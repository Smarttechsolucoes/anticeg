-- AV1 — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE o envio/troca/exclusão de QUALQUER arquivo em avatars para o visitante e remove o limite de tipo e tamanho)
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR AVATARS
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR AVATARS' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto reabriria o envio de qualquer arquivo ao bucket avatars.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'AV1') then raise exception 'Não há registro do AV1.'; end if;
end $$;

do $$
declare r record; j json; v_roles text; v_sql text;
begin
  -- as policies novas saem e as antigas de avatars voltam exatamente como estavam
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('avatars_ver', 'avatars_enviar', 'avatars_trocar', 'avatars_apagar') loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'AV1' and objeto like 'policy %' loop
    j := r.detalhe::json;
    if j ->> 'nome' = 'allow upload' then
      execute format('alter policy %I on storage.objects with check (%s)', 'allow upload', j ->> 'with_check');
    elsif not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = j ->> 'nome') then
      select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from json_array_elements_text(j -> 'roles') x;
      v_sql := format('create policy %I on storage.objects as %s for %s to %s', j ->> 'nome', lower(j ->> 'permissive'), lower(j ->> 'cmd'), v_roles);
      if j ->> 'qual' is not null then v_sql := v_sql || ' using (' || (j ->> 'qual') || ')'; end if;
      if j ->> 'with_check' is not null then v_sql := v_sql || ' with check (' || (j ->> 'with_check') || ')'; end if;
      execute v_sql;
    end if;
  end loop;
  -- bucket volta como estava
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'AV1' and objeto = 'bucket avatars' loop
    j := r.detalhe::json;
    update storage.buckets set public = (j ->> 'public')::boolean,
           file_size_limit = (j ->> 'file_size_limit')::bigint,
           allowed_mime_types = case when j -> 'allowed_mime_types' is null or json_typeof(j -> 'allowed_mime_types') = 'null' then null else array(select json_array_elements_text(j -> 'allowed_mime_types')) end
     where id = 'avatars';
  end loop;
end $$;

update emergencia.c0b_estado_anterior set etapa = 'AV1-revertido' where etapa = 'AV1';
do $$ begin raise notice 'Reversão do AV1 feita: avatars reaberto como antes (qualquer arquivo, qualquer caminho, sem limite).'; end $$;

commit;
