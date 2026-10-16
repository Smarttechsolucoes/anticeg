-- N0 (v3, ESTRUTURAL) — CRIA A TABELA public.notifications COMPLETAMENTE FECHADA. Nenhuma função, nenhuma policy, nenhum acesso de visitante ou logado.
-- Estado: ela NÃO consta em public no AUD_01/AUD_02 (16/10); o site a usa desde 17/06 e o J4c-4c ABORTA sem ela. HISTÓRICO ANTERIOR DESCONHECIDO: este script não presume exclusão, não recria dados e recusa se a tabela já existir.
-- POR QUE ESTRUTURAL: sem login geral, o @ é a única identidade e ele é público. Qualquer função "por @" (ver as versões anteriores) deixaria um visitante ler e marcar como lidas as notificações de outra joiner
--   só informando o @ dela (provado em teste local). Então NÃO se cria função alguma e NÃO se abre a tabela: o isolamento por CONTA chega com o J4c-4c (policies com cog_e_da_conta), que encontra a tabela pronta.
-- Efeito no site hoje: NENHUM (as chamadas diretas continuam falhando como hoje; nada é armazenado nem exposto). Efeito no lançamento: o J4c-4c deixa de abortar por falta da tabela.
-- Aditivo: só cria a tabela e um índice. Tudo em uma transação com registro e conferência: qualquer guarda que falhe = "Nada foi alterado".
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
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('minhas_notificacoes', 'marcar_notificacao_lida')) then
    raise exception 'Existe função minhas_notificacoes/marcar_notificacao_lida (versão antiga do N0). Nada foi alterado.';
  end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('N0', 'public.notifications', 'não existia antes do N0 (v3 estrutural: sem funções, sem policies)');

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

-- nada para visitante nem logado; só o servidor (service_role); sem policies (RLS ligado + nenhuma policy = ninguém mais passa)
revoke all on table public.notifications from public, anon, authenticated;
grant all on table public.notifications to service_role;
alter table public.notifications owner to postgres;

do $$
declare n integer;
begin
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'notifications';
  if n <> 0 then raise exception 'Esperava 0 policies em notifications e achei %. Transação desfeita.', n; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass) then raise exception 'RLS não ficou ligado. Transação desfeita.'; end if;
  if has_table_privilege('anon', 'public.notifications', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('anon', 'public.notifications', 'SELECT,INSERT,UPDATE,REFERENCES')
     or has_table_privilege('authenticated', 'public.notifications', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('authenticated', 'public.notifications', 'SELECT,INSERT,UPDATE,REFERENCES') then
    raise exception 'Visitante ou logado têm privilégio em notifications. Transação desfeita.';
  end if;
  if not has_table_privilege('service_role', 'public.notifications', 'SELECT,INSERT,UPDATE,DELETE') then raise exception 'O servidor (service_role) não acessa notifications. Transação desfeita.'; end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('minhas_notificacoes', 'marcar_notificacao_lida')) then raise exception 'Foi criada função pública. Transação desfeita.'; end if;
end $$;

commit;
