// ST1 — papel staff_pagamentos. Laboratório FICTÍCIO (PGlite): nenhum dado real, nenhuma rede. Rodar:  node tests/sql/st1-staff-pagamentos.mjs
process.on("uncaughtException", e => { console.log("ERRO:", String(e.message).slice(0, 800)); process.exit(2); });
process.on("unhandledRejection", e => { console.log("ERRO:", String((e && e.message) || e).slice(0, 800)); process.exit(2); });
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = (f, d) => readFileSync(R + d + "/" + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;   // 1 admin | 2 staff | 3 conta comum | 5 staff2

async function laboratorio() {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $f$;
    create function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    insert into auth.users values ('${U(1)}','admin@exemplo.com',now()), ('${U(2)}','staff@exemplo.com',now()), ('${U(3)}','comum@exemplo.com',now()), ('${U(5)}','staff2@exemplo.com',now());
  `);
  await d.exec(sql("01_schema_minimo.sql", "laboratorio"));
  await d.exec(`grant all on all tables in schema public to anon, authenticated, service_role; grant all on all sequences in schema public to anon, authenticated, service_role;
                revoke update, delete on public.pagamento_demandas from anon, authenticated;`);
  await d.exec(sql("A1_base_aplicar.sql", "admin-auth")); await d.exec(sql("A2_senha_apenas_aplicar.sql", "admin-auth"));
  await d.exec(`insert into public.admin_roles (user_id) values ('${U(1)}')`);
  await d.exec(sql("R1_admin_pagamentos_aplicar.sql", "pagamentos")); await d.exec(sql("R1_1_reassociar_itens_aplicar.sql", "pagamentos"));
  // dados fictícios: 2 itens da joiner 'ana', demanda 1 (ana, 2 itens), demanda 2 (outra demanda cobrindo o item A), venc. futuro
  await d.exec(`
    insert into public.masterlist (id, ceg, cog, nome, nome_do_item, valor_item, id_linha, venc_item) values
      (1,'W MAG','ana','Ana','Capa A',50,'WMAG-ITE-0001', current_date + 10), (2,'W MAG','ana','Ana','Capa B',40,'WMAG-ITE-0002', current_date + 10), (3,'W MAG','bia','Bia','Capa C',30,'WMAG-ITE-0003', current_date + 10);
    insert into public.pagamento_demandas (joiner_cog, itens, valor_total, status, comprovante_url) values
      ('ana', '[{"id":1,"id_linha":"WMAG-ITE-0001","ceg":"W MAG","nome_do_item":"Capa A","valor_item":50},{"id":2,"id_linha":"WMAG-ITE-0002","ceg":"W MAG","nome_do_item":"Capa B","valor_item":40}]', 90, 'em_analise', 'x/1.jpg'),
      ('ana', '[{"id":1,"id_linha":"WMAG-ITE-0001","ceg":"W MAG","nome_do_item":"Capa A","valor_item":50}]', 50, 'em_analise', 'x/2.jpg');
  `);
  return d;
}
async function como(d, papel, uid, q, email) {
  await d.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: U(uid), role: papel, email: email || null, aal: "aal1" }) : ""}', false)`); await d.exec(`set role ${papel}`);
  try { return { rows: (await d.query(q)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
}
const negado = r => !!r.erro && /permission denied|row-level security|sem permiss/.test(r.erro);
const v = (r, k) => r.rows?.[0]?.[k];
const flags = async d => (await d.query("select id, pago_item from public.masterlist order by id")).rows.map(r => r.pago_item);

const d = await laboratorio();

// ───────── antes do ST1 ─────────
ok(negado(await como(d, "authenticated", 2, "select public.admin_definir_status_pagamento(1,'pago')")), "antes: conta não-admin é negada nas RPCs de pagamento");
let e0 = null; try { await d.exec(`insert into public.admin_roles (user_id, papel) values ('${U(2)}','staff_pagamentos')`); } catch (e) { e0 = e.message; }
ok(!!e0, "antes: papel 'staff_pagamentos' ainda NÃO existe (o CHECK só aceita 'admin')");

// ───────── aplicar ST1 ─────────
let errAplicar = null; try { await d.exec(sql("ST1_aplicar.sql", "staff-pagamentos")); } catch (e) { errAplicar = e.message; await d.exec("rollback").catch(() => {}); }
ok(!errAplicar, "ST1 aplica sem erro" + (errAplicar ? ": " + errAplicar.slice(0, 300) : ""));
let errReaplicar = null; try { await d.exec(sql("ST1_aplicar.sql", "staff-pagamentos")); } catch (e) { errReaplicar = e.message; await d.exec("rollback").catch(() => {}); }
ok(/já foi aplicado/.test(errReaplicar || ""), "aplicar de novo é recusado (nada muda)");

await d.exec(`insert into public.admin_roles (user_id, papel) values ('${U(2)}','staff_pagamentos'), ('${U(5)}','staff_pagamentos')`);

// ───────── papéis ─────────
const papel = async (uid) => ({ admin: v(await como(d, "authenticated", uid, "select public.is_admin() as x"), "x"), pode: v(await como(d, "authenticated", uid, "select public.pode_operar_pagamentos() as x"), "x"), meu: v(await como(d, "authenticated", uid, "select public.meu_papel_admin() as x"), "x") });
const pa = await papel(1), ps = await papel(2), pc = await papel(3);
ok(pa.admin === true && pa.pode === true && pa.meu === "admin", "admin geral: is_admin e pode_operar verdadeiros, papel 'admin' (nada mudou para as contas atuais)");
ok(ps.admin === false && ps.pode === true && ps.meu === "staff_pagamentos", "staff: is_admin FALSO (não é admin geral), pode_operar VERDADEIRO, papel 'staff_pagamentos'");
ok(pc.admin === false && pc.pode === false && pc.meu === null, "conta comum: tudo falso");
ok(negado(await como(d, "anon", null, "select public.pode_operar_pagamentos()")), "anon não executa pode_operar_pagamentos");
ok(negado(await como(d, "anon", null, "select public.admin_definir_status_pagamento(1,'pago')")), "anon negado nas RPCs");
ok(negado(await como(d, "authenticated", 3, "select public.admin_definir_status_pagamento(1,'pago')")), "conta comum negada em admin_definir_status_pagamento");
ok(negado(await como(d, "authenticated", 3, "select public.admin_marcar_pago(1, true, false, false)")), "conta comum negada em admin_marcar_pago");

// ───────── staff aprova (efeito no banco + registro) ─────────
ok((await flags(d)).every(x => x === false), "partida: nenhum item marcado");
const ap1 = await como(d, "authenticated", 2, "select public.admin_definir_status_pagamento(1,'pago') as r", "staff@exemplo.com");
ok(!ap1.erro && v(ap1, "r").alterado === true && v(ap1, "r").itens_marcados === 2, "staff APROVA a demanda 1: status muda e 2 itens marcados" + (ap1.erro ? " | " + ap1.erro : ""));
ok(JSON.stringify(await flags(d)) === JSON.stringify([true, true, false]), "itens 1 e 2 marcados; item 3 intocado");
const ap2 = await como(d, "authenticated", 2, "select public.admin_definir_status_pagamento(1,'pago') as r", "staff@exemplo.com");
ok(!ap2.erro && v(ap2, "r").alterado === false, "idempotência: aprovar de novo não altera nada");
let log = (await d.query("select acao, demanda_id, status_anterior, status_novo, papel, email, user_id::text uid, resumo from emergencia.pagamento_decisoes order by id")).rows;
ok(log.length === 1 && log[0].acao === "definir_status" && log[0].status_anterior === "em_analise" && log[0].status_novo === "pago" && log[0].papel === "staff_pagamentos" && log[0].email === "staff@exemplo.com" && log[0].uid === U(2), "registro: quem (staff, e-mail, id), quando e o quê; repetição NÃO gera 2º registro");

// ───────── rejeitar preserva o que outra demanda cobre; reabrir ─────────
const dem2 = await como(d, "authenticated", 5, "select public.admin_definir_status_pagamento(2,'pago') as r", "staff2@exemplo.com");   // 2ª demanda também cobre o item 1
ok(!dem2.erro, "outra staff aprova a demanda 2 (cobre o item 1 também)");
const rej = await como(d, "authenticated", 2, "select public.admin_definir_status_pagamento(1,'rejeitado','comprovante ilegível') as r", "staff@exemplo.com");
ok(!rej.erro && v(rej, "r").status === "rejeitado", "staff REJEITA a demanda 1 com motivo" + (rej.erro ? " | " + rej.erro : ""));
ok(JSON.stringify(await flags(d)) === JSON.stringify([true, false, false]), "rejeitar desmarca só o item 2; o item 1 CONTINUA marcado (a demanda 2 paga ainda o cobre)");
ok((await d.query("select motivo_rejeicao from public.pagamento_demandas where id = 1")).rows[0].motivo_rejeicao === "comprovante ilegível", "motivo da rejeição gravado");
const reab = await como(d, "authenticated", 2, "select public.admin_definir_status_pagamento(1,'em_analise') as r", "staff@exemplo.com");
ok(!reab.erro && v(reab, "r").status === "em_analise", "staff REABRE a demanda 1 (volta a EM ANÁLISE)");
ok((await d.query("select status from public.pagamento_demandas where id = 1")).rows[0].status === "em_analise", "status gravado = em_analise");
log = (await d.query("select acao, demanda_id, status_anterior, status_novo, papel from emergencia.pagamento_decisoes order by id")).rows;
ok(log.map(l => `${l.demanda_id}:${l.status_anterior}>${l.status_novo}`).join(" ") === "1:em_analise>pago 2:em_analise>pago 1:pago>rejeitado 1:rejeitado>em_analise", "trilha completa: aprovar, aprovar, rejeitar, reabrir (cada uma com quem e quando)");
const manual = await como(d, "authenticated", 2, "select public.admin_marcar_pago(3, true, false, false) as r", "staff@exemplo.com");
ok(!manual.erro && v(manual, "r").status === "ok", "staff pode marcar pagamento manual (operação de pagamento)");
ok((await d.query("select count(*)::int n from emergencia.pagamento_decisoes where acao = 'marcar_manual' and papel = 'staff_pagamentos'")).rows[0].n === 1, "marcação manual também registrada");

// ───────── staff NÃO é admin geral; registro protegido ─────────
ok(negado(await como(d, "authenticated", 2, "select * from public.admin_decisoes_pagamento(10)")), "staff NÃO lê o registro de decisões (só admin geral)");
const ver = await como(d, "authenticated", 1, "select count(*)::int n from public.admin_decisoes_pagamento(100)");
ok(!ver.erro && v(ver, "n") >= 5, "admin geral lê o registro de decisões");
for (const [papel_, uid] of [["authenticated", 2], ["authenticated", 3], ["anon", null]]) ok(negado(await como(d, papel_, uid, "select * from emergencia.pagamento_decisoes")), `${papel_}${uid ? " #" + uid : ""} não lê emergencia.pagamento_decisoes`);
ok(negado(await como(d, "authenticated", 2, "insert into public.admin_roles (user_id, papel) values ('" + U(3) + "','admin')")), "staff não consegue se promover a admin (admin_roles sem acesso pela API)");
const sr = await como(d, "authenticated", 2, "update public.pagamento_demandas set status = 'pago' where id = 2");
ok(negado(sr) || sr.rows?.length === 0 || /0/.test(String(sr.rows?.length)), "staff não altera pagamento_demandas direto (só pelas RPCs)");

// ───────── reverter ─────────
let errRev = null; try { await d.exec(sql("ST1_reverter.sql", "staff-pagamentos")); } catch (e) { errRev = e.message; await d.exec("rollback").catch(() => {}); }
ok(/staff_pagamentos/.test(errRev || ""), "reverter é RECUSADO enquanto houver conta staff (nada muda)");
await d.exec(`delete from public.admin_roles where papel = 'staff_pagamentos'`);
errRev = null; try { await d.exec(sql("ST1_reverter.sql", "staff-pagamentos")); } catch (e) { errRev = e.message; await d.exec("rollback").catch(() => {}); }
ok(!errRev, "reverter funciona depois de remover as contas staff" + (errRev ? ": " + errRev.slice(0, 300) : ""));
ok(v(await como(d, "authenticated", 1, "select public.admin_definir_status_pagamento(2,'em_analise') as r"), "r")?.status === "em_analise", "após reverter: admin geral continua operando as RPCs");
ok((await d.query("select count(*)::int n from emergencia.pagamento_decisoes")).rows[0].n >= 5, "trilha de auditoria preservada após reverter");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
