-- P0-02/V5 — VERIFICAR (só leitura): confirma que o gatilho está com a regra de R$3 e mostra as multas mais recentes.
select position('DATE ''2026-10-01''' in pg_get_functiondef('public.registrar_multa_paga'::regproc)) > 0 as regra_de_3_reais_ativa,
       (select tgenabled from pg_trigger where tgrelid = 'public.masterlist'::regclass and tgname = 'trg_registrar_multa_paga') as gatilho_ligado_se_O,
       (select count(*) from emergencia.p0_02_v2_backup_funcoes where lote = 'P0-02-V5') as backups_v5;
-- depois que alguém for marcado como pago com atraso, valor_multa deve ser dias_atraso x 3 (prazo >= 01/10) ou x 1 (anterior):
select id, masterlist_id, campo, dias_atraso, valor_multa, created_at from public.multas_pagas order by id desc limit 10;
