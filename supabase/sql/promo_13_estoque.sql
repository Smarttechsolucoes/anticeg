-- Estoque do PROMO 13 (mesmo modelo de paper_tales_estoque). Pode rodar de novo a qualquer momento.
-- "estoque" = unidades disponíveis em "contar_desde".
-- O site desconta os pedidos (pendente + confirmado) criados depois dessa data;
-- pedido cancelado devolve a unidade. Quando chega a 0, o item fica INDISPONÍVEL.
-- ATENÇÃO: rodar de novo recomeça a contagem a partir de agora (pedidos antigos deixam de descontar).
create table if not exists promo_13_estoque (
  item_id       text primary key,
  estoque       integer     not null default 0,
  contar_desde  timestamptz not null default now()
);

alter table promo_13_estoque enable row level security;

drop policy if exists "select_publico" on promo_13_estoque;
create policy "select_publico" on promo_13_estoque
  for select using (true);

drop policy if exists "update_admin" on promo_13_estoque;
create policy "update_admin" on promo_13_estoque
  for update using (true);

delete from promo_13_estoque;

insert into promo_13_estoque (item_id, estoque) values
  ('AGENDA PAPER TALE',                11),
  ('DESK CALENDAR PAPER TALE',          8),
  ('OUTBOX PAPER TALE',                15),
  ('PHOTOBOOK PAPER TALE',             17),
  ('DESK CALENDAR WAVE MAKER',         10),
  ('OUTBOX WAVE MAKER',                 8),
  ('ID HOLDER WAVE MAKER',              3),
  ('KNAPSACK WAVE MAKER',               6),
  ('MAKING VIDEO QR CARD WAVE MAKER',   6);
