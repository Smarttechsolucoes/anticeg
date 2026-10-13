-- Pedidos do formulário SMOL MERCH (/smolmerch).
-- Rode uma vez no SQL Editor do Supabase ANTES de publicar o formulário.
--
-- Cada pedido guarda os itens em `itens` (jsonb): [{ id, produto, opcao, preco, qtd }].
-- O id é gerado pelo formulário (uuid), então o site não precisa ler o pedido de volta depois de gravar.

create table if not exists pedidos_smolmerch (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  email           text not null,
  social          text,
  itens           jsonb not null default '[]'::jsonb,
  qtd_total       int not null default 0,
  valor_total     numeric not null default 0,
  forma_pagamento text,
  comprovante_url text,
  status          text not null default 'aguardando',   -- aguardando | pendente | cartao | confirmado | cancelado
  created_at      timestamptz not null default now()
);

alter table pedidos_smolmerch enable row level security;

-- Qualquer pessoa pode enviar um pedido (formulário público)
create policy "insert_publico" on pedidos_smolmerch
  for insert with check (true);

-- Painel admin lê e atualiza com a chave anon, como nos outros drops.
-- (Será fechado junto com os demais drops quando o login de admin estiver ativo.)
create policy "select_todos" on pedidos_smolmerch
  for select using (true);

create policy "update_todos" on pedidos_smolmerch
  for update using (true);
