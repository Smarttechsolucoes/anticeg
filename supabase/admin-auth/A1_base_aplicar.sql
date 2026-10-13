-- A1 — IDENTIDADE DE ADMINISTRADOR NO BANCO (aditivo: não fecha nem muda nenhuma tabela existente)
-- Cria public.admin_roles (quem é admin) e public.is_admin() (verdadeiro SOMENTE para um admin cadastrado com sessão MFA, nível aal2).
-- * Ninguém lê nem escreve admin_roles pela API (sem policies, sem privilégios para anon/authenticated). A dona cadastra admins pelo SQL Editor.
-- * is_admin() é a única fonte de verdade que as policies e funções das próximas etapas vão usar (SECURITY DEFINER, search_path vazio).
-- * Impacto no site: nenhum até as próximas etapas usarem is_admin().
-- Tudo em uma transação com registro e verificação antes do COMMIT. Reversão: A1_reverter_protegido.sql.
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
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'A1') then
    raise exception 'A1 já foi aplicada: o registro já existe e não será sobrescrito.';
  end if;
  if to_regclass('auth.users') is null then raise exception 'auth.users não existe: Supabase Auth não está disponível. Nada foi alterado.'; end if;
  if to_regprocedure('auth.uid()') is null or to_regprocedure('auth.jwt()') is null then
    raise exception 'auth.uid() / auth.jwt() não existem. Nada foi alterado.';
  end if;
  if to_regclass('public.admin_roles') is not null then
    raise exception 'public.admin_roles já existe: revise antes de continuar. Nada foi alterado.';
  end if;
  if to_regprocedure('public.is_admin()') is not null then
    raise exception 'public.is_admin() já existe: revise antes de continuar. Nada foi alterado.';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'O papel service_role não existe neste banco. Nada foi alterado.';
  end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
values ('A1', 'public.admin_roles', 'não existia (criada pelo A1)'),
       ('A1', 'public.is_admin()', 'não existia (criada pelo A1)');

create table public.admin_roles (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  papel     text        not null default 'admin' check (papel in ('admin')),
  criado_em timestamptz not null default now()
);
alter table public.admin_roles enable row level security;
revoke all on table public.admin_roles from public, anon, authenticated;
grant select on table public.admin_roles to service_role;
-- (sem policies: ninguém lê/escreve pela API; is_admin() consulta como dono)

create function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = (select auth.uid())
      and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  )
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.admin_roles'::regclass) then
    raise exception 'RLS desligado em admin_roles. Transação desfeita.';
  end if;
  select count(*) into n from (values ('anon'), ('authenticated')) as r(rolname)
   where has_table_privilege(r.rolname, 'public.admin_roles', 'SELECT')
      or has_table_privilege(r.rolname, 'public.admin_roles', 'INSERT')
      or has_table_privilege(r.rolname, 'public.admin_roles', 'UPDATE')
      or has_table_privilege(r.rolname, 'public.admin_roles', 'DELETE')
      or has_any_column_privilege(r.rolname, 'public.admin_roles', 'SELECT')
      or has_any_column_privilege(r.rolname, 'public.admin_roles', 'INSERT');
  if n > 0 then raise exception 'anon/authenticated ainda têm acesso a admin_roles. Transação desfeita.'; end if;
  if not (select prosecdef from pg_proc where oid = 'public.is_admin()'::regprocedure) then
    raise exception 'is_admin() não é SECURITY DEFINER. Transação desfeita.';
  end if;
  if (select proconfig from pg_proc where oid = 'public.is_admin()'::regprocedure) is distinct from array['search_path=""'] then
    raise exception 'is_admin() sem search_path vazio. Transação desfeita.';
  end if;
  if not (has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') and has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')) then
    raise exception 'anon/authenticated não podem executar is_admin() (o front e as policies precisam). Transação desfeita.';
  end if;
  if has_function_privilege('public', 'public.is_admin()', 'EXECUTE') and not has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') then
    raise exception 'Permissões de is_admin() inconsistentes. Transação desfeita.';
  end if;
end $$;

commit;
