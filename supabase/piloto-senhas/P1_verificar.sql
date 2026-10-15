-- PILOTO DE SENHAS — VERIFICAÇÃO (SOMENTE LEITURA; só IDs, @ e contagens — nenhum e-mail). Rode antes de cada rodada de testes e depois de cada ativação.
-- Esperado (piloto liberado): 5 na lista, onda 1, liberar_todas false, 5 liberadas, nenhuma conta nem liberação FORA das cinco.
-- "contas vinculadas" mostra QUEM já ativou (pares ID = @): confira se cada par é exatamente o da lista.
with lista(id, cog) as (values (2::bigint, 'al.melo'), (272, 'nicknowsaurus'), (42, 'lyrichangbin'), (187751, 'gnabjubs'), (7213, 'ttalilitinha'))
select 'lista de ondas (esperado 5)' as item, (select count(*) from public.ativacao_ondas)::text as valor
union all select 'ids na lista de ondas (esperado 2, 42, 272, 7213, 187751)', coalesce((select string_agg(joiner_id::text, ', ' order by joiner_id) from public.ativacao_ondas), '(vazia)')
union all select 'onda liberada (esperado 1; 0 = piloto pausado)', (select onda_liberada::text from public.ativacao_estado)
union all select 'liberar_todas (esperado false)', (select liberar_todas::text from public.ativacao_estado)
union all select 'joiners com ativação liberada (esperado 5; 0 = piloto pausado)', (select count(*) from public.joiners j where public.ativacao_liberada(j.id))::text
union all select 'liberadas FORA das cinco (esperado 0)', (select count(*) from public.joiners j where public.ativacao_liberada(j.id) and j.id not in (select id from lista))::text
union all select 'contas vinculadas — total', (select count(*) from public.contas_joiner)::text
union all select 'contas vinculadas às cinco (pares ID = @)', coalesce((select string_agg(c.joiner_id || ' = @' || j.cog, ' · ' order by c.joiner_id) from public.contas_joiner c join public.joiners j on j.id = c.joiner_id where c.joiner_id in (select id from lista)), '(nenhuma ainda)')
union all select 'vínculo com @ DIFERENTE do esperado (esperado 0)', (select count(*) from public.contas_joiner c join lista l on l.id = c.joiner_id join public.joiners j on j.id = c.joiner_id where lower(trim(j.cog)) <> l.cog)::text
union all select 'contas vinculadas a joiners fora da lista (preservadas; não devem aumentar durante o piloto)', (select count(*) from public.contas_joiner c where c.joiner_id not in (select id from lista))::text
union all select 'pedidos de vínculo ABERTOS (esperado 0; > 0 = alguém caiu em ambiguidade e precisa da administradora)', (select count(*) from public.vinculos_pendentes where status = 'aberto')::text
union all select 'contas no Auth (total)', (select count(*) from auth.users)::text
union all select 'contas no Auth sem vínculo (esperado: só as que estão no meio da ativação)', (select count(*) from auth.users u where not exists (select 1 from public.contas_joiner c where c.user_id = u.id))::text
union all select 'o visitante executa ativar_minha_conta (esperado false)', has_function_privilege('anon', 'public.ativar_minha_conta(text)', 'EXECUTE')::text
union all select 'o visitante ou a joiner lê a lista de ondas (esperado false)', (has_table_privilege('anon', 'public.ativacao_ondas', 'SELECT') or has_table_privilege('authenticated', 'public.ativacao_ondas', 'SELECT'))::text
union all select 'a joiner executa ativacao_liberada (esperado false)', (has_function_privilege('anon', 'public.ativacao_liberada(bigint)', 'EXECUTE') or has_function_privilege('authenticated', 'public.ativacao_liberada(bigint)', 'EXECUTE'))::text;
