-- J4c-4c — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE feedbacks, notificações, storage, conferências e fila de envio ao visitante)
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR DADOS PESSOAIS RESTANTES
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR DADOS PESSOAIS RESTANTES' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto reabriria dados pessoais ao visitante.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-4c') then raise exception 'Não há registro do J4c-4c.'; end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('feedbacks', 'notifications', 'pushes', 'push_reads', 'joiner_storage', 'joiner_conferencias', 'joiner_updates', 'envio_rounds', 'envio_requests', 'confirmacoes') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-4c' and objeto like 'policy %' loop
    j := r.detalhe::json;
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from json_array_elements_text(j -> 'roles') x;
    v_sql := format('create policy %I on public.%I as %s for %s to %s', j ->> 'nome', j ->> 'tabela', lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
    if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
    if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
    execute v_sql;
  end loop;
  for r in select substr(objeto, 5) as t, detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-4c' and objeto like 'rls %' loop
    execute format('alter table public.%I %s row level security', r.t, case when r.detalhe = 'ligado' then 'enable' else 'disable' end);
    execute format('grant all on table public.%I to anon, authenticated', r.t);
  end loop;
  drop trigger if exists trg_j4c4c_protege on public.feedbacks;
  drop trigger if exists trg_j4c4c_protege on public.notifications;
  drop trigger if exists trg_j4c4c_protege on public.joiner_storage;
  drop trigger if exists trg_j4c4c_protege on public.joiner_conferencias;
  drop function if exists public.trg_j4c4c_protege();
  drop function if exists public.envio_entrar_round(text);
end $$;

update emergencia.c0b_estado_anterior set etapa = 'J4c-4c-revertido' where etapa = 'J4c-4c';
do $$ begin raise notice 'Reversão do J4c-4c feita: as 10 tabelas REABERTAS ao visitante.'; end $$;

commit;
