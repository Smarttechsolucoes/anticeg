-- J3 — VERIFICAÇÃO (somente leitura). Esperado: existe com RLS ligado; anon/authenticated sem acesso; service_role com acesso; 1 linha de estado.
select 'tentativas_acesso existe, RLS ligado (esperado true)' as item, coalesce((select relrowsecurity::text from pg_class where oid = to_regclass('public.tentativas_acesso')), 'não existe') as valor
union all select 'anon/authenticated com algum acesso (esperado false)',
       (has_table_privilege('anon', 'public.tentativas_acesso', 'SELECT') or has_table_privilege('authenticated', 'public.tentativas_acesso', 'SELECT')
        or has_table_privilege('anon', 'public.tentativas_acesso', 'INSERT') or has_table_privilege('authenticated', 'public.tentativas_acesso', 'INSERT'))::text
union all select 'service_role com acesso (esperado true)',
       (has_table_privilege('service_role', 'public.tentativas_acesso', 'SELECT') and has_table_privilege('service_role', 'public.tentativas_acesso', 'INSERT') and has_table_privilege('service_role', 'public.tentativas_acesso', 'DELETE'))::text
union all select 'estado registrado (linhas J3, esperado 1)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'J3')::text;
