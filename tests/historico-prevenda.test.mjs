// Histórico dos formulários de pré-venda (src/historicoPreVenda.js): quem é o dono, o filtro enviado ao banco e o resumo de cada pedido. Rodar:  node --test tests/historico-prevenda.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { FORMS_PREVENDA, identidade, filtroDoDono, normalizarPedido, statusInfo, totaisDoPedido, pagamentoDoPedido, explicacaoDoPedido } from "../src/historicoPreVenda.js";
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
test("nenhuma tabela é consultada por uma coluna que ela não tem (colunas de dono conferidas contra o esquema real de 17/10 + MURCE-ITENS)", () => {
  const colunas = { pedidos_smolmerch: ["email", "social"], pedidos_murce_itens: ["email", "social"], pedidos_wmag: ["email", "social"], pedidos_wmag_leeknow: ["email", "social"], pedidos_dazed_seungmin: ["email", "social"], pedidos_dazed_han: ["email", "social"], pedidos_esquire_hyunjin: ["email", "social"], pedidos_bazaar_in: ["email", "social"],
    pedidos_revista: ["email", "social", "joiner_cog"], pedidos_singba: ["joiner_cog"], pedidos_popcorn_sleeve: ["joiner_cog"], pedidos_lightstick: ["joiner_cog"], pedidos_skzoo_rio: ["cog"], pedidos_popup: ["email", "social", "claim"], mercari_pedidos: ["joiner_cog"], formulario_pedidos: ["joiner_cog"],
    pedidos_dicon_origin: ["email", "social"], pedidos_promo_murce_50: ["email", "social"], pedidos_promo_makestar: ["email", "social"], pedidos_promo_50_murcekaly: ["email", "social"], pedidos_weverse_black_friday: ["email", "social"], pedidos_fans_promo: ["email", "social"], pedidos_bazaar_v: ["email", "social"] };
  for (const f of FORMS_PREVENDA) { assert.ok(colunas[f.tabela], f.tabela); assert.deepEqual([...f.dono].sort(), [...colunas[f.tabela]].sort(), f.tabela); }
  assert.equal(FORMS_PREVENDA.length, 23);
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
test("formulários novos (Dicon, Promo Murce 50, Makestar, Promo 50, Weverse, FANS PROMO, Bazaar V) entram no histórico com os itens", () => {
  const f = normalizarPedido(F("fans-promo"), { id: 9, created_at: "2026-11-21T10:00:00Z", status: "aguardando", valor_total: 136, forma_pagamento: "pix", itens: [{ produto: "SKZOO PLUSH 10CM Ver. - SKZ 5'CLOCK", opcao: "Bang Chan (Wolf Chan)", qtd: 2, preco: 68 }] });
  assert.equal(f.rotulo, "FANS PROMO"); assert.deepEqual(f.linhas, ["2× SKZOO PLUSH 10CM Ver. - SKZ 5'CLOCK · Bang Chan (Wolf Chan)"]); assert.equal(f.valor, 136); assert.equal(f.pagamento, "PIX"); assert.equal(f.status.chave, "pendente");
  assert.deepEqual(normalizarPedido(F("bazaar-v"), { id: 1, capa_a: 1, capa_f: 2 }).linhas, ["Versão A ×1", "Versão F ×2"]);
  for (const c of ["dicon-origin", "promo-murce-50", "promo-makestar", "promo-50-murcekaly", "weverse-black-friday"]) assert.ok(F(c), c);
});
test("explicação clara por situação e forma de pagamento + endereço do comprovante para a pessoa abrir", () => {
  const F2 = c => FORMS_PREVENDA.find(f => f.chave === c);
  const pix = normalizarPedido(F2("fans-promo"), { id: "a3ff1b42-0000", status: "aguardando", forma_pagamento: "pix", comprovante_url: "https://x/comprovantes/fans-promo/a.jpg", valor_total: 153, itens: [] });
  assert.equal(pix.comprovanteUrl, "https://x/comprovantes/fans-promo/a.jpg"); assert.equal(pix.temComprovante, true); assert.match(pix.explicacao, /comprovante do PIX/);
  assert.match(normalizarPedido(F2("fans-promo"), { id: 1, status: "aguardando", forma_pagamento: "pix" }).explicacao, /Aguardando o pagamento por PIX e o comprovante/);
  assert.match(normalizarPedido(F2("fans-promo"), { id: 2, status: "cartao", forma_pagamento: "cartao" }).explicacao, /cartão ainda sem comprovante/);
  assert.match(normalizarPedido(F2("fans-promo"), { id: 3, status: "cartao", forma_pagamento: "cartao", comprovante_url: "u" }).explicacao, /comprovante do cartão/);
  assert.match(normalizarPedido(F2("fans-promo"), { id: 4, status: "confirmado", forma_pagamento: "pix", comprovante_url: "u" }).explicacao, /confirmado pela equipe/);
  assert.match(normalizarPedido(F2("fans-promo"), { id: 5, status: "cancelado" }).explicacao, /cancelado/);
  assert.match(normalizarPedido(F2("smolmerch"), { id: 6, status: "pendente", forma_pagamento: "depois" }).explicacao, /ainda não feito/);
  assert.equal(normalizarPedido(F2("smolmerch"), { id: 7 }).comprovanteUrl, null);
  assert.equal(typeof explicacaoDoPedido({ status: { chave: "pendente" } }), "string");
});
test("situação em palavras da joiner", () => {
  for (const s of ["confirmado", "pago", "aprovado", "finalizado"]) assert.equal(statusInfo(s).chave, "confirmado", s);
  for (const s of ["cancelado", "recusado", "rejeitado"]) assert.equal(statusInfo(s).chave, "cancelado", s);
  for (const s of ["pendente", "aguardando", "cartao", null, "qualquer coisa"]) assert.equal(statusInfo(s).chave, "pendente", String(s));
  assert.equal(statusInfo("cartao").rotulo, "◉ cartão — confirmar pagamento");
});
