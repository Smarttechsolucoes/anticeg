-- PRÉ-VOO DO LANÇAMENTO — SOMENTE LEITURA (não altera nada; só contagens e nomes, nenhum dado pessoal). Rode no SQL Editor da PRODUÇÃO e guarde o resultado.
-- Serve para: (1) saber o ponto de partida antes de cada etapa, (2) descobrir quantas joiners vão ativar sozinhas e quantas vão precisar de ajuda da administradora, (3) confirmar o que já está aplicado.
-- Nada daqui é pré-requisito dos scripts de proteção (eles têm as próprias travas), mas o resultado muda o plano de comunicação.

-- 1) PRONTIDÃO DOS CADASTROS (a ativação por e-mail só vincula quando o e-mail confirmado é IGUAL ao cadastrado e único entre as joiners)
select '1 cadastros' as secao, 'joiners no total' as item, count(*)::text as valor from public.joiners
union all select '1 cadastros', 'com e-mail de formato válido', count(*)::text from public.joiners where email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
union all select '1 cadastros', 'SEM e-mail válido (vão para "vínculo pendente": a administradora resolve)', count(*)::text from public.joiners where email is null or email !~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
union all select '1 cadastros', 'e-mails repetidos entre joiners diferentes (não vinculam sozinhas)', coalesce(sum(c), 0)::text from (select count(*) as c from public.joiners where email is not null and trim(email) <> '' group by lower(trim(email)) having count(*) > 1) x
union all select '1 cadastros', '@/COG repetidos ignorando maiúsculas (ex.: Ela e ela)', coalesce(sum(c), 0)::text from (select count(*) as c from public.joiners where cog is not null group by lower(trim(cog)) having count(*) > 1) x
union all select '1 cadastros', 'sem @/COG', count(*)::text from public.joiners where cog is null or trim(cog) = ''
union all select '1 cadastros', 'bloqueadas por atraso (não conseguem fazer claim)', count(*)::text from public.joiners where coalesce(bloqueado, false)

-- 2) O QUE JÁ ESTÁ APLICADO
union all select '2 já aplicado', 'administradoras cadastradas (admin_roles)', coalesce((select count(*)::text from public.admin_roles), 'tabela ausente')
union all select '2 já aplicado', x.nome, case when to_regprocedure(x.assinatura) is null then 'NÃO' else 'sim' end
  from (values ('J1: ativar_minha_conta', 'public.ativar_minha_conta(text)'), ('J1: meu_cog', 'public.meu_cog()'), ('J4a: entrar_com_arroba', 'public.entrar_com_arroba(text)'), ('J4a: cog_e_da_conta', 'public.cog_e_da_conta(text)'),
               ('J4c-1: solicitar_cadastro', 'public.solicitar_cadastro(text,text,text,text,text)'), ('J4c-3: pedido_loja_criar', 'public.pedido_loja_criar(text,jsonb)'),
               ('J4c-4b: claim_enviar', 'public.claim_enviar(bigint,jsonb)'), ('J4c-4c: envio_entrar_round', 'public.envio_entrar_round(text)'), ('J4c-4e: ceg_resumo', 'public.ceg_resumo()'),
               ('J5: comprovante_assinavel', 'public.comprovante_assinavel(text,text)')) x(nome, assinatura)
union all select '2 já aplicado', 'etapas já registradas em emergencia.c0b_estado_anterior', coalesce((select string_agg(distinct etapa, ', ' order by etapa) from emergencia.c0b_estado_anterior), 'nenhuma (schema emergencia ausente?)')
union all select '2 já aplicado', 'contas do Auth (auth.users) e contas já vinculadas a uma joiner', coalesce((select count(*)::text from auth.users), '?') || ' | ' || coalesce((select count(*)::text from public.contas_joiner), 'sem tabela contas_joiner')

-- 3) PONTO DE PARTIDA DAS TABELAS (RLS e o que o visitante alcança hoje)
union all select '3 tabelas', c.relname, (case when c.relrowsecurity then 'RLS ligado' else 'RLS DESLIGADO' end)
       || ' | visitante: ' || coalesce(nullif(concat_ws('+', case when has_table_privilege('anon', c.oid, 'SELECT') then 'SELECT' end, case when has_table_privilege('anon', c.oid, 'INSERT') then 'INSERT' end,
                                                      case when has_table_privilege('anon', c.oid, 'UPDATE') then 'UPDATE' end, case when has_table_privilege('anon', c.oid, 'DELETE') then 'DELETE' end), ''), 'nada')
       || ' | policies: ' || (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)::text
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
   and c.relname in ('joiners', 'masterlist', 'pagamento_demandas', 'multas_pagas', 'claims', 'reports', 'envio_solicitacoes', 'pre_cadastros', 'grupos_envio', 'push_subscriptions', 'formulario_pedidos',
        'pedidos_revista', 'pedidos_popup', 'pedidos_wmag', 'pedidos_wmag_leeknow', 'pedidos_dazed_seungmin','pedidos_esquire_hyunjin', 'pedidos_smolmerch', 'pedidos_bazaar_in', 'pedidos_lightstick', 'pedidos_popcorn_sleeve', 'pedidos_singba', 'pedidos_skzoo_rio',
        'mercari_pedidos', 'lojinha_repasses', 'repassos', 'claim_eventos', 'claim_sets', 'claim_reservas', 'feedbacks', 'notifications', 'pushes', 'push_reads', 'joiner_storage', 'joiner_conferencias', 'joiner_updates',
        'envio_rounds', 'envio_requests', 'confirmacoes', 'rastreios', 'estoque_itens', 'estoque_compras', 'ceg_config', 'item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos', 'sugestoes_tabela', 'antiv_badges', 'config')
union all select '3 tabelas', 'FALTAM (o script que a cobre vai ABORTAR até a tabela existir)', coalesce(string_agg(t, ', '), 'nenhuma')
  from unnest(array['mercari_pedidos', 'lojinha_repasses', 'repassos', 'claim_eventos', 'claim_sets', 'claim_reservas', 'feedbacks', 'notifications', 'pushes', 'push_reads', 'joiner_storage', 'joiner_conferencias', 'joiner_updates',
        'envio_rounds', 'envio_requests', 'confirmacoes', 'rastreios', 'estoque_itens', 'estoque_compras', 'ceg_config', 'item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos', 'sugestoes_tabela', 'antiv_badges', 'pedidos_dazed_seungmin', 'pedidos_esquire_hyunjin']) t
 where to_regclass('public.' || t) is null

-- 4) STORAGE
union all select '4 storage', 'bucket ' || b.id, case when b.public then 'PÚBLICO' else 'privado' end || ' | arquivos: ' || (select count(*) from storage.objects o where o.bucket_id = b.id)::text
  from storage.buckets b
union all select '4 storage', 'policy ' || p.policyname, p.cmd || ' para ' || array_to_string(p.roles, ',')
  from pg_policies p where p.schemaname = 'storage' and p.tablename = 'objects'
order by 1, 2;
