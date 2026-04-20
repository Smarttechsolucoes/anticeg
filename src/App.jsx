import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";
import LandingPage from "./LandingPage";
import bonequinha from "./assets/bonequinha.png";

const supabase = createClient(
  "https://ghjfsmwwcfpfvrouyrka.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM"
);

const FORMS_URL = "https://forms.gle/vMyjCKG4Dj2yhryP7";
const WHATSAPP_NUM = "5524992501917";
const ADMIN_EMAIL = "nandag_medeiros@hotmail.com";
const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function fmtBRL(val, hidden) {
  if (hidden) return "••••";
  return Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function whatsappMsg(item) {
  const total = Number(item.valor_item) + Number(item.frete_inter) + Number(item.taxa_rf || 0) + Number(item.nacional || 0);
  const msg = `Olá! Quero pagar no cartão de crédito.\nValor: R$ ${fmtBRL(total)}\nParcelas: até x12 com juros`;
  return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`;
}

const STATUS_STEPS = [
  { id: "Pré-venda",        label: "Pré-venda",       icon: "🛒" },
  { id: "Na Warehouse",     label: "Na Warehouse",     icon: "📦" },
  { id: "A Caminho",        label: "A Caminho",        icon: "✈️" },
  { id: "Taxa Liberada",    label: "Taxa Liberada",    icon: "✅" },
  { id: "Chegou Aqui",      label: "Chegou Aqui",      icon: "🏠" },
  { id: "Envio Liberado",   label: "Envio Liberado",   icon: "📬" },
  { id: "Enviado Nacional", label: "Enviado Nacional", icon: "🚚" },
];

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const chipMap = {
  "Pré-venda":       ["chip-prevenda",  "Pré-venda"],
  "Na Warehouse":    ["chip-warehouse", "Na Warehouse"],
  "A Caminho":       ["chip-caminho",   "A Caminho"],
  "Taxa Liberada":   ["chip-taxa",      "Taxa Liberada"],
  "Chegou Aqui":     ["chip-aqui",      "Chegou Aqui"],
  "Envio Liberado":  ["chip-nacional",  "Envio Liberado"],
  "Enviado Nacional":["chip-enviado",   "Enviado Nacional"],
  "Disponível":      ["chip-loja-disp", "Disponível"],
  "Vendido":         ["chip-loja-vend", "Vendido"],
};

function getStepIdx(status) { return STATUS_STEPS.findIndex(s => s.id === status); }
function isPendente(val) { return val && val !== "Pago" && val !== "N/A"; }

function PayBadge({ status }) {
  if (status === "Pago")      return <span className="pay-badge pay-pago">Pago</span>;
  if (isPendente(status))     return <span className="pay-badge pay-pendente">Pendente</span>;
  return null;
}

function StatusChip({ status }) {
  const [cls, label] = chipMap[status] || ["chip-prevenda", status || ""];
  return <span className={`status-chip ${cls}`}>{label}</span>;
}

function ProgressMini({ activeIdx }) {
  return (
    <div className="progress-mini">
      {STATUS_STEPS.slice(0, -1).map((_, i) => (
        <div key={i} className={`prog-seg ${i < activeIdx ? "done-seg" : i === activeIdx ? "active-seg" : ""}`}>
          <div className="prog-seg-fill" />
        </div>
      ))}
    </div>
  );
}

function Timeline({ activeIdx }) {
  return (
    <div className="drawer-inner">
      {STATUS_STEPS.map((step, i) => {
        const cls = i < activeIdx ? "tl-done" : i === activeIdx ? "tl-active" : "tl-pending";
        return (
          <div key={step.id} className={`timeline-step ${cls}`}>
            <div className="tl-dot">{step.icon}</div>
            <div className="tl-name">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function ValCell({ val, status }) {
  const cls = status === "Pago" ? "pago" : isPendente(status) ? "pend" : "zero";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className={`td-val ${cls}`}>R${fmtBRL(val)}</span>
      <PayBadge status={status} />
    </div>
  );
}

function SumCard({ label, value, valueCls, sub, isAmount }) {
  const [hidden, setHidden] = useState(false);
  return (
    <div className="sum-card">
      <div className="sum-label">{label}</div>
      <div className={`sum-value ${valueCls}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isAmount ? `R$${fmtBRL(value, hidden)}` : value}
        {isAmount && (
          <button onClick={() => setHidden(!hidden)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, opacity: 0.4, padding: 0, lineHeight: 1 }}>
            {hidden ? "👁️" : "🙈"}
          </button>
        )}
      </div>
      <div className="sum-sub">{sub}</div>
    </div>
  );
}

function PayButtons({ item }) {
  const temPendente = isPendente(item.pag_item) || isPendente(item.pag_frete) || isPendente(item.pag_taxa) || isPendente(item.pag_nacional);
  if (!temPendente) return null;
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <a href={FORMS_URL} target="_blank" rel="noopener noreferrer" className="pay-btn pay-btn-pix">💸 PIX</a>
      <a href={whatsappMsg(item)} target="_blank" rel="noopener noreferrer" className="pay-btn pay-btn-card">💳 Cartão</a>
    </div>
  );
}

// ── Input helper ────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="login-label" style={{ marginBottom: 6, display: "block" }}>{label}</label>
      {children}
    </div>
  );
}

function LoginScreen({ onLogin, onVoltar }) {
  const [mode, setMode] = useState("escolha");
  const [input, setInput] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [esquecInput, setEsquecInput] = useState("");

  // cadastro
  const [nome, setNome] = useState("");
  const [twitter, setTwitter] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [estado, setEstado] = useState("");
  const [email, setEmail] = useState("");

  // dados temporários entre steps
  const [cogTemp, setCogTemp] = useState("");
  const [nomeTemp, setNomeTemp] = useState("");
  const [itensTemp, setItensTemp] = useState([]);
  const [joinerTemp, setJoinerTemp] = useState(null);

  async function handleLoginCOG() {
    setLoading(true); setError("");
    const val = input.trim();
    const isEmail = val.includes("@");

    let cogReal = null;
    let nomeReal = null;
    let itensEncontrados = null;

    if (isEmail) {
      // Busca joiner pelo e-mail cadastrado
      const { data: joiner } = await supabase.from("joiners").select("*").eq("email", val.toLowerCase()).single();
      if (!joiner) { setError("E-mail não encontrado. Entre em contato com a Nanda para ter acesso."); setLoading(false); return; }
      cogReal = joiner.cog;
      nomeReal = joiner.nome || cogReal;
      const { data: itens } = await supabase.from("masterlist").select("*").eq("cog", cogReal);
      itensEncontrados = itens || [];
      setCogTemp(cogReal);
      setNomeTemp(nomeReal);
      setItensTemp(itensEncontrados);
      setJoinerTemp(joiner);
      setMode("senha");
      setLoading(false);
      return;
    }

    // Busca por COG
    const { data: itens } = await supabase.from("masterlist").select("*").eq("cog", val);
    const { data: itensPorNome } = await supabase.from("masterlist").select("*").ilike("nome", val);
    itensEncontrados = (itens && itens.length > 0) ? itens : (itensPorNome && itensPorNome.length > 0) ? itensPorNome : null;

    if (!itensEncontrados) {
      setError("COG não encontrado. Entre em contato com a Nanda para ter acesso.");
      setLoading(false); return;
    }

    cogReal = itensEncontrados[0].cog;
    nomeReal = itensEncontrados[0].nome || cogReal;

    setCogTemp(cogReal);
    setNomeTemp(nomeReal);
    setItensTemp(itensEncontrados);

    const { data: joiner } = await supabase.from("joiners").select("*").eq("cog", cogReal).single();

    if (!joiner || !joiner.senha) {
      setMode("criar-senha");
    } else {
      setJoinerTemp(joiner);
      setMode("senha");
    }
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
    const val = esquecInput.trim().toLowerCase();
    if (!val) { setError("Informe seu e-mail cadastrado."); setLoading(false); return; }
    if (!joinerTemp || !joinerTemp.email) { setError("Não foi possível verificar. Entre em contato com a Nanda."); setLoading(false); return; }
    if (joinerTemp.email.toLowerCase() !== val) { setError("E-mail não confere. Tente novamente ou fale com a Nanda."); setLoading(false); return; }
    await supabase.from("joiners").update({ senha: null }).eq("cog", cogTemp);
    setEsquecInput("");
    setSenha("");
    setSenhaConfirm("");
    setMode("criar-senha");
    setLoading(false);
  }

  async function handleCriarSenha() {
    setLoading(true); setError("");
    if (senha.length < 6) { setError("Senha deve ter pelo menos 6 caracteres."); setLoading(false); return; }
    if (senha !== senhaConfirm) { setError("As senhas não coincidem."); setLoading(false); return; }

    const { data: existe } = await supabase.from("joiners").select("id").eq("cog", cogTemp).single();
    if (existe) {
      await supabase.from("joiners").update({ senha }).eq("cog", cogTemp);
    } else {
      await supabase.from("joiners").insert([{ cog: cogTemp, senha }]);
    }

    const { data: joiner } = await supabase.from("joiners").select("*").eq("cog", cogTemp).single();
    const user = { ...joiner, nome: nomeTemp };
    localStorage.setItem("anticeg_user", JSON.stringify(user));
    onLogin(user, itensTemp);
    setLoading(false);
  }

  async function handleCadastro() {
    setLoading(true); setError("");
    if (!nome.trim()) { setError("Nome obrigatório."); setLoading(false); return; }
    if (!email.trim().includes("@")) { setError("E-mail inválido."); setLoading(false); return; }
    if (senha.length < 6) { setError("Senha deve ter pelo menos 6 caracteres."); setLoading(false); return; }
    const em = email.trim().toLowerCase();
    const { data: existe } = await supabase.from("joiners").select("id").eq("email", em).single();
    if (existe) { setError("E-mail já cadastrado."); setLoading(false); return; }
    const cog = em.split("@")[0];
    const novoUsuario = { cog, nome: nome.trim(), twitter: twitter.trim(), whatsapp: whatsapp.trim(), estado, email: em, senha };
    const { data: novo, error: err } = await supabase.from("joiners").insert([novoUsuario]).select().single();
    if (err) { setError("Erro ao cadastrar."); setLoading(false); return; }
    onLogin(novo, []);
    setLoading(false);
  }

  const logoBlock = (sub) => (
    <>
      <div className="login-eyebrow">masterlist · {sub}</div>
      <div className="login-title">ANTI<span className="lo">CEG</span><br /><span className="lg">MASTER</span><br />LIST</div>
    </>
  );

  if (mode === "escolha") return (
    <div className="login-screen"><div className="login-wrap">
      {logoBlock("acesso")}
      <div className="login-box">
        {onVoltar && <button className="login-skip" style={{ marginBottom: 4 }} onClick={onVoltar}>← Voltar para a home</button>}
        <button className="login-btn" onClick={() => setMode("cog")}>ACESSAR COM COG OU E-MAIL →</button>
        <button className="login-btn" style={{ background: "transparent", border: "1px solid rgba(245,240,232,.2)", color: "rgba(245,240,232,.7)" }} onClick={() => onLogin({ guest: true }, [])}>ENTRAR COMO VISITANTE →</button>
        <div style={{ textAlign: "center", fontSize: "var(--fs-xs)", color: "rgba(245,240,232,.35)", padding: "8px 0" }}>
          Não tem acesso ainda?
        </div>
        <a href={`https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent("Olá! Quero solicitar acesso ao portal ANTICEG.")}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: "1px solid rgba(245,240,232,.15)", color: "rgba(245,240,232,.5)", fontFamily: "'DM Mono', monospace", fontSize: "var(--fs-xs)", fontWeight: 600, padding: "14px", borderRadius: "6px", textDecoration: "none", letterSpacing: "1px", transition: "all .15s" }}
          onMouseOver={e => { e.currentTarget.style.borderColor = "var(--verde)"; e.currentTarget.style.color = "var(--verde)"; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(245,240,232,.15)"; e.currentTarget.style.color = "rgba(245,240,232,.5)"; }}>
          💬 SOLICITAR ACESSO
        </a>
      </div>
    </div></div>
  );

  if (mode === "cog") return (
    <div className="login-screen"><div className="login-wrap">
      {logoBlock("acesso por COG")}
      <div className="login-box">
        <label className="login-label">Seu COG ou e-mail</label>
        <input className="login-input" type="text" placeholder="Ex: COG ou seuemail@email.com" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLoginCOG()}
          style={{ borderColor: error ? "var(--laranja)" : "" }} />
        <button className="login-btn" onClick={handleLoginCOG} disabled={loading}>{loading ? "BUSCANDO..." : "CONTINUAR →"}</button>
        <button className="login-skip" onClick={() => { setMode("escolha"); setError(""); }}>← Voltar</button>
        {error && <div className="login-error">{error}</div>}
      </div>
    </div></div>
  );

  if (mode === "senha") return (
    <div className="login-screen"><div className="login-wrap">
      {logoBlock("acesso")}
      <div className="login-box">
        <div style={{ fontSize: "var(--fs-xs)", color: "rgba(245,240,232,.4)", marginBottom: 4 }}>COG: <span style={{ color: "var(--lilas)" }}>{cogTemp}</span></div>
        <label className="login-label">Sua senha</label>
        <input className="login-input" type="password" placeholder="••••••" value={senha}
          onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === "Enter" && handleConfirmarSenha()} />
        <button className="login-btn" onClick={handleConfirmarSenha} disabled={loading}>{loading ? "VERIFICANDO..." : "ENTRAR →"}</button>
        <button className="login-skip" onClick={() => { setMode("esqueci"); setError(""); setSenha(""); }}>Esqueci minha senha</button>
        <button className="login-skip" onClick={() => { setMode("cog"); setError(""); setSenha(""); }}>← Voltar</button>
        {error && <div className="login-error">{error}</div>}
      </div>
    </div></div>
  );

  if (mode === "esqueci") return (
    <div className="login-screen"><div className="login-wrap">
      {logoBlock("redefinir senha")}
      <div className="login-box">
        <div style={{ fontSize: 12, color: "rgba(245,240,232,.5)", marginBottom: 12 }}>
          COG: <span style={{ color: "var(--lilas)" }}>{cogTemp}</span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(245,240,232,.4)", marginBottom: 12 }}>
          Confirme o e-mail cadastrado para redefinir sua senha.
        </div>
        <label className="login-label">Seu e-mail cadastrado</label>
        <input className="login-input" type="email" placeholder="seuemail@email.com" value={esquecInput}
          onChange={e => setEsquecInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEsqueci()}
          style={{ borderColor: error ? "var(--laranja)" : "" }} />
        <button className="login-btn" onClick={handleEsqueci} disabled={loading}>{loading ? "VERIFICANDO..." : "REDEFINIR SENHA →"}</button>
        <button className="login-skip" onClick={() => { setMode("senha"); setError(""); setEsquecInput(""); }}>← Voltar</button>
        {error && <div className="login-error">{error}</div>}
      </div>
    </div></div>
  );

  if (mode === "criar-senha") return (
    <div className="login-screen"><div className="login-wrap">
      {logoBlock("primeiro acesso")}
      <div className="login-box">
        <div style={{ fontSize: "var(--fs-xs)", color: "rgba(245,240,232,.4)", marginBottom: 4 }}>COG: <span style={{ color: "var(--lilas)" }}>{cogTemp}</span></div>
        <div style={{ fontSize: "var(--fs-xs)", color: "rgba(245,240,232,.5)", padding: "8px 12px", background: "rgba(201,168,240,.08)", border: "1px solid rgba(201,168,240,.15)", borderRadius: 4 }}>
          Primeiro acesso! Crie uma senha para entrar nas próximas vezes.
        </div>
        <label className="login-label">Criar senha *</label>
        <input className="login-input" type="password" placeholder="mínimo 6 caracteres" value={senha} onChange={e => setSenha(e.target.value)} />
        <label className="login-label">Confirmar senha *</label>
        <input className="login-input" type="password" placeholder="repita a senha" value={senhaConfirm}
          onChange={e => setSenhaConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCriarSenha()} />
        <button className="login-btn" onClick={handleCriarSenha} disabled={loading}>{loading ? "SALVANDO..." : "CRIAR SENHA E ENTRAR →"}</button>
        <button className="login-skip" onClick={() => { setMode("cog"); setError(""); setSenha(""); setSenhaConfirm(""); }}>← Voltar</button>
        {error && <div className="login-error">{error}</div>}
      </div>
    </div></div>
  );

  if (mode === "cadastro") return (
    <div className="login-screen"><div className="login-wrap">
      {logoBlock("cadastro")}
      <div className="login-box">
        <label className="login-label">Nome completo *</label>
        <input className="login-input" type="text" placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} />
        <label className="login-label">@ no Twitter</label>
        <input className="login-input" type="text" placeholder="@seutwitter" value={twitter} onChange={e => setTwitter(e.target.value)} />
        <label className="login-label">WhatsApp</label>
        <input className="login-input" type="text" placeholder="(11) 99999-9999" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
        <label className="login-label">Estado (opcional)</label>
        <select className="login-input" value={estado} onChange={e => setEstado(e.target.value)} style={{ cursor: "pointer" }}>
          <option value="">Selecione...</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <label className="login-label">E-mail *</label>
        <input className="login-input" type="email" placeholder="seuemail@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <label className="login-label">Senha * (mínimo 6 caracteres)</label>
        <input className="login-input" type="password" placeholder="••••••" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCadastro()} />
        <button className="login-btn" onClick={handleCadastro} disabled={loading}>{loading ? "CADASTRANDO..." : "CADASTRAR →"}</button>
        <button className="login-skip" onClick={() => { setMode("escolha"); setError(""); }}>← Voltar</button>
        {error && <div className="login-error">{error}</div>}
      </div>
    </div></div>
  );
}

function CegModal({ ceg, onClose }) {
  const [itens, setItens] = useState(null);

  useEffect(() => {
    supabase.from("masterlist").select("*").eq("ceg", ceg).then(({ data }) => {
      setItens(data || []);
    });
  }, [ceg]);

  const byJoiner = itens
    ? itens.reduce((acc, item) => {
        const key = item.nome || item.cog;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {})
    : {};

  return (
    <div className="ceg-modal-overlay" onClick={onClose}>
      <div className="ceg-modal" onClick={e => e.stopPropagation()}>
        <div className="ceg-modal-header">
          <div>
            <div style={{ fontSize: "var(--fs-xs)", color: "rgba(245,240,232,.4)", letterSpacing: 2, marginBottom: 4 }}>COMPRA EM GRUPO</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "var(--fs-2xl)", color: "var(--laranja)", lineHeight: 1 }}>CEG {ceg}</div>
          </div>
          <button className="ceg-modal-close" onClick={onClose}>✕</button>
        </div>
        {itens === null ? (
          <div className="ceg-modal-loading">carregando...</div>
        ) : (
          <div className="ceg-modal-body">
            {itens.length === 0 ? (
              <div className="ceg-modal-loading">nenhum item encontrado</div>
            ) : (
              <>
                <div className="ceg-modal-summary">
                  <span>{itens.length} itens</span>
                  <span>·</span>
                  <span>{Object.keys(byJoiner).length} joiners</span>
                </div>
                {Object.entries(byJoiner).map(([joiner, items]) => (
                  <div key={joiner} className="ceg-joiner-group">
                    <div className="ceg-joiner-name">{joiner}</div>
                    {items.map(item => (
                      <div key={item.id} className="ceg-joiner-item">
                        <span className="ceg-item-name">{item.nome_do_item}</span>
                        <StatusChip status={item.status} />
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CegDetailView({ ceg, onVoltar }) {
  const [itens, setItens] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(null);

  useEffect(() => {
    supabase.from("masterlist").select("*").eq("ceg", ceg).neq("nome", "Disponivel")
      .then(({ data }) => setItens(data || []));
  }, [ceg]);

  const joiners = itens ? [...new Set(itens.map(i => i.cog))].length : 0;

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">
            <button onClick={onVoltar} style={{ background:"none", border:"none", color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", fontSize:"var(--fs-xs)", cursor:"pointer", padding:0, letterSpacing:1 }}>← voltar</button>
          </div>
          <div className="page-title">{ceg}</div>
        </div>
        {itens && (
          <div style={{ textAlign:"right" }}>
            <div className="greeting-sub" style={{ marginTop:8 }}>{itens.length} itens · {joiners} joiners</div>
          </div>
        )}
      </div>

      {itens === null ? (
        <div style={{ padding:40, textAlign:"center", color:"rgba(245,240,232,.3)", fontSize:"var(--fs-xs)" }}>carregando...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="col-group-header">
                <th colSpan={2}></th>
                <th colSpan={4}>VALORES A PAGAR</th>
                <th className="status-group" colSpan={2}>STATUS</th>
              </tr>
              <tr className="thead-cols">
                <th>JOINER</th>
                <th>NOME DO ITEM</th>
                <th>ITEM</th>
                <th>FRETE INTER</th>
                <th>TAXA RF</th>
                <th>NACIONAL</th>
                <th>STATUS</th>
                <th>INFO</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && (
                <tr><td colSpan={8} className="empty-cell">nenhum item</td></tr>
              )}
              {itens.map(item => {
                const ai = getStepIdx(item.status);
                const isOpen = openDrawer === item.id;
                return (
                  <>
                    <tr key={item.id}>
                      <td className="ceg-detail-joiner">{item.nome || item.cog || "—"}</td>
                      <td><div className="item-title">{item.nome_do_item}</div></td>
                      <td><span className="td-val">{Number(item.valor_item) > 0 ? `R$${fmtBRL(item.valor_item)}` : <span className="zero-val">—</span>}</span></td>
                      <td><span className="td-val">{Number(item.frete_inter) > 0 ? `R$${fmtBRL(item.frete_inter)}` : <span className="zero-val">—</span>}</span></td>
                      <td>{Number(item.taxa_rf) > 0 ? <span className="td-val">R${fmtBRL(item.taxa_rf)}</span> : <span className="zero-val">—</span>}</td>
                      <td>{Number(item.nacional) > 0 ? <span className="td-val">R${fmtBRL(item.nacional)}</span> : <span className="zero-val">—</span>}</td>
                      <td>
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                          <StatusChip status={item.status} />
                          <ProgressMini activeIdx={ai} />
                        </div>
                      </td>
                      <td>
                        {item.info_adicionais && <div className="item-detail">{item.info_adicionais}</div>}
                        <button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)} style={{marginTop: item.info_adicionais ? 4 : 0}}>▾</button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`drawer-${item.id}`} className="drawer-row">
                        <td colSpan={8}><Timeline activeIdx={ai} /></td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {itens && itens.length > 0 && (
        <div className="ml-cards">
          {itens.map(item => {
            const ai = getStepIdx(item.status);
            const isOpen = openDrawer === item.id;
            const total = Number(item.valor_item||0)+Number(item.frete_inter||0)+Number(item.taxa_rf||0)+Number(item.nacional||0);
            return (
              <div key={item.id} className="ml-card">
                <div className="ml-card-top">
                  <span className="ml-val-label" style={{ color:"rgba(245,240,232,.5)", fontSize:11 }}>{item.nome || item.cog || "—"}</span>
                  <StatusChip status={item.status} />
                </div>
                <div className="ml-card-name">{item.nome_do_item}</div>
                <div className="ml-card-vals">
                  {Number(item.valor_item) > 0 && <div className="ml-val-row"><span className="ml-val-label">item</span><ValCell val={item.valor_item} status={item.pag_item} /></div>}
                  {Number(item.frete_inter) > 0 && <div className="ml-val-row"><span className="ml-val-label">frete</span><ValCell val={item.frete_inter} status={item.pag_frete} /></div>}
                  {Number(item.taxa_rf) > 0 && <div className="ml-val-row"><span className="ml-val-label">taxa RF</span><ValCell val={item.taxa_rf} status={item.pag_taxa} /></div>}
                  {Number(item.nacional) > 0 && <div className="ml-val-row"><span className="ml-val-label">nacional</span><ValCell val={item.nacional} status={item.pag_nacional} /></div>}
                  {total > 0 && <div className={`ml-val-total${isPendente(item.pag_item) || isPendente(item.pag_frete) || isPendente(item.pag_taxa) || isPendente(item.pag_nacional) ? "" : " ml-val-total-pago"}`}>total R${fmtBRL(total)}</div>}
                </div>
                {item.info_adicionais && <div className="item-detail" style={{ fontSize:11 }}>{item.info_adicionais}</div>}
                <div className="ml-card-footer">
                  <button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)}>▾</button>
                </div>
                {isOpen && <div className="ml-card-timeline"><Timeline activeIdx={ai} /></div>}
              </div>
            );
          })}
        </div>
      )}

      {/* GALERIA */}
      {viewMode === "galeria" && (
        <div className="ml-gallery">
          {filtered.map(item => {
            const foto = localPhotos[item.id] || item.foto_item;
            const tipo = localTipos[item.id] || item.tipo || "outro";
            const isLocal = !!localPhotos[item.id] && !item.foto_item;
            return (
              <div key={item.id} className="ml-gallery-card">
                <div className="ml-gallery-img">
                  {foto
                    ? <>
                        <img src={foto} alt={item.nome_do_item} />
                        {isLocal && <span className="ml-gallery-local-tag">local</span>}
                        <label className="ml-gallery-swap" title="Trocar foto">
                          ↺
                          <input type="file" accept="image/*" style={{ display:"none" }}
                            onChange={e => assignPhoto(item.id, e.target.files[0])} />
                        </label>
                      </>
                    : <label className="ml-gallery-placeholder">
                        <span>+ foto</span>
                        <input type="file" accept="image/*" style={{ display:"none" }}
                          onChange={e => assignPhoto(item.id, e.target.files[0])} />
                      </label>
                  }
                </div>
                <div className="ml-gallery-info">
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <StatusChip status={item.status} />
                    <select
                      className="ml-tipo-select"
                      value={tipo}
                      onChange={e => setTipo(item.id, e.target.value)}
                      style={{ color: tipoColor[tipo] }}
                    >
                      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="ml-gallery-name">{item.nome_do_item}</div>
                  <div className="ml-gallery-ceg">{item.ceg}</div>
                  {!guest && <div className="ml-gallery-val">R${fmtBRL(Number(item.valor_item||0)+Number(item.frete_inter||0)+Number(item.taxa_rf||0)+Number(item.nacional||0))}</div>}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ color:"rgba(245,240,232,.3)", fontSize:13, padding:"32px 0" }}>Nenhum item encontrado.</div>}
        </div>
      )}
    </div>
  );
}

const STATUS_FINAIS = ["Enviado Nacional", "Vendido"];

function CegTab({ user, itens }) {
  const [allItens, setAllItens] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [filtro, setFiltro] = useState("todas");

  const guest = !user || user.guest;
  const meuCog = user?.cog;

  useEffect(() => {
    (async () => {
      let all = [], from = 0;
      while (true) {
        const { data } = await supabase.from("masterlist")
          .select("ceg, cog, status")
          .or("nome.neq.Disponivel,nome.is.null")
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        all = [...all, ...data];
        if (data.length < 1000) break;
        from += 1000;
      }
      setAllItens(all);
    })();
  }, []);

  if (detalhe) return <CegDetailView ceg={detalhe} onVoltar={() => setDetalhe(null)} />;

  const cegMap = {};
  (allItens || []).forEach(item => {
    const ceg = item.ceg || "—";
    if (!cegMap[ceg]) cegMap[ceg] = { itens: 0, joiners: new Set(), statusCount: {} };
    cegMap[ceg].itens++;
    if (item.cog) cegMap[ceg].joiners.add(item.cog);
    const s = item.status || "Pré-venda";
    cegMap[ceg].statusCount[s] = (cegMap[ceg].statusCount[s] || 0) + 1;
  });

  const todasCegs = Object.entries(cegMap).sort((a, b) => a[0].localeCompare(b[0]));

  const minhasCegs = meuCog ? todasCegs.filter(([, d]) => d.joiners.has(meuCog)) : [];

  const finalizadas = todasCegs.filter(([, d]) => {
    const statuses = Object.keys(d.statusCount);
    return statuses.length > 0 && statuses.every(s => STATUS_FINAIS.includes(s));
  });

  const cegsMap = { todas: todasCegs, minhas: minhasCegs, finalizadas };
  const cegs = cegsMap[filtro] || todasCegs;

  const filtrosBtns = [
    { id: "todas", label: `Todas (${todasCegs.length})` },
    ...(!guest ? [{ id: "minhas", label: `Minhas (${minhasCegs.length})` }] : []),
    { id: "finalizadas", label: `Finalizadas (${finalizadas.length})` },
  ];

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">anticeg · compras em grupo</div>
          <div className="page-title">RESU<span>MO CEGs</span></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {filtrosBtns.map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            style={{
              background: filtro === f.id ? "var(--laranja)" : "transparent",
              color: filtro === f.id ? "#111" : "rgba(245,240,232,.6)",
              border: `1px solid ${filtro === f.id ? "var(--laranja)" : "rgba(245,240,232,.2)"}`,
              borderRadius: 6, padding: "6px 14px", fontSize: 12,
              fontFamily: "'DM Mono', monospace", fontWeight: 600,
              cursor: "pointer", letterSpacing: "0.5px", transition: "all .15s"
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {allItens === null ? (
        <div style={{ padding: 40, textAlign: "center", color: "rgba(245,240,232,.3)", fontSize: "var(--fs-xs)" }}>carregando...</div>
      ) : cegs.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "rgba(245,240,232,.3)", fontSize: "var(--fs-xs)" }}>
          {filtro === "minhas" ? "você não está em nenhuma CEG ainda" : "nenhuma CEG encontrada"}
        </div>
      ) : (
        <div className="ceg-summary-grid">
          {cegs.map(([ceg, data]) => {
            const statuses = Object.entries(data.statusCount).sort((a, b) => b[1] - a[1]);
            const euEstou = meuCog && data.joiners.has(meuCog);
            return (
              <div key={ceg} className="ceg-summary-card" style={{ borderColor: euEstou ? "rgba(183,156,255,.25)" : "" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="ceg-summary-name">{ceg}</div>
                  {euEstou && <span style={{ fontSize: 9, background: "var(--lilas)", color: "#111", borderRadius: 4, padding: "1px 6px", fontWeight: 700, letterSpacing: 0.5 }}>EU</span>}
                </div>
                <div className="ceg-summary-meta">
                  <span>{data.itens} {data.itens === 1 ? "item" : "itens"}</span>
                  <span>·</span>
                  <span>{data.joiners.size} {data.joiners.size === 1 ? "joiner" : "joiners"}</span>
                </div>
                <div className="ceg-summary-chips">
                  {statuses.map(([status, count]) => (
                    <span key={status} className={`status-chip ${(chipMap[status] || ["chip-prevenda"])[0]}`} style={{ fontSize: 10 }}>
                      {status} <span style={{ opacity: 0.6, marginLeft: 2 }}>×{count}</span>
                    </span>
                  ))}
                </div>
                <button className="ceg-saiba-btn" onClick={() => setDetalhe(ceg)}>
                  saiba mais →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MasterlistTab({ user, itens, onLogin }) {
  const guest = user.guest;
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [openDrawer, setOpenDrawer] = useState(null);
  const [cegModal, setCegModal] = useState(null);

  const totalV = itens.reduce((a, b) => a + Number(b.valor_item||0) + Number(b.frete_inter||0) + Number(b.taxa_rf||0) + Number(b.nacional||0), 0);
  const pagoV  = itens.filter(i => i.pag_item === "Pago").reduce((a,b) => a+Number(b.valor_item||0), 0)
               + itens.filter(i => i.pag_frete === "Pago").reduce((a,b) => a+Number(b.frete_inter||0), 0)
               + itens.filter(i => i.pag_taxa === "Pago").reduce((a,b) => a+Number(b.taxa_rf||0), 0)
               + itens.filter(i => i.pag_nacional === "Pago").reduce((a,b) => a+Number(b.nacional||0), 0);
  const pendV = totalV - pagoV;
  const cegs  = [...new Set(itens.map(i => i.ceg))].length;

  const today = new Date(); today.setHours(0,0,0,0);
  const vencDates = [];
  itens.forEach(i => {
    const name = (i.nome_do_item || "").split(" ")[0];
    if (i.venc_item     && isPendente(i.pag_item))     vencDates.push({ d: new Date(i.venc_item),     label: "Item: " + name });
    if (i.venc_frete    && isPendente(i.pag_frete))    vencDates.push({ d: new Date(i.venc_frete),    label: "Frete: " + name });
    if (i.venc_taxa     && isPendente(i.pag_taxa))     vencDates.push({ d: new Date(i.venc_taxa),     label: "Taxa: " + name });
    if (i.venc_nacional && isPendente(i.pag_nacional)) vencDates.push({ d: new Date(i.venc_nacional), label: "Nacional: " + name });
  });
  const nextVenc = vencDates.filter(v => v.d >= today).sort((a,b) => a.d - b.d)[0];
  const qtdAtrasados = vencDates.filter(v => v.d < today).length;

  let filtered = [...itens];
  if (filter === "pendente") {
    filtered = filtered.filter(i => isPendente(i.pag_item) || isPendente(i.pag_frete) || isPendente(i.pag_taxa) || isPendente(i.pag_nacional));
  } else if (filter === "pago") {
    filtered = filtered.filter(i => !isPendente(i.pag_item) && !isPendente(i.pag_frete) && !isPendente(i.pag_taxa) && !isPendente(i.pag_nacional));
  } else if (filter !== "todos") {
    filtered = filtered.filter(i => i.status === filter);
  }
  if (search) filtered = filtered.filter(i => (i.nome_do_item || "").toLowerCase().includes(search));

  const tTotal = filtered.reduce((a,b) => a+Number(b.valor_item||0)+Number(b.frete_inter||0)+Number(b.taxa_rf||0)+Number(b.nacional||0), 0);
  const tPend  = filtered.filter(i=>isPendente(i.pag_item)).reduce((a,b)=>a+Number(b.valor_item||0),0)
               + filtered.filter(i=>isPendente(i.pag_frete)).reduce((a,b)=>a+Number(b.frete_inter||0),0)
               + filtered.filter(i=>isPendente(i.pag_taxa)).reduce((a,b)=>a+Number(b.taxa_rf||0),0)
               + filtered.filter(i=>isPendente(i.pag_nacional)).reduce((a,b)=>a+Number(b.nacional||0),0);

  const FILTERS = [
    { id: "todos",            label: "Todos" },
    { id: "pendente",         label: "Pendentes" },
    { id: "pago",             label: "Pagos" },
    { id: "Pré-venda",        label: "Pré-venda" },
    { id: "Na Warehouse",     label: "Na Warehouse" },
    { id: "A Caminho",        label: "A Caminho" },
    { id: "Taxa Liberada",    label: "Taxa Liberada" },
    { id: "Chegou Aqui",      label: "Chegou Aqui" },
    { id: "Envio Liberado",   label: "Envio Liberado" },
    { id: "Enviado Nacional", label: "Entregues" },
  ];

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">anticeg · visão completa</div>
          <div className="page-title">MASTER<span>LIST</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="greeting">{guest ? "Visitante" : (user.nome || user.cog)}</div>
          <div className="greeting-sub">{guest ? "visualização demo" : `${itens.length} itens · ${cegs} CEG${cegs > 1 ? "s" : ""}`}</div>
          {guest && <button className="login-btn" style={{ marginTop: 8, padding: "8px 20px", fontSize: "var(--fs-xs)" }} onClick={onLogin}>FAZER LOGIN →</button>}
        </div>
      </div>

      <div className="summary-row">
        <SumCard label="Itens totais" value={guest ? 0 : itens.length} valueCls="white" sub="em todas as CEGs" isAmount={false} />
        <SumCard label="Pendente" value={guest ? 0 : tPend} valueCls="lilas" sub="em aberto" isAmount={true} />
        <div className="sum-card">
          <div className="sum-label">Próx. vencimento</div>
          <div className="sum-value yellow">{!guest && nextVenc ? `${String(nextVenc.d.getDate()).padStart(2,"0")}/${String(nextVenc.d.getMonth()+1).padStart(2,"0")}` : "—"}</div>
          <div className="sum-sub">{!guest && nextVenc ? nextVenc.label : "nenhum pendente"}</div>
        </div>
      </div>

      {!guest && qtdAtrasados >= 3 && (
        <div className="blocklist-banner">
          <span className="blocklist-icon">⚠</span>
          <div>
            <div className="blocklist-title">pagamento atrasado</div>
            <div className="blocklist-sub">você tem {qtdAtrasados} pagamento{qtdAtrasados > 1 ? "s" : ""} em atraso. regularize para continuar participando das CEGs.</div>
          </div>
        </div>
      )}

      <div className="filters-bar">
        <span className="filter-label">Ver:</span>
        {FILTERS.map(f => (
          <button key={f.id} className={`filter-pill ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
        <input className="search-input" type="text" placeholder="Buscar item..." value={search} onChange={e => setSearch(e.target.value.toLowerCase())} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr className="col-group-header">
              <th colSpan={3}></th>
              <th colSpan={4}>VALORES A PAGAR</th>
              <th className="status-group" colSpan={2}>STATUS</th>
              <th>PAGAR</th>
            </tr>
            <tr className="thead-cols">
              <th>CEG</th>
              <th>NOME DO ITEM</th>
              <th>COG</th>
              <th>ITEM</th>
              <th>FRETE INTER</th>
              <th>TAXA RF</th>
              <th>NACIONAL</th>
              <th>STATUS</th>
              <th>INFO</th>
              <th>PAGAR</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="empty-cell">nenhum item para esse filtro</td></tr>
            )}
            {filtered.map(item => {
              const ai = getStepIdx(item.status);
              const isOpen = openDrawer === item.id;
              return (
                <>
                  <tr key={item.id}>
                    <td className="td-ceg"><button className="ceg-btn" onClick={() => setCegModal(item.ceg)}>{item.ceg}</button></td>
                    <td><div className="item-title">{item.nome_do_item}</div></td>
                    <td className="td-cog">{guest ? "—" : item.cog}</td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.valor_item} status={item.pag_item} />}</td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.frete_inter} status={item.pag_frete} />}</td>
                    <td>{guest ? <span className="zero-val">—</span> : (Number(item.taxa_rf) > 0 ? <ValCell val={item.taxa_rf} status={item.pag_taxa} /> : <span className="zero-val">—</span>)}</td>
                    <td>{guest ? <span className="zero-val">—</span> : (Number(item.nacional) > 0 ? <ValCell val={item.nacional} status={item.pag_nacional} /> : <span className="zero-val">—</span>)}</td>
                    <td>
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        <StatusChip status={item.status} />
                        <ProgressMini activeIdx={ai} />
                      </div>
                    </td>
                    <td>
                      {item.info_adicionais && <div className="item-detail">{item.info_adicionais}</div>}
                      <button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)} style={{marginTop: item.info_adicionais ? 4 : 0}}>▾</button>
                    </td>
                    <td>{!guest && <PayButtons item={item} />}</td>
                  </tr>
                  {isOpen && (
                    <tr key={`drawer-${item.id}`} className="drawer-row">
                      <td colSpan={10}><Timeline activeIdx={ai} /></td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length > 0 && !guest && (
              <tr className="total-row">
                <td colSpan={2}><span className="total-label">Total visível</span></td>
                <td colSpan={2}><span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"rgba(245,240,232,.3)"}}>{filtered.length} itens</span></td>
                <td colSpan={4}><span className="total-val">R${fmtBRL(tTotal)}</span></td>
                <td colSpan={2}>{tPend > 0 && <span className="total-pend">↗ R${fmtBRL(tPend)} pendente</span>}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Mobile cards — hidden on desktop via CSS */}
      <div className="ml-cards">
        {filtered.length === 0 && (
          <div style={{ padding:"32px 0", textAlign:"center", color:"rgba(245,240,232,.3)", fontSize:"var(--fs-xs)" }}>nenhum item para esse filtro</div>
        )}
        {filtered.map(item => {
          const ai = getStepIdx(item.status);
          const isOpen = openDrawer === item.id;
          const total = Number(item.valor_item||0)+Number(item.frete_inter||0)+Number(item.taxa_rf||0)+Number(item.nacional||0);
          return (
            <div key={item.id} className="ml-card">
              <div className="ml-card-top">
                <button className="ceg-btn" onClick={() => setCegModal(item.ceg)}>{item.ceg}</button>
                <StatusChip status={item.status} />
              </div>
              <div className="ml-card-name">{item.nome_do_item}</div>
              {!guest && (
                <div className="ml-card-vals">
                  {Number(item.valor_item) > 0 && <div className="ml-val-row"><span className="ml-val-label">item</span><ValCell val={item.valor_item} status={item.pag_item} /></div>}
                  {Number(item.frete_inter) > 0 && <div className="ml-val-row"><span className="ml-val-label">frete</span><ValCell val={item.frete_inter} status={item.pag_frete} /></div>}
                  {Number(item.taxa_rf) > 0 && <div className="ml-val-row"><span className="ml-val-label">taxa RF</span><ValCell val={item.taxa_rf} status={item.pag_taxa} /></div>}
                  {Number(item.nacional) > 0 && <div className="ml-val-row"><span className="ml-val-label">nacional</span><ValCell val={item.nacional} status={item.pag_nacional} /></div>}
                  {total > 0 && <div className={`ml-val-total${isPendente(item.pag_item) || isPendente(item.pag_frete) || isPendente(item.pag_taxa) || isPendente(item.pag_nacional) ? "" : " ml-val-total-pago"}`}>total R${fmtBRL(total)}</div>}
                </div>
              )}
              <div className="ml-card-footer">
                {!guest && <PayButtons item={item} />}
                <button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)}>▾</button>
              </div>
              {isOpen && <div className="ml-card-timeline"><Timeline activeIdx={ai} /></div>}
            </div>
          );
        })}
      </div>

      {cegModal && <CegModal ceg={cegModal} onClose={() => setCegModal(null)} />}
    </div>
  );
}

function PerfilTab({ user, onUpdate }) {
  const [nome, setNome] = useState(user.nome || "");
  const [twitter, setTwitter] = useState(user.twitter || "");
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || "");
  const [estado, setEstado] = useState(user.estado || "");
  const [email, setEmail] = useState(user.email || "");
  // endereço
  const [cep, setCep] = useState(user.cep || "");
  const [rua, setRua] = useState(user.rua || "");
  const [numero, setNumero] = useState(user.numero || "");
  const [complemento, setComplemento] = useState(user.complemento || "");
  const [bairro, setBairro] = useState(user.bairro || "");
  const [cidade, setCidade] = useState(user.cidade || "");
  // senha
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  // foto
  const [fotoUrl, setFotoUrl] = useState(user.foto_perfil || "");
  const [fotoLoading, setFotoLoading] = useState(false);
  const fileInputRef = useRef(null);

  async function handleFotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFotoLoading(true);
    // Redimensiona para 200x200 usando canvas
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 200; canvas.height = 200;
      const ctx = canvas.getContext("2d");
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
      canvas.toBlob(async (blob) => {
        const path = `${user.cog}/avatar.jpg`;
        await supabase.storage.from("avatars").remove([path]);
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) { setError("Erro ao fazer upload."); setFotoLoading(false); return; }
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        await supabase.from("joiners").update({ foto_perfil: publicUrl }).eq("cog", user.cog);
        const updatedUser = { ...user, foto_perfil: publicUrl };
        localStorage.setItem("anticeg_user", JSON.stringify(updatedUser));
        onUpdate(updatedUser);
        setFotoUrl(publicUrl);
        setFotoLoading(false);
      }, "image/jpeg", 0.9);
    };
  }

  async function buscarCep(v) {
    const c = v.replace(/\D/g, "");
    setCep(v);
    if (c.length === 8) {
      try {
        const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
        const d = await r.json();
        if (!d.erro) {
          setRua(d.logradouro || "");
          setBairro(d.bairro || "");
          setCidade(d.localidade || "");
          setEstado(d.uf || "");
        }
      } catch {}
    }
  }

  async function handleSalvar() {
    setLoading(true); setError(""); setSuccess("");

    if (novaSenha) {
      if (novaSenha.length < 6) { setError("Nova senha deve ter pelo menos 6 caracteres."); setLoading(false); return; }
      if (novaSenha !== confirmarSenha) { setError("As senhas não coincidem."); setLoading(false); return; }
      if (user.cog && senhaAtual !== user.senha) { setError("Senha atual incorreta."); setLoading(false); return; }
    }

    const updates = {
      nome, twitter, whatsapp, estado, email,
      cep, rua, numero, complemento, bairro, cidade,
      ...(novaSenha ? { senha: novaSenha } : {})
    };

    const { error: err } = await supabase.from("joiners").update(updates).eq("cog", user.cog);
    if (err) { setError("Erro ao salvar."); setLoading(false); return; }

    const updatedUser = { ...user, ...updates };
    localStorage.setItem("anticeg_user", JSON.stringify(updatedUser));
    onUpdate(updatedUser);
    setSuccess("Perfil atualizado com sucesso!");
    setSenhaAtual(""); setNovaSenha(""); setConfirmarSenha("");
    setLoading(false);
  }

  const inputStyle = { width: "100%", marginTop: 6 };
  const sectionTitle = (t) => (
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "var(--fs-lg)", color: "var(--laranja)", letterSpacing: 1, marginTop: 8, marginBottom: 4, paddingTop: 16, borderTop: "1px solid #1e1e1e" }}>{t}</div>
  );

  return (
    <div className="main" style={{ maxWidth: 600, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">anticeg · seu perfil</div>
          <div className="page-title">MEU<span> PERFIL</span></div>
        </div>
      </div>
      <div className="login-box" style={{ gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid #1e1e1e" }}>
          <div className="avatar-perfil" onClick={() => fileInputRef.current.click()} title="Clique para trocar a foto">
            <img src={fotoUrl || bonequinha} alt="foto de perfil" />
            <div className="avatar-perfil-overlay">{fotoLoading ? "..." : "trocar"}</div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFotoUpload} />
          <div style={{ fontSize: 11, color: "rgba(245,240,232,.35)" }}>clique na foto para alterar</div>
        </div>
        {user.cog && (
          <div>
            <div className="login-label" style={{ marginBottom: 6 }}>COG (fixo)</div>
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, padding: "12px 16px", color: "rgba(245,240,232,.4)", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{user.cog}</div>
          </div>
        )}

        <div><label className="login-label">Nome completo</label><input className="login-input" style={inputStyle} type="text" value={nome} onChange={e => setNome(e.target.value)} /></div>
        <div><label className="login-label">@ no Twitter</label><input className="login-input" style={inputStyle} type="text" placeholder="@seutwitter" value={twitter} onChange={e => setTwitter(e.target.value)} /></div>
        <div><label className="login-label">WhatsApp</label><input className="login-input" style={inputStyle} type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></div>
        <div><label className="login-label">E-mail</label><input className="login-input" style={inputStyle} type="email" placeholder="seuemail@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>

        {sectionTitle("⋆ Endereço")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="login-label">CEP</label>
            <input className="login-input" style={inputStyle} type="text" placeholder="00000-000" value={cep} onChange={e => buscarCep(e.target.value)} maxLength={9} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="login-label">Rua</label>
            <input className="login-input" style={inputStyle} type="text" value={rua} onChange={e => setRua(e.target.value)} />
          </div>
          <div>
            <label className="login-label">Número</label>
            <input className="login-input" style={inputStyle} type="text" value={numero} onChange={e => setNumero(e.target.value)} />
          </div>
          <div>
            <label className="login-label">Complemento</label>
            <input className="login-input" style={inputStyle} type="text" placeholder="Apto, bloco..." value={complemento} onChange={e => setComplemento(e.target.value)} />
          </div>
          <div>
            <label className="login-label">Bairro</label>
            <input className="login-input" style={inputStyle} type="text" value={bairro} onChange={e => setBairro(e.target.value)} />
          </div>
          <div>
            <label className="login-label">Cidade</label>
            <input className="login-input" style={inputStyle} type="text" value={cidade} onChange={e => setCidade(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="login-label">Estado</label>
            <select className="login-input" style={{ ...inputStyle, cursor: "pointer" }} value={estado} onChange={e => setEstado(e.target.value)}>
              <option value="">Selecione...</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        {sectionTitle("⋆ Senha")}
        <div><label className="login-label">Senha atual</label><input className="login-input" style={inputStyle} type="password" placeholder="••••••" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} /></div>
        <div><label className="login-label">Nova senha</label><input className="login-input" style={inputStyle} type="password" placeholder="mínimo 6 caracteres" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} /></div>
        <div><label className="login-label">Confirmar nova senha</label><input className="login-input" style={inputStyle} type="password" placeholder="••••••" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} /></div>

        {error && <div className="login-error">{error}</div>}
        {success && <div style={{ fontSize: "var(--fs-xs)", color: "var(--verde)", padding: "8px 12px", background: "rgba(186,255,57,.08)", border: "1px solid rgba(186,255,57,.2)", borderRadius: 4 }}>{success}</div>}
        <button className="login-btn" onClick={handleSalvar} disabled={loading} style={{ marginTop: 8 }}>{loading ? "SALVANDO..." : "SALVAR ALTERAÇÕES →"}</button>
      </div>
    </div>
  );
}

function CalendarTab({ user, itens }) {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  function changeMonth(d) {
    let m = calMonth + d, y = calYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setCalMonth(m); setCalYear(y);
  }

  const events = {};
  function addEv(dateStr, label, type) {
    if (!dateStr) return;
    if (!events[dateStr]) events[dateStr] = [];
    events[dateStr].push({ label, type });
  }
  itens.forEach(item => {
    const name = (item.nome_do_item || "").split(" ")[0];
    if (item.venc_item)     addEv(item.venc_item,     `${name} (${item.ceg}): Item`, "item");
    if (item.venc_frete)    addEv(item.venc_frete,    `${name}: Frete`, "frete");
    if (item.venc_taxa)     addEv(item.venc_taxa,     `${name}: Taxa`, "taxa");
    if (item.venc_nacional) addEv(item.venc_nacional, `${name}: Nacional`, "nacional");
  });

  const firstDay = new Date(calYear, calMonth, 1);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(<div key={`e${i}`} className="cal-day empty" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const isToday = new Date(calYear, calMonth, d).getTime() === today.getTime();
    const dayEvs = events[dateStr] || [];
    cells.push(
      <div key={d} className={`cal-day${isToday ? " today" : ""}`}>
        <div className="cal-day-num">{d}</div>
        <div className="cal-events">
          {dayEvs.map((e, i) => <div key={i} className={`cal-event ev-${e.type}`}>{e.label}</div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="cal-main">
      <div className="cal-header">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => changeMonth(-1)}>‹</button>
          <div className="cal-month-title"><span>{MONTHS[calMonth]}</span> <span className="cal-year">{calYear}</span></div>
          <button className="cal-nav-btn" onClick={() => changeMonth(1)}>›</button>
        </div>
        <div className="cal-legend">
          {[["laranja","Venc. Item"],["lilas","Frete"],["verde","Taxa RF"],["amarelo","Nacional"]].map(([c,l]) => (
            <div key={c} className="cal-legend-item"><div className={`leg-dot leg-${c}`}/>{l}</div>
          ))}
        </div>
      </div>
      <div className="cal-grid-wrap">
        <div className="cal-weekdays">
          {["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"].map(d => (
            <div key={d} className="cal-weekday">{d}</div>
          ))}
        </div>
        <div className="cal-days">{cells}</div>
      </div>
    </div>
  );
}

function RegrasTab() {
  const secoes = [
    { titulo: "⋆ Regra de Claim", itens: ["É permitida apenas UMA pessoa te ajudando a dar claims nos itens.","No momento da claim, deve estar claramente sinalizado para quem é o photocard. Caso não esteja sinalizado, o item será considerado seu.","Itens considerados seus só poderão ser repassados mediante pagamento integral."] },
    { titulo: "⋆ Infos Gerais", itens: ["Sempre buscamos trazer merchs, SKZOOs, itens de pop-up e photocards do SKZ com melhor preço e variedade.","Às vezes também rolam caixinhas do Mercari, POCA, TaoBao e outros lugares!","Assim que os itens chegam na warehouse/proxy, já solicito envio — não fazemos CEG longa.","Menores de idade não são permitidos.","Você pode convidar amigxs confiáveis, mas evitem pessoas totalmente desconhecidas."] },
    { titulo: "⋆ Atualizações", itens: ["As atualizações e informações de CEG se encontram sempre nas planilhas e nos respectivos grupos.","Se não tem atualização recente, é porque não houve novidade.","Em caso de dúvida, o WhatsApp da Nanda está sempre disponível."] },
    { titulo: "⋆ Pagamentos & Taxas", itens: ["A Nanda faz o pagamento com dinheiro próprio/cartão de crédito — por isso vocês ganham prazo maior para pagar, principalmente merchs.","Em caso de atraso do pagamento do item, existe taxa de R$1 por dia por item, somada na hora de realizar o pagamento pendente.","Taxa de embalagem de R$2,50 para até 6 photocards, podendo variar de acordo com os itens.","Pode existir taxa da warehouse/proxy — sempre serão comunicadas.","O comprovante de pagamento deve ser enviado no formulário de pagamento.","Reembolso só em caso de cancelamento da CEG inteira — imediato e integral.","Quem estiver com pagamento atrasado, ou atrasar 3 prazos consecutivos em 30 dias, não poderá dar claim até regularizar."] },
    { titulo: "⋆ Repasse & Atraso", itens: ["Você pode repassar seus itens para membros da comunidade ANTIGOM. Fora da comunidade, só após pagamento integral.","Pagamentos com mais de 15 dias de atraso (item/taxa/frete inter) serão considerados abandono e o item será revendido. Sem reembolso.","Atrasos não comunicados ou +5 dias entrarão na lista de NÃO PAGANTES.","Com 3 atrasos em 2 meses, as claims serão bloqueadas até regularização.","Itens com 20 dias corridos de atraso sem justificativa prévia serão repassados. Sem chance de recompra.","O repasse de qualquer item só será realizado após pagamento integral do valor à Nanda.","Repasses são autorizados somente para membros da comunidade ANTIGOM."] },
    { titulo: "⋆ Envios Inter & Nacional", itens: ["Taxa inter: prazo de até 4 dias para pagamento.","Taxa RF: prazo de 7 dias para pagamento.","Frete nacional: a combinar.","Armazenamento nacional gratuito por até 1 mês, caso haja outra CEG a caminho.","Se o armazenamento for extrapolado e o frete não for pago/solicitado, o item poderá ser repassado sem reembolso.","Após 30 dias sem outra CEG a caminho, será cobrada taxa de R$30/mês de armazenamento. Com 60 dias sem solicitação, o item é considerado ABANDONO e repassado sem reembolso.","Envios nacionais são informados no grupo e acontecem em 7 dias úteis pela plataforma NUVEMSHOP.","O valor da declaração sempre será o valor integral do produto para cobertura do seguro do frete nacional."] },
    { titulo: "⋆ Reembolsos", itens: ["Situações de calote de seller não serão reembolsadas. Todas as sellers têm boas avaliações, mas transações internacionais possuem riscos.","Não há reembolso em caso de roubo/perda do objeto.","Reembolso pode ser feito em caso de má embalagem comprovada por vídeo de abertura sem cortes."] },
    { titulo: "⋆ Compradores Sensíveis", itens: ["Compradores que se incomodam com pequenos defeitos estéticos (amassados leves, pressmarks, sinais de manuseio) não devem participar de CEGs. Ao participar, você declara estar ciente dessa possibilidade e concorda em não solicitar trocas, cancelamentos ou reclamações por esse tipo de marca."] },
  ];
  const faq = [
    { p: "Quem organiza?", r: "Nanda (eu mesma)." },
    { p: "Posso chamar amigos?", r: "Sim, desde que sejam confiáveis." },
    { p: "Menores podem participar?", r: "Não." },
    { p: "Preciso pagar à vista?", r: "Você pode pagar no PIX ou cartão de crédito." },
    { p: "Posso cancelar meu pedido?", r: "A partir do momento em que o seu item está confirmado, não é possível cancelar." },
    { p: "Como funcionam os repasses?", r: "Me mande mensagem pedindo autorização. Não aceito pessoas desconhecidas dentro da comunidade." },
    { p: "E se a CEG for cancelada?", r: "Reembolso total." },
    { p: "Como vou saber das atualizações?", r: "Sempre aviso no grupo. Qualquer dúvida pode me chamar no privado." },
    { p: "Quando os itens são enviados pro BR?", r: "Assim que chegam na warehouse/proxy, já fecho a caixa." },
    { p: "Quais formas de envio pro Brasil?", r: "Correios, Mini Envio, Superfrete ou Jadlog." },
    { p: "Posso retirar pessoalmente?", r: "Sim, se estivermos na mesma região." },
  ];
  return (
    <div className="main" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="page-header"><div><div className="page-eyebrow">anticeg · comunidade</div><div className="page-title">REGRAS DA<span> COMU</span></div></div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {secoes.map((s, i) => (
          <div key={i} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: 24 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "var(--fs-lg)", color: "var(--laranja)", marginBottom: 16, letterSpacing: 1 }}>{s.titulo}</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {s.itens.map((item, j) => (
                <li key={j} style={{ display: "flex", gap: 10, fontSize: "var(--fs-xs)", color: "rgba(245,240,232,.7)", lineHeight: 1.6 }}>
                  <span style={{ color: "var(--verde)", flexShrink: 0 }}>☆</span><span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: 24 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "var(--fs-lg)", color: "var(--laranja)", marginBottom: 16, letterSpacing: 1 }}>⋆ Perguntas Frequentes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {faq.map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--offwhite)", fontWeight: 600, marginBottom: 4 }}>→ {f.p}</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "rgba(245,240,232,.6)", lineHeight: 1.6, paddingLeft: 12 }}>{f.r}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: 24 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "var(--fs-lg)", color: "var(--laranja)", marginBottom: 16, letterSpacing: 1 }}>⋆ Contato & Suporte</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, fontSize: "var(--fs-xs)", color: "rgba(245,240,232,.7)" }}><span style={{ color: "var(--verde)" }}>☆</span><span>Dúvidas? Chama a Nanda no WhatsApp!</span></div>
            <a href={`https://wa.me/${WHATSAPP_NUM}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--verde)", color: "#0D0D0D", fontFamily: "'DM Mono', monospace", fontSize: "var(--fs-xs)", fontWeight: 600, padding: "10px 20px", borderRadius: 6, textDecoration: "none", width: "fit-content", marginTop: 8 }}>💬 Falar no WhatsApp</a>
          </div>
        </div>
      </div>
    </div>
  );
}


function AdminTab() {
  const [manutencaoAdmin, setManutencaoAdmin] = useState(false);
  const [perfilPushAdmin, setPerfilPushAdmin] = useState(true);
  useEffect(() => {
    supabase.from("config").select("value").eq("key", "manutencao").single()
      .then(({ data }) => { if (data) setManutencaoAdmin(data.value === "true"); });
    supabase.from("config").select("value").eq("key", "perfil_push_ativo").single()
      .then(({ data }) => { if (data) setPerfilPushAdmin(data.value !== "false"); });
  }, []);
  async function toggleManutencao() {
    const novo = !manutencaoAdmin;
    await supabase.from("config").update({ value: String(novo) }).eq("key", "manutencao");
    setManutencaoAdmin(novo);
  }
  async function togglePerfilPush() {
    const novo = !perfilPushAdmin;
    await supabase.from("config").upsert({ key: "perfil_push_ativo", value: String(novo) }, { onConflict: "key" });
    setPerfilPushAdmin(novo);
  }

  return (
    <div className="admin-wrap">
      <h2 className="admin-title">⚙ Admin</h2>

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, padding:"14px 16px", background:"var(--card-bg)", border:`1px solid ${manutencaoAdmin ? "rgba(255,90,31,.3)" : "rgba(245,240,232,.08)"}`, borderRadius:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)" }}>Modo Manutenção</div>
          <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", marginTop:2 }}>{manutencaoAdmin ? "⚠ Site bloqueado para todos (exceto admin)" : "Site normal — joiners têm acesso completo"}</div>
        </div>
        <button onClick={toggleManutencao} style={{
          background: manutencaoAdmin ? "rgba(255,90,31,.15)" : "rgba(74,222,128,.15)",
          border: `1px solid ${manutencaoAdmin ? "rgba(255,90,31,.4)" : "rgba(74,222,128,.4)"}`,
          color: manutencaoAdmin ? "var(--laranja)" : "#4ade80",
          borderRadius:8, padding:"8px 18px", fontSize:12,
          fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer"
        }}>
          {manutencaoAdmin ? "✗ ATIVO" : "✓ DESLIGADO"}
        </button>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12, padding:"14px 16px", background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.08)", borderRadius:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)" }}>Modal de perfil</div>
          <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", marginTop:2 }}>{perfilPushAdmin ? "Ativo — aparece uma vez para cada joiner" : "Desligado — ninguém vê o modal"}</div>
        </div>
        <button onClick={togglePerfilPush} style={{
          background: perfilPushAdmin ? "rgba(74,222,128,.15)" : "rgba(255,90,31,.15)",
          border: `1px solid ${perfilPushAdmin ? "rgba(74,222,128,.4)" : "rgba(255,90,31,.4)"}`,
          color: perfilPushAdmin ? "#4ade80" : "var(--laranja)",
          borderRadius:8, padding:"8px 18px", fontSize:12,
          fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer"
        }}>
          {perfilPushAdmin ? "✓ ATIVO" : "✗ DESLIGADO"}
        </button>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, padding:"14px 16px", background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.08)", borderRadius:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)" }}>Testar modal de perfil</div>
          <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", marginTop:2 }}>Reseta o flag — o modal vai aparecer no próximo acesso</div>
        </div>
        <button onClick={() => { localStorage.removeItem("anticeg_perfil_ok"); window.location.reload(); }} style={{
          background:"rgba(201,168,240,.1)", border:"1px solid rgba(201,168,240,.3)",
          color:"#C9A8F0", borderRadius:8, padding:"8px 18px", fontSize:12,
          fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer"
        }}>
          TESTAR →
        </button>
      </div>


      <AdminFeedbacks />
    </div>
  );
}

function FeedbackTab({ user }) {
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const cog = user.cog || user.nome || user.email || "";

  useEffect(() => {
    supabase.from("feedbacks").select("*").eq("cog", cog).order("created_at", { ascending: false })
      .then(({ data }) => setFeedbacks(data || []));
  }, [cog]);

  async function handleEnviar(e) {
    e.preventDefault();
    if (!mensagem.trim()) return;
    setEnviando(true);
    const { data } = await supabase.from("feedbacks").insert([{ cog, mensagem: mensagem.trim() }]).select().single();
    if (data) setFeedbacks(prev => [data, ...prev]);
    setMensagem("");
    setEnviando(false);
  }

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">anticeg · suporte</div>
          <div className="page-title">FEED<span>BACK</span></div>
        </div>
      </div>

      <form onSubmit={handleEnviar} style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:32 }}>
        <div className="feedback-card" style={{ flexDirection:"row", alignItems:"center", gap:10 }}>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.35)", letterSpacing:1, textTransform:"uppercase" }}>enviando como</span>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"var(--laranja)", fontWeight:600 }}>{cog}</span>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.25)" }}>— não anônimo</span>
        </div>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.35)", letterSpacing:1, textTransform:"uppercase" }}>sua mensagem</div>
        <textarea
          className="feedback-textarea"
          placeholder="Descreva sua sugestão, melhoria ou bug encontrado..."
          value={mensagem}
          onChange={e => setMensagem(e.target.value)}
          required
          rows={4}
        />
        <button type="submit" className="modal-confirm-btn" disabled={enviando || !mensagem.trim()}>
          {enviando ? "enviando..." : "✉ enviar feedback"}
        </button>
      </form>

      {feedbacks.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.35)", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>seus feedbacks anteriores</div>
          {feedbacks.map(fb => (
            <div key={fb.id} className="feedback-card">
              <div className="feedback-meta">{new Date(fb.created_at).toLocaleDateString("pt-BR")} · {fb.cog}</div>
              <div className="feedback-msg">{fb.mensagem}</div>
              {fb.resposta && (
                <div className="feedback-resposta">
                  <span className="feedback-resposta-label">resposta da nanda</span>
                  <div>{fb.resposta}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminFeedbacks() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [enviando, setEnviando] = useState(null);

  useEffect(() => {
    supabase.from("feedbacks").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setFeedbacks(data || []));
  }, []);

  async function handleResponder(id) {
    const resposta = respostas[id];
    if (!resposta?.trim()) return;
    setEnviando(id);
    await supabase.from("feedbacks").update({ resposta: resposta.trim() }).eq("id", id);
    setFeedbacks(prev => prev.map(fb => fb.id === id ? { ...fb, resposta: resposta.trim() } : fb));
    setRespostas(prev => ({ ...prev, [id]: "" }));
    setEnviando(null);
  }

  return (
    <div style={{ marginTop: 40 }}>
      <div className="admin-list-title">Feedbacks ({feedbacks.length})</div>
      {feedbacks.length === 0
        ? <div className="admin-loading">nenhum feedback ainda</div>
        : feedbacks.map(fb => (
          <div key={fb.id} className="feedback-card" style={{ marginBottom: 12 }}>
            <div className="feedback-meta">{new Date(fb.created_at).toLocaleDateString("pt-BR")} · <strong>{fb.cog}</strong></div>
            <div className="feedback-msg">{fb.mensagem}</div>
            {fb.resposta
              ? <div className="feedback-resposta"><span className="feedback-resposta-label">sua resposta</span><div>{fb.resposta}</div></div>
              : (
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <input
                    className="admin-input"
                    style={{ flex:1 }}
                    placeholder="Digite sua resposta..."
                    value={respostas[fb.id] || ""}
                    onChange={e => setRespostas(prev => ({ ...prev, [fb.id]: e.target.value }))}
                  />
                  <button className="admin-save-btn" onClick={() => handleResponder(fb.id)} disabled={enviando === fb.id}>
                    {enviando === fb.id ? "..." : "responder"}
                  </button>
                </div>
              )
            }
          </div>
        ))
      }
    </div>
  );
}

const TUTORIAL_STEPS = [
  {
    icon: "◈",
    title: "Bem-vinda ao ANTICEG!",
    text: "Aqui você acompanha todos os seus itens de compras em grupo (CEGs) em um só lugar — status, pagamentos e datas de vencimento."
  },
  {
    icon: "☰",
    title: "Sua Masterlist",
    text: "Cada card é um item de uma CEG. Toque na seta ▾ no canto inferior direito do card para expandir e ver o timeline completo de onde seu item está na jornada."
  },
  {
    icon: "◉",
    title: "Status do item",
    text: "Os chips coloridos mostram a etapa atual: Pré-venda → Na Warehouse → A Caminho → Enviado Nacional. Quanto mais à direita, mais perto de chegar!"
  },
  {
    icon: "R$",
    title: "Pagamentos",
    text: "Cada item mostra os valores separados: item, frete, taxa RF e nacional. Verde = Pago, Laranja = Pendente. O total fica branco quando tudo está pago."
  },
  {
    icon: "◈",
    title: "Aba CEGs",
    text: "Veja o resumo de todas as CEGs ativas. Use o filtro 'Minhas' para ver só aquelas em que você participa — seus cards ficam com borda roxa."
  },
];

function ProfileConfirmModal({ user, onSave, onSkip }) {
  const isNew = !user.nome || user.nome.trim() === "";
  const [nome, setNome] = useState(user.nome || "");
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || "");
  const [social, setSocial] = useState(user.twitter || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!nome.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true);
    await supabase.from("joiners").update({ nome: nome.trim(), whatsapp: whatsapp.trim() || null, twitter: social.trim() || null }).eq("id", user.id);
    const updated = { ...user, nome: nome.trim(), whatsapp: whatsapp.trim() || null, twitter: social.trim() || null };
    localStorage.setItem("anticeg_user", JSON.stringify(updated));
    localStorage.setItem("anticeg_perfil_ok", String(user.id));
    onSave(updated);
    setSaving(false);
  }

  function handleSkip() {
    localStorage.setItem("anticeg_perfil_ok", String(user.id));
    onSkip();
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:800, background:"rgba(0,0,0,.82)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:12, width:"100%", maxWidth:420, padding:28, display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.35)", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>
            {isNew ? "bem-vindx" : "seus dados"}
          </div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, lineHeight:1, color:"var(--offwhite)" }}>
            {isNew ? <>COMPLETE SEU <span style={{ color:"var(--laranja)" }}>PERFIL</span></> : <>CONFIRME SUAS <span style={{ color:"var(--laranja)" }}>INFORMAÇÕES</span></>}
          </div>
          <div style={{ fontSize:12, color:"rgba(245,240,232,.45)", marginTop:8, lineHeight:1.6 }}>
            {isNew
              ? "Preencha seus dados com as mesmas informações que você usa para dar claim no WhatsApp. Esses dados vinculam seus pedidos ao seu cadastro."
              : "Confira e atualize seus dados. Essas informações são usadas para vincular seus pedidos ao seu cadastro."}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <label style={{ fontSize:10, color:"rgba(245,240,232,.4)", letterSpacing:1.5, textTransform:"uppercase" }}>Seu nome *</label>
          <input className="login-input" type="text" placeholder="Como você aparece no grupo" value={nome} onChange={e => { setNome(e.target.value); setError(""); }} autoFocus />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <label style={{ fontSize:10, color:"rgba(245,240,232,.4)", letterSpacing:1.5, textTransform:"uppercase" }}>WhatsApp</label>
          <input className="login-input" type="tel" placeholder="(00) 00000-0000" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <label style={{ fontSize:10, color:"rgba(245,240,232,.4)", letterSpacing:1.5, textTransform:"uppercase" }}>Seu @ <span style={{ opacity:.4, fontSize:9 }}>(twitter / x / threads / insta)</span></label>
          <input className="login-input" type="text" placeholder="@seu_@" value={social} onChange={e => setSocial(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} />
        </div>
        {error && <div className="login-error">{error}</div>}
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          <button className="modal-confirm-btn" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : isNew ? "SALVAR →" : "CONFIRMAR →"}</button>
          <button className="modal-cancel-btn" onClick={handleSkip}>Depois</button>
        </div>
      </div>
    </div>
  );
}

function CalculadoraTab() {
  const CURRENCIES = [
    { id:"USD", sym:"$" }, { id:"PHP", sym:"₱" }, { id:"IDR", sym:"Rp" },
    { id:"KRW", sym:"₩" }, { id:"JPY", sym:"¥" },
  ];
  const [cur, setCur] = useState("USD");
  const [showRates, setShowRates] = useState(false);
  const [amount, setAmount] = useState("100");
  const [marginPct, setMarginPct] = useState("30");
  const [rates, setRates] = useState({
    USD:5.3700, PHP:0.0890, IDR:0.000310, KRW:0.004080, JPY:0.034000,
    WISE:6.5, SPREAD:4.0, IOF:3.5,
  });

  function setRate(k, v) { setRates(r => ({ ...r, [k]: parseFloat(v) || 0 })); }

  function fmtR(n) {
    if (n < 0.001) return n.toFixed(6);
    if (n < 0.01)  return n.toFixed(5);
    if (n < 1)     return n.toFixed(4);
    return n.toFixed(4);
  }
  function fmt(n, d=2) { return n.toLocaleString("pt-BR", { minimumFractionDigits:d, maximumFractionDigits:d }); }

  const a    = parseFloat(amount) || 0;
  const m    = (parseFloat(marginPct) || 0) / 100;
  const base = rates[cur] || 0;
  const wp   = rates.WISE   / 100;
  const sp   = rates.SPREAD / 100;
  const io   = rates.IOF    / 100;
  const wr   = base * (1 + wp);
  const cr   = base * (1 + sp) * (1 + io);

  let R = null;
  if (a > 0) {
    const wTotal   = a * wr;
    const cTotal   = a * cr;
    const baseT    = a * base;
    const wiseAmt  = baseT * wp;
    const spreadAmt= baseT * sp;
    const iofAmt   = baseT * (1 + sp) * io;
    const sW = wTotal * (1 + m);
    const lW = sW - wTotal;
    const sC = sW;
    const lC = sC - cTotal;
    R = { wTotal, cTotal, wiseAmt, spreadAmt, iofAmt, economia: cTotal - wTotal, sW, lW, sC, lC };
  }

  const INP = { className:"calc-big-input", type:"number" };

  return (
    <div className="calc-wrap">
      {/* HEADER */}
      <div className="calc-header">
        <div>
          <div className="calc-logo">Calculadora</div>
          <div className="calc-logo-sub">conversão de moeda · CEG</div>
        </div>
        <button className="calc-rates-btn" onClick={() => setShowRates(v => !v)}>✎ Editar Câmbio</button>
      </div>

      {/* RATES PANEL */}
      {showRates && (
        <div className="calc-rates-panel">
          {[["USD","USD / BRL"],["PHP","PHP / BRL"],["IDR","IDR / BRL"],["KRW","KRW / BRL"],["JPY","JPY / BRL"],
            ["WISE","Wise (+%)"],["SPREAD","Spread C.C. (%)"],["IOF","IOF (%)"]].map(([k, lbl]) => (
            <div key={k} className="calc-rate-field">
              <label>{lbl}</label>
              <input type="number" value={rates[k]} step={k==="USD"?"0.0001":k==="WISE"||k==="SPREAD"||k==="IOF"?"0.1":"0.000001"}
                onChange={e => setRate(k, e.target.value)} />
            </div>
          ))}
          <div className="calc-rates-note">💡 Altere quando a cotação mudar. Os campos abaixo atualizam automaticamente.</div>
        </div>
      )}

      <div className="calc-main">
        {/* CURRENCY TABS */}
        <div className="calc-section-label">Moeda</div>
        <div className="calc-cur-tabs">
          {CURRENCIES.map(c => (
            <button key={c.id} className={`calc-cur-tab ${cur === c.id ? "active" : ""}`} onClick={() => setCur(c.id)}>
              {c.id} {c.sym}
              <span className="calc-cur-rate">R$ {fmtR(rates[c.id] || 0)}</span>
            </button>
          ))}
        </div>

        {/* INPUTS */}
        <div className="calc-section-label">Entrada</div>
        <div className="calc-inputs-row">
          <div className="calc-field">
            <label>Valor em {cur}</label>
            <input {...INP} value={amount} onChange={e => setAmount(e.target.value)} />
            <span className="calc-hint">quanto você paga na origem</span>
          </div>
          <div className="calc-field">
            <label>Margem de lucro</label>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <input {...INP} value={marginPct} onChange={e => setMarginPct(e.target.value)} />
              <span className="calc-margin-sym">%</span>
            </div>
            <span className="calc-hint">preço de venda ao cliente</span>
          </div>
        </div>

        {/* RESULT CARDS */}
        <div className="calc-section-label">Resultado</div>
        <div className="calc-cards-row">
          {/* WISE */}
          <div className={`calc-card calc-wise ${R && R.wTotal <= R.cTotal ? "calc-best" : ""}`}>
            {R && R.wTotal <= R.cTotal && <div className="calc-badge">✓ mais barato</div>}
            <div className="calc-card-method">Wise / Pix</div>
            <div className="calc-card-cost-lbl">Custo</div>
            <div className="calc-card-cost-val"><span className="calc-cur-sym">R$</span>{R ? fmt(R.wTotal) : "—"}</div>
            <div className="calc-lines">
              <div className="calc-row"><span>câmbio</span><span>R$ {fmtR(base)}</span></div>
              <div className="calc-row"><span>taxa Wise +{rates.WISE}%</span><span>{R ? `+R$ ${fmt(R.wiseAmt)}` : "—"}</span></div>
              <div className="calc-row"><span>cotação efetiva</span><span>R$ {fmtR(wr)}</span></div>
            </div>
            <div className="calc-card-inner">
              <div className="calc-card-cost-lbl">Preço de Venda</div>
              <div className="calc-card-sale-val"><span className="calc-cur-sym">R$</span>{R ? fmt(R.sW) : "—"}</div>
              <div className="calc-lines">
                <div className="calc-row"><span>margem {Math.round(m*100)}%</span><span className="calc-green">{R ? `+R$ ${fmt(R.lW)}` : "—"}</span></div>
                <div className="calc-row"><span>lucro</span><span className="calc-green">{R ? `R$ ${fmt(R.lW)}` : "—"}</span></div>
              </div>
            </div>
          </div>

          {/* CARTÃO */}
          <div className={`calc-card calc-cc ${R && R.cTotal < R.wTotal ? "calc-best" : ""}`}>
            {R && R.cTotal < R.wTotal && <div className="calc-badge">✓ mais barato</div>}
            <div className="calc-card-method">Cartão de Crédito</div>
            <div className="calc-card-cost-lbl">Custo</div>
            <div className="calc-card-cost-val"><span className="calc-cur-sym">R$</span>{R ? fmt(R.cTotal) : "—"}</div>
            <div className="calc-lines">
              <div className="calc-row"><span>câmbio</span><span>R$ {fmtR(base)}</span></div>
              <div className="calc-row"><span>spread {rates.SPREAD}%</span><span>{R ? `+R$ ${fmt(R.spreadAmt)}` : "—"}</span></div>
              <div className="calc-row"><span>IOF {rates.IOF}%</span><span>{R ? `+R$ ${fmt(R.iofAmt)}` : "—"}</span></div>
              <div className="calc-row"><span>taxa efetiva</span><span>{R ? `+${fmt(((cr/base)-1)*100,2)}%` : "—"}</span></div>
            </div>
            <div className="calc-card-inner">
              <div className="calc-card-cost-lbl">Preço de Venda</div>
              <div className="calc-card-sale-val"><span className="calc-cur-sym">R$</span>{R ? fmt(R.sC) : "—"}</div>
              <div className="calc-lines">
                <div className="calc-row"><span>margem {Math.round(m*100)}%</span><span className="calc-green">{R ? `+R$ ${fmt(R.lW)}` : "—"}</span></div>
                <div className="calc-row"><span>lucro real</span>
                  <span className={R ? (R.lC >= 0 ? "calc-green" : "calc-red") : ""}>{R ? `R$ ${fmt(R.lC)}` : "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ECO STRIP */}
        <div className="calc-eco">
          <span className="calc-eco-lbl">economia Wise vs Cartão</span>
          <span className="calc-eco-val">{R ? (R.economia > 0 ? `R$ ${fmt(R.economia)} a menos` : "cartão mais barato") : "—"}</span>
          {R && <span className="calc-eco-iof">IOF pago: R$ {fmt(R.iofAmt)}</span>}
        </div>
      </div>
    </div>
  );
}

function TutorialModal({ onClose }) {
  const [step, setStep] = useState(0);
  const s = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  function fechar() {
    localStorage.setItem("anticeg_tutorial_v1", "1");
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal-box tutorial-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>{s.icon}</div>
        <div className="modal-title" style={{ marginBottom: 10 }}>{s.title}</div>
        <div style={{ fontSize: 13, color: "rgba(245,240,232,.7)", lineHeight: 1.6, marginBottom: 24 }}>{s.text}</div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {TUTORIAL_STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{
              width: i === step ? 20 : 6, height: 6, borderRadius: 3,
              background: i === step ? "var(--laranja)" : "rgba(245,240,232,.2)",
              cursor: "pointer", transition: "all .2s"
            }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 && (
            <button className="modal-cancel-btn" style={{ flex: 1 }} onClick={() => setStep(s => s - 1)}>← Anterior</button>
          )}
          {!isLast ? (
            <button className="modal-confirm-btn" style={{ flex: 2 }} onClick={() => setStep(s => s + 1)}>Próximo →</button>
          ) : (
            <button className="modal-confirm-btn" style={{ flex: 2 }} onClick={fechar}>Entendi! ✓</button>
          )}
        </div>
        <button className="login-skip" style={{ marginTop: 12 }} onClick={fechar}>Pular tutorial</button>
      </div>
    </div>
  );
}

function TutorialTab() {
  return (
    <div className="main">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">anticeg · guia de uso</div>
          <div className="page-title">TUTO<span>RIAL</span></div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {TUTORIAL_STEPS.map((s, i) => (
          <div key={i} style={{
            background: "var(--card-bg)", border: "1px solid rgba(245,240,232,.08)",
            borderRadius: 10, padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start"
          }}>
            <div style={{
              minWidth: 40, height: 40, borderRadius: 8, background: "rgba(255,90,31,.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "var(--laranja)", fontFamily: "'DM Mono', monospace", fontWeight: 700
            }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--offwhite)", marginBottom: 4, letterSpacing: 0.3 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "rgba(245,240,232,.6)", lineHeight: 1.7 }}>{s.text}</div>
            </div>
          </div>
        ))}
        <div style={{
          background: "rgba(255,90,31,.07)", border: "1px solid rgba(255,90,31,.2)",
          borderRadius: 10, padding: "18px 20px", textAlign: "center"
        }}>
          <div style={{ fontSize: 12, color: "rgba(245,240,232,.5)", marginBottom: 8 }}>Ficou com dúvidas?</div>
          <a href={`https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent("Oi Nanda! Tenho uma dúvida sobre o portal ANTICEG.")}`}
            target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--verde)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            💬 Falar com a Nanda no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("landing");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("anticeg_user")); } catch { return null; }
  });
  const [itens, setItens] = useState([]);
  const [tab, setTab] = useState("masterlist");
  const [showTutorial, setShowTutorial] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [manutencao, setManutencao] = useState(false);
  const [bypassManutencao, setBypassManutencao] = useState(
    () => localStorage.getItem("anticeg_admin_bypass") === "1"
  );
  const [adminPortalInput, setAdminPortalInput] = useState("");
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [showPerfilModal, setShowPerfilModal] = useState(false);
  const [perfilPushAtivo, setPerfilPushAtivo] = useState(true);

  useEffect(() => {
    supabase.from("config").select("value").eq("key", "manutencao").single()
      .then(({ data }) => { if (data) setManutencao(data.value === "true"); });
    supabase.from("config").select("value").eq("key", "perfil_push_ativo").single()
      .then(({ data }) => { if (data) setPerfilPushAtivo(data.value !== "false"); });
  }, []);

  function handleAdminBypass() {
    if (adminPortalInput === user?.senha || user?.email === ADMIN_EMAIL) {
      localStorage.setItem("anticeg_admin_bypass", "1");
      setBypassManutencao(true);
      setShowAdminPortal(false);
    }
  }

  async function updateLastSeen(u) {
    if (!u || u.guest || !u.cog) return;
    await supabase.from("joiners").update({ last_seen: new Date().toISOString() }).eq("cog", u.cog);
  }

  async function fetchOnlineUsers() {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await supabase.from("joiners").select("cog, nome, foto_perfil").gte("last_seen", since);
    setOnlineUsers(data || []);
  }

  useEffect(() => {
    if (user && !user.guest) {
      updateLastSeen(user);
      fetchOnlineUsers();
      const iv = setInterval(() => { updateLastSeen(user); fetchOnlineUsers(); }, 5 * 60 * 1000);
      return () => clearInterval(iv);
    }
  }, [user]);

  // Se já tem sessão salva, vai direto pro portal
  useEffect(() => {
    if (user) setPage("portal");
  }, []);

  async function handleLogin(u, itensData) {
    localStorage.setItem("anticeg_user", JSON.stringify(u));
    setUser(u);
    setItens(itensData);
    setPage("portal");
    if (!u.guest) {
      if (!localStorage.getItem("anticeg_tutorial_v1")) setShowTutorial(true);
      const jaConfirmou = localStorage.getItem("anticeg_perfil_ok") === String(u.id);
      if (!jaConfirmou) {
        // lê push do config em tempo real para pegar o valor atualizado
        const { data } = await supabase.from("config").select("value").eq("key", "perfil_push_ativo").single();
        const pushOn = !data || data.value !== "false";
        if (pushOn) setShowPerfilModal(true);
      }
    }
  }

  function handleLogout() {
    localStorage.removeItem("anticeg_user");
    setUser(null);
    setItens([]);
    setTab("masterlist");
    setPage("landing");
  }

  useEffect(() => {
    if (user && user.cog) {
      supabase.from("masterlist").select("*").eq("cog", user.cog).then(({ data }) => {
        setItens(data || []);
      });
    } else if (user && user.guest) {
      supabase.from("masterlist").select("*").neq("nome", "Disponivel").limit(30).then(({ data }) => {
        setItens(data || []);
      });
    }
  }, []);

  if (page === "landing") return <LandingPage onLogin={handleLogin} onEntrar={() => setPage("login")} />;
  if (page === "login" || !user) return <LoginScreen onLogin={handleLogin} onVoltar={() => setPage("landing")} />;

  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <div>
      {manutencao && !bypassManutencao && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "#0D0D0D",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24
        }}>
          <div style={{ textAlign: "center", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2 }}>
              ANTI<span style={{ color: "var(--laranja)" }}>CEG</span>
            </div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(48px, 8vw, 80px)", lineHeight: 1 }}>
              EM MANUTENÇÃO
            </div>
            <div style={{ fontSize: 13, color: "rgba(245,240,232,.5)", lineHeight: 1.6 }}>
              O site vai voltar em breve! Estamos atualizando os dados e corrigindo alguns bugs para melhorar sua experiência.
            </div>
            <a href="https://docs.google.com/spreadsheets/d/1iVi-DUq2glx5moyba5zuJktt45a9sYW5LoQXd4vkcHM"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--laranja)", color: "#0D0D0D",
                fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600,
                padding: "14px 28px", borderRadius: 6, textDecoration: "none", letterSpacing: 1
              }}>
              📊 Acessar Planilha
            </a>
            <div style={{ fontSize: 10, color: "rgba(245,240,232,.2)", letterSpacing: 2, textTransform: "uppercase" }}>
              anticeg · masterlist
            </div>
            {isAdmin && (
              <button onClick={() => { localStorage.setItem("anticeg_admin_bypass", "1"); setBypassManutencao(true); }}
                style={{
                  marginTop: 8, background: "transparent",
                  border: "1px solid rgba(245,240,232,.15)",
                  color: "rgba(245,240,232,.4)",
                  fontFamily: "'DM Mono',monospace", fontSize: 11,
                  padding: "10px 20px", borderRadius: 6, cursor: "pointer",
                  letterSpacing: 1
                }}>
                ⚙ ENTRAR NOS BASTIDORES
              </button>
            )}
          </div>
        </div>
      )}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showPerfilModal && !user.guest && (
        <ProfileConfirmModal
          user={user}
          onSave={updated => { setUser(updated); setShowPerfilModal(false); localStorage.setItem("anticeg_perfil_ok", String(updated.id)); localStorage.setItem("anticeg_user", JSON.stringify(updated)); }}
          onSkip={() => { setShowPerfilModal(false); localStorage.setItem("anticeg_perfil_ok", String(user.id)); }}
        />
      )}
      <div className="topbar">
        <a className="topbar-logo" href="#">ANTI<span>CEG</span></a>
        <div className="topbar-right">
          {onlineUsers.length > 0 && (
            <div className="online-avatars">
              {onlineUsers.slice(0, 6).map(u => (
                <div key={u.cog} className="online-avatar" title={u.nome || u.cog}>
                  <img src={u.foto_perfil || bonequinha} alt={u.cog} />
                  <div className="online-dot" />
                </div>
              ))}
              {onlineUsers.length > 6 && (
                <div className="online-avatar-more">+{onlineUsers.length - 6}</div>
              )}
            </div>
          )}
          <div className="topbar-user">
            <div className="user-dot" />
            <span className="user-email">{user.email || `COG ${user.cog}`}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Sair ↗</button>
        </div>
      </div>
      <div className="tabs-bar">
        <button className={`tab-btn ${tab === "masterlist" ? "active" : ""}`} onClick={() => setTab("masterlist")}>☰ Masterlist</button>
        <button className={`tab-btn ${tab === "cegs" ? "active" : ""}`} onClick={() => setTab("cegs")}>◈ CEGs</button>
        <button className={`tab-btn ${tab === "calendario" ? "active" : ""}`} onClick={() => setTab("calendario")}>◫ Calendário</button>
        {!user.guest && <button className={`tab-btn ${tab === "perfil" ? "active" : ""}`} onClick={() => setTab("perfil")}>⚙ Meu Perfil</button>}
        <button className={`tab-btn ${tab === "regras" ? "active" : ""}`} onClick={() => setTab("regras")}>☆ Regras</button>
        {!user.guest && <button className={`tab-btn ${tab === "feedback" ? "active" : ""}`} onClick={() => setTab("feedback")}>✉ Feedback</button>}
        <button className={`tab-btn ${tab === "tutorial" ? "active" : ""}`} onClick={() => setTab("tutorial")}>? Tutorial</button>
        <button className={`tab-btn ${tab === "calculadora" ? "active" : ""}`} onClick={() => setTab("calculadora")}>$ Calc</button>
        {user.email === ADMIN_EMAIL && (
          <button className={`tab-btn ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>⚙ Admin</button>
        )}
      </div>
      {tab === "masterlist" && <MasterlistTab user={user} itens={itens} onLogin={handleLogout} />}
      {tab === "cegs" && <CegTab user={user} itens={itens} />}
      {tab === "calendario" && <CalendarTab user={user} itens={itens} />}
      {!user.guest && tab === "perfil" && <PerfilTab user={user} onUpdate={setUser} />}
      {tab === "regras" && <RegrasTab />}
      {!user.guest && tab === "feedback" && <FeedbackTab user={user} />}
      {tab === "tutorial" && <TutorialTab />}
      {tab === "calculadora" && <CalculadoraTab />}
      {tab === "admin" && user.email === ADMIN_EMAIL && <AdminTab />}
    </div>
  );
}