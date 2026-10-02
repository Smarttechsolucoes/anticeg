create table if not exists pedidos_popcorn_sleeve (
  id              bigserial primary key,
  nome            text not null,
  contato         text not null,
  joiner_cog      text,
  comprovante_url text,
  status          text not null default 'aguardando',
  created_at      timestamptz not null default now()
);

alter table pedidos_popcorn_sleeve enable row level security;

-- Formulário público: qualquer pessoa pode inserir
create policy "insert_publico" on pedidos_popcorn_sleeve
  for insert with check (true);

-- Painel admin (mesmo padrão de pedidos_lightstick, que usa a chave anon)
create policy "select_admin" on pedidos_popcorn_sleeve
  for select using (true);

create policy "update_admin" on pedidos_popcorn_sleeve
  for update using (true);
