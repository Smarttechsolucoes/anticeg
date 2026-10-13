-- C0-B8 — VERIFICAÇÃO (somente leitura; mostra só nomes de chaves e contagens, nunca valores).
-- Esperado: 2 policies; anon sem escrita; leitura pública sem as 3 chaves ocultas; linhas iguais às registradas; estado registrado.
select 'policies em config (esperado 2)' as item, (select count(*) from pg_policies where schemaname = 'public' and tablename = 'config')::text as valor
union all select 'RLS ligado (esperado true)', (select relrowsecurity::text from pg_class where oid = 'public.config'::regclass)
union all select 'anon com escrita na config, tabela ou coluna (esperado false)',
       (has_table_privilege('anon', 'public.config', 'INSERT') or has_table_privilege('anon', 'public.config', 'UPDATE')
        or has_table_privilege('anon', 'public.config', 'DELETE') or has_table_privilege('anon', 'public.config', 'TRUNCATE')
        or has_any_column_privilege('anon', 'public.config', 'INSERT') or has_any_column_privilege('anon', 'public.config', 'UPDATE'))::text
union all select 'anon lê a config (esperado true)', has_table_privilege('anon', 'public.config', 'SELECT')::text
union all select 'policy de leitura pública exclui as chaves secretas (esperado true)',
       (select (qual ilike '%admin_pin%' and qual ilike '%senha_disponiveis%' and qual ilike '%senha_manutencao%' and (qual ilike '%not%' or qual ilike '%<> all%'))::text
          from pg_policies where schemaname = 'public' and tablename = 'config' and policyname = 'config_leitura_publica')
union all select 'policy de escrita usa is_admin() (esperado true)',
       (select (qual ilike '%is_admin%' and with_check ilike '%is_admin%')::text
          from pg_policies where schemaname = 'public' and tablename = 'config' and policyname = 'config_admin')
union all select 'linhas na config | antes',
       (select count(*) from public.config)::text || ' | ' || coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'B8' and objeto = 'impressão da config'), 'sem registro')
union all select 'chaves hoje (só nomes)', (select string_agg(key, ', ' order by key) from public.config)
union all select 'estado anterior registrado (linhas B8)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'B8')::text;
