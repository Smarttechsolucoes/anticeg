-- R1.1 — VERIFICAÇÃO (somente leitura; não mostra dados). Esperado: 8 linhas, como indicado.
select 'função com a reassociação (esperado true)' as item,
       (pg_get_functiondef('public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure) like '%reassociaveis%')::text as valor
union all select 'security definer, search_path vazio e dono postgres (esperado true)',
       (select (p.prosecdef and p.proconfig = array['search_path=""'] and pg_get_userbyid(p.proowner) = 'postgres')::text from pg_proc p where p.oid = 'public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure)
union all select 'o visitante executa a função (esperado false)', has_function_privilege('anon', 'public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)', 'EXECUTE')::text
union all select 'a administradora logada executa (esperado true)', has_function_privilege('authenticated', 'public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)', 'EXECUTE')::text
union all select 'quantidade de versões da função (esperado 1: nenhuma assinatura extra)', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'admin_definir_status_pagamento')::text
union all select 'admin_marcar_pago intacta e fechada ao visitante (esperado true)',
       (to_regprocedure('public.admin_marcar_pago(bigint, boolean, boolean, boolean)') is not null and not has_function_privilege('anon', 'public.admin_marcar_pago(bigint, boolean, boolean, boolean)', 'EXECUTE'))::text
union all select 'registro da etapa R1.1 (esperado 2: definição anterior + permissões)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'R1.1')::text
union all select 'UPDATE em pagamento_demandas / pago_item para visitante ou logado (esperado false: o C0 continua valendo)',
       (has_table_privilege('anon', 'public.pagamento_demandas', 'UPDATE') or has_table_privilege('authenticated', 'public.pagamento_demandas', 'UPDATE')
        or has_column_privilege('anon', 'public.masterlist', 'pago_item', 'UPDATE') or has_column_privilege('authenticated', 'public.masterlist', 'pago_item', 'UPDATE'))::text;
