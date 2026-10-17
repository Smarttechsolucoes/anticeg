-- R1.1 — CONFIRMAR PAGAMENTO COM ITENS QUE O SINCRONIZADOR RECRIOU (id novo, mesmo item). Substitui SÓ o corpo de public.admin_definir_status_pagamento (mesma assinatura, mesmo dono, mesmas permissões).
-- Por que existe: o sync apaga e reinsere linhas da masterlist quando a chave ceg|item|nome muda na planilha, e a linha volta com OUTRO id. As demandas guardam o id antigo (ex.: demanda 779: ids 6183/6184 -> hoje 7238/7239).
--   Sem este ajuste a função só consegue dizer "item ausente" e a administradora teria de marcar à mão.
-- O que muda (e o que NÃO muda):
--   ☆ Para um item da demanda cujo id NÃO existe mais, a função procura o MESMO item pelo id_linha (o código da planilha, que não muda). Só considera o item "reassociável" se TODAS estas condições valerem:
--        exatamente UMA linha da masterlist tem esse id_linha  E  mesmo ceg  E  mesmo nome_do_item  E  cada valor cobrado na demanda (valor_item/frete_inter/taxa_rf > 0) é IGUAL ao valor atual da linha.
--     Qualquer divergência (nome, ceg, valor, id_linha vazio, repetido ou inexistente) => o item continua "ausente"; NUNCA se marca outro item no lugar.
--   ☆ A confirmação continua PARANDO antes de gravar, com 'confirmar_itens_ausentes', agora listando 'reassociaveis' (id antigo -> id atual, CEG, item, dono) e 'ids' (os sem vínculo seguro).
--     Só com aceitar_ausentes = true ela segue: marca os reassociados pelo id ATUAL (e registra a marcação para desfazer depois) e pula os sem vínculo, como no R1.
--   ☆ Itens de OUTRA joiner (terceiros) continuam exigindo confirmação, também para os reassociados (vale o dono da linha atual).
--   ☆ Ao reabrir/rejeitar, a verificação "outra demanda paga cobre o mesmo item" passa a considerar também o id_linha (demanda com id antigo + demanda com id novo para o mesmo item).
--   ☆ O JSON das demandas NÃO é reescrito (histórico preservado). Nenhuma tabela, permissão, policy ou dado é alterado; só o corpo da função. O corpo ANTERIOR fica guardado para a reversão.
-- Tudo em uma transação; qualquer guarda que falhe: "Nada foi alterado".
begin;

do $$
declare v_def text;
begin
  if to_regclass('emergencia.c0b_estado_anterior') is null then raise exception 'R1 não está aplicado (registro de estado ausente). Nada foi alterado.'; end if;
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'R1.1') then raise exception 'R1.1 já foi aplicado. Nada foi alterado.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'R1') then raise exception 'R1 não está aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)') is null then raise exception 'A função do R1 (5 argumentos) não existe. Nada foi alterado.'; end if;
  v_def := pg_get_functiondef('public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure);
  if v_def not like '%confirmar_itens_ausentes%' or v_def like '%reassociaveis%' then raise exception 'A função atual não é a versão do R1 esperada (ou já tem a reassociação). Nada foi alterado.'; end if;
  if (select count(*) from pg_attribute where attrelid = 'public.masterlist'::regclass and attname in ('id', 'cog', 'ceg', 'nome_do_item', 'id_linha', 'valor_item', 'frete_inter', 'taxa_rf', 'pago_item', 'pago_frete', 'pago_rf') and not attisdropped) <> 11 then
    raise exception 'Esperava as colunas id, cog, ceg, nome_do_item, id_linha, valor_item, frete_inter, taxa_rf e pago_* em masterlist. Nada foi alterado.';
  end if;
  if to_regclass('emergencia.pagamento_marcacoes') is null then raise exception 'emergencia.pagamento_marcacoes não existe (R1). Nada foi alterado.'; end if;
end $$;

-- guarda a definição ANTERIOR (a reversão a executa) e as permissões, para provar que não mudam
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'R1.1', 'definicao_anterior admin_definir_status_pagamento', pg_get_functiondef('public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure);
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'R1.1', 'acl_e_dono admin_definir_status_pagamento', coalesce(p.proacl::text, '(padrão)') || ' | dono=' || pg_get_userbyid(p.proowner)
  from pg_proc p where p.oid = 'public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure;

create or replace function public.admin_definir_status_pagamento(p_demanda_id bigint, p_novo_status text, p_motivo text default null, p_aceitar_terceiros boolean default false, p_aceitar_ausentes boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_d record; v_m record; v_c record; v_it jsonb; v_id bigint; r record;
  v_marcados integer := 0; v_desmarcados integer := 0; v_mantidos integer := 0; v_n integer; v_motivo text; v_reass_n integer := 0;
  v_terceiros integer := 0; v_outras text[] := '{}'; v_ausentes bigint[] := '{}'; v_nao_enc bigint[] := '{}';
  v_f_item boolean; v_f_frete boolean; v_f_rf boolean; v_cobre bigint;
  v_idl text; v_cnt integer; v_novo bigint; v_ok boolean; v_mapa jsonb := '{}'::jsonb; v_reass jsonb := '[]'::jsonb;
begin
  if (select public.is_admin()) is not true then raise exception 'sem permissão'; end if;
  if p_novo_status is null or p_novo_status not in ('pago', 'em_analise', 'rejeitado') then raise exception 'status inválido'; end if;
  select id, status, itens, joiner_cog into v_d from public.pagamento_demandas where id = p_demanda_id for update;
  if not found then raise exception 'demanda não encontrada'; end if;
  v_motivo := case when p_novo_status = 'rejeitado' then nullif(left(btrim(coalesce(p_motivo, '')), 500), '') else null end;
  if v_d.status is not distinct from p_novo_status and v_motivo is not distinct from null then
    return jsonb_build_object('status', p_novo_status, 'alterado', false, 'itens_marcados', 0);
  end if;

  -- CONFIRMAR: conferências ANTES de gravar qualquer coisa (itens com id numérico; itens sem id, como "outros", não são da masterlist e não bloqueiam)
  if p_novo_status = 'pago' and jsonb_typeof(v_d.itens) = 'array' then
    for v_it in select e from jsonb_array_elements(v_d.itens) e loop
      if jsonb_typeof(v_it) <> 'object' or coalesce(v_it ->> 'id', '') !~ '^[0-9]{1,18}$' then continue; end if;
      v_id := (v_it ->> 'id')::bigint;
      select m.cog into v_m from public.masterlist m where m.id = v_id;
      if not found then
        -- id antigo (o sync recria linhas com id novo): procura o MESMO item pelo id_linha, com conferência estrita de ceg, nome e valores cobrados
        v_idl := nullif(btrim(coalesce(v_it ->> 'id_linha', '')), '');
        v_ok := false; v_novo := null;
        if v_idl is not null then
          select count(*), min(m.id) into v_cnt, v_novo from public.masterlist m where m.id_linha = v_idl;
          if v_cnt = 1 then
            select m.cog, m.ceg, m.nome_do_item, m.valor_item, m.frete_inter, m.taxa_rf into v_c from public.masterlist m where m.id = v_novo;
            v_ok := v_c.ceg is not distinct from (v_it ->> 'ceg')
                and v_c.nome_do_item is not distinct from (v_it ->> 'nome_do_item')
                and (coalesce(nullif(v_it ->> 'valor_item',  '')::numeric, 0) = 0 or coalesce(v_c.valor_item,  0) = nullif(v_it ->> 'valor_item',  '')::numeric)
                and (coalesce(nullif(v_it ->> 'frete_inter', '')::numeric, 0) = 0 or coalesce(v_c.frete_inter, 0) = nullif(v_it ->> 'frete_inter', '')::numeric)
                and (coalesce(nullif(v_it ->> 'taxa_rf',     '')::numeric, 0) = 0 or coalesce(v_c.taxa_rf,     0) = nullif(v_it ->> 'taxa_rf',     '')::numeric);
          end if;
        end if;
        if v_ok then
          v_mapa := v_mapa || jsonb_build_object(v_id::text, v_novo);
          v_reass := v_reass || jsonb_build_array(jsonb_build_object('id_antigo', v_id, 'id_novo', v_novo, 'ceg', v_c.ceg, 'nome_do_item', v_c.nome_do_item, 'cog', v_c.cog));
          v_m := v_c;   -- o teste de terceiros abaixo usa o dono da linha ATUAL
        else
          v_ausentes := v_ausentes || v_id;
          continue;
        end if;
      end if;
      if lower(btrim(coalesce(v_m.cog, ''))) <> lower(btrim(coalesce(v_d.joiner_cog, ''))) then
        v_terceiros := v_terceiros + 1; v_outras := v_outras || v_m.cog;
      end if;
    end loop;
    if v_terceiros > 0 and not coalesce(p_aceitar_terceiros, false) then
      return jsonb_build_object('status', 'confirmar_terceiros', 'alterado', false, 'itens_de_outra_joiner', v_terceiros,
                                'outras_joiners', (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from unnest(v_outras) x where x is not null));
    end if;
    if (cardinality(v_ausentes) > 0 or jsonb_array_length(v_reass) > 0) and not coalesce(p_aceitar_ausentes, false) then
      return jsonb_build_object('status', 'confirmar_itens_ausentes', 'alterado', false, 'itens_nao_encontrados', cardinality(v_ausentes) + jsonb_array_length(v_reass),
                                'ids', to_jsonb(v_ausentes), 'reassociaveis', v_reass);
    end if;
  end if;

  update public.pagamento_demandas set status = p_novo_status, motivo_rejeicao = v_motivo where id = p_demanda_id;

  if p_novo_status = 'pago' then
    -- liga pago_* dos itens (pelo id ATUAL quando reassociado) e REGISTRA só o que esta confirmação ligou (FALSE -> TRUE)
    if jsonb_typeof(v_d.itens) = 'array' then
      for v_it in select e from jsonb_array_elements(v_d.itens) e loop
        if jsonb_typeof(v_it) <> 'object' or coalesce(v_it ->> 'id', '') !~ '^[0-9]{1,18}$' then continue; end if;
        v_id := (v_it ->> 'id')::bigint;
        if v_mapa ? v_id::text then v_id := (v_mapa ->> v_id::text)::bigint; v_reass_n := v_reass_n + 1; end if;
        select m.pago_item, m.pago_frete, m.pago_rf into v_m from public.masterlist m where m.id = v_id for update;
        if not found then v_nao_enc := v_nao_enc || v_id; continue; end if;
        v_f_item  := coalesce(nullif(v_it ->> 'valor_item',  '')::numeric, 0) > 0 and v_m.pago_item  is not true;
        v_f_frete := coalesce(nullif(v_it ->> 'frete_inter', '')::numeric, 0) > 0 and v_m.pago_frete is not true;
        v_f_rf    := coalesce(nullif(v_it ->> 'taxa_rf',     '')::numeric, 0) > 0 and v_m.pago_rf    is not true;
        if v_f_item or v_f_frete or v_f_rf then
          update public.masterlist m set pago_item = m.pago_item or v_f_item, pago_frete = m.pago_frete or v_f_frete, pago_rf = m.pago_rf or v_f_rf where m.id = v_id;
          if v_f_item  then insert into emergencia.pagamento_marcacoes (masterlist_id, campo, origem, demanda_id) values (v_id, 'item',  'demanda', p_demanda_id); end if;
          if v_f_frete then insert into emergencia.pagamento_marcacoes (masterlist_id, campo, origem, demanda_id) values (v_id, 'frete', 'demanda', p_demanda_id); end if;
          if v_f_rf    then insert into emergencia.pagamento_marcacoes (masterlist_id, campo, origem, demanda_id) values (v_id, 'rf',    'demanda', p_demanda_id); end if;
        end if;
        v_marcados := v_marcados + 1;
      end loop;
    end if;
  elsif v_d.status = 'pago' then
    -- SAIU de 'pago' (reabrir/rejeitar): desfaz SÓ o que esta demanda ligou, salvo se houver outra justificativa
    for r in select id, masterlist_id, campo from emergencia.pagamento_marcacoes where demanda_id = p_demanda_id and origem = 'demanda' and desfeito_em is null order by id for update loop
      -- (b) marcação MANUAL registrada para o mesmo item/campo: ela assume a justificativa e esta marcação é liberada
      if exists (select 1 from emergencia.pagamento_marcacoes x where x.masterlist_id = r.masterlist_id and x.campo = r.campo and x.origem = 'manual' and x.desfeito_em is null) then
        v_mantidos := v_mantidos + 1;
        update emergencia.pagamento_marcacoes set desfeito_em = now() where id = r.id;
        continue;
      end if;
      -- (c) outra demanda PAGA cobre o mesmo item/campo (valor > 0), pelo id OU pelo id_linha (o sync troca o id): a marcação PASSA para ela
      v_cobre := null;
      select d2.id into v_cobre
        from public.pagamento_demandas d2
        cross join lateral jsonb_array_elements(case when jsonb_typeof(d2.itens) = 'array' then d2.itens else '[]'::jsonb end) e
       where d2.id <> p_demanda_id and d2.status = 'pago' and jsonb_typeof(e) = 'object'
         and (case when (e ->> 'id') ~ '^[0-9]{1,18}$' then (e ->> 'id')::bigint end = r.masterlist_id
              or (coalesce(btrim(e ->> 'id_linha'), '') <> '' and e ->> 'id_linha' = (select m.id_linha from public.masterlist m where m.id = r.masterlist_id)))
         and (select case when t.v ~ '^[0-9]+([.][0-9]+)?$' then t.v::numeric else 0 end
                from (select coalesce(e ->> (case r.campo when 'item' then 'valor_item' when 'frete' then 'frete_inter' else 'taxa_rf' end), '') as v) t) > 0
       order by d2.id limit 1;
      if v_cobre is not null then
        v_mantidos := v_mantidos + 1;
        update emergencia.pagamento_marcacoes set demanda_id = v_cobre where id = r.id;
        continue;
      end if;
      -- sem outra justificativa: desfaz SÓ esta marcação
      update public.masterlist m set
        pago_item  = case when r.campo = 'item'  then false else m.pago_item  end,
        pago_frete = case when r.campo = 'frete' then false else m.pago_frete end,
        pago_rf    = case when r.campo = 'rf'    then false else m.pago_rf    end
       where m.id = r.masterlist_id and (case r.campo when 'item' then m.pago_item when 'frete' then m.pago_frete else m.pago_rf end) is true;
      get diagnostics v_n = row_count;
      v_desmarcados := v_desmarcados + v_n;
      update emergencia.pagamento_marcacoes set desfeito_em = now() where id = r.id;
    end loop;
  end if;

  return jsonb_build_object('status', p_novo_status, 'alterado', true, 'itens_marcados', v_marcados, 'itens_reassociados', v_reass_n, 'itens_nao_encontrados', cardinality(v_nao_enc), 'ids_nao_encontrados', to_jsonb(v_nao_enc),
                            'itens_desmarcados', v_desmarcados, 'itens_mantidos', v_mantidos);
end $$;

-- conferência dentro da transação: assinatura, segurança, dono e permissões IDÊNTICAS às de antes
do $$
declare n integer; v_antes text; v_depois text;
begin
  select count(*) into n from pg_proc p where p.oid = 'public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure and p.prosecdef and p.proconfig = array['search_path=""'] and pg_get_userbyid(p.proowner) = 'postgres';
  if n <> 1 then raise exception 'A função não está com security definer, search_path vazio e dono postgres. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)', 'EXECUTE') then raise exception 'O visitante executa a função. Transação desfeita.'; end if;
  if not has_function_privilege('authenticated', 'public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)', 'EXECUTE') then raise exception 'A administradora logada não executa a função. Transação desfeita.'; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'R1.1' and objeto = 'acl_e_dono admin_definir_status_pagamento';
  select coalesce(p.proacl::text, '(padrão)') || ' | dono=' || pg_get_userbyid(p.proowner) into v_depois from pg_proc p where p.oid = 'public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure;
  if v_antes is distinct from v_depois then raise exception 'As permissões/dono da função mudaram (antes: %, depois: %). Transação desfeita.', v_antes, v_depois; end if;
  if pg_get_functiondef('public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure) not like '%reassociaveis%' then raise exception 'O novo corpo não foi gravado. Transação desfeita.'; end if;
end $$;

commit;
