// Fase A do lançamento (N1, J4-0, J4c-4e) aplicada sobre o estado de PRODUÇÃO de hoje (J1, J1c, J3, J4a, J4d já aplicados; J4b em diante NÃO): nada pode mudar para visitante nem para joiner.
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/fase-a.mjs
import { laboratorio, como, rodar, verificar, ok, fim, J, sql } from "./_lab.mjs";

const d = await laboratorio({ aplicarBase: false });
// estado de produção: J3, J4a e J4d já aplicados (J4-0 NÃO)
for (const a of ["J3_tentativas_aplicar.sql", "J4a_publico_aplicar.sql", "J4d_ondas_aplicar.sql"]) { const e = await rodar(d, a, J); if (e) throw new Error(a + ": " + e); }
await d.exec("update public.ativacao_estado set liberar_todas = false");   // onda fechada, como em produção

// Matriz de acesso efetivo: por papel/conta e por tabela, quantas linhas LÊ e se consegue inserir/atualizar/apagar (WHERE false) — sem alterar dado nenhum
const tabelas = (await d.query("select tablename t from pg_tables where schemaname = 'public' and tablename not like 'bkp\\_unir\\_%' order by 1")).rows.map(r => r.t);
async function matriz() {
  const m = {};
  for (const [papel, uid] of [["anon", null], ["authenticated", 2], ["authenticated", 4]]) {
    for (const t of tabelas) {
      const lê = await como(d, papel, uid, `select count(*)::int c from public.${t}`);
      const ins = await como(d, papel, uid, `insert into public.${t} select * from public.${t} where false`);
      const upd = await como(d, papel, uid, `update public.${t} set ctid = ctid where false`);
      const del = await como(d, papel, uid, `delete from public.${t} where false`);
      const tag = r => (r.erro ? "negado" : "ok");
      m[`${papel}${uid || ""}/${t}`] = `${lê.erro ? "negado" : lê.rows[0].c}|ins:${tag(ins)}|upd:${upd.erro && !/ctid/.test(upd.erro) ? "negado" : "ok"}|del:${tag(del)}`;
    }
  }
  return m;
}
const m0 = await matriz();
const pol0 = (await d.query("select schemaname, tablename, policyname from pg_policies where schemaname = 'public' order by 1,2,3")).rows.filter(r => r.policyname !== "admin_tudo").length;
const fn0 = (await d.query("select count(*)::int c from pg_proc where pronamespace = 'public'::regnamespace")).rows[0].c;

// ── N1 ──
let e = await rodar(d, "N1_emails_enviados_aplicar.sql", "notificacoes"); ok(e === null, "N1 aplica sem erro" + (e ? ": " + e : ""));
let v = await verificar(d, "N1_emails_enviados_verificar.sql", "notificacoes"); const vn = Object.values(v);
ok(vn[0] === "true" && vn[1] === "false" && vn[2] === "true" && vn[3] === "0" && vn[4] === "1", "N1 verificador: " + vn.join(", ") + " (esperado true, false, true, 0, 1)");
e = await rodar(d, "N1_emails_enviados_aplicar.sql", "notificacoes"); ok(e && /já foi aplicado|já existe/i.test(e), "N1: segunda aplicação é recusada");

// ── J4-0 ──
e = await rodar(d, "J4_0_admin_em_todas_aplicar.sql", J); ok(e === null, "J4-0 aplica sem erro" + (e ? ": " + e : ""));
v = await verificar(d, "J4_0_admin_em_todas_verificar.sql"); const vj = Object.entries(v);
ok(Number(vj[0][1]) > 20 && vj[1][1] === "0" && vj[5][1] === "false" && vj[6][1] === "4", "J4-0 verificador: " + vj.map(x => x[1]).slice(0, 7).join(" | ").slice(0, 160));
e = await rodar(d, "J4_0_admin_em_todas_aplicar.sql", J); ok(e && /já foi aplicada/.test(e), "J4-0: segunda aplicação é recusada");

// ── J4c-4e ──
e = await rodar(d, "J4c4e_cegs_publico_aplicar.sql", J); ok(e === null, "J4c-4e aplica sem erro" + (e ? ": " + e : ""));
v = await verificar(d, "J4c4e_cegs_publico_verificar.sql"); const v4 = Object.values(v);
ok(v4[0] === "3" && v4[1] === "false" && v4[2] === "true", "J4c-4e verificador: " + v4.join(", ") + " (esperado 3, false, true)");
const ceg = await como(d, "anon", null, "select count(*)::int c from public.ceg_resumo()"); ok(!ceg.erro, "visitante lê o resumo dos CEGs (função pública, sem dados pessoais)");
ok((await como(d, "anon", null, "select * from public.ceg_itens('X')")).erro && true, "visitante NÃO executa ceg_itens");

// ── nada mudou para ninguém ──
const m1 = await matriz();
const difs = Object.keys(m0).filter(k => m0[k] !== m1[k]);
ok(difs.length === 0, `NENHUM acesso mudou para visitante, joiner ativada ou conta sem vínculo (${Object.keys(m0).length} combinações papel×tabela comparadas)` + (difs.length ? ": " + difs.slice(0, 5).map(k => `${k}: ${m0[k]} -> ${m1[k]}`).join("; ") : ""));
const pol1 = (await d.query("select policyname from pg_policies where schemaname = 'public'")).rows.filter(r => r.policyname !== "admin_tudo").length;
ok(pol1 === pol0, `as policies existentes (fora as novas admin_tudo) continuam as mesmas (${pol0})`);
ok((await d.query("select count(*)::int c from pg_proc where pronamespace = 'public'::regnamespace")).rows[0].c === fn0 + 3, "só 3 funções novas em public (ceg_resumo, ceg_vencimentos, ceg_itens)");
// a administradora (conta 1) ganha acesso próprio; a joiner comum não
const adm = await como(d, "authenticated", 1, "select count(*)::int c from public.masterlist"), jo = await como(d, "authenticated", 2, "select count(*)::int c from public.masterlist");
ok(!adm.erro && adm.rows[0].c >= jo.rows[0].c, "a administradora enxerga ao menos o que a joiner enxerga (J4-0 só amplia para ela)");
// as travas do C0 seguem valendo também para a administradora
ok(!!(await como(d, "authenticated", 1, "update public.pagamento_demandas set status = status where false")).erro, "a trava de UPDATE em pagamento_demandas continua valendo até para a administradora (só as funções do R1 mudam status)");

// ── reversões (ordem inversa) e retorno ao estado anterior ──
e = await rodar(d, "J4c4e_cegs_publico_reverter.sql", J); ok(e === null, "J4c-4e reverte");
e = await rodar(d, "J4_0_admin_em_todas_reverter_protegido.sql", J); ok(e && /confirmação/.test(e), "J4-0: reversão sem a frase é recusada");
e = await rodar(d, "J4_0_admin_em_todas_reverter_protegido.sql", J, "AUTORIZO REMOVER ACESSO DA ADMIN"); ok(e === null, "J4-0 reverte com a frase" + (e ? ": " + e : ""));
e = await rodar(d, "N1_reverter_protegido.sql", "notificacoes"); ok(e && /confirmação|AUTORIZO/.test(e), "N1: reversão sem a frase é recusada");
e = await rodar(d, "N1_reverter_protegido.sql", "notificacoes", "AUTORIZO REMOVER CONTROLE DE ENVIOS"); ok(e === null, "N1 reverte com a frase" + (e ? ": " + e : ""));
const m2 = await matriz();
ok(Object.keys(m0).every(k => m0[k] === m2[k]), "depois das 3 reversões, o acesso é exatamente o do início");
ok((await d.query("select count(*)::int c from pg_policies where policyname = 'admin_tudo'")).rows[0].c === 0 && (await d.query("select to_regclass('public.emails_enviados') is null as n")).rows[0].n && (await d.query("select count(*)::int c from pg_proc where pronamespace = 'public'::regnamespace")).rows[0].c === fn0, "policies admin_tudo, tabela emails_enviados e as 3 funções saíram");
// reaplica tudo (reprodutível)
for (const [a, dir] of [["N1_emails_enviados_aplicar.sql", "notificacoes"], ["J4_0_admin_em_todas_aplicar.sql", J], ["J4c4e_cegs_publico_aplicar.sql", J]]) { e = await rodar(d, a, dir); ok(e === null, `${a} reaplica depois de reverter` + (e ? ": " + e : "")); }
fim();
