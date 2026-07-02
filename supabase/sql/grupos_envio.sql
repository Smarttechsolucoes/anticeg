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

-- Permitir que qualquer joiner logada leia e insira grupos
alter table grupos_envio enable row level security;

create policy "grupos_envio_select" on grupos_envio
  for select using (true);

create policy "grupos_envio_insert" on grupos_envio
  for insert with check (true);

-- Adicionar código de grupo à tabela de solicitações
alter table envio_solicitacoes
  add column if not exists grupo_envio_codigo text;
