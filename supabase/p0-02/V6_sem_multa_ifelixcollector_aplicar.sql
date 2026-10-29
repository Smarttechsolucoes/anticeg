-- P0-02/V6 — APLICAR: o gatilho registrar_multa_paga NUNCA grava multa para o joiner ifelixcollector (igual ao site: COGS_ISENTOS_MULTA em src/multa.js).
-- Muda SÓ uma linha da função (a guarda "IF NEW.cog IS NULL"); funciona sobre a V3, V4 ou V5. Transação única; ABORTA TUDO se algo não for o esperado.
-- Não altera nenhuma multa existente nem a masterlist. Reversão: V6_sem_multa_ifelixcollector_reverter.sql
begin;
do $$
declare
  v_def text; v_new text; v_n int; v_s numeric; v_hm text;
  v_velha constant text := 'IF NEW.cog IS NULL THEN RETURN NEW; END IF;';
  v_nova  constant text := 'IF NEW.cog IS NULL OR lower(NEW.cog) = ''ifelixcollector'' THEN RETURN NEW; END IF;  -- P0-02/V6: joiner isenta de multa';
begin
  v_def := pg_get_functiondef('public.registrar_multa_paga'::regproc);
  if (select tgenabled from pg_trigger where tgrelid = 'public.masterlist'::regclass and tgname = 'trg_registrar_multa_paga') <> 'O' then
    raise exception 'O gatilho trg_registrar_multa_paga não está ligado como esperado: interrompido, nada foi alterado.';
  end if;
  if position('ifelixcollector' in v_def) > 0 then
    raise exception 'A função já tem a isenção: nada a fazer, nada foi alterado.';
  end if;
  if (length(v_def) - length(replace(v_def, v_velha, ''))) / length(v_velha) <> 1 then
    raise exception 'A função atual não tem exatamente uma linha "%": interrompido, nada foi alterado.', v_velha;
  end if;

  select count(*), coalesce(sum(valor_multa), 0) into v_n, v_s from public.multas_pagas;
  select md5(string_agg(id::text || coalesce(id_linha, '') || coalesce(cog, '') || ceg || pago_item::text || pago_frete::text || pago_rf::text, ',' order by id)) into v_hm from public.masterlist;

  insert into emergencia.p0_02_v2_backup_funcoes (nome, definicao, hash, lote)
  values ('public.registrar_multa_paga', v_def, md5(v_def), 'P0-02-V6');

  v_new := replace(v_def, v_velha, v_nova);
  execute v_new;

  if position('ifelixcollector' in pg_get_functiondef('public.registrar_multa_paga'::regproc)) = 0 then raise exception 'função nova sem a isenção: abortado'; end if;
  if not (select prosecdef from pg_proc where oid = 'public.registrar_multa_paga'::regproc) then raise exception 'função nova sem SECURITY DEFINER: abortado'; end if;
  if (select tgenabled from pg_trigger where tgrelid = 'public.masterlist'::regclass and tgname = 'trg_registrar_multa_paga') <> 'O' then raise exception 'gatilho desligado: abortado'; end if;
  if v_n <> (select count(*) from public.multas_pagas) or v_s <> (select coalesce(sum(valor_multa), 0) from public.multas_pagas) then raise exception 'multas existentes mudaram: abortado'; end if;
  if v_hm <> (select md5(string_agg(id::text || coalesce(id_linha, '') || coalesce(cog, '') || ceg || pago_item::text || pago_frete::text || pago_rf::text, ',' order by id)) from public.masterlist) then raise exception 'masterlist mudou: abortado'; end if;
  if (select count(*) from emergencia.p0_02_v2_backup_funcoes where lote = 'P0-02-V6' and hash = md5(v_def)) <> 1 then raise exception 'backup da função anterior não encontrado: abortado'; end if;
end $$;
commit;

-- conferir:
select position('ifelixcollector' in pg_get_functiondef('public.registrar_multa_paga'::regproc)) > 0 as isencao_ativa,
       (select tgenabled from pg_trigger where tgrelid = 'public.masterlist'::regclass and tgname = 'trg_registrar_multa_paga') as gatilho_ligado_se_O;
