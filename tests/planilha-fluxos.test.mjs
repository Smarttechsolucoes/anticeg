// Fluxos Confirmar / Reabrir do painel (sem rede, sem alert/confirm reais). Rodar:  node --test tests/planilha-fluxos.test.mjs
import { chamadasBloqueadas } from "./helpers/sem-rede.mjs";   // nenhum fetch real
import test from "node:test";
import assert from "node:assert/strict";
import { confirmarEAvisar, mensagemReabrir } from "../src/planilhaFluxos.js";

const itens = [{ id_linha: "A1", ceg: "C", nome_do_item: "N1", valor_item: 10 }, { id_linha: "B2", ceg: "C", nome_do_item: "N2", frete_inter: 5 }];
const ok = { estado: "sucesso", atualizados: 2, naoProcessados: [], erro: null };
const ambiente = (respostas, { aceita = true } = {}) => {
  const log = { chamadas: [], avisos: [], perguntas: [] }; let n = 0;
  return { log, opts: {
    confirmar: async its => { log.chamadas.push(its.map(i => i.id_linha)); return respostas[Math.min(n++, respostas.length - 1)]; },
    perguntar: t => { log.perguntas.push(t); return aceita; },
    avisar: t => log.avisos.push(t),
  } };
};

test("sucesso total: nenhuma pergunta nem aviso; uma única chamada", async () => {
  const { log, opts } = ambiente([ok]);
  const r = await confirmarEAvisar(itens, [], opts);
  assert.equal(r.estado, "sucesso"); assert.equal(log.chamadas.length, 1); assert.equal(log.avisos.length, 0); assert.equal(log.perguntas.length, 0);
});

test("sem resposta (indeterminado): pergunta e, aceitando, reenvia TUDO; se agora confirmar, é sucesso", async () => {
  const { log, opts } = ambiente([{ estado: "indeterminado", naoProcessados: [], erro: "rede" }, ok]);
  const r = await confirmarEAvisar(itens, [], opts);
  assert.equal(r.estado, "sucesso"); assert.deepEqual(log.chamadas, [["A1", "B2"], ["A1", "B2"]]); assert.equal(log.perguntas.length, 1);
  assert.match(log.perguntas[0], /CONFIRMAR se a planilha foi atualizada/);
});

test("parcial: reenvia SÓ o item reenviável; o que exige decisão humana NÃO volta em loop", async () => {
  const parcial = { estado: "parcial", atualizados: 0, naoProcessados: [{ id_linha: "A1", motivo: "erro_ao_gravar" }, { id_linha: "B2", motivo: "id_ambiguo" }], erro: "parcial" };
  const { log, opts } = ambiente([parcial, ok]);
  const r = await confirmarEAvisar(itens, [], opts);
  assert.deepEqual(log.chamadas, [["A1", "B2"], ["A1"]]);
  assert.equal(r.estado, "sucesso");
});

test("recusa definitiva (ambíguo/inexistente): sem reenvio, aviso final com o motivo, estado pendente (NUNCA sucesso)", async () => {
  const recusa = { estado: "falha", atualizados: 0, naoProcessados: [{ id_linha: "A1", motivo: "id_ambiguo" }, { id_linha: "B2", motivo: "nao_encontrado" }], erro: "x" };
  const { log, opts } = ambiente([recusa]);
  const r = await confirmarEAvisar(itens, [], opts);
  assert.equal(r.estado, "pendente"); assert.equal(log.chamadas.length, 1); assert.equal(log.perguntas.length, 0);
  assert.match(log.avisos[0], /código repetido na planilha/); assert.match(log.avisos[0], /código não existe na planilha/);
});

test("administradora recusa reenviar: para, estado pendente, sem nova chamada", async () => {
  const { log, opts } = ambiente([{ estado: "indeterminado", naoProcessados: [], erro: "rede" }], { aceita: false });
  const r = await confirmarEAvisar(itens, [], opts);
  assert.equal(r.estado, "pendente"); assert.equal(log.chamadas.length, 1);
});

test("limite de rodadas: nunca fica em loop; o último estado é mostrado", async () => {
  const { log, opts } = ambiente([{ estado: "indeterminado", naoProcessados: [], erro: "rede" }]);
  const r = await confirmarEAvisar(itens, [], { ...opts, maxRodadas: 2 });
  assert.equal(r.estado, "pendente"); assert.equal(log.chamadas.length, 3); assert.equal(log.avisos.length, 1);
});

test("itens sem código: avisados uma vez só, mesmo com sucesso na planilha", async () => {
  const { log, opts } = ambiente([ok]);
  const r = await confirmarEAvisar(itens, [{ ceg: "P", nome_do_item: "Sem código" }], opts);
  assert.equal(r.estado, "sucesso_com_aviso"); assert.equal(log.avisos.length, 1); assert.match(log.avisos[0], /SEM código/);
});

test("itens sem código + falha: o aviso de 'sem código' aparece uma única vez (não repete a cada reenvio)", async () => {
  const { log, opts } = ambiente([{ estado: "indeterminado", naoProcessados: [], erro: "rede" }, ok]);
  await confirmarEAvisar(itens, [{ ceg: "P", nome_do_item: "Sem código" }], opts);
  const mencoes = [...log.perguntas, ...log.avisos].filter(t => /SEM código/.test(t)).length;
  assert.equal(mencoes, 1);
});

test("Reabrir: diz com todas as letras que a planilha NÃO é alterada e que rejeitar é o caminho para desmarcar", () => {
  const m = mensagemReabrir({ itens_mantidos: 0, itens_desmarcados: 0 });
  assert.match(m, /voltou para ANÁLISE/); assert.match(m, /planilha NÃO foi alterada/); assert.match(m, /rejeite o comprovante/);
  assert.doesNotMatch(m, /MANTIDAS/);
  const m2 = mensagemReabrir({ itens_mantidos: 2, itens_desmarcados: 3 });
  assert.match(m2, /3 marcação\(ões\).*desfeitas/); assert.match(m2, /2 marcação\(ões\) foram MANTIDAS/);
  assert.match(mensagemReabrir(null), /voltou para ANÁLISE/);
});

test("nenhum teste deste arquivo chegou à rede", () => assert.equal(chamadasBloqueadas.length, 0));
