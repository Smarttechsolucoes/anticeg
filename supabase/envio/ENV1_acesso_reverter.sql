-- ENV1 — REVERTER: devolve as policies, privilégios e o estado de RLS originais das 7 tabelas de envio (a partir de emergencia.env1_backup) e a policy "allow upload" do Storage.
-- Remove as peças novas (triggers, funções, policies do bucket novo). NÃO apaga dados, NÃO apaga o bucket envio-comprovantes (pode ter arquivos) e mantém emergencia.envio_acessos / env1_backup como evidência.
-- Depois da reversão o envio volta a funcionar como antes (aberto ao visitante): usar só em emergência. PREPARADO, NÃO APLICADO.
begin;
do $$ begin
  if to_regclass('emergencia.env1_backup') is null or not exists (select 1 from emergencia.env1_backup where tipo = 'policy') then raise exception 'ENV1 reverter: backup ausente: nada foi alterado.'; end if;
end $$;

-- 1) remove tudo que o ENV1 criou nas tabelas
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('envio_solicitacoes','grupos_envio','joiner_storage','envio_requests','envio_rounds','joiner_conferencias','rastreios') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
drop trigger if exists trg_envio_protege_ins on public.envio_solicitacoes;
drop trigger if exists trg_envio_protege_upd on public.envio_solicitacoes;
drop trigger if exists trg_storage_protege on public.joiner_storage;
drop trigger if exists trg_conferencia_protege_ins on public.joiner_conferencias;
drop trigger if exists trg_conferencia_protege_upd on public.joiner_conferencias;
drop policy if exists envio_comprovantes_enviar on storage.objects;
drop policy if exists envio_comprovantes_admin on storage.objects;

-- 2) devolve as policies originais
do $$ declare r record; q text; wc text; papeis text; begin
  for r in select dados from emergencia.env1_backup where tipo = 'policy' order by id loop
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into papeis from jsonb_array_elements_text(r.dados -> 'roles') x;
    q := r.dados ->> 'qual'; wc := r.dados ->> 'with_check';
    execute format('create policy %I on public.%I as %s for %s to %s%s%s', r.dados ->> 'policyname', r.dados ->> 'tablename', r.dados ->> 'permissive', r.dados ->> 'cmd', papeis,
                   case when q is not null then ' using (' || q || ')' else '' end, case when wc is not null then ' with check (' || wc || ')' else '' end);
  end loop;
end $$;

-- 3) devolve os privilégios e o estado de RLS originais
revoke all on table public.envio_solicitacoes, public.grupos_envio, public.joiner_storage, public.envio_requests, public.envio_rounds, public.joiner_conferencias, public.rastreios from anon, authenticated, public;
do $$ declare r record; begin
  for r in select dados, tabela from emergencia.env1_backup where tipo = 'grant' and dados ->> 'grantee' in ('anon','authenticated','public') loop
    execute format('grant %s on table public.%I to %s', r.dados ->> 'privilege', r.tabela, case when r.dados ->> 'grantee' = 'public' then 'public' else quote_ident(r.dados ->> 'grantee') end);
  end loop;
  for r in select tabela, (dados ->> 'rls')::boolean rls from emergencia.env1_backup where tipo = 'rls' loop
    execute format('alter table public.%I %s row level security', r.tabela, case when r.rls then 'enable' else 'disable' end);
  end loop;
end $$;

-- 4) policy genérica de upload do Storage como era
do $$ declare w text; begin
  select dados ->> 'with_check' into w from emergencia.env1_backup where tipo = 'storage_policy' and dados ->> 'policyname' = 'allow upload' order by id limit 1;
  if w is not null then execute 'alter policy "allow upload" on storage.objects with check (' || w || ')'; end if;
end $$;

-- 5) funções novas
drop function if exists public.envio_solicitar_rodada(text), public.envio_grupo_por_codigo(text), public.envio_meu_acesso(), public.envio_solicitacao_existe(text);
drop function if exists public.trg_envio_protege(), public.trg_storage_protege(), public.trg_conferencia_protege();
drop function if exists public.envio_dona(text), public.envio_privilegiado(), public.envio_token_cog();

-- 6) conferência: as policies voltaram iguais
do $$ begin
  if (select count(*) from pg_policies where schemaname = 'public' and tablename in ('envio_solicitacoes','grupos_envio','joiner_storage','envio_requests','envio_rounds','joiner_conferencias','rastreios'))
     <> (select count(*) from emergencia.env1_backup where tipo = 'policy') then raise exception 'ENV1 reverter: o numero de policies nao confere com o backup: abortado.'; end if;
end $$;
commit;
