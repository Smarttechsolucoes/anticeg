-- J4c-4f — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE o estoque dos drops para escrita pelo visitante)
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR ESTOQUE DOS DROPS
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR ESTOQUE DOS DROPS' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto reabriria escrita ao visitante.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-4f') then raise exception 'Não há registro do J4c-4f.'; end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-4f' and objeto like 'policy %' loop
    j := r.detalhe::json;
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from json_array_elements_text(j -> 'roles') x;
    v_sql := format('create policy %I on public.%I as %s for %s to %s', j ->> 'nome', j ->> 'tabela', lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
    if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
    if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
    execute v_sql;
  end loop;
  for r in select substr(objeto, 5) as t, detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-4f' and objeto like 'rls %' loop
    execute format('alter table public.%I %s row level security', r.t, case when r.detalhe = 'ligado' then 'enable' else 'disable' end);
    execute format('grant all on table public.%I to anon, authenticated', r.t);
  end loop;
end $$;

update emergencia.c0b_estado_anterior set etapa = 'J4c-4f-revertido' where etapa = 'J4c-4f';
do $$ begin raise notice 'Reversão do J4c-4f feita: o estoque dos drops foi REABERTO ao visitante.'; end $$;

commit;
