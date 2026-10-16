-- N0 — CRIA A TABELA public.notifications. Estado: ela NÃO consta em public no AUD_01 (16/10) nem no diagnóstico de 12-13/10; o site a usa desde 17/06 (insert/select/update) e o J4c-4c ABORTA sem ela.
-- HISTÓRICO ANTERIOR DESCONHECIDO: não há migration nem SQL no repositório que a crie, e não se sabe se já existiu (se existiu e foi removida, os dados antigos não estão aqui). Este script NÃO presume exclusão e não recria dados.
-- Aditivo: só cria tabela nova (nenhuma tabela, permissão ou dado existente é tocado); se a tabela já existir ele recusa.
-- Colunas = as que o site usa (insert: joiner_cog, message, type, report_id; leitura: *; update: só read_at).
-- Permissões = o MÍNIMO que o site atual usa com a chave pública: ler, criar e marcar como lida (UPDATE só na coluna read_at). Sem DELETE.
-- Isso é o modelo "aberto" de hoje, igual às demais tabelas; o J4c-4c (lançamento) troca por policies por joiner (a joiner só lê as próprias; criar é da administradora/servidor).
-- Tudo em uma transação com registro e conferência: qualquer guarda que falhe = "Nada foi alterado".
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
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('N0', 'public.notifications', 'não existia antes do N0');

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

revoke all on table public.notifications from public, anon, authenticated;
grant select, insert on table public.notifications to anon, authenticated;
grant update (read_at) on table public.notifications to anon, authenticated;
grant all on table public.notifications to service_role;

create policy notifications_ler        on public.notifications for select to anon, authenticated using (true);
create policy notifications_criar      on public.notifications for insert to anon, authenticated with check (true);
create policy notifications_marcar_lida on public.notifications for update to anon, authenticated using (true) with check (true);

do $$
declare n integer;
begin
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'notifications';
  if n <> 3 then raise exception 'Esperava 3 policies em notifications e achei %. Transação desfeita.', n; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass) then raise exception 'RLS não ficou ligado. Transação desfeita.'; end if;
  if has_table_privilege('anon', 'public.notifications', 'DELETE') or has_table_privilege('authenticated', 'public.notifications', 'DELETE') or has_table_privilege('anon', 'public.notifications', 'TRUNCATE') then
    raise exception 'Visitante/logado têm DELETE ou TRUNCATE em notifications. Transação desfeita.';
  end if;
  if has_column_privilege('anon', 'public.notifications', 'message', 'UPDATE') or has_column_privilege('anon', 'public.notifications', 'joiner_cog', 'UPDATE') then
    raise exception 'O visitante pode alterar colunas além de read_at. Transação desfeita.';
  end if;
  if not has_column_privilege('anon', 'public.notifications', 'read_at', 'UPDATE') then raise exception 'O visitante não consegue marcar como lida. Transação desfeita.'; end if;
end $$;

commit;
