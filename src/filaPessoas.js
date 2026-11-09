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
 * extras: dados lidos direto dos cadastros de quem NÃO está na lista de vínculos (nome, provedor do e-mail, se já tem conta); o que não vier fica desconhecido (nunca vira zero).
 * incluirTodos: entra também quem está só na lista de vínculos a confirmar e nunca pediu nada (situação "nada").
 * Ordem: primeiro quem usou a autoatendimento (já traz prova), depois solicitações, depois quem só pediu ajuda; dentro de cada grupo, o mais antigo primeiro.
 */
export function montarFila({ trocas = [], comprovacoes = [], solicitacoes = [], aConfirmar = [], motivos = {}, incluirTodos = false, extras = {} } = {}) {
  const m = new Map();
  const pessoa = (id, cog) => { if (!m.has(id)) m.set(id, { joiner_id: id, cog: cog || "", nome: "", dominio: null, itens: null, tem_conta: null, motivo: motivos[id] || null, troca: null, comprovacao: null, solicitacoes: [], vinculo: null, desde: null }); const p = m.get(id); if (!p.cog && cog) p.cog = cog; return p; };
  const antes = (p, d) => { if (d && (!p.desde || new Date(d) < new Date(p.desde))) p.desde = d; };
  for (const v of aConfirmar) { const p = pessoa(v.joiner_id, v.cog); p.vinculo = v; p.nome = v.nome_site || p.nome; p.dominio = v.dominio || ""; p.itens = v.itens ?? 0; p.tem_conta = !!v.tem_conta; }
  for (const t of trocas) { const p = pessoa(t.joiner_id, t.cog); p.troca = t; antes(p, t.criado_em); }
  for (const c of comprovacoes) { const p = pessoa(c.joiner_id, c.cog); p.comprovacao = c; p.itens = c.itens ? Number(c.itens) : p.itens; antes(p, c.criado_em); }
  for (const s of solicitacoes) if (s.status === "aberta" && s.joiner_id != null) { const p = pessoa(s.joiner_id, s.cog); p.solicitacoes.push(s); antes(p, s.criado_em); }
  const lista = [...m.values()].filter(p => p.troca || p.comprovacao || p.solicitacoes.length || (p.vinculo && (incluirTodos || p.vinculo.pedido_de_ajuda)));
  for (const p of lista) {
    const x = extras[p.joiner_id];
    if (x && !p.vinculo) { p.nome = x.nome || p.nome; if (x.dominio != null) p.dominio = x.dominio; if (x.tem_conta != null) p.tem_conta = !!x.tem_conta; }
    p.situacao = situacaoDe(p); p.motivoChave = motivoChave(p);
  }
  const rank = p => (p.situacao === "prova" ? 0 : p.situacao === "conta" ? 4 : p.solicitacoes.length ? 1 : p.situacao === "ajuda" ? 2 : 3);
  lista.sort((a, b) => rank(a) - rank(b) || (new Date(a.desde || 0) - new Date(b.desde || 0)) || a.joiner_id - b.joiner_id);
  return lista;
}

export { dia, hora };
