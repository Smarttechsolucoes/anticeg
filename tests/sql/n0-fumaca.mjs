// Valida o N0_teste_fumaca_desfeito.sql (PGlite local, dados fictícios). Uso: node tests/sql/n0-fumaca.mjs
// Prova: passa com o N0 correto; NADA fica gravado; pega permissões erradas; falha de forma clara se o N0 não foi aplicado.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/notificacoes/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
async function banco(aplicar = true) {
  const d = new PGlite();
  await d.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`);
  if (aplicar) await d.exec(sql("N0_tabela_notifications_aplicar.sql"));
  return d;
}
const rodar = async (d, f) => { try { await d.exec(sql(f)); return "sem erro"; } catch (e) { try { await d.exec("rollback"); } catch {} return e.message; } };
const F = "N0_teste_fumaca_desfeito.sql";
const imp = async d => (await d.query(`select md5(coalesce((select string_agg(relname || coalesce(relacl::text, '') || relrowsecurity::text, ',' order by relname) from pg_class where relnamespace = 'public'::regnamespace), '') || coalesce((select string_agg(policyname || cmd || coalesce(qual, '') || coalesce(with_check, ''), ',' order by policyname) from pg_policies), '') || (select count(*)::text from public.notifications)) h`)).rows[0].h;
{ const d = await banco(); const antes = await imp(d); const m = await rodar(d, F);
  ok(m.startsWith("N0 FUMAÇA OK"), "passa com o N0 correto");
  for (const t of ["visitante cria notificação", "visitante lê a notificação não lida", "visitante marca como lida", "NÃO altera a mensagem", "NÃO troca o destinatário", "visitante NÃO apaga", "visitante NÃO trunca", "logado cria notificação", "logado NÃO apaga"]) ok(m.includes(t), `relatório cobre: ${t}`);
  ok(await imp(d) === antes && (await d.query("select count(*)::int n from public.notifications")).rows[0].n === 0, "NADA ficou gravado (tabela vazia; permissões e policies idênticas)"); }
{ const d = await banco(); await d.exec("grant delete on public.notifications to anon;"); const m = await rodar(d, F);
  ok(m.startsWith("N0 FUMAÇA FALHA") && m.includes("visitante apagou"), "pega DELETE liberado ao visitante"); }
{ const d = await banco(); await d.exec("grant update on public.notifications to anon;"); const m = await rodar(d, F);
  ok(m.startsWith("N0 FUMAÇA FALHA") && m.includes("alterou a mensagem"), "pega UPDATE geral liberado (não só read_at)"); }
{ const d = await banco(false); const m = await rodar(d, F); ok(/não existe/.test(m) && !m.startsWith("N0 FUMAÇA OK"), "sem o N0 aplicado: falha de forma clara"); }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
