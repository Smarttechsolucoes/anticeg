-- Tabela de grupos de envio compartilhado
-- Rode no SQL Editor do Supabase (painel → SQL Editor → New query)

create table if not exists grupos_envio (
  codigo       text primary key,
  host_cog     text not null,
  destinatario text,
  cpf          text,
  cep          text,
  endereco     text,
  numero       text,
  complemento  text,
  bairro       text,
  cidade       text,
  estado       text,
  created_at   timestamptz default now()
);

alter table grupos_envio enable row level security;

drop policy if exists "grupos_envio_select" on grupos_envio;
drop policy if exists "grupos_envio_insert" on grupos_envio;
drop policy if exists "grupos_envio_update" on grupos_envio;

create policy "grupos_envio_select" on grupos_envio
  for select using (true);

create policy "grupos_envio_insert" on grupos_envio
  for insert with check (true);

create policy "grupos_envio_update" on grupos_envio
  for update using (true) with check (true);

-- Adicionar código de grupo à tabela de solicitações
alter table envio_solicitacoes
  add column if not exists grupo_envio_codigo text;
