// Testes da "Fila por pessoa" do painel (só lógica pura: sem React, sem rede).
// Rodar: node --test tests/filaPessoas.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { montarFila, oQueConferir, acaoNecessaria, motivoTroca, diasDeEspera, MOTIVOS_LISTA, conferencias, provasDe, citaOutroProblema, mensagemSolicitacao } from "../src/filaPessoas.js";

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

test("quem não está na lista de vínculos: o que não se sabe fica desconhecido (nunca zero nem 'sem e-mail'); extras preenchem o que foi lido do cadastro", () => {
  const [sem] = montarFila({ solicitacoes: [sol({ joiner_id: 20, cog: "x" })] });
  assert.equal(sem.itens, null); assert.equal(sem.dominio, null); assert.equal(sem.tem_conta, null); assert.equal(sem.motivoChave, "outro");
  const [com] = montarFila({ solicitacoes: [sol({ joiner_id: 20, cog: "x" })], extras: { 20: { nome: "Estilo", dominio: "gmail.com", tem_conta: false } } });
  assert.equal(com.nome, "Estilo"); assert.equal(com.dominio, "gmail.com"); assert.equal(com.itens, null);
  const [semEmail] = montarFila({ solicitacoes: [sol({ joiner_id: 20, cog: "x" })], extras: { 20: { nome: "", dominio: "", tem_conta: false } } });
  assert.equal(semEmail.motivoChave, "sem_email", "e-mail realmente ausente (lido do cadastro) vira 'sem e-mail'");
});

test("quem já tem conta: situação 'conta', vai para o fim, motivo 'já ativou', e o texto diz que basta fechar o pedido", () => {
  const f = montarFila({ solicitacoes: [sol({ joiner_id: 21, cog: "contaativa" }), sol({ id: 42, joiner_id: 22, cog: "outra" })], extras: { 21: { nome: "S", dominio: "gmail.com", tem_conta: true }, 22: { nome: "O", dominio: "gmail.com", tem_conta: false } } });
  assert.deepEqual(f.map(p => [p.joiner_id, p.situacao, p.motivoChave]), [[22, "ajuda", "outro"], [21, "conta", "ativou"]]);
  const conta = f[1];
  assert.match(acaoNecessaria(conta), /só então feche-o/); assert.match(oQueConferir(conta).join(" "), /JÁ TEM CONTA/);
  const [vinculoComConta] = montarFila({ aConfirmar: [vinc({ joiner_id: 23, tem_conta: true })], incluirTodos: true });
  assert.equal(vinculoComConta.situacao, "conta");
  const [prova] = montarFila({ trocas: [troca({ joiner_id: 24 })], extras: { 24: { tem_conta: true } } });
  assert.equal(prova.situacao, "prova", "com pedido de troca/comprovação a situação continua sendo 'prova'");
});

// ───────── atendimento orientado: conferências, provas e orientação ─────────
const fx = (o = {}) => ({ tem_conta: false, conta_criada_em: null, ultimo_login: null, bloqueado: false, email_valido: true, email_dominio: "exemplo.com", email_exclusivo: true, liberado: false, identidade_confirmada: false, itens: 3, pagamentos: 1, ...o });
const com = (f, extra = {}) => montarFila({ solicitacoes: [sol({ joiner_id: 50, cog: "zz", ...extra })], fatos: { 50: f } })[0];

test("orientação: já tem conta → login ou recuperação de senha, com nota pronta; o texto não promete encerrar sozinho", () => {
  const p = com(fx({ tem_conta: true, conta_criada_em: "2026-11-08T22:09:00Z", ultimo_login: "2026-11-09T11:56:00Z" }));
  assert.equal(p.orientacao.tipo, "conta"); assert.equal(p.situacao, "conta");
  assert.match(p.orientacao.passos.join(" "), /Esqueci minha senha/); assert.match(p.orientacao.passos.join(" "), /outro problema/);
  assert.match(p.orientacao.mensagem, /zz/); assert.match(p.orientacao.nota, /já tem conta/);
  assert.match(p.orientacao.resumo, /criada em 08\/11, entrou em 09\/11/);
});

test("orientação: liberada pela regra → pode ativar (pedir o código de novo); bloqueado nunca é 'pode ativar'", () => {
  const p = com(fx({ liberado: true }));
  assert.equal(p.orientacao.tipo, "ativar"); assert.match(p.orientacao.passos.join(" "), /pedir o código de novo/); assert.match(p.orientacao.mensagem, /@exemplo\.com/);
  assert.equal(com(fx({ liberado: true, bloqueado: true })).orientacao.tipo, "analise");
});

test("orientação: e-mail ausente, inválido ou compartilhado → corrigir o e-mail pelo fluxo de troca", () => {
  for (const o of [{ email_valido: false, email_dominio: null, email_exclusivo: false }, { email_exclusivo: false }]) {
    const p = com(fx(o)); assert.equal(p.orientacao.tipo, "corrigir_email"); assert.match(p.orientacao.passos.join(" "), /Quero mudar de e-mail/); assert.match(p.orientacao.mensagem, /perdi o acesso/);
  }
});

test("orientação: bloqueio da regra com e-mail bom → precisa de análise, dizendo exatamente o que falta; nada é fechado sozinho", () => {
  const p = com(fx());
  assert.equal(p.orientacao.tipo, "analise"); assert.equal(p.orientacao.nota, null);
  assert.match(p.orientacao.falta.join(" "), /Reconhecer a pessoa por um canal já conhecido/); assert.match(p.orientacao.falta.join(" "), /colar abaixo/);
  assert.match(p.orientacao.mensagem, /comprovar meu cadastro/);
});

test("orientação com pedido de troca ou de comprovação é sempre 'precisa de análise' (mesmo com conta ou liberada)", () => {
  const t = montarFila({ trocas: [troca({ joiner_id: 51 })], fatos: { 51: fx({ liberado: true, tem_conta: true }) } })[0];
  assert.equal(t.orientacao.tipo, "analise"); assert.match(t.orientacao.falta.join(" "), /só provou que ela lê o e-mail novo/);
  const c = montarFila({ comprovacoes: [comp({ joiner_id: 52 })], fatos: { 52: fx() } })[0];
  assert.equal(c.orientacao.tipo, "analise"); assert.match(c.orientacao.falta.join(" "), /é texto dela, não prova/);
});

test("sem conferências automáticas: orientação 'desconhecido', sem checklist e sem nota pronta (nada é inventado)", () => {
  const p = montarFila({ solicitacoes: [sol({ joiner_id: 53 })] })[0];
  assert.equal(p.orientacao.tipo, "desconhecido"); assert.equal(p.orientacao.nota, null); assert.deepEqual(conferencias(p), []);
});

test("'com prova' separa código verificado, descrição enviada e identidade conferida", () => {
  const t = provasDe(montarFila({ trocas: [troca({ joiner_id: 54 })], fatos: { 54: fx() } })[0]);
  assert.deepEqual([t.codigo.estado, t.descricao.estado, t.identidade.estado], ["sim", "nao", "nao"]);
  const c = provasDe(montarFila({ comprovacoes: [comp({ joiner_id: 55 })], fatos: { 55: fx() } })[0]);
  assert.deepEqual([c.codigo.estado, c.descricao.estado, c.identidade.estado], ["nao", "sim", "nao"]);
  assert.match(c.descricao.texto, /NÃO está validado/);
  const ok = provasDe(montarFila({ comprovacoes: [comp({ joiner_id: 56 })], fatos: { 56: fx({ identidade_confirmada: true }) } })[0]);
  assert.equal(ok.identidade.estado, "sim");
  assert.equal(provasDe(montarFila({ comprovacoes: [comp({ joiner_id: 57 })] })[0]).identidade.estado, "?");
});

test("conferências automáticas: conta, e-mail, contato informado, bloqueio, liberação e pedido; só o provedor aparece", () => {
  const p = montarFila({ solicitacoes: [sol({ joiner_id: 58 })], fatos: { 58: fx({ liberado: true }) }, extras: { 58: { contato_confere: true } } })[0];
  const c = Object.fromEntries(conferencias(p).map(x => [x.id, x]));
  assert.deepEqual(Object.keys(c), ["conta", "email", "contato", "bloqueado", "liberado", "pedido"]);
  assert.equal(c.conta.estado, "nao"); assert.equal(c.email.estado, "sim"); assert.match(c.email.texto, /@exemplo\.com/); assert.equal(c.liberado.estado, "sim"); assert.equal(c.pedido.estado, "nao");
  assert.match(c.contato.texto, /não prova quem é/);
  const sem = Object.fromEntries(conferencias(montarFila({ solicitacoes: [sol({ joiner_id: 59 })], fatos: { 59: fx() }, extras: { 59: { contato_confere: false } } })[0]).map(x => [x.id, x]));
  assert.match(sem.contato.texto, /NÃO é o e-mail do cadastro/);
  for (const x of Object.values(c)) assert.doesNotMatch(x.texto, /[\w.+-]+@[\w-]+\.\w+/);
});

test("pedido que cita item ou pagamento NÃO deve ser fechado só porque a pessoa tem conta", () => {
  assert.equal(citaOutroProblema({ tipo: "ativacao_ajuda", mensagem: "Meu pagamento de outubro não aparece" }), true);
  assert.equal(citaOutroProblema({ tipo: "ativacao_ajuda", mensagem: "Falta um item no meu pedido" }), true);
  assert.equal(citaOutroProblema({ tipo: "ativacao_ajuda", mensagem: "O código não chegou, tentei várias vezes" }), false);
  assert.equal(citaOutroProblema({ tipo: "ativacao_sem_vinculo", mensagem: "e-mail/@ do cadastro alterado depois da fotografia confiável" }), false);
});

test("situação 'conta' com fatos: os fatos têm prioridade sobre o que vinha da lista de vínculos", () => {
  const p = montarFila({ aConfirmar: [vinc({ joiner_id: 60, tem_conta: false, itens: 0 })], incluirTodos: true, fatos: { 60: fx({ tem_conta: true, itens: 19 }) } })[0];
  assert.equal(p.tem_conta, true); assert.equal(p.itens, 19); assert.equal(p.situacao, "conta"); assert.equal(p.orientacao.tipo, "conta");
});

test("texto automático antigo e falso é trocado pelo motivo calculado; texto da pessoa e texto novo ficam como estão", () => {
  const falso = { tipo: "ativacao_sem_vinculo", mensagem: "e-mail/@ do cadastro alterado depois da fotografia confiável" };
  const comMotivo = montarFila({ aConfirmar: [vinc({ joiner_id: 70 })], incluirTodos: true, motivos: { 70: { codigo: "historico_troca_email" } } })[0];
  const t = mensagemSolicitacao(falso, comMotivo);
  assert.doesNotMatch(t, /depois da fotografia/); assert.match(t, /registro antigo de pedido de troca/);
  const semMotivo = montarFila({ solicitacoes: [sol({ joiner_id: 71 })] })[0];
  const n = mensagemSolicitacao(falso, semMotivo); assert.match(n, /motivo exato não pôde ser determinado/); assert.doesNotMatch(n, /depois da fotografia/);
  assert.match(mensagemSolicitacao(falso, undefined), /não pôde ser determinado/);
  for (const [cod, re] of [["sem_email_valido", /não tem e-mail válido/], ["email_compartilhado", /compartilhado/], ["diverge_fotografia", /diferente da fotografia confiável \(não foi possível saber quando mudou\)/], ["arroba_repetido", /se repete/]]) {
    const p = montarFila({ aConfirmar: [vinc({ joiner_id: 72 })], incluirTodos: true, motivos: { 72: { codigo: cod } } })[0];
    assert.match(mensagemSolicitacao(falso, p), re, cod);
  }
  const nova = { tipo: "ativacao_sem_vinculo", mensagem: "O cadastro não tem e-mail válido." }; assert.equal(mensagemSolicitacao(nova, comMotivo), nova.mensagem);
  const pessoa = { tipo: "ativacao_ajuda", mensagem: "Meu e-mail foi alterado depois da fotografia do cadastro" }; assert.equal(mensagemSolicitacao(pessoa, comMotivo), pessoa.mensagem, "o que a pessoa escreveu nunca é reescrito");
});
