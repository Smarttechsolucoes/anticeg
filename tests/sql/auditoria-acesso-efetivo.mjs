// Valida o AUD_02 (acesso efetivo = privilégio x RLS x policies) em banco local com dados fictícios. Uso: node tests/sql/auditoria-acesso-efetivo.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/auditoria/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const consulta = readFileSync(R + "AUD_02_acesso_efetivo_leitura.sql", "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const d = new PGlite();
await d.exec(`
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  -- backup: privilégio total, RLS ligado, SEM policy => nenhum acesso efetivo
  create table public.bkp_unir_joiners (id int primary key, cog text); alter table public.bkp_unir_joiners enable row level security;
  grant all on public.bkp_unir_joiners to anon, authenticated;
  -- sem RLS e com privilégio => aberto
  create table public.sem_rls (id int primary key); grant all on public.sem_rls to anon, authenticated;
  -- policy livre para todos
  create table public.livre (id int primary key); alter table public.livre enable row level security; grant all on public.livre to anon, authenticated;
  create policy livre_all on public.livre for all to public using (true) with check (true);
  -- condicionada (só o logado, com condição)
  create table public.cond (id int primary key, joiner_cog text); alter table public.cond enable row level security; grant select on public.cond to anon, authenticated;
  create policy cond_sel on public.cond for select to authenticated using (joiner_cog = 'ana');
  -- insert só para anon
  create table public.so_anon (id int primary key); alter table public.so_anon enable row level security; grant select, insert on public.so_anon to anon, authenticated;
  create policy so_anon_ins on public.so_anon for insert to anon with check (true);
  -- sem privilégio nenhum
  create table public.fechada (id int primary key); alter table public.fechada enable row level security;
  -- livre + restritiva
  create table public.restr (id int primary key); alter table public.restr enable row level security; grant select on public.restr to anon;
  create policy r1 on public.restr for select to anon using (true);
  create policy r2 on public.restr as restrictive for select to anon using (id > 0);
`);
const imp = async () => (await d.query(`select md5(coalesce((select string_agg(c.relname || coalesce(c.relacl::text, '') || c.relrowsecurity::text, ',' order by c.relname) from pg_class c where c.relnamespace = 'public'::regnamespace), '') || coalesce((select string_agg(policyname || coalesce(qual, ''), ',' order by policyname) from pg_policies), '')) as h`)).rows[0].h;
const antes = await imp();
const rows = (await d.query(consulta)).rows;
ok((await imp()) === antes, "não alterou nada");
const T = n => rows.find(r => r.secao === "1 por tabela" && r.item === n);
const S = i => rows.find(r => r.secao === "2 resumo" && r.item.startsWith(i));
ok(/LER=bloqueado \(RLS sem policy\)/.test(T("bkp_unir_joiners").valor) && /APAGAR=bloqueado \(RLS sem policy\)/.test(T("bkp_unir_joiners").valor) && /sem acesso efetivo/.test(T("bkp_unir_joiners").leitura), "backup com RLS e sem policy: sem acesso efetivo (privilégio à toa)");
ok(/INSERIR=ABERTO \(sem RLS\)/.test(T("sem_rls").valor) && /ALERTA/.test(T("sem_rls").leitura), "sem RLS + privilégio: ABERTO e ALERTA");
ok(/APAGAR=ABERTO \(policy livre\)/.test(T("livre").valor) && /ALERTA/.test(T("livre").leitura), "policy livre: ABERTO e ALERTA");
ok(/VISITANTE: LER=bloqueado \(RLS sem policy\)/.test(T("cond").valor) && /LOGADO: LER=condicionado/.test(T("cond").leitura) && !/ALERTA/.test(T("cond").leitura), "policy só do logado com condição: visitante bloqueado, logado condicionado, sem alerta");
ok(/INSERIR=ABERTO \(policy livre\)/.test(T("so_anon").valor) && /LOGADO:.*INSERIR=bloqueado \(RLS sem policy\)/.test(T("so_anon").leitura), "policy só do visitante: o logado NÃO herda");
ok(/LER=bloqueado \(sem privilégio\)/.test(T("fechada").valor), "sem privilégio: bloqueado");
ok(/LER=condicionado \(livre \+ restritiva\)/.test(T("restr").valor), "livre + restritiva: condicionado");
ok(S("tabelas em que o visitante ESCREVE").valor === "3", "resumo: 3 tabelas com escrita livre do visitante (sem_rls, livre, so_anon)");
ok(S("tabelas SEM acesso efetivo").valor === "2", "resumo: 2 tabelas sem acesso efetivo (bkp_unir_joiners e fechada)");
ok(/sem_rls/.test(S("visitante APAGA").valor) && !/bkp_unir/.test(S("visitante APAGA").valor), "DELETE livre lista as abertas e NÃO lista o backup");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
