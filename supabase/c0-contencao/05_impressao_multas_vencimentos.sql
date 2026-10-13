-- C0-B3/B4 — IMPRESSÃO DIGITAL (somente leitura): prova de que nenhuma multa, vencimento, pedido, COG ou pagamento mudou.
-- Rode ANTES e DEPOIS de cada passo (B3 e B4) e compare. Os números têm de ser IDÊNTICOS.
-- Não devolve dado pessoal: só contagens e hashes.
select 'multas_pagas' as tabela,
       count(*)::text as linhas,
       coalesce(sum(valor_multa), 0)::text as soma_ou_pago,
       null::text as extra,
       md5(coalesce(string_agg(id::text || '|' || joiner_cog || '|' || masterlist_id::text || '|' || campo || '|' || dias_atraso::text || '|' || valor_multa::text, E'\n' order by id), '')) as impressao
from public.multas_pagas
union all
select 'masterlist (vencimentos)',
       count(*)::text,
       'item=' || count(venc_item) || ' frete=' || count(venc_frete) || ' rf=' || count(venc_rf),
       null,
       md5(coalesce(string_agg(id::text || '|' || coalesce(venc_item::text, 'null') || '|' || coalesce(venc_frete::text, 'null') || '|' || coalesce(venc_rf::text, 'null'), E'\n' order by id), ''))
from public.masterlist
union all
select 'masterlist (cog e pagos)',
       count(*)::text,
       'pago_item=' || count(*) filter (where pago_item is true) || ' pago_frete=' || count(*) filter (where pago_frete is true) || ' pago_rf=' || count(*) filter (where pago_rf is true),
       null,
       md5(coalesce(string_agg(id::text || '|' || coalesce(cog, 'null') || '|' || coalesce(pago_item::text, 'null') || '|' || coalesce(pago_frete::text, 'null') || '|' || coalesce(pago_rf::text, 'null'), E'\n' order by id), ''))
from public.masterlist
union all
select 'pagamento_demandas',
       count(*)::text,
       'em_analise=' || count(*) filter (where status = 'em_analise') || ' pago=' || count(*) filter (where status = 'pago') || ' rejeitado=' || count(*) filter (where status = 'rejeitado'),
       null,
       md5(coalesce(string_agg(id::text || '|' || coalesce(status, 'null'), E'\n' order by id), ''))
from public.pagamento_demandas;
