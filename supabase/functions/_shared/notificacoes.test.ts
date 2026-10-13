// Testes da lógica de notificações. Rodar: node --test supabase/functions/_shared/notificacoes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { prepararEmail, validarPush, endpointPushValido, identificarQuem, identificarChamada, escapeHtml, LIMITES } from "./notificacoes.ts";
import type { Db, Demanda, Joiner, Pendencia, Report } from "./notificacoes.ts";

const AGORA = new Date("2026-10-14T15:00:00Z");
const LEGADO = { permitirAnonimo: true };   // modo "só @" ainda aceito (antes do lançamento do acesso por senha)
const minutosAtras = (m: number) => new Date(AGORA.getTime() - m * 60000).toISOString();

function criarDb(sobras: Partial<{ demandas: Demanda[]; reports: Report[]; joiners: Joiner[]; pend: Pendencia[]; envios: { evento: string; referencia: string; destinatario: string; em: string }[] }> = {}) {
  const estado = {
    demandas: sobras.demandas ?? [{ id: 101, joiner_cog: "ana", status: "em_analise", created_at: minutosAtras(2), valor_total: 120.5, itens: [{ nome_do_item: "<b>Photocard</b>", ceg: "SKZOO", valor_item: 120.5 }], motivo_rejeicao: null }],
    reports: sobras.reports ?? [{ id: 7, joiner_cog: "ana", item_nome: "Item <x>", resposta: "ok", status: "resolvido" }],
    joiners: sobras.joiners ?? [{ cog: "ana", nome: "Ana", email: "Ana@Exemplo.com" }, { cog: "sem", nome: "Sem", email: null }, { cog: "dup", nome: "D1", email: "d@e.com" }, { cog: "dup", nome: "D2", email: "d2@e.com" }, { cog: "ruim", nome: "R", email: "sem-arroba" }],
    pend: sobras.pend ?? [{ ceg: "SKZOO", nome_do_item: "Item A", valor_item: 50, frete_inter: 10, taxa_rf: 0, pago_item: false, pago_frete: false, pago_rf: false }],
    envios: sobras.envios ?? [],
  };
  const db: Db = {
    demanda: async id => estado.demandas.find(d => d.id === id) ?? null,
    report: async id => estado.reports.find(r => r.id === id) ?? null,
    joinersPorCog: async cog => estado.joiners.filter(j => j.cog.toLowerCase() === cog.toLowerCase()),
    pendenciasDoJoiner: async () => estado.pend,
    contarEnvios: async (dest, desde) => estado.envios.filter(e => e.em >= desde && (dest === null || e.destinatario === dest)).length,
    registrarEnvio: async e => { if (estado.envios.some(x => x.evento === e.evento && x.referencia === e.referencia)) return false; estado.envios.push({ ...e, em: AGORA.toISOString() }); return true; },
  };
  return { db, estado };
}

test("comprovante_recebido: o visitante pode acionar, o destinatário vem do CADASTRO e o corpo é do sistema", async () => {
  const { db } = criarDb();
  const r = await prepararEmail({ evento: "comprovante_recebido", demanda_id: 101 }, "anonimo", db, AGORA, LEGADO);
  assert.equal(r.ok, true);
  assert.equal(r.para, "ana@exemplo.com");           // normalizado, vindo do banco
  assert.match(r.html!, /Recebemos o seu comprovante/);
  assert.match(r.html!, /&lt;b&gt;Photocard&lt;\/b&gt;/); // conteúdo dinâmico escapado
  assert.doesNotMatch(r.html!, /<b>Photocard/);
});
test("o visitante NÃO consegue escolher destinatário, assunto nem corpo", async () => {
  const { db } = criarDb();
  for (const extra of [{ to_email: "vitima@x.com" }, { assunto: "Golpe" }, { corpo: "<a href=x>clique</a>" }, { to_name: "x" }]) {
    const r = await prepararEmail({ evento: "comprovante_recebido", demanda_id: 101, ...extra }, "anonimo", db, AGORA, LEGADO);
    assert.equal(r.ok, false); assert.equal(r.status, 400);
  }
  const antigo = await prepararEmail({ to_email: "x@y.com", assunto: "a", corpo: "b" }, "anonimo", db, AGORA, LEGADO);
  assert.equal(antigo.ok, false); assert.equal(antigo.status, 400); // o formato antigo da função não funciona mais
});
test("só envia uma vez por registro (não dá para reenviar em loop)", async () => {
  const { db } = criarDb();
  assert.equal((await prepararEmail({ evento: "comprovante_recebido", demanda_id: 101 }, "anonimo", db, AGORA, LEGADO)).ok, true);
  const r2 = await prepararEmail({ evento: "comprovante_recebido", demanda_id: 101 }, "anonimo", db, AGORA, LEGADO);
  assert.equal(r2.ok, false); assert.equal(r2.status, 409);
});
test("comprovante_recebido recusa: demanda antiga, já confirmada, inexistente ou id inválido", async () => {
  const velha = criarDb({ demandas: [{ id: 1, joiner_cog: "ana", status: "em_analise", created_at: minutosAtras(500), valor_total: 1, itens: [], motivo_rejeicao: null }] });
  assert.equal((await prepararEmail({ evento: "comprovante_recebido", demanda_id: 1 }, "anonimo", velha.db, AGORA, LEGADO)).status, 409);
  const paga = criarDb({ demandas: [{ id: 2, joiner_cog: "ana", status: "pago", created_at: minutosAtras(1), valor_total: 1, itens: [], motivo_rejeicao: null }] });
  assert.equal((await prepararEmail({ evento: "comprovante_recebido", demanda_id: 2 }, "anonimo", paga.db, AGORA, LEGADO)).status, 409);
  const { db } = criarDb();
  assert.equal((await prepararEmail({ evento: "comprovante_recebido", demanda_id: 999 }, "anonimo", db, AGORA, LEGADO)).status, 404);
  for (const id of [0, -1, 1.5, "abc", null]) assert.equal((await prepararEmail({ evento: "comprovante_recebido", demanda_id: id }, "anonimo", db, AGORA, LEGADO)).status, 400);
});
test("eventos de administração exigem administradora (ou o serviço do sync) e anônimo é barrado", async () => {
  const rej = [{ id: 5, joiner_cog: "ana", status: "rejeitado", created_at: minutosAtras(60), valor_total: 1, itens: [], motivo_rejeicao: "Valor <script>" }];
  const { db } = criarDb({ demandas: rej });
  for (const ev of [{ evento: "comprovante_recusado", demanda_id: 5 }, { evento: "report_resolvido", report_id: 7 }, { evento: "lembrete_pagamento", joiner_cog: "ana" }]) {
    assert.equal((await prepararEmail(ev, "anonimo", db, AGORA, LEGADO)).status, 401);
  }
  const ok1 = await prepararEmail({ evento: "comprovante_recusado", demanda_id: 5 }, "admin", db, AGORA);
  assert.equal(ok1.ok, true); assert.match(ok1.html!, /Valor &lt;script&gt;/); assert.doesNotMatch(ok1.html!, /<script>/);
  const ok2 = await prepararEmail({ evento: "report_resolvido", report_id: 7 }, "admin", db, AGORA);
  assert.equal(ok2.ok, true); assert.match(ok2.html!, /Item &lt;x&gt;/);
  const ok3 = await prepararEmail({ evento: "lembrete_pagamento", joiner_cog: "ana" }, "admin", db, AGORA);
  assert.equal(ok3.ok, true); assert.match(ok3.html!, /R\$ 60,00/);
});
test("lembrete: só uma vez por dia por joiner e só se houver pendência", async () => {
  const { db } = criarDb();
  assert.equal((await prepararEmail({ evento: "lembrete_pagamento", joiner_cog: "ana" }, "admin", db, AGORA)).ok, true);
  assert.equal((await prepararEmail({ evento: "lembrete_pagamento", joiner_cog: "ana" }, "admin", db, AGORA)).status, 409);
  const sem = criarDb({ pend: [{ ceg: "X", nome_do_item: "I", valor_item: 10, frete_inter: 0, taxa_rf: 0, pago_item: true, pago_frete: true, pago_rf: true }] });
  assert.equal((await prepararEmail({ evento: "lembrete_pagamento", joiner_cog: "ana" }, "admin", sem.db, AGORA)).status, 409);
});
test("destinatário inválido, ausente ou ambíguo: não envia", async () => {
  for (const cog of ["sem", "dup", "ruim", "naoexiste"]) {
    const { db } = criarDb({ demandas: [{ id: 9, joiner_cog: cog, status: "em_analise", created_at: minutosAtras(1), valor_total: 1, itens: [], motivo_rejeicao: null }] });
    const r = await prepararEmail({ evento: "comprovante_recebido", demanda_id: 9 }, "anonimo", db, AGORA, LEGADO);
    assert.equal(r.ok, false, cog); assert.equal(r.status, 422, cog);
  }
});
test("limites: por destinatário por hora e global por dia", async () => {
  const hora = Array.from({ length: LIMITES.porDestinatarioPorHora }, (_, i) => ({ evento: "x", referencia: "r" + i, destinatario: "ana@exemplo.com", em: minutosAtras(10) }));
  const a = criarDb({ envios: hora });
  assert.equal((await prepararEmail({ evento: "comprovante_recebido", demanda_id: 101 }, "anonimo", a.db, AGORA, LEGADO)).status, 429);
  const dia = Array.from({ length: LIMITES.globalPorDia }, (_, i) => ({ evento: "x", referencia: "g" + i, destinatario: "outro" + i + "@e.com", em: minutosAtras(600) }));
  const b = criarDb({ envios: dia });
  assert.equal((await prepararEmail({ evento: "comprovante_recebido", demanda_id: 101 }, "anonimo", b.db, AGORA, LEGADO)).status, 429);
});
test("evento desconhecido ou entrada estranha", async () => {
  const { db } = criarDb();
  for (const x of [null, undefined, "texto", [], { evento: "qualquer" }, { evento: 7 }, { evento: "__proto__" }, { evento: "toString" }]) assert.equal((await prepararEmail(x, "admin", db, AGORA)).ok, false);
});

test("push: só administradora/serviço; endpoint só de serviços de push conhecidos; url só relativa; textos limitados", () => {
  const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "k", auth: "a" } };
  assert.equal(validarPush({ subscription: sub, title: "t", body: "b", url: "/" }, "anonimo").status, 401);
  const ok = validarPush({ subscription: sub, title: "T".repeat(500), body: "B".repeat(900), url: "//evil.com" }, "admin");
  assert.equal(ok.ok, true); assert.equal(ok.dados!.title.length, 80); assert.equal(ok.dados!.body.length, 300); assert.equal(ok.dados!.url, "/");
  assert.equal(validarPush({ subscription: sub, title: "t", body: "b", url: "/masterlist" }, "servico").dados!.url, "/masterlist");
  for (const ep of ["http://fcm.googleapis.com/x", "https://evil.com/x", "https://fcm.googleapis.com.evil.com/x", "https://user:pw@fcm.googleapis.com/x", "https://169.254.169.254/latest", "ftp://x", "not a url", ""]) {
    assert.equal(endpointPushValido(ep), false, ep);
    assert.equal(validarPush({ subscription: { ...sub, endpoint: ep }, title: "t", body: "b" }, "admin").status, 400, ep);
  }
  for (const ep of ["https://updates.push.services.mozilla.com/wpush/v2/x", "https://wns2-par02p.notify.windows.com/w/?token=x", "https://web.push.apple.com/abc"]) assert.equal(endpointPushValido(ep), true, ep);
});

test("identificarQuem: chave de serviço, administradora e anônimo", async () => {
  const ehAdmin = async (t: string) => t === "jwt-admin";
  assert.equal(await identificarQuem(null, "SERVICO", ehAdmin), "anonimo");
  assert.equal(await identificarQuem("Bearer SERVICO", "SERVICO", ehAdmin), "servico");
  assert.equal(await identificarQuem("bearer jwt-admin", "SERVICO", ehAdmin), "admin");
  assert.equal(await identificarQuem("Bearer chave-anonima-publica", "SERVICO", ehAdmin), "anonimo");
  assert.equal(await identificarQuem("Bearer SERVIC0", "SERVICO", ehAdmin), "anonimo");
  assert.equal(await identificarQuem("Bearer ", "SERVICO", ehAdmin), "anonimo");
  assert.equal(await identificarQuem("Bearer x", "", async () => { throw new Error("falha"); }), "anonimo");
  assert.equal(await identificarQuem("Bearer ", "", ehAdmin), "anonimo");
});
test("escapeHtml", () => { assert.equal(escapeHtml(`<a href="x" onclick='y'>&`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;"); assert.equal(escapeHtml(null), ""); });

test("depois do lançamento (modo legado desligado) o anônimo NÃO aciona nem o comprovante recebido", async () => {
  const { db } = criarDb();
  const r = await prepararEmail({ evento: "comprovante_recebido", demanda_id: 101 }, "anonimo", db, AGORA, { permitirAnonimo: false });
  assert.equal(r.ok, false); assert.equal(r.status, 401);
  assert.equal((await prepararEmail({ evento: "comprovante_recebido", demanda_id: 101 }, "anonimo", db, AGORA)).status, 401); // padrão: sem contexto = não permite
});
test("joiner logada: só dispara o aviso da PRÓPRIA demanda, nunca a de outra pessoa", async () => {
  const outra = criarDb({ demandas: [{ id: 50, joiner_cog: "bia", status: "em_analise", created_at: minutosAtras(1), valor_total: 1, itens: [], motivo_rejeicao: null }], joiners: [{ cog: "bia", nome: "Bia", email: "bia@e.com" }, { cog: "ana", nome: "Ana", email: "ana@e.com" }] });
  const negado = await prepararEmail({ evento: "comprovante_recebido", demanda_id: 50 }, "joiner", outra.db, AGORA, { cogConta: "ana", permitirAnonimo: false });
  assert.equal(negado.ok, false); assert.equal(negado.status, 403);
  assert.equal(outra.estado.envios.length, 0);                 // nada foi registrado nem enviado
  const propria = await prepararEmail({ evento: "comprovante_recebido", demanda_id: 50 }, "joiner", outra.db, AGORA, { cogConta: "BIA", permitirAnonimo: false });
  assert.equal(propria.ok, true); assert.equal(propria.para, "bia@e.com");
});
test("joiner logada NÃO aciona eventos de administração", async () => {
  const { db } = criarDb();
  for (const ev of [{ evento: "comprovante_recusado", demanda_id: 101 }, { evento: "report_resolvido", report_id: 7 }, { evento: "lembrete_pagamento", joiner_cog: "ana" }]) {
    assert.equal((await prepararEmail(ev, "joiner", db, AGORA, { cogConta: "ana" })).status, 403);
  }
});
test("identificarChamada: serviço, administradora, joiner com conta, e anônimo (inclusive token de quem não tem conta ativada)", async () => {
  const resolver = async (t: string) => t === "jwt-admin" ? { admin: true, cog: null } : t === "jwt-ana" ? { admin: false, cog: "ana" } : t === "jwt-sem-conta" ? { admin: false, cog: null } : (() => { throw new Error("inválido"); })();
  assert.deepEqual(await identificarChamada("Bearer SERVICO", "SERVICO", resolver), { quem: "servico", cogConta: null });
  assert.deepEqual(await identificarChamada("Bearer jwt-admin", "SERVICO", resolver), { quem: "admin", cogConta: null });
  assert.deepEqual(await identificarChamada("Bearer jwt-ana", "SERVICO", resolver), { quem: "joiner", cogConta: "ana" });
  assert.deepEqual(await identificarChamada("Bearer jwt-sem-conta", "SERVICO", resolver), { quem: "anonimo", cogConta: null });
  assert.deepEqual(await identificarChamada("Bearer lixo", "SERVICO", resolver), { quem: "anonimo", cogConta: null });
  assert.deepEqual(await identificarChamada(null, "SERVICO", resolver), { quem: "anonimo", cogConta: null });
});
