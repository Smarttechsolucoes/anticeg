// "Fila por pessoa" do painel (Admin → Contas): reúne, para CADA pessoa, o pedido, a prova e a ação necessária num só cartão.
// Só lógica pura (sem React, sem rede): monta a fila a partir do que as funções do banco já devolvem e escreve, em português claro, O QUE A ADMINISTRADORA PRECISA CONFERIR.
// Nada aqui decide ou grava coisa alguma; quem grava são as funções do banco (J6, J13, J14, J16), que conferem "é administradora" no servidor.

const dia = d => { const x = String(d || "").slice(0, 10).split("-"); return x.length === 3 ? `${x[2]}/${x[1]}/${x[0]}` : ""; };
const hora = d => { const t = new Date(d); return Number.isNaN(t.getTime()) ? "" : t.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };

/** Por que um pedido de troca de e-mail NÃO foi aplicado sozinho (desfecho gravado pelo banco). */
export function motivoTroca(t) {
  if (!t) return "";
  if (t.via === "sem_acesso") return "a pessoa NÃO tem acesso ao e-mail antigo: provou apenas que lê o e-mail novo (esta via nunca é aplicada sozinha)";
  if (t.desfecho === "perderia_liberacao") return "provou o e-mail antigo e o novo, mas aplicar a troca faria o cadastro PERDER a liberação (o e-mail novo não tem registro anterior)";
  return "provou o e-mail antigo e o novo, mas o cadastro NÃO é liberado pela regra automática (por isso a troca não foi aplicada sozinha)";
}

/** Texto do que precisa ser conferido, por tipo de pedido. Cada item é uma frase curta e direta. */
export function oQueConferir(p) {
  const itens = [];
  if (p.situacao === "conta") {
    itens.push("Esta pessoa JÁ TEM CONTA: a ativação que ela pediu não é mais necessária.");
    itens.push("Leia a mensagem: se o pedido era só de ativação, marque Resolvido. Se ela relata outro problema ainda pendente (item ou pagamento que não aparece, por exemplo), mantenha o pedido aberto e trate esse problema.");
    return itens;
  }
  if (p.troca) {
    itens.push("O e-mail novo foi provado por código, mas isso só prova que a pessoa lê ESSE endereço, não QUEM ela é.");
    itens.push("Confirme por um canal já conhecido (WhatsApp, o @ de sempre) que ela quer trocar e qual é o e-mail novo COMPLETO; você vai digitá-lo abaixo e o sistema compara com o pedido (a fila só mostra o provedor).");
    if (p.troca.desfecho === "perderia_liberacao") itens.push("Se tiver certeza de quem é, marque “confirmar também o vínculo” ao aplicar: sem isso, depois da troca ela fica sem poder ativar.");
    else itens.push("Aplicar a troca NÃO libera a ativação. Só marque “confirmar também o vínculo” se a identidade estiver confirmada.");
  }
  if (p.comprovacao) {
    itens.push("O texto abaixo é o que a PESSOA escreveu: não é prova. Confira com o que você enxerga (pedidos, pagamentos, itens) ou fale por um canal conhecido.");
    itens.push("Aprovar libera o código de ativação para o e-mail que JÁ está no cadastro (ela informou o par @ + e-mail corretos, mas isso não prova quem é).");
    if (p.comprovacao.via === "perfil_conhecido" && !p.comprovacao.desafio_validado) itens.push("Falta validar o código que ela enviou por mensagem direta antes de aprovar.");
  }
  for (const s of p.solicitacoes) itens.push(`Pedido “${s.tipo}”${s.mensagem ? `: leia a mensagem dela` : ""}${s.valor_pedido ? " e o valor pedido" : ""}. Resolva e anote o que foi feito.`);
  if (p.vinculo && !p.troca && !p.comprovacao) itens.push("Ela pediu ajuda para ativar. Confirme por canal conhecido; depois use “Confirmar vínculo” digitando o e-mail completo que ela informou (o sistema compara com o cadastro).");
  return itens;
}

/** Ação necessária, em poucas palavras, para o topo do cartão. */
export function acaoNecessaria(p) {
  if (p.situacao === "conta") return "Ela já tem conta: confira se o pedido era só de ativação ou se relata outro problema, e só então feche-o";
  if (p.troca) return "Confirmar a identidade e aplicar (ou cancelar) a troca de e-mail";
  if (p.comprovacao) return "Conferir a prova e aprovar ou recusar";
  if (p.solicitacoes.length) return "Responder o pedido";
  return "Confirmar o vínculo (ou orientar a pessoa)";
}

/** Situação da pessoa para a lista: com prova anexada, já tem conta (só falta fechar o pedido), pediu ajuda, ou ainda sem pedido. */
export function situacaoDe(p) {
  if (p.troca || p.comprovacao) return "prova";
  if (p.tem_conta) return "conta";
  if (p.solicitacoes.length || (p.vinculo && p.vinculo.pedido_de_ajuda)) return "ajuda";
  return "nada";
}
export const SITUACOES = { todos: "Todos", prova: "Com prova", ajuda: "Pediram ajuda", nada: "Sem pedido", conta: "Já têm conta" };

/** Motivo do bloqueio da ativação automática, em grupos curtos para filtrar (vem de admin_vinculos_motivos; se a função não existe, "outro"). */
export const MOTIVOS_LISTA = { ativou: "Já ativou a conta", historico: "Histórico de troca", sem_email: "Sem e-mail válido", compartilhado: "E-mail compartilhado", diverge: "Diferente da fotografia", arroba: "@ repetido", outro: "Sem motivo registrado" };
export function motivoChave(p) {
  if (p.tem_conta) return "ativou";
  const c = p.motivo && p.motivo.codigo;
  if (c === "historico_troca_email" || c === "historico_so_arroba") return "historico";
  if (c === "sem_email_valido") return "sem_email";
  if (c === "email_compartilhado") return "compartilhado";
  if (c === "diverge_fotografia") return "diverge";
  if (c === "arroba_repetido") return "arroba";
  if (!c && p.dominio === "") return "sem_email";
  return "outro";
}
/** Há quantos dias a pessoa espera (null quando não há pedido com data). */
export function diasDeEspera(p, agora = new Date()) { return p.desde ? Math.max(0, Math.floor((agora - new Date(p.desde)) / 86400000)) : null; }

/**
 * Monta a fila: uma linha por pessoa (joiner_id) que tem algo a decidir.
 * Entra quem tem pedido de troca em análise, pedido de comprovação, solicitação aberta, ou pediu ajuda para ativar (vínculo a confirmar).
 * fatos: conferências automáticas do banco (admin_conferencias_pessoas), por joiner_id: conta, bloqueio, e-mail, liberação, itens. Têm prioridade sobre extras. Sem elas, o que não se sabe fica desconhecido.
 * extras: dados lidos direto dos cadastros de quem NÃO está na lista de vínculos (nome, provedor do e-mail, se já tem conta); o que não vier fica desconhecido (nunca vira zero).
 * incluirTodos: entra também quem está só na lista de vínculos a confirmar e nunca pediu nada (situação "nada").
 * Ordem: primeiro quem usou a autoatendimento (já traz prova), depois solicitações, depois quem só pediu ajuda; dentro de cada grupo, o mais antigo primeiro.
 */
export function montarFila({ trocas = [], comprovacoes = [], solicitacoes = [], aConfirmar = [], motivos = {}, incluirTodos = false, extras = {}, fatos = {} } = {}) {
  const m = new Map();
  const pessoa = (id, cog) => { if (!m.has(id)) m.set(id, { joiner_id: id, cog: cog || "", nome: "", dominio: null, itens: null, tem_conta: null, motivo: motivos[id] || null, troca: null, comprovacao: null, solicitacoes: [], vinculo: null, desde: null }); const p = m.get(id); if (!p.cog && cog) p.cog = cog; return p; };
  const antes = (p, d) => { if (d && (!p.desde || new Date(d) < new Date(p.desde))) p.desde = d; };
  for (const v of aConfirmar) { const p = pessoa(v.joiner_id, v.cog); p.vinculo = v; p.nome = v.nome_site || p.nome; p.dominio = v.dominio || ""; p.itens = v.itens ?? 0; p.tem_conta = !!v.tem_conta; }
  for (const t of trocas) { const p = pessoa(t.joiner_id, t.cog); p.troca = t; antes(p, t.criado_em); }
  for (const c of comprovacoes) { const p = pessoa(c.joiner_id, c.cog); p.comprovacao = c; p.itens = c.itens ? Number(c.itens) : p.itens; antes(p, c.criado_em); }
  for (const s of solicitacoes) if (s.status === "aberta" && s.joiner_id != null) { const p = pessoa(s.joiner_id, s.cog); p.solicitacoes.push(s); antes(p, s.criado_em); }
  const lista = [...m.values()].filter(p => p.troca || p.comprovacao || p.solicitacoes.length || (p.vinculo && (incluirTodos || p.vinculo.pedido_de_ajuda)));
  for (const p of lista) {
    const x = extras[p.joiner_id], ft = fatos[p.joiner_id] || null;
    p.fatos = ft; p.contato_confere = x && x.contato_confere != null ? x.contato_confere : null;
    if (x && !p.vinculo) { p.nome = x.nome || p.nome; if (x.dominio != null) p.dominio = x.dominio; if (x.tem_conta != null) p.tem_conta = !!x.tem_conta; }
    if (ft) { p.tem_conta = !!ft.tem_conta; p.itens = ft.itens != null ? Number(ft.itens) : p.itens; p.dominio = ft.email_dominio || ""; p.nome = p.nome || (x && x.nome) || ""; }
    p.situacao = situacaoDe(p); p.motivoChave = motivoChave(p); p.orientacao = orientar(p);
  }
  const rank = p => (p.situacao === "prova" ? 0 : p.situacao === "conta" ? 4 : p.solicitacoes.length ? 1 : p.situacao === "ajuda" ? 2 : 3);
  lista.sort((a, b) => rank(a) - rank(b) || (new Date(a.desde || 0) - new Date(b.desde || 0)) || a.joiner_id - b.joiner_id);
  return lista;
}

// ───────────────────────────── conferências e orientação por pessoa ─────────────────────────────
const dm = d => { if (!d) return ""; const t = new Date(d); return Number.isNaN(t.getTime()) ? "" : t.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
/** O pedido (solicitação) cita item, pagamento ou cobrança? Então NÃO se fecha só porque a pessoa tem conta: pode ser outro problema ainda pendente. */
export const citaOutroProblema = x => /(item|itens|pagamento|multa|cobran|pedido de|sumiu|não aparece|nao aparece)/i.test(String(x.mensagem || "")) && x.tipo !== "ativacao_sem_vinculo";

/**
 * As TRÊS coisas que "Com prova" pode significar, separadas (nunca uma só):
 *  - código verificado: a pessoa digitou o código que chegou ao e-mail novo (só existe na troca de e-mail);
 *  - descrição enviada: a pessoa escreveu uma prova (comprovação); é TEXTO dela, não prova validada;
 *  - identidade conferida: SÓ a administradora confere (confirmação do vínculo); vem do banco, nunca da pessoa.
 */
export function provasDe(p) {
  const t = p.troca, c = p.comprovacao, f = p.fatos;
  return {
    codigo: t ? { estado: "sim", texto: `Código verificado: o e-mail novo (@${t.novo_dominio || "?"}) foi confirmado por código${t.novo_verificado_em ? ` em ${hora(t.novo_verificado_em)}` : ""}. Isso prova que ela lê esse endereço, não quem ela é.` }
         : { estado: "nao", texto: "Código verificado: não há e-mail novo confirmado por código." },
    descricao: c ? { estado: "sim", texto: "Descrição enviada: ela escreveu uma prova. É texto dela e NÃO está validado." }
         : { estado: "nao", texto: "Descrição enviada: não há descrição de prova." },
    identidade: f ? (f.identidade_confirmada ? { estado: "sim", texto: "Identidade conferida por você: sim." } : { estado: "nao", texto: "Identidade conferida por você: ainda não." }) : { estado: "?", texto: "Identidade conferida por você: não consultado." },
  };
}

/** Lista das conferências técnicas que o sistema faz sozinho. estado: "sim" | "nao". Vazia quando as conferências automáticas não puderam ser consultadas. */
export function conferencias(p) {
  const f = p.fatos, lista = [];
  if (!f) return lista;
  lista.push({ id: "conta", estado: f.tem_conta ? "sim" : "nao", texto: f.tem_conta ? `Já tem conta${f.conta_criada_em ? ` (criada em ${dm(f.conta_criada_em)}${f.ultimo_login ? `, entrou em ${dm(f.ultimo_login)}` : ""})` : ""}.` : "Ainda não tem conta." });
  lista.push({ id: "email", estado: f.email_valido && f.email_exclusivo ? "sim" : "nao", texto: !f.email_valido ? "E-mail do cadastro ausente ou inválido." : !f.email_exclusivo ? `E-mail do cadastro (@${f.email_dominio}) compartilhado com outro cadastro.` : `E-mail do cadastro válido e só deste cadastro (@${f.email_dominio}).` });
  if (p.contato_confere != null) lista.push({ id: "contato", estado: p.contato_confere ? "sim" : "nao", texto: p.contato_confere ? "O e-mail que ela informou no pedido é o do cadastro (ela mesma digitou: isso não prova quem é)." : "O contato que ela informou NÃO é o e-mail do cadastro." });
  lista.push({ id: "bloqueado", estado: f.bloqueado ? "nao" : "sim", texto: f.bloqueado ? "Cadastro BLOQUEADO." : "Cadastro não está bloqueado." });
  lista.push({ id: "liberado", estado: f.liberado ? "sim" : "nao", texto: f.liberado ? "Liberada pela regra automática: pode pedir o código." : `Não liberada pela regra automática${p.motivoChave && p.motivoChave !== "outro" ? `: ${MOTIVOS_LISTA[p.motivoChave].toLowerCase()}` : ""}.` });
  lista.push({ id: "pedido", estado: p.troca || p.comprovacao ? "sim" : "nao", texto: p.troca ? "Há pedido de troca de e-mail pendente." : p.comprovacao ? "Há pedido de comprovação pendente." : "Não há pedido de troca nem de comprovação." });
  return lista;
}

const SITE = "https://anticeg.vercel.app";
/** Orientação objetiva por pessoa. tipo: conta | ativar | corrigir_email | analise | desconhecido. */
export function orientar(p) {
  const f = p.fatos, arroba = `@${p.cog}`;
  if (p.troca) {
    return { tipo: "analise", rotulo: "Precisa de análise", resumo: "Ela confirmou o e-mail novo por código. Falta a sua decisão sobre quem ela é.", passos: [], mensagem: null, nota: null,
      falta: ["Reconhecer a pessoa por um canal já conhecido (WhatsApp, o @ de sempre): o código só provou que ela lê o e-mail novo.", "Pegar com ela o e-mail novo COMPLETO e colar abaixo (o sistema compara com o do pedido).", "Decidir: aplicar a troca (com ou sem confirmar o vínculo) ou cancelar o pedido."] };
  }
  if (p.comprovacao) {
    const falta = ["Ler a descrição (é texto dela, não prova) e comparar com o que você enxerga: pedidos, pagamentos e itens."];
    if (p.comprovacao.via === "perfil_conhecido" && !p.comprovacao.desafio_validado) falta.push("Validar o código que ela mandou por mensagem direta.");
    falta.push("Decidir: aprovar (o código de ativação passa a sair para o e-mail do cadastro) ou recusar.");
    return { tipo: "analise", rotulo: "Precisa de análise", resumo: "Ela enviou uma descrição de prova. Falta você conferir se a prova convence.", passos: [], mensagem: null, nota: null, falta };
  }
  if (!f) return { tipo: "desconhecido", rotulo: "Conferências não consultadas", resumo: "Não foi possível consultar as conferências automáticas agora. Use as informações do cartão.", passos: [], falta: [], mensagem: null, nota: null };
  if (f.tem_conta) {
    return { tipo: "conta", rotulo: "Já tem conta", resumo: `Já tem conta${f.conta_criada_em ? ` (criada em ${dm(f.conta_criada_em)}${f.ultimo_login ? `, entrou em ${dm(f.ultimo_login)}` : ""})` : ""}. A ativação não é mais necessária.`,
      passos: ["Oriente a entrar com o @ e a senha. Se esqueceu a senha, “Esqueci minha senha”: o código vai para o e-mail do cadastro.", "Se o pedido relata outro problema (item ou pagamento que não aparece, por exemplo), mantenha-o aberto e trate esse problema."],
      falta: [], mensagem: `Oi! Seu cadastro já tem conta ativa. Entre em ${SITE} com o seu @ (${arroba}) e a sua senha. Se esqueceu a senha, toque em “Esqueci minha senha”: o código vai para o e-mail do cadastro.`, nota: "já tem conta; orientada a entrar ou recuperar a senha" };
  }
  if (f.bloqueado) {
    return { tipo: "analise", rotulo: "Precisa de análise", resumo: "O cadastro está BLOQUEADO: não oriente a ativar.", passos: [], mensagem: null, nota: null, falta: ["Entender por que o cadastro está bloqueado antes de qualquer liberação.", "Decidir com a pessoa, por um canal conhecido, o que fazer."] };
  }
  if (f.liberado) {
    return { tipo: "ativar", rotulo: "Pode ativar", resumo: "Liberada pela regra automática, com e-mail válido e só dela. Não depende de você.",
      passos: [`Oriente a abrir “Ative sua conta”, informar o @ e o e-mail do cadastro (@${f.email_dominio}) e pedir o código de novo.`, "Se o código não chegar, olhar o Spam; depois, “Preciso de ajuda” de novo."],
      falta: [], mensagem: `Oi! Seu cadastro já está liberado. Abra ${SITE}, toque em “Ative sua conta”, informe o seu @ (${arroba}) e o e-mail do cadastro (@${f.email_dominio}) e peça o código de novo. Se não chegar, olhe o Spam e me avise.`, nota: "liberada pela regra; orientada a pedir o código de novo" };
  }
  if (!f.email_valido || !f.email_exclusivo) {
    return { tipo: "corrigir_email", rotulo: "Precisa corrigir o e-mail", resumo: !f.email_valido ? "O cadastro não tem e-mail válido: ela precisa informar um e-mail novo." : "O e-mail do cadastro é compartilhado com outro cadastro: a administração precisa decidir de quem é.",
      passos: ["Encaminhe para “Quero mudar de e-mail” (na tela “Ative sua conta”). Se ela não lê o e-mail antigo, “perdi o acesso”.", "O pedido chega aqui já com o e-mail novo verificado por código; aí falta só a sua decisão."],
      falta: [], mensagem: `Oi! Para corrigir o e-mail do seu cadastro, abra ${SITE}, toque em “Ative sua conta” e depois em “Quero mudar de e-mail”. Se você não lê mais o e-mail antigo, escolha “perdi o acesso”; aí eu confirmo por aqui que é você antes de trocar.`, nota: "e-mail ausente/compartilhado; orientada a usar Quero mudar de e-mail" };
  }
  return { tipo: "analise", rotulo: "Precisa de análise", resumo: `Bloqueada pela regra automática${p.motivoChave && p.motivoChave !== "outro" ? ` (${MOTIVOS_LISTA[p.motivoChave].toLowerCase()})` : ""}. O e-mail é válido e só dela, então falta reconhecer a pessoa.`,
    passos: [], falta: ["Reconhecer a pessoa por um canal já conhecido (não basta ela saber o @).", "Perguntar qual e-mail ela usa e colar abaixo (o sistema compara com o cadastro): isso confirma o vínculo e libera o código.", "Se você não a reconhece, oriente “Quero manter meu e-mail e comprovar meu cadastro”."],
    mensagem: `Oi! Para liberar o seu cadastro preciso confirmar que é você. Se o e-mail do cadastro é o que você usa, abra ${SITE}, toque em “Ative sua conta” e depois em “Quero manter meu e-mail e comprovar meu cadastro”, descrevendo uma prova (por exemplo, o comprovante de um pagamento anterior). Também posso confirmar por aqui: me diga o e-mail completo do cadastro.`, nota: null };
}
export const ORIENTACOES = { todos: "Todas", analise: "Precisa de análise", ativar: "Pode ativar", conta: "Já tem conta", corrigir_email: "Precisa corrigir o e-mail", desconhecido: "Não consultadas" };

export { dia, hora };
