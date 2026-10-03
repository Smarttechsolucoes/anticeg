create table if not exists pedidos_singba (
  id               bigserial primary key,
  nome             text not null,
  contato          text not null,
  joiner_cog       text,
  comprovante_url  text,
  status           text not null default 'aguardando',
  metodo_pagamento text not null default 'pix',
  itens            jsonb not null default '[]'::jsonb,
  quantidade       integer not null default 0,
  valor_total      numeric(10,2),
  created_at       timestamptz not null default now()
);

alter table pedidos_singba enable row level security;

-- Formulário público: qualquer pessoa pode inserir
create policy "insert_publico" on pedidos_singba
  for insert with check (true);

-- Painel admin (mesmo padrão de pedidos_popcorn_sleeve, que usa a chave anon)
create policy "select_admin" on pedidos_singba
  for select using (true);

create policy "update_admin" on pedidos_singba
  for update using (true);
