-- N0 (v3, estrutural) — VERIFICAÇÃO (somente leitura). Esperado: 9 linhas, como indicado.
select 'tabela notifications existe (esperado true)' as item, (to_regclass('public.notifications') is not null)::text as valor
union all select 'RLS ligado (esperado true)', coalesce((select relrowsecurity::text from pg_class where oid = to_regclass('public.notifications')), 'false')
union all select 'policies (esperado 0: ninguém passa pela API)', (select count(*) from pg_policies where schemaname = 'public' and tablename = 'notifications')::text
union all select 'VISITANTE com QUALQUER privilégio na tabela (esperado false)',
       (has_table_privilege('anon', 'public.notifications', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('anon', 'public.notifications', 'SELECT,INSERT,UPDATE,REFERENCES'))::text
union all select 'LOGADO com QUALQUER privilégio na tabela (esperado false)',
       (has_table_privilege('authenticated', 'public.notifications', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('authenticated', 'public.notifications', 'SELECT,INSERT,UPDATE,REFERENCES'))::text
union all select 'service_role (servidor) acessa (esperado true)', has_table_privilege('service_role', 'public.notifications', 'SELECT,INSERT,UPDATE,DELETE')::text
union all select 'funções minhas_notificacoes / marcar_notificacao_lida existem (esperado 0: nenhuma função pública)',
       (select count(*)::text from pg_proc where pronamespace = 'public'::regnamespace and proname in ('minhas_notificacoes', 'marcar_notificacao_lida'))
union all select 'colunas do site existem: id, joiner_cog, message, type, report_id, read_at, created_at (esperado 7)',
       (select count(*)::text from pg_attribute where attrelid = to_regclass('public.notifications') and attname in ('id','joiner_cog','message','type','report_id','read_at','created_at') and not attisdropped)
union all select 'N0 registrado em emergencia.c0b_estado_anterior (esperado 1)', (select count(*)::text from emergencia.c0b_estado_anterior where etapa = 'N0');
