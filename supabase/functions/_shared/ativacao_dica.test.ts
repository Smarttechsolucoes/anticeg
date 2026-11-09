// Testes da "dica" mascarada do e-mail na ativação (PROPOSTA, não publicada). Sem rede: banco simulado.
// Rodar: node --test supabase/functions/_shared/ativacao_dica.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { mascararEmail, dicaFalsa, processarPedidoDica, tratarPedidoDica, LIMITES_DICA } from "./ativacao_dica.ts";
import type { DbDica } from "./ativacao_dica.ts";
import type { JoinerAtivacao } from "./ativacao_dica.ts";

const AGORA = new Date("2026-11-09T12:00:00Z");
const SEGREDO = "segredo-de-teste-com-mais-de-16-caracteres";
const JOINERS: JoinerAtivacao[] = [
  { id: 1, cog: "ana", email: "ana.souza@gmail.com", bloqueado: false },
  { id: 2, cog: "bloq", email: "bloq@hotmail.com", bloqueado: true },
  { id: 3, cog: "Ela", email: "ela@gmail.com", bloqueado: false }, { id: 4, cog: "ela", email: "outra@gmail.com", bloqueado: false },   // ambíguo
  { id: 5, cog: "semmail", email: null, bloqueado: false },
  { id: 6, cog: "ruim", email: "isso-nao-e-email", bloqueado: false },
  { id: 7, cog: "casal1", email: "casal@uol.com.br", bloqueado: false }, { id: 8, cog: "casal2", email: "casal@uol.com.br", bloqueado: false },   // e-mail compartilhado
  { id: 9, cog: "jaativa", email: "jaativa@outlook.com", bloqueado: false },
];
function banco(extra: Partial<DbDica> = {}) {
  const regs: { chave: string; em: Date }[] = [];
  const db: DbDica = {
    contar: async (chave, desdeIso) => regs.filter(r => r.chave === chave && r.em.toISOString() >= desdeIso).length,
    registrar: async (chave) => { regs.push({ chave, em: AGORA }); },
    joinersPorCog: async (cog) => JOINERS.filter(j => j.cog.toLowerCase().includes(cog)),
    ...extra,
  };
  return { db, regs };
}
const FORMATO = /^[a-z0-9]•••@[a-z]•••\.[a-z.]+$/;

test("máscara: 1ª letra do usuário, 1ª letra do provedor e o final; sempre 3 pontos (não revela o tamanho)", () => {
  assert.equal(mascararEmail("maria.souza@gmail.com"), "m•••@g•••.com");
  assert.equal(mascararEmail("a@gmail.com"), "a•••@g•••.com");
  assert.equal(mascararEmail("UmEmailMuitoMuitoLongoDeVerdade@uol.com.br"), "u•••@u•••.com.br");
  assert.equal(mascararEmail("x@y.com").length, mascararEmail("xxxxxxxxxxxxxxxxxxxxxxxxxx@yyyyyyyyyyyy.com").length, "o tamanho do e-mail não aparece");
  for (const ruim of [null, undefined, "", "   ", "sem-arroba", "a@b", "@x.com", 123]) assert.equal(mascararEmail(ruim), null, String(ruim));
});

test("a dica real NÃO contém o usuário nem o domínio inteiros", () => {
  const m = mascararEmail("ana.souza@gmail.com")!;
  for (const parte of ["ana.souza", "souza", "ana", "gmail", "ail"]) assert.ok(!m.includes(parte), parte);
});

test("dica falsa: estável para o mesmo @ e segredo, muda com o segredo, tem o mesmo formato da real", async () => {
  const a1 = await dicaFalsa("fulano", SEGREDO), a2 = await dicaFalsa("fulano", SEGREDO), b = await dicaFalsa("fulano", SEGREDO + "x");
  assert.equal(a1, a2);
  const varias = new Set<string>(); let difere = 0;
  for (let i = 0; i < 200; i++) { const d = await dicaFalsa("p" + i, SEGREDO); assert.match(d, FORMATO); varias.add(d); if (d !== await dicaFalsa("p" + i, SEGREDO + "x")) difere++; }
  assert.ok(varias.size > 40, "há variedade");
  assert.ok(difere > 150, "sem o segredo não dá para prever (" + difere + " de 200 mudaram)");
  assert.match(a1, FORMATO); assert.match(b, FORMATO);
});

test("a resposta tem SEMPRE a mesma forma: existente, inexistente, ambíguo, bloqueado, sem e-mail, e-mail inválido, compartilhado", async () => {
  for (const cog of ["ana", "naoexiste", "ela", "bloq", "semmail", "ruim", "casal1", "jaativa"]) {
    const { db } = banco();
    const r = await processarPedidoDica({ cog }, "1.1.1.1", db, SEGREDO, AGORA);
    assert.equal(r.status, 200, cog);
    assert.deepEqual(Object.keys(r.corpo).sort(), ["dica", "ok"], cog);
    assert.equal(r.corpo.ok, true);
    assert.match(String(r.corpo.dica), FORMATO, cog);
  }
});

test("quem existe recebe a dica real; quem não dá dica real recebe a falsa estável (igual em consultas repetidas)", async () => {
  const { db } = banco();
  assert.equal((await processarPedidoDica({ cog: "ana" }, "1.1.1.1", db, SEGREDO, AGORA)).corpo.dica, "a•••@g•••.com");
  assert.equal((await processarPedidoDica({ cog: "@Bloq" }, "1.1.1.2", db, SEGREDO, AGORA)).corpo.dica, "b•••@h•••.com", "bloqueado também recebe a dica real: o estado não é revelado");
  const x1 = (await processarPedidoDica({ cog: "naoexiste" }, "1.1.1.3", db, SEGREDO, AGORA)).corpo.dica;
  const x2 = (await processarPedidoDica({ cog: "NAOEXISTE" }, "1.1.1.4", db, SEGREDO, AGORA)).corpo.dica;
  assert.equal(x1, x2, "a mesma pergunta devolve a mesma dica (não dá para distinguir por repetição)");
  assert.equal((await processarPedidoDica({ cog: "ela" }, "1.1.1.5", db, SEGREDO, AGORA)).corpo.dica, await dicaFalsa("ela", SEGREDO), "@ ambíguo cai na falsa");
});

test("a resposta nunca devolve o e-mail completo, o id ou o estado da conta", async () => {
  const { db } = banco();
  for (const cog of ["ana", "jaativa", "casal1"]) {
    const txt = JSON.stringify((await processarPedidoDica({ cog }, "2.2.2.2", db, SEGREDO, AGORA)).corpo);
    assert.ok(!/@(gmail|hotmail|uol|outlook)/.test(txt) && !txt.includes("ana.souza") && !/"id"|bloqueado|conta|liberad/.test(txt), txt);
  }
});

test("limite por rede (por hora): a partir de %d consultas, 429 genérico; toda consulta conta (mesmo sem achar)".replace("%d", String(LIMITES_DICA.porIpPorHora)), async () => {
  const { db, regs } = banco();
  for (let i = 0; i < LIMITES_DICA.porIpPorHora; i++) assert.equal((await processarPedidoDica({ cog: "nao" + i }, "3.3.3.3", db, SEGREDO, AGORA)).status, 200);
  const r = await processarPedidoDica({ cog: "ana" }, "3.3.3.3", db, SEGREDO, AGORA);
  assert.equal(r.status, 429); assert.deepEqual(Object.keys(r.corpo), ["error"]);
  assert.ok(regs.filter(x => x.chave === "dica-ip:3.3.3.3").length === LIMITES_DICA.porIpPorHora, "consultas que não acharam nada também foram contadas");
  assert.equal((await processarPedidoDica({ cog: "ana" }, "9.9.9.9", db, SEGREDO, AGORA)).status, 200, "outra rede não é afetada");
});

test("limite por @ (por hora): redes diferentes consultando o MESMO @ também esbarram", async () => {
  const { db } = banco();
  for (let i = 0; i < LIMITES_DICA.porCogPorHora; i++) assert.equal((await processarPedidoDica({ cog: "ana" }, "10.0.0." + i, db, SEGREDO, AGORA)).status, 200);
  assert.equal((await processarPedidoDica({ cog: "ana" }, "10.0.0.99", db, SEGREDO, AGORA)).status, 429);
});

test("teto por dia por rede, mesmo respeitando o limite por hora", async () => {
  const { db, regs } = banco();
  const ip = "4.4.4.4"; const dia = new Date(AGORA.getTime() - 3 * 3600000);
  for (let i = 0; i < LIMITES_DICA.porIpPorDia; i++) regs.push({ chave: `dica-ip:${ip}`, em: dia });   // consultas de 3 h atrás
  assert.equal((await processarPedidoDica({ cog: "ana" }, ip, db, SEGREDO, AGORA)).status, 429);
});

test("entrada inválida: 400 genérico (campo extra, @ vazio, espaço, tamanho)", async () => {
  const { db } = banco();
  for (const e of [null, [], "x", {}, { cog: "" }, { cog: "a b" }, { cog: "x".repeat(65) }, { cog: "ana", email: "a@b.com" }, { cog: "a\u0001b" }])
    assert.equal((await processarPedidoDica(e, "5.5.5.5", db, SEGREDO, AGORA)).status, 400, JSON.stringify(e));
});

test("erro do banco na consulta: ainda responde com a forma padrão (dica falsa), sem vazar o erro", async () => {
  const { db } = banco({ joinersPorCog: async () => { throw new Error("falha interna secreta"); } });
  const r = await processarPedidoDica({ cog: "ana" }, "6.6.6.6", db, SEGREDO, AGORA);
  assert.equal(r.status, 200); assert.match(String(r.corpo.dica), FORMATO); assert.ok(!JSON.stringify(r.corpo).includes("secreta"));
});

test("HTTP: só POST, CORS só para as origens permitidas, sem segredo configurado a função NÃO responde, sem cache", async () => {
  const { db } = banco();
  const deps = (env: Record<string, string>) => ({ env: (n: string) => env[n], db: () => db, agora: () => AGORA });
  const req = (m: string, corpo?: unknown, origin = "https://anticeg.vercel.app") => new Request("https://x.test/f", { method: m, headers: { origin, "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  assert.equal((await tratarPedidoDica(req("GET"), deps({ DICA_SEGREDO: SEGREDO }), "7.7.7.7")).status, 405);
  assert.equal((await tratarPedidoDica(req("POST", { cog: "ana" }), deps({}), "7.7.7.7")).status, 503, "sem segredo: não cai em dica previsível");
  assert.equal((await tratarPedidoDica(req("POST", { cog: "ana" }), deps({ DICA_SEGREDO: "curto" }), "7.7.7.7")).status, 503);
  const ok = await tratarPedidoDica(req("POST", { cog: "ana" }), deps({ DICA_SEGREDO: SEGREDO }), "7.7.7.7");
  assert.equal(ok.status, 200); assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.notEqual(ok.headers.get("access-control-allow-origin"), "https://site-estranho.example");
  const estranha = await tratarPedidoDica(req("POST", { cog: "ana" }, "https://site-estranho.example"), deps({ DICA_SEGREDO: SEGREDO }), "7.7.7.8");
  assert.notEqual(estranha.headers.get("access-control-allow-origin"), "https://site-estranho.example");
});
