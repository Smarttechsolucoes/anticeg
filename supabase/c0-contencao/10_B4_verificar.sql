-- C0-B4 — VERIFICAÇÃO (somente leitura).
-- Esperado: as 10 colunas travadas (pago_* do B1 + pag_* e venc_* do B4) com anon_altera = false, autenticado_altera = false
--           e service_role_altera = true. TODAS as outras colunas com os três = true (o site continua editando o resto).
select a.attname as coluna,
       (a.attname in ('pago_item', 'pago_frete', 'pago_rf', 'pag_item', 'pag_frete', 'pag_taxa', 'venc_item', 'venc_frete', 'venc_rf', 'venc_taxa')) as e_campo_travado,
       has_column_privilege('anon', 'public.masterlist', a.attname, 'UPDATE')          as anon_altera,
       has_column_privilege('authenticated', 'public.masterlist', a.attname, 'UPDATE') as autenticado_altera,
       has_column_privilege('service_role', 'public.masterlist', a.attname, 'UPDATE')  as service_role_altera
from pg_attribute a
where a.attrelid = 'public.masterlist'::regclass and a.attnum > 0 and not a.attisdropped
order by (a.attname in ('pago_item', 'pago_frete', 'pago_rf', 'pag_item', 'pag_frete', 'pag_taxa', 'venc_item', 'venc_frete', 'venc_rf', 'venc_taxa')) desc, a.attnum;
