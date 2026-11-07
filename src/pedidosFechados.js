// As tabelas de pedidos que o visitante NÃO lê nem altera mais (supabase/seguranca: Q4a/Q4b = DICON, PROMO-MURCE-50, MURCE-ITENS, DAZED-HAN; Q5a/Q5b = as 12 lojas antigas).
// O site lê o "ao vivo" e o estoque pelas visões *_publico (sem nome, e-mail nem comprovante), o histórico próprio por funções do servidor (q4_meus_pedidos / q5_meus_pedidos)
// e cria por função os pedidos das lojas cujo formulário precisa do número de volta. As demais tabelas do site continuam como antes.

// o cliente real só é carregado quando ninguém passa outro (nos testes entra um falso); assim este arquivo não depende do Vite
const padrao = async () => (await import("./supabase.js")).default;

/** Q4: tabela -> chave do formulário. */
export const TABELAS_Q4 = {
  pedidos_dicon_origin: "dicon-origin",
  pedidos_promo_murce_50: "promo-murce-50",
  pedidos_murce_itens: "murce-itens",
  pedidos_dazed_han: "dazed-han",
};
/** Q5: tabela -> { forma (chave do histórico), funcao (o pedido é criado por q5_criar_pedido) }. Mesma lista de q5_config() no banco. */
export const TABELAS_Q5 = {
  pedidos_smolmerch:       { forma: "smolmerch",       funcao: false },
  pedidos_wmag:            { forma: "wmag-hyunjin",    funcao: true },
  pedidos_wmag_leeknow:    { forma: "wmag-leeknow",    funcao: true },
  pedidos_dazed_seungmin:  { forma: "dazed-seungmin",  funcao: true },
  pedidos_esquire_hyunjin: { forma: "esquire-hyunjin", funcao: true },
  pedidos_bazaar_in:       { forma: "bazaar-in",       funcao: true },
  pedidos_revista:         { forma: "revista",         funcao: true },
  pedidos_popup:           { forma: "popup-this-that", funcao: true },
  pedidos_skzoo_rio:       { forma: "popup-skzoo-rio", funcao: true },
  pedidos_singba:          { forma: "singba",          funcao: false },
  pedidos_popcorn_sleeve:  { forma: "popcorn-sleeve",  funcao: false },
  pedidos_lightstick:      { forma: "lightstick",      funcao: false },
};
const tem = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
export const tabelaQ4 = tabela => tem(TABELAS_Q4, tabela);
export const tabelaQ5 = tabela => tem(TABELAS_Q5, tabela);
export const tabelaFechada = tabela => tabelaQ4(tabela) || tabelaQ5(tabela);

/** Onde LER o estoque e o "ao vivo": a visão pública nas tabelas com visão; a própria tabela nas demais. */
export const tabelaPublica = tabela => ((tabelaQ4(tabela) && tabela !== "pedidos_dazed_han") || tabela === "pedidos_smolmerch" ? tabela + "_publico" : tabela);

/** O pedido desta tabela é criado por função do servidor (o formulário recebe o número de volta)? */
export const criaPorFuncao = tabela => tabela === "pedidos_dazed_han" || (tabelaQ5(tabela) && TABELAS_Q5[tabela].funcao);

/** Cria o pedido por função. Devolve { id, error } (id como o servidor devolver). */
export async function criarPedidoFechado(tabela, dados, client) {
  client = client ?? await padrao();
  if (tabela === "pedidos_dazed_han") { const { data, error } = await client.rpc("q4_criar_pedido_dazed_han", { p: dados }); return { id: data ?? null, error }; }
  if (!criaPorFuncao(tabela)) throw new Error("esta tabela não é criada por função: " + tabela);
  const { data, error } = await client.rpc("q5_criar_pedido", { p_tabela: tabela, p: dados });
  return { id: data?.id ?? null, error };
}
/** Atalho para o formato { data: { id }, error } que os formulários já usavam com .insert().select().single(). */
export const criarPedidoComoInsert = (tabela, dados, client) => criarPedidoFechado(tabela, dados, client).then(r => ({ data: r.id === null ? null : { id: r.id }, error: r.error }));

/** Histórico da própria pessoa numa tabela fechada (por e-mail, @ ou COG). Devolve a lista de pedidos, sem dados pessoais. */
export async function meusPedidosFechados(tabela, { email = null, arroba = null, cog = null } = {}, client) {
  client = client ?? await padrao();
  const q = tabelaQ4(tabela)
    ? client.rpc("q4_meus_pedidos", { p_form: TABELAS_Q4[tabela], p_email: email || null, p_social: arroba || null })
    : client.rpc("q5_meus_pedidos", { p_form: TABELAS_Q5[tabela]?.forma, p_email: email || null, p_social: arroba || null, p_cog: cog || null });
  const { data, error } = await q;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** Quais pedidos do "ao vivo" (tabelas da Q4) têm o @ informado: [{ id, social }]. */
export async function meusIdsFechados(tabela, social, client) {
  client = client ?? await padrao();
  const { data, error } = await client.rpc("q4_meus_ids", { p_form: TABELAS_Q4[tabela], p_social: social || null });
  if (error || !Array.isArray(data)) return [];
  return data;
}
