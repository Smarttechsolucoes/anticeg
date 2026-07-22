import { useEffect, useRef, useState } from "react";
import "./LandingPage.css";
import supabase from "./supabase.js";
import bonequinha from "./assets/bonequinha.png";


const WA = "5524992782023";

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
  const [primeiroAcesso, setPrimeiroAcesso]   = useState(false);
  const [cadNome,        setCadNome]           = useState("");
  const [cadCog,         setCadCog]            = useState("");
  const [cadEmail,       setCadEmail]          = useState("");
  const [cadWhats,       setCadWhats]          = useState("");
  const [cadError,       setCadError]          = useState("");
  const [cadLoading,     setCadLoading]        = useState(false);
  const [cadOk,          setCadOk]             = useState(false);

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
    if (isEmail(input)) {
      const { data } = await supabase.from("joiners").select("*").eq("email", input.toLowerCase()).single();
      return data;
    }
    const handle = input.startsWith("@") ? input.slice(1) : input;
    const { data } = await supabase.from("joiners").select("*")
      .or(`twitter.ilike.@${handle},twitter.ilike.${handle}`)
      .single();
    return data;
  }

  async function handleEntrar() {
    setLoading(true); setError("");
    const input = email.trim();
    if (!input) { setError("Informe seu @ ou e-mail."); setLoading(false); return; }

    const joiner = await buscarJoiner(input);
    if (!joiner) { setError("Acesso não encontrado. Solicite pelo WhatsApp."); setLoading(false); return; }

    const isOwner = joiner.cog === "nandaverseo_c" || joiner.email === "nandag_medeiros@hotmail.com";
    if (isOwner && joiner.senha) {
      setPendingJoiner(joiner);
      setLoading(false);
      return;
    }

    if (joiner.cog === "ADMMODE") {
      setPendingJoiner({ ...joiner, _senha_demo: "anticeg@demo" });
      setLoading(false);
      return;
    }

    await entrarCom(joiner);
    setLoading(false);
  }

  async function handleSenha() {
    setLoading(true); setError("");
    const senhaCorreta = pendingJoiner._senha_demo || pendingJoiner.senha;
    if (senha.trim() !== senhaCorreta) {
      setError("Senha incorreta."); setLoading(false); return;
    }
    await entrarCom(pendingJoiner);
    setLoading(false);
  }

  async function entrarCom(joiner) {
    const { data: itens } = await supabase.from("masterlist").select("*").eq("cog", joiner.cog);
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
      await entrarCom(joiner);
      setCadLoading(false);
      return;
    }

    // não tem conta → cadastro pendente
    if (!nome || !cog || !eml) {
      setCadError("Conta não encontrada. Preencha nome, @ e e-mail para solicitar cadastro.");
      setCadLoading(false); return;
    }

    const { data: dup } = await supabase.from("pre_cadastros").select("id")
      .eq("status", "pendente").or(`cog.ilike.${cog},email.eq.${eml}`).maybeSingle();
    if (dup) { setCadError("Já existe um cadastro pendente com esses dados. Aguarde a aprovação."); setCadLoading(false); return; }

    const { error: err } = await supabase.from("pre_cadastros").insert([{ nome, cog, email: eml, whatsapp: whats || null }]);
    if (err) { setCadError("Erro ao enviar. Tente novamente."); setCadLoading(false); return; }

    setCadLoading(false);
    onLogin({ pre_cadastro: true, nome, cog, email: eml, whatsapp: whats || null }, []);
  }

  function resetPrimeiroAcesso() {
    setPrimeiroAcesso(false);
    setCadNome(""); setCadCog(""); setCadEmail(""); setCadWhats("");
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
            <div style={{ fontSize:11, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginBottom:14, lineHeight:1.6 }}>
              Preencha seus dados. Se você já tiver conta, entrará direto — senão, seu cadastro será enviado para aprovação.
            </div>
            <input className="lp-card-input" type="text" placeholder="nome para a claim" value={cadNome}
              onChange={e => { setCadNome(e.target.value); setCadError(""); }} autoFocus />
            <input className="lp-card-input" type="text" placeholder="@ da rede social (sem @)" value={cadCog}
              onChange={e => { setCadCog(e.target.value); setCadError(""); }} />
            <input className="lp-card-input" type="email" placeholder="e-mail" value={cadEmail}
              onChange={e => { setCadEmail(e.target.value); setCadError(""); }} />
            <input className="lp-card-input" type="text" placeholder="whatsapp (pra te localizar nas claims)" value={cadWhats}
              onChange={e => { setCadWhats(e.target.value); setCadError(""); }}
              onKeyDown={e => e.key === "Enter" && handlePrimeiroAcesso()} />
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
        <button className="lp-card-secondary" onClick={() => setPrimeiroAcesso(true)}>Primeiro acesso →</button>
      </>
    );
  }

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
