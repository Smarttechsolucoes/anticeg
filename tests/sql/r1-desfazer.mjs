// R1 — regras de itens ausentes e de DESFAZIMENTO ao reabrir/rejeitar (PGlite local, só dados fictícios). Uso: node tests/sql/r1-desfazer.mjs
// Prova: confirmar não passa com item inexistente sem aceite; reabrir/rejeitar desfaz SÓ o que a confirmação ligou, e nunca o que veio da planilha, de marcação manual ou de outra demanda paga.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/pagamentos/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

async function banco() {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    -- como no Supabase real: tudo o que o dono cria em public (e em emergencia) nasce com ALL para anon/authenticated/service_role (o R1 e o C0 é que fecham)
    create schema if not exists emergencia; grant usage on schema emergencia to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema emergencia grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema emergencia grant all on functions to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $f$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users values ('${U(1)}', 'dona@exemplo.com'), ('${U(2)}', 'joiner@exemplo.com');
    create table public.admin_roles (user_id uuid primary key); insert into public.admin_roles values ('${U(1)}');
    create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $f$ select exists (select 1 from public.admin_roles r where r.user_id = (select auth.uid())) $f$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;
    create table public.multas_pagas (id serial primary key, masterlist_id bigint);
    create table public.masterlist (id bigint primary key, cog text, valor_item numeric default 0, frete_inter numeric default 0, taxa_rf numeric default 0, pago_item boolean default false, pago_frete boolean default false, pago_rf boolean default false, nome text);
    create table public.pagamento_demandas (id bigint generated always as identity primary key, joiner_cog text, itens jsonb, valor_total numeric, status text default 'em_analise', motivo_rejeicao text);
    insert into public.masterlist (id, cog, valor_item, frete_inter) values (1,'ana',100,20),(2,'ana',50,0),(3,'ana',50,0),(4,'ana',30,0),(5,'ana',40,0),(6,'ana',60,10),(7,'ana',10,0),(8,'bia',70,0);
    -- estado do C0: visitante e logado só leem estas duas tabelas
    revoke all on all tables in schema public from anon, authenticated; grant select on public.masterlist, public.pagamento_demandas to anon, authenticated;
    grant select, update, insert on public.masterlist, public.pagamento_demandas to service_role;
    grant insert, select on public.multas_pagas to service_role;
  `);
  await d.exec(sql("R1_admin_pagamentos_aplicar.sql"));
  return d;
}
const adm = async (d, q, uid = 1) => {
  await d.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(uid), role: "authenticated" })}', false)`); await d.exec("set role authenticated");
  try { const r = await d.query(q); return r.rows[0]?.r ?? r.rows; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
};
const dem = async (d, cog, itens) => (await d.query("insert into public.pagamento_demandas (joiner_cog, itens, valor_total) values ($1, $2::jsonb, 1) returning id", [cog, JSON.stringify(itens)])).rows[0].id;
const it = (id, v = 0, f = 0, r = 0) => ({ id, valor_item: v, frete_inter: f, taxa_rf: r });
const def = (d, id, st, motivo = null, t = false, a = false) => adm(d, `select public.admin_definir_status_pagamento(${id}, '${st}', ${motivo === null ? "null" : `'${motivo}'`}, ${t}, ${a}) r`);
const estado = async (d, id) => { const x = (await d.query("select pago_item i, pago_frete f, pago_rf r from public.masterlist where id = $1", [id])).rows[0]; return `${+x.i}${+x.f}${+x.r}`; };
const abertas = async d => (await d.query("select count(*)::int n from emergencia.pagamento_marcacoes where desfeito_em is null")).rows[0].n;

{ // S1: a confirmação liga; reabrir desfaz exatamente isso
  const d = await banco(); const D = await dem(d, "ana", [it(1, 100, 20)]);
  const c = await def(d, D, "pago");
  ok(c.status === "pago" && await estado(d, 1) === "110" && await abertas(d) === 2, "S1: confirmar liga item+frete e registra as 2 marcações");
  const r = await def(d, D, "em_analise");
  ok(r.itens_desmarcados === 2 && await estado(d, 1) === "000" && await abertas(d) === 0, "S1: reabrir desfaz as 2 marcações (e fecha o registro)");
  const c2 = await def(d, D, "pago");
  ok(c2.status === "pago" && await estado(d, 1) === "110" && await abertas(d) === 2, "S1: confirmar de novo depois de reabrir liga e registra de novo");
  const rj = await def(d, D, "rejeitado", "ilegível");
  ok(rj.itens_desmarcados === 2 && await estado(d, 1) === "000", "S1: rejeitar depois de confirmar também desfaz");
}
{ // S2: campo que JÁ estava marcado (planilha/sync) nunca é desfeito
  const d = await banco(); await d.exec("update public.masterlist set pago_item = true where id = 2"); const D = await dem(d, "ana", [it(2, 50)]);
  const c = await def(d, D, "pago"); ok(c.status === "pago" && await abertas(d) === 0, "S2: item já marcado antes: a confirmação não registra nada");
  const r = await def(d, D, "rejeitado"); ok(r.itens_desmarcados === 0 && await estado(d, 2) === "100", "S2: rejeitar NÃO desmarca o que já estava marcado antes (planilha/sync)");
}
{ // S3: duas demandas pagas cobrem o mesmo item: a marcação passa para a que continua paga
  const d = await banco(); const A = await dem(d, "ana", [it(3, 50)]); const B = await dem(d, "ana", [it(3, 50)]);
  await def(d, A, "pago"); await def(d, B, "pago");
  const ra = await def(d, A, "rejeitado"); ok(ra.itens_desmarcados === 0 && ra.itens_mantidos === 1 && await estado(d, 3) === "100", "S3: rejeitar A mantém (B também paga o item)");
  const rb = await def(d, B, "rejeitado"); ok(rb.itens_desmarcados === 1 && await estado(d, 3) === "000" && await abertas(d) === 0, "S3: rejeitar B depois desmarca (ninguém mais cobre)");
}
{ // S4: marcação MANUAL protege (antes ou depois da confirmação)
  const d = await banco(); const A = await dem(d, "ana", [it(4, 30)]);
  await adm(d, "select public.admin_marcar_pago(4, true, false, false) r"); await def(d, A, "pago");
  const r1 = await def(d, A, "rejeitado"); ok(r1.itens_desmarcados === 0 && await estado(d, 4) === "100", "S4a: manual ANTES da confirmação: rejeitar não desmarca");
  const B = await dem(d, "ana", [it(5, 40)]); await def(d, B, "pago"); await adm(d, "select public.admin_marcar_pago(5, true, false, false) r");
  const r2 = await def(d, B, "em_analise"); ok(r2.itens_desmarcados === 0 && r2.itens_mantidos === 1 && await estado(d, 5) === "100", "S4b: manual DEPOIS da confirmação: reabrir não desmarca");
  ok((await adm(d, "select public.admin_marcar_pago(5, true, false, false) r")).status === "ok", "S4: marcar manual duas vezes é idempotente");
}
{ // S5: só o campo ligado por esta demanda é desfeito
  const d = await banco(); await d.exec("update public.masterlist set pago_item = true where id = 6"); const D = await dem(d, "ana", [it(6, 60, 10)]);
  await def(d, D, "pago"); ok(await estado(d, 6) === "110", "S5: confirmar ligou só o frete (item já estava)");
  const r = await def(d, D, "rejeitado"); ok(r.itens_desmarcados === 1 && await estado(d, 6) === "100", "S5: rejeitar desfaz só o frete e mantém o item que vinha da planilha");
}
{ // S6: nunca confirmada (em_analise -> rejeitado): nada é tocado
  const d = await banco(); await d.exec("update public.masterlist set pago_item = true where id = 7"); const D = await dem(d, "ana", [it(7, 10)]);
  const r = await def(d, D, "rejeitado"); ok(r.alterado === true && r.itens_desmarcados === 0 && await estado(d, 7) === "100", "S6: rejeitar demanda nunca confirmada não toca em pago_*");
}
{ // S7: demanda confirmada ANTES do R1 (sem registro) não desmarca nada ao reabrir
  const d = await banco(); const D = await dem(d, "ana", [it(1, 100, 20)]);
  await d.exec(`update public.masterlist set pago_item = true, pago_frete = true where id = 1; update public.pagamento_demandas set status = 'pago' where id = ${D}`);
  const r = await def(d, D, "em_analise"); ok(r.itens_desmarcados === 0 && await estado(d, 1) === "110", "S7: demanda 'pago' anterior ao R1 (sem registro): reabrir não desmarca (comportamento antigo preservado)");
}
{ // S8: itens ausentes
  const d = await banco(); const D = await dem(d, "ana", [it(2, 50), it(9999, 10), it(8888, 5)]);
  const b = await def(d, D, "pago");
  ok(b.status === "confirmar_itens_ausentes" && b.itens_nao_encontrados === 2 && JSON.stringify(b.ids) === "[9999,8888]" && await estado(d, 2) === "000" && (await d.query("select status from public.pagamento_demandas where id = $1", [D])).rows[0].status === "em_analise", "S8: ids inexistentes bloqueiam e NADA é gravado");
  const o = await def(d, D, "pago", null, false, true);
  ok(o.status === "pago" && o.itens_marcados === 1 && o.itens_nao_encontrados === 2 && await estado(d, 2) === "100", "S8: com aceitar_ausentes confirma o que existe e informa o que não existe");
  const D2 = await dem(d, "ana", [{ id: null, id_linha: null, ceg: "—", nome_do_item: "outros", valor_item: 10, frete_inter: 0, taxa_rf: 0 }]);
  ok((await def(d, D2, "pago")).status === "pago", "S8: item 'outros' (sem id, fora da masterlist) NÃO bloqueia");
  const D3 = await dem(d, "ana", [it(8, 70), it(9999, 1)]);
  const t = await def(d, D3, "pago"); ok(t.status === "confirmar_terceiros", "S8: terceiros vem antes (item da bia)");
  const t2 = await def(d, D3, "pago", null, true, false); ok(t2.status === "confirmar_itens_ausentes", "S8: depois de aceitar terceiros ainda pede o aceite dos ausentes");
  const t3 = await def(d, D3, "pago", null, true, true); ok(t3.status === "pago" && await estado(d, 8) === "100", "S8: com os dois aceites confirma");
}
{ // S9: falha no meio => nada fica gravado (valor não numérico)
  const d = await banco(); const D = await dem(d, "ana", [it(2, 50), { id: 3, valor_item: "abc" }]);
  const e = await def(d, D, "pago"); ok(!!e.erro, "S9: valor não numérico gera erro");
  ok(await estado(d, 2) === "000" && (await d.query("select status from public.pagamento_demandas where id = $1", [D])).rows[0].status === "em_analise" && await abertas(d) === 0, "S9: nada ficou gravado (status, pago_* e registro intactos)");
}
{ // S10: o registro interno é inacessível; função de admin só para admin
  const d = await banco();
  await d.exec("set role anon"); const a = await d.query("select * from emergencia.pagamento_marcacoes").then(() => "leu", e => e.message); await d.exec("reset role");
  await d.exec("set role authenticated"); const b = await d.query("select * from emergencia.pagamento_marcacoes").then(() => "leu", e => e.message); await d.exec("reset role");
  ok(/permission denied/.test(a) && /permission denied/.test(b), "S10: visitante e logado NÃO leem o registro interno");
  const D = await dem(d, "ana", [it(2, 50)]);
  ok(/sem permiss/.test((await adm(d, `select public.admin_definir_status_pagamento(${D}, 'pago') r`, 2)).erro || ""), "S10: logada que não é admin continua negada");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
