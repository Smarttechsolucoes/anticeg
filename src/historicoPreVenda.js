// Histórico dos formulários de pré-venda que a joiner preencheu (aba "Meus forms" em /prevenda). Só leitura.
// Cada formulário grava numa tabela própria; o "dono" do pedido é encontrado pelas colunas que a tabela tem:
//   e-mail / @ (social)  -> lojas abertas ao público (SMOL MERCH, W Magazine, Dazed, Esquire, Bazaar, revista...)
//   joiner_cog / cog / claim -> formulários feitos já logada
// No lançamento (J4c-3) o banco só devolve à joiner os pedidos dela (pelo e-mail verificado da conta ou pelo COG da conta): a consulta é a mesma, o banco é que filtra.

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const cap = (rotulo, v) => (num(v) > 0 ? `${rotulo} ×${num(v)}` : null);
const lista = itens => (Array.isArray(itens) ? itens : []);
const itemQtd = (nome, qtd, extra) => `${num(qtd) || 1}× ${[nome, extra && extra !== nome ? extra : null].filter(Boolean).join(" · ")}`;   // item de opção única repete o nome na opção: mostra só uma vez

export const FORMS_PREVENDA = [
  { chave: "smolmerch", rotulo: "SMOL MERCH", tabela: "pedidos_smolmerch", dono: ["email", "social"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.produto, i.qtd, i.opcao)) },
  { chave: "murce-itens", rotulo: "MURCEKALY ITENS", tabela: "pedidos_murce_itens", dono: ["email", "social"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.produto, i.qtd, i.opcao)) },
  { chave: "wmag-hyunjin", rotulo: "W MAGAZINE · HYUNJIN", tabela: "pedidos_wmag", dono: ["email", "social"],
    linhas: p => [cap("Capa A", p.capa_a), cap("Capa B", p.capa_b), cap("Capa C", p.capa_c)].filter(Boolean) },
  { chave: "wmag-leeknow", rotulo: "W MAGAZINE · LEE KNOW", tabela: "pedidos_wmag_leeknow", dono: ["email", "social"],
    linhas: p => [cap("Capa A", p.capa_a), cap("Capa B", p.capa_b), cap("Capa C", p.capa_c)].filter(Boolean) },
  { chave: "dazed-seungmin", rotulo: "DAZED & CONFUSED · SEUNGMIN", tabela: "pedidos_dazed_seungmin", dono: ["email", "social"],
    linhas: p => [cap("Capa A", p.capa_a), cap("Capa B", p.capa_b), cap("Capa C", p.capa_c)].filter(Boolean) },
  { chave: "dazed-han", rotulo: "DAZED & CONFUSED · HAN", tabela: "pedidos_dazed_han", dono: ["email", "social"],
    linhas: p => [cap("Capa A", p.capa_a), cap("Capa B", p.capa_b), cap("Capa C", p.capa_c)].filter(Boolean) },
  { chave: "esquire-hyunjin", rotulo: "ESQUIRE · HYUNJIN", tabela: "pedidos_esquire_hyunjin", dono: ["email", "social"],
    linhas: p => [cap("Capa A", p.capa_a), cap("Capa B", p.capa_b), cap("Capa C", p.capa_c)].filter(Boolean) },
  { chave: "bazaar-in", rotulo: "BAZAAR IN", tabela: "pedidos_bazaar_in", dono: ["email", "social"],
    linhas: p => [cap("Capa A", p.capa_a), cap("Capa B", p.capa_b), cap("Capa C", p.capa_c), cap("Caixa F", p.caixa_f), cap("Caixa G", p.caixa_g)].filter(Boolean) },
  { chave: "revista", rotulo: "REVISTA NYLON HAN", tabela: "pedidos_revista", dono: ["email", "social", "joiner_cog"],
    linhas: p => [cap("Versão regular", p.versao_regular), cap("Versão guys", p.versao_guys)].filter(Boolean) },
  { chave: "singba", rotulo: "SINGBA", tabela: "pedidos_singba", dono: ["joiner_cog"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.opcao, i.qtd, [i.tamanho, i.acabamento].filter(Boolean).join(" / "))) },
  { chave: "popcorn-sleeve", rotulo: "POPCORN SLEEVE", tabela: "pedidos_popcorn_sleeve", dono: ["joiner_cog"],
    linhas: p => (num(p.quantidade) > 0 ? [`${num(p.quantidade)}× Popcorn Sleeve`] : []) },
  { chave: "lightstick", rotulo: "LIGHTSTICK SKZ", tabela: "pedidos_lightstick", dono: ["joiner_cog"], linhas: () => [] },
  { chave: "popup-skzoo-rio", rotulo: "POP-UP SKZOO RIO", tabela: "pedidos_skzoo_rio", dono: ["cog"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.nome, i.qtd)) },
  { chave: "popup-this-that", rotulo: "POP-UP THIS & THAT", tabela: "pedidos_popup", dono: ["email", "social", "claim"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.item_nome, i.qtd, [i.versao, i.week ? "Week " + i.week : ""].filter(Boolean).join(" · "))) },
  { chave: "mercari", rotulo: "CAIXINHA MERCARI", tabela: "mercari_pedidos", dono: ["joiner_cog"],
    linhas: p => lista(p.itens).map(i => i.nome || "Item") },
  // formulários criados depois (itens em `itens`: { produto, opcao, qtd }); o banco só devolve à joiner os pedidos da conta dela
  { chave: "dicon-origin", rotulo: "DICON × D'FESTA · THE ORIGIN", tabela: "pedidos_dicon_origin", dono: ["email", "social"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.produto, i.qtd, i.opcao)) },
  { chave: "promo-murce-50", rotulo: "PROMO-MURCE-50", tabela: "pedidos_promo_murce_50", dono: ["email", "social"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.produto, i.qtd, i.opcao)) },
  { chave: "promo-makestar", rotulo: "PROMO MAKESTAR", tabela: "pedidos_promo_makestar", dono: ["email", "social"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.produto, i.qtd, i.opcao)) },
  { chave: "promo-50-murcekaly", rotulo: "PROMO 50 MURCEKALY", tabela: "pedidos_promo_50_murcekaly", dono: ["email", "social"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.produto, i.qtd, i.opcao)) },
  { chave: "weverse-black-friday", rotulo: "WEVERSE BLACK FRIDAY", tabela: "pedidos_weverse_black_friday", dono: ["email", "social"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.produto, i.qtd, i.opcao)) },
  { chave: "fans-promo", rotulo: "FANS PROMO", tabela: "pedidos_fans_promo", dono: ["email", "social"],
    linhas: p => lista(p.itens).map(i => itemQtd(i.produto, i.qtd, i.opcao)) },
  { chave: "bazaar-v", rotulo: "BAZAAR · V", tabela: "pedidos_bazaar_v", dono: ["email", "social"],
    linhas: p => [cap("Versão A", p.capa_a), cap("Versão B", p.capa_b), cap("Versão C", p.capa_c), cap("Versão D", p.capa_d), cap("Versão E", p.capa_e), cap("Versão F", p.capa_f)].filter(Boolean) },
  { chave: "formularios", rotulo: "FORMULÁRIOS (Promo 13, Odd & Fresh, Paper Tale, Run It, Wave Maker)", tabela: "formulario_pedidos", dono: ["joiner_cog"],
    rotuloDoPedido: p => p.evento || "FORMULÁRIO", linhas: p => [p.modalidade, p.observacoes].filter(Boolean) },
];

/** Valor e quantidade do pedido, qualquer que seja o nome da coluna naquela tabela. */
export function totaisDoPedido(p) {
  const valor = [p.valor_total, p.total_reais, p.valor_brl_total].map(num).find(v => v > 0) || 0;
  const qtd = [p.qtd_total, p.quantidade].map(num).find(v => v > 0) || 0;
  return { valor, qtd };
}

export const FORMA_PAGAMENTO = { pix: "PIX", cartao: "cartão", depois: "pagar depois", imediato: "pagamento imediato", cartao_whatsapp: "cartão (WhatsApp)" };
export function pagamentoDoPedido(p) {
  const f = String(p.forma_pagamento || p.metodo_pagamento || p.pagamento || "").trim().toLowerCase();
  if (!f || /^\d+$/.test(f)) return null;   // alguns formulários guardam a semana (01/02) nessa coluna
  return FORMA_PAGAMENTO[f] || f;
}

/** Situação do pedido em palavras da joiner. tom: ok | espera | ruim */
export function statusInfo(status) {
  const s = String(status || "").trim().toLowerCase();
  if (["confirmado", "pago", "aprovado", "finalizado"].includes(s)) return { chave: "confirmado", rotulo: "✓ confirmado", tom: "ok" };
  if (["cancelado", "recusado", "rejeitado"].includes(s)) return { chave: "cancelado", rotulo: "✕ cancelado", tom: "ruim" };
  if (s === "cartao" || s === "cartao_whatsapp") return { chave: "pendente", rotulo: "◉ cartão — confirmar pagamento", tom: "espera" };
  if (s === "aguardando") return { chave: "pendente", rotulo: "◉ aguardando confirmação", tom: "espera" };
  return { chave: "pendente", rotulo: "◉ pendente", tom: "espera" };
}

// valor seguro dentro de um filtro .or() do PostgREST: entre aspas, com % \ _ e " escapados (ilike sem curingas) e sem vírgula/parêntese soltos
const aspas = v => '"' + String(v).replace(/[\\%_"]/g, c => "\\" + c) + '"';
const semArroba = v => String(v || "").trim().replace(/^@+/, "").toLowerCase();

/** Quem a pessoa é nos formulários: { email, cog, arroba } normalizados (vazios viram null). */
export function identidade(user) {
  if (!user || user.guest) return null;
  const email = String(user.email || "").trim().toLowerCase() || null;
  const cog = String(user.cog || "").trim().toLowerCase() || null;
  const arroba = semArroba(user.twitter) || cog;
  return cog || email ? { email, cog, arroba } : null;
}

/** Filtro .or() para uma tabela, só com as colunas de dono que ela tem; null se não há como identificar a pessoa nela. */
export function filtroDoDono(form, ident) {
  if (!ident) return null;
  const p = [];
  for (const col of form.dono) {
    if (col === "email" && ident.email) p.push(`email.ilike.${aspas(ident.email)}`);
    else if (col === "social" && ident.arroba) { p.push(`social.ilike.${aspas("@" + ident.arroba)}`); p.push(`social.ilike.${aspas(ident.arroba)}`); }
    else if ((col === "joiner_cog" || col === "cog" || col === "claim") && ident.cog) p.push(`${col}.ilike.${aspas(ident.cog)}`);
  }
  return p.length ? p.join(",") : null;
}

/** Frase clara para a joiner sobre em que pé está o pedido dela (situação + forma de pagamento + comprovante). */
export function explicacaoDoPedido({ status, statusBruto, pagamento, temComprovante }) {
  const chave = status?.chave;
  if (chave === "confirmado") return "Pagamento confirmado pela equipe.";
  if (chave === "cancelado") return "Este pedido foi cancelado. Em caso de dúvida, fale com a equipe no grupo da CEG do formulário.";
  const cartao = statusBruto === "cartao" || statusBruto === "cartao_whatsapp" || pagamento === "cartão" || pagamento === "cartão (WhatsApp)";
  if (cartao) return temComprovante ? "Recebemos o comprovante do cartão. A equipe vai conferir o pagamento." : "Pagamento no cartão ainda sem comprovante. Se você já pagou, avise a equipe no grupo da CEG do formulário.";
  if (pagamento === "PIX") return temComprovante ? "Recebemos o comprovante do PIX. A equipe vai conferir o pagamento." : "Aguardando o pagamento por PIX e o comprovante.";
  if (pagamento === "pagar depois") return "Pagamento ainda não feito. Siga o prazo informado no formulário e no grupo da CEG.";
  return "Aguardando a equipe confirmar o pedido.";
}

/** Resumo pronto para mostrar: um objeto por pedido. */
export function normalizarPedido(form, p) {
  const { valor, qtd } = totaisDoPedido(p);
  const r = { chave: `${form.chave}-${p.id}`, formChave: form.chave, rotulo: (form.rotuloDoPedido && form.rotuloDoPedido(p)) || form.rotulo, id: p.id, criadoEm: p.created_at || null,
    linhas: (form.linhas(p) || []).filter(Boolean), valor, qtd, pagamento: pagamentoDoPedido(p), temComprovante: !!p.comprovante_url, comprovanteUrl: p.comprovante_url || null, status: statusInfo(p.status), statusBruto: p.status || null };
  return { ...r, explicacao: explicacaoDoPedido(r) };
}
