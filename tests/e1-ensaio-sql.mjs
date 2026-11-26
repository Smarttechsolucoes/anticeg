// Confere o SQL ÚNICO do projeto Supabase de TESTE (scripts/e1-gerar-sql-ensaio.mjs) num Postgres local (PGlite) que imita o Supabase (papéis, auth.users, auth.uid() lendo o JWT).
// Uso: npm i --no-save @electric-sql/pglite && node tests/e1-ensaio-sql.mjs
import { PGlite } from "@electric-sql/pglite";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const saida = join(mkdtempSync(join(tmpdir(), "e1sql-")), "ensaio.sql");
const g = spawnSync(process.execPath, ["scripts/e1-gerar-sql-ensaio.mjs", saida], { cwd: raiz, encoding: "utf8" });
ok(g.status === 0, "o gerador monta o SQL único");
const sql = readFileSync(saida, "utf8");
ok(/RECUSADO: este banco já tem public\.joiners/.test(sql) && !/ghjfsmwwcfpfvrouyrka/.test(sql), "o SQL tem a trava contra rodar em banco com public.joiners e não cita o projeto de produção");

const d = new PGlite();
await d.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;
  create schema auth; grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);
let erro1 = null; try { await d.exec(sql); } catch (e) { erro1 = e; }
ok(!erro1, "o SQL único roda inteiro num banco novo" + (erro1 ? ": " + erro1.message : ""));
let erro2 = null; try { await d.exec(sql); } catch (e) { erro2 = e; }
ok(erro2 && /RECUSADO/.test(String(erro2.message)), "rodar de novo (ou na produção) é RECUSADO");

const como = async (papel, claims, consulta, p = []) => {
  await d.exec(`select set_config('request.jwt.claims', '${claims ? JSON.stringify(claims) : ""}', false); set role ${papel}`);
  try { return { rows: (await d.query(consulta, p)).rows }; } catch (e) { return { erro: String(e.message) }; } finally { await d.exec("reset role; select set_config('request.jwt.claims', '', false)"); }
};
const U = "11111111-1111-1111-1111-111111111111";
await d.exec(`insert into auth.users values ('${U}', 'ensaio.e1@exemplo.com', now())`);
ok((await como("anon", null, "select public.e1_ensaio_semear($1,'teste_e1')", [U])).erro, "anon NÃO pode semear");
ok((await como("authenticated", { sub: U, role: "authenticated" }, "select public.e1_ensaio_semear($1,'teste_e1')", [U])).erro, "conta autenticada NÃO pode semear");
ok((await como("service_role", null, "select public.e1_ensaio_semear($1,'cadastro_real')", [U])).erro, "a semeadura só aceita cadastros teste_e1…");
const id = (await como("service_role", null, "select public.e1_ensaio_semear($1,'teste_e1') id", [U])).rows?.[0]?.id;
ok(id > 0, "service_role semeia o cadastro fictício e o vincula à conta");

// o caminho real da joiner: JWT da conta -> salvar_meu_cadastro (auth.uid() lê o JWT como no Supabase)
const r = await como("authenticated", { sub: U, role: "authenticated" }, "select public.salvar_meu_cadastro('Teste E1 Horario') r");
ok(r.rows?.[0]?.r?.ok === true && r.rows[0].r.nome === "Teste E1 Horario", "a conta fictícia salva o nome pelo caminho real (salvar_meu_cadastro) e recebe a confirmação do banco");
const t = (await como("service_role", null, "select id, planilha_status, lida_em, tipo from public.cadastro_tarefas where joiner_id = $1 order by id desc limit 1", [id])).rows?.[0];
ok(t && t.planilha_status === "pendente" && !t.lida_em, "a tarefa nasce 'pendente' e legível pela chave de serviço (como o script de ensaio vai ler pelo REST)");
const fila = (await como("service_role", null, "select * from public.perfil_sync_proximos(10)")).rows;
ok(fila.length === 1, "a fila tem 1 item para o perfil-sync pegar");
ok((await como("anon", null, "select count(*) from public.cadastro_tarefas")).erro && (await como("authenticated", { sub: U, role: "authenticated" }, "select count(*)::int n from public.cadastro_tarefas")).rows?.[0]?.n === 0, "anon NÃO acessa e a conta comum não enxerga nenhuma tarefa (nem a própria)");
await d.close(); process.exitCode = falhas ? 1 : 0;
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
