-- J4-0 — VERIFICAÇÃO (somente leitura). Mostra só nomes de tabelas e contagens.
select 'tabelas com a policy admin_tudo' as item, (select count(*) from pg_policies where schemaname = 'public' and policyname = 'admin_tudo')::text as valor
union all select 'admin_tudo fora do padrão (esperado 0)',
       (select count(*) from pg_policies where schemaname = 'public' and policyname = 'admin_tudo' and not (roles = array['authenticated']::name[] and qual ilike '%is_admin%' and with_check ilike '%is_admin%'))::text
union all select 'criadas por este passo', coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4-0' and objeto = 'policies admin_tudo criadas'), 'sem registro')
union all select 'tabelas SEM RLS (a tratar nos lotes)', coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4-0' and objeto like 'tabelas SEM RLS%'), 'sem registro')
union all select 'tabelas inexistentes (ignoradas)', coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4-0' and objeto like 'tabelas que não existem%'), 'sem registro')
union all select 'authenticated NÃO ganhou UPDATE de tabela inteira em masterlist/pagamento_demandas/multas_pagas (esperado false)',
       (coalesce(has_table_privilege('authenticated', to_regclass('public.masterlist'), 'UPDATE'), false) or coalesce(has_table_privilege('authenticated', to_regclass('public.pagamento_demandas'), 'UPDATE'), false) or coalesce(has_table_privilege('authenticated', to_regclass('public.multas_pagas'), 'UPDATE'), false))::text
union all select 'estado registrado (linhas J4-0, esperado 4)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'J4-0')::text;
