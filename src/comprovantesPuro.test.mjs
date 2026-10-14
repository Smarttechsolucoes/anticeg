// Rodar: node --test src/comprovantesPuro.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { referenciaDeComprovante, enderecosDeComprovante, substituirEnderecos } from "./comprovantesPuro.js";

const BASE = "https://abc.supabase.co/storage/v1/object";
test("referência: lê bucket e caminho das URLs que o site gravou (public, sign e com query)", () => {
  assert.deepEqual(referenciaDeComprovante(`${BASE}/public/comprovantes/wmag/1700000000000.jpg`), { bucket: "comprovantes", path: "wmag/1700000000000.jpg" });
  assert.deepEqual(referenciaDeComprovante(`${BASE}/public/mercari-comprovantes/ana_1.png`), { bucket: "mercari-comprovantes", path: "ana_1.png" });
  assert.deepEqual(referenciaDeComprovante(`${BASE}/sign/comprovantes/a/b.pdf?token=xyz`), { bucket: "comprovantes", path: "a/b.pdf" });
  assert.deepEqual(referenciaDeComprovante(`${BASE}/public/comprovantes/pagamentos/Comprovante%20final.pdf`), { bucket: "comprovantes", path: "pagamentos/Comprovante final.pdf" });
});
test("referência: o que não é de bucket de comprovantes vira null", () => {
  for (const v of [null, undefined, "", "https://exemplo.com/foto.jpg", `${BASE}/public/avatars/ana.png`, `${BASE}/public/fotos-itens/x.jpg`, "texto qualquer"]) assert.equal(referenciaDeComprovante(v), null, String(v));
});
test("HTML: acha só endereços de comprovante e troca todos pelos links assinados", () => {
  const u1 = `${BASE}/public/comprovantes/a/1.jpg`, u2 = `${BASE}/public/mercari-comprovantes/b_2.pdf`, foto = `${BASE}/public/avatars/ana.png`;
  const html = `<img src="${u1}"><a href="${u1}">abrir</a><embed src="${u2}"><img src="${foto}">`;
  assert.deepEqual(enderecosDeComprovante(html).sort(), [u1, u2].sort());
  const saida = substituirEnderecos(html, { [u1]: "https://assinado/1", [u2]: "" });
  assert.equal(saida, `<img src="https://assinado/1"><a href="https://assinado/1">abrir</a><embed src=""><img src="${foto}">`);
});
