-- R2 — REVERTER. Remove gatilhos e funcoes. As colunas ficam (guardam o historico e nao atrapalham).
-- Para apagar as colunas tambem, descomente as linhas do fim.
begin;
drop trigger if exists trg_reports_responsavel on public.reports;
drop trigger if exists trg_pagamento_demandas_responsavel on public.pagamento_demandas;
drop function if exists public.trg_reports_responsavel();
drop function if exists public.trg_pagamento_demandas_responsavel();
drop function if exists public.admin_responder_report(text, text, text);
drop function if exists public.admin_nome();
-- alter table public.reports drop column if exists respondido_por, drop column if exists respondido_em;
-- alter table public.pagamento_demandas drop column if exists analisado_por, drop column if exists analisado_em;
-- alter table public.admin_roles drop column if exists nome;
commit;
