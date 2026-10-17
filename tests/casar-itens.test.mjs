// Testes do casamento por código e do desempate pelo dono no sync (sem rede, sem Supabase). Rodar:  node --test tests/casar-itens.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { casarPorIdLinha, casarChavesRepetidas } from "../scripts/casar-itens.js";

const E = (id, id_linha, ceg = "W MAG", cog = "ana") => ({ id, id_linha, ceg, cog });
const L = (idLinha, ceg = "W MAG", cog = "ana") => ({ idLinha, ceg, cog });

// ── casarPorIdLinha ─────────────────────────────────────────────────────────────────────────
test("casa pelo código mesmo que nome/valor tenham mudado (a linha continua a mesma, mesmo id)", () => {
  const { porIndice, reivindicados } = casarPorIdLinha([L("A-1"), L("B-2", "W MAG", "bia")], [E(10, "A-1"), E(11, "B-2", "W MAG", "bia")]);
  assert.equal(porIndice.get(0).id, 10); assert.equal(porIndice.get(1).id, 11);
  assert.deepEqual([...reivindicados].sort(), [10, 11]);
});

test("espaços ao redor do código/dono são ignorados; CEG compara sem diferenciar maiúsculas", () => {
  assert.equal(casarPorIdLinha([L("  A-1 ", "w mag", " ana ")], [E(10, "A-1", "W MAG", "ana")]).porIndice.get(0)?.id, 10);
});

test("NÃO casa: o DONO é outro (código reaproveitado por OUTRA joiner) — o id nunca muda de dono", () => {
  assert.equal(casarPorIdLinha([L("A-1", "W MAG", "bia")], [E(10, "A-1", "W MAG", "ana")]).porIndice.size, 0);
});

test("NÃO casa: dono vazio/nulo em qualquer dos lados; Ela e ela são donos DIFERENTES (comparação exata)", () => {
  assert.equal(casarPorIdLinha([L("A-1", "W MAG", null)], [E(10, "A-1")]).porIndice.size, 0);
  assert.equal(casarPorIdLinha([L("A-1", "W MAG", "")], [E(10, "A-1")]).porIndice.size, 0);
  assert.equal(casarPorIdLinha([L("A-1")], [E(10, "A-1", "W MAG", null)]).porIndice.size, 0);
  assert.equal(casarPorIdLinha([L("A-1", "W MAG", "ela")], [E(10, "A-1", "W MAG", "Ela")]).porIndice.size, 0);
});

test("NÃO casa: sem código, código vazio ou só espaços", () => {
  for (const c of [null, undefined, "", "   "]) assert.equal(casarPorIdLinha([L(c)], [E(10, "A-1")]).porIndice.size, 0, JSON.stringify(c));
  assert.equal(casarPorIdLinha([L("A-1")], [E(10, ""), E(11, null)]).porIndice.size, 0);
});

test("NÃO casa: código repetido NA PLANILHA ou NO BANCO (ambíguo)", () => {
  const a = casarPorIdLinha([L("A-1"), L("A-1")], [E(10, "A-1")]); assert.equal(a.porIndice.size, 0); assert.equal(a.reivindicados.size, 0);
  assert.equal(casarPorIdLinha([L("A-1")], [E(10, "A-1"), E(11, "A-1")]).porIndice.size, 0);
});

test("NÃO casa: código inexistente no banco, nem CEG diferente", () => {
  assert.equal(casarPorIdLinha([L("Z-9")], [E(10, "A-1")]).porIndice.size, 0);
  assert.equal(casarPorIdLinha([L("A-1", "OUTRO CEG")], [E(10, "A-1", "W MAG")]).porIndice.size, 0);
});

test("cada linha do banco é reivindicada UMA vez; só as casadas entram no conjunto; entradas vazias não quebram", () => {
  const { porIndice, reivindicados } = casarPorIdLinha([L("A-1"), L("B-2"), L("C-3")], [E(10, "A-1"), E(11, "B-2"), E(12, "OUTRO")]);
  assert.equal(porIndice.size, 2); assert.deepEqual([...reivindicados].sort(), [10, 11]);
  assert.equal(casarPorIdLinha([], []).porIndice.size, 0); assert.equal(casarPorIdLinha([L("A-1")], []).porIndice.size, 0); assert.equal(casarPorIdLinha([], [E(1, "A-1")]).porIndice.size, 0);
});

// ── casarChavesRepetidas (desempate pelo dono) ───────────────────────────────────────────────
const LC = (indice, chave, cog) => ({ indice, chave, cog });
const EC = (id, chave, cog) => ({ id, chave, cog });

test("desempate: duas linhas de mesma chave e @ diferentes são ligadas ao SEU dono, em qualquer ordem da planilha", () => {
  const banco = [EC(7129, "k", "hyunbuzzcut"), EC(7130, "k", "schreavruelker")];
  const ordem1 = casarChavesRepetidas([LC(0, "k", "hyunbuzzcut"), LC(1, "k", "schreavruelker")], banco);
  const ordem2 = casarChavesRepetidas([LC(0, "k", "schreavruelker"), LC(1, "k", "hyunbuzzcut")], banco);   // ordem INVERTIDA
  assert.equal(ordem1.porIndice.get(0).id, 7129); assert.equal(ordem1.porIndice.get(1).id, 7130);
  assert.equal(ordem2.porIndice.get(0).id, 7130); assert.equal(ordem2.porIndice.get(1).id, 7129);
});

test("desempate: grupo SEM ambiguidade (1 linha na planilha e 1 no banco) não é tocado: segue a regra antiga", () => {
  assert.equal(casarChavesRepetidas([LC(0, "k", "ana")], [EC(1, "k", "ana")]).porIndice.size, 0);
  assert.equal(casarChavesRepetidas([LC(0, "k", "bia")], [EC(1, "k", "ana")]).porIndice.size, 0);
});

test("desempate: só pareia o MESMO @ (exato); quem não acha o seu dono fica para a regra antiga; cada linha do banco uma vez", () => {
  const r = casarChavesRepetidas([LC(0, "k", "ana"), LC(1, "k", "ana"), LC(2, "k", "cris"), LC(3, "k", "Ela")], [EC(1, "k", "ana"), EC(2, "k", "bia"), EC(3, "k", "ela")]);
  assert.equal(r.porIndice.get(0).id, 1);
  assert.equal(r.porIndice.has(1), false, "a segunda linha da ana não tem outra linha da ana livre");
  assert.equal(r.porIndice.has(2), false, "cris não existe no banco");
  assert.equal(r.porIndice.has(3), false, "Ela ≠ ela");
  assert.deepEqual([...r.reivindicados], [1]);
});

test("desempate: dono vazio nunca casa; chaves diferentes não se misturam", () => {
  assert.equal(casarChavesRepetidas([LC(0, "k", null), LC(1, "k", "")], [EC(1, "k", "ana"), EC(2, "k", "bia")]).porIndice.size, 0);
  const r = casarChavesRepetidas([LC(0, "k1", "ana"), LC(1, "k1", "bia")], [EC(1, "k2", "ana"), EC(2, "k2", "bia")]);
  assert.equal(r.porIndice.size, 0);
});

// ── guardas estáticas sobre o script do sync ─────────────────────────────────────────────────
test("o sync usa o casamento ANTES do laço, com o dono, tira as reivindicadas do mapa e só conta a chave antiga nas não casadas", () => {
  const src = readFileSync(new URL("../scripts/sync-masterlist.js", import.meta.url), "utf8");
  assert.ok(src.includes("import { casarPorIdLinha, casarChavesRepetidas } from './casar-itens.js'"), "importa os dois módulos");
  assert.ok(/select\('id, ceg, nome_do_item, nome, status, pago_item, pago_frete, pago_rf, id_linha, cog'\)/.test(src), "lê id_linha e cog do banco");
  assert.ok(/cog: cogDe\(r\)/.test(src), "o dono da linha da planilha entra no casamento por código");
  const iCasar = src.indexOf("casarPorIdLinha(", src.indexOf("const casamento"));
  const iLaco = src.indexOf("for (const [idxLinha, r] of rows.entries())");
  assert.ok(iCasar > 0 && iLaco > iCasar, "o casamento roda antes do laço de linhas");
  assert.ok(/existingMap\[k\] = existingMap\[k\]\.filter\(x => !casamento\.reivindicados\.has\(x\.id\)\)/.test(src), "tira as casadas por código do mapa de chaves (e do prune)");
  assert.ok(/existingMap\[k\] = existingMap\[k\]\.filter\(x => !desempate\.reivindicados\.has\(x\.id\)\)/.test(src), "tira as desempatadas do mapa de chaves (e do prune)");
  const iElse = src.indexOf("} else {", src.indexOf("else if (existingItem)"));
  assert.ok(src.slice(iElse, iElse + 400).includes("sheetKeyCount[key] = (sheetKeyCount[key] || 0) + 1"), "a contagem por chave só acontece para linhas NÃO casadas");
});

test("a trava de planilha parcial usa o total REAL do banco (as linhas casadas não podem afrouxá-la)", () => {
  const src = readFileSync(new URL("../scripts/sync-masterlist.js", import.meta.url), "utf8");
  const iTotal = src.indexOf("const totalNoBanco = Object.values(existingMap)");
  const iCasar = src.indexOf("casarPorIdLinha(", src.indexOf("const casamento"));
  assert.ok(iTotal > 0 && iCasar > iTotal, "o total do banco é medido ANTES do casamento");
  assert.ok(/const totalExistentes = totalNoBanco;/.test(src));
});
