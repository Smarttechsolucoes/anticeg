// Chamadas ao Apps Script da planilha (MASTERLIST / Dados), com tratamento EXPLÍCITO da resposta.
// Antes, cada chamada era `fetch(...).catch(() => {})`: se o script recusasse (ID repetido, item não achado, erro de gravação)
// ou a sincronização falhasse, ninguém ficava sabendo e a tela podia parecer que deu certo.
//
// Contrato com o Apps Script (PAGAMENTO-AUTOMATICO):
//   versão antiga:  { ok:true, ... } | { erro:"..." } | { updated:n }
//   versão nova:    { ok, updated, processados, nao_processados:[{id_linha,motivo,detalhe,linhas,ceg,nome_do_item}], parcial, sync, aviso, erro }
// Este módulo entende as duas.

const URL_PADRAO = "https://script.google.com/macros/s/AKfycbyqioOQMPByiLOI0TgAUBkqVLI5U1U8kwGJAV4MO-fVBp4OmXyBxUk9BtUraoEHAVZReA/exec";
// VITE_PLANILHA_URL / VITE_PLANILHA_TOKEN permitem apontar para uma CÓPIA de teste da planilha (sem tocar na produção).
export const URL_PLANILHA = import.meta.env?.VITE_PLANILHA_URL || URL_PADRAO;
const TOKEN_PLANILHA = import.meta.env?.VITE_PLANILHA_TOKEN || "anticeg-pag-2026";

const MOTIVOS = {
  id_ambiguo: "o código (ID) está repetido na planilha",
  nao_encontrado: "o código (ID) não existe na planilha",
  sem_id_linha: "o item não tem código (ID) na planilha",
  erro_ao_gravar: "erro ao gravar na planilha",
  nao_tentado: "não foi tentado porque uma gravação anterior falhou",
  escrita_parcial: "a gravação parou no meio deste item: confira a linha na planilha",
};

/** Quantos itens do lote têm algo a marcar (valor de item, frete ou taxa > 0). */
export function esperadosConfirmacao(itens) {
  return (itens || []).filter(i => Number(i?.valor_item || 0) > 0 || Number(i?.frete_inter || 0) > 0 || Number(i?.taxa_rf || 0) > 0).length;
}

function normalizarItem(n) {
  return { id_linha: n?.id_linha ?? "", motivo: n?.motivo || "desconhecido", detalhe: n?.detalhe || "", linhas: Array.isArray(n?.linhas) ? n.linhas : [], ceg: n?.ceg || "", nome_do_item: n?.nome_do_item || "" };
}

/** Interpreta o JSON do Apps Script (puro, sem rede). estado: sucesso | parcial | recusado | indeterminado. */
export function interpretarResposta(acao, json, { esperados = null } = {}) {
  const base = { acao, ok: false, estado: "recusado", atualizados: null, naoProcessados: [], sincronizacaoPendente: false, aviso: null, erro: null, bruto: json };
  if (!json || typeof json !== "object") return { ...base, estado: "indeterminado", erro: "A planilha respondeu algo que não foi possível entender." };
  const naoProc = Array.isArray(json.nao_processados) ? json.nao_processados.map(normalizarItem) : [];
  if (json.ambiguo && !naoProc.length) naoProc.push(normalizarItem({ id_linha: json.id_linha, motivo: "id_ambiguo", linhas: json.linhas, detalhe: json.erro }));
  const atualizados = typeof json.updated === "number" ? json.updated : null;
  const r = { ...base, atualizados, naoProcessados: naoProc, sincronizacaoPendente: json.sync === false, aviso: json.aviso || null };

  // json.parcial: o script gravou ALGO antes de falhar (mesmo com updated=0) — nunca tratar como "nada foi alterado"
  if (naoProc.length) return { ...r, estado: (atualizados > 0 || json.parcial === true) ? "parcial" : "recusado", erro: json.erro || "Nem todos os itens foram processados." };
  if (json.parcial === true) return { ...r, estado: "parcial", erro: String(json.erro || "A planilha foi alterada só em parte.") };
  if (json.erro) return { ...r, erro: String(json.erro) };
  if (json.ok === false) return { ...r, erro: "A planilha recusou a operação." };
  // versão antiga do script: não lista o que ficou de fora, mas devolve quantos atualizou — comparamos com o esperado
  if (esperados != null && atualizados != null && atualizados < esperados) {
    return { ...r, estado: atualizados > 0 ? "parcial" : "recusado", erro: `A planilha confirmou ${atualizados} de ${esperados} item(ns).` };
  }
  return { ...r, ok: true, estado: "sucesso" };
}

/** Faz a chamada e SEMPRE devolve um resultado (nunca lança). Sem resposta legível = "indeterminado": pode ou não ter sido aplicado. */
export async function chamarPlanilha(acao, dados = {}, { esperados = null, fetchImpl, url = URL_PLANILHA, token = TOKEN_PLANILHA, timeoutMs = 30000 } = {}) {
  const f = fetchImpl || globalThis.fetch;
  const base = { acao, ok: false, estado: "indeterminado", atualizados: null, naoProcessados: [], sincronizacaoPendente: false, aviso: null, erro: null, bruto: null };
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let resp;
  try {
    resp = await f(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ acao, token, ...dados }), signal: ctrl?.signal });
  } catch (e) {
    return { ...base, erro: e?.name === "AbortError" ? "A planilha demorou demais para responder." : "Sem resposta da planilha (conexão ou bloqueio do navegador)." };
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!resp.ok) return { ...base, erro: `A planilha respondeu com erro HTTP ${resp.status}.` };
  let json;
  try { json = JSON.parse(await resp.text()); }
  catch { return { ...base, erro: "A planilha respondeu algo que não foi possível entender." }; }
  return interpretarResposta(acao, json, { esperados });
}

function rotulo(n) { return n.nome_do_item ? `${n.ceg ? n.ceg + " — " : ""}${n.nome_do_item}` : (n.id_linha || "item sem código"); }

/**
 * Texto para mostrar a quem fez a ação. Devolve null quando está tudo certo (nada a avisar).
 * perfil "admin" mostra detalhe técnico (linhas, IDs); "joiner" fala em termos simples e não culpa a pessoa.
 * itensSemId: itens que nem foram enviados à planilha por não terem código.
 */
export function mensagemPlanilha(r, { perfil = "joiner", itensSemId = [], contexto = "A planilha" } = {}) {
  const linhas = [];
  const lista = (itens, comMotivo) => itens.slice(0, 8).map(n => "• " + rotulo(n) + (comMotivo ? ` (${MOTIVOS[n.motivo] || n.motivo}${perfil === "admin" && n.linhas?.length ? `; linhas ${n.linhas.join(", ")}` : ""})` : "")).concat(itens.length > 8 ? [`• … e mais ${itens.length - 8}`] : []);
  if (r && r.estado === "indeterminado") {
    linhas.push(perfil === "admin" ? `${contexto}: não foi possível confirmar se foi atualizada — ${r.erro || "sem resposta"}. Confira a planilha.` : `Não conseguimos confirmar a atualização automática da planilha. A administração vai conferir.`);
  } else if (r && !r.ok) {
    linhas.push(r.estado === "parcial"
      ? (perfil === "admin" ? `${contexto}: atualização PARCIAL${r.atualizados > 0 ? ` (${r.atualizados} item(ns) atualizado(s))` : ""}.` : "A planilha foi atualizada só em parte. A administração vai conferir o restante.")
      : (perfil === "admin" ? `${contexto}: NÃO foi atualizada${r.erro ? ` — ${r.erro}` : ""}.` : "A planilha não pôde ser atualizada automaticamente. A administração vai conferir."));
    if (r.naoProcessados.length) { linhas.push(perfil === "admin" ? "Itens não processados:" : "Itens que precisam de conferência:"); linhas.push(...lista(r.naoProcessados, true)); }
    else if (perfil === "admin" && r.erro && r.estado === "parcial") linhas.push(r.erro);
  } else if (r && r.sincronizacaoPendente) {
    linhas.push(perfil === "admin" ? `${contexto} foi atualizada, mas a sincronização com o site falhou. O site pode demorar a refletir; a próxima sincronização corrige.` : "A planilha foi atualizada; o site pode demorar alguns minutos para refletir.");
  }
  if (itensSemId.length) { linhas.push(perfil === "admin" ? "Itens sem código (ID) na planilha — não foram enviados:" : "Estes itens não têm código na planilha e serão conferidos pela administração:"); linhas.push(...lista(itensSemId, false)); }
  return linhas.length ? linhas.join("\n") : null;
}
