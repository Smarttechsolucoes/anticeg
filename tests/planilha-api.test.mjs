// Testes do tratamento de resposta do Apps Script. Rodar:  node --test tests/planilha-api.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chamarPlanilha, interpretarResposta, mensagemPlanilha, esperadosConfirmacao } from "../src/planilhaApi.js";

const resp = (obj, { ok = true, status = 200, texto } = {}) => async () => ({ ok, status, text: async () => texto ?? JSON.stringify(obj) });
const chamar = (obj, extra = {}, opts) => chamarPlanilha("confirmar", { itens: [] }, { fetchImpl: resp(obj, opts), ...extra });

test("sucesso: versão nova e versão antiga do script", async () => {
  const nova = await chamar({ ok: true, updated: 2, nao_processados: [], sync: true }, { esperados: 2 });
  assert.equal(nova.ok, true); assert.equal(nova.estado, "sucesso"); assert.equal(nova.sincronizacaoPendente, false);
  const antiga = await chamar({ ok: true, acao: "confirmar", updated: 2 }, { esperados: 2 });
  assert.equal(antiga.ok, true);
  const umaLinha = await chamarPlanilha("recebido", { id_linha: "A-1" }, { fetchImpl: resp({ ok: true, linha: 7 }) });
  assert.equal(umaLinha.ok, true);
});

test("ID ambíguo (uma linha): recusado, identifica as linhas, NÃO é sucesso", async () => {
  const r = await chamarPlanilha("recebido", { id_linha: "MERC-ITE-4351" }, { fetchImpl: resp({ erro: "id_linha ambíguo: ...", ambiguo: true, id_linha: "MERC-ITE-4351", linhas: [4, 5] }) });
  assert.equal(r.ok, false); assert.equal(r.estado, "recusado"); assert.deepEqual(r.naoProcessados[0].linhas, [4, 5]); assert.equal(r.naoProcessados[0].motivo, "id_ambiguo");
  assert.match(mensagemPlanilha(r, { perfil: "admin" }), /NÃO foi atualizada[\s\S]*MERC-ITE-4351[\s\S]*linhas 4, 5/);
});

test("lote parcial: estado parcial, itens não processados listados com nome do item", async () => {
  const r = await chamar({ ok: false, updated: 2, parcial: true, nao_processados: [{ id_linha: "X-1", motivo: "id_ambiguo", linhas: [4, 5], ceg: "MERCARI", nome_do_item: "Item Mercari" }], erro: "Atualização PARCIAL: 1 item(ns)" });
  assert.equal(r.ok, false); assert.equal(r.estado, "parcial"); assert.equal(r.atualizados, 2);
  const joiner = mensagemPlanilha(r), admin = mensagemPlanilha(r, { perfil: "admin" });
  assert.match(joiner, /só em parte/); assert.match(joiner, /MERCARI — Item Mercari/); assert.doesNotMatch(joiner, /linhas 4/);
  assert.match(admin, /PARCIAL[\s\S]*MERCARI — Item Mercari \(o código \(ID\) está repetido na planilha; linhas 4, 5\)/);
});

test("lote totalmente recusado: estado recusado, nenhum sucesso", async () => {
  const r = await chamar({ ok: false, updated: 0, nao_processados: [{ id_linha: "A", motivo: "nao_encontrado" }, { id_linha: "B", motivo: "id_ambiguo", linhas: [1, 2] }] });
  assert.equal(r.estado, "recusado"); assert.equal(r.ok, false); assert.equal(r.naoProcessados.length, 2);
});

test("script ANTIGO que silenciosamente atualizou menos do que o esperado é detectado pela contagem", async () => {
  const itens = [{ valor_item: 10 }, { frete_inter: 5 }, { valor_item: 0 }];
  assert.equal(esperadosConfirmacao(itens), 2);
  const parcial = await chamar({ ok: true, updated: 1 }, { esperados: 2 });
  assert.equal(parcial.estado, "parcial"); assert.match(parcial.erro, /1 de 2/);
  const nenhum = await chamar({ ok: true, updated: 0 }, { esperados: 2 });
  assert.equal(nenhum.estado, "recusado");
});

test("planilha alterada mas SYNC falhou: ok continua true, mas o aviso aparece", async () => {
  const r = await chamar({ ok: true, updated: 1, nao_processados: [], sync: false, aviso: "A planilha foi atualizada, mas a sincronização ..." }, { esperados: 1 });
  assert.equal(r.ok, true); assert.equal(r.sincronizacaoPendente, true);
  assert.match(mensagemPlanilha(r, { perfil: "admin" }), /atualizada, mas a sincronização com o site falhou/);
  assert.match(mensagemPlanilha(r), /pode demorar alguns minutos/);
});

test("sem tudo certo não há mensagem (nada a avisar)", async () => {
  const r = await chamar({ ok: true, updated: 1, nao_processados: [], sync: true }, { esperados: 1 });
  assert.equal(mensagemPlanilha(r), null); assert.equal(mensagemPlanilha(r, { perfil: "admin" }), null);
});

test("erro do script (token, colunas, não achou): recusado com o texto do erro", async () => {
  const r = await chamar({ erro: "Token inválido" });
  assert.equal(r.estado, "recusado"); assert.equal(r.erro, "Token inválido"); assert.match(mensagemPlanilha(r, { perfil: "admin" }), /Token inválido/);
});

test("rede, HTTP, JSON inválido e timeout: 'indeterminado' (não afirma sucesso nem falha), nunca lança", async () => {
  const falha = async () => { throw new TypeError("Failed to fetch"); };
  const a = await chamarPlanilha("recebido", {}, { fetchImpl: falha });
  assert.equal(a.estado, "indeterminado"); assert.equal(a.ok, false);
  const b = await chamarPlanilha("recebido", {}, { fetchImpl: resp({}, { ok: false, status: 500 }) }); assert.equal(b.estado, "indeterminado"); assert.match(b.erro, /500/);
  const c = await chamarPlanilha("recebido", {}, { fetchImpl: resp(null, { texto: "<html>Erro</html>" }) }); assert.equal(c.estado, "indeterminado");
  const lento = (url, opts) => new Promise((_, rej) => opts.signal.addEventListener("abort", () => { const e = new Error("abort"); e.name = "AbortError"; rej(e); }));
  const d = await chamarPlanilha("recebido", {}, { fetchImpl: lento, timeoutMs: 20 }); assert.equal(d.estado, "indeterminado"); assert.match(d.erro, /demorou demais/);
  assert.match(mensagemPlanilha(a, { perfil: "admin" }), /não foi possível confirmar/); assert.match(mensagemPlanilha(a), /Não conseguimos confirmar/);
});

test("itens sem código (ID) são informados mesmo quando a planilha respondeu sucesso", async () => {
  const r = await chamar({ ok: true, updated: 1, nao_processados: [], sync: true }, { esperados: 1 });
  const msg = mensagemPlanilha(r, { itensSemId: [{ ceg: "BTS", nome_do_item: "Lightstick", id_linha: "" }] });
  assert.match(msg, /não têm código na planilha[\s\S]*BTS — Lightstick/);
});

test("a requisição envia ação, token e dados, como text/plain com redirect follow", async () => {
  let capturado;
  await chamarPlanilha("recebido", { id_linha: "A-1" }, { fetchImpl: async (url, o) => { capturado = { url, o }; return { ok: true, status: 200, text: async () => '{"ok":true}' }; }, url: "https://exemplo/exec", token: "t" });
  assert.equal(capturado.url, "https://exemplo/exec"); assert.equal(capturado.o.method, "POST"); assert.equal(capturado.o.redirect, "follow"); assert.equal(capturado.o.headers["Content-Type"], "text/plain");
  assert.deepEqual(JSON.parse(capturado.o.body), { acao: "recebido", token: "t", id_linha: "A-1" });
});

test("interpretarResposta: resposta vazia ou não-objeto é indeterminado", () => {
  assert.equal(interpretarResposta("x", null).estado, "indeterminado"); assert.equal(interpretarResposta("x", "texto").estado, "indeterminado");
});

test("GUARDA: nenhuma chamada ao Apps Script fora do módulo e nenhum `.catch(() => {})` engolindo a resposta", () => {
  for (const f of ["src/App.jsx", "src/LandingPage.jsx"]) {
    const codigo = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.equal((codigo.match(/script\.google\.com\/macros/g) || []).length, 0, f + " ainda chama o Apps Script direto");
    assert.equal((codigo.match(/anticeg-pag-2026/g) || []).length, 0, f + " ainda tem o token solto");
  }
});
