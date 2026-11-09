// Testes do pedido de comprovação de cadastro (J14), SEM rede: banco simulado; nenhum e-mail ou código existe neste fluxo.
// Rodar: node --test supabase/functions/_shared/comprovar.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { processarPedidoComprovacao, tratarPedidoComprovacao, LIMITES_COMPROVAR, DETALHE_MIN } from "./comprovar.ts";
import type { DbComprovar } from "./comprovar.ts";
import type { JoinerAtivacao } from "./ativacao.ts";

const AGORA = new Date("2026-11-09T15:00:00Z");
const DETALHE = "Paguei o pedido da Smol em outubro, comprovante de R$ 120 pelo mesmo @.";
const JOINERS: JoinerAtivacao[] = [
  { id: 1, cog: "ana", email: "ana@exemplo.com", bloqueado: false }, { id: 2, cog: "bloq", email: "bloq@exemplo.com", bloqueado: true },
  { id: 3, cog: "sem", email: null, bloqueado: false }, { id: 4, cog: "Ela", email: "ela@exemplo.com", bloqueado: false }, { id: 5, cog: "ela", email: "ela2@exemplo.com", bloqueado: false },
];
function montar(o: { usados?: Record<string, number>; erro?: string } = {}) {
  const usados = { ...(o.usados ?? {}) }; const abertos: { id: number; email: string; detalhe: string }[] = [];
  const db: DbComprovar = {
    contar: async c => usados[c] ?? 0, registrar: async c => { usados[c] = (usados[c] ?? 0) + 1; },
    joinersPorCog: async cog => JOINERS.filter(j => j.cog.toLowerCase() === cog.toLowerCase()),
    abrirComprovacao: async (id, email, detalhe) => { if (o.erro) throw new Error(o.erro); abertos.push({ id, email, detalhe }); return abertos.length; },
  };
  return { db, abertos, usados };
}
const pedir = (m: ReturnType<typeof montar>, c: Record<string, unknown>, ip = "1.1.1.1") => processarPedidoComprovacao({ detalhe: DETALHE, ...c }, ip, m.db, AGORA);

test("quem acerta o par abre um pedido; o texto vai como está (sem HTML interpretado) e a resposta não tem código nem e-mail", async () => {
  const m = montar(); const r = await pedir(m, { cog: "@Ana", email: " ANA@exemplo.com ", detalhe: "  <b>Paguei</b> o pedido em outubro; comprovante pelo mesmo @.  " });
  assert.deepEqual(r, { status: 200, corpo: { ok: true, etapa: "pedido_recebido" } });
  assert.deepEqual(m.abertos, [{ id: 1, email: "ana@exemplo.com", detalhe: "<b>Paguei</b> o pedido em outubro; comprovante pelo mesmo @." }]);
});

test("par errado, @ inexistente, ambíguo (Ela/ela) ou sem e-mail: MESMA resposta e NENHUM pedido", async () => {
  const casos = [{ cog: "naoexiste", email: "x@exemplo.com" }, { cog: "ana", email: "outra@exemplo.com" }, { cog: "sem", email: "qualquer@exemplo.com" }, { cog: "ela", email: "ela@exemplo.com" }];
  const feliz = await pedir(montar(), { cog: "ana", email: "ana@exemplo.com" });
  for (const c of casos) { const m = montar(); const r = await pedir(m, c); assert.deepEqual(r, feliz, c.cog); assert.equal(m.abertos.length, 0); }
});

test("quem acertou o par e não pode seguir recebe o próximo passo", async () => {
  const casos: [Record<string, unknown>, string, string?][] = [
    [{ cog: "bloq", email: "bloq@exemplo.com" }, "ajuda"], [{ cog: "ana", email: "ana@exemplo.com" }, "pedir_codigo", "nao_precisa"], [{ cog: "ana", email: "ana@exemplo.com" }, "entrar", "conta_ativa"],
    [{ cog: "ana", email: "ana@exemplo.com" }, "limite_diario", "limite_diario"], [{ cog: "ana", email: "ana@exemplo.com" }, "ajuda", "email_compartilhado"], [{ cog: "ana", email: "ana@exemplo.com" }, "ajuda", "sem_email_valido"],
    [{ cog: "ana", email: "ana@exemplo.com" }, "pedido_recebido", "falha qualquer do banco"],
  ];
  for (const [c, esperado, erro] of casos) { const m = montar({ erro }); const r = await pedir(m, c); assert.deepEqual(r.corpo, { ok: true, etapa: esperado }, `${c.cog}/${erro}`); assert.equal(m.abertos.length, 0); }
});

test("descrição obrigatória (mín. 20, máx. 500), chaves extras e via de DM NÃO existem", async () => {
  const m = montar();
  assert.equal((await pedir(m, { cog: "ana", email: "ana@exemplo.com", detalhe: "curto" })).status, 400);
  assert.equal((await pedir(m, { cog: "ana", email: "ana@exemplo.com", detalhe: "x".repeat(DETALHE_MIN - 1) })).status, 400);
  assert.equal((await pedir(m, { cog: "ana", email: "ana@exemplo.com", detalhe: "y".repeat(501) })).status, 400);
  assert.equal((await pedir(m, { cog: "ana", email: "ana@exemplo.com", detalhe: "z".repeat(500) })).status, 200);
  assert.equal((await pedir(m, { cog: "ana", email: "ana@exemplo.com", via: "perfil_conhecido" })).status, 400, "a via do perfil não é oferecida");
  assert.equal((await pedir(m, { cog: "ana", email: "ana@exemplo.com", desafio: "ABCD-EFGH" })).status, 400);
  assert.equal((await pedir(m, { cog: "", email: "ana@exemplo.com" })).status, 400);
  assert.equal((await pedir(m, { cog: "ana", email: "sem-arroba" })).status, 400);
  assert.equal((await processarPedidoComprovacao(null, "1.1.1.1", m.db, AGORA)).status, 400);
});

test("limites por rede, @ e e-mail (toda tentativa conta, acerte ou não)", async () => {
  for (const [chave, n] of [["comp-ip:1.1.1.1", LIMITES_COMPROVAR.porIpPorHora], ["comp-cog:ana", LIMITES_COMPROVAR.porCogPorHora], ["comp-email:ana@exemplo.com", LIMITES_COMPROVAR.porEmailPorHora]] as const) {
    const m = montar({ usados: { [chave]: n } }); const r = await pedir(m, { cog: "ana", email: "ana@exemplo.com" }); assert.equal(r.status, 429, chave); assert.equal(m.abertos.length, 0);
  }
  const m = montar(); await pedir(m, { cog: "naoexiste", email: "x@exemplo.com" });
  assert.equal(m.usados["comp-cog:naoexiste"], 1, "mesmo para @ que não existe");
});

test("HTTP: 405, 200 neutro em erro interno, CORS", async () => {
  const m = montar(); const deps = { env: () => undefined, db: () => m.db, agora: () => AGORA };
  assert.equal((await tratarPedidoComprovacao(new Request("https://x.test", { method: "GET" }), deps, "1.1.1.1")).status, 405);
  const op = await tratarPedidoComprovacao(new Request("https://x.test", { method: "OPTIONS", headers: { origin: "https://anticeg.vercel.app" } }), deps, "1.1.1.1");
  assert.equal(op.headers.get("access-control-allow-origin"), "https://anticeg.vercel.app");
  const ok = await tratarPedidoComprovacao(new Request("https://x.test", { method: "POST", body: JSON.stringify({ cog: "ana", email: "ana@exemplo.com", detalhe: DETALHE }) }), deps, "1.1.1.1");
  assert.deepEqual(await ok.json(), { ok: true, etapa: "pedido_recebido" }); assert.equal(m.abertos.length, 1);
});
