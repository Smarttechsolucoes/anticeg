-- C0-B7 — VERIFICAÇÃO (somente leitura, sem dados pessoais).
-- Esperado: gatilho trg_confirmar_pagamento com estado D (desligado); função presente; masterlist e multa intactos;
--           estado anterior registrado (3 linhas); pagamento_demandas com a mesma contagem de antes.
select 'gatilho trg_confirmar_pagamento (D = desligado, O = ligado)' as item,
       coalesce((select t.tgenabled::text from pg_trigger t where t.tgrelid = 'public.pagamento_demandas'::regclass and t.tgname = 'trg_confirmar_pagamento'), 'não existe') as valor
union all select 'função fn_confirmar_pagamento presente (esperado true)', (to_regprocedure('public.fn_confirmar_pagamento()') is not null)::text
union all select 'gatilho de multa trg_registrar_multa_paga ligado (esperado O)',
       coalesce((select t.tgenabled::text from pg_trigger t where t.tgrelid = 'public.masterlist'::regclass and t.tgname = 'trg_registrar_multa_paga'), 'não existe')
union all select 'colunas pago_* continuam travadas para anon (esperado false)',
       (has_column_privilege('anon', 'public.masterlist', 'pago_item', 'UPDATE') or has_column_privilege('anon', 'public.masterlist', 'pago_frete', 'UPDATE') or has_column_privilege('anon', 'public.masterlist', 'pago_rf', 'UPDATE'))::text
union all select 'pagamento_demandas (linhas) | antes',
       (select count(*) from public.pagamento_demandas)::text || ' | ' || coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'B7' and objeto = 'impressão de pagamento_demandas'), 'sem registro')
union all select 'estado anterior registrado (linhas B7, esperado 3)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'B7')::text;
