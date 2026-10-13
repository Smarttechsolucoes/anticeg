-- C0-B8 — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE a config para qualquer visitante gravar)
-- Nada reverte sozinho. Para executar é preciso digitar, na variável abaixo, a frase exata de autorização.
-- Recria exatamente as policies que existiam (registradas em emergencia.c0b_estado_anterior) e devolve a escrita a anon/authenticated.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR CONFIG
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR CONFIG' then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto permitiria que qualquer pessoa tire o site do ar, mude a equipe e os avisos.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B8') then
    raise exception 'Não há estado anterior do B8 registrado.';
  end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text;
begin
  drop policy if exists config_leitura_publica on public.config;
  drop policy if exists config_admin on public.config;
  for r in select objeto, detalhe from emergencia.c0b_estado_anterior where etapa = 'B8' and objeto like 'policy %' loop
    j := r.detalhe::json;
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles
      from json_array_elements_text(j -> 'roles') x;
    v_sql := format('create policy %I on public.config as %s for %s to %s', substr(r.objeto, 8), lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
    if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
    if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
    execute v_sql;
  end loop;
end $$;

grant insert, update, delete on table public.config to anon, authenticated;

update emergencia.c0b_estado_anterior set etapa = 'B8-revertido' where etapa = 'B8';

do $$ begin raise notice 'Reversão do B8 feita: a config foi REABERTA para escrita pública.'; end $$;

commit;
