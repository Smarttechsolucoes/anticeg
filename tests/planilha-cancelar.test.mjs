// Testes do aviso de planilha ao rejeitar (sem rede, sem Supabase). Rodar:  node --test tests/planilha-cancelar.test.mjs
import { chamadasBloqueadas } from "./helpers/sem-rede.mjs";   // nenhum fetch real nos testes (nunca chegar ao Apps Script de produção)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interpretarCancelar, cancelarNaPlanilha, mensagemCancelar } from "../src/planilhaCancelar.js";

const itens = [{ id_linha: "A1", ceg: "W MAG", nome_do_item: "Capa A" }, { id_linha: "B2", ceg: "—", nome_do_item: "Capa B" }];
const resp = (corpo, { ok = true, status = 200 } = {}) => async () => ({ ok, status, text: async () => (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) });

test("sucesso: planilha confirma tudo => nenhuma mensagem", async () => {
  const r = await cancelarNaPlanilha(itens, { fetchImpl: resp({ ok: true, updated: 2 }) });
  assert.equal(r.estado, "sucesso");
  assert.equal(mensagemCancelar(r, itens), null);
});

test("script antigo sem 'updated': { ok:true } é sucesso", () => assert.equal(interpretarCancelar({ ok: true }, 2).estado, "sucesso"));

test("desmarcou menos do que o esperado => parcial, com aviso e lista dos itens", async () => {
  const r = await cancelarNaPlanilha(itens, { fetchImpl: resp({ ok: true, updated: 1 }) });
  assert.equal(r.estado, "parcial");
  const m = mensagemCancelar(r, itens);
  assert.match(m, /EM PARTE/); assert.match(m, /1 de 2/); assert.match(m, /W MAG — Capa A \[A1\]/); assert.match(m, /Capa B \[B2\]/); assert.match(m, /9h\/21h/);
});

test("erro do script, ok:false e nao_processados => NÃO é sucesso e avisa", async () => {
  for (const corpo of [{ erro: "id repetido" }, { ok: false }, { nao_processados: [{ id_linha: "A1", motivo: "nao_encontrado" }], updated: 0 }]) {
    const r = await cancelarNaPlanilha(itens, { fetchImpl: resp(corpo) });
    assert.notEqual(r.estado, "sucesso", JSON.stringify(corpo));
    assert.match(mensagemCancelar(r, itens), /pode continuar marcada como paga/);
  }
  assert.equal(interpretarCancelar({ nao_processados: [{ id_linha: "A1" }], updated: 1 }, 2).estado, "parcial");
});

test("sem resposta legível (rede, HTTP 500, JSON inválido, CORS) => indeterminado e AVISA, nunca silencioso", async () => {
  const falhas = [async () => { throw new TypeError("Failed to fetch"); }, resp("x", { ok: false, status: 500 }), resp("<html>erro</html>")];
  for (const f of falhas) {
    const r = await cancelarNaPlanilha(itens, { fetchImpl: f });
    assert.equal(r.estado, "indeterminado");
    assert.match(mensagemCancelar(r, itens), /CONFIRMAR se a planilha foi atualizada/);
  }
});

test("tempo esgotado => indeterminado (a chamada é abortada)", async () => {
  const lento = (url, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("abort"), { name: "AbortError" }))));
  const r = await cancelarNaPlanilha(itens, { fetchImpl: lento, timeoutMs: 20 });
  assert.equal(r.estado, "indeterminado"); assert.match(r.erro, /demorou demais/);
});

test("nunca lança, mesmo com resposta estranha (null, lista, número)", async () => {
  for (const corpo of ["null", "[]", "42", "{}", '{"foo":1}']) {
    const r = await cancelarNaPlanilha(itens, { fetchImpl: resp(corpo) });
    assert.notEqual(r.estado, "sucesso", corpo);
  }
});

test("formato da requisição: POST text/plain com acao=cancelar e os itens", async () => {
  let visto;
  await cancelarNaPlanilha(itens, { fetchImpl: async (url, init) => { visto = { url, init }; return { ok: true, text: async () => '{"ok":true,"updated":2}' }; } });
  assert.equal(visto.init.method, "POST"); assert.equal(visto.init.headers["Content-Type"], "text/plain");
  const corpo = JSON.parse(visto.init.body); assert.equal(corpo.acao, "cancelar"); assert.deepEqual(corpo.itens, itens); assert.ok(corpo.token);
});

test("lista longa é resumida na mensagem (máx. 8 itens + resto)", () => {
  const muitos = Array.from({ length: 11 }, (_, i) => ({ id_linha: "X" + i, nome_do_item: "Item " + i }));
  assert.match(mensagemCancelar({ estado: "falha", erro: "x" }, muitos), /e mais 3/);
});

test("GUARDA: a rejeição no site não volta a chamar o 'cancelar' de forma silenciosa", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.ok(!/acao:\s*"cancelar"/.test(app), "App.jsx não deve mais montar a chamada 'cancelar' direto (usa cancelarNaPlanilha)");
  assert.ok(/cancelarNaPlanilha\(itensComId\)\.then\(rc => \{ const aviso = mensagemCancelar\(rc, itensComId\); if \(aviso\) alert\(aviso\); \}\)/.test(app), "rejeitar usa cancelarNaPlanilha e mostra o aviso");
  const i = app.indexOf("async function rejeitar(id, motivo)"); const j = app.indexOf("const listaAtiva", i);
  assert.ok(app.slice(i, j).includes("admin_definir_status_pagamento") && app.slice(i, j).includes("cancelarNaPlanilha"), "a rejeição chama o R1 e depois a planilha");
});
