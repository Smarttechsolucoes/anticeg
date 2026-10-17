// Fluxos do painel de pagamentos que falam com a planilha. Tudo injetável (sem rede, sem alert/confirm globais nos testes).
import { confirmarNaPlanilha, mensagemConfirmar, separarRecusados } from "./planilhaConfirmar.js";

/**
 * CONFIRMAR: grava TRUE na planilha e NUNCA apresenta sucesso indevido. Se a planilha não confirmar tudo:
 *   - mostra o que aconteceu (parcial / sem resposta / recusado) e oferece REENVIAR só os itens pendentes (a operação é idempotente);
 *   - itens recusados por motivo que exige decisão humana (código repetido, inexistente) NÃO são reenviados em loop;
 *   - no máximo `maxRodadas` reenvios; no fim, o último estado é sempre mostrado.
 * Devolve { estado: "sucesso" | "pendente", rodadas, pendentes } — "sucesso" só quando TODOS os itens com código foram confirmados.
 */
export async function confirmarEAvisar(itens, semCodigo = [], {
  confirmar = confirmarNaPlanilha,
  perguntar = txt => (typeof globalThis.confirm === "function" ? globalThis.confirm(txt) : false),
  avisar = txt => { if (typeof globalThis.alert === "function") globalThis.alert(txt); },
  maxRodadas = 3,
} = {}) {
  let atual = Array.isArray(itens) ? itens : [];
  let rodada = 0, resultado = await confirmar(atual), mostrouSemCodigo = false;
  while (resultado.estado !== "sucesso") {
    // o que vale reenviar: tudo se não houve resposta legível; senão só o que o script marcou como reenviável
    const reenviar = resultado.estado === "indeterminado" ? atual : separarRecusados(resultado, atual).reenviaveis;
    const msg = mensagemConfirmar(resultado, atual, mostrouSemCodigo ? [] : semCodigo);
    mostrouSemCodigo = true;
    if (!reenviar.length || rodada >= maxRodadas) { avisar(msg); return { estado: "pendente", rodadas: rodada, pendentes: atual.length }; }
    if (!perguntar(`${msg}\n\nReenviar agora ${reenviar.length} item(ns) pendente(s) à planilha?`)) return { estado: "pendente", rodadas: rodada, pendentes: reenviar.length };
    rodada++; atual = reenviar; resultado = await confirmar(atual);
  }
  const aviso = mensagemConfirmar(resultado, atual, mostrouSemCodigo ? [] : semCodigo);   // só sobra o aviso de itens sem código, se houver
  if (aviso) avisar(aviso);
  return { estado: semCodigo.length ? "sucesso_com_aviso" : "sucesso", rodadas: rodada, pendentes: 0 };   // itens sem código ficam para marcação manual (avisados)
}

/**
 * REABRIR: comportamento esperado, dito com todas as letras. "Em análise" é o estado do envio do comprovante: a planilha fica MARCADA desde o envio,
 * por isso reabrir NÃO desmarca a planilha; o banco desfaz só o que a confirmação ligou e o próximo sincronismo devolve a marca (igual à planilha).
 * Para desmarcar de verdade, a demanda deve ser REJEITADA. `dados` é a resposta da RPC admin_definir_status_pagamento.
 */
export function mensagemReabrir(dados) {
  const mantidas = Number(dados?.itens_mantidos) || 0, desmarcadas = Number(dados?.itens_desmarcados) || 0;
  const linhas = ["Demanda reaberta: voltou para ANÁLISE (não foi rejeitada)."];
  linhas.push("A planilha NÃO foi alterada: itens em análise continuam marcados nela, como no envio do comprovante. No site, as marcas voltam no próximo sincronismo (9h/21h ou ao editar a planilha).");
  if (desmarcadas) linhas.push(`${desmarcadas} marcação(ões) feita(s) por esta confirmação foram desfeitas agora no site.`);
  if (mantidas) linhas.push(`${mantidas} marcação(ões) foram MANTIDAS porque outra demanda paga ou uma marcação manual também as justifica.`);
  linhas.push("Para desmarcar na planilha, rejeite o comprovante.");
  return linhas.join("\n");
}
