// Preservação do e-mail das joiners no sync (MASTERLIST → Supabase). O sync lê o e-mail da coluna EMAIL do PRIMEIRO registro de cada @; essa célula pode estar
// vazia (cadastros novos entram na planilha pelo Apps Script sem preencher EMAIL) e o upsert gravava NULL por cima do e-mail que a pessoa informou no site.
//
// Regras (só para o campo email; os demais campos seguem como sempre):
//   1. célula vazia na planilha           → o e-mail que já está no banco NÃO é tocado;
//   2. joiner com conta ativada (vinculada em contas_joiner, e-mail verificado pelo Auth) → o e-mail NÃO é trocado pelo sync, nem por outro valor da planilha;
//   3. não foi possível saber quem tem conta (consulta falhou) → fail-safe: NENHUM e-mail é enviado pelo sync nesta rodada;
//   4. os demais casos (e-mail novo em quem ainda não tem conta) continuam como hoje: a planilha preenche/atualiza.

/** Devolve o objeto a gravar no upsert de joiners, com ou sem o campo email. */
export function montarUpsertJoiner(j, atual, { idsComConta, contasIndisponiveis = false } = {}) {
  const saida = { ...j };
  const emailPlanilha = String(j.email ?? '').trim();
  if (contasIndisponiveis || !emailPlanilha) { delete saida.email; return saida; }
  if (atual && atual.id != null && idsComConta && idsComConta.has(atual.id)) { delete saida.email; return saida; }
  saida.email = emailPlanilha.toLowerCase();
  return saida;
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
