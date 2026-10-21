// Testes da escolha do cadastro na entrada por @/e-mail (sem rede). Rodar:  node --test tests/escolher-joiner.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { escolherJoiner, escaparLike } from "../src/escolherJoiner.js";

test("gêmeos só de maiúsculas: entra no cadastro confirmado, digite como digitar", () => {
  const real = { id: 1, cog: "Seopookie", confirmado: true }, gemeo = { id: 2, cog: "seopookie", confirmado: false };
  for (const ordem of [[real, gemeo], [gemeo, real]]) for (const digitado of ["seopookie", "@seopookie", "Seopookie", "@SEOPOOKIE"]) {
    assert.equal(escolherJoiner(ordem, digitado).id, 1, digitado);
  }
});
test("sem confirmado: vale o cog escrito como digitado; depois o mais antigo", () => {
  const a = { id: 5, cog: "Ana" }, b = { id: 3, cog: "ana" };
  assert.equal(escolherJoiner([a, b], "Ana").id, 5);
  assert.equal(escolherJoiner([a, b], "ANA").id, 3);
});
test("lista vazia ou nula = nenhum cadastro; um só = ele mesmo", () => {
  assert.equal(escolherJoiner([], "x"), null); assert.equal(escolherJoiner(null, "x"), null); assert.equal(escolherJoiner(undefined), null);
  assert.deepEqual(escolherJoiner([{ id: 9, cog: "z" }], "x"), { id: 9, cog: "z" });
});
test("escaparLike escapa _ % e barra (o @ Hellouisa__ nao pode casar HellouisaXY)", () => {
  const B = String.fromCharCode(92);
  assert.equal(escaparLike("Hellouisa__"), "Hellouisa" + B + "_" + B + "_");
  assert.equal(escaparLike("a%b" + B + "c"), "a" + B + "%b" + B + B + "c");
  assert.equal(escaparLike("simples"), "simples");
});
test("as entradas por @/e-mail não usam mais maybeSingle (erro com mais de uma linha) nem eq exato de cog", () => {
  const lp = readFileSync(new URL("../src/LandingPage.jsx", import.meta.url), "utf8");
  const trecho = lp.slice(lp.indexOf("async function buscarJoiner"), lp.indexOf("async function handleEntrar"));
  assert.doesNotMatch(trecho, /maybeSingle/); assert.doesNotMatch(trecho, /\.eq\("cog"/); assert.match(trecho, /escolherJoiner/);
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const acesso = app.slice(app.indexOf("joiner = escolherJoiner(data, val)") - 400, app.indexOf("joiner = escolherJoiner(data, handle)") + 100);
  assert.doesNotMatch(acesso, /maybeSingle/);
});
test("paginações sem ordem fixa da masterlist ganharam order por id", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const pags = [...app.matchAll(/from\("masterlist"\)[\s\S]{0,260}?\.range\(from, from \+ 999\)/g)].map(m => m[0]);
  assert.ok(pags.length >= 3);
  for (const p of pags) assert.match(p, /\.order\("id"/, p.slice(0, 80));
});
