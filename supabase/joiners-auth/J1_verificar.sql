-- J1 (v2) — VERIFICAÇÃO (somente leitura; não mostra e-mails nem COGs).
-- Esperado (10 linhas): RLS ligado nas 2 tabelas; anon sem acesso; authenticated só lê; 7 funções security definer com search_path vazio,
--           nenhuma executável por anon; ativar_minha_conta FECHADA para authenticated até o J4d; joiners idêntica ao registrado antes; estado registrado (1 linha).
select 'RLS ligado em contas_joiner e vinculos_pendentes (esperado true)' as item,
       ((select relrowsecurity from pg_class where oid = to_regclass('public.contas_joiner')) and (select relrowsecurity from pg_class where oid = to_regclass('public.vinculos_pendentes')))::text as valor
union all select 'anon com algum acesso às 2 tabelas (esperado false)',
       (has_table_privilege('anon', 'public.contas_joiner', 'SELECT') or has_table_privilege('anon', 'public.vinculos_pendentes', 'SELECT')
        or has_table_privilege('anon', 'public.contas_joiner', 'INSERT') or has_table_privilege('anon', 'public.vinculos_pendentes', 'INSERT'))::text
union all select 'authenticated escreve direto nas 2 tabelas (esperado false)',
       (has_table_privilege('authenticated', 'public.contas_joiner', 'INSERT') or has_table_privilege('authenticated', 'public.contas_joiner', 'UPDATE') or has_table_privilege('authenticated', 'public.contas_joiner', 'DELETE')
        or has_table_privilege('authenticated', 'public.vinculos_pendentes', 'INSERT') or has_table_privilege('authenticated', 'public.vinculos_pendentes', 'UPDATE') or has_table_privilege('authenticated', 'public.vinculos_pendentes', 'DELETE'))::text
union all select 'funções security definer com search_path vazio (esperado 7)',
       (select count(*) from pg_proc p where p.oid in (to_regprocedure('public.ativar_minha_conta(text)'), to_regprocedure('public.meu_cog()'), to_regprocedure('public.meu_joiner_id()'),
          to_regprocedure('public.admin_vinculos_pendentes()'), to_regprocedure('public.admin_buscar_joiners(text)'), to_regprocedure('public.admin_resolver_vinculo(bigint, boolean, bigint)'), to_regprocedure('public.admin_desvincular_conta(uuid)'))
          and p.prosecdef and p.proconfig = array['search_path=""'])::text
union all select 'funções executáveis por anon (esperado 0)',
       (select count(*) from pg_proc p where p.oid in (to_regprocedure('public.ativar_minha_conta(text)'), to_regprocedure('public.meu_cog()'), to_regprocedure('public.meu_joiner_id()'),
          to_regprocedure('public.admin_vinculos_pendentes()'), to_regprocedure('public.admin_buscar_joiners(text)'), to_regprocedure('public.admin_resolver_vinculo(bigint, boolean, bigint)'), to_regprocedure('public.admin_desvincular_conta(uuid)'))
          and has_function_privilege('anon', p.oid, 'EXECUTE'))::text
union all select 'vínculo por id permanente (coluna joiner_id existe, sem coluna cog) (esperado true)',
       (exists (select 1 from pg_attribute where attrelid = to_regclass('public.contas_joiner') and attname = 'joiner_id' and not attisdropped)
        and not exists (select 1 from pg_attribute where attrelid = to_regclass('public.contas_joiner') and attname = 'cog' and not attisdropped))::text
union all select 'joiners (linhas | hash) | antes',
       (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(cog, '') || '|' || coalesce(email, ''), E'\n' order by id), '')) from public.joiners)
       || ' | ' || coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'J1' and objeto = 'impressão de joiners'), 'sem registro')
union all select 'contas vinculadas | pedidos abertos', (select count(*) from public.contas_joiner)::text || ' | ' || (select count(*) from public.vinculos_pendentes where status = 'aberto')::text
union all select 'usuário logado executa ativar_minha_conta (esperado false ATÉ o J4d; depois do J4d vira true, e aí só vale com a liberação)',
       has_function_privilege('authenticated', 'public.ativar_minha_conta(text)', 'EXECUTE')::text
union all select 'estado registrado (linhas J1, esperado 1)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'J1')::text;
