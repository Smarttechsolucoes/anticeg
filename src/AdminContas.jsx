// Painel da administradora: contas das joiners (vínculos pendentes, cadastros com problema, troca de e-mail, pedidos antigos sem dona).
// Tudo passa por funções do banco que conferem "é administradora" no servidor (J1 e J4c-0); este arquivo só mostra e chama.
// Nada aqui apaga pedido, claim, pagamento ou cadastro.
import { useCallback, useEffect, useState } from "react";
import { clienteAdmin } from "./adminAuth.js";

const mono = "'DM Mono',monospace";
const C = { fundo: "rgba(245,240,232,.04)", borda: "rgba(245,240,232,.12)", mudo: "rgba(245,240,232,.55)", texto: "#F5F0E8", destaque: "#FF5C1A", ok: "#BAFF39", erro: "#ff6b6b" };
const caixa = { background: C.fundo, border: `1px solid ${C.borda}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 };
const campo = { background: "rgba(245,240,232,.06)", border: `1px solid ${C.borda}`, borderRadius: 6, padding: "7px 10px", color: C.texto, fontFamily: mono, fontSize: 12, minWidth: 0 };
const botao = (cor = C.destaque) => ({ background: "transparent", border: `1px solid ${cor}`, color: cor, borderRadius: 6, padding: "6px 12px", fontFamily: mono, fontSize: 11, cursor: "pointer" });
const rot = { fontFamily: mono, fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: C.mudo };

// Escolhe UMA joiner pelo id permanente (a busca mostra e-mail e se já tem conta, para decidir os casos repetidos)
function BuscaJoiner({ cliente, rotulo, onEscolher }) {
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState([]);
  const [msg, setMsg] = useState("");
  async function buscar() {
    setMsg("");
    const { data, error } = await cliente.rpc("admin_buscar_joiners", { p_termo: termo });
    if (error) { setMsg(error.message); return; }
    setAchados(data || []); if (!(data || []).length) setMsg("Nenhuma joiner encontrada (digite ao menos 2 letras).");
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input style={{ ...campo, flex: 1 }} value={termo} onChange={e => setTermo(e.target.value)} placeholder="Buscar joiner por @ ou nome" aria-label="Buscar joiner" onKeyDown={e => { if (e.key === "Enter") buscar(); }} />
        <button style={botao(C.mudo)} onClick={buscar}>Buscar</button>
      </div>
      {msg && <div style={{ color: C.mudo, fontSize: 11, fontFamily: mono }}>{msg}</div>}
      {achados.map(j => (
        <div key={j.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontFamily: mono, fontSize: 11, color: C.texto, borderTop: `1px solid ${C.borda}`, paddingTop: 6 }}>
          <span style={{ flex: 1, minWidth: 180 }}>#{j.id} · @{j.cog} · {j.nome_site || "—"} · {j.email || "sem e-mail"}{j.conta_vinculada ? " · já tem conta" : ""}</span>
          <button style={botao(C.ok)} onClick={() => onEscolher(j)}>{rotulo}</button>
        </div>
      ))}
    </div>
  );
}

export default function AdminContas() {
  const [cliente] = useState(() => clienteAdmin());
  const [pendentes, setPendentes] = useState([]);
  const [problemas, setProblemas] = useState([]);
  const [orfaos, setOrfaos] = useState([]);
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  const [abertoTroca, setAbertoTroca] = useState(null);       // joiner_id com o formulário de troca de e-mail aberto
  const [novoEmail, setNovoEmail] = useState("");
  const [motivo, setMotivo] = useState("");
  const [abertoOrfao, setAbertoOrfao] = useState(null);       // e-mail do grupo de pedidos aberto para vincular
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [a, b, c] = await Promise.all([
      cliente.rpc("admin_vinculos_pendentes"),
      cliente.rpc("admin_joiners_problemas", { p_limite: 500 }),
      cliente.rpc("admin_pedidos_orfaos", { p_limite: 1000 }),
    ]);
    setPendentes(a.data || []); setProblemas(b.data || []); setOrfaos(c.data || []);
    const falha = a.error || b.error || c.error;
    if (falha) setAviso({ tipo: "erro", texto: "Não foi possível carregar tudo: " + falha.message });
    setCarregando(false);
  }, [cliente]);
  useEffect(() => { carregar(); }, [carregar]);

  const ok = texto => setAviso({ tipo: "ok", texto });
  const falhou = texto => setAviso({ tipo: "erro", texto });

  async function resolver(p, aprovar, joiner) {
    if (aprovar && !window.confirm(`Ligar a conta ${p.email_da_conta} ao cadastro @${joiner.cog} (#${joiner.id})? Confirme antes que a pessoa é mesmo a dona deste @.`)) return;
    const { data, error } = await cliente.rpc("admin_resolver_vinculo", { p_id: p.id, p_aprovar: aprovar, p_joiner_id: aprovar ? joiner.id : null });
    if (error) return falhou(error.message);
    ok(data?.status === "aprovado" ? `Conta ligada ao @${joiner.cog}.` : "Pedido recusado.");
    carregar();
  }
  async function trocarEmail(j) {
    if (!window.confirm(`Trocar o e-mail do cadastro @${j.cog} para ${novoEmail.trim()}?\n\nA conta de login antiga será desvinculada (nada é apagado) e a pessoa ativa de novo com o e-mail novo. Só faça depois de confirmar quem é a pessoa por outro canal.`)) return;
    const { data, error } = await cliente.rpc("admin_trocar_email_joiner", { p_joiner_id: j.joiner_id, p_novo_email: novoEmail.trim(), p_motivo: motivo.trim() });
    if (error) return falhou(error.message);
    ok(`E-mail trocado. ${data?.conta_desvinculada ? "A conta antiga foi desvinculada. " : ""}${data?.pedidos_vinculados ? `${data.pedidos_vinculados} pedido(s) do e-mail antigo continuam dela.` : (data?.email_antigo_era_exclusivo === false ? "O e-mail antigo era compartilhado: nenhum pedido foi vinculado sozinho." : "")}`);
    setAbertoTroca(null); setNovoEmail(""); setMotivo(""); carregar();
  }
  async function vincularEmail(email, j) {
    if (!window.confirm(`Vincular TODOS os pedidos feitos com ${email} ao cadastro @${j.cog} (#${j.id})?`)) return;
    const { data, error } = await cliente.rpc("admin_vincular_pedidos_do_email", { p_email: email, p_joiner_id: j.id, p_motivo: "vínculo pelo painel" });
    if (error) return falhou(error.message);
    ok(`${data} pedido(s) vinculado(s) a @${j.cog}.`); setAbertoOrfao(null); carregar();
  }

  // pedidos sem dona agrupados por e-mail
  const grupos = Object.values(orfaos.reduce((m, o) => { const k = (o.email || "(sem e-mail)").toLowerCase(); (m[k] ||= { email: o.email || "", chave: k, itens: [] }).itens.push(o); return m; }, {}));

  return (
    <div style={{ color: C.texto, fontFamily: mono, maxWidth: 980 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, marginBottom: 4 }}>CONTAS DAS JOINERS</div>
      <div style={{ color: C.mudo, fontSize: 11, lineHeight: 1.6, marginBottom: 14 }}>
        Resolva aqui quem não consegue ativar sozinha (e-mail ausente, inválido, repetido ou perdido). Antes de ligar uma conta a um cadastro ou trocar um e-mail, confirme a identidade por outro canal. Cada troca fica registrada.
      </div>
      {aviso.texto && <div role="status" style={{ ...caixa, borderColor: aviso.tipo === "erro" ? C.erro : C.ok, color: aviso.tipo === "erro" ? C.erro : C.ok, fontSize: 12 }}>{aviso.texto}</div>}
      {carregando && <div style={{ color: C.mudo, fontSize: 12, marginBottom: 12 }}>Carregando…</div>}

      <div style={caixa}>
        <div style={rot}>Pedidos de ligação de conta ({pendentes.length})</div>
        {!pendentes.length && <div style={{ color: C.mudo, fontSize: 12, marginTop: 8 }}>Nenhum pedido aberto.</div>}
        {pendentes.map(p => (
          <div key={p.id} style={{ borderTop: `1px solid ${C.borda}`, marginTop: 10, paddingTop: 10, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12 }}>Conta <b>{p.email_da_conta}</b> pediu o @ <b>{p.cog_pedido}</b> · motivo: {p.motivo} · {new Date(p.criado_em).toLocaleString("pt-BR")}</div>
            <BuscaJoiner cliente={cliente} rotulo="Ligar a esta joiner" onEscolher={j => resolver(p, true, j)} />
            <div><button style={botao(C.erro)} onClick={() => window.confirm("Recusar este pedido?") && resolver(p, false)}>Recusar pedido</button></div>
          </div>
        ))}
      </div>

      <div style={caixa}>
        <div style={rot}>Cadastros que não ativam sozinhos ({problemas.length})</div>
        {!problemas.length && <div style={{ color: C.mudo, fontSize: 12, marginTop: 8 }}>Nenhum.</div>}
        {problemas.map(j => (
          <div key={j.joiner_id} style={{ borderTop: `1px solid ${C.borda}`, marginTop: 8, paddingTop: 8, fontSize: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 200 }}>#{j.joiner_id} · @{j.cog} · {j.nome_site || "—"} · {j.email || "sem e-mail"} · <b style={{ color: C.destaque }}>{j.problema}</b>{j.conta_vinculada ? " · já tem conta" : ""}</span>
              <button style={botao()} onClick={() => { setAbertoTroca(abertoTroca === j.joiner_id ? null : j.joiner_id); setNovoEmail(""); setMotivo(""); }}>Trocar e-mail</button>
            </div>
            {abertoTroca === j.joiner_id && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <input style={{ ...campo, flex: 1, minWidth: 200 }} type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="novo e-mail" aria-label="Novo e-mail" />
                <input style={{ ...campo, flex: 1, minWidth: 200 }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="motivo (como confirmou quem é)" aria-label="Motivo" />
                <button style={botao(C.ok)} disabled={!novoEmail.includes("@")} onClick={() => trocarEmail(j)}>Confirmar troca</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={caixa}>
        <div style={rot}>Pedidos antigos sem dona ({orfaos.length} pedidos · {grupos.length} e-mails)</div>
        <div style={{ color: C.mudo, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>Pedidos feitos com um e-mail ou @ que nenhuma conta alcança sozinha (e-mail antigo, digitado diferente ou compartilhado). Ligue ao cadastro certo; nenhum pedido é alterado.</div>
        {grupos.map(g => (
          <div key={g.chave} style={{ borderTop: `1px solid ${C.borda}`, marginTop: 8, paddingTop: 8, fontSize: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 200 }}><b>{g.email || "(sem e-mail)"}</b> · {g.itens.length} pedido(s) · {[...new Set(g.itens.map(i => i.tabela.replace("pedidos_", "")))].join(", ")}{g.itens.some(i => i.social) ? ` · @ digitado: ${[...new Set(g.itens.map(i => i.social).filter(Boolean))].slice(0, 3).join(", ")}` : ""}</span>
              {g.email && <button style={botao()} onClick={() => setAbertoOrfao(abertoOrfao === g.chave ? null : g.chave)}>Vincular…</button>}
            </div>
            {abertoOrfao === g.chave && <div style={{ marginTop: 8 }}><BuscaJoiner cliente={cliente} rotulo="Vincular a esta joiner" onEscolher={j => vincularEmail(g.email, j)} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
