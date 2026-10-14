import { useEffect, useState } from "react";
import supabase from "./supabase.js";
import { criarPedidoLoja } from "./joinerAuth.js";
import { SMOLMERCH_PRODUTOS, SMOLMERCH_OPCOES, SMOLMERCH_CFG, fmtReais, foto } from "./smolmerchDados.js";

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

// ── Formulário público ───────────────────────────────────────────────────────
export function SmolMerchFormPage({ pixKey, cfg = SMOLMERCH_CFG }) {
  const encerrado = !!cfg.deadline && new Date() > cfg.deadline;
  const [claim,       setClaim]       = useState(() => { try { return JSON.parse(localStorage.getItem("anticeg_user_v2"))?.cog || ""; } catch { return ""; } });
  const [nome,        setNome]        = useState("");
  const [email,       setEmail]       = useState("");
  const [social,      setSocial]      = useState("");
  const [qtds,        setQtds]        = useState({});
  const [pagamento,   setPagamento]   = useState(cfg.pagamentoAgora === false ? "depois" : "pix");
  const [comprovante, setComprovante] = useState(null);
  const [pixCopiado,  setPixCopiado]  = useState(false);
  const [status,      setStatus]      = useState("idle");
  const [erro,        setErro]        = useState("");
  const [pedidoId,    setPedidoId]    = useState(null);
  const [lightbox,    setLightbox]    = useState(null);

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

  const escolhidos = SMOLMERCH_OPCOES.filter(o => (qtds[o.id] || 0) > 0);
  const qtdTotal = escolhidos.reduce((a, o) => a + qtds[o.id], 0);
  const total = escolhidos.reduce((a, o) => a + qtds[o.id] * o.preco, 0);
  const ajustar = (id, delta) => setQtds(q => ({ ...q, [id]: Math.min(20, Math.max(0, (q[id] || 0) + delta)) }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (cfg.bloqueado) return;
    if (!qtdTotal || !nome.trim() || !email.trim()) { setErro("Preencha nome, e-mail e escolha ao menos 1 item."); return; }
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
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <img src={lightbox} alt="produto" style={{ maxWidth: "92vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }} />
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

        <div style={{ background: "rgba(255,92,26,.07)", border: "1px solid rgba(255,92,26,.2)", borderRadius: 10, padding: "14px 16px", marginBottom: 28, fontSize: 12, lineHeight: 1.7, color: "rgba(245,240,232,.7)" }}>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "2px", color: "var(--laranja)", marginBottom: 8 }}>⚠ AVISOS IMPORTANTES</div>
          {cfg.avisos.map((a, i) => <div key={i}>☆ {a.split("**").map((t, k) => k % 2 ? <strong key={k}>{t}</strong> : t)}</div>)}
        </div>

        {encerrado ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontFamily: mono, fontSize: 13, color: "rgba(245,240,232,.5)" }}>Pedidos encerrados em {cfg.pedidosAte}.</div>
          </div>
        ) : status === "sucesso" ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Pedido registrado!</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.5)", lineHeight: 1.6, marginBottom: 24 }}>
              {pagamento === "pix" ? "Comprovante enviado. Aguardando confirmação."
                : pagamento === "depois" ? "Pedido registrado! Avisaremos como pagar."
                : "Abrimos o link de pagamento no cartão. Se não abriu, acesse linknabio.gg/anticeg-comu."}
              {pedidoId && <div style={{ marginTop: 8, fontSize: 10, opacity: .5 }}>#{pedidoId}</div>}
            </div>
            <a href="https://chat.whatsapp.com/FqcEhq1039j3ZH0YntnCHD" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", padding: "12px 24px", borderRadius: 10, background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.35)", color: "#25d366", fontFamily: mono, fontSize: 12, fontWeight: 700, textDecoration: "none", letterSpacing: "0.5px" }}>
              Entrar no grupo de atualizações
            </a>
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
              <div style={labelStyle}>Escolha os itens</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {SMOLMERCH_PRODUTOS.map(p => (
                  <div key={p.id} style={{ background: "rgba(245,240,232,.03)", border: "1px solid rgba(245,240,232,.08)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: 12, padding: "12px 12px 8px", alignItems: "center" }}>
                      <img src={foto(p.foto)} alt={p.nome} loading="lazy" onClick={() => setLightbox(foto(p.foto, 2000))}
                        style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, cursor: "zoom-in", flexShrink: 0, background: "rgba(245,240,232,.06)" }}
                        onError={e => { e.target.style.visibility = "hidden"; }} />
                      <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{p.nome}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {p.opcoes.map(o => {
                        const q = qtds[o.id] || 0;
                        return (
                          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: "1px solid rgba(245,240,232,.06)", background: q > 0 ? "rgba(255,92,26,.06)" : "transparent", transition: "background .15s" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{o.label}</div>
                              <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.45)", marginTop: 2 }}>{fmtReais(o.preco)}</div>
                            </div>
                            <Qty valor={q} onMenos={() => ajustar(o.id, -1)} onMais={() => ajustar(o.id, 1)} />
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

            {cfg.pagamentoAgora === false ? null : (
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
            )}

            {erro && <div style={{ color: "#ff6b6b", fontFamily: mono, fontSize: 11, marginBottom: 16 }}>{erro}</div>}
            <button type="submit" disabled={status === "enviando" || !qtdTotal || cfg.bloqueado}
              style={{ width: "100%", padding: "14px 0", borderRadius: 10, background: qtdTotal && !cfg.bloqueado ? "var(--laranja)" : "rgba(245,240,232,.1)", color: qtdTotal && !cfg.bloqueado ? "#fff" : "rgba(245,240,232,.3)", fontFamily: mono, fontSize: 13, fontWeight: 700, border: "none", cursor: qtdTotal && !cfg.bloqueado ? "pointer" : "not-allowed", letterSpacing: "1px" }}>
              {cfg.bloqueado ? "AINDA NÃO DISPONÍVEL" : status === "enviando" ? "ENVIANDO..." : "CONFIRMAR PEDIDO →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Painel admin ─────────────────────────────────────────────────────────────
export function AdminSmolMerch({ onCountChange, cfg = SMOLMERCH_CFG }) {
  const [pedidos, setPedidos] = useState([]);
  const [filtro,  setFiltro]  = useState("abertos");
  const [erro,    setErro]    = useState("");

  useEffect(() => {
    supabase.from(cfg.tabela).select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) setErro(error.message); else if (data) setPedidos(data); });
  }, [cfg.tabela]);

  const emAberto = p => p.status !== "confirmado" && p.status !== "cancelado";
  async function atualizar(id, novoStatus) {
    const { error } = await supabase.from(cfg.tabela).update({ status: novoStatus }).eq("id", id);
    if (error) { setErro("Não foi possível atualizar: " + error.message); return; }
    setPedidos(prev => {
      const next = prev.map(p => p.id === id ? { ...p, status: novoStatus } : p);
      onCountChange?.(next.filter(emAberto).length);
      return next;
    });
  }

  const cor = s => s === "confirmado" ? "#4ade80" : s === "cancelado" ? "#ff6b6b" : s === "cartao" ? "rgba(255,200,0,.8)" : s === "pendente" ? "rgba(180,140,255,.8)" : "rgba(255,92,26,.8)";
  const rotulo = s => ({ confirmado: "confirmado", cancelado: "cancelado", cartao: "cartão — confirmar no linknabio", pendente: "pagamento pendente", aguardando: "aguardando confirmação do PIX" }[s] || s);

  // resumo por item (para fazer a compra): tudo que não foi cancelado, e quanto já está confirmado
  const porId = new Map(SMOLMERCH_OPCOES.map(o => [o.id, { ...o, pedido: 0, confirmado: 0 }]));
  pedidos.forEach(p => {
    if (p.status === "cancelado") return;
    (p.itens || []).forEach(i => {
      // opção que saiu do catálogo depois do pedido: usa o nome gravado no próprio pedido
      if (!porId.has(i.id)) porId.set(i.id, { id: i.id, produto: i.produto || "(item antigo)", label: i.opcao || i.id, preco: i.preco, pedido: 0, confirmado: 0 });
      const r = porId.get(i.id);
      r.pedido += Number(i.qtd) || 0;
      if (p.status === "confirmado") r.confirmado += Number(i.qtd) || 0;
    });
  });
  const resumo = [...porId.values()].filter(r => r.pedido > 0);

  const lista = pedidos.filter(p => filtro === "todos" ? true : filtro === "abertos" ? emAberto(p) : p.status === filtro);
  const tab = (id, texto) => (
    <button key={id} onClick={() => setFiltro(id)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${filtro === id ? "var(--laranja)" : "rgba(245,240,232,.12)"}`, background: filtro === id ? "rgba(255,92,26,.1)" : "transparent", color: filtro === id ? "var(--laranja)" : "rgba(245,240,232,.5)", fontFamily: mono, fontSize: 10, cursor: "pointer" }}>{texto}</button>
  );

  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "2px", color: "rgba(245,240,232,.35)", marginBottom: 16 }}>{cfg.titulo} — {cfg.sub}</div>
      {erro && <div style={{ fontFamily: mono, fontSize: 11, color: "#ff6b6b", marginBottom: 12 }}>{erro}</div>}

      {resumo.length > 0 && (
        <div style={{ background: "rgba(245,240,232,.04)", border: "1px solid rgba(245,240,232,.1)", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "1.5px", color: "rgba(245,240,232,.4)", marginBottom: 8 }}>RESUMO POR ITEM (pedido · já confirmado)</div>
          {resumo.map(r => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: mono, fontSize: 11, padding: "3px 0", color: "rgba(245,240,232,.7)" }}>
              <span>{r.produto} — {r.label}</span>
              <span style={{ color: "var(--offwhite)", fontWeight: 700 }}>{r.pedido} · {r.confirmado}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {tab("abertos", "em aberto")}{tab("confirmado", "confirmados")}{tab("cancelado", "cancelados")}{tab("todos", "todos")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.length === 0 && <div style={{ fontFamily: mono, fontSize: 12, opacity: .4, padding: "20px 0" }}>Nenhum pedido aqui.</div>}
        {lista.map(p => (
          <div key={p.id} style={{ background: "rgba(245,240,232,.04)", border: `1px solid ${p.status === "confirmado" ? "rgba(74,222,128,.15)" : emAberto(p) ? "rgba(255,92,26,.2)" : "rgba(245,240,232,.08)"}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.nome}</span>
                  {p.social && <span style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.4)" }}>{p.social}</span>}
                  <span style={{ fontFamily: mono, fontSize: 9, color: "rgba(245,240,232,.2)" }}>#{String(p.id).slice(0, 8)}</span>
                </div>
                <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.45)" }}>{p.email}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
                  {(p.itens || []).map((i, k) => (
                    <span key={k} style={{ fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.6)" }}>{i.qtd}x {i.produto} — {i.opcao}</span>
                  ))}
                </div>
                <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "var(--laranja)", marginTop: 4 }}>
                  {p.qtd_total} un · {fmtReais(p.valor_total)}
                </div>
                {p.comprovante_url && <a href={p.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,92,26,.7)", marginTop: 2 }}>ver comprovante ↗</a>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: cor(p.status) }}>{rotulo(p.status)}</span>
                {emAberto(p) && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => atualizar(p.id, "confirmado")} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(74,222,128,.4)", background: "transparent", color: "#4ade80", fontFamily: mono, fontSize: 10, cursor: "pointer" }}>Confirmar</button>
                    <button onClick={() => atualizar(p.id, "cancelado")} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,107,107,.4)", background: "transparent", color: "#ff6b6b", fontFamily: mono, fontSize: 10, cursor: "pointer" }}>Cancelar</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
