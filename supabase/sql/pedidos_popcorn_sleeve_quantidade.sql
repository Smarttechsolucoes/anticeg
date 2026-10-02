alter table pedidos_popcorn_sleeve
  add column if not exists quantidade  integer       not null default 1,
  add column if not exists valor_total numeric(10,2) not null default 45;
