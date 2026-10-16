-- N0 (v2, fechada) — VERIFICAÇÃO (somente leitura). Esperado: 9 linhas, como indicado.
select 'tabela notifications existe (esperado true)' as item, (to_regclass('public.notifications') is not null)::text as valor
union all select 'RLS ligado (esperado true)', coalesce((select relrowsecurity::text from pg_class where oid = to_regclass('public.notifications')), 'false')
union all select 'policies (esperado 1: só a administradora cria)', (select count(*) from pg_policies where schemaname = 'public' and tablename = 'notifications')::text
union all select 'VISITANTE com QUALQUER privilégio direto na tabela (esperado false)',
       (has_table_privilege('anon', 'public.notifications', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('anon', 'public.notifications', 'SELECT,INSERT,UPDATE,REFERENCES'))::text
union all select 'LOGADO com leitura/alteração direta na tabela (esperado false)',
       (has_table_privilege('authenticated', 'public.notifications', 'SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('authenticated', 'public.notifications', 'SELECT,UPDATE,REFERENCES'))::text
union all select 'logado pode INSERIR (a policy is_admin() decide) (esperado true)', has_table_privilege('authenticated', 'public.notifications', 'INSERT')::text
union all select 'funções minhas_notificacoes e marcar_notificacao_lida: security definer, search_path vazio, dono postgres, executáveis por anon e authenticated (esperado 2)',
       (select count(*)::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('minhas_notificacoes', 'marcar_notificacao_lida') and p.prosecdef and p.proconfig = array['search_path=""']
           and pg_get_userbyid(p.proowner) = 'postgres' and has_function_privilege('anon', p.oid, 'EXECUTE') and has_function_privilege('authenticated', p.oid, 'EXECUTE'))
union all select 'colunas que o site usa existem: id, joiner_cog, message, type, report_id, read_at, created_at (esperado 7)',
       (select count(*)::text from pg_attribute where attrelid = to_regclass('public.notifications') and attname in ('id','joiner_cog','message','type','report_id','read_at','created_at') and not attisdropped)
union all select 'N0 registrado em emergencia.c0b_estado_anterior (esperado 1)', (select count(*)::text from emergencia.c0b_estado_anterior where etapa = 'N0');
