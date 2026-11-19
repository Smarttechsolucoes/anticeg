import { useEffect, useState } from "react";
import supabase from "./supabase.js";
import { criarPedidoLoja } from "./joinerAuth.js";
import { enviarComprovante as enviarArquivoSeguro } from "./comprovantes.js";
import { MAKESTAR_GRUPOS, MAKESTAR_OPCOES, MAKESTAR_CFG, fmtReais } from "./promoMakestarDados.js";

const mono = "'DM Mono',monospace";

function Qty({ valor, onMenos, onMais }) {
  const b = { width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(245,240,232,.2)", background: "transparent", color: "var(--offwhite)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      <button type="button" aria-label="diminuir" onClick={onMenos} style={b}>−</button>
      <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, minWidth: 22, textAlign: "center" }}>{valor}</span>
      <button type="button" aria-label="aumentar" onClick={onMais} style={b}>+</button>
    </div>
  );
}

// busca sem diferenciar maiúsculas nem acentos
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ── Formulário público ───────────────────────────────────────────────────────
export function PromoMakestarFormPage({ pixKey, cfg = MAKESTAR_CFG }) {
  const encerrado = !!cfg.deadline && new Date() > cfg.deadline;
  const [claim,       setClaim]       = useState(() => { try { return JSON.parse(localStorage.getItem("anticeg_user_v2"))?.cog || ""; } catch { return ""; } });
  const [nome,        setNome]        = useState("");
  const [email,       setEmail]       = useState("");
  const [social,      setSocial]      = useState("");
  const [qtds,        setQtds]        = useState({});
  const [busca,       setBusca]       = useState("");
  const [abertos,     setAbertos]     = useState({});     // grupos expandidos: { [id]: true }
  const [pagamento,   setPagamento]   = useState("pix");  // pagamento imediato: só "pix" ou "cartao"
  const [comprovante, setComprovante] = useState(null);
  const [pixCopiado,  setPixCopiado]  = useState(false);
  const [status,      setStatus]      = useState("idle");
  const [erro,        setErro]        = useState("");
  const [pedidoId,    setPedidoId]    = useState(null);
  const [logado]                      = useState(() => { try { return !!JSON.parse(localStorage.getItem("anticeg_user_v2"))?.cog; } catch { return false; } });
  const [editando,    setEditando]    = useState(false);
  const [cadastroCompleto, setCadastroCompleto] = useState(false);   // o cadastro já tem nome do site e e-mail
  const [socialDoCadastro, setSocialDoCadastro] = useState(false);   // o cadastro já tem o @

  // se a pessoa está logada, preenche nome, e-mail e @ a partir do cadastro
  useEffect(() => {
    if (!claim) return;
    supabase.from("joiners").select("nome_site,twitter,email").eq("cog", claim).single()
      .then(({ data: j }) => {
        if (j?.nome_site) setNome(j.nome_site);
        if (j?.email)     setEmail(j.email);
        if (j?.twitter)   setSocial(j.twitter);
        // a trava vale pelo que veio do CADASTRO (não pelo que a pessoa digita): cadastro sem nome do site/e-mail fica livre para preencher
        setCadastroCompleto(!!j?.nome_site?.trim() && !!j?.email?.trim());
        setSocialDoCadastro(!!j?.twitter?.trim());
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só no primeiro carregamento
  }, []);

  const escolhidos = MAKESTAR_OPCOES.filter(o => (qtds[o.id] || 0) > 0);
  const qtdTotal = escolhidos.reduce((a, o) => a + qtds[o.id], 0);
  const total = escolhidos.reduce((a, o) => a + qtds[o.id] * o.preco, 0);
  const ajustar = (id, delta) => setQtds(q => ({ ...q, [id]: Math.min(20, Math.max(0, (q[id] || 0) + delta)) }));

  // com busca, só aparecem os álbuns que combinam (artista ou título) e os grupos ficam abertos
  const termo = norm(busca.trim());
  const gruposVisiveis = MAKESTAR_GRUPOS
    .map(g => ({ ...g, itens: termo ? g.itens.filter(i => norm(`${i.produto} ${i.label}`).includes(termo)) : g.itens }))
    .filter(g => g.itens.length > 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (cfg.bloqueado) return;
    if (!qtdTotal || !nome.trim() || !email.trim()) { setErro("Preencha nome, e-mail e escolha ao menos 1 álbum."); return; }
    if (!comprovante) { setErro(pagamento === "pix" ? "Anexe o comprovante do PIX." : "Pague no cartão pelo link e anexe o comprovante."); return; }
    setStatus("enviando"); setErro("");

    // o id é gerado aqui (não precisa ler o pedido de volta do banco) e também dá nome ao comprovante
    const id = crypto.randomUUID();
    let comprovanteUrl = null;
    if (comprovante) {   // PIX e cartão: os dois exigem o comprovante
      const ext  = comprovante.name.split(".").pop();
      const path = `${cfg.pasta}/${id}.${ext}`;
      const { error: upErr } = await enviarArquivoSeguro("comprovantes", path, comprovante, { upsert: false });
      if (upErr) { setStatus("idle"); setErro("Erro ao enviar comprovante: " + upErr.message); return; }
      const { data: { publicUrl } } = supabase.storage.from("comprovantes").getPublicUrl(path);
      comprovanteUrl = publicUrl;
    }

    const { error } = await criarPedidoLoja(cfg.tabela, {
      id, nome: nome.trim(), email: email.trim(), social: social.trim() || null,
      itens: escolhidos.map(o => ({ id: o.id, produto: o.produto, opcao: o.label, preco: o.preco, qtd: qtds[o.id] })),
      qtd_total: qtdTotal, valor_total: total,
      forma_pagamento: pagamento, comprovante_url: comprovanteUrl,
      status: pagamento === "pix" ? "aguardando" : "cartao",
    });
    if (error) { setStatus("idle"); setErro("Erro: " + (error.message || JSON.stringify(error))); return; }
    setPedidoId(id.slice(0, 8));

    setStatus("sucesso");
  }

  const inputStyle = { width: "100%", background: "rgba(245,240,232,.06)", border: "1px solid rgba(245,240,232,.12)", borderRadius: 8, padding: "10px 14px", color: "var(--offwhite)", fontFamily: mono, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const labelStyle = { fontFamily: mono, fontSize: 10, letterSpacing: "1.5px", color: "rgba(245,240,232,.4)", textTransform: "uppercase", marginBottom: 6, display: "block" };
  // campo do cadastro: travado fica mais apagado e sem cursor de digitação
  const campo = trava => trava ? { ...inputStyle, background: "rgba(245,240,232,.03)", color: "rgba(245,240,232,.7)", cursor: "default" } : inputStyle;
  // quem está logada tem os dados vindos do cadastro travados; sem nome ou e-mail (cadastro incompleto) os campos ficam livres
  const travado = logado && cadastroCompleto && !editando && !!nome.trim() && !!email.trim();
  const caixa = { background: "rgba(245,240,232,.04)", border: "1px solid rgba(245,240,232,.1)", borderRadius: 10, padding: "14px 16px", fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.6)", lineHeight: 1.7 };
  const podeEnviar = qtdTotal > 0 && !cfg.bloqueado;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--offwhite)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px 80px" }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "4px", color: "rgba(245,240,232,.3)", marginBottom: 8 }}>ANTI CEGS × PROMO</div>
          <div style={{ fontSize: "clamp(22px,6vw,32px)", fontWeight: 900, letterSpacing: "-1px", lineHeight: 1.1 }}>{cfg.titulo} ☆</div>
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
              Comprovante enviado. Aguardando confirmação.
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
              {logado && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.4)", lineHeight: 1.5 }}>
                    {travado ? "Dados do seu cadastro. Algo errado? Toque em Editar (vale só para este pedido)." : "Editando os dados deste pedido."}
                  </div>
                  {(travado || editando) && (
                    <button type="button" onClick={() => setEditando(e => !e)}
                      style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(245,240,232,.2)", background: "transparent", color: editando ? "var(--laranja)" : "rgba(245,240,232,.75)", fontFamily: mono, fontSize: 10, cursor: "pointer" }}>
                      {editando ? "Travar" : "✎ Editar"}
                    </button>
                  )}
                </div>
              )}
              {claim && (
                <div>
                  <label style={labelStyle}>Nome de claim <span style={{ color: "rgba(245,240,232,.25)", fontWeight: 400 }}>· como está na planilha</span></label>
                  <input style={campo(travado)} readOnly={travado} value={claim} onChange={e => setClaim(e.target.value)} placeholder="Seu claim" />
                </div>
              )}
              <div>
                <label style={labelStyle}>Nome do site <span style={{ color: "rgba(245,240,232,.25)", fontWeight: 400 }}>· como você quer aparecer aqui</span></label>
                <input style={campo(travado)} readOnly={travado} value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" required />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input style={campo(travado)} readOnly={travado} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <div>
                <label style={labelStyle}>@ Rede Social</label>
                <input style={campo(travado && socialDoCadastro)} readOnly={travado && socialDoCadastro} value={social} onChange={e => setSocial(e.target.value)} placeholder="@seu_usuario" />
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={labelStyle}>Escolha os álbuns — {fmtReais(cfg.preco)} cada</div>
              <input type="search" style={{ ...inputStyle, marginBottom: 12 }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar artista ou álbum…" aria-label="Buscar artista ou álbum" />

              {gruposVisiveis.length === 0 && (
                <div style={{ fontFamily: mono, fontSize: 12, opacity: .5, padding: "16px 0", textAlign: "center" }}>Nenhum álbum encontrado.</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {gruposVisiveis.map(g => {
                  const aberto = !!termo || !!abertos[g.id];
                  // a quantidade escolhida aparece no grupo mesmo fechado (conta todos os álbuns do grupo, não só os filtrados pela busca)
                  const qGrupo = MAKESTAR_GRUPOS.find(x => x.id === g.id).itens.reduce((a, i) => a + (qtds[i.id] || 0), 0);
                  return (
                    <div key={g.id} style={{ background: "rgba(245,240,232,.03)", border: `1px solid ${qGrupo > 0 ? "rgba(255,92,26,.35)" : "rgba(245,240,232,.08)"}`, borderRadius: 12, overflow: "hidden" }}>
                      <button type="button" aria-expanded={aberto} onClick={() => setAbertos(a => ({ ...a, [g.id]: !a[g.id] }))}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "transparent", border: "none", color: "var(--offwhite)", cursor: "pointer", textAlign: "left" }}>
                        <span style={{ flex: 1, fontWeight: 800, fontSize: 14, letterSpacing: ".5px" }}>{g.nome}</span>
                        {qGrupo > 0 && <span style={{ fontSize: 9, fontFamily: mono, background: "var(--laranja)", color: "#fff", borderRadius: 10, padding: "1px 6px", fontWeight: 700 }}>{qGrupo}</span>}
                        <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.4)" }}>{g.itens.length} álbum{g.itens.length !== 1 ? "ns" : ""}</span>
                        <span style={{ fontFamily: mono, fontSize: 12, color: "rgba(245,240,232,.5)" }}>{aberto ? "−" : "+"}</span>
                      </button>
                      {aberto && g.itens.map(i => {
                        const q = qtds[i.id] || 0;
                        return (
                          <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: "1px solid rgba(245,240,232,.06)", background: q > 0 ? "rgba(255,92,26,.06)" : "transparent" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-word" }}>{g.id === "outros" ? <><span style={{ color: "var(--laranja)" }}>{i.produto}</span> — {i.label}</> : i.label}</div>
                              <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.45)", marginTop: 2 }}>{fmtReais(i.preco)}</div>
                            </div>
                            <Qty valor={q} onMenos={() => ajustar(i.id, -1)} onMais={() => ajustar(i.id, 1)} />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {escolhidos.length > 0 && (
                <div style={{ ...caixa, marginTop: 16 }}>
                  <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "rgba(245,240,232,.4)", marginBottom: 8 }}>SEU PEDIDO</div>
                  {escolhidos.map(o => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "2px 0", color: "var(--offwhite)" }}>
                      <span style={{ wordBreak: "break-word" }}>{qtds[o.id]}x {o.produto} — {o.label}</span>
                      <span style={{ flexShrink: 0 }}>{fmtReais(qtds[o.id] * o.preco)}</span>
                    </div>
                  ))}
                </div>
              )}
              {total > 0 && (
                <div style={{ marginTop: 14, fontFamily: mono, fontSize: 13, fontWeight: 700, color: "var(--laranja)", textAlign: "right" }}>
                  Total: {fmtReais(total)} ({qtdTotal} álbum{qtdTotal !== 1 ? "ns" : ""})
                </div>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={labelStyle}>Pagamento imediato</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[["pix", "PIX"], ["cartao", "Cartão"]].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setPagamento(v)}
                    style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: `1px solid ${pagamento === v ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, background: pagamento === v ? "rgba(255,92,26,.12)" : "transparent", color: pagamento === v ? "var(--laranja)" : "rgba(245,240,232,.6)", fontFamily: mono, fontSize: 11, cursor: "pointer", fontWeight: pagamento === v ? 700 : 400 }}>
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
                </div>
              )}
              {pagamento === "cartao" && (
                <div style={caixa}>
                  <div style={{ marginBottom: 10 }}>1. Pague no cartão pelo link abaixo. 2. Volte aqui e anexe o comprovante do pagamento.</div>
                  <a href="https://linknabio.gg/anticeg-comu" target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-block", padding: "9px 16px", borderRadius: 8, background: "rgba(255,92,26,.12)", border: "1px solid var(--laranja)", color: "var(--laranja)", fontFamily: mono, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                    Abrir link de pagamento (cartão) ↗
                  </a>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Comprovante de pagamento {pagamento === "pix" ? "(PIX)" : "(cartão)"}</label>
                <input type="file" accept="image/*,application/pdf" onChange={e => setComprovante(e.target.files[0] || null)} style={{ ...inputStyle, padding: "8px 14px", fontSize: 12 }} />
              </div>
            </div>

            {erro && <div style={{ color: "#ff6b6b", fontFamily: mono, fontSize: 11, marginBottom: 16 }}>{erro}</div>}
            <button type="submit" disabled={status === "enviando" || !podeEnviar}
              style={{ width: "100%", padding: "14px 0", borderRadius: 10, background: podeEnviar ? "var(--laranja)" : "rgba(245,240,232,.1)", color: podeEnviar ? "#fff" : "rgba(245,240,232,.3)", fontFamily: mono, fontSize: 13, fontWeight: 700, border: "none", cursor: podeEnviar ? "pointer" : "not-allowed", letterSpacing: "1px" }}>
              {cfg.bloqueado ? "EM BREVE" : status === "enviando" ? "ENVIANDO..." : "CONFIRMAR PEDIDO →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
