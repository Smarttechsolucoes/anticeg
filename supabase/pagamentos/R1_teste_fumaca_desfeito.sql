-- R1 — TESTE DE FUMAÇA COM DESFAZIMENTO AUTOMÁTICO. Rode DEPOIS de R1_admin_pagamentos_aplicar.sql e do _verificar. NADA É GRAVADO.
-- Como funciona: tudo roda dentro de UM bloco DO e ele termina de propósito com um ERRO ("R1 FUMAÇA ..."), o que desfaz a transação inteira (inclusive o gatilho de multa).
--   O texto do erro é o relatório. Se aparecer "R1 FUMAÇA OK" tudo passou; "R1 FUMAÇA FALHA" lista o que falhou. Nenhuma notificação, e-mail ou chamada externa é disparada (só SQL).
-- Usa: a primeira administradora de admin_roles e UM item real da masterlist ainda não pago (só para o teste; o estado dele é restaurado pelo desfazimento).
-- GUARDAS DE SEGURANÇA (antes de gravar qualquer coisa, o próprio teste confere e ABORTA se algo for inesperado): (a) só pode haver ligado, nas tabelas tocadas, o gatilho trg_registrar_multa_paga; (b) o corpo dele
--   não pode conter HTTP, NOTIFY, dblink, pg_net, COPY PROGRAM ou similares; (c) nenhuma regra (RULE) nessas tabelas. Tudo é transacional: o único efeito que NÃO é desfeito é o avanço da numeração (sequência) dos ids
--   de pagamento_demandas e multas_pagas (ids "pulam" 2-3 números; nenhum dado). Há também um bloqueio de linha de milissegundos no item usado, até o desfazimento.
-- Cobre: visitante negado · logada sem ser admin negada · admin confirma · item de outra joiner pede confirmação · reabrir · rejeitar com motivo · marcar pago manual · item inexistente.
do $$
declare
  rep text := ''; falhas int := 0; v_admin uuid; v_outra uuid := gen_random_uuid(); v_item bigint; v_cog text; v_dem bigint; v_dem2 bigint;
  g record; r jsonb; st text; mot text; v_pi boolean; v_pf boolean; v_msg text;
begin
  -- guardas (nada foi gravado ainda)
  for g in select t.tgname, t.tgfoid, c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid
            where not t.tgisinternal and t.tgenabled <> 'D' and t.tgrelid in ('public.masterlist'::regclass, 'public.pagamento_demandas'::regclass, 'public.multas_pagas'::regclass) loop
    if g.tgname <> 'trg_registrar_multa_paga' then raise exception 'R1 FUMAÇA ABORTADO (nada gravado): gatilho inesperado ligado: % em %. Não executo o teste.', g.tgname, g.relname; end if;
    if pg_get_functiondef(g.tgfoid) ~* '(net\.|http_|pg_notify|\mnotify\M|dblink|pg_net|supabase_functions|copy[^;]*program|lo_import|lo_export|pg_read_file)' then
      raise exception 'R1 FUMAÇA ABORTADO (nada gravado): o gatilho % parece ter efeito externo. Não executo o teste.', g.tgname; end if;
  end loop;
  if exists (select 1 from pg_rewrite r where r.ev_class in ('public.masterlist'::regclass, 'public.pagamento_demandas'::regclass, 'public.multas_pagas'::regclass) and r.rulename <> '_RETURN') then
    raise exception 'R1 FUMAÇA ABORTADO (nada gravado): há regras (RULE) nas tabelas tocadas. Não executo o teste.'; end if;
  select user_id into v_admin from public.admin_roles order by user_id limit 1;
  if v_admin is null then raise exception 'R1 FUMAÇA: nenhuma administradora em admin_roles (nada gravado)'; end if;
  select m.id, m.cog into v_item, v_cog from public.masterlist m where m.pago_item is not true and m.pago_frete is not true and m.cog is not null and btrim(m.cog) <> '' order by m.id limit 1;
  if v_item is null then raise exception 'R1 FUMAÇA: não achei um item não pago com @ para usar no teste (nada gravado)'; end if;

  insert into public.pagamento_demandas (joiner_cog, itens, valor_total)
  values (v_cog, jsonb_build_array(jsonb_build_object('id', v_item, 'valor_item', 1, 'frete_inter', 0, 'taxa_rf', 0)), 1) returning id into v_dem;
  insert into public.pagamento_demandas (joiner_cog, itens, valor_total)
  values ('zz_teste_r1_terceiro', jsonb_build_array(jsonb_build_object('id', v_item, 'valor_item', 1, 'frete_inter', 0, 'taxa_rf', 0)), 1) returning id into v_dem2;

  -- 1) VISITANTE: não executa
  set local role anon;
  begin
    perform public.admin_definir_status_pagamento(v_dem, 'pago');
    rep := rep || E'FALHA visitante conseguiu executar admin_definir_status_pagamento\n'; falhas := falhas + 1;
  exception when others then rep := rep || E'OK    visitante negado (' || sqlstate || E')\n';
  end;
  begin
    perform public.admin_marcar_pago(v_item, true, false, false);
    rep := rep || E'FALHA visitante conseguiu executar admin_marcar_pago\n'; falhas := falhas + 1;
  exception when others then rep := rep || E'OK    visitante negado em admin_marcar_pago (' || sqlstate || E')\n';
  end;
  reset role;

  -- 2) LOGADA QUE NÃO É ADMIN (ex.: joiner com conta): negada pela função
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outra, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outra::text, true);
  set local role authenticated;
  begin
    perform public.admin_definir_status_pagamento(v_dem, 'pago');
    rep := rep || E'FALHA logada sem ser admin conseguiu confirmar\n'; falhas := falhas + 1;
  exception when others then get stacked diagnostics v_msg = message_text; rep := rep || E'OK    logada sem ser admin negada (' || v_msg || E')\n';
  end;
  begin
    perform public.admin_marcar_pago(v_item, true, false, false);
    rep := rep || E'FALHA logada sem ser admin conseguiu marcar pago\n'; falhas := falhas + 1;
  exception when others then rep := rep || E'OK    logada sem ser admin negada em admin_marcar_pago\n';
  end;
  reset role;
  select pago_item into v_pi from public.masterlist where id = v_item;
  if v_pi is true then rep := rep || E'FALHA o item foi marcado pago apesar das negações\n'; falhas := falhas + 1; else rep := rep || E'OK    item continua não pago depois das negações\n'; end if;

  -- 3) ADMINISTRADORA
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  -- 3a) confirmar (itens da própria joiner)
  r := public.admin_definir_status_pagamento(v_dem, 'pago');
  reset role;
  select status into st from public.pagamento_demandas where id = v_dem;
  select pago_item into v_pi from public.masterlist where id = v_item;
  if st = 'pago' and v_pi is true and (r ->> 'itens_marcados')::int = 1 then rep := rep || E'OK    admin confirmou: demanda pago, item marcado, 1 item (' || r::text || E')\n'; else rep := rep || E'FALHA confirmar: status=' || coalesce(st, 'null') || ' pago_item=' || coalesce(v_pi::text, 'null') || ' ' || r::text || E'\n'; falhas := falhas + 1; end if;
  -- 3b) reabrir
  set local role authenticated;
  r := public.admin_definir_status_pagamento(v_dem, 'em_analise');
  reset role;
  select status into st from public.pagamento_demandas where id = v_dem;
  if st = 'em_analise' then rep := rep || E'OK    admin reabriu (status em_analise)\n'; else rep := rep || E'FALHA reabrir: ' || coalesce(st, 'null') || E'\n'; falhas := falhas + 1; end if;
  -- 3c) rejeitar com motivo
  set local role authenticated;
  r := public.admin_definir_status_pagamento(v_dem, 'rejeitado', 'comprovante ilegível (teste)');
  reset role;
  select status, motivo_rejeicao into st, mot from public.pagamento_demandas where id = v_dem;
  if st = 'rejeitado' and mot = 'comprovante ilegível (teste)' then rep := rep || E'OK    admin rejeitou com motivo\n'; else rep := rep || E'FALHA rejeitar: ' || coalesce(st, 'null') || ' / ' || coalesce(mot, 'null') || E'\n'; falhas := falhas + 1; end if;
  -- 3d) itens de OUTRA joiner exigem confirmação explícita
  update public.masterlist set pago_item = false where id = v_item;
  set local role authenticated;
  r := public.admin_definir_status_pagamento(v_dem2, 'pago');
  reset role;
  select status into st from public.pagamento_demandas where id = v_dem2;
  select pago_item into v_pi from public.masterlist where id = v_item;
  if r ->> 'status' = 'confirmar_terceiros' and st = 'em_analise' and v_pi is not true then rep := rep || E'OK    item de outra joiner pede confirmação e nada é alterado antes\n'; else rep := rep || E'FALHA terceiros: ' || r::text || ' status=' || coalesce(st, 'null') || E'\n'; falhas := falhas + 1; end if;
  set local role authenticated;
  r := public.admin_definir_status_pagamento(v_dem2, 'pago', null, true);
  reset role;
  select status into st from public.pagamento_demandas where id = v_dem2;
  select pago_item into v_pi from public.masterlist where id = v_item;
  if st = 'pago' and v_pi is true then rep := rep || E'OK    com aceitar_terceiros=true confirma e marca o item\n'; else rep := rep || E'FALHA terceiros aceitos: ' || r::text || E'\n'; falhas := falhas + 1; end if;
  -- 3e) marcar pago manual (só liga) e item inexistente
  update public.masterlist set pago_frete = false where id = v_item;
  set local role authenticated;
  r := public.admin_marcar_pago(v_item, false, true, false);
  reset role;
  select pago_item, pago_frete into v_pi, v_pf from public.masterlist where id = v_item;
  if r ->> 'status' = 'ok' and v_pf is true and v_pi is true then rep := rep || E'OK    marcar pago manual liga o frete e não desmarca o item\n'; else rep := rep || E'FALHA marcar manual: ' || r::text || E'\n'; falhas := falhas + 1; end if;
  set local role authenticated;
  r := public.admin_marcar_pago(-1, true, false, false);
  reset role;
  if r ->> 'status' = 'nao_encontrado' then rep := rep || E'OK    item inexistente devolve nao_encontrado\n'; else rep := rep || E'FALHA item inexistente: ' || r::text || E'\n'; falhas := falhas + 1; end if;

  -- o erro abaixo é PROPOSITAL: desfaz tudo (demandas de teste, marcações, multa registrada pelo gatilho)
  if falhas = 0 then raise exception E'R1 FUMAÇA OK (todas as verificações passaram; NADA foi gravado, este erro é proposital):\n%', rep;
  else raise exception E'R1 FUMAÇA FALHA (% falha(s); NADA foi gravado):\n%', falhas, rep; end if;
end $$;
