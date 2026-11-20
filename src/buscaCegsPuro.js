// Regras puras da busca em "Resumo CEGs" (sem rede nem tela, para testar).
// Procura pelo NOME DA CEG e pelo NOME DO ITEM, sem acento e sem diferenciar maiúscula; várias palavras = todas precisam aparecer.
// Valores (item, frete, taxa RF, multa) só existem nas linhas da própria pessoa: as linhas da comunidade vêm sem valor e sem preço.

export const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const termosDe = q => norm(q).split(/\s+/).filter(Boolean);
export const casa = (texto, termos) => { const t = norm(texto); return termos.length > 0 && termos.every(x => t.includes(x)); };

const n = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

/** CEGs cujo nome casa com a busca. */
export const cegsPorNome = (cegs, termos) => (cegs || []).filter(c => casa(c, termos));

/** Preço de uma linha da própria pessoa: item, frete, taxa RF, multa e total (+ o que já foi pago). */
export function precoDaLinha(r) {
  const item = n(r.valor_item), frete = n(r.frete_inter), rf = n(r.taxa_rf), multa = n(r.multa);
  return { item, frete, rf, multa, total: item + frete + rf + multa,
    pagoItem: !!r.pago_item, pagoFrete: !!r.pago_frete, pagoRf: !!r.pago_rf };
}

/** Linhas da própria pessoa que casam (pelo item ou pelo nome da CEG), em ordem de CEG e de item. */
export function meusItensQueCasam(minhas, termos) {
  return (minhas || []).filter(r => casa(r.nome_do_item, termos) || casa(r.ceg, termos))
    .sort((a, b) => String(a.ceg || "").localeCompare(String(b.ceg || ""), "pt-BR") || String(a.nome_do_item || "").localeCompare(String(b.nome_do_item || ""), "pt-BR"));
}

/** Soma do que a pessoa pagou/deve nos itens encontrados. */
export function totaisDosMeus(linhas) {
  return (linhas || []).reduce((t, r) => {
    const p = precoDaLinha(r);
    return { itens: t.itens + 1, item: t.item + p.item, frete: t.frete + p.frete, rf: t.rf + p.rf, multa: t.multa + p.multa, total: t.total + p.total };
  }, { itens: 0, item: 0, frete: 0, rf: 0, multa: 0, total: 0 });
}

/** Itens da comunidade que casam, agrupados por CEG e por nome do item, só com a QUANTIDADE de pedidos (sem @, nome nem valor). */
export function itensDaComunidade(porCeg, termos) {
  const grupos = [];
  for (const [ceg, linhas] of Object.entries(porCeg || {})) {
    const porNome = new Map();
    for (const r of linhas || []) {
      if (!casa(r.nome_do_item, termos)) continue;
      const nome = String(r.nome_do_item || "").trim() || "(sem nome)";
      porNome.set(nome, (porNome.get(nome) || 0) + 1);
    }
    if (porNome.size) grupos.push({ ceg, itens: [...porNome.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR")), pedidos: [...porNome.values()].reduce((a, b) => a + b, 0) });
  }
  return grupos.sort((a, b) => b.pedidos - a.pedidos || a.ceg.localeCompare(b.ceg, "pt-BR"));
}
