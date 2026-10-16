-- N0 — VERIFICAÇÃO (somente leitura). Esperado: 8 linhas como indicado.
select 'tabela notifications existe (esperado true)' as item, (to_regclass('public.notifications') is not null)::text as valor
union all select 'RLS ligado (esperado true)', coalesce((select relrowsecurity::text from pg_class where oid = to_regclass('public.notifications')), 'false')
union all select 'policies (esperado 3)', (select count(*) from pg_policies where schemaname = 'public' and tablename = 'notifications')::text
union all select 'visitante: DELETE ou TRUNCATE (esperado false)', (has_table_privilege('anon', 'public.notifications', 'DELETE') or has_table_privilege('anon', 'public.notifications', 'TRUNCATE'))::text
union all select 'visitante altera outra coluna além de read_at (esperado false)', (has_column_privilege('anon', 'public.notifications', 'message', 'UPDATE') or has_column_privilege('anon', 'public.notifications', 'joiner_cog', 'UPDATE'))::text
union all select 'visitante marca como lida: UPDATE em read_at (esperado true)', has_column_privilege('anon', 'public.notifications', 'read_at', 'UPDATE')::text
union all select 'colunas que o site usa existem: id, joiner_cog, message, type, report_id, read_at, created_at (esperado 7)', (select count(*)::text from pg_attribute where attrelid = to_regclass('public.notifications') and attname in ('id','joiner_cog','message','type','report_id','read_at','created_at') and not attisdropped)
union all select 'N0 registrado em emergencia.c0b_estado_anterior (esperado 1)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'N0')::text;
