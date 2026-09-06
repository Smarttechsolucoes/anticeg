create table if not exists pedidos_lightstick (
  id          bigserial primary key,
  nome        text not null,
  contato     text not null,
  comprovante_url text,
  status      text not null default 'aguardando',
  created_at  timestamptz not null default now()
);

alter table pedidos_lightstick enable row level security;

-- Qualquer pessoa pode inserir (formulário público)
create policy "insert_publico" on pedidos_lightstick
  for insert with check (true);

-- Só admins leem (ajuste conforme seu auth)
create policy "select_admin" on pedidos_lightstick
  for select using (auth.role() = 'service_role');
