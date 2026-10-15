-- R1 — VERIFICAÇÃO (somente leitura; não mostra dados). Esperado: 8 linhas, como indicado.
select 'funções novas seguras: security definer com search_path vazio (esperado 2)' as item,
       (select count(*) from pg_proc p where p.oid in (to_regprocedure('public.admin_definir_status_pagamento(bigint, text, text)'), to_regprocedure('public.admin_marcar_pago(bigint, boolean, boolean, boolean)')) and p.prosecdef and p.proconfig = array['search_path=""'])::text as valor
union all select 'o visitante executa alguma função nova (esperado false)',
       (has_function_privilege('anon', 'public.admin_definir_status_pagamento(bigint, text, text)', 'EXECUTE') or has_function_privilege('anon', 'public.admin_marcar_pago(bigint, boolean, boolean, boolean)', 'EXECUTE'))::text
union all select 'a administradora logada executa as duas (a negação a não-admin é feita dentro delas) (esperado true)',
       (has_function_privilege('authenticated', 'public.admin_definir_status_pagamento(bigint, text, text)', 'EXECUTE') and has_function_privilege('authenticated', 'public.admin_marcar_pago(bigint, boolean, boolean, boolean)', 'EXECUTE'))::text
union all select 'função antiga set_pagamento_demanda_status executável por visitante ou logado (esperado false)',
       coalesce((select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE')) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'set_pagamento_demanda_status')::text, 'false (não existe)')
union all select 'UPDATE em pagamento_demandas para visitante ou logado (esperado false: o C0 continua valendo)',
       (has_table_privilege('anon', 'public.pagamento_demandas', 'UPDATE') or has_table_privilege('authenticated', 'public.pagamento_demandas', 'UPDATE'))::text
union all select 'UPDATE na coluna masterlist.pago_item para visitante ou logado (esperado false)',
       (has_column_privilege('anon', 'public.masterlist', 'pago_item', 'UPDATE') or has_column_privilege('authenticated', 'public.masterlist', 'pago_item', 'UPDATE'))::text
union all select 'administradoras cadastradas (admin_roles) — quem pode usar os botões', (select count(*) from public.admin_roles)::text
union all select 'estado registrado (linhas R1, esperado 3 ou mais)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'R1')::text;
