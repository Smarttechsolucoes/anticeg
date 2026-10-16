-- N0 (v2, FECHADA) — CRIA A TABELA public.notifications SEM EXPOR NADA. Estado: ela NÃO consta em public no AUD_01/AUD_02 (16/10); o site a usa desde 17/06 (insert/select/update) e o J4c-4c ABORTA sem ela.
-- HISTÓRICO ANTERIOR DESCONHECIDO: não há migration nem SQL no repositório que a crie; este script NÃO presume exclusão, não recria dados e recusa se a tabela já existir.
-- POR QUE FECHADA: a versão anterior (policies abertas) deixava qualquer visitante LISTAR as notificações de todas as joiners, lê-las só informando o @ e CRIAR notificações falsas (phishing). Antes do N0 nada é armazenado;
--   abrir a tabela aumentaria a exposição. Esta versão:
--     ☆ visitante e logado: NENHUM privilégio direto na tabela (nem ler, nem alterar, nem apagar);
--     ☆ quem CRIA notificação: só administradora (INSERT para authenticated com policy is_admin(); o painel passa a usar a sessão de admin);
--     ☆ a joiner LÊ só as NÃO LIDAS do @ informado, pela função minhas_notificacoes(@) (no máximo 20, sem listagem entre joiners, sem curinga) e as marca como lidas por marcar_notificacao_lida(id, @), que só vale se o id for desse @;
--     ☆ o isolamento por CONTA (a joiner só vê as dela, provado pelo login) chega com o J4c-4c, que troca estas regras; enquanto o site funciona só com o @ (modo visitante), o @ é a única identidade possível.
-- Sem mudança no site até o PR do front: antes dele, as chamadas diretas à tabela continuam falhando como hoje (nenhum comportamento novo, nenhuma exposição); o N0 só destrava o J4c-4c e prepara a função.
-- Aditivo: só cria objetos novos (tabela + 2 funções). Tudo em uma transação com registro e conferência: qualquer guarda que falhe = "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'N0') then raise exception 'N0 já foi aplicado. Nada foi alterado.'; end if;
  if to_regclass('public.notifications') is not null then raise exception 'public.notifications já existe (não vou recriar nem alterar). Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'public.is_admin() não existe (A1/A2). Nada foi alterado.'; end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('minhas_notificacoes', 'marcar_notificacao_lida')) then raise exception 'Já existe função minhas_notificacoes/marcar_notificacao_lida. Nada foi alterado.'; end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('N0', 'public.notifications + minhas_notificacoes + marcar_notificacao_lida', 'não existiam antes do N0');

create table public.notifications (
  id         bigint generated always as identity primary key,
  joiner_cog text,
  message    text,
  type       text,
  report_id  bigint,   -- o painel grava o id do report ao avisar que foi resolvido (src/App.jsx: type 'report_resolved')
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_cog_idx on public.notifications (joiner_cog, created_at desc);
alter table public.notifications enable row level security;

-- nada direto para visitante/logado; só a administradora cria
revoke all on table public.notifications from public, anon, authenticated;
grant insert on table public.notifications to authenticated;
grant all on table public.notifications to service_role;
create policy notifications_admin_cria on public.notifications for insert to authenticated with check ((select public.is_admin()));

-- leitura das NÃO LIDAS de UM @ (exato), no máximo 20, mais recentes primeiro
create function public.minhas_notificacoes(p_cog text)
returns setof public.notifications language sql stable security definer set search_path = '' as $$
  select n.* from public.notifications n
   where nullif(btrim(coalesce(p_cog, '')), '') is not null and n.joiner_cog = p_cog and n.read_at is null
   order by n.created_at desc, n.id desc limit 20
$$;
revoke all on function public.minhas_notificacoes(text) from public, anon, authenticated;
grant execute on function public.minhas_notificacoes(text) to anon, authenticated, service_role;

-- marca UMA notificação como lida, só se ela for desse @ (devolve true se marcou)
create function public.marcar_notificacao_lida(p_id bigint, p_cog text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_n integer;
begin
  if p_id is null or nullif(btrim(coalesce(p_cog, '')), '') is null then return false; end if;
  update public.notifications set read_at = now() where id = p_id and joiner_cog = p_cog and read_at is null;
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$;
revoke all on function public.marcar_notificacao_lida(bigint, text) from public, anon, authenticated;
grant execute on function public.marcar_notificacao_lida(bigint, text) to anon, authenticated, service_role;

alter function public.minhas_notificacoes(text) owner to postgres;
alter function public.marcar_notificacao_lida(bigint, text) owner to postgres;

do $$
declare n integer;
begin
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'notifications';
  if n <> 1 then raise exception 'Esperava 1 policy em notifications e achei %. Transação desfeita.', n; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass) then raise exception 'RLS não ficou ligado. Transação desfeita.'; end if;
  if has_table_privilege('anon', 'public.notifications', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_any_column_privilege('anon', 'public.notifications', 'SELECT,INSERT,UPDATE,REFERENCES') then
    raise exception 'O visitante tem privilégio direto em notifications. Transação desfeita.';
  end if;
  if has_table_privilege('authenticated', 'public.notifications', 'SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_any_column_privilege('authenticated', 'public.notifications', 'SELECT,UPDATE,REFERENCES') then
    raise exception 'O logado tem privilégio de leitura/alteração direto em notifications. Transação desfeita.';
  end if;
  if not has_table_privilege('authenticated', 'public.notifications', 'INSERT') then raise exception 'A administradora logada não consegue inserir. Transação desfeita.'; end if;
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('minhas_notificacoes', 'marcar_notificacao_lida')
     and p.prosecdef and p.proconfig = array['search_path=""'] and pg_get_userbyid(p.proowner) = 'postgres'
     and has_function_privilege('anon', p.oid, 'EXECUTE') and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if n <> 2 then raise exception 'As funções não estão como esperado (security definer, search_path vazio, dono postgres, execução para anon/authenticated). Transação desfeita.'; end if;
end $$;

commit;
