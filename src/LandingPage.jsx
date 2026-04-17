import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./LandingPage.css";
import bonequinha from "./assets/bonequinha.png";

const supabase = createClient(
  "https://ghjfsmwwcfpfvrouyrka.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM"
);

const WA = "5524992501917";
const WA_ACESSO = `https://wa.me/${WA}?text=${encodeURIComponent("Olá! Quero solicitar acesso ao portal ANTICEG.")}`;

export default function LandingPage({ onLogin, onEntrar }) {
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const [mobileNav, setMobileNav] = useState(false);

  // mini-login states
  const [mode, setMode] = useState("cog"); // cog | senha | criar-senha | esqueci
  const [input, setInput] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [esquecInput, setEsquecInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cogTemp, setCogTemp] = useState("");
  const [nomeTemp, setNomeTemp] = useState("");
  const [itensTemp, setItensTemp] = useState([]);
  const [joinerTemp, setJoinerTemp] = useState(null);

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

  async function handleBuscarCOG() {
    setLoading(true); setError("");
    const val = input.trim();
    if (!val) { setError("Informe seu COG ou e-mail."); setLoading(false); return; }
    const isEmail = val.includes("@");

    if (isEmail) {
      const { data: joiner } = await supabase.from("joiners").select("*").eq("email", val.toLowerCase()).single();
      if (!joiner) { setError("E-mail não encontrado. Fale com a Nanda."); setLoading(false); return; }
      const { data: itens } = await supabase.from("masterlist").select("*").eq("cog", joiner.cog);
      setCogTemp(joiner.cog); setNomeTemp(joiner.nome || joiner.cog);
      setItensTemp(itens || []); setJoinerTemp(joiner);
      setMode("senha"); setLoading(false); return;
    }

    const { data: itens } = await supabase.from("masterlist").select("*").eq("cog", val);
    const { data: itensPorNome } = await supabase.from("masterlist").select("*").ilike("nome", val);
    const itensEncontrados = (itens && itens.length > 0) ? itens : (itensPorNome && itensPorNome.length > 0) ? itensPorNome : null;

    if (!itensEncontrados) { setError("COG não encontrado. Fale com a Nanda."); setLoading(false); return; }

    const cogReal = itensEncontrados[0].cog;
    const nomeReal = itensEncontrados[0].nome || cogReal;
    setCogTemp(cogReal); setNomeTemp(nomeReal); setItensTemp(itensEncontrados);
    const { data: joiner } = await supabase.from("joiners").select("*").eq("cog", cogReal).single();
    setJoinerTemp(joiner);
    setMode(!joiner || !joiner.senha ? "criar-senha" : "senha");
    setLoading(false);
  }

  async function handleConfirmarSenha() {
    setLoading(true); setError("");
    if (senha !== joinerTemp.senha) { setError("Senha incorreta."); setLoading(false); return; }
    const user = { ...joinerTemp, nome: nomeTemp };
    localStorage.setItem("anticeg_user", JSON.stringify(user));
    onLogin(user, itensTemp);
    setLoading(false);
  }

  async function handleEsqueci() {
    setLoading(true); setError("");
    if (!joinerTemp?.email) { setError("Conta sem e-mail. Fale com a Nanda."); setLoading(false); return; }
    if (joinerTemp.email.toLowerCase() !== esquecInput.trim().toLowerCase()) { setError("E-mail não confere."); setLoading(false); return; }
    await supabase.from("joiners").update({ senha: null }).eq("cog", cogTemp);
    setSenha(""); setSenhaConfirm(""); setEsquecInput(""); setMode("criar-senha");
    setLoading(false);
  }

  async function handleCriarSenha() {
    setLoading(true); setError("");
    if (senha.length < 6) { setError("Mínimo 6 caracteres."); setLoading(false); return; }
    if (senha !== senhaConfirm) { setError("As senhas não coincidem."); setLoading(false); return; }
    const { data: existe } = await supabase.from("joiners").select("id").eq("cog", cogTemp).single();
    if (existe) { await supabase.from("joiners").update({ senha }).eq("cog", cogTemp); }
    else { await supabase.from("joiners").insert([{ cog: cogTemp, senha }]); }
    const { data: joiner } = await supabase.from("joiners").select("*").eq("cog", cogTemp).single();
    const user = { ...joiner, nome: nomeTemp };
    localStorage.setItem("anticeg_user", JSON.stringify(user));
    onLogin(user, itensTemp);
    setLoading(false);
  }

  function renderCard() {
    if (mode === "senha") return (
      <>
        <div className="lp-card-label">// bem-vinda, {nomeTemp}</div>
        <input className="lp-card-input" type="password" placeholder="Sua senha" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === "Enter" && handleConfirmarSenha()} autoFocus />
        {error && <div className="lp-card-error">{error}</div>}
        <button className="lp-card-btn" onClick={handleConfirmarSenha} disabled={loading}>{loading ? "..." : "ENTRAR →"}</button>
        <div className="lp-card-links">
          <button className="lp-card-link" onClick={() => { setMode("esqueci"); setError(""); }}>Esqueci minha senha</button>
          <button className="lp-card-link" onClick={() => { setMode("cog"); setInput(""); setError(""); }}>← Voltar</button>
        </div>
      </>
    );

    if (mode === "esqueci") return (
      <>
        <div className="lp-card-label">// redefinir senha</div>
        <p className="lp-card-desc">Confirme o e-mail cadastrado para redefinir.</p>
        <input className="lp-card-input" type="email" placeholder="Seu e-mail" value={esquecInput} onChange={e => setEsquecInput(e.target.value)} />
        {error && <div className="lp-card-error">{error}</div>}
        <button className="lp-card-btn" onClick={handleEsqueci} disabled={loading}>{loading ? "..." : "CONFIRMAR →"}</button>
        <button className="lp-card-link" style={{ marginTop: 8 }} onClick={() => { setMode("senha"); setError(""); }}>← Voltar</button>
      </>
    );

    if (mode === "criar-senha") return (
      <>
        <div className="lp-card-label">// criar senha — {nomeTemp}</div>
        <input className="lp-card-input" type="password" placeholder="Nova senha (mín. 6 caracteres)" value={senha} onChange={e => setSenha(e.target.value)} autoFocus />
        <input className="lp-card-input" type="password" placeholder="Confirmar senha" value={senhaConfirm} onChange={e => setSenhaConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCriarSenha()} />
        {error && <div className="lp-card-error">{error}</div>}
        <button className="lp-card-btn" onClick={handleCriarSenha} disabled={loading}>{loading ? "..." : "CRIAR SENHA E ENTRAR →"}</button>
        <button className="lp-card-link" style={{ marginTop: 8 }} onClick={() => { setMode("cog"); setInput(""); setError(""); }}>← Voltar</button>
      </>
    );

    // mode === "cog"
    return (
      <>
        <div className="lp-card-label">// acesso rápido</div>
        <input
          className="lp-card-input"
          type="text"
          placeholder="Seu COG ou e-mail"
          value={input}
          onChange={e => { setInput(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleBuscarCOG()}
          autoFocus
        />
        {error && <div className="lp-card-error">{error}</div>}
        <button className="lp-card-btn" onClick={handleBuscarCOG} disabled={loading}>{loading ? "..." : "ENTRAR →"}</button>
        <div className="lp-card-divider" />
        <button className="lp-card-secondary" onClick={() => onLogin({ guest: true }, [])}>Entrar como visitante</button>
        <a href={WA_ACESSO} target="_blank" rel="noopener noreferrer" className="lp-card-secondary lp-card-secondary-link">Solicitar acesso</a>
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
          <li><a href="https://anticeg.vercel.app/regras.html" target="_blank" rel="noopener noreferrer" className="lp-nav-cta">REGRAS →</a></li>
        </ul>
        <button className="lp-hamburger" onClick={() => setMobileNav(v => !v)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </nav>
      {mobileNav && (
        <div className="lp-mobile-nav" onClick={() => setMobileNav(false)}>
          <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">Comunidade</a>
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
        <span className="lp-footer-logo">ANTI<span>CEG</span></span>
        <span className="lp-footer-mid">Compras em grupo · Anticomu · Kpop</span>
        <span className="lp-footer-copy">© 2025 anticeg — Nanda</span>
      </footer>
    </div>
  );
}
