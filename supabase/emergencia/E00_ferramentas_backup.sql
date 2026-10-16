-- ============================================================================
-- E00 — FERRAMENTAS DE BACKUP E REVERSÃO  (ADITIVO, não muda nenhum acesso)
-- ============================================================================
-- Cria o schema "emergencia" (NÃO exposto pela API: anon/authenticated sem acesso)
-- com tabelas que guardam o estado ORIGINAL de permissões e policies antes de cada
-- etapa, e funções auxiliares usadas pelos scripts de reversão.
--
-- Impacto no site: nenhum. Reversão: drop schema emergencia cascade
-- (NÃO faça isso antes de concluir todas as etapas: apaga o backup).
-- Seguro rodar mais de uma vez.
-- ============================================================================

begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;

create table if not exists emergencia.grant_backup (
  id             bigint generated always as identity primary key,
  etapa          text        not null,
  feito_em       timestamptz not null default now(),
  tabela         text        not null,
  grantee        text        not null,   -- 'PUBLIC', 'anon', 'authenticated'
  privilege_type text        not null,
  coluna         text                    -- null = privilégio da tabela; preenchido = privilégio só dessa coluna
);

create table if not exists emergencia.policy_backup (
  id         bigint generated always as identity primary key,
  etapa      text        not null,
  feito_em   timestamptz not null default now(),
  tablename  text        not null,
  policyname text        not null,
  permissive text        not null,       -- PERMISSIVE | RESTRICTIVE
  roles      text[]      not null,
  cmd        text        not null,       -- SELECT | INSERT | UPDATE | DELETE | ALL
  qual       text,
  with_check text
);

create table if not exists emergencia.rls_backup (
  id         bigint generated always as identity primary key,
  etapa      text        not null,
  feito_em   timestamptz not null default now(),
  tablename  text        not null,
  rls_ligado boolean     not null,
  rls_forcado boolean    not null
);

alter table emergencia.grant_backup  enable row level security;
alter table emergencia.rls_backup    enable row level security;
alter table emergencia.policy_backup enable row level security;
revoke all on all tables in schema emergencia from public, anon, authenticated;

-- Guarda as policies atuais de uma tabela sob o nome de uma etapa.
-- Recusa sobrescrever um backup que já existe para (etapa, tabela): isso evitaria
-- salvar o estado JÁ alterado por cima do original.
create or replace function emergencia.salvar_policies(p_etapa text, p_tabela text)
returns integer language plpgsql set search_path = '' as $$
declare n integer;
begin
  if exists (select 1 from emergencia.rls_backup where etapa = p_etapa and tablename = p_tabela) then
    raise exception 'Backup de policies de % já existe para a etapa %. Reverta antes de reaplicar.', p_tabela, p_etapa;
  end if;
  insert into emergencia.rls_backup (etapa, tablename, rls_ligado, rls_forcado)
  select p_etapa, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relname = p_tabela;
  insert into emergencia.policy_backup (etapa, tablename, policyname, permissive, roles, cmd, qual, with_check)
  select p_etapa, tablename, policyname, permissive, roles::text[], cmd, qual, with_check
  from pg_policies where schemaname = 'public' and tablename = p_tabela;
  get diagnostics n = row_count;
  return n;
end $$;

-- Remove TODAS as policies de uma tabela (use só depois de salvar_policies).
create or replace function emergencia.remover_policies(p_tabela text)
returns integer language plpgsql set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = p_tabela loop
    execute format('drop policy %I on public.%I', r.policyname, p_tabela);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Recria exatamente as policies salvas (e remove as policies novas da tabela antes).
create or replace function emergencia.restaurar_policies(p_etapa text, p_tabela text)
returns integer language plpgsql set search_path = '' as $$
declare r record; n integer := 0; sql text;
begin
  if not exists (select 1 from emergencia.rls_backup where etapa = p_etapa and tablename = p_tabela) then
    raise exception 'Não há backup de % para a etapa %.', p_tabela, p_etapa;
  end if;
  perform emergencia.remover_policies(p_tabela);
  for r in select * from emergencia.policy_backup where etapa = p_etapa and tablename = p_tabela order by id loop
    sql := format('create policy %I on public.%I as %s for %s to %s',
                  r.policyname, p_tabela, lower(r.permissive), lower(r.cmd), array_to_string(r.roles, ', '));
    if r.qual is not null then sql := sql || format(' using (%s)', r.qual); end if;
    if r.with_check is not null then sql := sql || format(' with check (%s)', r.with_check); end if;
    execute sql;
    n := n + 1;
  end loop;
  -- devolve o estado original do RLS (inclusive DESLIGADO, se era assim)
  select * into r from emergencia.rls_backup where etapa = p_etapa and tablename = p_tabela;
  execute format('alter table public.%I %s row level security', p_tabela, case when r.rls_ligado then 'enable' else 'disable' end);
  execute format('alter table public.%I %s row level security', p_tabela, case when r.rls_forcado then 'force' else 'no force' end);
  -- marca como revertido para permitir reaplicar a etapa no futuro
  update emergencia.rls_backup
     set etapa = p_etapa || '_revertida_' || to_char(now(), 'YYYYMMDDHH24MISS')
   where etapa = p_etapa and tablename = p_tabela;
  update emergencia.policy_backup
     set etapa = p_etapa || '_revertida_' || to_char(now(), 'YYYYMMDDHH24MISS')
   where etapa = p_etapa and tablename = p_tabela;
  return n;
end $$;

revoke all on function emergencia.salvar_policies(text, text)    from public, anon, authenticated;
revoke all on function emergencia.remover_policies(text)         from public, anon, authenticated;
revoke all on function emergencia.restaurar_policies(text, text) from public, anon, authenticated;

commit;
