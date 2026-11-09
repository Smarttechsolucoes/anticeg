// Testes da "Fila por pessoa" do painel (só lógica pura: sem React, sem rede).
// Rodar: node --test tests/filaPessoas.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { montarFila, oQueConferir, acaoNecessaria, motivoTroca, diasDeEspera, MOTIVOS_LISTA } from "../src/filaPessoas.js";

const troca = (o = {}) => ({ id: 1, joiner_id: 7, cog: "bia", via: "sem_acesso", desfecho: "sem_acesso", novo_dominio: "gmail.com", novo_verificado_em: "2026-11-09T15:00:00Z", criado_em: "2026-11-09T14:50:00Z", ...o });
const comp = (o = {}) => ({ id: 2, joiner_id: 8, cog: "caio", via: "sem_perfil", desafio_validado: false, detalhe: "Paguei em outubro.", itens: 3, criado_em: "2026-11-09T10:00:00Z", expira_em: "2026-11-16T10:00:00Z", ...o });
const sol = (o = {}) => ({ id: 41, joiner_id: 9, cog: "duda", tipo: "ativacao_ajuda", valor_pedido: "whatsapp 11 9", mensagem: "não recebi", status: "aberta", criado_em: "2026-11-08T10:00:00Z", ...o });
const vinc = (o = {}) => ({ joiner_id: 10, cog: "eva", nome_site: "Eva", dominio: "exemplo.com", tem_conta: false, itens: 2, pedido_de_ajuda: true, ...o });

test("junta numa pessoa só o pedido de troca, a solicitação e o vínculo a confirmar", () => {
  const f = montarFila({ trocas: [troca()], solicitacoes: [sol({ joiner_id: 7, cog: "bia" })], aConfirmar: [vinc({ joiner_id: 7, cog: "bia", dominio: "exemplo.com", itens: 5 })] });
  assert.equal(f.length, 1); const p = f[0];
  assert.equal(p.joiner_id, 7); assert.equal(p.troca.id, 1); assert.equal(p.solicitacoes.length, 1); assert.equal(p.vinculo.joiner_id, 7); assert.equal(p.itens, 5); assert.equal(p.dominio, "exemplo.com");
});

test("só entra quem tem algo a decidir; quem apenas está na lista de vínculos sem pedir ajuda fica de fora", () => {
  const f = montarFila({ aConfirmar: [vinc({ joiner_id: 1, pedido_de_ajuda: false }), vinc({ joiner_id: 2, pedido_de_ajuda: true })], solicitacoes: [sol({ status: "resolvida", joiner_id: 3 }), sol({ joiner_id: null })] });
  assert.deepEqual(f.map(p => p.joiner_id), [2]);
});

test("ordem: com prova anexada primeiro, depois solicitações, depois quem só pediu ajuda; o mais antigo primeiro", () => {
  const f = montarFila({
    aConfirmar: [vinc({ joiner_id: 10 })], solicitacoes: [sol({ joiner_id: 9 })],
    trocas: [troca({ joiner_id: 7, criado_em: "2026-11-09T14:00:00Z" })], comprovacoes: [comp({ joiner_id: 8, criado_em: "2026-11-09T09:00:00Z" })],
  });
  assert.deepEqual(f.map(p => p.joiner_id), [8, 7, 9, 10]);
});

test("o que conferir: troca sem acesso diz que o e-mail novo NÃO prova quem é e que o e-mail completo será digitado", () => {
  const [p] = montarFila({ trocas: [troca()] }); const t = oQueConferir(p).join(" ");
  assert.match(t, /só prova que a pessoa lê ESSE endereço, não QUEM ela é/); assert.match(t, /COMPLETO/); assert.match(t, /NÃO libera a ativação/);
  assert.match(acaoNecessaria(p), /aplicar \(ou cancelar\) a troca/);
  assert.match(motivoTroca(p.troca), /NÃO tem acesso ao e-mail antigo/);
});

test("troca que faria perder a liberação explica o motivo e orienta a marcar o vínculo só com certeza", () => {
  const [p] = montarFila({ trocas: [troca({ via: "email_antigo", desfecho: "perderia_liberacao" })] });
  assert.match(motivoTroca(p.troca), /PERDER a liberação/); assert.match(oQueConferir(p).join(" "), /confirmar também o vínculo/);
  const [q] = montarFila({ trocas: [troca({ via: "email_antigo", desfecho: "identidade_independente" })] }); assert.match(motivoTroca(q.troca), /NÃO é liberado pela regra/);
});

test("o que conferir: comprovação diz que o texto NÃO é prova; desafio de DM pendente pede validação antes de aprovar", () => {
  const [p] = montarFila({ comprovacoes: [comp()] }); const t = oQueConferir(p).join(" ");
  assert.match(t, /NÃO é prova|não é prova/); assert.match(acaoNecessaria(p), /aprovar ou recusar/); assert.doesNotMatch(t, /mensagem direta/);
  const [d] = montarFila({ comprovacoes: [comp({ via: "perfil_conhecido" })] }); assert.match(oQueConferir(d).join(" "), /validar o código/);
  const [v] = montarFila({ comprovacoes: [comp({ via: "perfil_conhecido", desafio_validado: true })] }); assert.doesNotMatch(oQueConferir(v).join(" "), /validar o código/);
});

test("pessoa só com pedido de ajuda: orienta a confirmar o vínculo; nenhum texto cita e-mail completo", () => {
  const [p] = montarFila({ aConfirmar: [vinc()] }); assert.match(acaoNecessaria(p), /Confirmar o vínculo/);
  for (const s of [...oQueConferir(p), ...oQueConferir(montarFila({ trocas: [troca()] })[0]), ...oQueConferir(montarFila({ comprovacoes: [comp()] })[0])]) assert.doesNotMatch(s, /[\w.+-]+@[\w-]+\.\w+/);
});

test("entradas ausentes não quebram", () => { assert.deepEqual(montarFila(), []); assert.deepEqual(montarFila({ trocas: [], comprovacoes: [], solicitacoes: [], aConfirmar: [], motivos: {} }), []); });

test("incluirTodos traz quem nunca pediu nada; sem ele só entra quem pediu ajuda", () => {
  const aConfirmar = [vinc({ joiner_id: 1, pedido_de_ajuda: false }), vinc({ joiner_id: 2, pedido_de_ajuda: true })];
  assert.deepEqual(montarFila({ aConfirmar }).map(p => p.joiner_id), [2]);
  const todos = montarFila({ aConfirmar, incluirTodos: true });
  assert.deepEqual(todos.map(p => [p.joiner_id, p.situacao]), [[2, "ajuda"], [1, "nada"]]);
});

test("situação: prova > ajuda > nada, e a ordem da lista segue essa prioridade", () => {
  const f = montarFila({ trocas: [troca({ joiner_id: 3 })], solicitacoes: [sol({ joiner_id: 4 })], aConfirmar: [vinc({ joiner_id: 5, pedido_de_ajuda: false })], incluirTodos: true });
  assert.deepEqual(f.map(p => [p.joiner_id, p.situacao]), [[3, "prova"], [4, "ajuda"], [5, "nada"]]);
});

test("motivo do bloqueio vira um grupo curto; sem informação e sem domínio é 'sem e-mail'; o resto é 'outro'", () => {
  const motivos = { 1: { codigo: "historico_troca_email" }, 2: { codigo: "historico_so_arroba" }, 3: { codigo: "email_compartilhado" }, 4: { codigo: "diverge_fotografia" }, 5: { codigo: "sem_email_valido" }, 6: { codigo: "arroba_repetido" } };
  const aConfirmar = [1, 2, 3, 4, 5, 6, 7, 8].map(id => vinc({ joiner_id: id, cog: "p" + id, dominio: id === 8 ? "" : "exemplo.com" }));
  const f = montarFila({ aConfirmar, motivos, incluirTodos: true });
  const m = Object.fromEntries(f.map(p => [p.joiner_id, p.motivoChave]));
  assert.deepEqual(m, { 1: "historico", 2: "historico", 3: "compartilhado", 4: "diverge", 5: "sem_email", 6: "arroba", 7: "outro", 8: "sem_email" });
  assert.ok(Object.keys(MOTIVOS_LISTA).includes("outro"));
});

test("dias de espera: contados desde o pedido mais antigo; sem pedido = null", () => {
  const agora = new Date("2026-11-12T12:00:00Z");
  const [p] = montarFila({ trocas: [troca({ criado_em: "2026-11-09T09:00:00Z" })] });
  assert.equal(diasDeEspera(p, agora), 3);
  const [q] = montarFila({ aConfirmar: [vinc()], incluirTodos: true });
  assert.equal(diasDeEspera(q, agora), null);
  const [r] = montarFila({ trocas: [troca({ criado_em: "2026-11-12T11:00:00Z" })] });
  assert.equal(diasDeEspera(r, agora), 0);
});
