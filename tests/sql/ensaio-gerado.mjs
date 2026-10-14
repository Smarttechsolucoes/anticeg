// Confere que os SQLs GERADOS para o projeto de ensaio (scripts/ensaio/gerar-sql.mjs) rodam do começo ao fim em um banco vazio simulado (PGlite), na ordem do guia,
// e que a guarda contra rodar em banco com tabelas do site (produção) funciona. Uso: node scripts/ensaio/gerar-sql.mjs && node tests/sql/ensaio-gerado.mjs
process.on("uncaughtException", e => { console.log("ERRO:", String(e.message).slice(0, 600)); process.exit(2); });
process.on("unhandledRejection", e => { console.log("ERRO:", String(e && e.message || e).slice(0, 600)); process.exit(2); });
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/ensaio/gerado/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const base = async () => {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $f$;
    create function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    insert into auth.users values ('00000000-0000-0000-0000-000000000001','admin.ensaio@exemplo.com',now()), ('00000000-0000-0000-0000-000000000002','ana@exemplo.com',now());`);
  return d;
};
const sql = f => readFileSync(R + f, "utf8");
{
  const d = await base();
  try { await d.exec(sql("ENSAIO_1_base.sql")); ok(true, "ENSAIO_1 (estado de hoje + J1 + J3) roda em banco vazio"); } catch (e) { ok(false, "ENSAIO_1: " + e.message.slice(0, 200)); }
  ok((await d.query("select count(*)::int c from public.joiners")).rows[0].c === 11 && (await d.query("select count(*)::int c from public.joiners where email like '%@exemplo.com' or email is null or email like 'duda%'")).rows[0].c === 11, "só dados fictícios (11 joiners, todas com e-mail de exemplo)");
  await d.exec("insert into public.admin_roles (user_id) values ('00000000-0000-0000-0000-000000000001')");
  try { await d.exec(sql("ENSAIO_2_lancamento.sql")); ok(true, "ENSAIO_2 (J4-0, J4a, J4b, J4c-1, J4c-2) roda em seguida"); } catch (e) { ok(false, "ENSAIO_2: " + e.message.slice(0, 200)); }
  ok((await d.query("select count(*)::int c from emergencia.c0b_estado_anterior where etapa in ('J4-0','J4a','J4b-1','J4c-1','J4c-2')")).rows[0].c > 20, "o estado anterior de cada etapa ficou registrado");
  await d.exec("set role anon");
  let negado = false; try { await d.query("select * from public.joiners"); } catch (e) { negado = /permission denied/.test(e.message); }
  ok(negado, "depois do lançamento o visitante não lê joiners");
}
{
  const d = await base(); await d.exec("create table public.masterlist (id bigint)");
  let msg = ""; try { await d.exec(sql("ENSAIO_1_base.sql")); } catch (e) { msg = e.message; }
  ok(/JÁ TEM tabelas do site/.test(msg), "GUARDA: o ENSAIO_1 se recusa a rodar em banco que já tem tabelas do site (produção)");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
