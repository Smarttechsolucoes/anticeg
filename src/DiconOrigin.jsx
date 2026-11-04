import { useEffect, useState } from "react";
import supabase from "./supabase.js";
import { criarPedidoLoja } from "./joinerAuth.js";
import { DICON_GRUPOS, DICON_OPCOES, DICON_CFG, fmtReais } from "./diconOriginDados.js";

const mono = "'DM Mono',monospace";

function Qty({ valor, onMenos, onMais }) {
  const b = { width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(245,240,232,.2)", background: "transparent", color: "var(--offwhite)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button type="button" aria-label="diminuir" onClick={onMenos} style={b}>−</button>
      <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, minWidth: 22, textAlign: "center" }}>{valor}</span>
      <button type="button" aria-label="aumentar" onClick={onMais} style={b}>+</button>
    </div>
  );
}

// miniatura da capa: sem a foto (ainda não enviada) fica só o quadro com a inicial
function Capa({ m, onAmpliar }) {
  return (
    <div onClick={() => onAmpliar({ src: m.foto, legenda: m.label })}
      style={{ position: "relative", width: 54, height: 80, borderRadius: 6, flexShrink: 0, background: "rgba(245,240,232,.06)", cursor: "zoom-in", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 18, color: "rgba(245,240,232,.25)" }}>
      {m.label.charAt(0).toUpperCase()}
      <img src={m.foto} alt={m.label} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        onError={e => { e.target.style.display = "none"; }} />
    </div>
  );
}

// ── Formulário público ───────────────────────────────────────────────────────
export function DiconOriginFormPage({ pixKey, cfg = DICON_CFG }) {
  const encerrado = !!cfg.deadline && new Date() > cfg.deadline;
  const [claim,       setClaim]       = useState(() => { try { return JSON.parse(localStorage.getItem("anticeg_user_v2"))?.cog || ""; } catch { return ""; } });
  const [nome,        setNome]        = useState("");
  const [email,       setEmail]       = useState("");
  const [social,      setSocial]      = useState("");
  const [qtds,        setQtds]        = useState({});
  const [pagamento,   setPagamento]   = useState("pix");
  const [comprovante, setComprovante] = useState(null);
  const [pixCopiado,  setPixCopiado]  = useState(false);
  const [status,      setStatus]      = useState("idle");
  const [erro,        setErro]        = useState("");
  const [pedidoId,    setPedidoId]    = useState(null);
  const [lightbox,    setLightbox]    = useState(null);   // { src, legenda }
  const [lightboxFalhou, setLightboxFalhou] = useState(false);

  // se a pessoa está logada, preenche nome, e-mail e @ a partir do cadastro
  useEffect(() => {
    if (!claim) return;
    supabase.from("joiners").select("nome_site,twitter,email").eq("cog", claim).single()
      .then(({ data: j }) => {
        if (j?.nome_site) setNome(j.nome_site);
        if (j?.email)     setEmail(j.email);
        if (j?.twitter)   setSocial(j.twitter);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só no primeiro carregamento
  }, []);

  const escolhidos = DICON_OPCOES.filter(o => (qtds[o.id] || 0) > 0);
  const qtdTotal = escolhidos.reduce((a, o) => a + qtds[o.id], 0);
  const total = escolhidos.reduce((a, o) => a + qtds[o.id] * o.preco, 0);
  const ajustar = (id, delta) => setQtds(q => ({ ...q, [id]: Math.min(20, Math.max(0, (q[id] || 0) + delta)) }));
  const ampliar = img => { setLightboxFalhou(false); setLightbox(img); };

  async function handleSubmit(e) {
    e.preventDefault();
    if (cfg.bloqueado) return;
    if (!qtdTotal || !nome.trim() || !email.trim()) { setErro("Preencha nome, e-mail e escolha ao menos 1 capa."); return; }
    if (pagamento === "pix" && !comprovante) { setErro("Anexe o comprovante do PIX."); return; }
    setStatus("enviando"); setErro("");

    // o id é gerado aqui (não precisa ler o pedido de volta do banco) e também dá nome ao comprovante
    const id = crypto.randomUUID();
    let comprovanteUrl = null;
    if (pagamento === "pix" && comprovante) {
      const ext  = comprovante.name.split(".").pop();
      const path = `${cfg.pasta}/${id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, comprovante, { upsert: false });
      if (upErr) { setStatus("idle"); setErro("Erro ao enviar comprovante: " + upErr.message); return; }
      const { data: { publicUrl } } = supabase.storage.from("comprovantes").getPublicUrl(path);
      comprovanteUrl = publicUrl;
    }

    const { error } = await criarPedidoLoja(cfg.tabela, {
      id, nome: nome.trim(), email: email.trim(), social: social.trim() || null,
      itens: escolhidos.map(o => ({ id: o.id, produto: o.produto, opcao: o.label, preco: o.preco, qtd: qtds[o.id] })),
      qtd_total: qtdTotal, valor_total: total,
      forma_pagamento: pagamento, comprovante_url: comprovanteUrl,
      status: pagamento === "depois" ? "pendente" : pagamento === "pix" ? "aguardando" : "cartao",
    });
    if (error) { setStatus("idle"); setErro("Erro: " + (error.message || JSON.stringify(error))); return; }
    setPedidoId(id.slice(0, 8));

    if (pagamento === "cartao") window.open("https://linknabio.gg/anticeg-comu", "_blank");
    setStatus("sucesso");
  }

  const inputStyle = { width: "100%", background: "rgba(245,240,232,.06)", border: "1px solid rgba(245,240,232,.12)", borderRadius: 8, padding: "10px 14px", color: "var(--offwhite)", fontFamily: mono, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const labelStyle = { fontFamily: mono, fontSize: 10, letterSpacing: "1.5px", color: "rgba(245,240,232,.4)", textTransform: "uppercase", marginBottom: 6, display: "block" };
  const caixa = { background: "rgba(245,240,232,.04)", border: "1px solid rgba(245,240,232,.1)", borderRadius: 10, padding: "14px 16px", fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.6)", lineHeight: 1.7 };
  const agora = pagamento !== "depois";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--offwhite)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px 80px" }}>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "zoom-out" }}>
          {lightboxFalhou
            ? <div style={{ fontFamily: mono, fontSize: 12, color: "rgba(245,240,232,.6)" }}>Imagem em breve.</div>
            : <img src={lightbox.src} alt={lightbox.legenda} onError={() => setLightboxFalhou(true)} style={{ maxWidth: "92vw", maxHeight: "86vh", borderRadius: 8, objectFit: "contain" }} />}
          <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.7)" }}>{lightbox.legenda}</div>
        </div>
      )}
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "4px", color: "rgba(245,240,232,.3)", marginBottom: 8 }}>ANTI CEGS × PRÉ-VENDA</div>
          <div style={{ fontSize: "clamp(22px,6vw,32px)", fontWeight: 900, letterSpacing: "-1px", lineHeight: 1.1 }}>{cfg.titulo}</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.5)", marginTop: 6 }}>{cfg.sub}</div>
          {!encerrado && cfg.pedidosAte && (
            <div style={{ marginTop: 10, fontFamily: mono, fontSize: 10, color: "rgba(255,92,26,.7)", letterSpacing: "1px" }}>PEDIDOS ATÉ {cfg.pedidosAte}</div>
          )}
        </div>

        {cfg.bloqueado && (
          <div style={{ background: "rgba(255,209,102,.1)", border: "1px solid rgba(255,209,102,.4)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, textAlign: "center", fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: "1px", color: "#FFD166" }}>
            ⚠ EM BREVE — os pedidos ainda não abriram
          </div>
        )}

        <div style={{ background: "rgba(255,92,26,.07)", border: "1px solid rgba(255,92,26,.2)", borderRadius: 10, padding: "14px 16px", marginBottom: 28, fontSize: 12, lineHeight: 1.7, color: "rgba(245,240,232,.7)" }}>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "2px", color: "var(--laranja)", marginBottom: 8 }}>⚠ AVISOS IMPORTANTES</div>
          {cfg.avisos.map((a, i) => <div key={i}>☆ {a.split("**").map((t, k) => k % 2 ? <strong key={k}>{t}</strong> : t)}</div>)}
        </div>

        {encerrado ? (
          <div style={{ textAlign: "center", padding: "10px 0 28px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontFamily: mono, fontSize: 13, color: "rgba(245,240,232,.5)" }}>Pedidos encerrados em {cfg.pedidosAte}.</div>
          </div>
        ) : status === "sucesso" ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Pedido registrado!</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.5)", lineHeight: 1.6, marginBottom: 24 }}>
              {pagamento === "pix" ? "Comprovante enviado. Aguardando confirmação."
                : pagamento === "depois" ? "Pedido registrado! Avisaremos como e quando pagar."
                : "Abrimos o link de pagamento no cartão. Se não abriu, acesse linknabio.gg/anticeg-comu."}
              {pedidoId && <div style={{ marginTop: 8, fontSize: 10, opacity: .5 }}>#{pedidoId}</div>}
            </div>
            {cfg.grupoWhatsapp && (
              <a href={cfg.grupoWhatsapp} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", padding: "12px 24px", borderRadius: 10, background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.35)", color: "#25d366", fontFamily: mono, fontSize: 12, fontWeight: 700, textDecoration: "none", letterSpacing: "0.5px" }}>
                Entrar no grupo de atualizações
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
              {claim && (
                <div>
                  <label style={labelStyle}>Nome de claim <span style={{ color: "rgba(245,240,232,.25)", fontWeight: 400 }}>· como está na planilha</span></label>
                  <input style={inputStyle} value={claim} onChange={e => setClaim(e.target.value)} placeholder="Seu claim" />
                </div>
              )}
              <div>
                <label style={labelStyle}>Nome do site <span style={{ color: "rgba(245,240,232,.25)", fontWeight: 400 }}>· como você quer aparecer aqui</span></label>
                <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" required />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <div>
                <label style={labelStyle}>@ Rede Social</label>
                <input style={inputStyle} value={social} onChange={e => setSocial(e.target.value)} placeholder="@seu_usuario" />
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={labelStyle}>Escolha as capas — {fmtReais(cfg.preco)} cada</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {DICON_GRUPOS.map(g => (
                  <div key={g.id} style={{ background: "rgba(245,240,232,.03)", border: "1px solid rgba(245,240,232,.08)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px" }}>
                      <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: ".5px" }}>{g.nome}</div>
                      <button type="button" onClick={() => ampliar({ src: g.completa, legenda: `${g.nome} — visualização completa` })}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(245,240,232,.2)", background: "transparent", color: "rgba(245,240,232,.75)", fontFamily: mono, fontSize: 10, cursor: "pointer", whiteSpace: "nowrap" }}>
                        Ver completo
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {g.membros.map(m => {
                        const q = qtds[m.id] || 0;
                        return (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: "1px solid rgba(245,240,232,.06)", background: q > 0 ? "rgba(255,92,26,.06)" : "transparent", transition: "background .15s" }}>
                            <Capa m={m} onAmpliar={ampliar} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                              <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.45)", marginTop: 2 }}>{fmtReais(m.preco)}</div>
                            </div>
                            <Qty valor={q} onMenos={() => ajustar(m.id, -1)} onMais={() => ajustar(m.id, 1)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {total > 0 && (
                <div style={{ marginTop: 14, fontFamily: mono, fontSize: 13, fontWeight: 700, color: "var(--laranja)", textAlign: "right" }}>
                  Total: {fmtReais(total)} ({qtdTotal} unidade{qtdTotal !== 1 ? "s" : ""})
                </div>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={labelStyle}>Pagamento</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {[["agora", "Pagar agora", agora], ["depois", "Pagar depois", !agora]].map(([v, l, ativo]) => (
                  <button key={v} type="button" onClick={() => setPagamento(v === "agora" ? "pix" : "depois")}
                    style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: `1px solid ${ativo ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, background: ativo ? "rgba(255,92,26,.12)" : "transparent", color: ativo ? "var(--laranja)" : "rgba(245,240,232,.6)", fontFamily: mono, fontSize: 11, cursor: "pointer", fontWeight: ativo ? 700 : 400 }}>
                    {l}
                  </button>
                ))}
              </div>

              {!agora && (
                <div style={caixa}>
                  Seu pedido será registrado sem pagamento agora. {cfg.pagarAte
                    ? <>O prazo para pagar é <strong style={{ color: "var(--offwhite)" }}>{cfg.pagarAte}</strong> — após isso o pedido será cancelado automaticamente.</>
                    : "O prazo de pagamento será informado em breve."}
                </div>
              )}

              {agora && (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    {[["pix", "PIX"], ["cartao", "Cartão"]].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setPagamento(v)}
                        style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${pagamento === v ? "rgba(255,92,26,.6)" : "rgba(245,240,232,.1)"}`, background: pagamento === v ? "rgba(255,92,26,.08)" : "transparent", color: pagamento === v ? "var(--laranja)" : "rgba(245,240,232,.5)", fontFamily: mono, fontSize: 11, cursor: "pointer", fontWeight: pagamento === v ? 700 : 400 }}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {pagamento === "pix" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ ...caixa, padding: "14px 16px" }}>
                        <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "rgba(245,240,232,.4)", marginBottom: 6 }}>CHAVE PIX</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ fontSize: 11, wordBreak: "break-all", color: "var(--offwhite)" }}>{pixKey}</span>
                          <button type="button" onClick={() => { navigator.clipboard.writeText(pixKey); setPixCopiado(true); setTimeout(() => setPixCopiado(false), 2000); }}
                            style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(245,240,232,.2)", background: "transparent", color: pixCopiado ? "#4ade80" : "rgba(245,240,232,.7)", fontFamily: mono, fontSize: 10, cursor: "pointer" }}>
                            {pixCopiado ? "✓ copiado" : "copiar"}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Comprovante PIX</label>
                        <input type="file" accept="image/*,application/pdf" onChange={e => setComprovante(e.target.files[0] || null)} style={{ ...inputStyle, padding: "8px 14px", fontSize: 12 }} />
                      </div>
                    </div>
                  )}
                  {pagamento === "cartao" && (
                    <div style={caixa}>Após confirmar, abriremos o link de pagamento (linknabio) para você pagar no cartão.</div>
                  )}
                </>
              )}
            </div>

            {erro && <div style={{ color: "#ff6b6b", fontFamily: mono, fontSize: 11, marginBottom: 16 }}>{erro}</div>}
            <button type="submit" disabled={status === "enviando" || !qtdTotal || cfg.bloqueado}
              style={{ width: "100%", padding: "14px 0", borderRadius: 10, background: qtdTotal && !cfg.bloqueado ? "var(--laranja)" : "rgba(245,240,232,.1)", color: qtdTotal && !cfg.bloqueado ? "#fff" : "rgba(245,240,232,.3)", fontFamily: mono, fontSize: 13, fontWeight: 700, border: "none", cursor: qtdTotal && !cfg.bloqueado ? "pointer" : "not-allowed", letterSpacing: "1px" }}>
              {cfg.bloqueado ? "EM BREVE" : status === "enviando" ? "ENVIANDO..." : "CONFIRMAR PEDIDO →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
