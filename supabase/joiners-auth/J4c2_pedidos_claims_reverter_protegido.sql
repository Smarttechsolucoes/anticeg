-- J4c-2 — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE claims, reports e solicitações de envio ao visitante)
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR CLAIMS E ENVIOS
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR CLAIMS E ENVIOS' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto reabriria dados pessoais ao visitante.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-2') then raise exception 'Não há registro do J4c-2.'; end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('claims', 'reports', 'envio_solicitacoes') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-2' and objeto like 'policy %' loop
    j := r.detalhe::json;
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from json_array_elements_text(j -> 'roles') x;
    v_sql := format('create policy %I on public.%I as %s for %s to %s', j ->> 'nome', j ->> 'tabela', lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
    if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
    if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
    execute v_sql;
  end loop;
  grant all on table public.claims, public.reports, public.envio_solicitacoes to anon, authenticated;
  drop trigger if exists trg_reports_protege on public.reports;
  drop trigger if exists trg_envio_protege_ins on public.envio_solicitacoes;
  drop trigger if exists trg_envio_protege_upd on public.envio_solicitacoes;
  drop function if exists public.trg_reports_protege();
  drop function if exists public.trg_envio_protege();
  drop view if exists public.claims_quadro;
  drop view if exists public.claims_vendidos;
end $$;

update emergencia.c0b_estado_anterior set etapa = 'J4c-2-revertido' where etapa = 'J4c-2';
do $$ begin raise notice 'Reversão do J4c-2 feita: claims, reports e envio_solicitacoes REABERTOS ao visitante.'; end $$;

commit;
