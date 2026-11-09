// Preservação do e-mail das joiners no sync (MASTERLIST → Supabase). O sync lê o e-mail da coluna EMAIL do PRIMEIRO registro de cada @; essa célula pode estar
// vazia (cadastros novos entram na planilha pelo Apps Script sem preencher EMAIL) e o upsert gravava NULL por cima do e-mail que a pessoa informou no site.
//
// Regras (só para o campo email; os demais campos seguem como sempre):
//   1. célula vazia na planilha           → o e-mail que já está no banco NÃO é tocado;
//   2. joiner com conta ativada (vinculada em contas_joiner, e-mail verificado pelo Auth) → o e-mail NÃO é trocado pelo sync, nem por outro valor da planilha;
//   3. não foi possível saber quem tem conta (consulta falhou) → fail-safe: NENHUM e-mail é enviado pelo sync nesta rodada;
//   4. os demais casos (e-mail novo em quem ainda não tem conta) continuam como hoje: a planilha preenche/atualiza.
//   5. joiner cujo e-mail foi TROCADO pela administração ou por um pedido com prova verificada (registro em contas_auditoria: 'trocar_email' ou 'troca_email_verificada') → o e-mail NÃO é trocado pelo sync,
//      senão a rodada seguinte desfaria a troca com o valor antigo da planilha. Nada é sobrescrito nem apagado dos dois lados: o sync só AVISA (log) quando a planilha ainda diz outra coisa, para a planilha ser corrigida.
//   6. não foi possível saber quem teve o e-mail trocado (consulta falhou) → fail-safe: NENHUM e-mail é enviado pelo sync nesta rodada.

/** Devolve o objeto a gravar no upsert de joiners, com ou sem o campo email. */
export function montarUpsertJoiner(j, atual, { idsComConta, contasIndisponiveis = false, idsEmailTrocado, trocadosIndisponiveis = false } = {}) {
  const saida = { ...j };
  const emailPlanilha = String(j.email ?? '').trim();
  if (contasIndisponiveis || trocadosIndisponiveis || !emailPlanilha) { delete saida.email; return saida; }
  if (atual && atual.id != null && idsComConta && idsComConta.has(atual.id)) { delete saida.email; return saida; }
  if (atual && atual.id != null && idsEmailTrocado && idsEmailTrocado.has(atual.id)) { delete saida.email; return saida; }
  saida.email = emailPlanilha.toLowerCase();
  return saida;
}

/** A planilha ainda diz um e-mail diferente do de um cadastro com e-mail trocado (protegido)? Só para avisar no log; não altera nada. */
export function emailPlanilhaDivergeDoTrocado(j, atual, idsEmailTrocado) {
  const emailPlanilha = String(j?.email ?? '').trim().toLowerCase();
  return !!(atual && atual.id != null && idsEmailTrocado && idsEmailTrocado.has(atual.id) && emailPlanilha && emailPlanilha !== String(atual.email ?? '').trim().toLowerCase());
}

/** Lê os ids das joiners com conta ativada. Tabela inexistente (J1 ainda não aplicado) = ninguém tem conta; qualquer outro erro = indisponível (fail-safe). */
export async function carregarIdsComConta(supabase) {
  const { data, error } = await supabase.from('contas_joiner').select('joiner_id');
  if (error) {
    const faltaTabela = error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table|schema cache/i.test(error.message || '');
    return faltaTabela ? { idsComConta: new Set(), contasIndisponiveis: false } : { idsComConta: new Set(), contasIndisponiveis: true };
  }
  return { idsComConta: new Set((data || []).map(r => r.joiner_id)), contasIndisponiveis: false };
}

/**
 * Lê os ids das joiners cujo e-mail foi TROCADO de forma controlada (administração ou pedido com prova verificada), em contas_auditoria.
 * Tabela inexistente (J4c0 ainda não aplicado) = ninguém foi trocado; qualquer outro erro = indisponível (fail-safe: nenhum e-mail enviado pelo sync).
 */
export async function carregarIdsEmailTrocado(supabase) {
  const ids = new Set(); const TAM = 1000;
  for (let ini = 0; ini < 100000; ini += TAM) {
    const { data, error } = await supabase.from('contas_auditoria').select('joiner_id').in('acao', ['trocar_email', 'troca_email_verificada']).order('id', { ascending: true }).range(ini, ini + TAM - 1);
    if (error) {
      // só "a TABELA não existe" vale como "ninguém foi trocado"; coluna ausente, timeout etc. são indisponibilidade (fail-safe)
      const faltaTabela = error.code === '42P01' || error.code === 'PGRST205' || /relation .* does not exist|could not find the table|schema cache/i.test(error.message || '');
      return faltaTabela ? { idsEmailTrocado: new Set(), trocadosIndisponiveis: false } : { idsEmailTrocado: new Set(), trocadosIndisponiveis: true };
    }
    for (const r of data || []) if (r.joiner_id != null) ids.add(r.joiner_id);
    if (!data || data.length < TAM) break;
  }
  return { idsEmailTrocado: ids, trocadosIndisponiveis: false };
}
