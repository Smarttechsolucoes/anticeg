// Testes do casamento por código (id_linha) no sync (sem rede, sem Supabase). Rodar:  node --test tests/casar-itens.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { casarPorIdLinha } from "../scripts/casar-itens.js";

const E = (id, id_linha, ceg = "W MAG") => ({ id, id_linha, ceg });
const L = (idLinha, ceg = "W MAG") => ({ idLinha, ceg });

test("casa pelo código mesmo que nome/valor/dono tenham mudado (a linha continua a mesma, mesmo id)", () => {
  const { porIndice, reivindicados } = casarPorIdLinha([L("A-1"), L("B-2")], [E(10, "A-1"), E(11, "B-2")]);
  assert.equal(porIndice.get(0).id, 10); assert.equal(porIndice.get(1).id, 11);
  assert.deepEqual([...reivindicados].sort(), [10, 11]);
});

test("espaços ao redor do código são ignorados; CEG compara sem diferenciar maiúsculas", () => {
  const { porIndice } = casarPorIdLinha([L("  A-1 ", "w mag")], [E(10, "A-1", "W MAG")]);
  assert.equal(porIndice.get(0)?.id, 10);
});

test("NÃO casa: sem código, código vazio ou só espaços", () => {
  for (const c of [null, undefined, "", "   "]) assert.equal(casarPorIdLinha([L(c)], [E(10, "A-1")]).porIndice.size, 0, JSON.stringify(c));
  assert.equal(casarPorIdLinha([L("A-1")], [E(10, ""), E(11, null)]).porIndice.size, 0);
});

test("NÃO casa: código repetido NA PLANILHA (ninguém sabe qual é qual)", () => {
  const { porIndice, reivindicados } = casarPorIdLinha([L("A-1"), L("A-1")], [E(10, "A-1")]);
  assert.equal(porIndice.size, 0); assert.equal(reivindicados.size, 0);
});

test("NÃO casa: código repetido NO BANCO (ambíguo)", () => {
  assert.equal(casarPorIdLinha([L("A-1")], [E(10, "A-1"), E(11, "A-1")]).porIndice.size, 0);
});

test("NÃO casa: código que não existe no banco (item novo)", () => {
  assert.equal(casarPorIdLinha([L("Z-9")], [E(10, "A-1")]).porIndice.size, 0);
});

test("NÃO casa: CEG diferente (o código de um item não muda de CEG; tratamos como outro item)", () => {
  assert.equal(casarPorIdLinha([L("A-1", "OUTRO CEG")], [E(10, "A-1", "W MAG")]).porIndice.size, 0);
});

test("cada linha do banco é reivindicada UMA vez e só as casadas entram no conjunto", () => {
  const { porIndice, reivindicados } = casarPorIdLinha([L("A-1"), L("B-2"), L("C-3")], [E(10, "A-1"), E(11, "B-2"), E(12, "OUTRO")]);
  assert.equal(porIndice.size, 2); assert.deepEqual([...reivindicados].sort(), [10, 11]);
});

test("planilha e banco vazios não quebram", () => {
  assert.equal(casarPorIdLinha([], []).porIndice.size, 0);
  assert.equal(casarPorIdLinha([L("A-1")], []).porIndice.size, 0);
  assert.equal(casarPorIdLinha([], [E(1, "A-1")]).porIndice.size, 0);
});

test("o sync usa o casamento ANTES do laço, tira as reivindicadas do mapa (nunca são excluídas) e só conta a chave antiga nas não casadas", () => {
  const src = readFileSync(new URL("../scripts/sync-masterlist.js", import.meta.url), "utf8");
  assert.ok(src.includes("import { casarPorIdLinha } from './casar-itens.js'"), "importa o módulo");
  assert.ok(/select\('id, ceg, nome_do_item, nome, status, pago_item, pago_frete, pago_rf, id_linha'\)/.test(src), "lê id_linha do banco");
  const iCasar = src.indexOf("casarPorIdLinha(\n") >= 0 ? src.indexOf("casarPorIdLinha(\n") : src.indexOf("casarPorIdLinha(\r\n");
  const iLaco = src.indexOf("for (const [idxLinha, r] of rows.entries())");
  assert.ok(iCasar > 0 && iLaco > iCasar, "o casamento roda antes do laço de linhas");
  assert.ok(/existingMap\[k\] = existingMap\[k\]\.filter\(x => !casamento\.reivindicados\.has\(x\.id\)\)/.test(src), "tira as reivindicadas do mapa de chaves (e do prune)");
  const iElse = src.indexOf("} else {", src.indexOf("let existingItem = casamento.porIndice.get(idxLinha)"));
  assert.ok(src.slice(iElse, iElse + 400).includes("sheetKeyCount[key] = (sheetKeyCount[key] || 0) + 1"), "a contagem por chave só acontece para linhas NÃO casadas pelo código");
});

test("a trava de planilha parcial usa o total REAL do banco (as linhas casadas pelo código não podem afrouxá-la)", () => {
  const src = readFileSync(new URL("../scripts/sync-masterlist.js", import.meta.url), "utf8");
  const iTotal = src.indexOf("const totalNoBanco = Object.values(existingMap)");
  const iCasar = src.indexOf("casarPorIdLinha(", src.indexOf("const casamento"));
  assert.ok(iTotal > 0 && iCasar > iTotal, "o total do banco é medido ANTES do casamento");
  assert.ok(/const totalExistentes = totalNoBanco;/.test(src), "a trava usa esse total");
  assert.ok(!/const totalExistentes = Object\.values\(existingMap\)/.test(src), "não recalcula o total sobre o mapa já reduzido");
});
