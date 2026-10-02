-- Estoque do Wave Maker.
-- "estoque" = unidades disponíveis em "contar_desde".
-- O site desconta os pedidos (pendente + confirmado) criados depois dessa data;
-- pedido cancelado devolve a unidade. Quando chega a 0, o item fica INDISPONÍVEL.
create table if not exists wave_maker_estoque (
  item_id       text primary key,
  estoque       integer     not null default 0,
  contar_desde  timestamptz not null default now()
);

alter table wave_maker_estoque enable row level security;

create policy "select_publico" on wave_maker_estoque
  for select using (true);

-- Edição pelo painel admin (mesmo padrão das outras tabelas, que usam a chave anon)
create policy "update_admin" on wave_maker_estoque
  for update using (true);

insert into wave_maker_estoque (item_id, estoque) values
  ('OUTBOX',               5),
  ('HARD COVER DIARY',     0),
  ('DESK CALENDAR',        5),
  ('POSTER',               3),
  ('STICKER',              1),
  ('ID HOLDER',            1),
  ('KNAPSACK',             5),
  ('MAKING VIDEO QR CARD', 4),
  ('KIT 01',               2),
  ('KIT 02',               0),
  ('KIT 03',               2)
on conflict (item_id) do nothing;
