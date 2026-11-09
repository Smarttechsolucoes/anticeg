-- Pagamento imediato (PIX ou cartão) nos formulários de loja que gravam em formulario_pedidos (primeiro uso: ODD & FRESH POP-UP, 09/11/2026).
-- SÓ ACRESCENTA três colunas opcionais; nada existente é alterado e os 57 pedidos antigos continuam como estão (as colunas ficam vazias neles).
-- Quem já tem pagamento imediato é identificado por forma_pagamento preenchida. As regras de acesso (RLS) da tabela não mudam.
-- Desfazer: formulario_pedidos_pagamento_imediato_reverter.sql (remove só as três colunas; apaga apenas o que foi gravado nelas).
begin;
alter table public.formulario_pedidos add column if not exists forma_pagamento text check (forma_pagamento is null or forma_pagamento in ('pix', 'cartao'));
alter table public.formulario_pedidos add column if not exists valor_total numeric(10, 2) check (valor_total is null or valor_total > 0);
alter table public.formulario_pedidos add column if not exists comprovante_url text check (comprovante_url is null or char_length(comprovante_url) <= 500);

do $$ begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'formulario_pedidos' and column_name in ('forma_pagamento', 'valor_total', 'comprovante_url')) <> 3 then
    raise exception 'As três colunas não foram criadas. Transação desfeita.'; end if;
  if (select count(*) from public.formulario_pedidos where forma_pagamento is not null or valor_total is not null or comprovante_url is not null) <> 0 then
    raise exception 'Pedidos existentes receberam valores nas colunas novas. Transação desfeita.'; end if;
end $$;
commit;
