-- S1 — VERIFICAÇÃO (somente leitura). Esperado: tudo "OK".
select 'função prune_masterlist existe' as item, case when to_regprocedure('public.prune_masterlist(bigint[],integer,integer)') is not null then 'OK' else 'FALHA' end as valor
union all select 'prune_masterlist: só service_role executa',
  case when has_function_privilege('service_role', 'public.prune_masterlist(bigint[],integer,integer)', 'execute')
        and not has_function_privilege('anon', 'public.prune_masterlist(bigint[],integer,integer)', 'execute')
        and not has_function_privilege('authenticated', 'public.prune_masterlist(bigint[],integer,integer)', 'execute') then 'OK' else 'FALHA' end
union all select 'arquivo de exclusões fechado ao site',
  case when not has_table_privilege('anon', 'public.masterlist_exclusoes', 'select') and not has_table_privilege('authenticated', 'public.masterlist_exclusoes', 'select') then 'OK' else 'FALHA' end
union all select 'gatilho de proteção de claims ligado',
  case when exists (select 1 from pg_trigger where tgrelid = 'public.masterlist'::regclass and tgname = 'trg_masterlist_protege_claims' and tgenabled = 'O') then 'OK' else 'FALHA' end
union all select 'linhas da masterlist agora / quando o S1 foi aplicado',
  (select count(*) from public.masterlist)::text || ' / ' || coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'S1' and objeto = 'linhas da masterlist'), '?')
union all select 'linhas já arquivadas em masterlist_exclusoes', (select count(*) from public.masterlist_exclusoes)::text;
