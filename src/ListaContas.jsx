// Lista única das pendências de contas (Admin → Contas): uma linha por pessoa, com filtros, busca e o detalhe dentro da própria linha.
// Reúne, para cada pessoa, o pedido, a prova e a ação necessária, com o que a administradora precisa conferir. Quem anexou prova (troca de e-mail ou comprovação) vem primeiro.
// Tudo passa por funções do banco que conferem "é administradora" no servidor (J6, J13, J14, J16). O texto escrito pela pessoa é mostrado como TEXTO (nunca HTML) e sempre marcado como "não é prova".
import { useMemo, useState } from "react";
import { citaOutroProblema, conferencias, dia, diasDeEspera, hora, mensagemSolicitacao, motivoTroca, MOTIVOS_LISTA, ORIENTACOES, provasDe, SITUACOES } from "./filaPessoas.js";

const mono = "'DM Mono',monospace";
const C = { fundo: "rgba(245,240,232,.04)", borda: "rgba(245,240,232,.12)", mudo: "rgba(245,240,232,.62)", texto: "#F5F0E8", destaque: "#FF5C1A", ok: "#BAFF39", erro: "#ff6b6b" };
const campo = { background: "rgba(245,240,232,.06)", border: `1px solid ${C.borda}`, borderRadius: 8, padding: "9px 12px", color: C.texto, fontFamily: "var(--sans, system-ui, sans-serif)", fontSize: 14, minWidth: 0, minHeight: 40, boxSizing: "border-box" };
const botao = (cor = C.destaque) => ({ background: "transparent", border: `1px solid ${cor}`, color: cor, borderRadius: 8, padding: "9px 14px", fontFamily: "var(--sans, system-ui, sans-serif)", fontSize: 13, fontWeight: 500, cursor: "pointer", minHeight: 40 });
const POR_PAGINA = 15;
const ROTULO_TAG = { prova: "Com prova", ajuda: "Pediu ajuda", nada: "Sem pedido", conta: "Já tem conta" };

// estilos com @media (o painel usa estilos em linha; aqui precisamos de colunas que viram cartões no celular)
const CSS = `
.lc-cab,.lc-topo{display:grid;grid-template-columns:minmax(150px,1.3fr) minmax(130px,1fr) minmax(120px,.9fr) 74px 66px 22px;gap:12px;align-items:center}
.lc-cab{padding:0 14px;font:500 10px ${mono};letter-spacing:.1em;text-transform:uppercase;color:${C.mudo}}
.lc-linha{background:rgba(245,240,232,.035);border:1px solid ${C.borda};border-radius:10px;overflow:hidden}
.lc-linha.aberta{border-color:rgba(245,240,232,.4)}
.lc-topo{padding:12px 14px;cursor:pointer;width:100%;text-align:left;background:none;border:0;color:${C.texto};font:inherit;font-family:var(--sans,system-ui,sans-serif)}
.lc-topo:focus-visible,.lc-chip:focus-visible{outline:2px solid ${C.destaque};outline-offset:2px}
.lc-arroba{font-weight:700;font-size:15px}.lc-nome{display:block;color:${C.mudo};font-size:13px}
.lc-m{color:${C.mudo};font-size:13px}.lc-num{font-family:${mono};font-size:12px;color:${C.mudo};text-align:right;font-variant-numeric:tabular-nums}
.lc-tag{font-family:${mono};font-size:11px;padding:3px 8px;border-radius:5px;display:inline-block;white-space:nowrap}
.lc-conta{background:rgba(100,181,246,.16);color:#64B5F6}.lc-orient{display:block;font-size:12px;color:${C.mudo};margin-top:3px}.lc-prova{background:rgba(186,255,57,.14);color:${C.ok}}.lc-ajuda{background:rgba(255,92,26,.16);color:#ff8a57}.lc-nada{background:rgba(245,240,232,.08);color:${C.mudo}}
.lc-seta{color:${C.mudo};transition:transform .15s}.lc-linha.aberta .lc-seta{transform:rotate(90deg)}
.lc-det{border-top:1px solid ${C.borda};padding:16px;display:grid;grid-template-columns:1.15fr 1fr;gap:22px;font-family:var(--sans,system-ui,sans-serif)}
.lc-det h4{margin:0 0 8px;font:500 10px ${mono};letter-spacing:.1em;text-transform:uppercase;color:${C.mudo}}
.lc-fatos{display:grid;gap:8px;margin:0;padding:0;list-style:none;font-family:var(--sans,system-ui,sans-serif);font-size:14px;line-height:1.5}
.lc-fatos li{display:grid;grid-template-columns:20px 1fr;gap:6px}
.lc-chip{font:500 13px var(--sans,system-ui,sans-serif);border:1px solid ${C.borda};background:transparent;color:${C.mudo};padding:7px 12px;border-radius:999px;cursor:pointer;min-height:36px;display:inline-flex;gap:8px;align-items:center}
.lc-chip b{font-family:${mono};font-weight:500;color:${C.texto}}
.lc-chip[aria-pressed="true"]{background:${C.texto};color:#111;border-color:${C.texto}}.lc-chip[aria-pressed="true"] b{color:#111}
.lc-chip.prova:not([aria-pressed="true"]){border-color:${C.ok};color:${C.ok}}.lc-chip.ajuda:not([aria-pressed="true"]){border-color:${C.destaque};color:#ff8a57}
@media (max-width:820px){
  .lc-cab{display:none}
  .lc-topo{grid-template-columns:1fr auto;grid-template-areas:"a s" "b b" "c d";row-gap:6px}
  .lc-topo>:nth-child(1){grid-area:a}.lc-topo>:nth-child(2){grid-area:b}.lc-topo>:nth-child(3){grid-area:s;justify-self:end}.lc-topo>:nth-child(4){grid-area:c;text-align:left}.lc-topo>:nth-child(5){grid-area:d}.lc-topo>:nth-child(6){display:none}
  .lc-det{grid-template-columns:1fr}
}`;

function Facto({ marca, tipo, children }) {
  const cor = tipo === "sim" ? C.ok : tipo === "pend" ? C.destaque : C.mudo;
  return <li><span aria-hidden="true" style={{ color: cor }}>{marca}</span><span>{children}</span></li>;
}

function FatosTroca({ t }) {
  return (
    <ul className="lc-fatos" data-testid="fila-troca-fatos">
      <Facto marca="✓" tipo="sim">E-mail novo (<b>@{t.novo_dominio || "?"}</b>) <b>verificado por código</b>{t.novo_verificado_em ? ` em ${hora(t.novo_verificado_em)}` : ""}.</Facto>
      <Facto marca="–">{motivoTroca(t)}.</Facto>
      <Facto marca="…" tipo="pend">Falta a sua conferência de identidade. Pedido em {hora(t.criado_em)}.</Facto>
    </ul>
  );
}
function AcaoTroca({ p, cliente, onFeito, onErro, recarregar }) {
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
    <div data-testid="fila-troca" style={{ display: "grid", gap: 8 }}>
      <input style={campo} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cole o e-mail novo COMPLETO que a pessoa informou" aria-label={`E-mail novo informado pela pessoa (@${p.cog})`} />
      <input style={campo} value={nota} onChange={e => setNota(e.target.value)} placeholder="como confirmou quem é (canal e data)" aria-label={`Como você confirmou (@${p.cog})`} />
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: C.mudo, fontSize: 13 }}><input type="checkbox" checked={vinculo} onChange={e => setVinculo(e.target.checked)} />também confirmar o vínculo (libera o código de ativação com o e-mail novo)</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={botao(C.ok)} disabled={ocupado || !email.includes("@") || nota.trim().length < 5} onClick={aplicar}>Aplicar troca</button>
        <button style={botao(C.erro)} disabled={ocupado} onClick={cancelar}>Cancelar pedido</button>
      </div>
    </div>
  );
}

function FatosComprovacao({ p }) {
  const c = p.comprovacao;
  return (
    <div data-testid="fila-comprovacao-fatos">
      <ul className="lc-fatos">
        <Facto marca="✓" tipo="sim">Informou o @ e o e-mail do cadastro certos.</Facto>
        <Facto marca="…" tipo="pend">Descreveu outra prova <b style={{ color: "#ff8a57" }}>(texto da pessoa, NÃO é prova)</b>:</Facto>
      </ul>
      <blockquote data-testid="fila-detalhe" style={{ margin: "8px 0", padding: "8px 12px", borderLeft: `3px solid ${C.destaque}`, background: C.fundo, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "var(--sans, system-ui, sans-serif)", fontSize: 14 }}>{c.detalhe || "(sem descrição)"}</blockquote>
      <div style={{ color: C.mudo, fontSize: 13 }}>{p.itens ? `${p.itens} item(ns) no cadastro` : "nenhum item no cadastro"} · pedido em {hora(c.criado_em)} · vale até {dia(c.expira_em)}</div>
    </div>
  );
}
function AcaoComprovacao({ p, cliente, onFeito, onErro, recarregar }) {
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
    <div data-testid="fila-comprovacao" style={{ display: "grid", gap: 8 }}>
      {c.via === "perfil_conhecido" && !c.desafio_validado && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...campo, flex: 1, minWidth: 180 }} value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="código recebido por mensagem direta" aria-label={`Código recebido (@${p.cog})`} />
          <button style={botao(C.mudo)} disabled={codigo.trim().length < 4} onClick={validar}>Conferir código</button>
        </div>
      )}
      {c.via === "perfil_conhecido" && c.desafio_validado && <div style={{ color: C.ok, fontSize: 13 }}>código de mensagem direta já conferido</div>}
      <input style={campo} value={nota} onChange={e => setNota(e.target.value)} placeholder="que prova você aceitou (canal e data), fica no registro" aria-label={`Prova aceita (@${p.cog})`} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={botao(C.ok)} disabled={ocupado || nota.trim().length < 5 || (c.via === "perfil_conhecido" && !c.desafio_validado)} onClick={aprovar}>Aprovar</button>
        <button style={botao(C.erro)} disabled={ocupado} onClick={recusar}>Recusar</button>
      </div>
    </div>
  );
}

// "Confirmar vínculo": a administradora digita o e-mail completo que a pessoa informou pelo canal conhecido; o banco compara com o do cadastro e não o devolve
function AcaoVinculo({ p, cliente, onFeito, onErro, recarregar }) {
  const [email, setEmail] = useState(""), [nota, setNota] = useState(""), [ocupado, setOcupado] = useState(false);
  async function confirmar() {
    setOcupado(true);
    const { error } = await cliente.rpc("admin_confirmar_vinculo", { p_joiner_id: p.joiner_id, p_nota: nota.trim(), p_email_informado: email.trim() });
    setOcupado(false);
    if (error) return onErro("Não foi possível confirmar: " + error.message);
    onFeito(`Vínculo do @${p.cog} confirmado. Ela já pode pedir o código de ativação.`); recarregar();
  }
  return (
    <div data-testid="fila-vinculo" style={{ display: "grid", gap: 8 }}>
      <input style={campo} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e-mail completo que a pessoa informou (o sistema compara com o cadastro)" aria-label={`E-mail completo informado pela pessoa (@${p.cog})`} />
      <input style={campo} value={nota} onChange={e => setNota(e.target.value)} placeholder="como confirmou que é a pessoa certa (canal e data)" aria-label={`Como você confirmou (@${p.cog})`} />
      <div><button style={botao(C.ok)} disabled={ocupado || !email.includes("@") || nota.trim().length < 5} onClick={confirmar}>Confirmar vínculo</button></div>
    </div>
  );
}

const COR_TIPO = { analise: "#ff8a57", ativar: C.ok, conta: "#64B5F6", corrigir_email: "#f0c040", desconhecido: C.mudo };

function Marca({ estado }) {
  const cor = estado === "sim" ? C.ok : estado === "nao" ? C.mudo : C.mudo;
  return <span aria-hidden="true" style={{ color: cor }}>{estado === "sim" ? "✓" : estado === "nao" ? "–" : "?"}</span>;
}

function Orientacao({ p, onFeito, resolverSolicitacao }) {
  const o = p.orientacao;
  const [copiado, setCopiado] = useState(false);
  const citam = p.solicitacoes.filter(citaOutroProblema);
  const podeFechar = !!o.nota && p.solicitacoes.length > 0 && !citam.length;
  async function copiar() {
    try { await navigator.clipboard.writeText(o.mensagem); setCopiado(true); setTimeout(() => setCopiado(false), 2000); onFeito("Mensagem copiada. Cole no canal em que você fala com a pessoa."); }
    catch { window.prompt("Copie a mensagem abaixo:", o.mensagem); }
  }
  async function orientei() {
    if (!window.confirm(`Marcar ${p.solicitacoes.length} pedido(s) de @${p.cog} como RESOLVIDO(S) com a nota:\n“${o.nota}”?\n\nFaça isso só depois de ter orientado a pessoa.`)) return;
    for (const x of p.solicitacoes) await resolverSolicitacao(x, "resolvida", o.nota);
  }
  return (
    <div data-testid="fila-conferir" style={{ background: "rgba(255,92,26,.08)", border: `1px solid ${COR_TIPO[o.tipo]}`, borderRadius: 8, padding: "10px 14px" }}>
      <h4 style={{ color: COR_TIPO[o.tipo], margin: 0 }}>{o.tipo === "analise" ? "O que você precisa conferir" : "Orientação"}: {o.rotulo}</h4>
      <div data-testid="fila-acao" style={{ fontSize: 14, margin: "6px 0 0" }}>{o.resumo}</div>
      {o.passos.length > 0 && <ul data-testid="orientacao-passos" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.55, fontSize: 13, display: "grid", gap: 4 }}>{o.passos.map((t, i) => <li key={i}>{t}</li>)}</ul>}
      {o.falta.length > 0 && <div data-testid="orientacao-falta" style={{ marginTop: 8 }}><div style={{ fontSize: 12, color: C.mudo }}>Falta você conferir:</div><ul style={{ margin: "4px 0 0", paddingLeft: 18, lineHeight: 1.55, fontSize: 13, display: "grid", gap: 4 }}>{o.falta.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
      {citam.length > 0 && o.nota && <div role="status" style={{ marginTop: 8, fontSize: 13, color: "#f0c040" }}>Um dos pedidos cita item ou pagamento: leia antes de fechar. Ter conta não resolve outro problema pendente.</div>}
      {(o.mensagem || podeFechar) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {o.mensagem && <button type="button" style={botao(C.mudo)} onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar mensagem para a pessoa"}</button>}
          {podeFechar && <button type="button" data-testid="orientei" style={botao(C.ok)} onClick={orientei}>Orientei: marcar os pedidos como resolvidos</button>}
        </div>
      )}
    </div>
  );
}

function Detalhe({ p, cliente, motivos, rotuloMotivo, onFeito, onErro, recarregar, resolverSolicitacao }) {
  const acaoVinculo = p.vinculo && !p.troca && !p.comprovacao && !p.tem_conta && p.orientacao.tipo === "analise";
  const checks = conferencias(p), prova = (p.troca || p.comprovacao) ? provasDe(p) : null;
  return (
    <div className="lc-det">
      <div>
        {checks.length > 0 && (
          <div data-testid="conferencias" style={{ marginBottom: 14 }}>
            <h4>Conferido automaticamente</h4>
            <ul className="lc-fatos">{checks.map(c => <li key={c.id} data-testid={`conf-${c.id}`} data-estado={c.estado}><Marca estado={c.estado} /><span>{c.texto}</span></li>)}</ul>
          </div>
        )}
        {prova && (
          <div data-testid="provas" style={{ marginBottom: 14 }}>
            <h4>O que “com prova” significa aqui</h4>
            <ul className="lc-fatos">{["codigo", "descricao", "identidade"].map(k => <li key={k} data-testid={`prova-${k}`} data-estado={prova[k].estado}><Marca estado={prova[k].estado} /><span>{prova[k].texto}</span></li>)}</ul>
          </div>
        )}
        <h4>O que aconteceu</h4>
        {p.troca && <FatosTroca t={p.troca} />}
        {p.comprovacao && <FatosComprovacao p={p} />}
        {p.solicitacoes.map(x => (
          <ul key={x.id} className="lc-fatos" data-testid="fila-solicitacao" style={{ marginTop: 8 }}>
            <Facto marca="…" tipo="pend"><b style={{ color: "#ff8a57" }}>{x.tipo === "ativacao_sem_vinculo" ? "ativação sem vínculo confiável" : x.tipo}</b>{x.valor_pedido ? <> · pediu: <b>{x.valor_pedido}</b></> : null}{x.mensagem ? <> · “{mensagemSolicitacao(x, p)}”</> : null} · {hora(x.criado_em)}
              <span style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button style={botao(C.ok)} onClick={() => resolverSolicitacao(x, "resolvida")}>Resolvido</button><button style={botao(C.erro)} onClick={() => resolverSolicitacao(x, "recusada")}>Recusar</button>
              </span>
            </Facto>
          </ul>
        ))}
        {!p.troca && !p.comprovacao && !p.solicitacoes.length && (
          <ul className="lc-fatos"><Facto marca="–">{p.vinculo && p.vinculo.pedido_de_ajuda ? "Pediu ajuda para ativar e espera resposta." : "Ainda não pediu nada. Quando usar uma das telas novas, o pedido aparece aqui com a prova."}</Facto></ul>
        )}
        <ul className="lc-fatos" style={{ marginTop: 10, color: C.mudo }}>
          {motivos[p.joiner_id] && !p.tem_conta && <Facto marca="–">Por que não ativa sozinha: {rotuloMotivo(motivos[p.joiner_id])}</Facto>}
          <Facto marca="–">{[p.itens == null ? "" : p.itens ? `${p.itens} item(ns) no cadastro` : "nenhum item no cadastro", p.fatos && p.fatos.pagamentos != null ? `${Number(p.fatos.pagamentos)} pagamento(s)` : "", p.dominio ? `e-mail do cadastro @${p.dominio}` : p.dominio === "" ? "sem e-mail válido" : "", p.tem_conta ? "já tem conta" : ""].filter(Boolean).join(" · ") || "cadastro sem mais informações aqui"}</Facto>
        </ul>
      </div>
      <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <Orientacao p={p} onFeito={onFeito} resolverSolicitacao={resolverSolicitacao} />
        {p.troca && <AcaoTroca p={p} cliente={cliente} onFeito={onFeito} onErro={onErro} recarregar={recarregar} />}
        {p.comprovacao && <AcaoComprovacao p={p} cliente={cliente} onFeito={onFeito} onErro={onErro} recarregar={recarregar} />}
        {acaoVinculo && <AcaoVinculo p={p} cliente={cliente} onFeito={onFeito} onErro={onErro} recarregar={recarregar} />}
      </div>
    </div>
  );
}

export default function ListaContas({ cliente, fila, motivos, rotuloMotivo, onFeito, onErro, recarregar, resolverSolicitacao, estilo }) {
  const [situacao, setSituacao] = useState("todos");
  const [motivo, setMotivo] = useState("");
  const [orientacao, setOrientacao] = useState("todos");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState(null);
  const [limite, setLimite] = useState(POR_PAGINA);
  const q = busca.trim().toLowerCase();
  const base = useMemo(() => fila.filter(p => (!motivo || p.motivoChave === motivo) && (orientacao === "todos" || p.orientacao.tipo === orientacao) && (!q || `${p.cog} ${p.nome}`.toLowerCase().includes(q))), [fila, motivo, orientacao, q]);
  const contar = k => (k === "todos" ? base.length : base.filter(p => p.situacao === k).length);
  const visiveis = base.filter(p => situacao === "todos" || p.situacao === situacao);
  const mostradas = visiveis.slice(0, limite);
  const mudar = fn => v => { fn(v); setLimite(POR_PAGINA); setAberta(null); };
  const comProva = fila.filter(p => p.situacao === "prova").length;
  return (
    <div style={estilo} data-testid="admin-fila-pessoas">
      <style>{CSS}</style>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: C.mudo }}>Pendências por pessoa ({fila.length}{comProva ? ` · ${comProva} com prova anexada` : ""})</div>
      <div style={{ color: C.mudo, fontSize: 13, lineHeight: 1.55, marginTop: 6, fontFamily: "var(--sans, system-ui, sans-serif)" }}>
        Quem anexou prova aparece primeiro. As conferências técnicas (conta, e-mail, bloqueio, código) já vêm feitas. Abra uma linha para ver o que a pessoa fez, a orientação e os botões. Nada é aplicado sozinho: reconhecer a pessoa é sempre decisão sua.
      </div>
      <div style={{ display: "grid", gap: 10, margin: "14px 0", position: "sticky", top: 0, zIndex: 3, background: "#0e0e10", padding: "10px 0" }}>
        <div role="group" aria-label="Situação" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(SITUACOES).map(([k, rotulo]) => (
            <button key={k} type="button" className={`lc-chip ${k === "prova" ? "prova" : k === "ajuda" ? "ajuda" : ""}`} aria-pressed={situacao === k} onClick={() => mudar(setSituacao)(k)}>{rotulo} <b>{contar(k)}</b></button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input type="search" style={{ ...campo, flex: "1 1 220px" }} value={busca} onChange={e => mudar(setBusca)(e.target.value)} placeholder="Buscar por @ ou nome" aria-label="Buscar por @ ou nome" />
          <select style={{ ...campo, flex: "0 1 240px" }} value={motivo} onChange={e => mudar(setMotivo)(e.target.value)} aria-label="Motivo do bloqueio">
            <option value="">Todos os motivos</option>
            {Object.entries(MOTIVOS_LISTA).filter(([k]) => fila.some(x => x.motivoChave === k)).map(([k, rotulo]) => <option key={k} value={k}>{rotulo}</option>)}
          </select>
          <select style={{ ...campo, flex: "0 1 240px" }} value={orientacao} onChange={e => mudar(setOrientacao)(e.target.value)} aria-label="Orientação">
            {Object.entries(ORIENTACOES).map(([k, rotulo]) => <option key={k} value={k}>{k === "todos" ? "Todas as orientações" : `${rotulo} (${fila.filter(x => x.orientacao.tipo === k).length})`}</option>)}
          </select>
          <span data-testid="lc-contagem" aria-live="polite" style={{ color: C.mudo, fontSize: 12, fontFamily: mono }}>{mostradas.length} de {visiveis.length} pessoas</span>
        </div>
      </div>
      <div className="lc-cab" aria-hidden="true"><span>Pessoa</span><span>Motivo</span><span>Situação</span><span style={{ textAlign: "right" }}>Itens</span><span style={{ textAlign: "right" }}>Espera</span><span /></div>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {!visiveis.length && <div style={{ padding: "28px 16px", textAlign: "center", color: C.mudo, border: `1px dashed ${C.borda}`, borderRadius: 10, fontSize: 14 }}>{fila.length ? "Ninguém com esses filtros. Limpe a busca ou escolha “Todos”." : "Ninguém aguardando uma decisão sua."}</div>}
        {mostradas.map(p => {
          const dias = diasDeEspera(p), aberto = aberta === p.joiner_id;
          return (
            <div key={p.joiner_id} data-testid={`fila-pessoa-${p.joiner_id}`} className={`lc-linha ${aberto ? "aberta" : ""}`}>
              <button type="button" className="lc-topo" aria-expanded={aberto} onClick={() => setAberta(aberto ? null : p.joiner_id)}>
                <span><span className="lc-arroba">@{p.cog || "?"}</span><span className="lc-nome">{p.nome || "sem nome no site"}</span></span>
                <span className="lc-m">{MOTIVOS_LISTA[p.motivoChave]}</span>
                <span><span className={`lc-tag lc-${p.situacao}`}>{ROTULO_TAG[p.situacao]}</span><span className="lc-orient" data-testid="lc-orient">→ {p.orientacao.rotulo}</span></span>
                <span className="lc-num">{p.itens == null ? "—" : `${p.itens} itens`}</span>
                <span className="lc-num">{dias == null ? "—" : dias === 0 ? "hoje" : `${dias} d`}</span>
                <span className="lc-seta" aria-hidden="true">›</span>
              </button>
              {aberto && <Detalhe p={p} cliente={cliente} motivos={motivos} rotuloMotivo={rotuloMotivo} onFeito={onFeito} onErro={onErro} recarregar={recarregar} resolverSolicitacao={resolverSolicitacao} />}
            </div>
          );
        })}
      </div>
      {visiveis.length > limite && <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}><button type="button" style={botao(C.mudo)} onClick={() => setLimite(l => l + POR_PAGINA)}>Mostrar mais ({visiveis.length - limite} restantes)</button></div>}
    </div>
  );
}
