-- Pedidos do formulário BAZAAR V (/bazaar-v) — Harper's Bazaar Korea, dezembro/2026, 6 versões (A a F).
-- Pedidos até 13/11, pagamento até 20/11, envio internacional previsto 15/12. R$ 70 por unidade.
--
-- ATENÇÃO (corrigido em 10/11/2026): a primeira versão deste arquivo criava regras abertas ao público (select/update/insert para qualquer visitante),
-- como nos drops antigos. Em produção as tabelas de pedidos são fechadas e o pedido é criado pela função pedido_loja_criar(), que só aceita as
-- tabelas da lista dela. Por isso o formulário dava "Não foi possível registrar o pedido".
-- Se a tabela ainda não existe: rode ESTE arquivo e DEPOIS pedidos_bazaar_v_liberar_e_fechar.sql (acrescenta a tabela à lista da função e cria as regras seguras).
-- Se a tabela já existe com as regras antigas: rode só pedidos_bazaar_v_liberar_e_fechar.sql.

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

-- Segurança por linha ligada e SEM regra nenhuma: a tabela nasce fechada. As regras (administradora e a própria pessoa) vêm no outro arquivo.
alter table pedidos_bazaar_v enable row level security;
