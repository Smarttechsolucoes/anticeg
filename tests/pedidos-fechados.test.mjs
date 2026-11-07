// Acesso do site às tabelas fechadas (src/pedidosFechados.js, Q4 e Q5). Rodar: node --test tests/pedidos-fechados.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { TABELAS_Q4, TABELAS_Q5, tabelaQ4, tabelaQ5, tabelaFechada, tabelaPublica, criaPorFuncao, criarPedidoFechado, criarPedidoComoInsert, meusPedidosFechados, meusIdsFechados } from "../src/pedidosFechados.js";
import { FORMS_PREVENDA } from "../src/historicoPreVenda.js";

const cliente = respostas => { const chamadas = []; return { chamadas, rpc: async (nome, args) => { chamadas.push([nome, args]); return respostas[nome] ?? { data: null, error: null }; } }; };

test("quais tabelas estão fechadas (16 = 4 da Q4 + 12 da Q5) e de onde o público lê", () => {
  assert.equal(Object.keys(TABELAS_Q4).length, 4); assert.equal(Object.keys(TABELAS_Q5).length, 12);
  for (const t of ["pedidos_dicon_origin", "pedidos_promo_murce_50", "pedidos_murce_itens"]) assert.equal(tabelaPublica(t), t + "_publico");
  assert.equal(tabelaPublica("pedidos_smolmerch"), "pedidos_smolmerch_publico", "SMOL MERCH tem visão pública para o estoque");
  for (const t of ["pedidos_dazed_han", "pedidos_wmag", "pedidos_revista", "pedidos_lightstick", "mercari_pedidos", "joiners", "toString", "constructor", undefined]) assert.equal(tabelaPublica(t), t, String(t));
  for (const t of ["toString", "constructor", "__proto__", "mercari_pedidos", "joiners", undefined]) assert.equal(tabelaFechada(t), false, String(t));
  assert.equal(tabelaQ4("pedidos_smolmerch"), false); assert.equal(tabelaQ5("pedidos_dicon_origin"), false);
});
test("as 8 lojas que recebem o número de volta são criadas por função; as 4 de inserção direta não", () => {
  const porFuncao = Object.keys(TABELAS_Q5).filter(criaPorFuncao).sort();
  assert.deepEqual(porFuncao, ["pedidos_bazaar_in", "pedidos_dazed_seungmin", "pedidos_esquire_hyunjin", "pedidos_popup", "pedidos_revista", "pedidos_skzoo_rio", "pedidos_wmag", "pedidos_wmag_leeknow"]);
  assert.equal(criaPorFuncao("pedidos_dazed_han"), true, "Dazed Han também (Q4)");
  for (const t of ["pedidos_smolmerch", "pedidos_singba", "pedidos_popcorn_sleeve", "pedidos_lightstick", "pedidos_dicon_origin", "joiners"]) assert.equal(criaPorFuncao(t), false, t);
});
test("as chaves do histórico do site batem com as da lista (se uma loja mudar de chave, o histórico dela quebraria em silêncio)", () => {
  const chavesSite = Object.fromEntries(FORMS_PREVENDA.map(f => [f.tabela, f.chave]));
  for (const [t, { forma }] of Object.entries(TABELAS_Q5)) assert.equal(chavesSite[t], forma, t);
  for (const [t, chave] of Object.entries(TABELAS_Q4)) if (chavesSite[t]) assert.equal(chavesSite[t], chave, t);
});
test("criar pedido por função: Q5 devolve o número; Dazed Han usa a função da Q4; tabela errada é recusada no navegador", async () => {
  const c = cliente({ q5_criar_pedido: { data: { id: "42" }, error: null } });
  assert.deepEqual(await criarPedidoFechado("pedidos_revista", { nome: "A" }, c), { id: "42", error: null });
  assert.deepEqual(c.chamadas, [["q5_criar_pedido", { p_tabela: "pedidos_revista", p: { nome: "A" } }]]);
  const h = cliente({ q4_criar_pedido_dazed_han: { data: 77, error: null } });
  assert.deepEqual(await criarPedidoFechado("pedidos_dazed_han", { nome: "A" }, h), { id: 77, error: null });
  await assert.rejects(() => criarPedidoFechado("pedidos_lightstick", {}, cliente({})), /não é criada por função/);
  await assert.rejects(() => criarPedidoFechado("joiners", {}, cliente({})), /não é criada por função/);
  const e = await criarPedidoFechado("pedidos_popup", {}, cliente({ q5_criar_pedido: { data: null, error: { message: "pedido inválido" } } }));
  assert.equal(e.id, null); assert.equal(e.error.message, "pedido inválido");
  assert.deepEqual(await criarPedidoComoInsert("pedidos_wmag", {}, cliente({ q5_criar_pedido: { data: { id: "5" }, error: null } })), { data: { id: "5" }, error: null }, "no formato { data: { id } } que os formulários já usavam");
  assert.equal((await criarPedidoComoInsert("pedidos_wmag", {}, cliente({ q5_criar_pedido: { data: null, error: { message: "x" } } }))).data, null);
});
test("histórico próprio: Q4 e Q5 chamam a função certa com a chave certa; erro do servidor não vira lista vazia", async () => {
  const c4 = cliente({ q4_meus_pedidos: { data: [{ id: 1 }], error: null } });
  assert.deepEqual(await meusPedidosFechados("pedidos_murce_itens", { email: "a@b.com", arroba: "ana" }, c4), [{ id: 1 }]);
  assert.deepEqual(c4.chamadas, [["q4_meus_pedidos", { p_form: "murce-itens", p_email: "a@b.com", p_social: "ana" }]]);
  const c5 = cliente({ q5_meus_pedidos: { data: [{ id: 2 }], error: null } });
  assert.deepEqual(await meusPedidosFechados("pedidos_skzoo_rio", { cog: "ana" }, c5), [{ id: 2 }]);
  assert.deepEqual(c5.chamadas, [["q5_meus_pedidos", { p_form: "popup-skzoo-rio", p_email: null, p_social: null, p_cog: "ana" }]]);
  assert.deepEqual(await meusPedidosFechados("pedidos_revista", { email: "", arroba: "", cog: "" }, cliente({ q5_meus_pedidos: { data: null, error: null } })), []);
  await assert.rejects(() => meusPedidosFechados("pedidos_revista", { email: "a@b.com" }, cliente({ q5_meus_pedidos: { data: null, error: new Error("falhou") } })), /falhou/);
});
test("marca 'seu pedido' (Q4): erro vira lista vazia", async () => {
  assert.deepEqual(await meusIdsFechados("pedidos_dicon_origin", "ana", cliente({ q4_meus_ids: { data: [{ id: "x", social: "@ana" }], error: null } })), [{ id: "x", social: "@ana" }]);
  assert.deepEqual(await meusIdsFechados("pedidos_dicon_origin", "ana", cliente({ q4_meus_ids: { data: null, error: new Error("x") } })), []);
});
