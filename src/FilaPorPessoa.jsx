// "Fila por pessoa" (Admin → Contas): o pedido, a prova e a ação necessária de cada pessoa no MESMO cartão, com o que a administradora precisa conferir.
// Tudo passa por funções do banco que conferem "é administradora" no servidor (J6, J13, J14, J16). O texto escrito pela pessoa é mostrado como TEXTO (nunca HTML) e sempre marcado como "não é prova".
import { useState } from "react";
import { acaoNecessaria, dia, hora, motivoTroca, oQueConferir } from "./filaPessoas.js";

const mono = "'DM Mono',monospace";
const C = { fundo: "rgba(245,240,232,.04)", borda: "rgba(245,240,232,.12)", mudo: "rgba(245,240,232,.55)", texto: "#F5F0E8", destaque: "#FF5C1A", ok: "#BAFF39", erro: "#ff6b6b" };
const campo = { background: "rgba(245,240,232,.06)", border: `1px solid ${C.borda}`, borderRadius: 6, padding: "7px 10px", color: C.texto, fontFamily: mono, fontSize: 12, minWidth: 0 };
const botao = (cor = C.destaque) => ({ background: "transparent", border: `1px solid ${cor}`, color: cor, borderRadius: 6, padding: "6px 12px", fontFamily: mono, fontSize: 11, cursor: "pointer" });
const rot = { fontFamily: mono, fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: C.mudo };

function Troca({ p, cliente, onFeito, onErro, recarregar }) {
  const t = p.troca;
  const [email, setEmail] = useState(""), [nota, setNota] = useState(""), [vinculo, setVinculo] = useState(false), [ocupado, setOcupado] = useState(false);
  async function aplicar() {
    if (!window.confirm(`Aplicar a troca de e-mail do cadastro @${p.cog} (#${p.joiner_id})?\n\nO e-mail do cadastro passa a ser o do pedido (já verificado por código).${vinculo ? "\nO vínculo também será CONFIRMADO: ela poderá pedir o código de ativação." : "\nO vínculo NÃO será confirmado."}\nSó faça depois de confirmar quem é a pessoa por outro canal.`)) return;
    setOcupado(true);
    const { data, error } = await cliente.rpc("admin_aplicar_troca_email", { p_id: t.id, p_email_informado: email.trim(), p_nota: nota.trim(), p_confirmar_vinculo: vinculo });
    setOcupado(false);
    if (error) return onErro("Nada foi alterado: " + error.message);
    onFeito(`E-mail do @${p.cog} trocado${data?.vinculo_confirmado ? " e vínculo confirmado: ela já pode pedir o código" : "; o vínculo continua SEM confirmação"}.`); recarregar();
  }
  async function cancelar() {
    const n = window.prompt("Motivo do cancelamento (a pessoa não vê; fica no registro):", ""); if (n === null) return;
    const { error } = await cliente.rpc("admin_cancelar_troca_email", { p_id: t.id, p_nota: n });
    if (error) return onErro("Não foi possível cancelar: " + error.message); onFeito("Pedido de troca cancelado. Nada foi alterado no cadastro."); recarregar();
  }
  return (
    <div data-testid="fila-troca" style={{ borderTop: `1px solid ${C.borda}`, marginTop: 10, paddingTop: 10, fontSize: 12 }}>
      <div style={rot}>Pedido de troca de e-mail</div>
      <div style={{ marginTop: 4, lineHeight: 1.5 }}>{motivoTroca(t)}. E-mail novo no provedor <b>@{t.novo_dominio || "?"}</b>, <b style={{ color: C.ok }}>verificado por código</b>{t.novo_verificado_em ? ` em ${hora(t.novo_verificado_em)}` : ""} · pedido em {hora(t.criado_em)}.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
        <input style={{ ...campo, flex: 1, minWidth: 220 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e-mail novo COMPLETO que a pessoa informou" aria-label={`E-mail novo informado pela pessoa (@${p.cog})`} />
        <input style={{ ...campo, flex: 1, minWidth: 220 }} value={nota} onChange={e => setNota(e.target.value)} placeholder="como confirmou quem é (canal e data)" aria-label={`Como você confirmou (@${p.cog})`} />
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, color: C.mudo, fontSize: 11 }}><input type="checkbox" checked={vinculo} onChange={e => setVinculo(e.target.checked)} />também confirmar o vínculo (libera o código de ativação com o e-mail novo)</label>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button style={botao(C.ok)} disabled={ocupado || !email.includes("@") || nota.trim().length < 5} onClick={aplicar}>Aplicar troca</button>
        <button style={botao(C.erro)} disabled={ocupado} onClick={cancelar}>Cancelar pedido</button>
      </div>
    </div>
  );
}

function Comprovacao({ p, cliente, onFeito, onErro, recarregar }) {
  const c = p.comprovacao;
  const [nota, setNota] = useState(""), [codigo, setCodigo] = useState(""), [ocupado, setOcupado] = useState(false);
  async function aprovar() {
    if (!window.confirm(`Aprovar a comprovação do @${p.cog} (#${p.joiner_id})?\n\nEla passará a poder pedir o código de ativação, que sai para o e-mail que JÁ está no cadastro (@${p.dominio || "?"}). Aprove só se a prova convenceu você.`)) return;
    setOcupado(true); const { error } = await cliente.rpc("admin_aprovar_comprovacao", { p_id: c.id, p_nota: nota.trim() }); setOcupado(false);
    if (error) return onErro("Nada foi alterado: " + error.message); onFeito(`Comprovação do @${p.cog} aprovada. Ela já pode pedir o código de ativação.`); recarregar();
  }
  async function recusar() {
    const n = window.prompt("Motivo da recusa (a pessoa não vê; fica no registro):", nota); if (n === null) return;
    const { error } = await cliente.rpc("admin_recusar_comprovacao", { p_id: c.id, p_nota: n });
    if (error) return onErro("Não foi possível recusar: " + error.message); onFeito("Pedido de comprovação recusado. Nada foi liberado."); recarregar();
  }
  async function validar() {
    const { data, error } = await cliente.rpc("admin_validar_desafio", { p_id: c.id, p_codigo_recebido: codigo });
    if (error) return onErro("Não foi possível conferir: " + error.message);
    if (data === "ok") { onFeito("Código conferido: confere com o do pedido."); recarregar(); } else onErro(data === "errado" ? "O código NÃO confere. Nada foi validado." : data === "bloqueado" ? "Muitas conferências erradas: o código foi bloqueado." : "Não foi possível validar este pedido (" + data + ").");
  }
  return (
    <div data-testid="fila-comprovacao" style={{ borderTop: `1px solid ${C.borda}`, marginTop: 10, paddingTop: 10, fontSize: 12 }}>
      <div style={rot}>Pedido de comprovação (quer manter o e-mail do cadastro)</div>
      <div style={{ marginTop: 4, lineHeight: 1.5 }}>Ela informou o @ e o e-mail certos e escreveu isto <b style={{ color: C.destaque }}>(texto da pessoa, NÃO é prova)</b>:</div>
      <blockquote data-testid="fila-detalhe" style={{ margin: "6px 0", padding: "6px 10px", borderLeft: `3px solid ${C.destaque}`, background: C.fundo, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.detalhe || "(sem descrição)"}</blockquote>
      <div style={{ color: C.mudo, fontSize: 11 }}>{p.itens ? `${p.itens} item(ns) no cadastro` : "nenhum item no cadastro"} · pedido em {hora(c.criado_em)} · vale até {dia(c.expira_em)}</div>
      {c.via === "perfil_conhecido" && !c.desafio_validado && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <input style={{ ...campo, flex: 1, minWidth: 200 }} value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="código recebido por mensagem direta" aria-label={`Código recebido (@${p.cog})`} />
          <button style={botao(C.mudo)} disabled={codigo.trim().length < 4} onClick={validar}>Conferir código</button>
        </div>
      )}
      {c.via === "perfil_conhecido" && c.desafio_validado && <div style={{ color: C.ok, fontSize: 11, marginTop: 6 }}>código de mensagem direta já conferido</div>}
      <input style={{ ...campo, width: "100%", boxSizing: "border-box", marginTop: 8 }} value={nota} onChange={e => setNota(e.target.value)} placeholder="que prova você aceitou (canal e data) — fica no registro" aria-label={`Prova aceita (@${p.cog})`} />
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button style={botao(C.ok)} disabled={ocupado || nota.trim().length < 5 || (c.via === "perfil_conhecido" && !c.desafio_validado)} onClick={aprovar}>Aprovar</button>
        <button style={botao(C.erro)} disabled={ocupado} onClick={recusar}>Recusar</button>
      </div>
    </div>
  );
}

function Cartao({ p, cliente, motivos, rotuloMotivo, onFeito, onErro, recarregar, resolverSolicitacao, confirmarVinculo }) {
  const conferir = oQueConferir(p);
  return (
    <div data-testid={`fila-pessoa-${p.joiner_id}`} style={{ borderTop: `1px solid ${C.borda}`, marginTop: 12, paddingTop: 12 }}>
      <div style={{ fontSize: 13, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <b>@{p.cog || "?"}</b><span style={{ color: C.mudo, fontSize: 11 }}>#{p.joiner_id}{p.nome ? ` · ${p.nome}` : ""}{p.dominio ? ` · e-mail do cadastro @${p.dominio}` : ""}{p.itens ? ` · ${p.itens} item(ns)` : ""}{p.tem_conta ? " · já tem conta" : ""}</span>
      </div>
      <div data-testid="fila-acao" style={{ color: C.destaque, fontSize: 12, marginTop: 4 }}><b>O que fazer:</b> {acaoNecessaria(p)}</div>
      {motivos[p.joiner_id] && <div style={{ color: C.mudo, fontSize: 11, marginTop: 2 }}>por que o cadastro não ativa sozinho: {rotuloMotivo(motivos[p.joiner_id])}</div>}
      <div data-testid="fila-conferir" style={{ border: `1px solid ${C.destaque}`, borderRadius: 8, padding: "8px 12px", marginTop: 8, background: "rgba(255,92,26,.06)" }}>
        <div style={{ ...rot, color: C.destaque }}>O que você precisa conferir</div>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.55, fontSize: 11.5 }}>{conferir.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>
      {p.troca && <Troca p={p} cliente={cliente} onFeito={onFeito} onErro={onErro} recarregar={recarregar} />}
      {p.comprovacao && <Comprovacao p={p} cliente={cliente} onFeito={onFeito} onErro={onErro} recarregar={recarregar} />}
      {p.solicitacoes.map(x => (
        <div key={x.id} data-testid="fila-solicitacao" style={{ borderTop: `1px solid ${C.borda}`, marginTop: 10, paddingTop: 10, fontSize: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 220 }}><b style={{ color: C.destaque }}>{x.tipo === "ativacao_sem_vinculo" ? "ativação sem vínculo confiável" : x.tipo}</b>{x.valor_pedido ? <> · pediu: <b>{x.valor_pedido}</b></> : null}{x.mensagem ? <> · “{x.mensagem}”</> : null} · {hora(x.criado_em)}</span>
          <button style={botao(C.ok)} onClick={() => resolverSolicitacao(x, "resolvida")}>Resolvido</button><button style={botao(C.erro)} onClick={() => resolverSolicitacao(x, "recusada")}>Recusar</button>
        </div>
      ))}
      {p.vinculo && !p.troca && !p.comprovacao && (
        <div style={{ borderTop: `1px solid ${C.borda}`, marginTop: 10, paddingTop: 10 }}><button style={botao(C.ok)} onClick={() => confirmarVinculo(p.vinculo)}>Confirmar vínculo</button></div>
      )}
    </div>
  );
}

export default function FilaPorPessoa({ cliente, fila, motivos, rotuloMotivo, onFeito, onErro, recarregar, resolverSolicitacao, confirmarVinculo, estilo }) {
  const novos = fila.filter(p => p.troca || p.comprovacao).length;
  return (
    <div style={estilo} data-testid="admin-fila-pessoas">
      <div style={rot}>Fila por pessoa ({fila.length}{novos ? ` · ${novos} com prova anexada` : ""})</div>
      <div style={{ color: C.mudo, fontSize: 11, marginTop: 6, lineHeight: 1.55 }}>
        Cada cartão reúne o pedido, a prova e a ação de UMA pessoa. Quem usou “Quero mudar de e-mail” ou “Quero manter meu e-mail e comprovar” aparece primeiro, com o que ela provou. Nada daqui é aplicado sozinho: a identidade é sempre sua decisão.
        As listas abaixo continuam mostrando as mesmas pendências por tipo.
      </div>
      {!fila.length && <div style={{ color: C.mudo, fontSize: 12, marginTop: 8 }}>Ninguém aguardando uma decisão sua.</div>}
      {fila.map(p => <Cartao key={p.joiner_id} p={p} cliente={cliente} motivos={motivos} rotuloMotivo={rotuloMotivo} onFeito={onFeito} onErro={onErro} recarregar={recarregar} resolverSolicitacao={resolverSolicitacao} confirmarVinculo={confirmarVinculo} />)}
    </div>
  );
}
