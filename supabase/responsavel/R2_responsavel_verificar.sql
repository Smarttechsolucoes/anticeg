-- R2 — VERIFICAR (so leitura). Esperado: colunas 5, funcoes 2, gatilhos 2, admins_sem_nome 0, e os dois "anon_executa" = false.
select 'colunas' as item, count(*)::text as valor from information_schema.columns
 where table_schema = 'public' and (
   (table_name = 'admin_roles' and column_name = 'nome') or
   (table_name = 'reports' and column_name in ('respondido_por', 'respondido_em')) or
   (table_name = 'pagamento_demandas' and column_name in ('analisado_por', 'analisado_em')))
union all
select 'funcoes', count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('admin_nome', 'admin_responder_report')
union all
select 'gatilhos', count(*)::text from pg_trigger
 where not tgisinternal and tgname in ('trg_pagamento_demandas_responsavel', 'trg_reports_responsavel')
union all
select 'admins_sem_nome', count(*)::text from public.admin_roles where nullif(trim(nome), '') is null
union all
select 'anon_executa_admin_nome', has_function_privilege('anon', 'public.admin_nome()', 'execute')::text
union all
select 'anon_executa_responder', has_function_privilege('anon', 'public.admin_responder_report(text,text,text)', 'execute')::text;
