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
export function indexarJoiners(joiners, arrobasAntigos = []) {
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

  // @ ANTIGOS registrados nas trocas (de/para), por cadastro. Mudanças sucessivas (A→B→C) deixam A e B ligados ao mesmo cadastro.
  // O @ de HOJE de qualquer cadastro (twitter ou cog) sempre vence: um @ antigo só vale se NINGUÉM o usa hoje (a resolução trata isso).
  const cogDoCadastro = new Map(lista.map(j => [minusculo(j.cog), j.cog]));
  const porArrobaAntigo = new Map();            // @ (minúsculo, sem @) -> Set de cogs
  for (const h of arrobasAntigos || []) {
    const cog = cogDoCadastro.get(minusculo(h && h.cog));
    if (!cog) continue;
    for (const v of [h.de, h.para]) {
      const k = minusculo(v).replace(/^@/, '');
      if (!k) continue;
      if (!porArrobaAntigo.has(k)) porArrobaAntigo.set(k, new Set());
      porArrobaAntigo.get(k).add(cog);
    }
  }
  return { porTwitter, porEmail, porCog, porCogMin, porArrobaAntigo };
}

/**
 * Resolve a linha da planilha. Ordem: @ de hoje → e-mail → @ ANTIGO registrado → o próprio @/e-mail (pessoa nova).
 * Devolve { cog, via, conflito }: via = 'twitter' | 'email' | 'arroba_antigo' | 'novo' | 'conflito'.
 * Se mais de um cadastro é possível, via = 'conflito' e cog = null: quem chama NÃO move itens, NÃO cria cadastro e registra o conflito.
 */
export function resolverLinha({ twitter, email }, idx) {
  const tw = minusculo(twitter).replace(/^@/, '');
  const em = minusculo(email);
  const conflito = (tipo, chave, candidatos) => ({ cog: null, via: 'conflito', conflito: { tipo, chave, candidatos } });
  // @ de hoje e e-mail seguem a regra de "dono de hoje" (acima), SEM mudança. Só o @ ANTIGO, que é novo, trata "mais de um cadastro possível" como conflito.
  if (tw && idx.porTwitter[tw]) return { cog: idx.porTwitter[tw], via: 'twitter', conflito: null };
  if (em && idx.porEmail[em]) return { cog: idx.porEmail[em], via: 'email', conflito: null };
  if (tw && idx.porArrobaAntigo && idx.porArrobaAntigo.has(tw)) {
    const donos = [...idx.porArrobaAntigo.get(tw)];
    if (donos.length > 1) return conflito('arroba_antigo_em_mais_de_um_cadastro', tw, donos.map(minusculo).sort());
    const outro = idx.porCogMin[tw];             // alguém tem hoje um cog igual a este @ antigo?
    if (outro && minusculo(outro.cog) !== minusculo(donos[0])) return conflito('arroba_antigo_e_cog_de_outro_cadastro', tw, [minusculo(donos[0]), minusculo(outro.cog)].sort());
    return { cog: donos[0], via: 'arroba_antigo', conflito: null };
  }
  return { cog: tw || em.split('@')[0] || null, via: 'novo', conflito: null };
}

/** COG (dono) da linha da planilha: @ → joiner cadastrada; senão o e-mail; senão o próprio @/e-mail em minúsculas. */
export function cogDaLinha({ twitter, email }, idx) {
  return resolverLinha({ twitter, email }, idx).cog;      // conflito => null (quem precisa distinguir usa resolverLinha)
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
