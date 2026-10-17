-- J5 — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela TORNA OS COMPROVANTES PÚBLICOS DE NOVO e reabre o envio de arquivos ao visitante)
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR COMPROVANTES
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR COMPROVANTES' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto tornaria os comprovantes públicos de novo.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J5') then raise exception 'Não há registro do J5.'; end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text;
begin
  -- policies de storage.objects voltam como estavam
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'J5' and objeto like 'policy %' loop
    j := r.detalhe::json;
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from json_array_elements_text(j -> 'roles') x;
    v_sql := format('create policy %I on storage.objects as %s for %s to %s', j ->> 'nome', lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
    if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
    if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
    execute v_sql;
  end loop;
  -- buckets voltam como estavam
  for r in select substr(objeto, 8) as id, detalhe from emergencia.c0b_estado_anterior where etapa = 'J5' and objeto like 'bucket %' loop
    j := r.detalhe::json;
    update storage.buckets set public = (j ->> 'public')::boolean,
           file_size_limit = (j ->> 'file_size_limit')::bigint,
           allowed_mime_types = case when j -> 'allowed_mime_types' is null or json_typeof(j -> 'allowed_mime_types') = 'null' then null else array(select json_array_elements_text(j -> 'allowed_mime_types')) end
     where id = r.id;
  end loop;
  drop function if exists public.comprovante_assinavel(text, text);
  drop table if exists public.comprovantes_uploads;
end $$;

update emergencia.c0b_estado_anterior set etapa = 'J5-revertido' where etapa = 'J5';
do $$ begin raise notice 'Reversão do J5 feita: comprovantes PÚBLICOS de novo e envio direto reaberto (o site novo deixa de enviar/ver comprovantes até reaplicar).'; end $$;

commit;
