-- C0-B8 (passo 0, TRANSIÇÃO) — a conta de administrador logada passa a poder ler e gravar a config
-- Hoje a única policy da config é anon_all (só para o papel anônimo). A conta de admin logada (papel authenticated) não tem policy nenhuma:
-- com RLS ligado ela não lê nem grava. Este passo ADICIONA uma policy só para administrador (public.is_admin()).
-- É aditivo: não remove nada, não reabre nada. O visitante continua como hoje (o fechamento dele é o passo 21).
-- Tudo em uma transação com registro e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
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
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B8-0') then
    raise exception 'B8-0 já foi aplicada: o registro já existe e não será sobrescrito.';
  end if;
  if to_regclass('public.config') is null then raise exception 'public.config não existe. Nada foi alterado.'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.config'::regclass) then raise exception 'RLS desligado em config. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'public.is_admin() não existe (A1/A2 não aplicados). Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há nenhum administrador em admin_roles. Nada foi alterado.'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'config' and policyname = 'config_admin') then
    raise exception 'A policy config_admin já existe. Nada foi alterado.';
  end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B8-0', 'policy ' || policyname, format('cmd=%s roles=%s using=%s check=%s', cmd, roles::text, coalesce(qual, 'null'), coalesce(with_check, 'null'))
from pg_policies where schemaname = 'public' and tablename = 'config';

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B8-0', 'impressão da config',
       'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(key || '=' || coalesce(value, E'\001null'), E'\n' order by key), ''))
from public.config;

create policy config_admin on public.config for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

do $$
declare n integer; v_antes text; v_depois text;
begin
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'config' and policyname = 'config_admin' and roles = array['authenticated']::name[];
  if n <> 1 then raise exception 'A policy config_admin não ficou como esperado. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'config' and policyname = 'anon_all';
  if n <> 1 then raise exception 'A policy anon_all mudou (o passo é só aditivo). Transação desfeita.'; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'B8-0' and objeto = 'impressão da config';
  select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(key || '=' || coalesce(value, E'\001null'), E'\n' order by key), ''))
    into v_depois from public.config;
  if v_antes is distinct from v_depois then raise exception 'A config mudou durante o script (% -> %). Transação desfeita.', v_antes, v_depois; end if;
end $$;

commit;
