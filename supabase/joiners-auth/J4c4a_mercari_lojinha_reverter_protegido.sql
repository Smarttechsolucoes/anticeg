-- J4c-4a — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE Mercari, lojinha e repasses ao visitante)
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR MERCARI E LOJINHA
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR MERCARI E LOJINHA' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto reabriria dados pessoais ao visitante.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-4a') then raise exception 'Não há registro do J4c-4a.'; end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('mercari_pedidos', 'lojinha_repasses', 'repassos') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-4a' and objeto like 'policy %' loop
    j := r.detalhe::json;
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from json_array_elements_text(j -> 'roles') x;
    v_sql := format('create policy %I on public.%I as %s for %s to %s', j ->> 'nome', j ->> 'tabela', lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
    if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
    if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
    execute v_sql;
  end loop;
  -- RLS volta ao estado em que estava (se estava desligado, volta desligado)
  for r in select substr(objeto, 5) as t, detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-4a' and objeto like 'rls %' loop
    execute format('alter table public.%I %s row level security', r.t, case when r.detalhe = 'ligado' then 'enable' else 'disable' end);
  end loop;
  grant all on table public.mercari_pedidos, public.lojinha_repasses, public.repassos to anon, authenticated;
  drop trigger if exists trg_lojinha_protege on public.lojinha_repasses;
  drop trigger if exists trg_repassos_protege on public.repassos;
  drop function if exists public.trg_lojinha_protege();
  drop function if exists public.trg_repassos_protege();
end $$;

update emergencia.c0b_estado_anterior set etapa = 'J4c-4a-revertido' where etapa = 'J4c-4a';
do $$ begin raise notice 'Reversão do J4c-4a feita: Mercari, lojinha e repasses REABERTOS ao visitante.'; end $$;

commit;
