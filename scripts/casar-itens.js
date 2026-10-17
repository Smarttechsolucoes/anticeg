// Casamento das linhas da PLANILHA com as linhas já existentes na masterlist, ANTES da regra antiga (ceg|item|nome + ordem). Duas etapas, ambas conservadoras (na dúvida NÃO casam e vale a regra antiga):
//
//  1) casarPorIdLinha — pelo CÓDIGO da planilha (coluna ID => masterlist.id_linha).
//     Problema que resolve: a regra antiga identifica a linha por ceg|nome_do_item|nome. Se alguém edita o nome do item, o nome de exibição ou o CEG na planilha, a chave muda: o sync INSERE uma linha nova (id novo)
//     e apaga a antiga. As demandas de pagamento guardam o masterlist.id antigo e passam a apontar para uma linha que não existe mais (413 de 3.811 itens em 2026-10-16).
//     Regras: o código existe e é ÚNICO na planilha; exatamente UMA linha da masterlist o tem; mesmo CEG; **o DONO (@/cog) é o MESMO** (um id NUNCA muda de dono por causa de um código: se outra joiner
//     aparece com o mesmo código, vale a regra antiga e ela recebe uma linha nova); a linha do banco ainda não foi reivindicada.
//
//  2) casarChavesRepetidas — DESEMPATE PELO DONO entre linhas SEM código que têm a MESMA chave (ex.: duas joiners com o mesmo nome de exibição e o mesmo item "PERFIL NOVO").
//     A regra antiga casa essas linhas só pela ORDEM; se a ordem da planilha mudar, os DONOS (@) trocam entre os ids. Aqui cada linha da planilha é ligada à linha do banco que já pertence ao MESMO @.
//     Só mexe em grupos de chave repetida (na planilha ou no banco); grupos sem ambiguidade seguem exatamente como hoje. O que não achar o mesmo @ cai na regra antiga.
//
// Entradas: linhas da planilha ({ idLinha?, ceg, cog, chave? }) e linhas existentes ({ id, id_linha?, ceg, cog, chave? }). Saídas: { porIndice: Map<indice da linha da planilha, linha existente>, reivindicados: Set<id> }.

const norm = v => String(v ?? '').trim();

export function casarPorIdLinha(linhasPlanilha, existentes) {
  const porIndice = new Map();
  const reivindicados = new Set();

  const naPlanilha = new Map();                       // código -> quantas vezes aparece na planilha
  for (const l of linhasPlanilha) { const c = norm(l?.idLinha); if (c) naPlanilha.set(c, (naPlanilha.get(c) || 0) + 1); }

  const noBanco = new Map();                          // código -> linhas da masterlist
  for (const e of existentes) { const c = norm(e?.id_linha); if (c) { if (!noBanco.has(c)) noBanco.set(c, []); noBanco.get(c).push(e); } }

  linhasPlanilha.forEach((l, i) => {
    const c = norm(l?.idLinha);
    if (!c || naPlanilha.get(c) !== 1) return;        // sem código, ou repetido na planilha
    const candidatos = noBanco.get(c);
    if (!candidatos || candidatos.length !== 1) return; // inexistente ou ambíguo no banco
    const e = candidatos[0];
    if (norm(e.ceg).toLowerCase() !== norm(l.ceg).toLowerCase()) return;
    const dono = norm(l.cog);
    if (!dono || dono !== norm(e.cog)) return;        // o id NUNCA troca de dono por causa de um código (comparação exata: Ela e ela são pessoas diferentes)
    if (reivindicados.has(e.id)) return;
    porIndice.set(i, e);
    reivindicados.add(e.id);
  });
  return { porIndice, reivindicados };
}

/** linhas: [{ indice, chave, cog }] (só as NÃO casadas pelo código); existentes: [{ id, chave, cog }] (só as NÃO reivindicadas). Devolve o mesmo formato, com o índice ORIGINAL da linha da planilha. */
export function casarChavesRepetidas(linhas, existentes) {
  const porIndice = new Map();
  const reivindicados = new Set();
  const grupoLinhas = new Map(), grupoBanco = new Map();
  for (const l of linhas) { const k = norm(l.chave); if (!grupoLinhas.has(k)) grupoLinhas.set(k, []); grupoLinhas.get(k).push(l); }
  for (const e of existentes) { const k = norm(e.chave); if (!grupoBanco.has(k)) grupoBanco.set(k, []); grupoBanco.get(k).push(e); }

  for (const [k, ls] of grupoLinhas) {
    const es = grupoBanco.get(k) || [];
    if (ls.length < 2 && es.length < 2) continue;      // sem ambiguidade: fica na regra antiga, igual a hoje
    for (const l of ls) {
      const dono = norm(l.cog);
      if (!dono) continue;
      const e = es.find(x => !reivindicados.has(x.id) && norm(x.cog) === dono);   // mesmo @, ainda livre (comparação exata)
      if (!e) continue;
      porIndice.set(l.indice, e);
      reivindicados.add(e.id);
    }
  }
  return { porIndice, reivindicados };
}
