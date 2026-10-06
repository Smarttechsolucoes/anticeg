-- Estoque do Paper Tale (mesmo modelo de wave_maker_estoque).
-- "estoque" = unidades disponíveis em "contar_desde".
-- O site desconta os pedidos (pendente + confirmado) criados depois dessa data;
-- pedido cancelado devolve a unidade. Quando chega a 0, o item fica INDISPONÍVEL.
-- Item sem linha aqui = sem controle de estoque. Valores abaixo são placeholders.
create table if not exists paper_tales_estoque (
  item_id       text primary key,
  estoque       integer     not null default 0,
  contar_desde  timestamptz not null default now()
);

alter table paper_tales_estoque enable row level security;

create policy "select_publico" on paper_tales_estoque
  for select using (true);

create policy "update_admin" on paper_tales_estoque
  for update using (true);

insert into paper_tales_estoque (item_id, estoque) values
  ('BOX LACRADA', 5),
  ('AGENDA', 5),
  ('CAPA DE CADERNO', 5),
  ('DESK CALENDAR', 5),
  ('MASKING TAPE', 5),
  ('OUTBOX', 5),
  ('PHOTOBOOK', 5),
  ('KIT 01',      3),
  ('KIT 02',      3),
  ('KIT 03',      3)
on conflict (item_id) do nothing;
