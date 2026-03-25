import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const supabase = createClient(
  "https://ghjfsmwwcfpfvrouyrka.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM"
);

const FORMS_URL = "https://forms.gle/vMyjCKG4Dj2yhryP7";
const WHATSAPP_NUM = "5524992501917";

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function fmtBRL(val, hidden) {
  if (hidden) return "••••";
  return Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function whatsappMsg(item) {
  const total = Number(item.valor_item) + Number(item.frete_inter) + Number(item.taxa_rf || 0) + Number(item.nacional || 0);
  const msg = `Olá! Quero pagar no cartão de crédito. Vou te mandar as informações:\nValor: R$ ${fmtBRL(total)}\nParcelas: até x12 com juros`;
  return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`;
}

const STATUS_STEPS = [
  { id: "Pré-venda",       label: "Pré-venda",       icon: "🛒" },
  { id: "Na Warehouse",    label: "Na Warehouse",     icon: "📦" },
  { id: "A Caminho",       label: "A Caminho",        icon: "✈️" },
  { id: "Taxa Liberada",   label: "Taxa Liberada",    icon: "✅" },
  { id: "Chegou Aqui",     label: "Chegou Aqui",      icon: "🏠" },
  { id: "Envio Liberado",  label: "Envio Liberado",   icon: "📬" },
  { id: "Enviado Nacional",label: "Enviado Nacional", icon: "🚚" },
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
};

function getStepIdx(status) { return STATUS_STEPS.findIndex(s => s.id === status); }

function PayBadge({ status }) {
  if (status === "Pago")      return <span className="pay-badge pay-pago">Pago</span>;
  if (status === "Em aberto") return <span className="pay-badge pay-pendente">Pendente</span>;
  return null;
}

function isPendente(val) { return val && val !== "Pago"; }

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

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("escolha");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [nome, setNome] = useState("");
  const [twitter, setTwitter] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [estado, setEstado] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function handleLoginCOG() {
    setLoading(true); setError("");
    const val = input.trim();

    // Busca por COG na masterlist
    const { data: itens } = await supabase
      .from("masterlist")
      .select("*")
      .eq("cog", val);

    if (itens && itens.length > 0) {
      const user = { cog: val, nome: itens[0].nome || val };
      onLogin(user, itens);
      setLoading(false);
      return;
    }

    // Busca por nome na masterlist
    const { data: itensPorNome } = await supabase
      .from("masterlist")
      .select("*")
      .ilike("nome", val);

    if (itensPorNome && itensPorNome.length > 0) {
      const user = { cog: itensPorNome[0].cog, nome: itensPorNome[0].nome || val };
      onLogin(user, itensPorNome);
      setLoading(false);
      return;
    }

    setError("COG ou nome não encontrado.");
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
    if (err) { setError("Erro ao cadastrar. Tente novamente."); setLoading(false); return; }

    onLogin(novoUsuario, []);
    setLoading(false);
  }

  if (mode === "escolha") return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-eyebrow">masterlist · acesso</div>
        <div className="login-title">ANTI<span className="lo">CEG</span><br /><span className="lg">MASTER</span><br />LIST</div>
        <div className="login-box">
          <button className="login-btn" onClick={() => setMode("cog")}>TENHO COG →</button>
          <button className="login-btn" style={{ background: "transparent", border: "1px solid var(--laranja)", color: "var(--laranja)" }} onClick={() => setMode("cadastro")}>QUERO ME CADASTRAR →</button>
        </div>
      </div>
    </div>
  );

  if (mode === "cog") return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-eyebrow">masterlist · acesso por COG</div>
        <div className="login-title">ANTI<span className="lo">CEG</span><br /><span className="lg">MASTER</span><br />LIST</div>
        <div className="login-box">
          <label className="login-label">Seu COG ou nome</label>
          <input className="login-input" type="text" placeholder="Seu código da masterlist ou e-mail" value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLoginCOG()}
            style={{ borderColor: error ? "var(--laranja)" : "" }} />
          <button className="login-btn" onClick={handleLoginCOG} disabled={loading}>{loading ? "BUSCANDO..." : "ACESSAR →"}</button>
          <button className="login-skip" onClick={() => { setMode("escolha"); setError(""); }}>← Voltar</button>
          {error && <div className="login-error">{error}</div>}
        </div>
      </div>
    </div>
  );

  if (mode === "cadastro") return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-eyebrow">masterlist · cadastro</div>
        <div className="login-title">ANTI<span className="lo">CEG</span><br /><span className="lg">CADASTRO</span></div>
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
      </div>
    </div>
  );
}

function MasterlistTab({ user, itens }) {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [openDrawer, setOpenDrawer] = useState(null);

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
          <div className="greeting">{user.nome || user.cog}</div>
          <div className="greeting-sub">{itens.length} itens · {cegs} CEG{cegs > 1 ? "s" : ""}</div>
        </div>
      </div>

      <div className="summary-row">
        <SumCard label="Itens totais" value={itens.length} valueCls="white" sub="em todas as CEGs" isAmount={false} />
        <SumCard label="Valor total" value={totalV} valueCls="orange" sub="item + frete + taxa" isAmount={true} />
        <SumCard label="Pago" value={pagoV} valueCls="green" sub="confirmado" isAmount={true} />
        <SumCard label="Pendente" value={Math.max(0, pendV)} valueCls="lilas" sub="em aberto" isAmount={true} />
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
  <th colSpan={4}>VALORES A PAGAR</th>
  <th className="status-group" colSpan={2}>STATUS</th>
  <th>PAGAR</th>
</tr>
            <tr className="thead-cols">
              <th style={{width:20}}></th>
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
                    <td><button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)}>▾</button></td>
                    <td className="td-ceg">{item.ceg}</td>
                    <td><div className="item-title">{item.nome_do_item}</div></td>
                    <td className="td-cog">{item.cog}</td>
                    <td><ValCell val={item.valor_item} status={item.pag_item} /></td>
                    <td><ValCell val={item.frete_inter} status={item.pag_frete} /></td>
                    <td>{Number(item.taxa_rf) > 0 ? <ValCell val={item.taxa_rf} status={item.pag_taxa} /> : <span className="zero-val">—</span>}</td>
                    <td>{Number(item.nacional) > 0 ? <ValCell val={item.nacional} status={item.pag_nacional} /> : <span className="zero-val">—</span>}</td>
                    <td>
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        <StatusChip status={item.status} />
                        <ProgressMini activeIdx={ai} />
                      </div>
                    </td>
                    <td>{item.info_adicionais && <div className="item-detail">{item.info_adicionais}</div>}</td>
                    <td><PayButtons item={item} /></td>
                  </tr>
                  {isOpen && (
                    <tr key={`drawer-${item.id}`} className="drawer-row">
                      <td colSpan={11}><Timeline activeIdx={ai} /></td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length > 0 && (
              <tr className="total-row">
                <td colSpan={2}><span className="total-label">Total visível</span></td>
                <td colSpan={2}><span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"rgba(245,240,232,.3)"}}>{filtered.length} itens</span></td>
                <td colSpan={5}><span className="total-val">R${fmtBRL(tTotal)}</span></td>
                <td colSpan={2}>{tPend > 0 && <span className="total-pend">↗ R${fmtBRL(tPend)} pendente</span>}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PerfilTab({ user, onUpdate }) {
  const [nome, setNome] = useState(user.nome || "");
  const [twitter, setTwitter] = useState(user.twitter || "");
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || "");
  const [estado, setEstado] = useState(user.estado || "");
  const [email, setEmail] = useState(user.email || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const temCOG = !!user.cog && !user.email;

  async function handleSalvar() {
    setLoading(true); setError(""); setSuccess("");
    const updates = { nome, twitter, whatsapp, estado, email };
    if (novaSenha) {
      if (novaSenha.length < 6) { setError("Nova senha deve ter pelo menos 6 caracteres."); setLoading(false); return; }
      updates.senha = novaSenha;
    }

    if (!temCOG) {
      const { error: err } = await supabase.from("usuarios").update(updates).eq("email", user.email);
      if (err) { setError("Erro ao salvar."); setLoading(false); return; }
    }

    const updatedUser = { ...user, ...updates };
    localStorage.setItem("anticeg_user", JSON.stringify(updatedUser));
    onUpdate(updatedUser);
    setSuccess("Perfil atualizado com sucesso!");
    setLoading(false);
  }

  return (
<div className="main" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="page-header">
        <div>
          <div className="page-eyebrow">anticeg · seu perfil</div>
          <div className="page-title">MEU<span> PERFIL</span></div>
        </div>
      </div>
      <div className="login-box" style={{ gap: 16 }}>
        {user.cog && (
          <div>
            <div className="login-label" style={{ marginBottom: 6 }}>COG (fixo)</div>
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, padding: "12px 16px", color: "rgba(245,240,232,.4)", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{user.cog}</div>
          </div>
        )}
        <div><label className="login-label">Nome completo</label><input className="login-input" style={{ width: "100%", marginTop: 6 }} type="text" value={nome} onChange={e => setNome(e.target.value)} /></div>
        <div><label className="login-label">@ no Twitter</label><input className="login-input" style={{ width: "100%", marginTop: 6 }} type="text" placeholder="@seutwitter" value={twitter} onChange={e => setTwitter(e.target.value)} /></div>
        <div><label className="login-label">WhatsApp</label><input className="login-input" style={{ width: "100%", marginTop: 6 }} type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></div>
        <div>
          <label className="login-label">Estado</label>
          <select className="login-input" style={{ width: "100%", marginTop: 6, cursor: "pointer" }} value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">Selecione...</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        {!temCOG && <div><label className="login-label">E-mail</label><input className="login-input" style={{ width: "100%", marginTop: 6 }} type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>}
        {!temCOG && <div><label className="login-label">Nova senha (deixe em branco para não alterar)</label><input className="login-input" style={{ width: "100%", marginTop: 6 }} type="password" placeholder="••••••" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} /></div>}
        {error && <div className="login-error">{error}</div>}
        {success && <div style={{ fontSize: "var(--fs-xs)", color: "var(--verde)", padding: "8px 12px", background: "rgba(186,255,57,.08)", border: "1px solid rgba(186,255,57,.2)", borderRadius: 4 }}>{success}</div>}
        <button className="login-btn" onClick={handleSalvar} disabled={loading}>{loading ? "SALVANDO..." : "SALVAR ALTERAÇÕES →"}</button>
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
<div className="main" style={{ maxWidth: 800, margin: '0 auto' }}>
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
            <div style={{ display: "flex", gap: 10, fontSize: "var(--fs-xs)", color: "rgba(245,240,232,.7)" }}><span style={{ color: "var(--verde)" }}>☆</span><span>Dúvidas? Chama a Nanda no WhatsApp — quase sempre disponível!</span></div>
            <a href={`https://wa.me/${WHATSAPP_NUM}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--verde)", color: "#0D0D0D", fontFamily: "'DM Mono', monospace", fontSize: "var(--fs-xs)", fontWeight: 600, padding: "10px 20px", borderRadius: 6, textDecoration: "none", width: "fit-content", marginTop: 8 }}>💬 Falar no WhatsApp</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("anticeg_user")); } catch { return null; }
  });
  const [itens, setItens] = useState([]);
  const [tab, setTab] = useState("masterlist");

  async function handleLogin(u, itensData) {
    localStorage.setItem("anticeg_user", JSON.stringify(u));
    setUser(u);
    setItens(itensData);
  }

  function handleLogout() {
    localStorage.removeItem("anticeg_user");
    setUser(null);
    setItens([]);
    setTab("masterlist");
  }

  // Recarrega itens ao voltar com sessão salva
  useState(() => {
    if (user && user.cog) {
      supabase.from("masterlist").select("*").eq("cog", user.cog).then(({ data }) => {
        setItens(data || []);
      });
    }
  }, []);

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
        <button className={`tab-btn ${tab === "calendario" ? "active" : ""}`} onClick={() => setTab("calendario")}>◫ Calendário</button>
        <button className={`tab-btn ${tab === "perfil" ? "active" : ""}`} onClick={() => setTab("perfil")}>⚙ Meu Perfil</button>
        <button className={`tab-btn ${tab === "regras" ? "active" : ""}`} onClick={() => setTab("regras")}>☆ Regras</button>
      </div>
      {tab === "masterlist" && <MasterlistTab user={user} itens={itens} />}
      {tab === "calendario" && <CalendarTab user={user} itens={itens} />}
      {tab === "perfil" && <PerfilTab user={user} onUpdate={setUser} />}
      {tab === "regras" && <RegrasTab />}
    </div>
  );
}