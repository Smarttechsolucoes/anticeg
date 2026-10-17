-- S2 — impressão do estado (SOMENTE LEITURA). Compare com os valores registrados em S2_verificacao_24h.md.
select 'linhas' k, count(*)::text v from public.masterlist
union all select 'impressão id|cog|id_linha|ceg', md5(string_agg(id::text||'|'||coalesce(cog,'')||'|'||coalesce(id_linha,'')||'|'||coalesce(ceg,''), ',' order by id)) from public.masterlist
union all select 'impressão pagamentos', md5(string_agg(id::text||coalesce(pago_item::text,'')||coalesce(pago_frete::text,'')||coalesce(pago_rf::text,''), ',' order by id)) from public.masterlist
union all select 'claims', count(*)::text from public.claims
union all select 'claims impressão', md5(string_agg(id::text||'|'||coalesce(masterlist_id::text,''), ',' order by id)) from public.claims
union all select 'multas_pagas', count(*)::text from public.multas_pagas
union all select 'linhas com claim', (select count(*)::text from public.masterlist m where exists (select 1 from public.claims c where c.masterlist_id=m.id))
union all select 'demandas por status', (select string_agg(status||'='||n, ' ' order by status) from (select status, count(*) n from public.pagamento_demandas group by 1) x)
union all select 'arquivadas', count(*)::text from public.masterlist_exclusoes
union all select 'maior id', max(id)::text from public.masterlist;
