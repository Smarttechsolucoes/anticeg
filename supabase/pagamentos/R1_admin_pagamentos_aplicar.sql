-- R1 — RESTAURA A CONFIRMAÇÃO DE PAGAMENTOS PARA AS ADMINISTRADORAS, COM A AUTORIZAÇÃO FEITA NO SERVIDOR
-- Por que existe: o C0 tirou UPDATE de pagamento_demandas e das colunas pago_* da masterlist, e o botão ficou suspenso (PAGAMENTOS_SUSPENSO) porque a função antiga
--   set_pagamento_demanda_status era SECURITY DEFINER SEM checar quem chama e liberada para o visitante (anon).
-- O que faz (FUNÇÕES + um registro interno; nenhuma permissão de tabela ou coluna do site é alterada, nenhuma policy, nenhum dado existente):
--   1) admin_definir_status_pagamento(demanda, status, motivo, aceitar_terceiros, aceitar_ausentes): muda o status da demanda (pago | em_analise | rejeitado). Só para quem está em admin_roles (is_admin() IS NOT TRUE => nega, inclusive NULL).
--      Em 'pago', ANTES de gravar qualquer coisa, confere os itens da demanda que têm id numérico:
--        ☆ item de OUTRA joiner      => devolve 'confirmar_terceiros' e não altera nada até a administradora confirmar de novo com aceitar_terceiros = true;
--        ☆ item que NÃO EXISTE mais na masterlist (ex.: removido/renomeado pelo sync) => devolve 'confirmar_itens_ausentes' (com os ids) e não altera nada até confirmar com aceitar_ausentes = true.
--          (itens sem id, como o campo "outros" do formulário, não são da masterlist e nunca bloqueiam.)
--      Depois marca pago_item / pago_frete / pago_rf dos itens na MESMA transação e REGISTRA, em emergencia.pagamento_marcacoes, só as marcações que ESTA confirmação ligou (FALSE -> TRUE).
--      Ao SAIR de 'pago' (reabrir ou rejeitar), desfaz apenas as marcações registradas por esta demanda, e NÃO desfaz: (a) campo já marcado antes da confirmação (planilha/sync/outra origem: nunca foi registrado),
--      (b) campo com marcação MANUAL registrada, (c) campo que outra demanda também PAGA cobre (a marcação passa para essa demanda, que a desfaz se também sair de 'pago'). O que não é desfeito fica contado em 'itens_mantidos'.
--   2) admin_marcar_pago(item, item?, frete?, rf?): marca como pago (nunca desmarca) itens da masterlist e registra a marcação como MANUAL (protege contra o desfazimento do item 1); mesma autorização.
--   3) as funções passam a pertencer ao postgres (confere no fim); a função antiga set_pagamento_demanda_status perde a execução de visitante e de logado (fecha o buraco); o site passa a usar as novas.
-- Não toca em multas_pagas: se o gatilho de multa registrou multa ao confirmar, ela NÃO é apagada ao reabrir/rejeitar (dinheiro: decisão humana).
-- Tudo em uma transação com registro do estado anterior; qualquer guarda que falhe: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'R1') then raise exception 'R1 já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'public.is_admin() não existe (A1/A2 não aplicados). Nada foi alterado.'; end if;
  if to_regclass('public.admin_roles') is null then raise exception 'public.admin_roles não existe. Nada foi alterado.'; end if;
  if to_regclass('public.pagamento_demandas') is null or to_regclass('public.masterlist') is null then raise exception 'pagamento_demandas/masterlist não existem. Nada foi alterado.'; end if;
  if (select count(*) from pg_attribute where attrelid = 'public.pagamento_demandas'::regclass and attname in ('id', 'itens', 'status', 'motivo_rejeicao', 'joiner_cog') and not attisdropped) <> 5 then
    raise exception 'Esperava as colunas id, itens, status, motivo_rejeicao e joiner_cog em pagamento_demandas. Nada foi alterado.';
  end if;
  -- as funções usam jsonb_typeof / jsonb_array_elements sobre itens: se a coluna for json (e não jsonb) elas falhariam na primeira confirmação real
  if (select format_type(a.atttypid, a.atttypmod) from pg_attribute a where a.attrelid = 'public.pagamento_demandas'::regclass and a.attname = 'itens' and not a.attisdropped) is distinct from 'jsonb' then
    raise exception 'pagamento_demandas.itens precisa ser jsonb e é %. Nada foi alterado.', (select format_type(a.atttypid, a.atttypmod) from pg_attribute a where a.attrelid = 'public.pagamento_demandas'::regclass and a.attname = 'itens');
  end if;
  if (select count(*) from pg_attribute where attrelid = 'public.masterlist'::regclass and attname in ('id', 'cog', 'pago_item', 'pago_frete', 'pago_rf') and not attisdropped) <> 5 then
    raise exception 'Esperava as colunas id, cog, pago_item, pago_frete e pago_rf em masterlist. Nada foi alterado.';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('admin_definir_status_pagamento', 'admin_marcar_pago')) then
    raise exception 'As funções do R1 já existem (qualquer assinatura). Nada foi alterado.';
  end if;
end $$;

-- estado ANTERIOR: permissões de tabela/coluna (para provar que não mudam) e o que a função antiga permitia
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'R1', 'permissões ' || c.relname,
       md5(coalesce(c.relacl::text, '') || '|' || coalesce((select string_agg(a.attname || '=' || a.attacl::text, ';' order by a.attname) from pg_attribute a where a.attrelid = c.oid and a.attacl is not null), ''))
  from pg_class c where c.oid in ('public.pagamento_demandas'::regclass, 'public.masterlist'::regclass);
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'R1', 'funcao_antiga ' || p.oid::regprocedure::text,
       json_build_object('anon', has_function_privilege('anon', p.oid, 'EXECUTE'), 'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'set_pagamento_demanda_status';

-- registro INTERNO (schema emergencia: sem acesso de visitante/logado, fora da API) de quem ligou cada pago_*: base para desfazer só o que uma confirmação ligou
create table if not exists emergencia.pagamento_marcacoes (
  id            bigint generated always as identity primary key,
  criado_em     timestamptz not null default now(),
  masterlist_id bigint not null,
  campo         text   not null check (campo in ('item', 'frete', 'rf')),
  origem        text   not null check (origem in ('demanda', 'manual')),
  demanda_id    bigint,
  desfeito_em   timestamptz,
  constraint pagamento_marcacoes_origem_ck check ((origem = 'demanda') = (demanda_id is not null))
);
create unique index if not exists pagamento_marcacoes_manual_uq on emergencia.pagamento_marcacoes (masterlist_id, campo) where origem = 'manual' and desfeito_em is null;
create index if not exists pagamento_marcacoes_demanda_ix on emergencia.pagamento_marcacoes (demanda_id) where desfeito_em is null;
alter table emergencia.pagamento_marcacoes enable row level security;
revoke all on table emergencia.pagamento_marcacoes from public, anon, authenticated;
alter table emergencia.pagamento_marcacoes owner to postgres;

-- 1) status da demanda + marcação dos itens na masterlist (mesma transação)
create function public.admin_definir_status_pagamento(p_demanda_id bigint, p_novo_status text, p_motivo text default null, p_aceitar_terceiros boolean default false, p_aceitar_ausentes boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_d record; v_m record; v_it jsonb; v_id bigint; r record;
  v_marcados integer := 0; v_desmarcados integer := 0; v_mantidos integer := 0; v_n integer; v_motivo text;
  v_terceiros integer := 0; v_outras text[] := '{}'; v_ausentes bigint[] := '{}'; v_nao_enc bigint[] := '{}';
  v_f_item boolean; v_f_frete boolean; v_f_rf boolean; v_cobre bigint;
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
        v_ausentes := v_ausentes || v_id;
      elsif lower(btrim(coalesce(v_m.cog, ''))) <> lower(btrim(coalesce(v_d.joiner_cog, ''))) then
        v_terceiros := v_terceiros + 1; v_outras := v_outras || v_m.cog;
      end if;
    end loop;
    if v_terceiros > 0 and not coalesce(p_aceitar_terceiros, false) then
      return jsonb_build_object('status', 'confirmar_terceiros', 'alterado', false, 'itens_de_outra_joiner', v_terceiros,
                                'outras_joiners', (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from unnest(v_outras) x where x is not null));
    end if;
    if cardinality(v_ausentes) > 0 and not coalesce(p_aceitar_ausentes, false) then
      return jsonb_build_object('status', 'confirmar_itens_ausentes', 'alterado', false, 'itens_nao_encontrados', cardinality(v_ausentes), 'ids', to_jsonb(v_ausentes));
    end if;
  end if;

  update public.pagamento_demandas set status = p_novo_status, motivo_rejeicao = v_motivo where id = p_demanda_id;

  if p_novo_status = 'pago' then
    -- liga pago_* dos itens e REGISTRA só o que esta confirmação ligou (FALSE -> TRUE)
    if jsonb_typeof(v_d.itens) = 'array' then
      for v_it in select e from jsonb_array_elements(v_d.itens) e loop
        if jsonb_typeof(v_it) <> 'object' or coalesce(v_it ->> 'id', '') !~ '^[0-9]{1,18}$' then continue; end if;
        v_id := (v_it ->> 'id')::bigint;
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
      -- (c) outra demanda PAGA cobre o mesmo item/campo (valor > 0): a marcação PASSA para ela (se essa também sair de 'pago', ela é quem desfaz)
      v_cobre := null;
      select d2.id into v_cobre
        from public.pagamento_demandas d2
        cross join lateral jsonb_array_elements(case when jsonb_typeof(d2.itens) = 'array' then d2.itens else '[]'::jsonb end) e
       where d2.id <> p_demanda_id and d2.status = 'pago' and jsonb_typeof(e) = 'object'
         and case when (e ->> 'id') ~ '^[0-9]{1,18}$' then (e ->> 'id')::bigint end = r.masterlist_id
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

  return jsonb_build_object('status', p_novo_status, 'alterado', true, 'itens_marcados', v_marcados, 'itens_nao_encontrados', cardinality(v_nao_enc), 'ids_nao_encontrados', to_jsonb(v_nao_enc),
                            'itens_desmarcados', v_desmarcados, 'itens_mantidos', v_mantidos);
end $$;
revoke all on function public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean) to authenticated, service_role;

-- 2) marcar como pago manualmente (só liga; nunca desmarca) e REGISTRAR como manual (protege contra o desfazimento ao reabrir/rejeitar uma demanda)
create function public.admin_marcar_pago(p_item_id bigint, p_item boolean default false, p_frete boolean default false, p_rf boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if (select public.is_admin()) is not true then raise exception 'sem permissão'; end if;
  if not (coalesce(p_item, false) or coalesce(p_frete, false) or coalesce(p_rf, false)) then return jsonb_build_object('status', 'nada_a_marcar'); end if;
  update public.masterlist m set
    pago_item  = m.pago_item  or coalesce(p_item,  false),
    pago_frete = m.pago_frete or coalesce(p_frete, false),
    pago_rf    = m.pago_rf    or coalesce(p_rf,    false)
   where m.id = p_item_id;
  get diagnostics v_n = row_count;
  if v_n = 1 then
    if coalesce(p_item, false)  then insert into emergencia.pagamento_marcacoes (masterlist_id, campo, origem) values (p_item_id, 'item',  'manual') on conflict (masterlist_id, campo) where origem = 'manual' and desfeito_em is null do nothing; end if;
    if coalesce(p_frete, false) then insert into emergencia.pagamento_marcacoes (masterlist_id, campo, origem) values (p_item_id, 'frete', 'manual') on conflict (masterlist_id, campo) where origem = 'manual' and desfeito_em is null do nothing; end if;
    if coalesce(p_rf, false)    then insert into emergencia.pagamento_marcacoes (masterlist_id, campo, origem) values (p_item_id, 'rf',    'manual') on conflict (masterlist_id, campo) where origem = 'manual' and desfeito_em is null do nothing; end if;
  end if;
  return jsonb_build_object('status', case when v_n = 1 then 'ok' else 'nao_encontrado' end);
end $$;
revoke all on function public.admin_marcar_pago(bigint, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.admin_marcar_pago(bigint, boolean, boolean, boolean) to authenticated, service_role;

-- as funções SECURITY DEFINER precisam pertencer ao postgres (e não a um papel temporário de login, como o do CLI), pois é com os privilégios do dono que elas gravam
alter function public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean) owner to postgres;
alter function public.admin_marcar_pago(bigint, boolean, boolean, boolean) owner to postgres;

-- 3) a função antiga deixa de ser executável por visitante e por logado (o site passa a usar as novas)
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as f from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'set_pagamento_demanda_status' loop
    execute format('revoke all on function %s from public, anon, authenticated', r.f);
  end loop;
end $$;

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_antes text; v_depois text; r record;
begin
  select count(*) into n from pg_proc p where p.oid in ('public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure, 'public.admin_marcar_pago(bigint, boolean, boolean, boolean)'::regprocedure)
     and p.prosecdef and p.proconfig = array['search_path=""'];
  if n <> 2 then raise exception 'As funções novas não estão com security definer e search_path vazio. Transação desfeita.'; end if;
  select count(*) into n from pg_proc p where p.oid in ('public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure, 'public.admin_marcar_pago(bigint, boolean, boolean, boolean)'::regprocedure) and pg_get_userbyid(p.proowner) = 'postgres';
  if n <> 2 then raise exception 'As funções novas não pertencem ao postgres. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)', 'EXECUTE') or has_function_privilege('anon', 'public.admin_marcar_pago(bigint, boolean, boolean, boolean)', 'EXECUTE') then
    raise exception 'O visitante executa as funções novas. Transação desfeita.';
  end if;
  if not (has_function_privilege('authenticated', 'public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)', 'EXECUTE') and has_function_privilege('authenticated', 'public.admin_marcar_pago(bigint, boolean, boolean, boolean)', 'EXECUTE')) then
    raise exception 'A administradora logada não executa as funções novas. Transação desfeita.';
  end if;
  if has_schema_privilege('anon', 'emergencia', 'USAGE') or has_schema_privilege('authenticated', 'emergencia', 'USAGE')
     or has_table_privilege('anon', 'emergencia.pagamento_marcacoes', 'SELECT') or has_table_privilege('authenticated', 'emergencia.pagamento_marcacoes', 'SELECT') then
    raise exception 'O registro interno de marcações está acessível a visitante/logado. Transação desfeita.';
  end if;
  for r in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'set_pagamento_demanda_status' loop
    if has_function_privilege('anon', r.oid, 'EXECUTE') or has_function_privilege('authenticated', r.oid, 'EXECUTE') then raise exception 'A função antiga ainda é executável. Transação desfeita.'; end if;
  end loop;
  -- permissões de tabela e de coluna: idênticas às de antes
  for r in select c.oid, c.relname from pg_class c where c.oid in ('public.pagamento_demandas'::regclass, 'public.masterlist'::regclass) loop
    select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'R1' and objeto = 'permissões ' || r.relname;
    select md5(coalesce(c.relacl::text, '') || '|' || coalesce((select string_agg(a.attname || '=' || a.attacl::text, ';' order by a.attname) from pg_attribute a where a.attrelid = c.oid and a.attacl is not null), ''))
      into v_depois from pg_class c where c.oid = r.oid;
    if v_antes is distinct from v_depois then raise exception 'As permissões de % mudaram. Transação desfeita.', r.relname; end if;
  end loop;
end $$;

commit;
