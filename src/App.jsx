import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";
import LandingPage from "./LandingPage";

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
function isPendente(val) { return val && val !== "Pago"; }

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

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("escolha");
  const [input, setInput] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    const { data: existe } = await supabase.from("usuarios").select("id").eq("email", email.trim().toLowerCase()).single();
    if (existe) { setError("E-mail já cadastrado."); setLoading(false); return; }
    const novoUsuario = { nome: nome.trim(), twitter: twitter.trim(), whatsapp: whatsapp.trim(), estado, email: email.trim().toLowerCase(), senha };
    const { error: err } = await supabase.from("usuarios").insert([novoUsuario]);
    if (err) { setError("Erro ao cadastrar."); setLoading(false); return; }
    onLogin(novoUsuario, []);
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
        <input className="login-input" type="text" placeholder="Ex: Morri7 ou seuemail@email.com" value={input}
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
        <button className="login-skip" onClick={() => { setMode("cog"); setError(""); setSenha(""); }}>← Voltar</button>
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
        <SumCard label="Valor total" value={0} valueCls="orange" sub="item + frete + taxa" isAmount={true} />
        <SumCard label="Pago" value={0} valueCls="green" sub="confirmado" isAmount={true} />
        <SumCard label="Pendente" value={0} valueCls="lilas" sub="em aberto" isAmount={true} />
        <div className="sum-card">
          <div className="sum-label">Próx. vencimento</div>
          <div className="sum-value yellow">{!guest && nextVenc ? `${String(nextVenc.d.getDate()).padStart(2,"0")}/${String(nextVenc.d.getMonth()+1).padStart(2,"0")}` : "—"}</div>
          <div className="sum-sub">{!guest && nextVenc ? nextVenc.label : "nenhum pendente"}</div>
        </div>
      </div>

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

    if (user.cog) {
      const { error: err } = await supabase.from("joiners").update(updates).eq("cog", user.cog);
      if (err) { setError("Erro ao salvar."); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from("usuarios").update(updates).eq("email", user.email);
      if (err) { setError("Erro ao salvar."); setLoading(false); return; }
    }

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

function AntiStoreTab({ user }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroMembro, setFiltroMembro] = useState("todos");
  const [ordenacao, setOrdenacao] = useState("padrao");

  useEffect(() => {
    supabase.from("masterlist").select("*").eq("nome", "Disponivel").neq("status", "Vendido").then(({ data }) => {
      setItens(data || []);
      setLoading(false);
    });
  }, []);

  const MEMBROS_MAP = [
    { canonical: "Bang Chan",  keys: ["bangchan","bangcahn","bang chan","bang"] },
    { canonical: "Changbin",   keys: ["changbin","chang bin","changbhin","changbim"] },
    { canonical: "Hyunjin",    keys: ["hyunjin","hyun jin","hyunjim","hyunijn"] },
    { canonical: "Han",        keys: ["han"] },
    { canonical: "Felix",      keys: ["felix","félix","feliz","feliix"] },
    { canonical: "Seungmin",   keys: ["seungmin","seung min","seungmim"] },
    { canonical: "I.N.",       keys: ["i.n.","i.n","in","i n","jeongin"] },
    { canonical: "Lee Know",   keys: ["leeknow","lee know","lee","minho"] },
    { canonical: "RM",         keys: ["rm"] },
    { canonical: "Jin",        keys: ["jin"] },
    { canonical: "Suga",       keys: ["suga","yoongi"] },
    { canonical: "J-Hope",     keys: ["jhope","j-hope","j hope","hoseok"] },
    { canonical: "Jimin",      keys: ["jimin"] },
    { canonical: "V",          keys: ["v","taehyung"] },
    { canonical: "Jungkook",   keys: ["jungkook","jk"] },
  ];

  function normStr(s) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s.]/g, "");
  }

  function getMembro(nome_do_item) {
    if (!nome_do_item) return "outros";
    const norm = normStr(nome_do_item);
    for (const { canonical, keys } of MEMBROS_MAP) {
      if (keys.some(k => norm.startsWith(normStr(k)))) return canonical;
    }
    // fallback: primeira palavra
    return nome_do_item.trim().split(/\s+/)[0];
  }

  const membros = ["todos", ...Array.from(new Set(itens.map(i => getMembro(i.nome_do_item)))).sort()];

  function getTotal(item) {
    return Number(item.valor_item||0) + Number(item.frete_inter||0) + Number(item.taxa_rf||0) + Number(item.nacional||0);
  }

  const itensFiltrados = itens
    .filter(i => filtroMembro === "todos" || getMembro(i.nome_do_item) === filtroMembro)
    .sort((a, b) => ordenacao === "preco" ? getTotal(a) - getTotal(b) : 0);

  function claimMsg(item) {
    const total = getTotal(item);
    const msg = `Olá Nanda! Quero dar claim no item: *${item.nome_do_item}* — R$ ${fmtBRL(total)}\nMeu COG: ${user.cog || user.nome || user.email}`;
    return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">anticeg · repasses</div>
          <div className="page-title">ANTI<span>STORE</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="greeting-sub" style={{ marginTop: 8 }}>{itensFiltrados.length} {itensFiltrados.length === 1 ? "item disponível" : "itens disponíveis"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select className="store-filter-select" value={filtroMembro} onChange={e => setFiltroMembro(e.target.value)}>
          {membros.map(m => <option key={m} value={m}>{m === "todos" ? "todos os membros" : m}</option>)}
        </select>
        <select className="store-filter-select" value={ordenacao} onChange={e => setOrdenacao(e.target.value)}>
          <option value="padrao">ordem padrão</option>
          <option value="preco">mais barato primeiro</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "rgba(245,240,232,.3)", fontSize: "var(--fs-xs)" }}>carregando...</div>
      ) : itensFiltrados.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "rgba(245,240,232,.3)", fontSize: "var(--fs-xs)" }}>nenhum item disponível no momento</div>
      ) : (
        <div className="store-grid">
          {itensFiltrados.map(item => (
            <div key={item.id} className="store-card">
              <div className="store-card-img">
                {item.cog
                  ? <img src={item.cog} alt={item.nome_do_item} />
                  : <div className="store-no-img">sem foto</div>
                }
              </div>
              <div className="store-card-body">
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:6 }}>
                  <div className="store-card-name">{item.nome_do_item}</div>
                  {item.status && <StatusChip status={item.status} />}
                </div>
                {item.info_adicionais && <div className="store-card-desc">{item.info_adicionais}</div>}
                <div className="store-card-meta">
                  <span className="store-card-cog">CEG {item.ceg || "—"}</span>
                  <span className="store-card-valor">R$ {fmtBRL(Number(item.valor_item||0) + Number(item.frete_inter||0) + Number(item.taxa_rf||0) + Number(item.nacional||0))}</span>
                </div>
                {item.status !== "Vendido" && (
                  <a href={claimMsg(item)} target="_blank" rel="noopener noreferrer" className="store-claim-btn">
                    ⚡ DAR CLAIM
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function usePhotoUpload() {
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState("");
  function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFoto(file); setPreview(URL.createObjectURL(file));
  }
  async function upload() {
    if (!foto) return null;
    const ext = foto.name.split(".").pop();
    const path = `itens/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("anti-store").upload(path, foto, { upsert: true });
    if (error) throw new Error(error.message);
    return supabase.storage.from("anti-store").getPublicUrl(path).data.publicUrl;
  }
  function reset() { setFoto(null); setPreview(""); }
  return { foto, preview, onFile, upload, reset };
}

function AdminItemRow({ item, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    nome_do_item: item.nome_do_item || "",
    ceg: item.ceg || "",
    valor_item: item.valor_item || "",
    frete_inter: item.frete_inter || "",
    taxa_rf: item.taxa_rf || "",
    nacional: item.nacional || "",
    info_adicionais: item.info_adicionais || "",
  });
  const photo = usePhotoUpload();

  async function handleSave() {
    setSaving(true);
    let fotoUrl = item.cog || "";
    if (photo.foto) {
      try { fotoUrl = await photo.upload(); } catch (e) { alert("Erro no upload: " + e.message); setSaving(false); return; }
    }
    await supabase.from("masterlist").update({
      cog: fotoUrl,
      nome_do_item: editForm.nome_do_item,
      ceg: editForm.ceg,
      valor_item: parseFloat(editForm.valor_item) || 0,
      frete_inter: parseFloat(editForm.frete_inter) || 0,
      taxa_rf: parseFloat(editForm.taxa_rf) || 0,
      nacional: parseFloat(editForm.nacional) || 0,
      info_adicionais: editForm.info_adicionais,
    }).eq("id", item.id);
    setSaving(false);
    setOpen(false);
    photo.reset();
    onRefresh();
  }

  async function toggleStatus() {
    const next = item.status === "Disponível" ? "Vendido" : "Disponível";
    await supabase.from("masterlist").update({ status: next }).eq("id", item.id);
    onRefresh();
  }

  async function handleDelete() {
    if (!confirm("Remover este item da loja?")) return;
    await supabase.from("masterlist").delete().eq("id", item.id);
    onRefresh();
  }

  const inp = { className: "admin-input" };
  const fotoAtual = photo.preview || item.cog;
  const total = Number(item.valor_item||0) + Number(item.frete_inter||0) + Number(item.taxa_rf||0) + Number(item.nacional||0);

  return (
    <div className={`admin-item-wrap ${open ? "open" : ""}`}>
      <div className="admin-item" onClick={() => setOpen(o => !o)} style={{ cursor:"pointer" }}>
        {item.cog
          ? <img src={item.cog} alt="" className="admin-item-img" />
          : <div className="admin-item-img-empty">+foto</div>
        }
        <div className="admin-item-info">
          <div className="admin-item-name">{item.nome_do_item}</div>
          <div className="admin-item-ceg">{item.ceg || "—"} · R$ {fmtBRL(total)}</div>
        </div>
        <div className="admin-item-actions" onClick={e => e.stopPropagation()}>
          <button className={`admin-toggle ${item.status === "Vendido" ? "vendido" : "disp"}`} onClick={toggleStatus}>
            {item.status === "Vendido" ? "Vendido" : "Disponível"}
          </button>
          <button className="admin-del-btn" onClick={handleDelete}>✕</button>
        </div>
      </div>

      {open && (
        <div className="admin-edit-form">
          <div className="admin-foto-row">
            <label className="admin-foto-label">
              {fotoAtual
                ? <img src={fotoAtual} alt="preview" className="admin-foto-preview" />
                : <div className="admin-foto-placeholder">+ foto</div>
              }
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={photo.onFile} />
            </label>
            <div className="admin-form-fields">
              <input {...inp} placeholder="Nome do item *" value={editForm.nome_do_item} onChange={e => setEditForm(f => ({ ...f, nome_do_item: e.target.value }))} />
              <input {...inp} placeholder="CEG (ex: DOME JP☆)" value={editForm.ceg} onChange={e => setEditForm(f => ({ ...f, ceg: e.target.value }))} />
              <div className="admin-money-row">
                <input {...inp} placeholder="Valor item" type="number" step="0.01" value={editForm.valor_item} onChange={e => setEditForm(f => ({ ...f, valor_item: e.target.value }))} />
                <input {...inp} placeholder="Frete inter." type="number" step="0.01" value={editForm.frete_inter} onChange={e => setEditForm(f => ({ ...f, frete_inter: e.target.value }))} />
                <input {...inp} placeholder="Taxa RF" type="number" step="0.01" value={editForm.taxa_rf} onChange={e => setEditForm(f => ({ ...f, taxa_rf: e.target.value }))} />
                <input {...inp} placeholder="Nacional" type="number" step="0.01" value={editForm.nacional} onChange={e => setEditForm(f => ({ ...f, nacional: e.target.value }))} />
              </div>
              <input {...inp} placeholder="Descrição / info adicionais" value={editForm.info_adicionais} onChange={e => setEditForm(f => ({ ...f, info_adicionais: e.target.value }))} />
            </div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <button className="admin-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button className="admin-cancel-btn" onClick={() => { setOpen(false); photo.reset(); }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminTab() {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    nome_do_item: "", ceg: "", valor_item: "", frete_inter: "",
    taxa_rf: "", nacional: "", info_adicionais: "",
  });
  const photo = usePhotoUpload();

  function fetchItens() {
    supabase.from("masterlist").select("*").eq("nome", "Disponivel")
      .order("id", { ascending: false })
      .then(({ data }) => { setItens(data || []); setLoading(false); });
  }

  useEffect(() => { fetchItens(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.nome_do_item) { setMsg("Nome do item é obrigatório."); return; }
    setSaving(true); setMsg("");
    let fotoUrl = "";
    if (photo.foto) {
      try { fotoUrl = await photo.upload(); } catch (err) { setMsg("⚠ Foto não enviada (verifique permissões do storage), salvando sem foto."); }
    }
    const { error } = await supabase.from("masterlist").insert({
      nome: "Disponivel", cog: fotoUrl,
      nome_do_item: form.nome_do_item, ceg: form.ceg,
      valor_item: parseFloat(form.valor_item) || 0,
      frete_inter: parseFloat(form.frete_inter) || 0,
      taxa_rf: parseFloat(form.taxa_rf) || 0,
      nacional: parseFloat(form.nacional) || 0,
      info_adicionais: form.info_adicionais,
      status: "Disponível",
    });
    setSaving(false);
    if (error) { setMsg("Erro: " + error.message); return; }
    setMsg("✓ Item adicionado!");
    setForm({ nome_do_item: "", ceg: "", valor_item: "", frete_inter: "", taxa_rf: "", nacional: "", info_adicionais: "" });
    photo.reset();
    fetchItens();
  }

  const inp = { className: "admin-input" };

  return (
    <div className="admin-wrap">
      <h2 className="admin-title">⚙ Admin — Anti-Store</h2>

      <form className="admin-form" onSubmit={handleAdd}>
        <div className="admin-form-section-label">Novo item</div>
        <div className="admin-foto-row">
          <label className="admin-foto-label">
            {photo.preview
              ? <img src={photo.preview} alt="preview" className="admin-foto-preview" />
              : <div className="admin-foto-placeholder">+ foto</div>
            }
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={photo.onFile} />
          </label>
          <div className="admin-form-fields">
            <input {...inp} placeholder="Nome do item *" value={form.nome_do_item} onChange={e => setForm(f => ({ ...f, nome_do_item: e.target.value }))} />
            <input {...inp} placeholder="CEG (ex: DOME JP☆)" value={form.ceg} onChange={e => setForm(f => ({ ...f, ceg: e.target.value }))} />
            <div className="admin-money-row">
              <input {...inp} placeholder="Valor item" type="number" step="0.01" value={form.valor_item} onChange={e => setForm(f => ({ ...f, valor_item: e.target.value }))} />
              <input {...inp} placeholder="Frete inter." type="number" step="0.01" value={form.frete_inter} onChange={e => setForm(f => ({ ...f, frete_inter: e.target.value }))} />
              <input {...inp} placeholder="Taxa RF" type="number" step="0.01" value={form.taxa_rf} onChange={e => setForm(f => ({ ...f, taxa_rf: e.target.value }))} />
              <input {...inp} placeholder="Nacional" type="number" step="0.01" value={form.nacional} onChange={e => setForm(f => ({ ...f, nacional: e.target.value }))} />
            </div>
            <input {...inp} placeholder="Descrição / info adicionais" value={form.info_adicionais} onChange={e => setForm(f => ({ ...f, info_adicionais: e.target.value }))} />
          </div>
        </div>
        {msg && <div className="admin-msg">{msg}</div>}
        <button type="submit" className="admin-save-btn" disabled={saving}>
          {saving ? "Salvando..." : "+ Adicionar item"}
        </button>
      </form>

      <div className="admin-list-title">Itens na loja ({itens.length}) — clique para editar</div>
      {loading ? (
        <div className="admin-loading">carregando...</div>
      ) : itens.length === 0 ? (
        <div className="admin-loading">nenhum item ainda</div>
      ) : (
        <div className="admin-list">
          {itens.map(item => <AdminItemRow key={item.id} item={item} onRefresh={fetchItens} />)}
        </div>
      )}
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

  // Se já tem sessão salva, vai direto pro portal
  useEffect(() => {
    if (user) setPage("portal");
  }, []);

  async function handleLogin(u, itensData) {
    localStorage.setItem("anticeg_user", JSON.stringify(u));
    setUser(u);
    setItens(itensData);
    setPage("portal");
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

  if (page === "landing") return <LandingPage onEntrar={() => setPage("login")} />;
  if (page === "login" || !user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div>
      <div className="topbar">
        <a className="topbar-logo" href="#">ANTI<span>CEG</span></a>
        <div className="topbar-right">
          <div className="topbar-user">
            <div className="user-dot" />
            <span className="user-email">{user.email || `COG ${user.cog}`}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Sair ↗</button>
        </div>
      </div>
      <div className="tabs-bar">
        <button className={`tab-btn ${tab === "masterlist" ? "active" : ""}`} onClick={() => setTab("masterlist")}>☰ Masterlist</button>
        <button className={`tab-btn ${tab === "calendario" ? "active" : ""}`} onClick={() => setTab("calendario")}>◫ Calendário</button>
        {!user.guest && <button className={`tab-btn ${tab === "perfil" ? "active" : ""}`} onClick={() => setTab("perfil")}>⚙ Meu Perfil</button>}
        <button className={`tab-btn ${tab === "regras" ? "active" : ""}`} onClick={() => setTab("regras")}>☆ Regras</button>
        <button className={`tab-btn ${tab === "store" ? "active" : ""}`} onClick={() => setTab("store")}>🛍 Anti-Store</button>
        {user.email === ADMIN_EMAIL && (
          <button className={`tab-btn ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>⚙ Admin</button>
        )}
      </div>
      {tab === "masterlist" && <MasterlistTab user={user} itens={itens} onLogin={handleLogout} />}
      {tab === "calendario" && <CalendarTab user={user} itens={itens} />}
      {!user.guest && tab === "perfil" && <PerfilTab user={user} onUpdate={setUser} />}
      {tab === "regras" && <RegrasTab />}
      {tab === "store" && <AntiStoreTab user={user} />}
      {tab === "admin" && user.email === ADMIN_EMAIL && <AdminTab />}
    </div>
  );
}