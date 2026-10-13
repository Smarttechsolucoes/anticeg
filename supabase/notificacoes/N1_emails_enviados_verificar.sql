-- N1 — VERIFICAÇÃO (somente leitura). Esperado: existe com RLS ligado; anon/authenticated sem acesso; service_role com acesso; 0 envios; 1 linha de estado.
select 'emails_enviados existe, RLS ligado (esperado true)' as item, coalesce((select relrowsecurity::text from pg_class where oid = to_regclass('public.emails_enviados')), 'não existe') as valor
union all select 'anon/authenticated com algum acesso (esperado false)',
       (has_table_privilege('anon', 'public.emails_enviados', 'SELECT') or has_table_privilege('authenticated', 'public.emails_enviados', 'SELECT')
        or has_table_privilege('anon', 'public.emails_enviados', 'INSERT') or has_table_privilege('authenticated', 'public.emails_enviados', 'INSERT'))::text
union all select 'service_role com acesso (esperado true)',
       (has_table_privilege('service_role', 'public.emails_enviados', 'SELECT') and has_table_privilege('service_role', 'public.emails_enviados', 'INSERT') and has_table_privilege('service_role', 'public.emails_enviados', 'DELETE'))::text
union all select 'envios registrados', (select count(*) from public.emails_enviados)::text
union all select 'estado registrado (linhas N1, esperado 1)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'N1')::text;
