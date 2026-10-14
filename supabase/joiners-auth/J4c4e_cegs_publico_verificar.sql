-- J4c-4e — VERIFICAÇÃO (somente leitura). Esperado: 3 funções seguras; ceg_itens fechada ao visitante; resumo e vencimentos públicos.
select 'funções de CEG seguras (esperado 3)' as item, (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('ceg_resumo', 'ceg_vencimentos', 'ceg_itens') and p.prosecdef and p.proconfig = array['search_path=""'])::text as valor
union all select 'visitante executa ceg_itens (esperado false)', has_function_privilege('anon', 'public.ceg_itens(text)', 'EXECUTE')::text
union all select 'visitante executa ceg_resumo e ceg_vencimentos (esperado true)', (has_function_privilege('anon', 'public.ceg_resumo()', 'EXECUTE') and has_function_privilege('anon', 'public.ceg_vencimentos()', 'EXECUTE'))::text;
