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

// linhas da tela "meu pedido completo"
function ResumoTitulo({ children }) {
  return <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "2px", color: "rgba(245,240,232,.4)", textTransform: "uppercase", margin: "18px 0 6px", paddingTop: 12, borderTop: "1px solid rgba(245,240,232,.1)" }}>{children}</div>;
}
function ResumoLinha({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "3px 0", fontSize: 12 }}>
      <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.45)", flexShrink: 0 }}>{k}</span>
      <span style={{ textAlign: "right", wordBreak: "break-word" }}>{v}</span>
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
  const [aba,         setAba]         = useState(DICON_GRUPOS[0].id);   // grupo mostrado
  const [logado]                      = useState(() => { try { return !!JSON.parse(localStorage.getItem("anticeg_user_v2"))?.cog; } catch { return false; } });
  const [editando,    setEditando]    = useState(false);
  const [prazo,       setPrazo]       = useState(cfg.prazos[0].id);   // opção de prazo/valor
  const [loja,        setLoja]        = useState("");                 // loja do POB
  const [revisando,   setRevisando]   = useState(false);              // tela "ver meu pedido completo"

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

  const grupo = DICON_GRUPOS.find(g => g.id === aba) || DICON_GRUPOS[0];
  const escolhidos = DICON_OPCOES.filter(o => (qtds[o.id] || 0) > 0);
  const qtdTotal = escolhidos.reduce((a, o) => a + qtds[o.id], 0);
  const prazoSel = cfg.prazos.find(p => p.id === prazo) || cfg.prazos[0];
  const lojaSel = cfg.lojas.find(l => l.id === loja) || null;
  const total = qtdTotal * prazoSel.preco;
  const parcelas = prazoSel.parcelas.map(p => ({ ate: p.ate, valor: p.valor * qtdTotal }));
  const ajustar = (id, delta) => setQtds(q => ({ ...q, [id]: Math.min(20, Math.max(0, (q[id] || 0) + delta)) }));
  const ampliar = img => { setLightboxFalhou(false); setLightbox(img); };

  function validar() {
    if (!qtdTotal || !nome.trim() || !email.trim()) return "Preencha nome, e-mail e escolha ao menos 1 capa.";
    if (!lojaSel) return "Escolha a loja do POB.";
    if (pagamento === "pix" && !comprovante) return "Anexe o comprovante do PIX.";
    return "";
  }

  // o botão do formulário não envia: abre "ver meu pedido completo" para a pessoa conferir tudo antes
  function handleSubmit(e) {
    e.preventDefault();
    if (cfg.bloqueado) return;
    const msg = validar();
    if (msg) { setErro(msg); return; }
    setErro(""); setRevisando(true);
  }

  async function enviar() {
    if (cfg.bloqueado || status === "enviando") return;
    const msg = validar();
    if (msg) { setRevisando(false); setErro(msg); return; }
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
      // prazo e loja do POB vão dentro de cada item (a tabela não precisa de colunas novas); preco = valor de cada revista no prazo escolhido
      itens: escolhidos.map(o => ({ id: o.id, produto: o.produto, opcao: o.label, preco: prazoSel.preco, qtd: qtds[o.id], prazo: prazoSel.titulo, loja: lojaSel.nome })),
      qtd_total: qtdTotal, valor_total: total,
      forma_pagamento: pagamento, comprovante_url: comprovanteUrl,
      status: pagamento === "depois" ? "pendente" : pagamento === "pix" ? "aguardando" : "cartao",
    });
    if (error) { setStatus("idle"); setErro("Erro: " + (error.message || JSON.stringify(error))); return; }
    setPedidoId(id.slice(0, 8));
    setRevisando(false);

    if (pagamento === "cartao") window.open("https://linknabio.gg/anticeg-comu", "_blank");
    setStatus("sucesso");
  }

  const inputStyle = { width: "100%", background: "rgba(245,240,232,.06)", border: "1px solid rgba(245,240,232,.12)", borderRadius: 8, padding: "10px 14px", color: "var(--offwhite)", fontFamily: mono, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const labelStyle = { fontFamily: mono, fontSize: 10, letterSpacing: "1.5px", color: "rgba(245,240,232,.4)", textTransform: "uppercase", marginBottom: 6, display: "block" };
  // campo do cadastro: travado fica mais apagado e sem cursor de digitação
  const campo = trava => trava ? { ...inputStyle, background: "rgba(245,240,232,.03)", color: "rgba(245,240,232,.7)", cursor: "default" } : inputStyle;
  // quem está logada tem os dados vindos do cadastro travados; sem nome ou e-mail (cadastro incompleto) os campos ficam livres
  const travado = logado && !editando && !!nome.trim() && !!email.trim();
  const caixa = { background: "rgba(245,240,232,.04)", border: "1px solid rgba(245,240,232,.1)", borderRadius: 10, padding: "14px 16px", fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.6)", lineHeight: 1.7 };
  const agora = pagamento !== "depois";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--offwhite)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px 80px" }}>
      {revisando && status !== "sucesso" && (
        <div role="dialog" aria-modal="true" aria-label="Meu pedido completo" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", zIndex: 998, overflowY: "auto", display: "flex", justifyContent: "center", padding: "24px 14px 40px" }}>
          <div style={{ width: "100%", maxWidth: 520, height: "fit-content", background: "#0d0d0d", border: "1px solid rgba(245,240,232,.15)", borderRadius: 14, padding: "20px 18px" }}>
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "3px", color: "var(--laranja)", marginBottom: 6 }}>CONFIRA ANTES DE ENVIAR</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Meu pedido completo</div>

            <ResumoTitulo>Seus dados</ResumoTitulo>
            {claim && <ResumoLinha k="Claim" v={claim} />}
            <ResumoLinha k="Nome" v={nome} />
            <ResumoLinha k="E-mail" v={email} />
            <ResumoLinha k="@ Rede social" v={social.trim() || "—"} />

            <ResumoTitulo>Capas ({qtdTotal})</ResumoTitulo>
            {escolhidos.map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <img src={o.foto} alt="" style={{ width: 36, height: 54, objectFit: "cover", borderRadius: 4, background: "rgba(245,240,232,.06)", flexShrink: 0 }} onError={e => { e.target.style.visibility = "hidden"; }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{o.label}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.45)" }}>{o.produto}</div>
                </div>
                <div style={{ fontFamily: mono, fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>
                  {qtds[o.id]} × {fmtReais(prazoSel.preco)}
                  <div style={{ fontSize: 11, color: "rgba(245,240,232,.5)" }}>{fmtReais(qtds[o.id] * prazoSel.preco)}</div>
                </div>
              </div>
            ))}

            <ResumoTitulo>Prazo</ResumoTitulo>
            <ResumoLinha k="Opção" v={`${prazoSel.titulo} — ${fmtReais(prazoSel.preco)} por revista`} />
            {parcelas.map((p, i) => <ResumoLinha key={i} k={parcelas.length > 1 ? `Parcela ${i + 1}` : "Pagamento"} v={`${fmtReais(p.valor)} até ${p.ate}`} />)}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, fontFamily: mono, fontWeight: 700, color: "var(--laranja)" }}>
              <span style={{ fontSize: 12 }}>TOTAL ({qtdTotal} unidade{qtdTotal !== 1 ? "s" : ""})</span>
              <span style={{ fontSize: 16 }}>{fmtReais(total)}</span>
            </div>

            <ResumoTitulo>Loja do POB</ResumoTitulo>
            <ResumoLinha k="Loja" v={lojaSel.nome} />

            <ResumoTitulo>Pagamento</ResumoTitulo>
            <ResumoLinha k="Forma" v={pagamento === "pix" ? "Pagar agora · PIX" : pagamento === "cartao" ? "Pagar agora · Cartão" : "Pagar depois"} />
            {agora && <ResumoLinha k="Valor agora" v={fmtReais(parcelas[0].valor)} />}
            {pagamento === "pix" && <ResumoLinha k="Comprovante" v={comprovante ? comprovante.name : "—"} />}

            <div style={{ ...caixa, marginTop: 16 }}>Ao confirmar, o pedido <strong style={{ color: "var(--offwhite)" }}>não poderá ser cancelado</strong>. Se algo estiver errado, volte e corrija.</div>
            {erro && <div style={{ color: "#ff6b6b", fontFamily: mono, fontSize: 11, marginTop: 12 }}>{erro}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="button" disabled={status === "enviando"} onClick={() => setRevisando(false)}
                style={{ flex: 1, padding: "13px 0", borderRadius: 10, border: "1px solid rgba(245,240,232,.25)", background: "transparent", color: "var(--offwhite)", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>
                ← VOLTAR E EDITAR
              </button>
              <button type="button" disabled={status === "enviando"} onClick={enviar}
                style={{ flex: 1.4, padding: "13px 0", borderRadius: 10, border: "none", background: "var(--laranja)", color: "#fff", fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: "1px", cursor: status === "enviando" ? "wait" : "pointer" }}>
                {status === "enviando" ? "ENVIANDO..." : "CONFIRMAR E ENVIAR"}
              </button>
            </div>
          </div>
        </div>
      )}
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
          {cfg.avisos.map((bloco, b) => (
            <div key={b} style={b > 0 ? { marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,92,26,.2)" } : undefined}>
              {bloco.map((a, i) => <div key={i}>☆ {a.split("**").map((t, k) => k % 2 ? <strong key={k}>{t}</strong> : t)}</div>)}
            </div>
          ))}
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
                <input style={campo(travado && !!social.trim())} readOnly={travado && !!social.trim()} value={social} onChange={e => setSocial(e.target.value)} placeholder="@seu_usuario" />
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={labelStyle}>Escolha as capas{cfg.valorADefinir ? "" : ` — ${cfg.prazos.map(p => `${fmtReais(p.preco)} ${p.titulo.toLowerCase()}`).join(" ou ")}`}</div>
              {/* abas dos grupos: a quantidade escolhida em cada um aparece na aba, mesmo com outra aberta */}
              <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
                {DICON_GRUPOS.map(g => {
                  const ativa = g.id === grupo.id;
                  const qGrupo = g.membros.reduce((a, m) => a + (qtds[m.id] || 0), 0);
                  return (
                    <button key={g.id} type="button" role="tab" aria-selected={ativa} onClick={() => setAba(g.id)}
                      style={{ flex: "1 0 auto", padding: "10px 12px", borderRadius: 8, border: `1px solid ${ativa ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, background: ativa ? "rgba(255,92,26,.12)" : "transparent", color: ativa ? "var(--laranja)" : "rgba(245,240,232,.6)", fontFamily: mono, fontSize: 11, fontWeight: ativa ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {g.nome}
                      {qGrupo > 0 && <span style={{ fontSize: 9, background: "var(--laranja)", color: "#fff", borderRadius: 10, padding: "1px 6px", fontWeight: 700 }}>{qGrupo}</span>}
                    </button>
                  );
                })}
              </div>

              <div style={{ background: "rgba(245,240,232,.03)", border: "1px solid rgba(245,240,232,.08)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: ".5px" }}>{grupo.nome}</div>
                </div>
                {/* prévia do que vem incluso: o topo da imagem completa, com "Ver mais" para abrir inteira */}
                <button type="button" aria-label={`Ver mais: ${grupo.nome} — o que vem incluso`} onClick={() => ampliar({ src: grupo.completa, legenda: `${grupo.nome} — visualização completa` })}
                  style={{ position: "relative", display: "block", width: "100%", height: 240, padding: 0, border: "none", borderTop: "1px solid rgba(245,240,232,.06)", background: "rgba(245,240,232,.05)", cursor: "zoom-in", overflow: "hidden" }}>
                  <img key={grupo.id} src={grupo.completaMiniatura} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
                    onError={e => { e.target.style.display = "none"; }} />
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "40px 12px 12px", background: "linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,0))", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "1.5px", color: "rgba(245,240,232,.75)", textAlign: "left" }}>O QUE VEM INCLUSO</span>
                    <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--laranja)", borderRadius: 20, padding: "6px 14px", whiteSpace: "nowrap" }}>Ver mais +</span>
                  </div>
                </button>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {grupo.membros.map(m => {
                    const q = qtds[m.id] || 0;
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: "1px solid rgba(245,240,232,.06)", background: q > 0 ? "rgba(255,92,26,.06)" : "transparent", transition: "background .15s" }}>
                        <Capa m={m} onAmpliar={ampliar} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                          <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.45)", marginTop: 2 }}>{cfg.valorADefinir ? "valor a definir" : `${fmtReais(prazoSel.preco)} · ${prazoSel.titulo.toLowerCase()}`}</div>
                        </div>
                        <Qty valor={q} onMenos={() => ajustar(m.id, -1)} onMais={() => ajustar(m.id, 1)} />
                      </div>
                    );
                  })}
                </div>
              </div>
              {total > 0 && !cfg.valorADefinir && (
                <div style={{ marginTop: 14, fontFamily: mono, fontSize: 13, fontWeight: 700, color: "var(--laranja)", textAlign: "right" }}>
                  Total: {fmtReais(total)} ({qtdTotal} unidade{qtdTotal !== 1 ? "s" : ""})
                </div>
              )}
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={labelStyle}>Prazo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cfg.prazos.map(p => {
                  const ativo = p.id === prazoSel.id;
                  return (
                    <button key={p.id} type="button" aria-pressed={ativo} onClick={() => setPrazo(p.id)}
                      style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: `1px solid ${ativo ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, background: ativo ? "rgba(255,92,26,.12)" : "transparent", color: "var(--offwhite)", fontFamily: mono, cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: ativo ? "var(--laranja)" : "var(--offwhite)" }}>{p.titulo}</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtReais(p.preco)}<span style={{ fontSize: 10, fontWeight: 400, color: "rgba(245,240,232,.5)" }}> /revista</span></span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: "rgba(245,240,232,.6)", lineHeight: 1.6 }}>
                        {p.parcelas.map((x, i) => <div key={i}>{fmtReais(x.valor)} até {x.ate}</div>)}
                      </div>
                      {qtdTotal > 0 && <div style={{ marginTop: 6, fontSize: 11, color: ativo ? "var(--laranja)" : "rgba(245,240,232,.45)" }}>Seu pedido ({qtdTotal}): {fmtReais(qtdTotal * p.preco)}</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={labelStyle}>Loja do POB</div>
              <div style={{ ...caixa, marginBottom: 10 }}>Todas as revistas acompanham <strong style={{ color: "var(--offwhite)" }}>POB</strong>. Escolha a sua loja:</div>
              <div style={{ display: "flex", gap: 8 }}>
                {cfg.lojas.map(l => {
                  const ativo = l.id === loja;
                  return (
                    <button key={l.id} type="button" aria-pressed={ativo} onClick={() => setLoja(l.id)}
                      style={{ flex: 1, padding: "12px 4px", borderRadius: 8, border: `1px solid ${ativo ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, background: ativo ? "rgba(255,92,26,.12)" : "transparent", color: ativo ? "var(--laranja)" : "rgba(245,240,232,.6)", fontFamily: mono, fontSize: 11, fontWeight: ativo ? 700 : 400, cursor: "pointer" }}>
                      {l.nome}
                    </button>
                  );
                })}
              </div>
              {lojaSel ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "1.5px", color: "rgba(245,240,232,.45)", marginBottom: 8 }}>POB {lojaSel.nome.toUpperCase()} · TOQUE PARA AMPLIAR</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {DICON_GRUPOS.map(g => (
                      <button key={g.id} type="button" aria-label={`POB ${lojaSel.nome} — ${g.nome}`} onClick={() => ampliar({ src: g.pobs[lojaSel.id].grande, legenda: `POB ${lojaSel.nome} — ${g.nome}` })}
                        style={{ padding: 0, border: "1px solid rgba(245,240,232,.12)", borderRadius: 8, background: "rgba(245,240,232,.05)", overflow: "hidden", cursor: "zoom-in", textAlign: "left" }}>
                        <img src={g.pobs[lojaSel.id].miniatura} alt="" loading="lazy" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }} onError={e => { e.target.style.visibility = "hidden"; }} />
                        <div style={{ padding: "6px 8px", fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.7)" }}>{g.nome}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : <div style={{ marginTop: 8, fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.4)" }}>Toque numa loja para ver o POB de cada grupo.</div>}
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
                  Seu pedido será registrado sem pagamento agora. Prazo: {parcelas.map((p, i) => <span key={i}>{i > 0 && " + "}<strong style={{ color: "var(--offwhite)" }}>{fmtReais(p.valor)} até {p.ate}</strong></span>)}.
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
                  {qtdTotal > 0 && <div style={{ ...caixa, marginBottom: 12 }}>Valor a pagar agora: <strong style={{ color: "var(--offwhite)" }}>{fmtReais(parcelas[0].valor)}</strong>{parcelas.length > 1 && <> (1ª parcela; a próxima, {fmtReais(parcelas[1].valor)}, vence em {parcelas[1].ate})</>}</div>}
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
              {cfg.bloqueado ? "EM BREVE" : status === "enviando" ? "ENVIANDO..." : "VER MEU PEDIDO COMPLETO →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
