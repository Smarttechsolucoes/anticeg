alter table pedidos_popcorn_sleeve
  add column if not exists metodo_pagamento text not null default 'pix';
