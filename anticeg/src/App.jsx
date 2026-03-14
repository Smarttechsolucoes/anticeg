import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const supabase = createClient(
  "https://ghjfsmwwcfpfvrouyrka.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM"
);

const FORMS_URL = "https://forms.gle/vMyjCKG4Dj2yhryP7";
const WHATSAPP_NUM = "5524992501917";

function fmtBRL(val, hidden) {
  if (hidden) return "••••";
  return Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function whatsappMsg(item) {
  const total = Number(item.item_val) + Number(item.frete_inter) + Number(item.taxa_rf || 0) + Number(item.nacional || 0);
  const msg = `Olá! Quero pagar no cartão de crédito. Vou te mandar as informações:\nValor: R$ ${fmtBRL(total)}\nParcelas: até x12 com juros`;
  return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`;
}

const STATUS_STEPS = [
  { id: "prevenda",  label: "Pré-venda",       icon: "🛒" },
  { id: "warehouse", label: "Na Warehouse",     icon: "📦" },
  { id: "caminho",   label: "A Caminho",        icon: "✈️"  },
  { id: "taxa",      label: "Taxa Liberada",    icon: "✅" },
  { id: "aqui",      label: "Chegou Aqui",      icon: "🏠" },
  { id: "nacional",  label: "Envio Liberado",   icon: "📬" },
  { id: "enviado",   label: "Enviado Nacional", icon: "🚚" },
];

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const chipMap = {
  prevenda:  ["chip-prevenda",  "Pré-venda"],
  warehouse: ["chip-warehouse", "Na Warehouse"],
  caminho:   ["chip-caminho",   "A Caminho"],
  taxa:      ["chip-taxa",      "Taxa Liberada"],
  aqui:      ["chip-aqui",      "Chegou Aqui"],
  nacional:  ["chip-nacional",  "Envio Liberado"],
  enviado:   ["chip-enviado",   "Enviado Nacional"],
};

function getStepIdx(id) { return STATUS_STEPS.findIndex((s) => s.id === id); }

function PayBadge({ status }) {
  if (status === "pago")     return <span className="pay-badge pay-pago">Pago</span>;
  if (status === "pendente") return <span className="pay-badge pay-pendente">Pend.</span>;
  if (status === "parcial")  return <span className="pay-badge pay-parcial">Parcial</span>;
  return null;
}

function StatusChip({ status }) {
  const [cls, label] = chipMap[status] || ["", ""];
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

function Timeline({ item, activeIdx }) {
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
  const cls = status === "pago" ? "pago" : status === "pendente" ? "pend" : "zero";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className={`td-val ${cls}`}>R${fmtBRL(val)}</span>
      <PayBadge status={status} />
    </div>
  );
}

function SumCard({ label, value, valueCls, sub, showEye }) {
  const [hidden, setHidden] = useState(false);
  return (
    <div className="sum-card">
      <div className="sum-label">{label}</div>
      <div className={`sum-value ${valueCls}`} style={{ display:"flex", alignItems:"center", gap:8 }}>
        {showEye ? `R$${fmtBRL(value, hidden)}` : value}
        {showEye && (
          <button onClick={() => setHidden(!hidden)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, opacity:0.4, padding:0, lineHeight:1 }}>
            {hidden ? "👁️" : "🙈"}
          </button>
        )}
      </div>
      <div className="sum-sub">{sub}</div>
    </div>
  );
}

function PayButtons({ item }) {
  const temPendente = item.pag_item === "pendente" || item.pag_frete === "pendente" || item.pag_taxa === "pendente" || item.pag_nacional === "pendente";
  if (!temPendente) return null;
  return (
    <div style={{ display:"flex", gap:6, marginTop:6 }}>
      <a href={FORMS_URL} target="_blank" rel="noopener noreferrer" className="pay-btn pay-btn-pix">
        💸 PIX
      </a>
      <a href={whatsappMsg(item)} target="_blank" rel="noopener noreferrer" className="pay-btn pay-btn-card">
        💳 Cartão
      </a>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [input, setInput] = useState("");
  const [stage, setStage] = useState("login");
  const [email, setEmail] = useState("");
  const [antijoiner, setAntijoiner] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError("");
    const val = input.trim().toLowerCase();
    let { data } = await supabase.from("antijoiners").select("*").eq("email", val).single();
    if (!data) {
      const res = await supabase.from("antijoiners").select("*").eq("cog", input.trim()).single();
      data = res.data;
    }
    setLoading(false);
    if (!data) { setError("COG ou e-mail não encontrado. Confirma com a antigom o seu COG."); return; }
    if (!data.email) { setAntijoiner(data); setStage("cadastro_email"); return; }
    buscarItens(data);
  }

  async function handleCadastroEmail() {
    setLoading(true);
    setError("");
    const emailLimpo = email.trim().toLowerCase();
    if (!emailLimpo.includes("@")) { setError("E-mail inválido."); setLoading(false); return; }
    const { error: err } = await supabase.from("antijoiners").update({ email: emailLimpo }).eq("cog", antijoiner.cog);
    if (err) { setError("Esse e-mail já está em uso."); setLoading(false); return; }
    buscarItens({ ...antijoiner, email: emailLimpo });
    setLoading(false);
  }

  async function buscarItens(aj) {
    const { data: itens } = await supabase.from("itens").select("*").eq("cog", aj.cog);
    onLogin(aj, itens || []);
  }

  if (stage === "cadastro_email") {
    return (
      <div className="login-screen">
        <div className="login-wrap">
          <div className="login-eyebrow">masterlist · cadastro de e-mail</div>
          <div className="login-title">OI, <span className="lo">{antijoiner.nome || antijoiner.cog}</span>!</div>
          <div className="login-box">
            <label className="login-label">Cadastra um e-mail pra acessar mais fácil depois</label>
            <input className="login-input" type="email" placeholder="seuemail@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCadastroEmail()} />
            <button className="login-btn" onClick={handleCadastroEmail} disabled={loading}>
              {loading ? "SALVANDO..." : "SALVAR E ENTRAR →"}
            </button>
            <button className="login-skip" onClick={() => buscarItens(antijoiner)}>Pular por agora</button>
            {error && <div className="login-error">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-eyebrow">masterlist · acesso por COG</div>
        <div className="login-title">
          ANTI<span className="lo">CEG</span><br /><span className="lg">MASTER</span><br />LIST
        </div>
        <div className="login-box">
          <label className="login-label">Seu COG ou e-mail cadastrado</label>
          <input className="login-input" type="text" placeholder="COG ou seuemail@email.com" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{ borderColor: error ? "var(--laranja)" : "" }} />
          <button className="login-btn" onClick={handleLogin} disabled={loading}>
            {loading ? "BUSCANDO..." : "ACESSAR →"}
          </button>
          {error && <div className="login-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}

function MasterlistTab({ user, itens }) {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [openDrawer, setOpenDrawer] = useState(null);

  const totalV = itens.reduce((a, b) => a + Number(b.item_val) + Number(b.frete_inter) + Number(b.taxa_rf || 0) + Number(b.nacional || 0), 0);
  const pagoV  = itens.filter(i => i.pag_item === "pago").reduce((a,b)=>a+Number(b.item_val),0)
               + itens.filter(i => i.pag_frete === "pago").reduce((a,b)=>a+Number(b.frete_inter),0)
               + itens.filter(i => i.pag_taxa === "pago").reduce((a,b)=>a+Number(b.taxa_rf||0),0)
               + itens.filter(i => i.pag_nacional === "pago").reduce((a,b)=>a+Number(b.nacional||0),0);
  const pendV  = totalV - pagoV;
  const cegs   = [...new Set(itens.map(i => i.ceg))].length;

  const today = new Date(); today.setHours(0,0,0,0);
  const vencDates = [];
  itens.forEach(i => {
    if (i.venc_item && i.pag_item !== "pago") vencDates.push({ d: new Date(i.venc_item), label: "Item: " + i.nome_item.split(" ")[0] });
    if (i.venc_frete && i.pag_frete !== "pago") vencDates.push({ d: new Date(i.venc_frete), label: "Frete: " + i.nome_item.split(" ")[0] });
    if (i.venc_taxa && i.pag_taxa === "pendente") vencDates.push({ d: new Date(i.venc_taxa), label: "Taxa: " + i.nome_item.split(" ")[0] });
    if (i.venc_nacional && i.pag_nacional === "pendente") vencDates.push({ d: new Date(i.venc_nacional), label: "Nacional: " + i.nome_item.split(" ")[0] });
  });
  const future = vencDates.filter(v => v.d >= today).sort((a,b) => a.d - b.d);
  const nextVenc = future[0];

  let filtered = [...itens];
  if (filter === "pendente") filtered = filtered.filter(i => i.pag_item === "pendente" || i.pag_frete === "pendente" || i.pag_taxa === "pendente" || i.pag_nacional === "pendente");
  else if (filter === "pago") filtered = filtered.filter(i => i.pag_item === "pago" && i.pag_frete === "pago");
  else if (filter === "transito") filtered = filtered.filter(i => ["warehouse","caminho","taxa","aqui","nacional"].includes(i.status));
  else if (filter === "entregue") filtered = filtered.filter(i => i.ceg_filter === "entregue");
  if (search) filtered = filtered.filter(i => i.nome_item.toLowerCase().includes(search));

  const tPend = filtered.filter(i=>i.pag_item==="pendente").reduce((a,b)=>a+Number(b.item_val),0)
              + filtered.filter(i=>i.pag_frete==="pendente").reduce((a,b)=>a+Number(b.frete_inter),0)
              + filtered.filter(i=>i.pag_taxa==="pendente").reduce((a,b)=>a+Number(b.taxa_rf||0),0)
              + filtered.filter(i=>i.pag_nacional==="pendente").reduce((a,b)=>a+Number(b.nacional||0),0);
  const tTotal = filtered.reduce((a,b)=>a+Number(b.item_val)+Number(b.frete_inter)+Number(b.taxa_rf||0)+Number(b.nacional||0),0);

  const FILTERS = [
    { id: "todos", label: "Todos" },
    { id: "pendente", label: "Pendentes" },
    { id: "pago", label: "Pagos" },
    { id: "transito", label: "Em Trânsito" },
    { id: "entregue", label: "Entregues" },
  ];

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">anticeg · visão completa</div>
          <div className="page-title">MASTER<span>LIST</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="greeting">{user.nome || user.cog}</div>
          <div className="greeting-sub">{itens.length} itens · {cegs} CEG{cegs > 1 ? "s" : ""}</div>
        </div>
      </div>

      <div className="summary-row">
        <SumCard label="Itens totais" value={itens.length} valueCls="white" sub="em todas as CEGs" showEye={false} />
        <SumCard label="Valor total" value={totalV} valueCls="orange" sub="item + frete + taxa" showEye={true} />
        <SumCard label="Pago" value={pagoV} valueCls="green" sub="confirmado" showEye={true} />
        <SumCard label="Pendente" value={Math.max(0,pendV)} valueCls="lilas" sub="em aberto" showEye={true} />
        <div className="sum-card">
          <div className="sum-label">Próx. vencimento</div>
          <div className="sum-value yellow">{nextVenc ? `${String(nextVenc.d.getDate()).padStart(2,"0")}/${String(nextVenc.d.getMonth()+1).padStart(2,"0")}` : "—"}</div>
          <div className="sum-sub">{nextVenc ? nextVenc.label : "nenhum pendente"}</div>
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
              <th colSpan={4}></th>
              <th colSpan={3}>VALORES A PAGAR</th>
              <th colSpan={2} className="status-group">STATUS</th>
              <th>PAGAR</th>
            </tr>
            <tr>
              <th style={{width:28}}></th>
              <th>CEG</th>
              <th>NOME DO ITEM</th>
              <th>COG</th>
              <th>ITEM</th>
              <th>FRETE INTER</th>
              <th>TAXA RF</th>
              <th>NACIONAL</th>
              <th>INFORMAÇÕES ADICIONAIS</th>
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
                    <td><button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)}>▾</button></td>
                    <td className="td-ceg">{item.ceg}</td>
                    <td><div className="item-title">{item.nome_item}</div></td>
                    <td className="td-cog">{user.cog}</td>
                    <td><ValCell val={item.item_val} status={item.pag_item} /></td>
                    <td><ValCell val={item.frete_inter} status={item.pag_frete} /></td>
                    <td>{Number(item.taxa_rf) > 0 ? <ValCell val={item.taxa_rf} status={item.pag_taxa} /> : <span className="zero-val">—</span>}</td>
                    <td>{Number(item.nacional) > 0 ? <ValCell val={item.nacional} status={item.pag_nacional} /> : <span className="zero-val">—</span>}</td>
                    <td>
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        <StatusChip status={item.status} />
                        <ProgressMini activeIdx={ai} />
                      </div>
                      {item.info && <div className="item-detail" style={{marginTop:4}}>{item.info}</div>}
                    </td>
                    <td><PayButtons item={item} /></td>
                  </tr>
                  {isOpen && (
                    <tr key={`drawer-${item.id}`} className="drawer-row">
                      <td colSpan={10}><Timeline item={item} activeIdx={ai} /></td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length > 0 && (
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
    const name = item.nome_item.split(" ")[0];
    if (item.venc_item)     addEv(item.venc_item,     `${name} (${item.ceg}): Venc. Item`, "item");
    if (item.venc_frete)    addEv(item.venc_frete,    `${name}: Frete Inter`, "frete");
    if (item.venc_taxa)     addEv(item.venc_taxa,     `${name}: Taxa RF`, "taxa");
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
          <div className="cal-month-title">
            <span>{MONTHS[calMonth]}</span> <span className="cal-year">{calYear}</span>
          </div>
          <button className="cal-nav-btn" onClick={() => changeMonth(1)}>›</button>
        </div>
        <div className="cal-legend">
          {[["laranja","Venc. Item"],["lilas","Frete Inter"],["verde","Taxa RF"],["amarelo","Nacional"]].map(([c,l])=>(
            <div key={c} className="cal-legend-item"><div className={`leg-dot leg-${c}`}/>{l}</div>
          ))}
        </div>
      </div>
      <div className="cal-grid-wrap">
        <div className="cal-weekdays">
          {["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"].map(d=>(
            <div key={d} className="cal-weekday">{d}</div>
          ))}
        </div>
        <div className="cal-days">{cells}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [itens, setItens] = useState([]);
  const [tab, setTab] = useState("masterlist");

  function handleLogin(aj, itensData) { setUser(aj); setItens(itensData); }
  function handleLogout() { setUser(null); setItens([]); setTab("masterlist"); }

  if (!user) return <LoginScreen onLogin={handleLogin} />;

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
        <button className={`tab-btn ${tab === "calendario" ? "active" : ""}`} onClick={() => setTab("calendario")}>◫ Calendário de Pagamentos</button>
      </div>
      {tab === "masterlist" && <MasterlistTab user={user} itens={itens} />}
      {tab === "calendario" && <CalendarTab user={user} itens={itens} />}
    </div>
  );
}