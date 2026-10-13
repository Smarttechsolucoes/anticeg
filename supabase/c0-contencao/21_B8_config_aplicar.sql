-- C0-B8 — TABELA config: só administrador (login) grava; visitantes só leem as chaves públicas
-- Hoje qualquer visitante, com a chave pública do site, cria, altera e apaga linhas da config (manutenção do site, equipe, avisos, PIN...).
-- Depois deste script:
--   * visitante (anon) e conta comum (authenticated): só LEEM as chaves públicas. Ficam ocultas admin_pin, senha_disponiveis e senha_manutencao.
--   * quem grava (e lê tudo): conta de administrador (public.is_admin(): cadastrada em admin_roles e logada). service_role mantém tudo.
-- Nenhuma linha é alterada ou apagada (conferido por contagem e hash dentro da transação).
-- PRÉ-REQUISITO: o site que grava a config pelo login de administrador (PR "config via admin") precisa estar no ar ANTES deste script.
-- Tudo em uma transação com registro do estado anterior e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;

create table if not exists emergencia.c0b_estado_anterior (
  id            bigint generated always as identity primary key,
  registrado_em timestamptz not null default now(),
  etapa         text not null,
  objeto        text not null,
  detalhe       text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare n integer;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B8') then
    raise exception 'C0-B8 já foi aplicada: o estado anterior já está registrado e não será sobrescrito.';
  end if;
  if to_regclass('public.config') is null then raise exception 'public.config não existe. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.config'::regclass and attname in ('key', 'value') and not attisdropped;
  if n <> 2 then raise exception 'Esperava as colunas key e value em public.config. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'public.is_admin() não existe (A1/A2 não aplicados). Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há nenhum administrador em admin_roles: ninguém conseguiria gravar a config. Nada foi alterado.'; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then raise exception 'O papel service_role não existe. Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR: RLS, permissões da tabela, TODAS as policies (para recriar exatamente) e a impressão dos dados
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B8', 'config: rls=' || relrowsecurity::text, coalesce(relacl::text, '(padrão do dono)') from pg_class where oid = 'public.config'::regclass;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B8', 'policy ' || policyname,
       json_build_object('cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'public' and tablename = 'config';

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B8', 'impressão da config',
       'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(key || '=' || coalesce(value, E'\001null'), E'\n' order by key), ''))
from public.config;

-- 1) RLS ligado e fora TODAS as policies antigas
alter table public.config enable row level security;
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'config' loop
    execute format('drop policy %I on public.config', r.policyname);
  end loop;
end $$;

-- 2) permissões: visitante só lê; escrita (e TRUNCATE) saem de anon/PUBLIC, inclusive por coluna
revoke insert, update, delete, truncate, references, trigger on table public.config from anon, public;
revoke truncate, references, trigger on table public.config from authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into cols from pg_attribute where attrelid = 'public.config'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke insert (%s), update (%s), references (%s) on public.config from anon, authenticated, public', cols, cols, cols);
end $$;
grant select on table public.config to anon, authenticated;
grant insert, update, delete on table public.config to authenticated;   -- a policy abaixo deixa passar só administrador
grant select, insert, update, delete on table public.config to service_role;

-- 3) as duas policies novas
create policy config_leitura_publica on public.config for select to anon, authenticated
  using (key not in ('admin_pin', 'senha_disponiveis', 'senha_manutencao'));
create policy config_admin on public.config for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_antes text; v_depois text;
begin
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'config';
  if n <> 2 then raise exception 'Esperava exatamente 2 policies em config e há %. Transação desfeita.', n; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.config'::regclass) then raise exception 'RLS desligado em config. Transação desfeita.'; end if;

  select count(*) into n from (values ('anon')) r(rolname)
   where has_table_privilege(r.rolname, 'public.config', 'INSERT') or has_table_privilege(r.rolname, 'public.config', 'UPDATE')
      or has_table_privilege(r.rolname, 'public.config', 'DELETE') or has_table_privilege(r.rolname, 'public.config', 'TRUNCATE')
      or has_any_column_privilege(r.rolname, 'public.config', 'INSERT') or has_any_column_privilege(r.rolname, 'public.config', 'UPDATE');
  if n > 0 then raise exception 'anon ainda pode escrever na config (tabela ou coluna). Transação desfeita.'; end if;
  if has_table_privilege('authenticated', 'public.config', 'TRUNCATE') then raise exception 'authenticated ainda pode TRUNCATE. Transação desfeita.'; end if;

  if not (has_table_privilege('anon', 'public.config', 'SELECT') and has_table_privilege('authenticated', 'public.config', 'SELECT')) then
    raise exception 'anon/authenticated perderam a leitura da config (o site precisa). Transação desfeita.';
  end if;
  if not (has_table_privilege('service_role', 'public.config', 'INSERT') and has_table_privilege('service_role', 'public.config', 'UPDATE')
          and has_table_privilege('service_role', 'public.config', 'DELETE') and has_table_privilege('service_role', 'public.config', 'SELECT')) then
    raise exception 'service_role perdeu permissão na config. Transação desfeita.';
  end if;

  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'B8' and objeto = 'impressão da config';
  select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(key || '=' || coalesce(value, E'\001null'), E'\n' order by key), ''))
    into v_depois from public.config;
  if v_antes is distinct from v_depois then raise exception 'A config mudou durante o script (% -> %). Transação desfeita.', v_antes, v_depois; end if;
end $$;

commit;
