// Resolução do dono (COG) de cada linha da MASTERLIST no sync.
//
// Problema que isto resolve: o mesmo @ pode existir em mais de uma linha de `joiners` só com diferença de maiúsculas ("Seopookie" e "seopookie").
// O sync (a) escolhia o COG por "última linha vence" (ordem física do banco, instável) e (b) gravava o upsert com o @ em minúsculas
// (onConflict 'cog' é sensível a maiúsculas), o que CRIAVA um gêmeo minúsculo a cada rodada. Resultado: os itens iam para o gêmeo
// (cog minúsculo) e a joiner, que entra com o cadastro de verdade ("Seopookie"), via a masterlist vazia.
//
// Regras:
//   1. Entre cadastros que disputam o mesmo @/e-mail vence, nesta ordem: o cadastro CONFIRMADO (a joiner entrou nele); o COG igual ao @ (sem mexer em maiúsculas
//      só quando o outro não é confirmado); o mais antigo (menor id). Determinístico: não depende da ordem física do banco. Para os pares que NÃO são só
//      de maiúsculas isto reproduz o dono que as linhas já têm hoje.
//   2. O upsert de uma joiner que já existe (ignorando maiúsculas) usa o COG que ela já tem; só joiner realmente nova entra com o @ em minúsculas.

const minusculo = v => String(v ?? '').trim().toLowerCase();

/** Índices de busca das joiners; disputa pelo mesmo @/e-mail é decidida de forma determinística (ver regras acima). */
export function indexarJoiners(joiners) {
  const lista = [...(joiners || [])].filter(j => j && j.cog);
  const idDe = j => j.id ?? Infinity;
  const melhor = (candidatos, chave) => [...candidatos].sort((a, b) =>
    (b.confirmado ? 1 : 0) - (a.confirmado ? 1 : 0)
    || (minusculo(b.cog) === chave ? 1 : 0) - (minusculo(a.cog) === chave ? 1 : 0)
    || idDe(a) - idDe(b))[0];
  const agrupar = (chaveDe) => {
    const grupos = new Map();
    for (const j of lista) { const k = chaveDe(j); if (!k) continue; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(j); }
    return grupos;
  };
  const porTwitter = {}, porEmail = {}, porCog = {}, porCogMin = {};
  for (const [k, g] of agrupar(j => minusculo(j.twitter).replace(/^@/, ''))) porTwitter[k] = melhor(g, k).cog;
  for (const [k, g] of agrupar(j => minusculo(j.email))) porEmail[k] = melhor(g, k).cog;
  for (const j of [...lista].sort((a, b) => idDe(a) - idDe(b))) {
    if (!porCog[j.cog]) porCog[j.cog] = j;
  }
  for (const [k, g] of agrupar(j => minusculo(j.cog))) porCogMin[k] = melhor(g, k);
  return { porTwitter, porEmail, porCog, porCogMin };
}

/** COG (dono) da linha da planilha: @ → joiner cadastrada; senão o e-mail; senão o próprio @/e-mail em minúsculas. */
export function cogDaLinha({ twitter, email }, idx) {
  const tw = minusculo(twitter).replace(/^@/, '');
  const em = minusculo(email);
  return idx.porTwitter[tw] || idx.porEmail[em] || tw || em.split('@')[0] || null;
}

/** Joiner já cadastrada para este @, ignorando maiúsculas (se houver gêmeos, a que a regra 1 escolhe). */
export function joinerExistente(cog, idx) {
  return idx.porCogMin[minusculo(cog)] || idx.porCog[cog] || null;
}

/** COG que o upsert deve usar: o da joiner existente (nunca cria um gêmeo só com maiúsculas diferentes). */
export function cogDoUpsert(cog, idx) {
  const atual = joinerExistente(cog, idx);
  return atual ? atual.cog : cog;
}
