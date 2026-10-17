-- J4c-4a — MERCARI, LOJINHA E REPASSES PROTEGIDOS PELO BANCO: mercari_pedidos, lojinha_repasses, repassos
-- Hoje qualquer visitante lê (e altera) pedidos do Mercari (nome, links, comprovante, valores), a lojinha inteira (nome e WHATSAPP de cada vendedora) e os repasses entre joiners.
-- Depois deste passo:
--   mercari_pedidos  : a joiner logada lê e CRIA só os próprios pedidos (nascem 'pendente'); aprovar/recusar/pagar/finalizar/cancelar é só da administradora. Visitante: nada.
--   lojinha_repasses : joiner logada com conta ATIVADA vê os itens 'disponivel' (vitrine, com o contato da vendedora) e tudo que é dela ou foi reservado para ela;
--                      cria e edita só os próprios (não troca de dono, id nem data); administradora tudo. Visitante: nada.
--   repassos         : a joiner lê os repasses em que ela é quem repassa OU quem recebe; cria os próprios (nascem 'pendente'); só consegue CANCELAR o próprio repasse pendente;
--                      aprovar/recusar/reabrir e definir novo dono é só da administradora. Visitante: nada.
-- Nada de dado é alterado/apagado. As permissões do visitante saem e NENHUMA é copiada para a conta logada.
-- ⚠ APLICAR SOMENTE NO LANÇAMENTO, junto com o site novo no ar (VITE_JOINERS_AUTH ligado) e depois do J1, J4-0, J4a e J4c-1/2/3. O site de hoje depende do acesso de visitante.
-- Tudo em uma transação com registro do estado anterior e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare n integer; t text;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-4a') then raise exception 'J4c-4a já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.meu_cog()') is null or to_regprocedure('public.is_admin()') is null then raise exception 'J1/A1 não estão aplicados. Nada foi alterado.'; end if;
  if to_regprocedure('public.cog_e_da_conta(text)') is null then raise exception 'O J4a não está aplicado (falta cog_e_da_conta). Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há administradora cadastrada. Nada foi alterado.'; end if;
  foreach t in array array['mercari_pedidos', 'lojinha_repasses', 'repassos'] loop
    if to_regclass('public.' || t) is null then raise exception 'A tabela % não existe. Nada foi alterado.', t; end if;
  end loop;
  select count(*) into n from pg_attribute where attrelid = 'public.mercari_pedidos'::regclass and not attisdropped and attname in ('id', 'joiner_cog', 'status', 'comprovante_url', 'itens', 'created_at');
  if n <> 6 then raise exception 'mercari_pedidos sem as colunas esperadas (achei % de 6). Nada foi alterado.', n; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.lojinha_repasses'::regclass and not attisdropped and attname in ('id', 'joiner_cog', 'status', 'reservado_para', 'whatsapp', 'created_at');
  if n <> 6 then raise exception 'lojinha_repasses sem as colunas esperadas (achei % de 6). Nada foi alterado.', n; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.repassos'::regclass and not attisdropped and attname in ('id', 'joiner_cog', 'novo_dono_cog', 'status', 'created_at');
  if n <> 5 then raise exception 'repassos sem as colunas esperadas (achei % de 5). Nada foi alterado.', n; end if;
end $$;

-- estado ANTERIOR (policies para recriar exatamente, permissões e impressão dos dados)
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4a', 'policy ' || tablename || ' / ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'public' and tablename in ('mercari_pedidos', 'lojinha_repasses', 'repassos');
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4a', 'acl ' || c.relname, coalesce(c.relacl::text, '(padrão do dono)') from pg_class c
 where c.oid in ('public.mercari_pedidos'::regclass, 'public.lojinha_repasses'::regclass, 'public.repassos'::regclass);
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4a', 'rls ' || c.relname, case when c.relrowsecurity then 'ligado' else 'desligado' end from pg_class c
 where c.oid in ('public.mercari_pedidos'::regclass, 'public.lojinha_repasses'::regclass, 'public.repassos'::regclass);
do $$
declare t text; v text;
begin
  foreach t in array array['mercari_pedidos', 'lojinha_repasses', 'repassos'] loop
    execute format('select ''linhas='' || count(*) || '' md5='' || md5(coalesce(string_agg(id::text || coalesce(status, ''''), '','' order by id::text), '''')) from public.%I', t) into v;
    insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('J4c-4a', 'impressão ' || t, v);
  end loop;
end $$;

-- 1) RLS ligado e fora TODAS as policies antigas
alter table public.mercari_pedidos enable row level security;
alter table public.lojinha_repasses enable row level security;
alter table public.repassos enable row level security;
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('mercari_pedidos', 'lojinha_repasses', 'repassos') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) visitante: nenhuma permissão. Conta logada: as policies decidem as LINHAS; os gatilhos (abaixo) decidem os CAMPOS.
revoke all on table public.mercari_pedidos, public.lojinha_repasses, public.repassos from anon, public;
grant select, insert, update, delete on table public.mercari_pedidos, public.lojinha_repasses, public.repassos to authenticated;

-- 3) policies
create policy admin_tudo on public.mercari_pedidos for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_proprios on public.mercari_pedidos for select to authenticated using (public.cog_e_da_conta(joiner_cog));
create policy joiner_cria_proprio on public.mercari_pedidos for insert to authenticated
  with check (public.cog_e_da_conta(joiner_cog) and coalesce(status, 'pendente') = 'pendente');

create policy admin_tudo on public.lojinha_repasses for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy vitrine_ativadas on public.lojinha_repasses for select to authenticated using (status = 'disponivel' and (select public.meu_cog()) is not null);
create policy joiner_le_proprios on public.lojinha_repasses for select to authenticated using (public.cog_e_da_conta(joiner_cog) or public.cog_e_da_conta(reservado_para));
create policy joiner_cria_proprio on public.lojinha_repasses for insert to authenticated
  with check (public.cog_e_da_conta(joiner_cog) and coalesce(status, 'disponivel') = 'disponivel');
create policy joiner_edita_proprio on public.lojinha_repasses for update to authenticated
  using (public.cog_e_da_conta(joiner_cog)) with check (public.cog_e_da_conta(joiner_cog));

create policy admin_tudo on public.repassos for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_proprios on public.repassos for select to authenticated using (public.cog_e_da_conta(joiner_cog) or public.cog_e_da_conta(novo_dono_cog));
create policy joiner_cria_proprio on public.repassos for insert to authenticated
  with check (public.cog_e_da_conta(joiner_cog) and coalesce(status, 'pendente') = 'pendente');
create policy joiner_cancela_proprio on public.repassos for update to authenticated
  using (public.cog_e_da_conta(joiner_cog) and status = 'pendente')
  with check (public.cog_e_da_conta(joiner_cog) and status = 'cancelado');

-- 4) gatilhos de campos (para quem NÃO é administradora; o servidor, sem auth.uid(), segue livre)
create function public.trg_lojinha_protege() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.id is distinct from old.id or new.joiner_cog is distinct from old.joiner_cog or new.created_at is distinct from old.created_at then
    raise exception 'Alteração não permitida neste item da lojinha.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.trg_lojinha_protege() from public, anon, authenticated;
create trigger trg_lojinha_protege before update on public.lojinha_repasses for each row execute function public.trg_lojinha_protege();

create function public.trg_repassos_protege() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Alteração não permitida: só a administradora altera os dados do repasse.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.trg_repassos_protege() from public, anon, authenticated;
create trigger trg_repassos_protege before update on public.repassos for each row execute function public.trg_repassos_protege();

-- 5) conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_a text; v_d text; t text;
begin
  select count(*) into n from (values ('public.mercari_pedidos'), ('public.lojinha_repasses'), ('public.repassos')) x(nome)
   where has_table_privilege('anon', x.nome, 'SELECT') or has_table_privilege('anon', x.nome, 'INSERT') or has_table_privilege('anon', x.nome, 'UPDATE') or has_table_privilege('anon', x.nome, 'DELETE')
      or has_any_column_privilege('anon', x.nome, 'SELECT') or has_any_column_privilege('anon', x.nome, 'UPDATE') or has_any_column_privilege('anon', x.nome, 'INSERT');
  if n > 0 then raise exception 'O visitante ainda tem permissão em alguma das 3 tabelas. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('mercari_pedidos', 'lojinha_repasses', 'repassos') and ('anon' = any(roles) or 'public' = any(roles));
  if n > 0 then raise exception 'Sobrou policy para visitante ou PUBLIC. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('mercari_pedidos', 'lojinha_repasses', 'repassos');
  if n <> 12 then raise exception 'Esperava 12 policies novas e há %. Transação desfeita.', n; end if;
  for t in select unnest(array['mercari_pedidos', 'lojinha_repasses', 'repassos']) loop
    select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'J4c-4a' and objeto = 'impressão ' || t;
    execute format('select ''linhas='' || count(*) || '' md5='' || md5(coalesce(string_agg(id::text || coalesce(status, ''''), '','' order by id::text), '''')) from public.%I', t) into v_d;
    if v_a is distinct from v_d then raise exception 'Os dados de % mudaram durante o script. Transação desfeita.', t; end if;
  end loop;
end $$;

commit;
