-- A2 — VERIFICAÇÃO (somente leitura, sem dados pessoais).
-- Esperado: is_admin() sem aal na definição; security definer com search_path vazio; executável por anon/authenticated;
--           admin_roles ainda fechada para anon/authenticated; mesmo número de admins de antes; estado registrado (2 linhas).
select 'is_admin() ainda menciona aal (esperado false)' as item,
       (pg_get_functiondef(to_regprocedure('public.is_admin()')) ilike '%aal%')::text as valor
union all select 'is_admin(): security definer | search_path',
       (select p.prosecdef::text || ' | ' || coalesce(p.proconfig::text, 'sem config') from pg_proc p where p.oid = to_regprocedure('public.is_admin()'))
union all select 'is_admin() executável por anon e authenticated (esperado true)',
       (has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') and has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE'))::text
union all select 'anon/authenticated com algum acesso a admin_roles (esperado false)',
       (has_table_privilege('anon', 'public.admin_roles', 'SELECT') or has_table_privilege('authenticated', 'public.admin_roles', 'SELECT')
        or has_table_privilege('anon', 'public.admin_roles', 'INSERT') or has_table_privilege('authenticated', 'public.admin_roles', 'INSERT')
        or has_table_privilege('anon', 'public.admin_roles', 'UPDATE') or has_table_privilege('authenticated', 'public.admin_roles', 'UPDATE')
        or has_table_privilege('anon', 'public.admin_roles', 'DELETE') or has_table_privilege('authenticated', 'public.admin_roles', 'DELETE'))::text
union all select 'admins cadastrados | antes',
       (select count(*) from public.admin_roles)::text || ' | ' || coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'A2' and objeto = 'admins cadastrados'), 'sem registro')
union all select 'estado registrado (linhas A2, esperado 2)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'A2')::text;
