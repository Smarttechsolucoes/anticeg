-- P0-02/V5 — HISTÓRICO (OPCIONAL, rodar DEPOIS do aplicar): as multas já gravadas para prazos a partir de 01/10/2026 estão a R$1/dia (valor_multa = dias_atraso);
-- aqui elas passam a R$3/dia (valor_multa = dias_atraso * 3). Só mexe na coluna valor_multa, e só nas linhas ainda a R$1/dia. Guarda uma cópia antes.
-- Medido em 28/10: 272 multas, R$807 gravados -> R$2.421 (diferença R$1.614). O site não usa esse valor (só conta as linhas); serve para relatório/planilha.
-- Reversão: V5_multa_3_reais_historico_reverter.sql
begin;
do $$
declare v_n int; v_antes numeric; v_depois numeric; v_afetadas int;
begin
  if to_regclass('emergencia.p0_02_v5_backup_multas') is not null then raise exception 'já existe emergencia.p0_02_v5_backup_multas: este script já rodou, nada foi alterado.'; end if;

  create table emergencia.p0_02_v5_backup_multas as
    select mp.* from public.multas_pagas mp join public.masterlist m on m.id = mp.masterlist_id
     where mp.valor_multa = mp.dias_atraso * 1
       and (case mp.campo when 'item' then m.venc_item when 'frete' then m.venc_frete when 'rf' then m.venc_rf end)::date >= date '2026-10-01';
  select count(*), coalesce(sum(valor_multa), 0) into v_n, v_antes from emergencia.p0_02_v5_backup_multas;

  update public.multas_pagas mp set valor_multa = mp.dias_atraso * 3 where mp.id in (select id from emergencia.p0_02_v5_backup_multas);
  get diagnostics v_afetadas = row_count;

  select coalesce(sum(mp.valor_multa), 0) into v_depois from public.multas_pagas mp where mp.id in (select id from emergencia.p0_02_v5_backup_multas);
  if v_afetadas <> v_n then raise exception 'linhas alteradas (%) diferem das copiadas (%): abortado', v_afetadas, v_n; end if;
  if v_depois <> (select sum(dias_atraso) * 3 from emergencia.p0_02_v5_backup_multas) then raise exception 'soma após a correção não confere: abortado'; end if;
  raise notice 'multas corrigidas: % | antes R$ % | depois R$ %', v_n, v_antes, v_depois;
end $$;
commit;
