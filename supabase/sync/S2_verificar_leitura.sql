-- S2 — VERIFICAÇÃO / MONITORAMENTO (SOMENTE LEITURA; um SELECT; não altera nada; só contagens, nenhum dado de joiner). Rode ANTES de publicar o S2 (linha de base) e depois de cada execução do sync, para comparar.
-- Linha de base medida em produção em 2026-10-16 (antes do S2): ver a coluna "base 16/10". O S2 NÃO muda o banco: só muda como o sync escolhe a linha a atualizar. O efeito esperado é a queda do ritmo de recriação de linhas.
with itens as (
  select d.id as demanda, d.status, e from public.pagamento_demandas d cross join lateral jsonb_array_elements(case when jsonb_typeof(d.itens) = 'array' then d.itens else '[]'::jsonb end) e
   where jsonb_typeof(e) = 'object' and (e ->> 'id') ~ '^[0-9]{1,18}$'),
obsoletos as (select * from itens i where not exists (select 1 from public.masterlist m where m.id = (i.e ->> 'id')::bigint))
select 1 as ordem, 'linhas na masterlist' as item, (select count(*)::text from public.masterlist) as valor, '6412 (varia com a planilha)' as base_16_10, 'estável: só muda com itens realmente novos/removidos' as leitura
union all select 2, 'linhas sem id_linha (continuam pela regra antiga)', (select count(*)::text from public.masterlist where coalesce(btrim(id_linha), '') = ''), '1015', 'não deve crescer; quem cadastra o código na planilha reduz'
union all select 3, 'valores de id_linha repetidos no banco (o S2 não os usa)', (select count(*)::text from (select id_linha from public.masterlist where coalesce(btrim(id_linha), '') <> '' group by id_linha having count(*) > 1) x), '24', 'NÃO deve crescer; se crescer, o gerador de códigos está repetindo'
union all select 4, 'chaves ceg|item|nome repetidas no banco', (select count(*)::text from (select 1 from public.masterlist group by lower(ceg || '|' || nome_do_item || '|' || coalesce(nome, '')) having count(*) > 1) x), '203', 'NÃO deve crescer (se crescer, o sync está duplicando)'
union all select 5, 'itens de demandas com id obsoleto (total)', (select count(*)::text from obsoletos), '413', 'NÃO deve crescer para demandas novas depois do S2 (as antigas permanecem)'
union all select 6, '…em demandas EM ANÁLISE', (select count(*)::text from obsoletos where status = 'em_analise'), '2 (demanda 779)', 'deve voltar a 0 depois que a 779 for decidida e se manter 0'
union all select 7, 'ids emitidos e que não existem mais (maior id - linhas)', ((select max(id) from public.masterlist) - (select count(*) from public.masterlist))::text, '1943', 'cresce a cada linha recriada: compare a diferença entre duas medições; deve cair para perto de 0 por dia'
union all select 8, 'último valor da sequência / maior id', coalesce((select last_value::text from pg_sequences where schemaname = 'public' and sequencename ilike 'masterlist%id%seq' limit 1), '?') || ' / ' || (select max(id)::text from public.masterlist), '8355 / 8355', 'a sequência sobe só com INSERT novo'
order by 1;
