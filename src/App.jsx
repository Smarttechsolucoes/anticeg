import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import emailjs from "@emailjs/browser";
import "./App.css";
import LandingPage from "./LandingPage";
import bonequinha from "./assets/bonequinha.png";

// ── EmailJS config ── preencha após criar conta em emailjs.com
const EJS_SERVICE  = "service_wguc7si";
const EJS_TEMPLATE = "template_3x4zqua";
const EJS_KEY      = "FoEjO0bZC4mn9ebeN";

async function sendEmailJoiner(toEmail, toNome, assunto, corpo) {
  if (!toEmail || EJS_SERVICE.startsWith("YOUR")) return;
  try {
    await emailjs.send(EJS_SERVICE, EJS_TEMPLATE, {
      to_email: toEmail,
      to_name:  toNome  || "joiner",
      assunto,
      corpo,
    }, EJS_KEY);
  } catch (e) {
    console.error("[EmailJS]", e);
  }
}

function buildEmailHTML(_toNome, contentRows) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ANTICEG</title></head>
<body style="margin:0;padding:0;background:#1a1a1a;font-family:'Courier New',Courier,monospace">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
  <tr>
    <td align="center" style="background:#0D0D0D;padding:40px 40px 34px;border-bottom:3px solid #FF5C1A">
      <div style="font-size:34px;font-weight:900;color:#F5F0E8;letter-spacing:5px;margin-bottom:6px">ANTI<span style="color:#FF5C1A">CEG</span></div>
      <div style="font-size:9px;letter-spacing:3px;color:rgba(245,240,232,0.3);text-transform:uppercase">comunidade antigom &middot; compras em grupo</div>
    </td>
  </tr>
  <tr>
    <td style="background:#111111;padding:32px 40px 8px">
      <div style="font-size:22px;font-weight:700;color:#F5F0E8">Ol&aacute;, anti!</div>
    </td>
  </tr>
  ${contentRows}
  <tr>
    <td style="background:#111111;padding:8px 40px 24px">
      <div style="height:1px;background:rgba(255,92,26,0.2);margin-bottom:24px"></div>
      <p style="margin:0;font-size:12px;color:#F5F0E8;line-height:1.75">Caso o pagamento j&aacute; tenha sido realizado, abra um chamado pelo bot&atilde;o <strong>&ldquo;Reportar Erro&rdquo;</strong> dentro do portal para que possamos verificar.</p>
    </td>
  </tr>
  <tr>
    <td align="center" style="background:#111111;padding:0 40px 28px">
      <a href="https://anticeg.vercel.app/masterlist" style="display:inline-block;background:#FF5C1A;color:#ffffff;text-decoration:none;font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:14px 36px;border-radius:4px">ACESSAR O PORTAL &rarr;</a>
    </td>
  </tr>
  <tr>
    <td style="background:#111111;padding:0 40px 36px">
      <p style="margin:0 0 20px;font-size:11px;color:rgba(245,240,232,0.38);line-height:1.75">Para acessar sua conta, basta informar o e-mail utilizado nos pagamentos da comunidade ou o @ utilizado para realizar claims.</p>
      <p style="margin:0;font-size:10px;color:rgba(245,240,232,0.18);line-height:1.6">Esta &eacute; uma mensagem autom&aacute;tica enviada pelo sistema.</p>
    </td>
  </tr>
  <tr>
    <td align="center" style="background:#0D0D0D;padding:24px 40px;border-top:1px solid #1e1e1e">
      <div style="font-size:15px;font-weight:900;color:#F5F0E8;letter-spacing:3px;margin-bottom:4px">ANTI<span style="color:#FF5C1A">CEG</span></div>
      <div style="font-size:9px;color:rgba(245,240,232,0.2);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px">comunidade antigom</div>
      <div><a href="https://anticeg.vercel.app" style="color:rgba(245,240,232,0.3);text-decoration:none;font-size:10px;margin:0 8px">Portal</a><span style="color:rgba(245,240,232,0.1)">&middot;</span><a href="https://wa.me/5524992501917" style="color:rgba(245,240,232,0.3);text-decoration:none;font-size:10px;margin:0 8px">WhatsApp</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const pf = v => parseFloat(String(v ?? 0).replace(",", ".")) || 0;

const supabase = createClient(
  "https://ghjfsmwwcfpfvrouyrka.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM"
);

const WHATSAPP_NUM = "5524992501917";
const OWNER_EMAILS = ["nandag_medeiros@hotmail.com"];
const OWNER_COGS   = ["nandaverseo_c"];
const STAFF_EMAILS = ["nathallynayane1234@gmail.com"];
const STAFF_COGS   = ["nathy_mrnd"];
const SESSION_VERSION = "2";
function isAdminUser(user) {
  return OWNER_EMAILS.includes(user?.email) || OWNER_COGS.includes(user?.cog) || user?.twitter === "@nandaverseo_c"
      || STAFF_EMAILS.includes(user?.email) || STAFF_COGS.includes(user?.cog);
}
function isOwner(user) {
  return OWNER_EMAILS.includes(user?.email) || OWNER_COGS.includes(user?.cog) || user?.twitter === "@nandaverseo_c";
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
  { id: "Enviado Nacional", label: "Finalizado",       icon: "🚚" },
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
  "Enviado Nacional":["chip-enviado",   "Finalizado"],
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

function diasAtraso(vencimento) {
  if (!vencimento) return 0;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const venc = new Date(vencimento + "T12:00:00");
  const diff = Math.floor((hoje - venc) / 86400000);
  return diff > 0 ? diff : 0;
}

function ValCell({ val, status, vencimento }) {
  if (!Number(val)) return <span className="zero-val">—</span>;
  const pendente = isPendente(status);
  const cls = pendente ? "pend" : "pago";
  const dias = pendente ? diasAtraso(vencimento) : 0;
  const multa = dias * 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className={`td-val ${cls}`}>R${fmtBRL(val)}</span>
      <PayBadge status={status} />
      {dias > 0 && (
        <span style={{ fontSize: 9, fontWeight: 700, color: "#ff6b6b", background: "rgba(255,107,107,.12)", border: "1px solid rgba(255,107,107,.3)", borderRadius: 4, padding: "1px 5px", letterSpacing: ".05em", whiteSpace: "nowrap" }}>
          ⚠ multa R${fmtBRL(multa)} ({dias}d)
        </span>
      )}
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
                        <span className="ceg-item-name"><InfoContent info={item.nome_do_item} /></span>
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

function CegDetailView({ ceg, onVoltar, guest, user }) {
  const [itens, setItens] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(null);
  const [reportItem, setReportItem] = useState(null);

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
            <button onClick={onVoltar} style={{ background:"none", border:"none", color:"rgba(245,240,232,.62)", fontFamily:"'DM Mono',monospace", fontSize:"var(--fs-xs)", cursor:"pointer", padding:0, letterSpacing:1 }}>← voltar</button>
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
        <div style={{ padding:40, textAlign:"center", color:"rgba(245,240,232,.52)", fontSize:"var(--fs-xs)" }}>carregando...</div>
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
                      <td><div className="item-title"><InfoContent info={item.nome_do_item} /></div></td>
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
                        {item.info_adicionais && <div className="item-detail"><InfoContent info={item.info_adicionais} /></div>}
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
                <div className="ml-card-name"><InfoContent info={item.nome_do_item} /></div>
                <div className="ml-card-vals">
                  {Number(item.valor_item) > 0 && <div className="ml-val-row"><span className="ml-val-label">item</span><ValCell val={item.valor_item} status={item.pago_item} vencimento={item.venc_item} /></div>}
                  {Number(item.frete_inter) > 0 && <div className="ml-val-row"><span className="ml-val-label">frete</span><ValCell val={item.frete_inter} status={item.pago_frete} vencimento={item.venc_frete} /></div>}
                  {Number(item.taxa_rf) > 0 && <div className="ml-val-row"><span className="ml-val-label">taxa RF</span><ValCell val={item.taxa_rf} status={item.pago_rf} vencimento={item.venc_rf} /></div>}
                  {total > 0 && <div className={`ml-val-total${isPendente(item.pago_item) || isPendente(item.pago_frete) || isPendente(item.pago_rf) ? "" : " ml-val-total-pago"}`}>total R${fmtBRL(total)}</div>}
                </div>
                {item.info_adicionais && <div className="ml-card-info"><InfoContent info={item.info_adicionais} /></div>}
                <div className="ml-card-footer">
                  <button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)}>▾</button>
                  {!guest && <button className="report-row-btn" onClick={() => setReportItem(item)}>⚑ Reportar</button>}
                </div>
                {isOpen && <div className="ml-card-timeline"><Timeline activeIdx={ai} /></div>}
              </div>
            );
          })}
        </div>
      )}

      {reportItem && <ReportModal user={user} item={reportItem} onClose={() => setReportItem(null)} />}
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

  if (detalhe) return <CegDetailView ceg={detalhe} onVoltar={() => setDetalhe(null)} guest={guest} user={user} />;

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
  const [erros, setErros] = useState({ item: false, valor: false, frete: false, taxa: false, pagamento: false, recebido: false, outro: false });
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
      status:          "pendente",
      erro_item:       erros.item,
      erro_valor:      erros.valor,
      erro_frete:      erros.frete,
      erro_taxa:       erros.taxa,
      erro_pagamento:  erros.pagamento,
      erro_recebido:   erros.recebido,
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
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}><InfoContent info={item.nome_do_item} /></div>

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
              <CheckRow k="recebido" label="Já recebi esse item" />
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

const INFO_LIMIT = 72;

function cleanUrl(raw) {
  try { return new URL(raw).origin + new URL(raw).pathname; } catch { return raw; }
}

function InfoContent({ info }) {
  const [expandido, setExpandido] = useState(false);
  if (!info) return null;
  const isUrl = /^https?:\/\//i.test(info.trim());
  if (isUrl) {
    const href = info.trim();
    const label = cleanUrl(href).replace(/^https?:\/\//, "");
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        style={{ fontSize:11, color:"rgba(201,168,240,.7)", textDecoration:"none", wordBreak:"break-all", lineHeight:1.5 }}
        onMouseEnter={e => e.currentTarget.style.textDecoration="underline"}
        onMouseLeave={e => e.currentTarget.style.textDecoration="none"}>
        {label} ↗
      </a>
    );
  }
  const longo = info.length > INFO_LIMIT;
  const texto = longo && !expandido ? info.slice(0, INFO_LIMIT) + "…" : info;
  return (
    <div style={{ fontSize:11, color:"rgba(245,240,232,.45)", lineHeight:1.5, wordBreak:"break-word" }}>
      {texto}
      {longo && (
        <button onClick={() => setExpandido(e => !e)} style={{ background:"none", border:"none", color:"rgba(245,240,232,.52)", fontSize:10, cursor:"pointer", padding:"0 0 0 4px", fontFamily:"'DM Mono',monospace" }}>
          {expandido ? "menos" : "ler mais"}
        </button>
      )}
    </div>
  );
}

function InfoCell({ info, isOpen, onToggleDrawer, onReport }) {
  return (
    <div style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
      <button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={onToggleDrawer} style={{ flexShrink:0, marginTop:1 }}>▾</button>
      <button onClick={onReport} className="report-row-btn" style={{ flexShrink:0, marginTop:1 }}>⚑ Reportar erro</button>
      <InfoContent info={info} />
    </div>
  );
}

const ENVIO_STEPS = [
  "solicitação de envio",
  "cotação em andamento",
  "pagamento em aberto",
  "pagamento confirmado",
  "embalando",
  "enviado",
];
const ENVIO_STEP_COLORS = {
  "solicitação de envio":"#BAFF39", "cotação em andamento":"#FF5C1A",
  "pagamento em aberto":"#C9A8F0", "pagamento confirmado":"#FFD166",
  embalando:"#64B5F6", enviado:"#BAFF39", cancelado:"rgba(245,240,232,.3)",
};
const ENVIO_STATUS_LABEL = {
  "solicitação de envio": "Cotação enviada",
  "cotação em andamento": "Cotação em andamento",
  "pagamento em aberto":  "Pgto. em aberto",
  "pagamento confirmado": "Pgto. confirmado",
  "embalando":            "Embalando",
  "enviado":              "Finalizado",
};

function EnvioMiniBar({ status }) {
  const idx = ENVIO_STEPS.indexOf(status);
  const color = ENVIO_STEP_COLORS[status] || "rgba(245,240,232,.3)";
  return (
    <div style={{ display:"flex", gap:2, marginTop:4 }}>
      {ENVIO_STEPS.slice(0, -1).map((_, i) => (
        <div key={i} style={{ flex:1, height:3, borderRadius:2,
          background: i < idx ? color : i === idx ? color : "rgba(245,240,232,.12)",
          opacity: i > idx ? 1 : 1 }} />
      ))}
    </div>
  );
}

const ENVIO_STEP_LABELS_SHORT = [
  "Cotação\nenviada", "Cotação\nem andamento", "Pgto.\nem aberto",
  "Pgto.\nconfirmado", "Embalando", "Finalizado",
];

function EnvioFlowStepper({ status }) {
  const idx = ENVIO_STEPS.indexOf(status);
  const color = ENVIO_STEP_COLORS[status] || "rgba(245,240,232,.35)";
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:0, padding:"10px 4px 4px", overflowX:"auto" }}>
      {ENVIO_STEPS.map((step, i) => {
        const isPast    = i < idx;
        const isCurrent = i === idx;
        const isFuture  = i > idx;
        return (
          <div key={i} style={{ display:"flex", alignItems:"flex-start", flex:1, minWidth:44 }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
              {/* dot */}
              <div style={{ width:10, height:10, borderRadius:"50%", flexShrink:0,
                background: isCurrent ? color : isPast ? color : "transparent",
                border: `2px solid ${isCurrent ? color : isPast ? color : "rgba(245,240,232,.15)"}`,
                boxShadow: isCurrent ? `0 0 6px ${color}88` : "none",
              }} />
              {/* label */}
              <div style={{ marginTop:5, fontSize:8, fontFamily:"'DM Mono',monospace", textAlign:"center", lineHeight:1.4, whiteSpace:"pre-line",
                color: isCurrent ? color : isPast ? "rgba(245,240,232,.45)" : "rgba(245,240,232,.2)",
                fontWeight: isCurrent ? 700 : 400,
              }}>{ENVIO_STEP_LABELS_SHORT[i]}</div>
            </div>
            {/* connecting line */}
            {i < ENVIO_STEPS.length - 1 && (
              <div style={{ height:2, flex:1, marginTop:4, borderRadius:1, flexShrink:0, minWidth:8,
                background: i < idx ? color : "rgba(245,240,232,.08)",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MasterlistTab({ user, itens, onLogin, pushAtivos = [] }) {
  const guest = user.guest;
  const [search, setSearch] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("tudo");
  const [ordenacao, setOrdenacao] = useState("padrao");
  const [openDrawer, setOpenDrawer] = useState(null);
  const [cegModal, setCegModal] = useState(null);
  const [reportItem, setReportItem] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [avisosModal, setAvisosModal] = useState(false);
  const [envioByItem,      setEnvioByItem]      = useState({});
  const [showFinalizados,  setShowFinalizados]  = useState(false);

  useEffect(() => {
    if (guest || !user.cog) return;
    supabase.from("envio_solicitacoes").select("id,status,itens").eq("joiner_cog", user.cog)
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach(s => (s.itens || []).forEach(it => { map[it.id] = s; }));
        setEnvioByItem(map);
      });
  }, [user.cog, guest]);

  useEffect(() => {
    supabase.from("pushes").select("*").eq("active", true)
      .or(`joiner_cog.is.null,joiner_cog.eq.${user.cog}`)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        if (!data?.length) { setAvisos([]); return; }
        if (user.guest) { setAvisos(data); return; }
        const { data: lidos } = await supabase.from("push_reads").select("push_id").eq("joiner_cog", user.cog);
        const lidosIds = new Set((lidos || []).map(r => r.push_id));
        setAvisos(data.filter(p => !lidosIds.has(p.id)));
      });
  }, []);

  async function marcarLido(pushId) {
    if (!user.guest) await supabase.from("push_reads").insert([{ push_id: pushId, joiner_cog: user.cog }]);
    setAvisos(prev => prev.filter(a => a.id !== pushId));
  }

  const totalV = itens.reduce((a, b) => a + Number(b.valor_item||0) + Number(b.frete_inter||0) + Number(b.taxa_rf||0), 0);
  const pagoV  = itens.reduce((a,b) =>
    a + (b.pago_item  ? Number(b.valor_item||0)  : 0)
      + (b.pago_frete ? Number(b.frete_inter||0) : 0)
      + (b.pago_rf    ? Number(b.taxa_rf||0)     : 0), 0);
  const pendV = totalV - pagoV;
  const cegs  = [...new Set(itens.map(i => i.ceg))].length;

  const today = new Date(); today.setHours(0,0,0,0);
  const parseLocalDate = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
  const vencDates = [];
  itens.forEach(i => {
    if (i.venc_item     && isPendente(i.pago_item))     vencDates.push({ d: parseLocalDate(i.venc_item),     label: "Item: " + i.ceg });
    if (i.venc_frete    && isPendente(i.pago_frete))   vencDates.push({ d: parseLocalDate(i.venc_frete),    label: "Frete: " + i.ceg });
    if (i.venc_rf       && isPendente(i.pago_rf))      vencDates.push({ d: parseLocalDate(i.venc_rf),       label: "Taxa: " + i.ceg });
  });
  const nextVenc = vencDates.filter(v => v.d >= today).sort((a,b) => a.d - b.d)[0];
  const qtdAtrasados = vencDates.filter(v => v.d < today).length;

  let filtered = [...itens];
  if (search) filtered = filtered.filter(i => (i.nome_do_item || "").toLowerCase().includes(search));
  if (STATUS_STEPS.some(s => s.id === statusFiltro)) filtered = filtered.filter(i => i.status === statusFiltro);
  if (statusFiltro === "pendente")    filtered = filtered.filter(i =>
    (isPendente(i.pago_item)  && Number(i.valor_item||0)  > 0) ||
    (isPendente(i.pago_frete) && Number(i.frete_inter||0) > 0) ||
    (isPendente(i.pago_rf)    && Number(i.taxa_rf||0)     > 0)
  );
  if (statusFiltro === "envio") filtered = filtered.filter(i => {
    const es = envioByItem[i.id]?.status;
    return es && es !== "cancelado" && i.status !== "Enviado Nacional";
  });
  const filteredAtivos      = statusFiltro === "tudo" ? filtered.filter(i => i.status !== "Enviado Nacional") : filtered;
  const filteredFinalizados = statusFiltro === "tudo" ? filtered.filter(i => i.status === "Enviado Nacional") : [];
  if (ordenacao === "ceg")      filtered.sort((a,b) => (a.ceg||"").localeCompare(b.ceg||""));
  if (ordenacao === "venc")     filtered.sort((a,b) => {
    const va = [a.venc_item, a.venc_frete, a.venc_rf].filter(Boolean).sort()[0] || "9999";
    const vb = [b.venc_item, b.venc_frete, b.venc_rf].filter(Boolean).sort()[0] || "9999";
    return va.localeCompare(vb);
  });
  if (ordenacao === "valor-desc") filtered.sort((a,b) =>
    (Number(b.valor_item||0)+Number(b.frete_inter||0)+Number(b.taxa_rf||0)) -
    (Number(a.valor_item||0)+Number(a.frete_inter||0)+Number(a.taxa_rf||0))
  );
  if (ordenacao === "valor-asc")  filtered.sort((a,b) =>
    (Number(a.valor_item||0)+Number(a.frete_inter||0)+Number(a.taxa_rf||0)) -
    (Number(b.valor_item||0)+Number(b.frete_inter||0)+Number(b.taxa_rf||0))
  );

  const tTotal = filtered.reduce((a,b) => a+Number(b.valor_item||0)+Number(b.frete_inter||0)+Number(b.taxa_rf||0), 0);
  const tPend  = filtered.reduce((a,b) =>
    a + (isPendente(b.pago_item)  ? Number(b.valor_item||0)  : 0)
      + (isPendente(b.pago_frete) ? Number(b.frete_inter||0) : 0)
      + (isPendente(b.pago_rf)    ? Number(b.taxa_rf||0)     : 0), 0);
  const tMulta = itens.reduce((a,b) =>
    a + (isPendente(b.pago_item)  ? diasAtraso(b.venc_item)  : 0)
      + (isPendente(b.pago_frete) ? diasAtraso(b.venc_frete) : 0)
      + (isPendente(b.pago_rf)    ? diasAtraso(b.venc_rf)    : 0), 0);


  const temPendente = !guest && pendV > 0;
  const temAntigomEmAberto = !guest && itens.some(i =>
    i.status === "ANTIGOM" && (
      (i.pago_item  === false && Number(i.valor_item  || 0) > 0) ||
      (i.pago_frete === false && Number(i.frete_inter || 0) > 0) ||
      (i.pago_rf    === false && Number(i.taxa_rf     || 0) > 0)
    )
  );

  return (
    <div className="main">
      {reportItem && <ReportModal user={user} item={reportItem} onClose={() => setReportItem(null)} />}
      {!guest && (
        <div className="notif-info">
          ℹ Os pagamentos foram atualizados de acordo com o preenchimento do forms de pagamento no dia 23/06/2026 às 15:49. Caso tenha realizado após esse horário, ainda será atualizado.
        </div>
      )}
      {temAntigomEmAberto && (
        <div className="notif-pagamento">
          ⚠ Verifique os pagamentos em aberto para liberar seu envio nacional
        </div>
      )}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">anticeg · visão completa</div>
          <div className="page-title">MASTER<span>LIST</span></div>
        </div>
        <div className="page-header-right">
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
        {!guest && (
          <div className="sum-card" style={{ borderColor: tMulta > 0 ? "rgba(255,107,107,.25)" : undefined }}>
            <div className="sum-label">Total a pagar</div>
            <div className="sum-value" style={{ color: tMulta > 0 ? "#ff6b6b" : "var(--lilas)" }}>
              R${fmtBRL(tPend + tMulta)}
            </div>
            {tMulta > 0
              ? <div className="sum-sub" style={{ color:"rgba(255,107,107,.7)" }}>R${fmtBRL(tPend)} + R${fmtBRL(tMulta)} multa</div>
              : <div className="sum-sub">sem atraso</div>
            }
          </div>
        )}
        <div className="sum-card">
          <div className="sum-label">Próx. vencimento</div>
          <div className="sum-value yellow">{!guest && nextVenc ? `${String(nextVenc.d.getDate()).padStart(2,"0")}/${String(nextVenc.d.getMonth()+1).padStart(2,"0")}` : "—"}</div>
          <div className="sum-sub">{!guest && nextVenc ? nextVenc.label : (!guest ? "sem vencimento" : "—")}</div>
        </div>
        {avisos.length > 0 && (
          <button onClick={() => setAvisosModal(true)} className="sum-card" style={{
            border:"1px solid rgba(201,168,240,.3)", textAlign:"left", cursor:"pointer"
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div className="sum-label">Mural de avisos</div>
              <span style={{ background:"#C9A8F0", color:"#111", borderRadius:99, fontSize:9, fontWeight:700, padding:"1px 6px", lineHeight:1.5 }}>{avisos.length}</span>
            </div>
            <div style={{ fontSize:12, color:"#C9A8F0", marginTop:6, lineHeight:1.5, fontFamily:"'DM Mono',monospace", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
              {avisos[0].message}
            </div>
            <div className="sum-sub" style={{ marginTop:4 }}>
              {avisos.length > 1 ? `${avisos.length} avisos não lidos` : "1 aviso não lido"}
            </div>
          </button>
        )}
      </div>

      {avisosModal && (
        <div className="modal-overlay" onClick={() => setAvisosModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:480 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:1, color:"var(--offwhite)" }}>
                  MURAL DE <span style={{ color:"#C9A8F0" }}>AVISOS</span>
                </div>
                <div style={{ fontSize:11, color:"rgba(245,240,232,.58)", marginTop:2 }}>{avisos.length} aviso{avisos.length !== 1 ? "s" : ""} não lido{avisos.length !== 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => setAvisosModal(false)} style={{ background:"none", border:"none", color:"rgba(245,240,232,.52)", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {avisos.map((a, i) => (
                <div key={a.id} style={{ background:"rgba(201,168,240,.06)", border:"1px solid rgba(201,168,240,.18)", borderRadius:10, padding:"16px 18px" }}>
                  <div style={{ fontSize:10, color:"rgba(201,168,240,.45)", fontFamily:"'DM Mono',monospace", marginBottom:8 }}>
                    {avisos.length > 1 && <span style={{ letterSpacing:".1em", textTransform:"uppercase", marginRight:8 }}>Aviso {i + 1} ·</span>}
                    {new Date(a.created_at).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                  </div>
                  <div style={{ fontSize:13, color:"var(--offwhite)", lineHeight:1.75, fontFamily:"'DM Mono',monospace", marginBottom:14 }}>{a.message}</div>
                  <button onClick={() => marcarLido(a.id)} style={{
                    background:"rgba(201,168,240,.12)", border:"1px solid rgba(201,168,240,.3)",
                    color:"#C9A8F0", borderRadius:6, padding:"6px 14px",
                    fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".05em"
                  }}>✓ Marcar como lido</button>
                </div>
              ))}
              {avisos.length > 1 && (
                <button onClick={() => { avisos.forEach(a => marcarLido(a.id)); setAvisosModal(false); }} style={{
                  background:"rgba(201,168,240,.08)", border:"1px solid rgba(201,168,240,.2)",
                  color:"rgba(201,168,240,.6)", borderRadius:8, padding:"10px",
                  fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".05em"
                }}>✓ Marcar todos como lido</button>
              )}
            </div>
          </div>
        </div>
      )}

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
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} style={{
          background:"#0d0d0d", border:"1px solid rgba(245,240,232,.18)", color:"rgba(245,240,232,.8)",
          borderRadius:6, padding:"5px 10px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", outline:"none"
        }}>
          <option value="tudo">Tudo</option>
          <option value="pendente">Pendente</option>
          <option value="envio">Em envio</option>
          {STATUS_STEPS.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} style={{
          background:"#0d0d0d", border:"1px solid rgba(245,240,232,.18)", color:"rgba(245,240,232,.8)",
          borderRadius:6, padding:"5px 10px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", outline:"none"
        }}>
          <option value="padrao">Ordenar: padrão</option>
          <option value="ceg">CEG A → Z</option>
          <option value="venc">Vencimento mais próximo</option>
          <option value="valor-desc">Valor ↓</option>
          <option value="valor-asc">Valor ↑</option>
        </select>
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
            {filteredAtivos.length === 0 && filteredFinalizados.length === 0 && (
              <tr><td colSpan={7} className="empty-cell">nenhum item para esse filtro</td></tr>
            )}
            {filteredAtivos.map(item => {
              const ai = getStepIdx(item.status);
              const isOpen = openDrawer === item.id;
              const envioSolic = envioByItem[item.id];
              const envioStatus = envioSolic?.status;
              const showEnvio = envioStatus && envioStatus !== "cancelado" && item.status !== "Enviado Nacional";
              const envioColor = ENVIO_STEP_COLORS[envioStatus] || "rgba(245,240,232,.5)";
              return (
                <>
                  <tr key={item.id} style={item.info_adicionais?.toUpperCase().includes("REEMBOLSO") ? { outline:"2px solid rgba(220,50,50,.55)", outlineOffset:"-2px" } : {}}>
                    <td className="td-ceg"><button className="ceg-btn" onClick={() => setCegModal(item.ceg)}>{item.ceg}</button></td>
                    <td><div className="item-title"><InfoContent info={item.nome_do_item} /></div></td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.valor_item} status={item.pago_item} vencimento={item.venc_item} adminPreview={isAdminUser(user)} />}</td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.frete_inter} status={item.pago_frete} vencimento={item.venc_frete} adminPreview={isAdminUser(user)} />}</td>
                    <td>{guest ? <span className="zero-val">—</span> : (Number(item.taxa_rf) > 0 ? <ValCell val={item.taxa_rf} status={item.pago_rf} vencimento={item.venc_rf} adminPreview={isAdminUser(user)} /> : <span className="zero-val">—</span>)}</td>
                    <td>
                      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                        {showEnvio ? (
                          <>
                            <span style={{ fontSize:9, color:envioColor, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".05em" }}>{ENVIO_STATUS_LABEL[envioStatus] || envioStatus}</span>
                            <EnvioMiniBar status={envioStatus} />
                          </>
                        ) : (
                          <>
                            <StatusChip status={item.status} />
                            {item.status !== "Enviado Nacional" && <ProgressMini activeIdx={ai} />}
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <InfoCell
                        info={item.info_adicionais}
                        isOpen={isOpen}
                        itemId={item.id}
                        onToggleDrawer={() => setOpenDrawer(isOpen ? null : item.id)}
                        onReport={() => setReportItem(item)}
                      />
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
            {filteredAtivos.length > 0 && !guest && (
              <tr className="total-row">
                <td colSpan={2}><span className="total-label">Total visível</span></td>
                <td><span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"rgba(245,240,232,.52)"}}>{filteredAtivos.length} itens</span></td>
                <td colSpan={3}><span className="total-val">R${fmtBRL(tTotal)}</span></td>
                <td>
                  {tPend > 0 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                      <span className="total-pend">↗ R${fmtBRL(tPend + tMulta)} a pagar</span>
                      {tMulta > 0 && <span style={{ fontSize:10, color:"rgba(255,107,107,.6)", fontFamily:"'DM Mono',monospace" }}>+R${fmtBRL(tMulta)} multa</span>}
                    </div>
                  )}
                </td>
              </tr>
            )}
            {filteredFinalizados.length > 0 && (
              <tr>
                <td colSpan={7} style={{ padding:"4px 0" }}>
                  <button onClick={() => setShowFinalizados(v => !v)} style={{ background:"none", border:"none", color:"rgba(245,240,232,.48)", fontFamily:"'DM Mono',monospace", fontSize:"var(--fs-xs)", letterSpacing:"1px", cursor:"pointer", padding:"6px 0" }}>
                    {showFinalizados ? "▲" : "▼"} {filteredFinalizados.length} finalizado(s)
                  </button>
                </td>
              </tr>
            )}
            {showFinalizados && filteredFinalizados.map(item => {
              const ai = getStepIdx(item.status);
              const isOpen = openDrawer === item.id;
              return (
                <>
                  <tr key={item.id} className="row-finalizado">
                    <td className="td-ceg"><button className="ceg-btn" onClick={() => setCegModal(item.ceg)}>{item.ceg}</button></td>
                    <td><div className="item-title"><InfoContent info={item.nome_do_item} /></div></td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.valor_item} status={item.pago_item} vencimento={item.venc_item} adminPreview={isAdminUser(user)} />}</td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.frete_inter} status={item.pago_frete} vencimento={item.venc_frete} adminPreview={isAdminUser(user)} />}</td>
                    <td>{guest ? <span className="zero-val">—</span> : (Number(item.taxa_rf) > 0 ? <ValCell val={item.taxa_rf} status={item.pago_rf} vencimento={item.venc_rf} adminPreview={isAdminUser(user)} /> : <span className="zero-val">—</span>)}</td>
                    <td><StatusChip status={item.status} /></td>
                    <td><InfoCell info={item.info_adicionais} isOpen={isOpen} itemId={item.id} onToggleDrawer={() => setOpenDrawer(isOpen ? null : item.id)} onReport={() => setReportItem(item)} /></td>
                  </tr>
                  {isOpen && <tr key={`drawer-${item.id}`} className="drawer-row"><td colSpan={7}><Timeline activeIdx={ai} /></td></tr>}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Mobile cards — hidden on desktop via CSS */}
      <div className="ml-cards">
        {filteredAtivos.length === 0 && filteredFinalizados.length === 0 && (
          <div style={{ padding:"32px 0", textAlign:"center", color:"rgba(245,240,232,.52)", fontSize:"var(--fs-xs)" }}>nenhum item para esse filtro</div>
        )}
        {filteredAtivos.map(item => {
          const ai = getStepIdx(item.status);
          const isOpen = openDrawer === item.id;
          const total = Number(item.valor_item||0)+Number(item.frete_inter||0)+Number(item.taxa_rf||0);
          const pendItem  = !guest && isPendente(item.pago_item)  && Number(item.valor_item) > 0;
          const pendFrete = !guest && isPendente(item.pago_frete) && Number(item.frete_inter) > 0;
          const pendRf    = !guest && isPendente(item.pago_rf)    && Number(item.taxa_rf) > 0;
          const temPendente = pendItem || pendFrete || pendRf;
          const totalPend = (pendItem  ? Number(item.valor_item||0)  : 0)
                          + (pendFrete ? Number(item.frete_inter||0) : 0)
                          + (pendRf    ? Number(item.taxa_rf||0)     : 0);
          const multaItem = (pendItem  ? diasAtraso(item.venc_item)  : 0)
                          + (pendFrete ? diasAtraso(item.venc_frete) : 0)
                          + (pendRf    ? diasAtraso(item.venc_rf)    : 0);
          const envioSolicCard = envioByItem[item.id];
          const envioStatusCard = envioSolicCard?.status;
          const showEnvioCard = envioStatusCard && envioStatusCard !== "cancelado" && item.status !== "Enviado Nacional";
          return (
            <div key={item.id} className="ml-card" style={item.info_adicionais?.toUpperCase().includes("REEMBOLSO") ? { border:"1.5px solid rgba(220,50,50,.55)" } : {}}>
              <div className="ml-card-top">
                <button className="ceg-btn" onClick={() => setCegModal(item.ceg)}>{item.ceg}</button>
                {showEnvioCard ? (
                  <div style={{ textAlign:"right" }}>
                    <span style={{ fontSize:9, color: ENVIO_STEP_COLORS[envioStatusCard] || "rgba(245,240,232,.5)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".05em" }}>{ENVIO_STATUS_LABEL[envioStatusCard] || envioStatusCard}</span>
                    <EnvioMiniBar status={envioStatusCard} />
                  </div>
                ) : (
                  <StatusChip status={item.status} />
                )}
              </div>
              <div className="ml-card-name"><InfoContent info={item.nome_do_item} /></div>
              {temPendente && (
                <div className="ml-card-pend-banner">
                  <span className="ml-pend-dot" />
                  <span>
                    R${fmtBRL(totalPend + multaItem)} a pagar
                    {multaItem > 0 && <span style={{ fontSize:10, opacity:.7 }}> (R${fmtBRL(totalPend)} + R${fmtBRL(multaItem)} multa)</span>}
                  </span>
                  <span className="ml-pend-tags">
                    {[pendItem && "item", pendFrete && "frete", pendRf && "taxa RF"].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
              {item.info_adicionais && <div className="ml-card-info">{item.info_adicionais}</div>}
              {!guest && (
                <div className="ml-card-vals">
                  {Number(item.valor_item) > 0 && <div className="ml-val-row"><span className="ml-val-label">item</span><ValCell val={item.valor_item} status={item.pago_item} vencimento={item.venc_item} /></div>}
                  {Number(item.frete_inter) > 0 && <div className="ml-val-row"><span className="ml-val-label">frete</span><ValCell val={item.frete_inter} status={item.pago_frete} vencimento={item.venc_frete} /></div>}
                  {Number(item.taxa_rf) > 0 && <div className="ml-val-row"><span className="ml-val-label">taxa RF</span><ValCell val={item.taxa_rf} status={item.pago_rf} vencimento={item.venc_rf} /></div>}
                  {total > 0 && (
                    <div className={`ml-val-total${temPendente ? "" : " ml-val-total-pago"}`}>
                      total R${fmtBRL(total)}
                      {temPendente && multaItem > 0 && <span style={{ color:"rgba(255,107,107,.7)", marginLeft:6, fontSize:10 }}>+R${fmtBRL(multaItem)} multa</span>}
                    </div>
                  )}
                </div>
              )}
              <div className="ml-card-footer">
                <button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={() => setOpenDrawer(isOpen ? null : item.id)}>▾</button>
                {!guest && <button className="report-row-btn" onClick={() => setReportItem(item)}>⚑ Reportar erro</button>}
              </div>
              {isOpen && <div className="ml-card-timeline"><Timeline activeIdx={ai} /></div>}
            </div>
          );
        })}

        {filteredFinalizados.length > 0 && (
          <button onClick={() => setShowFinalizados(v => !v)} style={{ width:"100%", background:"none", border:"1px solid rgba(245,240,232,.1)", borderRadius:8, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace", fontSize:10, cursor:"pointer", padding:"10px 0", marginTop:4, letterSpacing:".05em" }}>
            {showFinalizados ? "▲" : "▼"} {filteredFinalizados.length} finalizado(s)
          </button>
        )}
        {showFinalizados && filteredFinalizados.map(item => {
          const ai = getStepIdx(item.status);
          const isOpen = openDrawer === item.id;
          return (
            <div key={item.id} className="ml-card row-finalizado">
              <div className="ml-card-top">
                <button className="ceg-btn" onClick={() => setCegModal(item.ceg)}>{item.ceg}</button>
                <StatusChip status={item.status} />
              </div>
              <div className="ml-card-name"><InfoContent info={item.nome_do_item} /></div>
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

function FeedbackForm({ user, defaultTipo }) {
  const [tipo, setTipo] = useState(defaultTipo || "sugestão");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleEnviar() {
    if (!message.trim()) return;
    setLoading(true);
    await supabase.from("feedbacks").insert([{
      joiner_cog:  user.cog,
      joiner_nome: user.nome || user.cog,
      tipo,
      message: message.trim(),
    }]);
    setLoading(false);
    setSent(true);
  }

  if (sent) return (
    <div style={{ textAlign:"center", padding:"40px 0" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>✓</div>
      <div style={{ fontSize:14, color:"var(--offwhite)", marginBottom:8 }}>Enviado!</div>
      <div style={{ fontSize:12, color:"rgba(245,240,232,.62)", marginBottom:20 }}>Obrigada pelo feedback. Vou dar uma olhada.</div>
      <button onClick={() => { setSent(false); setMessage(""); }} style={{ background:"none", border:"1px solid rgba(245,240,232,.15)", color:"rgba(245,240,232,.62)", borderRadius:6, padding:"6px 16px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>Enviar outro</button>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:12, color:"rgba(245,240,232,.45)", lineHeight:1.7 }}>
        Tem alguma sugestão de melhoria, encontrou um bug ou quer dar um feedback? Manda aqui!
      </div>
      <div style={{ display:"flex", gap:8 }}>
        {["bug", "sugestão", "elogio"].map(t => (
          <button key={t} onClick={() => setTipo(t)} style={{
            background: tipo === t ? "rgba(201,168,240,.15)" : "transparent",
            border: `1px solid ${tipo === t ? "rgba(201,168,240,.4)" : "rgba(245,240,232,.15)"}`,
            color: tipo === t ? "#C9A8F0" : "rgba(245,240,232,.4)",
            borderRadius:6, padding:"5px 14px", fontSize:11,
            fontFamily:"'DM Mono',monospace", cursor:"pointer", textTransform:"capitalize"
          }}>{t}</button>
        ))}
      </div>
      <textarea
        value={message} onChange={e => setMessage(e.target.value)}
        placeholder={tipo === "bug" ? "Descreva o que aconteceu..." : tipo === "elogio" ? "Conta o que você curtiu..." : "Qual melhoria você sugere?"}
        rows={5}
        style={{ background:"#0d0d0d", border:"1px solid rgba(245,240,232,.12)", borderRadius:8, padding:"12px 14px", color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:12, resize:"vertical", outline:"none", lineHeight:1.6 }}
      />
      <button onClick={handleEnviar} disabled={loading || !message.trim()} className="login-btn" style={{ opacity: message.trim() ? 1 : 0.4 }}>
        {loading ? "ENVIANDO..." : "ENVIAR →"}
      </button>
    </div>
  );
}

const STAFF_MEMBERS = [
  { cog: "nathy_mrnd", email: "nathallynayane1234@gmail.com", nome: "Nathally" },
];

const ALL_ACESSOS = [
  { id:"cadastros",   label:"Cadastros" },
  { id:"pagamentos",  label:"Pagamentos" },
  { id:"disponiveis", label:"Disponíveis" },
  { id:"blocklist",   label:"Blocklist" },
  { id:"reports",     label:"Reports" },
  { id:"geral",       label:"Config / Geral" },
];

const DEFAULT_STAFF_ACESSOS = ["cadastros","pagamentos","disponiveis","blocklist","reports"];

function StaffPanel() {
  const [acessos, setAcessos] = useState(null); // { nathy_mrnd: [...] }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("config").select("value").eq("key","staff_acessos").single()
      .then(async ({ data }) => {
        if (data?.value) {
          try { setAcessos(JSON.parse(data.value)); } catch { setAcessos({}); }
        } else {
          const defaults = {};
          STAFF_MEMBERS.forEach(s => { defaults[s.cog] = [...DEFAULT_STAFF_ACESSOS]; });
          setAcessos(defaults);
          await supabase.from("config").insert({ key:"staff_acessos", value: JSON.stringify(defaults) });
        }
      });
  }, []);

  async function toggle(cog, acessoId) {
    setSaving(true);
    const atual = acessos[cog] || [...DEFAULT_STAFF_ACESSOS];
    const novo  = atual.includes(acessoId) ? atual.filter(a => a !== acessoId) : [...atual, acessoId];
    const novoAcessos = { ...acessos, [cog]: novo };
    setAcessos(novoAcessos);
    await supabase.from("config").update({ value: JSON.stringify(novoAcessos) }).eq("key","staff_acessos");
    setSaving(false);
  }

  if (!acessos) return <div style={{ fontSize:12, color:"rgba(245,240,232,.52)" }}>Carregando...</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontSize:11, color:"rgba(245,240,232,.58)", letterSpacing:".08em", textTransform:"uppercase" }}>Acesso da equipe</div>
        {saving && <div style={{ fontSize:10, color:"rgba(245,240,232,.52)" }}>salvando...</div>}
      </div>
      {STAFF_MEMBERS.map(s => {
        const staffAcessos = acessos[s.cog] || DEFAULT_STAFF_ACESSOS;
        return (
          <div key={s.cog} style={{ background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.08)", borderRadius:12, padding:"18px 20px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(201,168,240,.15)", border:"1px solid rgba(201,168,240,.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, color:"#C9A8F0", fontFamily:"'Bebas Neue',sans-serif" }}>
                {s.nome[0]}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)" }}>{s.nome}</div>
                <div style={{ fontSize:11, color:"rgba(245,240,232,.58)" }}>@{s.cog} · {s.email}</div>
              </div>
              <span style={{ marginLeft:"auto", fontSize:10, background:"rgba(201,168,240,.1)", border:"1px solid rgba(201,168,240,.2)", color:"#C9A8F0", borderRadius:99, padding:"2px 10px" }}>staff</span>
            </div>
            <div style={{ fontSize:11, color:"rgba(245,240,232,.62)", marginBottom:10, letterSpacing:".05em" }}>ACESSOS NO ADMIN</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {ALL_ACESSOS.map(a => {
                const ativo = staffAcessos.includes(a.id);
                return (
                  <div key={a.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background:"rgba(245,240,232,.03)", borderRadius:8, border:"1px solid rgba(245,240,232,.06)" }}>
                    <span style={{ fontSize:12, color: ativo ? "var(--offwhite)" : "rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>{a.label}</span>
                    <button onClick={() => toggle(s.cog, a.id)} style={{
                      width:42, height:24, borderRadius:99, border:"none", cursor:"pointer",
                      background: ativo ? "var(--verde)" : "rgba(245,240,232,.12)",
                      position:"relative", transition:"background .2s", flexShrink:0
                    }}>
                      <span style={{
                        position:"absolute", top:3, left: ativo ? 21 : 3,
                        width:18, height:18, borderRadius:"50%",
                        background: ativo ? "#111" : "rgba(245,240,232,.4)",
                        transition:"left .2s"
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PerfilTab({ user, onUpdate, owner = false }) {
  const [perfilSubTab, setPerfilSubTab] = useState("dados");
  const [feedbackTipo, setFeedbackTipo] = useState("sugestão");
  const [meuEnvios,      setMeuEnvios]      = useState([]);
  const [opcaoEscolhida, setOpcaoEscolhida] = useState({});
  const [expandedEnvio,  setExpandedEnvio]  = useState(new Set());

  useEffect(() => {
    supabase.from("envio_solicitacoes").select("*").eq("joiner_cog", user.cog).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setMeuEnvios(data); });
  }, [user.cog]);

  function reportarProblema() {
    setFeedbackTipo("bug");
    setPerfilSubTab("feedback");
  }
  const [nome, setNome] = useState(user.nome || "");
  const [twitter, setTwitter] = useState(user.twitter || "");
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || "");
  const [email, setEmail] = useState(user.email || "");
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

    const updates = { nome, twitter, whatsapp, email };

    const { error: err } = await supabase.from("joiners").update(updates).eq("cog", user.cog);
    if (err) { setError("Erro ao salvar."); setLoading(false); return; }

    const updatedUser = { ...user, ...updates };
    localStorage.setItem("anticeg_user", JSON.stringify(updatedUser));
    onUpdate(updatedUser);
    setSuccess("Perfil atualizado com sucesso!");
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

      <div className="perfil-subtabs" style={{ display:"flex", gap:6, marginBottom:24 }}>
        {[
          { id:"dados",     label:"Dados" },
          { id:"envios",    label:"Envios", badge: meuEnvios.filter(e => e.status === "pagamento em aberto").length || null },
          { id:"tutorial",  label:"Tutorial" },
          { id:"feedback",  label:"Feedbacks" },
          ...(owner ? [{ id:"staff", label:"Staff" }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setPerfilSubTab(t.id)} style={{
            background: perfilSubTab === t.id ? "var(--laranja)" : "transparent",
            color:      perfilSubTab === t.id ? "#111" : "rgba(245,240,232,.5)",
            border:    `1px solid ${perfilSubTab === t.id ? "var(--laranja)" : "rgba(245,240,232,.18)"}`,
            borderRadius:6, padding:"6px 16px", fontSize:11,
            fontFamily:"'DM Mono',monospace", fontWeight: perfilSubTab === t.id ? 700 : 400,
            cursor:"pointer", letterSpacing:".08em", textTransform:"uppercase", position:"relative"
          }}>
            {t.label}
            {t.badge > 0 && <span style={{ position:"absolute", top:-6, right:-6, background:"#C9A8F0", color:"#111", borderRadius:99, fontSize:9, fontWeight:700, padding:"1px 5px", lineHeight:1.4 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {perfilSubTab === "envios" && (
        <div>
          {meuEnvios.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", fontSize:12, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>Nenhuma solicitação de envio ainda.</div>
          ) : meuEnvios.map(s => {
            const statusColor  = { "solicitação de envio":"#BAFF39", "cotação em andamento":"#FF5C1A", "pagamento em aberto":"#C9A8F0", "pagamento confirmado":"#FFD166", embalando:"#64B5F6", enviado:"rgba(245,240,232,.4)", cancelado:"rgba(245,240,232,.2)" }[s.status] || "rgba(245,240,232,.4)";
            const statusBorder = { "solicitação de envio":"rgba(186,255,57,.2)", "cotação em andamento":"rgba(255,92,26,.25)", "pagamento em aberto":"rgba(201,168,240,.25)", "pagamento confirmado":"rgba(255,209,102,.25)", embalando:"rgba(100,181,246,.25)", enviado:"rgba(245,240,232,.08)", cancelado:"rgba(245,240,232,.06)" }[s.status] || "rgba(245,240,232,.08)";
            const expanded = expandedEnvio.has(s.id);
            const toggleExpand = () => setExpandedEnvio(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; });
            return (
              <div key={s.id} style={{ background:"var(--card-bg)", border:`1px solid ${statusBorder}`, borderRadius:10, marginBottom:8, overflow:"hidden" }}>
                {/* Linha colapsada */}
                <div onClick={toggleExpand} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", cursor:"pointer", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{new Date(s.created_at).toLocaleDateString("pt-BR")} · {s.itens?.length || 0} item(s)</div>
                    <div style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{s.metodo || "—"}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:9, color:statusColor, border:`1px solid ${statusBorder}`, borderRadius:4, padding:"2px 8px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", whiteSpace:"nowrap" }}>{ENVIO_STATUS_LABEL[s.status] || s.status}</span>
                    <span style={{ fontSize:12, color:"rgba(245,240,232,.4)" }}>{expanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Conteúdo expandido */}
                {expanded && <div style={{ padding:"0 16px 16px" }}>
                <div style={{ height:1, background:"rgba(245,240,232,.06)", marginBottom:8 }} />

                {/* Fluxo de envio */}
                <EnvioFlowStepper status={s.status} />
                <div style={{ height:1, background:"rgba(245,240,232,.06)", marginTop:8, marginBottom:12 }} />

                {/* Itens */}
                {s.itens?.length > 0 && (() => {
                  const totalCaixa = s.itens.reduce((a, it) => a + pf(it.valor) + pf(it.taxa) + pf(it.frete), 0);
                  return (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                        <div style={{ fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase" }}>Itens solicitados</div>
                        {totalCaixa > 0 && <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.4)" }}>Total da caixa: <strong style={{ color:"#F5F0E8" }}>R$ {totalCaixa.toFixed(2).replace(".",",")}</strong></div>}
                      </div>
                      {s.itens.map((it, idx) => (
                        <div key={idx} style={{ fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace", padding:"3px 0", borderBottom:"1px solid rgba(245,240,232,.04)" }}>
                          {it.nome || it.nome_do_item || "—"} <span style={{ color:"rgba(245,240,232,.3)" }}>({it.ceg})</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Método */}
                <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginBottom: s.cotacao_valor ? 10 : 0 }}>
                  Método: {s.metodo} · Val. declarado: {s.seguro === "sim" ? `R$ ${s.valor_seguro}` : "—"}
                </div>

                {/* Cotação */}
                {s.cotacao_valor && (() => {
                  const opcoes = s.cotacao_opcoes || [];
                  const emb    = pf(s.cotacao_embalagem);
                  const minVal = opcoes.length > 0 ? Math.min(...opcoes.map(o => pf(o.valor))) : 0;
                  const formaIcon = { "PAC":"🟢","SEDEX":"🟠","Correios":"🟢","Jadlog":"🔴","Mini Envios":"📦" };
                  return (
                    <div style={{ background:"rgba(201,168,240,.06)", border:"1px solid rgba(201,168,240,.2)", borderRadius:9, padding:"14px 16px", marginTop:8, fontFamily:"'DM Mono',monospace" }}>
                      <div style={{ fontSize:10, letterSpacing:"1px", color:"#C9A8F0", textTransform:"uppercase", marginBottom:12 }}>Cotação disponível</div>
                      {opcoes.length > 0 ? (
                        <>
                          {["pagamento em aberto","pagamento confirmado","embalando","enviado"].includes(s.status) && s.modalidade_escolhida ? (
                            <>
                              <div style={{ background: s.status === "pagamento em aberto" ? "rgba(201,168,240,.06)" : "rgba(186,255,57,.06)", border:`1px solid ${s.status === "pagamento em aberto" ? "rgba(201,168,240,.22)" : "rgba(186,255,57,.22)"}`, borderRadius:8, padding:"12px 14px", marginBottom:8, fontFamily:"'DM Mono',monospace" }}>
                                <div style={{ fontSize:10, color: s.status === "pagamento em aberto" ? "#C9A8F0" : "#BAFF39", letterSpacing:"1px", marginBottom:4 }}>{s.status === "pagamento em aberto" ? "PAGAMENTO EM ABERTO" : "MODALIDADE CONFIRMADA"}</div>
                                <div style={{ fontSize:15, fontWeight:900, color:"#F5F0E8" }}>{s.modalidade_escolhida.forma} — R$ {(pf(s.modalidade_escolhida.valor)+emb).toFixed(2).replace(".",",")}</div>
                                <div style={{ fontSize:10, color:"rgba(245,240,232,.4)", marginTop:3 }}>Até {s.modalidade_escolhida.prazo}{emb > 0 ? ` · frete R$ ${s.modalidade_escolhida.valor} + emb. R$ ${s.cotacao_embalagem}` : ""}</div>
                              </div>
                              {s.status === "pagamento em aberto" && (
                                <a href={`https://wa.me/5524992501917?text=${encodeURIComponent(`Olá! Segue o comprovante de pagamento do meu envio.\n\nNome: ${s.joiner_nome}\nModalidade: ${s.modalidade_escolhida.forma} (${s.modalidade_escolhida.prazo})\nValor pago: R$ ${(pf(s.modalidade_escolhida.valor)+emb).toFixed(2).replace(".",",")}`)}`} target="_blank" rel="noopener noreferrer" style={{ display:"block", textAlign:"center", padding:"11px", background:"rgba(201,168,240,.12)", color:"#C9A8F0", border:"1px solid rgba(201,168,240,.3)", borderRadius:7, fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, textDecoration:"none", marginTop:2 }}>
                                  📎 Enviar comprovante no WhatsApp →
                                </a>
                              )}
                            </>
                          ) : (
                            <>
                              {["enviado","cancelado"].includes(s.status) ? null : <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>Toque para selecionar a modalidade</div>}
                              {opcoes.map((op, idx) => {
                                const isBest     = pf(op.valor) === minVal;
                                const isSelected = opcaoEscolhida[s.id] === idx;
                                const canSelect  = !["enviado","cancelado","pagamento em aberto","pagamento confirmado","embalando"].includes(s.status);
                                const total      = (pf(op.valor) + emb).toFixed(2).replace(".",",");
                                return (
                                  <div key={idx} onClick={() => canSelect && setOpcaoEscolhida(prev => ({ ...prev, [s.id]: isSelected ? undefined : idx }))} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", marginBottom:6, borderRadius:8, cursor: canSelect ? "pointer" : "default", transition:"all .15s", background: isSelected ? "rgba(201,168,240,.1)" : isBest ? "rgba(186,255,57,.06)" : "rgba(245,240,232,.03)", border:`1px solid ${isSelected ? "rgba(201,168,240,.5)" : isBest ? "rgba(186,255,57,.22)" : "rgba(245,240,232,.08)"}` }}>
                                    <div>
                                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                                        <span>{formaIcon[op.forma] || "📦"}</span>
                                        <span style={{ fontSize:12, fontWeight:700, color:"#F5F0E8" }}>{op.forma}</span>
                                        {isBest && opcoes.length > 1 && <span style={{ fontSize:9, background:"#BAFF39", color:"#111", borderRadius:3, padding:"1px 6px", fontWeight:700 }}>Melhor preço</span>}
                                        {isSelected && <span style={{ fontSize:9, background:"#C9A8F0", color:"#111", borderRadius:3, padding:"1px 6px", fontWeight:700 }}>Selecionado</span>}
                                      </div>
                                      <div style={{ fontSize:10, color:"rgba(245,240,232,.4)" }}>Até {op.prazo}</div>
                                    </div>
                                    <div style={{ textAlign:"right" }}>
                                      <div style={{ fontSize:15, fontWeight:900, color: isSelected ? "#C9A8F0" : isBest ? "#BAFF39" : "#F5F0E8" }}>R$ {total}</div>
                                      {emb > 0 && <div style={{ fontSize:9, color:"rgba(245,240,232,.3)" }}>frete R$ {op.valor} + emb. R$ {s.cotacao_embalagem}</div>}
                                    </div>
                                  </div>
                                );
                              })}
                              {opcaoEscolhida[s.id] !== undefined && !["pagamento em aberto","pagamento confirmado","embalando","enviado","cancelado"].includes(s.status) && (() => {
                                const chosen = opcoes[opcaoEscolhida[s.id]];
                                if (!chosen) return null;
                                const totalChosen = (pf(chosen.valor) + emb).toFixed(2).replace(".",",");
                                const waMsg = encodeURIComponent(`Olá! Gostaria de confirmar meu envio.\n\nNome: ${s.joiner_nome}\nModalidade: ${chosen.forma} (até ${chosen.prazo})\nTotal: R$ ${totalChosen}\n\nVou realizar o PIX! 💚`);
                                return (
                                  <button onClick={async () => {
                                    await supabase.from("envio_solicitacoes").update({ modalidade_escolhida: chosen, status:"pagamento em aberto" }).eq("id", s.id);
                                    setMeuEnvios(prev => prev.map(x => x.id === s.id ? { ...x, modalidade_escolhida: chosen, status:"pagamento em aberto" } : x));
                                    window.open(`https://wa.me/5524992501917?text=${waMsg}`, "_blank");
                                  }} style={{ width:"100%", marginTop:6, padding:"10px", background:"rgba(201,168,240,.15)", color:"#C9A8F0", border:"1px solid rgba(201,168,240,.35)", borderRadius:7, fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                    Confirmar {chosen.forma} — R$ {totalChosen} e enviar PIX →
                                  </button>
                                );
                              })()}
                            </>
                          )}
                          {s.cotacao_obs && <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", marginTop:8, lineHeight:1.6 }}>{s.cotacao_obs}</div>}
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize:20, fontWeight:900, color:"#F5F0E8", marginBottom:4 }}>R$ {s.cotacao_valor}</div>
                          {s.cotacao_frete && <div style={{ fontSize:11, color:"rgba(245,240,232,.5)" }}>Frete ({s.cotacao_forma}): R$ {s.cotacao_frete}{s.cotacao_embalagem ? ` + emb. R$ ${s.cotacao_embalagem}` : ""}</div>}
                          <div style={{ fontSize:11, color:"rgba(245,240,232,.5)", marginTop:2 }}>Prazo: {s.cotacao_prazo}</div>
                          {s.cotacao_obs && <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", marginTop:6 }}>{s.cotacao_obs}</div>}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Cancelar solicitação */}
                {["solicitação de envio","cotação em andamento","pagamento em aberto"].includes(s.status) && (
                  <button onClick={async () => {
                    if (!window.confirm("Cancelar esta solicitação de envio?")) return;
                    await supabase.from("envio_solicitacoes").update({ status:"cancelado" }).eq("id", s.id);
                    setMeuEnvios(prev => prev.map(x => x.id === s.id ? { ...x, status:"cancelado" } : x));
                  }} style={{ marginTop:10, fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.25)", border:"1px solid rgba(245,240,232,.1)", borderRadius:5, padding:"6px 14px", cursor:"pointer", width:"100%" }}>
                    Cancelar solicitação
                  </button>
                )}
                {s.status === "cancelado" && (
                  <div style={{ marginTop:8, fontSize:11, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace", textAlign:"center" }}>Solicitação cancelada</div>
                )}
                {s.status === "enviado" && s.rastreio_codigo && (
                  <div style={{ marginTop:10, background:"rgba(186,255,57,.06)", border:"1px solid rgba(186,255,57,.2)", borderRadius:8, padding:"12px 14px", fontFamily:"'DM Mono',monospace" }}>
                    <div style={{ fontSize:10, color:"#BAFF39", letterSpacing:"1px", marginBottom:6 }}>RASTREIO</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#F5F0E8", letterSpacing:".05em" }}>{s.rastreio_codigo}</div>
                    {s.rastreio_link && (
                      <a href={s.rastreio_link} target="_blank" rel="noopener noreferrer" style={{ display:"inline-block", marginTop:6, fontSize:10, color:"#BAFF39", textDecoration:"underline", fontFamily:"'DM Mono',monospace" }}>
                        Rastrear encomenda →
                      </a>
                    )}
                  </div>
                )}
                </div>}
              </div>
            );
          })}
        </div>
      )}

      {perfilSubTab === "dados" && (
        <div className="login-box" style={{ gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid #1e1e1e" }}>
            <div className="avatar-perfil" onClick={() => fileInputRef.current.click()} title="Clique para trocar a foto">
              <img src={fotoUrl || bonequinha} alt="foto de perfil" />
              <div className="avatar-perfil-overlay">{fotoLoading ? "..." : "trocar"}</div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFotoUpload} />
            <div style={{ fontSize: 11, color: "rgba(245,240,232,.35)" }}>clique na foto para alterar</div>
          </div>
          <div><label className="login-label">Nome completo</label><input className="login-input" style={inputStyle} type="text" value={nome} onChange={e => setNome(e.target.value)} /></div>
          <div><label className="login-label">@ no Twitter</label><input className="login-input" style={inputStyle} type="text" placeholder="@seutwitter" value={twitter} onChange={e => setTwitter(e.target.value)} /></div>
          <div><label className="login-label">WhatsApp</label><input className="login-input" style={inputStyle} type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></div>
          <div><label className="login-label">E-mail</label><input className="login-input" style={inputStyle} type="email" placeholder="seuemail@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
          {error && <div className="login-error">{error}</div>}
          {success && <div style={{ fontSize: "var(--fs-xs)", color: "var(--verde)", padding: "8px 12px", background: "rgba(186,255,57,.08)", border: "1px solid rgba(186,255,57,.2)", borderRadius: 4 }}>{success}</div>}
          <button className="login-btn" onClick={handleSalvar} disabled={loading} style={{ marginTop: 8 }}>{loading ? "SALVANDO..." : "SALVAR ALTERAÇÕES →"}</button>
          <button onClick={reportarProblema} style={{ background:"none", border:"1px solid rgba(255,90,31,.25)", color:"rgba(255,90,31,.6)", borderRadius:6, padding:"10px 16px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", marginTop:4, letterSpacing:".05em" }}>
            ⚑ Reportar problema (item faltando ou erro grave)
          </button>
        </div>
      )}

      {perfilSubTab === "tutorial" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {TUTORIAL_STEPS.map((s, i) => (
            <div key={i} style={{ background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.08)", borderRadius:10, padding:"18px 20px", display:"flex", gap:16, alignItems:"flex-start" }}>
              <span style={{ fontSize:28, flexShrink:0 }}>{s.icon}</span>
              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:"var(--offwhite)", letterSpacing:.5, marginBottom:6 }}>{s.title}</div>
                <div style={{ fontSize:12, color:"rgba(245,240,232,.55)", lineHeight:1.7 }}>{s.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {perfilSubTab === "feedback" && (
        <FeedbackForm user={user} defaultTipo={feedbackTipo} />
      )}

      {perfilSubTab === "staff" && owner && <StaffPanel />}
    </div>
  );
}

function CalendarTab({ user, itens }) {
  const now = new Date();
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calView, setCalView]   = useState("geral");
  const [allItens, setAllItens] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const [calEventos, setCalEventos] = useState([]);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    supabase.from("cal_eventos").select("*").order("data")
      .then(({ data }) => { if (data) setCalEventos(data); });
  }, []);

  useEffect(() => {
    (async () => {
      let all = [], from = 0;
      while (true) {
        const { data } = await supabase.from("masterlist")
          .select("ceg, venc_item, venc_frete, venc_rf, pago_item, pago_frete, pago_rf")
          .or("venc_item.not.is.null,venc_frete.not.is.null,venc_rf.not.is.null");
        if (!data || data.length === 0) break;
        all = [...all, ...data];
        if (data.length < 1000) break;
        from += 1000;
      }
      setAllItens(all);
    })();
  }, []);

  function changeMonth(d) {
    let m = calMonth + d, y = calYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setCalMonth(m); setCalYear(y);
  }

  const activeItens = calView === "meu" ? itens : (allItens || []);

  const events = {};
  const evSeen = {};
  function addEv(dateStr, label, type) {
    if (!dateStr) return;
    const dedupeKey = `${dateStr}|${label}`;
    if (evSeen[dedupeKey]) return;
    evSeen[dedupeKey] = true;
    if (!events[dateStr]) events[dateStr] = [];
    events[dateStr].push({ label, type });
  }
  activeItens.forEach(item => {
    if (item.venc_item)     addEv(item.venc_item,     `${item.ceg}: Item`, "item");
    if (item.venc_frete)    addEv(item.venc_frete,    `${item.ceg}: Frete`, "frete");
    if (item.venc_rf)       addEv(item.venc_rf,       `${item.ceg}: Taxa RF`, "taxa");
  });
  calEventos.forEach(ev => {
    if (!ev.data_fim || ev.data_fim <= ev.data) {
      addEv(ev.data, ev.titulo, ev.tipo || "envio");
    } else {
      const cur = new Date(ev.data + "T12:00:00");
      const end = new Date(ev.data_fim + "T12:00:00");
      while (cur <= end) {
        const ds = cur.toISOString().slice(0, 10);
        addEv(ds, ev.titulo, ev.tipo || "envio");
        cur.setDate(cur.getDate() + 1);
      }
    }
  });

  const firstDay = new Date(calYear, calMonth, 1);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  // Desktop cells (full labels)
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(<div key={`e${i}`} className="cal-day empty" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const isToday = new Date(calYear, calMonth, d).getTime() === today.getTime();
    const dayEvs = events[dateStr] || [];
    cells.push(
      <div key={d} className={`cal-day${isToday ? " today" : ""}${dayEvs.length > 0 ? " cal-day-has-ev" : ""}`}
        onClick={() => dayEvs.length > 0 && setDayDetail({ d, month: calMonth+1, year: calYear, evs: dayEvs })}>
        <div className="cal-day-num">{d}</div>
        <div className="cal-events">
          {dayEvs.map((e, i) => <div key={i} className={`cal-event ev-${e.type}`}>{e.label}</div>)}
        </div>
      </div>
    );
  }

  // Mobile cells (compact — dots only)
  const mobileCells = [];
  for (let i = 0; i < startDow; i++) mobileCells.push(<div key={`e${i}`} className="cal-day cal-day-mini empty" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const isToday = new Date(calYear, calMonth, d).getTime() === today.getTime();
    const dayEvs = events[dateStr] || [];
    mobileCells.push(
      <div key={d} className={`cal-day cal-day-mini${isToday ? " today" : ""}${dayEvs.length > 0 ? " cal-day-has-ev" : ""}`}
        onClick={() => dayEvs.length > 0 && setDayDetail({ d, month: calMonth+1, year: calYear, evs: dayEvs })}>
        <div className="cal-day-num">{d}</div>
        {dayEvs.length > 0 && (
          <div className="cal-mini-dots">
            {dayEvs.slice(0, 3).map((e, i) => <div key={i} className={`cal-mini-dot dot-${e.type}`} />)}
          </div>
        )}
      </div>
    );
  }

  // Agenda entries for mobile (sorted events this month)
  const agendaEntries = Object.entries(events)
    .filter(([dateStr]) => {
      const [y, m] = dateStr.split("-").map(Number);
      return y === calYear && m === calMonth + 1;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  const viewBtns = (
    <div style={{ display:"flex", gap:4 }}>
      {["geral","meu"].map(v => (
        <button key={v} onClick={() => setCalView(v)} style={{ background: calView === v ? "var(--laranja)" : "transparent", color: calView === v ? "#000" : "rgba(245,240,232,.45)", border: `1px solid ${calView === v ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, borderRadius:6, padding:"5px 12px", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer", textTransform:"uppercase" }}>
          {v === "geral" ? "Geral" : "Meu Calendário"}
        </button>
      ))}
    </div>
  );

  const legend = (
    <div className="cal-legend" style={{ marginBottom:12 }}>
      {[["laranja","Venc. Item"],["lilas","Frete"],["verde","Taxa RF"],["azul","Envio"]].map(([c,l]) => (
        <div key={c} className="cal-legend-item"><div className={`leg-dot leg-${c}`}/>{l}</div>
      ))}
    </div>
  );

  const popup = dayDetail && (
    <div className="cal-day-popup-overlay" onClick={() => setDayDetail(null)}>
      <div className="cal-day-popup" onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div className="cal-day-popup-title">
            {String(dayDetail.d).padStart(2,"0")}/{String(dayDetail.month).padStart(2,"0")}/{dayDetail.year}
          </div>
          <button className="cal-day-popup-close" onClick={() => setDayDetail(null)}>✕</button>
        </div>
        {dayDetail.evs.map((e, i) => (
          <div key={i} className={`cal-day-popup-ev ev-${e.type}`}>{e.label}</div>
        ))}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="cal-main">
        <div className="cal-header">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => changeMonth(-1)}>‹</button>
            <div className="cal-month-title"><span>{MONTHS[calMonth]}</span> <span className="cal-year">{calYear}</span></div>
            <button className="cal-nav-btn" onClick={() => changeMonth(1)}>›</button>
          </div>
          {viewBtns}
        </div>
        {legend}

        <div className="cal-grid-wrap">
          <div className="cal-weekdays">
            {["S","T","Q","Q","S","S","D"].map((d, i) => (
              <div key={i} className="cal-weekday">{d}</div>
            ))}
          </div>
          <div className="cal-days">{mobileCells}</div>
        </div>

        <div className="cal-agenda">
          <div className="cal-agenda-title">// eventos de {MONTHS[calMonth]}</div>
          {agendaEntries.length === 0 ? (
            <div className="cal-agenda-empty">Nenhuma data registrada este mês</div>
          ) : agendaEntries.map(([dateStr, evs]) => {
            const [y, m, d] = dateStr.split("-").map(Number);
            const date = new Date(y, m - 1, d);
            const isAgendaToday = date.getTime() === today.getTime();
            const isPast = date < today;
            return (
              <div key={dateStr} className={`cal-agenda-day${isAgendaToday ? " cal-agenda-today" : ""}${isPast && !isAgendaToday ? " cal-agenda-past" : ""}`}>
                <div className="cal-agenda-date">
                  <span className="cal-agenda-daynum">{String(d).padStart(2,"0")}</span>
                  <span className="cal-agenda-weekday">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][date.getDay()]}</span>
                </div>
                <div className="cal-agenda-evs">
                  {evs.map((e, i2) => (
                    <div key={i2} className={`cal-day-popup-ev ev-${e.type}`}>{e.label}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {popup}
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
        {viewBtns}
      </div>
      {legend}
      <div className="cal-grid-wrap">
        <div className="cal-weekdays">
          {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => (
            <div key={d} className="cal-weekday">{d}</div>
          ))}
        </div>
        <div className="cal-days">{cells}</div>
      </div>
      {popup}
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
  const [links, setLinks] = useState([]);

  useEffect(() => {
    supabase.from("links_uteis").select("*").eq("ativo", true).order("ordem").then(({ data }) => setLinks(data || []));
  }, []);

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

      {links.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "rgba(245,240,232,.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Links úteis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {links.map(l => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", background: "var(--card-bg)", border: "1px solid rgba(245,240,232,.08)", borderRadius: 12, textDecoration: "none", transition: "border-color .15s", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(245,240,232,.2)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(245,240,232,.08)"}>
                <span style={{ fontSize: 22, minWidth: 32, textAlign: "center" }}>{l.emoji || "🔗"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--offwhite)" }}>{l.titulo}</div>
                  {l.descricao && <div style={{ fontSize: 11, color: "rgba(245,240,232,.4)", marginTop: 2 }}>{l.descricao}</div>}
                </div>
                <span style={{ fontSize: 11, color: "rgba(245,240,232,.25)" }}>↗</span>
              </a>
            ))}
          </div>
        </div>
      )}

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

function PushBanner({ push, onOk, onX }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 950,
      background: "rgba(0,0,0,.88)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24
    }}>
      <div style={{
        background: "#111", border: "1px solid rgba(201,168,240,.25)", borderRadius: 16,
        width: "100%", maxWidth: 460, padding: 32, boxShadow: "0 24px 64px rgba(0,0,0,.8)",
        display: "flex", flexDirection: "column", gap: 20
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "#C9A8F0", fontFamily: "'DM Mono',monospace" }}>📢 aviso</span>
          <button onClick={onX} style={{ background: "none", border: "none", color: "rgba(245,240,232,.25)", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ fontSize: 14, color: "var(--offwhite)", lineHeight: 1.7 }}>{push.message}</div>
        <button onClick={onOk} style={{
          background: "#C9A8F0", color: "#111", border: "none", borderRadius: 8,
          padding: "12px", fontSize: 13, fontFamily: "'DM Mono',monospace",
          fontWeight: 700, cursor: "pointer", letterSpacing: ".05em"
        }}>
          OK, ENTENDI ✓
        </button>
      </div>
    </div>
  );
}

function NotifResolvido({ notif, user, onDismiss }) {
  const [reenviar, setReenviar] = useState(false);
  const [reportItem, setReportItem] = useState(null);

  useEffect(() => {
    if (reenviar && notif.report_id) {
      supabase.from("reports").select("*").eq("id", notif.report_id).single()
        .then(({ data }) => { if (data) setReportItem({ id: data.item_id, nome_do_item: data.item_nome, ceg: data.ceg }); });
    }
  }, [reenviar]);

  return (
    <>
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 900, width: "calc(100% - 48px)", maxWidth: 520, background: "#1a1a1a", border: "1px solid rgba(74,222,128,.3)", borderRadius: 12, padding: "16px 20px", boxShadow: "0 8px 32px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 20 }}>✓</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#4ade80", marginBottom: 4 }}>Problema resolvido!</div>
            <div style={{ fontSize: 12, color: "rgba(245,240,232,.6)", lineHeight: 1.5 }}>
              {notif.message} Se o problema persistir, reenvie a solicitação.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => setReenviar(true)} style={{ background: "rgba(74,222,128,.1)", border: "1px solid rgba(74,222,128,.3)", color: "#4ade80", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>
                Reenviar solicitação →
              </button>
              <button onClick={onDismiss} style={{ background: "none", border: "1px solid rgba(245,240,232,.1)", color: "rgba(245,240,232,.35)", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>
                OK, entendi
              </button>
            </div>
          </div>
        </div>
      </div>
      {reportItem && (
        <ReportModal user={user} item={reportItem} onClose={() => { setReportItem(null); setReenviar(false); onDismiss(); }} />
      )}
    </>
  );
}

function PushAdminCard({ p, onDesativar }) {
  const [aberto, setAberto] = useState(false);
  const [leituras, setLeituras] = useState(null);

  async function verLeituras() {
    if (leituras) { setAberto(a => !a); return; }
    const { data } = await supabase.from("push_reads").select("joiner_cog, created_at").eq("push_id", p.id).order("created_at", { ascending: false });
    if (data?.length > 0) {
      const cogs = data.map(d => d.joiner_cog);
      const { data: jData } = await supabase.from("joiners").select("cog, nome").in("cog", cogs);
      const nomeMap = Object.fromEntries((jData || []).map(j => [j.cog, j.nome]));
      setLeituras(data.map(d => ({ ...d, nome: nomeMap[d.joiner_cog] || d.joiner_cog })));
      setAberto(true); return;
    }
    setLeituras(data || []);
    setAberto(true);
  }

  return (
    <div style={{ background: "var(--card-bg)", border: `1px solid ${p.active ? "rgba(201,168,240,.2)" : "rgba(245,240,232,.06)"}`, borderRadius: 8, marginBottom: 6, opacity: p.active ? 1 : 0.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
        <div style={{ flex: 1, fontSize: 12, color: p.active ? "var(--offwhite)" : "rgba(245,240,232,.35)" }}>{p.message}</div>
        <div style={{ fontSize: 10, color: "rgba(245,240,232,.25)", whiteSpace: "nowrap" }}>{new Date(p.created_at).toLocaleDateString("pt-BR")}</div>
        <button onClick={verLeituras} style={{ background: "none", border: "1px solid rgba(245,240,232,.1)", color: "rgba(245,240,232,.35)", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer", whiteSpace: "nowrap" }}>
          {aberto ? "▴ ocultar" : "▾ quem viu"}
        </button>
        {p.active
          ? <button onClick={onDesativar} style={{ background: "none", border: "1px solid rgba(245,240,232,.1)", color: "rgba(245,240,232,.3)", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>desativar</button>
          : <span style={{ fontSize: 10, color: "rgba(245,240,232,.2)" }}>desativado</span>
        }
      </div>
      {aberto && (
        <div style={{ borderTop: "1px solid rgba(245,240,232,.06)", padding: "10px 14px" }}>
          {leituras?.length === 0
            ? <div style={{ fontSize: 11, color: "rgba(245,240,232,.3)" }}>Nenhum joiner confirmou leitura ainda.</div>
            : <>
                <div style={{ fontSize: 10, color: "rgba(245,240,232,.3)", marginBottom: 8, letterSpacing: ".08em", textTransform: "uppercase" }}>{leituras?.length} joiner{leituras?.length > 1 ? "s" : ""} viram</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {leituras?.map(l => (
                    <span key={l.joiner_cog} className="cog-tip" data-nome={l.nome || l.joiner_cog} style={{ fontSize: 10, background: "rgba(201,168,240,.08)", border: "1px solid rgba(201,168,240,.15)", borderRadius: 4, padding: "2px 8px", color: "rgba(245,240,232,.5)" }}>
                      @{l.joiner_cog}
                    </span>
                  ))}
                </div>
              </>
          }
        </div>
      )}
    </div>
  );
}

function EmailJSTestBlock() {
  const [testEmail, setTestEmail] = useState("");
  const [status, setStatus] = useState(null); // null | "sending" | "ok" | "error" | "notcfg"

  const configured = !EJS_SERVICE.startsWith("YOUR");

  async function testar() {
    if (!testEmail.trim()) return;
    if (!configured) { setStatus("notcfg"); return; }
    setStatus("sending");
    try {
      await sendEmailJoiner(testEmail.trim(), "você", "Teste de e-mail ANTICEG ✓", buildEmailHTML("você", `<tr><td style="background:#111111;padding:20px 40px 24px"><p style="margin:0 0 8px;font-size:13px;color:#F5F0E8;font-weight:700;line-height:1.6">Configura&ccedil;&atilde;o confirmada ✓</p><p style="margin:0;font-size:13px;color:rgba(245,240,232,0.65);line-height:1.6">Se voc&ecirc; recebeu este e-mail, o EmailJS est&aacute; funcionando corretamente e os envios autom&aacute;ticos est&atilde;o ativos.</p></td></tr>`));
      setStatus("ok");
    } catch { setStatus("error"); }
  }

  const statusMsg = {
    notcfg: { text: "Preencha EJS_SERVICE, EJS_TEMPLATE e EJS_KEY em App.jsx primeiro.", color: "#ff6b6b" },
    sending: { text: "Enviando...", color: "rgba(245,240,232,.4)" },
    ok:      { text: "✓ E-mail enviado! Verifique a caixa de entrada.", color: "#4ade80" },
    error:   { text: "✗ Erro ao enviar. Verifique as credenciais no EmailJS.", color: "#ff6b6b" },
  };

  return (
    <div style={{ marginBottom:20, padding:"14px 16px", background:"var(--card-bg)", border:`1px solid ${configured ? "rgba(245,240,232,.08)" : "rgba(255,107,107,.2)"}`, borderRadius:10 }}>
      <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)", marginBottom:4 }}>
        E-mail de notificação
        <span style={{ marginLeft:8, fontSize:10, fontFamily:"'DM Mono',monospace", color: configured ? "#4ade80" : "#ff6b6b", fontWeight:400 }}>
          {configured ? "● configurado" : "● não configurado"}
        </span>
      </div>
      <div style={{ fontSize:11, color:"rgba(245,240,232,.58)", marginBottom:12 }}>Envie um e-mail de teste para confirmar que a integração está funcionando.</div>
      <div style={{ display:"flex", gap:8 }}>
        <input
          value={testEmail} onChange={e => { setTestEmail(e.target.value); setStatus(null); }}
          placeholder="seu@email.com"
          style={{ flex:1, background:"#0d0d0d", border:"1px solid rgba(245,240,232,.12)", borderRadius:8, padding:"8px 12px", color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none" }}
        />
        <button onClick={testar} disabled={status === "sending"} style={{
          background:"rgba(245,240,232,.06)", border:"1px solid rgba(245,240,232,.15)", color:"var(--offwhite)",
          borderRadius:8, padding:"8px 16px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer"
        }}>Testar →</button><EmailTypeBadge type="teste" />
      </div>
      {status && <div style={{ fontSize:11, color:statusMsg[status].color, marginTop:8, fontFamily:"'DM Mono',monospace" }}>{statusMsg[status].text}</div>}
    </div>
  );
}

const EMAIL_TYPE_BADGE = {
  pagamento: { label: "pagamento", bg: "rgba(186,255,57,.1)",  color: "#BAFF39", border: "rgba(186,255,57,.25)" },
  report:    { label: "report",    bg: "rgba(255,92,26,.1)",   color: "#FF5C1A", border: "rgba(255,92,26,.3)"  },
  teste:     { label: "teste",     bg: "rgba(201,168,240,.1)", color: "#C9A8F0", border: "rgba(201,168,240,.3)"},
};
function EmailTypeBadge({ type }) {
  const t = EMAIL_TYPE_BADGE[type] || EMAIL_TYPE_BADGE.pagamento;
  return (
    <span style={{ display:"inline-block", fontSize:9, letterSpacing:"1px", textTransform:"uppercase",
      background:t.bg, color:t.color, border:`1px solid ${t.border}`,
      borderRadius:4, padding:"2px 7px", fontFamily:"'DM Mono',monospace", verticalAlign:"middle" }}>
      {t.label}
    </span>
  );
}

function EmailPreviewsBlock() {
  function open(html) {
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  }

  function previewPagamento() {
    const mockItems = [
      { nome_do_item: "Leebit SKZOO Plush", ceg: "7TH FAN", pend: 85.00 },
      { nome_do_item: "Photo Card Set", ceg: "SKZ", pend: 45.00 },
      { nome_do_item: "Frete Internacional", ceg: "", pend: 22.50 },
    ];
    const mockTotal = mockItems.reduce((s, i) => s + i.pend, 0);
    const mockMulta = 3.00;
    const itemRows = mockItems.map(it =>
      `<tr><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#F5F0E8">${it.nome_do_item}${it.ceg ? `<div style="font-size:10px;color:rgba(245,240,232,0.3);margin-top:2px">${it.ceg}</div>` : ""}</td><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;text-align:right;white-space:nowrap;font-size:12px;color:#FF5C1A">R$&nbsp;${fmtBRL(it.pend)}</td></tr>`
    ).join("");
    open(buildEmailHTML("Antigom Exemplo", `<tr><td style="background:#111111;padding:20px 40px 8px"><p style="margin:0 0 18px;font-size:13px;color:rgba(245,240,232,0.65);line-height:1.6">Constam em seu portal os seguintes itens com pagamento em aberto:</p><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #1e1e1e">${itemRows}<tr><td colspan="2" style="padding:16px 0 8px;text-align:right"><div style="font-size:10px;color:rgba(245,240,232,0.3);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Total em aberto</div><div style="font-size:26px;font-weight:900;color:#BAFF39">R$&nbsp;${fmtBRL(mockTotal + mockMulta)}</div><div style="font-size:10px;color:rgba(255,92,26,0.7);margin-top:4px">R$&nbsp;${fmtBRL(mockTotal)} item + R$&nbsp;${fmtBRL(mockMulta)} multa</div></td></tr></table></td></tr>`));
  }

  function previewReport() {
    open(buildEmailHTML("Antigom Exemplo", `<tr><td style="background:#111111;padding:20px 40px 24px"><p style="margin:0 0 14px;font-size:13px;color:rgba(245,240,232,0.65);line-height:1.6">Seu report sobre o item abaixo foi marcado como <strong style="color:#BAFF39">resolvido</strong>:</p><div style="background:#0D0D0D;border-radius:6px;padding:14px 16px;border-left:3px solid #BAFF39"><div style="font-size:13px;font-weight:700;color:#F5F0E8">Leebit SKZOO Plush — 7TH FAN</div></div></td></tr>`));
  }

  function previewTeste() {
    open(buildEmailHTML("Antigom Exemplo", `<tr><td style="background:#111111;padding:20px 40px 24px"><p style="margin:0 0 8px;font-size:13px;color:#F5F0E8;font-weight:700;line-height:1.6">Configura&ccedil;&atilde;o confirmada ✓</p><p style="margin:0;font-size:13px;color:rgba(245,240,232,0.65);line-height:1.6">Se voc&ecirc; recebeu este e-mail, o EmailJS est&aacute; funcionando corretamente e os envios autom&aacute;ticos est&atilde;o ativos.</p></td></tr>`));
  }

  const tipos = [
    { type:"pagamento", label:"Pagamento em aberto",  desc:"Notificar Todos e notificar individual",  fn: previewPagamento },
    { type:"report",    label:"Report resolvido",     desc:"Disparado ao clicar em Resolver ✓",       fn: previewReport    },
    { type:"teste",     label:"Teste de integração",  desc:"Disparado pelo EmailJS Test Block",       fn: previewTeste     },
  ];

  return (
    <div style={{ marginBottom:20, padding:"14px 16px", background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.08)", borderRadius:10 }}>
      <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)", marginBottom:4 }}>Prévia de e-mails</div>
      <div style={{ fontSize:11, color:"rgba(245,240,232,.58)", marginBottom:14 }}>Estrutura de cada tipo de e-mail enviado pelo sistema.</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {tipos.map(t => (
          <div key={t.type} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"rgba(245,240,232,.03)", border:"1px solid rgba(245,240,232,.06)", borderRadius:8 }}>
            <EmailTypeBadge type={t.type} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace" }}>{t.label}</div>
              <div style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{t.desc}</div>
            </div>
            <button onClick={t.fn} style={{ background:"none", border:"1px solid rgba(245,240,232,.12)", color:"rgba(245,240,232,.45)", borderRadius:6, padding:"5px 12px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>visualizar →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificarTodosBlock() {
  const [status, setStatus]       = useState(null);
  const [resultado, setResultado] = useState(null);
  const [lista, setLista]         = useState(null);   // null | [] | [{nome, cog, email, nItens, total}]
  const [listaLoading, setListaLoading] = useState(false);
  const [listaOpen, setListaOpen] = useState(false);

  const configured = !EJS_SERVICE.startsWith("YOUR");

  async function carregarLista() {
    setListaLoading(true);
    try {
      const { data: joiners } = await supabase.from("joiners").select("cog, nome, email").not("email", "is", null).neq("email", "");
      const { data: itens }   = await supabase.from("masterlist").select("cog, nome_do_item, ceg, pago_item, valor_item, pago_frete, frete_inter, pago_rf, taxa_rf, venc_item, venc_frete, venc_rf").neq("cog","disponivel");
      const resultado = (joiners || []).reduce((acc, j) => {
        const meus = (itens || []).filter(i => i.cog === j.cog);
        const pendentes = meus.filter(i =>
          (isPendente(i.pago_item)  && Number(i.valor_item||0)  > 0) ||
          (isPendente(i.pago_frete) && Number(i.frete_inter||0) > 0) ||
          (isPendente(i.pago_rf)    && Number(i.taxa_rf||0)     > 0)
        );
        if (pendentes.length === 0) return acc;
        const total = pendentes.reduce((s, i) =>
          s + (isPendente(i.pago_item)  ? Number(i.valor_item||0)  : 0)
            + (isPendente(i.pago_frete) ? Number(i.frete_inter||0) : 0)
            + (isPendente(i.pago_rf)    ? Number(i.taxa_rf||0)     : 0), 0);
        const totalMulta = pendentes.reduce((s, i) =>
          s + diasAtraso(i.venc_item) + diasAtraso(i.venc_frete) + diasAtraso(i.venc_rf), 0);
        acc.push({ nome: j.nome || j.cog, cog: j.cog, email: j.email, nItens: pendentes.length, total, totalMulta, pendentes });
        return acc;
      }, []);
      setLista(resultado);
      setListaOpen(true);
    } catch (e) { console.error(e); }
    setListaLoading(false);
  }

  function previewJoiner(r) {
    const itemRows = r.pendentes.map(i => {
      const v = (isPendente(i.pago_item)  ? Number(i.valor_item||0)  : 0)
              + (isPendente(i.pago_frete) ? Number(i.frete_inter||0) : 0)
              + (isPendente(i.pago_rf)    ? Number(i.taxa_rf||0)     : 0);
      return `<tr><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#F5F0E8">${i.nome_do_item}${i.ceg ? `<div style="font-size:10px;color:rgba(245,240,232,0.3);margin-top:2px">${i.ceg}</div>` : ""}</td><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;text-align:right;white-space:nowrap;font-size:12px;color:#FF5C1A">R$&nbsp;${fmtBRL(v)}</td></tr>`;
    }).join("");
    const content = `<tr><td style="background:#111111;padding:20px 40px 8px">
  <p style="margin:0 0 18px;font-size:13px;color:rgba(245,240,232,0.65);line-height:1.6">Constam em seu portal os seguintes itens com pagamento em aberto:</p>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #1e1e1e">${itemRows}<tr><td colspan="2" style="padding:16px 0 8px;text-align:right"><div style="font-size:10px;color:rgba(245,240,232,0.3);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Total em aberto</div><div style="font-size:26px;font-weight:900;color:#BAFF39">R$&nbsp;${fmtBRL(r.total + r.totalMulta)}</div>${r.totalMulta > 0 ? `<div style="font-size:10px;color:rgba(255,92,26,0.7);margin-top:4px">R$&nbsp;${fmtBRL(r.total)} item + R$&nbsp;${fmtBRL(r.totalMulta)} multa</div>` : ""}</td></tr></table>
</td></tr>`;
    const w = window.open("", "_blank");
    w.document.write(buildEmailHTML(r.nome, content));
    w.document.close();
  }

  async function notificarTodos() {
    if (!configured) { setStatus("notcfg"); return; }
    setStatus("loading");
    try {
      const { data: joiners } = await supabase.from("joiners").select("cog, nome, email, last_notified_at").not("email", "is", null).neq("email", "");
      if (!joiners?.length) { setStatus("done"); setResultado({ enviados:0, semPendencia:0, cooldown:0 }); return; }

      const { data: itens } = await supabase.from("masterlist").select("cog, nome_do_item, ceg, pago_item, valor_item, pago_frete, frete_inter, pago_rf, taxa_rf, venc_item, venc_frete, venc_rf").neq("cog","disponivel");

      setStatus("sending");
      let enviados = 0, semPendencia = 0, cooldown = 0;
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      for (const j of joiners) {
        const meus = (itens || []).filter(i => i.cog === j.cog);
        const pendentes = meus.filter(i =>
          (isPendente(i.pago_item)  && Number(i.valor_item||0)  > 0) ||
          (isPendente(i.pago_frete) && Number(i.frete_inter||0) > 0) ||
          (isPendente(i.pago_rf)    && Number(i.taxa_rf||0)     > 0)
        );

        if (pendentes.length === 0) { semPendencia++; continue; }

        const ultimoEnvio = j.last_notified_at
          ? new Date(j.last_notified_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
          : null;
        if (ultimoEnvio === hoje) { cooldown++; continue; }

        const totalPend = pendentes.reduce((s,i) =>
          s + (isPendente(i.pago_item)  ? Number(i.valor_item||0)  : 0)
            + (isPendente(i.pago_frete) ? Number(i.frete_inter||0) : 0)
            + (isPendente(i.pago_rf)    ? Number(i.taxa_rf||0)     : 0), 0);
        const totalMulta = pendentes.reduce((s,i) =>
          s + diasAtraso(i.venc_item) + diasAtraso(i.venc_frete) + diasAtraso(i.venc_rf), 0);

        const itemRows = pendentes.map(i => {
          const v = (isPendente(i.pago_item)  ? Number(i.valor_item||0)  : 0)
                  + (isPendente(i.pago_frete) ? Number(i.frete_inter||0) : 0)
                  + (isPendente(i.pago_rf)    ? Number(i.taxa_rf||0)     : 0);
          return `<tr><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#F5F0E8">${i.nome_do_item}${i.ceg ? `<div style="font-size:10px;color:rgba(245,240,232,0.3);margin-top:2px">${i.ceg}</div>` : ""}</td><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;text-align:right;white-space:nowrap;font-size:12px;color:#FF5C1A">R$&nbsp;${fmtBRL(v)}</td></tr>`;
        }).join("");
        const emailContent = `<tr><td style="background:#111111;padding:20px 40px 8px">
  <p style="margin:0 0 18px;font-size:13px;color:rgba(245,240,232,0.65);line-height:1.6">Constam em seu portal os seguintes itens com pagamento em aberto:</p>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #1e1e1e">${itemRows}<tr><td colspan="2" style="padding:16px 0 8px;text-align:right"><div style="font-size:10px;color:rgba(245,240,232,0.3);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Total em aberto</div><div style="font-size:26px;font-weight:900;color:#BAFF39">R$&nbsp;${fmtBRL(totalPend + totalMulta)}</div>${totalMulta > 0 ? `<div style="font-size:10px;color:rgba(255,92,26,0.7);margin-top:4px">R$&nbsp;${fmtBRL(totalPend)} item + R$&nbsp;${fmtBRL(totalMulta)} multa</div>` : ""}</td></tr></table>
</td></tr>`;
        const corpo = buildEmailHTML(j.nome || j.cog, emailContent);
        await sendEmailJoiner(j.email, j.nome, "📋 Pagamentos em aberto — ANTICEG", corpo);
        await supabase.from("joiners").update({ last_notified_at: new Date().toISOString() }).eq("cog", j.cog);
        enviados++;
      }

      setResultado({ enviados, semPendencia, cooldown });
      setStatus("done");
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  function previewEmail() {
    const mockItems = [
      { nome_do_item: "Leebit SKZOO Plush", ceg: "7TH FAN", pend: 85.00 },
      { nome_do_item: "Photo Card Set", ceg: "SKZ", pend: 45.00 },
      { nome_do_item: "Frete Internacional", ceg: "", pend: 22.50 },
    ];
    const mockTotal = mockItems.reduce((s, i) => s + i.pend, 0);
    const mockMulta = 3.00;
    const itemRows = mockItems.map(it =>
      `<tr><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#F5F0E8">${it.nome_do_item}${it.ceg ? `<div style="font-size:10px;color:rgba(245,240,232,0.3);margin-top:2px">${it.ceg}</div>` : ""}</td><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;text-align:right;white-space:nowrap;font-size:12px;color:#FF5C1A">R$&nbsp;${fmtBRL(it.pend)}</td></tr>`
    ).join("");
    const content = `<tr><td style="background:#111111;padding:20px 40px 8px">
  <p style="margin:0 0 18px;font-size:13px;color:rgba(245,240,232,0.65);line-height:1.6">Constam em seu portal os seguintes itens com pagamento em aberto:</p>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #1e1e1e">${itemRows}<tr><td colspan="2" style="padding:16px 0 8px;text-align:right"><div style="font-size:10px;color:rgba(245,240,232,0.3);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Total em aberto</div><div style="font-size:26px;font-weight:900;color:#BAFF39">R$&nbsp;${fmtBRL(mockTotal + mockMulta)}</div><div style="font-size:10px;color:rgba(255,92,26,0.7);margin-top:4px">R$&nbsp;${fmtBRL(mockTotal)} item + R$&nbsp;${fmtBRL(mockMulta)} multa</div></td></tr></table>
</td></tr>`;
    const html = buildEmailHTML("Antigom Exemplo", content);
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  }

  return (
    <div style={{ marginBottom:20, padding:"14px 16px", background:"var(--card-bg)", border:"1px solid rgba(201,168,240,.15)", borderRadius:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)" }}>Notificar todos os joiners</div>
        <EmailTypeBadge type="pagamento" />
      </div>
      <div style={{ fontSize:11, color:"rgba(245,240,232,.58)", marginBottom:12 }}>
        Envia um e-mail para cada joiner com pagamentos em aberto. Use após atualizar a planilha.
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <button onClick={notificarTodos} disabled={!!status && status !== "done" && status !== "error" && status !== "notcfg"} style={{
          background:"rgba(201,168,240,.1)", border:"1px solid rgba(201,168,240,.3)",
          color:"#C9A8F0", borderRadius:8, padding:"9px 18px",
          fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer", letterSpacing:".05em"
        }}>
          {status === "loading" ? "Carregando dados..." : status === "sending" ? "Enviando e-mails..." : "✉ Notificar todos →"}
        </button>
        <button onClick={() => { if (listaOpen) { setListaOpen(false); } else if (lista) { setListaOpen(true); } else { carregarLista(); } }} style={{
          background:"none", border:"1px solid rgba(245,240,232,.15)",
          color:"rgba(245,240,232,.55)", borderRadius:8, padding:"9px 14px",
          fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".05em"
        }}>{listaLoading ? "carregando..." : listaOpen ? "ocultar lista" : "ver destinatários"}</button>
      </div>

      {listaOpen && lista !== null && (
        <div style={{ marginTop:12, borderRadius:8, overflow:"hidden", border:"1px solid rgba(245,240,232,.08)" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto auto auto", gap:0,
            background:"rgba(245,240,232,.04)", padding:"6px 12px",
            fontSize:9, letterSpacing:"1px", textTransform:"uppercase", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>
            <span>Nome</span><span>@</span><span>E-mail</span><span style={{ textAlign:"center" }}>Itens</span><span style={{ textAlign:"right" }}>Total</span><span></span>
          </div>
          {lista.length === 0
            ? <div style={{ padding:"12px", fontSize:11, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace" }}>Nenhum joiner com pagamento pendente e e-mail cadastrado.</div>
            : lista.map((r, i) => (
              <div key={r.cog} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto auto auto", gap:0,
                padding:"8px 12px", borderTop:"1px solid rgba(245,240,232,.05)",
                background: i % 2 === 0 ? "transparent" : "rgba(245,240,232,.02)", alignItems:"center" }}>
                <span style={{ fontSize:11, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.nome}</span>
                <span style={{ fontSize:11, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace" }}>@{r.cog}</span>
                <span style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.email}</span>
                <span style={{ fontSize:11, color:"rgba(245,240,232,.5)", fontFamily:"'DM Mono',monospace", textAlign:"center", paddingLeft:8 }}>{r.nItens}i</span>
                <span style={{ fontSize:11, color:"#BAFF39", fontFamily:"'DM Mono',monospace", textAlign:"right", paddingLeft:12, fontWeight:700 }}>R${fmtBRL(r.total)}</span>
                <button onClick={() => previewJoiner(r)} style={{ marginLeft:10, background:"none", border:"1px solid rgba(245,240,232,.15)", color:"rgba(245,240,232,.45)", borderRadius:4, padding:"3px 8px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>ver</button>
              </div>
            ))
          }
          {lista.length > 0 && (
            <div style={{ padding:"6px 12px", borderTop:"1px solid rgba(245,240,232,.06)", display:"flex", justifyContent:"space-between",
              fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>
              <span>{lista.length} destinatário{lista.length !== 1 ? "s" : ""}</span>
              <span style={{ color:"#BAFF39" }}>R${fmtBRL(lista.reduce((s, r) => s + r.total, 0))} total em aberto</span>
            </div>
          )}
        </div>
      )}

      {status === "notcfg" && <div style={{ fontSize:11, color:"#ff6b6b", marginTop:8, fontFamily:"'DM Mono',monospace" }}>Configure o EmailJS primeiro.</div>}
      {status === "error"   && <div style={{ fontSize:11, color:"#ff6b6b", marginTop:8, fontFamily:"'DM Mono',monospace" }}>Erro ao enviar. Tente novamente.</div>}
      {status === "done" && resultado && (
        <div style={{ fontSize:11, color:"#4ade80", marginTop:8, fontFamily:"'DM Mono',monospace", lineHeight:1.7 }}>
          ✓ {resultado.enviados} e-mail(s) enviado(s)
          {resultado.semPendencia > 0 && <span style={{ color:"rgba(245,240,232,.52)" }}> · {resultado.semPendencia} sem pendência</span>}
          {resultado.cooldown > 0 && <span style={{ color:"rgba(245,240,232,.52)" }}> · {resultado.cooldown} já notificado(s) hoje</span>}
        </div>
      )}
    </div>
  );
}

function AdminPinBlock() {
  const [pin,     setPin]     = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState("");

  async function salvar() {
    if (!pin.trim()) return;
    if (pin !== confirm) { setMsg("Os PINs não coincidem."); return; }
    setSaving(true);
    const { data } = await supabase.from("config").select("id").eq("key","admin_pin").maybeSingle();
    if (data) await supabase.from("config").update({ value: pin }).eq("key","admin_pin");
    else       await supabase.from("config").insert({ key:"admin_pin", value: pin });
    setMsg("PIN salvo! Vai valer no próximo acesso."); setPin(""); setConfirm(""); setSaving(false);
  }

  async function remover() {
    if (!window.confirm("Remover o PIN? O admin ficará sem senha.")) return;
    await supabase.from("config").delete().eq("key","admin_pin");
    setMsg("PIN removido."); setPin(""); setConfirm("");
  }

  return (
    <div style={{ marginBottom:20, padding:"14px 16px", background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.08)", borderRadius:10 }}>
      <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)", marginBottom:2 }}>PIN de acesso Admin</div>
      <div style={{ fontSize:11, color:"rgba(245,240,232,.45)", marginBottom:12 }}>Exige senha ao clicar em Admin. Deixe vazio para desativar.</div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <input type="password" placeholder="Novo PIN" value={pin} onChange={e => { setPin(e.target.value); setMsg(""); }}
          style={{ background:"#0d0d0d", border:"1px solid #222", borderRadius:6, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:13, padding:"8px 12px", outline:"none", width:130, letterSpacing:4 }} />
        <input type="password" placeholder="Confirmar" value={confirm} onChange={e => { setConfirm(e.target.value); setMsg(""); }}
          style={{ background:"#0d0d0d", border:"1px solid #222", borderRadius:6, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:13, padding:"8px 12px", outline:"none", width:130, letterSpacing:4 }} />
        <button onClick={salvar} disabled={saving || !pin} style={{ background:"var(--laranja)", color:"#111", border:"none", borderRadius:6, fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, padding:"8px 16px", cursor:"pointer", opacity: pin ? 1 : .4 }}>
          {saving ? "..." : "Salvar PIN"}
        </button>
        <button onClick={remover} style={{ background:"none", border:"1px solid rgba(245,240,232,.1)", color:"rgba(245,240,232,.35)", borderRadius:6, fontFamily:"'DM Mono',monospace", fontSize:11, padding:"8px 14px", cursor:"pointer" }}>
          Remover
        </button>
      </div>
      {msg && <div style={{ marginTop:8, fontSize:11, fontFamily:"'DM Mono',monospace", color: msg.includes("coincidem") ? "var(--laranja)" : "var(--verde)" }}>{msg}</div>}
    </div>
  );
}

function AdminTab({ owner = false, userCog = "", resetSignal = 0 }) {
  const [manutencaoAdmin, setManutencaoAdmin] = useState(false);
  const [reports, setReports] = useState([]);
  const [adminTab, setAdminTab] = useState("pendentes");
  const [adminMainTab, setAdminMainTab] = useState("home");
  useEffect(() => { setAdminMainTab("home"); }, [resetSignal]);
  const [pushes, setPushes] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [novoPush, setNovoPush] = useState("");
  const [sendingPush, setSendingPush] = useState(false);
  const [pendentesData, setPendentesData] = useState([]);
  const [disponiveisData, setDisponiveisData] = useState([]);
  const [joinersData, setJoinersData] = useState([]);
  const [confirmacoes, setConfirmacoes] = useState([]);
  const [staffAcessos,      setStaffAcessos]      = useState(null);
  const [envioSolic,        setEnvioSolic]        = useState([]);
  const [envioLoading,      setEnvioLoading]      = useState(null);
  const [calEventos,        setCalEventos]        = useState([]);
  const [novoEvData,        setNovoEvData]        = useState("");
  const [novoEvDataFim,     setNovoEvDataFim]     = useState("");
  const [novoEvTitulo,      setNovoEvTitulo]      = useState("");
  const [novoEvTipo,        setNovoEvTipo]        = useState("envio");
  const [savingEv,          setSavingEv]          = useState(false);
  const [filtroEnvio,       setFiltroEnvio]       = useState("todos");
  const [expandedEnvio,     setExpandedEnvio]     = useState(new Set());
  const [rastreioAberto,    setRastreioAberto]    = useState(null);
  const [rastreioCodigo,    setRastreioCodigo]    = useState("");
  const [rastreioLink,      setRastreioLink]      = useState("");
  const [cotacaoAberta,     setCotacaoAberta]     = useState(null);
  const [cotacaoOpcoes,     setCotacaoOpcoes]     = useState([{ forma:"", valor:"", prazo:"" }]);
  const [cotacaoEmbalagem,  setCotacaoEmbalagem]  = useState("");
  const [cotacaoObs,        setCotacaoObs]        = useState("");

  async function confirmarEnvio(s) {
    if (!rastreioCodigo.trim()) { alert("Informe o código de rastreio antes de confirmar."); return; }
    setEnvioLoading(s.id);
    for (const it of (s.itens || [])) {
      await supabase.from("masterlist").update({ status: "Enviado Nacional" }).eq("id", it.id);
    }
    await supabase.from("envio_solicitacoes").update({
      status: "enviado",
      rastreio_codigo: rastreioCodigo.trim(),
      rastreio_link: rastreioLink.trim() || null,
    }).eq("id", s.id);
    const pushMsg = rastreioLink.trim()
      ? `Seu pedido foi enviado! Código de rastreio: ${rastreioCodigo.trim()}. Acompanhe em: ${rastreioLink.trim()}`
      : `Seu pedido foi enviado! Código de rastreio: ${rastreioCodigo.trim()}.`;
    await supabase.from("pushes").insert([{ message: pushMsg, active: true, joiner_cog: s.joiner_cog }]);
    setEnvioSolic(prev => prev.map(x => x.id === s.id ? { ...x, status:"enviado", rastreio_codigo:rastreioCodigo.trim(), rastreio_link:rastreioLink.trim()||null } : x));
    setEnvioLoading(null);
    setRastreioAberto(null); setRastreioCodigo(""); setRastreioLink("");
  }

  async function enviarCotacao(s) {
    const preenchidas = cotacaoOpcoes.filter(o => o.forma && o.valor && o.prazo);
    if (preenchidas.length === 0) { alert("Preencha ao menos uma modalidade completa."); return; }
    const valorDeclarado = s.seguro === "sim" ? s.valor_seguro : null;
    const emb      = pf(cotacaoEmbalagem);
    const minPreco = Math.min(...preenchidas.map(o => pf(o.valor)));
    const bestOp   = preenchidas.find(o => parseFloat(o.valor) === minPreco);
    const totalFmt = (minPreco + emb).toFixed(2).replace(".", ",");
    await supabase.from("envio_solicitacoes").update({
      cotacao_opcoes:    preenchidas,
      cotacao_frete:     bestOp.valor,
      cotacao_forma:     bestOp.forma,
      cotacao_seguro:    valorDeclarado || null,
      cotacao_embalagem: cotacaoEmbalagem || null,
      cotacao_valor:     totalFmt,
      cotacao_prazo:     bestOp.prazo,
      cotacao_obs:       cotacaoObs || null,
      cotacao_at:        new Date().toISOString(),
      status:            "pagamento em aberto",
    }).eq("id", s.id);
    await supabase.from("pushes").insert([{
      message: `Sua cotação de envio está disponível! A partir de R$ ${totalFmt} via ${bestOp.forma}. Acesse Meu Perfil → Envios para ver as opções.`,
      active: true,
      joiner_cog: s.joiner_cog,
    }]);
    setEnvioSolic(prev => prev.map(x => x.id === s.id ? { ...x, status:"pagamento em aberto", cotacao_opcoes:preenchidas, cotacao_frete:bestOp.valor, cotacao_forma:bestOp.forma, cotacao_seguro:valorDeclarado||null, cotacao_embalagem:cotacaoEmbalagem, cotacao_valor:totalFmt, cotacao_prazo:bestOp.prazo, cotacao_obs:cotacaoObs } : x));
    setCotacaoAberta(null); setCotacaoOpcoes([{ forma:"", valor:"", prazo:"" }]); setCotacaoEmbalagem(""); setCotacaoObs("");
  }

  async function cancelarCotacao(s) {
    if (!window.confirm("Cancelar a cotação enviada? O joiner será notificado e a solicitação volta para 'em cotação'.")) return;
    await supabase.from("envio_solicitacoes").update({
      status: "cotação em andamento", cotacao_opcoes: null, cotacao_frete: null, cotacao_forma: null,
      cotacao_embalagem: null, cotacao_valor: null, cotacao_prazo: null, cotacao_obs: null,
      cotacao_at: null, cotacao_seguro: null,
    }).eq("id", s.id);
    await supabase.from("pushes").insert([{
      message: "Sua cotação de envio foi cancelada e será refeita em breve. Aguarde a nova cotação.",
      active: true, joiner_cog: s.joiner_cog,
    }]);
    setEnvioSolic(prev => prev.map(x => x.id === s.id ? { ...x, status:"cotação em andamento", cotacao_opcoes:null, cotacao_frete:null, cotacao_forma:null, cotacao_embalagem:null, cotacao_valor:null, cotacao_prazo:null, cotacao_obs:null, cotacao_seguro:null } : x));
  }

  async function cancelarSolicitacaoAdmin(s) {
    if (!window.confirm("Cancelar esta solicitação de envio? O joiner será notificado.")) return;
    await supabase.from("envio_solicitacoes").update({ status: "cancelado" }).eq("id", s.id);
    await supabase.from("pushes").insert([{
      message: "Sua solicitação de envio foi cancelada. Entre em contato com a GOM para mais informações.",
      active: true, joiner_cog: s.joiner_cog,
    }]);
    setEnvioSolic(prev => prev.map(x => x.id === s.id ? { ...x, status:"cancelado" } : x));
  }

  async function corrigirItem(s, it) {
    const nomeItem = it.nome || it.nome_do_item || it.ceg || "item";
    if (!window.confirm(`Corrigir "${nomeItem}"? O status volta para ANTIGOM e o joiner receberá uma notificação.`)) return;
    await supabase.from("masterlist").update({ status: "ANTIGOM" }).eq("id", it.id);
    await supabase.from("pushes").insert([{
      message: `O item "${nomeItem}" (${it.ceg}) ainda não chegou à GOM. Entre em contato com a GOM para mais informações.`,
      active: true,
      joiner_cog: s.joiner_cog,
    }]);
    alert(`Status revertido e notificação enviada para ${s.joiner_nome || s.joiner_cog}.`);
  }

  useEffect(() => {
    supabase.from("config").select("value").eq("key", "manutencao").single()
      .then(({ data }) => { if (data) setManutencaoAdmin(data.value === "true"); });
    supabase.from("config").select("value").eq("key", "staff_acessos").single()
      .then(async ({ data }) => {
        if (data?.value) {
          try { setStaffAcessos(JSON.parse(data.value)); } catch { setStaffAcessos({}); }
        } else {
          const defaults = {};
          STAFF_MEMBERS.forEach(s => { defaults[s.cog] = [...DEFAULT_STAFF_ACESSOS]; });
          setStaffAcessos(defaults);
          if (owner) {
            await supabase.from("config").insert({ key:"staff_acessos", value: JSON.stringify(defaults) });
          }
        }
      });
    supabase.from("reports").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setReports(data); });
    supabase.from("pushes").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setPushes(data); });
    supabase.from("feedbacks").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setFeedbacks(data); });
    supabase.from("confirmacoes").select("*").eq("visto", false).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setConfirmacoes(data); });
    supabase.from("envio_solicitacoes").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setEnvioSolic(data); });
    supabase.from("cal_eventos").select("*").order("data")
      .then(({ data }) => { if (data) setCalEventos(data); });
    // Masterlist separada: joiners reais (sem disponivel) e disponíveis
    (async () => {
      const sel = "id, cog, nome, ceg, nome_do_item, status, valor_item, frete_inter, taxa_rf, pago_item, pago_frete, pago_rf, venc_item, venc_frete, venc_rf, info_adicionais";

      // Itens de joiners reais — exclui cog "disponivel" na query
      let joiners_all = [], from = 0;
      while (true) {
        const { data } = await supabase.from("masterlist")
          .select(sel)
          .neq("cog", "disponivel")
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        joiners_all = [...joiners_all, ...data];
        if (data.length < 1000) break;
        from += 1000;
      }
      setPendentesData(joiners_all);

      // Itens disponíveis para venda
      const { data: dispData } = await supabase.from("masterlist")
        .select(sel)
        .eq("cog", "disponivel");
      setDisponiveisData(dispData || []);

      const { data: jData } = await supabase.from("joiners").select("cog, nome, bloqueado").order("nome");
      setJoinersData(jData || []);
    })();
  }, []);

  async function enviarPush() {
    if (!novoPush.trim()) return;
    setSendingPush(true);
    const { data } = await supabase.from("pushes").insert([{ message: novoPush.trim() }]).select().single();
    if (data) setPushes(p => [data, ...p]);
    setNovoPush("");
    setSendingPush(false);
  }
  async function desativarPush(id) {
    await supabase.from("pushes").update({ active: false }).eq("id", id);
    setPushes(p => p.map(x => x.id === id ? { ...x, active: false } : x));
  }

  async function marcarResolvido(rep) {
    const { error } = await supabase.from("reports").update({ status: "resolvido" }).eq("id", rep.id);
    if (error) { alert("Erro ao resolver report: " + error.message); return; }
    await supabase.from("notifications").insert([{
      joiner_cog: rep.joiner_cog,
      message: `Seu report sobre "${rep.item_nome}" foi resolvido.`,
      type: "report_resolved",
      report_id: rep.id,
    }]);
    const joinerInfo = joinersData.find(j => j.cog === rep.joiner_cog);
    if (joinerInfo?.email) {
      sendEmailJoiner(
        joinerInfo.email,
        joinerInfo.nome || rep.joiner_cog,
        "Seu report foi resolvido ✓",
        buildEmailHTML(joinerInfo.nome || rep.joiner_cog, `<tr><td style="background:#111111;padding:20px 40px 24px"><p style="margin:0 0 14px;font-size:13px;color:rgba(245,240,232,0.65);line-height:1.6">Seu report sobre o item abaixo foi marcado como <strong style="color:#BAFF39">resolvido</strong>:</p><div style="background:#0D0D0D;border-radius:6px;padding:14px 16px;border-left:3px solid #BAFF39"><div style="font-size:13px;font-weight:700;color:#F5F0E8">${rep.item_nome}</div></div></td></tr>`)
      );
    }
    setReports(r => r.map(x => x.id === rep.id ? { ...x, status: "resolvido" } : x));
  }
  async function desfazerResolvido(id) {
    const { error } = await supabase.from("reports").update({ status: "pendente" }).eq("id", id);
    if (error) { alert("Erro ao desfazer: " + error.message); return; }
    setReports(r => r.map(x => x.id === id ? { ...x, status: "pendente" } : x));
  }
  async function toggleManutencao() {
    const novo = !manutencaoAdmin;
    await supabase.from("config").update({ value: String(novo) }).eq("key", "manutencao");
    setManutencaoAdmin(novo);
  }

  const totalPend = envioSolic.filter(e => e.status === "solicitação de envio").length
                  + reports.filter(r => r.status !== "resolvido").length
                  + confirmacoes.length;
  const greetMsg = totalPend > 0
    ? `${totalPend} pendência${totalPend > 1 ? "s" : ""} esperando você →`
    : "tudo em dia! bom trabalho ✓";

  return (
    <div className="admin-wrap">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <h2 className="admin-title" style={{ margin:0 }}>⚙ Admin</h2>
        <a href="https://docs.google.com/spreadsheets/d/1JOH6f_FYs5EVL4M_bNB-1_Bm9FtPN38f/edit?gid=2116437995#gid=2116437995" target="_blank" rel="noopener noreferrer" style={{
          display:"flex", alignItems:"center", gap:6,
          background:"rgba(186,255,57,.08)", border:"1px solid rgba(186,255,57,.25)",
          color:"var(--verde)", borderRadius:8, padding:"7px 14px",
          fontSize:11, fontFamily:"'DM Mono',monospace", textDecoration:"none",
          letterSpacing:".05em", whiteSpace:"nowrap"
        }}>
          ↗ Planilha
        </a>
      </div>

      <div className="admin-greeting">
        <span className="admin-greeting-prompt">// </span>
        <span className="admin-greeting-msg">{greetMsg}</span>
      </div>

      <div className="admin-layout">
        {/* Sidebar */}
        {(() => {
          const meuAcesso = !owner && staffAcessos ? (staffAcessos[userCog] || DEFAULT_STAFF_ACESSOS) : null;
          const temAcesso = (id) => owner || !meuAcesso || meuAcesso.includes(id);
          const nav = (id, label, icon, badge) => (
            <button key={id} className={`admin-sidebar-item${adminMainTab === id ? " active" : ""}`} onClick={() => setAdminMainTab(id)}>
              <span>{icon}</span>{label}
              {badge > 0 && <span className="admin-sidebar-badge">{badge}</span>}
            </button>
          );
          return (
            <nav className="admin-sidebar">
              <div className="admin-sidebar-group">
                <div className="admin-sidebar-group-label">Operacional</div>
                {temAcesso("envios")    && nav("envios",    "Envios",    "◫", envioSolic.filter(e => e.status === "solicitação de envio").length || 0)}
                {temAcesso("reports")   && nav("reports",   "Reports",   "⚑", reports.filter(r => r.status !== "resolvido").length || 0)}
                {temAcesso("cadastros") && nav("cadastros", "Cadastros", "👤", confirmacoes.length || 0)}
              </div>
              <div className="admin-sidebar-group">
                <div className="admin-sidebar-group-label">Financeiro</div>
                {temAcesso("pagamentos")  && nav("pagamentos",  "Pagamentos",  "💸", 0)}
                {temAcesso("disponiveis") && nav("disponiveis", "Disponíveis", "🛒", 0)}
              </div>
              {owner && (
                <div className="admin-sidebar-group">
                  <div className="admin-sidebar-group-label">Config</div>
                  {nav("geral",     "Geral",     "⚙", 0)}
                  {nav("agenda",    "Agenda",    "📅", 0)}
                  {temAcesso("blocklist") && nav("blocklist", "Blocklist", "🚫", 0)}
                </div>
              )}
            </nav>
          );
        })()}

        {/* Conteúdo */}
        <div className="admin-content">

      {adminMainTab === "home" && (() => {
        const cards = [
          { id:"envios",    icon:"◫", label:"Envios",    count: envioSolic.filter(e => e.status === "solicitação de envio").length, sub:"nova solicitação", color:"#BAFF39", bg:"rgba(186,255,57,.06)", border:"rgba(186,255,57,.18)" },
          { id:"reports",   icon:"⚑", label:"Reports",   count: reports.filter(r => r.status !== "resolvido").length, sub:"pendente", color:"var(--laranja)", bg:"rgba(255,92,26,.06)", border:"rgba(255,92,26,.2)" },
          { id:"cadastros", icon:"👤", label:"Cadastros", count: confirmacoes.length, sub:"aguardando", color:"var(--lilas)", bg:"rgba(201,168,240,.06)", border:"rgba(201,168,240,.18)" },
        ].filter(c => c.count > 0);
        return (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10, marginBottom:24 }}>
              {cards.length === 0 ? (
                <div style={{ gridColumn:"1/-1", padding:"32px 0", textAlign:"center", fontFamily:"'DM Mono',monospace", fontSize:12, color:"rgba(245,240,232,.3)" }}>
                  nada pendente por aqui ✓
                </div>
              ) : cards.map(c => (
                <div key={c.id} onClick={() => setAdminMainTab(c.id)} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:"18px 16px", cursor:"pointer", transition:"all .15s" }}>
                  <div style={{ fontSize:20, marginBottom:8 }}>{c.icon}</div>
                  <div style={{ fontSize:28, fontWeight:900, color:c.color, fontFamily:"'DM Mono',monospace", lineHeight:1 }}>{c.count}</div>
                  <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.5)", marginTop:4, textTransform:"uppercase", letterSpacing:"1px" }}>{c.label}</div>
                  <div style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.3)", marginTop:2 }}>{c.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.2)", letterSpacing:".05em" }}>
              selecione uma seção na barra lateral →
            </div>
          </div>
        );
      })()}

      {adminMainTab === "geral" && owner && <>
      <AdminLinks />
      <AdminPinBlock />

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, padding:"14px 16px", background:"var(--card-bg)", border:`1px solid ${manutencaoAdmin ? "rgba(255,90,31,.3)" : "rgba(245,240,232,.08)"}`, borderRadius:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)" }}>Modo Manutenção</div>
          <div style={{ fontSize:11, color:"rgba(245,240,232,.62)", marginTop:2 }}>{manutencaoAdmin ? "⚠ Site bloqueado para todos (exceto admin)" : "Site normal — joiners têm acesso completo"}</div>
        </div>
        <button onClick={toggleManutencao} style={{
          background: manutencaoAdmin ? "rgba(255,90,31,.15)" : "rgba(74,222,128,.15)",
          border: `1px solid ${manutencaoAdmin ? "rgba(255,90,31,.4)" : "rgba(74,222,128,.4)"}`,
          color: manutencaoAdmin ? "var(--laranja)" : "#4ade80",
          borderRadius:8, padding:"8px 18px", fontSize:12,
          fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer"
        }}>
          {manutencaoAdmin ? "OFF" : "ON"}
        </button>
      </div>

      <EmailJSTestBlock />
      <EmailPreviewsBlock />
      <NotificarTodosBlock />

      <div style={{ marginTop: 28, marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--offwhite)", marginBottom: 12 }}>Avisos / Push para joiners</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={novoPush} onChange={e => setNovoPush(e.target.value)}
            onKeyDown={e => e.key === "Enter" && enviarPush()}
            placeholder="Ex: Atenção! Prazo de pagamento amanhã..."
            style={{ flex: 1, background: "#0d0d0d", border: "1px solid rgba(245,240,232,.12)", borderRadius: 8, padding: "10px 14px", color: "var(--offwhite)", fontFamily: "'DM Mono',monospace", fontSize: 12, outline: "none" }}
          />
          <button onClick={enviarPush} disabled={sendingPush || !novoPush.trim()} style={{ background: "var(--laranja)", color: "#000", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 700, cursor: "pointer", opacity: novoPush.trim() ? 1 : 0.4 }}>
            {sendingPush ? "..." : "Enviar →"}
          </button>
        </div>
        {pushes.length === 0 && <div style={{ fontSize: 12, color: "rgba(245,240,232,.3)" }}>Nenhum aviso enviado ainda.</div>}
        {pushes.map(p => <PushAdminCard key={p.id} p={p} onDesativar={() => desativarPush(p.id)} />)}
      </div>

      </>}

      {adminMainTab === "reports" && <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          {["pendentes", "finalizados"].map(t => {
            const count = t === "pendentes" ? reports.filter(r => r.status !== "resolvido").length : reports.filter(r => r.status === "resolvido").length;
            const active = adminTab === t;
            return (
              <button key={t} onClick={() => setAdminTab(t)} style={{
                background: active ? "rgba(245,240,232,.08)" : "none",
                border: `1px solid ${active ? "rgba(245,240,232,.2)" : "rgba(245,240,232,.07)"}`,
                color: active ? "var(--offwhite)" : "rgba(245,240,232,.35)",
                borderRadius: 8, padding: "6px 16px", fontSize: 12,
                fontFamily: "'DM Mono',monospace", fontWeight: active ? 700 : 400, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7, textTransform: "uppercase", letterSpacing: ".08em"
              }}>
                {t}
                {count > 0 && (
                  <span style={{ background: t === "pendentes" ? "var(--laranja)" : "rgba(74,222,128,.2)", color: t === "pendentes" ? "#000" : "#4ade80", borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
        {reports.filter(r => adminTab === "pendentes" ? r.status !== "resolvido" : r.status === "resolvido").length === 0 && (
          <div style={{ fontSize: 12, color: "rgba(245,240,232,.3)", padding: "16px 0" }}>Nenhum report {adminTab === "pendentes" ? "pendente" : "finalizado"} ainda.</div>
        )}
        {reports.filter(r => adminTab === "pendentes" ? r.status !== "resolvido" : r.status === "resolvido").map(r => {
          const erroLabels = [
            r.erro_item      && "Item incorreto",
            r.erro_valor     && "Valor incorreto",
            r.erro_frete     && "Frete incorreto",
            r.erro_taxa      && "Taxa RF incorreta",
            r.erro_pagamento && "Já paguei (pendente)",
            r.erro_recebido  && "Já recebi esse item",
            r.erro_outro     && "Outro problema",
          ].filter(Boolean);
          return (
          <div key={r.id} style={{ padding: "14px 16px", background: "var(--card-bg)", border: `1px solid ${r.status === "resolvido" ? "rgba(74,222,128,.15)" : "rgba(255,92,26,.25)"}`, borderRadius: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--offwhite)" }}>
                  {r.joiner_nome} <span className="cog-tip" data-nome={r.joiner_nome} style={{ fontSize: 10, color: "rgba(245,240,232,.3)", fontWeight: 400 }}>@{r.joiner_cog}</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(245,240,232,.5)", marginTop: 3 }}>
                  {r.item_nome} <span style={{ color: "rgba(245,240,232,.25)" }}>· {r.ceg}</span>
                </div>
                {erroLabels.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {erroLabels.map(l => (
                      <span key={l} style={{ fontSize: 10, background: "rgba(255,92,26,.12)", border: "1px solid rgba(255,92,26,.25)", borderRadius: 4, padding: "2px 7px", color: "var(--laranja)" }}>{l}</span>
                    ))}
                  </div>
                )}
                {(r.motivo_item || r.correcao_valor || r.correcao_frete || r.correcao_taxa) && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(245,240,232,.4)", display: "flex", flexDirection: "column", gap: 2 }}>
                    {r.motivo_item     && <span>↳ Item: {r.motivo_item}</span>}
                    {r.correcao_valor  && <span>↳ Valor correto: {r.correcao_valor}</span>}
                    {r.correcao_frete  && <span>↳ Frete correto: {r.correcao_frete}</span>}
                    {r.correcao_taxa   && <span>↳ Taxa correta: {r.correcao_taxa}</span>}
                  </div>
                )}
                {r.erro_pagamento && (r.pag_data || r.pag_valor || r.pag_metodo) && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(245,240,232,.4)", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {r.pag_data   && <span>Data pag: <strong style={{ color: "var(--offwhite)" }}>{new Date(r.pag_data + "T12:00:00").toLocaleDateString("pt-BR")}</strong></span>}
                    {r.pag_valor  && <span>Valor: <strong style={{ color: "var(--offwhite)" }}>{r.pag_valor}</strong></span>}
                    {r.pag_metodo && <span>Método: <strong style={{ color: "var(--offwhite)" }}>{r.pag_metodo}</strong></span>}
                    {r.pag_data_forms && <span>Forms em: <strong style={{ color: "var(--offwhite)" }}>{new Date(r.pag_data_forms).toLocaleString("pt-BR")}</strong></span>}
                  </div>
                )}
                {r.observacao && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(245,240,232,.5)", fontStyle: "italic" }}>"{r.observacao}"</div>
                )}
                <div style={{ fontSize: 10, color: "rgba(245,240,232,.2)", marginTop: 6 }}>
                  Reportado em {new Date(r.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                {r.status === "pendente" ? (
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <EmailTypeBadge type="report" />
                  <button onClick={() => marcarResolvido(r)} style={{ background: "rgba(74,222,128,.1)", border: "1px solid rgba(74,222,128,.3)", color: "#4ade80", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontFamily: "'DM Mono',monospace", cursor: "pointer", whiteSpace: "nowrap" }}>
                    Resolver ✓
                  </button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 11, color: "#4ade80" }}>✓ resolvido</span>
                    <button onClick={() => desfazerResolvido(r.id)} style={{ background: "none", border: "1px solid rgba(245,240,232,.1)", color: "rgba(245,240,232,.3)", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer", whiteSpace: "nowrap" }}>
                      desfazer
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>}

      {adminMainTab === "cadastros"   && <AdminCadastros confirmacoes={confirmacoes} onUpdate={setConfirmacoes} />}
      {adminMainTab === "pagamentos"  && <AdminPagamentos data={pendentesData} joiners={joinersData} />}
      {adminMainTab === "disponiveis" && <AdminDisponivel data={disponiveisData} />}
      {adminMainTab === "blocklist"   && <AdminBlocklist data={pendentesData} joiners={joinersData} onUpdate={setJoinersData} />}

      {adminMainTab === "agenda" && owner && (
        <div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.35)", letterSpacing:"1px", textTransform:"uppercase", marginBottom:16 }}>Adicionar data ao calendário</div>

          {/* Form */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              <input type="date" value={novoEvData} onChange={e => setNovoEvData(e.target.value)}
                style={{ background:"#0d0d0d", border:"1px solid #222", borderRadius:6, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"8px 12px", outline:"none" }} />
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"rgba(245,240,232,.35)" }}>à</span>
              <input type="date" value={novoEvDataFim} min={novoEvData || undefined} onChange={e => setNovoEvDataFim(e.target.value)}
                style={{ background:"#0d0d0d", border:"1px solid #222", borderRadius:6, color: novoEvDataFim ? "var(--offwhite)" : "rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"8px 12px", outline:"none" }} />
            </div>
            <input type="text" placeholder="Título (ex: Envio CEG Stray Kids)" value={novoEvTitulo} onChange={e => setNovoEvTitulo(e.target.value)}
              style={{ flex:1, minWidth:200, background:"#0d0d0d", border:"1px solid #222", borderRadius:6, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"8px 12px", outline:"none" }} />
            <select value={novoEvTipo} onChange={e => setNovoEvTipo(e.target.value)}
              style={{ background:"#0d0d0d", border:"1px solid #222", borderRadius:6, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"8px 12px", outline:"none", cursor:"pointer" }}>
              <option value="envio">Envio Nacional</option>
              <option value="item">Venc. Item</option>
              <option value="frete">Frete</option>
              <option value="taxa">Taxa RF</option>
            </select>
            <button disabled={!novoEvData || !novoEvTitulo.trim() || savingEv} onClick={async () => {
              setSavingEv(true);
              const payload = { data: novoEvData, titulo: novoEvTitulo.trim(), tipo: novoEvTipo, data_fim: novoEvDataFim || null };
              const { data } = await supabase.from("cal_eventos").insert([payload]).select().single();
              if (data) setCalEventos(prev => [...prev, data].sort((a,b) => a.data.localeCompare(b.data)));
              setNovoEvData(""); setNovoEvDataFim(""); setNovoEvTitulo(""); setNovoEvTipo("envio");
              setSavingEv(false);
            }} style={{ background:"var(--laranja)", color:"#111", border:"none", borderRadius:6, fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, padding:"8px 18px", cursor:"pointer", letterSpacing:".08em", opacity: (!novoEvData || !novoEvTitulo.trim()) ? .4 : 1 }}>
              {savingEv ? "..." : "+ Adicionar"}
            </button>
          </div>

          {/* Lista */}
          {calEventos.length === 0 ? (
            <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"20px 0" }}>Nenhuma data manual adicionada ainda.</div>
          ) : calEventos.map(ev => {
            const tipoColor = { envio:"#64B5F6", item:"var(--laranja)", frete:"var(--lilas)", taxa:"var(--verde)" }[ev.tipo] || "#64B5F6";
            return (
              <div key={ev.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:8, border:"1px solid rgba(245,240,232,.07)", marginBottom:6, background:"rgba(245,240,232,.02)" }}>
                <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.45)", minWidth:90, whiteSpace:"nowrap" }}>
                  {new Date(ev.data + "T12:00:00").toLocaleDateString("pt-BR")}
                  {ev.data_fim && <> <span style={{ color:"rgba(245,240,232,.25)" }}>à</span> {new Date(ev.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}</>}
                </span>
                <span style={{ fontSize:9, color:tipoColor, border:`1px solid ${tipoColor}44`, borderRadius:4, padding:"2px 7px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase" }}>{ev.tipo}</span>
                <span style={{ flex:1, fontSize:12, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace" }}>{ev.titulo}</span>
                <button onClick={async () => {
                  await supabase.from("cal_eventos").delete().eq("id", ev.id);
                  setCalEventos(prev => prev.filter(x => x.id !== ev.id));
                }} style={{ background:"none", border:"none", color:"rgba(245,240,232,.25)", cursor:"pointer", fontSize:14, padding:"2px 6px", borderRadius:4 }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {adminMainTab === "envios" && (
        <div>
          {/* Filtros */}
          {(() => {
            const FILTROS = [
              { key:"todos",                  label:"Todas" },
              { key:"solicitação de envio",   label:"Nova" },
              { key:"cotação em andamento",   label:"Cotação" },
              { key:"pagamento em aberto",    label:"Pgto. aberto" },
              { key:"pagamento confirmado",   label:"Pgto. confirmado" },
              { key:"embalando",              label:"Embalando" },
              { key:"enviado",                label:"Enviado" },
              { key:"cancelado",              label:"Cancelado" },
            ];
            return (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
                {FILTROS.map(f => {
                  const count = f.key === "todos" ? envioSolic.length : envioSolic.filter(e => e.status === f.key).length;
                  const active = filtroEnvio === f.key;
                  return (
                    <button key={f.key} onClick={() => setFiltroEnvio(f.key)} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", padding:"5px 12px", borderRadius:20, cursor:"pointer", border: active ? "1px solid var(--laranja)" : "1px solid rgba(245,240,232,.15)", background: active ? "rgba(255,92,26,.12)" : "transparent", color: active ? "var(--laranja)" : "rgba(245,240,232,.45)", fontWeight: active ? 700 : 400 }}>
                      {f.label}{count > 0 ? ` (${count})` : ""}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {(() => {
            const lista = filtroEnvio === "todos" ? envioSolic : envioSolic.filter(e => e.status === filtroEnvio);
            if (lista.length === 0) return <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:12, textAlign:"center", padding:"32px 0" }}>Nenhuma solicitação{filtroEnvio !== "todos" ? " neste status" : ""}.</div>;
            return lista.map(s => {
            const statusColor  = { "solicitação de envio":"#BAFF39", "cotação em andamento":"#FF5C1A", "pagamento em aberto":"#C9A8F0", "pagamento confirmado":"#FFD166", embalando:"#64B5F6", enviado:"rgba(245,240,232,.35)", cancelado:"rgba(245,240,232,.2)" }[s.status] || "rgba(245,240,232,.35)";
            const statusBorder = { "solicitação de envio":"rgba(186,255,57,.25)", "cotação em andamento":"rgba(255,92,26,.3)", "pagamento em aberto":"rgba(201,168,240,.3)", "pagamento confirmado":"rgba(255,209,102,.3)", embalando:"rgba(100,181,246,.3)", enviado:"rgba(245,240,232,.1)", cancelado:"rgba(245,240,232,.08)" }[s.status] || "rgba(245,240,232,.1)";
            const expanded = expandedEnvio.has(s.id);
            const toggleExpand = () => setExpandedEnvio(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; });
            return (
              <div key={s.id} style={{ background:"var(--card-bg)", border:`1px solid ${statusBorder}`, borderRadius:10, marginBottom:8, overflow:"hidden" }}>
                {/* Linha colapsada — sempre visível */}
                <div onClick={toggleExpand} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", cursor:"pointer", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{s.joiner_nome}</div>
                    <div style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace" }}>{s.joiner_cog} · {s.itens?.length || 0} item(s) · {s.metodo}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:9, color:statusColor, border:`1px solid ${statusBorder}`, borderRadius:4, padding:"2px 8px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", whiteSpace:"nowrap" }}>{s.status}</span>
                    <span style={{ fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
                    <span style={{ fontSize:12, color:"rgba(245,240,232,.4)" }}>{expanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Conteúdo expandido */}
                {expanded && <div style={{ padding:"0 16px 16px" }}>
                {/* Cabeçalho */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{s.joiner_nome || s.joiner_cog}</div>
                    {s.joiner_handle && <div style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{s.joiner_handle}</div>}
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:10, color:statusColor, fontFamily:"'DM Mono',monospace", border:`1px solid ${statusBorder}`, borderRadius:4, padding:"2px 8px", textTransform:"uppercase" }}>{s.status}</span>
                    <span style={{ fontSize:10, color:"rgba(245,240,232,.2)", fontFamily:"'DM Mono',monospace" }}>{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>

                {/* Endereço */}
                <div style={{ fontSize:11, color:"rgba(245,240,232,.5)", fontFamily:"'DM Mono',monospace", marginBottom:10, lineHeight:1.8, background:"rgba(245,240,232,.03)", borderRadius:6, padding:"10px 12px" }}>
                  <strong style={{ color:"rgba(245,240,232,.7)" }}>Dest.:</strong> {s.destinatario} · CPF: {s.cpf}<br />
                  {s.endereco}, {s.numero}{s.complemento ? ` (${s.complemento})` : ""} — {s.bairro}, {s.cidade}/{s.estado} · CEP {s.cep}<br />
                  <strong style={{ color:"rgba(245,240,232,.7)" }}>Método:</strong> {s.metodo} · <strong style={{ color:"rgba(245,240,232,.7)" }}>Val. declarado:</strong> {s.seguro === "sim" ? `R$ ${s.valor_seguro}` : "—"}
                </div>

                {/* Itens */}
                {s.itens?.length > 0 && (() => {
                  const totalCaixa = s.itens.reduce((a, it) => a + pf(it.valor) + pf(it.taxa) + pf(it.frete), 0);
                  return (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
                      <div style={{ fontSize:10, letterSpacing:"1px", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase" }}>Itens solicitados</div>
                      {totalCaixa > 0 && <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.4)" }}>Total da caixa: <strong style={{ color:"#F5F0E8" }}>R$ {totalCaixa.toFixed(2).replace(".",",")}</strong></div>}
                    </div>
                    {s.itens.map((it, idx) => (
                      <div key={idx} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace", padding:"5px 0", borderBottom:"1px solid rgba(245,240,232,.05)" }}>
                        <span>{it.nome || it.nome_do_item || "—"} <span style={{ color:"rgba(245,240,232,.3)" }}>({it.ceg})</span></span>
                        {s.status === "enviado" && (
                          <button onClick={() => corrigirItem(s, it)} style={{ fontSize:9, fontFamily:"'DM Mono',monospace", background:"rgba(255,92,26,.08)", color:"var(--laranja)", border:"1px solid rgba(255,92,26,.25)", borderRadius:4, padding:"3px 8px", cursor:"pointer", whiteSpace:"nowrap", marginLeft:8 }}>
                            Corrigir
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  );
                })()}

                {/* Cotação recebida */}
                {s.cotacao_valor && (
                  <div style={{ background:"rgba(201,168,240,.06)", border:"1px solid rgba(201,168,240,.18)", borderRadius:7, padding:"10px 14px", marginBottom:10, fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.7)", lineHeight:1.8 }}>
                    <strong style={{ color:"#C9A8F0" }}>Cotação enviada</strong><br />
                    Valor: <strong style={{ color:"#F5F0E8" }}>R$ {s.cotacao_valor}</strong> · Prazo: <strong style={{ color:"#F5F0E8" }}>{s.cotacao_prazo}</strong>
                    {s.cotacao_obs && <><br />{s.cotacao_obs}</>}
                  </div>
                )}

                {/* Form cotação */}
                {s.status === "cotação em andamento" && cotacaoAberta === s.id && (() => {
                  const valorDecl  = s.seguro === "sim" ? s.valor_seguro : null;
                  const totalItens = (s.itens||[]).reduce((a, it) => a + pf(it.valor) + pf(it.taxa) + pf(it.frete), 0);
                  const emb        = pf(cotacaoEmbalagem);
                  const precos     = cotacaoOpcoes.map(o => pf(o.valor)).filter(v => v > 0);
                  const minPreco   = precos.length > 0 ? Math.min(...precos) : 0;
                  const inp2 = { width:"100%", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.14)", borderRadius:5, padding:"7px 10px", color:"#F5F0E8", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box" };
                  const lbl2 = { fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginBottom:4, display:"block" };
                  const formas = ["PAC","SEDEX","Correios","Jadlog","Mini Envios"];
                  return (
                    <div style={{ background:"rgba(245,240,232,.03)", border:"1px solid rgba(201,168,240,.15)", borderRadius:8, padding:"14px", marginBottom:10, display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", letterSpacing:"1px" }}>MODALIDADES *</div>
                      {cotacaoOpcoes.map((op, idx) => (
                        <div key={idx} style={{ display:"grid", gridTemplateColumns:"130px 1fr 1fr auto", gap:6, alignItems:"center" }}>
                          <select value={op.forma} onChange={e => { const a=[...cotacaoOpcoes]; a[idx]={...a[idx],forma:e.target.value}; setCotacaoOpcoes(a); }} style={{ ...inp2, cursor:"pointer" }}>
                            <option value="">Modalidade...</option>
                            {formas.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                          <input value={op.valor} onChange={e => { const a=[...cotacaoOpcoes]; a[idx]={...a[idx],valor:e.target.value}; setCotacaoOpcoes(a); }} placeholder="Valor R$" style={inp2} />
                          <input value={op.prazo} onChange={e => { const a=[...cotacaoOpcoes]; a[idx]={...a[idx],prazo:e.target.value}; setCotacaoOpcoes(a); }} placeholder="Prazo (ex: 9 dias úteis)" style={inp2} />
                          {cotacaoOpcoes.length > 1
                            ? <button onClick={() => setCotacaoOpcoes(cotacaoOpcoes.filter((_,i) => i !== idx))} style={{ background:"transparent", border:"none", color:"rgba(245,240,232,.25)", cursor:"pointer", fontSize:15, padding:"0 4px" }}>✕</button>
                            : <span style={{ width:22 }} />
                          }
                        </div>
                      ))}
                      {cotacaoOpcoes.length < 4 && (
                        <button onClick={() => setCotacaoOpcoes([...cotacaoOpcoes, { forma:"", valor:"", prazo:"" }])} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.35)", border:"1px dashed rgba(245,240,232,.15)", borderRadius:5, padding:"5px", cursor:"pointer" }}>+ modalidade</button>
                      )}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        <div>
                          <label style={lbl2}>EMBALAGEM (R$)</label>
                          <input value={cotacaoEmbalagem} onChange={e => setCotacaoEmbalagem(e.target.value)} placeholder="0,00" style={inp2} />
                        </div>
                        <div>
                          <label style={lbl2}>VALOR DECLARADO</label>
                          <div style={{ ...inp2, color:"rgba(245,240,232,.4)", background:"rgba(245,240,232,.04)", lineHeight:1.5 }}>
                            {valorDecl ? `R$ ${valorDecl}` : "—"}
                            {totalItens > 0 && <div style={{ fontSize:9, color:"rgba(245,240,232,.25)", marginTop:2 }}>total caixa: R$ {totalItens.toFixed(2).replace(".",",")} (item+taxa+frete)</div>}
                          </div>
                        </div>
                      </div>
                      {minPreco > 0 && (
                        <div style={{ ...inp2, background:"rgba(201,168,240,.08)", border:"1px solid rgba(201,168,240,.25)", color:"#C9A8F0", fontWeight:700, fontSize:13 }}>
                          A partir de R$ {(minPreco + emb).toFixed(2).replace(".",",")}
                        </div>
                      )}
                      <div>
                        <label style={lbl2}>OBSERVAÇÃO (opcional)</label>
                        <input value={cotacaoObs} onChange={e => setCotacaoObs(e.target.value)} placeholder="Informações adicionais..." style={inp2} />
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => enviarCotacao(s)} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(201,168,240,.12)", color:"#C9A8F0", border:"1px solid rgba(201,168,240,.3)", borderRadius:5, padding:"6px 14px", cursor:"pointer", fontWeight:700 }}>Enviar cotação →</button>
                        <button onClick={() => setCotacaoAberta(null)} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.3)", border:"1px solid rgba(245,240,232,.1)", borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>Cancelar</button>
                      </div>
                    </div>
                  );
                })()}

                {/* Ações */}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {s.status === "solicitação de envio" && (
                    <button onClick={async () => {
                      await supabase.from("envio_solicitacoes").update({ status:"cotação em andamento" }).eq("id", s.id);
                      setEnvioSolic(prev => prev.map(x => x.id === s.id ? { ...x, status:"cotação em andamento" } : x));
                    }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(255,92,26,.08)", color:"var(--laranja)", border:"1px solid rgba(255,92,26,.25)", borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>
                      Iniciar cotação
                    </button>
                  )}
                  {s.status === "cotação em andamento" && cotacaoAberta !== s.id && (
                    <button onClick={() => { setCotacaoAberta(s.id); setCotacaoOpcoes([{ forma:"", valor:"", prazo:"" }]); setCotacaoEmbalagem(""); setCotacaoObs(""); }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(201,168,240,.08)", color:"#C9A8F0", border:"1px solid rgba(201,168,240,.25)", borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>
                      Enviar cotação
                    </button>
                  )}
                  {["solicitação de envio","cotação em andamento","pagamento em aberto","pagamento confirmado","embalando"].includes(s.status) && (
                    rastreioAberto === s.id ? (
                      <div style={{ width:"100%", marginTop:4, display:"flex", flexDirection:"column", gap:6 }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                          <div>
                            <div style={{ fontSize:9, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginBottom:3 }}>CÓDIGO DE RASTREIO *</div>
                            <input value={rastreioCodigo} onChange={e => setRastreioCodigo(e.target.value)} placeholder="ex: AA123456789BR" style={{ width:"100%", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.18)", borderRadius:5, padding:"7px 10px", color:"#F5F0E8", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box" }} />
                          </div>
                          <div>
                            <div style={{ fontSize:9, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginBottom:3 }}>LINK DE RASTREIO (opcional)</div>
                            <input value={rastreioLink} onChange={e => setRastreioLink(e.target.value)} placeholder="https://..." style={{ width:"100%", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.18)", borderRadius:5, padding:"7px 10px", color:"#F5F0E8", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box" }} />
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={() => confirmarEnvio(s)} disabled={envioLoading === s.id} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(186,255,57,.1)", color:"#BAFF39", border:"1px solid rgba(186,255,57,.25)", borderRadius:5, padding:"6px 14px", cursor:"pointer", fontWeight:700 }}>
                            {envioLoading === s.id ? "Processando..." : "📦 Confirmar Envio"}
                          </button>
                          <button onClick={() => { setRastreioAberto(null); setRastreioCodigo(""); setRastreioLink(""); }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.3)", border:"1px solid rgba(245,240,232,.1)", borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setRastreioAberto(s.id); setRastreioCodigo(""); setRastreioLink(""); }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(186,255,57,.1)", color:"#BAFF39", border:"1px solid rgba(186,255,57,.25)", borderRadius:5, padding:"6px 14px", cursor:"pointer", fontWeight:700 }}>
                        📦 Confirmar Envio
                      </button>
                    )
                  )}
                  {s.status === "pagamento em aberto" && (
                    <button onClick={async () => {
                      await supabase.from("envio_solicitacoes").update({ status:"pagamento confirmado" }).eq("id", s.id);
                      await supabase.from("pushes").insert([{ message:"Seu pagamento foi confirmado! Em breve seu pedido será enviado.", active:true, joiner_cog:s.joiner_cog }]);
                      setEnvioSolic(prev => prev.map(x => x.id === s.id ? { ...x, status:"pagamento confirmado" } : x));
                    }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(255,209,102,.12)", color:"#FFD166", border:"1px solid rgba(255,209,102,.3)", borderRadius:5, padding:"6px 14px", cursor:"pointer", fontWeight:700 }}>
                      ✓ Pagamento confirmado
                    </button>
                  )}
                  {s.status === "pagamento confirmado" && (
                    <button onClick={async () => {
                      await supabase.from("envio_solicitacoes").update({ status:"embalando" }).eq("id", s.id);
                      await supabase.from("pushes").insert([{ message:"Seu pedido está sendo embalado! Em breve você receberá o código de rastreio.", active:true, joiner_cog:s.joiner_cog }]);
                      setEnvioSolic(prev => prev.map(x => x.id === s.id ? { ...x, status:"embalando" } : x));
                    }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(100,181,246,.1)", color:"#64B5F6", border:"1px solid rgba(100,181,246,.28)", borderRadius:5, padding:"6px 14px", cursor:"pointer", fontWeight:700 }}>
                      📦 Embalando
                    </button>
                  )}
                  {s.status === "pagamento em aberto" && (
                    <button onClick={() => cancelarCotacao(s)} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.3)", border:"1px solid rgba(245,240,232,.12)", borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>
                      Cancelar cotação
                    </button>
                  )}
                  {!["enviado","embalando","pagamento confirmado","cancelado"].includes(s.status) && (
                    <button onClick={() => cancelarSolicitacaoAdmin(s)} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.2)", border:"1px solid rgba(245,240,232,.08)", borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>
                      Cancelar solicitação
                    </button>
                  )}
                </div>
              </div>
              }
            </div>
            );
          });
          })()}
        </div>
      )}

        </div> {/* admin-content */}
      </div> {/* admin-layout */}
    </div>
  );
}

function AdminLinks() {
  const [links, setLinks] = useState([]);
  const [emoji, setEmoji] = useState("🔗");
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("links_uteis").select("*").order("ordem").then(({ data }) => setLinks(data || []));
  }, []);

  async function handleAdd() {
    if (!titulo.trim() || !url.trim()) return;
    setSaving(true);
    const ordem = links.length;
    const { data } = await supabase.from("links_uteis").insert([{ emoji: emoji.trim() || "🔗", titulo: titulo.trim(), url: url.trim(), descricao: descricao.trim() || null, ordem, ativo: true }]).select().single();
    if (data) setLinks(prev => [...prev, data]);
    setEmoji("🔗"); setTitulo(""); setUrl(""); setDescricao("");
    setSaving(false);
  }

  async function handleDelete(id) {
    await supabase.from("links_uteis").delete().eq("id", id);
    setLinks(prev => prev.filter(l => l.id !== id));
  }

  async function toggleAtivo(l) {
    await supabase.from("links_uteis").update({ ativo: !l.ativo }).eq("id", l.id);
    setLinks(prev => prev.map(x => x.id === l.id ? { ...x, ativo: !l.ativo } : x));
  }

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--offwhite)", marginBottom: 14 }}>Links da Comunidade</div>
      <div className="admin-links-row1" style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🔗" style={{ width: 48, flexShrink: 0, background: "#0d0d0d", border: "1px solid rgba(245,240,232,.12)", borderRadius: 8, padding: "9px 10px", color: "var(--offwhite)", fontFamily: "'DM Mono',monospace", fontSize: 16, textAlign: "center", outline: "none" }} />
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título do link" style={{ flex: 2, minWidth: 120, background: "#0d0d0d", border: "1px solid rgba(245,240,232,.12)", borderRadius: 8, padding: "9px 14px", color: "var(--offwhite)", fontFamily: "'DM Mono',monospace", fontSize: 12, outline: "none" }} />
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={{ flex: 3, minWidth: 140, background: "#0d0d0d", border: "1px solid rgba(245,240,232,.12)", borderRadius: 8, padding: "9px 14px", color: "var(--offwhite)", fontFamily: "'DM Mono',monospace", fontSize: 12, outline: "none" }} />
      </div>
      <div className="admin-links-row2" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição (opcional)" style={{ flex: 1, minWidth: 120, background: "#0d0d0d", border: "1px solid rgba(245,240,232,.12)", borderRadius: 8, padding: "9px 14px", color: "var(--offwhite)", fontFamily: "'DM Mono',monospace", fontSize: 12, outline: "none" }} />
        <button onClick={handleAdd} disabled={saving || !titulo.trim() || !url.trim()} style={{ background: "var(--laranja)", color: "#000", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 700, cursor: "pointer", opacity: titulo.trim() && url.trim() ? 1 : 0.4 }}>+ Adicionar</button>
      </div>
      {links.length === 0 && <div style={{ fontSize: 12, color: "rgba(245,240,232,.3)" }}>Nenhum link cadastrado ainda.</div>}
      {links.map(l => (
        <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--card-bg)", border: "1px solid rgba(245,240,232,.07)", borderRadius: 10, marginBottom: 6, opacity: l.ativo ? 1 : 0.45 }}>
          <span style={{ fontSize: 18 }}>{l.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--offwhite)" }}>{l.titulo}</div>
            <div style={{ fontSize: 10, color: "rgba(245,240,232,.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url}</div>
          </div>
          <button onClick={() => toggleAtivo(l)} style={{ background: "none", border: `1px solid ${l.ativo ? "rgba(74,222,128,.3)" : "rgba(245,240,232,.12)"}`, color: l.ativo ? "#4ade80" : "rgba(245,240,232,.3)", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>{l.ativo ? "ON" : "OFF"}</button>
          <button onClick={() => handleDelete(l.id)} style={{ background: "none", border: "1px solid rgba(255,90,31,.2)", color: "rgba(255,90,31,.6)", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function AdminCadastros({ confirmacoes, onUpdate }) {
  if (confirmacoes.length === 0) return (
    <div style={{ fontSize:12, color:"rgba(245,240,232,.52)", padding:"20px 0" }}>Nenhuma atualização de cadastro pendente.</div>
  );
  return (
    <div>
      <div style={{ fontSize:11, color:"rgba(245,240,232,.52)", marginBottom:16, lineHeight:1.6 }}>
        Joiners que alteraram @ ou e-mail. Atualize na planilha e marque como visto.
      </div>
      {confirmacoes.map(c => (
        <div key={c.id} style={{ padding:"14px 16px", background:"var(--card-bg)", border:"1px solid rgba(255,90,31,.2)", borderRadius:10, marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--offwhite)", marginBottom:6 }}>
                {c.joiner_nome} <span style={{ fontSize:10, color:"rgba(245,240,232,.52)", fontWeight:400 }}>@{c.joiner_cog}</span>
              </div>
              {c.twitter_novo && <div style={{ fontSize:12, color:"rgba(245,240,232,.6)" }}>@ novo: <span style={{ color:"var(--laranja)", fontWeight:600 }}>{c.twitter_novo}</span></div>}
              {c.email_novo   && <div style={{ fontSize:12, color:"rgba(245,240,232,.6)", marginTop:3 }}>e-mail: <span style={{ color:"var(--laranja)", fontWeight:600 }}>{c.email_novo}</span></div>}
              <div style={{ fontSize:10, color:"rgba(245,240,232,.42)", marginTop:6 }}>{new Date(c.created_at).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}</div>
            </div>
            <button onClick={async () => {
              await supabase.from("confirmacoes").update({ visto: true }).eq("id", c.id);
              onUpdate(prev => prev.filter(x => x.id !== c.id));
            }} style={{ background:"none", border:"1px solid rgba(245,240,232,.1)", color:"rgba(245,240,232,.58)", borderRadius:6, padding:"6px 12px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer", whiteSpace:"nowrap" }}>
              marcar visto
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminPagamentos({ data, joiners }) {
  const [open, setOpen] = useState(null);
  const [subtab, setSubtab] = useState("atrasados");

  const cogValidos = new Set((joiners || []).map(j => j.cog));

  const byJoiner = {};
  data.filter(item => cogValidos.has(item.cog)).forEach(item => {
    const cog = item.cog || "—";
    if (!byJoiner[cog]) byJoiner[cog] = { nome: item.nome || cog, cog, itens: [] };
    const pend = (isPendente(item.pago_item)  ? Number(item.valor_item||0)  : 0)
               + (isPendente(item.pago_frete) ? Number(item.frete_inter||0) : 0)
               + (isPendente(item.pago_rf)    ? Number(item.taxa_rf||0)     : 0);
    const multa = (isPendente(item.pago_item)  ? diasAtraso(item.venc_item)  : 0)
                + (isPendente(item.pago_frete) ? diasAtraso(item.venc_frete) : 0)
                + (isPendente(item.pago_rf)    ? diasAtraso(item.venc_rf)    : 0);
    if (pend > 0) byJoiner[cog].itens.push({ ...item, pend, multa });
  });
  const todos = Object.values(byJoiner).filter(j => j.itens.length > 0)
    .sort((a, b) => b.itens.reduce((s,i)=>s+i.pend,0) - a.itens.reduce((s,i)=>s+i.pend,0));

  const atrasados  = todos.filter(j => j.itens.some(i => i.multa > 0));
  const emAberto   = todos.filter(j => j.itens.every(i => i.multa === 0));
  const lista = subtab === "atrasados" ? atrasados : emAberto;

  const btnStyle = active => ({
    background: active ? "var(--laranja)" : "transparent",
    color: active ? "#111" : "rgba(245,240,232,.45)",
    border: `1px solid ${active ? "var(--laranja)" : "rgba(245,240,232,.15)"}`,
    borderRadius: 6, padding: "5px 14px", fontSize: 11,
    fontFamily: "'DM Mono',monospace", fontWeight: active ? 700 : 400,
    cursor: "pointer", letterSpacing: ".05em"
  });

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        <button style={btnStyle(subtab === "atrasados")} onClick={() => setSubtab("atrasados")}>Atrasados ({atrasados.length})</button>
        <button style={btnStyle(subtab === "emaberto")}  onClick={() => setSubtab("emaberto")}>Em aberto ({emAberto.length})</button>
      </div>
      {lista.length === 0 && <div style={{ fontSize:12, color:"rgba(245,240,232,.52)" }}>Nenhum aqui.</div>}
      {lista.map(j => {
        const total = j.itens.reduce((s,i) => s+i.pend, 0);
        const totalMulta = j.itens.reduce((s,i) => s+i.multa, 0);
        const isOpen = open === j.cog;
        return (
          <div key={j.cog} style={{ background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.08)", borderRadius:10, marginBottom:6, overflow:"hidden" }}>
            <div onClick={() => setOpen(isOpen ? null : j.cog)} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", cursor:"pointer" }}>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:13, fontWeight:600, color:"var(--offwhite)" }}>{j.nome}</span>
                <span className="cog-tip" data-nome={j.nome} style={{ fontSize:10, color:"rgba(245,240,232,.52)", marginLeft:8 }}>@{j.cog}</span>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--laranja)" }}>R${fmtBRL(total)}</div>
                {totalMulta > 0 && <div style={{ fontSize:10, color:"#ff6b6b", fontWeight:600 }}>+R${fmtBRL(totalMulta)} multa</div>}
              </div>
              <span style={{ fontSize:10, color:"rgba(245,240,232,.52)", marginLeft:4 }}>{j.itens.length}i</span>
              <span style={{ fontSize:12, color:"rgba(245,240,232,.52)", transition:"transform .2s", display:"inline-block", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
            </div>
            {isOpen && (
              <div style={{ borderTop:"1px solid rgba(245,240,232,.05)", padding:"8px 16px 12px" }}>
                {j.itens.map((item, idx) => (
                  <div key={idx} style={{ display:"flex", gap:8, alignItems:"center", fontSize:11, color:"rgba(245,240,232,.5)", padding:"4px 0", borderBottom: idx < j.itens.length-1 ? "1px solid rgba(245,240,232,.04)" : "none" }}>
                    <span style={{ flex:1 }}><InfoContent info={item.nome_do_item} /></span>
                    <span style={{ fontSize:10, color:"rgba(245,240,232,.48)" }}>{item.ceg}</span>
                    <span style={{ color:"var(--laranja)", fontWeight:600 }}>R${fmtBRL(item.pend)}</span>
                    {item.multa > 0 && <span style={{ fontSize:10, color:"#ff6b6b", fontWeight:700 }}>+R${fmtBRL(item.multa)}</span>}
                  </div>
                ))}
                {(() => {
                  const joinerInfo = (joiners || []).find(jn => jn.cog === j.cog);
                  if (!joinerInfo?.email) return null;
                  const itemRowsInd = j.itens.map(it => `<tr><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#F5F0E8">${it.nome_do_item}${it.ceg ? `<div style="font-size:10px;color:rgba(245,240,232,0.3);margin-top:2px">${it.ceg}</div>` : ""}</td><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;text-align:right;white-space:nowrap;font-size:12px;color:#FF5C1A">R$&nbsp;${fmtBRL(it.pend)}</td></tr>`).join("");
                  const corpo = buildEmailHTML(j.nome, `<tr><td style="background:#111111;padding:20px 40px 8px"><p style="margin:0 0 18px;font-size:13px;color:rgba(245,240,232,0.65);line-height:1.6">Constam em seu portal os seguintes itens com pagamento em aberto:</p><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #1e1e1e">${itemRowsInd}<tr><td colspan="2" style="padding:16px 0 8px;text-align:right"><div style="font-size:10px;color:rgba(245,240,232,0.3);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Total em aberto</div><div style="font-size:26px;font-weight:900;color:#BAFF39">R$&nbsp;${fmtBRL(total + totalMulta)}</div>${totalMulta > 0 ? `<div style="font-size:10px;color:rgba(255,92,26,0.7);margin-top:4px">R$&nbsp;${fmtBRL(total)} item + R$&nbsp;${fmtBRL(totalMulta)} multa</div>` : ""}</td></tr></table></td></tr>`);
                  return (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
                      <button onClick={e => { e.stopPropagation(); sendEmailJoiner(joinerInfo.email, j.nome, "Lembrete de pagamento pendente", corpo); }} style={{
                        background:"none", border:"1px solid rgba(245,240,232,.12)",
                        color:"rgba(245,240,232,.62)", borderRadius:6, padding:"5px 12px",
                        fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".05em"
                      }}>✉ Notificar por e-mail</button>
                      <EmailTypeBadge type="pagamento" />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AdminDisponivel({ data }) {
  const [itens, setItens] = useState(data);

  async function marcarVendido(id) {
    await supabase.from("masterlist").update({ status: "Vendido" }).eq("id", id);
    setItens(prev => prev.map(i => i.id === id ? { ...i, status: "Vendido" } : i));
  }
  async function marcarDisponivel(id) {
    await supabase.from("masterlist").update({ status: "Disponível" }).eq("id", id);
    setItens(prev => prev.map(i => i.id === id ? { ...i, status: "Disponível" } : i));
  }

  return (
    <div>
      <div style={{ fontSize:12, color:"rgba(245,240,232,.58)", marginBottom:16 }}>
        {itens.length} item{itens.length !== 1 ? "s" : ""} disponível{itens.length !== 1 ? "is" : ""} para venda
      </div>
      {itens.length === 0 && <div style={{ fontSize:12, color:"rgba(245,240,232,.52)" }}>Nenhum item disponível.</div>}
      {itens.map(item => (
        <div key={item.id} style={{
          background:"var(--card-bg)",
          border:`1px solid ${item.status === "Disponível" ? "rgba(255,180,0,.2)" : "rgba(245,240,232,.07)"}`,
          borderRadius:10, padding:"14px 16px", marginBottom:8,
          display:"flex", alignItems:"center", gap:12
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, color:"var(--lilas)" }}>{item.ceg}</span>
              <StatusChip status={item.status} />
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:"var(--offwhite)", marginTop:4 }}><InfoContent info={item.nome_do_item} /></div>
            {Number(item.valor_item) > 0 && (
              <div style={{ fontSize:12, color:"var(--laranja)", marginTop:3, fontWeight:600 }}>R${fmtBRL(item.valor_item)}</div>
            )}
            {item.info_adicionais && (
              <div style={{ fontSize:11, color:"rgba(245,240,232,.62)", marginTop:4 }}>{item.info_adicionais}</div>
            )}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
            {item.status === "Disponível" ? (
              <button onClick={() => marcarVendido(item.id)} style={{
                background:"rgba(186,255,57,.1)", border:"1px solid rgba(186,255,57,.3)",
                color:"var(--verde)", borderRadius:6, padding:"5px 12px",
                fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer", whiteSpace:"nowrap"
              }}>Marcar vendido ✓</button>
            ) : (
              <button onClick={() => marcarDisponivel(item.id)} style={{
                background:"rgba(255,180,0,.08)", border:"1px solid rgba(255,180,0,.25)",
                color:"#ffb400", borderRadius:6, padding:"5px 12px",
                fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer", whiteSpace:"nowrap"
              }}>Reabrir →</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminBlocklist({ data, joiners, onUpdate }) {
  const pendByJoiner = {};
  data.filter(item => (item.nome || "").toLowerCase() !== "disponivel" && item.cog !== "disponivel").forEach(item => {
    const cog = item.cog || "—";
    if (!pendByJoiner[cog]) pendByJoiner[cog] = 0;
    if (item.pago_item === false && Number(item.valor_item||0) > 0) pendByJoiner[cog]++;
    if (item.pago_frete === false && Number(item.frete_inter||0) > 0) pendByJoiner[cog]++;
    if (item.pago_rf === false && Number(item.taxa_rf||0) > 0) pendByJoiner[cog]++;
  });

  async function toggleBloqueado(cog, atual) {
    await supabase.from("joiners").update({ bloqueado: !atual }).eq("cog", cog);
    onUpdate(prev => prev.map(j => j.cog === cog ? { ...j, bloqueado: !atual } : j));
  }

  const lista = joiners.map(j => ({ ...j, pendentes: pendByJoiner[j.cog] || 0 }))
    .filter(j => j.bloqueado || j.pendentes >= 3)
    .sort((a, b) => (b.bloqueado ? 1 : 0) - (a.bloqueado ? 1 : 0) || b.pendentes - a.pendentes);

  return (
    <div>
      <div style={{ fontSize:11, color:"rgba(245,240,232,.52)", marginBottom:16, lineHeight:1.6 }}>
        Joiners bloqueados ou com 3+ pagamentos pendentes aparecem aqui automaticamente.
      </div>
      {lista.length === 0 && <div style={{ fontSize:12, color:"rgba(245,240,232,.52)" }}>Nenhum joiner na blocklist.</div>}
      {lista.map(j => (
        <div key={j.cog} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"var(--card-bg)", border:`1px solid ${j.bloqueado ? "rgba(255,90,31,.3)" : "rgba(245,240,232,.08)"}`, borderRadius:10, marginBottom:8 }}>
          <div style={{ flex:1 }}>
            <span style={{ fontSize:13, fontWeight:600, color: j.bloqueado ? "var(--laranja)" : "var(--offwhite)" }}>{j.nome || j.cog}</span>
            <span className="cog-tip" data-nome={j.nome||j.cog} style={{ fontSize:10, color:"rgba(245,240,232,.52)", marginLeft:8 }}>@{j.cog}</span>
            {j.pendentes > 0 && <span style={{ fontSize:10, color:"rgba(245,240,232,.52)", marginLeft:8 }}>{j.pendentes} pgto{j.pendentes>1?"s":""} pendente{j.pendentes>1?"s":""}</span>}
          </div>
          <button onClick={() => toggleBloqueado(j.cog, j.bloqueado)} style={{
            background: j.bloqueado ? "rgba(255,90,31,.12)" : "rgba(245,240,232,.05)",
            border: `1px solid ${j.bloqueado ? "rgba(255,90,31,.35)" : "rgba(245,240,232,.12)"}`,
            color: j.bloqueado ? "var(--laranja)" : "rgba(245,240,232,.35)",
            borderRadius:6, padding:"5px 14px", fontSize:11,
            fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer"
          }}>
            {j.bloqueado ? "BLOQUEADO" : "BLOQUEAR"}
          </button>
        </div>
      ))}
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
  const [email, setEmail] = useState(user.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!nome.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true);
    const twitterNovo = social.trim() || null;
    const emailNovo   = email.trim().toLowerCase() || null;
    const twitterMudou = twitterNovo !== (user.twitter || null);
    const emailMudou   = emailNovo   !== (user.email || null);
    await supabase.from("joiners").update({
      nome: nome.trim(), whatsapp: whatsapp.trim() || null,
      twitter: twitterNovo, email: emailNovo, confirmado: true,
    }).eq("cog", user.cog);
    if (twitterMudou || emailMudou) {
      await supabase.from("confirmacoes").insert([{
        joiner_cog:   user.cog,
        joiner_nome:  nome.trim() || user.cog,
        twitter_novo: twitterNovo,
        email_novo:   emailNovo,
      }]);
    }
    const updated = { ...user, nome: nome.trim(), whatsapp: whatsapp.trim() || null, twitter: twitterNovo, email: emailNovo, confirmado: true };
    localStorage.setItem("anticeg_user", JSON.stringify(updated));
    onSave(updated);
    setSaving(false);
  }

  function handleSkip() { onSkip(); }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:800, background:"rgba(0,0,0,.88)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#111", border:"1px solid rgba(245,240,232,.1)", borderRadius:14, width:"100%", maxWidth:440, padding:30, display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, lineHeight:1.1, color:"var(--offwhite)", marginBottom:8 }}>
            CONFIRME SEUS DADOS E EVITE ERROS<br/><span style={{ color:"var(--laranja)" }}>NA SUA MASTERLIST</span>
          </div>
          <div style={{ fontSize:12, color:"rgba(245,240,232,.62)", lineHeight:1.6 }}>
            Caso algo esteja errado, corrija abaixo. Clique em <strong style={{ color:"rgba(245,240,232,.7)" }}>Tudo certo</strong> para não receber essa mensagem novamente.
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <label style={{ fontSize:10, color:"rgba(245,240,232,.62)", letterSpacing:1.5, textTransform:"uppercase" }}>Nome</label>
          <input className="login-input" type="text" placeholder="Como você aparece no grupo" value={nome} onChange={e => { setNome(e.target.value); setError(""); }} autoFocus />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <label style={{ fontSize:10, color:"rgba(245,240,232,.62)", letterSpacing:1.5, textTransform:"uppercase" }}>@ para acesso <span style={{ opacity:.5, fontSize:9 }}>(twitter / x / threads / insta)</span></label>
          <input className="login-input" type="text" placeholder="@seu_@" value={social} onChange={e => setSocial(e.target.value)} />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <label style={{ fontSize:10, color:"rgba(245,240,232,.62)", letterSpacing:1.5, textTransform:"uppercase" }}>WhatsApp</label>
          <input className="login-input" type="tel" placeholder="(00) 00000-0000" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <label style={{ fontSize:10, color:"rgba(245,240,232,.62)", letterSpacing:1.5, textTransform:"uppercase" }}>E-mail</label>
          <input className="login-input" type="email" placeholder="seuemail@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} />
        </div>
        {error && <div className="login-error">{error}</div>}
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          <button className="modal-confirm-btn" onClick={handleSave} disabled={saving} style={{ flex:1 }}>{saving ? "Salvando..." : "TUDO CERTO ✓"}</button>
          <button className="modal-cancel-btn" onClick={handleSkip}>Agora não</button>
        </div>
      </div>
    </div>
  );
}

function EnvioTab({ user, itens }) {
  const WA_GOM = "5524992501917";
  const antigomItens = itens.filter(i => ["ANTIGOM", "Envio Liberado"].includes(i.status));

  const [unlocked,    setUnlocked]    = useState(false);
  const [senha,       setSenha]       = useState("");
  const [senhaErr,    setSenhaErr]    = useState(false);
  const [nome,        setNome]        = useState(user.nome    || "");
  const [handle,      setHandle]      = useState(user.twitter || "");
  const [whatsapp,    setWhatsapp]    = useState(user.whatsapp || "");
  const [destinatario,setDestinatario]= useState("");
  const [cpf,         setCpf]         = useState("");
  const [cep,         setCep]         = useState("");
  const [endereco,    setEndereco]    = useState("");
  const [numero,      setNumero]      = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro,      setBairro]      = useState("");
  const [cidade,      setCidade]      = useState("");
  const [estado,      setEstado]      = useState("");
  const [cepLoading,  setCepLoading]  = useState(false);
  const [selecionados,setSelecionados]= useState(() => antigomItens.map(i => i.id));
  const [metodo,      setMetodo]      = useState("");
  const [seguro,      setSeguro]      = useState("");
  const [valorSeguro, setValorSeguro] = useState("");
  const [confirmou,   setConfirmou]   = useState(false);
  const [ciente1,     setCiente1]     = useState(false);
  const [ciente2,     setCiente2]     = useState(false);
  const [erro,        setErro]        = useState("");
  const [loading,     setLoading]     = useState(false);
  const [enviado,     setEnviado]     = useState(false);

  if (!unlocked) return (
    <div style={{ maxWidth:360, margin:"80px auto", padding:"0 16px", textAlign:"center" }}>
      <div style={{ fontSize:32, marginBottom:16 }}>🚧</div>
      <div style={{ fontSize:14, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>Em construção</div>
      <div style={{ fontSize:11, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginBottom:28, lineHeight:1.6 }}>
        Esta funcionalidade ainda está sendo preparada.<br />Em breve disponível para todas.
      </div>
      <input
        type="password"
        placeholder="senha de acesso"
        value={senha}
        onChange={e => { setSenha(e.target.value); setSenhaErr(false); }}
        onKeyDown={e => { if (e.key === "Enter") { if (senha === "2MINAFOREVER") setUnlocked(true); else setSenhaErr(true); } }}
        style={{ width:"100%", background:"#0d0d0d", border:`1px solid ${senhaErr ? "var(--laranja)" : "rgba(245,240,232,.14)"}`, borderRadius:6, padding:"9px 12px", color:"#F5F0E8", fontSize:12, fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box", textAlign:"center", marginBottom:8 }}
      />
      {senhaErr && <div style={{ fontSize:10, color:"var(--laranja)", fontFamily:"'DM Mono',monospace", marginBottom:8 }}>senha incorreta</div>}
      <button onClick={() => { if (senha === "2MINAFOREVER") setUnlocked(true); else setSenhaErr(true); }}
        style={{ width:"100%", padding:"10px 0", background:"var(--laranja)", color:"#111", border:"none", borderRadius:6, fontSize:12, fontWeight:700, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
        ACESSAR →
      </button>
    </div>
  );

  async function buscarCep(val) {
    const clean = val.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setEndereco(data.logradouro || "");
        setBairro(data.bairro      || "");
        setCidade(data.localidade  || "");
        setEstado(data.uf          || "");
      }
    } catch {}
    setCepLoading(false);
  }

  function toggleItem(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSubmit() {
    setErro("");
    const missing = [];
    if (!destinatario) missing.push("nome do destinatário");
    if (!cpf)          missing.push("CPF");
    if (!cep)          missing.push("CEP");
    if (!endereco)     missing.push("endereço");
    if (!numero)       missing.push("número");
    if (!bairro)       missing.push("bairro");
    if (!cidade)       missing.push("cidade");
    if (!estado)       missing.push("estado");
    if (selecionados.length === 0) missing.push("itens selecionados");
    if (!metodo)       missing.push("método de envio");
    if (!seguro)       missing.push("seguro");
    if (!confirmou || !ciente1 || !ciente2) missing.push("todas as confirmações");
    if (missing.length > 0) { setErro(`Preencha: ${missing.join(", ")}.`); return; }

    setLoading(true);
    const itensSel = antigomItens.filter(i => selecionados.includes(i.id))
      .map(i => ({ id: i.id, ceg: i.ceg, nome: i.nome_do_item, valor: Number(i.valor_item||0), taxa: Number(i.taxa_rf||0), frete: Number(i.frete_inter||0) }));

    const { error } = await supabase.from("envio_solicitacoes").insert([{
      joiner_cog:      user.cog,
      joiner_nome:     nome,
      joiner_handle:   handle,
      destinatario,
      cpf,
      cep,
      endereco,
      numero,
      complemento:     complemento || null,
      bairro,
      cidade,
      estado,
      itens:           itensSel,
      metodo,
      seguro,
      valor_seguro:    seguro === "sim" ? valorSeguro : null,
      status:          "solicitação de envio",
    }]);

    setLoading(false);
    if (error) { setErro("Erro ao enviar. Tente novamente."); return; }
    setEnviado(true);
  }

  const inp = {
    width:"100%", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.14)",
    borderRadius:6, padding:"9px 12px", color:"#F5F0E8", fontSize:12,
    fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box",
  };
  const lbl = {
    display:"block", fontSize:10, letterSpacing:"0.8px", color:"rgba(245,240,232,.38)",
    textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:5,
  };
  const sec = {
    background:"#111", border:"1px solid rgba(245,240,232,.07)",
    borderRadius:10, padding:"20px 20px 16px", marginBottom:12,
  };
  const row2 = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 };
  const fld  = { marginBottom:12 };
  const stat = { fontSize:12, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", padding:"9px 0", borderBottom:"1px solid rgba(245,240,232,.06)" };

  if (enviado) return (
    <div style={{ maxWidth:480, margin:"60px auto", padding:"0 16px", textAlign:"center" }}>
      <div style={{ fontSize:36, marginBottom:16 }}>📦</div>
      <div style={{ fontSize:16, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", marginBottom:14 }}>Solicitação enviada!</div>
      <div style={{ fontSize:12, color:"rgba(245,240,232,.55)", fontFamily:"'DM Mono',monospace", lineHeight:1.9, background:"#111", border:"1px solid rgba(245,240,232,.07)", borderRadius:10, padding:"20px 24px", textAlign:"left" }}>
        Sua solicitação foi recebida com sucesso.<br /><br />
        O prazo de cotação é de <strong style={{ color:"#F5F0E8" }}>5 dias úteis</strong> a partir do preenchimento deste formulário.<br /><br />
        A cotação estará disponível dentro do seu acesso com os valores e taxas.
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:560, margin:"0 auto", padding:"24px 16px 100px" }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, letterSpacing:"2px", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:4 }}>// solicitação</div>
        <div style={{ fontSize:20, fontWeight:700, color:"#F5F0E8" }}>Envio Nacional</div>
        <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", marginTop:4 }}>Preencha os dados abaixo para solicitar o envio dos seus itens.</div>
      </div>

      {/* SEUS DADOS — somente leitura */}
      <div style={sec}>
        <div style={{ fontSize:10, letterSpacing:"1.5px", color:"var(--laranja)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:14 }}>Seus dados</div>
        <div style={fld}><label style={lbl}>Nome</label><div style={stat}>{nome || "—"}</div></div>
        <div style={row2}>
          <div style={fld}><label style={lbl}>@</label><div style={stat}>{handle || "—"}</div></div>
          <div style={fld}><label style={lbl}>WhatsApp</label><div style={stat}>{whatsapp || "—"}</div></div>
        </div>
        <div style={{ fontSize:10, color:"rgba(245,240,232,.2)", fontFamily:"'DM Mono',monospace" }}>Dados incorretos? Atualize em Meu Perfil.</div>
      </div>

      {/* DESTINATÁRIO */}
      <div style={sec}>
        <div style={{ fontSize:10, letterSpacing:"1.5px", color:"var(--laranja)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:14 }}>Destinatário</div>
        <div style={fld}><label style={lbl}>Nome completo do destinatário</label><input style={inp} value={destinatario} onChange={e => setDestinatario(e.target.value)} /></div>
        <div style={fld}><label style={lbl}>CPF do destinatário</label><input style={inp} value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" /></div>
      </div>

      {/* ENDEREÇO */}
      <div style={sec}>
        <div style={{ fontSize:10, letterSpacing:"1.5px", color:"var(--laranja)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:14 }}>Endereço</div>
        <div style={fld}>
          <label style={lbl}>CEP {cepLoading && <span style={{ color:"rgba(245,240,232,.3)" }}>buscando...</span>}</label>
          <input style={inp} value={cep} onChange={e => { setCep(e.target.value); buscarCep(e.target.value); }} placeholder="00000-000" />
        </div>
        <div style={fld}><label style={lbl}>Endereço</label><input style={inp} value={endereco} onChange={e => setEndereco(e.target.value)} /></div>
        <div style={row2}>
          <div style={fld}><label style={lbl}>Número</label><input style={inp} value={numero} onChange={e => setNumero(e.target.value)} /></div>
          <div style={fld}><label style={lbl}>Complemento (se houver)</label><input style={inp} value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Apto, bloco..." /></div>
        </div>
        <div style={row2}>
          <div style={fld}><label style={lbl}>Bairro</label><input style={inp} value={bairro} onChange={e => setBairro(e.target.value)} /></div>
          <div style={fld}><label style={lbl}>Cidade</label><input style={inp} value={cidade} onChange={e => setCidade(e.target.value)} /></div>
        </div>
        <div style={{ ...fld, maxWidth:140 }}><label style={lbl}>Estado</label>
          <select style={{ ...inp, cursor:"pointer" }} value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">—</option>
            {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>

      {/* ITENS */}
      <div style={sec}>
        <div style={{ fontSize:10, letterSpacing:"1.5px", color:"var(--laranja)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:14 }}>Itens disponíveis para envio</div>
        {antigomItens.length === 0 ? (
          <div style={{ fontSize:12, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", textAlign:"center", padding:"20px 0" }}>
            Nenhum item com status ANTIGOM no momento.
          </div>
        ) : (
          antigomItens.map(item => {
            const sel = selecionados.includes(item.id);
            return (
              <div key={item.id} onClick={() => toggleItem(item.id)} style={{
                display:"flex", alignItems:"center", gap:12, padding:"10px 12px",
                background: sel ? "rgba(186,255,57,.06)" : "rgba(245,240,232,.02)",
                border: `1px solid ${sel ? "rgba(186,255,57,.2)" : "rgba(245,240,232,.07)"}`,
                borderRadius:7, marginBottom:6, cursor:"pointer",
              }}>
                <div style={{
                  width:18, height:18, borderRadius:4, flexShrink:0,
                  background: sel ? "#BAFF39" : "transparent",
                  border: `2px solid ${sel ? "#BAFF39" : "rgba(245,240,232,.2)"}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  {sel && <span style={{ fontSize:11, color:"#111", fontWeight:900 }}>✓</span>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {item.nome_do_item || "—"}
                  </div>
                  <div style={{ fontSize:10, color:"rgba(245,240,232,.35)", marginTop:2 }}>{item.ceg}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ENVIO */}
      <div style={sec}>
        <div style={{ fontSize:10, letterSpacing:"1.5px", color:"var(--laranja)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:14 }}>Método de envio</div>
        <div style={fld}>
          <label style={lbl}>Método de envio</label>
          <select style={{ ...inp, cursor:"pointer" }} value={metodo} onChange={e => setMetodo(e.target.value)}>
            <option value="">Selecione...</option>
            <option value="Correios">Correios</option>
            <option value="Jadlog">Jadlog</option>
            <option value="Mini Envios">Mini Envios (somente photocards)</option>
            <option value="Mais econômico">Método mais econômico (a critério da GOM)</option>
          </select>
        </div>
        <div style={fld}>
          <label style={lbl}>Declaração de conteúdo</label>
          <div style={{ display:"flex", gap:8 }}>
            {["sim","nao"].map(v => (
              <button key={v} onClick={() => setSeguro(v)} style={{
                flex:1, padding:"8px 0", borderRadius:6, fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer",
                background: seguro === v ? "var(--laranja)" : "transparent",
                color:      seguro === v ? "#111" : "rgba(245,240,232,.6)",
                border:    `1px solid ${seguro === v ? "var(--laranja)" : "rgba(245,240,232,.18)"}`,
              }}>{v === "sim" ? "Sim" : "Não"}</button>
            ))}
          </div>
        </div>
        {seguro === "sim" && (
          <div style={fld}><label style={lbl}>Valor declarado da caixa (R$)</label><input style={inp} type="number" value={valorSeguro} onChange={e => setValorSeguro(e.target.value)} placeholder="0,00" /></div>
        )}
      </div>

      {/* CONFIRMAÇÕES */}
      <div style={sec}>
        <div style={{ fontSize:10, letterSpacing:"1.5px", color:"var(--laranja)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:14 }}>Confirmações</div>
        {[
          { val:confirmou, set:setConfirmou, text:"Confirmo que revisei todas as informações acima." },
          { val:ciente1,   set:setCiente1,   text:"Estou ciente de que a GOM não se responsabiliza por dados incorretos informados neste formulário." },
          { val:ciente2,   set:setCiente2,   text:"Estou ciente que serão enviados todos os itens listados e/ou disponíveis na casa da GOM." },
        ].map(({ val, set, text }, idx) => (
          <div key={idx} onClick={() => set(v => !v)} style={{
            display:"flex", alignItems:"flex-start", gap:10, marginBottom:12, cursor:"pointer",
          }}>
            <div style={{
              width:18, height:18, borderRadius:4, flexShrink:0, marginTop:1,
              background: val ? "var(--laranja)" : "transparent",
              border: `2px solid ${val ? "var(--laranja)" : "rgba(245,240,232,.2)"}`,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              {val && <span style={{ fontSize:11, color:"#111", fontWeight:900 }}>✓</span>}
            </div>
            <div style={{ fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace", lineHeight:1.6 }}>{text}</div>
          </div>
        ))}
      </div>

      {erro && <div style={{ fontSize:11, color:"#FF5C1A", fontFamily:"'DM Mono',monospace", marginBottom:12, lineHeight:1.5 }}>{erro}</div>}

      <button onClick={handleSubmit} disabled={loading} style={{
        width:"100%", padding:"14px 0", background:"var(--laranja)", color:"#111",
        border:"none", borderRadius:8, fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace",
        cursor: loading ? "not-allowed" : "pointer", letterSpacing:"1px", opacity: loading ? 0.7 : 1,
      }}>
        {loading ? "ENVIANDO..." : "SOLICITAR ENVIO →"}
      </button>
    </div>
  );
}

function BottomNav({ tab, setTab, isGuest, isAdmin }) {
  const items = [
    { id:"masterlist", icon:"☰", label:"Lista" },
    { id:"cegs",       icon:"◈", label:"CEGs" },
    { id:"calendario", icon:"◫", label:"Datas" },
    ...(!isGuest ? [{ id:"perfil", icon:"○", label:"Perfil" }] : []),
    ...(!isGuest ? [{ id:"envio",  icon:"📦", label:"Envio" }] : []),
    { id:"regras",     icon:"☆", label:"Links" },
    ...(isAdmin ? [{ id:"admin", icon:"⚙", label:"Admin" }] : []),
  ];
  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button key={item.id} className={`bottom-nav-btn ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
          <span className="bottom-nav-icon">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
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
        <button className="login-skip" style={{ marginTop: 12 }} onClick={fechar}>Não mostrar novamente</button>
      </div>
    </div>
  );
}

function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [contraste, setContraste] = useState(() => localStorage.getItem("a11y_contraste") === "1");
  const [fonte, setFonte] = useState(() => localStorage.getItem("a11y_fonte") || "normal");

  useEffect(() => {
    document.body.classList.toggle("high-contrast", contraste);
    localStorage.setItem("a11y_contraste", contraste ? "1" : "0");
  }, [contraste]);

  useEffect(() => {
    document.body.classList.remove("font-lg", "font-xl");
    if (fonte !== "normal") document.body.classList.add(fonte);
    localStorage.setItem("a11y_fonte", fonte);
  }, [fonte]);

  const fontes = ["normal", "font-lg", "font-xl"];
  const fonteLabels = { normal: "Normal", "font-lg": "Grande", "font-xl": "Maior" };

  return (
    <>
      {open && (
        <div className="a11y-panel">
          <div className="a11y-panel-title">Acessibilidade</div>
          <div className="a11y-row">
            <span className="a11y-label">Fonte</span>
            <div className="a11y-controls">
              {fontes.map(f => (
                <button key={f} className={`a11y-ctrl-btn${fonte === f ? " active" : ""}`} onClick={() => setFonte(f)} title={fonteLabels[f]}>
                  {f === "normal" ? "A" : f === "font-lg" ? "A+" : "A++"}
                </button>
              ))}
            </div>
          </div>
          <div className="a11y-row">
            <span className="a11y-label">Alto contraste</span>
            <button className={`a11y-toggle${contraste ? " on" : ""}`} onClick={() => setContraste(c => !c)} aria-label="Alternar alto contraste" />
          </div>
        </div>
      )}
      <button className="a11y-btn" onClick={() => setOpen(o => !o)} aria-label="Opções de acessibilidade" title="Acessibilidade">
        Aa
      </button>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState("landing");
  const [sideOpen, setSideOpen] = useState(false);
  const [user, setUser] = useState(() => {
    try {
      if (localStorage.getItem("anticeg_session_v") !== SESSION_VERSION) {
        localStorage.removeItem("anticeg_user");
        localStorage.removeItem("anticeg_session_at");
        localStorage.setItem("anticeg_session_v", SESSION_VERSION);
        return null;
      }
      const sessionAt = Number(localStorage.getItem("anticeg_session_at") || 0);
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      if (sessionAt && Date.now() - sessionAt > SEVEN_DAYS) {
        localStorage.removeItem("anticeg_user");
        localStorage.removeItem("anticeg_session_at");
        return null;
      }
      return JSON.parse(localStorage.getItem("anticeg_user"));
    } catch { return null; }
  });
  const [itens, setItens] = useState([]);
  const TAB_SLUGS = ["masterlist","cegs","calendario","perfil","regras","envio","admin"];
  const [tab, setTab] = useState(() => {
    const slug = window.location.pathname.replace(/^\//, "").split(/[?#]/)[0];
    return TAB_SLUGS.includes(slug) ? slug : "masterlist";
  });
  const [adminReset, setAdminReset] = useState(0);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPinModal, setAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState("");
  const [adminPinError, setAdminPinError] = useState(false);
  const [adminPinStored, setAdminPinStored] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [pushAtivos, setPushAtivos] = useState([]);
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
    supabase.from("config").select("value").eq("key", "admin_pin").single()
      .then(({ data }) => { if (data?.value) setAdminPinStored(data.value); });
    // Atualiza dados do joiner em cache (foto, nome, etc.)
    const cached = (() => { try { return JSON.parse(localStorage.getItem("anticeg_user")); } catch { return null; } })();
    if (cached?.cog && !cached?.guest) {
      supabase.from("joiners").select("*").eq("cog", cached.cog).single()
        .then(({ data }) => {
          if (data) {
            localStorage.setItem("anticeg_user", JSON.stringify(data));
            setUser(data);
          }
        });
    }
  }, []);

  function changeTab(newTab) {
    setTab(newTab);
    history.pushState(null, "", "/" + newTab);
  }

  useEffect(() => {
    const handler = () => {
      const slug = window.location.pathname.replace(/^\//, "").split(/[?#]/)[0];
      if (TAB_SLUGS.includes(slug)) setTab(slug);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
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
    localStorage.setItem("anticeg_session_at", String(Date.now()));
    setUser(u);
    setItens(itensData);
    setPage("portal");
    if (!u.guest) {
      if (!localStorage.getItem("anticeg_tutorial_v1")) setShowTutorial(true);
      if (!u.confirmado) setShowPerfilModal(true);
      const { data: notifs } = await supabase.from("notifications")
        .select("*").eq("joiner_cog", u.cog).is("read_at", null).order("created_at", { ascending: false });
      if (notifs?.length > 0) setNotificacoes(notifs);

      const { data: allPushes } = await supabase.from("pushes").select("*").eq("active", true).order("created_at", { ascending: false });
      if (allPushes?.length > 0) {
        const { data: lidos } = await supabase.from("push_reads").select("push_id").eq("joiner_cog", u.cog);
        const lidosIds = new Set((lidos || []).map(r => r.push_id));
        setPushAtivos(allPushes.filter(p => !lidosIds.has(p.id)));
      }
    }
  }

  function handleLogout() {
    localStorage.removeItem("anticeg_user");
    setUser(null);
    setItens([]);
    setTab("masterlist");
    history.replaceState(null, "", "/");
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
    history.replaceState(null, "", "/cegs");
    setPage("portal");
  }

  if (page === "landing" || !user) return <LandingPage onLogin={handleLogin} onVerCegs={handleVerCegs} />;

  const isAdmin = isAdminUser(user);

  return (
    <div>
      <AccessibilityWidget />
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
      {pushAtivos.map((p, i) => (
        <PushBanner
          key={p.id}
          push={p}
          offset={i}
          user={user}
          onOk={async () => {
            await supabase.from("push_reads").insert([{ push_id: p.id, joiner_cog: user.cog }]);
            setPushAtivos(prev => prev.filter(x => x.id !== p.id));
          }}
          onX={() => setPushAtivos(prev => prev.filter(x => x.id !== p.id))}
        />
      ))}
      {notificacoes.filter(n => n.type === "report_resolved").slice(0, 1).map(n => (
        <NotifResolvido
          key={n.id}
          notif={n}
          user={user}
          onDismiss={async () => {
            await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
            setNotificacoes(prev => prev.filter(x => x.id !== n.id));
          }}
        />
      ))}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showPerfilModal && !user.guest && (
        <ProfileConfirmModal
          user={user}
          onSave={updated => { setUser(updated); setShowPerfilModal(false); localStorage.setItem("anticeg_user", JSON.stringify(updated)); }}
          onSkip={() => setShowPerfilModal(false)}
        />
      )}
      {/* Side drawer overlay */}
      {sideOpen && (
        <div className="side-nav-overlay" onClick={() => setSideOpen(false)}>
          <nav className="side-nav" onClick={e => e.stopPropagation()}>
            <div className="side-nav-header">
              <span className="topbar-logo" style={{ fontSize:20 }}>ANTI<span>CEG</span></span>
              <button className="side-nav-close" onClick={() => setSideOpen(false)}>✕</button>
            </div>
            {!user.guest && (
              <div className="side-nav-user">
                <div className="user-dot" />
                <span>{user.nome || `@${user.cog}`}</span>
              </div>
            )}
            <div className="side-nav-items">
              {[
                { id:"masterlist", icon:"☰", label:"Masterlist" },
                { id:"cegs",       icon:"◈", label:"CEGs" },
                { id:"calendario", icon:"◫", label:"Calendário" },
                ...(!user.guest ? [{ id:"perfil", icon:"○", label:"Meu Perfil" }] : []),
                ...(!user.guest ? [{ id:"envio",  icon:"📦", label:"Envio Nacional" }] : []),
                { id:"regras",     icon:"☆", label:"Links & Regras" },
                ...(isAdmin ? [{ id:"admin", icon:"⚙", label:"Admin" }] : []),
              ].map(item => (
                <button key={item.id} className={`side-nav-item ${tab === item.id ? "active" : ""}`}
                  onClick={() => { changeTab(item.id); setSideOpen(false); }}>
                  <span className="side-nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="side-nav-footer">
              {user.guest ? (
                <button className="side-nav-logout" onClick={handleLogout}>ENTRAR →</button>
              ) : (
                <button className="side-nav-logout" onClick={() => { handleLogout(); setSideOpen(false); }}>Sair ↗</button>
              )}
            </div>
          </nav>
        </div>
      )}

      <div className="topbar">
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button className="topbar-hamburger" onClick={() => setSideOpen(true)} aria-label="Menu">
            <span /><span /><span />
          </button>
          <a className="topbar-logo" href="#">ANTI<span>CEG</span></a>
        </div>
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
        <button className={`tab-btn ${tab === "masterlist" ? "active" : ""}`} onClick={() => changeTab("masterlist")}>☰ Masterlist</button>
        <button className={`tab-btn ${tab === "cegs" ? "active" : ""}`} onClick={() => changeTab("cegs")}>◈ CEGs</button>
        <button className={`tab-btn ${tab === "calendario" ? "active" : ""}`} onClick={() => changeTab("calendario")}>◫ Calendário</button>
        {!user.guest && <button className={`tab-btn ${tab === "perfil" ? "active" : ""}`} onClick={() => changeTab("perfil")}>⚙ Meu Perfil</button>}
        {!user.guest && <button className={`tab-btn ${tab === "envio"  ? "active" : ""}`} onClick={() => changeTab("envio")}>◫ Envio Nacional</button>}
        <button className={`tab-btn ${tab === "regras" ? "active" : ""}`} onClick={() => changeTab("regras")}>☆ Links</button>
        {isAdminUser(user) && (
          <button className={`tab-btn ${tab === "admin" ? "active" : ""}`} onClick={() => {
            if (adminPinStored && !adminUnlocked) { setAdminPinModal(true); setAdminPinInput(""); setAdminPinError(false); }
            else { setAdminReset(v => v + 1); changeTab("admin"); }
          }}>⚙ Admin</button>
        )}
      </div>
      {tab === "masterlist" && <MasterlistTab user={user} itens={itens} onLogin={() => setPage("landing")} pushAtivos={pushAtivos} />}
      {tab === "cegs" && <CegTab user={user} itens={itens} />}
      {tab === "calendario" && <CalendarTab user={user} itens={itens} />}
      {!user.guest && tab === "perfil" && <PerfilTab user={user} onUpdate={setUser} owner={isOwner(user)} />}
      {!user.guest && tab === "envio" && <EnvioTab user={user} itens={itens} />}
      {tab === "regras" && <RegrasTab />}
      {tab === "admin" && isAdminUser(user) && <AdminTab owner={isOwner(user)} userCog={user?.cog || ""} resetSignal={adminReset} />}

      <BottomNav tab={tab} setTab={changeTab} isGuest={user.guest} isAdmin={isAdmin} />

      {!user.guest && itens.some(i =>
        (isPendente(i.pago_item) && Number(i.valor_item) > 0) ||
        (isPendente(i.pago_frete) && Number(i.frete_inter) > 0) ||
        (isPendente(i.pago_rf) && Number(i.taxa_rf) > 0)
      ) && (
        <a href="https://forms.gle/SyG2Zz8Lovreq8kn9" target="_blank" rel="noopener noreferrer" className="fab-pag">
          💳 Pagar agora
        </a>
      )}

      {/* Modal PIN Admin */}
      {adminPinModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }} onClick={() => setAdminPinModal(false)}>
          <div style={{ background:"#111", border:"1px solid rgba(245,240,232,.12)", borderRadius:14, padding:"32px 28px", width:300, display:"flex", flexDirection:"column", gap:16 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:"var(--laranja)", letterSpacing:1 }}>⚙ ADMIN</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"rgba(245,240,232,.45)" }}>// insira o PIN de acesso</div>
            <input
              autoFocus
              type="password"
              value={adminPinInput}
              onChange={e => { setAdminPinInput(e.target.value); setAdminPinError(false); }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  if (adminPinInput === adminPinStored) {
                    setAdminUnlocked(true); setAdminPinModal(false);
                    setAdminReset(v => v + 1); changeTab("admin");
                  } else { setAdminPinError(true); setAdminPinInput(""); }
                }
              }}
              placeholder="••••••"
              style={{ background:"#0d0d0d", border:`1px solid ${adminPinError ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, borderRadius:8, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:18, padding:"12px 16px", outline:"none", letterSpacing:4, textAlign:"center" }}
            />
            {adminPinError && <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--laranja)", textAlign:"center" }}>PIN incorreto. Tente novamente.</div>}
            <button onClick={() => {
              if (adminPinInput === adminPinStored) {
                setAdminUnlocked(true); setAdminPinModal(false);
                setAdminReset(v => v + 1); changeTab("admin");
              } else { setAdminPinError(true); setAdminPinInput(""); }
            }} style={{ background:"var(--laranja)", color:"#111", border:"none", borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700, padding:"12px", cursor:"pointer", letterSpacing:".08em" }}>
              ENTRAR →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}