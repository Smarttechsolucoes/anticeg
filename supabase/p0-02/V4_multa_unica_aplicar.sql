-- P0-02/V4 — APLICAR: a multa deixa de ser criada de novo para o mesmo componente (masterlist_id + campo). Transação única; ABORTA TUDO se a função atual não for a esperada (V3, md5 4e16a9218ad2aaebaf392a3a8d7f895c).
-- Não altera nenhuma multa existente nem nenhuma linha da masterlist. Reversão: V4_multa_unica_reverter.sql
begin;
do $$ begin
  if md5(pg_get_functiondef('public.registrar_multa_paga'::regproc)) <> '4e16a9218ad2aaebaf392a3a8d7f895c' then
    raise exception 'A função registrar_multa_paga atual NÃO é a esperada (md5 diferente): interrompido, nada foi alterado.';
  end if;
  if (select tgenabled from pg_trigger where tgrelid = 'public.masterlist'::regclass and tgname = 'trg_registrar_multa_paga') <> 'O' then
    raise exception 'O gatilho trg_registrar_multa_paga não está ligado como esperado: interrompido.';
  end if;
end $$;
create temp table _antes on commit drop as select (select count(*) from public.multas_pagas) n, (select coalesce(sum(valor_multa), 0) from public.multas_pagas) s, (select md5(string_agg(id::text || coalesce(id_linha, '') || coalesce(cog, '') || ceg || pago_item::text || pago_frete::text || pago_rf::text, ',' order by id)) from public.masterlist) hm;
insert into emergencia.p0_02_v2_backup_funcoes (nome, definicao, hash, lote) select 'public.registrar_multa_paga', pg_get_functiondef('public.registrar_multa_paga'::regproc), md5(pg_get_functiondef('public.registrar_multa_paga'::regproc)), 'P0-02-V4';
CREATE OR REPLACE FUNCTION public.registrar_multa_paga()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  c record;
  v_ovr date;
  v_dem date;
  v_ref date;
  v_dias integer;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;   -- 'hoje' e as datas das demandas no horário de Brasília (current_date/::date usavam UTC e adiantavam o dia depois das 21h)
BEGIN
  IF NEW.cog IS NULL THEN RETURN NEW; END IF;

  -- P0-02/V3 (fuso de Brasília) + V4 (sem multa repetida): o atraso é medido até a DATA DE REFERÊNCIA do pagamento, e não até HOJE. Só age quando o campo passa de não-pago para pago.
  -- Referência (nunca depois de hoje; vale a primeira que existir, nesta ordem de prioridade):
  --   1) correção MANUAL em emergencia.multa_data_referencia (comprovação de pagamento bancário anterior ao envio do comprovante);
  --   2) data de ENVIO do comprovante da demanda 'pago'/'em_analise' que cobre este item/campo (nunca a data de aprovação da administradora);
  --   3) sem nenhuma das duas: hoje (regra anterior).
  -- SECURITY DEFINER porque o schema emergencia não é acessível a service_role/authenticated e o sync grava como service_role.
  FOR c IN SELECT * FROM (VALUES
      ('item'::text,  NEW.pago_item,  OLD.pago_item,  NEW.venc_item,  'valor_item'::text),
      ('frete'::text, NEW.pago_frete, OLD.pago_frete, NEW.venc_frete, 'frete_inter'::text),
      ('rf'::text,    NEW.pago_rf,    OLD.pago_rf,    NEW.venc_rf,    'taxa_rf'::text)
    ) AS t(campo, novo, antigo, venc, chave)
  LOOP
    IF c.novo = true AND (c.antigo IS DISTINCT FROM true) AND c.venc IS NOT NULL AND (v_hoje - c.venc::date) > 0 THEN
      SELECT r.data_referencia INTO v_ovr
        FROM emergencia.multa_data_referencia r
       WHERE r.masterlist_id = NEW.id AND r.campo = c.campo;
      SELECT min((d.created_at AT TIME ZONE 'America/Sao_Paulo')::date) INTO v_dem
        FROM public.pagamento_demandas d
       WHERE d.status IN ('pago', 'em_analise')
         AND jsonb_typeof(d.itens) = 'array'
         AND EXISTS (
               SELECT 1 FROM jsonb_array_elements(d.itens) e
                WHERE jsonb_typeof(e) = 'object'
                  AND ((e ->> 'id') = NEW.id::text OR (NEW.id_linha IS NOT NULL AND btrim(coalesce(e ->> 'id_linha', '')) = NEW.id_linha))
                  AND (CASE WHEN (e ->> c.chave) ~ '^[0-9]+([.][0-9]+)?$' THEN (e ->> c.chave)::numeric ELSE 0 END) > 0);
      v_ref := least(v_hoje, coalesce(v_ovr, v_dem, v_hoje));
      v_dias := v_ref - c.venc::date;
      -- P0-02/V4: no máximo UMA multa por componente (masterlist_id + campo). Se o pago liga e desliga (planilha x painel x sync), cada nova ligação gerava outra multa
      -- (já havia 456 multas repetidas); a multa já registrada continua valendo e não é alterada.
      IF v_dias > 0 AND NOT EXISTS (SELECT 1 FROM public.multas_pagas mp WHERE mp.masterlist_id = NEW.id AND mp.campo = c.campo) THEN
        INSERT INTO public.multas_pagas (joiner_cog, masterlist_id, campo, dias_atraso, valor_multa)
        VALUES (NEW.cog, NEW.id, c.campo, v_dias, v_dias * 1);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
do $$ declare a record; begin
  select * into a from _antes;
  if a.n <> (select count(*) from public.multas_pagas) or a.s <> (select coalesce(sum(valor_multa), 0) from public.multas_pagas) then raise exception 'multas existentes mudaram: abortado'; end if;
  if a.hm <> (select md5(string_agg(id::text || coalesce(id_linha, '') || coalesce(cog, '') || ceg || pago_item::text || pago_frete::text || pago_rf::text, ',' order by id)) from public.masterlist) then raise exception 'masterlist mudou: abortado'; end if;
  if not (select prosecdef from pg_proc where oid = 'public.registrar_multa_paga'::regproc) then raise exception 'função nova sem SECURITY DEFINER: abortado'; end if;
  if (select count(*) from emergencia.p0_02_v2_backup_funcoes where hash = '4e16a9218ad2aaebaf392a3a8d7f895c' and lote = 'P0-02-V4') <> 1 then raise exception 'backup da função V3 não encontrado: abortado'; end if;
  if (select tgenabled from pg_trigger where tgrelid = 'public.masterlist'::regclass and tgname = 'trg_registrar_multa_paga') <> 'O' then raise exception 'gatilho desligado: abortado'; end if;
  if pg_get_functiondef('public.registrar_multa_paga'::regproc) not like '%NOT EXISTS (SELECT 1 FROM public.multas_pagas mp%' then raise exception 'função nova não contém a trava: abortado'; end if;
end $$;
commit;
