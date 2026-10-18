// Testes do autoatendimento do Envio Nacional (sem rede, sem banco, sem e-mail real).
import test from "node:test";
import assert from "node:assert/strict";
import { tratarEnvioAcesso, normalizarCog, codigoAleatorio, hmacHex, MENSAGEM_PEDIDO, MENSAGEM_ERRO_CODIGO, corpoEmailCodigo } from "./envioAcesso.ts";
import type { DepsEnvioAcesso } from "./envioAcesso.ts";

function fazDeps(sobrescrever: Partial<DepsEnvioAcesso> = {}) {
  const chamadas = { emitir: [] as unknown[][], validar: [] as unknown[][], emails: [] as unknown[][] };
  const deps: DepsEnvioAcesso = {
    env: (n) => ({ SUPABASE_SERVICE_ROLE_KEY: "segredo-de-teste" } as Record<string, string>)[n],
    emitir: async (...a) => { chamadas.emitir.push(a); return "dona@exemplo.com"; },
    validar: async (...a) => { chamadas.validar.push(a); return "a".repeat(48); },
    enviarEmail: async (...a) => { chamadas.emails.push(a); },
    aleatorio: () => "123456",
    ...sobrescrever,
  };
  return { deps, chamadas };
}
const pedido = (corpo: unknown, extras: Record<string, string> = {}, metodo = "POST") =>
  new Request("https://x/functions/v1/envio-acesso", { method: metodo, headers: { "content-type": "application/json", origin: "https://anticeg.vercel.app", "x-forwarded-for": "203.0.113.7", ...extras }, body: metodo === "POST" ? JSON.stringify(corpo) : undefined });

test("normalizarCog: aceita o @ digitado de várias formas e recusa lixo", () => {
  assert.equal(normalizarCog("@Fulana_X "), "Fulana_X");
  assert.equal(normalizarCog("soobinwalls (twitter)"), "soobinwalls (twitter)");
  for (const x of ["", "   ", null, 5, "a".repeat(61), "x;drop", "a/b", "<b>"]) assert.equal(normalizarCog(x), null);
});
test("codigoAleatorio: 6 dígitos", () => { for (let i = 0; i < 200; i++) assert.match(codigoAleatorio(), /^\d{6}$/); });

test("pedir: o banco recebe só o HASH do código e o IP em hash; o e-mail leva o código; a resposta é neutra", async () => {
  const { deps, chamadas } = fazDeps();
  const r = await tratarEnvioAcesso(pedido({ acao: "pedir", cog: "@Ana" }), deps);
  assert.equal(r.status, 200);
  const corpo = await r.json();
  assert.deepEqual(corpo, { ok: true, mensagem: MENSAGEM_PEDIDO });
  const [cog, hash, ipHash] = chamadas.emitir[0] as [string, string, string];
  assert.equal(cog, "Ana"); assert.match(hash, /^[0-9a-f]{64}$/); assert.match(ipHash, /^[0-9a-f]{64}$/);
  assert.equal(hash, await hmacHex("segredo-de-teste", "ana|123456"));
  assert.ok(!JSON.stringify(chamadas.emitir).includes("123456") && !JSON.stringify(chamadas.emitir).includes("203.0.113.7"));
  assert.deepEqual(chamadas.emails[0], ["dona@exemplo.com", "123456"]);
  assert.ok(!JSON.stringify(corpo).includes("dona@exemplo.com") && !JSON.stringify(corpo).includes("123456"));
});
test("pedir: a resposta é IDÊNTICA com @ inexistente, sem e-mail, bloqueado ou limite atingido (nenhum e-mail sai)", async () => {
  const { deps, chamadas } = fazDeps({ emitir: async () => null });
  const r1 = await tratarEnvioAcesso(pedido({ acao: "pedir", cog: "naoexiste" }), deps);
  const { deps: d2 } = fazDeps();
  const r2 = await tratarEnvioAcesso(pedido({ acao: "pedir", cog: "existe" }), d2);
  assert.equal(r1.status, r2.status);
  assert.equal(JSON.stringify(await r1.json()), JSON.stringify(await r2.json()));
  assert.equal(chamadas.emails.length, 0);
});
test("pedir: falha ao enviar o e-mail não vaza erro nem muda a resposta", async () => {
  const { deps } = fazDeps({ enviarEmail: async () => { throw new Error("SendGrid HTTP 401"); } });
  const r = await tratarEnvioAcesso(pedido({ acao: "pedir", cog: "ana" }), deps);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, mensagem: MENSAGEM_PEDIDO });
});
test("pedir: modo seco não envia e-mail; em segundo plano a resposta não espera o envio", async () => {
  const seco = fazDeps({ env: (n) => ({ SUPABASE_SERVICE_ROLE_KEY: "s", ENVIO_CODIGO_MODO_SECO: "true" } as Record<string, string>)[n] });
  await tratarEnvioAcesso(pedido({ acao: "pedir", cog: "ana" }), seco.deps); assert.equal(seco.chamadas.emails.length, 0);
  let segundoPlano = 0; const lento = fazDeps({ enviarEmail: () => new Promise(res => setTimeout(res, 300)), depois: () => { segundoPlano++; } });
  const t0 = Date.now(); await tratarEnvioAcesso(pedido({ acao: "pedir", cog: "ana" }), lento.deps);
  assert.ok(Date.now() - t0 < 200 && segundoPlano === 1, "a resposta não pode esperar o provedor de e-mail");
});
test("validar: código certo devolve o acesso; errado devolve mensagem genérica; formato ruim é 400", async () => {
  const ok = fazDeps(); const r = await tratarEnvioAcesso(pedido({ acao: "validar", cog: "Ana", codigo: "123 456" }), ok.deps);
  assert.deepEqual(await r.json(), { ok: true, token: "a".repeat(48) });
  assert.equal(ok.chamadas.validar[0][1], await hmacHex("segredo-de-teste", "ana|123456"));
  const ruim = fazDeps({ validar: async () => null }); const r2 = await tratarEnvioAcesso(pedido({ acao: "validar", cog: "ana", codigo: "000000" }), ruim.deps);
  assert.deepEqual(await r2.json(), { ok: false, erro: MENSAGEM_ERRO_CODIGO });
  for (const c of ["12345", "1234567", "abcdef", "", 123456]) { const r3 = await tratarEnvioAcesso(pedido({ acao: "validar", cog: "ana", codigo: c }), fazDeps().deps); assert.equal(r3.status, 400); }
});
test("entradas inválidas: método, ação desconhecida, campos extras, @ ausente, corpo que não é objeto", async () => {
  const d = fazDeps().deps;
  assert.equal((await tratarEnvioAcesso(pedido({}, {}, "GET"), d)).status, 405);
  assert.equal((await tratarEnvioAcesso(pedido({ acao: "x", cog: "ana" }), d)).status, 400);
  assert.equal((await tratarEnvioAcesso(pedido({ acao: "pedir", cog: "ana", email: "a@b.c" }), d)).status, 400);
  assert.equal((await tratarEnvioAcesso(pedido({ acao: "pedir" }), d)).status, 400);
  assert.equal((await tratarEnvioAcesso(pedido([1, 2]), d)).status, 400);
});
test("CORS: só as origens do site; OPTIONS responde", async () => {
  const d = fazDeps().deps;
  const ok = await tratarEnvioAcesso(pedido({ acao: "pedir", cog: "ana" }), d); assert.equal(ok.headers.get("access-control-allow-origin"), "https://anticeg.vercel.app");
  const fora = await tratarEnvioAcesso(pedido({ acao: "pedir", cog: "ana" }, { origin: "https://malvado.example" }), d); assert.equal(fora.headers.get("access-control-allow-origin"), null);
  assert.equal((await tratarEnvioAcesso(new Request("https://x", { method: "OPTIONS", headers: { origin: "https://anticeg.vercel.app" } }), d)).status, 200);
});
test("erro do banco vira 500 genérico, sem detalhe", async () => {
  const d = fazDeps({ emitir: async () => { throw new Error("detalhe interno do banco"); } }).deps;
  const r = await tratarEnvioAcesso(pedido({ acao: "pedir", cog: "ana" }), d);
  assert.equal(r.status, 500); assert.ok(!(await r.text()).includes("detalhe"));
});
test("o e-mail do código não contém dado pessoal além do código", () => {
  const { assunto, html } = corpoEmailCodigo("654321");
  assert.ok(html.includes("654321") && assunto.includes("Envio Nacional"));
  assert.ok(!/cpf|telefone|endere/i.test(html));
});
