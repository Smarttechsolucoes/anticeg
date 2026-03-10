import { useState } from "react";
import "./App.css";

const STATUS_STEPS = [
  { id: "prevenda",  label: "Pré-venda",       icon: "🛒" },
  { id: "warehouse", label: "Na Warehouse",     icon: "📦" },
  { id: "caminho",   label: "A Caminho",        icon: "✈️"  },
  { id: "taxa",      label: "Taxa Liberada",    icon: "✅" },
  { id: "aqui",      label: "Chegou Aqui",      icon: "🏠" },
  { id: "nacional",  label: "Envio Liberado",   icon: "📬" },
  { id: "enviado",   label: "Enviado Nacional", icon: "🚚" },
];

const DB = {
  "ana@email.com": {
    nome: "ANA",
    itens: [
      { id: 1, ceg: "#12", item: "SEVENTEEN — Spill The Feels", detalhe: "Weverse · PC aleatório",
        item_val: 89, frete_inter: 22, taxa_rf: 0, nacional: 18, info: "Versão capa azul",
        pag_item: "pago", pag_frete: "pago", pag_taxa: "—", pag_nacional: "pendente",
        status: "caminho", statusDates: { prevenda: "01/02", warehouse: "14/02", caminho: "20/02" },
        venc_item: "2026-03-07", venc_frete: "2026-03-12", venc_nacional: "2026-03-20", ceg_filter: "transito" },
      { id: 2, ceg: "#12", item: "ILLIT — Super Real Me", detalhe: "Weverse Lim. · Sticker pack",
        item_val: 112, frete_inter: 28, taxa_rf: 0, nacional: 20, info: "",
        pag_item: "pendente", pag_frete: "pendente", pag_taxa: "—", pag_nacional: "—",
        status: "prevenda", statusDates: { prevenda: "01/03" },
        venc_item: "2026-03-14", venc_frete: "2026-03-18", ceg_filter: "transito" },
      { id: 3, ceg: "#11", item: "AESPA — Armageddon", detalhe: "Hanteo · versão aleatória",
        item_val: 67, frete_inter: 18, taxa_rf: 12, nacional: 16, info: "Já entregue",
        pag_item: "pago", pag_frete: "pago", pag_taxa: "pago", pag_nacional: "pago",
        status: "enviado", statusDates: { prevenda: "01/01", warehouse: "10/01", caminho: "15/01", taxa: "22/01", aqui: "28/01", nacional: "30/01", enviado: "01/02" },
        venc_item: "2026-03-05", venc_frete: "2026-03-05", venc_taxa: "2026-03-10", venc_nacional: "2026-03-25", ceg_filter: "entregue" },
      { id: 4, ceg: "#11", item: "LE SSERAFIM — EASY", detalhe: "Weverse · 2 versões",
        item_val: 134, frete_inter: 32, taxa_rf: 18, nacional: 0, info: "Aguardando liberação taxa",
        pag_item: "pago", pag_frete: "pago", pag_taxa: "pendente", pag_nacional: "—",
        status: "taxa", statusDates: { prevenda: "01/01", warehouse: "10/01", caminho: "15/01", taxa: "22/01" },
        venc_item: "2026-03-05", venc_frete: "2026-03-05", venc_taxa: "2026-03-22", ceg_filter: "transito" },
    ],
  },
  "joao@email.com": {
    nome: "JOÃO",
    itens: [
      { id: 5, ceg: "#12", item: "BTS — Map of the Soul", detalhe: "Weverse · PC exclusivo",
        item_val: 95, frete_inter: 24, taxa_rf: 0, nacional: 18, info: "",
        pag_item: "pago", pag_frete: "pendente", pag_taxa: "—", pag_nacional: "—",
        status: "warehouse", statusDates: { prevenda: "05/02", warehouse: "18/02" },
        venc_item: "2026-03-08", venc_frete: "2026-03-15", ceg_filter: "transito" },
      { id: 6, ceg: "#12", item: "STRAY KIDS — ATE", detalhe: "Hanteo · versão aleatória",
        item_val: 78, frete_inter: 20, taxa_rf: 0, nacional: 15, info: "",
        pag_item: "pendente", pag_frete: "pendente", pag_taxa: "—", pag_nacional: "—",
        status: "prevenda", statusDates: { prevenda: "05/02" },
        venc_item: "2026-03-10", ceg_filter: "transito" },
    ],
  },
  "maria@email.com": {
    nome: "MARIA",
    itens: [
      { id: 7, ceg: "#12", item: "TWICE — WITH YOU-TH", detalhe: "Weverse · todas as versões",
        item_val: 210, frete_inter: 48, taxa_rf: 0, nacional: 24, info: "4 versões",
        pag_item: "pago", pag_frete: "pago", pag_taxa: "—", pag_nacional: "pendente",
        status: "aqui", statusDates: { prevenda: "01/02", warehouse: "12/02", caminho: "18/02", taxa: "25/02", aqui: "01/03" },
        venc_item: "2026-03-03", venc_frete: "2026-03-18", venc_nacional: "2026-03-28", ceg_filter: "transito" },
      { id: 8, ceg: "#10", item: "NewJeans — How Sweet", detalhe: "Weverse · PC aleatório",
        item_val: 55, frete_inter: 15, taxa_rf: 8, nacional: 14, info: "",
        pag_item: "pago", pag_frete: "pago", pag_taxa: "pago", pag_nacional: "pago",
        status: "enviado", statusDates: { prevenda: "10/12", warehouse: "20/12", caminho: "26/12", taxa: "05/01", aqui: "10/01", nacional: "12/01", enviado: "14/01" },
        venc_item: "2026-03-01", venc_frete: "2026-03-01", venc_taxa: "2026-03-05", venc_nacional: "2026-03-12", ceg_filter: "entregue" },
    ],
  },
};

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
            {item.statusDates?.[step.id] && <div className="tl-date">{item.statusDates[step.id]}</div>}
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
      <span className={`td-val ${cls}`}>R${val.toFixed(2).replace(".", ",")}</span>
      <PayBadge status={status} />
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);

  function handleLogin() {
    const key = email.trim().toLowerCase();
    if (DB[key]) { setError(false); onLogin(key, DB[key]); }
    else { setError(true); }
  }

  return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-eyebrow">masterlist · acesso por COG</div>
        <div className="login-title">
          ANTI<span className="lo">CEG</span><br />
          <span className="lg">MASTER</span><br />LIST
        </div>
        <div className="login-box">
          <label className="login-label">Seu COG (e-mail cadastrado na anticeg)</label>
          <input
            className="login-input"
            type="email"
            placeholder="seucog@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{ borderColor: error ? "var(--laranja)" : "" }}
          />
          <button className="login-btn" onClick={handleLogin}>ACESSAR →</button>
          {error && <div className="login-error">COG não encontrado. Usa o mesmo e-mail da entrada na anticeg.</div>}
        </div>
      </div>
    </div>
  );
}

function MasterlistTab({ user }) {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [openDrawer, setOpenDrawer] = useState(null);

  const itens = user.itens;
  const totalV = itens.reduce((a, b) => a + b.item_val + b.frete_inter + (b.taxa_rf || 0) + (b.nacional || 0), 0);
  const pagoV  = itens.filter(i => i.pag_item === "pago").reduce((a,b)=>a+b.item_val,0)
               + itens.filter(i => i.pag_frete === "pago").reduce((a,b)=>a+b.frete_inter,0)
               + itens.filter(i => i.pag_taxa === "pago").reduce((a,b)=>a+(b.taxa_rf||0),0)
               + itens.filter(i => i.pag_nacional === "pago").reduce((a,b)=>a+(b.nacional||0),0);
  const pendV  = totalV - pagoV;
  const cegs   = [...new Set(itens.map(i => i.ceg))].length;

  const today = new Date(); today.setHours(0,0,0,0);
  const vencDates = [];
  itens.forEach(i => {
    if (i.venc_item && i.pag_item !== "pago") vencDates.push({ d: new Date(i.venc_item), label: "Item: " + i.item.split("—")[0].trim() });
    if (i.venc_frete && i.pag_frete !== "pago") vencDates.push({ d: new Date(i.venc_frete), label: "Frete: " + i.item.split("—")[0].trim() });
    if (i.venc_taxa && i.pag_taxa === "pendente") vencDates.push({ d: new Date(i.venc_taxa), label: "Taxa: " + i.item.split("—")[0].trim() });
    if (i.venc_nacional && i.pag_nacional === "pendente") vencDates.push({ d: new Date(i.venc_nacional), label: "Nacional: " + i.item.split("—")[0].trim() });
  });
  const future = vencDates.filter(v => v.d >= today).sort((a,b) => a.d - b.d);
  const nextVenc = future[0];

  let filtered = [...itens];
  if (filter === "pendente") filtered = filtered.filter(i => i.pag_item === "pendente" || i.pag_frete === "pendente" || i.pag_taxa === "pendente" || i.pag_nacional === "pendente");
  else if (filter === "pago") filtered = filtered.filter(i => i.pag_item === "pago" && i.pag_frete === "pago");
  else if (filter === "transito") filtered = filtered.filter(i => i.ceg_filter === "transito");
  else if (filter === "entregue") filtered = filtered.filter(i => i.ceg_filter === "entregue");
  if (search) filtered = filtered.filter(i => i.item.toLowerCase().includes(search) || i.detalhe.toLowerCase().includes(search));

  const tPend = filtered.filter(i=>i.pag_item==="pendente").reduce((a,b)=>a+b.item_val,0)
              + filtered.filter(i=>i.pag_frete==="pendente").reduce((a,b)=>a+b.frete_inter,0)
              + filtered.filter(i=>i.pag_taxa==="pendente").reduce((a,b)=>a+(b.taxa_rf||0),0)
              + filtered.filter(i=>i.pag_nacional==="pendente").reduce((a,b)=>a+(b.nacional||0),0);
  const tTotal = filtered.reduce((a,b)=>a+b.item_val+b.frete_inter+(b.taxa_rf||0)+(b.nacional||0),0);

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
          <div className="greeting">{user.nome}</div>
          <div className="greeting-sub">{itens.length} itens · {cegs} CEG{cegs > 1 ? "s" : ""}</div>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Itens totais</div><div className="sum-value white">{itens.length}</div><div className="sum-sub">em todas as CEGs</div></div>
        <div className="sum-card"><div className="sum-label">Valor total</div><div className="sum-value orange">R${totalV.toFixed(0)}</div><div className="sum-sub">item + frete + taxa</div></div>
        <div className="sum-card"><div className="sum-label">Pago</div><div className="sum-value green">R${pagoV.toFixed(0)}</div><div className="sum-sub">confirmado</div></div>
        <div className="sum-card"><div className="sum-label">Pendente</div><div className="sum-value lilas">R${Math.max(0,pendV).toFixed(0)}</div><div className="sum-sub">em aberto</div></div>
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
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="empty-cell">nenhum item para esse filtro</td></tr>
            )}
            {filtered.map(item => {
              const ai = getStepIdx(item.status);
              const isOpen = openDrawer === item.id;
              return (
                <>
                  <tr key={item.id}>
                    <td><button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)}>▾</button></td>
                    <td className="td-ceg">{item.ceg}</td>
                    <td>
                      <div className="item-title">{item.item}</div>
                      <div className="item-detail">{item.detalhe}</div>
                    </td>
                    <td className="td-cog">{user.email}</td>
                    <td><ValCell val={item.item_val} status={item.pag_item} /></td>
                    <td><ValCell val={item.frete_inter} status={item.pag_frete} /></td>
                    <td>{item.taxa_rf > 0 ? <ValCell val={item.taxa_rf} status={item.pag_taxa} /> : <span className="zero-val">—</span>}</td>
                    <td>{item.nacional > 0 ? <ValCell val={item.nacional} status={item.pag_nacional} /> : <span className="zero-val">—</span>}</td>
                    <td>
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        <StatusChip status={item.status} />
                        <ProgressMini activeIdx={ai} />
                      </div>
                      {item.info && <div className="item-detail" style={{marginTop:4}}>{item.info}</div>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`drawer-${item.id}`} className="drawer-row">
                      <td colSpan={9}><Timeline item={item} activeIdx={ai} /></td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length > 0 && (
              <tr className="total-row">
                <td colSpan={2}><span className="total-label">Total visível</span></td>
                <td colSpan={2}><span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"rgba(245,240,232,.3)"}}>{filtered.length} itens</span></td>
                <td colSpan={4}><span className="total-val">R${tTotal.toFixed(0)}</span></td>
                <td>{tPend > 0 && <span className="total-pend">↗ R${tPend.toFixed(0)} pendente</span>}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalendarTab({ user }) {
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
  user.itens.forEach(item => {
    const name = item.item.replace(/—.*/, "").trim();
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
  const [tab, setTab] = useState("masterlist");

  function handleLogin(email, data) { setUser({ email, ...data }); }
  function handleLogout() { setUser(null); setTab("masterlist"); }

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div>
      <div className="topbar">
        <a className="topbar-logo" href="#">ANTI<span>CEG</span></a>
        <div className="topbar-right">
          <div className="topbar-user">
            <div className="user-dot" />
            <span className="user-email">{user.email}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Sair ↗</button>
        </div>
      </div>

      <div className="tabs-bar">
        <button className={`tab-btn ${tab === "masterlist" ? "active" : ""}`} onClick={() => setTab("masterlist")}>☰ Masterlist</button>
        <button className={`tab-btn ${tab === "calendario" ? "active" : ""}`} onClick={() => setTab("calendario")}>◫ Calendário de Pagamentos</button>
      </div>

      {tab === "masterlist" && <MasterlistTab user={user} />}
      {tab === "calendario" && <CalendarTab user={user} />}
    </div>
  );
}