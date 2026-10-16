// Teste LOCAL dos scripts de emergência, em um Postgres descartável em memória (PGlite).
// NÃO se conecta ao Supabase nem a nenhum banco real.
// Simula os papéis anon/authenticated e tabelas parecidas com as de produção.
// Limite: PGlite não é o Supabase (versão do Postgres, extensões e PostgREST diferem);
// este teste valida a LÓGICA dos scripts, não substitui o teste no ambiente real.
//
// Como rodar (nada é instalado no projeto principal):
//   cd supabase/emergencia/teste-local
//   npm init -y && npm i @electric-sql/pglite
//   node teste-sql.mjs
process.on("uncaughtException", e => { console.log("ERRO:", String(e.message).slice(0,300)); process.exit(2); });
process.on("unhandledRejection", e => { console.log("ERRO:", String(e && e.message || e).slice(0,300)); process.exit(2); });
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";

import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("../", import.meta.url));
const sql = f => readFileSync(dir + f, "utf8");
const db = new PGlite({ extensions: { pgcrypto } });
let falhas = 0;
const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };

// ── cenário parecido com o Supabase ──────────────────────────────────────────
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema if not exists extensions;
  grant usage on schema public to anon, authenticated;
  create table public.joiners (id bigint generated always as identity primary key, cog text unique, nome text, cpf text);
  create table public.claims (id serial primary key, x text);
  create table public.config (key text primary key, value text);
  create table public.masterlist (id serial primary key, cog text);
  create table public.bkp_unir_joiners (id int, cpf text);
  create table public.bkp_unir_claims_joiner_cog (id int);
  create table public.pedidos_singba (id serial primary key, email text);
  alter table public.joiners enable row level security;
  alter table public.config enable row level security;
  alter table public.bkp_unir_joiners enable row level security;
  create policy aberta on public.joiners for all using (true);
  create policy "Allow all" on public.config for all to public using (true) with check (true);
  create policy aberta on public.bkp_unir_joiners for select using (true);
  grant all on all tables in schema public to anon, authenticated; grant all on all sequences in schema public to anon, authenticated;
  create table public.bkp_unir_colunas (a int, b int); grant select (a) on public.bkp_unir_colunas to anon;
  insert into public.config values ('admin_pin','1234'),('senha_manutencao','velha'),('proximo_envio','2026-11-01');
  insert into public.joiners (cog, nome, cpf) values ('abc','Ana','111');
`);
await db.exec(`create schema auth; create table auth.users (id uuid primary key, email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$; grant execute on function auth.jwt() to anon, authenticated; create table public.rastreios (id serial primary key, codigo text); grant all on public.rastreios to anon, authenticated; grant all on all sequences in schema public to anon, authenticated; insert into public.rastreios (codigo) values ('BR123'); insert into auth.users values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@x.com'), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'joiner@x.com');`);
const ver = async (q) => (await db.query(q)).rows;
const anon = async (q) => { await db.exec("set role anon"); try { return (await db.query(q)).rows; } finally { await db.exec("reset role"); } };
const anonErro = async (q) => { await db.exec("set role anon"); try { await db.query(q); return null; } catch (e) { return e.message; } finally { await db.exec("reset role"); } };

// ── E00 ──────────────────────────────────────────────────────────────────────
await db.exec(sql("E00_ferramentas_backup.sql"));
ok((await ver("select has_schema_privilege('anon','emergencia','USAGE') p"))[0].p === false, "E00: anon sem acesso ao schema emergencia");

// ── E0 aplicar ───────────────────────────────────────────────────────────────
ok((await anon("select count(*)::int n from public.bkp_unir_joiners")).length === 1, "antes de E0: anon lê bkp (exposição real simulada)");
await db.exec(sql("E0_aplicar.sql"));
ok(/permission denied/.test(await anonErro("select * from public.bkp_unir_joiners") || ""), "E0: anon NÃO lê mais bkp_unir_joiners");
ok(/permission denied/.test(await anonErro("select * from public.bkp_unir_claims_joiner_cog") || ""), "E0: anon NÃO lê outro bkp");
ok(/permission denied/.test(await anonErro("delete from public.pedidos_singba") || ""), "E0: anon sem DELETE em pedidos_singba");
ok(/permission denied/.test(await anonErro("truncate public.claims") || ""), "E0: anon sem TRUNCATE");
ok(await anonErro("delete from public.claims where id = -1") === null, "E0: anon ainda apaga em claims (lista admin preservada)");
ok(await anonErro("insert into public.pedidos_singba (email) values ('t@t')") === null, "E0: formulário público ainda insere");
ok((await anon("select * from public.joiners")).length === 1, "E0: leitura de joiners inalterada (esperado: aberta até E2/E3)");
ok(await anonErro("update public.joiners set nome = nome") === null, "E0: update inalterado");
let r2 = null; try { await db.exec(sql("E0_aplicar.sql")); } catch (e) { r2 = e.message; await db.exec("rollback"); }
ok(/já foi aplicada/.test(r2 || ""), "E0: segunda aplicação é recusada (protege o backup)");
const chk = await ver(`select
  count(*) filter (where c.relname like 'bkp\\_unir\\_%' escape '\\' and has_any_column_privilege('anon', c.oid, 'SELECT'))::int a,
  count(*) filter (where has_table_privilege('anon', c.oid, 'TRUNCATE'))::int b,
  count(*) filter (where has_table_privilege('anon', c.oid, 'DELETE') and c.relname not like 'bkp\\_unir\\_%' escape '\\')::int c
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')`);
console.log("      verificação:", JSON.stringify(chk[0]), "(só 3 das 13 tabelas apagáveis existem neste cenário)");
ok(chk[0].a === 0 && chk[0].b === 0, "E0_verificar: 0 bkp legível, 0 truncate");
ok(/permission denied/.test(await anonErro("select a from public.bkp_unir_colunas") || ""), "E0: privilégio POR COLUNA em bkp também é removido");
ok(/permission denied/.test(await anonErro("delete from public.config where key = 'zzz'") || ""), "E0: anon não apaga mais em config (impede desligar o PIN pela API)");
{ await db.exec("set role authenticated"); let e = null; try { await db.query("delete from public.pedidos_singba where id = -1"); } catch (x) { e = x.message; } await db.exec("reset role");
  ok(/permission denied/.test(e || ""), "E0: authenticated também perde DELETE onde o site não apaga"); }
// reverter COM flags mas SEM a frase de autorização explícita: deve recusar
let semFrase = null; try { await db.exec(sql("E0_reverter.sql").replace("reabrir_backups boolean := false;","reabrir_backups boolean := true;")); } catch (e) { semFrase = e.message; await db.exec("rollback"); }
ok(/falta a confirmação por escrito/.test(semFrase || ""), "E0 reverter: flags true SEM a frase 'AUTORIZO REABRIR EXPOSICOES' → recusa");
ok(/permission denied/.test(await anonErro("select * from public.bkp_unir_joiners") || ""), "E0 reverter sem frase: nada foi reaberto");

// ── cofre ──
const cofre = (await ver("select has_schema_privilege('anon','emergencia','USAGE') a, has_schema_privilege('authenticated','emergencia','USAGE') b, (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='emergencia' and c.relkind='r' and (has_table_privilege('anon',c.oid,'SELECT, INSERT, UPDATE, DELETE') or has_table_privilege('authenticated',c.oid,'SELECT, INSERT, UPDATE, DELETE')))::int t, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='emergencia' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')))::int f"))[0];
ok(cofre.a === false && cofre.b === false && cofre.t === 0 && cofre.f === 0, "cofre emergencia: anon/authenticated sem schema, sem tabelas, sem funções (E0_verificar 4a)");
ok(/permission denied/.test(await anonErro("select * from emergencia.grant_backup") || ""), "cofre: anon não lê grant_backup");
ok(/permission denied/.test(await anonErro("select emergencia.restaurar_policies('E0','config')") || ""), "cofre: anon não executa restaurar_policies");

// ── E0 reverter ──────────────────────────────────────────────────────────────
let revPadrao = null; try { await db.exec(sql("E0_reverter.sql")); } catch (e) { revPadrao = e.message; await db.exec("rollback"); }
ok(/Reversão NÃO executada|Nada será revertido/.test(revPadrao || ""), "E0 reverter: por padrão RECUSA (não reabre nada sem escolha consciente)");
ok(/permission denied/.test(await anonErro("select * from public.bkp_unir_joiners") || ""), "E0 reverter padrão: bkp continua fechado");
// parcial: só DELETE
await db.exec(sql("E0_reverter.sql").replace("reabrir_delete  boolean := false;","reabrir_delete  boolean := true;").replace("confirmacao     text    := '';","confirmacao     text    := 'AUTORIZO REABRIR EXPOSICOES';"));
ok(await anonErro("delete from public.pedidos_singba where id = -1") === null, "E0 reverter parcial: DELETE restaurado");
ok(/permission denied/.test(await anonErro("select * from public.bkp_unir_joiners") || ""), "E0 reverter parcial (só DELETE): bkp CONTINUA fechado");
ok(/permission denied/.test(await anonErro("truncate public.claims") || ""), "E0 reverter parcial (só DELETE): TRUNCATE continua negado");
ok((await ver("select count(*)::int n from emergencia.grant_backup where etapa = 'E0'"))[0].n > 0, "E0 reverter parcial: backup restante ainda marcado como aplicado");
// total
await db.exec(sql("E0_reverter.sql").replace("confirmacao     text    := '';","confirmacao     text    := 'AUTORIZO REABRIR EXPOSICOES';").replace("reabrir_backups boolean := false;","reabrir_backups boolean := true;").replace("reabrir_outros  boolean := false;","reabrir_outros  boolean := true;").replace("reabrir_delete  boolean := false;","reabrir_delete  boolean := true;").replace("confirmacao     text    := '';","confirmacao     text    := 'AUTORIZO REABRIR EXPOSICOES';"));
ok((await anon("select * from public.bkp_unir_joiners")).length === 0 && await anonErro("select * from public.bkp_unir_joiners") === null, "E0 reverter total: anon volta a ler bkp (estado original restaurado)");
ok(/permission denied/.test(await anonErro("truncate public.claims") || "") === false, "E0 reverter total: TRUNCATE restaurado");
ok(await anonErro("select a from public.bkp_unir_colunas") === null, "E0 reverter total: privilégio por coluna restaurado exatamente");
ok(/permission denied/.test(await anonErro("select b from public.bkp_unir_colunas") || ""), "E0 reverter total: coluna que nunca teve privilégio continua negada");
ok((await ver("select count(*)::int n from emergencia.grant_backup where etapa = 'E0'"))[0].n === 0, "E0 reverter total: nada mais pendente (permite reaplicar)");
await db.exec(sql("E0_aplicar.sql"));
ok(/permission denied/.test(await anonErro("select * from public.bkp_unir_joiners") || ""), "E0 reaplicar após reverter funciona");

// ── E1a ──────────────────────────────────────────────────────────────────────
await db.exec(sql("E1a_segredos_aplicar.sql"));
ok(/permission denied/.test(await anonErro("select * from seguranca.segredos") || ""), "E1a: anon não acessa seguranca.*");
ok(/permission denied/.test(await anonErro("select seguranca.definir_segredo('admin_pin','hackeado123')") || ""), "E1a: anon não consegue definir segredo");
ok((await anon("select public.segredo_configurado('admin_pin') v"))[0].v === false, "E1a: segredo ainda não configurado");
await db.query("select seguranca.definir_segredo('admin_pin','NovoPin#2026')");
await db.query("select seguranca.definir_segredo('senha_manutencao','NovaSenha#2026')");
ok((await anon("select public.segredo_configurado('admin_pin') v"))[0].v === true, "E1a: segredo configurado");
ok((await anon("select public.verificar_pin_admin('NovoPin#2026') v"))[0].v === true, "E1a: PIN novo correto → true");
ok((await anon("select public.verificar_pin_admin('1234') v"))[0].v === false, "E1a: PIN ANTIGO não funciona");
ok((await anon("select public.verificar_senha_manutencao('velha') v"))[0].v === false, "E1a: senha antiga não funciona");
ok((await anon("select public.verificar_senha_manutencao('NovaSenha#2026') v"))[0].v === true, "E1a: senha nova funciona");
ok(/permission denied/.test(await anonErro("select seguranca.verificar('admin_pin','x')") || ""), "E1a: função interna não chamável por anon");
const hash = (await ver("select hash from seguranca.segredos where nome='admin_pin'"))[0].hash;
ok(hash.startsWith("$2") && !hash.includes("NovoPin"), "E1a: segredo armazenado como hash bcrypt");

// força bruta: 5 erros bloqueiam inclusive o PIN correto
for (let i = 0; i < 5; i++) await anon("select public.verificar_pin_admin('chute" + i + "') v");
ok((await anon("select public.verificar_pin_admin('NovoPin#2026') v"))[0].v === false, "E1a: após 5 erros, até o PIN correto é bloqueado (15 min)");
await db.query("delete from seguranca.tentativas where nome = 'admin_pin'");
ok((await anon("select public.verificar_pin_admin('NovoPin#2026') v"))[0].v === true, "E1a: destravar manual funciona");

// ── E1c ──────────────────────────────────────────────────────────────────────
ok((await anon("select value from public.config where key='admin_pin'")).length === 1, "antes de E1c: anon ainda lê a linha admin_pin");
await db.exec(sql("E1c_config_fechar_aplicar.sql"));
ok((await anon("select * from public.config where key in ('admin_pin','senha_manutencao')")).length === 0, "E1c: anon NÃO enxerga mais as chaves de segredo");
ok((await anon("select * from public.config where key='proximo_envio'")).length === 1, "E1c: demais chaves continuam legíveis");
ok(await anonErro("update public.config set value='x' where key='proximo_envio'") === null, "E1c: escrita em chaves comuns continua (limite honesto até E2)");
const upd = await anon("update public.config set value='hack' where key='admin_pin' returning key");
ok(upd.length === 0, "E1c: anon não consegue reescrever admin_pin");
const ins = await anonErro("insert into public.config values ('admin_pin','x') on conflict (key) do update set value=excluded.value");
ok(ins !== null, "E1c: anon não consegue inserir/sobrescrever admin_pin");
ok((await ver("select value from public.config where key='admin_pin'"))[0].value === "", "E1c: valor antigo zerado em config");
ok((await anon("select public.verificar_pin_admin('NovoPin#2026') v"))[0].v === true, "E1c: PIN novo segue funcionando via RPC");

// ── E1c reverter ─────────────────────────────────────────────────────────────
await db.exec(sql("E1c_reverter.sql"));
ok((await ver("select value from public.config where key='admin_pin'"))[0].value === "", "E1c reverter: PIN ANTIGO NÃO volta (continua zerado)");
ok((await ver("select count(*)::int n from pg_policies where tablename='config'"))[0].n === 1, "E1c reverter: policy original restaurada (1 policy)");
ok((await ver("select policyname from pg_policies where tablename='config'"))[0].policyname === "Allow all", "E1c reverter: nome da policy original preservado");

// ── E1a reverter ─────────────────────────────────────────────────────────────
await db.exec(sql("E1a_reverter.sql"));
ok((await ver("select count(*)::int n from pg_namespace where nspname='seguranca'"))[0].n === 0, "E1a reverter: schema seguranca removido");


// ── E2a / E2b ────────────────────────────────────────────────────────────────
await db.exec(sql("E2a_admin_base_aplicar.sql"));
ok(/permission denied/.test(await anonErro("select * from public.admin_roles") || ""), "E2a: anon não lê admin_roles");
await db.exec(sql("E2b_ferramenta_fatias.sql"));
let semAdmin = null; try { await db.query("select emergencia.fechar_tabela_so_admin('E2_rastreios','rastreios',false)"); } catch (e) { semAdmin = e.message; }
ok(/Nenhum admin cadastrado/.test(semAdmin || ""), "E2b: recusa fechar tabela se não há admin cadastrado (evita se trancar)");
await db.query("insert into public.admin_roles (user_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')");
const comoAuth = async (uid, q) => { await db.exec("set role authenticated"); await db.query("select set_config('request.jwt.claim.sub', '" + uid + "', false)"); try { return (await db.query(q)).rows; } catch (e) { return "ERRO:" + e.message; } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', '', false)"); } };
ok((await ver("select relrowsecurity r from pg_class where relname='rastreios'"))[0].r === false, "pré: rastreios está com RLS DESLIGADO (como no diagnóstico)");
ok((await anon("select * from public.rastreios")).length === 1, "pré: anon lê rastreios");
await db.query("select emergencia.fechar_tabela_so_admin('E2_rastreios','rastreios',false)");
ok((await anon("select * from public.rastreios")).length === 0, "E2b: anon NÃO lê mais rastreios");
ok(/row-level security/.test(await anonErro("insert into public.rastreios (codigo) values ('x')") || ""), "E2b: anon não insere (sem insert público)");
ok((await anon("update public.rastreios set codigo='hack' returning id")).length === 0, "E2b: anon não altera");
ok((await comoAuth("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "select * from public.rastreios")).length === 0, "E2b: joiner autenticada (não admin) NÃO lê rastreios");
ok((await comoAuth("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "select * from public.rastreios")).length === 1, "E2b: admin autenticado lê rastreios");
ok(Array.isArray(await comoAuth("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "update public.rastreios set codigo='BR999' returning id")), "E2b: admin altera");
// MFA: com mfa_obrigatorio, só aal2 vale
await db.query("update public.admin_roles set mfa_obrigatorio = true where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'");
ok((await comoAuth("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "select * from public.rastreios")).length === 0, "MFA: admin com senha só (aal1) e MFA obrigatório NÃO lê");
await db.exec("set role authenticated"); await db.query("select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false), set_config('request.jwt.claims','{\"aal\":\"aal2\"}',false)");
const aal2 = (await db.query("select * from public.rastreios")).rows.length; await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claims','',false)");
ok(aal2 === 1, "MFA: admin com aal2 (senha + TOTP) lê");
await db.query("update public.admin_roles set mfa_obrigatorio = false where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'");
// insert público sem leitura de volta
await db.exec("create table public.pedidos_x (id serial primary key, email text); alter table public.pedidos_x enable row level security; create policy aberta on public.pedidos_x for all using (true); grant all on public.pedidos_x to anon, authenticated; grant all on all sequences in schema public to anon, authenticated; insert into public.pedidos_x (email) values ('a@a')");
await db.query("select emergencia.fechar_tabela_so_admin('E2_pedidos_x','pedidos_x',true)");
ok(await anonErro("insert into public.pedidos_x (email) values ('novo@x')") === null, "E2b: formulário público ainda grava (INSERT)");
ok(/row-level security/.test(await anonErro("insert into public.pedidos_x (email) values ('n2@x') returning id") || ""), "E2b: insert ... returning falha (front precisa mudar o .select())");
ok((await anon("select * from public.pedidos_x")).length === 0, "E2b: anon não lê pedidos_x");
let dupl = null; try { await db.query("select emergencia.fechar_tabela_so_admin('E2_pedidos_x','pedidos_x',true)"); } catch (e) { dupl = e.message; }
ok(/já existe/.test(dupl || ""), "E2b: reaplicar a mesma fatia é recusado (protege o backup)");
// reversão exata, inclusive RLS desligado
await db.query("select emergencia.restaurar_policies('E2_rastreios','rastreios')");
ok((await ver("select relrowsecurity r from pg_class where relname='rastreios'"))[0].r === false, "E2b reverter: RLS volta a DESLIGADO (estado original)");
ok((await anon("select * from public.rastreios")).length === 1, "E2b reverter: anon volta a ler rastreios");
await db.query("select emergencia.restaurar_policies('E2_pedidos_x','pedidos_x')");
ok((await ver("select policyname from pg_policies where tablename='pedidos_x'"))[0].policyname === "aberta", "E2b reverter: policy original restaurada");
await db.exec(sql("E2a_reverter.sql").replace(/begin;|commit;/g, "").replace("drop function if exists public.is_admin();", "drop function if exists public.is_admin() cascade;"));

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
