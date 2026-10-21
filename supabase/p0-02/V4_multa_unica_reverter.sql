-- P0-02/V4 — REVERTER: volta a função V3 (a que estava em produção antes), guardada em emergencia.p0_02_v2_backup_funcoes (lote P0-02-V4). Não toca em multas nem na masterlist.
begin;
do $$
declare v_def text;
begin
  select definicao into v_def from emergencia.p0_02_v2_backup_funcoes where lote = 'P0-02-V4' and nome = 'public.registrar_multa_paga' order by id desc limit 1;
  if v_def is null then raise exception 'backup da função V3 não encontrado: nada foi alterado'; end if;
  execute v_def;
  if md5(pg_get_functiondef('public.registrar_multa_paga'::regproc)) <> '4e16a9218ad2aaebaf392a3a8d7f895c' then raise exception 'a função restaurada não confere com a V3: abortado'; end if;
end $$;
commit;
