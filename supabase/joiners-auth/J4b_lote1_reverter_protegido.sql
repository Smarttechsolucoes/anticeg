-- J4b (lote 1) — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE pagamentos, multas e masterlist para o visitante)
-- Recria exatamente as policies que existiam antes (registradas) e devolve as permissões de visitante.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR DADOS DO LOTE 1
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR DADOS DO LOTE 1' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto reabriria dados pessoais ao visitante.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4b-1') then raise exception 'Não há registro do J4b (lote 1).'; end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text; t text;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('pagamento_demandas', 'multas_pagas', 'masterlist') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4b-1' and objeto like 'policy %' loop
    j := r.detalhe::json;
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from json_array_elements_text(j -> 'roles') x;
    v_sql := format('create policy %I on public.%I as %s for %s to %s', j ->> 'nome', j ->> 'tabela', lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
    if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
    if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
    execute v_sql;
  end loop;
  -- devolve o que o visitante tinha de privilégio de tabela (sem reabrir UPDATE/DELETE de tabela inteira nem as colunas travadas)
  grant select, insert on table public.pagamento_demandas to anon;
  grant select on table public.multas_pagas to anon;
  grant select, insert on table public.masterlist to anon;
end $$;

-- colunas editáveis da masterlist (todas, exceto as travadas) voltam ao visitante, como antes
do $$
declare cols text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into cols from pg_attribute
   where attrelid = 'public.masterlist'::regclass and attnum > 0 and not attisdropped
     and attname not in ('pago_item', 'pago_frete', 'pago_rf', 'pag_item', 'pag_frete', 'pag_taxa', 'venc_item', 'venc_frete', 'venc_rf', 'venc_taxa');
  execute format('grant update (%s) on public.masterlist to anon', cols);
end $$;

update emergencia.c0b_estado_anterior set etapa = 'J4b-1-revertido' where etapa = 'J4b-1';
do $$ begin raise notice 'Reversão do J4b (lote 1) feita: pagamentos, multas e masterlist REABERTOS ao visitante.'; end $$;

commit;
