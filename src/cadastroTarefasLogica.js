import { useCallback, useEffect, useRef, useState } from "react";

// ETAPA 1 do cadastro (lado da administração): lógica e hook das tarefas em Atualizações (padrão do Report). A tela está em CadastroTarefas.jsx.
// Dois estados SEPARADOS: leitura (lida_em) e planilha (pendente | sincronizada | precisa de atenção). A regra de "pendência" vem pronta do banco (campo `pendente`):
//   não lida  OU  planilha "precisa de atenção" que ainda não foi vista (uma falha que exige intervenção VOLTA como pendência, mesmo já lida).
export const MOTIVOS = {
  linha_nao_encontrada: "Não achei a linha em Dados (sem ID e sem @ igual)",
  linha_ambigua: "O mesmo @ aparece em mais de uma linha de Dados",
  duplicata_arroba: "O @ aparece em outra linha de Dados (duplicata real)",
  duplicata_principal: "Há mais de uma linha principal para este cadastro",
  alias_sem_principal: "Só existe linha alias, sem a principal",
  id_site_diferente: "A linha encontrada pertence a outro cadastro",
  celula_com_formula: "A célula de destino em Dados tem fórmula",
  dados_invalidos: "Dados inválidos no pedido",
  tarefa_nao_encontrada: "A tarefa deste envio não existe mais",
  aba_dados_ausente: "Aba Dados não encontrada",
  troca_de_arroba_sem_alias: "Troca de @: a planilha só acompanha na etapa 2 (alias)",
};
export const ORIGENS = {
  site: "feito no site", conta_verificada: "e-mail confirmado pela conta", administracao_ou_servidor: "feito pela administração",
  solicitacao_conta: "pedido da conta", solicitacao_sem_prova: "pedido SEM prova de identidade (login legado)",
};
export const CAMPOS = { nome: "Nome cadastral", email: "E-mail", twitter: "@", arroba: "@", outro: "Outro" };

export const linkTarefa = id => `/admin/atualizacoes?tarefa=${id}`;
export const precisaAtencaoNaoVista = t => t.planilha_status === "atencao" && (!t.atencao_vista_em || new Date(t.atencao_vista_em) < new Date(t.atencao_desde));
export function rotuloPlanilha(t) {
  if (t.planilha_status === "sincronizada") return { texto: "Planilha: sincronizada", cor: "#7CE08A" };
  if (t.planilha_status === "atencao") return { texto: "Planilha: precisa de atenção", cor: "#FF8A80" };
  if (t.planilha_status === "nao_se_aplica") return { texto: "Pedido: não vai à planilha", cor: "rgba(245,240,232,.5)" };
  return { texto: t.planilha_tentativas > 0 ? `Planilha: pendente (${t.planilha_tentativas} tentativa${t.planilha_tentativas > 1 ? "s" : ""})` : "Planilha: pendente", cor: "#FFD166" };
}
export const rotuloLeitura = t => (t.resolvida_em ? { texto: "Resolvida", cor: "rgba(245,240,232,.5)" } : t.lida_em ? { texto: "Lida", cor: "rgba(245,240,232,.5)" } : { texto: "Não lida", cor: "#C9A8F0" });
export function textoNotificacao(t) {
  const campos = Object.keys(t.campos || {}).map(k => CAMPOS[k] || k).join(", ");
  return precisaAtencaoNaoVista(t) && t.lida_em
    ? { titulo: "Cadastro: a planilha precisa de atenção", corpo: `@${t.cog || "?"} · ${campos}${t.planilha_motivo ? " · " + (MOTIVOS[t.planilha_motivo] || t.planilha_motivo) : ""}` }
    : { titulo: t.tipo === "solicitacao" ? "Cadastro: novo pedido de alteração" : "Cadastro alterado", corpo: `@${t.cog || "?"} · ${campos}` };
}

/** Avisa (navegador) cada tarefa que ENTROU ou VOLTOU a ser pendência desde a última checagem. A primeira checagem só marca a base (não avisa o que já existia). */
export function notificarNovas(tarefas, vistas, Notif, aoAbrir) {
  const chaves = new Set(); const novas = [];
  for (const t of tarefas) if (t.pendente) { const k = `${t.id}:${t.atencao_desde || ""}:${t.lida_em ? 1 : 0}`; chaves.add(k); if (vistas.current && !vistas.current.has(k)) novas.push(t); }
  vistas.current = chaves;
  if (!Notif || Notif.permission !== "granted") return novas.length;
  for (const t of novas) {
    const { titulo, corpo } = textoNotificacao(t);
    try { const n = new Notif(titulo, { body: corpo, tag: `cadastro-tarefa-${t.id}` }); n.onclick = () => { try { window.focus(); } catch { /* sem janela */ } aoAbrir?.(t.id); try { n.close(); } catch { /* já fechada */ } }; } catch { /* sem suporte */ }
  }
  return novas.length;
}

export function useCadastroTarefas({ obterCliente, ativo = true, aoAbrir, intervaloMs = 30000 }) {
  const [tarefas, setTarefas] = useState([]);
  const [erro, setErro] = useState("");
  const vistas = useRef(null);
  const aoAbrirRef = useRef(aoAbrir);
  useEffect(() => { aoAbrirRef.current = aoAbrir; });
  const tituloBase = useRef(typeof document !== "undefined" ? document.title.replace(/^\(\d+\)\s*/, "") : "");

  const recarregar = useCallback(async () => {
    try {
      const { data, error } = await obterCliente().rpc("admin_cadastro_tarefas", { p_limite: 300 });
      if (error) { setErro(/function|schema cache|does not exist/i.test(String(error.message)) ? "" : "Não foi possível carregar as tarefas de cadastro."); return; }   // sem o SQL E1 aplicado a lista fica vazia, sem alarme
      setErro(""); const lista = Array.isArray(data) ? data : [];
      setTarefas(lista); notificarNovas(lista, vistas, typeof Notification !== "undefined" ? Notification : null, id => aoAbrirRef.current?.(id));
    } catch { setErro("Não foi possível carregar as tarefas de cadastro."); }
  }, [obterCliente]);
  useEffect(() => { if (!ativo) return undefined; const t0 = setTimeout(recarregar, 0); const t = setInterval(recarregar, intervaloMs); return () => { clearTimeout(t0); clearInterval(t); }; }, [ativo, recarregar, intervaloMs]);

  const pendentes = tarefas.filter(t => t.pendente).length;
  useEffect(() => { if (typeof document === "undefined") return undefined; const base = tituloBase.current; document.title = pendentes > 0 ? `(${pendentes}) ${base}` : base; return () => { document.title = base; }; }, [pendentes]);

  const chamar = useCallback(async (fn, args) => { const { error } = await obterCliente().rpc(fn, args); if (error) setErro("Não foi possível concluir a ação. Tente de novo."); await recarregar(); }, [obterCliente, recarregar]);
  return {
    tarefas, pendentes, erro, recarregar,
    marcarLida: id => chamar("admin_cadastro_marcar_lida", { p_id: id }),
    vejaFalha: id => chamar("admin_cadastro_marcar_atencao_vista", { p_id: id }),
    reprocessar: id => chamar("admin_cadastro_reprocessar", { p_id: id }),
    resolver: (id, nota) => chamar("admin_cadastro_resolver", { p_id: id, p_nota: nota || "" }),
  };
}

