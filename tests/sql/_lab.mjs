// Laboratório compartilhado pelos testes do J4c-4 e do J5 (PGlite local, só dados fictícios). Uso: npm i --no-save @electric-sql/pglite
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
export const sql = (f, d) => readFileSync(R + d + "/" + f, "utf8");
export const J = "joiners-auth";
export const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
let falhas = 0;
export const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
export const fim = () => { console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0); };
process.on("uncaughtException", e => { console.log("ERRO:", String(e.message).slice(0, 600)); process.exit(2); });
process.on("unhandledRejection", e => { console.log("ERRO:", String(e && e.message || e).slice(0, 600)); process.exit(2); });

// contas: 1 administradora | 2 ana (ativada, joiner 1) | 3 bia (ativada pelo admin, joiner 2) | 4 conta SEM vínculo | 9 gabi (ativada) | 7/8 "ela"/"Ela" (COGs parecidos)
// ondas: "todas" (padrão: a ativação já está liberada para todas, como depois do lançamento geral) | "fechado" (ninguém liberada) | false (J4d não aplicado)
export async function laboratorio({ aplicarBase = true, ondas = "todas" } = {}) {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $f$;
    create function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    insert into auth.users values ('${U(1)}','dona@exemplo.com',now()), ('${U(2)}','ana@exemplo.com',now()), ('${U(3)}','bia.antiga@exemplo.com',now()), ('${U(4)}','sem.vinculo@exemplo.com',now()), ('${U(9)}','gabi@exemplo.com',now()), ('${U(7)}','ela.conta@exemplo.com',now()), ('${U(8)}','ela2.conta@exemplo.com',now());
  `);
  await d.exec(sql("01_schema_minimo.sql", "laboratorio")); await d.exec(sql("02_politicas_de_hoje_simuladas.sql", "laboratorio"));
  await d.exec(`grant all on all tables in schema public to anon, authenticated, service_role; grant all on all sequences in schema public to anon, authenticated, service_role;`);
  await d.exec(`revoke update on public.masterlist from anon, authenticated; grant update (ceg, cog, nome, nome_do_item, valor_item, frete_inter, taxa_rf, status, info_adicionais, na_loja, id_linha) on public.masterlist to anon, authenticated;
                revoke update, delete on public.pagamento_demandas from anon, authenticated; revoke insert, update, delete on public.multas_pagas from anon, authenticated;`);
  await d.exec(sql("03_dados_ficticios.sql", "laboratorio")); await d.exec(sql("04_tabelas_j4c.sql", "laboratorio")); await d.exec(sql("06_lojas_publicas.sql", "laboratorio")); await d.exec(sql("07_tabelas_j4c4.sql", "laboratorio"));
  await d.exec(sql("A1_base_aplicar.sql", "admin-auth")); await d.exec(sql("A2_senha_apenas_aplicar.sql", "admin-auth"));
  await d.exec(`insert into public.admin_roles (user_id) values ('${U(1)}')`);
  await d.exec(sql("J1_estrutura_aplicar.sql", J));
  // no J1 isolado a função só é executável pelo servidor (service_role); o J4d devolve a execução ao authenticated
  const ativar = async (uid, cog) => { await d.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(uid), role: "authenticated" })}', false)`); await d.exec("set role service_role"); await d.query(`select public.ativar_minha_conta('${cog}')`); await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims','',false)"); };
  await ativar(2, "ana"); await ativar(9, "gabi");
  await d.exec(`insert into public.contas_joiner (user_id, joiner_id, origem) values ('${U(3)}', 2, 'admin')`);
  await d.exec(`insert into public.contas_joiner (user_id, joiner_id, origem) values ('${U(7)}', 7, 'admin'), ('${U(8)}', 8, 'admin');`);
  if (aplicarBase) for (const a of ["J4_0_admin_em_todas_aplicar.sql", "J4a_publico_aplicar.sql"]) { const e = await rodar(d, a, J); if (e) throw new Error(a + ": " + e); }
  if (aplicarBase && ondas) {
    await d.exec(sql("J3_tentativas_aplicar.sql", J));
    const e = await rodar(d, "J4d_ondas_aplicar.sql", J); if (e) throw new Error("J4d_ondas_aplicar.sql: " + e);
    if (ondas === "todas") await d.exec("update public.ativacao_estado set liberar_todas = true");
  }
  return d;
}
export async function como(d, papel, uid, q) {
  await d.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: U(uid), role: papel, aal: "aal1" }) : ""}', false)`); await d.exec(`set role ${papel}`);
  try { return { rows: (await d.query(q)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
}
export const n = async (d, papel, uid, q) => (await como(d, papel, uid, q)).rows?.length;
export const negado = r => !!r.erro && /permission denied|row-level security|sem permiss|não permitida|nao permitida/.test(r.erro);
export async function rodar(d, arq, dir, frase) { try { await d.exec(frase ? sql(arq, dir).replace("confirmacao text := '';", `confirmacao text := '${frase}';`) : sql(arq, dir)); return null; } catch (e) { await d.exec("rollback").catch(() => {}); return String(e.message); } }
export const verificar = async (d, arq, dir = J) => Object.fromEntries((await d.query(sql(arq, dir))).rows.map(r => [r.item, r.valor]));
