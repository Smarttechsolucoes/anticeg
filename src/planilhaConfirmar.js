// Ao CONFIRMAR um pagamento no painel, o banco marca pago_item/pago_frete/pago_rf (RPC admin_definir_status_pagamento), mas a PLANILHA é a fonte da verdade do sync (9h/21h e a cada edição):
// se a planilha não estiver TRUE, o próximo sync DESFAZ a confirmação. Este módulo pede a ação "confirmar" PELO PROXY AUTORIZADO (função planilha-acao, com o login de quem decide) e LÊ a resposta.
// O navegador não conhece o token do Apps Script nem o endereço dele; o papel (admin ou staff_pagamentos) é decidido no servidor.
//
// Garantias:
//  ☆ Idempotente: "confirmar" só escreve TRUE; repetir a chamada não muda nada além do que já está TRUE (por isso é seguro reenviar).
//  ☆ Nunca lança: sempre devolve { estado: sucesso | parcial | recusado | indeterminado, ... }.
//  ☆ Falha de rede/HTTP 5xx/JSON inválido (indeterminado) é repetida até `tentativas` vezes; resposta DEFINITIVA (recusa do proxy, erro do script, itens recusados) NÃO é repetida em loop.
//  ☆ Resposta parcial: separa os itens recusados em "reenviáveis" (erro_ao_gravar, escrita_parcial, nao_tentado) e "precisam de decisão humana" (id_ambiguo, nao_encontrado, sem_id_linha).
//  ☆ Só envia itens com código (id_linha) e com algum valor > 0; o resto é devolvido em `semCodigo` para a administradora marcar à mão. Nunca escolhe linha por nome.
import { chamarPlanilha } from "./planilhaApi.js";

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

/** Confirma na planilha pelo proxy. SEMPRE devolve um resultado (nunca lança). Repete só o que é indeterminado, pois "confirmar" é idempotente. `chamar`/`fetchImpl`/`config` existem para teste. */
export async function confirmarNaPlanilha(itens, { chamar = chamarPlanilha, fetchImpl, config, timeoutMs = 30000, tentativas = 3, esperaMs = 1500, esperar = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (!Array.isArray(itens) || itens.length === 0) return { estado: "sucesso", atualizados: 0, naoProcessados: [], erro: null, tentativas: 0 };
  let r, n = 0;
  while (n < Math.max(1, tentativas)) {
    n++;
    r = await chamar("confirmar", { itens }, { esperados: itens.length, admin: true, fetchImpl, config, timeoutMs });
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

/**
 * REJEITAR: quais itens desmarcar na planilha. Puro. Um componente (ITEM/FRETE/RF) NÃO é desmarcado se OUTRA demanda `pago` ou `em_analise`
 * ainda o cobre (mesmo código e valor > 0): o pagamento justificado por outra demanda é preservado. Itens sem código nunca entram.
 * Devolve { itens: [{ id_linha, ceg, nome_do_item, valor_item, frete_inter, taxa_rf }] (só com os componentes a desmarcar), mantidos: [{ id_linha, componente, demanda }] }.
 */
const CAMPOS = [["valor_item", "ITEM"], ["frete_inter", "FRETE"], ["taxa_rf", "RF"]];
export function itensParaCancelar(demanda, todasDemandas = []) {
  const outras = (todasDemandas || []).filter(d => d && d.id !== demanda?.id && (d.status === "pago" || d.status === "em_analise"));
  const cobertura = new Map();                                                  // `${código}|${campo}` -> id da demanda que ainda cobre
  for (const d of outras) for (const i of (Array.isArray(d.itens) ? d.itens : [])) {
    const cod = String(i?.id_linha || "").trim(); if (!cod) continue;
    for (const [campo] of CAMPOS) if (num(i[campo]) > 0 && !cobertura.has(`${cod}|${campo}`)) cobertura.set(`${cod}|${campo}`, d.id);
  }
  const porCodigo = new Map(), mantidos = [];
  for (const i of (Array.isArray(demanda?.itens) ? demanda.itens : [])) {
    if (!i || i.ceg === "—" || !i.nome_do_item) continue;
    const cod = String(i.id_linha || "").trim(); if (!cod) continue;
    for (const [campo, rot] of CAMPOS) {
      if (!(num(i[campo]) > 0)) continue;
      const outra = cobertura.get(`${cod}|${campo}`);
      if (outra != null) { mantidos.push({ id_linha: cod, componente: rot, demanda: outra }); continue; }
      const it = porCodigo.get(cod) || { id_linha: cod, ceg: i.ceg, nome_do_item: i.nome_do_item, valor_item: 0, frete_inter: 0, taxa_rf: 0 };
      it[campo] = num(i[campo]); porCodigo.set(cod, it);
    }
  }
  return { itens: [...porCodigo.values()], mantidos };
}

/** Aviso à administradora sobre o que foi PRESERVADO ao rejeitar (null se nada foi preservado). */
export function mensagemMantidos(mantidos = []) {
  if (!mantidos.length) return null;
  const linhas = mantidos.slice(0, 8).map(m => `• ${m.id_linha} (${m.componente}) — continua justificado pela demanda #${m.demanda}`);
  if (mantidos.length > 8) linhas.push(`• … e mais ${mantidos.length - 8}`);
  return ["Comprovante rejeitado. " + mantidos.length + " marcação(ões) de pagamento NÃO foram desmarcadas na planilha porque outra demanda ainda as cobre:", ...linhas].join("\n");
}
