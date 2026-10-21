// Testes da resolução do dono (COG) no sync quando o mesmo @ existe com maiúsculas diferentes (sem rede, sem Supabase).
// Rodar:  node --test tests/sync-joiner-maiusculas.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexarJoiners, cogDaLinha, joinerExistente, cogDoUpsert } from "../scripts/resolver-joiner.js";

const J = (id, cog, extra = {}) => ({ id, cog, twitter: "@" + cog, email: `${cog.toLowerCase()}@x.com`, confirmado: false, ...extra });

test("gêmeos só de maiúsculas: o cadastro confirmado vence, em qualquer ordem física", () => {
  const real = J(10, "Seopookie", { confirmado: true }), gemeo = J(20, "seopookie", { twitter: "@Seopookie", email: real.email });
  for (const ordem of [[real, gemeo], [gemeo, real]]) {
    const idx = indexarJoiners(ordem);
    assert.equal(cogDaLinha({ twitter: "@Seopookie", email: "" }, idx), "Seopookie");
    assert.equal(cogDaLinha({ twitter: "seopookie", email: "" }, idx), "Seopookie");
    assert.equal(cogDaLinha({ twitter: "", email: real.email }, idx), "Seopookie");
    assert.equal(cogDoUpsert("seopookie", idx), "Seopookie", "o upsert usa o cog que já existe: não cria gêmeo");
    assert.equal(joinerExistente("seopookie", idx).id, 10);
  }
});

test("disputa que NÃO é só de maiúsculas mantém o dono de hoje: confirmado, depois cog igual ao @", () => {
  // anny: a conta usada (confirmada) tem outro cog; o cog igual ao @ é um cadastro sem uso
  const idx1 = indexarJoiners([J(1, "qnny_dool", { twitter: "@anny_dool", confirmado: true }), J(2, "anny_dool", { confirmado: false })]);
  assert.equal(cogDaLinha({ twitter: "@anny_dool" }, idx1), "qnny_dool");
  // as duas confirmadas: vale o cog igual ao @ (e não o mais antigo)
  const idx2 = indexarJoiners([J(1, "soobinwalls (twitter)", { twitter: "soobinwalls", confirmado: true }), J(2, "soobinwalls", { confirmado: true })]);
  assert.equal(cogDaLinha({ twitter: "@soobinwalls" }, idx2), "soobinwalls");
});

test("sem gêmeos e sem cadastro: comportamento de sempre (@ em minúsculas; senão o começo do e-mail)", () => {
  const idx = indexarJoiners([J(1, "ana")]);
  assert.equal(cogDaLinha({ twitter: "@Ana" }, idx), "ana");
  assert.equal(cogDaLinha({ twitter: "@Nova_Pessoa" }, idx), "nova_pessoa");
  assert.equal(cogDaLinha({ twitter: "", email: "Fulana@x.com" }, idx), "fulana");
  assert.equal(cogDaLinha({ twitter: "", email: "" }, idx), null);
  assert.equal(cogDoUpsert("nova_pessoa", idx), "nova_pessoa", "joiner realmente nova entra com o @ em minúsculas");
});

test("resultado não depende da ordem das joiners nem altera a lista de entrada", () => {
  const a = [J(3, "Zed", { confirmado: true }), J(4, "zed"), J(1, "ana")];
  const copia = JSON.stringify(a);
  const i1 = indexarJoiners(a), i2 = indexarJoiners([...a].reverse());
  assert.deepEqual(i1.porTwitter, i2.porTwitter);
  assert.equal(JSON.stringify(a), copia);
});

test("sync-masterlist.js usa o resolvedor e carrega as joiners em ordem fixa, e o upsert usa o cog existente", () => {
  const src = readFileSync(new URL("../scripts/sync-masterlist.js", import.meta.url), "utf8");
  assert.match(src, /from 'resolver-joiner\.js'|from '\.\/resolver-joiner\.js'/);
  assert.match(src, /select\('id, cog, email, twitter, confirmado'\)\.order\('id'/);
  assert.match(src, /cogDoUpsert\(j\.cog, idxJoiners\)/);
  assert.doesNotMatch(src, /byTwitter\[/, "nenhum índice 'última linha vence' restou");
});
