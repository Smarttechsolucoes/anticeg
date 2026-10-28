-- P0-02/V5 — REVERTER: volta a função que estava em produção antes do V5 (guardada em emergencia.p0_02_v2_backup_funcoes, lote P0-02-V5). Não toca em multas nem na masterlist.
begin;
do $$
declare v_def text; v_hash text;
begin
  select definicao, hash into v_def, v_hash from emergencia.p0_02_v2_backup_funcoes where lote = 'P0-02-V5' and nome = 'public.registrar_multa_paga' order by id desc limit 1;
  if v_def is null then raise exception 'backup da função anterior não encontrado: nada foi alterado'; end if;
  execute v_def;
  if md5(pg_get_functiondef('public.registrar_multa_paga'::regproc)) <> v_hash then raise exception 'a função restaurada não confere com o backup: abortado'; end if;
end $$;
commit;
