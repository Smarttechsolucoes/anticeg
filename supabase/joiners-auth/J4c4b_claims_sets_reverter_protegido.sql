-- J4c-4b — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE os claims em sets ao visitante, com COG e nome real de cada joiner)
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR CLAIMS EM SETS
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR CLAIMS EM SETS' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto reabriria dados pessoais ao visitante.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-4b') then raise exception 'Não há registro do J4c-4b.'; end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('claim_eventos', 'claim_sets', 'claim_reservas') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-4b' and objeto like 'policy %' loop
    j := r.detalhe::json;
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from json_array_elements_text(j -> 'roles') x;
    v_sql := format('create policy %I on public.%I as %s for %s to %s', j ->> 'nome', j ->> 'tabela', lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
    if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
    if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
    execute v_sql;
  end loop;
  for r in select substr(objeto, 5) as t, detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-4b' and objeto like 'rls %' loop
    execute format('alter table public.%I %s row level security', r.t, case when r.detalhe = 'ligado' then 'enable' else 'disable' end);
  end loop;
  grant all on table public.claim_eventos, public.claim_sets, public.claim_reservas to anon, authenticated;
  drop view if exists public.claim_reservas_quadro;
  drop function if exists public.claim_enviar(bigint, jsonb);
  drop function if exists public.claim_organizar(bigint);
  drop function if exists public._claim_organizar_interno(bigint);
  drop function if exists public._claim_membros(jsonb);
end $$;

update emergencia.c0b_estado_anterior set etapa = 'J4c-4b-revertido' where etapa = 'J4c-4b';
do $$ begin raise notice 'Reversão do J4c-4b feita: claims em sets REABERTOS ao visitante (o site novo deixa de funcionar nos claims até reaplicar).'; end $$;

commit;
