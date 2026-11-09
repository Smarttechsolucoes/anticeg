// Testes das claims só com @ (J20), SEM rede: banco simulado; nenhuma claim é registrada de verdade.
// Rodar: node --test supabase/functions/_shared/claims.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { processarClaim, tratarClaim, LIMITES_CLAIM } from "./claims.ts";
import type { DbClaim } from "./claims.ts";

const AGORA = new Date("2026-11-09T20:00:00Z");
function montar(o: { usados?: Record<string, number>; conta?: Record<string, string>; resposta?: unknown; erro?: boolean } = {}) {
  const usados = { ...(o.usados ?? {}) }; const chamadas: { cog: string; evento: number; pedidos: Record<string, number> }[] = [];
  const db: DbClaim = {
    contar: async c => usados[c] ?? 0, registrar: async c => { usados[c] = (usados[c] ?? 0) + 1; },
    cogDaConta: async t => (o.conta ?? {})[t] ?? null,
    enviar: async (cog, evento, pedidos) => { chamadas.push({ cog, evento, pedidos }); if (o.erro) throw new Error("falha do banco"); return o.resposta ?? { ok: true, ot8: false, gravados: 1, standby: [], falhas: [] }; },
  };
  return { db, usados, chamadas };
}
const pedir = (m: ReturnType<typeof montar>, corpo: unknown, token: string | null = null, ip = "1.1.1.1") => processarClaim(corpo, token, ip, m.db, AGORA);

test("SEM login e SEM cadastro: o @ informado basta; a claim é enviada ao banco com esse @ (sem @, minúsculas), sem criar nada", async () => {
  const m = montar(); const r = await pedir(m, { cog: "@Pessoa.Nova", evento: 7, pedidos: { Han: 1, Felix: 2 } });
  assert.equal(r.status, 200); assert.deepEqual({ ...r.corpo, conta: undefined }, { ok: true, ot8: false, gravados: 1, standby: [], falhas: [], conta: undefined }); assert.equal(r.corpo.conta, false);
  assert.deepEqual(m.chamadas, [{ cog: "pessoa.nova", evento: 7, pedidos: { Han: 1, Felix: 2 } }]);
});

test("LOGADA: usa o @ da PRÓPRIA conta e IGNORA o @ do pedido (a sessão não serve para claimar em nome de outra pessoa)", async () => {
  const m = montar({ conta: { "token-ana": "Ana" } });
  const r = await pedir(m, { cog: "outra_pessoa", evento: 3, pedidos: { Han: 1 } }, "token-ana");
  assert.equal(r.corpo.conta, true); assert.equal(m.chamadas[0].cog, "Ana"); assert.equal(JSON.stringify(m.chamadas).includes("outra_pessoa"), false);
  const sem = await pedir(montar({ conta: { "token-ana": "Ana" } }), { evento: 3, pedidos: { Han: 1 } }, "token-ana"); assert.equal(sem.status, 200, "logada nem precisa informar o @");
});

test("token que NÃO é de uma conta (a chave pública do site) cai no caminho do @ informado", async () => {
  const m = montar({ conta: {} }); await pedir(m, { cog: "visitante", evento: 1, pedidos: { Han: 1 } }, "chave-publica-do-site");
  assert.equal(m.chamadas[0].cog, "visitante");
  const semCog = await pedir(m, { evento: 1, pedidos: { Han: 1 } }, "chave-publica-do-site"); assert.deepEqual(semCog.corpo, { ok: false, motivo: "cog_invalido" }); assert.equal(m.chamadas.length, 1);
});

test("@ inválido: recusado antes de chegar ao banco", async () => {
  for (const cog of ["", "   ", "@@", "a b", "x@y", "a".repeat(65), 5, null]) { const m = montar(); const r = await pedir(m, { cog, evento: 1, pedidos: { Han: 1 } }); assert.equal(r.corpo.motivo, "cog_invalido", String(cog)); assert.equal(m.chamadas.length, 0); }
});

test("a resposta do banco é repassada (motivos de recusa, standby, OT8, falhas) e nada além disso", async () => {
  for (const resposta of [{ ok: false, motivo: "bloqueada" }, { ok: false, motivo: "sem_vaga", falhas: ["Han"] }, { ok: true, ot8: true, gravados: 8, standby: [], falhas: [] }, { ok: true, ot8: false, gravados: 2, standby: ["Han"], falhas: [], interno: "segredo" }]) {
    const r = await pedir(montar({ resposta }), { cog: "x", evento: 1, pedidos: { Han: 1 } });
    assert.equal(r.status, 200); assert.equal(r.corpo.ok, (resposta as { ok: boolean }).ok); assert.equal("interno" in r.corpo, false);
    if ("motivo" in resposta) assert.equal(r.corpo.motivo, (resposta as { motivo: string }).motivo);
  }
});

test("validação do pedido: chaves extras, evento, quantidades e tamanho", async () => {
  const m = montar();
  for (const c of [null, [], { cog: "x", evento: 1 }, { cog: "x", evento: "1", pedidos: { Han: 1 } }, { cog: "x", evento: 0, pedidos: { Han: 1 } }, { cog: "x", evento: 1.5, pedidos: { Han: 1 } }, { cog: "x", evento: 1, pedidos: {} },
    { cog: "x", evento: 1, pedidos: { Han: "1" } }, { cog: "x", evento: 1, pedidos: { Han: -1 } }, { cog: "x", evento: 1, pedidos: { Han: 51 } }, { cog: "x", evento: 1, pedidos: [1] }, { cog: "x", evento: 1, pedidos: { Han: 1 }, extra: true },
    { cog: "x", evento: 1, pedidos: Object.fromEntries(Array.from({ length: LIMITES_CLAIM.maxMembros + 1 }, (_, i) => ["m" + i, 1])) }, { cog: "x", evento: 1, pedidos: { ["a".repeat(61)]: 1 } }]) assert.equal((await pedir(m, c)).status, 400, JSON.stringify(c).slice(0, 60));
  assert.equal(m.chamadas.length, 0);
  assert.deepEqual((await pedir(m, { cog: "x", evento: 1, pedidos: { Han: 0 } })).corpo, { ok: false, motivo: "pedido_vazio" });
});

test("limites por rede e por @ (toda tentativa conta); a conta logada também conta pelo @ dela", async () => {
  for (const [chave, n] of [["claim-ip:1.1.1.1", LIMITES_CLAIM.porIpPorHora], ["claim-cog:fulana", LIMITES_CLAIM.porCogPorHora]] as const) { const m = montar({ usados: { [chave]: n } }); const r = await pedir(m, { cog: "Fulana", evento: 1, pedidos: { Han: 1 } }); assert.equal(r.status, 429, chave); assert.equal(m.chamadas.length, 0); }
  const m = montar({ conta: { t: "Ana" } }); await pedir(m, { evento: 1, pedidos: { Han: 1 } }, "t"); assert.equal(m.usados["claim-cog:ana"], 1);
  const n = montar(); await pedir(n, { cog: "Nao.Existe", evento: 1, pedidos: { Han: 1 } }); assert.equal(n.usados["claim-cog:nao.existe"], 1, "conta também para @ que não existe");
});

test("falha do banco: 502 genérico, sem detalhe", async () => {
  const r = await pedir(montar({ erro: true }), { cog: "x", evento: 1, pedidos: { Han: 1 } }); assert.equal(r.status, 502); assert.equal(JSON.stringify(r.corpo).includes("falha do banco"), false);
  assert.equal((await pedir(montar({ resposta: "texto" }), { cog: "x", evento: 1, pedidos: { Han: 1 } })).status, 502);
});

test("HTTP: 405, CORS, token Bearer repassado, JSON inválido = 400", async () => {
  const m = montar({ conta: { abc: "Ana" } }); const deps = { env: () => undefined, db: () => m.db, agora: () => AGORA };
  assert.equal((await tratarClaim(new Request("https://x.test", { method: "GET" }), deps, "1.1.1.1")).status, 405);
  assert.equal((await tratarClaim(new Request("https://x.test", { method: "OPTIONS", headers: { origin: "https://anticeg.vercel.app" } }), deps, "1.1.1.1")).headers.get("access-control-allow-origin"), "https://anticeg.vercel.app");
  assert.equal((await tratarClaim(new Request("https://x.test", { method: "POST", body: "nao json" }), deps, "1.1.1.1")).status, 400);
  const ok = await tratarClaim(new Request("https://x.test", { method: "POST", headers: { authorization: "Bearer abc" }, body: JSON.stringify({ evento: 2, pedidos: { Han: 1 } }) }), deps, "1.1.1.1");
  assert.equal(ok.status, 200); assert.equal(m.chamadas[0].cog, "Ana"); assert.equal((await ok.json()).conta, true);
});
