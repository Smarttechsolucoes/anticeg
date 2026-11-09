-- Desfaz formulario_pedidos_pagamento_imediato.sql: remove as três colunas (e só o que foi gravado nelas; o restante dos pedidos não muda).
begin;
alter table public.formulario_pedidos drop column if exists forma_pagamento, drop column if exists valor_total, drop column if exists comprovante_url;
commit;
