-- J4c-3 — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE todos os pedidos das lojas e dos formulários ao visitante)
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR PEDIDOS DAS LOJAS
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR PEDIDOS DAS LOJAS' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto reabriria dados pessoais ao visitante.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-3') then raise exception 'Não há registro do J4c-3.'; end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text; t text;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio','formulario_pedidos') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-3' and objeto like 'policy %' loop
    j := r.detalhe::json;
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from json_array_elements_text(j -> 'roles') x;
    v_sql := format('create policy %I on public.%I as %s for %s to %s', j ->> 'nome', j ->> 'tabela', lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
    if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
    if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
    execute v_sql;
  end loop;
  foreach t in array array['pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio','formulario_pedidos'] loop
    if to_regclass('public.' || t) is not null then execute format('grant all on table public.%I to anon, authenticated', t); end if;
  end loop;
  drop view if exists public.formulario_pedidos_publico;
  drop function if exists public.pedido_loja_criar(text, jsonb);
end $$;

update emergencia.c0b_estado_anterior set etapa = 'J4c-3-revertido' where etapa = 'J4c-3';
do $$ begin raise notice 'Reversão do J4c-3 feita: pedidos das lojas e formulários REABERTOS ao visitante.'; end $$;

commit;
