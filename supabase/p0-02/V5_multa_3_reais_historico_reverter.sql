-- P0-02/V5 — REVERTER o histórico: devolve valor_multa às linhas alteradas, a partir da cópia emergencia.p0_02_v5_backup_multas.
begin;
do $$
declare v_n int;
begin
  if to_regclass('emergencia.p0_02_v5_backup_multas') is null then raise exception 'cópia não encontrada: nada foi alterado'; end if;
  update public.multas_pagas mp set valor_multa = b.valor_multa from emergencia.p0_02_v5_backup_multas b where b.id = mp.id;
  get diagnostics v_n = row_count;
  if v_n <> (select count(*) from emergencia.p0_02_v5_backup_multas) then raise exception 'nem todas as linhas voltaram: abortado'; end if;
end $$;
commit;
