-- J4a — VERIFICAÇÃO (somente leitura; não mostra dados).
select 'colunas da visão pública (esperado 5: cog, nome_site, twitter, foto_perfil, recrutador)' as item,
       (select string_agg(column_name, ', ' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'joiners_publico') as valor
union all select 'coluna sensível na visão pública (esperado 0)',
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'joiners_publico' and column_name ~* '(email|cpf|whats|telefone|cep|rua|bairro|cidade|numero|saldo|bloque|nome_entrega|^nome$)')::text
union all select 'funções security definer com search_path vazio (esperado 4)',
       (select count(*) from pg_proc p where p.oid in (to_regprocedure('public.entrar_com_arroba(text)'), to_regprocedure('public.meus_dados()'), to_regprocedure('public.contar_recrutados(text)'), to_regprocedure('public.cog_e_da_conta(text)')) and p.prosecdef and p.proconfig = array['search_path=""'])::text
union all select 'anon executa entrar_com_arroba (esperado true)', has_function_privilege('anon', 'public.entrar_com_arroba(text)', 'EXECUTE')::text
union all select 'anon executa meus_dados (esperado false)', has_function_privilege('anon', 'public.meus_dados()', 'EXECUTE')::text
union all select 'anon lê a visão pública (esperado true)', has_table_privilege('anon', 'public.joiners_publico', 'SELECT')::text
union all select 'estado registrado (linhas J4a, esperado 1)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'J4a')::text;
