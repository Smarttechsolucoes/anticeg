// Testes da resolução por @ ANTIGO (sem rede, sem banco). Rodar: node --test tests/sync-arroba-antigo.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { indexarJoiners, resolverLinha, cogDaLinha } from "../scripts/resolver-joiner.js";

const J = (id, cog, twitter, email = `${cog}@x.com`, confirmado = false) => ({ id, cog, twitter, email, confirmado });

test("sem histórico de @: resolve como sempre (@ de hoje, e-mail, ou pessoa nova)", () => {
  const idx = indexarJoiners([J(1, "ana", "@ana"), J(2, "bia", "@bia_nova", "bia@x.com")]);
  assert.deepEqual(resolverLinha({ twitter: "@Ana" }, idx), { cog: "ana", via: "twitter", conflito: null });
  assert.deepEqual(resolverLinha({ twitter: "@outro", email: "BIA@x.com" }, idx), { cog: "bia", via: "email", conflito: null });
  assert.deepEqual(resolverLinha({ twitter: "@novinha" }, idx), { cog: "novinha", via: "novo", conflito: null });
  assert.equal(cogDaLinha({ twitter: "@ninguem", email: "z@x.com" }, idx), "ninguem");
  assert.equal(cogDaLinha({}, idx), null);
});

test("@ antigo registrado: reconhece o cadastro original (cog preservado)", () => {
  const idx = indexarJoiners([J(1, "qnny_dool", "@anny_nova")], [{ cog: "QNNY_DOOL", de: "@Anny_Dool", para: "@anny_nova" }]);
  assert.deepEqual(resolverLinha({ twitter: "@anny_dool" }, idx), { cog: "qnny_dool", via: "arroba_antigo", conflito: null });
  assert.equal(cogDaLinha({ twitter: "anny_dool" }, idx), "qnny_dool");
});

test("mudanças sucessivas A→B→C: os dois @ antigos levam ao mesmo cadastro", () => {
  const idx = indexarJoiners([J(1, "x1", "@c3")], [{ cog: "x1", de: "@a1", para: "@b2" }, { cog: "x1", de: "@b2", para: "@c3" }]);
  assert.equal(resolverLinha({ twitter: "@a1" }, idx).cog, "x1"); assert.equal(resolverLinha({ twitter: "@b2" }, idx).cog, "x1");
  assert.equal(resolverLinha({ twitter: "@c3" }, idx).via, "twitter");
});

test("o @ de HOJE de outro cadastro vence o @ antigo", () => {
  const idx = indexarJoiners([J(1, "x1", "@c3"), J(2, "y1", "@b2")], [{ cog: "x1", de: "@b2", para: "@c3" }]);
  assert.deepEqual(resolverLinha({ twitter: "@b2" }, idx), { cog: "y1", via: "twitter", conflito: null });
});

test("mais de um cadastro possível => CONFLITO (cog nulo): @ antigo em dois cadastros, ou igual ao cog de outro", () => {
  const dois = indexarJoiners([J(1, "pa", "@pa_n"), J(2, "pb", "@pb_n")], [{ cog: "pa", de: "@h", para: "@pa_n" }, { cog: "pb", de: "@h", para: "@pb_n" }]);
  const r = resolverLinha({ twitter: "@h" }, dois);
  assert.equal(r.via, "conflito"); assert.equal(r.cog, null); assert.equal(r.conflito.tipo, "arroba_antigo_em_mais_de_um_cadastro"); assert.deepEqual(r.conflito.candidatos, ["pa", "pb"]);
  assert.equal(cogDaLinha({ twitter: "@h" }, dois), null);
  const cogOutro = indexarJoiners([J(1, "xx", "@xx_n"), J(2, "h2", "@outro")], [{ cog: "xx", de: "@h2", para: "@xx_n" }]);
  const r2 = resolverLinha({ twitter: "@h2" }, cogOutro);
  assert.equal(r2.conflito.tipo, "arroba_antigo_e_cog_de_outro_cadastro"); assert.deepEqual(r2.conflito.candidatos, ["h2", "xx"]);
});

test("o cadastro com o @ antigo igual ao PRÓPRIO cog (caso b_adss) resolve para ele mesmo", () => {
  const idx = indexarJoiners([J(1, "b_adss", "@bad"), J(2, "bad", "@bad", "novo@x.com")], [{ cog: "b_adss", de: "@b_adss", para: "@bad" }]);
  assert.deepEqual(resolverLinha({ twitter: "@b_adss" }, idx), { cog: "b_adss", via: "arroba_antigo", conflito: null });
});

test("histórico de cadastro que não existe mais, ou vazio, é ignorado; a entrada não é alterada", () => {
  const entrada = [{ cog: "fantasma", de: "@a", para: "@b" }, { cog: "ana", de: "", para: "" }, null];
  const copia = JSON.stringify(entrada);
  const idx = indexarJoiners([J(1, "ana", "@ana")], entrada);
  assert.equal(idx.porArrobaAntigo.size, 0); assert.equal(JSON.stringify(entrada), copia);
});
