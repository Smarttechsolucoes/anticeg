-- J4c-1 — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE joiners, pre_cadastros, grupos_envio e push_subscriptions ao visitante)
-- Recria exatamente as policies que existiam antes (registradas) e devolve as permissões padrão do Supabase ao visitante. As funções novas e a trava de colunas são removidas.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR DADOS PESSOAIS DAS JOINERS
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR DADOS PESSOAIS DAS JOINERS' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto reabriria dados pessoais ao visitante.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-1') then raise exception 'Não há registro do J4c-1.'; end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('joiners', 'pre_cadastros', 'grupos_envio', 'push_subscriptions') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-1' and objeto like 'policy %' loop
    j := r.detalhe::json;
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from json_array_elements_text(j -> 'roles') x;
    v_sql := format('create policy %I on public.%I as %s for %s to %s', j ->> 'nome', j ->> 'tabela', lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
    if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
    if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
    execute v_sql;
  end loop;
  grant all on table public.joiners, public.pre_cadastros, public.grupos_envio, public.push_subscriptions to anon, authenticated;
  drop trigger if exists trg_joiners_protege_colunas on public.joiners;
  drop function if exists public.trg_joiners_protege_colunas();
  drop function if exists public.solicitar_cadastro(text, text, text, text, text);
  drop function if exists public.resolver_recrutador(text);
  drop function if exists public.meus_recrutados();
  drop function if exists public.joiners_online(integer);
  drop function if exists public.debitar_cashback(numeric);
  drop function if exists public.grupo_por_codigo(text);
  drop function if exists public.registrar_push(text, text, text);
end $$;

update emergencia.c0b_estado_anterior set etapa = 'J4c-1-revertido' where etapa = 'J4c-1';
do $$ begin raise notice 'Reversão do J4c-1 feita: joiners, pre_cadastros, grupos_envio e push_subscriptions REABERTOS ao visitante.'; end $$;

commit;
