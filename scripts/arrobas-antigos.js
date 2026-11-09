// @ ANTIGOS registrados nas trocas de @ (para o sync reconhecer a pessoa quando a planilha ainda mostra o @ de antes).
// Fontes (só leitura): joiner_updates.campos.twitter = { de, para } (alteração feita no site) e joiner_perfil_historico (campo 'twitter', valor_antigo/valor_novo, por joiner_id).
// Regras: tabela inexistente = sem histórico (comportamento de antes); QUALQUER outro erro de leitura = o sync PARA sem gravar nada (melhor parar do que perder a pessoa de vista).
const faltaTabela = e => e && (e.code === '42P01' || e.code === 'PGRST205' || /relation .* does not exist|could not find the table|schema cache/i.test(e.message || ''));

async function lerPaginado(supabase, tabela, colunas, filtrar) {
  const linhas = []; const TAM = 1000;
  for (let ini = 0; ini < 200000; ini += TAM) {
    let q = supabase.from(tabela).select(colunas).order('id', { ascending: true });
    if (filtrar) q = filtrar(q);
    const { data, error } = await q.range(ini, ini + TAM - 1);
    if (error) { if (faltaTabela(error)) return { linhas: [], ausente: true }; throw new Error(`Não consegui ler ${tabela} (${error.message}). Nada foi gravado.`); }
    linhas.push(...(data || []));
    if (!data || data.length < TAM) break;
  }
  return { linhas, ausente: false };
}

/** Devolve [{ cog, de, para }]: cada troca de @ registrada. `joiners` ([{id,cog}]) liga o histórico por joiner_id ao cog. */
export async function carregarArrobasAntigos(supabase, joiners = []) {
  const saida = [];
  const upd = await lerPaginado(supabase, 'joiner_updates', 'id, joiner_cog, campos');
  for (const r of upd.linhas) {
    const t = r && r.campos && typeof r.campos === 'object' ? r.campos.twitter : null;
    if (t && typeof t === 'object' && !Array.isArray(t) && (t.de || t.para)) saida.push({ cog: r.joiner_cog, de: t.de ?? '', para: t.para ?? '' });
  }
  const cogPorId = new Map((joiners || []).map(j => [j.id, j.cog]));
  const his = await lerPaginado(supabase, 'joiner_perfil_historico', 'id, joiner_id, campo, valor_antigo, valor_novo', q => q.eq('campo', 'twitter'));
  for (const r of his.linhas) { const cog = cogPorId.get(r.joiner_id); if (cog && (r.valor_antigo || r.valor_novo)) saida.push({ cog, de: r.valor_antigo ?? '', para: r.valor_novo ?? '' }); }
  return saida;
}
