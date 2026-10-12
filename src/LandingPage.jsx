import { useEffect, useRef, useState } from "react";
import "./LandingPage.css";
import supabase from "./supabase.js";
import bonequinha from "./assets/bonequinha.png";
import foxinyBronze from "./assets/badges/foxiny_bronze.jpg.png";
import foxinyPrata  from "./assets/badges/foxiny_prata.jpg.png";
import foxinyOuro   from "./assets/badges/foxiny_ouro.jpg.png";
import { resolverRecrutador, buscarRecrutador, buscarLinkComunidade, LINK_COMUNIDADE_PADRAO } from "./recrutador.js";


const WA = "5524992782023";

const NIVEIS_RECRUTADOR = [
  { id:"bronze", img:foxinyBronze, cor:"#CD7F32", titulo:"MAKNAE ON TOP", regra:"Entrou na comunidade" },
  { id:"prata",  img:foxinyPrata,  cor:"#C0C0C0", titulo:"RECRUTADOR",    regra:"Recrutou de 1 a 5 membros" },
  { id:"ouro",   img:foxinyOuro,   cor:"#D4AF37", titulo:"EMBAIXADOR",    regra:"Recrutou 6 ou mais membros" },
];

export default function LandingPage({ onLogin, onVerCegs }) {
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const [mobileNav, setMobileNav] = useState(false);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingJoiner, setPendingJoiner] = useState(null);
  const [senha, setSenha] = useState("");

  // primeiro acesso unificado (encontrar conta existente OU cadastrar)
  const [primeiroAcesso, setPrimeiroAcesso]   = useState(() => ["/primeiro-acesso", "/recrutador"].includes(window.location.pathname));
  const [cadNome,        setCadNome]           = useState("");
  const [cadCog,         setCadCog]            = useState("");
  const [cadEmail,       setCadEmail]          = useState("");
  const [cadWhats,       setCadWhats]          = useState("");
  const [cadRecrutador,  setCadRecrutador]     = useState("");
  const [linkComunidade, setLinkComunidade]    = useState(LINK_COMUNIDADE_PADRAO);
  const [recStatus,      setRecStatus]          = useState(null); // null | "buscando" | { ok, cog, nome }
  const [cadError,       setCadError]          = useState("");
  const [cadLoading,     setCadLoading]        = useState(false);
  const [cadOk,          setCadOk]             = useState(false);

  useEffect(() => { buscarLinkComunidade().then(setLinkComunidade); }, []);

  // confirma o recrutador enquanto a pessoa digita o @
  useEffect(() => {
    if (!cadRecrutador.trim()) { setRecStatus(null); return; }
    setRecStatus("buscando");
    let cancelado = false;
    const t = setTimeout(async () => {
      const r = await buscarRecrutador(cadRecrutador);
      if (!cancelado) setRecStatus(r ? { ok: true, ...r } : { ok: false });
    }, 500);
    return () => { cancelado = true; clearTimeout(t); };
  }, [cadRecrutador]);

  // quem já tem conta (logada neste aparelho) vê os dados do primeiro acesso preenchidos
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("anticeg_user_v2"));
      if (!u?.cog) return;
      setCadNome(u.nome || u.nome_site || "");
      setCadCog((u.twitter || u.cog || "").replace(/^@/, ""));
      setCadEmail(u.email || "");
      setCadWhats(u.whatsapp || "");
      if (u.recrutador) setCadRecrutador("@" + u.recrutador);
    } catch { /* sem dados salvos */ }
  }, []);

  useEffect(() => {
    const cursor = cursorRef.current;
    const ring = ringRef.current;
    const move = e => {
      cursor.style.left = e.clientX + "px";
      cursor.style.top = e.clientY + "px";
      ring.style.left = e.clientX + "px";
      ring.style.top = e.clientY + "px";
    };
    document.addEventListener("mousemove", move);
    const interactives = document.querySelectorAll(".lp a, .lp button, .lp input");
    interactives.forEach(el => {
      el.addEventListener("mouseenter", () => { cursor.style.width="6px"; cursor.style.height="6px"; ring.style.width="52px"; ring.style.height="52px"; });
      el.addEventListener("mouseleave", () => { cursor.style.width="12px"; cursor.style.height="12px"; ring.style.width="36px"; ring.style.height="36px"; });
    });
    return () => document.removeEventListener("mousemove", move);
  }, []);

  function isEmail(str) {
    const idx = str.indexOf("@");
    return idx > 0;
  }

  async function buscarJoiner(input) {
    const handle = input.startsWith("@") ? input.slice(1) : input;
    // email: busca direto por email, sem passar pelo cog
    if (isEmail(input)) {
      const { data: byEmail } = await supabase.from("joiners").select("*")
        .eq("email", input.toLowerCase())
        .maybeSingle();
      return byEmail || null;
    }
    // busca por cog exato (eq evita wildcards SQL do ilike)
    const { data: byCog } = await supabase.from("joiners").select("*")
      .eq("cog", handle)
      .maybeSingle();
    if (byCog) return byCog;
    // fallback: twitter handle
    const { data: byTw } = await supabase.from("joiners").select("*")
      .or(`twitter.ilike.@${handle},twitter.ilike.${handle}`)
      .maybeSingle();
    return byTw || null;
  }

  async function handleEntrar() {
    setLoading(true); setError("");
    const input = email.trim();
    if (!input) { setError("Informe seu @ ou e-mail."); setLoading(false); return; }

    const handle = input.startsWith("@") ? input.slice(1) : input;
    if (handle.toUpperCase() === "ADMMODE") {
      setPendingJoiner({ cog: "ADMMODE", nome: "Modo Demo", email: "demo@anticeg.com.br", confirmado: true, _senha_demo: "anticeg@demo" });
      setLoading(false);
      return;
    }

    try {
      const joiner = await buscarJoiner(input);
      if (!joiner) { setError("Acesso não encontrado. Solicite pelo WhatsApp."); setLoading(false); return; }

      const isOwner = joiner.cog === "nandaverseo_c" || joiner.email === "nandag_medeiros@hotmail.com";
      if (isOwner && joiner.senha) {
        setPendingJoiner(joiner);
        setLoading(false);
        return;
      }

      await entrarCom(joiner);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  async function handleSenha() {
    setLoading(true); setError("");
    const senhaCorreta = pendingJoiner._senha_demo || pendingJoiner.senha;
    if (senha.trim() !== senhaCorreta) {
      setError("Senha incorreta."); setLoading(false); return;
    }
    try {
      await entrarCom(pendingJoiner);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  // nas páginas /primeiro-acesso e /recrutador, volta pra raiz antes de entrar (senão a página continuaria aberta)
  function sairDaPaginaPublica() {
    if (["/primeiro-acesso", "/recrutador"].includes(window.location.pathname)) window.history.replaceState(null, "", "/");
  }

  async function entrarCom(joiner) {
    const cogReal = joiner.cog === "ADMMODE" ? "nandaverseo_c" : joiner.cog;
    const { data: itens } = await supabase.from("masterlist").select("*").eq("cog", cogReal);
    sairDaPaginaPublica();
    onLogin(joiner, itens || []);
  }

  async function handlePrimeiroAcesso() {
    setCadLoading(true); setCadError("");
    const nome  = cadNome.trim();
    const cog   = cadCog.trim().replace(/^@/, "");
    const eml   = cadEmail.trim().toLowerCase();
    const whats = cadWhats.trim();

    if (!cog && !eml) { setCadError("Preencha pelo menos o @ ou o e-mail."); setCadLoading(false); return; }

    // tenta encontrar conta existente
    let joiner = null;
    if (eml) {
      const { data } = await supabase.from("joiners").select("*").eq("email", eml).maybeSingle();
      if (data) joiner = data;
    }
    if (!joiner && cog) {
      const { data } = await supabase.from("joiners").select("*")
        .or(`twitter.ilike.@${cog},twitter.ilike.${cog}`)
        .maybeSingle();
      if (data) joiner = data;
    }

    if (joiner) {
      // conta existe → loga direto
      try {
        await entrarCom(joiner);
      } catch {
        setCadError("Erro de conexão. Tente novamente.");
      }
      setCadLoading(false);
      return;
    }

    // não tem conta → cadastro automático
    if (!nome || !cog || !eml) {
      setCadError("Conta não encontrada. Preencha nome, @ e e-mail para solicitar cadastro.");
      setCadLoading(false); return;
    }

    // recrutador (opcional): precisa existir
    let recrutador = null;
    if (cadRecrutador.trim()) {
      recrutador = await resolverRecrutador(cadRecrutador);
      if (!recrutador) { setCadError("Recrutador não encontrado. Confira o @ ou deixe em branco."); setCadLoading(false); return; }
      if (recrutador === cog) { setCadError("Você não pode ser seu próprio recrutador."); setCadLoading(false); return; }
    }

    // verifica duplicata na tabela de joiners
    const { data: dupJoiner } = await supabase.from("joiners").select("id")
      .or(`cog.eq.${cog},email.eq.${eml}`).maybeSingle();
    if (dupJoiner) { setCadError("Já existe uma conta com esses dados. Entre em contato com a admin."); setCadLoading(false); return; }

    // cria conta diretamente
    const { error: joinErr } = await supabase.from("joiners").insert([{
      cog, nome, email: eml, twitter: "@" + cog, whatsapp: whats || null, confirmado: false,
      ...(recrutador ? { recrutador } : {}),
    }]);
    if (joinErr) { setCadError("Erro ao criar conta. Tente novamente."); setCadLoading(false); return; }

    // log para admin (não bloqueia)
    supabase.from("pre_cadastros").insert([{ nome, cog, email: eml, whatsapp: whats || null, status: "aprovado" }]).then(() => {});

    // adiciona na planilha (async)
    fetch("https://script.google.com/macros/s/AKfycbyqioOQMPByiLOI0TgAUBkqVLI5U1U8kwGJAV4MO-fVBp4OmXyBxUk9BtUraoEHAVZReA/exec", {
      method: "POST", redirect: "follow",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ acao: "novo_joiner", token: "anticeg-pag-2026", nome, twitter: "@" + cog, email: eml }),
    }).catch(() => {});

    // notifica admin por e-mail
    supabase.functions.invoke("send-email", {
      body: {
        to_email: "nandadomarketing@gmail.com",
        to_name: "Nanda",
        assunto: "✦ Novo joiner adicionado — ANTICEG",
        corpo: `<p style="font-family:monospace;font-size:13px;color:#F5F0E8;line-height:1.7">Novo joiner adicionado automaticamente:</p><ul style="font-family:monospace;font-size:12px;color:rgba(245,240,232,.7);line-height:2"><li><b>Nome:</b> ${nome}</li><li><b>@:</b> ${cog}</li><li><b>E-mail:</b> ${eml}</li>${whats ? `<li><b>WhatsApp:</b> ${whats}</li>` : ""}</ul>`,
      },
    }).catch(() => {});

    // loga direto com a conta recém-criada
    const { data: novoJoiner } = await supabase.from("joiners").select("*").eq("cog", cog).maybeSingle();
    setCadLoading(false);
    if (novoJoiner) {
      await entrarCom(novoJoiner);
    } else {
      sairDaPaginaPublica();
      onLogin({ nome, cog, email: eml, whatsapp: whats || null }, []);
    }
  }

  // página /primeiro-acesso: só o formulário de primeiro acesso, sem o resto da landing
  // /recrutador é a página de convite: igual ao primeiro acesso, com o botão do grupo da comunidade
  const modoConvite = window.location.pathname === "/recrutador";
  const soPrimeiroAcesso = modoConvite || window.location.pathname === "/primeiro-acesso";

  function resetPrimeiroAcesso() {
    if (soPrimeiroAcesso) { window.location.href = "/"; return; }
    setPrimeiroAcesso(false);
    setCadNome(""); setCadCog(""); setCadEmail(""); setCadWhats(""); setCadRecrutador("");
    setCadError(""); setCadOk(false);
  }

  const voltarStyle = {
    background:"none", border:"none", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace",
    fontSize:11, cursor:"pointer", marginTop:4, textAlign:"center", width:"100%"
  };

  function renderCard() {
    if (pendingJoiner) return (
      <>
        <div className="lp-card-label">// senha de acesso</div>
        <div style={{ fontSize:12, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginBottom:8 }}>
          Olá, {pendingJoiner.nome || pendingJoiner.cog}. Digite sua senha para continuar.
        </div>
        <input
          className="lp-card-input"
          type="password"
          placeholder="senha"
          value={senha}
          onChange={e => { setSenha(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleSenha()}
          autoFocus
        />
        {error && <div className="lp-card-error">{error}</div>}
        <button className="lp-card-btn" onClick={handleSenha} disabled={loading}>{loading ? "..." : "CONFIRMAR →"}</button>
        <button onClick={() => { setPendingJoiner(null); setSenha(""); setError(""); }} style={voltarStyle}>← voltar</button>
      </>
    );

    if (primeiroAcesso) return (
      <>
        <div className="lp-card-label">// primeiro acesso</div>
        {cadOk ? (
          <>
            <div style={{ fontSize:12, color:"#BAFF39", fontFamily:"'DM Mono',monospace", lineHeight:1.7, marginBottom:16 }}>
              Cadastro enviado! Aguarde a aprovação da admin. Você receberá acesso em breve.
            </div>
            <button className="lp-card-btn" onClick={resetPrimeiroAcesso}>← voltar</button>
          </>
        ) : (
          <>
            {modoConvite && <a href={linkComunidade} target="_blank" rel="noopener noreferrer"
              style={{ display:"block", textAlign:"center", textDecoration:"none", marginBottom:14, padding:"11px 12px", borderRadius:6, background:"rgba(37,211,102,.12)", border:"1px solid rgba(37,211,102,.35)", color:"#25d366", fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:".5px" }}>
              1 · Entrar na comunidade (WhatsApp) →
            </a>}
            <div style={{ fontSize:11, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginBottom:14, lineHeight:1.6 }}>
              {modoConvite && "2 · "}Preencha seus dados. Se você já tiver conta, entrará direto — senão, seu cadastro será enviado para aprovação.
            </div>
            <input className="lp-card-input" type="text" placeholder="nome para a claim" value={cadNome}
              onChange={e => { setCadNome(e.target.value); setCadError(""); }} autoFocus />
            <input className="lp-card-input" type="text" placeholder="@ da rede social (sem @)" value={cadCog}
              onChange={e => { setCadCog(e.target.value); setCadError(""); }} />
            <input className="lp-card-input" type="email" placeholder="e-mail" value={cadEmail}
              onChange={e => { setCadEmail(e.target.value); setCadError(""); }} />
            <input className="lp-card-input" type="text" placeholder="whatsapp (pra te localizar nas claims)" value={cadWhats}
              onChange={e => { setCadWhats(e.target.value); setCadError(""); }} />
            <input className="lp-card-input" type="text" placeholder={modoConvite ? "@ de quem te indicou" : "@ de quem te indicou (opcional)"} value={cadRecrutador}
              onChange={e => { setCadRecrutador(e.target.value); setCadError(""); }}
              onKeyDown={e => e.key === "Enter" && handlePrimeiroAcesso()} />
            {recStatus && (
              <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:-4, marginBottom:10, lineHeight:1.5,
                color: recStatus === "buscando" ? "rgba(245,240,232,.4)" : recStatus.ok ? "#BAFF39" : "#ff6b6b" }}>
                {recStatus === "buscando" ? "buscando..."
                  : recStatus.ok ? `✓ Recrutador confirmado: @${recStatus.cog}${recStatus.nome && recStatus.nome !== recStatus.cog ? ` · ${recStatus.nome}` : ""}`
                  : "✕ Recrutador não encontrado. Confira o @."}
              </div>
            )}
            {cadError && <div className="lp-card-error">{cadError}</div>}
            <button className="lp-card-btn" onClick={handlePrimeiroAcesso} disabled={cadLoading}>
              {cadLoading ? "..." : "CONTINUAR →"}
            </button>
            <button onClick={resetPrimeiroAcesso} style={voltarStyle}>← voltar</button>
          </>
        )}
      </>
    );

    return (
      <>
        <div className="lp-card-label">// acesso rápido</div>
        <input
          className="lp-card-input"
          type="text"
          placeholder="@ da rede social ou e-mail"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleEntrar()}
          autoFocus
        />
        {error && <div className="lp-card-error">{error}</div>}
        <button className="lp-card-btn" onClick={handleEntrar} disabled={loading}>{loading ? "..." : "ENTRAR →"}</button>
        <div className="lp-card-divider" />
        <button className="lp-card-secondary" onClick={() => { window.location.href = "/primeiro-acesso"; }}>Primeiro acesso →</button>
      </>
    );
  }

  if (modoConvite) {
    const mono = "'DM Mono',monospace";
    const bebas = "'Bebas Neue',sans-serif";
    return (
      <div className="lp">
        <div className="lp-cursor" ref={cursorRef} />
        <div className="lp-cursor-ring" ref={ringRef} />
        <div style={{ flex:1, width:"100%", maxWidth:720, margin:"0 auto", boxSizing:"border-box", padding:"36px 20px 56px" }}>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ fontFamily:mono, fontSize:10, letterSpacing:"3px", color:"#C9A8F0", marginBottom:12 }}>// ANTICEG · CONVITE</div>
            <h1 style={{ fontFamily:bebas, fontSize:"clamp(30px,6vw,46px)", lineHeight:1, letterSpacing:".02em", margin:0, color:"#F5F0E8" }}>
              RECRUTE E <span style={{ color:"#BAFF39" }}>SUBA DE NÍVEL</span>
            </h1>
            <p style={{ fontFamily:mono, fontSize:12, lineHeight:1.7, color:"rgba(245,240,232,.55)", maxWidth:460, margin:"12px auto 0" }}>
              Chame stays pra comunidade e suba de nível. Quanto mais gente você traz, mais o seu título cresce no perfil.
            </p>
            <p style={{ fontFamily:mono, fontSize:11, lineHeight:1.6, color:"#FFD166", maxWidth:460, margin:"12px auto 0", padding:"8px 12px", background:"rgba(255,209,102,.08)", border:"1px solid rgba(255,209,102,.3)", borderRadius:8 }}>
              <strong>Importante:</strong> apenas stays com +18 anos. Menores de idade serão banidos.
            </p>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:10, marginBottom:28 }}>
            {NIVEIS_RECRUTADOR.map((n, i) => (
              <div key={n.id} style={{ position:"relative", background:"#141414", border:`1px solid ${n.cor}55`, borderRadius:14, padding:"14px 10px 12px", textAlign:"center", boxShadow:`0 0 28px ${n.cor}14` }}>
                <div style={{ position:"absolute", top:8, left:10, fontFamily:mono, fontSize:8, color:n.cor, letterSpacing:"1.5px" }}>NÍVEL {i + 1}</div>
                <img src={n.img} alt={n.titulo} style={{ width:64, height:64, objectFit:"contain", margin:"10px auto 8px", display:"block", filter:`drop-shadow(0 0 14px ${n.cor}88)` }} />
                <div style={{ fontFamily:bebas, fontSize:16, letterSpacing:".06em", color:n.cor }}>{n.titulo}</div>
                <div style={{ fontFamily:mono, fontSize:9, color:"rgba(245,240,232,.55)", marginTop:3, lineHeight:1.4 }}>{n.regra}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12, marginBottom:32 }}>
            {[
              ["1", "Entre na comunidade", "Pelo grupo do WhatsApp, é onde a gente avisa tudo."],
              ["2", "Faça seu cadastro", "Rapidinho, é só preencher o formulário aqui embaixo."],
              ["3", "Diga quem te indicou", "Coloque o @ de quem te convidou. É assim que ela sobe de nível!"],
              ["4", "Recrutador premiado", "Recrutadores ganham tickets a cada cadastro para concorrer a prêmios/campanhas especiais, como: desconto, presentes, oportunidades exclusivas."],
            ].map(([num, t, d]) => (
              <div key={num} style={{ display:"flex", gap:14, alignItems:"flex-start", padding:"12px 14px", border:"1px solid rgba(245,240,232,.08)", borderRadius:12, background:"rgba(245,240,232,.02)" }}>
                <div style={{ fontFamily:bebas, fontSize:24, lineHeight:1, color:"#FF5C1A" }}>{num}</div>
                <div>
                  <div style={{ fontFamily:mono, fontSize:11, fontWeight:700, color:"#F5F0E8", marginBottom:3 }}>{t}</div>
                  <div style={{ fontFamily:mono, fontSize:10, lineHeight:1.6, color:"rgba(245,240,232,.45)" }}>{d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", justifyContent:"center" }}>
            <div className="lp-hero-card">{renderCard()}</div>
          </div>
        </div>
      </div>
    );
  }

  if (soPrimeiroAcesso) return (
    <div className="lp">
      <div className="lp-cursor" ref={cursorRef} />
      <div className="lp-cursor-ring" ref={ringRef} />
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div className="lp-hero-card">{renderCard()}</div>
      </div>
    </div>
  );

  return (
    <div className="lp">
      <div className="lp-cursor" ref={cursorRef} />
      <div className="lp-cursor-ring" ref={ringRef} />

      {/* NAV */}
      <nav className="lp-nav">
        <a className="lp-nav-logo" href="#" onClick={e => e.preventDefault()}>ANTI<span>CEG</span></a>
        <ul className="lp-nav-links">
          <li><a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">Comunidade</a></li>
          <li><button onClick={onVerCegs} className="lp-nav-link-btn">CEGs</button></li>
          <li><a href="https://anticeg.vercel.app/regras.html" target="_blank" rel="noopener noreferrer" className="lp-nav-cta">REGRAS →</a></li>
        </ul>
        <button className="lp-hamburger" onClick={() => setMobileNav(v => !v)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </nav>
      {mobileNav && (
        <div className="lp-mobile-nav" onClick={() => setMobileNav(false)}>
          <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">Comunidade</a>
          <button onClick={onVerCegs} className="lp-nav-link-btn" style={{ textAlign:"center" }}>CEGs</button>
          <a href="https://anticeg.vercel.app/regras.html" target="_blank" rel="noopener noreferrer" className="lp-nav-cta" style={{ textAlign:"center" }}>REGRAS →</a>
        </div>
      )}

      {/* HERO */}
      <section className="lp-hero">
        <img src={bonequinha} alt="antigom" className="lp-bonequinha" />
        <div className="lp-hero-content">
          <div className="lp-hero-left">
            <div className="lp-hero-tag">anticeg — compras em grupo · SKZ & mais</div>
            <h1 className="lp-h1"><span className="ao">ANTI</span><span className="ag">GOM</span></h1>
            <p className="lp-hero-sub">O lugar para você organizar seus trequinhos da anticomu. Consulte seus itens, acompanhe envios e gerencie pagamentos — e sim, você pode comprar na anti-store.</p>
          </div>
          <div className="lp-hero-card">
            {renderCard()}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <span className="lp-footer-mid">OMG, YOU'RE SO ANTI</span>
        <span className="lp-footer-copy">© 2025 design e programação por @nandaverseo_c</span>
      </footer>
    </div>
  );
}
