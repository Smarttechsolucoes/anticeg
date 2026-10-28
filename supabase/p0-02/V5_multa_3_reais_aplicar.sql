-- P0-02/V5 — APLICAR: o gatilho registrar_multa_paga passa a gravar R$3 por dia de atraso para prazos a partir de 01/10/2026 (R$1 para os anteriores), igual ao site.
-- Muda SÓ a conta do valor (v_dias * 1 -> v_dias * (3 ou 1)); o resto da função, seja a V3 ou a V4, fica como está. Transação única; ABORTA TUDO se algo não for o esperado.
-- Não altera nenhuma multa existente nem a masterlist (o histórico é outro script: V5_multa_3_reais_historico_opcional.sql). Reversão: V5_multa_3_reais_reverter.sql
begin;
do $$
declare
  v_def text; v_new text; v_n int; v_s numeric; v_hm text;
begin
  v_def := pg_get_functiondef('public.registrar_multa_paga'::regproc);
  if (select tgenabled from pg_trigger where tgrelid = 'public.masterlist'::regclass and tgname = 'trg_registrar_multa_paga') <> 'O' then
    raise exception 'O gatilho trg_registrar_multa_paga não está ligado como esperado: interrompido, nada foi alterado.';
  end if;
  if position('DATE ''2026-10-01''' in v_def) > 0 then
    raise exception 'A função já tem a regra de R$3: nada a fazer, nada foi alterado.';
  end if;
  if (length(v_def) - length(replace(v_def, 'v_dias * 1)', ''))) / length('v_dias * 1)') <> 1 then
    raise exception 'A função atual não tem exatamente um "v_dias * 1)" (não é a V3/V4 esperada): interrompido, nada foi alterado.';
  end if;

  select count(*), coalesce(sum(valor_multa), 0) into v_n, v_s from public.multas_pagas;
  select md5(string_agg(id::text || coalesce(id_linha, '') || coalesce(cog, '') || ceg || pago_item::text || pago_frete::text || pago_rf::text, ',' order by id)) into v_hm from public.masterlist;

  insert into emergencia.p0_02_v2_backup_funcoes (nome, definicao, hash, lote)
  values ('public.registrar_multa_paga', v_def, md5(v_def), 'P0-02-V5');

  v_new := replace(v_def, 'v_dias * 1)', 'v_dias * (CASE WHEN c.venc::date >= DATE ''2026-10-01'' THEN 3 ELSE 1 END))');
  execute v_new;

  if position('DATE ''2026-10-01''' in pg_get_functiondef('public.registrar_multa_paga'::regproc)) = 0 then raise exception 'função nova sem a regra de R$3: abortado'; end if;
  if not (select prosecdef from pg_proc where oid = 'public.registrar_multa_paga'::regproc) then raise exception 'função nova sem SECURITY DEFINER: abortado'; end if;
  if (select tgenabled from pg_trigger where tgrelid = 'public.masterlist'::regclass and tgname = 'trg_registrar_multa_paga') <> 'O' then raise exception 'gatilho desligado: abortado'; end if;
  if v_n <> (select count(*) from public.multas_pagas) or v_s <> (select coalesce(sum(valor_multa), 0) from public.multas_pagas) then raise exception 'multas existentes mudaram: abortado'; end if;
  if v_hm <> (select md5(string_agg(id::text || coalesce(id_linha, '') || coalesce(cog, '') || ceg || pago_item::text || pago_frete::text || pago_rf::text, ',' order by id)) from public.masterlist) then raise exception 'masterlist mudou: abortado'; end if;
  if (select count(*) from emergencia.p0_02_v2_backup_funcoes where lote = 'P0-02-V5' and hash = md5(v_def)) <> 1 then raise exception 'backup da função anterior não encontrado: abortado'; end if;
end $$;
commit;
