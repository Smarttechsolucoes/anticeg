-- PILOTO DE SENHAS — PRÉ-VOO (SOMENTE LEITURA: não altera nada; mostra só contagens, IDs, @ e e-mail MASCARADO). Rode no SQL Editor da produção e guarde o resultado.
-- Serve para: confirmar as cinco joiners do piloto, provar que NÃO há duplicidade (e-mail, @, ID) nem conta já existente no Auth, e mostrar o que já está aplicado.
-- Pode ser rodado ANTES do J1 (as tabelas novas ainda não existem: aparece "n/a") e DEPOIS (fica mais completo). Rode de novo logo antes de liberar e depois de cada ativação.
-- Coluna "situacao": OK = como esperado | FALHA = NÃO prossiga com esta pessoa/etapa | ATENÇÃO = olhar com calma | INFO = só informação.
-- A lista autorizada fica SÓ aqui e no P1_liberar_cinco_aplicar.sql (o navegador e as funções não a conhecem; o servidor decide pela tabela ativacao_ondas).
with lista(id, cog) as (values (2::bigint, 'al.melo'), (272, 'nicknowsaurus'), (42, 'lyrichangbin'), (187751, 'gnabjubs'), (7213, 'ttalilitinha')),
alvo as (  -- as cinco, com o que existe hoje no cadastro
  select l.id as id_esperado, l.cog as cog_esperado, j.id as id_real, j.cog, j.email, j.twitter, coalesce(j.bloqueado, false) as bloqueado,
         (j.email is not null and trim(j.email) ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') as email_valido
    from lista l left join public.joiners j on j.id = l.id
),
tem_auth as (select to_regclass('auth.users') is not null as v),
tem_contas as (select to_regclass('public.contas_joiner') is not null as v),
tem_ondas as (select to_regclass('public.ativacao_ondas') is not null as v),
dyn as (  -- tabelas que o J1/J4d criam: só são consultadas SE existirem (antes do J1 o resultado é "n/a", sem erro)
  select
    case when to_regclass('public.contas_joiner') is not null then (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.contas_joiner', false, true, '')))[1]::text end as contas_total,
    case when to_regclass('public.contas_joiner') is not null then (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.contas_joiner where joiner_id in (2, 272, 42, 187751, 7213)', false, true, '')))[1]::text end as contas_cinco,
    case when to_regclass('public.contas_joiner') is not null then (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.contas_joiner where joiner_id not in (2, 272, 42, 187751, 7213)', false, true, '')))[1]::text end as contas_fora,
    case when to_regclass('public.ativacao_ondas') is not null then (xpath('/row/n/text()', query_to_xml('select (select count(*) from public.ativacao_ondas) || chr(32) || chr(47) || chr(32) || (select onda_liberada from public.ativacao_estado) || chr(32) || chr(47) || chr(32) || (select liberar_todas from public.ativacao_estado) as n', false, true, '')))[1]::text end as ondas_resumo,
    case when to_regclass('public.ativacao_ondas') is not null then (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.ativacao_ondas where joiner_id not in (2, 272, 42, 187751, 7213)', false, true, '')))[1]::text end as ondas_fora
)

-- 1) cada uma das cinco: o ID aponta para o @ certo?
select '1 as cinco' as secao, 'id ' || a.id_esperado || ' = @' || a.cog_esperado as item,
       case when a.id_real is null then 'NÃO EXISTE' when lower(trim(a.cog)) <> a.cog_esperado then 'cog diferente: ' || coalesce(a.cog, '(vazio)') else 'confere' end as valor,
       case when a.id_real is not null and lower(trim(a.cog)) = a.cog_esperado then 'OK' else 'FALHA' end as situacao
  from alvo a
union all select '1 as cinco', 'id ' || a.id_esperado || ': e-mail cadastrado (mascarado)',
       coalesce(left(a.email, 2) || '***@' || split_part(a.email, '@', 2), '(sem e-mail)'), case when a.email_valido then 'OK' else 'FALHA' end from alvo a
union all select '1 as cinco', 'id ' || a.id_esperado || ': bloqueada', a.bloqueado::text, case when a.bloqueado then 'FALHA' else 'OK' end from alvo a

-- 2) DUPLICIDADE (a ativação só vincula quando tudo é único)
union all select '2 duplicidade', 'id ' || a.id_esperado || ': joiners com ESTE e-mail (esperado 1)',
       (select count(*) from public.joiners x where lower(trim(x.email)) = lower(trim(a.email)))::text,
       case when (select count(*) from public.joiners x where lower(trim(x.email)) = lower(trim(a.email))) = 1 then 'OK' else 'FALHA' end from alvo a where a.email_valido
union all select '2 duplicidade', 'id ' || a.id_esperado || ': joiners com ESTE cog ignorando maiúsculas (esperado 1)',
       (select count(*) from public.joiners x where lower(trim(x.cog)) = a.cog_esperado)::text,
       case when (select count(*) from public.joiners x where lower(trim(x.cog)) = a.cog_esperado) = 1 then 'OK' else 'FALHA' end from alvo a
union all select '2 duplicidade', 'id ' || a.id_esperado || ': outras joiners cujo @ (campo twitter) é este mesmo (esperado 0)',
       (select count(*) from public.joiners x where x.id <> a.id_esperado and lower(regexp_replace(coalesce(x.twitter, ''), '^\s*@+', '')) = a.cog_esperado)::text,
       case when (select count(*) from public.joiners x where x.id <> a.id_esperado and lower(regexp_replace(coalesce(x.twitter, ''), '^\s*@+', '')) = a.cog_esperado) = 0 then 'OK' else 'FALHA' end from alvo a
union all select '2 duplicidade', 'o cadastro antigo biachinicks (id 12) não existe mais (esperado 0)',
       (select count(*) from public.joiners x where x.id = 12 or lower(trim(x.cog)) = 'biachinicks')::text,
       case when (select count(*) from public.joiners x where x.id = 12 or lower(trim(x.cog)) = 'biachinicks') = 0 then 'OK' else 'FALHA' end
union all select '2 duplicidade', 'qualquer outra joiner com o e-mail de uma das cinco (esperado 0)',
       (select count(*) from public.joiners x join alvo a on lower(trim(x.email)) = lower(trim(a.email)) and x.id <> a.id_esperado)::text,
       case when (select count(*) from public.joiners x join alvo a on lower(trim(x.email)) = lower(trim(a.email)) and x.id <> a.id_esperado) = 0 then 'OK' else 'FALHA' end
union all select '2 duplicidade', 'joiners.id repetidos na tabela inteira (esperado 0)',
       (select count(*) from (select id from public.joiners group by id having count(*) > 1) t)::text,
       case when (select count(*) from (select id from public.joiners group by id having count(*) > 1) t) = 0 then 'OK' else 'FALHA' end

-- 3) CONTAS JÁ EXISTENTES NO AUTH (para evitar duplicidade e para preservar o que já existe)
union all select '3 contas no Auth', 'contas no Auth (total)', (select count(*)::text from auth.users), 'INFO'
union all select '3 contas no Auth', 'contas no Auth com o e-mail de uma das cinco (esperado 0 antes do piloto)',
       case when (select v from tem_auth) then (select count(*)::text from auth.users u join alvo a on lower(trim(u.email)) = lower(trim(a.email))) else 'n/a' end,
       case when (select v from tem_auth) and (select count(*) from auth.users u join alvo a on lower(trim(u.email)) = lower(trim(a.email))) > 0 then 'ATENÇÃO' else 'OK' end
union all select '3 contas no Auth', 'dessas, já CONFIRMADAS (se > 0, confira de quem é a conta antes de seguir)',
       case when (select v from tem_auth) then (select count(*)::text from auth.users u join alvo a on lower(trim(u.email)) = lower(trim(a.email)) where u.email_confirmed_at is not null) else 'n/a' end,
       case when (select v from tem_auth) and (select count(*) from auth.users u join alvo a on lower(trim(u.email)) = lower(trim(a.email)) where u.email_confirmed_at is not null) > 0 then 'ATENÇÃO' else 'OK' end
union all select '3 contas no Auth', 'contas vinculadas a joiners (contas_joiner) — total', coalesce((select contas_total from dyn), 'n/a (J1 ainda não aplicado)'), 'INFO'
union all select '3 contas no Auth', 'contas vinculadas às cinco', coalesce((select contas_cinco from dyn), 'n/a'), 'INFO'
union all select '3 contas no Auth', 'contas vinculadas a joiners FORA da lista (devem ser preservadas; esperado 0 antes do piloto)', coalesce((select contas_fora from dyn), 'n/a'), 'INFO'

-- 4) O QUE JÁ ESTÁ APLICADO (os quatro SQLs do piloto)
union all select '4 aplicado', 'J1 (contas_joiner)', case when (select v from tem_contas) then 'sim' else 'NÃO' end, 'INFO'
union all select '4 aplicado', 'J3 (tentativas_acesso)', case when to_regclass('public.tentativas_acesso') is not null then 'sim' else 'NÃO' end, 'INFO'
union all select '4 aplicado', 'J4a (entrar_com_arroba)', case when to_regprocedure('public.entrar_com_arroba(text)') is not null then 'sim' else 'NÃO' end, 'INFO'
union all select '4 aplicado', 'J4d (ativacao_ondas)', case when (select v from tem_ondas) then 'sim' else 'NÃO' end, 'INFO'
union all select '4 aplicado', 'ondas: joiners na lista / onda liberada / liberar_todas', coalesce((select ondas_resumo from dyn), 'n/a'), 'INFO'
union all select '4 aplicado', 'ondas: joiners na lista FORA das cinco (esperado 0)', coalesce((select ondas_fora from dyn), 'n/a'),
       case when coalesce((select ondas_fora from dyn), '0')::int > 0 then 'FALHA' else 'OK' end
order by 1, 2;
