import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";
import LandingPage from "./LandingPage";
import bonequinha from "./assets/bonequinha.png";

const supabase = createClient(
  "https://ghjfsmwwcfpfvrouyrka.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM"
);

const WHATSAPP_NUM = "5524992501917";
const ADMIN_EMAIL = "nandag_medeiros@hotmail.com";
function isAdminUser(user) {
  return user?.email === ADMIN_EMAIL || user?.twitter === "@nandaverseo_c" || user?.cog === "nandaverseo_c";
}

function fmtBRL(val, hidden) {
  if (hidden) return "••••";
  return Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_STEPS = [
  { id: "Comprado",         label: "Comprado",         icon: "🛒" },
  { id: "A Caminho",        label: "A Caminho",        icon: "✈️" },
  { id: "Taxa Liberada",    label: "Taxa Liberada",    icon: "✅" },
  { id: "ANTIGOM",          label: "ANTIGOM",          icon: "🏠" },
  { id: "Envio Liberado",   label: "Envio Liberado",   icon: "📬" },
  { id: "Enviado Nacional", label: "Enviado Nacional", icon: "🚚" },
];

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const chipMap = {
  "Comprado":        ["chip-prevenda",  "Comprado"],
  "Pré-venda":       ["chip-prevenda",  "Comprado"],
  "A Caminho":       ["chip-caminho",   "A Caminho"],
  "Taxa Liberada":   ["chip-taxa",      "Taxa Liberada"],
  "ANTIGOM":         ["chip-aqui",      "ANTIGOM"],
  "Chegou Aqui":     ["chip-aqui",      "ANTIGOM"],
  "Envio Liberado":  ["chip-nacional",  "Envio Liberado"],
  "Enviado Nacional":["chip-enviado",   "Enviado Nacional"],
  "Disponível":      ["chip-loja-disp", "Disponível"],
  "Vendido":         ["chip-loja-vend", "Vendido"],
};

function getStepIdx(status) { return STATUS_STEPS.findIndex(s => s.id === status); }
function isPendente(val) {
  if (typeof val === "boolean") return !val; // true=pago, false=pendente
  return val && val !== "Pago" && val !== "N/A";
}

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
  if (!Number(val)) return <span className="zero-val">—</span>;
  const cls = isPendente(status) ? "pend" : "pago";
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

// ── Input helper ────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="login-label" style={{ marginBottom: 6, display: "block" }}>{label}</label>
      {children}
    </div>
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

function CegDetailView({ ceg, onVoltar, guest }) {
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
                {!guest && <th colSpan={3}>VALORES A PAGAR</th>}
                <th className="status-group" colSpan={2}>STATUS</th>
              </tr>
              <tr className="thead-cols">
                <th>JOINER</th>
                <th>NOME DO ITEM</th>
                {!guest && <><th>ITEM</th><th>FRETE INTER</th><th>TAXA RF</th></>}
                <th>STATUS</th>
                <th>INFO</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">nenhum item</td></tr>
              )}
              {itens.map(item => {
                const ai = getStepIdx(item.status);
                const isOpen = openDrawer === item.id;
                return (
                  <>
                    <tr key={item.id}>
                      <td className="ceg-detail-joiner">{item.nome || item.cog || "—"}</td>
                      <td><div className="item-title">{item.nome_do_item}</div></td>
                      {!guest && <>
                        <td><span className="td-val">{Number(item.valor_item) > 0 ? `R$${fmtBRL(item.valor_item)}` : <span className="zero-val">—</span>}</span></td>
                        <td><span className="td-val">{Number(item.frete_inter) > 0 ? `R$${fmtBRL(item.frete_inter)}` : <span className="zero-val">—</span>}</span></td>
                        <td>{Number(item.taxa_rf) > 0 ? <span className="td-val">R${fmtBRL(item.taxa_rf)}</span> : <span className="zero-val">—</span>}</td>
                      </>}
                      <td>
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                          <StatusChip status={item.status} />
                          <ProgressMini activeIdx={ai} />
                        </div>
                      </td>
                      <td>
                        {item.info_adicionais && <div className="item-detail">{item.info_adicionais}</div>}
                        <div style={{ display:"flex", gap:6, alignItems:"center", marginTop: item.info_adicionais ? 4 : 0 }}>
                          <button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)}>▾</button>
                          <button onClick={() => setReportItem(item)} className="report-row-btn">⚑ Reportar erro</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`drawer-${item.id}`} className="drawer-row">
                        <td colSpan={7}><Timeline activeIdx={ai} /></td>
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
            const total = Number(item.valor_item||0)+Number(item.frete_inter||0)+Number(item.taxa_rf||0);
            return (
              <div key={item.id} className="ml-card">
                <div className="ml-card-top">
                  <span className="ml-val-label" style={{ color:"rgba(245,240,232,.5)", fontSize:11 }}>{item.nome || item.cog || "—"}</span>
                  <StatusChip status={item.status} />
                </div>
                <div className="ml-card-name">{item.nome_do_item}</div>
                <div className="ml-card-vals">
                  {Number(item.valor_item) > 0 && <div className="ml-val-row"><span className="ml-val-label">item</span><ValCell val={item.valor_item} status={item.pago_item} /></div>}
                  {Number(item.frete_inter) > 0 && <div className="ml-val-row"><span className="ml-val-label">frete</span><ValCell val={item.frete_inter} status={item.pago_frete} /></div>}
                  {Number(item.taxa_rf) > 0 && <div className="ml-val-row"><span className="ml-val-label">taxa RF</span><ValCell val={item.taxa_rf} status={item.pago_rf} /></div>}
                  {total > 0 && <div className={`ml-val-total${isPendente(item.pago_item) || isPendente(item.pago_frete) || isPendente(item.pago_rf) ? "" : " ml-val-total-pago"}`}>total R${fmtBRL(total)}</div>}
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

  if (detalhe) return <CegDetailView ceg={detalhe} onVoltar={() => setDetalhe(null)} guest={guest} />;

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

const inputStyle = { width: "100%", background: "rgba(245,240,232,.06)", border: "1px solid rgba(245,240,232,.12)", borderRadius: 6, padding: "10px 14px", color: "var(--offwhite)", fontFamily: "'DM Mono',monospace", fontSize: 12 };
const labelStyle = { fontSize: 11, color: "rgba(245,240,232,.45)", display: "block", marginBottom: 5 };

function ReportModal({ user, item, onClose }) {
  const [erros, setErros] = useState({ item: false, valor: false, frete: false, taxa: false, pagamento: false, outro: false });
  const [correcoes, setCorrecoes] = useState({ valor: "", frete: "", taxa: "" });
  const [motivoItem, setMotivoItem] = useState(null);
  const [preencheuForms, setPreencheuForms] = useState(null);
  const [dataHora, setDataHora] = useState("");
  const [pagInfo, setPagInfo] = useState({ dataPag: "", dataForms: "", valorPago: "", metodo: null });
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function toggleErro(k) { setErros(e => ({ ...e, [k]: !e[k] })); }

  async function handleEnviar() {
    setLoading(true);
    const { error } = await supabase.from("reports").insert([{
      joiner_cog:      user.cog,
      joiner_nome:     user.nome || user.cog,
      item_id:         item.id,
      item_nome:       item.nome_do_item,
      ceg:             item.ceg,
      erro_item:       erros.item,
      erro_valor:      erros.valor,
      erro_frete:      erros.frete,
      erro_taxa:       erros.taxa,
      erro_pagamento:  erros.pagamento,
      erro_outro:      erros.outro,
      motivo_item:     erros.item   ? motivoItem        : null,
      correcao_valor:  erros.valor  ? correcoes.valor  : null,
      correcao_frete:  erros.frete  ? correcoes.frete  : null,
      correcao_taxa:   erros.taxa   ? correcoes.taxa   : null,
      pag_data:        erros.pagamento ? pagInfo.dataPag   : null,
      pag_data_forms:  erros.pagamento ? pagInfo.dataForms : null,
      pag_valor:       erros.pagamento ? pagInfo.valorPago : null,
      pag_metodo:      erros.pagamento ? pagInfo.metodo    : null,
      observacao:      obs.trim() || null,
    }]);
    setLoading(false);
    if (error) { alert("Erro ao enviar: " + error.message); return; }
    setSent(true);
  }

  const CheckRow = ({ k, label }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer" }}>
      <input type="checkbox" checked={erros[k]} onChange={() => toggleErro(k)}
        style={{ accentColor: "var(--laranja)", width: 14, height: 14 }} />
      <span style={{ fontSize: 12, color: "rgba(245,240,232,.75)" }}>{label}</span>
    </label>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        {sent ? (
          <>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Report enviado!</div>
            <div style={{ fontSize: 12, color: "rgba(245,240,232,.45)", marginBottom: 20 }}>A admin vai revisar e atualizar em breve.</div>
            <button className="lp-card-btn" onClick={onClose}>Fechar</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "rgba(245,240,232,.35)", marginBottom: 2, letterSpacing: 1 }}>{item.ceg}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{item.nome_do_item}</div>

            <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
              <span>O que está errado? <span style={{ color: "var(--laranja)" }}>*</span></span>
              {!Object.values(erros).some(Boolean) && <span style={{ color: "rgba(245,240,232,.25)", fontSize: 10 }}>selecione ao menos uma opção</span>}
            </div>
            <div style={{ marginBottom: 16, padding: "4px 12px", background: "rgba(245,240,232,.04)", borderRadius: 8 }}>
              <CheckRow k="item" label="Item incorreto" />
              {erros.item && (
                <div style={{ marginLeft: 24, marginBottom: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { v: "repassei", label: "Repassei o item e já preenchi o forms" },
                    { v: "membro_errado", label: "Esse é o item mas o membro/skzoo está errado" },
                  ].map(({ v, label }) => (
                    <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
                      <input type="radio" name="motivo_item" checked={motivoItem === v} onChange={() => setMotivoItem(v)}
                        style={{ accentColor: "var(--laranja)", width: 13, height: 13 }} />
                      <span style={{ fontSize: 11, color: "rgba(245,240,232,.65)" }}>{label}</span>
                    </label>
                  ))}
                </div>
              )}
              <CheckRow k="valor" label="Valor do item incorreto" />
              {erros.valor && (
                <div style={{ marginLeft: 24, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "rgba(245,240,232,.35)" }}>Registrado: R${fmtBRL(item.valor_item)}</span>
                  <input placeholder="Valor correto (R$)" value={correcoes.valor} onChange={e => setCorrecoes(c => ({ ...c, valor: e.target.value }))}
                    style={{ ...inputStyle, width: 140, padding: "5px 10px" }} />
                </div>
              )}
              <CheckRow k="frete" label="Frete incorreto" />
              {erros.frete && (
                <div style={{ marginLeft: 24, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "rgba(245,240,232,.35)" }}>Registrado: R${fmtBRL(item.frete_inter)}</span>
                  <input placeholder="Valor correto (R$)" value={correcoes.frete} onChange={e => setCorrecoes(c => ({ ...c, frete: e.target.value }))}
                    style={{ ...inputStyle, width: 140, padding: "5px 10px" }} />
                </div>
              )}
              <CheckRow k="taxa" label="Taxa RF incorreta" />
              {erros.taxa && (
                <div style={{ marginLeft: 24, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "rgba(245,240,232,.35)" }}>Registrado: R${fmtBRL(item.taxa_rf)}</span>
                  <input placeholder="Valor correto (R$)" value={correcoes.taxa} onChange={e => setCorrecoes(c => ({ ...c, taxa: e.target.value }))}
                    style={{ ...inputStyle, width: 140, padding: "5px 10px" }} />
                </div>
              )}
              <CheckRow k="pagamento" label="Já paguei e continua pendente" />
              {erros.pagamento && (
                <div style={{ marginLeft: 24, marginBottom: 4, display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
                  <div>
                    <div style={labelStyle}>Data do pagamento</div>
                    <input type="date" value={pagInfo.dataPag} onChange={e => setPagInfo(p => ({ ...p, dataPag: e.target.value }))}
                      style={{ ...inputStyle, width: "100%" }} />
                  </div>
                  <div>
                    <div style={labelStyle}>Data e horário do preenchimento do forms</div>
                    <input type="datetime-local" value={pagInfo.dataForms} onChange={e => setPagInfo(p => ({ ...p, dataForms: e.target.value }))}
                      style={{ ...inputStyle, width: "100%" }} />
                  </div>
                  <div>
                    <div style={labelStyle}>Valor pago</div>
                    <input type="text" placeholder="Ex: 96,00" value={pagInfo.valorPago} onChange={e => setPagInfo(p => ({ ...p, valorPago: e.target.value }))}
                      style={{ ...inputStyle, width: "100%" }} />
                  </div>
                  <div>
                    <div style={labelStyle}>Método de pagamento</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["PIX", "Transferência", "Outro"].map(m => (
                        <button key={m} onClick={() => setPagInfo(p => ({ ...p, metodo: m }))}
                          style={{ flex: 1, padding: "6px", borderRadius: 6, fontSize: 11, fontFamily: "'DM Mono',monospace", cursor: "pointer", border: `1px solid ${pagInfo.metodo === m ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, background: pagInfo.metodo === m ? "rgba(255,92,26,.12)" : "transparent", color: pagInfo.metodo === m ? "var(--laranja)" : "rgba(245,240,232,.5)" }}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <CheckRow k="outro" label="Outro problema" />
            </div>

            <label style={labelStyle}>Obs (opcional)</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Adicione informações adicionais caso necessário"
              rows={3} style={{ ...inputStyle, marginBottom: 20, resize: "none" }} />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: "none", border: "1px solid rgba(245,240,232,.15)", borderRadius: 6, padding: "10px", color: "rgba(245,240,232,.4)", fontFamily: "'DM Mono',monospace", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleEnviar} disabled={loading || !Object.values(erros).some(Boolean)} className="lp-card-btn" style={{ flex: 2, margin: 0, cursor: Object.values(erros).some(Boolean) ? "pointer" : "default", opacity: Object.values(erros).some(Boolean) ? 1 : 0.4 }}>
                {loading ? "..." : "Enviar report →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MasterlistTab({ user, itens, onLogin }) {
  const guest = user.guest;
  const [search, setSearch] = useState("");
  const [openDrawer, setOpenDrawer] = useState(null);
  const [cegModal, setCegModal] = useState(null);
  const [reportItem, setReportItem] = useState(null);

  const totalV = itens.reduce((a, b) => a + Number(b.valor_item||0) + Number(b.frete_inter||0) + Number(b.taxa_rf||0), 0);
  const pagoV  = itens.reduce((a,b) =>
    a + (b.pago_item  ? Number(b.valor_item||0)  : 0)
      + (b.pago_frete ? Number(b.frete_inter||0) : 0)
      + (b.pago_rf    ? Number(b.taxa_rf||0)     : 0), 0);
  const pendV = totalV - pagoV;
  const cegs  = [...new Set(itens.map(i => i.ceg))].length;

  const today = new Date(); today.setHours(0,0,0,0);
  const vencDates = [];
  itens.forEach(i => {
    const name = (i.nome_do_item || "").split(" ")[0];
    if (i.venc_item     && isPendente(i.pago_item))     vencDates.push({ d: new Date(i.venc_item),     label: "Item: " + name });
    if (i.venc_frete    && isPendente(i.pago_frete))   vencDates.push({ d: new Date(i.venc_frete),    label: "Frete: " + name });
    if (i.venc_taxa     && isPendente(i.pago_rf))      vencDates.push({ d: new Date(i.venc_taxa),     label: "Taxa: " + name });
  });
  const nextVenc = vencDates.filter(v => v.d >= today).sort((a,b) => a.d - b.d)[0];
  const qtdAtrasados = vencDates.filter(v => v.d < today).length;

  let filtered = [...itens];
  if (search) filtered = filtered.filter(i => (i.nome_do_item || "").toLowerCase().includes(search));

  const tTotal = filtered.reduce((a,b) => a+Number(b.valor_item||0)+Number(b.frete_inter||0)+Number(b.taxa_rf||0), 0);
  const tPend  = filtered.reduce((a,b) =>
    a + (isPendente(b.pago_item)  ? Number(b.valor_item||0)  : 0)
      + (isPendente(b.pago_frete) ? Number(b.frete_inter||0) : 0)
      + (isPendente(b.pago_rf)    ? Number(b.taxa_rf||0)     : 0), 0);


  const temEnvioLiberado = !guest && itens.some(i => i.status === "Envio Liberado");
  const temPendente = !guest && pendV > 0;

  return (
    <div className="main">
      {reportItem && <ReportModal user={user} item={reportItem} onClose={() => setReportItem(null)} />}
      {!guest && (
        <div className="notif-info">
          ℹ Os pagamentos foram atualizados de acordo com o preenchimento do forms de pagamento no dia 11/06/2026 às 13:02. Caso tenha realizado após esse horário, ainda será atualizado.
        </div>
      )}
      {temEnvioLiberado && temPendente && (
        <div className="notif-pagamento">
          ⚠ Verifique os pagamentos em aberto para liberar seu envio nacional
        </div>
      )}
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
        <a className="sum-card sum-card-link" href="https://forms.gle/SyG2Zz8Lovreq8kn9" target="_blank" rel="noopener noreferrer">
          <div className="sum-label">Forms de Pagamento</div>
          <div className="sum-value orange">CLIQUE AQUI</div>
          <div className="sum-sub">pague o que está em aberto</div>
        </a>
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
        <input className="search-input" type="text" placeholder="Buscar item..." value={search} onChange={e => setSearch(e.target.value.toLowerCase())} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr className="col-group-header">
              <th colSpan={2}></th>
              <th colSpan={3}>VALORES A PAGAR</th>
              <th className="status-group" colSpan={2}>STATUS</th>
            </tr>
            <tr className="thead-cols">
              <th>CEG</th>
              <th>NOME DO ITEM</th>
              <th>ITEM</th>
              <th>FRETE INTER</th>
              <th>TAXA RF</th>
              <th>STATUS</th>
              <th>INFO</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="empty-cell">nenhum item para esse filtro</td></tr>
            )}
            {filtered.map(item => {
              const ai = getStepIdx(item.status);
              const isOpen = openDrawer === item.id;
              return (
                <>
                  <tr key={item.id}>
                    <td className="td-ceg"><button className="ceg-btn" onClick={() => setCegModal(item.ceg)}>{item.ceg}</button></td>
                    <td><div className="item-title">{item.nome_do_item}</div></td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.valor_item} status={item.pago_item} />}</td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.frete_inter} status={item.pago_frete} />}</td>
                    <td>{guest ? <span className="zero-val">—</span> : (Number(item.taxa_rf) > 0 ? <ValCell val={item.taxa_rf} status={item.pago_rf} /> : <span className="zero-val">—</span>)}</td>
                    <td>
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        <StatusChip status={item.status} />
                        <ProgressMini activeIdx={ai} />
                      </div>
                    </td>
                    <td>
                      {item.info_adicionais && <div className="item-detail">{item.info_adicionais}</div>}
                      <div style={{ display:"flex", gap:6, alignItems:"center", marginTop: item.info_adicionais ? 4 : 0 }}>
                        <button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)}>▾</button>
                        <button onClick={() => setReportItem(item)} className="report-row-btn">⚑ Reportar erro</button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`drawer-${item.id}`} className="drawer-row">
                      <td colSpan={7}><Timeline activeIdx={ai} /></td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length > 0 && !guest && (
              <tr className="total-row">
                <td colSpan={2}><span className="total-label">Total visível</span></td>
                <td><span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"rgba(245,240,232,.3)"}}>{filtered.length} itens</span></td>
                <td colSpan={3}><span className="total-val">R${fmtBRL(tTotal)}</span></td>
                <td>{tPend > 0 && <span className="total-pend">↗ R${fmtBRL(tPend)} pendente</span>}</td>
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
          const total = Number(item.valor_item||0)+Number(item.frete_inter||0)+Number(item.taxa_rf||0);
          return (
            <div key={item.id} className="ml-card">
              <div className="ml-card-top">
                <button className="ceg-btn" onClick={() => setCegModal(item.ceg)}>{item.ceg}</button>
                <StatusChip status={item.status} />
              </div>
              <div className="ml-card-name">{item.nome_do_item}</div>
              {!guest && (
                <div className="ml-card-vals">
                  {Number(item.valor_item) > 0 && <div className="ml-val-row"><span className="ml-val-label">item</span><ValCell val={item.valor_item} status={item.pago_item} /></div>}
                  {Number(item.frete_inter) > 0 && <div className="ml-val-row"><span className="ml-val-label">frete</span><ValCell val={item.frete_inter} status={item.pago_frete} /></div>}
                  {Number(item.taxa_rf) > 0 && <div className="ml-val-row"><span className="ml-val-label">taxa RF</span><ValCell val={item.taxa_rf} status={item.pago_rf} /></div>}
                  {total > 0 && <div className={`ml-val-total${isPendente(item.pago_item) || isPendente(item.pago_frete) || isPendente(item.pago_rf) ? "" : " ml-val-total-pago"}`}>total R${fmtBRL(total)}</div>}
                </div>
              )}
              <div className="ml-card-footer">
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
  const [email, setEmail] = useState(user.email || "");
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

  async function handleSalvar() {
    setLoading(true); setError(""); setSuccess("");

    if (novaSenha) {
      if (novaSenha.length < 6) { setError("Nova senha deve ter pelo menos 6 caracteres."); setLoading(false); return; }
      if (novaSenha !== confirmarSenha) { setError("As senhas não coincidem."); setLoading(false); return; }
      if (user.cog && senhaAtual !== user.senha) { setError("Senha atual incorreta."); setLoading(false); return; }
    }

    const updates = {
      nome, twitter, whatsapp, email,
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
          {[["laranja","Venc. Item"],["lilas","Frete"],["verde","Taxa RF"]].map(([c,l]) => (
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

function highlightMatch(text, q) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark>{text.slice(idx, idx + q.length)}</mark>{highlightMatch(text.slice(idx + q.length), q)}</>;
}

function RegrasTab() {
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState({});

  const secoes = [
    { titulo: "⋆ Infos Gerais", color: "lilas", fixed: true, itens: ["Menores de idade não são permitidos.","Você pode convidar amigxs confiáveis, mas evitem pessoas totalmente desconhecidas.","Ao participar da CEG, você declara estar ciente e de acordo com todas as regras.","O não cumprimento das regras pode resultar em bloqueio na comunidade.","Compradores que se incomodam com pequenos defeitos estéticos (amassados leves, pressmarks, sinais de manuseio) não devem participar das CEGs."] },
    { titulo: "⋆ Regra de Claim", color: "lilas", itens: ["É permitida apenas UMA pessoa te ajudando a dar claims nos itens.","No momento da claim, deve estar claramente sinalizado para quem é o photocard.","Caso não esteja claramente sinalizado no momento da claim, o item será automaticamente considerado seu, sem possibilidade de contestação posterior, inclusive em caso de erro de interpretação ou falta de identificação clara.","Itens considerados seus só poderão ser repassados mediante pagamento integral."] },
    { titulo: "⋆ Atualizações", color: "lilas", itens: ["As atualizações e informações de CEG se encontram sempre nas planilhas e nos respectivos grupos.","Caso o participante não esteja nos grupos ou não acompanhe as atualizações, a GOM não se responsabiliza por perdas de prazo, multas ou falta de informação.","Se não tem atualização recente, é porque não houve novidade."] },
    { titulo: "⋆ Pagamentos & Taxas", color: "verde", itens: ["A taxa de R$1 por dia por item é aplicada automaticamente após o vencimento, sem necessidade de aviso.","Não é necessário comunicar atrasos individuais. Todas as situações seguem as mesmas regras.","Exceções por motivos pessoais não serão consideradas para prazos de pagamento — a multa continua sendo aplicada.","O comprovante de pagamento deve ser enviado no formulário de pagamento — comprovantes enviados no privado não serão considerados.","Reembolso só ocorre em caso de cancelamento da CEG inteira — e integral."] },
    { titulo: "⋆ Repasse & Atraso", color: "lilas", itens: ["Repasses são permitidos dentro da comunidade ANTIGOM, inclusive no grupo V&T, desde que o item esteja totalmente pago à Nanda e com o formulário de pagamento devidamente preenchido.","Não é necessário solicitar autorização prévia para repasses realizados dentro da comunidade.","Repasses para pessoas fora da comunidade não são permitidos e serão cancelados.","CEGs que não permitem repasse: itens fanmade, revistas e caixas Mercari.","O repasse de qualquer item só será realizado após pagamento integral.","O joiner original é totalmente responsável por repassar todas as informações e regras ao novo dono do item.","O joiner deve preencher o formulário de repasse após a finalização. Repasses não informados via formulário não serão considerados pela GOM.","A GOM não se responsabiliza por falhas de comunicação entre as partes."] },
    { titulo: "⋆ Envio Nacional", color: "lilas", itens: ["Os envios nacionais são realizados em rounds mensais, com avisos prévios no grupo. Não é necessário um novo grupo para isso.","O formulário de envio ficará aberto durante períodos do mês. O prazo de envio após o preenchimento é de 15 dias.","Entrarei em contato individualmente para finalizar cada solicitação.","O pagamento do frete nacional + taxa de embalagem é imediato após a confirmação.","O envio só será realizado após a confirmação do pagamento de todas as taxas pendentes relacionadas aos itens solicitados.","Endereços preenchidos incorretamente ou incompletos podem resultar em atrasos, devoluções ou cobranças adicionais — sendo de responsabilidade do joiner.","O valor da declaração será sempre o valor integral do produto para cobertura do seguro.","Após a postagem, não nos responsabilizamos por atrasos ou falhas da transportadora. A responsabilidade da GOM se encerra no momento da postagem.","Condições de abandono relacionadas ao envio estão descritas na seção Abandono de Item.","Taxa de embalagem: Mini envio R$3,00 · Caixas 1kg–3kg R$4,00 · Caixas 3kg–7kg R$6,00 · Caixas +7kg R$10,00 — calculada conforme o peso final, cobrindo os materiais de proteção e preparo do envio."] },
    { titulo: "⋆ Abandono de Item", color: "laranja", itens: ["Itens com mais de 15 dias corridos de atraso no pagamento serão considerados abandono e poderão ser repassados sem reembolso.","Itens sem solicitação de envio após 60 dias do recebimento no Brasil serão considerados abandono e poderão ser repassados sem reembolso.","Pagamentos realizados após a caracterização de abandono não garantem a recuperação do item.","Não é necessário aviso individual para caracterização de abandono.","Ao participar da CEG, você declara estar ciente dos prazos e condições para evitar o abandono."] },
    { titulo: "⋆ Reembolsos", color: "laranja", itens: ["Transações internacionais envolvem riscos. Ao participar, você declara estar ciente de que não há reembolso em casos de problemas com sellers, incluindo calotes.","Não há reembolso em caso de roubo ou perda do objeto, incluindo extravios por transportadoras ou serviços postais.","Reembolso pode ser realizado apenas em caso de má embalagem, comprovada por vídeo de abertura sem cortes."] },
    { titulo: "⋆ Compradores Sensíveis", color: "lilas", itens: ["Compradores que se incomodam com pequenos defeitos estéticos (amassados leves, pressmarks, sinais de manuseio) não devem participar das CEGs.","Ao participar, você concorda em não solicitar trocas, cancelamentos ou reclamações por esse tipo de marca.","Reclamações desse tipo não serão consideradas."] },
  ];

  const q = search.trim().toLowerCase();
  const secoesFiltradas = secoes.map(s => ({
    ...s,
    itensFiltrados: q ? s.itens.filter(it => it.toLowerCase().includes(q)) : s.itens
  })).filter(s => !q || s.itensFiltrados.length > 0);
  const totalMatches = q ? secoesFiltradas.reduce((a, s) => a + s.itensFiltrados.length, 0) : 0;

  function toggle(titulo) {
    setOpenSections(prev => ({ ...prev, [titulo]: !prev[titulo] }));
  }

  return (
    <div className="main" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="page-header"><div><div className="page-eyebrow">anticeg · comunidade</div><div className="page-title">REGRAS DA<span> COMU</span></div></div></div>

      <div className="regras-search-wrap">
        <span className="regras-search-icon">🔍</span>
        <input className="regras-search-input" type="text" placeholder="Buscar por palavra-chave..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {q && (
        <div className="regras-search-count">
          {totalMatches === 0 ? "nenhum resultado encontrado" : <><span>{totalMatches}</span> resultado{totalMatches > 1 ? "s" : ""} encontrado{totalMatches > 1 ? "s" : ""}</>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {secoesFiltradas.map((s) => {
          const isOpen = s.fixed || (q && s.itensFiltrados.length > 0) || !!openSections[s.titulo];
          return (
            <div key={s.titulo} className={`regras-acc regras-acc-${s.color}`}>
              <button className="regras-acc-toggle" onClick={() => !s.fixed && toggle(s.titulo)} style={s.fixed ? { cursor: "default" } : {}}>
                <span className="regras-acc-title">{s.titulo}</span>
                {!s.fixed && <span className={`regras-acc-chevron ${isOpen ? "open" : ""}`}>▾</span>}
              </button>
              {isOpen && (
                <ul className="regras-list">
                  {s.itensFiltrados.map((item, j) => (
                    <li key={j}>
                      <span className="regras-list-icon">☆</span><span>{highlightMatch(item, q)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
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
  const [reports, setReports] = useState([]);

  useEffect(() => {
    supabase.from("config").select("value").eq("key", "manutencao").single()
      .then(({ data }) => { if (data) setManutencaoAdmin(data.value === "true"); });
    supabase.from("config").select("value").eq("key", "perfil_push_ativo").single()
      .then(({ data }) => { if (data) setPerfilPushAdmin(data.value !== "false"); });
    supabase.from("reports").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setReports(data); });
  }, []);

  async function marcarResolvido(id) {
    await supabase.from("reports").update({ status: "resolvido" }).eq("id", id);
    setReports(r => r.map(x => x.id === id ? { ...x, status: "resolvido" } : x));
  }
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

      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--offwhite)", marginBottom: 14 }}>
          Reports de pagamento {reports.filter(r => r.status === "pendente").length > 0 && (
            <span style={{ background: "var(--laranja)", color: "#000", borderRadius: 99, padding: "2px 8px", fontSize: 10, marginLeft: 8 }}>
              {reports.filter(r => r.status === "pendente").length} novo{reports.filter(r => r.status === "pendente").length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {reports.length === 0 && (
          <div style={{ fontSize: 12, color: "rgba(245,240,232,.3)", padding: "16px 0" }}>Nenhum report ainda.</div>
        )}
        {reports.map(r => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--card-bg)", border: `1px solid ${r.status === "resolvido" ? "rgba(74,222,128,.15)" : "rgba(255,92,26,.25)"}`, borderRadius: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--offwhite)" }}>{r.joiner_nome}</div>
              <div style={{ fontSize: 11, color: "rgba(245,240,232,.4)", marginTop: 2 }}>
                Forms preenchido em: <strong style={{ color: "var(--offwhite)" }}>{new Date(r.data_forms + "T12:00:00").toLocaleDateString("pt-BR")}</strong>
                {r.observacao && <> · {r.observacao}</>}
              </div>
              <div style={{ fontSize: 10, color: "rgba(245,240,232,.25)", marginTop: 2 }}>
                Reportado em {new Date(r.created_at).toLocaleString("pt-BR")}
              </div>
            </div>
            {r.status === "pendente" ? (
              <button onClick={() => marcarResolvido(r.id)} style={{ background: "rgba(74,222,128,.1)", border: "1px solid rgba(74,222,128,.3)", color: "#4ade80", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>
                Resolver ✓
              </button>
            ) : (
              <span style={{ fontSize: 11, color: "#4ade80" }}>✓ resolvido</span>
            )}
          </div>
        ))}
      </div>
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
    icon: "💳",
    title: "Forms de Pagamento",
    text: "No topo da Masterlist, toque no card 'Forms de Pagamento' (CLIQUE AQUI) para abrir o formulário e enviar o comprovante dos itens em aberto."
  },
  {
    icon: "◉",
    title: "Status do item",
    text: "Os chips coloridos mostram a etapa atual: Pré-venda → Na Warehouse → A Caminho → Enviado Nacional. Quanto mais à direita, mais perto de chegar!"
  },
  {
    icon: "R$",
    title: "Pagamentos",
    text: "Cada item mostra os valores separados: item, frete e taxa RF. Verde = Pago, Laranja = Pendente. O total fica branco quando tudo está pago."
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
    if (adminPortalInput === user?.senha || isAdminUser(user)) {
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
      if (!jaConfirmou && perfilPushAtivo) setShowPerfilModal(true);
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

  function handleVerCegs() {
    setUser({ guest: true });
    setItens([]);
    setTab("cegs");
    setPage("portal");
  }

  if (page === "landing" || !user) return <LandingPage onLogin={handleLogin} onVerCegs={handleVerCegs} />;

  const isAdmin = isAdminUser(user);

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
          {user.guest ? (
            <button className="logout-btn" onClick={handleLogout}>ENTRAR →</button>
          ) : (
            <>
              <div className="topbar-user">
                <div className="user-dot" />
                <span className="user-email">{user.email || `COG ${user.cog}`}</span>
              </div>
              <button className="logout-btn" onClick={handleLogout}>Sair ↗</button>
            </>
          )}
        </div>
      </div>
      <div className="tabs-bar">
        <button className={`tab-btn ${tab === "masterlist" ? "active" : ""}`} onClick={() => setTab("masterlist")}>☰ Masterlist</button>
        <button className={`tab-btn ${tab === "cegs" ? "active" : ""}`} onClick={() => setTab("cegs")}>◈ CEGs</button>
        <button className={`tab-btn ${tab === "calendario" ? "active" : ""}`} onClick={() => setTab("calendario")}>◫ Calendário</button>
        {!user.guest && <button className={`tab-btn ${tab === "perfil" ? "active" : ""}`} onClick={() => setTab("perfil")}>⚙ Meu Perfil</button>}
        <button className={`tab-btn ${tab === "regras" ? "active" : ""}`} onClick={() => setTab("regras")}>☆ Regras</button>
        <button className={`tab-btn ${tab === "tutorial" ? "active" : ""}`} onClick={() => setTab("tutorial")}>? Tutorial</button>
        {isAdminUser(user) && (
          <button className={`tab-btn ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>⚙ Admin</button>
        )}
      </div>
      {tab === "masterlist" && <MasterlistTab user={user} itens={itens} onLogin={() => setPage("landing")} />}
      {tab === "cegs" && <CegTab user={user} itens={itens} />}
      {tab === "calendario" && <CalendarTab user={user} itens={itens} />}
      {!user.guest && tab === "perfil" && <PerfilTab user={user} onUpdate={setUser} />}
      {tab === "regras" && <RegrasTab />}
      {tab === "tutorial" && <TutorialTab />}
      {tab === "admin" && isAdminUser(user) && <AdminTab />}
    </div>
  );
}