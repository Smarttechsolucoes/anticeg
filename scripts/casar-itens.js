// Casamento das linhas da PLANILHA com as linhas já existentes na masterlist, ANTES da regra antiga (ceg|item|nome + ordem). Duas etapas, ambas conservadoras (na dúvida NÃO casam e vale a regra antiga):
//
//  1) casarPorIdLinha — pelo CÓDIGO da planilha (coluna ID => masterlist.id_linha).
//     Problema que resolve: a regra antiga identifica a linha por ceg|nome_do_item|nome. Se alguém edita o nome do item, o nome de exibição ou o CEG na planilha, a chave muda: o sync INSERE uma linha nova (id novo)
//     e apaga a antiga. As demandas de pagamento guardam o masterlist.id antigo e passam a apontar para uma linha que não existe mais (413 de 3.811 itens em 2026-10-16).
//     Regras: o código existe e é ÚNICO na planilha; exatamente UMA linha da masterlist o tem; mesmo CEG (OU, se a planilha MOVEU a linha de CEG, o mesmo ITEM: ver abaixo); **o DONO (@/cog) é o MESMO** (um id NUNCA muda de dono por causa de um código: se outra joiner
//     aparece com o mesmo código, vale a regra antiga e ela recebe uma linha nova); a linha do banco ainda não foi reivindicada.
//     CEG MOVIDO (04/11): se a planilha só mudou a linha de CEG (mesmo código, mesmo dono, MESMO nome de item, informado dos dois lados), a linha continua a MESMA e o sync atualiza o CEG nela.
//     Antes, mudar o CEG fazia o sync inserir uma linha nova e deixar a velha para trás (a joiner via o item em dobro: 11 casos em 03/11). CEG diferente E item diferente continua sem casar.
//
//  2) casarChavesRepetidas — DESEMPATE PELO DONO entre linhas SEM código que têm a MESMA chave (ex.: duas joiners com o mesmo nome de exibição e o mesmo item "PERFIL NOVO").
//     A regra antiga casa essas linhas só pela ORDEM; se a ordem da planilha mudar, os DONOS (@) trocam entre os ids. Aqui cada linha da planilha é ligada à linha do banco que já pertence ao MESMO @.
//     Só mexe em grupos de chave repetida (na planilha ou no banco); grupos sem ambiguidade seguem exatamente como hoje. O que não achar o mesmo @ cai na regra antiga.
//
//  3) adotarCodigoSemChave — ADOÇÃO DO CÓDIGO (13/11/2026). Linha da planilha com um CÓDIGO NOVO (que nenhuma linha do banco tem) cuja chave (ceg|item|nome) não casou com ninguém, porque o NOME de exibição mudou
//     junto com o código (a coluna NOME da planilha é preenchida depois, por fórmula). Sem esta etapa o sync INSERIA uma linha nova com o código e deixava a antiga SEM código para trás: a cópia
//     (13/11: 36 cópias em "SKZOO EAAW · ONLINE", 9 em MERCARI). Aqui a linha antiga SEM código, do MESMO CEG, MESMO item e MESMO dono (comparação exata), RECEBE o código: continua a mesma linha (mesmo id).
//     Só atua nas linhas que, depois da regra da chave, ficariam SEM PAR de qualquer dos lados (compra repetida legítima, com par pela chave, nunca é tocada); o código tem que ser único na planilha e
//     inexistente no banco; o pareamento é 1 para 1, na ordem. Na dúvida NÃO casa (vale o comportamento antigo).
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
    if (norm(e.ceg).toLowerCase() !== norm(l.ceg).toLowerCase()) {
      // CEG mudou: só casa se for o MESMO item (a planilha moveu a linha). Sem o item dos dois lados, não casa.
      const itemPlanilha = norm(l.item).toLowerCase(), itemBanco = norm(e.item ?? e.nome_do_item).toLowerCase();
      if (!itemPlanilha || itemPlanilha !== itemBanco) return;
    }
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

/**
 * linhas: [{ indice, chave, idLinha, ceg, item, cog }] — só as NÃO casadas pelo código nem pelo desempate, na ordem da planilha (chave já em minúsculas, igual à do sync).
 * existentes: [{ id, chave, id_linha, ceg, nome_do_item, cog }] — só as NÃO reivindicadas, na ordem de leitura do banco (id crescente).
 * opcoes.codigosPlanilha: Map código -> quantas vezes aparece na planilha inteira. opcoes.codigosBanco: Set de TODOS os códigos que o banco já tem.
 */
export function adotarCodigoSemChave(linhas, existentes, { codigosPlanilha = new Map(), codigosBanco = new Set() } = {}) {
  const porIndice = new Map();
  const reivindicados = new Set();

  // 1) emula o pareamento pela chave que o sync faz em seguida (n-ésima ocorrência da chave na planilha <-> n-ésima linha do banco com a mesma chave)
  const gl = new Map(), ge = new Map();
  for (const l of linhas) { const k = String(l.chave); if (!gl.has(k)) gl.set(k, []); gl.get(k).push(l); }
  for (const e of existentes) { const k = String(e.chave); if (!ge.has(k)) ge.set(k, []); ge.get(k).push(e); }
  const semParLinha = [], semParBanco = [];
  for (const [k, ls] of gl) { const es = ge.get(k) || []; semParLinha.push(...ls.slice(es.length)); }
  for (const [k, es] of ge) { const ls = gl.get(k) || []; semParBanco.push(...es.slice(ls.length)); }

  // 2) candidatas: do lado da planilha, código novo e único; do lado do banco, linha SEM código
  const grupo = (ceg, item, cog) => norm(ceg).toLowerCase() + '|' + norm(item).toLowerCase() + '|' + norm(cog);
  const candLinhas = new Map(), candBanco = new Map();
  for (const l of semParLinha) {
    const c = norm(l.idLinha), dono = norm(l.cog);
    if (!c || !dono || codigosPlanilha.get(c) !== 1 || codigosBanco.has(c)) continue;
    const g = grupo(l.ceg, l.item, l.cog);
    if (!candLinhas.has(g)) candLinhas.set(g, []);
    candLinhas.get(g).push(l);
  }
  for (const e of semParBanco) {
    if (norm(e.id_linha) || !norm(e.cog)) continue;
    const g = grupo(e.ceg, e.nome_do_item, e.cog);
    if (!candBanco.has(g)) candBanco.set(g, []);
    candBanco.get(g).push(e);
  }

  // 3) pareia 1 para 1, na ordem (planilha na ordem das linhas; banco por id crescente)
  for (const [g, ls] of candLinhas) {
    const es = (candBanco.get(g) || []).slice().sort((a, b) => Number(a.id) - Number(b.id));
    const n = Math.min(ls.length, es.length);
    for (let i = 0; i < n; i++) {
      if (reivindicados.has(es[i].id)) continue;
      porIndice.set(ls[i].indice, es[i]);
      reivindicados.add(es[i].id);
    }
  }
  return { porIndice, reivindicados };
}
