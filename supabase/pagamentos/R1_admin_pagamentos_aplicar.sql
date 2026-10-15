-- R1 — RESTAURA A CONFIRMAÇÃO DE PAGAMENTOS PARA AS ADMINISTRADORAS, COM A AUTORIZAÇÃO FEITA NO SERVIDOR
-- Por que existe: o C0 tirou UPDATE de pagamento_demandas e das colunas pago_* da masterlist, e o botão ficou suspenso (PAGAMENTOS_SUSPENSO) porque a função antiga
--   set_pagamento_demanda_status era SECURITY DEFINER SEM checar quem chama e liberada para o visitante (anon).
-- O que faz (somente FUNÇÕES; nenhuma permissão de tabela ou coluna é alterada, nenhuma policy, nenhum dado):
--   1) admin_definir_status_pagamento(demanda, status, motivo): muda o status da demanda (pago | em_analise | rejeitado). Em 'pago' marca pago_item / pago_frete / pago_rf
--      dos itens da demanda na masterlist, na MESMA transação (o que o botão sempre fez). Só para quem está em admin_roles (is_admin() IS NOT TRUE => nega, inclusive NULL).
--   2) admin_marcar_pago(item, item?, frete?, rf?): marca como pago (nunca desmarca) itens da masterlist; mesma autorização.
--   3) a função antiga set_pagamento_demanda_status perde a execução de visitante e de logado (fecha o buraco); o site passa a usar as novas.
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
  if (select count(*) from pg_attribute where attrelid = 'public.pagamento_demandas'::regclass and attname in ('id', 'itens', 'status', 'motivo_rejeicao') and not attisdropped) <> 4 then
    raise exception 'Esperava as colunas id, itens, status e motivo_rejeicao em pagamento_demandas. Nada foi alterado.';
  end if;
  if (select count(*) from pg_attribute where attrelid = 'public.masterlist'::regclass and attname in ('id', 'pago_item', 'pago_frete', 'pago_rf') and not attisdropped) <> 4 then
    raise exception 'Esperava as colunas id, pago_item, pago_frete e pago_rf em masterlist. Nada foi alterado.';
  end if;
  if to_regprocedure('public.admin_definir_status_pagamento(bigint, text, text)') is not null or to_regprocedure('public.admin_marcar_pago(bigint, boolean, boolean, boolean)') is not null then
    raise exception 'As funções do R1 já existem. Nada foi alterado.';
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

-- 1) status da demanda + marcação dos itens na masterlist (mesma transação)
create function public.admin_definir_status_pagamento(p_demanda_id bigint, p_novo_status text, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_d record; v_it jsonb; v_id bigint; v_marcados integer := 0; v_ausentes integer := 0; v_n integer; v_motivo text;
begin
  if (select public.is_admin()) is not true then raise exception 'sem permissão'; end if;
  if p_novo_status is null or p_novo_status not in ('pago', 'em_analise', 'rejeitado') then raise exception 'status inválido'; end if;
  select id, status, itens into v_d from public.pagamento_demandas where id = p_demanda_id for update;
  if not found then raise exception 'demanda não encontrada'; end if;
  v_motivo := case when p_novo_status = 'rejeitado' then nullif(left(btrim(coalesce(p_motivo, '')), 500), '') else null end;
  if v_d.status is not distinct from p_novo_status and v_motivo is not distinct from null then
    return jsonb_build_object('status', p_novo_status, 'alterado', false, 'itens_marcados', 0);
  end if;
  update public.pagamento_demandas set status = p_novo_status, motivo_rejeicao = v_motivo where id = p_demanda_id;
  if p_novo_status = 'pago' and jsonb_typeof(v_d.itens) = 'array' then
    for v_it in select e from jsonb_array_elements(v_d.itens) e loop
      if jsonb_typeof(v_it) <> 'object' or coalesce(v_it ->> 'id', '') !~ '^[0-9]{1,18}$' then continue; end if;
      v_id := (v_it ->> 'id')::bigint;
      update public.masterlist m set
        pago_item  = case when coalesce(nullif(v_it ->> 'valor_item',  '')::numeric, 0) > 0 then true else m.pago_item  end,
        pago_frete = case when coalesce(nullif(v_it ->> 'frete_inter', '')::numeric, 0) > 0 then true else m.pago_frete end,
        pago_rf    = case when coalesce(nullif(v_it ->> 'taxa_rf',     '')::numeric, 0) > 0 then true else m.pago_rf    end
       where m.id = v_id;
      get diagnostics v_n = row_count;
      if v_n = 1 then v_marcados := v_marcados + 1; else v_ausentes := v_ausentes + 1; end if;
    end loop;
  end if;
  return jsonb_build_object('status', p_novo_status, 'alterado', true, 'itens_marcados', v_marcados, 'itens_nao_encontrados', v_ausentes);
end $$;
revoke all on function public.admin_definir_status_pagamento(bigint, text, text) from public, anon, authenticated;
grant execute on function public.admin_definir_status_pagamento(bigint, text, text) to authenticated, service_role;

-- 2) marcar como pago manualmente (só liga; nunca desmarca)
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
  return jsonb_build_object('status', case when v_n = 1 then 'ok' else 'nao_encontrado' end);
end $$;
revoke all on function public.admin_marcar_pago(bigint, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.admin_marcar_pago(bigint, boolean, boolean, boolean) to authenticated, service_role;

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
  select count(*) into n from pg_proc p where p.oid in ('public.admin_definir_status_pagamento(bigint, text, text)'::regprocedure, 'public.admin_marcar_pago(bigint, boolean, boolean, boolean)'::regprocedure)
     and p.prosecdef and p.proconfig = array['search_path=""'];
  if n <> 2 then raise exception 'As funções novas não estão com security definer e search_path vazio. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.admin_definir_status_pagamento(bigint, text, text)', 'EXECUTE') or has_function_privilege('anon', 'public.admin_marcar_pago(bigint, boolean, boolean, boolean)', 'EXECUTE') then
    raise exception 'O visitante executa as funções novas. Transação desfeita.';
  end if;
  if not (has_function_privilege('authenticated', 'public.admin_definir_status_pagamento(bigint, text, text)', 'EXECUTE') and has_function_privilege('authenticated', 'public.admin_marcar_pago(bigint, boolean, boolean, boolean)', 'EXECUTE')) then
    raise exception 'A administradora logada não executa as funções novas. Transação desfeita.';
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
