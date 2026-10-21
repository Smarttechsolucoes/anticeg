-- P0-02/V4 — ENSAIO com ROLLBACK (nada fica gravado; só avança a sequência de ids de multas).
begin;
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
do $$
declare a record; b record; antes int; depois int;
begin
  -- (A) componente que JÁ tem multa registrada, hoje não pago e vencido: ligar o pago NÃO pode criar outra multa
  select m.id, mp.campo into a from public.masterlist m join public.multas_pagas mp on mp.masterlist_id = m.id
   where mp.campo = 'item' and coalesce(m.pago_item,false) = false and m.venc_item is not null and m.venc_item < current_date - 3 and m.cog is not null and m.valor_item > 0 limit 1;
  if a.id is null then raise exception 'ensaio: sem caso A'; end if;
  select count(*) into antes from public.multas_pagas where masterlist_id = a.id and campo = 'item';
  update public.masterlist set pago_item = true where id = a.id;
  select count(*) into depois from public.multas_pagas where masterlist_id = a.id and campo = 'item';
  raise notice 'CASO A (ja tem multa): multas antes=%, depois=% (esperado igual)', antes, depois;
  if antes <> depois then raise exception 'FALHOU caso A'; end if;
  -- (B) componente SEM multa, vencido, sem demanda: ligar o pago cria exatamente UMA multa
  select m.id into b from public.masterlist m
   where coalesce(m.pago_frete,false) = false and m.venc_frete is not null and m.venc_frete < current_date - 3 and m.cog is not null
     and not exists (select 1 from public.multas_pagas mp where mp.masterlist_id = m.id and mp.campo = 'frete')
     and not exists (select 1 from public.pagamento_demandas d where d.status in ('pago','em_analise') and d.itens::text like '%"id": ' || m.id || ',%') limit 1;
  if b.id is null then raise exception 'ensaio: sem caso B'; end if;
  update public.masterlist set pago_frete = true where id = b.id;
  select count(*) into depois from public.multas_pagas where masterlist_id = b.id and campo = 'frete';
  raise notice 'CASO B (sem multa): multas depois=% (esperado 1)', depois;
  if depois <> 1 then raise exception 'FALHOU caso B'; end if;
  -- (C) desliga e liga de novo: continua 1
  update public.masterlist set pago_frete = false where id = b.id;
  update public.masterlist set pago_frete = true where id = b.id;
  select count(*) into depois from public.multas_pagas where masterlist_id = b.id and campo = 'frete';
  raise notice 'CASO C (liga/desliga/liga): multas=% (esperado 1)', depois;
  if depois <> 1 then raise exception 'FALHOU caso C'; end if;
end $$;
rollback;
select 'ensaio concluido; rollback feito' as resultado, md5(pg_get_functiondef('public.registrar_multa_paga'::regproc)) as md5_funcao_atual;
