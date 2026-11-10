-- Pedidos do formulário BAZAAR V (/bazaar-v) — Harper's Bazaar Korea, dezembro/2026, 6 versões (A a F).
-- Rode uma vez no SQL Editor do Supabase ANTES de publicar o formulário.
-- Pedidos até 13/11, pagamento até 20/11, envio internacional previsto 15/12. R$ 70 por unidade.

create table if not exists pedidos_bazaar_v (
  id              bigserial primary key,
  nome            text not null,
  email           text not null,
  social          text,
  capa_a          int not null default 0,
  capa_b          int not null default 0,
  capa_c          int not null default 0,
  capa_d          int not null default 0,
  capa_e          int not null default 0,
  capa_f          int not null default 0,
  qtd_total       int not null default 0,
  valor_total     numeric not null default 0,
  forma_pagamento text,
  comprovante_url text,
  status          text not null default 'aguardando',   -- aguardando | pendente | cartao_whatsapp | confirmado | cancelado
  created_at      timestamptz not null default now()
);

alter table pedidos_bazaar_v enable row level security;

-- Qualquer pessoa pode inserir (formulário público)
create policy "insert_publico" on pedidos_bazaar_v
  for insert with check (true);

-- Painel admin lê e atualiza com a chave anon, como nos outros drops
create policy "select_todos" on pedidos_bazaar_v
  for select using (true);

create policy "update_todos" on pedidos_bazaar_v
  for update using (true);
