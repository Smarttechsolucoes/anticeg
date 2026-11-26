// Lógica das tarefas de cadastro no painel (sem navegador): rótulos, regra de falha não vista, aviso do navegador e link direto.
// Rodar: node --test tests/cadastro-tarefas-logica.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { linkTarefa, precisaAtencaoNaoVista, rotuloPlanilha, rotuloLeitura, textoNotificacao, notificarNovas } from "../src/cadastroTarefasLogica.js";

const T = (o = {}) => ({ id: 1, cog: "ana", tipo: "alteracao", campos: { nome: { de: "A", para: "B" } }, planilha_status: "pendente", planilha_tentativas: 0, lida_em: null, resolvida_em: null, atencao_desde: null, atencao_vista_em: null, pendente: true, ...o });

test("link direto da tarefa abre a aba Atualizações com o número", () => { assert.equal(linkTarefa(12), "/admin/atualizacoes?tarefa=12"); });
test("estado da PLANILHA e da LEITURA são rótulos independentes", () => {
  const lidaMasPendente = T({ lida_em: "2026-11-26T10:00:00Z" });
  assert.equal(rotuloLeitura(lidaMasPendente).texto, "Lida"); assert.equal(rotuloPlanilha(lidaMasPendente).texto, "Planilha: pendente");
  const sinc = T({ planilha_status: "sincronizada", planilha_tentativas: 3 });
  assert.equal(rotuloLeitura(sinc).texto, "Não lida", "sincronizada NÃO vira lida"); assert.equal(rotuloPlanilha(sinc).texto, "Planilha: sincronizada");
  assert.equal(rotuloPlanilha(T({ planilha_tentativas: 2 })).texto, "Planilha: pendente (2 tentativas)");
  assert.equal(rotuloPlanilha(T({ planilha_status: "atencao" })).texto, "Planilha: precisa de atenção");
  assert.equal(rotuloLeitura(T({ resolvida_em: "2026-11-26T11:00:00Z" })).texto, "Resolvida");
});
test("falha que exige atenção só deixa de ser 'não vista' depois de 'vi a falha' e VOLTA quando a falha é mais nova", () => {
  const a = T({ planilha_status: "atencao", atencao_desde: "2026-11-26T10:00:00Z" });
  assert.equal(precisaAtencaoNaoVista(a), true);
  assert.equal(precisaAtencaoNaoVista({ ...a, atencao_vista_em: "2026-11-26T10:05:00Z" }), false);
  assert.equal(precisaAtencaoNaoVista({ ...a, atencao_vista_em: "2026-11-26T10:05:00Z", atencao_desde: "2026-11-26T11:00:00Z" }), true, "nova falha depois do 'vi'");
  assert.equal(precisaAtencaoNaoVista(T({ planilha_status: "sincronizada" })), false);
});
test("texto do aviso: tarefa nova x falha da planilha em tarefa já lida x pedido", () => {
  assert.equal(textoNotificacao(T()).titulo, "Cadastro alterado");
  const falha = textoNotificacao(T({ lida_em: "x", planilha_status: "atencao", atencao_desde: "2026-11-26T10:00:00Z", planilha_motivo: "linha_nao_encontrada" }));
  assert.equal(falha.titulo, "Cadastro: a planilha precisa de atenção"); assert.match(falha.corpo, /Não achei a linha em Dados/);
  assert.equal(textoNotificacao(T({ tipo: "solicitacao", campos: { email: { pedido: "x@y.com" } } })).titulo, "Cadastro: novo pedido de alteração");
});
function fakeNotif(permissao = "granted") {
  const criadas = []; class N { static permission = permissao; constructor(t, o) { this.titulo = t; this.opcoes = o; this.fechada = false; criadas.push(this); } close() { this.fechada = true; } }
  return { N, criadas };
}
test("aviso do navegador: a 1ª checagem só marca a base; depois avisa SÓ o que entrou ou voltou a ser pendência; clicar abre a tarefa", () => {
  const { N, criadas } = fakeNotif(); const vistas = { current: null }; const abertas = [];
  const t1 = T({ id: 1 });
  assert.equal(notificarNovas([t1], vistas, N, id => abertas.push(id)), 0); assert.equal(criadas.length, 0, "o que já existia não avisa");
  assert.equal(notificarNovas([t1], vistas, N, id => abertas.push(id)), 0, "repetir a checagem não repete o aviso");
  const t2 = T({ id: 2, cog: "bia" });
  assert.equal(notificarNovas([t1, t2], vistas, N, id => abertas.push(id)), 1); assert.equal(criadas.length, 1);
  assert.equal(criadas[0].opcoes.tag, "cadastro-tarefa-2"); criadas[0].onclick(); assert.deepEqual(abertas, [2]); assert.equal(criadas[0].fechada, true);
  const t1lida = T({ id: 1, lida_em: "x", pendente: false });
  assert.equal(notificarNovas([t1lida, t2], vistas, N, () => {}), 0, "ler uma tarefa não gera aviso");
  const t1falha = T({ id: 1, lida_em: "x", planilha_status: "atencao", atencao_desde: "2026-11-26T12:00:00Z", pendente: true });
  assert.equal(notificarNovas([t1falha, t2], vistas, N, () => {}), 1, "falha que exige atenção em tarefa JÁ LIDA volta a avisar"); assert.equal(criadas.length, 2);
  const t1falha2 = { ...t1falha, atencao_desde: "2026-11-26T13:00:00Z" };
  assert.equal(notificarNovas([t1falha2, t2], vistas, N, () => {}), 1, "nova falha (outro atencao_desde) avisa de novo");
});
test("sem permissão ou sem suporte: nada é criado, mas a base continua sendo atualizada e nada quebra", () => {
  const { N, criadas } = fakeNotif("denied"); const vistas = { current: new Set() };
  assert.equal(notificarNovas([T()], vistas, N, () => {}), 1); assert.equal(criadas.length, 0);
  assert.doesNotThrow(() => notificarNovas([T({ id: 9 })], vistas, null, () => {}));
});
