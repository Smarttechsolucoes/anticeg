import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const RAIZ = new URL("../../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DJ = RAIZ + "joiners-auth/", DA = RAIZ + "admin-auth/";
const sql = (f, d = DJ) => readFileSync(d + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
// usuários: 1 admin | 2 ana (ok) | 3 bia (e-mail diferente) | 4 cris (cadastro sem e-mail) | 5 duda (e-mail inválido) | 6 casal (e-mail compartilhado)
// 8 ela (COG repetido por maiúscula) | 9 e-mail NÃO confirmado | 10 outra conta com o e-mail da ana | 11 sem cadastro | 12 fabi (ok)
async function banco({ semPk = false, idsRuins = false } = {}) {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $f$;
    create function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    create table public.joiners (id bigint ${semPk ? "" : "primary key"}, cog text, nome text, nome_site text, email text, twitter text);
    alter table public.joiners enable row level security; create policy aberta on public.joiners for all to public using (true) with check (true);
    grant all on all tables in schema public to anon, authenticated, service_role;
    insert into auth.users values
      ('${U(1)}','dona@exemplo.com',now()), ('${U(2)}','ana@exemplo.com',now()), ('${U(3)}','bia.nova@exemplo.com',now()), ('${U(4)}','cris@exemplo.com',now()),
      ('${U(5)}','duda@exemplo.com',now()), ('${U(6)}','casal@exemplo.com',now()), ('${U(7)}','x@exemplo.com',now()), ('${U(8)}','ela@exemplo.com',now()),
      ('${U(9)}','gabi@exemplo.com',null), ('${U(10)}','ANA@Exemplo.com',now()), ('${U(11)}','sem.cadastro@exemplo.com',now()), ('${U(12)}','fabi@exemplo.com',now());
    insert into public.joiners (id, cog, nome, nome_site, email, twitter) values
      (1,'ana','Ana','Ana S','Ana@Exemplo.com ','@ana'), (2,'bia','Bia','Bia','bia.antiga@exemplo.com','@bia'), (3,'cris','Cris','Cris',null,'@cris'), (4,'duda','Duda','Duda','duda-sem-arroba','@duda'),
      (5,'casal1','C1','C1','casal@exemplo.com','@c1'), (6,'casal2','C2','C2','CASAL@exemplo.com','@c2'),
      (7,'Ela','Ela','Ela','ela@exemplo.com','@ela'), (255010,'ela','Ela2','Ela Dois','outro@exemplo.com','@ela2'), (9,'gabi','Gabi','Gabi','gabi@exemplo.com','@gabi'), (10,'fabi','Fabi','Fabi','fabi@exemplo.com','@fabi');
    ${idsRuins ? "insert into public.joiners (id, cog) values (null, 'semid');" : ""}
  `);
  await d.exec(sql("A1_base_aplicar.sql", DA)); await d.exec(sql("A2_senha_apenas_aplicar.sql", DA));
  await d.exec(`insert into public.admin_roles (user_id) values ('${U(1)}')`);
  return d;
}
async function como(d, papel, uid, q) {
  await d.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: U(uid), role: papel, aal: "aal1" }) : ""}', false)`); await d.exec(`set role ${papel}`);
  try { return { rows: (await d.query(q)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
}
const rodar = async (d, texto) => { try { await d.exec(texto); return null; } catch (e) { await d.exec("rollback").catch(() => {}); return String(e.message); } };
const J1_ANTIGO = execSync("git show ae5d409~1:supabase/joiners-auth/J1_estrutura_aplicar.sql", { cwd: RAIZ, encoding: "utf8", maxBuffer: 1 << 24 });
const J1C = sql("J1c_correcao_aplicar.sql"), VER = sql("J1c_verificar.sql");
const ver = async d => Object.fromEntries((await d.query(VER)).rows.map(r => [r.item, r.valor]));
const fpJ = async d => JSON.stringify((await d.query("select count(*)::int n, md5(string_agg(id::text||coalesce(cog,'')||coalesce(email,''), ',' order by id)) m from public.joiners")).rows[0]);
const estado = async d => JSON.stringify([(await d.query("select * from public.contas_joiner order by user_id")).rows, (await d.query("select * from public.vinculos_pendentes order by id")).rows, (await d.query("select id,email,email_confirmed_at from auth.users order by id")).rows]);
const negado = r => !!r.erro && /permission denied|sem permiss/.test(r.erro);

{ // J1 ANTIGO instalado -> janela aberta; J1c fecha
  const d = await banco(); ok((await rodar(d, J1_ANTIGO)) === null, "J1 antigo (o já instalado) aplica");
  ok((await como(d, "authenticated", 2, "select public.ativar_minha_conta('ana') r")).rows?.[0].r.status === "ok", "ANTES do J1c: conta logada consegue se vincular (a janela existia)");
  const d2 = await banco(); await rodar(d2, J1_ANTIGO); await d2.exec(`insert into public.contas_joiner (user_id, joiner_id, origem) values ('${U(3)}', 2, 'admin')`);
  const antesJ = await fpJ(d2), antesE = await estado(d2);
  ok((await rodar(d2, J1C)) === null, "J1c aplica sem erro");
  ok(await fpJ(d2) === antesJ && await estado(d2) === antesE, "J1c não altera joiners, vínculos, pedidos nem auth.users");
  const v = await ver(d2);
  ok(v["funções de administração com a checagem \"is not true\" (esperado 4)"] === "4", "verificador: 4 funções com 'is not true'");
  ok(v["usuário logado executa ativar_minha_conta (esperado false ATÉ o J4d)"] === "false", "verificador: logado NÃO executa ativar_minha_conta");
  ok(v["o servidor (service_role) executa ativar_minha_conta (esperado true)"] === "true", "verificador: servidor executa");
  ok(v["funções do J1 executáveis por anon (esperado 0)"] === "0", "verificador: anon 0");
  ok(v["funções de administração ainda executáveis pelo authenticated (esperado 4; a negação é feita dentro delas)"] === "4", "verificador: 4 funções admin executáveis (a negação é interna)");
  ok(v["J1c registrada (5 funções guardadas, esperado 5)"] === "5", "verificador: J1c registrada (5)");
  ok(negado(await como(d2, "authenticated", 2, "select public.ativar_minha_conta('ana') r")), "DEPOIS do J1c: conta logada NÃO executa o vínculo");
  ok((await d2.query("select count(*)::int n from public.contas_joiner")).rows[0].n === 1, "nenhum vínculo novo");
  ok((await como(d2, "authenticated", 1, "select count(*)::int n from public.admin_vinculos_pendentes()")).rows?.[0].n === 0, "administradora continua usando as funções admin");
  ok(negado(await como(d2, "authenticated", 2, "select * from public.admin_vinculos_pendentes()")), "joiner comum continua negada nas funções admin");
  await d2.exec("create or replace function public.is_admin() returns boolean language sql stable as $f$ select null::boolean $f$");
  for (const q of ["select * from public.admin_vinculos_pendentes()", "select public.admin_resolver_vinculo(1, false)", "select * from public.admin_buscar_joiners('ana')", "select public.admin_desvincular_conta('" + U(3) + "')"])
    ok(/sem permiss/.test((await como(d2, "authenticated", 1, q)).erro || ""), "is_admin() NULL é NEGADO: " + q.slice(0, 45));
  ok(/J1c já foi aplicada/.test((await rodar(d2, J1C)) || ""), "reaplicar o J1c é recusado");
}
{ const d = await banco(); ok(/J1 não está registrado/.test((await rodar(d, J1C)) || ""), "J1c ABORTA sem o J1 instalado"); }
{ // sequência real: J1 antigo -> J1c -> J4d reabre para as logadas, com a conferência das ondas
  const { laboratorio, como: comoL, rodar: rodarL, U: UL } = await import("./_lab.mjs");
  const d = await laboratorio({ aplicarBase: false });
  const e = await rodarL(d, "J1c_correcao_aplicar.sql", "joiners-auth");
  ok(/J1c já foi aplicada|Nada foi alterado/.test(e || "") || e === null, "laboratório (J1 novo já fecha a janela): J1c é recusada ou inócua: " + (e || "ok"));
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
