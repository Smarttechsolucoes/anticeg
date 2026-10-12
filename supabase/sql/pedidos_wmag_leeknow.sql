create table if not exists pedidos_wmag_leeknow (
  id              bigserial primary key,
  nome            text not null,
  email           text not null,
  social          text,
  capa_a          int not null default 0,
  capa_b          int not null default 0,
  capa_c          int not null default 0,
  qtd_total       int not null default 0,
  valor_total     numeric not null default 0,
  forma_pagamento text,
  comprovante_url text,
  status          text not null default 'aguardando',
  created_at      timestamptz not null default now()
);

alter table pedidos_wmag_leeknow enable row level security;

-- Qualquer pessoa pode inserir (formulário público)
create policy "insert_publico" on pedidos_wmag_leeknow
  for insert with check (true);

-- Painel admin lê e atualiza com a chave anon, como nos outros drops
create policy "select_todos" on pedidos_wmag_leeknow
  for select using (true);

create policy "update_todos" on pedidos_wmag_leeknow
  for update using (true);
