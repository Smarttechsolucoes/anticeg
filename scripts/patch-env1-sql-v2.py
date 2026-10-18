# Acrescenta ao ENV1: (a) envio_meus_dados() (dados de entrega da joiner pelo token, sem depender da leitura aberta de joiners);
# (b) isolamento do bucket storage-itens (visitante não lista, não apaga e não envia; só a administração); (c) testes e reversão correspondentes.
import os, re
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "envio")
def ler(n): return open(os.path.join(D, n), encoding="utf-8").read()
def gravar(n, s): open(os.path.join(D, n), "w", encoding="utf-8").write(s)
def rep(s, a, b, n=1):
    assert s.count(a) == n, (a[:80], s.count(a)); return s.replace(a, b)

# ---------- aplicar
a = ler("ENV1_acesso_aplicar.sql")
a = rep(a, "revoke all on function public.envio_solicitar_rodada(text), public.envio_grupo_por_codigo(text), public.envio_meu_acesso() from public;\ngrant execute on function public.envio_solicitar_rodada(text), public.envio_grupo_por_codigo(text), public.envio_meu_acesso() to anon, authenticated, service_role;",
"""create function public.envio_meus_dados() returns jsonb
language sql stable security definer set search_path = '' as $$
  -- dados de entrega SALVOS da própria joiner (identificada pelo token ou pela conta): o envio não depende da leitura aberta da tabela joiners
  select to_jsonb(x) from (
    select j.nome, j.nome_entrega, j.cpf, j.cep, j.rua, j.numero, j.complemento, j.bairro, j.cidade, j.estado, j.whatsapp, j.twitter
      from public.joiners j
     where lower(btrim(j.cog)) = lower(btrim(coalesce((select public.envio_token_cog()), (select public.meu_cog()))))
     order by (btrim(j.cog) = btrim(coalesce((select public.envio_token_cog()), (select public.meu_cog())))) desc, j.id limit 1) x
$$;
revoke all on function public.envio_solicitar_rodada(text), public.envio_grupo_por_codigo(text), public.envio_meu_acesso(), public.envio_meus_dados() from public;
grant execute on function public.envio_solicitar_rodada(text), public.envio_grupo_por_codigo(text), public.envio_meu_acesso(), public.envio_meus_dados() to anon, authenticated, service_role;""")
a = rep(a, "alter policy \"allow upload\" on storage.objects with check ((bucket_id <> 'anti-store'::text) and (bucket_id <> 'avatars'::text) and (bucket_id <> 'envio-comprovantes'::text));",
"""alter policy "allow upload" on storage.objects with check ((bucket_id <> 'anti-store'::text) and (bucket_id <> 'avatars'::text) and (bucket_id <> 'envio-comprovantes'::text) and (bucket_id <> 'storage-itens'::text));
-- storage-itens (fotos do storage): o visitante deixa de LISTAR, APAGAR e ENVIAR arquivos; só a administração (conta admin). As fotos continuam abrindo pelos links já gravados (bucket público, sem policy de leitura).
insert into emergencia.env1_backup (tipo, tabela, dados) select 'storage_policy', 'objects', to_jsonb(p) from pg_policies p where schemaname = 'storage' and tablename = 'objects' and policyname in ('allow delete storage-itens', 'allow select storage-itens', 'allow uploads storage-itens');
drop policy "allow delete storage-itens" on storage.objects;
drop policy "allow select storage-itens" on storage.objects;
drop policy "allow uploads storage-itens" on storage.objects;
create policy storage_itens_admin on storage.objects for all to authenticated
  using (bucket_id = 'storage-itens' and (select public.is_admin())) with check (bucket_id = 'storage-itens' and (select public.is_admin()));""")
a = rep(a, "  if (select count(*) from emergencia.env1_backup where tipo = 'policy') < 7 then raise exception 'ENV1: backup de policies incompleto'; end if;",
"""  if (select count(*) from emergencia.env1_backup where tipo = 'policy') < 7 then raise exception 'ENV1: backup de policies incompleto'; end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and 'anon' = any(roles) and (coalesce(qual,'') ~ '= ''storage-itens''' or coalesce(with_check,'') ~ '= ''storage-itens''')) then raise exception 'ENV1: visitante ainda tem policy no bucket storage-itens'; end if;
  if (select with_check from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'allow upload') !~ 'storage-itens' then raise exception 'ENV1: a policy generica de upload ainda aceita storage-itens'; end if;""")
gravar("ENV1_acesso_aplicar.sql", a)

# ---------- reverter
r = ler("ENV1_acesso_reverter.sql")
r = rep(r, "drop policy if exists envio_comprovantes_admin on storage.objects;", "drop policy if exists envio_comprovantes_admin on storage.objects;\ndrop policy if exists storage_itens_admin on storage.objects;")
r = rep(r, "-- 4) policy genérica de upload do Storage como era",
"""-- 3b) policies do bucket storage-itens como eram
do $$ declare r record; papeis text; q text; wc text; begin
  for r in select dados from emergencia.env1_backup where tipo = 'storage_policy' and dados ->> 'policyname' <> 'allow upload' order by id loop
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into papeis from jsonb_array_elements_text(r.dados -> 'roles') x;
    q := r.dados ->> 'qual'; wc := r.dados ->> 'with_check';
    execute format('create policy %I on storage.objects as %s for %s to %s%s%s', r.dados ->> 'policyname', r.dados ->> 'permissive', r.dados ->> 'cmd', papeis,
                   case when q is not null then ' using (' || q || ')' else '' end, case when wc is not null then ' with check (' || wc || ')' else '' end);
  end loop;
end $$;

-- 4) policy genérica de upload do Storage como era""")
r = rep(r, "drop function if exists public.envio_solicitar_rodada(text), public.envio_grupo_por_codigo(text), public.envio_meu_acesso(), public.envio_solicitacao_existe(text);",
           "drop function if exists public.envio_solicitar_rodada(text), public.envio_grupo_por_codigo(text), public.envio_meu_acesso(), public.envio_meus_dados(), public.envio_solicitacao_existe(text);")
r = rep(r, "select dados ->> 'with_check' into w from emergencia.env1_backup where tipo = 'storage_policy' and dados ->> 'policyname' = 'allow upload' order by id limit 1;",
           "select dados ->> 'with_check' into w from emergencia.env1_backup where tipo = 'storage_policy' and dados ->> 'policyname' = 'allow upload' order by id limit 1;")
gravar("ENV1_acesso_reverter.sql", r)

# ---------- testes (parte) : mais verificações antes do bloco final
t = ler("ENV1_testes_rollback.part.sql")
t = rep(t, "  execute 'reset role';\n  raise exception E'ENV1_ENSAIO",
"""  -- ---------- T20: dados de entrega pelo token e storage-itens isolado
  execute 'reset role'; perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  perform set_config('request.headers', '{}', true); perform set_config('request.jwt.claim.sub', '', true);
  if public.envio_meus_dados() is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T20 envio_meus_dados sem token ; '; end if;
  perform set_config('request.headers', json_build_object('x-envio-token', tok_a)::text, true);
  if public.envio_meus_dados() is not null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T20b envio_meus_dados com token ; '; end if;
  begin insert into storage.objects (bucket_id, name) values ('storage-itens', 'ensaio/1760000000000.jpg'); bad := bad + 1; res := res || 'FALHA T21 visitante enviou ao storage-itens ; '; exception when others then ok := ok + 1; end;
  begin select count(*) into n from storage.objects where bucket_id = 'storage-itens'; if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T21b visitante lista storage-itens ; '; end if; exception when others then ok := ok + 1; end;
  begin delete from storage.objects where bucket_id = 'storage-itens'; get diagnostics n = row_count; if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T21c visitante apagou storage-itens ; '; end if; exception when others then ok := ok + 1; end;
  execute 'reset role'; execute 'set local role authenticated';
  perform set_config('request.headers', '{}', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', v_admin::text, true); perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin insert into storage.objects (bucket_id, name) values ('storage-itens', 'ensaio/1760000000001.jpg'); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T22 admin nao envia ao storage-itens: ' || sqlerrm || ' ; '; end;
  begin select count(*) into n from storage.objects where bucket_id = 'storage-itens'; if n >= 1 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T22b admin nao lista storage-itens ; '; end if; exception when others then bad := bad + 1; res := res || 'FALHA T22b ' || sqlerrm || ' ; '; end;
  begin select count(*) into n from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'storage_itens_admin' and cmd = 'ALL'; if n = 1 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T22c policy admin do storage-itens ; '; end if; end;
  execute 'reset role';
  raise exception E'ENV1_ENSAIO""")
gravar("ENV1_testes_rollback.part.sql", t)

# ---------- remonta os dois ensaios
ap = ler("ENV1_acesso_aplicar.sql").rstrip(); assert ap.endswith("commit;")
gravar("ENV1_ensaio_rollback.sql", "-- ENSAIO (rollback) do ENV1: aplica o pacote DENTRO de uma transação, roda os testes com papéis reais e termina em exceção. Nada permanece.\n" + ap[:-len("commit;")] + "\n" + ler("ENV1_testes_rollback.part.sql"))
rv = ler("ENV1_acesso_reverter.sql").strip(); rb = rv[rv.index("begin;") + len("begin;"):-len("commit;")]
old = ler("ENV1_reversao_ensaio_rollback.sql")
i = old.index("create temp table _pol_antes"); j = old.index("create table emergencia.env1_backup") if "create table emergencia.env1_backup" in old else None
snap = old[i:old.index("do $$ begin\n  if to_regprocedure('public.is_admin()')")] if "do $$ begin\n  if to_regprocedure('public.is_admin()')" in old else None
fim = old[old.index("do $$ declare a1 record; begin"):]
snap_pol_extra = "create temp table _stor_antes on commit drop as select md5(string_agg(policyname||cmd||roles::text||coalesce(qual,'')||coalesce(with_check,''), '|' order by policyname)) h from pg_policies where schemaname='storage' and tablename='objects';\n"
fim = fim.replace("  raise exception 'ENV1_REVERSAO_OK", "  if (select md5(string_agg(policyname||cmd||roles::text||coalesce(qual,'')||coalesce(with_check,''), '|' order by policyname)) from pg_policies where schemaname='storage' and tablename='objects') is distinct from (select h from _stor_antes) then raise exception 'REVERSAO: policies do Storage diferentes do original'; end if;\n  raise exception 'ENV1_REVERSAO_OK")
body = ap[ap.index("begin;") + len("begin;"):-len("commit;")]
snapshots = old[old.index("create temp table _pol_antes"):old.index("do $$ begin\n  if to_regprocedure")] if "do $$ begin\n  if to_regprocedure" in old else None
assert snapshots is not None
gravar("ENV1_reversao_ensaio_rollback.sql", "-- ENSAIO (rollback) da REVERSÃO: aplica o ENV1, reverte e prova que o estado volta idêntico ao original.\nbegin;\n" + snapshots + snap_pol_extra + body + "\n" + rb + "\n" + fim)
print("ENV1 v2 gerado")
