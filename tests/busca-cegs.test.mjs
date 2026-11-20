// Busca em "Resumo CEGs" (src/buscaCegsPuro.js). Rodar:  node --test tests/busca-cegs.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { norm, termosDe, casa, cegsPorNome, precoDaLinha, meusItensQueCasam, totaisDosMeus, itensDaComunidade } from "../src/buscaCegsPuro.js";

test("normaliza: sem acento, sem maiúscula, várias palavras = todas precisam aparecer", () => {
  assert.equal(norm("  SKZOO Pelúcia "), "skzoo pelucia");
  assert.deepEqual(termosDe("skzoo  plush"), ["skzoo", "plush"]);
  assert.equal(casa("SKZOO PLUSH 10CM Ver.", termosDe("plush skzoo")), true);
  assert.equal(casa("SKZOO PLUSH 10CM Ver.", termosDe("skzoo pelucia")), false);
  assert.equal(casa("Pelúcia", termosDe("pelucia")), true);
  assert.equal(casa("qualquer", []), false, "busca vazia não casa nada");
});

test("CEGs pelo nome", () => {
  assert.deepEqual(cegsPorNome(["THIS & THAT", "SKZOO EAAW", "Odd & Fresh"], termosDe("skzoo")), ["SKZOO EAAW"]);
  assert.deepEqual(cegsPorNome(["THIS & THAT"], termosDe("zzz")), []);
});

test("preço da linha da própria pessoa: item + frete + taxa RF + multa, com o que já foi pago", () => {
  const p = precoDaLinha({ valor_item: "100", frete_inter: 20.5, taxa_rf: "10", multa: null, pago_item: true, pago_frete: false, pago_rf: true });
  assert.deepEqual(p, { item: 100, frete: 20.5, rf: 10, multa: 0, total: 130.5, pagoItem: true, pagoFrete: false, pagoRf: true });
  assert.equal(precoDaLinha({ valor_item: "abc" }).total, 0, "texto no lugar de número vira 0");
});

test("seus itens: casa pelo item ou pelo nome da CEG e soma só o que casou", () => {
  const minhas = [
    { id: 1, ceg: "SKZOO EAAW", nome_do_item: "SKZOO PLUSH 10CM", valor_item: 100, frete_inter: 20, taxa_rf: 10 },
    { id: 2, ceg: "THIS & THAT", nome_do_item: "Álbum THIS", valor_item: 80, frete_inter: 15, taxa_rf: 0 },
    { id: 3, ceg: "OUTRA", nome_do_item: "SKZOO Tote", valor_item: 50, frete_inter: 5, taxa_rf: 5, multa: 2 },
  ];
  const achou = meusItensQueCasam(minhas, termosDe("skzoo"));
  assert.deepEqual(achou.map(r => r.id), [3, 1], "ordena por CEG");
  assert.deepEqual(totaisDosMeus(achou), { itens: 2, item: 150, frete: 25, rf: 15, multa: 2, total: 192 });
  assert.equal(meusItensQueCasam(minhas, termosDe("album")).length, 1);
});

test("comunidade: só a quantidade de pedidos por item e CEG, sem @, nome nem valor", () => {
  const porCeg = {
    "SKZOO EAAW": [{ nome_do_item: "SKZOO PLUSH 10CM", cog: "ana", nome: "Ana", valor_item: 999 }, { nome_do_item: "SKZOO PLUSH 10CM", cog: "bia" }, { nome_do_item: "SKZOO Tote", cog: "ana" }, { nome_do_item: "Album X", cog: "ana" }],
    "THIS & THAT": [{ nome_do_item: "Album Y", cog: "bia" }],
  };
  const g = itensDaComunidade(porCeg, termosDe("skzoo"));
  assert.equal(g.length, 1);
  assert.deepEqual(g[0], { ceg: "SKZOO EAAW", itens: [{ nome: "SKZOO PLUSH 10CM", qtd: 2 }, { nome: "SKZOO Tote", qtd: 1 }], pedidos: 3 });
  assert.ok(!JSON.stringify(g).match(/ana|bia|999|valor/i), "nada de pessoa nem valor no resultado");
});
