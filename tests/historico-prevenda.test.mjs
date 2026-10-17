// Histórico dos formulários de pré-venda (src/historicoPreVenda.js): quem é o dono, o filtro enviado ao banco e o resumo de cada pedido. Rodar:  node --test tests/historico-prevenda.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { FORMS_PREVENDA, identidade, filtroDoDono, normalizarPedido, statusInfo, totaisDoPedido, pagamentoDoPedido } from "../src/historicoPreVenda.js";
const F = c => FORMS_PREVENDA.find(f => f.chave === c);

test("identidade: visitante e sem dados não têm histórico; @ vem do twitter ou do cog, sem @ e em minúsculas", () => {
  assert.equal(identidade(null), null); assert.equal(identidade({ guest: true, cog: "x" }), null); assert.equal(identidade({}), null);
  assert.deepEqual(identidade({ cog: "Ana_Z", email: " Ana@Exemplo.COM ", twitter: "@Ana_Twitter" }), { email: "ana@exemplo.com", cog: "ana_z", arroba: "ana_twitter" });
  assert.deepEqual(identidade({ cog: "bia" }), { email: null, cog: "bia", arroba: "bia" });
});
const BS = String.fromCharCode(92);   // a barra invertida que escapa _ e % no ilike
test("filtro: cada tabela só usa as colunas de dono que ela tem; curingas do ilike são escapados e o valor vai entre aspas", () => {
  const id = { email: "a_b%@x.com", cog: "ana", arroba: "ana" };
  assert.equal(filtroDoDono(F("smolmerch"), id), `email.ilike."a${BS}_b${BS}%@x.com",social.ilike."@ana",social.ilike."ana"`);
  assert.equal(filtroDoDono(F("singba"), id), 'joiner_cog.ilike."ana"');
  assert.equal(filtroDoDono(F("popup-skzoo-rio"), id), 'cog.ilike."ana"');
  assert.equal(filtroDoDono(F("popup-this-that"), id), `email.ilike."a${BS}_b${BS}%@x.com",social.ilike."@ana",social.ilike."ana",claim.ilike."ana"`);
  assert.equal(filtroDoDono(F("revista"), id).split(",").length, 4);
  assert.equal(filtroDoDono(F("smolmerch"), { email: null, cog: null, arroba: null }), null);
  assert.equal(filtroDoDono(F("singba"), { email: "a@b.com", cog: null, arroba: null }), null, "tabela só por COG sem COG: não consulta");
  assert.equal(filtroDoDono(F("smolmerch"), null), null);
});
test("nenhuma tabela é consultada por uma coluna que ela não tem (colunas de dono conferidas contra o esquema real de 17/10)", () => {
  const colunas = { pedidos_smolmerch: ["email", "social"], pedidos_wmag: ["email", "social"], pedidos_wmag_leeknow: ["email", "social"], pedidos_dazed_seungmin: ["email", "social"], pedidos_esquire_hyunjin: ["email", "social"], pedidos_bazaar_in: ["email", "social"],
    pedidos_revista: ["email", "social", "joiner_cog"], pedidos_singba: ["joiner_cog"], pedidos_popcorn_sleeve: ["joiner_cog"], pedidos_lightstick: ["joiner_cog"], pedidos_skzoo_rio: ["cog"], pedidos_popup: ["email", "social", "claim"], mercari_pedidos: ["joiner_cog"], formulario_pedidos: ["joiner_cog"] };
  for (const f of FORMS_PREVENDA) { assert.ok(colunas[f.tabela], f.tabela); assert.deepEqual([...f.dono].sort(), [...colunas[f.tabela]].sort(), f.tabela); }
  assert.equal(FORMS_PREVENDA.length, 14);
});
test("resumo: SMOL MERCH lista item e quantidade; capas só as pedidas; valor e pagamento", () => {
  const s = normalizarPedido(F("smolmerch"), { id: 7, created_at: "2026-10-17T12:00:00Z", status: "pendente", valor_total: 62, qtd_total: 2, forma_pagamento: "depois", itens: [{ produto: "Miso PVC Candy Pouch", opcao: "Candy Pouch", qtd: 2, preco: 32 }, { produto: "Han BDAY", opcao: "Adesivo", qtd: 1 }] });
  assert.deepEqual(s.linhas, ["2× Miso PVC Candy Pouch · Candy Pouch", "1× Han BDAY · Adesivo"]); assert.equal(s.valor, 62); assert.equal(s.pagamento, "pagar depois"); assert.equal(s.status.chave, "pendente");
  const w = normalizarPedido(F("wmag-hyunjin"), { id: 1, capa_a: 1, capa_b: 0, capa_c: 2, valor_total: 120, status: "confirmado", forma_pagamento: "pix", comprovante_url: "x" });
  assert.deepEqual(w.linhas, ["Capa A ×1", "Capa C ×2"]); assert.equal(w.pagamento, "PIX"); assert.equal(w.temComprovante, true); assert.equal(w.status.tom, "ok");
  const sk = normalizarPedido(F("popup-skzoo-rio"), { id: 2, itens: [{ nome: "Wolf Chan", qtd: 2 }], total_reais: 90, status: "pago", pagamento: "01" });
  assert.deepEqual(sk.linhas, ["2× Wolf Chan"]); assert.equal(sk.valor, 90); assert.equal(sk.pagamento, null, "'01' é a semana, não a forma de pagamento");
});
test("formulario_pedidos: o título do cartão é o evento (Promo 13, Odd & Fresh...) e a linha é a modalidade", () => {
  const r = normalizarPedido(F("formularios"), { id: 3, evento: "PROMO 13", modalidade: "Item avulso", status: "pendente" });
  assert.equal(r.rotulo, "PROMO 13"); assert.deepEqual(r.linhas, ["Item avulso"]);
  assert.equal(normalizarPedido(F("formularios"), { id: 4 }).rotulo, "FORMULÁRIO");
});
test("resumo aguenta dados faltando ou fora do formato (itens nulos, texto no lugar de número)", () => {
  for (const f of FORMS_PREVENDA) { const r = normalizarPedido(f, { id: 1, itens: null, valor_total: "abc", capa_a: null }); assert.ok(Array.isArray(r.linhas)); assert.equal(r.valor, 0); }
  assert.deepEqual(totaisDoPedido({ valor_brl_total: "120.5", quantidade: "3" }), { valor: 120.5, qtd: 3 });
  assert.equal(pagamentoDoPedido({ metodo_pagamento: "imediato" }), "pagamento imediato");
});
test("situação em palavras da joiner", () => {
  for (const s of ["confirmado", "pago", "aprovado", "finalizado"]) assert.equal(statusInfo(s).chave, "confirmado", s);
  for (const s of ["cancelado", "recusado", "rejeitado"]) assert.equal(statusInfo(s).chave, "cancelado", s);
  for (const s of ["pendente", "aguardando", "cartao", null, "qualquer coisa"]) assert.equal(statusInfo(s).chave, "pendente", String(s));
  assert.equal(statusInfo("cartao").rotulo, "◉ cartão — confirmar pagamento");
});
