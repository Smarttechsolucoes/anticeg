// Testes da confirmação na planilha (sem rede, sem Supabase). Rodar:  node --test tests/planilha-confirmar.test.mjs
import { chamadasBloqueadas } from "./helpers/sem-rede.mjs";   // nenhum fetch real nos testes (nunca chegar ao Apps Script de produção)
import test from "node:test";
import assert from "node:assert/strict";
import { itensParaPlanilha, separarRecusados, confirmarNaPlanilha, mensagemConfirmar } from "../src/planilhaConfirmar.js";

const dem = { itens: [
  { id_linha: "A1", ceg: "W MAG", nome_do_item: "Capa A", valor_item: 45, frete_inter: 0, taxa_rf: 0 },
  { id_linha: "B2", ceg: "THIS & THAT", nome_do_item: "Album", valor_item: 0, frete_inter: 12.5, taxa_rf: 3 },
  { id_linha: "", ceg: "PAPER TALE", nome_do_item: "Sem código", valor_item: 30 },
  { id_linha: "C3", ceg: "—", nome_do_item: "outros", valor_item: 10 },
  { id_linha: "D4", ceg: "X", nome_do_item: "Sem valor", valor_item: 0, frete_inter: 0, taxa_rf: 0 },
  { id_linha: "A1", ceg: "W MAG", nome_do_item: "Capa A", valor_item: 45 },              // repetido idêntico
] };
const resp = (corpo, { ok = true, status = 200 } = {}) => async () => ({ ok, status, text: async () => (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) });
const semEspera = { esperar: async () => {}, esperaMs: 0 };

test("itensParaPlanilha: só itens com código e valor; 'outros', sem valor e repetidos ficam de fora; sem código é devolvido à parte", () => {
  const { itens, semCodigo } = itensParaPlanilha(dem);
  assert.deepEqual(itens.map(i => i.id_linha), ["A1", "B2"]);
  assert.deepEqual(itens[1], { id_linha: "B2", ceg: "THIS & THAT", nome_do_item: "Album", valor_item: 0, frete_inter: 12.5, taxa_rf: 3 });
  assert.deepEqual(semCodigo, [{ ceg: "PAPER TALE", nome_do_item: "Sem código" }]);
  assert.deepEqual(itensParaPlanilha(null), { itens: [], semCodigo: [] });
});

test("itensParaPlanilha é idempotente e não escolhe linha por nome: item sem código NUNCA vai no payload", () => {
  const a = itensParaPlanilha(dem), b = itensParaPlanilha(dem);
  assert.deepEqual(a, b);
  assert.ok(a.itens.every(i => i.id_linha));
});

test("envia a ação 'confirmar' com os itens e o token; sucesso => nenhuma mensagem", async () => {
  let corpo;
  const f = async (url, o) => { corpo = JSON.parse(o.body); return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, updated: 2 }) }; };
  const { itens } = itensParaPlanilha(dem);
  const r = await confirmarNaPlanilha(itens, { fetchImpl: f, ...semEspera });
  assert.equal(r.estado, "sucesso"); assert.equal(r.tentativas, 1);
  assert.equal(corpo.acao, "confirmar"); assert.equal(corpo.itens.length, 2); assert.ok(corpo.token);
  assert.equal(mensagemConfirmar(r, itens, []), null);
});

test("lista vazia: não chama a planilha e é sucesso", async () => {
  let chamou = false;
  const r = await confirmarNaPlanilha([], { fetchImpl: async () => { chamou = true; }, ...semEspera });
  assert.equal(r.estado, "sucesso"); assert.equal(chamou, false);
});

test("falha de rede / HTTP 500 / JSON inválido: tenta de novo (idempotente) e, se continuar, avisa como indeterminado", async () => {
  const { itens } = itensParaPlanilha(dem);
  for (const f of [async () => { throw new TypeError("Failed to fetch"); }, resp("x", { ok: false, status: 500 }), resp("<html>")]) {
    let n = 0; const contador = async (...a) => { n++; return f(...a); };
    const r = await confirmarNaPlanilha(itens, { fetchImpl: contador, tentativas: 3, ...semEspera });
    assert.equal(r.estado, "indeterminado"); assert.equal(n, 3); assert.equal(r.tentativas, 3);
    assert.match(mensagemConfirmar(r, itens, []), /CONFIRMAR se a planilha foi atualizada/);
  }
});

test("a 2ª tentativa resolve: falha de rede seguida de sucesso => sucesso (sem mensagem)", async () => {
  const { itens } = itensParaPlanilha(dem); let n = 0;
  const f = async () => { n++; if (n === 1) throw new TypeError("Failed to fetch"); return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, updated: 2 }) }; };
  const r = await confirmarNaPlanilha(itens, { fetchImpl: f, ...semEspera });
  assert.equal(r.estado, "sucesso"); assert.equal(r.tentativas, 2); assert.equal(mensagemConfirmar(r, itens, []), null);
});

test("resposta DEFINITIVA do script (erro, ok:false, recusados) NÃO é repetida em loop", async () => {
  const { itens } = itensParaPlanilha(dem);
  for (const corpo of [{ erro: "Colunas ITEM/FRETE/RF não encontradas" }, { ok: false }, { updated: 0, nao_processados: [{ id_linha: "A1", motivo: "id_ambiguo" }] }]) {
    let n = 0; const f = async () => { n++; return { ok: true, status: 200, text: async () => JSON.stringify(corpo) }; };
    const r = await confirmarNaPlanilha(itens, { fetchImpl: f, ...semEspera });
    assert.notEqual(r.estado, "sucesso", JSON.stringify(corpo)); assert.equal(n, 1, JSON.stringify(corpo));
  }
});

test("resposta parcial: separa o que pode ser reenviado do que precisa de decisão humana, e a mensagem diz o motivo", async () => {
  const { itens } = itensParaPlanilha(dem);
  const corpo = { ok: false, updated: 1, parcial: true, nao_processados: [{ id_linha: "B2", motivo: "erro_ao_gravar" }] };
  const r = await confirmarNaPlanilha(itens, { fetchImpl: resp(corpo), ...semEspera });
  assert.equal(r.estado, "parcial");
  const s = separarRecusados(r, itens);
  assert.deepEqual(s.reenviaveis.map(i => i.id_linha), ["B2"]); assert.equal(s.decisaoHumana.length, 0);
  assert.match(mensagemConfirmar(r, itens, []), /Pode reenviar/);
  const r2 = await confirmarNaPlanilha(itens, { fetchImpl: resp({ updated: 1, nao_processados: [{ id_linha: "A1", motivo: "id_ambiguo" }] }), ...semEspera });
  const s2 = separarRecusados(r2, itens);
  assert.equal(s2.reenviaveis.length, 0); assert.equal(s2.decisaoHumana[0].motivo, "id_ambiguo");
  assert.match(mensagemConfirmar(r2, itens, []), /código repetido na planilha \(não escolhi uma linha\)/);
});

test("reenviar só os pendentes é idempotente: segundo envio com os mesmos itens dá o mesmo payload", async () => {
  const { itens } = itensParaPlanilha(dem); const corpos = [];
  const f = async (_u, o) => { corpos.push(o.body); return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, updated: itens.length }) }; };
  await confirmarNaPlanilha(itens, { fetchImpl: f, ...semEspera }); await confirmarNaPlanilha(itens, { fetchImpl: f, ...semEspera });
  assert.equal(corpos[0], corpos[1]);
});

test("itens sem código geram aviso mesmo com a planilha respondendo sucesso", async () => {
  const { itens, semCodigo } = itensParaPlanilha(dem);
  const r = await confirmarNaPlanilha(itens, { fetchImpl: resp({ ok: true, updated: 2 }), ...semEspera });
  const m = mensagemConfirmar(r, itens, semCodigo);
  assert.match(m, /SEM código/); assert.match(m, /PAPER TALE — Sem código/);
});

test("'sem_alteracao' do script não conta como item faltando", async () => {
  const { itens } = itensParaPlanilha(dem);
  const r = await confirmarNaPlanilha(itens, { fetchImpl: resp({ ok: true, updated: 1, sem_alteracao: ["B2"] }), ...semEspera });
  assert.equal(r.estado, "sucesso");
});

test("nunca lança, mesmo com fetch quebrado ou resposta estranha (sempre simulado: este teste NÃO usa a rede)", async () => {
  const { itens } = itensParaPlanilha(dem);
  for (const f of [async () => { throw new ReferenceError("sem fetch"); }, async () => ({ ok: true, status: 200, text: async () => "null" }), async () => ({ ok: true, status: 200, text: async () => "[]" })]) {
    const r = await confirmarNaPlanilha(itens, { fetchImpl: f, tentativas: 1, ...semEspera });
    assert.ok(["indeterminado", "falha", "sucesso", "parcial"].includes(r.estado));
  }
});

test("sem fetch simulado o módulo NÃO alcança a rede real: o guard bloqueia e o resultado é indeterminado", async () => {
  const { itens } = itensParaPlanilha(dem);
  const antes = chamadasBloqueadas.length;
  const r = await confirmarNaPlanilha(itens, { tentativas: 1, ...semEspera });
  assert.equal(r.estado, "indeterminado");
  assert.equal(chamadasBloqueadas.length, antes + 1, "a tentativa foi interceptada pelo guard");
  assert.match(chamadasBloqueadas.at(-1), /script\.google\.com/);
});
