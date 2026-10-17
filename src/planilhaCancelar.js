// Ao REJEITAR um comprovante, o site pede ao Apps Script que volte a planilha para FALSE (ação "cancelar"). Antes isso era `fetch(...).catch(() => {})`: se falhasse, ninguém ficava sabendo,
// a planilha continuava TRUE e o próximo sync (9h/21h) devolvia o pagamento ao site. Este módulo só LÊ a resposta e diz, em texto, quando a planilha pode ter ficado marcada.
// Escopo mínimo de propósito (uma única ação); o tratamento geral das 8 chamadas ao Apps Script está no PR #30.
//
// Respostas entendidas (script antigo e novo): { ok:true, updated:n } | { ok:false } | { erro:"..." } | { updated:n, nao_processados:[{id_linha,motivo,...}], parcial:true }.
// Sem resposta legível (rede, CORS, JSON inválido, HTTP != 2xx, tempo esgotado) = "indeterminado": a planilha PODE ou NÃO ter sido atualizada.

const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbyqioOQMPByiLOI0TgAUBkqVLI5U1U8kwGJAV4MO-fVBp4OmXyBxUk9BtUraoEHAVZReA/exec";
const TOKEN_PLANILHA = "anticeg-pag-2026";

/** Interpreta o JSON do script (puro, sem rede). estado: sucesso | parcial | falha | indeterminado */
export function interpretarCancelar(json, esperados = null) {
  const base = { estado: "falha", atualizados: null, naoProcessados: [], erro: null };
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ...base, estado: "indeterminado", erro: "A planilha respondeu algo que não foi possível entender." };
  const naoProc = Array.isArray(json.nao_processados) ? json.nao_processados : [];
  const atualizados = typeof json.updated === "number" ? json.updated : null;
  const r = { ...base, atualizados, naoProcessados: naoProc };
  if (naoProc.length || json.parcial === true) return { ...r, estado: atualizados > 0 ? "parcial" : "falha", erro: json.erro || "Nem todos os itens foram desmarcados." };
  if (json.erro) return { ...r, erro: String(json.erro) };
  if (json.ok === false) return { ...r, erro: "A planilha recusou a operação." };
  if (esperados != null && atualizados != null && atualizados < esperados) return { ...r, estado: atualizados > 0 ? "parcial" : "falha", erro: `A planilha desmarcou ${atualizados} de ${esperados} item(ns).` };
  // só vale como sucesso com um sinal POSITIVO da planilha (ok:true ou a contagem 'updated'); objeto vazio ou sem esses campos não confirma nada
  if (json.ok !== true && atualizados == null) return { ...r, estado: "indeterminado", erro: "A planilha respondeu sem confirmar a operação." };
  return { ...r, estado: "sucesso" };
}

/** Chama o script e SEMPRE devolve um resultado (nunca lança). */
export async function cancelarNaPlanilha(itens, { fetchImpl, url = URL_PLANILHA, token = TOKEN_PLANILHA, timeoutMs = 30000 } = {}) {
  const f = fetchImpl || globalThis.fetch;
  const esperados = (itens || []).length;
  const indet = erro => ({ estado: "indeterminado", atualizados: null, naoProcessados: [], erro });
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let resp;
  try {
    resp = await f(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ acao: "cancelar", token, itens }), signal: ctrl?.signal });
  } catch (e) {
    return indet(e?.name === "AbortError" ? "A planilha demorou demais para responder." : "Sem resposta da planilha (conexão ou bloqueio do navegador).");
  } finally { if (timer) clearTimeout(timer); }
  if (!resp.ok) return indet(`A planilha respondeu com erro HTTP ${resp.status}.`);
  let json;
  try { json = JSON.parse(await resp.text()); } catch { return indet("A planilha respondeu algo que não foi possível entender."); }
  return interpretarCancelar(json, esperados);
}

const rotulo = i => `${i?.ceg && i.ceg !== "—" ? i.ceg + " — " : ""}${i?.nome_do_item || i?.id_linha || "item"}${i?.id_linha ? ` [${i.id_linha}]` : ""}`;

/** Texto para a administradora; null quando a planilha confirmou tudo (nada a avisar). */
export function mensagemCancelar(r, itens = []) {
  if (r && r.estado === "sucesso") return null;
  const lista = itens.slice(0, 8).map(i => "• " + rotulo(i)).concat(itens.length > 8 ? [`• … e mais ${itens.length - 8}`] : []).join("\n");
  const situacao = !r || r.estado === "indeterminado"
    ? `Não foi possível CONFIRMAR se a planilha foi atualizada (${r?.erro || "sem resposta"}).`
    : r.estado === "parcial" ? `A planilha foi atualizada só EM PARTE${r.erro ? ` (${r.erro})` : ""}.` : `A planilha NÃO foi atualizada${r.erro ? ` (${r.erro})` : ""}.`;
  return `Comprovante rejeitado no site, mas a PLANILHA pode continuar marcada como paga.\n${situacao}\n\n` +
    `Confira e desmarque ITEM / FRETE / RF na planilha para:\n${lista}\n\n` +
    `Enquanto estiver marcada, o próximo sincronismo (9h/21h) devolve o pagamento ao site.`;
}
