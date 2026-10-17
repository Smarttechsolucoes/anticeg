// Ao CONFIRMAR um pagamento no painel, o banco marca pago_item/pago_frete/pago_rf (RPC admin_definir_status_pagamento), mas a PLANILHA é a fonte da verdade do sync (9h/21h e a cada edição):
// se a planilha não estiver TRUE, o próximo sync DESFAZ a confirmação. Este módulo pede ao Apps Script a ação "confirmar" (mesma já usada no envio do comprovante) e LÊ a resposta.
//
// Garantias:
//  ☆ Idempotente: "confirmar" só escreve TRUE; repetir a chamada não muda nada além do que já está TRUE (por isso é seguro reenviar).
//  ☆ Nunca lança: sempre devolve { estado: sucesso | parcial | falha | indeterminado, ... }.
//  ☆ Falha de rede/HTTP/JSON inválido (indeterminado) é repetida até `tentativas` vezes; resposta DEFINITIVA do script (erro, ok:false, itens recusados) NÃO é repetida em loop.
//  ☆ Resposta parcial: separa os itens recusados em "reenviáveis" (erro_ao_gravar, escrita_parcial, nao_tentado) e "precisam de decisão humana" (id_ambiguo, nao_encontrado, sem_id_linha).
//  ☆ Só envia itens com código (id_linha) e com algum valor > 0; o resto é devolvido em `semCodigo` para a administradora marcar à mão. Nunca escolhe linha por nome.
import { interpretarCancelar } from "./planilhaCancelar.js";

const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbyqioOQMPByiLOI0TgAUBkqVLI5U1U8kwGJAV4MO-fVBp4OmXyBxUk9BtUraoEHAVZReA/exec";
const TOKEN_PLANILHA = "anticeg-pag-2026";
const MOTIVOS_REENVIAVEIS = new Set(["erro_ao_gravar", "escrita_parcial", "nao_tentado"]);

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Itens da demanda que a planilha consegue marcar: { itens, semCodigo }. Puro. Sem duplicar o mesmo código com os mesmos valores. */
export function itensParaPlanilha(demanda) {
  const itens = [], semCodigo = [], vistos = new Set();
  for (const i of (Array.isArray(demanda?.itens) ? demanda.itens : [])) {
    if (!i || i.ceg === "—" || !i.nome_do_item) continue;                       // "outros" não existem na masterlist
    const valores = { valor_item: num(i.valor_item), frete_inter: num(i.frete_inter), taxa_rf: num(i.taxa_rf) };
    if (!(valores.valor_item > 0 || valores.frete_inter > 0 || valores.taxa_rf > 0)) continue;   // nada a marcar
    const id_linha = String(i.id_linha || "").trim();
    if (!id_linha) { semCodigo.push({ ceg: i.ceg, nome_do_item: i.nome_do_item }); continue; }
    const chave = `${id_linha}|${valores.valor_item}|${valores.frete_inter}|${valores.taxa_rf}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    itens.push({ id_linha, ceg: i.ceg, nome_do_item: i.nome_do_item, ...valores });
  }
  return { itens, semCodigo };
}

/** Separa o que o script recusou: { reenviaveis: [item], decisaoHumana: [{item, motivo}] }. Puro. */
export function separarRecusados(resultado, itens = []) {
  const porCodigo = new Map(itens.map(i => [i.id_linha, i]));
  const reenviaveis = [], decisaoHumana = [];
  for (const n of resultado?.naoProcessados || []) {
    const item = porCodigo.get(n?.id_linha) || { id_linha: n?.id_linha || "", ceg: n?.ceg, nome_do_item: n?.nome_do_item };
    if (MOTIVOS_REENVIAVEIS.has(n?.motivo) && porCodigo.has(n?.id_linha)) reenviaveis.push(item);
    else decisaoHumana.push({ item, motivo: n?.motivo || "desconhecido" });
  }
  return { reenviaveis, decisaoHumana };
}

async function umaChamada(itens, { fetchImpl, url, token, timeoutMs }) {
  const f = fetchImpl || globalThis.fetch;
  const indet = erro => ({ estado: "indeterminado", atualizados: null, naoProcessados: [], erro });
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let resp;
  try {
    resp = await f(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ acao: "confirmar", token, itens }), signal: ctrl?.signal });
  } catch (e) {
    return indet(e?.name === "AbortError" ? "A planilha demorou demais para responder." : "Sem resposta da planilha (conexão ou bloqueio do navegador).");
  } finally { if (timer) clearTimeout(timer); }
  if (!resp.ok) return indet(`A planilha respondeu com erro HTTP ${resp.status}.`);
  let json;
  try { json = JSON.parse(await resp.text()); } catch { return indet("A planilha respondeu algo que não foi possível entender."); }
  // "sem_alteracao" (item sem valor a marcar) conta como atendido: o script não o inclui em `updated`
  const semAlteracao = Array.isArray(json?.sem_alteracao) ? json.sem_alteracao.length : 0;
  return interpretarCancelar(json, Math.max(0, itens.length - semAlteracao));
}

/** Confirma na planilha. SEMPRE devolve um resultado (nunca lança). Repete só o que é indeterminado (rede/HTTP/JSON), pois "confirmar" é idempotente. */
export async function confirmarNaPlanilha(itens, { fetchImpl, url = URL_PLANILHA, token = TOKEN_PLANILHA, timeoutMs = 30000, tentativas = 3, esperaMs = 1500, esperar = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (!Array.isArray(itens) || itens.length === 0) return { estado: "sucesso", atualizados: 0, naoProcessados: [], erro: null, tentativas: 0 };
  let r, n = 0;
  while (n < Math.max(1, tentativas)) {
    n++;
    r = await umaChamada(itens, { fetchImpl, url, token, timeoutMs });
    if (r.estado !== "indeterminado") break;
    if (n < tentativas) await esperar(esperaMs * n);
  }
  return { ...r, tentativas: n };
}

const rotulo = i => `${i?.ceg && i.ceg !== "—" ? i.ceg + " — " : ""}${i?.nome_do_item || i?.id_linha || "item"}${i?.id_linha ? ` [${i.id_linha}]` : ""}`;
const lista = (xs, max = 8) => xs.slice(0, max).map(i => "• " + rotulo(i)).concat(xs.length > max ? [`• … e mais ${xs.length - max}`] : []).join("\n");
const MOTIVO_TXT = { id_ambiguo: "código repetido na planilha (não escolhi uma linha)", nao_encontrado: "código não existe na planilha", sem_id_linha: "item sem código", desconhecido: "motivo não informado" };

/** Texto para a administradora; null quando a planilha confirmou tudo e todos os itens tinham código. */
export function mensagemConfirmar(r, itens = [], semCodigo = []) {
  const partes = [];
  if (r && r.estado !== "sucesso") {
    const { reenviaveis, decisaoHumana } = separarRecusados(r, itens);
    const situacao = r.estado === "indeterminado" ? `Não foi possível CONFIRMAR se a planilha foi atualizada (${r.erro || "sem resposta"}).`
      : r.estado === "parcial" ? `A planilha foi atualizada só EM PARTE${r.erro ? ` (${r.erro})` : ""}.` : `A planilha NÃO foi atualizada${r.erro ? ` (${r.erro})` : ""}.`;
    partes.push(`Pagamento confirmado no site, mas a PLANILHA pode não estar marcada como paga.\n${situacao}`);
    if (reenviaveis.length) partes.push(`Pode reenviar (a operação é segura de repetir):\n${lista(reenviaveis)}`);
    if (decisaoHumana.length) partes.push(`Precisam de decisão sua:\n${decisaoHumana.slice(0, 8).map(d => `• ${rotulo(d.item)} — ${MOTIVO_TXT[d.motivo] || d.motivo}`).join("\n")}`);
    if (!reenviaveis.length && !decisaoHumana.length) partes.push(`Confira e marque ITEM / FRETE / RF na planilha para:\n${lista(itens)}`);
  }
  if (semCodigo.length) partes.push(`Itens SEM código (a planilha não foi tocada para eles — marque à mão):\n${lista(semCodigo)}`);
  if (!partes.length) return null;
  return partes.join("\n\n") + "\n\nEnquanto a planilha não estiver marcada, o próximo sincronismo pode desfazer este pagamento no site.";
}
