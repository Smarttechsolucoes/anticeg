import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import supabase from "./supabase.js";
import emailjs from "@emailjs/browser";
import "./App.css";
import LandingPage from "./LandingPage";
import bonequinha from "./assets/bonequinha.png";
import badgeFoxiny   from "./assets/badges/foxiny.jpg";
import badgePuppym   from "./assets/badges/puppym.jpg";
import badgeWolfchan from "./assets/badges/wolfchan.jpg";
import badgeBbokari  from "./assets/badges/bbokari.jpg";
import badgeJiniret  from "./assets/badges/jiniret.jpg";
import badgeDwaekki  from "./assets/badges/dwaekki.jpg";
import badgeQuokka   from "./assets/badges/quokka.jpg";
import badgeLeebit   from "./assets/badges/leebit.png";

// ── EmailJS config ── preencha após criar conta em emailjs.com
const EJS_SERVICE  = "service_wguc7si";
const EJS_TEMPLATE = "template_3x4zqua";
const EJS_KEY      = "FoEjO0bZC4mn9ebeN";

async function sendEmailJoiner(toEmail, toNome, assunto, corpo) {
  return; // emails temporariamente desativados
  if (!toEmail || EJS_SERVICE.startsWith("YOUR")) return; // eslint-disable-line no-unreachable
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
      <div><a href="https://anticeg.vercel.app" style="color:rgba(245,240,232,0.3);text-decoration:none;font-size:10px;margin:0 8px">Portal</a><span style="color:rgba(245,240,232,0.1)">&middot;</span><a href="https://wa.me/5524992782023" style="color:rgba(245,240,232,0.3);text-decoration:none;font-size:10px;margin:0 8px">WhatsApp</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const pf = v => parseFloat(String(v ?? 0).replace(",", ".")) || 0;


const WHATSAPP_NUM = "5524992782023";
const OWNER_EMAILS = ["nandag_medeiros@hotmail.com"];
const OWNER_COGS   = ["nandaverseo_c"];
const STAFF_EMAILS = ["nathallynayane1234@gmail.com"];
const STAFF_COGS   = ["nathy_mrnd"];
const SESSION_VERSION = "3";
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

function fmtVenc(v) {
  if (!v) return null;
  return new Date(v + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function diasAtraso(vencimento) {
  if (!vencimento) return 0;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const venc = new Date(vencimento + "T12:00:00");
  const diff = Math.floor((hoje - venc) / 86400000);
  return diff > 0 ? diff : 0;
}

// ── Badges de gamificação (SKZOO) ──────────────────────────────
const CEG_GRUPO = {
  "DO IT": "Stray Kids", "DO IT CARDS": "Stray Kids", "DO IT CARDS2": "Stray Kids",
  "DO IT EXTRAS": "Stray Kids", "POP-UP DO IT": "Stray Kids", "SKZOO": "Stray Kids",
  "DOMINATE JAPAN": "Stray Kids", "DOMINATE DVD": "Stray Kids",
  "6TH FAN MEETING CARD": "Stray Kids", "6TH FANMEETING MERCH": "Stray Kids",
  "6th GEN": "Stray Kids", "ATE LIP": "Stray Kids", "BAHNGS": "Stray Kids",
  "SKZOOTOPIA": "Stray Kids", "SKZ ALBUNS": "Stray Kids", "WOLFGANG": "Stray Kids",
  "KMS KARMA": "Stray Kids", "POP-UP KARMA": "Stray Kids",
  "BTS": "BTS", "ATEEZ": "ATEEZ",
};

// Concessões manuais de badges (exceções decididas pela admin, fora do cálculo automático)
const BADGES_MANUAIS = {};

const BADGES_DEF = [
  { id: "foxiny",   img: badgeFoxiny,   label: "Foxiny",   desc: "Novo membro — poucas CEGs vinculadas", color: "laranja" },
  { id: "puppym",   img: badgePuppym,   label: "Puppym",   desc: "Joiner fiel — 20+ CEGs ativas", color: "verde" },
  { id: "wolfchan", img: badgeWolfchan, label: "Wolfchan",  desc: "Usou envio nacional, forms de pagamento e reportar erro", color: "lilas" },
  { id: "bbokari",  img: badgeBbokari,  label: "Bbokari",   desc: "3+ envios concluídos pelo site", color: "laranja" },
  { id: "jiniret",  img: badgeJiniret,  label: "Jiniret",   desc: "Menos de 10 multas pagas", color: "verde" },
  { id: "dwaekki",  img: badgeDwaekki,  label: "Dwaekki",   desc: "Comprou item(ns) 3D", color: "lilas" },
  { id: "quokka",   img: badgeQuokka,   label: "Quokka",    desc: "Multifandom — 2+ grupos diferentes", color: "laranja" },
  { id: "leebit",   img: badgeLeebit,   label: "Leebit",    desc: "Gastou mais de R$7.000 acumulado", color: "dourado" },
];

function computeBadges({ itens = [], envios = [], pagamentos = [], reports = [], multasPagas = 0, cog = null }) {
  const cegsDistintos = new Set(itens.map(i => i.ceg)).size;
  const gruposDistintos = new Set(itens.map(i => CEG_GRUPO[i.ceg]).filter(Boolean)).size;
  const totalPago = itens.reduce((a, i) =>
    a + (i.pago_item ? Number(i.valor_item || 0) : 0)
      + (i.pago_frete ? Number(i.frete_inter || 0) : 0)
      + (i.pago_rf ? Number(i.taxa_rf || 0) : 0), 0);
  const enviosFeitos = envios.filter(e => e.status === "enviado").length;
  const temItem3D = itens.some(i => /3d/i.test(i.nome_do_item || "") || (i.ceg || "").trim().toUpperCase() === "GET COOL");
  const fmtR = v => `R$${v.toFixed(2).replace(".", ",")}`;
  const manuais = BADGES_MANUAIS[cog] || [];

  const earned = {
    foxiny:   itens.length > 0,
    puppym:   cegsDistintos >= 20,
    wolfchan: envios.length > 0 && pagamentos.length > 0 && reports.length > 0,
    bbokari:  enviosFeitos >= 3,
    jiniret:  multasPagas < 10,
    dwaekki:  temItem3D,
    quokka:   gruposDistintos >= 2,
    leebit:   totalPago >= 7000,
  };
  manuais.forEach(id => { earned[id] = true; });

  const wolfchanFaltam = [
    envios.length === 0     ? "fazer um Envio Nacional" : null,
    pagamentos.length === 0 ? "usar o forms de pagamento" : null,
    reports.length === 0    ? "reportar um erro" : null,
  ].filter(Boolean);

  const detalhe = {
    foxiny:   earned.foxiny   ? "Conquistado pra sempre — não some, mesmo crescendo na comunidade." : "Adicione pelo menos 1 item na sua masterlist pra conquistar.",
    puppym:   earned.puppym   ? `Conquistado com ${cegsDistintos} CEGs — fica valendo pra sempre.` : `Você tem ${cegsDistintos}/20 CEGs vinculadas. Faltam ${20 - cegsDistintos} pra conquistar.`,
    wolfchan: earned.wolfchan ? "Conquistado pra sempre — você já usou os 3 recursos." : `Falta: ${wolfchanFaltam.join(", ")}.`,
    bbokari:  earned.bbokari  ? `Conquistado com ${enviosFeitos} envios concluídos — fica valendo pra sempre.` : `Você tem ${enviosFeitos}/3 envios concluídos pelo site.`,
    jiniret:  earned.jiniret  ? `Em dia! ${multasPagas} multa(s) paga(s) até agora. Pague sempre antes do vencimento pra não perder esse badge (precisa ficar abaixo de 10).` : `Você já tem ${multasPagas} multas pagas. Fique abaixo de 10 pra reconquistar.`,
    dwaekki:  earned.dwaekki  ? "Conquistado pra sempre — você já comprou um item 3D." : "Compre algum item com \"3D\" no nome pra conquistar.",
    quokka:   earned.quokka   ? `Conquistado pra sempre — você já participou de ${gruposDistintos} grupos diferentes.` : `Você participou de ${gruposDistintos}/2 grupos diferentes. Participe de outro grupo pra conquistar.`,
    leebit:   earned.leebit   ? `Conquistado pra sempre — você gastou ${fmtR(totalPago)} acumulado.` : `Você gastou ${fmtR(totalPago)} de R$7.000,00 necessários. Faltam ${fmtR(7000 - totalPago)}.`,
  };

  return BADGES_DEF.map(b => ({
    ...b,
    earned: !!earned[b.id],
    detalhe: manuais.includes(b.id) ? "Conquistado — concedido pela equipe ANTICEG." : detalhe[b.id],
  }));
}

function NovoBadgePopup({ badge, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [badge.id]);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.78)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }} onClick={onClose}>
      <div style={{ background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.12)", borderRadius:16, padding:"32px 28px", width:"min(320px, 100%)", display:"flex", flexDirection:"column", alignItems:"center", gap:10, textAlign:"center", animation:"badgePopIn .35s ease" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"1.5px", color:"var(--verde)", textTransform:"uppercase" }}>🎉 Novo badge conquistado!</div>
        <div className={`badge-hex-wrap badge-earned ${badge.color === "dourado" ? "badge-hex-glow" : ""}`} style={{ margin:"10px 0" }}>
          <div className={`badge-hex badge-hex-${badge.color}`} style={{ width:96, height:86 }}>
            <div className="badge-hex-inner">
              <div className="badge-hex-circle" style={{ width:66, height:66 }}>
                <img src={badge.img} alt={badge.label} />
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:"var(--offwhite)", letterSpacing:1 }}>{badge.label}</div>
        <div style={{ fontSize:12, color:"rgba(245,240,232,.55)", lineHeight:1.5 }}>{badge.desc}</div>
        <button onClick={onClose} className="login-btn" style={{ marginTop:14, width:"100%" }}>FECHAR</button>
      </div>
    </div>
  );
}

function BadgesRow({ badges }) {
  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:"1.5px", color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:12 }}>
        Conquistas
      </div>
      <div className="badges-row">
        <div className="badge-line badge-line-top" />
        <div className="badge-line badge-line-bottom" />
        <div className="badge-line badge-line-connector" />
        {badges.map(b => (
          <div key={b.id} className={`badge-hex-wrap ${b.earned ? "badge-earned" : "badge-locked"} ${b.earned && b.color === "dourado" ? "badge-hex-glow" : ""}`} title={b.desc}>
            <div className={`badge-hex badge-hex-${b.color}`}>
              <div className="badge-hex-inner">
                <div className="badge-hex-circle">
                  <img src={b.img} alt={b.label} />
                </div>
              </div>
            </div>
            <div className="badge-hex-label">{b.label}</div>
            <span className="badge-pill-desc">{b.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValCell({ val, status, vencimento, emAnalise, confirmado }) {
  if (!Number(val)) return <span className="zero-val">—</span>;
  const pendente = isPendente(status) && !confirmado;
  const dias = pendente && !emAnalise ? diasAtraso(vencimento) : 0;
  const multa = dias * 1;
  const numStyle = emAnalise && pendente
    ? { color: "#A78BFA", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 }
    : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {numStyle
        ? <span style={numStyle}>R${fmtBRL(val)}</span>
        : <span className={`td-val ${pendente ? "pend" : "pago"}`}>R${fmtBRL(val)}</span>}
      {confirmado && isPendente(status) && <span style={{ fontSize: 9, color: "#4ade80", fontFamily: "'DM Mono',monospace", letterSpacing: ".05em" }}>✓ confirmado</span>}
      {!emAnalise && !confirmado && <PayBadge status={status} />}
      {emAnalise && pendente && <span style={{ fontSize: 9, color: "#A78BFA", fontFamily: "'DM Mono',monospace", letterSpacing: ".05em" }}>em análise</span>}
      {pendente && !emAnalise && !confirmado && vencimento && dias === 0 && (
        <span style={{ fontSize: 9, color: "rgba(240,192,64,.8)", fontFamily: "'DM Mono',monospace", letterSpacing: ".03em", whiteSpace: "nowrap" }}>
          venc {fmtVenc(vencimento)}
        </span>
      )}
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

const NOMES_MEMBROS = [
  "BANG CHAN", "LEE KNOW", "HAN QUOKKA", "WOLF CHAN", "FOX I.NY",
  "CHANGBIN", "HYUNJIN", "SEUNGMIN", "LEEBIT", "DWAEKKI",
  "JINIRET", "BBOKARI", "PUPPYM", "FELIX", "FOXINY", "FOXI.NY",
  "HAN", "I.N", "IN",
];

function parseMembro(nomeItem) {
  const s = (nomeItem || "").trim();
  const up = s.toUpperCase();
  const membrosEncontrados = [];
  let pos = 0;

  while (pos <= s.length) {
    // se já achamos ao menos um membro, tenta consumir " + " antes do próximo
    if (membrosEncontrados.length > 0) {
      const plusMatch = up.slice(pos).match(/^\s*\+\s*/);
      if (!plusMatch) break;
      const tentativa = pos + plusMatch[0].length;
      let achouProximo = false;
      for (const m of NOMES_MEMBROS) {
        const up2 = up.slice(tentativa);
        const depois = tentativa + m.length;
        if (up2.startsWith(m) && (depois >= s.length || /[\s|+]/.test(s[depois]))) {
          membrosEncontrados.push(s.slice(tentativa, depois));
          pos = depois;
          achouProximo = true;
          break;
        }
      }
      if (!achouProximo) break;
    } else {
      // tenta achar o primeiro membro
      let achou = false;
      for (const m of NOMES_MEMBROS) {
        const depois = pos + m.length;
        if (up.startsWith(m) && (depois >= s.length || /[\s|+]/.test(s[depois]))) {
          membrosEncontrados.push(s.slice(pos, depois));
          pos = depois;
          achou = true;
          break;
        }
      }
      if (!achou) break;
    }
  }

  if (membrosEncontrados.length === 0) {
    const partes = s.split("|");
    return { membro: "", tipo: partes[0].trim(), versao: partes.slice(1).join("|").trim() };
  }

  const resto = s.slice(pos).trim();
  const partes = resto.split("|");
  return {
    membro: membrosEncontrados.join(" + "),
    tipo: partes[0].trim() || s,
    versao: partes.slice(1).join("|").trim(),
  };
}

function slugify(str) {
  return (str || "").toLowerCase()
    .replace(/&/g, "and").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").trim();
}

function parseCapaCfg(nomeDoItem) {
  if (!nomeDoItem) return { zoom: 1, posY: 50 };
  try {
    const cfg = JSON.parse(nomeDoItem);
    if (cfg && typeof cfg.zoom === "number") return { zoom: cfg.zoom, posY: cfg.posY ?? 50 };
  } catch {}
  return { zoom: 1, posY: 50 };
}

function CegDetailView({ ceg, onVoltar, guest, user }) {
  const [itens, setItens] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(null);
  const [reportItem, setReportItem] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [viewMode, setViewMode] = useState("tabela");
  const [ordemAlfa, setOrdemAlfa] = useState(false);
  const [ampliada, setAmpliada] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [capaZoom, setCapaZoom] = useState(1);
  const [capaPosY, setCapaPosY] = useState(50);

  const capaFotoAtual = fotos.find(f => f.ordem < 0);
  useEffect(() => {
    const cfg = parseCapaCfg(capaFotoAtual?.nome_do_item);
    setCapaZoom(cfg.zoom);
    setCapaPosY(cfg.posY);
  }, [capaFotoAtual?.id]);

  const owner = isOwner(user);

  async function salvarCapaCfg(id, zoom, posY) {
    await supabase.from("item_fotos").update({ nome_do_item: JSON.stringify({ zoom, posY }) }).eq("id", id);
    setUploadMsg("Capa salva ✓");
    setTimeout(() => setUploadMsg(""), 2000);
  }

  async function uploadFotos(files, comoCapa = false) {
    setUploading(true);
    const slug = ceg.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().slice(0, 30);
    const novas = [];
    const galeriaAtual = fotos.filter(f => f.ordem >= 0);
    for (const file of files) {
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `${slug}/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("fotos-itens").upload(path, file, { upsert: true });
      if (upErr) { alert("Erro: " + upErr.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from("fotos-itens").getPublicUrl(path);
      const ordemVal = comoCapa ? -1 : (galeriaAtual.length + novas.length);
      const { data: nova, error: insErr } = await supabase.from("item_fotos")
        .insert([{ ceg, nome_do_item: file.name.replace(/\.[^.]+$/, ""), foto_url: publicUrl, ordem: ordemVal }])
        .select().single();
      if (insErr) { alert("Erro ao salvar foto: " + insErr.message); continue; }
      if (nova) novas.push(nova);
    }
    if (comoCapa && novas.length > 0) {
      // remove capa anterior se existir
      const capaAnterior = fotos.find(f => f.ordem < 0);
      if (capaAnterior) {
        await supabase.from("item_fotos").delete().eq("id", capaAnterior.id);
        setFotos(prev => prev.filter(f => f.id !== capaAnterior.id));
      }
    }
    setFotos(prev => {
      const combined = [...prev, ...novas];
      combined.sort((a, b) => a.ordem - b.ordem || a.id - b.id);
      return combined;
    });
    if (novas.length > 0) {
      setUploadMsg(comoCapa ? "Capa atualizada ✓" : `${novas.length} foto(s) adicionada(s) ✓`);
      setTimeout(() => setUploadMsg(""), 3000);
    }
    setUploading(false);
  }

  async function removerFoto(id) {
    if (!window.confirm("Remover foto?")) return;
    const { error } = await supabase.from("item_fotos").delete().eq("id", id);
    if (error) { alert("Erro ao remover foto: " + error.message); return; }
    setFotos(prev => prev.filter(f => f.id !== id));
  }

  async function usarComoCapa(id) {
    // Reset capa anterior (ordem < 0) para 0, define nova capa com ordem = -1
    const capaAnterior = fotos.find(f => f.ordem < 0 && f.id !== id);
    if (capaAnterior) {
      await supabase.from("item_fotos").update({ ordem: 0 }).eq("id", capaAnterior.id);
    }
    const jaCapa = fotos.find(f => f.id === id)?.ordem < 0;
    if (jaCapa) {
      // toggle: remove da capa, volta pra galeria
      await supabase.from("item_fotos").update({ ordem: 0 }).eq("id", id);
      setFotos(prev => {
        const updated = prev.map(f => {
          if (f.id === id) return { ...f, ordem: 0 };
          if (capaAnterior && f.id === capaAnterior.id) return { ...f, ordem: 0 };
          return f;
        });
        updated.sort((a, b) => a.ordem - b.ordem || a.id - b.id);
        return updated;
      });
    } else {
      await supabase.from("item_fotos").update({ ordem: -1 }).eq("id", id);
      setFotos(prev => {
        const updated = prev.map(f => {
          if (f.id === id) return { ...f, ordem: -1 };
          if (capaAnterior && f.id === capaAnterior.id) return { ...f, ordem: 0 };
          return f;
        });
        updated.sort((a, b) => a.ordem - b.ordem || a.id - b.id);
        return updated;
      });
    }
  }

  useEffect(() => {
    supabase.from("masterlist").select("*").eq("ceg", ceg).neq("nome", "Disponivel")
      .then(({ data }) => setItens(data || []));
    supabase.from("item_fotos").select("*").eq("ceg", ceg).order("ordem").order("id")
      .then(({ data }) => setFotos(data || []));
  }, [ceg]);

  const joiners = itens ? [...new Set(itens.map(i => i.cog))].length : 0;

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">
            <button onClick={onVoltar} style={{ background:"none", border:"none", color:"rgba(245,240,232,.62)", fontFamily:"'DM Mono',monospace", fontSize:"var(--fs-xs)", cursor:"pointer", padding:0, letterSpacing:1 }}>← voltar</button>
          </div>
          {ceg === "THIS & THAT"
            ? <img src="/this-and-that-logo.png" alt="THIS & THAT" style={{ height:60, width:"auto", display:"block", mixBlendMode:"screen", filter:"invert(1)", marginTop:4 }} />
            : <div className="page-title">{ceg}</div>
          }
        </div>
        {itens && (
          <div style={{ textAlign:"right" }}>
            <div className="greeting-sub" style={{ marginTop:8 }}>{itens.length} itens · {joiners} joiners</div>
            <div style={{ display:"flex", gap:4, marginTop:10, justifyContent:"flex-end", alignItems:"center", flexWrap:"wrap" }}>
              {(fotos.length > 0 || owner) && [["tabela","⊞"],["galeria","⊟"]].map(([mode, icon]) => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{ fontSize:9, fontFamily:"'DM Mono',monospace", padding:"4px 10px", borderRadius:5, cursor:"pointer", border:`1px solid ${viewMode===mode ? "rgba(201,168,240,.4)" : "rgba(245,240,232,.1)"}`, background:viewMode===mode ? "rgba(201,168,240,.12)" : "transparent", color:viewMode===mode ? "#C9A8F0" : "rgba(245,240,232,.3)" }}>
                  {icon} {mode}
                </button>
              ))}
              {viewMode === "tabela" && (
                <button onClick={() => setOrdemAlfa(v => !v)} title={ordemAlfa ? "Ordenação A–Z ativa — clique para desativar" : "Ordenar joiners de A a Z"} style={{ fontSize:9, fontFamily:"'DM Mono',monospace", padding:"4px 10px", borderRadius:5, cursor:"pointer", border:`1px solid ${ordemAlfa ? "rgba(186,255,57,.4)" : "rgba(245,240,232,.1)"}`, background:ordemAlfa ? "rgba(186,255,57,.1)" : "transparent", color:ordemAlfa ? "var(--verde)" : "rgba(245,240,232,.3)", display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontSize:11, lineHeight:1 }}>{ordemAlfa ? "↑" : "↕"}</span>
                  <span>joiner</span>
                  {ordemAlfa && <span style={{ fontSize:8, opacity:.7 }}>A–Z</span>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Galeria de fotos */}
      {viewMode === "galeria" && (fotos.length > 0 || owner) && (
        <div style={{ marginBottom:28 }}>
          {/* Seção de capa (só visível pro owner) */}
          {owner && (() => {
            const capaFoto = fotos.find(f => f.ordem < 0);
            return (
              <div style={{ marginBottom:24, padding:"16px 20px", borderRadius:10, background:"rgba(255,92,26,.06)", border:"1px solid rgba(255,92,26,.2)" }}>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:"1.5px", color:"rgba(255,92,26,.7)", textTransform:"uppercase", marginBottom:12 }}>foto de capa do card</div>
                {capaFoto ? (
                  <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
                    {/* Preview menor */}
                    <div style={{ width:180, flexShrink:0, aspectRatio:"16/7", overflow:"hidden", borderRadius:6, border:"1px solid rgba(255,92,26,.25)" }}>
                      <img src={capaFoto.foto_url} alt="capa" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:`50% ${capaPosY}%`, transform:`scale(${capaZoom})`, transformOrigin:`50% ${capaPosY}%`, display:"block" }} />
                    </div>
                    {/* Sliders + ações */}
                    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10 }}>
                      <div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"rgba(245,240,232,.4)" }}>zoom</span>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"rgba(255,92,26,.7)" }}>{capaZoom.toFixed(1)}×</span>
                        </div>
                        <input type="range" min="1" max="3" step="0.05" value={capaZoom}
                          onChange={e => setCapaZoom(parseFloat(e.target.value))}
                          style={{ width:"100%", accentColor:"var(--laranja)", cursor:"pointer" }} />
                      </div>
                      <div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"rgba(245,240,232,.4)" }}>posição vertical</span>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"rgba(255,92,26,.7)" }}>{capaPosY}%</span>
                        </div>
                        <input type="range" min="0" max="100" step="1" value={capaPosY}
                          onChange={e => setCapaPosY(parseInt(e.target.value, 10))}
                          style={{ width:"100%", accentColor:"var(--laranja)", cursor:"pointer" }} />
                      </div>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:2 }}>
                        <button onClick={() => salvarCapaCfg(capaFoto.id, capaZoom, capaPosY)} style={{ fontSize:9, fontFamily:"'DM Mono',monospace", padding:"5px 12px", borderRadius:5, cursor:"pointer", border:"1px solid rgba(255,92,26,.4)", background:"rgba(255,92,26,.1)", color:"var(--laranja)" }}>
                          salvar
                        </button>
                        <label style={{ fontSize:9, fontFamily:"'DM Mono',monospace", padding:"5px 12px", borderRadius:5, cursor:"pointer", border:"1px solid rgba(245,240,232,.1)", background:"transparent", color:"rgba(245,240,232,.4)" }}>
                          trocar capa
                          <input type="file" accept="image/*" style={{ display:"none" }} disabled={uploading} onChange={e => e.target.files.length && uploadFotos(Array.from(e.target.files), true)} />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
                    <div style={{ width:60, height:80, borderRadius:7, border:"2px dashed rgba(255,92,26,.3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:20, color:"rgba(255,92,26,.4)" }}>+</span>
                    </div>
                    <div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--laranja)" }}>{uploading ? "enviando..." : "adicionar foto de capa"}</div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"rgba(245,240,232,.3)", marginTop:3 }}>aparece no card do resumo — separada da galeria</div>
                    </div>
                    <input type="file" accept="image/*" style={{ display:"none" }} disabled={uploading} onChange={e => e.target.files.length && uploadFotos(Array.from(e.target.files), true)} />
                  </label>
                )}
              </div>
            );
          })()}

          {/* Fotos da galeria de itens (ordem >= 0) */}
          {(() => {
            const galeriaFotos = fotos.filter(f => f.ordem >= 0);
            return galeriaFotos.length > 0 ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:12, marginBottom:16 }}>
                {galeriaFotos.map(f => {
                  const fTipo = parseMembro(f.nome_do_item).tipo || f.nome_do_item || "";
                  const joinersDoItem = (itens || []).filter(i => {
                    const { tipo } = parseMembro(i.nome_do_item);
                    return tipo.toLowerCase() === fTipo.toLowerCase();
                  });
                  return (
                    <div key={f.id} style={{ position:"relative", borderRadius:10, overflow:"hidden", background:"#111", border:"1px solid rgba(245,240,232,.08)", cursor:"pointer" }}
                      onClick={() => setAmpliada(f)}>
                      <img src={f.foto_url} alt={f.nome_do_item} style={{ width:"100%", aspectRatio:"3/4", objectFit:"cover", display:"block" }} />
                      <div style={{ padding:"8px 10px 10px" }}>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"var(--offwhite)", letterSpacing:"0.5px", lineHeight:1.4 }}>{f.nome_do_item || "—"}</div>
                        {joinersDoItem.length > 0 && (
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"rgba(245,240,232,.35)", marginTop:4 }}>{joinersDoItem.length} joiner{joinersDoItem.length > 1 ? "s" : ""}</div>
                        )}
                      </div>
                      {owner && (
                        <>
                          <button onClick={e => { e.stopPropagation(); removerFoto(f.id); }} style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,.7)", border:"none", borderRadius:4, color:"rgba(255,107,107,.8)", fontSize:14, width:22, height:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                          <button onClick={e => { e.stopPropagation(); usarComoCapa(f.id); }} title="Usar como capa" style={{ position:"absolute", top:6, left:6, background:"rgba(0,0,0,.7)", border:"1px solid transparent", borderRadius:4, color:"rgba(245,240,232,.5)", fontSize:12, width:22, height:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>★</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : owner ? (
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.25)", marginBottom:12 }}>nenhuma foto na galeria ainda</div>
            ) : null;
          })()}

          {owner && (
            <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, border:"2px dashed rgba(201,168,240,.25)", borderRadius:10, padding:"20px", cursor:"pointer", background:"rgba(201,168,240,.03)" }}>
              <span style={{ fontSize:18 }}>+</span>
              <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"#C9A8F0" }}>{uploading ? "enviando..." : "adicionar fotos à galeria"}</span>
              <input type="file" accept="image/*" multiple style={{ display:"none" }} disabled={uploading} onChange={e => e.target.files.length && uploadFotos(Array.from(e.target.files))} />
            </label>
          )}
          {uploadMsg && <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"#BAFF39", marginTop:10 }}>{uploadMsg}</div>}

          {/* Modal de joiners ao clicar na foto */}
          {ampliada && (
            <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex" }} onClick={() => setAmpliada(null)}>
              <div style={{ flex:1, background:"rgba(0,0,0,.7)" }} />
              <div style={{ width:"min(380px, 100vw)", background:"#111", borderLeft:"1px solid rgba(245,240,232,.1)", display:"flex", flexDirection:"column", overflowY:"auto" }}
                onClick={e => e.stopPropagation()}>
                <div style={{ padding:"20px 20px 0" }}>
                  <button onClick={() => setAmpliada(null)} style={{ background:"none", border:"none", color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer", padding:0, marginBottom:14 }}>← fechar</button>
                  <img src={ampliada.foto_url} alt={ampliada.nome_do_item} style={{ width:"100%", borderRadius:8, display:"block", marginBottom:12 }} />
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:"var(--offwhite)", letterSpacing:"1px", marginBottom:4 }}>{ampliada.nome_do_item || "—"}</div>
                </div>
                <div style={{ padding:"12px 20px 24px", borderTop:"1px solid rgba(245,240,232,.08)", marginTop:8 }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:"1.5px", color:"rgba(245,240,232,.3)", textTransform:"uppercase", marginBottom:12 }}>joiners</div>
                  {(() => {
                    const fTipo = parseMembro(ampliada.nome_do_item).tipo || ampliada.nome_do_item || "";
                    const joinersDoItem = (itens || []).filter(i => {
                      const { tipo } = parseMembro(i.nome_do_item);
                      return tipo.toLowerCase() === fTipo.toLowerCase();
                    });
                    return joinersDoItem.length === 0
                      ? <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"rgba(245,240,232,.3)" }}>nenhum joiner com esse item</div>
                      : joinersDoItem.map(i => {
                          const { membro, versao } = parseMembro(i.nome_do_item);
                          return (
                            <div key={i.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid rgba(245,240,232,.06)", gap:8 }}>
                              <div>
                                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"var(--offwhite)" }}>{i.nome || i.cog || "—"}</div>
                                {(membro || versao) && (
                                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.4)", marginTop:2 }}>
                                    {versao ? `${membro} · ${versao}` : membro}
                                  </div>
                                )}
                              </div>
                              <StatusChip status={i.status} />
                            </div>
                          );
                        });
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode !== "galeria" && (itens === null ? (
        <div style={{ padding:40, textAlign:"center", color:"rgba(245,240,232,.52)", fontSize:"var(--fs-xs)" }}>carregando...</div>
      ) : (() => {
        const fotoMap = {};
        fotos.filter(f => f.ordem >= 0).forEach(f => {
          const k = (f.nome_do_item || "").trim().toLowerCase();
          if (k && !fotoMap[k]) fotoMap[k] = f.foto_url;
        });
        const fotoDoGrupo = (tipo) => {
          const k = tipo.trim().toLowerCase();
          if (fotoMap[k]) return fotoMap[k];
          for (const [fk, url] of Object.entries(fotoMap)) {
            if (fk.includes(k) || k.includes(fk)) return url;
          }
          return null;
        };
        const itensOrdenados = ordemAlfa
          ? [...itens].sort((a, b) => (a.nome || a.cog || "").localeCompare(b.nome || b.cog || ""))
          : itens;
        const grupos = ordemAlfa
          ? [["", itensOrdenados]]
          : Object.entries(
              itens.reduce((acc, item) => {
                const { tipo } = parseMembro(item.nome_do_item);
                const chave = tipo || item.nome_do_item || "—";
                if (!acc[chave]) acc[chave] = [];
                acc[chave].push(item);
                return acc;
              }, {})
            );
        const cols = !guest ? 7 : 4;
        return (
          <>
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
                    <th>MEMBRO</th>
                    {!guest && <><th>ITEM</th><th>FRETE INTER</th><th>TAXA RF</th></>}
                    <th>STATUS</th>
                    <th>INFO</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.length === 0 && (
                    <tr><td colSpan={cols} className="empty-cell">nenhum item</td></tr>
                  )}
                  {grupos.map(([nome, grupoItens]) => {
                    const foto = fotoDoGrupo(nome);
                    return (
                      <Fragment key={nome}>
                        {nome && (
                          <tr>
                            <td colSpan={cols} style={{ padding:0, borderTop:"2px solid rgba(245,240,232,.12)" }}>
                              {foto && (
                                <img src={foto} alt={nome} style={{ maxWidth:"100%", width:"auto", height:"auto", display:"block", margin:"0 auto", maxHeight:300 }} />
                              )}
                              <div style={{ background:"rgba(245,240,232,.06)", borderBottom:"1px solid rgba(245,240,232,.08)", padding:"9px 14px" }}>
                                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:"1.5px", color:"var(--offwhite)" }}>{nome}</span>
                                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.35)", marginLeft:10 }}>× {grupoItens.length}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                        {grupoItens.map(item => {
                          const ai = getStepIdx(item.status);
                          const isOpen = openDrawer === item.id;
                          const { membro, versao } = parseMembro(item.nome_do_item);
                          return (
                            <Fragment key={item.id}>
                              <tr>
                                <td className="ceg-detail-joiner">{item.nome || item.cog || "—"}</td>
                                <td style={{ fontSize:11, color:"rgba(245,240,232,.55)", fontFamily:"'DM Mono',monospace" }}>
                                  {versao ? `${membro} · ${versao}` : membro}
                                </td>
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
                                <tr className="drawer-row">
                                  <td colSpan={cols}><Timeline activeIdx={ai} /></td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            {itens.length > 0 && (
              <div className="ml-cards">
                {grupos.map(([nome, grupoItens]) => {
                  const foto = fotoDoGrupo(nome);
                  return (
                    <Fragment key={nome}>
                      {nome && (
                        <div style={{ borderTop:"2px solid rgba(245,240,232,.12)", marginTop:14 }}>
                          {foto && (
                            <img src={foto} alt={nome} style={{ maxWidth:"100%", width:"auto", height:"auto", display:"block", margin:"0 auto", maxHeight:280, borderRadius:"6px 6px 0 0" }} />
                          )}
                          <div style={{ padding:"9px 0 8px", borderBottom:"2px solid rgba(245,240,232,.1)", marginBottom:10 }}>
                            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:"1.5px", color:"var(--offwhite)" }}>{nome}</span>
                            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.35)", marginLeft:10 }}>× {grupoItens.length}</span>
                          </div>
                        </div>
                      )}
                      {grupoItens.map(item => {
                        const ai = getStepIdx(item.status);
                        const isOpen = openDrawer === item.id;
                        const total = Number(item.valor_item||0)+Number(item.frete_inter||0)+Number(item.taxa_rf||0);
                        const { membro, versao } = parseMembro(item.nome_do_item);
                        return (
                          <div key={item.id} className="ml-card">
                            <div className="ml-card-top">
                              <span className="ml-val-label" style={{ color:"rgba(245,240,232,.5)", fontSize:11 }}>{item.nome || item.cog || "—"}</span>
                              <StatusChip status={item.status} />
                            </div>
                            {ordemAlfa && item.nome_do_item && (
                              <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.55)", marginBottom:4 }}>{item.nome_do_item}</div>
                            )}
                            {!ordemAlfa && (membro || versao) && (
                              <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.4)", marginBottom:6 }}>
                                {versao ? `${membro} · ${versao}` : membro}
                              </div>
                            )}
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
                    </Fragment>
                  );
                })}
              </div>
            )}
          </>
        );
      })())}

      {reportItem && <ReportModal user={user} item={reportItem} onClose={() => setReportItem(null)} />}
    </div>
  );
}

const STATUS_FINAIS = ["Enviado Nacional", "Vendido"];

function CegSlugPage({ slug, user }) {
  const [cegNome, setCegNome] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase.from("masterlist").select("ceg").neq("nome", "Disponivel")
      .then(({ data }) => {
        if (!data) { setNotFound(true); return; }
        const cegs = [...new Set(data.map(r => r.ceg))];
        const match = cegs.find(c => slugify(c) === slug);
        if (match) setCegNome(match);
        else setNotFound(true);
      });
  }, [slug]);

  const voltar = () => {
    window.history.pushState(null, "", "/cegs");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (notFound) return (
    <div className="main" style={{ paddingTop: 40 }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "rgba(245,240,232,.4)" }}>
        CEG não encontrada. <button onClick={voltar} style={{ background: "none", border: "none", color: "var(--laranja)", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>← voltar</button>
      </div>
    </div>
  );
  if (!cegNome) return (
    <div className="main" style={{ paddingTop: 40 }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "rgba(245,240,232,.4)" }}>carregando...</div>
    </div>
  );
  return <CegDetailView ceg={cegNome} onVoltar={voltar} guest={!user || user.guest} user={user} />;
}

function CegTab({ user, itens }) {
  const [allItens, setAllItens] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [filtro, setFiltro] = useState(!user || user.guest ? "todas" : "minhas");
  const [cegCapas, setCegCapas] = useState({});

  const guest = !user || user.guest;
  const meuCog = user?.cog;

  useEffect(() => {
    async function fetchItens() {
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
    }

    fetchItens();

    const channel = supabase
      .channel("ceg-status-watch")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "masterlist" }, fetchItens)
      .subscribe();

    supabase.from("item_fotos").select("ceg, foto_url, nome_do_item, ordem").order("ordem").order("id")
      .then(({ data }) => {
        if (!data) return;
        const capas = {};
        data.forEach(f => {
          if (!capas[f.ceg]) {
            const cfg = parseCapaCfg(f.nome_do_item);
            capas[f.ceg] = { url: f.foto_url, zoom: cfg.zoom, posY: cfg.posY };
          }
        });
        setCegCapas(capas);
      });

    return () => supabase.removeChannel(channel);
  }, []);

  if (detalhe) return <CegDetailView ceg={detalhe} onVoltar={() => { window.history.pushState(null, "", "/cegs"); setDetalhe(null); }} guest={guest} user={user} />;

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

  // Monta mapa de statuses apenas dos itens do joiner logado, por CEG
  const meuStatusPorCeg = {};
  if (meuCog) {
    (allItens || []).forEach(item => {
      if (item.cog === meuCog) {
        if (!meuStatusPorCeg[item.ceg]) meuStatusPorCeg[item.ceg] = [];
        meuStatusPorCeg[item.ceg].push(item.status || "Pré-venda");
      }
    });
  }

  // Finalizada para o joiner = todos os itens DELE nessa CEG são STATUS_FINAIS
  // Para guest = CEGs onde todos os itens (de todos) são STATUS_FINAIS
  const finalizadas = meuCog
    ? minhasCegs.filter(([ceg]) => {
        const meus = meuStatusPorCeg[ceg] || [];
        return meus.length > 0 && meus.every(s => STATUS_FINAIS.includes(s));
      })
    : todasCegs.filter(([, d]) => {
        const statuses = Object.keys(d.statusCount);
        return statuses.length > 0 && statuses.every(s => STATUS_FINAIS.includes(s));
      });

  // "Minhas" mostra só as que ainda não foram finalizadas para o joiner
  const minhasAtivas = meuCog
    ? minhasCegs.filter(([ceg]) => {
        const meus = meuStatusPorCeg[ceg] || [];
        return meus.length === 0 || !meus.every(s => STATUS_FINAIS.includes(s));
      })
    : [];

  const cegsMap = { todas: todasCegs, minhas: minhasAtivas, finalizadas };
  const cegs = cegsMap[filtro] || todasCegs;

  const filtrosBtns = [
    { id: "todas", label: `Todas (${todasCegs.length})` },
    ...(!guest ? [{ id: "minhas", label: `Minhas (${minhasAtivas.length})` }] : []),
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
              <div key={ceg} className="ceg-summary-card" style={{ borderColor: euEstou ? "rgba(183,156,255,.25)" : "", padding: cegCapas[ceg] ? 0 : undefined, overflow: "hidden" }}>
                {cegCapas[ceg] && (() => {
                  const { url, zoom = 1, posY = 50 } = cegCapas[ceg];
                  return (
                    <div style={{ width: "100%", aspectRatio: "16/7", overflow: "hidden", borderRadius: "8px 8px 0 0" }}>
                      <img src={url} alt={ceg} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `50% ${posY}%`, transform: `scale(${zoom})`, transformOrigin: `50% ${posY}%`, display: "block" }} />
                    </div>
                  );
                })()}
                <div style={{ padding: cegCapas[ceg] ? "12px 14px 14px" : undefined }}>
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
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="ceg-saiba-btn" onClick={() => { window.history.pushState(null, "", `/cegs/${slugify(ceg)}`); setDetalhe(ceg); }}>
                    saiba mais →
                  </button>
                </div>
                </div>
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

function ReportModal({ user, item, onClose, onReported }) {
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
    onReported?.(item.id);
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

function InfoCell({ info, isOpen, onToggleDrawer, onReport, isPending }) {
  return (
    <div style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
      <button className={`expand-btn ${isOpen ? "open" : ""}`} onClick={onToggleDrawer} style={{ flexShrink:0, marginTop:1 }}>▾</button>
      {isPending
        ? <span className="report-row-btn" style={{ flexShrink:0, marginTop:1, opacity:.5, cursor:"default" }}>⚑ em análise</span>
        : <button onClick={onReport} className="report-row-btn" style={{ flexShrink:0, marginTop:1 }}>⚑ Reportar erro</button>}
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
          opacity: i > idx ? 0.4 : 1 }} />
      ))}
    </div>
  );
}

const ENVIO_STEP_LABELS_SHORT = [
  "Cotação enviada", "Em cotação", "Pgto. aberto",
  "Pgto. pago", "Embalando", "Enviado!",
];

const ENVIO_STEP_DESC = [
  "Sua solicitação chegou — a GOM vai calcular o frete e te enviar a cotação.",
  "Estamos calculando o melhor frete para o seu endereço.",
  "Cotação disponível! Realize o pagamento via PIX para confirmar.",
  "Pagamento confirmado. Seu pacote será preparado em breve.",
  "Seu pacote está sendo embalado e preparado para postagem.",
  "Postado! Acompanhe pelo código de rastreio.",
];

function EnvioFlowStepper({ status }) {
  const idx   = ENVIO_STEPS.indexOf(status);
  const color = ENVIO_STEP_COLORS[status] || "rgba(245,240,232,.35)";
  return (
    <div style={{ padding:"8px 0 10px" }}>
      {/* dots + linha */}
      <div style={{ display:"flex", alignItems:"center", marginBottom:8 }}>
        {ENVIO_STEPS.map((_, i) => {
          const isPast    = i < idx;
          const isCurrent = i === idx;
          return (
            <div key={i} style={{ display:"flex", alignItems:"center", flex:1 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
                background: (isPast || isCurrent) ? color : "rgba(245,240,232,.1)",
                border: `1.5px solid ${(isPast || isCurrent) ? color : "rgba(245,240,232,.13)"}`,
                boxShadow: isCurrent ? `0 0 6px ${color}bb` : "none",
                transform: isCurrent ? "scale(1.5)" : "scale(1)",
                transition: "transform .2s",
              }} />
              {i < ENVIO_STEPS.length - 1 && (
                <div style={{ flex:1, height:1.5, borderRadius:1,
                  background: isPast ? color : "rgba(245,240,232,.07)",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* labels de todos os passos */}
      <div style={{ display:"flex", marginBottom:10 }}>
        {ENVIO_STEP_LABELS_SHORT.map((lbl, i) => {
          const isPast    = i < idx;
          const isCurrent = i === idx;
          return (
            <div key={i} style={{ flex:1, fontSize:8, fontFamily:"'DM Mono',monospace",
              textAlign:"center", lineHeight:1.3, padding:"0 1px",
              color: isCurrent ? color : isPast ? `${color}70` : "rgba(245,240,232,.18)",
              fontWeight: isCurrent ? 700 : 400,
            }}>
              {lbl}
            </div>
          );
        })}
      </div>

      {/* descrição do passo atual */}
      {ENVIO_STEP_DESC[idx] && (
        <div style={{ background:"rgba(245,240,232,.03)", border:`1px solid ${color}33`, borderRadius:6, padding:"8px 10px",
          fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.55)", lineHeight:1.6 }}>
          <span style={{ color, fontWeight:700, marginRight:6 }}>→</span>
          {ENVIO_STEP_DESC[idx]}
        </div>
      )}
    </div>
  );
}

function MasterlistTab({ user, itens, onLogin, pushAtivos = [], pendingReportIds = new Set(), onReported, avisoMasterlist = "", proximoEnvio = "", bannerEnvioVisivel = true, onOpenPagamentos, onOpenEnvio }) {
  const guest = user.guest;
  const [search, setSearch] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("tudo");
  const [ordenacao, setOrdenacao] = useState("padrao");
  const [openDrawer, setOpenDrawer] = useState(null);
  const [cegModal, setCegModal] = useState(null);
  const [reportItem, setReportItem] = useState(null);

  const [totalModal,    setTotalModal]    = useState(false);
  const [vencModal,     setVencModal]     = useState(false);
  const [galeriaModal,  setGaleriaModal]  = useState(false);
  const [minhasFotos,   setMinhasFotos]   = useState(null);
  const [pagDemandaMap,  setPagDemandaMap]  = useState({});
  const [pagConfirmMap,  setPagConfirmMap]  = useState({});
  const [pagConfirmLoaded, setPagConfirmLoaded] = useState(false);
  const [repasseMap,    setRepasseMap]    = useState({});
  useEffect(() => {
    if (user.guest) return;
    supabase.from("pagamento_demandas").select("itens, status").eq("joiner_cog", user.cog)
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        const confirm = {};
        data.forEach(d => {
          (d.itens || []).forEach(it => {
            if (!map[it.id] || d.status === "em_analise") map[it.id] = d.status;
            if (d.status === "pago") {
              const k = `${it.ceg}::${it.nome_do_item}`;
              if (!confirm[k]) confirm[k] = {};
              if (Number(it.valor_item  || 0) > 0) confirm[k].item  = true;
              if (Number(it.frete_inter || 0) > 0) confirm[k].frete = true;
              if (Number(it.taxa_rf     || 0) > 0) confirm[k].rf    = true;
            }
          });
        });
        setPagDemandaMap(map);
        setPagConfirmMap(confirm);
        setPagConfirmLoaded(true);
      });
    supabase.from("repassos").select("item_id, status").eq("joiner_cog", user.cog)
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach(d => { if (d.item_id && d.status === "pendente") map[d.item_id] = "pendente"; });
        setRepasseMap(map);
      });
  }, [user.cog]);
  const [avisos, setAvisos] = useState([]);
  const [avisosModal, setAvisosModal] = useState(false);
  const [avisosHistorico, setAvisosHistorico] = useState(null);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [acoes, setAcoes] = useState(null);
  const [loadingAcoes, setLoadingAcoes] = useState(false);
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
  }, [user.cog]);

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
    const ck = `${i.ceg}::${i.nome_do_item}`;
    const cfm = pagConfirmMap[ck] || {};
    if (i.venc_item  && isPendente(i.pago_item)  && !cfm.item)  vencDates.push({ d: parseLocalDate(i.venc_item),  label: "Item: "  + i.ceg, val: Number(i.valor_item  || 0), nome: i.nome_do_item, ceg: i.ceg, tipo: "item" });
    if (i.venc_frete && isPendente(i.pago_frete) && !cfm.frete) vencDates.push({ d: parseLocalDate(i.venc_frete), label: "Frete: " + i.ceg, val: Number(i.frete_inter || 0), nome: i.nome_do_item, ceg: i.ceg, tipo: "frete" });
    if (i.venc_rf    && isPendente(i.pago_rf)    && !cfm.rf)    vencDates.push({ d: parseLocalDate(i.venc_rf),    label: "Taxa: "  + i.ceg, val: Number(i.taxa_rf     || 0), nome: i.nome_do_item, ceg: i.ceg, tipo: "taxa RF" });
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
  const filteredAtivos      = statusFiltro === "tudo" ? filtered.filter(i => i.status !== "Enviado Nacional") : filtered;
  const filteredFinalizados = statusFiltro === "tudo" ? filtered.filter(i => i.status === "Enviado Nacional") : [];

  const tTotal = filtered.reduce((a,b) => a+Number(b.valor_item||0)+Number(b.frete_inter||0)+Number(b.taxa_rf||0), 0);
  const tPend  = filtered.reduce((a,b) => {
    const ck = `${b.ceg}::${b.nome_do_item}`;
    return a + (isPendente(b.pago_item)  && !pagConfirmMap[ck]?.item  ? Number(b.valor_item||0)  : 0)
             + (isPendente(b.pago_frete) && !pagConfirmMap[ck]?.frete ? Number(b.frete_inter||0) : 0)
             + (isPendente(b.pago_rf)    && !pagConfirmMap[ck]?.rf    ? Number(b.taxa_rf||0)     : 0);
  }, 0);
  const tMulta = itens.reduce((a,b) => {
    const ck = `${b.ceg}::${b.nome_do_item}`;
    return a + (isPendente(b.pago_item)  && pagDemandaMap[b.id] !== "em_analise" && !pagConfirmMap[ck]?.item  ? diasAtraso(b.venc_item)  : 0)
             + (isPendente(b.pago_frete) && pagDemandaMap[b.id] !== "em_analise" && !pagConfirmMap[ck]?.frete ? diasAtraso(b.venc_frete) : 0)
             + (isPendente(b.pago_rf)    && pagDemandaMap[b.id] !== "em_analise" && !pagConfirmMap[ck]?.rf    ? diasAtraso(b.venc_rf)    : 0);
  }, 0);


  const temPendente = !guest && pendV > 0;
  const temAntigomEmAberto = !guest && itens.some(i =>
    i.status === "ANTIGOM" && (
      (i.pago_item  === false && Number(i.valor_item  || 0) > 0) ||
      (i.pago_frete === false && Number(i.frete_inter || 0) > 0) ||
      (i.pago_rf    === false && Number(i.taxa_rf     || 0) > 0)
    )
  );
  const nEnvioLiberado = !guest ? itens.filter(i => i.status === "Envio Liberado").length : 0;

  if (user.pre_cadastro) return (
    <div className="main">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">anticeg · visão completa</div>
          <div className="page-title">MASTER<span>LIST</span></div>
        </div>
        <div className="page-header-right">
          <div className="greeting">{user.nome || user.cog}</div>
          <div className="greeting-sub">perfil em aprovação</div>
        </div>
      </div>
      <div style={{ marginTop: 32, textAlign: "center", fontFamily: "'DM Mono',monospace" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 14, color: "var(--lilas)", marginBottom: 8 }}>Claims indisponíveis</div>
        <div style={{ fontSize: 12, color: "rgba(245,240,232,.4)", lineHeight: 1.7, maxWidth: 280, margin: "0 auto" }}>
          Seu perfil está aguardando aprovação da admin. Assim que aprovado, seus itens aparecerão aqui.
        </div>
      </div>
    </div>
  );

  return (
    <>
      {reportItem && <ReportModal user={user} item={reportItem} onClose={() => setReportItem(null)} onReported={onReported} />}
    <div className="main">
      {temAntigomEmAberto && (
        <div className="notif-pagamento">
          ⚠ Verifique os pagamentos em aberto para liberar seu envio nacional
        </div>
      )}
      {nEnvioLiberado > 0 && bannerEnvioVisivel && (
        <div style={{ background:"rgba(100,181,246,.07)", border:"1px solid rgba(100,181,246,.25)", borderRadius:8, padding:"10px 16px", marginBottom:12, fontSize:12, fontFamily:"'DM Mono',monospace", color:"#64B5F6", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span>📬</span>
          <span style={{ flex:1 }}>
            {nEnvioLiberado === 1 ? "1 item pronto" : `${nEnvioLiberado} itens prontos`} para Envio Nacional
            {proximoEnvio ? <> · <strong>{proximoEnvio}</strong></> : " · aguarde a abertura do forms"}
          </span>
          {onOpenEnvio && (
            <button onClick={onOpenEnvio} style={{ background:"rgba(100,181,246,.15)", border:"1px solid rgba(100,181,246,.4)", borderRadius:5, color:"#64B5F6", fontSize:11, fontFamily:"'DM Mono',monospace", padding:"3px 10px", cursor:"pointer", whiteSpace:"nowrap" }}>
              clique aqui →
            </button>
          )}
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
          {!guest && (
            <button onClick={async () => {
              setGaleriaModal(true);
              if (minhasFotos !== null) return;
              const meusCegs = [...new Set(itens.map(i => i.ceg))];
              const { data } = await supabase.from("item_fotos").select("*").in("ceg", meusCegs).gte("ordem", 0).order("ceg").order("ordem").order("id");
              if (!data) { setMinhasFotos([]); return; }
              const meusTipos = itens.map(i => ({ ceg: i.ceg, tipo: parseMembro(i.nome_do_item).tipo.toLowerCase() }));
              const filtradas = data.filter(f => {
                const fTipo = parseMembro(f.nome_do_item).tipo.toLowerCase();
                return meusTipos.some(m => m.ceg === f.ceg && (m.tipo === fTipo || m.tipo.includes(fTipo) || fTipo.includes(m.tipo)));
              });
              setMinhasFotos(filtradas);
            }} style={{ marginTop:8, background:"rgba(201,168,240,.1)", border:"1px solid rgba(201,168,240,.3)", color:"#C9A8F0", borderRadius:6, padding:"6px 14px", fontSize:"var(--fs-xs)", fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".5px" }}>
              ⊟ minha galeria
            </button>
          )}
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card sum-card-link" onClick={onOpenPagamentos} style={{ cursor:"pointer", display:"flex", flexDirection:"column", justifyContent:"center" }}>
          <div className="sum-value orange">FORMS DE PAGAMENTO</div>
          <div className="sum-sub" style={{ marginTop:4 }}>clique aqui →</div>
        </div>
        {!guest && (
          <div className="sum-card" onClick={() => setTotalModal(true)} style={{ borderColor: tMulta > 0 ? "rgba(255,107,107,.25)" : undefined, cursor:"pointer" }}>
            <div className="sum-label">Total a pagar</div>
            <div className="sum-value" style={{ color: tMulta > 0 ? "#ff6b6b" : "var(--lilas)" }}>
              R${fmtBRL(tPend + tMulta)}
            </div>
            {tMulta > 0
              ? <div className="sum-sub" style={{ color:"rgba(255,107,107,.7)" }}>R${fmtBRL(tPend)} + R${fmtBRL(tMulta)} multa</div>
              : <div className="sum-sub">ver detalhes →</div>
            }
          </div>
        )}
        <div className="sum-card" onClick={() => !guest && nextVenc && setVencModal(true)} style={{ cursor: !guest && nextVenc ? "pointer" : undefined }}>
          <div className="sum-label">Próx. vencimento</div>
          <div className="sum-value yellow">{!guest && nextVenc ? `${String(nextVenc.d.getDate()).padStart(2,"0")}/${String(nextVenc.d.getMonth()+1).padStart(2,"0")}` : "—"}</div>
          <div className="sum-sub">{!guest && nextVenc ? nextVenc.label : (!guest ? "sem vencimento" : "—")}</div>
          {!guest && nextVenc && <div className="sum-sub" style={{ marginTop:4, color:"rgba(245,240,232,.35)" }}>ver calendário →</div>}
        </div>
        <button onClick={() => setAvisosModal(true)} className="sum-card" style={{
          border:`1px solid ${avisos.length > 0 ? "rgba(201,168,240,.3)" : "rgba(245,240,232,.08)"}`, textAlign:"left", cursor:"pointer",
          display:"flex", flexDirection:"column", justifyContent:"center"
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div className="sum-value" style={{ color:"#C9A8F0" }}>MURAL DE AVISOS</div>
            {avisos.length > 0 && <span style={{ background:"#C9A8F0", color:"#111", borderRadius:99, fontSize:9, fontWeight:700, padding:"1px 6px", lineHeight:1.5, flexShrink:0 }}>{avisos.length}</span>}
          </div>
          {avisos.length > 0 ? (
            <div className="sum-sub" style={{ marginTop:4 }}>
              {avisos.length > 1 ? `${avisos.length} avisos não lidos` : "1 aviso não lido"}
            </div>
          ) : (
            <div className="sum-sub" style={{ marginTop:4 }}>sem avisos no momento</div>
          )}
        </button>
      </div>

      {galeriaModal && (
        <div className="modal-overlay" onClick={() => setGaleriaModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:680, width:"95vw", display:"flex", flexDirection:"column", maxHeight:"90vh", overflow:"hidden", padding:0 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid rgba(245,240,232,.07)", flexShrink:0 }}>
              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:1, color:"var(--offwhite)" }}>
                  MINHA <span style={{ color:"#C9A8F0" }}>GALERIA</span>
                </div>
                <div style={{ fontSize:11, color:"rgba(245,240,232,.45)", marginTop:2, fontFamily:"'DM Mono',monospace" }}>
                  {minhasFotos === null ? "carregando..." : `${minhasFotos.length} foto${minhasFotos.length !== 1 ? "s" : ""} dos seus itens`}
                </div>
              </div>
              <button onClick={() => setGaleriaModal(false)} style={{ background:"none", border:"none", color:"rgba(245,240,232,.52)", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ overflowY:"auto", flex:1, padding:"20px 24px 24px" }}>
              {minhasFotos === null ? (
                <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", fontSize:12 }}>carregando...</div>
              ) : minhasFotos.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", fontSize:12 }}>nenhuma foto cadastrada para os seus itens</div>
              ) : (
                <>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"rgba(245,240,232,.3)", marginBottom:14, lineHeight:1.6 }}>
                    caso algum item não apareça aqui, é porque ele ainda não tem foto cadastrada.
                  </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))", gap:12 }}>
                  {minhasFotos.map(f => {
                    const itemDoJoiner = itens.find(i => {
                      if (i.ceg !== f.ceg) return false;
                      const fTipo = parseMembro(f.nome_do_item).tipo.toLowerCase();
                      const iTipo = parseMembro(i.nome_do_item).tipo.toLowerCase();
                      return iTipo === fTipo || iTipo.includes(fTipo) || fTipo.includes(iTipo);
                    });
                    const { membro } = itemDoJoiner ? parseMembro(itemDoJoiner.nome_do_item) : {};
                    return (
                      <div key={f.id} style={{ borderRadius:10, overflow:"hidden", background:"#111", border:"1px solid rgba(245,240,232,.08)" }}>
                        <img src={f.foto_url} alt={f.nome_do_item} style={{ width:"100%", aspectRatio:"3/4", objectFit:"cover", display:"block" }} />
                        <div style={{ padding:"8px 10px 10px" }}>
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"rgba(245,240,232,.35)", letterSpacing:"0.5px", marginBottom:2 }}>{f.ceg}</div>
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"var(--offwhite)", lineHeight:1.4 }}>{f.nome_do_item}</div>
                          {membro && <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"#C9A8F0", marginTop:3 }}>{membro}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {totalModal && (() => {
        const linhas = itens.map(i => {
          const ck = `${i.ceg}::${i.nome_do_item}`;
          const vItem  = isPendente(i.pago_item)  && !pagConfirmMap[ck]?.item  ? Number(i.valor_item  || 0) : 0;
          const vFrete = isPendente(i.pago_frete) && !pagConfirmMap[ck]?.frete ? Number(i.frete_inter || 0) : 0;
          const vRf    = isPendente(i.pago_rf)    && !pagConfirmMap[ck]?.rf    ? Number(i.taxa_rf     || 0) : 0;
          const mItem  = vItem  > 0 ? diasAtraso(i.venc_item)  : 0;
          const mFrete = vFrete > 0 ? diasAtraso(i.venc_frete) : 0;
          const mRf    = vRf    > 0 ? diasAtraso(i.venc_rf)    : 0;
          const diasMax = Math.max(mItem > 0 ? diasAtraso(i.venc_item) : 0, mFrete > 0 ? diasAtraso(i.venc_frete) : 0, mRf > 0 ? diasAtraso(i.venc_rf) : 0);
          const total  = vItem + vFrete + vRf + mItem + mFrete + mRf;
          return total > 0 ? { i, vItem, vFrete, vRf, mItem, mFrete, mRf, diasMax, total } : null;
        }).filter(Boolean);
        const atrasados = linhas.filter(r => r.diasMax > 0).sort((a, b) => b.diasMax - a.diasMax);
        const noPrazo   = linhas.filter(r => r.diasMax === 0);
        const temMulta = linhas.some(r => r.mItem + r.mFrete + r.mRf > 0);
        const thS = { fontSize:8, letterSpacing:"1.2px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", textAlign:"right", paddingBottom:8 };
        const tdS = { fontSize:12, fontFamily:"'DM Mono',monospace", textAlign:"right", color:"rgba(245,240,232,.6)" };
        const dash = <span style={{ color:"rgba(245,240,232,.2)" }}>—</span>;
        const renderLinha = (row, idx) => {
          const multa = row.mItem + row.mFrete + row.mRf;
          const hasMulta = multa > 0;
          return (
            <tr key={idx} style={{ borderTop:"1px solid rgba(245,240,232,.06)" }}>
              <td style={{ padding:"10px 8px 10px 0", verticalAlign:"middle" }}>
                <div style={{ fontSize:12, color: hasMulta ? "#ff6b6b" : "var(--offwhite)", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.i.nome_do_item}</div>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>{row.i.ceg}</span>
                  {hasMulta && <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"#ff6b6b", background:"rgba(255,107,107,.1)", border:"1px solid rgba(255,107,107,.2)", borderRadius:4, padding:"1px 6px" }}>{row.diasMax}d em atraso</span>}
                </div>
                {(() => {
                  const tags = [
                    row.vItem  > 0 && row.i.venc_item  && diasAtraso(row.i.venc_item)  === 0 && ["item",  row.i.venc_item],
                    row.vFrete > 0 && row.i.venc_frete && diasAtraso(row.i.venc_frete) === 0 && ["frete", row.i.venc_frete],
                    row.vRf    > 0 && row.i.venc_rf    && diasAtraso(row.i.venc_rf)    === 0 && ["RF",    row.i.venc_rf],
                  ].filter(Boolean);
                  if (!tags.length) return null;
                  return (
                    <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap" }}>
                      {tags.map(([label, v]) => (
                        <span key={label} style={{ fontSize:9, color:"rgba(240,192,64,.85)", fontFamily:"'DM Mono',monospace", background:"rgba(240,192,64,.07)", border:"1px solid rgba(240,192,64,.2)", borderRadius:3, padding:"1px 6px", whiteSpace:"nowrap" }}>
                          {label} {fmtVenc(v)}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </td>
              <td style={{ ...tdS, padding:"10px 0", verticalAlign:"middle" }}>{row.vItem > 0 ? `R$${fmtBRL(row.vItem)}` : dash}</td>
              <td style={{ ...tdS, padding:"10px 0", verticalAlign:"middle" }}>{row.vFrete > 0 ? `R$${fmtBRL(row.vFrete)}` : dash}</td>
              <td style={{ ...tdS, padding:"10px 0", verticalAlign:"middle" }}>{row.vRf > 0 ? `R$${fmtBRL(row.vRf)}` : dash}</td>
              {temMulta && <td style={{ ...tdS, color: hasMulta ? "rgba(255,107,107,.8)" : undefined, padding:"10px 0", verticalAlign:"middle" }}>{hasMulta ? `R$${fmtBRL(multa)}` : dash}</td>}
              <td style={{ ...tdS, color: hasMulta ? "#ff6b6b" : "#BAFF39", fontWeight:700, padding:"10px 0", verticalAlign:"middle" }}>R${fmtBRL(row.total)}</td>
            </tr>
          );
        };
        const tHead = (
          <thead>
            <tr>
              <th style={{ ...thS, textAlign:"left", padding:"16px 0 8px" }}>Item</th>
              <th style={{ ...thS, padding:"16px 0 8px" }}>Item R$</th>
              <th style={{ ...thS, padding:"16px 0 8px" }}>Frete</th>
              <th style={{ ...thS, padding:"16px 0 8px" }}>RF</th>
              {temMulta && <th style={{ ...thS, color:"rgba(255,107,107,.5)", padding:"16px 0 8px" }}>Multa</th>}
              <th style={{ ...thS, padding:"16px 0 8px" }}>Total</th>
            </tr>
          </thead>
        );
        const tColgroup = (
          <colgroup>
            <col style={{ width:"auto" }} />
            <col style={{ width:72 }} /><col style={{ width:72 }} /><col style={{ width:52 }} />
            {temMulta && <col style={{ width:66 }} />}
            <col style={{ width:76 }} />
          </colgroup>
        );
        return (
          <div className="modal-overlay" onClick={() => setTotalModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:560, display:"flex", flexDirection:"column", maxHeight:"85vh", overflow:"hidden", padding:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid rgba(245,240,232,.07)", flexShrink:0 }}>
                <div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:1, color:"var(--offwhite)" }}>
                    PENDÊNCIAS <span style={{ color: tMulta > 0 ? "#ff6b6b" : "var(--lilas)" }}>R${fmtBRL(tPend + tMulta)}</span>
                  </div>
                  <div style={{ fontSize:11, color:"rgba(245,240,232,.45)", marginTop:2 }}>{linhas.length} item{linhas.length !== 1 ? "ns" : ""} em aberto</div>
                </div>
                <button onClick={() => setTotalModal(false)} style={{ background:"none", border:"none", color:"rgba(245,240,232,.52)", fontSize:20, cursor:"pointer" }}>✕</button>
              </div>
              <div style={{ overflowY:"auto", flex:1, padding:"0 24px 24px" }}>
                {linhas.length === 0 ? (
                  <div style={{ fontSize:13, color:"rgba(245,240,232,.35)", textAlign:"center", padding:"32px 0" }}>Nenhuma pendência no momento.</div>
                ) : (
                  <>
                    {atrasados.length > 0 && (
                      <>
                        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 0 6px" }}>
                          <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", fontWeight:700, color:"#ff6b6b", letterSpacing:"1.5px", textTransform:"uppercase" }}>Em atraso</span>
                          <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"rgba(255,107,107,.4)", background:"rgba(255,107,107,.08)", borderRadius:10, padding:"1px 8px" }}>{atrasados.length}</span>
                          <div style={{ flex:1, height:"1px", background:"rgba(255,107,107,.15)" }} />
                        </div>
                        <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed" }}>
                          {tColgroup}{tHead}
                          <tbody>{atrasados.map(renderLinha)}</tbody>
                        </table>
                      </>
                    )}
                    {noPrazo.length > 0 && (
                      <>
                        {atrasados.length > 0 && (
                          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 0 6px" }}>
                            <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.3)", letterSpacing:"1.5px", textTransform:"uppercase" }}>No prazo</span>
                            <div style={{ flex:1, height:"1px", background:"rgba(245,240,232,.06)" }} />
                          </div>
                        )}
                        <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed" }}>
                          {tColgroup}{atrasados.length === 0 && tHead}
                          <tbody>{noPrazo.map(renderLinha)}</tbody>
                        </table>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {vencModal && (() => {
        const futuros = vencDates.filter(v => v.d >= today).sort((a,b) => a.d - b.d);
        const atrasados = vencDates.filter(v => v.d < today).sort((a,b) => a.d - b.d);
        const fmtDia = d => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
        const fmtDiaSemana = d => d.toLocaleDateString("pt-BR", { weekday:"long" });
        const agruparPorDia = lista => {
          const grupos = {};
          lista.forEach(v => {
            const k = v.d.toISOString().slice(0,10);
            if (!grupos[k]) grupos[k] = { d: v.d, itens: [] };
            grupos[k].itens.push(v);
          });
          return Object.values(grupos);
        };
        const gruposFuturos = agruparPorDia(futuros);
        const gruposAtrasados = agruparPorDia(atrasados);
        return (
          <div className="modal-overlay" onClick={() => setVencModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:480, display:"flex", flexDirection:"column", maxHeight:"85vh", overflow:"hidden", padding:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid rgba(245,240,232,.07)", flexShrink:0 }}>
                <div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:1, color:"var(--offwhite)" }}>
                    CALENDÁRIO <span style={{ color:"#F0C040" }}>DE PAGAMENTOS</span>
                  </div>
                  <div style={{ fontSize:11, color:"rgba(245,240,232,.45)", marginTop:2 }}>
                    {futuros.length} pagamento{futuros.length !== 1 ? "s" : ""} por vir
                    {atrasados.length > 0 && <span style={{ color:"rgba(255,107,107,.7)", marginLeft:8 }}>· {atrasados.length} atrasado{atrasados.length !== 1 ? "s" : ""}</span>}
                  </div>
                </div>
                <button onClick={() => setVencModal(false)} style={{ background:"none", border:"none", color:"rgba(245,240,232,.52)", fontSize:20, cursor:"pointer" }}>✕</button>
              </div>
              <div style={{ overflowY:"auto", flex:1, padding:"16px 24px 24px", display:"flex", flexDirection:"column", gap:0 }}>
                {atrasados.length > 0 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:"1.5px", color:"rgba(255,107,107,.6)", textTransform:"uppercase", marginBottom:10 }}>atrasados</div>
                    {gruposAtrasados.map(g => (
                      <div key={g.d.toISOString()} style={{ marginBottom:12, background:"rgba(255,107,107,.04)", border:"1px solid rgba(255,107,107,.15)", borderRadius:8, overflow:"hidden" }}>
                        <div style={{ padding:"8px 14px", borderBottom:"1px solid rgba(255,107,107,.1)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:1, color:"#ff6b6b" }}>{fmtDia(g.d)}</span>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"rgba(255,107,107,.5)", textTransform:"capitalize" }}>{fmtDiaSemana(g.d)}</span>
                        </div>
                        {g.itens.map((v,i) => (
                          <div key={i} style={{ padding:"8px 14px", borderBottom:"1px solid rgba(255,107,107,.07)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                            <div>
                              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"var(--offwhite)", lineHeight:1.4 }}>{v.nome}</div>
                              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"rgba(255,107,107,.5)", marginTop:1 }}>{v.tipo} · {v.ceg}</div>
                            </div>
                            {v.val > 0 && <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#ff6b6b", whiteSpace:"nowrap" }}>R${fmtBRL(v.val)}</div>}
                          </div>
                        ))}
                        {g.itens.reduce((a,v) => a+v.val, 0) > 0 && (
                          <div style={{ padding:"7px 14px", background:"rgba(255,107,107,.06)", display:"flex", justifyContent:"flex-end" }}>
                            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(255,107,107,.7)" }}>total R${fmtBRL(g.itens.reduce((a,v) => a+v.val, 0))}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {gruposFuturos.length === 0 && atrasados.length === 0 && (
                  <div style={{ fontSize:13, color:"rgba(245,240,232,.35)", textAlign:"center", padding:"32px 0" }}>Nenhum vencimento em aberto.</div>
                )}
                {gruposFuturos.map(g => (
                  <div key={g.d.toISOString()} style={{ marginBottom:12, border:"1px solid rgba(245,240,232,.08)", borderRadius:8, overflow:"hidden" }}>
                    <div style={{ padding:"8px 14px", background:"rgba(240,192,64,.06)", borderBottom:"1px solid rgba(245,240,232,.07)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:1, color:"#F0C040" }}>{fmtDia(g.d)}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"rgba(240,192,64,.5)", textTransform:"capitalize" }}>{fmtDiaSemana(g.d)}</span>
                    </div>
                    {g.itens.map((v,i) => (
                      <div key={i} style={{ padding:"8px 14px", borderBottom:"1px solid rgba(245,240,232,.05)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                        <div>
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"var(--offwhite)", lineHeight:1.4 }}>{v.nome}</div>
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"rgba(245,240,232,.35)", marginTop:1 }}>{v.tipo} · {v.ceg}</div>
                        </div>
                        {v.val > 0 && <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"rgba(240,192,64,.85)", whiteSpace:"nowrap" }}>R${fmtBRL(v.val)}</div>}
                      </div>
                    ))}
                    {g.itens.reduce((a,v) => a+v.val, 0) > 0 && (
                      <div style={{ padding:"7px 14px", background:"rgba(240,192,64,.04)", display:"flex", justifyContent:"flex-end" }}>
                        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(240,192,64,.6)" }}>total R${fmtBRL(g.itens.reduce((a,v) => a+v.val, 0))}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {avisosModal && (
        <div className="modal-overlay" onClick={() => setAvisosModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:480, display:"flex", flexDirection:"column", maxHeight:"85vh", overflow:"hidden", padding:0 }}>
            {/* Header fixo */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid rgba(245,240,232,.07)", flexShrink:0 }}>
              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:1, color:"var(--offwhite)" }}>
                  MURAL DE <span style={{ color:"#C9A8F0" }}>AVISOS</span>
                </div>
                <div style={{ fontSize:11, color:"rgba(245,240,232,.58)", marginTop:2 }}>{avisos.length} aviso{avisos.length !== 1 ? "s" : ""} não lido{avisos.length !== 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => setAvisosModal(false)} style={{ background:"none", border:"none", color:"rgba(245,240,232,.52)", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            {/* Conteúdo rolável */}
            <div className="avisos-scroll" style={{ overflowY:"auto", flex:1, padding:"16px 24px 24px" }}>
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
                <button onClick={async () => { await Promise.all(avisos.map(a => marcarLido(a.id))); setAvisosModal(false); }} style={{
                  background:"rgba(201,168,240,.08)", border:"1px solid rgba(201,168,240,.2)",
                  color:"rgba(201,168,240,.6)", borderRadius:8, padding:"10px",
                  fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".05em"
                }}>✓ Marcar todos como lido</button>
              )}
            </div>

            {/* Histórico */}
            <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid rgba(245,240,232,.06)" }}>
              {avisosHistorico === null ? (
                <button onClick={async () => {
                  setLoadingHistorico(true);
                  const q = supabase.from("pushes").select("*").eq("active", false).order("created_at", { ascending: false });
                  if (!user.guest) q.or(`joiner_cog.is.null,joiner_cog.eq.${user.cog}`);
                  const { data } = await q;
                  setAvisosHistorico(data || []);
                  setLoadingHistorico(false);
                }} style={{ background:"none", border:"none", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer", padding:0, letterSpacing:".03em" }}>
                  {loadingHistorico ? "carregando..." : "↓ ver avisos anteriores"}
                </button>
              ) : avisosHistorico.length === 0 ? (
                <div style={{ fontSize:11, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace" }}>Nenhum aviso anterior.</div>
              ) : (
                <>
                  <div style={{ fontSize:9, color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase", marginBottom:10 }}>Avisos anteriores</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {avisosHistorico.map(a => (
                      <div key={a.id} style={{ background:"rgba(245,240,232,.03)", border:"1px solid rgba(245,240,232,.06)", borderRadius:8, padding:"12px 14px" }}>
                        <div style={{ fontSize:9, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>
                          {new Date(a.created_at).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                        </div>
                        <div style={{ fontSize:12, color:"rgba(245,240,232,.55)", lineHeight:1.75, fontFamily:"'DM Mono',monospace" }}>{a.message}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Histórico de ações */}
            {!user.guest && !user.pre_cadastro && (
              <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid rgba(245,240,232,.06)" }}>
                {acoes === null ? (
                  <button onClick={async () => {
                    setLoadingAcoes(true);
                    const fmtDt = s => new Date(s).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
                    const ev = [];
                    const [reps, envios, mercs, fbs] = await Promise.all([
                      supabase.from("reports").select("id,created_at,nome_item,ceg").eq("joiner_cog", user.cog).order("created_at", { ascending:false }).limit(30),
                      supabase.from("envio_solicitacoes").select("id,created_at,status,itens").eq("joiner_cog", user.cog).order("created_at", { ascending:false }).limit(30),
                      supabase.from("mercari_pedidos").select("id,created_at,valor_jpy_total,valor_brl_total,itens,status").eq("joiner_cog", user.cog).order("created_at", { ascending:false }).limit(30),
                      supabase.from("feedbacks").select("id,created_at,mensagem").eq("joiner_cog", user.cog).order("created_at", { ascending:false }).limit(30),
                    ]);
                    (reps.data||[]).forEach(r => ev.push({ id:"r"+r.id, at:r.created_at, icon:"🐛", cor:"rgba(255,107,107,.7)", label:"Report enviado", sub: r.nome_item ? `${r.nome_item}${r.ceg ? " · "+r.ceg : ""}` : null }));
                    (envios.data||[]).forEach(e => {
                      const nIt = Array.isArray(e.itens) ? e.itens.length : 0;
                      ev.push({ id:"e"+e.id, at:e.created_at, icon:"📦", cor:"rgba(100,181,246,.7)", label:"Solicitação de envio", sub: [nIt>0?`${nIt} item${nIt!==1?"s":""}`:null, e.status?e.status.charAt(0).toUpperCase()+e.status.slice(1):null].filter(Boolean).join(" · ")||null });
                    });
                    (mercs.data||[]).forEach(m => {
                      const nItens = Array.isArray(m.itens) ? m.itens.length : 0;
                      ev.push({ id:"m"+m.id, at:m.created_at, icon:"🎌", cor:"rgba(240,192,64,.7)", label:"Pedido Mercari", sub: `${nItens} item${nItens!==1?"s":""} · ¥${(m.valor_jpy_total||0).toLocaleString("pt-BR")}${m.valor_brl_total?" · R$ "+parseFloat(m.valor_brl_total).toLocaleString("pt-BR",{minimumFractionDigits:2}):""}` });
                    });
                    (fbs.data||[]).forEach(f => ev.push({ id:"f"+f.id, at:f.created_at, icon:"💬", cor:"rgba(186,255,57,.6)", label:"Feedback enviado", sub: f.mensagem ? f.mensagem.slice(0,60)+(f.mensagem.length>60?"…":"") : null }));
                    ev.sort((a,b) => new Date(b.at)-new Date(a.at));
                    setAcoes(ev);
                    setLoadingAcoes(false);
                  }} style={{ background:"none", border:"none", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer", padding:0, letterSpacing:".03em" }}>
                    {loadingAcoes ? "carregando..." : "↓ ver histórico de ações"}
                  </button>
                ) : acoes.length === 0 ? (
                  <div style={{ fontSize:11, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace" }}>Nenhuma ação registrada ainda.</div>
                ) : (
                  <>
                    <div style={{ fontSize:9, color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase", marginBottom:10 }}>Histórico de ações</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {acoes.map(a => (
                        <div key={a.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px", background:"rgba(245,240,232,.02)", border:"1px solid rgba(245,240,232,.05)", borderRadius:8 }}>
                          <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>{a.icon}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, color:a.cor, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{a.label}</div>
                            {a.sub && <div style={{ fontSize:11, color:"rgba(245,240,232,.45)", fontFamily:"'DM Mono',monospace", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.sub}</div>}
                          </div>
                          <div style={{ fontSize:9, color:"rgba(245,240,232,.22)", fontFamily:"'DM Mono',monospace", flexShrink:0, marginTop:2, whiteSpace:"nowrap" }}>
                            {new Date(a.at).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {!guest && pagConfirmLoaded && qtdAtrasados >= 3 && (
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
                <Fragment key={item.id}>
                  <tr style={item.info_adicionais?.toUpperCase().includes("REEMBOLSO") ? { outline:"2px solid rgba(220,50,50,.55)", outlineOffset:"-2px" } : {}}>
                    <td className="td-ceg"><button className="ceg-btn" onClick={() => setCegModal(item.ceg)}>{item.ceg}</button></td>
                    <td><div className="item-title"><InfoContent info={item.nome_do_item} /></div></td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.valor_item} status={item.pago_item} vencimento={item.venc_item} adminPreview={isAdminUser(user)} emAnalise={pagDemandaMap[item.id]==="em_analise"} confirmado={pagConfirmMap[`${item.ceg}::${item.nome_do_item}`]?.item} />}</td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.frete_inter} status={item.pago_frete} vencimento={item.venc_frete} adminPreview={isAdminUser(user)} emAnalise={pagDemandaMap[item.id]==="em_analise"} confirmado={pagConfirmMap[`${item.ceg}::${item.nome_do_item}`]?.frete} />}</td>
                    <td>{guest ? <span className="zero-val">—</span> : (Number(item.taxa_rf) > 0 ? <ValCell val={item.taxa_rf} status={item.pago_rf} vencimento={item.venc_rf} adminPreview={isAdminUser(user)} emAnalise={pagDemandaMap[item.id]==="em_analise"} confirmado={pagConfirmMap[`${item.ceg}::${item.nome_do_item}`]?.rf} /> : <span className="zero-val">—</span>)}</td>
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
                        {(() => {
                          const pStatus = pagDemandaMap[item.id];
                          if (!pStatus) return null;
                          return (
                            <span style={{ display:"inline-block", marginTop:4, fontSize:8, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".06em", padding:"2px 7px", borderRadius:4, border: pStatus === "pago" ? "1px solid rgba(186,255,57,.35)" : "1px solid rgba(167,139,250,.6)", color: pStatus === "pago" ? "#BAFF39" : "#A78BFA", background: pStatus === "pago" ? "rgba(186,255,57,.06)" : "rgba(167,139,250,.15)" }}>
                              {pStatus === "pago" ? "✓ pago" : "◉ em análise"}
                            </span>
                          );
                        })()}
                        {repasseMap[item.id] === "pendente" && (
                          <span style={{ display:"inline-block", marginTop:4, fontSize:8, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".06em", padding:"2px 7px", borderRadius:4, border:"1px solid rgba(255,92,26,.5)", color:"#FF5C1A", background:"rgba(255,92,26,.08)" }}>
                            ⇄ repasse em análise
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <InfoCell
                        info={item.info_adicionais}
                        isOpen={isOpen}
                        onToggleDrawer={() => setOpenDrawer(isOpen ? null : item.id)}
                        onReport={() => setReportItem(item)}
                        isPending={pendingReportIds.has(item.id)}
                      />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="drawer-row">
                      <td colSpan={7}><Timeline activeIdx={ai} /></td>
                    </tr>
                  )}
                </Fragment>
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
                <Fragment key={item.id}>
                  <tr className="row-finalizado">
                    <td className="td-ceg"><button className="ceg-btn" onClick={() => setCegModal(item.ceg)}>{item.ceg}</button></td>
                    <td><div className="item-title"><InfoContent info={item.nome_do_item} /></div></td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.valor_item} status={item.pago_item} vencimento={item.venc_item} adminPreview={isAdminUser(user)} emAnalise={pagDemandaMap[item.id]==="em_analise"} confirmado={pagConfirmMap[`${item.ceg}::${item.nome_do_item}`]?.item} />}</td>
                    <td>{guest ? <span className="zero-val">•••</span> : <ValCell val={item.frete_inter} status={item.pago_frete} vencimento={item.venc_frete} adminPreview={isAdminUser(user)} emAnalise={pagDemandaMap[item.id]==="em_analise"} confirmado={pagConfirmMap[`${item.ceg}::${item.nome_do_item}`]?.frete} />}</td>
                    <td>{guest ? <span className="zero-val">—</span> : (Number(item.taxa_rf) > 0 ? <ValCell val={item.taxa_rf} status={item.pago_rf} vencimento={item.venc_rf} adminPreview={isAdminUser(user)} emAnalise={pagDemandaMap[item.id]==="em_analise"} confirmado={pagConfirmMap[`${item.ceg}::${item.nome_do_item}`]?.rf} /> : <span className="zero-val">—</span>)}</td>
                    <td><StatusChip status={item.status} /></td>
                    <td><InfoCell info={item.info_adicionais} isOpen={isOpen} onToggleDrawer={() => setOpenDrawer(isOpen ? null : item.id)} onReport={() => setReportItem(item)} isPending={pendingReportIds.has(item.id)} /></td>
                  </tr>
                  {isOpen && <tr className="drawer-row"><td colSpan={7}><Timeline activeIdx={ai} /></td></tr>}
                </Fragment>
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
          const cfm       = pagConfirmMap[`${item.ceg}::${item.nome_do_item}`] || {};
          const pendItem  = !guest && isPendente(item.pago_item)  && Number(item.valor_item) > 0  && !cfm.item;
          const pendFrete = !guest && isPendente(item.pago_frete) && Number(item.frete_inter) > 0 && !cfm.frete;
          const pendRf    = !guest && isPendente(item.pago_rf)    && Number(item.taxa_rf) > 0     && !cfm.rf;
          const temPendente = pendItem || pendFrete || pendRf;
          const totalPend = (pendItem  ? Number(item.valor_item||0)  : 0)
                          + (pendFrete ? Number(item.frete_inter||0) : 0)
                          + (pendRf    ? Number(item.taxa_rf||0)     : 0);
          const emAnalise = pagDemandaMap[item.id] === "em_analise";
          const multaItem = (!emAnalise && pendItem  ? diasAtraso(item.venc_item)  : 0)
                          + (!emAnalise && pendFrete ? diasAtraso(item.venc_frete) : 0)
                          + (!emAnalise && pendRf    ? diasAtraso(item.venc_rf)    : 0);
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
              {repasseMap[item.id] === "pendente" && (
                <div style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 0 2px", marginBottom:2 }}>
                  <span style={{ fontSize:8, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".06em", padding:"2px 8px", borderRadius:4, border:"1px solid rgba(255,92,26,.5)", color:"#FF5C1A", background:"rgba(255,92,26,.08)" }}>
                    ⇄ repasse em análise
                  </span>
                </div>
              )}
              {!guest && (
                <div className="ml-card-vals">
                  {Number(item.valor_item) > 0 && <div className="ml-val-row"><span className="ml-val-label">item</span><ValCell val={item.valor_item} status={item.pago_item} vencimento={item.venc_item} emAnalise={pagDemandaMap[item.id]==="em_analise"} confirmado={pagConfirmMap[`${item.ceg}::${item.nome_do_item}`]?.item} /></div>}
                  {Number(item.frete_inter) > 0 && <div className="ml-val-row"><span className="ml-val-label">frete</span><ValCell val={item.frete_inter} status={item.pago_frete} vencimento={item.venc_frete} emAnalise={pagDemandaMap[item.id]==="em_analise"} confirmado={pagConfirmMap[`${item.ceg}::${item.nome_do_item}`]?.frete} /></div>}
                  {Number(item.taxa_rf) > 0 && <div className="ml-val-row"><span className="ml-val-label">taxa RF</span><ValCell val={item.taxa_rf} status={item.pago_rf} vencimento={item.venc_rf} emAnalise={pagDemandaMap[item.id]==="em_analise"} confirmado={pagConfirmMap[`${item.ceg}::${item.nome_do_item}`]?.rf} /></div>}
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
    </>
  );
}

function FeedbackForm({ user, defaultTipo, onSent }) {
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
    onSent?.();
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
  { id:"envios",       label:"Envios" },
  { id:"reports",      label:"Reports" },
  { id:"cadastros",    label:"Cadastros" },
  { id:"atualizacoes", label:"Atualizações" },
  { id:"demandas",     label:"Demandas + Repassos" },
  { id:"pagamentos",   label:"Pagamentos" },
  { id:"disponiveis",  label:"Disponíveis" },
  { id:"blocklist",    label:"Blocklist" },
  { id:"geral",        label:"Config / Geral" },
];

const DEFAULT_STAFF_ACESSOS = ["cadastros","pagamentos","disponiveis","blocklist","reports","envios","demandas","badges"];

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

function PerfilTab({ user, onUpdate, owner = false, openPagamentosSignal = 0, initialSubTab = null, onSubTabChange }) {
  const [winW, setWinW] = useState(window.innerWidth);
  useEffect(() => { const h = () => setWinW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  const isMobile = winW <= 680;
  const [perfilSubTab, setPerfilSubTab] = useState(initialSubTab || "dados");
  const [feedbackTipo, setFeedbackTipo] = useState("sugestão");
  const [feedbackSubTab, setFeedbackSubTab] = useState("enviar");
  useEffect(() => { if (openPagamentosSignal > 0) setPerfilSubTab("pagamentos"); }, [openPagamentosSignal]);
  useEffect(() => { onSubTabChange?.(perfilSubTab); }, [perfilSubTab]);
  const [meuEnvios,      setMeuEnvios]      = useState([]);
  const [opcaoEscolhida, setOpcaoEscolhida] = useState({});
  // ── pagamentos ──
  const [itensPendentes,  setItensPendentes]  = useState([]);
  const [pagSelecionados, setPagSelecionados] = useState(new Set());
  const [pagComprovante,  setPagComprovante]  = useState(null);
  const [pagUsarCodigo,   setPagUsarCodigo]   = useState(false);
  const [pagCodigoTx,     setPagCodigoTx]     = useState("");
  const [pagObs,          setPagObs]          = useState("");
  const [pixCopiado,      setPixCopiado]      = useState(false);
  const [pagStatus,       setPagStatus]       = useState("idle"); // idle | enviando | enviado
  const [pagErro,         setPagErro]         = useState("");
  const [meusPagamentos,  setMeusPagamentos]  = useState([]);
  const [showReportPicker, setShowReportPicker] = useState(false);
  const [reportItem,       setReportItem]       = useState(null);
  const [pagRecibo,        setPagRecibo]        = useState(null);
  const [pagSubTab,        setPagSubTab]        = useState("pendentes"); // pendentes | enviar | historico
  // "outros" no pagamento
  const [pagOutros,         setPagOutros]       = useState(false);
  const [pagOutrosNome,     setPagOutrosNome]   = useState("");
  const [pagOutrosItem,     setPagOutrosItem]   = useState("");
  const [pagOutrosFrete,    setPagOutrosFrete]  = useState("");
  const [pagOutrosRF,       setPagOutrosRF]     = useState("");
  const [expandedEnvio,  setExpandedEnvio]  = useState(new Set());
  const [meuReports,     setMeuReports]     = useState(null);
  const [meusFeedbacks,  setMeusFeedbacks]  = useState(null);
  const [expandedReports, setExpandedReports] = useState(new Set());
  // ── repasse ──
  const [meusItens,           setMeusItens]           = useState([]);
  const [repasseItem,         setRepasseItem]         = useState(null);
  const [repasseNovoDono,     setRepasseNovoDono]     = useState(null);
  const [repasseNovoDonoSearch, setRepasseNovoDonoSearch] = useState("");
  const [repasseJoiners,      setRepasseJoiners]      = useState(null);
  const [repasseQuitado,      setRepasseQuitado]      = useState(null);
  const [repasseCustos,       setRepasseCustos]       = useState(new Set());
  const [repassePendDesc,     setRepassePendDesc]     = useState("");
  const [repasseValor,        setRepasseValor]        = useState("");
  const [repasseComprovante,  setRepasseComprovante]  = useState(null);
  const [repasseObs,          setRepasseObs]          = useState("");
  const [repasseStatus,       setRepasseStatus]       = useState("idle");
  const [repasseErro,         setRepasseErro]         = useState("");
  const [repasseRecibo,       setRepasseRecibo]       = useState(null);
  const [meusRepassos,        setMeusRepassos]        = useState([]);
  const [repasseSubTab,       setRepasseSubTab]       = useState("enviar");
  const [repasseOutrosNome,   setRepasseOutrosNome]   = useState("");
  const [repasseOutrosCeg,    setRepasseOutrosCeg]    = useState("");
  const [repasseCiente,       setRepasseCiente]       = useState(false);
  // ── badges ──
  const [multasPagasCount, setMultasPagasCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [
        { data: envios },
        { data: reports },
        { data: feedbacksData },
        { data: pendentes },
        { data: pagamentos },
        { data: itensData },
        { data: repassosData },
        { count: multasCount },
      ] = await Promise.all([
        supabase.from("envio_solicitacoes").select("*").eq("joiner_cog", user.cog).order("created_at", { ascending: false }),
        supabase.from("reports").select("id, item_nome, ceg, status, created_at, erro_item, erro_valor, erro_frete, erro_taxa, erro_pagamento, erro_recebido, erro_outro, motivo_item, correcao_valor, correcao_frete, correcao_taxa, pag_data, pag_valor, pag_metodo, observacao").eq("joiner_cog", user.cog).order("created_at", { ascending: false }),
        supabase.from("feedbacks").select("id, tipo, message, resposta, created_at").eq("joiner_cog", user.cog).order("created_at", { ascending: false }),
        supabase.from("masterlist")
          .select("id, ceg, nome_do_item, valor_item, frete_inter, taxa_rf, pago_item, pago_frete, pago_rf, venc_item, venc_frete, venc_rf")
          .eq("cog", user.cog)
          .or("and(pago_item.eq.false,valor_item.gt.0),and(pago_frete.eq.false,frete_inter.gt.0),and(pago_rf.eq.false,taxa_rf.gt.0)"),
        supabase.from("pagamento_demandas").select("*").eq("joiner_cog", user.cog).order("created_at", { ascending: false }),
        supabase.from("masterlist").select("id, ceg, nome_do_item, status, pago_item, pago_frete, pago_rf, valor_item, frete_inter, taxa_rf")
          .eq("cog", user.cog).order("ceg").order("nome_do_item"),
        supabase.from("repassos").select("*").eq("joiner_cog", user.cog).order("created_at", { ascending: false }),
        supabase.from("multas_pagas").select("id", { count: "exact", head: true }).eq("joiner_cog", user.cog),
      ]);
      if (cancelled) return;
      if (envios) setMeuEnvios(envios);
      setMeuReports(reports || []);
      setMeusFeedbacks(feedbacksData || []);
      if (pendentes && pagamentos) {
        const cfm = {};
        pagamentos.filter(d => d.status === "pago").forEach(d => {
          (d.itens || []).filter(it => it.ceg && it.nome_do_item).forEach(it => {
            const k = `${it.ceg}::${it.nome_do_item}`;
            if (!cfm[k]) cfm[k] = {};
            if (Number(it.valor_item  || 0) > 0) cfm[k].item  = true;
            if (Number(it.frete_inter || 0) > 0) cfm[k].frete = true;
            if (Number(it.taxa_rf     || 0) > 0) cfm[k].rf    = true;
          });
        });
        const stillPending = pendentes.filter(i => {
          const c = cfm[`${i.ceg}::${i.nome_do_item}`] || {};
          return (!i.pago_item  && Number(i.valor_item ||0) > 0 && !c.item)
              || (!i.pago_frete && Number(i.frete_inter||0) > 0 && !c.frete)
              || (!i.pago_rf    && Number(i.taxa_rf    ||0) > 0 && !c.rf);
        });
        setItensPendentes(stillPending);
        setPagSelecionados(new Set(stillPending.map(i => i.id)));
      } else if (pendentes) {
        setItensPendentes(pendentes);
        setPagSelecionados(new Set(pendentes.map(i => i.id)));
      }
      if (pagamentos) setMeusPagamentos(pagamentos);
      if (itensData) setMeusItens(itensData);
      if (repassosData) setMeusRepassos(repassosData);
      setMultasPagasCount(multasCount || 0);
    }
    load();
    return () => { cancelled = true; };
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
  const [fotoErro, setFotoErro] = useState("");
  const fileInputRef = useRef(null);

  async function handleFotoUpload(e) {
    const file = e.target.files[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois de um erro
    if (!file) return;
    setFotoErro("");

    if (file.size > 15 * 1024 * 1024) {
      setFotoErro("Essa imagem é muito grande (máx. 15MB). Tente outra foto.");
      return;
    }

    setFotoLoading(true);
    // Redimensiona para 200x200 usando canvas
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    const timeout = setTimeout(() => {
      setFotoErro("Demorou demais pra processar a imagem. Tente outra foto.");
      setFotoLoading(false);
      URL.revokeObjectURL(objectUrl);
    }, 15000);

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      setFotoErro("Não conseguimos abrir essa imagem. Se for foto do iPhone (formato HEIC), troque pra JPG ou PNG e tente de novo.");
      setFotoLoading(false);
    };
    img.onload = async () => {
      clearTimeout(timeout);
      const canvas = document.createElement("canvas");
      canvas.width = 200; canvas.height = 200;
      const ctx = canvas.getContext("2d");
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
      canvas.toBlob(async (blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) { setFotoErro("Erro ao processar a imagem. Tente outra foto."); setFotoLoading(false); return; }
        const path = `${user.cog}/avatar.jpg`;
        await supabase.storage.from("avatars").remove([path]);
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) { setFotoErro("Erro ao fazer upload: " + upErr.message); setFotoLoading(false); return; }
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;
        await supabase.from("joiners").update({ foto_perfil: cacheBustedUrl }).eq("cog", user.cog);
        const updatedUser = { ...user, foto_perfil: cacheBustedUrl };
        localStorage.setItem("anticeg_user", JSON.stringify(updatedUser));
        onUpdate(updatedUser);
        setFotoUrl(cacheBustedUrl);
        setFotoLoading(false);
      }, "image/jpeg", 0.9);
    };
    img.src = objectUrl;
  }

  async function handleSalvar() {
    setLoading(true); setError(""); setSuccess("");

    const updates = { nome, twitter, whatsapp, email };

    const { error: err } = await supabase.from("joiners").update(updates).eq("cog", user.cog);
    if (err) { setError("Erro ao salvar."); setLoading(false); return; }

    const camposAlterados = {};
    const mapa = { nome: user.nome, twitter: user.twitter, whatsapp: user.whatsapp, email: user.email };
    for (const [campo, valorNovo] of Object.entries(updates)) {
      const valorAntigo = mapa[campo] || "";
      if ((valorNovo || "") !== (valorAntigo || "")) {
        camposAlterados[campo] = { de: valorAntigo || "", para: valorNovo || "" };
      }
    }
    if (Object.keys(camposAlterados).length > 0) {
      await supabase.from("joiner_updates").insert([{ joiner_cog: user.cog, campos: camposAlterados }]);
    }

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

  const navPerfil = (id, icon, label, badge) => (
    <button key={id} className={`admin-sidebar-item${perfilSubTab === id ? " active" : ""}`} onClick={() => setPerfilSubTab(id)}>
      <span>{icon}</span>{label}
      {badge > 0 && <span className="admin-sidebar-badge">{badge}</span>}
    </button>
  );

  return (
    <div className="admin-wrap">
      <h2 className="admin-title" style={{ marginBottom:4 }}>Meu Perfil</h2>
      <div className="admin-greeting" style={{ marginBottom:20 }}>
        <span className="admin-greeting-prompt">// </span>
        <span className="admin-greeting-msg">{user.nome || user.cog}</span>
      </div>

      <div className="admin-layout">
        <nav className="admin-sidebar">
          <div className="admin-sidebar-group">
            <div className="admin-sidebar-group-label">Conta</div>
            {navPerfil("dados",      "○",  "Dados",      0)}
            {navPerfil("badges",     "✦", "Badges",     0)}
            {navPerfil("pagamentos", "◎", "Pagamentos", meusPagamentos.filter(p => p.status === "em_analise").length)}
            {navPerfil("repasse",    "⇄",  "Repasse",    meusRepassos.filter(r => r.status === "pendente").length)}
            {navPerfil("envios",     "◫",  "Envios",     meuEnvios.filter(e => e.status === "pagamento em aberto").length)}
            {navPerfil("suporte",    "⚑",  "Suporte",    (meuReports || []).filter(r => r.status === "pendente").length)}
          </div>
          <div className="admin-sidebar-group">
            <div className="admin-sidebar-group-label">Conteúdo</div>
            {navPerfil("historico", "◷", "Histórico", 0)}
            {navPerfil("tutorial", "☆", "Tutorial",  0)}
            {navPerfil("feedback", "✉", "Feedbacks", 0)}
          </div>
          {owner && (
            <div className="admin-sidebar-group">
              <div className="admin-sidebar-group-label">Config</div>
              {navPerfil("staff", "⚙", "Staff", 0)}
            </div>
          )}
        </nav>

        <div className="admin-content">

      {/* ── PAGAMENTOS ── */}
      {perfilSubTab === "pagamentos" && (() => {
        function exportarComprovante(p) {
          const itensHTML = p.itens.map(it => {
            const itTotal = Number(it.valor_item||0)+Number(it.frete_inter||0)+Number(it.taxa_rf||0)+Number(it.multa||0);
            const partes = [
              Number(it.valor_item)>0  ? `Item: R$${Number(it.valor_item ).toFixed(2).replace(".",",")}` : null,
              Number(it.frete_inter)>0 ? `Frete: R$${Number(it.frete_inter).toFixed(2).replace(".",",")}` : null,
              Number(it.taxa_rf)>0     ? `RF: R$${Number(it.taxa_rf    ).toFixed(2).replace(".",",")}` : null,
              Number(it.multa)>0       ? `Multa: R$${Number(it.multa    ).toFixed(2).replace(".",",")}` : null,
            ].filter(Boolean).join("  ·  ");
            return `<tr>
              <td style="padding:10px 0;border-bottom:1px solid #eee">
                <strong>${it.nome_do_item}</strong>
                <div style="font-size:11px;color:#888;margin-top:2px">${it.ceg}${partes ? `  —  ${partes}` : ""}</div>
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700">R$${itTotal.toFixed(2).replace(".",",")}</td>
            </tr>`;
          }).join("");
          const dataFmt = new Date(p.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
          const protocolo = `#${String(p.id).slice(-6).toUpperCase()}`;
          const status = p.status === "pago" ? "PAGO" : "EM ANÁLISE";
          const statusColor = p.status === "pago" ? "#2e7d32" : "#6a1b9a";
          const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Comprovante ${protocolo}</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:40px auto;color:#111;font-size:13px;line-height:1.6}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#888;font-size:12px;margin-bottom:24px}
  .badge{display:inline-block;padding:3px 12px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.05em;background:${p.status==="pago"?"#e8f5e9":"#f3e5f5"};color:${statusColor}}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  .total-row td{padding:12px 0;font-weight:900;font-size:15px;border-top:2px solid #111}
  .footer{margin-top:24px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
  @media print{body{margin:20px}}
</style></head><body>
<h1>Comprovante de pagamento</h1>
<div class="sub">${protocolo}  ·  ${dataFmt}  ·  <span class="badge">${status}</span></div>
<table>
  <tbody>${itensHTML}</tbody>
  <tfoot><tr class="total-row"><td>Total</td><td style="text-align:right">R$${Number(p.valor_total).toFixed(2).replace(".",",")}</td></tr></tfoot>
</table>
${p.comprovante_url ? (() => {
            const ext = p.comprovante_url.split(".").pop().toLowerCase().split("?")[0];
            const isImg = ["jpg","jpeg","png","gif","webp"].includes(ext);
            return `<div style="margin-top:24px;border-top:1px solid #eee;padding-top:16px">
  <div style="font-size:12px;color:#888;margin-bottom:10px">Comprovante anexado</div>
  ${isImg
    ? `<img src="${p.comprovante_url}" style="max-width:100%;border:1px solid #eee;border-radius:4px" />`
    : `<embed src="${p.comprovante_url}" type="application/pdf" width="100%" height="700px" style="border:1px solid #eee;border-radius:4px" />`
  }
</div>`;
          })() : ""}
<div class="footer">ANTICEG · GOM · Documento gerado em ${new Date().toLocaleString("pt-BR")}</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
          const w = window.open("","_blank");
          w.document.write(html);
          w.document.close();
        }
        if (pagSubTab === "historico") return (
          <div style={{ paddingBottom:40 }}>
            <div style={{ display:"flex", gap:6, marginBottom:20 }}>
              {[["pendentes","○ Pendentes"],["enviar","◎ Enviar"],["historico","≡ Histórico"]].map(([id, label]) => (
                <button key={id} onClick={() => setPagSubTab(id)}
                  style={{ padding:"6px 16px", borderRadius:6, fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600, cursor:"pointer", border:`1px solid ${pagSubTab===id ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, background: pagSubTab===id ? "rgba(255,92,26,.12)" : "transparent", color: pagSubTab===id ? "var(--laranja)" : "rgba(245,240,232,.4)", transition:"all .12s", letterSpacing:".3px" }}>
                  {label}
                </button>
              ))}
            </div>
            {meusPagamentos.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 0", fontSize:12, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>Nenhum envio de comprovante ainda.</div>
            ) : meusPagamentos.map(p => (
              <div key={p.id} style={{ background:"var(--card-bg)", border:`1px solid ${p.status==="pago" ? "rgba(186,255,57,.12)" : "rgba(201,168,240,.1)"}`, borderRadius:12, marginBottom:10, overflow:"hidden" }}>
                {/* Cabeçalho */}
                <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(245,240,232,.05)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", letterSpacing:".8px" }}>
                      #{String(p.id).slice(-6).toUpperCase()} · {new Date(p.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                    </div>
                  </div>
                  <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", padding:"3px 10px", borderRadius:4, border: p.status==="pago" ? "1px solid rgba(186,255,57,.3)" : "1px solid rgba(201,168,240,.3)", color: p.status==="pago" ? "#BAFF39" : "#C9A8F0", textTransform:"uppercase", letterSpacing:".5px" }}>
                    {p.status==="pago" ? "✓ Pago" : "◉ Em análise"}
                  </span>
                </div>
                {/* Itens */}
                <div style={{ padding:"12px 16px 0" }}>
                  {p.itens.map((it, idx) => {
                    const itTotal = Number(it.valor_item||0)+Number(it.frete_inter||0)+Number(it.taxa_rf||0)+Number(it.multa||0);
                    return (
                      <div key={idx} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", paddingBottom:8, marginBottom:8, borderBottom:"1px solid rgba(245,240,232,.04)" }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.nome_do_item}</div>
                          <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>{it.ceg}</div>
                          <div style={{ display:"flex", gap:10, marginTop:2, flexWrap:"wrap" }}>
                            {Number(it.valor_item)>0  && <span style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>item R${Number(it.valor_item ).toFixed(2).replace(".",",")}</span>}
                            {Number(it.frete_inter)>0 && <span style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>frete R${Number(it.frete_inter).toFixed(2).replace(".",",")}</span>}
                            {Number(it.taxa_rf)>0     && <span style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>rf R${Number(it.taxa_rf    ).toFixed(2).replace(".",",")}</span>}
                            {Number(it.multa)>0       && <span style={{ fontSize:9, color:"#ff6b6b", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>multa R${Number(it.multa).toFixed(2).replace(".",",")}</span>}
                          </div>
                        </div>
                        <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", flexShrink:0, marginLeft:12 }}>R${itTotal.toFixed(2).replace(".",",")}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Rodapé */}
                <div style={{ padding:"10px 16px", borderTop:"1px solid rgba(245,240,232,.05)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    {p.comprovante_url && (
                      <a href={p.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:9, color:"#64B5F6", fontFamily:"'DM Mono',monospace", textDecoration:"none" }}>↗ ver anexo</a>
                    )}
                    <button onClick={() => exportarComprovante(p)} style={{ fontSize:9, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", background:"none", border:"1px solid rgba(245,240,232,.12)", borderRadius:4, padding:"3px 10px", cursor:"pointer" }}>
                      ↓ exportar
                    </button>
                  </div>
                  <span style={{ fontSize:14, fontWeight:900, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>R$ {Number(p.valor_total).toFixed(2).replace(".",",")}</span>
                </div>
              </div>
            ))}
          </div>
        );

        const emAnaliseIds = new Set(
          meusPagamentos
            .filter(d => d.status === "em_analise")
            .flatMap(d => (d.itens || []).map(it => it.id))
        );
        const itensSel = itensPendentes.filter(i => pagSelecionados.has(i.id));
        const multaItem = i => {
          if (emAnaliseIds.has(i.id)) return 0;
          return (!i.pago_item  && Number(i.valor_item ||0) > 0 ? diasAtraso(i.venc_item)  : 0)
               + (!i.pago_frete && Number(i.frete_inter||0) > 0 ? diasAtraso(i.venc_frete) : 0)
               + (!i.pago_rf    && Number(i.taxa_rf    ||0) > 0 ? diasAtraso(i.venc_rf)    : 0);
        };
        const subtotalItem = i => (i.pago_item  ? 0 : Number(i.valor_item ||0))
                                + (i.pago_frete ? 0 : Number(i.frete_inter||0))
                                + (i.pago_rf    ? 0 : Number(i.taxa_rf    ||0))
                                + multaItem(i);
        const outrosValTotal = pagOutros ? (Number(pagOutrosItem.replace(",",".")||0) + Number(pagOutrosFrete.replace(",",".")||0) + Number(pagOutrosRF.replace(",",".")||0)) : 0;
        const total = itensSel.reduce((acc, i) => acc + subtotalItem(i), 0) + outrosValTotal;
        const temItens = itensSel.length > 0 || (pagOutros && pagOutrosNome.trim() && outrosValTotal > 0);

        const temComprovante = pagUsarCodigo ? pagCodigoTx.trim().length > 0 : !!pagComprovante;

        async function handleSubmit() {
          if (!temItens || !temComprovante) return;
          setPagStatus("enviando"); setPagErro("");

          let comprovanteUrl = null;
          let obsFinal = pagObs || null;

          if (pagUsarCodigo) {
            obsFinal = `Código da transação: ${pagCodigoTx.trim()}${pagObs ? "\n" + pagObs : ""}`;
          } else {
            const ext  = pagComprovante.name.split(".").pop();
            const path = `${user.cog}/${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, pagComprovante, { upsert: true });
            if (upErr) { setPagStatus("idle"); setPagErro(`Erro ao enviar arquivo: ${upErr.message}`); return; }
            const { data: { publicUrl } } = supabase.storage.from("comprovantes").getPublicUrl(path);
            comprovanteUrl = publicUrl;
          }

          const itensPayload = [
            ...itensSel.map(i => ({ id:i.id, ceg:i.ceg, nome_do_item:i.nome_do_item, valor_item:i.pago_item?0:Number(i.valor_item||0), frete_inter:i.pago_frete?0:Number(i.frete_inter||0), taxa_rf:i.pago_rf?0:Number(i.taxa_rf||0), multa:multaItem(i) })),
            ...(pagOutros && pagOutrosNome.trim() ? [{ id:null, ceg:"—", nome_do_item:pagOutrosNome.trim(), valor_item:Number(pagOutrosItem.replace(",",".")||0), frete_inter:Number(pagOutrosFrete.replace(",",".")||0), taxa_rf:Number(pagOutrosRF.replace(",",".")||0), multa:0 }] : []),
          ];
          const { data: nova, error } = await supabase.from("pagamento_demandas").insert([{
            joiner_cog:      user.cog,
            itens:           itensPayload,
            valor_total:     total,
            comprovante_url: comprovanteUrl,
            obs:             obsFinal,
          }]).select().single();
          if (error) { setPagStatus("idle"); setPagErro(`Erro ao salvar demanda: ${error.message}`); return; }
          setMeusPagamentos(prev => [nova, ...prev]);
          setPagRecibo(nova);
          setPagStatus("enviado");
        }

        if (pagStatus === "enviado" && pagRecibo) return (
          <div style={{ paddingBottom:40 }}>
            {/* Cabeçalho do comprovante */}
            <div style={{ textAlign:"center", padding:"28px 0 20px" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(186,255,57,.12)", border:"1px solid rgba(186,255,57,.3)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px", fontSize:20 }}>✓</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>Comprovante de envio</div>
              <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", marginTop:4, letterSpacing:"1px" }}>
                #{String(pagRecibo.id).slice(-6).toUpperCase()} · {new Date(pagRecibo.created_at).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
              </div>
            </div>

            {/* Card comprovante */}
            <div style={{ background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.08)", borderRadius:12, overflow:"hidden", marginBottom:16 }}>
              {/* Status */}
              <div style={{ background:"rgba(201,168,240,.07)", borderBottom:"1px solid rgba(245,240,232,.06)", padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", letterSpacing:".8px", textTransform:"uppercase" }}>Status</span>
                <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", padding:"3px 10px", borderRadius:4, border:"1px solid rgba(201,168,240,.35)", color:"#C9A8F0", textTransform:"uppercase", letterSpacing:".5px" }}>◉ Em análise</span>
              </div>

              {/* Itens */}
              <div style={{ padding:"14px 16px 0" }}>
                <div style={{ fontSize:9, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:10 }}>Itens</div>
                {pagRecibo.itens.map((it, idx) => {
                  const itTotal = Number(it.valor_item||0) + Number(it.frete_inter||0) + Number(it.taxa_rf||0) + Number(it.multa||0);
                  return (
                    <div key={idx} style={{ paddingBottom:10, marginBottom:10, borderBottom:"1px solid rgba(245,240,232,.05)" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{it.nome_do_item}</div>
                          <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>{it.ceg}</div>
                        </div>
                        <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", flexShrink:0, marginLeft:8 }}>R${itTotal.toFixed(2).replace(".",",")}</div>
                      </div>
                      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                        {Number(it.valor_item) > 0 && <span style={{ fontSize:9, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace" }}>item R${Number(it.valor_item).toFixed(2).replace(".",",")}</span>}
                        {Number(it.frete_inter) > 0 && <span style={{ fontSize:9, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace" }}>frete R${Number(it.frete_inter).toFixed(2).replace(".",",")}</span>}
                        {Number(it.taxa_rf) > 0 && <span style={{ fontSize:9, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace" }}>rf R${Number(it.taxa_rf).toFixed(2).replace(".",",")}</span>}
                        {Number(it.multa) > 0 && <span style={{ fontSize:9, color:"#ff6b6b", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>multa R${Number(it.multa).toFixed(2).replace(".",",")}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(245,240,232,.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".5px" }}>Total pago</span>
                <span style={{ fontSize:17, fontWeight:900, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>R$ {Number(pagRecibo.valor_total).toFixed(2).replace(".",",")}</span>
              </div>

              {/* Comprovante anexado */}
              {pagRecibo.comprovante_url && (
                <div style={{ padding:"10px 16px", borderTop:"1px solid rgba(245,240,232,.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".8px" }}>Comprovante anexado</span>
                  <a href={pagRecibo.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:"#64B5F6", fontFamily:"'DM Mono',monospace", textDecoration:"none" }}>↗ ver arquivo</a>
                </div>
              )}
            </div>

            <div style={{ fontSize:11, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textAlign:"center", lineHeight:1.8, marginBottom:16 }}>
              Assim que o pagamento for confirmado,<br />o status atualiza automaticamente.
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <button onClick={() => { setPagStatus("idle"); setPagRecibo(null); setPagSelecionados(new Set()); setPagComprovante(null); setPagObs(""); setPagSubTab("enviar"); }}
                style={{ width:"100%", padding:"13px 0", background:"var(--laranja)", color:"#000", border:"none", borderRadius:8, fontSize:13, fontWeight:900, fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".5px" }}>
                + Enviar novo comprovante
              </button>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => exportarComprovante(pagRecibo)} style={{ flex:1, padding:"10px 0", background:"rgba(245,240,232,.07)", border:"1px solid rgba(245,240,232,.1)", borderRadius:8, fontSize:11, fontWeight:700, color:"rgba(245,240,232,.5)", fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
                  ↓ Exportar
                </button>
                <button onClick={() => { setPagStatus("idle"); setPagSubTab("historico"); }} style={{ flex:1, padding:"10px 0", background:"rgba(245,240,232,.07)", border:"1px solid rgba(245,240,232,.1)", borderRadius:8, fontSize:11, fontWeight:700, color:"rgba(245,240,232,.5)", fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
                  Ver histórico →
                </button>
              </div>
            </div>
          </div>
        );


        if (pagSubTab === "pendentes") {
          const grandTotal = itensPendentes.reduce((a, i) =>
            a + (!i.pago_item  ? Number(i.valor_item ||0) : 0)
              + (!i.pago_frete ? Number(i.frete_inter||0) : 0)
              + (!i.pago_rf    ? Number(i.taxa_rf    ||0) : 0)
              + multaItem(i), 0);
          const grandMulta = itensPendentes.reduce((a, i) => a + multaItem(i), 0);
          const tabBar = (
            <div style={{ display:"flex", gap:6, marginBottom:20 }}>
              {[["pendentes","○ Pendentes"],["enviar","◎ Enviar"],["historico","≡ Histórico"]].map(([id, label]) => (
                <button key={id} onClick={() => setPagSubTab(id)}
                  style={{ padding:"6px 16px", borderRadius:6, fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600, cursor:"pointer", border:`1px solid ${pagSubTab===id ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, background: pagSubTab===id ? "rgba(255,92,26,.12)" : "transparent", color: pagSubTab===id ? "var(--laranja)" : "rgba(245,240,232,.4)", transition:"all .12s", letterSpacing:".3px" }}>
                  {label}
                </button>
              ))}
            </div>
          );
          return (
            <div style={{ paddingBottom:40 }}>
              {tabBar}
              {itensPendentes.length === 0 ? (
                <div style={{ padding:"16px", background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.07)", borderRadius:10, fontSize:11, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textAlign:"center" }}>
                  Nenhum item com pagamento pendente no momento.
                </div>
              ) : (
                <>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
                    {itensPendentes.map(item => {
                      const isAn = emAnaliseIds.has(item.id);
                      const valItem  = !item.pago_item  ? Number(item.valor_item ||0) : 0;
                      const valFrete = !item.pago_frete ? Number(item.frete_inter||0) : 0;
                      const valRf    = !item.pago_rf    ? Number(item.taxa_rf    ||0) : 0;
                      const multa    = multaItem(item);
                      const itemTotal = valItem + valFrete + valRf + multa;
                      return (
                        <div key={item.id} style={{ background:"var(--card-bg)", border:`1px solid ${isAn ? "rgba(201,168,240,.15)" : "rgba(245,240,232,.07)"}`, borderRadius:10, padding:"12px 14px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                            <div style={{ flex:1, minWidth:0, paddingRight:10 }}>
                              <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.nome_do_item}</div>
                              <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{item.ceg}</div>
                            </div>
                            <div style={{ textAlign:"right", flexShrink:0 }}>
                              <div style={{ fontSize:13, fontWeight:900, color: isAn ? "#C9A8F0" : "#F5F0E8", fontFamily:"'DM Mono',monospace" }}>R${itemTotal.toFixed(2).replace(".",",")}</div>
                              {isAn && <div style={{ fontSize:8, color:"#C9A8F0", fontFamily:"'DM Mono',monospace", letterSpacing:".05em", marginTop:1 }}>em análise</div>}
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                            {valItem  > 0 && <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", background:"rgba(245,240,232,.06)", border:"1px solid rgba(245,240,232,.1)", borderRadius:4, padding:"2px 8px", color:"rgba(245,240,232,.5)" }}>item R${valItem.toFixed(2).replace(".",",")}</span>}
                            {valFrete > 0 && <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", background:"rgba(245,240,232,.06)", border:"1px solid rgba(245,240,232,.1)", borderRadius:4, padding:"2px 8px", color:"rgba(245,240,232,.5)" }}>frete R${valFrete.toFixed(2).replace(".",",")}</span>}
                            {valRf    > 0 && <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", background:"rgba(245,240,232,.06)", border:"1px solid rgba(245,240,232,.1)", borderRadius:4, padding:"2px 8px", color:"rgba(245,240,232,.5)" }}>RF R${valRf.toFixed(2).replace(".",",")}</span>}
                            {multa    > 0 && <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", background:"rgba(255,107,107,.1)", border:"1px solid rgba(255,107,107,.3)", borderRadius:4, padding:"2px 8px", color:"#ff6b6b", fontWeight:700 }}>⚠ multa R${multa.toFixed(2).replace(".",",")}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ padding:"12px 14px", background:"rgba(245,240,232,.04)", border:"1px solid rgba(245,240,232,.1)", borderRadius:10, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase" }}>Total em aberto</div>
                      {grandMulta > 0 && <div style={{ fontSize:9, color:"rgba(255,107,107,.6)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>inclui R${grandMulta.toFixed(2).replace(".",",")} de multa</div>}
                    </div>
                    <div style={{ fontSize:16, fontWeight:900, color:"var(--laranja)", fontFamily:"'DM Mono',monospace" }}>R${grandTotal.toFixed(2).replace(".",",")}</div>
                  </div>
                  <button onClick={() => setPagSubTab("enviar")} style={{ width:"100%", padding:"12px 0", background:"var(--laranja)", color:"#000", border:"none", borderRadius:8, fontSize:12, fontWeight:900, fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".5px" }}>
                    ◎ Enviar comprovante →
                  </button>
                </>
              )}
            </div>
          );
        }

        return (
          <div style={{ paddingBottom:40 }}>
            <div style={{ display:"flex", gap:6, marginBottom:20 }}>
              {[["pendentes","○ Pendentes"],["enviar","◎ Enviar"],["historico","≡ Histórico"]].map(([id, label]) => (
                <button key={id} onClick={() => { if (id === "enviar" && pagStatus === "enviado") { setPagStatus("idle"); setPagRecibo(null); setPagSelecionados(new Set()); setPagComprovante(null); setPagObs(""); } setPagSubTab(id); }}
                  style={{ padding:"6px 16px", borderRadius:6, fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600, cursor:"pointer", border:`1px solid ${pagSubTab===id ? "var(--laranja)" : "rgba(245,240,232,.15)"}`, background: pagSubTab===id ? "rgba(255,92,26,.12)" : "transparent", color: pagSubTab===id ? "var(--laranja)" : "rgba(245,240,232,.4)", transition:"all .12s", letterSpacing:".3px" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize:10, letterSpacing:"1.5px", color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:16 }}>
              Selecione os itens que está pagando
            </div>
            {itensPendentes.length === 0 && (
              <div style={{ padding:"16px", background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.07)", borderRadius:10, marginBottom:8, fontSize:11, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textAlign:"center" }}>
                Nenhum item com pagamento pendente no momento.
              </div>
            )}
            {/* Lista de itens — tabela no desktop, cards no mobile */}
            {itensPendentes.length > 0 && (() => {
              const temMulta = itensPendentes.some(i => multaItem(i) > 0);
              const toggle = id => setPagSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
              const fmtV = v => v > 0 ? `R$${Number(v).toFixed(2).replace(".",",")}` : null;

              if (isMobile) return (
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:8 }}>
                  {itensPendentes.map(item => {
                    const sel = pagSelecionados.has(item.id);
                    const sub = subtotalItem(item);
                    const multa = multaItem(item);
                    const valItem  = !item.pago_item  ? Number(item.valor_item ||0) : 0;
                    const valFrete = !item.pago_frete ? Number(item.frete_inter||0) : 0;
                    const valRf    = !item.pago_rf    ? Number(item.taxa_rf    ||0) : 0;
                    const cols = [
                      valItem  > 0 ? { label:"Item",  v:valItem  } : null,
                      valFrete > 0 ? { label:"Frete", v:valFrete } : null,
                      valRf    > 0 ? { label:"RF",    v:valRf    } : null,
                      multa    > 0 ? { label:"Multa", v:multa, red:true } : null,
                    ].filter(Boolean);
                    return (
                      <div key={item.id} onClick={() => toggle(item.id)}
                        style={{ background: sel ? "rgba(186,255,57,.05)" : "var(--card-bg)", border:`1px solid ${sel ? "rgba(186,255,57,.2)" : "rgba(245,240,232,.07)"}`, borderRadius:10, padding:"12px 14px", cursor:"pointer", transition:"all .12s" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: cols.length > 0 ? 10 : 0 }}>
                          <div style={{ width:16, height:16, borderRadius:3, flexShrink:0, background: sel ? "#BAFF39" : "transparent", border:`2px solid ${sel ? "#BAFF39" : "rgba(245,240,232,.2)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {sel && <span style={{ fontSize:10, color:"#111", fontWeight:900, lineHeight:1 }}>✓</span>}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.nome_do_item}</div>
                            <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>{item.ceg}</div>
                          </div>
                          <div style={{ fontSize:14, fontWeight:900, color: sel ? "#BAFF39" : "rgba(245,240,232,.45)", fontFamily:"'DM Mono',monospace", flexShrink:0 }}>R${sub.toFixed(2).replace(".",",")}</div>
                        </div>
                        {cols.length > 0 && (
                          <div style={{ display:"flex", gap:0, borderTop:"1px solid rgba(245,240,232,.06)", paddingTop:8 }}>
                            {cols.map(c => (
                              <div key={c.label} style={{ flex:1, textAlign:"center" }}>
                                <div style={{ fontSize:8, letterSpacing:"1px", color: c.red ? "rgba(255,107,107,.5)" : "rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:2 }}>{c.label}</div>
                                <div style={{ fontSize:11, fontWeight:700, color: c.red ? "#ff6b6b" : "rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace" }}>R${c.v.toFixed(2).replace(".",",")}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );

              // Desktop — tabela com grid
              const gridCols = `30px 1fr 72px 72px 56px${temMulta ? " 66px" : ""} 80px`;
              const thStyle = { fontSize:8, letterSpacing:"1.2px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", textAlign:"right", paddingBottom:6 };
              return (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:"0 8px", paddingBottom:2, borderBottom:"1px solid rgba(245,240,232,.07)", marginBottom:4 }}>
                    <div />
                    <div style={{ ...thStyle, textAlign:"left" }}>Item</div>
                    <div style={thStyle}>Item R$</div>
                    <div style={thStyle}>Frete</div>
                    <div style={thStyle}>RF</div>
                    {temMulta && <div style={{ ...thStyle, color:"rgba(255,107,107,.5)" }}>Multa</div>}
                    <div style={{ ...thStyle, color:"rgba(245,240,232,.5)" }}>Total</div>
                  </div>
                  {itensPendentes.map(item => {
                    const sel = pagSelecionados.has(item.id);
                    const sub = subtotalItem(item);
                    const multa = multaItem(item);
                    return (
                      <div key={item.id} onClick={() => toggle(item.id)}
                        style={{ display:"grid", gridTemplateColumns:gridCols, gap:"0 8px", alignItems:"center", background: sel ? "rgba(186,255,57,.04)" : "transparent", borderRadius:7, padding:"9px 0", marginBottom:2, cursor:"pointer", transition:"background .12s", borderBottom:"1px solid rgba(245,240,232,.04)" }}>
                        <div style={{ display:"flex", justifyContent:"center" }}>
                          <div style={{ width:16, height:16, borderRadius:3, background: sel ? "#BAFF39" : "transparent", border:`2px solid ${sel ? "#BAFF39" : "rgba(245,240,232,.2)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {sel && <span style={{ fontSize:10, color:"#111", fontWeight:900, lineHeight:1 }}>✓</span>}
                          </div>
                        </div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.nome_do_item}</div>
                          <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>{item.ceg}</div>
                        </div>
                        <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.6)", textAlign:"right" }}>{fmtV(!item.pago_item ? Number(item.valor_item||0) : 0) || <span style={{opacity:.2}}>—</span>}</div>
                        <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.6)", textAlign:"right" }}>{fmtV(!item.pago_frete ? Number(item.frete_inter||0) : 0) || <span style={{opacity:.2}}>—</span>}</div>
                        <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.6)", textAlign:"right" }}>{fmtV(!item.pago_rf ? Number(item.taxa_rf||0) : 0) || <span style={{opacity:.2}}>—</span>}</div>
                        {temMulta && <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"#ff6b6b", fontWeight: multa > 0 ? 700 : 400, textAlign:"right" }}>{fmtV(multa) || <span style={{opacity:.2}}>—</span>}</div>}
                        <div style={{ fontSize:12, fontWeight:900, fontFamily:"'DM Mono',monospace", color: sel ? "#BAFF39" : "rgba(245,240,232,.45)", textAlign:"right" }}>R${sub.toFixed(2).replace(".",",")}</div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
            {/* Outros */}
            <div onClick={() => setPagOutros(p => !p)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", marginTop:4, cursor:"pointer", borderTop:"1px solid rgba(245,240,232,.06)" }}>
              <div style={{ width:16, height:16, borderRadius:3, flexShrink:0, background: pagOutros ? "#BAFF39" : "transparent", border:`2px solid ${pagOutros ? "#BAFF39" : "rgba(245,240,232,.2)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {pagOutros && <span style={{ fontSize:10, color:"#111", fontWeight:900, lineHeight:1 }}>✓</span>}
              </div>
              <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.5)" }}>Outro item (não cadastrado)</span>
            </div>
            {pagOutros && (
              <div style={{ background:"rgba(245,240,232,.03)", border:"1px solid rgba(245,240,232,.08)", borderRadius:8, padding:"12px 14px", marginBottom:4, display:"flex", flexDirection:"column", gap:10 }}>
                <div>
                  <div style={{ fontSize:9, letterSpacing:".8px", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:4 }}>Nome do item</div>
                  <input value={pagOutrosNome} onChange={e => setPagOutrosNome(e.target.value)} placeholder="Descreva o item..."
                    style={{ background:"rgba(245,240,232,.04)", border:"1px solid rgba(245,240,232,.1)", borderRadius:7, padding:"8px 11px", color:"#F5F0E8", fontSize:12, fontFamily:"'DM Mono',monospace", width:"100%", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap:8 }}>
                  {[["Item R$", pagOutrosItem, setPagOutrosItem], ["Frete R$", pagOutrosFrete, setPagOutrosFrete], ["Taxa RF R$", pagOutrosRF, setPagOutrosRF]].map(([label, val, set]) => (
                    <div key={label}>
                      <div style={{ fontSize:9, letterSpacing:".8px", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
                      <input type="text" inputMode="decimal" value={val} onChange={e => set(e.target.value)} placeholder="0,00"
                        style={{ background:"rgba(245,240,232,.04)", border:"1px solid rgba(245,240,232,.1)", borderRadius:7, padding:"8px 11px", color:"#F5F0E8", fontSize:12, fontFamily:"'DM Mono',monospace", width:"100%", outline:"none", boxSizing:"border-box" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderTop:"1px solid rgba(245,240,232,.08)", borderBottom:"1px solid rgba(245,240,232,.08)", margin:"8px 0 16px" }}>
              <span style={{ fontSize:11, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", letterSpacing:".05em", textTransform:"uppercase" }}>Total selecionado</span>
              <span style={{ fontSize:18, fontWeight:900, color: temItens ? "#F5F0E8" : "rgba(245,240,232,.2)", fontFamily:"'DM Mono',monospace" }}>R$ {total.toFixed(2).replace(".",",")}</span>
            </div>
            {/* Dados PIX */}
            {(() => {
              const PIX_KEY = "de1a489d-db81-4864-a8cf-74cdd79d9cdc";
              function copiar() {
                navigator.clipboard.writeText(PIX_KEY);
                setPixCopiado(true);
                setTimeout(() => setPixCopiado(false), 2000);
              }
              return (
                <div style={{ background:"rgba(186,255,57,.04)", border:"1px solid rgba(186,255,57,.18)", borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
                  <div style={{ fontSize:9, letterSpacing:"1.5px", color:"rgba(186,255,57,.6)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:10 }}>Dados para pagamento</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <div>
                      <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".8px", marginBottom:3 }}>Chave PIX — Mercado Pago</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ flex:1, background:"rgba(0,0,0,.35)", border:"1px solid rgba(245,240,232,.1)", borderRadius:6, padding:"8px 11px", fontSize:11, fontFamily:"'DM Mono',monospace", color:"#F5F0E8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{PIX_KEY}</div>
                        <button onClick={copiar} style={{ flexShrink:0, padding:"8px 14px", background: pixCopiado ? "rgba(186,255,57,.2)" : "rgba(186,255,57,.1)", color:"#BAFF39", border:`1px solid ${pixCopiado ? "rgba(186,255,57,.5)" : "rgba(186,255,57,.25)"}`, borderRadius:6, fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, cursor:"pointer", transition:"all .15s", whiteSpace:"nowrap" }}>
                          {pixCopiado ? "✓ copiado" : "copiar"}
                        </button>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                      <div>
                        <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".8px", marginBottom:2 }}>Nome da conta</div>
                        <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.75)", fontWeight:700 }}>Fernanda Gomes Medeiros</div>
                      </div>
                      <div>
                        <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".8px", marginBottom:2 }}>Valor</div>
                        <div style={{ fontSize:13, fontFamily:"'DM Mono',monospace", color:"#BAFF39", fontWeight:900 }}>R$ {total.toFixed(2).replace(".",",")}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, letterSpacing:".8px", color:"rgba(245,240,232,.38)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:6 }}>Comprovante de pagamento</div>
              {!pagUsarCodigo ? (
                <>
                  <label style={{ display:"flex", alignItems:"center", gap:10, background: pagComprovante ? "rgba(186,255,57,.06)" : "rgba(245,240,232,.03)", border:`1px dashed ${pagComprovante ? "rgba(186,255,57,.3)" : "rgba(245,240,232,.15)"}`, borderRadius:8, padding:"12px 14px", cursor:"pointer", transition:"all .12s" }}>
                    <input type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={e => setPagComprovante(e.target.files[0] || null)} />
                    <span style={{ fontSize:16 }}>{pagComprovante ? "✓" : "↑"}</span>
                    <div>
                      <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color: pagComprovante ? "#BAFF39" : "rgba(245,240,232,.5)" }}>{pagComprovante ? pagComprovante.name : "Clique para anexar (jpg, png, pdf)"}</div>
                      <div style={{ fontSize:9, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>Obrigatório</div>
                    </div>
                  </label>
                  <button onClick={() => { setPagUsarCodigo(true); setPagComprovante(null); }} style={{ marginTop:8, background:"none", border:"none", padding:0, fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", cursor:"pointer", textDecoration:"underline" }}>
                    Não consigo enviar o comprovante
                  </button>
                </>
              ) : (
                <>
                  <div style={{ background:"rgba(245,240,232,.03)", border:"1px solid rgba(245,240,232,.12)", borderRadius:8, padding:"12px 14px" }}>
                    <div style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>Código da transação (Ex: E00038166...)</div>
                    <input
                      value={pagCodigoTx}
                      onChange={e => setPagCodigoTx(e.target.value)}
                      placeholder="Cole o código da transação aqui"
                      style={{ width:"100%", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.14)", borderRadius:6, padding:"9px 12px", color:"#F5F0E8", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box" }}
                    />
                  </div>
                  <button onClick={() => { setPagUsarCodigo(false); setPagCodigoTx(""); }} style={{ marginTop:8, background:"none", border:"none", padding:0, fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", cursor:"pointer", textDecoration:"underline" }}>
                    ← Voltar para anexar arquivo
                  </button>
                </>
              )}
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, letterSpacing:".8px", color:"rgba(245,240,232,.38)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:6 }}>Observações (opcional)</div>
              <textarea value={pagObs} onChange={e => setPagObs(e.target.value)} rows={2} placeholder="Ex: paguei os 3 itens juntos" style={{ width:"100%", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.14)", borderRadius:6, padding:"9px 12px", color:"#F5F0E8", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none", resize:"none", boxSizing:"border-box" }} />
            </div>
            {pagErro && <div style={{ fontSize:11, color:"var(--laranja)", fontFamily:"'DM Mono',monospace", marginBottom:10 }}>{pagErro}</div>}
            <button onClick={handleSubmit} disabled={!temItens || !temComprovante || pagStatus === "enviando"}
              style={{ width:"100%", padding:"14px 0", background: temItens && temComprovante ? "var(--laranja)" : "rgba(245,240,232,.1)", color: temItens && temComprovante ? "#111" : "rgba(245,240,232,.3)", border:"none", borderRadius:8, fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace", cursor: temItens && temComprovante ? "pointer" : "not-allowed", letterSpacing:"1px" }}>
              {pagStatus === "enviando" ? "ENVIANDO..." : `ENVIAR COMPROVANTE — R$ ${total.toFixed(2).replace(".",",")}`}
            </button>

            {/* Reportar problema */}
            <button onClick={() => setShowReportPicker(true)}
              style={{ width:"100%", marginTop:10, padding:"10px 0", background:"transparent", border:"1px solid rgba(245,240,232,.1)", borderRadius:8, fontSize:11, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".5px" }}>
              ⚑ Reportar problema
            </button>
          </div>
        );
      })()}

      {/* Seletor de item para report */}
      {showReportPicker && (
        <div className="modal-overlay" onClick={() => setShowReportPicker(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:400 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", marginBottom:4 }}>Reportar problema</div>
            <div style={{ fontSize:11, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginBottom:16 }}>Selecione o item com problema:</div>
            {itensPendentes.length === 0 && (
              <div style={{ fontSize:11, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textAlign:"center", padding:"16px 0" }}>Nenhum item disponível.</div>
            )}
            {itensPendentes.map(item => (
              <div key={item.id} onClick={() => { setReportItem(item); setShowReportPicker(false); }}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 14px", marginBottom:6, background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.07)", borderRadius:8, cursor:"pointer", transition:"border-color .12s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor="rgba(245,240,232,.2)"}
                onMouseLeave={e => e.currentTarget.style.borderColor="rgba(245,240,232,.07)"}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{item.nome_do_item}</div>
                  <div style={{ fontSize:9, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{item.ceg}</div>
                </div>
                <span style={{ fontSize:11, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace" }}>→</span>
              </div>
            ))}
            <button onClick={() => setShowReportPicker(false)} style={{ width:"100%", marginTop:8, padding:"10px", background:"none", border:"1px solid rgba(245,240,232,.1)", borderRadius:6, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", fontSize:12, cursor:"pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ReportModal após seleção */}
      {reportItem && (
        <ReportModal
          user={user}
          item={reportItem}
          onClose={() => setReportItem(null)}
          onReported={() => setReportItem(null)}
        />
      )}

      {/* ── REPASSE ── */}
      {perfilSubTab === "repasse" && (() => {
        const isOutros = repasseItem?.id === "outros";
        async function handleSubmitRepasse() {
          if (!repasseItem || !repasseNovoDono || repasseQuitado === null || !repasseValor || !repasseComprovante) return;
          if (isOutros && (!repasseOutrosNome.trim() || !repasseOutrosCeg.trim())) return;
          setRepasseStatus("enviando"); setRepasseErro("");
          const ext  = repasseComprovante.name.split(".").pop();
          const path = `repassos/${user.cog}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, repasseComprovante, { upsert: true });
          if (upErr) { setRepasseStatus("idle"); setRepasseErro(`Erro ao enviar arquivo: ${upErr.message}`); return; }
          const { data: { publicUrl } } = supabase.storage.from("comprovantes").getPublicUrl(path);
          const custosPagosArr = [...repasseCustos];
          const nomeItem = isOutros ? repasseOutrosNome.trim() : repasseItem.nome_do_item;
          const cegItem  = isOutros ? repasseOutrosCeg.trim()  : repasseItem.ceg;
          const { data: nova, error } = await supabase.from("repassos").insert([{
            joiner_cog:     user.cog,
            joiner_nome:    user.nome || user.cog,
            joiner_twitter: user.twitter || null,
            item_id:        isOutros ? null : repasseItem.id,
            ceg:            cegItem,
            nome_do_item:   nomeItem,
            item_status:    isOutros ? "outros" : repasseItem.status,
            novo_dono_cog:  repasseNovoDono.cog,
            novo_dono_nome: repasseNovoDono.nome,
            novo_dono_twitter: repasseNovoDono.twitter || null,
            item_quitado:   repasseQuitado,
            custos_pagos:   custosPagosArr,
            valor_pendente_descricao: !repasseQuitado ? repassePendDesc : null,
            valor_acordado: Number(repasseValor.replace(",",".")),
            comprovacao_url: publicUrl,
            obs:            repasseObs || null,
          }]).select().single();
          if (error) { setRepasseStatus("idle"); setRepasseErro(`Erro ao enviar: ${error.message}`); return; }
          // Notifica novo dono
          await supabase.from("pushes").insert([{
            message: `${user.nome || user.cog} quer te repassar o item "${nomeItem}" (${cegItem}). Aguarde confirmação da admin!`,
            active: true,
            joiner_cog: repasseNovoDono.cog,
          }]);
          setMeusRepassos(prev => [nova, ...prev]);
          setRepasseRecibo(nova);
          setRepasseStatus("enviado");
        }

        if (repasseRecibo) {
          const r = repasseRecibo;
          const custosMap = { item:"Item", frete:"Frete", rf:"Taxa RF" };
          return (
            <div style={{ paddingTop:4 }}>
              {/* Card principal — mesmo estilo dos envios */}
              <div style={{ background:"var(--card-bg)", border:"1px solid rgba(167,139,250,.25)", borderRadius:10, overflow:"hidden", marginBottom:16 }}>
                {/* Header */}
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, padding:"14px 16px", borderBottom:"1px solid rgba(245,240,232,.06)", flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", lineHeight:1.4 }}>{r.nome_do_item}</div>
                    <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", marginTop:3 }}>
                      {r.ceg} · {new Date(r.created_at).toLocaleDateString("pt-BR")} às {new Date(r.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                    </div>
                  </div>
                  <span style={{ fontSize:9, fontWeight:700, color:"#A78BFA", border:"1px solid rgba(167,139,250,.35)", borderRadius:4, padding:"2px 9px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap", flexShrink:0 }}>
                    ◉ Em análise
                  </span>
                </div>

                {/* Corpo */}
                <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:14 }}>

                  {/* De → Para */}
                  <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto 1fr", gap:10, alignItems:"center" }}>
                    <div style={{ background:"rgba(245,240,232,.03)", border:"1px solid rgba(245,240,232,.07)", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:8, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:4 }}>De</div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{r.joiner_nome}</div>
                      <div style={{ fontSize:10, color:"rgba(167,139,250,.7)", fontFamily:"'DM Mono',monospace" }}>@{r.joiner_cog}</div>
                    </div>
                    <div style={{ textAlign:"center", fontSize:16, color:"rgba(245,240,232,.2)" }}>→</div>
                    <div style={{ background:"rgba(167,139,250,.06)", border:"1px solid rgba(167,139,250,.2)", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:8, letterSpacing:"1px", color:"rgba(167,139,250,.5)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:4 }}>Para</div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{r.novo_dono_nome}</div>
                      <div style={{ fontSize:10, color:"rgba(167,139,250,.7)", fontFamily:"'DM Mono',monospace" }}>@{r.novo_dono_cog}</div>
                    </div>
                  </div>

                  {/* Detalhes */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, borderTop:"1px solid rgba(245,240,232,.06)", paddingTop:12 }}>
                    <div>
                      <div style={{ fontSize:8, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:3 }}>Valor acordado</div>
                      <div style={{ fontSize:14, fontWeight:900, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>R$ {Number(r.valor_acordado).toFixed(2).replace(".",",")}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:8, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:3 }}>Quitado</div>
                      <div style={{ fontSize:12, fontWeight:700, color: r.item_quitado ? "#BAFF39" : "#ff6b6b", fontFamily:"'DM Mono',monospace" }}>{r.item_quitado ? "Sim" : "Não"}</div>
                    </div>
                    {(r.custos_pagos || []).length > 0 && (
                      <div style={{ gridColumn:"1 / -1" }}>
                        <div style={{ fontSize:8, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:3 }}>Custos já pagos</div>
                        <div style={{ fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace" }}>{r.custos_pagos.map(c => custosMap[c]||c).join(", ")}</div>
                      </div>
                    )}
                    {r.valor_pendente_descricao && (
                      <div style={{ gridColumn:"1 / -1" }}>
                        <div style={{ fontSize:8, letterSpacing:"1px", color:"rgba(255,107,107,.45)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:3 }}>Valores pendentes</div>
                        <div style={{ fontSize:11, color:"rgba(255,107,107,.7)", fontFamily:"'DM Mono',monospace", lineHeight:1.5 }}>{r.valor_pendente_descricao}</div>
                      </div>
                    )}
                  </div>

                  {r.obs && (
                    <div style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", fontStyle:"italic", borderTop:"1px solid rgba(245,240,232,.06)", paddingTop:10 }}>
                      {r.obs}
                    </div>
                  )}
                </div>
              </div>

              {/* Protocolo + nota */}
              <div style={{ fontSize:10, color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", marginBottom:4, letterSpacing:".05em" }}>
                Protocolo #{String(r.id).slice(0,8).toUpperCase()}
              </div>
              <div style={{ fontSize:10, color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", marginBottom:20, lineHeight:1.6 }}>
                A notificação foi enviada para {r.novo_dono_nome}. A admin irá processar o repasse em breve.
              </div>

              <button onClick={() => { setRepasseRecibo(null); setRepasseItem(null); setRepasseNovoDono(null); setRepasseNovoDonoSearch(""); setRepasseQuitado(null); setRepasseCustos(new Set()); setRepassePendDesc(""); setRepasseValor(""); setRepasseComprovante(null); setRepasseObs(""); setRepasseStatus("idle"); setRepasseCiente(false); }}
                style={{ background:"transparent", border:"1px solid rgba(245,240,232,.15)", color:"rgba(245,240,232,.6)", borderRadius:8, padding:"9px 18px", fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
                Novo repasse
              </button>
            </div>
          );
        }

        const novoDonoFiltered = (repasseJoiners || []).filter(j =>
          j.cog !== user.cog &&
          (j.nome?.toLowerCase().includes(repasseNovoDonoSearch.toLowerCase()) ||
           j.cog?.toLowerCase().includes(repasseNovoDonoSearch.toLowerCase()))
        ).slice(0, 8);

        const labelSt = { fontSize:10, letterSpacing:".8px", color:"rgba(245,240,232,.38)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:6, display:"block" };
        const inputSt = { background:"rgba(245,240,232,.04)", border:"1px solid rgba(245,240,232,.1)", borderRadius:8, padding:"10px 12px", color:"#F5F0E8", fontSize:12, fontFamily:"'DM Mono',monospace", width:"100%", outline:"none", boxSizing:"border-box" };

        const subTabs = [["enviar","◎ Enviar"],["historico","≡ Histórico"]];
        return (
          <div style={{ padding:"4px 0" }}>
            <div style={{ display:"flex", gap:8, marginBottom:20, overflowX:"auto", paddingBottom:2 }}>
              {subTabs.map(([id, label]) => (
                <button key={id} onClick={() => setRepasseSubTab(id)}
                  style={{ fontSize:11, fontFamily:"'DM Mono',monospace", padding: isMobile ? "7px 18px" : "5px 14px", borderRadius:20, cursor:"pointer", border: repasseSubTab===id ? "1px solid var(--laranja)" : "1px solid rgba(245,240,232,.12)", background: repasseSubTab===id ? "rgba(255,92,26,.12)" : "transparent", color: repasseSubTab===id ? "var(--laranja)" : "rgba(245,240,232,.4)", fontWeight: repasseSubTab===id ? 700 : 400, whiteSpace:"nowrap", flexShrink:0 }}>
                  {label}
                </button>
              ))}
            </div>

            {repasseSubTab === "historico" && (() => {

              function exportarComprovanteRepasse(r) {
                const protocolo = `#${String(r.id).slice(-6).toUpperCase()}`;
                const dataFmt   = new Date(r.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
                const custosMap = { item:"Item", frete:"Frete", rf:"Taxa RF" };
                const statusStr = r.status === "aprovado" ? "APROVADO" : r.status === "recusado" ? "RECUSADO" : "PENDENTE";
                const statusColor = r.status === "aprovado" ? "#2e7d32" : r.status === "recusado" ? "#b71c1c" : "#6a1b9a";
                const custosList = (r.custos_pagos || []).map(c => custosMap[c]||c).join(", ") || "Nenhum";
                const compHTML = r.comprovacao_url ? (() => {
                  const ext = r.comprovacao_url.split(".").pop().toLowerCase().split("?")[0];
                  const isImg = ["jpg","jpeg","png","gif","webp"].includes(ext);
                  return `<div style="margin-top:24px;border-top:1px solid #eee;padding-top:16px">
  <div style="font-size:12px;color:#888;margin-bottom:10px">Comprovante de acordo</div>
  ${isImg ? `<img src="${r.comprovacao_url}" style="max-width:100%;border:1px solid #eee;border-radius:4px" />` : `<a href="${r.comprovacao_url}" style="font-size:12px;color:#1565c0">↗ Ver comprovante</a>`}
</div>`;
                })() : "";
                const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Comprovante de Repasse ${protocolo}</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:40px auto;color:#111;font-size:13px;line-height:1.6}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#888;font-size:12px;margin-bottom:24px}
  .badge{display:inline-block;padding:3px 12px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.05em;background:${r.status==="aprovado"?"#e8f5e9":r.status==="recusado"?"#ffebee":"#f3e5f5"};color:${statusColor}}
  .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:13px}
  .label{color:#888}
  .total{font-weight:900;font-size:15px;border-top:2px solid #111 !important;padding-top:12px !important}
  .footer{margin-top:24px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
  @media print{body{margin:20px}}
</style></head><body>
<h1>Comprovante de Repasse</h1>
<div class="sub">${protocolo}  ·  ${dataFmt}  ·  <span class="badge">${statusStr}</span></div>
<div class="row"><span class="label">Item</span><span><strong>${r.nome_do_item}</strong></span></div>
<div class="row"><span class="label">CEG</span><span>${r.ceg || "—"}</span></div>
<div class="row"><span class="label">De (dono original)</span><span>${r.joiner_nome} @${r.joiner_cog}</span></div>
<div class="row"><span class="label">Para (novo dono)</span><span>${r.novo_dono_nome} @${r.novo_dono_cog}</span></div>
<div class="row"><span class="label">Item quitado</span><span>${r.item_quitado ? "Sim" : "Não"}</span></div>
<div class="row"><span class="label">Custos já pagos</span><span>${custosList}</span></div>
${r.valor_pendente_descricao ? `<div class="row"><span class="label">Valor pendente</span><span>${r.valor_pendente_descricao}</span></div>` : ""}
<div class="row total"><span>Valor acordado</span><span>R$ ${Number(r.valor_acordado).toFixed(2).replace(".",",")}</span></div>
${r.obs ? `<div class="row"><span class="label">Observações</span><span>${r.obs}</span></div>` : ""}
${compHTML}
<div class="footer">ANTICEG · GOM · Documento gerado em ${new Date().toLocaleString("pt-BR")}</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
                const w = window.open("","_blank");
                w.document.write(html);
                w.document.close();
              }

              async function cancelarRepasse(id) {
                if (!window.confirm("Cancelar este repasse? Essa ação não pode ser desfeita.")) return;
                await supabase.from("repassos").update({ status: "cancelado" }).eq("id", id);
                setMeusRepassos(prev => prev.map(x => x.id === id ? { ...x, status:"cancelado" } : x));
              }

              return (
                <div>
                  {meusRepassos.length === 0
                    ? <div style={{ fontSize:12, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>Nenhum repasse registrado.</div>
                    : meusRepassos.map(r => {
                      const statusColor  = r.status === "aprovado" ? "#BAFF39" : r.status === "recusado" ? "#ff6b6b" : r.status === "cancelado" ? "rgba(245,240,232,.25)" : "rgba(167,139,250,.9)";
                      const statusBorder = r.status === "aprovado" ? "rgba(186,255,57,.2)" : r.status === "recusado" ? "rgba(255,107,107,.2)" : r.status === "cancelado" ? "rgba(245,240,232,.06)" : "rgba(167,139,250,.2)";
                      const statusLabel  = r.status === "aprovado" ? "✓ aprovado" : r.status === "recusado" ? "✗ recusado" : r.status === "cancelado" ? "— cancelado" : "◉ pendente";
                      return (
                        <div key={r.id} style={{ background:"var(--card-bg)", border:`1px solid ${statusBorder}`, borderRadius:10, padding:"14px 16px", marginBottom:10, opacity: r.status === "cancelado" ? .5 : 1 }}>
                          {/* Header */}
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                            <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", flex:1, minWidth:0, lineHeight:1.4 }}>{r.nome_do_item}</div>
                            <span style={{ fontSize:9, fontWeight:700, color:statusColor, fontFamily:"'DM Mono',monospace", letterSpacing:".05em", flexShrink:0, border:`1px solid ${statusBorder}`, borderRadius:4, padding:"2px 8px" }}>{statusLabel}</span>
                          </div>
                          {/* Detalhes */}
                          <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", lineHeight:1.9 }}>
                            <span style={{ color:"rgba(245,240,232,.25)" }}>CEG:</span> {r.ceg}<br/>
                            <span style={{ color:"rgba(245,240,232,.25)" }}>Para:</span> {r.novo_dono_nome} <span style={{color:"rgba(167,139,250,.7)"}}>@{r.novo_dono_cog}</span><br/>
                            <span style={{ color:"rgba(245,240,232,.25)" }}>Valor:</span> R$ {Number(r.valor_acordado).toFixed(2).replace(".",",")} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                          </div>
                          {r.obs && <div style={{ fontSize:10, color:"rgba(245,240,232,.25)", marginTop:6, fontStyle:"italic" }}>{r.obs}</div>}
                          {/* Ações */}
                          {r.status !== "cancelado" && (
                            <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 6 : 8, marginTop:12 }}>
                              <button onClick={() => exportarComprovanteRepasse(r)}
                                style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"none", border:"1px solid rgba(245,240,232,.15)", color:"rgba(245,240,232,.5)", borderRadius:6, padding: isMobile ? "10px 0" : "5px 12px", cursor:"pointer", letterSpacing:".05em", textAlign:"center" }}>
                                ↓ exportar comprovante
                              </button>
                              {r.status === "pendente" && (
                                <button onClick={() => cancelarRepasse(r.id)}
                                  style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"none", border:"1px solid rgba(255,107,107,.3)", color:"rgba(255,107,107,.7)", borderRadius:6, padding: isMobile ? "10px 0" : "5px 12px", cursor:"pointer", letterSpacing:".05em", textAlign:"center" }}>
                                  ✕ cancelar repasse
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  }
                </div>
              );
            })()}

            {repasseSubTab === "enviar" && (
              <div style={{ display:"flex", flexDirection:"column", gap: isMobile ? 14 : 18 }}>
                {/* Disclaimer */}
                <div style={{ background:"rgba(245,240,232,.02)", border:"1px solid rgba(245,240,232,.09)", borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ fontSize:9, letterSpacing:"1.5px", color:"rgba(255,92,26,.7)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:2 }}>Leia antes de preencher</div>
                  {[
                    "Este formulário deve ser preenchido pelo dono original do item que deseja repassá-lo dentro da comunidade.",
                    "Só é permitido repassar itens totalmente pagos à Nanda e com o formulário de pagamento devidamente preenchido.",
                    "Repasses são permitidos dentro da comunidade ANTIGOM, inclusive no grupo V&T da comunidade, sem necessidade de autorização prévia.",
                    "Repasses para pessoas fora da comunidade não são permitidos e serão cancelados.",
                    "Não podem ser repassados: itens fanmade, revistas e caixas de Mercari.",
                    "Repasses não informados via formulário não serão considerados pela GOM.",
                  ].map((r, i) => (
                    <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                      <span style={{ color:"rgba(255,92,26,.5)", fontSize:11, flexShrink:0, marginTop:1 }}>☆</span>
                      <span style={{ fontSize:11, color:"rgba(245,240,232,.55)", fontFamily:"'DM Mono',monospace", lineHeight:1.6 }}>{r}</span>
                    </div>
                  ))}
                </div>

                {/* Dono atual (fixado) */}
                <div style={{ background:"rgba(245,240,232,.03)", border:"1px solid rgba(245,240,232,.07)", borderRadius:8, padding:"10px 14px" }}>
                  <span style={labelSt}>Dono atual</span>
                  <div style={{ fontSize:13, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{user.nome || user.cog}</div>
                  {user.twitter && <div style={{ fontSize:11, color:"rgba(167,139,250,.8)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>@{user.twitter}</div>}
                  {user.email && <div style={{ fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", marginTop:1 }}>{user.email}</div>}
                </div>

                {/* Seleção do item */}
                <div>
                  <span style={labelSt}>Item a repassar</span>
                  <select value={repasseItem?.id ?? ""} onChange={e => {
                      if (e.target.value === "outros") { setRepasseItem({ id:"outros" }); setRepasseValor(""); }
                      else {
                        const found = meusItens.find(i => i.id === Number(e.target.value));
                        setRepasseItem(found || null);
                        if (found) {
                          const v = Number(found.valor_item||0) + Number(found.frete_inter||0) + Number(found.taxa_rf||0);
                          setRepasseValor(v > 0 ? v.toFixed(2).replace(".",",") : "");
                        }
                      }
                    }}
                    style={{ ...inputSt, appearance:"none", cursor:"pointer" }}>
                    <option value="" style={{ color:"#111" }}>Selecione um item...</option>
                    {meusItens.map(i => (
                      <option key={i.id} value={i.id} style={{ color:"#111" }}>[{i.ceg}] {i.nome_do_item} — {i.status}</option>
                    ))}
                    <option value="outros" style={{ color:"#111" }}>Outro item (não cadastrado)...</option>
                  </select>
                  {repasseItem?.id === "outros" && (
                    <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:8 }}>
                      <div>
                        <div style={{ fontSize:9, letterSpacing:".8px", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:4 }}>Nome do item</div>
                        <input value={repasseOutrosNome} onChange={e => setRepasseOutrosNome(e.target.value)} placeholder="Descreva o item..."
                          style={inputSt} />
                      </div>
                      <div>
                        <div style={{ fontSize:9, letterSpacing:".8px", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:4 }}>CEG</div>
                        <input value={repasseOutrosCeg} onChange={e => setRepasseOutrosCeg(e.target.value)} placeholder="Ex: 6TH FAN MEETING CARD"
                          style={inputSt} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Novo dono */}
                <div style={{ position:"relative" }}>
                  <span style={labelSt}>Novo dono</span>
                  {repasseNovoDono ? (
                    <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(167,139,250,.07)", border:"1px solid rgba(167,139,250,.25)", borderRadius:8, padding:"10px 14px" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{repasseNovoDono.nome}</div>
                        <div style={{ fontSize:11, color:"rgba(167,139,250,.8)", fontFamily:"'DM Mono',monospace" }}>@{repasseNovoDono.cog}</div>
                      </div>
                      <button onClick={() => { setRepasseNovoDono(null); setRepasseNovoDonoSearch(""); }}
                        style={{ background:"transparent", border:"none", color:"rgba(245,240,232,.4)", fontSize:16, cursor:"pointer", padding:4 }}>✕</button>
                    </div>
                  ) : (
                    <div>
                      <input value={repasseNovoDonoSearch} onChange={e => {
                          setRepasseNovoDonoSearch(e.target.value);
                          if (!repasseJoiners) supabase.from("joiners").select("cog,nome,twitter").order("nome").then(({ data }) => setRepasseJoiners(data || []));
                        }}
                        placeholder="Buscar joiner por nome ou @..."
                        style={inputSt} />
                      {repasseNovoDonoSearch.trim().length > 0 && repasseJoiners && (
                        <div style={{ background:"#111", border:"1px solid rgba(245,240,232,.1)", borderRadius:8, marginTop:4, overflow:"hidden" }}>
                          {novoDonoFiltered.length === 0
                            ? <div style={{ padding:"10px 14px", fontSize:11, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>Nenhuma joiner encontrada</div>
                            : novoDonoFiltered.map(j => (
                              <button key={j.cog} onClick={() => { setRepasseNovoDono(j); setRepasseNovoDonoSearch(""); }}
                                style={{ display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", borderBottom:"1px solid rgba(245,240,232,.06)", padding:"9px 14px", cursor:"pointer", color:"#F5F0E8" }}>
                                <span style={{ fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{j.nome}</span>
                                <span style={{ fontSize:11, color:"rgba(167,139,250,.7)", fontFamily:"'DM Mono',monospace", marginLeft:8 }}>@{j.cog}</span>
                              </button>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Item quitado? */}
                <div>
                  <span style={labelSt}>O item está 100% quitado?</span>
                  <div style={{ display:"flex", gap:8 }}>
                    {[true, false].map(v => (
                      <button key={String(v)} onClick={() => setRepasseQuitado(v)}
                        style={{ flex:1, padding:"9px 0", borderRadius:8, border: repasseQuitado === v ? `1px solid ${v ? "rgba(186,255,57,.4)" : "rgba(255,107,107,.4)"}` : "1px solid rgba(245,240,232,.1)", background: repasseQuitado === v ? (v ? "rgba(186,255,57,.08)" : "rgba(255,107,107,.08)") : "transparent", color: repasseQuitado === v ? (v ? "#BAFF39" : "#ff6b6b") : "rgba(245,240,232,.4)", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer" }}>
                        {v ? "Sim" : "Não"}
                      </button>
                    ))}
                  </div>
                  {repasseQuitado === false && (
                    <div style={{ marginTop:10 }}>
                      <span style={{ ...labelSt, color:"rgba(255,107,107,.6)" }}>Quais valores ainda estão pendentes?</span>
                      <textarea value={repassePendDesc} onChange={e => setRepassePendDesc(e.target.value)}
                        placeholder="Ex: frete R$25 ainda não pago, novo dono assume a responsabilidade..."
                        rows={3} style={{ ...inputSt, resize:"vertical" }} />
                    </div>
                  )}
                </div>

                {/* Custos já pagos */}
                <div>
                  <span style={labelSt}>Custos já pagos por você (antes do repasse)</span>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {[["item","Item"],["frete","Frete"],["rf","Taxa RF"]].map(([k, label]) => {
                      const on = repasseCustos.has(k);
                      return (
                        <button key={k} onClick={() => setRepasseCustos(prev => { const n = new Set(prev); on ? n.delete(k) : n.add(k); return n; })}
                          style={{ padding: isMobile ? "9px 20px" : "7px 16px", borderRadius:20, border: on ? "1px solid rgba(186,255,57,.4)" : "1px solid rgba(245,240,232,.1)", background: on ? "rgba(186,255,57,.08)" : "transparent", color: on ? "#BAFF39" : "rgba(245,240,232,.45)", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight: on ? 700 : 400, cursor:"pointer" }}>
                          {on ? "✓ " : ""}{label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Valor acordado */}
                <div>
                  <span style={labelSt}>Valor total acordado no repasse (R$)</span>
                  <input type="text" inputMode="decimal" value={repasseValor} onChange={e => setRepasseValor(e.target.value)}
                    placeholder="Ex: 85,00" style={inputSt} />
                  <div style={{ fontSize:10, color:"rgba(255,92,26,.7)", fontFamily:"'DM Mono',monospace", marginTop:6, lineHeight:1.5 }}>
                    ⚠ Repasses com valor adicional cobrado não serão autorizados.
                  </div>
                </div>

                {/* Comprovação */}
                <div>
                  <span style={labelSt}>Comprovação do repasse (print da conversa)</span>
                  <label style={{ display:"flex", alignItems:"center", gap:10, background: repasseComprovante ? "rgba(186,255,57,.06)" : "rgba(245,240,232,.03)", border:`1px dashed ${repasseComprovante ? "rgba(186,255,57,.3)" : "rgba(245,240,232,.15)"}`, borderRadius:8, padding:"12px 14px", cursor:"pointer", transition:"all .12s" }}>
                    <input type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={e => setRepasseComprovante(e.target.files[0] || null)} />
                    <span style={{ fontSize:18, opacity:.5, flexShrink:0 }}>{repasseComprovante ? "✓" : "+"}</span>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontSize:12, fontFamily:"'DM Mono',monospace", color: repasseComprovante ? "#BAFF39" : "rgba(245,240,232,.45)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {repasseComprovante ? repasseComprovante.name : "Selecionar arquivo"}
                      </div>
                      <div style={{ fontSize:10, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace" }}>Imagem ou PDF</div>
                    </div>
                  </label>
                </div>

                {/* Observações */}
                <div>
                  <span style={labelSt}>Observações (opcional)</span>
                  <textarea value={repasseObs} onChange={e => setRepasseObs(e.target.value)}
                    placeholder="Alguma informação adicional..."
                    rows={2} style={{ ...inputSt, resize:"vertical" }} />
                </div>

                {/* Checkbox de ciente */}
                <div onClick={() => setRepasseCiente(p => !p)}
                  style={{ display:"flex", alignItems:"flex-start", gap:12, background: repasseCiente ? "rgba(186,255,57,.04)" : "rgba(245,240,232,.02)", border:`1px solid ${repasseCiente ? "rgba(186,255,57,.2)" : "rgba(245,240,232,.1)"}`, borderRadius:10, padding:"14px", cursor:"pointer", transition:"all .12s" }}>
                  <div style={{ width:18, height:18, borderRadius:4, flexShrink:0, marginTop:1, background: repasseCiente ? "#BAFF39" : "transparent", border:`2px solid ${repasseCiente ? "#BAFF39" : "rgba(245,240,232,.25)"}`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .12s" }}>
                    {repasseCiente && <span style={{ fontSize:11, color:"#111", fontWeight:900, lineHeight:1 }}>✓</span>}
                  </div>
                  <div style={{ fontSize:11, color:"rgba(245,240,232,.65)", fontFamily:"'DM Mono',monospace", lineHeight:1.7 }}>
                    Eu, <strong style={{ color:"#F5F0E8" }}>{user.nome || user.cog}</strong>, sou responsável por repassar todas as informações e regras da CEG do item ao novo dono. Estou ciente de que o item será enviado para outra pessoa, <strong style={{ color:"#F5F0E8" }}>sem possibilidade de cancelamento</strong>.
                  </div>
                </div>

                {repasseErro && <div style={{ fontSize:11, color:"#ff6b6b", fontFamily:"'DM Mono',monospace" }}>{repasseErro}</div>}

                {(() => {
                  const disabled = repasseStatus === "enviando" || !repasseItem || !repasseNovoDono || repasseQuitado === null || !repasseValor || !repasseComprovante || !repasseCiente || (isOutros && (!repasseOutrosNome.trim() || !repasseOutrosCeg.trim()));
                  return (
                    <button onClick={handleSubmitRepasse} disabled={disabled}
                      style={{ background:"var(--laranja)", color:"#000", border:"none", borderRadius:8, padding:"12px 0", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:900, cursor:"pointer", opacity: disabled ? 0.4 : 1, transition:"opacity .12s", width:"100%" }}>
                      {repasseStatus === "enviando" ? "Enviando..." : "Enviar repasse"}
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })()}

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
                    <div style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{s.metodo || "—"}{s.grupo_envio_codigo && <span style={{ marginLeft:8, color:"#C9A8F0" }}>👥 {s.grupo_envio_codigo}</span>}</div>
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

                {s.status === "enviado" && s.rastreio_codigo && (
                  <div style={{ marginBottom:14, background:"rgba(186,255,57,.08)", border:"2px solid rgba(186,255,57,.35)", borderRadius:12, padding:"16px", fontFamily:"'DM Mono',monospace" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                      <span style={{ fontSize:18 }}>📦</span>
                      <span style={{ fontSize:10, fontWeight:700, color:"#BAFF39", letterSpacing:"1.5px", textTransform:"uppercase" }}>Pedido Enviado · Rastreio</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                      <div style={{ flex:1, background:"rgba(0,0,0,.4)", border:"1px solid rgba(186,255,57,.25)", borderRadius:7, padding:"10px 12px", fontSize:15, fontWeight:900, color:"#F5F0E8", letterSpacing:".1em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {s.rastreio_codigo}
                      </div>
                      <button onClick={() => navigator.clipboard.writeText(s.rastreio_codigo)} style={{ flexShrink:0, padding:"10px 14px", background:"rgba(186,255,57,.15)", color:"#BAFF39", border:"1px solid rgba(186,255,57,.35)", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                        Copiar
                      </button>
                    </div>
                    {s.rastreio_link && (
                      <a href={s.rastreio_link} target="_blank" rel="noopener noreferrer" style={{ display:"block", textAlign:"center", padding:"12px", background:"rgba(186,255,57,.18)", color:"#BAFF39", border:"1px solid rgba(186,255,57,.4)", borderRadius:8, fontSize:12, fontWeight:700, textDecoration:"none", letterSpacing:".05em" }}>
                        Rastrear encomenda →
                      </a>
                    )}
                  </div>
                )}

                {/* Código do grupo */}
                {s.grupo_envio_codigo && (
                  <div style={{ background:"rgba(201,168,240,.06)", border:"1px solid rgba(201,168,240,.2)", borderRadius:8, padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                    <div>
                      <div style={{ fontSize:9, color:"#C9A8F0", fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase", marginBottom:3 }}>👥 Envio em grupo</div>
                      <div style={{ fontSize:16, fontWeight:900, color:"#C9A8F0", fontFamily:"'DM Mono',monospace", letterSpacing:"3px" }}>{s.grupo_envio_codigo}</div>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(s.grupo_envio_codigo)}
                      style={{ background:"rgba(201,168,240,.12)", border:"1px solid rgba(201,168,240,.25)", color:"#C9A8F0", borderRadius:7, padding:"6px 14px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", whiteSpace:"nowrap" }}>
                      Copiar código
                    </button>
                  </div>
                )}

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
                  const formaCor = { "PAC":"#003DA5","SEDEX":"#E87722","Correios":"#003DA5","Jadlog":"#E63946","JADLOG":"#E63946","Mini Envios":"#6B7280","Busca":"#6B7280" };
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
                              {s.status === "pagamento em aberto" && (() => {
                                const PIX_KEY  = "de1a489d-db81-4864-a8cf-74cdd79d9cdc";
                                const totalPix = (pf(s.modalidade_escolhida.valor)+emb).toFixed(2).replace(".",",");
                                return (
                                  <>
                                    <div style={{ background:"rgba(186,255,57,.05)", border:"1px solid rgba(186,255,57,.18)", borderRadius:8, padding:"12px 14px", marginTop:8 }}>
                                      <div style={{ fontSize:9, color:"#BAFF39", letterSpacing:"1px", fontFamily:"'DM Mono',monospace", marginBottom:8 }}>CHAVE PIX — MERCADO PAGO</div>
                                      <div style={{ fontSize:10, color:"rgba(245,240,232,.5)", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>Fernanda Gomes Medeiros · R$ {totalPix}</div>
                                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                                        <div style={{ flex:1, background:"rgba(0,0,0,.35)", border:"1px solid rgba(245,240,232,.12)", borderRadius:5, padding:"7px 10px", fontSize:10, fontFamily:"'DM Mono',monospace", color:"#F5F0E8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{PIX_KEY}</div>
                                        <button onClick={() => { navigator.clipboard.writeText(PIX_KEY); }} style={{ flexShrink:0, padding:"7px 12px", background:"rgba(186,255,57,.14)", color:"#BAFF39", border:"1px solid rgba(186,255,57,.3)", borderRadius:5, fontFamily:"'DM Mono',monospace", fontSize:10, fontWeight:700, cursor:"pointer" }}>Copiar</button>
                                      </div>
                                    </div>
                                    <a href={`https://wa.me/5524992782023?text=${encodeURIComponent(`Olá! Segue o comprovante de pagamento do meu envio.\n\nNome: ${s.joiner_nome}\nModalidade: ${s.modalidade_escolhida.forma} (${s.modalidade_escolhida.prazo})\nValor pago: R$ ${totalPix}`)}`} target="_blank" rel="noopener noreferrer" style={{ display:"block", textAlign:"center", padding:"11px", background:"rgba(201,168,240,.12)", color:"#C9A8F0", border:"1px solid rgba(201,168,240,.3)", borderRadius:7, fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, textDecoration:"none", marginTop:6 }}>
                                      📎 Enviar comprovante no WhatsApp →
                                    </a>
                                  </>
                                );
                              })()}
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
                                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                      <div style={{ width:36, height:36, borderRadius:8, background: formaCor[op.forma] || "#555", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                        <span style={{ fontSize:9, fontWeight:900, color:"#fff", letterSpacing:"-.5px", textAlign:"center", lineHeight:1.1 }}>{(op.forma||"").slice(0,3).toUpperCase()}</span>
                                      </div>
                                      <div>
                                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                                          <span style={{ fontSize:12, fontWeight:700, color:"#F5F0E8" }}>{op.forma}</span>
                                          {isBest && opcoes.length > 1 && <span style={{ fontSize:9, background:"#BAFF39", color:"#111", borderRadius:3, padding:"1px 6px", fontWeight:700 }}>Melhor preço</span>}
                                          {isSelected && <span style={{ fontSize:9, background:"#C9A8F0", color:"#111", borderRadius:3, padding:"1px 6px", fontWeight:700 }}>✓ Selecionado</span>}
                                        </div>
                                        <div style={{ fontSize:10, color:"rgba(245,240,232,.4)" }}>Até {op.prazo}</div>
                                      </div>
                                    </div>
                                    <div style={{ textAlign:"right" }}>
                                      <div style={{ fontSize:15, fontWeight:900, color: isSelected ? "#C9A8F0" : isBest ? "#BAFF39" : "#F5F0E8" }}>R$ {total}</div>
                                      {op.valor_original && <div style={{ fontSize:10, color:"rgba(245,240,232,.3)", textDecoration:"line-through" }}>R$ {pf(op.valor_original).toFixed(2).replace(".",",")}</div>}
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
                                    window.open(`https://wa.me/5524992782023?text=${waMsg}`, "_blank");
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
                </div>}
              </div>
            );
          })}
        </div>
      )}

      {perfilSubTab === "badges" && (() => {
        const badges = computeBadges({ itens: meusItens, envios: meuEnvios, pagamentos: meusPagamentos, reports: meuReports, multasPagas: multasPagasCount, cog: user.cog });
        return (
          <div style={{ paddingBottom: 40 }}>
            <BadgesRow badges={badges} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {badges.map(b => (
                <div key={b.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--card-bg)", border: `1px solid ${b.earned ? "rgba(186,255,57,.18)" : "rgba(245,240,232,.07)"}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ width: 44, height: 39, flexShrink: 0, clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", background: b.earned ? (b.color === "dourado" ? "linear-gradient(160deg, #FFE9A8, #D4AF37)" : "#fff") : "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", background: "#fff" }}>
                      <img src={b.img} alt={b.label} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.65)", opacity: b.earned ? 1 : .4, filter: b.earned ? "none" : "grayscale(1)" }} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: "var(--offwhite)", letterSpacing: .5 }}>{b.label}</span>
                      <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", fontWeight: 700, letterSpacing: ".05em", padding: "2px 7px", borderRadius: 4, textTransform: "uppercase", color: b.earned ? "var(--verde)" : "rgba(245,240,232,.4)", background: b.earned ? "rgba(186,255,57,.1)" : "rgba(245,240,232,.06)" }}>
                        {b.earned ? "✓ Conquistado" : "Bloqueado"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(245,240,232,.55)", lineHeight: 1.5 }}>{b.detalhe}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {perfilSubTab === "historico" && (() => {
        function fmtDataHora(iso) {
          if (!iso) return "—";
          const d = new Date(iso);
          return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        }

        // CEGs (sem timestamp — painel separado)
        const cegsParticipando = [...new Set(meusItens.map(i => i.ceg))].sort();

        // Monta lista unificada de eventos com timestamp
        const eventos = [];

        // Reports
        (meuReports || []).forEach(r => {
          if (r.created_at) eventos.push({ tipo: "report", ts: r.created_at, item: r.item_nome, ceg: r.ceg, status: r.status });
        });

        // Pagamentos enviados
        meusPagamentos.forEach(p => {
          if (p.created_at) {
            const total = (p.itens || []).reduce((s, it) => s + Number(it.valor_item || 0) + Number(it.frete_inter || 0) + Number(it.taxa_rf || 0), 0);
            eventos.push({ tipo: "pagamento", ts: p.created_at, status: p.status, total, itens: p.itens || [] });
          }
        });

        // Envios
        meuEnvios.forEach(e => {
          if (e.created_at) eventos.push({ tipo: "envio", ts: e.created_at, status: e.status, opcao: e.opcao_escolhida });
        });

        // Repassos
        meusRepassos.forEach(r => {
          if (r.created_at) eventos.push({ tipo: "repasse", ts: r.created_at, item: r.nome_do_item, ceg: r.ceg, status: r.status });
        });

        // Feedbacks
        (meusFeedbacks || []).forEach(f => {
          if (f.created_at) eventos.push({ tipo: "feedback", ts: f.created_at, tipo_fb: f.tipo, msg: f.message });
        });

        eventos.sort((a, b) => new Date(b.ts) - new Date(a.ts));

        const ICONS  = { report: "⚑", pagamento: "◎", envio: "◫", repasse: "⇄", feedback: "✉" };
        const COLORS = { report: "#e85c1a", pagamento: "#BAFF39", envio: "#60a5fa", repasse: "#fb923c", feedback: "#a3e635" };
        const LABELS = { report: "Report", pagamento: "Pagamento", envio: "Envio", repasse: "Repasse", feedback: "Feedback" };

        function descEvento(ev) {
          if (ev.tipo === "report") return `Report: ${ev.item || "item"}${ev.ceg ? ` · ${ev.ceg}` : ""}`;
          if (ev.tipo === "pagamento") {
            const n = ev.itens.length;
            return `Pagamento enviado — ${n} item(s)${ev.total > 0 ? ` · R$${fmtBRL(ev.total)}` : ""}`;
          }
          if (ev.tipo === "envio") return `Solicitação de envio${ev.opcao ? ` · ${ev.opcao}` : ""}`;
          if (ev.tipo === "repasse") return `Repasse: ${ev.item || "item"}${ev.ceg ? ` · ${ev.ceg}` : ""}`;
          if (ev.tipo === "feedback") return `Feedback (${ev.tipo_fb || "sugestão"})`;
          return "";
        }

        function badgeStatus(ev) {
          if (!ev.status) return null;
          const statusMap = {
            pago: { label: "pago", color: "#BAFF39" },
            em_analise: { label: "em análise", color: "#fbbf24" },
            rejeitado: { label: "rejeitado", color: "#f87171" },
            pendente: { label: "pendente", color: "#94a3b8" },
            enviado: { label: "enviado", color: "#60a5fa" },
            embalando: { label: "embalando", color: "#a78bfa" },
            cancelado: { label: "cancelado", color: "#f87171" },
            resolvido: { label: "resolvido", color: "#BAFF39" },
          };
          const s = statusMap[ev.status];
          return s ? <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: s.color, border: `1px solid ${s.color}44`, borderRadius: 4, padding: "1px 7px", marginLeft: 6, letterSpacing: "0.5px" }}>{s.label}</span> : null;
        }

        return (
          <div>
            <h3 className="admin-title" style={{ fontSize: 15, marginBottom: 16 }}>Histórico de atividades</h3>

            {/* Painel de CEGs (sem timestamp disponível na tabela) */}
            {cegsParticipando.length > 0 && (
              <div style={{ marginBottom: 28, padding: "14px 16px", background: "rgba(201,168,240,.05)", border: "1px solid rgba(201,168,240,.12)", borderRadius: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "#C9A8F0", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>◈ CEGs participando ({cegsParticipando.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {cegsParticipando.map(c => (
                    <span key={c} style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "#F5F0E8", background: "rgba(201,168,240,.1)", border: "1px solid rgba(201,168,240,.2)", borderRadius: 5, padding: "3px 10px" }}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {eventos.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(245,240,232,.3)", fontFamily: "'DM Mono',monospace", fontSize: 12, padding: "60px 0" }}>Nenhuma atividade registrada ainda.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
              {/* linha vertical */}
              {eventos.length > 0 && <div style={{ position: "absolute", left: 17, top: 10, bottom: 10, width: 1, background: "rgba(245,240,232,.07)", zIndex: 0 }} />}
              {eventos.map((ev) => (
                <div key={`${ev.tipo}-${ev.ts}`} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0", position: "relative", zIndex: 1 }}>
                  {/* dot + icon */}
                  <div style={{ width: 35, height: 35, borderRadius: "50%", background: "#181614", border: `1px solid ${COLORS[ev.tipo]}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, color: COLORS[ev.tipo] }}>
                    {ICONS[ev.tipo]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: COLORS[ev.tipo], letterSpacing: "1px", textTransform: "uppercase" }}>{LABELS[ev.tipo]}</span>
                      {badgeStatus(ev)}
                    </div>
                    <div style={{ fontSize: 12, color: "#F5F0E8", fontFamily: "'DM Mono',monospace", lineHeight: 1.4, wordBreak: "break-word" }}>{descEvento(ev)}</div>
                    <div style={{ fontSize: 10, color: "rgba(245,240,232,.3)", fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{fmtDataHora(ev.ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {perfilSubTab === "dados" && (
        <div className="login-box" style={{ gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid #1e1e1e" }}>
            <div className="avatar-perfil" onClick={() => fileInputRef.current.click()} title="Clique para trocar a foto">
              <img src={fotoUrl || bonequinha} alt="foto de perfil" />
              <div className="avatar-perfil-overlay">{fotoLoading ? "..." : "trocar"}</div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFotoUpload} />
            <button type="button" onClick={() => fileInputRef.current.click()} disabled={fotoLoading} style={{ background:"rgba(245,240,232,.07)", border:"1px solid rgba(245,240,232,.15)", color:"var(--offwhite)", borderRadius:6, padding:"8px 16px", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer", letterSpacing:".03em" }}>
              {fotoLoading ? "Enviando..." : "Alterar foto"}
            </button>
            {fotoErro && <div style={{ fontSize:11, color:"var(--laranja)", textAlign:"center", maxWidth:280, lineHeight:1.5 }}>{fotoErro}</div>}
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
        <div>
          <div style={{ position:"relative", width:"100%", paddingBottom:"56.25%", borderRadius:10, overflow:"hidden", background:"#000" }}>
            <iframe
              src="https://drive.google.com/file/d/15A_JdCaKfpT2ZNm0ccMrA39-VGIL1tMt/preview"
              title="Tutorial ANTICEG"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", border:"none" }}
            />
          </div>
        </div>
      )}

      {perfilSubTab === "feedback" && (
        <div>
          {/* Sub-abas */}
          <div style={{ display:"flex", gap:8, marginBottom:20, overflowX:"auto", paddingBottom:2 }}>
            {[["enviar","◎ Enviar"],["historico","≡ Histórico"]].map(([id, label]) => {
              const respondidos = id === "historico" && (meusFeedbacks || []).filter(f => f.resposta).length;
              return (
                <button key={id} onClick={() => setFeedbackSubTab(id)}
                  style={{ fontSize:11, fontFamily:"'DM Mono',monospace", padding: isMobile ? "7px 18px" : "5px 14px", borderRadius:20, cursor:"pointer", border: feedbackSubTab===id ? "1px solid var(--laranja)" : "1px solid rgba(245,240,232,.12)", background: feedbackSubTab===id ? "rgba(255,92,26,.12)" : "transparent", color: feedbackSubTab===id ? "var(--laranja)" : "rgba(245,240,232,.4)", fontWeight: feedbackSubTab===id ? 700 : 400, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6 }}>
                  {label}
                  {respondidos > 0 && <span style={{ background:"#A78BFA", color:"#000", borderRadius:99, fontSize:9, fontWeight:700, padding:"1px 6px" }}>{respondidos}</span>}
                </button>
              );
            })}
          </div>

          {feedbackSubTab === "enviar" && (
            <FeedbackForm user={user} defaultTipo={feedbackTipo} onSent={() => {
              supabase.from("feedbacks").select("id, tipo, message, resposta, created_at").eq("joiner_cog", user.cog).order("created_at", { ascending: false })
                .then(({ data }) => { setMeusFeedbacks(data || []); setFeedbackSubTab("historico"); });
            }} />
          )}

          {feedbackSubTab === "historico" && (
            meusFeedbacks === null
              ? <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"20px 0" }}>carregando...</div>
              : meusFeedbacks.length === 0
                ? <div style={{ textAlign:"center", padding:"40px 0", fontSize:12, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>Nenhum feedback enviado ainda.</div>
                : meusFeedbacks.map(fb => {
                    const tipoColor = { bug:"var(--laranja)", sugestão:"#64B5F6", elogio:"#4ade80" }[fb.tipo] || "rgba(245,240,232,.4)";
                    return (
                      <div key={fb.id} style={{ background:"var(--card-bg)", border:`1px solid ${fb.resposta ? "rgba(167,139,250,.2)" : "rgba(245,240,232,.07)"}`, borderRadius:10, padding:"14px 16px", marginBottom:10 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                          <span style={{ fontSize:9, color:tipoColor, border:`1px solid ${tipoColor}55`, borderRadius:4, padding:"2px 7px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase" }}>{fb.tipo}</span>
                          {fb.resposta && <span style={{ fontSize:9, color:"#A78BFA", border:"1px solid rgba(167,139,250,.3)", borderRadius:4, padding:"2px 7px", fontFamily:"'DM Mono',monospace" }}>↩ respondido</span>}
                          <span style={{ fontSize:9, color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", marginLeft:"auto" }}>{new Date(fb.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <div style={{ fontSize:12, color:"rgba(245,240,232,.65)", fontFamily:"'DM Mono',monospace", lineHeight:1.6, marginBottom: fb.resposta ? 12 : 0 }}>{fb.message}</div>
                        {fb.resposta && (
                          <div style={{ background:"rgba(167,139,250,.07)", border:"1px solid rgba(167,139,250,.18)", borderRadius:7, padding:"10px 14px" }}>
                            <div style={{ fontSize:9, color:"rgba(167,139,250,.55)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".08em", marginBottom:5 }}>↩ Resposta da Nanda</div>
                            <div style={{ fontSize:12, color:"rgba(245,240,232,.8)", fontFamily:"'DM Mono',monospace", lineHeight:1.7 }}>{fb.resposta}</div>
                          </div>
                        )}
                      </div>
                    );
                  })
          )}
        </div>
      )}

      {perfilSubTab === "suporte" && (() => {
        const toggleReport = id => setExpandedReports(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

        const ERRO_LABELS = { erro_item:"Nome do item", erro_valor:"Valor do item", erro_frete:"Frete", erro_taxa:"Taxa RF", erro_pagamento:"Pagamento", erro_recebido:"Item recebido", erro_outro:"Outro" };

        return (
          <div>
            <div style={{ fontSize:12, color:"rgba(245,240,232,.45)", lineHeight:1.7, marginBottom:20 }}>
              Seus reports de itens ficam aqui. A gente analisa cada um e entra em contato quando estiver resolvido.
            </div>
            {meuReports === null ? (
              <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"20px 0" }}>carregando...</div>
            ) : meuReports.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 0", fontSize:12, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>Nenhum report enviado ainda.</div>
            ) : meuReports.map(r => {
              const resolvido = r.status === "resolvido";
              const expanded  = expandedReports.has(r.id);
              const errosMarcados = Object.keys(ERRO_LABELS).filter(k => r[k]);
              const temDetalhes = errosMarcados.length > 0 || r.observacao;
              return (
                <div key={r.id} style={{ background:"var(--card-bg)", border:`1px solid ${resolvido ? "rgba(74,222,128,.12)" : "rgba(245,240,232,.07)"}`, borderRadius:8, marginBottom:8, overflow:"hidden" }}>
                  {/* Header — clicável se tiver detalhes */}
                  <div onClick={() => temDetalhes && toggleReport(r.id)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", cursor: temDetalhes ? "pointer" : "default" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace" }}>{r.item_nome || r.ceg || "—"}</div>
                      <div style={{ fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>
                        {r.ceg && <span style={{ marginRight:8 }}>{r.ceg}</span>}
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                      <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", whiteSpace:"nowrap", padding:"3px 9px", borderRadius:4, color: resolvido ? "#4ade80" : "rgba(245,240,232,.5)", border:`1px solid ${resolvido ? "rgba(74,222,128,.35)" : "rgba(245,240,232,.15)"}`, background: resolvido ? "rgba(74,222,128,.07)" : "transparent" }}>
                        {resolvido ? "✓ resolvido" : "🔍 em análise"}
                      </span>
                      {temDetalhes && <span style={{ fontSize:11, color:"rgba(245,240,232,.3)" }}>{expanded ? "▲" : "▼"}</span>}
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {expanded && temDetalhes && (
                    <div style={{ borderTop:"1px solid rgba(245,240,232,.06)", padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                      {errosMarcados.length > 0 && (
                        <div>
                          <div style={{ fontSize:9, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:6 }}>Problemas reportados</div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                            {errosMarcados.map(k => (
                              <span key={k} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", padding:"2px 9px", borderRadius:4, border:"1px solid rgba(255,92,26,.3)", color:"rgba(255,92,26,.8)", background:"rgba(255,92,26,.06)" }}>
                                {ERRO_LABELS[k]}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {r.motivo_item    && <div><div style={{ fontSize:9, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:3 }}>Motivo</div><div style={{ fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace", lineHeight:1.6 }}>{r.motivo_item}</div></div>}
                      {r.correcao_valor && <div><div style={{ fontSize:9, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:3 }}>Valor correto</div><div style={{ fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace" }}>{r.correcao_valor}</div></div>}
                      {r.correcao_frete && <div><div style={{ fontSize:9, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:3 }}>Frete correto</div><div style={{ fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace" }}>{r.correcao_frete}</div></div>}
                      {r.correcao_taxa  && <div><div style={{ fontSize:9, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:3 }}>Taxa correta</div><div style={{ fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace" }}>{r.correcao_taxa}</div></div>}
                      {r.pag_valor      && <div><div style={{ fontSize:9, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:3 }}>Pagamento informado</div><div style={{ fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace" }}>R$ {r.pag_valor}{r.pag_metodo ? ` · ${r.pag_metodo}` : ""}{r.pag_data ? ` · ${r.pag_data}` : ""}</div></div>}
                      {r.observacao     && <div><div style={{ fontSize:9, letterSpacing:"1px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:3 }}>Observação</div><div style={{ fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace", lineHeight:1.6, fontStyle:"italic" }}>{r.observacao}</div></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {perfilSubTab === "staff" && owner && <StaffPanel />}

        </div>{/* admin-content */}
      </div>{/* admin-layout */}
    </div>
  );
}

function CalendarTab({ user, itens, calEventos, setCalEventos }) {
  const now = new Date();
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calView, setCalView]   = useState("geral");
  const [allItens, setAllItens] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    (async () => {
      let all = [], from = 0;
      while (true) {
        const { data } = await supabase.from("masterlist")
          .select("ceg, venc_item, venc_frete, venc_rf, pago_item, pago_frete, pago_rf")
          .or("venc_item.not.is.null,venc_frete.not.is.null,venc_rf.not.is.null")
          .range(from, from + 999);
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
  (calEventos || []).forEach(ev => {
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
        <div className="regras-contato-box" style={{ background: "var(--card-bg)", border: "1px solid rgba(245,240,232,.08)", borderRadius: 8, padding: 24 }}>
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
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 900, width: "calc(100% - 48px)", maxWidth: 520, background: "var(--card-bg)", border: "1px solid rgba(74,222,128,.3)", borderRadius: 12, padding: "16px 20px", boxShadow: "0 8px 32px rgba(0,0,0,.6)" }}>
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

function PushListFiltrada({ pushes, onDesativar, onReativar }) {
  const [filtro, setFiltro] = useState("ativos");
  const isConsumed = p => p.joiner_cog && (p.push_reads?.length ?? 0) > 0;
  const ativos    = pushes.filter(p => p.active && !isConsumed(p));
  const inativos  = pushes.filter(p => !p.active && !isConsumed(p));
  const lista     = filtro === "ativos" ? ativos : inativos;
  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        {[["ativos", ativos.length], ["desativados", inativos.length]].map(([key, count]) => (
          <button key={key} onClick={() => setFiltro(key)} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", padding:"4px 12px", borderRadius:20, cursor:"pointer", border: filtro === key ? "1px solid var(--laranja)" : "1px solid rgba(245,240,232,.12)", background: filtro === key ? "rgba(255,92,26,.1)" : "transparent", color: filtro === key ? "var(--laranja)" : "rgba(245,240,232,.4)", fontWeight: filtro === key ? 700 : 400 }}>
            {key} ({count})
          </button>
        ))}
      </div>
      {lista.length === 0
        ? <div style={{ fontSize:12, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>Nenhum aviso {filtro}.</div>
        : lista.map(p => <PushAdminCard key={p.id} p={p} onDesativar={() => onDesativar(p.id)} onReativar={() => onReativar(p.id)} />)
      }
    </div>
  );
}

function PushAdminCard({ p, onDesativar, onReativar }) {
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
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: p.active ? "var(--offwhite)" : "rgba(245,240,232,.35)" }}>{p.message}</div>
          <div style={{ marginTop: 5 }}>
            {p.joiner_cog
              ? <span style={{ fontSize: 9, fontFamily:"'DM Mono',monospace", background:"rgba(201,168,240,.1)", border:"1px solid rgba(201,168,240,.25)", borderRadius:4, padding:"2px 7px", color:"var(--lilas)", letterSpacing:".05em" }}>→ @{p.joiner_cog}</span>
              : <span style={{ fontSize: 9, fontFamily:"'DM Mono',monospace", background:"rgba(255,92,26,.08)", border:"1px solid rgba(255,92,26,.2)", borderRadius:4, padding:"2px 7px", color:"var(--laranja)", letterSpacing:".05em" }}>→ todas as joiners</span>
            }
          </div>
        </div>
        <div style={{ fontSize: 10, color: "rgba(245,240,232,.25)", whiteSpace: "nowrap" }}>{new Date(p.created_at).toLocaleDateString("pt-BR")}</div>
        <button onClick={verLeituras} style={{ background: "none", border: "1px solid rgba(245,240,232,.1)", color: "rgba(245,240,232,.35)", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer", whiteSpace: "nowrap" }}>
          {aberto ? "▴ ocultar" : "▾ quem viu"}
        </button>
        {p.active
          ? <button onClick={onDesativar} style={{ background: "none", border: "1px solid rgba(245,240,232,.1)", color: "rgba(245,240,232,.3)", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>desativar</button>
          : <button onClick={onReativar} style={{ background: "rgba(186,255,57,.07)", border: "1px solid rgba(186,255,57,.2)", color: "#BAFF39", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>reativar</button>
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
      const ts   = new Date().toISOString();

      // monta a lista de quem precisa receber e-mail
      const paraEnviar = [];
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
        paraEnviar.push({ j, pendentes });
      }

      // envia em lotes de 5 (respeita limite de taxa do EmailJS)
      const BATCH = 5;
      for (let i = 0; i < paraEnviar.length; i += BATCH) {
        await Promise.all(paraEnviar.slice(i, i + BATCH).map(async ({ j, pendentes }) => {
          const totalPend = pendentes.reduce((s,it) =>
            s + (isPendente(it.pago_item)  ? Number(it.valor_item||0)  : 0)
              + (isPendente(it.pago_frete) ? Number(it.frete_inter||0) : 0)
              + (isPendente(it.pago_rf)    ? Number(it.taxa_rf||0)     : 0), 0);
          const totalMulta = pendentes.reduce((s,it) =>
            s + diasAtraso(it.venc_item) + diasAtraso(it.venc_frete) + diasAtraso(it.venc_rf), 0);
          const itemRows = pendentes.map(it => {
            const v = (isPendente(it.pago_item)  ? Number(it.valor_item||0)  : 0)
                    + (isPendente(it.pago_frete) ? Number(it.frete_inter||0) : 0)
                    + (isPendente(it.pago_rf)    ? Number(it.taxa_rf||0)     : 0);
            return `<tr><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#F5F0E8">${it.nome_do_item}${it.ceg ? `<div style="font-size:10px;color:rgba(245,240,232,0.3);margin-top:2px">${it.ceg}</div>` : ""}</td><td style="padding:11px 0;border-bottom:1px solid #1e1e1e;text-align:right;white-space:nowrap;font-size:12px;color:#FF5C1A">R$&nbsp;${fmtBRL(v)}</td></tr>`;
          }).join("");
          const emailContent = `<tr><td style="background:#111111;padding:20px 40px 8px">
  <p style="margin:0 0 18px;font-size:13px;color:rgba(245,240,232,0.65);line-height:1.6">Constam em seu portal os seguintes itens com pagamento em aberto:</p>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #1e1e1e">${itemRows}<tr><td colspan="2" style="padding:16px 0 8px;text-align:right"><div style="font-size:10px;color:rgba(245,240,232,0.3);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Total em aberto</div><div style="font-size:26px;font-weight:900;color:#BAFF39">R$&nbsp;${fmtBRL(totalPend + totalMulta)}</div>${totalMulta > 0 ? `<div style="font-size:10px;color:rgba(255,92,26,0.7);margin-top:4px">R$&nbsp;${fmtBRL(totalPend)} item + R$&nbsp;${fmtBRL(totalMulta)} multa</div>` : ""}</td></tr></table>
</td></tr>`;
          const corpo = buildEmailHTML(j.nome || j.cog, emailContent);
          await Promise.all([
            sendEmailJoiner(j.email, j.nome, "📋 Pagamentos em aberto — ANTICEG", corpo),
            supabase.from("joiners").update({ last_notified_at: ts }).eq("cog", j.cog),
          ]);
          enviados++;
        }));
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
          <div style={{ overflowX:"auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto auto auto", gap:0, minWidth:480,
            background:"rgba(245,240,232,.04)", padding:"6px 12px",
            fontSize:9, letterSpacing:"1px", textTransform:"uppercase", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>
            <span>Nome</span><span>@</span><span>E-mail</span><span style={{ textAlign:"center" }}>Itens</span><span style={{ textAlign:"right" }}>Total</span><span></span>
          </div>
          {lista.length === 0
            ? <div style={{ padding:"12px", fontSize:11, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace" }}>Nenhum joiner com pagamento pendente e e-mail cadastrado.</div>
            : lista.map((r, i) => (
              <div key={r.cog} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto auto auto", gap:0, minWidth:480,
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
          </div>
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

function ProximoEnvioBlock() {
  const [texto,  setTexto]  = useState("");
  const [inicio, setInicio] = useState("");
  const [fim,    setFim]    = useState("");
  const [saving,  setSaving]  = useState(false);
  const [ok,      setOk]      = useState(false);
  const [bannerOn, setBannerOn] = useState(true);

  useEffect(() => {
    supabase.from("config").select("key,value").in("key", ["proximo_envio","envio_abertura_inicio","envio_abertura_fim","banner_envio_visivel"])
      .then(({ data }) => {
        if (!data) return;
        data.forEach(r => {
          if (r.key === "proximo_envio")        setTexto(r.value  || "");
          if (r.key === "envio_abertura_inicio") setInicio(r.value || "");
          if (r.key === "envio_abertura_fim")    setFim(r.value    || "");
          if (r.key === "banner_envio_visivel")  setBannerOn(r.value !== "false");
        });
      });
  }, []);

  function fmtDate(iso) {
    if (!iso) return "";
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  async function salvar() {
    setSaving(true);
    const textoFinal = texto.trim() || (inicio && fim ? `${fmtDate(inicio)} a ${fmtDate(fim)}` : "");
    await Promise.all([
      supabase.from("config").upsert({ key:"proximo_envio",         value: textoFinal }, { onConflict:"key" }),
      supabase.from("config").upsert({ key:"envio_abertura_inicio", value: inicio     }, { onConflict:"key" }),
      supabase.from("config").upsert({ key:"envio_abertura_fim",    value: fim        }, { onConflict:"key" }),
    ]);
    if (!texto.trim() && textoFinal) setTexto(textoFinal);
    setSaving(false); setOk(true); setTimeout(() => setOk(false), 2500);
  }

  async function limpar() {
    setTexto(""); setInicio(""); setFim("");
    await Promise.all([
      supabase.from("config").upsert({ key:"proximo_envio",         value:"" }, { onConflict:"key" }),
      supabase.from("config").upsert({ key:"envio_abertura_inicio", value:"" }, { onConflict:"key" }),
      supabase.from("config").upsert({ key:"envio_abertura_fim",    value:"" }, { onConflict:"key" }),
    ]);
  }

  async function toggleBanner() {
    const novoValor = !bannerOn;
    setBannerOn(novoValor);
    await supabase.from("config").upsert({ key:"banner_envio_visivel", value: novoValor ? "true" : "false" }, { onConflict:"key" });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const ativo = inicio && fim && hoje >= inicio && hoje <= fim;

  return (
    <div style={{ marginBottom:20, padding:"14px 16px", background:"var(--card-bg)", border:`1px solid ${ativo ? "rgba(186,255,57,.25)" : "rgba(100,181,246,.15)"}`, borderRadius:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)" }}>Próximo round de Envio Nacional</div>
        {ativo && <span style={{ fontSize:10, background:"rgba(186,255,57,.15)", border:"1px solid rgba(186,255,57,.3)", color:"#BAFF39", borderRadius:4, padding:"2px 8px", fontFamily:"'DM Mono',monospace" }}>● ABERTO AGORA</span>}
      </div>
      <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", marginBottom:12 }}>
        Defina o período → o forms abre e fecha automaticamente. O texto de exibição é preenchido automaticamente (ou edite manualmente).
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginBottom:4 }}>ABERTURA</div>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)}
            style={{ width:"100%", boxSizing:"border-box", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.12)", borderRadius:8, padding:"8px 10px", color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none", colorScheme:"dark" }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginBottom:4 }}>ENCERRAMENTO</div>
          <input type="date" value={fim} onChange={e => setFim(e.target.value)}
            style={{ width:"100%", boxSizing:"border-box", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.12)", borderRadius:8, padding:"8px 10px", color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none", colorScheme:"dark" }} />
        </div>
      </div>

      <div style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>TEXTO DE EXIBIÇÃO (opcional — preenchido auto se vazio)</div>
      <input type="text" value={texto} onChange={e => setTexto(e.target.value)}
        placeholder="Ex: 03/07 a 05/07 · ou deixe vazio para gerar automaticamente"
        style={{ width:"100%", boxSizing:"border-box", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.12)", borderRadius:8, padding:"9px 14px", color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none" }}
      />

      <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap", alignItems:"center" }}>
        <button onClick={salvar} disabled={saving} style={{ background:"rgba(100,181,246,.12)", border:"1px solid rgba(100,181,246,.3)", color:"#64B5F6", borderRadius:8, padding:"7px 18px", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer" }}>
          {saving ? "..." : ok ? "✓ Salvo" : "Salvar"}
        </button>
        <button onClick={limpar} style={{ background:"none", border:"1px solid rgba(245,240,232,.1)", color:"rgba(245,240,232,.35)", borderRadius:8, padding:"7px 14px", fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
          Limpar tudo
        </button>
        <button onClick={toggleBanner} style={{ marginLeft:"auto", background: bannerOn ? "rgba(186,255,57,.08)" : "rgba(245,240,232,.04)", border:`1px solid ${bannerOn ? "rgba(186,255,57,.25)" : "rgba(245,240,232,.12)"}`, color: bannerOn ? "#BAFF39" : "rgba(245,240,232,.35)", borderRadius:8, padding:"7px 14px", fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
          {bannerOn ? "📬 Banner visível — ocultar" : "📭 Banner oculto — mostrar"}
        </button>
      </div>
    </div>
  );
}

function AvisoMasterlistBlock() {
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.from("config").select("value").eq("key","aviso_masterlist").single()
      .then(({ data }) => { if (data?.value) setTexto(data.value); });
  }, []);

  async function salvar() {
    setSaving(true);
    await supabase.from("config").upsert({ key:"aviso_masterlist", value: texto.trim() }, { onConflict:"key" });
    setSaving(false); setOk(true); setTimeout(() => setOk(false), 2000);
  }

  async function limpar() {
    setTexto("");
    await supabase.from("config").upsert({ key:"aviso_masterlist", value:"" }, { onConflict:"key" });
  }

  return (
    <div style={{ marginBottom:20, padding:"14px 16px", background:"var(--card-bg)", border:"1px solid rgba(186,255,57,.15)", borderRadius:10 }}>
      <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)", marginBottom:4 }}>Alerta fixo da Masterlist</div>
      <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", marginBottom:12 }}>Aparece no topo para todas as joiners enquanto preenchido.</div>
      <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} placeholder="Ex: ✓ Masterlist atualizada em 27/06 às 19h03 — pagamentos conferidos"
        style={{ width:"100%", boxSizing:"border-box", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.12)", borderRadius:8, padding:"10px 14px", color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none", resize:"vertical" }} />
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <button onClick={salvar} disabled={saving} style={{ background:"rgba(186,255,57,.12)", border:"1px solid rgba(186,255,57,.3)", color:"#BAFF39", borderRadius:8, padding:"7px 18px", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer" }}>
          {saving ? "..." : ok ? "✓ Salvo" : "Salvar"}
        </button>
        <button onClick={limpar} style={{ background:"none", border:"1px solid rgba(245,240,232,.1)", color:"rgba(245,240,232,.35)", borderRadius:8, padding:"7px 14px", fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
          Limpar
        </button>
      </div>
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

function AdminTab({ owner = false, userCog = "", resetSignal = 0, calEventos, setCalEventos, initialSubTab = null, onSubTabChange }) {
  const [adminWinW, setAdminWinW] = useState(window.innerWidth);
  useEffect(() => { const h = () => setAdminWinW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  const adminIsMobile = adminWinW <= 680;
  const [manutencaoAdmin, setManutencaoAdmin] = useState(false);
  const [reports, setReports] = useState([]);
  const [adminTab, setAdminTab] = useState("pendentes");
  const [searchReport, setSearchReport] = useState("");
  const [openReportJoiner, setOpenReportJoiner] = useState(null);
  const [adminRepasseSearch,     setAdminRepasseSearch]     = useState("");
  const [adminRepasseTab,        setAdminRepasseTab]        = useState("pendentes");
  const [adminRepasseOpenJoiner, setAdminRepasseOpenJoiner] = useState(null);
  const [adminPagSubTab,         setAdminPagSubTab]         = useState("formulario");
  const [formularioFiltro,       setFormularioFiltro]       = useState("analise");
  const [fbRespostaAberta, setFbRespostaAberta] = useState(null);
  const [fbRespostaTexto,  setFbRespostaTexto]  = useState("");
  const [fbRespostaEnv,    setFbRespostaEnv]    = useState(false);
  const [adminPixCopiado,  setAdminPixCopiado]  = useState(false);
  const [badgesSearch,  setBadgesSearch]  = useState("");
  const [badgesJoiner,  setBadgesJoiner]  = useState(null);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [badgesErro,    setBadgesErro]    = useState("");
  const [adminMainTab, setAdminMainTab] = useState(initialSubTab || "home");
  useEffect(() => { setAdminMainTab("home"); }, [resetSignal]);
  useEffect(() => { onSubTabChange?.(adminMainTab); }, [adminMainTab]);
  const [pushes, setPushes] = useState(null);
  const [feedbacks, setFeedbacks] = useState(null);
  const [novoPush, setNovoPush] = useState("");
  const [sendingPush, setSendingPush] = useState(false);
  const [pushDestinatario, setPushDestinatario] = useState("todos");
  const [pushJoinerSearch, setPushJoinerSearch] = useState("");
  const [pushJoiners, setPushJoiners] = useState(null);
  const [pushJoinerSel, setPushJoinerSel] = useState(null);
  const [pendentesData, setPendentesData] = useState(null);
  const [disponiveisData, setDisponiveisData] = useState(null);
  const [joinersData, setJoinersData] = useState(null);
  const [confirmacoes, setConfirmacoes] = useState([]);
  const [preCadastros, setPreCadastros] = useState([]);
  const [mercariPedidos, setMercariPedidos] = useState([]);
  const [staffAcessos,      setStaffAcessos]      = useState(null);
  const meuAcessoAdmin = !owner && staffAcessos ? (staffAcessos[userCog] || DEFAULT_STAFF_ACESSOS) : null;
  const temAcesso = (id) => owner || !meuAcessoAdmin || meuAcessoAdmin.includes(id);
  const [envioSolic,        setEnvioSolic]        = useState([]);
  const [envioLoading,      setEnvioLoading]      = useState(null);
  const [novoEvData,        setNovoEvData]        = useState("");
  const [novoEvDataFim,     setNovoEvDataFim]     = useState("");
  const [novoEvTitulo,      setNovoEvTitulo]      = useState("");
  const [novoEvTipo,        setNovoEvTipo]        = useState("envio");
  const [savingEv,          setSavingEv]          = useState(false);
  const [filtroEnvio,       setFiltroEnvio]       = useState("todos");
  const [buscaEnvio,        setBuscaEnvio]        = useState("");
  const [verGrupos,         setVerGrupos]         = useState(false);
  const [expandedEnvio,     setExpandedEnvio]     = useState(new Set());
  const [rastreioAberto,    setRastreioAberto]    = useState(null);
  const [rastreioCodigo,    setRastreioCodigo]    = useState("");
  const [rastreioLink,      setRastreioLink]      = useState("");
  const [cotacaoAberta,     setCotacaoAberta]     = useState(null);
  const [cotacaoOpcoes,     setCotacaoOpcoes]     = useState([{ forma:"", valor:"", valor_original:"", prazo:"" }]);
  const [cotacaoEmbalagem,  setCotacaoEmbalagem]  = useState("");
  const [cotacaoObs,        setCotacaoObs]        = useState("");
  const [pushManualId,      setPushManualId]      = useState(null);
  const [pushManualMsg,     setPushManualMsg]     = useState("");
  const [pushManualSending, setPushManualSending] = useState(false);
  const [corrigirOk,        setCorrigirOk]        = useState(null); // item id
  const [joinerUpdates,     setJoinerUpdates]     = useState([]);
  const [pagDemandas,       setPagDemandas]       = useState([]);
  const [adminRepassos,     setAdminRepassos]     = useState(null);
  const loadedTabsRef = useRef(new Set());

  async function confirmarEnvio(s) {
    if (!rastreioCodigo.trim()) { alert("Informe o código de rastreio antes de confirmar."); return; }
    setEnvioLoading(s.id);
    for (const it of (s.itens || [])) {
      await supabase.from("masterlist").update({ status: "Enviado Nacional" }).eq("id", it.id);
    }
    const { error } = await supabase.from("envio_solicitacoes").update({
      status: "enviado",
      rastreio_codigo: rastreioCodigo.trim(),
      rastreio_link: rastreioLink.trim() || null,
    }).eq("id", s.id);
    if (error) { alert("Erro ao confirmar envio: " + error.message); setEnvioLoading(null); return; }
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
    const bestOp   = preenchidas.find(o => pf(o.valor) === minPreco);
    const totalFmt = (minPreco + emb).toFixed(2).replace(".", ",");
    const payload  = {
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
    };

    if (s.grupo_envio_codigo) {
      // busca host_cog do grupo
      const { data: grupoData } = await supabase.from("grupos_envio").select("host_cog").eq("codigo", s.grupo_envio_codigo).single();
      const hostCog = grupoData?.host_cog;

      // atualiza só o registro do host
      const { error: errCot } = await supabase.from("envio_solicitacoes")
        .update(payload)
        .eq("grupo_envio_codigo", s.grupo_envio_codigo)
        .eq("joiner_cog", hostCog);
      if (errCot) { alert("Erro ao enviar cotação: " + errCot.message); return; }

      const membros = envioSolic.filter(e => e.grupo_envio_codigo === s.grupo_envio_codigo);
      const pushes = membros.map(m => ({
        message: m.joiner_cog === hostCog
          ? `Sua cotação de envio está disponível! A partir de R$ ${totalFmt} via ${bestOp.forma}. Acesse Meu Perfil → Envios para ver as opções.`
          : `A host do seu grupo de envio recebeu a cotação. A partir de R$ ${totalFmt} via ${bestOp.forma}. Ela escolherá a modalidade em breve.`,
        active: true,
        joiner_cog: m.joiner_cog,
      }));
      await supabase.from("pushes").insert(pushes);

      const updFields = { status:"pagamento em aberto", cotacao_opcoes:preenchidas, cotacao_frete:bestOp.valor, cotacao_forma:bestOp.forma, cotacao_seguro:valorDeclarado||null, cotacao_embalagem:cotacaoEmbalagem, cotacao_valor:totalFmt, cotacao_prazo:bestOp.prazo, cotacao_obs:cotacaoObs };
      setEnvioSolic(prev => prev.map(x =>
        x.grupo_envio_codigo === s.grupo_envio_codigo && x.joiner_cog === hostCog ? { ...x, ...updFields } : x
      ));
    } else {
      const { error: errCot } = await supabase.from("envio_solicitacoes").update(payload).eq("id", s.id);
      if (errCot) { alert("Erro ao enviar cotação: " + errCot.message); return; }
      await supabase.from("pushes").insert([{
        message: `Sua cotação de envio está disponível! A partir de R$ ${totalFmt} via ${bestOp.forma}. Acesse Meu Perfil → Envios para ver as opções.`,
        active: true,
        joiner_cog: s.joiner_cog,
      }]);
      setEnvioSolic(prev => prev.map(x => x.id === s.id ? { ...x, status:"pagamento em aberto", cotacao_opcoes:preenchidas, cotacao_frete:bestOp.valor, cotacao_forma:bestOp.forma, cotacao_seguro:valorDeclarado||null, cotacao_embalagem:cotacaoEmbalagem, cotacao_valor:totalFmt, cotacao_prazo:bestOp.prazo, cotacao_obs:cotacaoObs } : x));
    }

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
    const { error } = await supabase.from("envio_solicitacoes").update({ status: "cancelado" }).eq("id", s.id);
    if (error) { alert("Erro ao cancelar: " + error.message); return; }
    await supabase.from("pushes").insert([{
      message: "Sua solicitação de envio foi cancelada. Entre em contato com a GOM para mais informações.",
      active: true, joiner_cog: s.joiner_cog,
    }]);
    setEnvioSolic(prev => prev.map(x => x.id === s.id ? { ...x, status:"cancelado" } : x));
  }

  async function corrigirItem(s, it) {
    const nomeItem = it.nome || it.nome_do_item || it.ceg || "item";
    if (!window.confirm(`Corrigir "${nomeItem}"? O status volta para ANTIGOM e o joiner receberá uma notificação.`)) return;
    const { error } = await supabase.from("masterlist").update({ status: "ANTIGOM" }).eq("id", it.id);
    if (error) { alert("Erro ao corrigir: " + error.message); return; }
    await supabase.from("pushes").insert([{
      message: `O item "${nomeItem}" (${it.ceg}) ainda não chegou à GOM. Entre em contato com a GOM para mais informações.`,
      active: true,
      joiner_cog: s.joiner_cog,
    }]);
    setPendentesData(prev => (prev || []).map(row => row.id === it.id ? { ...row, status: "ANTIGOM" } : row));
    setCorrigirOk(it.id);
    setTimeout(() => setCorrigirOk(null), 3000);
  }

  // Core: dados leves necessários para sidebar + home dashboard
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
    supabase.from("confirmacoes").select("*").eq("visto", false).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setConfirmacoes(data); });
    supabase.from("pre_cadastros").select("*").eq("status", "pendente").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setPreCadastros(data); });
    supabase.from("envio_solicitacoes").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setEnvioSolic(data); });
    supabase.from("joiner_updates").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setJoinerUpdates(data); });
    supabase.from("pagamento_demandas").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setPagDemandas(data); });
    supabase.from("repassos").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setAdminRepassos(data || []); });
    supabase.from("mercari_pedidos").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setMercariPedidos(data); });
  }, []);

  // Lazy: carrega dados apenas quando a aba é visitada pela primeira vez
  useEffect(() => {
    const loaded = loadedTabsRef.current;

    if (adminMainTab === "geral" && !loaded.has("geral")) {
      loaded.add("geral");
      supabase.from("pushes").select("*, push_reads(push_id)").order("created_at", { ascending: false })
        .then(({ data }) => { if (data) setPushes(data); });
      supabase.from("feedbacks").select("*").order("created_at", { ascending: false })
        .then(({ data }) => { if (data) setFeedbacks(data); });
    }

    const needsJoiners = ["reports", "pagamentos", "blocklist"].includes(adminMainTab);
    if (needsJoiners && !loaded.has("joiners")) {
      loaded.add("joiners");
      supabase.from("joiners").select("cog, nome, email, bloqueado").order("nome")
        .then(({ data }) => { if (data) setJoinersData(data); });
    }

    const needsMasterlist = ["pagamentos", "blocklist"].includes(adminMainTab);
    if (needsMasterlist && !loaded.has("masterlist")) {
      loaded.add("masterlist");
      (async () => {
        const sel = "id, cog, nome, ceg, nome_do_item, status, valor_item, frete_inter, taxa_rf, pago_item, pago_frete, pago_rf, venc_item, venc_frete, venc_rf, info_adicionais";
        let all = [], from = 0;
        while (true) {
          const { data } = await supabase.from("masterlist").select(sel).neq("cog", "disponivel").range(from, from + 999);
          if (!data || data.length === 0) break;
          all = [...all, ...data];
          if (data.length < 1000) break;
          from += 1000;
        }
        setPendentesData(all);
      })();
    }

    if (adminMainTab === "disponiveis" && !loaded.has("disponiveis")) {
      loaded.add("disponiveis");
      const sel = "id, cog, nome, ceg, nome_do_item, status, valor_item, frete_inter, taxa_rf, pago_item, pago_frete, pago_rf, venc_item, venc_frete, venc_rf, info_adicionais";
      supabase.from("masterlist").select(sel).eq("cog", "disponivel")
        .then(({ data }) => { if (data) setDisponiveisData(data); });
    }
  }, [adminMainTab]);

  async function enviarPush() {
    if (!novoPush.trim()) return;
    if (pushDestinatario === "especifico" && !pushJoinerSel) return;
    setSendingPush(true);
    const payload = { message: novoPush.trim(), active: true };
    if (pushDestinatario === "especifico") payload.joiner_cog = pushJoinerSel.cog;
    const { data } = await supabase.from("pushes").insert([payload]).select().single();
    if (data) setPushes(p => [data, ...(p || [])]);
    setNovoPush("");
    setPushJoinerSel(null);
    setPushJoinerSearch("");
    setSendingPush(false);
  }
  async function desativarPush(id) {
    await supabase.from("pushes").update({ active: false }).eq("id", id);
    setPushes(p => (p || []).map(x => x.id === id ? { ...x, active: false } : x));
  }
  async function reativarPush(id) {
    await supabase.from("pushes").update({ active: true }).eq("id", id);
    setPushes(p => (p || []).map(x => x.id === id ? { ...x, active: true } : x));
  }

  async function marcarResolvido(rep) {
    const { error } = await supabase.from("reports").update({ status: "resolvido" }).eq("id", rep.id);
    if (error) { alert("Erro ao resolver report: " + error.message); return; }
    await supabase.from("pushes").insert([{
      message: `Seu report sobre "${rep.item_nome}" foi atualizado! Acesse a aba Suporte e verifique se está correto.`,
      active: true,
      joiner_cog: rep.joiner_cog,
    }]);
    await supabase.from("notifications").insert([{
      joiner_cog: rep.joiner_cog,
      message: `Seu report sobre "${rep.item_nome}" foi resolvido.`,
      type: "report_resolved",
      report_id: rep.id,
    }]);
    const joinerInfo = (joinersData || []).find(j => j.cog === rep.joiner_cog);
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

  async function buscarBadgesJoiner() {
    const termo = badgesSearch.trim().replace(/^@/, "");
    if (!termo) return;
    setBadgesLoading(true); setBadgesErro(""); setBadgesJoiner(null);
    const { data: joiner } = await supabase.from("joiners").select("*")
      .or(`cog.ilike.%${termo}%,nome.ilike.%${termo}%`).limit(1).single();
    if (!joiner) { setBadgesErro("Joiner não encontrado."); setBadgesLoading(false); return; }

    const [{ data: itens }, { data: envios }, { data: reports }, { data: pagamentos }, { count: multasPagas }] = await Promise.all([
      supabase.from("masterlist").select("ceg, nome_do_item, valor_item, frete_inter, taxa_rf, pago_item, pago_frete, pago_rf").eq("cog", joiner.cog),
      supabase.from("envio_solicitacoes").select("status").eq("joiner_cog", joiner.cog),
      supabase.from("reports").select("id").eq("joiner_cog", joiner.cog),
      supabase.from("pagamento_demandas").select("id").eq("joiner_cog", joiner.cog),
      supabase.from("multas_pagas").select("id", { count: "exact", head: true }).eq("joiner_cog", joiner.cog),
    ]);

    setBadgesJoiner({
      joiner,
      badges: computeBadges({ itens: itens || [], envios: envios || [], pagamentos: pagamentos || [], reports: reports || [], multasPagas: multasPagas || 0, cog: joiner.cog }),
    });
    setBadgesLoading(false);
  }

  const totalPend = envioSolic.filter(e => e.status === "solicitação de envio").length
                  + reports.filter(r => r.status !== "resolvido").length
                  + confirmacoes.length
                  + joinerUpdates.filter(u => !u.lido).length
                  + pagDemandas.filter(d => d.status === "em_analise").length;
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
                {temAcesso("envios")       && nav("envios",       "Envios",       "◫", envioSolic.filter(e => e.status === "solicitação de envio").length || 0)}
                {temAcesso("reports")      && nav("reports",      "Reports",      "⚑", reports.filter(r => r.status !== "resolvido").length || 0)}
                {temAcesso("cadastros")    && nav("cadastros",    "Cadastros",    "👤", confirmacoes.length + preCadastros.length || 0)}
                {temAcesso("atualizacoes") && nav("atualizacoes", "Atualizações", "↻", joinerUpdates.filter(u => !u.lido).length || 0)}
                {temAcesso("demandas")     && nav("repassos",     "Repassos",     "⇄", (adminRepassos || []).filter(r => r.status === "pendente").length || 0)}
                {temAcesso("badges")       && nav("badges",       "Badges",       "✦", 0)}
                {nav("mercari", "Mercari", "🎌", mercariPedidos.filter(p => p.status === "pendente").length || 0)}
              </div>
              <div className="admin-sidebar-group">
                <div className="admin-sidebar-group-label">Financeiro</div>
                {(temAcesso("pagamentos") || temAcesso("demandas") || temAcesso("blocklist")) && nav("pagamentos", "Pagamentos", "💸", pagDemandas.filter(d => d.status === "em_analise").length || 0)}
                {temAcesso("disponiveis") && nav("disponiveis", "Disponíveis", "🛒", 0)}
              </div>
              {owner && (
                <div className="admin-sidebar-group">
                  <div className="admin-sidebar-group-label">Config</div>
                  {nav("geral",    "Geral",       "⚙",  0)}
                  {nav("agenda",   "Agenda",      "📅", 0)}
                  {nav("galeria",  "GALERIA", "◈",  0)}
                </div>
              )}
            </nav>
          );
        })()}

        {/* Conteúdo */}
        <div className="admin-content">

      {adminMainTab === "home" && (() => {
        const ENVIO_CARDS = [
          { key:"solicitação de envio",  label:"Nova",             icon:"✦", cor:"#BAFF39",              bg:"rgba(186,255,57,.06)",  border:"rgba(186,255,57,.2)"  },
          { key:"cotação em andamento",  label:"Cotação",          icon:"◎", cor:"#FF5C1A",              bg:"rgba(255,92,26,.06)",   border:"rgba(255,92,26,.2)"   },
          { key:"pagamento em aberto",   label:"Pgto. aberto",     icon:"◷", cor:"#C9A8F0",              bg:"rgba(201,168,240,.06)", border:"rgba(201,168,240,.2)" },
          { key:"pagamento confirmado",  label:"Pgto. confirmado", icon:"✓", cor:"#FFD166",              bg:"rgba(255,209,102,.06)", border:"rgba(255,209,102,.2)" },
          { key:"embalando",             label:"Embalando",        icon:"□", cor:"#64B5F6",              bg:"rgba(100,181,246,.06)", border:"rgba(100,181,246,.2)" },
          { key:"enviado",              label:"Enviado",           icon:"→", cor:"rgba(245,240,232,.6)", bg:"rgba(245,240,232,.03)", border:"rgba(245,240,232,.1)" },
          { key:"cancelado",            label:"Cancelado",         icon:"✕", cor:"rgba(245,240,232,.3)", bg:"rgba(245,240,232,.02)", border:"rgba(245,240,232,.08)"},
        ];
        const otherCards = [
          { id:"reports",   icon:"⚑", label:"Reports",   count: (reports||[]).filter(r => r.status !== "resolvido").length, sub:"pendente", color:"var(--laranja)", bg:"rgba(255,92,26,.06)", border:"rgba(255,92,26,.2)" },
          { id:"cadastros", icon:"👤", label:"Cadastros", count: (confirmacoes||[]).length, sub:"aguardando", color:"var(--lilas)", bg:"rgba(201,168,240,.06)", border:"rgba(201,168,240,.18)" },
        ].filter(c => c.count > 0);
        return (
          <div>
            {/* Envios por status */}
            <div style={{ fontSize:9, fontFamily:"'DM Mono',monospace", letterSpacing:"1.5px", textTransform:"uppercase", color:"rgba(245,240,232,.28)", marginBottom:8 }}>Envios</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(100px, 1fr))", gap:8, marginBottom:20 }}>
              {ENVIO_CARDS.map(f => {
                const count = envioSolic.filter(e => e.status === f.key).length;
                return (
                  <div key={f.key} onClick={() => { setFiltroEnvio(f.key); setAdminMainTab("envios"); }}
                    style={{ background: count > 0 ? f.bg : "var(--card-bg)", border:`1px solid ${count > 0 ? f.border : "rgba(245,240,232,.07)"}`, borderRadius:10, padding:"14px 14px", cursor:"pointer", transition:"all .15s" }}>
                    <div style={{ fontSize:16, color: count > 0 ? f.cor : "rgba(245,240,232,.2)", marginBottom:4, lineHeight:1 }}>{f.icon}</div>
                    <div style={{ fontSize:24, fontWeight:900, color: count > 0 ? f.cor : "rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace", lineHeight:1, marginBottom:4 }}>{count}</div>
                    <div style={{ fontSize:9, fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase", color: count > 0 ? f.cor : "rgba(245,240,232,.25)", fontWeight: count > 0 ? 700 : 400 }}>{f.label}</div>
                  </div>
                );
              })}
            </div>
            {/* Outros pendentes */}
            {otherCards.length > 0 && <>
              <div style={{ fontSize:9, fontFamily:"'DM Mono',monospace", letterSpacing:"1.5px", textTransform:"uppercase", color:"rgba(245,240,232,.28)", marginBottom:8 }}>Outros</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10, marginBottom:24 }}>
                {otherCards.map(c => (
                  <div key={c.id} onClick={() => setAdminMainTab(c.id)} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:"18px 16px", cursor:"pointer", transition:"all .15s" }}>
                    <div style={{ fontSize:20, marginBottom:8 }}>{c.icon}</div>
                    <div style={{ fontSize:28, fontWeight:900, color:c.color, fontFamily:"'DM Mono',monospace", lineHeight:1 }}>{c.count}</div>
                    <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.5)", marginTop:4, textTransform:"uppercase", letterSpacing:"1px" }}>{c.label}</div>
                    <div style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.3)", marginTop:2 }}>{c.sub}</div>
                  </div>
                ))}
              </div>
            </>}
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(245,240,232,.2)", letterSpacing:".05em" }}>
              selecione uma seção na barra lateral →
            </div>
          </div>
        );
      })()}

      {adminMainTab === "geral" && owner && <>
      <AdminLinks />
      <AdminPinBlock />

      <ProximoEnvioBlock />
      <AvisoMasterlistBlock />

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
        {/* Seleção de destinatário */}
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          {[["todos","→ Todas as joiners"],["especifico","→ Joiner específica"]].map(([val, label]) => (
            <button key={val} onClick={() => { setPushDestinatario(val); setPushJoinerSel(null); setPushJoinerSearch(""); if (val === "especifico" && !pushJoiners) { supabase.from("joiners").select("cog,nome").order("nome").then(({ data }) => setPushJoiners(data || [])); } }}
              style={{ fontSize:11, fontFamily:"'DM Mono',monospace", padding:"5px 14px", borderRadius:20, cursor:"pointer", border: pushDestinatario === val ? "1px solid var(--laranja)" : "1px solid rgba(245,240,232,.12)", background: pushDestinatario === val ? "rgba(255,92,26,.12)" : "transparent", color: pushDestinatario === val ? "var(--laranja)" : "rgba(245,240,232,.4)", fontWeight: pushDestinatario === val ? 700 : 400 }}>
              {label}
            </button>
          ))}
        </div>

        {/* Seletor de joiner específica */}
        {pushDestinatario === "especifico" && (
          <div style={{ marginBottom:12, position:"relative" }}>
            {pushJoinerSel ? (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(201,168,240,.08)", border:"1px solid rgba(201,168,240,.25)", borderRadius:8, padding:"8px 14px" }}>
                <span style={{ flex:1, fontSize:12, color:"var(--offwhite)" }}>{pushJoinerSel.nome} <span style={{ color:"var(--lilas)", fontSize:11 }}>@{pushJoinerSel.cog}</span></span>
                <button onClick={() => { setPushJoinerSel(null); setPushJoinerSearch(""); }} style={{ background:"none", border:"none", color:"rgba(245,240,232,.35)", fontSize:14, cursor:"pointer", padding:0, lineHeight:1 }}>✕</button>
              </div>
            ) : (
              <>
                <input value={pushJoinerSearch} onChange={e => setPushJoinerSearch(e.target.value)} placeholder="Buscar joiner por nome ou @cog..."
                  style={{ width:"100%", boxSizing:"border-box", background:"#0d0d0d", border:"1px solid rgba(245,240,232,.12)", borderRadius:8, padding:"9px 14px", color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none" }} />
                {pushJoinerSearch.trim().length > 0 && pushJoiners && (
                  <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#141414", border:"1px solid rgba(245,240,232,.12)", borderRadius:8, marginTop:4, maxHeight:200, overflowY:"auto", zIndex:10 }}>
                    {pushJoiners.filter(j => j.nome?.toLowerCase().includes(pushJoinerSearch.toLowerCase()) || j.cog?.toLowerCase().includes(pushJoinerSearch.toLowerCase())).slice(0,10).map(j => (
                      <div key={j.cog} onClick={() => { setPushJoinerSel(j); setPushJoinerSearch(""); }}
                        style={{ padding:"9px 14px", fontSize:12, color:"var(--offwhite)", cursor:"pointer", borderBottom:"1px solid rgba(245,240,232,.06)" }}
                        onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,.04)"}
                        onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                        {j.nome} <span style={{ color:"rgba(245,240,232,.35)", fontSize:11 }}>@{j.cog}</span>
                      </div>
                    ))}
                    {pushJoiners.filter(j => j.nome?.toLowerCase().includes(pushJoinerSearch.toLowerCase()) || j.cog?.toLowerCase().includes(pushJoinerSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding:"10px 14px", fontSize:11, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>nenhuma joiner encontrada</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={novoPush} onChange={e => setNovoPush(e.target.value)}
            onKeyDown={e => e.key === "Enter" && enviarPush()}
            placeholder="Ex: Atenção! Prazo de pagamento amanhã..."
            style={{ flex: 1, background: "#0d0d0d", border: "1px solid rgba(245,240,232,.12)", borderRadius: 8, padding: "10px 14px", color: "var(--offwhite)", fontFamily: "'DM Mono',monospace", fontSize: 12, outline: "none" }}
          />
          <button onClick={enviarPush} disabled={sendingPush || !novoPush.trim() || (pushDestinatario === "especifico" && !pushJoinerSel)} style={{ background: "var(--laranja)", color: "#000", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 700, cursor: "pointer", opacity: (novoPush.trim() && (pushDestinatario === "todos" || pushJoinerSel)) ? 1 : 0.4 }}>
            {sendingPush ? "..." : "Enviar →"}
          </button>
        </div>

        {pushes === null
          ? <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"20px 0" }}>carregando...</div>
          : <PushListFiltrada pushes={pushes} onDesativar={desativarPush} onReativar={reativarPush} />
        }
      </div>

      <div style={{ marginTop:28 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)", marginBottom:12 }}>
          Feedbacks dos joiners
          {feedbacks?.length > 0 && <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:"rgba(245,240,232,.35)" }}>({feedbacks.length})</span>}
        </div>
        {feedbacks === null ? (
          <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"20px 0" }}>carregando...</div>
        ) : feedbacks.length === 0 ? (
          <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"20px 0" }}>Nenhum feedback recebido ainda.</div>
        ) : (() => {
          async function enviarResposta(fb) {
            if (!fbRespostaTexto.trim()) return;
            setFbRespostaEnv(true);
            await supabase.from("feedbacks").update({ resposta: fbRespostaTexto.trim() }).eq("id", fb.id);
            await supabase.from("pushes").insert([{ message:`Nanda respondeu seu feedback: "${fbRespostaTexto.trim()}"`, active:true, joiner_cog: fb.joiner_cog }]);
            setFeedbacks(prev => prev.map(x => x.id === fb.id ? { ...x, resposta: fbRespostaTexto.trim() } : x));
            setFbRespostaAberta(null);
            setFbRespostaTexto("");
            setFbRespostaEnv(false);
          }

          return feedbacks.map(fb => {
            const tipoColor  = { bug:"var(--laranja)", sugestão:"#64B5F6", elogio:"#4ade80" }[fb.tipo] || "rgba(245,240,232,.4)";
            const respondendo = fbRespostaAberta === fb.id;
            return (
              <div key={fb.id} style={{ background:"var(--card-bg)", border:`1px solid ${fb.resposta ? "rgba(167,139,250,.15)" : "rgba(245,240,232,.07)"}`, borderRadius:8, marginBottom:8, overflow:"hidden" }}>
                <div style={{ padding:"12px 16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:9, color:tipoColor, border:`1px solid ${tipoColor}55`, borderRadius:4, padding:"2px 7px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase" }}>{fb.tipo}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"var(--offwhite)", fontFamily:"'DM Mono',monospace" }}>{fb.joiner_nome}</span>
                    {fb.resposta && <span style={{ fontSize:9, color:"#A78BFA", fontFamily:"'DM Mono',monospace", border:"1px solid rgba(167,139,250,.25)", borderRadius:4, padding:"2px 7px" }}>✓ respondido</span>}
                    <span style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", marginLeft:"auto" }}>
                      {new Date(fb.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:"rgba(245,240,232,.7)", lineHeight:1.6, marginBottom:10 }}>{fb.message}</div>

                  {/* Resposta existente */}
                  {fb.resposta && !respondendo && (
                    <div style={{ background:"rgba(167,139,250,.06)", border:"1px solid rgba(167,139,250,.15)", borderRadius:6, padding:"8px 12px", marginBottom:8 }}>
                      <div style={{ fontSize:9, color:"rgba(167,139,250,.5)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".08em", marginBottom:4 }}>Sua resposta</div>
                      <div style={{ fontSize:11, color:"rgba(245,240,232,.65)", fontFamily:"'DM Mono',monospace", lineHeight:1.6 }}>{fb.resposta}</div>
                    </div>
                  )}

                  {/* Botão / form de resposta */}
                  {!respondendo ? (
                    <button onClick={() => { setFbRespostaAberta(fb.id); setFbRespostaTexto(fb.resposta || ""); }}
                      style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"none", border:"1px solid rgba(167,139,250,.2)", color:"rgba(167,139,250,.6)", borderRadius:5, padding:"5px 12px", cursor:"pointer", letterSpacing:".05em" }}>
                      {fb.resposta ? "✎ editar resposta" : "↩ responder"}
                    </button>
                  ) : (
                    <div style={{ marginTop:4 }}>
                      <textarea value={fbRespostaTexto} onChange={e => setFbRespostaTexto(e.target.value)}
                        placeholder="Escreva sua resposta para o joiner..."
                        rows={3} autoFocus
                        style={{ width:"100%", boxSizing:"border-box", background:"rgba(245,240,232,.04)", border:"1px solid rgba(167,139,250,.25)", borderRadius:7, padding:"9px 12px", color:"#F5F0E8", fontSize:12, fontFamily:"'DM Mono',monospace", outline:"none", resize:"vertical", marginBottom:8 }} />
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => enviarResposta(fb)} disabled={fbRespostaEnv || !fbRespostaTexto.trim()}
                          style={{ fontSize:11, fontFamily:"'DM Mono',monospace", background:"rgba(167,139,250,.15)", border:"1px solid rgba(167,139,250,.3)", color:"#A78BFA", borderRadius:6, padding:"7px 16px", cursor:"pointer", fontWeight:700, opacity: fbRespostaTexto.trim() ? 1 : 0.4 }}>
                          {fbRespostaEnv ? "enviando..." : "↩ enviar resposta"}
                        </button>
                        <button onClick={() => { setFbRespostaAberta(null); setFbRespostaTexto(""); }}
                          style={{ fontSize:11, fontFamily:"'DM Mono',monospace", background:"none", border:"1px solid rgba(245,240,232,.1)", color:"rgba(245,240,232,.35)", borderRadius:6, padding:"7px 12px", cursor:"pointer" }}>
                          cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          });
        })()}
      </div>

      </>}

      {adminMainTab === "reports" && <div>
        <input
          value={searchReport}
          onChange={e => { setSearchReport(e.target.value); setOpenReportJoiner(null); }}
          placeholder="Buscar joiner ou item..."
          style={{ width:"100%", marginBottom:12, background:"rgba(245,240,232,.04)", border:"1px solid rgba(245,240,232,.12)", borderRadius:7, padding:"8px 12px", color:"#F5F0E8", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box" }}
        />
        {(() => {
          const q = searchReport.trim().toLowerCase();
          const base = reports.filter(r =>
            !q || r.joiner_nome?.toLowerCase().includes(q) || r.joiner_cog?.toLowerCase().includes(q) || r.item_nome?.toLowerCase().includes(q)
          );
          const pendentes  = base.filter(r => r.status !== "resolvido");
          const finalizados = base.filter(r => r.status === "resolvido");

          // Tabs
          const tabBtnStyle = active => ({
            background: active ? "rgba(245,240,232,.08)" : "none",
            border: `1px solid ${active ? "rgba(245,240,232,.2)" : "rgba(245,240,232,.07)"}`,
            color: active ? "var(--offwhite)" : "rgba(245,240,232,.35)",
            borderRadius: 8, padding: "6px 16px", fontSize: 12,
            fontFamily: "'DM Mono',monospace", fontWeight: active ? 700 : 400, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 7, textTransform: "uppercase", letterSpacing: ".08em"
          });

          const lista = adminTab === "pendentes" ? pendentes : finalizados;

          // Agrupar por joiner
          const byJoiner = {};
          lista.forEach(r => {
            const key = r.joiner_cog || r.joiner_nome || "—";
            if (!byJoiner[key]) byJoiner[key] = { nome: r.joiner_nome, cog: r.joiner_cog, reports: [] };
            byJoiner[key].reports.push(r);
          });
          const grupos = Object.values(byJoiner).sort((a, b) => b.reports.length - a.reports.length);

          const ReportCard = ({ r }) => {
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
              <div style={{ borderTop:"1px solid rgba(245,240,232,.06)", padding:"12px 0" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--offwhite)", marginBottom:3 }}>
                  {r.item_nome} <span style={{ color:"rgba(245,240,232,.3)", fontWeight:400 }}>· {r.ceg}</span>
                </div>
                {erroLabels.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:4 }}>
                    {erroLabels.map(l => <span key={l} style={{ fontSize:9, background:"rgba(255,92,26,.12)", border:"1px solid rgba(255,92,26,.25)", borderRadius:3, padding:"1px 6px", color:"var(--laranja)" }}>{l}</span>)}
                  </div>
                )}
                {(r.motivo_item || r.correcao_valor || r.correcao_frete || r.correcao_taxa) && (
                  <div style={{ marginTop:4, fontSize:10, color:"rgba(245,240,232,.4)", display:"flex", flexDirection:"column", gap:1 }}>
                    {r.motivo_item    && <span>↳ {r.motivo_item}</span>}
                    {r.correcao_valor && <span>↳ Valor: {r.correcao_valor}</span>}
                    {r.correcao_frete && <span>↳ Frete: {r.correcao_frete}</span>}
                    {r.correcao_taxa  && <span>↳ Taxa: {r.correcao_taxa}</span>}
                  </div>
                )}
                {r.erro_pagamento && (r.pag_data || r.pag_valor || r.pag_metodo) && (
                  <div style={{ marginTop:4, fontSize:10, color:"rgba(245,240,232,.4)", display:"flex", flexWrap:"wrap", gap:8 }}>
                    {r.pag_data   && <span>Data: {new Date(r.pag_data+"T12:00:00").toLocaleDateString("pt-BR")}</span>}
                    {r.pag_valor  && <span>Valor: {r.pag_valor}</span>}
                    {r.pag_metodo && <span>Método: {r.pag_metodo}</span>}
                  </div>
                )}
                {r.observacao && <div style={{ marginTop:4, fontSize:10, color:"rgba(245,240,232,.45)", fontStyle:"italic" }}>"{r.observacao}"</div>}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8 }}>
                  <div style={{ fontSize:9, color:"rgba(245,240,232,.2)" }}>{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                  {r.status === "pendente" ? (
                    <div style={{ display:"flex", gap:6 }}>
                      <EmailTypeBadge type="report" />
                      <button onClick={() => marcarResolvido(r)} style={{ background:"rgba(74,222,128,.1)", border:"1px solid rgba(74,222,128,.3)", color:"#4ade80", borderRadius:5, padding:"4px 12px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>Resolver ✓</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:10, color:"#4ade80" }}>✓ resolvido</span>
                      <button onClick={() => desfazerResolvido(r.id)} style={{ background:"none", border:"1px solid rgba(245,240,232,.1)", color:"rgba(245,240,232,.3)", borderRadius:5, padding:"3px 8px", fontSize:9, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>desfazer</button>
                    </div>
                  )}
                </div>
              </div>
            );
          };

          return (
            <>
              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <button style={tabBtnStyle(adminTab === "pendentes")} onClick={() => { setAdminTab("pendentes"); setOpenReportJoiner(null); }}>
                  Pendentes {pendentes.length > 0 && <span style={{ background:"var(--laranja)", color:"#000", borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{pendentes.length}</span>}
                </button>
                <button style={tabBtnStyle(adminTab === "finalizados")} onClick={() => { setAdminTab("finalizados"); setOpenReportJoiner(null); }}>
                  Finalizados {finalizados.length > 0 && <span style={{ background:"rgba(74,222,128,.2)", color:"#4ade80", borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{finalizados.length}</span>}
                </button>
              </div>
              {grupos.length === 0 && <div style={{ fontSize:12, color:"rgba(245,240,232,.3)", padding:"16px 0" }}>Nenhum report{q ? ` para "${searchReport}"` : ""}.</div>}
              {grupos.map(g => {
                const isOpen = openReportJoiner === g.cog;
                const pendCount = g.reports.filter(r => r.status !== "resolvido").length;
                return (
                  <div key={g.cog} style={{ background:"var(--card-bg)", border:`1px solid ${pendCount > 0 ? "rgba(255,92,26,.2)" : "rgba(74,222,128,.12)"}`, borderRadius:10, marginBottom:6, overflow:"hidden" }}>
                    <div onClick={() => setOpenReportJoiner(isOpen ? null : g.cog)} style={{ display:"flex", alignItems:"center", padding:"12px 16px", cursor:"pointer", gap:10 }}>
                      <div style={{ flex:1 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:"var(--offwhite)" }}>{g.nome}</span>
                        <span style={{ fontSize:10, color:"rgba(245,240,232,.35)", marginLeft:8 }}>@{g.cog}</span>
                      </div>
                      <span style={{ fontSize:10, background: pendCount > 0 ? "rgba(255,92,26,.15)" : "rgba(74,222,128,.12)", color: pendCount > 0 ? "var(--laranja)" : "#4ade80", border:`1px solid ${pendCount > 0 ? "rgba(255,92,26,.3)" : "rgba(74,222,128,.25)"}`, borderRadius:99, padding:"2px 9px", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
                        {g.reports.length} report{g.reports.length > 1 ? "s" : ""}
                      </span>
                      <span style={{ fontSize:12, color:"rgba(245,240,232,.4)", transition:"transform .15s", display:"inline-block", transform: isOpen ? "rotate(180deg)" : "none" }}>▾</span>
                    </div>
                    {isOpen && (
                      <div style={{ borderTop:"1px solid rgba(245,240,232,.06)", padding:"4px 16px 12px" }}>
                        {g.reports.map(r => <ReportCard key={r.id} r={r} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          );
        })()}
      </div>}

      {adminMainTab === "cadastros"   && <AdminCadastros confirmacoes={confirmacoes} onUpdate={setConfirmacoes} preCadastros={preCadastros} onUpdatePre={setPreCadastros} />}
      {adminMainTab === "pagamentos" && (() => {
        const PIX_KEY = "de1a489d-db81-4864-a8cf-74cdd79d9cdc";
        const PixBar = () => (
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(186,255,57,.04)", border:"1px solid rgba(186,255,57,.15)", borderRadius:8, padding:"9px 14px", marginBottom:16, flexWrap:"wrap" }}>
            <span style={{ fontSize:9, color:"rgba(186,255,57,.55)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"1px", flexShrink:0 }}>PIX · Mercado Pago</span>
            <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.6)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{PIX_KEY}</span>
            <button onClick={() => { navigator.clipboard.writeText(PIX_KEY); setAdminPixCopiado(true); setTimeout(() => setAdminPixCopiado(false), 2000); }}
              style={{ flexShrink:0, padding:"5px 12px", background: adminPixCopiado ? "rgba(186,255,57,.2)" : "rgba(186,255,57,.08)", color:"#BAFF39", border:`1px solid ${adminPixCopiado ? "rgba(186,255,57,.5)" : "rgba(186,255,57,.2)"}`, borderRadius:5, fontFamily:"'DM Mono',monospace", fontSize:10, fontWeight:700, cursor:"pointer", transition:"all .15s" }}>
              {adminPixCopiado ? "✓ copiado" : "copiar"}
            </button>
          </div>
        );
        const formPend = pagDemandas.filter(d => d.status === "em_analise").length;
        const subTabs = [
          temAcesso("demandas")  && { id:"formulario", label:"Formulário", badge: formPend },
          temAcesso("pagamentos") && { id:"em_aberto",  label:"Em aberto",  badge: 0 },
          temAcesso("pagamentos") && { id:"atrasados",  label:"Atrasados",  badge: 0 },
          (temAcesso("blocklist") || owner) && { id:"blocklist",  label:"Blocklist",  badge: 0 },
        ].filter(Boolean);

        const tabSt = active => ({
          background: active ? "rgba(245,240,232,.08)" : "none",
          border: `1px solid ${active ? "rgba(245,240,232,.2)" : "rgba(245,240,232,.07)"}`,
          color: active ? "var(--offwhite)" : "rgba(245,240,232,.35)",
          borderRadius:8, padding:"6px 16px", fontSize:12, fontFamily:"'DM Mono',monospace",
          fontWeight: active ? 700 : 400, cursor:"pointer", display:"flex", alignItems:"center",
          gap:7, textTransform:"uppercase", letterSpacing:".08em", whiteSpace:"nowrap",
        });

        const loading = pendentesData === null || joinersData === null;

        return (
          <div>
            <PixBar />
            <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:2 }}>
              {subTabs.map(t => (
                <button key={t.id} style={tabSt(adminPagSubTab === t.id)} onClick={() => setAdminPagSubTab(t.id)}>
                  {t.label}
                  {t.badge > 0 && <span style={{ background:"var(--laranja)", color:"#000", borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{t.badge}</span>}
                </button>
              ))}
            </div>

            {adminPagSubTab === "formulario" && (() => {
              const pendentes  = pagDemandas.filter(d => d.status === "em_analise");
              const resolvidas = pagDemandas.filter(d => d.status === "pago");

              async function confirmar(id) {
                const { error } = await supabase.rpc("set_pagamento_demanda_status", { demanda_id: id, novo_status: "pago" });
                if (error) { alert("Erro ao confirmar: " + error.message); return; }
                const d = pagDemandas.find(x => x.id === id);
                if (d) await supabase.from("pushes").insert([{ message:`Seu pagamento foi confirmado! R$ ${Number(d.valor_total).toFixed(2).replace(".",",")} — ${d.itens.length} item(s).`, active:true, joiner_cog:d.joiner_cog }]);
                setPagDemandas(prev => prev.map(x => x.id === id ? { ...x, status:"pago" } : x));
              }
              async function reabrir(id) {
                await supabase.rpc("set_pagamento_demanda_status", { demanda_id: id, novo_status: "em_analise" });
                setPagDemandas(prev => prev.map(x => x.id === id ? { ...x, status:"em_analise" } : x));
              }
              const joinerNome = cog => (joinersData || []).find(j => j.cog === cog)?.nome || null;

              const CardDemanda = ({ d }) => {
                const isPend = d.status === "em_analise";
                const nome = joinerNome(d.joiner_cog);
                const fmtV = v => Number(v) > 0 ? `R$${Number(v).toFixed(2).replace(".",",")}` : null;
                const temMulta = d.itens.some(it => Number(it.multa) > 0);
                const gridCols = `1fr 72px 72px 56px${temMulta ? " 66px" : ""} 80px`;
                const thStyle = { fontSize:8, letterSpacing:"1.2px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", textAlign:"right", paddingBottom:6 };
                const dash = <span style={{opacity:.2}}>—</span>;
                return (
                  <div style={{ background:"var(--card-bg)", border:`1px solid ${isPend ? "rgba(167,139,250,.2)" : "rgba(245,240,232,.07)"}`, borderRadius:12, padding:"16px", marginBottom:10 }}>

                    {/* cabeçalho */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:2 }}>
                          {nome && <span style={{ fontSize:14, fontWeight:800, color:"#F5F0E8" }}>{nome}</span>}
                          <span style={{ fontSize:11, color:"rgba(167,139,250,.65)", fontFamily:"'DM Mono',monospace" }}>@{d.joiner_cog}</span>
                        </div>
                        <div style={{ fontSize:9, color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace" }}>
                          {new Date(d.created_at).toLocaleDateString("pt-BR")} às {new Date(d.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                        </div>
                      </div>
                      <div style={{ fontSize:18, fontWeight:900, color: isPend ? "#F5F0E8" : "rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", flexShrink:0, marginLeft:12 }}>
                        R$ {Number(d.valor_total).toFixed(2).replace(".",",")}
                      </div>
                    </div>

                    {/* tabela de itens */}
                    <div style={{ overflowX:"auto" }}>
                      {/* cabeçalho da tabela */}
                      <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:"0 8px", paddingBottom:6, borderBottom:"1px solid rgba(245,240,232,.07)", marginBottom:2, minWidth:380 }}>
                        <div style={{ ...thStyle, textAlign:"left" }}>Item</div>
                        <div style={thStyle}>Item R$</div>
                        <div style={thStyle}>Frete</div>
                        <div style={thStyle}>RF</div>
                        {temMulta && <div style={{ ...thStyle, color:"rgba(255,107,107,.5)" }}>Multa</div>}
                        <div style={{ ...thStyle, color:"rgba(245,240,232,.5)" }}>Total</div>
                      </div>
                      {/* linhas */}
                      {d.itens.map((it, i) => {
                        const total = Number(it.valor_item||0)+Number(it.frete_inter||0)+Number(it.taxa_rf||0)+Number(it.multa||0);
                        return (
                          <div key={i} style={{ display:"grid", gridTemplateColumns:gridCols, gap:"0 8px", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(245,240,232,.04)", minWidth:380 }}>
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:11, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.nome_do_item}</div>
                              <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>{it.ceg}</div>
                            </div>
                            <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.6)", textAlign:"right" }}>{fmtV(it.valor_item)  || dash}</div>
                            <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.6)", textAlign:"right" }}>{fmtV(it.frete_inter) || dash}</div>
                            <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.6)", textAlign:"right" }}>{fmtV(it.taxa_rf)     || dash}</div>
                            {temMulta && <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"#ff6b6b", fontWeight:700, textAlign:"right" }}>{fmtV(it.multa) || dash}</div>}
                            <div style={{ fontSize:12, fontWeight:900, fontFamily:"'DM Mono',monospace", color:"#BAFF39", textAlign:"right" }}>R${total.toFixed(2).replace(".",",")}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* comprovante + obs */}
                    {(d.comprovante_url || d.obs) && (
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", margin:"12px 0" }}>
                        {d.comprovante_url && <a href={d.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(100,181,246,.08)", border:"1px solid rgba(100,181,246,.2)", borderRadius:5, padding:"4px 10px", color:"#64B5F6", textDecoration:"none" }}>↓ ver comprovante</a>}
                        {d.obs && <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.35)", fontStyle:"italic" }}>"{d.obs}"</span>}
                      </div>
                    )}

                    <div style={{ marginTop:12 }}>
                      {isPend
                        ? <button onClick={() => confirmar(d.id)} style={{ width:"100%", padding:"10px", background:"rgba(186,255,57,.12)", color:"#BAFF39", border:"1px solid rgba(186,255,57,.3)", borderRadius:7, fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:".05em" }}>✓ Confirmar pagamento</button>
                        : <button onClick={() => reabrir(d.id)} style={{ width:"100%", padding:"8px", background:"transparent", color:"rgba(245,240,232,.3)", border:"1px solid rgba(245,240,232,.1)", borderRadius:7, fontFamily:"'DM Mono',monospace", fontSize:10, cursor:"pointer" }}>↩ Reabrir</button>
                      }
                    </div>
                  </div>
                );
              };

              const listaAtiva = formularioFiltro === "analise" ? pendentes : resolvidas;
              return (
                <div>
                  {/* mini filtro */}
                  <div style={{ display:"flex", gap:6, marginBottom:16 }}>
                    <button onClick={() => setFormularioFiltro("analise")}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:7, fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer", border: formularioFiltro === "analise" ? "1px solid rgba(167,139,250,.4)" : "1px solid rgba(245,240,232,.08)", background: formularioFiltro === "analise" ? "rgba(167,139,250,.12)" : "transparent", color: formularioFiltro === "analise" ? "#A78BFA" : "rgba(245,240,232,.35)" }}>
                      Em análise
                      {pendentes.length > 0 && <span style={{ background:"rgba(167,139,250,.25)", color:"#A78BFA", borderRadius:99, fontSize:9, fontWeight:700, padding:"1px 6px" }}>{pendentes.length}</span>}
                    </button>
                    <button onClick={() => setFormularioFiltro("confirmados")}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:7, fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer", border: formularioFiltro === "confirmados" ? "1px solid rgba(186,255,57,.3)" : "1px solid rgba(245,240,232,.08)", background: formularioFiltro === "confirmados" ? "rgba(186,255,57,.08)" : "transparent", color: formularioFiltro === "confirmados" ? "#BAFF39" : "rgba(245,240,232,.35)" }}>
                      Confirmados
                      {resolvidas.length > 0 && <span style={{ background:"rgba(186,255,57,.15)", color:"#BAFF39", borderRadius:99, fontSize:9, fontWeight:700, padding:"1px 6px" }}>{resolvidas.length}</span>}
                    </button>
                  </div>

                  {listaAtiva.length === 0
                    ? <div style={{ textAlign:"center", padding:"40px 0", fontSize:12, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace" }}>
                        {formularioFiltro === "analise" ? "Nenhum formulário em análise." : "Nenhum pagamento confirmado ainda."}
                      </div>
                    : listaAtiva.map(d => <CardDemanda key={d.id} d={d} />)
                  }
                </div>
              );
            })()}

            {(adminPagSubTab === "em_aberto" || adminPagSubTab === "atrasados") && (
              loading
                ? <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"20px 0" }}>carregando...</div>
                : <AdminPagamentos data={pendentesData} joiners={joinersData} subtab={adminPagSubTab} />
            )}

            {adminPagSubTab === "blocklist" && (
              loading
                ? <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"20px 0" }}>carregando...</div>
                : <AdminBlocklist data={pendentesData} joiners={joinersData} onUpdate={setJoinersData} />
            )}
          </div>
        );
      })()}
      {adminMainTab === "disponiveis" && (
        disponiveisData === null
          ? <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"20px 0" }}>carregando...</div>
          : <AdminDisponivel data={disponiveisData} />
      )}

      {adminMainTab === "badges" && (
        <div>
          <h3 className="admin-title" style={{ fontSize:16, marginBottom:14 }}>Badges do joiner</h3>
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <input className="login-input" type="text" placeholder="@ ou nome do joiner" value={badgesSearch}
              onChange={e => setBadgesSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && buscarBadgesJoiner()}
              style={{ flex:1 }} />
            <button className="login-btn" onClick={buscarBadgesJoiner} disabled={badgesLoading} style={{ width:"auto", padding:"0 20px" }}>
              {badgesLoading ? "..." : "Buscar"}
            </button>
          </div>
          {badgesErro && <div className="login-error">{badgesErro}</div>}
          {badgesJoiner && (
            <div style={{ background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.08)", borderRadius:10, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)", marginBottom:2 }}>{badgesJoiner.joiner.nome || badgesJoiner.joiner.cog}</div>
              <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginBottom:14 }}>@{badgesJoiner.joiner.cog}</div>
              <BadgesRow badges={badgesJoiner.badges} />
            </div>
          )}
        </div>
      )}

      {adminMainTab === "mercari" && (
        <AdminMercari pedidos={mercariPedidos} onUpdate={setMercariPedidos} />
      )}

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
          {calEventos === null ? (
            <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"20px 0" }}>carregando...</div>
          ) : calEventos.length === 0 ? (
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

      {adminMainTab === "galeria" && owner && <AdminGaleria />}

      {adminMainTab === "envios" && (
        <div>
          {/* PIX */}
          {(() => {
            const PIX_KEY = "de1a489d-db81-4864-a8cf-74cdd79d9cdc";
            return (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(186,255,57,.04)", border:"1px solid rgba(186,255,57,.15)", borderRadius:8, padding:"9px 14px", marginBottom:16, flexWrap:"wrap" }}>
                <span style={{ fontSize:9, color:"rgba(186,255,57,.55)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"1px", flexShrink:0 }}>PIX · Mercado Pago</span>
                <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.6)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{PIX_KEY}</span>
                <button onClick={() => { navigator.clipboard.writeText(PIX_KEY); setAdminPixCopiado(true); setTimeout(() => setAdminPixCopiado(false), 2000); }}
                  style={{ flexShrink:0, padding:"5px 12px", background: adminPixCopiado ? "rgba(186,255,57,.2)" : "rgba(186,255,57,.08)", color:"#BAFF39", border:`1px solid ${adminPixCopiado ? "rgba(186,255,57,.5)" : "rgba(186,255,57,.2)"}`, borderRadius:5, fontFamily:"'DM Mono',monospace", fontSize:10, fontWeight:700, cursor:"pointer", transition:"all .15s" }}>
                  {adminPixCopiado ? "✓ copiado" : "copiar"}
                </button>
              </div>
            );
          })()}
          {/* Pills de status */}
          {(() => {
            const statusConfig = [
              { key:"todos",                   label:"Todos",        color:"rgba(245,240,232,.5)",  border:"rgba(245,240,232,.15)" },
              { key:"solicitação de envio",     label:"Solicitação",  color:"#BAFF39",               border:"rgba(186,255,57,.3)"   },
              { key:"cotação em andamento",     label:"Cotação",      color:"#FF5C1A",               border:"rgba(255,92,26,.3)"    },
              { key:"pagamento em aberto",      label:"Pgto. aberto", color:"#C9A8F0",               border:"rgba(201,168,240,.3)"  },
              { key:"pagamento confirmado",     label:"Pgto. conf.",  color:"#FFD166",               border:"rgba(255,209,102,.3)"  },
              { key:"embalando",                label:"Embalando",    color:"#64B5F6",               border:"rgba(100,181,246,.3)"  },
              { key:"enviado",                  label:"Enviado",      color:"rgba(245,240,232,.4)",  border:"rgba(245,240,232,.12)" },
            ];
            return (
              <div style={{ marginBottom:16 }}>
              <input
                value={buscaEnvio}
                onChange={e => setBuscaEnvio(e.target.value)}
                placeholder="buscar por nome ou @cog..."
                style={{ width:"100%", boxSizing:"border-box", background:"rgba(245,240,232,.05)", border:"1px solid rgba(245,240,232,.1)", borderRadius:8, padding:"8px 12px", color:"var(--offwhite)", fontFamily:"'DM Mono',monospace", fontSize:11, outline:"none", marginBottom:10 }}
              />
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {statusConfig.map(({ key, label, color, border }) => {
                  const base = buscaEnvio.trim() ? envioSolic.filter(e => { const q = buscaEnvio.toLowerCase(); return (e.joiner_nome||"").toLowerCase().includes(q) || (e.joiner_cog||"").toLowerCase().includes(q); }) : envioSolic;
                  const count = key === "todos" ? base.length : base.filter(e => e.status === key).length;
                  if (key !== "todos" && count === 0) return null;
                  const ativo = filtroEnvio === key;
                  return (
                    <button key={key} onClick={() => setFiltroEnvio(key)} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:20, cursor:"pointer", border:`1px solid ${ativo ? border : "rgba(245,240,232,.08)"}`, background: ativo ? `${border.replace(".3)", ".08)")}` : "transparent", transition:"all .15s" }}>
                      <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color: ativo ? color : "rgba(245,240,232,.35)", fontWeight: ativo ? 700 : 400 }}>{label}</span>
                      <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color: ativo ? color : "rgba(245,240,232,.25)", background:"rgba(245,240,232,.06)", borderRadius:10, padding:"1px 7px" }}>{count}</span>
                    </button>
                  );
                })}
                <div style={{ marginLeft:"auto", display:"flex", gap:4, alignItems:"center" }}>
                  {[["individual", false], ["por grupo", true]].map(([label, val]) => (
                    <button key={label} onClick={() => setVerGrupos(val)}
                      style={{ fontSize:9, fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase", padding:"4px 10px", borderRadius:4, cursor:"pointer", border:`1px solid ${verGrupos === val ? "rgba(201,168,240,.4)" : "rgba(245,240,232,.1)"}`, background: verGrupos === val ? "rgba(201,168,240,.12)" : "transparent", color: verGrupos === val ? "#C9A8F0" : "rgba(245,240,232,.3)" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              </div>
            );
          })()}

          {(() => {
            const ORDEM_STATUS = ["solicitação de envio","cotação em andamento","pagamento em aberto","pagamento confirmado","embalando","enviado","cancelado"];
            const STATUS_LABEL = { "solicitação de envio":"Solicitação de Envio", "cotação em andamento":"Cotação em Andamento", "pagamento em aberto":"Pagamento em Aberto", "pagamento confirmado":"Pagamento Confirmado", embalando:"Embalando", enviado:"Enviado", cancelado:"Cancelado" };
            const STATUS_COLOR = { "solicitação de envio":"#BAFF39", "cotação em andamento":"#FF5C1A", "pagamento em aberto":"#C9A8F0", "pagamento confirmado":"#FFD166", embalando:"#64B5F6", enviado:"rgba(245,240,232,.35)", cancelado:"rgba(245,240,232,.2)" };

            const buscaQ = buscaEnvio.trim().toLowerCase();
            const filtradosBusca = buscaQ
              ? envioSolic.filter(e => (e.joiner_nome||"").toLowerCase().includes(buscaQ) || (e.joiner_cog||"").toLowerCase().includes(buscaQ))
              : envioSolic;
            const listaBase = filtroEnvio === "todos" ? filtradosBusca : filtradosBusca.filter(e => e.status === filtroEnvio);
            if (listaBase.length === 0) return <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:12, textAlign:"center", padding:"32px 0" }}>Nenhuma solicitação{filtroEnvio !== "todos" ? " neste status" : ""}{buscaQ ? ` para "${buscaEnvio}"` : ""}.</div>;

            const lista = listaBase;
            const displayLista = verGrupos
              ? [...lista].sort((a, b) => {
                  const ga = a.grupo_envio_codigo || "￿";
                  const gb = b.grupo_envio_codigo || "￿";
                  return ga.localeCompare(gb);
                })
              : lista;

            const grupoCounts = {};
            if (verGrupos) {
              for (const s of lista) {
                if (s.grupo_envio_codigo) grupoCounts[s.grupo_envio_codigo] = (grupoCounts[s.grupo_envio_codigo] || 0) + 1;
              }
            }

            // No modo "todos" sem grupo: ordenar por status priority
            const sortedLista = (filtroEnvio === "todos" && !verGrupos)
              ? [...displayLista].sort((a, b) => {
                  const ia = ORDEM_STATUS.indexOf(a.status); const ib = ORDEM_STATUS.indexOf(b.status);
                  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                })
              : displayLista;

            const seenGrupos = new Set();
            let showedIndiv = false;
            let lastStatus = null;

            return sortedLista.map(s => {
            const statusColor  = { "solicitação de envio":"#BAFF39", "cotação em andamento":"#FF5C1A", "pagamento em aberto":"#C9A8F0", "pagamento confirmado":"#FFD166", embalando:"#64B5F6", enviado:"rgba(245,240,232,.35)", cancelado:"rgba(245,240,232,.2)" }[s.status] || "rgba(245,240,232,.35)";
            const statusBorder = { "solicitação de envio":"rgba(186,255,57,.25)", "cotação em andamento":"rgba(255,92,26,.3)", "pagamento em aberto":"rgba(201,168,240,.3)", "pagamento confirmado":"rgba(255,209,102,.3)", embalando:"rgba(100,181,246,.3)", enviado:"rgba(245,240,232,.1)", cancelado:"rgba(245,240,232,.08)" }[s.status] || "rgba(245,240,232,.1)";
            const expanded = expandedEnvio.has(s.id);
            const toggleExpand = () => setExpandedEnvio(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; });

            const isGrupo = verGrupos && !!s.grupo_envio_codigo;
            const isFirstGrupo = isGrupo && !seenGrupos.has(s.grupo_envio_codigo);
            if (isGrupo) seenGrupos.add(s.grupo_envio_codigo);
            const showIndivSep = verGrupos && !isGrupo && !showedIndiv && seenGrupos.size > 0;
            if (showIndivSep) showedIndiv = true;

            const showStatusHeader = filtroEnvio === "todos" && !verGrupos && s.status !== lastStatus;
            lastStatus = s.status;

            return (
              <Fragment key={s.id}>
                {showStatusHeader && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop: lastStatus !== s.status ? 20 : 0, marginBottom:10 }}>
                    <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", fontWeight:700, color: statusColor, letterSpacing:"1.5px", textTransform:"uppercase" }}>{STATUS_LABEL[s.status]}</span>
                    <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.25)", background:"rgba(245,240,232,.05)", borderRadius:10, padding:"1px 8px" }}>{sortedLista.filter(x => x.status === s.status).length}</span>
                    <div style={{ flex:1, height:"1px", background:"rgba(245,240,232,.06)" }} />
                  </div>
                )}
                {isFirstGrupo && (
                  <div style={{ background:"rgba(201,168,240,.06)", border:"1px solid rgba(201,168,240,.22)", borderRadius:8, padding:"10px 14px", marginBottom:6, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontWeight:900, color:"#C9A8F0", fontSize:14, letterSpacing:3 }}>{s.grupo_envio_codigo}</span>
                    <span style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace" }}>👥 {grupoCounts[s.grupo_envio_codigo]} joiner(s)</span>
                    <span style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginLeft:"auto" }}>{s.endereco}{s.numero ? `, ${s.numero}` : ""}{s.complemento ? ` (${s.complemento})` : ""} — {s.bairro}, {s.cidade}/{s.estado}</span>
                  </div>
                )}
                {showIndivSep && (
                  <div style={{ fontSize:9, fontFamily:"'DM Mono',monospace", letterSpacing:"1.5px", textTransform:"uppercase", color:"rgba(245,240,232,.25)", marginBottom:8, marginTop:4 }}>Sem grupo</div>
                )}
              <div style={{ background:"var(--card-bg)", border:`1px solid ${statusBorder}`, borderRadius:10, marginBottom:8, overflow:"hidden", ...(isGrupo ? { marginLeft:12 } : {}) }}>
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
                {s.joiner_handle && <div style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginBottom:10, marginTop:2 }}>{s.joiner_handle}</div>}

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
                          corrigirOk === it.id
                            ? <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"#4ade80", marginLeft:8, whiteSpace:"nowrap" }}>✓ revertido</span>
                            : <button onClick={() => corrigirItem(s, it)} style={{ fontSize:9, fontFamily:"'DM Mono',monospace", background:"rgba(255,92,26,.08)", color:"var(--laranja)", border:"1px solid rgba(255,92,26,.25)", borderRadius:4, padding:"3px 8px", cursor:"pointer", whiteSpace:"nowrap", marginLeft:8 }}>
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
                        <div key={idx} style={{ display:"grid", gridTemplateColumns: adminIsMobile ? "1fr 1fr" : "130px 1fr 1fr 1fr auto", gap:6, alignItems:"center" }}>
                          <select value={op.forma} onChange={e => { const a=[...cotacaoOpcoes]; a[idx]={...a[idx],forma:e.target.value}; setCotacaoOpcoes(a); }} style={{ ...inp2, cursor:"pointer" }}>
                            <option value="">Modalidade...</option>
                            {formas.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                          <input value={op.valor} onChange={e => { const a=[...cotacaoOpcoes]; a[idx]={...a[idx],valor:e.target.value}; setCotacaoOpcoes(a); }} placeholder="Valor c/ desconto" style={inp2} />
                          <input value={op.valor_original||""} onChange={e => { const a=[...cotacaoOpcoes]; a[idx]={...a[idx],valor_original:e.target.value}; setCotacaoOpcoes(a); }} placeholder="Valor original (opcional)" style={inp2} />
                          <input value={op.prazo} onChange={e => { const a=[...cotacaoOpcoes]; a[idx]={...a[idx],prazo:e.target.value}; setCotacaoOpcoes(a); }} placeholder="Prazo (ex: 9 dias úteis)" style={inp2} />
                          {cotacaoOpcoes.length > 1
                            ? <button onClick={() => setCotacaoOpcoes(cotacaoOpcoes.filter((_,i) => i !== idx))} style={{ background:"transparent", border:"none", color:"rgba(245,240,232,.25)", cursor:"pointer", fontSize:15, padding:"0 4px" }}>✕</button>
                            : <span style={{ width:22 }} />
                          }
                        </div>
                      ))}
                      {cotacaoOpcoes.length < 4 && (
                        <button onClick={() => setCotacaoOpcoes([...cotacaoOpcoes, { forma:"", valor:"", valor_original:"", prazo:"" }])} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.35)", border:"1px dashed rgba(245,240,232,.15)", borderRadius:5, padding:"5px", cursor:"pointer" }}>+ modalidade</button>
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
                      await supabase.from("pushes").insert([{ message:"Sua solicitação de envio está sendo processada — em até 5 dias úteis você receberá a cotação.", active:true, joiner_cog:s.joiner_cog }]);
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
                      const { error: ePgto } = await supabase.from("envio_solicitacoes").update({ status:"pagamento confirmado" }).eq("id", s.id);
                      if (ePgto) { alert("Erro: " + ePgto.message); return; }
                      await supabase.from("pushes").insert([{ message:"Seu pagamento foi confirmado! Em breve seu pedido será enviado.", active:true, joiner_cog:s.joiner_cog }]);
                      setEnvioSolic(prev => prev.map(x => x.id === s.id ? { ...x, status:"pagamento confirmado" } : x));
                    }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(255,209,102,.12)", color:"#FFD166", border:"1px solid rgba(255,209,102,.3)", borderRadius:5, padding:"6px 14px", cursor:"pointer", fontWeight:700 }}>
                      ✓ Pagamento confirmado
                    </button>
                  )}
                  {s.status === "pagamento confirmado" && (
                    <button onClick={async () => {
                      const { error: eEmb } = await supabase.from("envio_solicitacoes").update({ status:"embalando" }).eq("id", s.id);
                      if (eEmb) { alert("Erro: " + eEmb.message); return; }
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
                  {s.status !== "cancelado" && (
                    <button onClick={() => cancelarSolicitacaoAdmin(s)} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.2)", border:"1px solid rgba(245,240,232,.08)", borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>
                      Cancelar solicitação
                    </button>
                  )}
                  {["cancelado","enviado"].includes(s.status) && (
                    <button onClick={async () => {
                      await supabase.from("envio_solicitacoes").update({
                        status:"solicitação de envio",
                        cotacao_opcoes:null, cotacao_valor:null, cotacao_frete:null,
                        cotacao_forma:null, cotacao_prazo:null, cotacao_embalagem:null,
                        cotacao_obs:null, modalidade_escolhida:null,
                        rastreio_codigo:null, rastreio_link:null,
                      }).eq("id", s.id);
                      setEnvioSolic(prev => prev.map(x => x.id === s.id ? {
                        ...x, status:"solicitação de envio",
                        cotacao_opcoes:null, cotacao_valor:null, cotacao_frete:null,
                        cotacao_forma:null, cotacao_prazo:null, cotacao_embalagem:null,
                        cotacao_obs:null, modalidade_escolhida:null,
                        rastreio_codigo:null, rastreio_link:null,
                      } : x));
                    }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(186,255,57,.06)", color:"#BAFF39", border:"1px solid rgba(186,255,57,.2)", borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>
                      ↺ Reabrir solicitação
                    </button>
                  )}
                </div>

                {/* Push manual */}
                <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid rgba(245,240,232,.06)" }}>
                  {pushManualId === s.id ? (
                    <div style={{ display:"flex", gap:8 }}>
                      <input
                        autoFocus
                        value={pushManualMsg}
                        onChange={e => setPushManualMsg(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === "Escape") { setPushManualId(null); setPushManualMsg(""); }
                          if (e.key === "Enter" && pushManualMsg.trim() && !pushManualSending) {
                            setPushManualSending(true);
                            await supabase.from("pushes").insert([{ message: pushManualMsg.trim(), active: true, joiner_cog: s.joiner_cog }]);
                            setPushManualId(null); setPushManualMsg(""); setPushManualSending(false);
                          }
                        }}
                        placeholder={`Mensagem para ${s.joiner_nome || s.joiner_cog}...`}
                        style={{ flex:1, background:"#0d0d0d", border:"1px solid rgba(201,168,240,.25)", borderRadius:6, padding:"7px 10px", color:"#F5F0E8", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none" }}
                      />
                      <button disabled={!pushManualMsg.trim() || pushManualSending} onClick={async () => {
                        setPushManualSending(true);
                        await supabase.from("pushes").insert([{ message: pushManualMsg.trim(), active: true, joiner_cog: s.joiner_cog }]);
                        setPushManualId(null); setPushManualMsg(""); setPushManualSending(false);
                      }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(201,168,240,.12)", color:"#C9A8F0", border:"1px solid rgba(201,168,240,.3)", borderRadius:6, padding:"7px 14px", cursor:"pointer", fontWeight:700, opacity: pushManualMsg.trim() ? 1 : .4 }}>
                        {pushManualSending ? "..." : "Enviar →"}
                      </button>
                      <button onClick={() => { setPushManualId(null); setPushManualMsg(""); }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.25)", border:"1px solid rgba(245,240,232,.1)", borderRadius:6, padding:"7px 10px", cursor:"pointer" }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setPushManualId(s.id); setPushManualMsg(""); }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(201,168,240,.45)", border:"1px solid rgba(201,168,240,.15)", borderRadius:6, padding:"5px 12px", cursor:"pointer" }}>
                      📢 Enviar push para {s.joiner_nome || s.joiner_cog}
                    </button>
                  )}
                </div>

              </div>
              }
            </div>
            </Fragment>
            );
          });
          })()}
        </div>
      )}

      {/* ── DEMANDAS DE PAGAMENTO (legado — migrado para pagamentos > formulário) ── */}
      {adminMainTab === "demandas_legacy_unused" && (() => {
        const pendentes  = pagDemandas.filter(d => d.status === "em_analise");
        const resolvidas = pagDemandas.filter(d => d.status === "pago");

        async function confirmar(id) {
          const { error } = await supabase.from("pagamento_demandas").update({ status: "pago" }).eq("id", id);
          if (error) { alert("Erro ao confirmar: " + error.message); return; }
          const d = pagDemandas.find(x => x.id === id);
          if (d) {
            for (const it of (d.itens || [])) {
              if (!it.id) continue;
              const updates = {};
              if (Number(it.valor_item  || 0) > 0) updates.pago_item  = true;
              if (Number(it.frete_inter || 0) > 0) updates.pago_frete = true;
              if (Number(it.taxa_rf     || 0) > 0) updates.pago_rf    = true;
              if (Object.keys(updates).length > 0)
                await supabase.from("masterlist").update(updates).eq("id", it.id);
            }
            await supabase.from("pushes").insert([{ message:`Seu pagamento foi confirmado! R$ ${Number(d.valor_total).toFixed(2).replace(".",",")} — ${d.itens.length} item(s).`, active:true, joiner_cog:d.joiner_cog }]);
          }
          setPagDemandas(prev => prev.map(x => x.id === id ? { ...x, status:"pago" } : x));
        }
        async function reabrir(id) {
          await supabase.from("pagamento_demandas").update({ status: "em_analise" }).eq("id", id);
          setPagDemandas(prev => prev.map(x => x.id === id ? { ...x, status:"em_analise" } : x));
        }

        const joinerNome = cog => (joinersData || []).find(j => j.cog === cog)?.nome || null;

        const CardDemanda = ({ d }) => {
          const isPend = d.status === "em_analise";
          const nome = joinerNome(d.joiner_cog);
          return (
            <div style={{ background:"var(--card-bg)", border:`1px solid ${isPend ? "rgba(167,139,250,.2)" : "rgba(245,240,232,.07)"}`, borderRadius:10, padding:"16px", marginBottom:8 }}>
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    {nome && <span style={{ fontSize:13, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{nome}</span>}
                    <span style={{ fontSize:11, color:"rgba(167,139,250,.7)", fontFamily:"'DM Mono',monospace" }}>@{d.joiner_cog}</span>
                    <span style={{ fontSize:9, padding:"2px 8px", borderRadius:4, fontFamily:"'DM Mono',monospace", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em",
                      border: isPend ? "1px solid rgba(167,139,250,.35)" : "1px solid rgba(186,255,57,.25)",
                      color: isPend ? "#A78BFA" : "#BAFF39",
                      background: isPend ? "rgba(167,139,250,.08)" : "rgba(186,255,57,.06)" }}>
                      {isPend ? "em análise" : "pago"}
                    </span>
                  </div>
                  <div style={{ fontSize:9, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace", marginTop:4 }}>
                    {new Date(d.created_at).toLocaleDateString("pt-BR")} às {new Date(d.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
                <div style={{ fontSize:17, fontWeight:900, color: isPend ? "#F5F0E8" : "rgba(245,240,232,.45)", fontFamily:"'DM Mono',monospace", flexShrink:0, marginLeft:12 }}>
                  R$ {Number(d.valor_total).toFixed(2).replace(".",",")}
                </div>
              </div>

              {/* Itens em tabela */}
              {(() => {
                const temMulta = d.itens.some(it => Number(it.multa||0) > 0);
                const thS = { fontSize:8, letterSpacing:"1.2px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", textAlign:"right", padding:"10px 0 6px", fontWeight:400 };
                const tdS = { fontSize:11, fontFamily:"'DM Mono',monospace", textAlign:"right", color:"rgba(245,240,232,.55)", padding:"8px 0", verticalAlign:"middle" };
                const dash = <span style={{ color:"rgba(245,240,232,.18)" }}>—</span>;
                const fmt = v => `R$${Number(v).toFixed(2).replace(".",",")}`;
                return (
                  <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed", borderTop:"1px solid rgba(245,240,232,.06)", marginBottom:10 }}>
                    <colgroup>
                      <col />
                      <col style={{ width:68 }} />
                      <col style={{ width:68 }} />
                      <col style={{ width:46 }} />
                      {temMulta && <col style={{ width:62 }} />}
                      <col style={{ width:74 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ ...thS, textAlign:"left" }}>Item</th>
                        <th style={thS}>Item R$</th>
                        <th style={thS}>Frete</th>
                        <th style={thS}>RF</th>
                        {temMulta && <th style={{ ...thS, color:"rgba(255,107,107,.45)" }}>Multa</th>}
                        <th style={thS}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.itens.map((it, i) => {
                        const vItem  = Number(it.valor_item  || 0);
                        const vFrete = Number(it.frete_inter || 0);
                        const vRf    = Number(it.taxa_rf     || 0);
                        const vMulta = Number(it.multa       || 0);
                        const total  = vItem + vFrete + vRf + vMulta;
                        return (
                          <tr key={i} style={{ borderTop:"1px solid rgba(245,240,232,.05)" }}>
                            <td style={{ padding:"8px 8px 8px 0", verticalAlign:"middle" }}>
                              <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.8)", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.nome_do_item}</div>
                              <div style={{ fontSize:9, color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", marginTop:1 }}>{it.ceg}</div>
                            </td>
                            <td style={tdS}>{vItem  > 0 ? fmt(vItem)  : dash}</td>
                            <td style={tdS}>{vFrete > 0 ? fmt(vFrete) : dash}</td>
                            <td style={tdS}>{vRf    > 0 ? fmt(vRf)    : dash}</td>
                            {temMulta && <td style={{ ...tdS, color: vMulta > 0 ? "rgba(255,107,107,.8)" : undefined }}>{vMulta > 0 ? fmt(vMulta) : dash}</td>}
                            <td style={{ ...tdS, color: vMulta > 0 ? "#ff6b6b" : "#BAFF39", fontWeight:700 }}>{fmt(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}

              {/* Comprovante + obs */}
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom: (isPend || !isPend) ? 10 : 0 }}>
                {d.comprovante_url && (
                  <a href={d.comprovante_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"rgba(100,181,246,.08)", border:"1px solid rgba(100,181,246,.2)", borderRadius:5, padding:"4px 10px", color:"#64B5F6", textDecoration:"none" }}>
                    ↓ ver comprovante
                  </a>
                )}
                {d.obs && <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.35)", fontStyle:"italic" }}>{d.obs}</span>}
              </div>

              {/* Ações */}
              {isPend ? (
                <button onClick={() => confirmar(d.id)}
                  style={{ width:"100%", padding:"10px", background:"rgba(186,255,57,.12)", color:"#BAFF39", border:"1px solid rgba(186,255,57,.3)", borderRadius:7, fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:".05em" }}>
                  ✓ Confirmar pagamento
                </button>
              ) : (
                <button onClick={() => reabrir(d.id)}
                  style={{ width:"100%", padding:"8px", background:"transparent", color:"rgba(245,240,232,.3)", border:"1px solid rgba(245,240,232,.1)", borderRadius:7, fontFamily:"'DM Mono',monospace", fontSize:10, cursor:"pointer" }}>
                  ↩ Reabrir
                </button>
              )}
            </div>
          );
        };

        return (
          <div>
            {pendentes.length === 0 && resolvidas.length === 0 && (
              <div style={{ textAlign:"center", padding:"48px 0", fontSize:12, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace" }}>Nenhuma demanda ainda.</div>
            )}
            {pendentes.length > 0 && (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <div style={{ fontSize:9, letterSpacing:"1.5px", color:"rgba(167,139,250,.7)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase" }}>Em análise</div>
                  <div style={{ background:"rgba(167,139,250,.2)", color:"#A78BFA", borderRadius:99, fontSize:9, fontWeight:700, fontFamily:"'DM Mono',monospace", padding:"1px 7px" }}>{pendentes.length}</div>
                </div>
                {pendentes.map(d => <CardDemanda key={d.id} d={d} />)}
              </>
            )}
            {resolvidas.length > 0 && (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:8, margin:"24px 0 12px" }}>
                  <div style={{ fontSize:9, letterSpacing:"1.5px", color:"rgba(186,255,57,.5)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase" }}>Confirmados</div>
                  <div style={{ background:"rgba(186,255,57,.12)", color:"#BAFF39", borderRadius:99, fontSize:9, fontWeight:700, fontFamily:"'DM Mono',monospace", padding:"1px 7px" }}>{resolvidas.length}</div>
                </div>
                {resolvidas.map(d => <CardDemanda key={d.id} d={d} />)}
              </>
            )}
          </div>
        );
      })()}

      {/* ── REPASSOS ── */}
      {adminMainTab === "repassos" && (() => {
        const [searchRepasse,     setSearchRepasse]     = [adminRepasseSearch,     setAdminRepasseSearch];
        const [repasseAdminTab,   setRepasseAdminTab]   = [adminRepasseTab,        setAdminRepasseTab];
        const [openRepasseJoiner, setOpenRepasseJoiner] = [adminRepasseOpenJoiner, setAdminRepasseOpenJoiner];

        async function aprovarRepasse(r) {
          await supabase.from("repassos").update({ status: "aprovado" }).eq("id", r.id);
          await supabase.from("pushes").insert([{ message:`Seu repasse de "${r.nome_do_item}" para ${r.novo_dono_nome} foi aprovado pela admin!`, active:true, joiner_cog:r.joiner_cog }]);
          await supabase.from("pushes").insert([{ message:`Repasse aprovado! O item "${r.nome_do_item}" (${r.ceg}) agora é seu. Fale com a admin para mais detalhes.`, active:true, joiner_cog:r.novo_dono_cog }]);
          setAdminRepassos(prev => prev.map(x => x.id === r.id ? { ...x, status:"aprovado" } : x));
        }
        async function recusarRepasse(r) {
          await supabase.from("repassos").update({ status: "recusado" }).eq("id", r.id);
          await supabase.from("pushes").insert([{ message:`Seu repasse de "${r.nome_do_item}" foi recusado. Entre em contato com a admin para mais informações.`, active:true, joiner_cog:r.joiner_cog }]);
          setAdminRepassos(prev => prev.map(x => x.id === r.id ? { ...x, status:"recusado" } : x));
        }
        async function reabrirRepasse(id) {
          await supabase.from("repassos").update({ status: "pendente" }).eq("id", id);
          setAdminRepassos(prev => prev.map(x => x.id === id ? { ...x, status:"pendente" } : x));
        }

        const custosMap = { item:"Item", frete:"Frete", rf:"Taxa RF" };

        const RepasseCard = ({ r }) => (
          <div style={{ borderTop:"1px solid rgba(245,240,232,.06)", padding:"12px 0" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:6 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--offwhite)", marginBottom:2 }}>
                  {r.nome_do_item} <span style={{ color:"rgba(245,240,232,.3)", fontWeight:400 }}>· {r.ceg}</span>
                </div>
                <div style={{ fontSize:9, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace" }}>
                  {new Date(r.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
                  {r.novo_dono_nome && <> · para <strong style={{color:"rgba(167,139,250,.8)"}}>{r.novo_dono_nome}</strong> @{r.novo_dono_cog}</>}
                </div>
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", flexShrink:0 }}>
                R$ {Number(r.valor_acordado).toFixed(2).replace(".",",")}
              </div>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
              <span style={{ fontSize:9, padding:"1px 7px", borderRadius:3, fontFamily:"'DM Mono',monospace", border: r.item_quitado ? "1px solid rgba(186,255,57,.3)" : "1px solid rgba(255,107,107,.3)", color: r.item_quitado ? "#BAFF39" : "#ff6b6b", background: r.item_quitado ? "rgba(186,255,57,.06)" : "rgba(255,107,107,.06)" }}>
                {r.item_quitado ? "quitado" : "não quitado"}
              </span>
              {(r.custos_pagos || []).map(c => (
                <span key={c} style={{ fontSize:9, padding:"1px 7px", borderRadius:3, fontFamily:"'DM Mono',monospace", background:"rgba(245,240,232,.06)", border:"1px solid rgba(245,240,232,.12)", color:"rgba(245,240,232,.5)" }}>{custosMap[c]||c}</span>
              ))}
            </div>
            {!r.item_quitado && r.valor_pendente_descricao && (
              <div style={{ fontSize:10, color:"rgba(255,107,107,.7)", fontFamily:"'DM Mono',monospace", marginBottom:6, fontStyle:"italic" }}>↳ {r.valor_pendente_descricao}</div>
            )}
            {r.obs && <div style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontStyle:"italic", marginBottom:6 }}>"{r.obs}"</div>}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginTop:4 }}>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {r.comprovacao_url && (
                  <a href={r.comprovacao_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:9, fontFamily:"'DM Mono',monospace", background:"rgba(100,181,246,.08)", border:"1px solid rgba(100,181,246,.2)", borderRadius:4, padding:"3px 8px", color:"#64B5F6", textDecoration:"none" }}>
                    ↗ ver comprovação
                  </a>
                )}
              </div>
              {r.status === "pendente" ? (
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => aprovarRepasse(r)} style={{ background:"rgba(186,255,57,.1)", border:"1px solid rgba(186,255,57,.3)", color:"#BAFF39", borderRadius:5, padding:"4px 12px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer", fontWeight:700 }}>✓ Aprovar</button>
                  <button onClick={() => recusarRepasse(r)} style={{ background:"rgba(255,107,107,.08)", border:"1px solid rgba(255,107,107,.2)", color:"#ff6b6b", borderRadius:5, padding:"4px 12px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer", fontWeight:700 }}>✗ Recusar</button>
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color: r.status==="aprovado" ? "#BAFF39" : "#ff6b6b" }}>
                    {r.status === "aprovado" ? "✓ aprovado" : r.status === "cancelado" ? "— cancelado" : "✗ recusado"}
                  </span>
                  {r.status !== "cancelado" && (
                    <button onClick={() => reabrirRepasse(r.id)} style={{ background:"none", border:"1px solid rgba(245,240,232,.1)", color:"rgba(245,240,232,.3)", borderRadius:5, padding:"3px 8px", fontSize:9, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>↩ reabrir</button>
                  )}
                </div>
              )}
            </div>
          </div>
        );

        const q    = (searchRepasse||"").trim().toLowerCase();
        const base = (adminRepassos||[]).filter(r =>
          !q || r.joiner_nome?.toLowerCase().includes(q) || r.joiner_cog?.toLowerCase().includes(q) ||
                r.novo_dono_nome?.toLowerCase().includes(q) || r.nome_do_item?.toLowerCase().includes(q)
        );
        const pendentes  = base.filter(r => r.status === "pendente");
        const resolvidos = base.filter(r => r.status !== "pendente");
        const lista      = repasseAdminTab === "pendentes" ? pendentes : resolvidos;

        const tabBtnStyle = active => ({
          background: active ? "rgba(245,240,232,.08)" : "none",
          border: `1px solid ${active ? "rgba(245,240,232,.2)" : "rgba(245,240,232,.07)"}`,
          color: active ? "var(--offwhite)" : "rgba(245,240,232,.35)",
          borderRadius:8, padding:"6px 16px", fontSize:12,
          fontFamily:"'DM Mono',monospace", fontWeight: active ? 700 : 400, cursor:"pointer",
          display:"flex", alignItems:"center", gap:7, textTransform:"uppercase", letterSpacing:".08em",
        });

        // Agrupar por joiner
        const byJoiner = {};
        lista.forEach(r => {
          const key = r.joiner_cog || "—";
          if (!byJoiner[key]) byJoiner[key] = { nome:r.joiner_nome, cog:r.joiner_cog, repassos:[] };
          byJoiner[key].repassos.push(r);
        });
        const grupos = Object.values(byJoiner).sort((a,b) => b.repassos.length - a.repassos.length);

        return (
          <div>
            <input value={searchRepasse||""} onChange={e => { setSearchRepasse(e.target.value); setOpenRepasseJoiner(null); }}
              placeholder="Buscar joiner ou item..."
              style={{ width:"100%", marginBottom:12, background:"rgba(245,240,232,.04)", border:"1px solid rgba(245,240,232,.12)", borderRadius:7, padding:"8px 12px", color:"#F5F0E8", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box" }}
            />
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <button style={tabBtnStyle(repasseAdminTab==="pendentes")} onClick={() => { setRepasseAdminTab("pendentes"); setOpenRepasseJoiner(null); }}>
                Pendentes {pendentes.length > 0 && <span style={{ background:"var(--laranja)", color:"#000", borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{pendentes.length}</span>}
              </button>
              <button style={tabBtnStyle(repasseAdminTab==="resolvidos")} onClick={() => { setRepasseAdminTab("resolvidos"); setOpenRepasseJoiner(null); }}>
                Resolvidos {resolvidos.length > 0 && <span style={{ background:"rgba(74,222,128,.2)", color:"#4ade80", borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{resolvidos.length}</span>}
              </button>
            </div>
            {grupos.length === 0 && <div style={{ fontSize:12, color:"rgba(245,240,232,.3)", padding:"16px 0" }}>Nenhum repasse{q ? ` para "${searchRepasse}"` : ""}.</div>}
            {grupos.map(g => {
              const isOpen = openRepasseJoiner === g.cog;
              const pendCount = g.repassos.filter(r => r.status === "pendente").length;
              return (
                <div key={g.cog} style={{ background:"var(--card-bg)", border:`1px solid ${pendCount > 0 ? "rgba(167,139,250,.25)" : "rgba(74,222,128,.1)"}`, borderRadius:10, marginBottom:6, overflow:"hidden" }}>
                  <div onClick={() => setOpenRepasseJoiner(isOpen ? null : g.cog)} style={{ display:"flex", alignItems:"center", padding:"12px 16px", cursor:"pointer", gap:10 }}>
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"var(--offwhite)" }}>{g.nome}</span>
                      <span style={{ fontSize:10, color:"rgba(245,240,232,.35)", marginLeft:8 }}>@{g.cog}</span>
                    </div>
                    <span style={{ fontSize:10, background: pendCount > 0 ? "rgba(167,139,250,.15)" : "rgba(74,222,128,.12)", color: pendCount > 0 ? "#A78BFA" : "#4ade80", border:`1px solid ${pendCount > 0 ? "rgba(167,139,250,.3)" : "rgba(74,222,128,.25)"}`, borderRadius:99, padding:"2px 9px", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
                      {g.repassos.length} repasse{g.repassos.length > 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize:12, color:"rgba(245,240,232,.4)", transition:"transform .15s", display:"inline-block", transform: isOpen ? "rotate(180deg)" : "none" }}>▾</span>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop:"1px solid rgba(245,240,232,.06)", padding:"4px 16px 12px" }}>
                      {g.repassos.map(r => <RepasseCard key={r.id} r={r} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── ATUALIZAÇÕES DE PERFIL ── */}
      {adminMainTab === "atualizacoes" && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"rgba(245,240,232,.4)" }}>
              {joinerUpdates.filter(u => !u.lido).length} não lida(s)
            </div>
            {joinerUpdates.some(u => !u.lido) && (
              <button onClick={async () => {
                await supabase.from("joiner_updates").update({ lido: true }).eq("lido", false);
                setJoinerUpdates(prev => prev.map(u => ({ ...u, lido: true })));
              }} style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.35)", border:"1px solid rgba(245,240,232,.1)", borderRadius:6, padding:"5px 12px", cursor:"pointer" }}>
                marcar todas como lidas
              </button>
            )}
          </div>

          {joinerUpdates.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 0", fontSize:12, color:"rgba(245,240,232,.25)", fontFamily:"'DM Mono',monospace" }}>
              Nenhuma atualização de perfil ainda.
            </div>
          ) : joinerUpdates.map(u => {
            const campos = u.campos || {};
            const nomes = { nome:"Nome", twitter:"@", whatsapp:"WhatsApp", email:"E-mail" };
            return (
              <div key={u.id} style={{ background: u.lido ? "var(--card-bg)" : "rgba(201,168,240,.05)", border:`1px solid ${u.lido ? "rgba(245,240,232,.07)" : "rgba(201,168,240,.25)"}`, borderRadius:10, padding:"14px 16px", marginBottom:8, display:"flex", alignItems:"flex-start", gap:12 }}>
                {!u.lido && <div style={{ width:6, height:6, borderRadius:"50%", background:"#C9A8F0", flexShrink:0, marginTop:5 }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>@{u.joiner_cog}</span>
                    <span style={{ fontSize:9, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>
                      {new Date(u.created_at).toLocaleDateString("pt-BR")} às {new Date(u.created_at).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
                    </span>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {Object.entries(campos).map(([campo, { de, para }]) => (
                      <div key={campo} style={{ fontSize:11, fontFamily:"'DM Mono',monospace", display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <span style={{ fontSize:9, background:"rgba(245,240,232,.07)", borderRadius:4, padding:"2px 6px", color:"rgba(245,240,232,.4)", textTransform:"uppercase", letterSpacing:".05em" }}>{nomes[campo] || campo}</span>
                        <span style={{ color:"rgba(245,240,232,.35)", textDecoration:"line-through", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{de || "—"}</span>
                        <span style={{ color:"rgba(245,240,232,.25)" }}>→</span>
                        <span style={{ color:"#F5F0E8", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{para || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {!u.lido && (
                  <button onClick={async () => {
                    await supabase.from("joiner_updates").update({ lido: true }).eq("id", u.id);
                    setJoinerUpdates(prev => prev.map(x => x.id === u.id ? { ...x, lido: true } : x));
                  }} style={{ flexShrink:0, fontSize:9, fontFamily:"'DM Mono',monospace", background:"transparent", color:"rgba(245,240,232,.3)", border:"1px solid rgba(245,240,232,.1)", borderRadius:6, padding:"4px 10px", cursor:"pointer", whiteSpace:"nowrap" }}>
                    ✓ lida
                  </button>
                )}
              </div>
            );
          })}
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

function MercariTab() {
  const PIX  = 'de1a489d-db81-4864-a8cf-74cdd79d9cdc';
  const WA   = '5524992782023';
  const SUPA_URL = 'https://ghjfsmwwcfpfvrouyrka.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM';
  const STEPS = [{key:'pendente',label:'Solicitado'},{key:'aprovado',label:'Aprovado'},{key:'pago',label:'Pago'},{key:'finalizado',label:'Finalizado'}];
  const STEP_IDX = {pendente:0,aprovado:1,pago:2,finalizado:3,recusado:-1};

  const [fxVal, setFxVal]     = useState(0.03141);
  const [fxInp, setFxInp]     = useState('');
  const [modal, setModal]     = useState(false);
  const [itab, setItab]       = useState('pedido');
  const [joiner, setJoiner]   = useState(null);
  const [idInp, setIdInp]     = useState('');
  const [idSt, setIdSt]       = useState('');
  const [idMsg, setIdMsg]     = useState('');
  const [items, setItems]     = useState([{id:1,nome:'',link:'',jpy:0}]);
  const [checks, setChecks]   = useState([false,false,false,false]);
  const [semComp, setSemComp] = useState(false);
  const [fileComp, setFileComp] = useState(null);
  const [idPix, setIdPix]     = useState('');
  const [sending, setSending] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [done, setDone]       = useState(false);
  const [waLink, setWaLink]   = useState('');
  const [calcInp, setCalcInp] = useState(5000);
  const [pedidos, setPedidos] = useState(null);
  const [pedLoad, setPedLoad] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  const tmrRef  = useRef(null);
  const idRef   = useRef('');
  const jRef    = useRef(null);
  const fxRef   = useRef(0.03141);
  const cntRef  = useRef(1);
  const fileRef = useRef(null);

  useEffect(() => { jRef.current = joiner; }, [joiner]);
  useEffect(() => { fxRef.current = fxVal; }, [fxVal]);

  const calcBRL = (jpy) => { const s=jpy+100,f=Math.round(s*.08),c=s+f,p=Math.round(c*.08); return (c+p)*fxVal; };
  const fBRL = (v) => v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fJPY = (v) => '¥ '+Math.round(v).toLocaleString('pt-BR');

  const calcR = useMemo(() => {
    const n=parseFloat(calcInp)||0,s=n+100,f=Math.round(s*.08),c=s+f,p=Math.round(c*.08),t=c+p;
    return {n,f,t,b:t*fxVal};
  }, [calcInp,fxVal]);

  const tots = useMemo(() => {
    let j=0,b=0; items.forEach(it=>{if(it.jpy>0){j+=it.jpy;b+=calcBRL(it.jpy);}});
    return {j,b};
  }, [items,fxVal]);

  const formOk = useMemo(() => {
    const io=items.length>0&&items.every(it=>it.link&&it.jpy>0);
    const po=semComp?idPix.trim().length>0:!!fileComp;
    return !!(joiner&&io&&checks.every(c=>c)&&po);
  }, [joiner,items,checks,semComp,idPix,fileComp]);

  const waHref = useMemo(() => {
    if(!joiner) return '#';
    let j=0,b=0,lines='';
    items.forEach((it,i)=>{
      const v=calcBRL(it.jpy||0);
      if(it.link||it.jpy>0){j+=it.jpy||0;b+=v;lines+=`\nItem ${i+1}${it.nome?' — '+it.nome:''}: ¥${(it.jpy||0).toLocaleString('pt-BR')} → R$ ${fBRL(v)}${it.link?'\n'+it.link:''}`;}
    });
    const vt=j>0?`\n\nValor total: ¥${Math.round(j).toLocaleString('pt-BR')} · R$ ${fBRL(b)}`:'';
    return `https://wa.me/${WA}?text=${encodeURIComponent(`Olá! Gostaria de pagar por cartão o meu pedido da Caixinha Mercari. Sou ${joiner.nome||joiner.cog} (@${joiner.cog}).`+(lines?`\n${lines}`:'')+vt+`\n\nPode me enviar o link de pagamento?`)}`;
  }, [joiner,items,fxVal]);

  const buscar = async () => {
    clearTimeout(tmrRef.current);
    const v=idRef.current.trim();
    if(!v) return;
    setIdSt('loading'); setIdMsg('Buscando...');
    const isEml=v.includes('@')&&v.indexOf('@')>0;
    let q=supabase.from('joiners').select('cog,nome,email').limit(1);
    q=isEml?q.eq('email',v.toLowerCase()):q.ilike('twitter',`@${v.replace(/^@/,'')}`);
    try {
      const {data}=await q;
      if(data?.length){
        const j=data[0]; setJoiner(j); jRef.current=j;
        setIdSt('found'); setIdMsg(`✦ ${j.nome||j.cog} · @${j.cog}`);
        setItems(p=>p.length?p:[{id:++cntRef.current,nome:'',link:'',jpy:0}]);
        loadPedidos(j);
      } else {
        setJoiner(null); jRef.current=null;
        setIdSt('notfound'); setIdMsg('Cadastro não encontrado. Fale com a GOM pelo WhatsApp.');
      }
    } catch {
      setJoiner(null); jRef.current=null;
      setIdSt('notfound'); setIdMsg('Erro de conexão. Tente novamente.');
    }
  };

  const onId = (v) => {
    idRef.current=v; setIdInp(v);
    setIdSt(''); setIdMsg(''); setJoiner(null); jRef.current=null; setPedidos(null);
    clearTimeout(tmrRef.current);
    if(v.trim().length>=3) tmrRef.current=setTimeout(buscar,600);
  };

  const loadPedidos = async (j) => {
    const jj=j||jRef.current; if(!jj) return;
    setPedLoad(true);
    try {
      const {data}=await supabase.from('mercari_pedidos').select('*').eq('joiner_cog',jj.cog).order('created_at',{ascending:false});
      setPedidos(Array.isArray(data)?data:[]);
    } catch { setPedidos([]); }
    setPedLoad(false);
  };

  useEffect(() => {
    if(itab==='meus'&&jRef.current&&pedidos===null&&!pedLoad) loadPedidos();
  }, [itab]);

  const addIt = () => { const id=++cntRef.current; setItems(p=>[...p,{id,nome:'',link:'',jpy:0}]); };
  const rmIt  = (id) => setItems(p=>p.filter(x=>x.id!==id));
  const upIt  = (id,f,v) => setItems(p=>p.map(x=>x.id===id?{...x,[f]:v}:x));

  const enviar = async () => {
    setSending(true); setFormErr('');
    const itens=items.map(it=>({nome:it.nome.trim(),link:it.link.trim(),valor_jpy:it.jpy,valor_brl:parseFloat((it.jpy>0?(()=>{const s=it.jpy+100,f=Math.round(s*.08),c=s+f,p=Math.round(c*.08);return(c+p)*fxRef.current;})():0).toFixed(2))}));
    let totJ=0,totB=0; itens.forEach(it=>{totJ+=it.valor_jpy;totB+=it.valor_brl;});
    let comp=null;
    if(fileComp&&!semComp){
      try{
        const ext=fileComp.name.split('.').pop()||'jpg';
        const path=`${jRef.current.cog}_${Date.now()}.${ext}`;
        const up=await fetch(`${SUPA_URL}/storage/v1/object/mercari-comprovantes/${path}`,{method:'POST',headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,'Content-Type':fileComp.type||'application/octet-stream'},body:fileComp});
        if(up.ok) comp=`${SUPA_URL}/storage/v1/object/public/mercari-comprovantes/${path}`;
      }catch{}
    }
    const j=jRef.current;
    const {error}=await supabase.from('mercari_pedidos').insert([{joiner_cog:j.cog,joiner_nome:j.nome||j.cog,itens,valor_jpy_total:Math.round(totJ),valor_brl_total:parseFloat(totB.toFixed(2)),taxa_cambio:fxRef.current,comprovante_url:comp,metodo_pagamento:'pix',id_transacao:idPix||null,status:'pendente'}]);
    if(error){setFormErr('Erro ao enviar. Tente novamente.');setSending(false);return;}
    const msg=encodeURIComponent(`Olá! Fiz meu pedido da Caixinha Mercari.\n\n${j.nome||j.cog} (@${j.cog})\n\n`+itens.map((it,i)=>`Item ${i+1}: ${it.nome||'—'}\n${it.link}\n¥${it.valor_jpy.toLocaleString('pt-BR')} → R$ ${fBRL(it.valor_brl)}`).join('\n\n')+`\n\nTotal: ¥${Math.round(totJ).toLocaleString('pt-BR')} · R$ ${fBRL(totB)}`+(comp?`\n\nComprovante: ${comp}`:'\n\nComprovante segue em anexo.'));
    setWaLink(`https://wa.me/${WA}?text=${msg}`);
    setDone(true); setSending(false);
  };

  const reset = () => {
    cntRef.current=1;
    setItems([{id:1,nome:'',link:'',jpy:0}]);
    setJoiner(null); jRef.current=null;
    setIdInp(''); idRef.current=''; setIdSt(''); setIdMsg('');
    setSemComp(false); setFileComp(null); setIdPix('');
    setChecks([false,false,false,false]);
    setFormErr(''); setDone(false); setPedidos(null);
    if(fileRef.current) fileRef.current.value='';
  };

  const RULES = [
    'Feedbacks e retornos das compras serão repassados assim que a seller responder.',
    <span key="r1">É necessário realizar o pagamento do <strong>valor integral</strong> no momento em que a GOM chamar para validação dos valores convertidos.</span>,
    <span key="r2"><strong>Não me responsabilizo</strong> por calotes de vendedores, itens falsificados ou danos no trajeto Mercari → proxy.</span>,
    'O frete internacional e a taxa da Receita Federal serão cobrados no momento do envio da caixa.',
    <span key="r3">Cancelamentos por parte do joiner e/ou repasse dos itens <strong>não serão autorizados</strong>.</span>,
    <span key="r4">Itens com bateria <strong>NÃO</strong> serão comprados.</span>,
    <span key="r5">Itens em grupo <strong>não serão permitidos</strong> — apenas uma pessoa responsável por item até o fim da CEG.</span>,
    'Não há troca, devolução ou escolha posterior.',
  ];
  const CTXT = [
    'Estou ciente que ao adicionar o link do Mercari, estou realizando meu pedido.',
    <span key="c1">Estou ciente que <strong>não posso</strong> realizar repasse de itens da caixinha em nenhuma hipótese.</span>,
    <span key="c2">Estou ciente que o prazo de pagamento é <strong>imediato</strong> e existe risco de esgotar sem aviso prévio.</span>,
    <span key="c3">Estou ciente que a GOM é responsável por <strong>intermediar</strong> o processo de compra.</span>,
  ];

  return (
    <div className="mc-wrap">
      <div className="mc-top">
        <div>
          <div className="mc-title">Caixinha <span>Mercari</span></div>
          <div className="mc-sub">por @anticegs · compras no Japão</div>
        </div>
        <div className="mc-fx-row">
          <span className="mc-fx-val">¥1 = R$ {fBRL(fxVal)}</span>
          <button className="mc-btn-fx" onClick={()=>{setFxInp('');setModal(true);}}>✎ Câmbio</button>
        </div>
      </div>

      {modal && (
        <div className="mc-modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModal(false);}}>
          <div className="mc-modal">
            <div className="mc-modal-title">Editar Câmbio</div>
            <label className="mc-modal-label">JPY / BRL</label>
            <input className="mc-modal-inp" type="number" step="0.00001" placeholder="0.03141" value={fxInp} onChange={e=>setFxInp(e.target.value)} autoFocus />
            <div className="mc-modal-btns">
              <button className="mc-btn-save" onClick={()=>{const v=parseFloat(fxInp);if(v>0){setFxVal(v);fxRef.current=v;}setModal(false);}}>Salvar</button>
              <button className="mc-btn-cancel" onClick={()=>setModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="mc-tab-bar">
        {[['pedido','◈ Fazer Pedido'],['meus','☰ Meus Pedidos'],['calc','⬡ Calculadora']].map(([k,l])=>(
          <button key={k} className={`mc-tab-btn${itab===k?' active':''}`} onClick={()=>setItab(k)}>{l}</button>
        ))}
      </div>

      <div className="mc-main">

        {itab==='calc' && (
          <div>
            <div className="mc-sec">Entrada</div>
            <div className="mc-input-group">
              <span className="mc-input-label">Valor do item — JPY ¥</span>
              <div className="mc-input-wrap">
                <input type="number" value={calcInp} min="0" step="1" onChange={e=>setCalcInp(e.target.value)} />
                <span className="mc-unit">¥</span>
              </div>
              <span className="mc-hint">¥ 1 = R$ {fxVal.toFixed(5)}</span>
            </div>
            <div className="mc-sec">Resultado</div>
            <div className="mc-result-card">
              <div className="mc-card-tag">Mercari JP</div>
              <div className="mc-detail-rows">
                <div className="mc-detail-row"><span className="mc-dl">valor do item (¥)</span><span className="mc-dv">{fJPY(calcR.n)}</span></div>
                <div className="mc-detail-row"><span className="mc-dl">taxa por link (¥)</span><span className="mc-dv">¥ 100</span></div>
                <div className="mc-detail-row"><span className="mc-dl">taxa de serviço 8% (¥)</span><span className="mc-dv">{fJPY(calcR.f)}</span></div>
                <div className="mc-detail-row"><span className="mc-dl">total em iene</span><span className="mc-dv">{fJPY(calcR.t)}</span></div>
                <div className="mc-detail-row"><span className="mc-dl">câmbio aplicado</span><span className="mc-dv">R$ {fxVal.toFixed(5)}</span></div>
              </div>
              <div className="mc-sell-block">
                <div className="mc-sell-label">Preço ao joiner</div>
                <div className="mc-sell-price"><span className="mc-cur">R$</span><span className="mc-amt">{fBRL(calcR.b)}</span></div>
              </div>
            </div>
            <p className="mc-disclaimer">A calculadora é uma projeção e pode não refletir no valor final.</p>
          </div>
        )}

        {itab==='meus' && (
          <div>
            {!joiner && (
              <div className="mc-pedidos-login">
                <p>Identifique-se na aba <strong>Fazer Pedido</strong> para ver seus pedidos.</p>
                <button className="mc-btn-sec" style={{maxWidth:260,margin:'0 auto',display:'block'}} onClick={()=>setItab('pedido')}>← Ir para Fazer Pedido</button>
              </div>
            )}
            {joiner && pedLoad && <div className="mc-pedidos-loading">Carregando pedidos...</div>}
            {joiner && !pedLoad && pedidos!==null && (
              pedidos.length===0
                ? <div className="mc-pedidos-empty">Nenhum pedido encontrado.</div>
                : pedidos.map(p=>{
                    const si=STEP_IDX[p.status]??0, rec=p.status==='recusado';
                    return (
                      <div key={p.id} className="mc-pedido-card">
                        <div className="mc-pedido-header">
                          <span className={`mc-status-badge mc-s-${p.status}`}>{p.status}</span>
                          <span className="mc-pedido-date">{new Date(p.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        <div className="mc-pedido-steps">
                          {STEPS.map((s,i)=>(
                            <div key={s.key} style={{display:'contents'}}>
                              <div className="mc-step">
                                <div className={`mc-step-dot${!rec&&si>i?' done':!rec&&si===i?' active':rec&&i===0?' fail':''}`}/>
                                <span className={`mc-step-label${(!rec&&(si>i||si===i))?' lit':''}`}>{s.label}</span>
                              </div>
                              {i<STEPS.length-1&&<div className={`mc-step-line${!rec&&si>i?' done':''}`}/>}
                            </div>
                          ))}
                        </div>
                        <div className="mc-pedido-itens">
                          {(p.itens||[]).map((it,i)=>(
                            <div key={i} className="mc-pedido-item">
                              <div>
                                {it.nome&&<div className="mc-pi-nome">{it.nome}</div>}
                                {it.link&&<a className="mc-pi-link" href={it.link} target="_blank" rel="noopener noreferrer">{it.link}</a>}
                              </div>
                              {it.valor_jpy>0&&<div className="mc-pi-val">¥{Number(it.valor_jpy).toLocaleString('pt-BR')} → R$ {fBRL(it.valor_brl||0)}</div>}
                            </div>
                          ))}
                        </div>
                        {(p.valor_jpy_total||p.valor_brl_total)&&(
                          <div className="mc-pedido-total">
                            {p.valor_jpy_total&&<span className="mc-pt-jpy">¥{Number(p.valor_jpy_total).toLocaleString('pt-BR')}</span>}
                            {p.valor_brl_total&&<span className="mc-pt-brl">R$ {fBRL(p.valor_brl_total)}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })
            )}
          </div>
        )}

        {itab==='pedido' && !done && (
          <div>
            <div className="mc-rules-box">
              <div className="mc-rules-title">⋆.˚✮ CAIXINHA MERCARI ⋆.˚✮</div>
              {RULES.map((r,i)=><div key={i} className="mc-rule-item">{r}</div>)}
            </div>

            <div className="mc-sec">Identificação</div>
            <div className="mc-id-field">
              <input
                className={`mc-id-input${idSt==='found'?' found':idSt==='notfound'?' notfound':''}`}
                type="text" placeholder="@ da rede social ou e-mail"
                value={idInp} onChange={e=>onId(e.target.value)}
                onBlur={buscar} onKeyDown={e=>e.key==='Enter'&&buscar()}
              />
              <span className="mc-id-status">{idSt==='loading'?'⏳':idSt==='found'?'✓':''}</span>
            </div>
            <div className={`mc-id-info${idSt==='notfound'?' err':''}`}>{idMsg}</div>

            <div style={{height:22}}/>

            <div className="mc-sec">Itens do pedido</div>
            <div className="mc-items-list">
              {items.map((it,idx)=>(
                <div key={it.id} className="mc-item-card">
                  <div className="mc-item-num">
                    <span>Item {idx+1}</span>
                    <button className="mc-btn-rm" onClick={()=>rmIt(it.id)}>×</button>
                  </div>
                  <div className="mc-item-row2">
                    <div className="mc-field">
                      <label>Nome do item</label>
                      <input type="text" placeholder="ex: Photocard Felix" value={it.nome} onChange={e=>upIt(it.id,'nome',e.target.value)}/>
                    </div>
                    <div className="mc-field">
                      <label>Link do Mercari *</label>
                      <input type="url" placeholder="https://jp.mercari.com/item/..." value={it.link} onChange={e=>upIt(it.id,'link',e.target.value)}/>
                    </div>
                  </div>
                  <div className="mc-price-row">
                    <div className="mc-field">
                      <label>Preço Mercari (¥) *</label>
                      <input type="number" placeholder="ex: 3500" min="1" step="1" value={it.jpy||''} onChange={e=>upIt(it.id,'jpy',parseFloat(e.target.value)||0)}/>
                    </div>
                    <div className="mc-field">
                      <label>Calculadora (R$) <span style={{fontWeight:400,opacity:.5}}>incl. ¥100/link</span></label>
                      <input type="text" readOnly value={it.jpy>0?'R$ '+fBRL(calcBRL(it.jpy)):''} tabIndex={-1}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {items.length>1&&tots.j>0&&(
              <div className="mc-total-bar">
                <span className="mc-total-label">Total do pedido</span>
                <span className="mc-total-jpy">{fJPY(tots.j)}</span>
                <span className="mc-total-sep">·</span>
                <span className="mc-total-brl">R$ {fBRL(tots.b)}</span>
              </div>
            )}

            <button className="mc-btn-add" onClick={addIt}>＋ Adicionar outro item</button>

            <div className="mc-sec">Confirmações</div>
            {CTXT.map((txt,i)=>(
              <div key={i} className={`mc-check-item${checks[i]?' on':''}`} onClick={()=>setChecks(p=>p.map((c,j)=>j===i?!c:c))}>
                <div className="mc-cb-box"/>
                <span className="mc-cb-text">{txt}</span>
              </div>
            ))}

            <div className="mc-divider"/>
            <div className="mc-sec">Pagamento</div>

            <div className="mc-pix-card">
              <div className="mc-pix-title">✦ Chave PIX — Mercado Pago</div>
              <div className="mc-pix-name">Fernanda Gomes Medeiros</div>
              <div className="mc-pix-key-row">
                <div className="mc-pix-key">{PIX}</div>
                <button className="mc-btn-copy" onClick={()=>{navigator.clipboard.writeText(PIX);setPixCopied(true);setTimeout(()=>setPixCopied(false),2000);}}>
                  {pixCopied?'Copiado ✓':'Copiar'}
                </button>
              </div>
            </div>

            <div className="mc-field" style={{marginBottom:6}}>
              <label>Comprovante de pagamento *</label>
              <label className={`mc-file-label${semComp?' disabled':''}`} htmlFor="mc-f-comp">
                <span className="mc-file-icon">📎</span>
                <div>
                  <div className="mc-file-text">Clique para adicionar o arquivo</div>
                  {fileComp&&<div className="mc-file-name">{fileComp.name}</div>}
                </div>
              </label>
              <input ref={fileRef} type="file" id="mc-f-comp" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>{setFileComp(e.target.files[0]||null);}}/>
            </div>

            <button className="mc-btn-sem-comp" onClick={()=>{const ns=!semComp;setSemComp(ns);if(ns){setFileComp(null);if(fileRef.current)fileRef.current.value='';}}}>
              {semComp?'← Voltar a anexar arquivo':'Não consigo anexar o comprovante →'}
            </button>

            {semComp&&(
              <div className="mc-field" style={{marginBottom:18}}>
                <label>ID da transação PIX *</label>
                <input type="text" value={idPix} placeholder="ex: E00000000202407..." onChange={e=>setIdPix(e.target.value)}/>
                <span style={{fontSize:11,color:'#9a9888',marginTop:3,display:'block'}}>Disponível no comprovante do app do banco, em "Detalhes da transação".</span>
              </div>
            )}

            <a href={waHref} target="_blank" rel="noopener noreferrer" className="mc-btn-cartao-wa">
              💳 Prefiro pagar no cartão de crédito →
            </a>

            {formErr&&<div className="mc-err">{formErr}</div>}
            <button className="mc-btn-primary" onClick={enviar} disabled={!formOk||sending}>
              {sending?'Enviando...':'Enviar pedido →'}
            </button>
          </div>
        )}

        {itab==='pedido' && done && (
          <div className="mc-success-card">
            <div className="mc-success-icon">🎌</div>
            <div className="mc-success-title">Pedido enviado!</div>
            <div className="mc-success-sub">Sua solicitação foi recebida.<br/>A GOM vai verificar e entrar em contato para confirmar os valores.</div>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="mc-btn-wa">📲 Enviar comprovante pelo WhatsApp →</a>
            <button className="mc-btn-sec" style={{marginTop:10}} onClick={reset}>+ Fazer outro pedido</button>
          </div>
        )}

      </div>
    </div>
  );
}

function AdminMercari({ pedidos = [], onUpdate }) {
  const STATUS_COLOR = { pendente:"#BAFF39", aguardando_link:"#f0c040", aprovado:"#64B5F6", recusado:"#ff6b6b", pago:"#C9A8F0", finalizado:"#4ecb71" };
  const STATUS_BG    = { pendente:"rgba(186,255,57,.08)", aguardando_link:"rgba(240,192,64,.08)", aprovado:"rgba(100,181,246,.08)", recusado:"rgba(255,107,107,.06)", pago:"rgba(201,168,240,.08)", finalizado:"rgba(78,203,113,.08)" };
  const STATUS_BORDER= { pendente:"rgba(186,255,57,.2)", aguardando_link:"rgba(240,192,64,.2)", aprovado:"rgba(100,181,246,.2)", recusado:"rgba(255,107,107,.15)", pago:"rgba(201,168,240,.2)", finalizado:"rgba(78,203,113,.2)" };
  const [filtro, setFiltro] = useState("pendente");
  const STATUS_LABEL = { pendente:"pendente", aguardando_link:"aguard. link", aprovado:"aprovado", recusado:"recusado", pago:"pago", finalizado:"finalizado", todos:"todos" };
  const [carregando, setCarregando] = useState(null);

  const lista = filtro === "todos" ? pedidos : pedidos.filter(p => p.status === filtro);

  async function mudarStatus(p, novoStatus) {
    setCarregando(p.id);
    await supabase.from("mercari_pedidos").update({ status: novoStatus }).eq("id", p.id);
    const msgs = {
      aprovado: `🎌 Seu pedido Mercari foi aprovado! Seu item estará finalizado assim que a proxy realizar a compra no Mercari.`,
      recusado: `🎌 Seu pedido Mercari não pôde ser realizado. Entre em contato com a admin para mais informações.`,
      pago:       `🎌 Pagamento do seu pedido Mercari confirmado! Acompanhe o status por aqui.`,
      finalizado: `🎌 Seu pedido Mercari foi finalizado! A compra no Mercari foi realizada. Em breve você receberá mais informações sobre o envio.`,
    };
    if (msgs[novoStatus]) {
      await supabase.from("pushes").insert([{ message: msgs[novoStatus], active: true, joiner_cog: p.joiner_cog }]);
    }
    onUpdate(prev => prev.map(x => x.id === p.id ? { ...x, status: novoStatus } : x));
    setCarregando(null);
  }

  const pf = v => parseFloat(String(v ?? 0).replace(",", ".")) || 0;

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {["pendente","aguardando_link","aprovado","pago","finalizado","recusado","todos"].map(s => (
          <button key={s} onClick={() => setFiltro(s)}
            style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${filtro===s ? STATUS_COLOR[s]||"rgba(245,240,232,.4)" : "rgba(245,240,232,.12)"}`, background: filtro===s ? (STATUS_BG[s]||"rgba(245,240,232,.06)") : "transparent", color: filtro===s ? (STATUS_COLOR[s]||"var(--offwhite)") : "rgba(245,240,232,.45)", fontFamily:"'DM Mono',monospace", fontSize:10, fontWeight:700, cursor:"pointer", textTransform:"uppercase", letterSpacing:".08em" }}>
            {STATUS_LABEL[s]||s} {s !== "todos" && <span>({pedidos.filter(p => p.status === s).length})</span>}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div style={{ fontSize:12, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", padding:"20px 0" }}>
          Nenhum pedido {filtro !== "todos" ? filtro : ""}.
        </div>
      ) : lista.map(p => (
        <div key={p.id} style={{ background:"var(--card-bg)", border:`1px solid ${STATUS_BORDER[p.status]||"rgba(245,240,232,.08)"}`, borderRadius:10, padding:"14px 16px", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                <span style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)" }}>{p.joiner_nome}</span>
                <span style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace" }}>@{p.joiner_cog}</span>
                <span style={{ fontSize:9, color: STATUS_COLOR[p.status]||"rgba(245,240,232,.4)", background: STATUS_BG[p.status]||"rgba(245,240,232,.06)", border:`1px solid ${STATUS_BORDER[p.status]||"rgba(245,240,232,.1)"}`, borderRadius:4, padding:"1px 8px", fontFamily:"'DM Mono',monospace", fontWeight:700, textTransform:"uppercase" }}>
                  {p.status}
                </span>
              </div>
              {Array.isArray(p.itens) && p.itens.map((it, i) => (
                <div key={i} style={{ background:"rgba(0,0,0,.2)", border:"1px solid rgba(245,240,232,.06)", borderRadius:7, padding:"8px 12px", marginTop:i===0?6:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>item {i+1}</span>
                    {it.nome && <span style={{ fontSize:12, color:"var(--offwhite)", fontWeight:600 }}>{it.nome}</span>}
                    <span style={{ fontSize:11, color:"var(--laranja)", fontFamily:"'DM Mono',monospace", fontWeight:700, marginLeft:"auto" }}>
                      ¥{(it.valor_jpy||0).toLocaleString("pt-BR")} → R$ {pf(it.valor_brl).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                    </span>
                  </div>
                  {it.link && (
                    <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:"rgba(100,181,246,.7)", fontFamily:"'DM Mono',monospace", wordBreak:"break-all", display:"block", marginTop:3 }}>
                      {it.link}
                    </a>
                  )}
                </div>
              ))}
              <div style={{ display:"flex", gap:14, marginTop:8, flexWrap:"wrap", alignItems:"center" }}>
                {p.valor_jpy_total > 0 && (
                  <span style={{ fontSize:11, color:"rgba(245,240,232,.55)", fontFamily:"'DM Mono',monospace" }}>
                    Total ¥{(p.valor_jpy_total||0).toLocaleString("pt-BR")}
                  </span>
                )}
                {p.valor_brl_total > 0 && (
                  <span style={{ fontSize:11, color:"var(--laranja)", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
                    R$ {pf(p.valor_brl_total).toLocaleString("pt-BR", { minimumFractionDigits:2 })}
                  </span>
                )}
                {p.metodo_pagamento === "cartao" && (
                  <span style={{ fontSize:10, color:"#f0c040", fontFamily:"'DM Mono',monospace", fontWeight:700, background:"rgba(240,192,64,.1)", border:"1px solid rgba(240,192,64,.25)", borderRadius:4, padding:"2px 8px" }}>
                    💳 cartão
                  </span>
                )}
                {p.id_transacao && (
                  <span style={{ fontSize:10, color:"rgba(245,240,232,.55)", fontFamily:"'DM Mono',monospace" }}>
                    ID: {p.id_transacao}
                  </span>
                )}
                {p.comprovante_url && (
                  <a href={p.comprovante_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:10, color:"#4ecb71", fontFamily:"'DM Mono',monospace", fontWeight:700, textDecoration:"none", background:"rgba(78,203,113,.1)", border:"1px solid rgba(78,203,113,.25)", borderRadius:4, padding:"2px 8px" }}>
                    📎 comprovante
                  </a>
                )}
                <span style={{ fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", marginLeft:"auto" }}>
                  {new Date(p.created_at).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                </span>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5, flexShrink:0 }}>
              {(p.status === "pendente" || p.status === "aguardando_link") && (
                <>
                  {p.status === "aguardando_link" && (
                    <a href={`https://wa.me/55${(p.joiner_whatsapp||"").replace(/\D/g,"")}?text=${encodeURIComponent("Olá "+p.joiner_nome+"! Aqui está o link para pagamento por cartão do seu pedido Mercari: ")}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display:"block", textAlign:"center", background:"rgba(240,192,64,.1)", border:"1px solid rgba(240,192,64,.3)", color:"#f0c040", borderRadius:6, padding:"6px 14px", fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:700, textDecoration:"none", marginBottom:4 }}>
                      💬 Enviar link
                    </a>
                  )}
                  <button onClick={() => mudarStatus(p, "aprovado")} disabled={carregando === p.id}
                    style={{ background:"rgba(100,181,246,.1)", border:"1px solid rgba(100,181,246,.3)", color:"#64B5F6", borderRadius:6, padding:"6px 14px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer", fontWeight:700 }}>
                    {carregando === p.id ? "..." : "✓ Aprovar"}
                  </button>
                  <button onClick={() => mudarStatus(p, "recusado")} disabled={carregando === p.id}
                    style={{ background:"rgba(255,107,107,.08)", border:"1px solid rgba(255,107,107,.2)", color:"#ff6b6b", borderRadius:6, padding:"6px 14px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
                    ✗ Recusar
                  </button>
                </>
              )}
              {p.status === "aprovado" && (
                <button onClick={() => mudarStatus(p, "pago")} disabled={carregando === p.id}
                  style={{ background:"rgba(201,168,240,.1)", border:"1px solid rgba(201,168,240,.3)", color:"#C9A8F0", borderRadius:6, padding:"6px 14px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer", fontWeight:700 }}>
                  {carregando === p.id ? "..." : "✓ Marcar pago"}
                </button>
              )}
              {p.status === "pago" && (
                <button onClick={() => mudarStatus(p, "finalizado")} disabled={carregando === p.id}
                  style={{ background:"rgba(78,203,113,.1)", border:"1px solid rgba(78,203,113,.3)", color:"#4ecb71", borderRadius:6, padding:"6px 14px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer", fontWeight:700 }}>
                  {carregando === p.id ? "..." : "✓ Finalizar"}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminCadastros({ confirmacoes, onUpdate, preCadastros = [], onUpdatePre }) {
  const [aprovando, setAprovando] = useState(null);

  async function aprovarCadastro(p) {
    setAprovando(p.id);
    const { error } = await supabase.from("joiners").insert([{
      cog: p.cog, nome: p.nome, email: p.email,
      twitter: "@" + p.cog, whatsapp: p.whatsapp || null, confirmado: false,
    }]);
    if (error) { alert("Erro ao criar conta: " + error.message); setAprovando(null); return; }
    await supabase.from("pre_cadastros").update({ status: "aprovado" }).eq("id", p.id);
    onUpdatePre(prev => prev.filter(x => x.id !== p.id));
    setAprovando(null);
  }

  async function recusarCadastro(p) {
    await supabase.from("pre_cadastros").update({ status: "recusado" }).eq("id", p.id);
    onUpdatePre(prev => prev.filter(x => x.id !== p.id));
  }

  if (preCadastros.length === 0 && confirmacoes.length === 0) return (
    <div style={{ fontSize:12, color:"rgba(245,240,232,.52)", padding:"20px 0" }}>Nenhuma pendência de cadastro.</div>
  );

  return (
    <div>
      {preCadastros.length > 0 && (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", fontWeight:700, color:"#BAFF39", letterSpacing:"1.5px", textTransform:"uppercase" }}>Novos Joiners</span>
            <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"rgba(186,255,57,.4)", background:"rgba(186,255,57,.08)", borderRadius:10, padding:"1px 8px" }}>{preCadastros.length}</span>
            <div style={{ flex:1, height:"1px", background:"rgba(186,255,57,.12)" }} />
          </div>
          {preCadastros.map(p => (
            <div key={p.id} style={{ padding:"14px 16px", background:"var(--card-bg)", border:"1px solid rgba(186,255,57,.2)", borderRadius:10, marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:10, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--offwhite)", marginBottom:4 }}>
                    {p.nome} <span style={{ fontSize:10, color:"rgba(245,240,232,.4)", fontWeight:400 }}>@{p.cog}</span>
                  </div>
                  <div style={{ fontSize:11, color:"rgba(245,240,232,.55)", fontFamily:"'DM Mono',monospace" }}>{p.email}</div>
                  {p.whatsapp && <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{p.whatsapp}</div>}
                  <div style={{ fontSize:10, color:"rgba(245,240,232,.28)", marginTop:6 }}>{new Date(p.created_at).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}</div>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={() => aprovarCadastro(p)} disabled={aprovando === p.id}
                    style={{ background:"rgba(186,255,57,.1)", border:"1px solid rgba(186,255,57,.3)", color:"#BAFF39", borderRadius:6, padding:"6px 14px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer", fontWeight:700 }}>
                    {aprovando === p.id ? "..." : "✓ Aprovar"}
                  </button>
                  <button onClick={() => recusarCadastro(p)}
                    style={{ background:"rgba(255,107,107,.08)", border:"1px solid rgba(255,107,107,.2)", color:"#ff6b6b", borderRadius:6, padding:"6px 14px", fontSize:10, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
                    ✗ Recusar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {confirmacoes.length > 0 && <div style={{ height:1, background:"rgba(245,240,232,.06)", margin:"16px 0" }} />}
        </>
      )}

      {confirmacoes.length > 0 && (
        <>
          <div style={{ fontSize:11, color:"rgba(245,240,232,.52)", marginBottom:12, lineHeight:1.6 }}>
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
        </>
      )}
    </div>
  );
}

function AdminPagamentos({ data, joiners, subtab }) {
  const [open, setOpen] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");

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

  const atrasados = todos.filter(j => j.itens.some(i => i.multa > 0));
  const emAberto  = todos.filter(j => j.itens.every(i => i.multa === 0));
  const baseList  = subtab === "atrasados" ? atrasados : emAberto;

  // helpers de atraso por tipo
  const temItemAtr  = j => j.itens.some(i => isPendente(i.pago_item)  && diasAtraso(i.venc_item)  > 0);
  const temFreteAtr = j => j.itens.some(i => isPendente(i.pago_frete) && diasAtraso(i.venc_frete) > 0);
  const temRfAtr    = j => j.itens.some(i => isPendente(i.pago_rf)    && diasAtraso(i.venc_rf)    > 0);
  const temMultaAtr = j => j.itens.some(i => i.multa > 0);

  const lista = subtab !== "atrasados" ? baseList : (() => {
    if (filtroTipo === "item")  return baseList.filter(temItemAtr);
    if (filtroTipo === "frete") return baseList.filter(temFreteAtr);
    if (filtroTipo === "rf")    return baseList.filter(temRfAtr);
    if (filtroTipo === "multa") return baseList.filter(temMultaAtr);
    return baseList;
  })();

  // totais por tipo para os pills
  const totItem  = atrasados.filter(temItemAtr) .reduce((s,j) => s + j.itens.reduce((a,i) => a + (isPendente(i.pago_item)  ? Number(i.valor_item||0)  : 0), 0), 0);
  const totFrete = atrasados.filter(temFreteAtr).reduce((s,j) => s + j.itens.reduce((a,i) => a + (isPendente(i.pago_frete) ? Number(i.frete_inter||0) : 0), 0), 0);
  const totRf    = atrasados.filter(temRfAtr)   .reduce((s,j) => s + j.itens.reduce((a,i) => a + (isPendente(i.pago_rf)    ? Number(i.taxa_rf||0)     : 0), 0), 0);
  const totMulta = atrasados.filter(temMultaAtr).reduce((s,j) => s + j.itens.reduce((a,i) => a + (i.multa || 0), 0), 0);

  return (
    <div>
      {subtab === "atrasados" && atrasados.length > 0 && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {[
            { id:"todos",  label:"Todos",  valor: null,     count: atrasados.length },
            { id:"item",   label:"Item",   valor: totItem,  count: atrasados.filter(temItemAtr).length  },
            { id:"frete",  label:"Frete",  valor: totFrete, count: atrasados.filter(temFreteAtr).length },
            { id:"rf",     label:"RF",     valor: totRf,    count: atrasados.filter(temRfAtr).length    },
            { id:"multa",  label:"Multa",  valor: totMulta, count: atrasados.filter(temMultaAtr).length },
          ].map(({ id, label, valor, count }) => {
            const ativo = filtroTipo === id;
            return (
              <button key={id} onClick={() => setFiltroTipo(id)} style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:1, padding:"7px 12px", borderRadius:7, border:`1px solid ${ativo ? "rgba(255,92,26,.5)" : "rgba(245,240,232,.1)"}`, background: ativo ? "rgba(255,92,26,.1)" : "rgba(245,240,232,.03)", cursor:"pointer", minWidth:64, transition:"all .15s" }}>
                <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase", color: ativo ? "var(--laranja)" : "rgba(245,240,232,.35)", fontWeight: ativo ? 700 : 400 }}>{label}</span>
                {valor !== null && <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:700, color: ativo ? "var(--laranja)" : "rgba(245,240,232,.6)" }}>R${fmtBRL(valor)}</span>}
                <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.28)" }}>{count} joiner{count !== 1 ? "s" : ""}</span>
              </button>
            );
          })}
        </div>
      )}
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
                {(() => {
                  const thS = { fontSize:8, letterSpacing:"1.2px", color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", textAlign:"right", padding:"6px 0 6px", fontWeight:400 };
                  const tdS = { fontSize:11, fontFamily:"'DM Mono',monospace", textAlign:"right", color:"rgba(245,240,232,.55)", padding:"7px 0", verticalAlign:"middle" };
                  const dash = <span style={{ color:"rgba(245,240,232,.18)" }}>—</span>;
                  const fmt = v => `R$${fmtBRL(v)}`;

                  // filtra linhas e colunas conforme filtroTipo ativo
                  const mostraItem  = filtroTipo === "todos" || filtroTipo === "item"  || filtroTipo === "multa";
                  const mostraFrete = filtroTipo === "todos" || filtroTipo === "frete" || filtroTipo === "multa";
                  const mostraRf    = filtroTipo === "todos" || filtroTipo === "rf"    || filtroTipo === "multa";

                  const itensFiltrados = filtroTipo === "item"  ? j.itens.filter(i => isPendente(i.pago_item)  && Number(i.valor_item  ||0) > 0)
                                       : filtroTipo === "frete" ? j.itens.filter(i => isPendente(i.pago_frete) && Number(i.frete_inter||0) > 0)
                                       : filtroTipo === "rf"    ? j.itens.filter(i => isPendente(i.pago_rf)    && Number(i.taxa_rf    ||0) > 0)
                                       : j.itens;

                  const temMulta = itensFiltrados.some(i => i.multa > 0);

                  return (
                    <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed" }}>
                      <colgroup>
                        <col />
                        {mostraItem  && <col style={{ width:66 }} />}
                        {mostraFrete && <col style={{ width:66 }} />}
                        {mostraRf    && <col style={{ width:46 }} />}
                        {temMulta    && <col style={{ width:62 }} />}
                        <col style={{ width:72 }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={{ ...thS, textAlign:"left" }}>Item</th>
                          {mostraItem  && <th style={thS}>Item R$</th>}
                          {mostraFrete && <th style={thS}>Frete</th>}
                          {mostraRf    && <th style={thS}>RF</th>}
                          {temMulta    && <th style={{ ...thS, color:"rgba(255,107,107,.45)" }}>Multa</th>}
                          <th style={thS}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensFiltrados.map((item, idx) => {
                          const vItem  = isPendente(item.pago_item)  ? Number(item.valor_item  || 0) : 0;
                          const vFrete = isPendente(item.pago_frete) ? Number(item.frete_inter || 0) : 0;
                          const vRf    = isPendente(item.pago_rf)    ? Number(item.taxa_rf     || 0) : 0;
                          const vMulta = item.multa || 0;
                          const vFiltItem  = mostraItem  ? vItem  : 0;
                          const vFiltFrete = mostraFrete ? vFrete : 0;
                          const vFiltRf    = mostraRf    ? vRf    : 0;
                          const total = vFiltItem + vFiltFrete + vFiltRf + vMulta;
                          return (
                            <tr key={idx} style={{ borderTop:"1px solid rgba(245,240,232,.05)" }}>
                              <td style={{ padding:"7px 8px 7px 0", verticalAlign:"middle" }}>
                                <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.8)", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}><InfoContent info={item.nome_do_item} /></div>
                                <div style={{ fontSize:9, color:"rgba(245,240,232,.28)", fontFamily:"'DM Mono',monospace", marginTop:1 }}>{item.ceg}</div>
                              </td>
                              {mostraItem  && <td style={tdS}>{vItem  > 0 ? fmt(vItem)  : dash}</td>}
                              {mostraFrete && <td style={tdS}>{vFrete > 0 ? fmt(vFrete) : dash}</td>}
                              {mostraRf    && <td style={tdS}>{vRf    > 0 ? fmt(vRf)    : dash}</td>}
                              {temMulta    && <td style={{ ...tdS, color: vMulta > 0 ? "rgba(255,107,107,.8)" : undefined }}>{vMulta > 0 ? fmt(vMulta) : dash}</td>}
                              <td style={{ ...tdS, color: vMulta > 0 ? "#ff6b6b" : "#BAFF39", fontWeight:700 }}>{fmt(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {itensFiltrados.length > 1 && (() => {
                        const sItem  = itensFiltrados.reduce((s,i) => s + (mostraItem  && isPendente(i.pago_item)  ? Number(i.valor_item  ||0) : 0), 0);
                        const sFrete = itensFiltrados.reduce((s,i) => s + (mostraFrete && isPendente(i.pago_frete) ? Number(i.frete_inter ||0) : 0), 0);
                        const sRf    = itensFiltrados.reduce((s,i) => s + (mostraRf    && isPendente(i.pago_rf)    ? Number(i.taxa_rf     ||0) : 0), 0);
                        const sMulta = itensFiltrados.reduce((s,i) => s + (i.multa || 0), 0);
                        const sTotal = sItem + sFrete + sRf + sMulta;
                        const ftS = { fontSize:11, fontFamily:"'DM Mono',monospace", textAlign:"right", fontWeight:700, padding:"8px 0 4px", color:"rgba(245,240,232,.9)" };
                        return (
                          <tfoot>
                            <tr style={{ borderTop:"1px solid rgba(245,240,232,.15)" }}>
                              <td style={{ ...ftS, textAlign:"left", fontSize:9, letterSpacing:"1px", textTransform:"uppercase", color:"rgba(245,240,232,.3)", fontWeight:400 }}>Total</td>
                              {mostraItem  && <td style={ftS}>{sItem  > 0 ? fmt(sItem)  : dash}</td>}
                              {mostraFrete && <td style={ftS}>{sFrete > 0 ? fmt(sFrete) : dash}</td>}
                              {mostraRf    && <td style={ftS}>{sRf    > 0 ? fmt(sRf)    : dash}</td>}
                              {temMulta    && <td style={{ ...ftS, color:"rgba(255,107,107,.9)" }}>{sMulta > 0 ? fmt(sMulta) : dash}</td>}
                              <td style={{ ...ftS, color: sMulta > 0 ? "#ff6b6b" : "#BAFF39", fontSize:12 }}>{fmt(sTotal)}</td>
                            </tr>
                          </tfoot>
                        );
                      })()}
                    </table>
                  );
                })()}
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
      <div style={{ background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.1)", borderRadius:14, width:"100%", maxWidth:440, padding:30, display:"flex", flexDirection:"column", gap:14 }}>
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

// ── Página genérica /ceg/:nome ────────────────────────────────────────────────
function CegPage({ ceg, isOwner = false, logoUrl = null }) {
  const [itens,      setItens]      = useState(null);
  const [categorias, setCategorias] = useState(null);
  const [uploading,  setUploading]  = useState(null);
  const [ampliada,   setAmpliada]   = useState(null);
  const [msg,        setMsg]        = useState("");
  const [viewMode,   setViewMode]   = useState("tabela");

  useEffect(() => {
    supabase.from("masterlist").select("*").eq("ceg", ceg).neq("nome", "Disponivel")
      .then(({ data }) => setItens(data || []));
    supabase.from("item_fotos").select("*").eq("ceg", ceg).order("ordem").order("id")
      .then(({ data }) => setCategorias(data || []));
  }, [ceg]);

  function categoriaDoItem(nomeItem) {
    if (!categorias) return null;
    return categorias.find(c => nomeItem.toLowerCase().includes(c.nome_do_item.toLowerCase())) || null;
  }

  const uploadSlug = ceg.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().slice(0, 30);

  async function uploadCategoria(catNome, file) {
    setUploading(catNome);
    const ext  = file.name.split(".").pop().toLowerCase();
    const path = `${uploadSlug}/${Date.now()}_${catNome.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("fotos-itens").upload(path, file, { upsert: true });
    if (upErr) { alert("Erro upload: " + upErr.message); setUploading(null); return; }
    const { data: { publicUrl } } = supabase.storage.from("fotos-itens").getPublicUrl(path);
    const existente = (categorias || []).find(c => c.nome_do_item === catNome);
    if (existente) {
      await supabase.from("item_fotos").update({ foto_url: publicUrl }).eq("id", existente.id);
      setCategorias(prev => prev.map(c => c.id === existente.id ? { ...c, foto_url: publicUrl } : c));
    } else {
      const { data: nova, error: insErr } = await supabase.from("item_fotos")
        .insert([{ ceg, nome_do_item: catNome, foto_url: publicUrl, ordem: (categorias || []).length }])
        .select().single();
      if (insErr) { alert("Erro: " + insErr.message); setUploading(null); return; }
      if (nova) setCategorias(prev => [...(prev || []), nova]);
    }
    setMsg(catNome + " ✓"); setTimeout(() => setMsg(""), 2500);
    setUploading(null);
  }

  async function removerCategoria(id) {
    if (!window.confirm("Remover categoria?")) return;
    await supabase.from("item_fotos").delete().eq("id", id);
    setCategorias(prev => prev.filter(c => c.id !== id));
  }

  const loading = itens === null || categorias === null;
  const joiners = itens ? new Set(itens.map(i => i.cog)).size : 0;

  // Agrupa itens por categoria (ou "Sem categoria")
  const grupos = (() => {
    if (!itens || !categorias) return [];
    const mapa = {};
    for (const item of itens) {
      const cat = categoriaDoItem(item.nome_do_item);
      const key = cat ? cat.nome_do_item : "__sem__";
      if (!mapa[key]) mapa[key] = { cat, itens: [] };
      mapa[key].itens.push(item);
    }
    // ordenar: categorias com foto primeiro (na ordem do array categorias), depois sem categoria
    const result = [];
    for (const cat of (categorias || [])) {
      if (mapa[cat.nome_do_item]) result.push(mapa[cat.nome_do_item]);
    }
    if (mapa["__sem__"]) result.push(mapa["__sem__"]);
    return result;
  })();

  return (
    <div style={{ minHeight: "100vh", background: "#0D0C0B", color: "#F5F0E8", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="main">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">
              <a href="/" style={{ background: "none", border: "none", color: "rgba(245,240,232,.62)", fontFamily: "'DM Mono',monospace", fontSize: "var(--fs-xs)", cursor: "pointer", padding: 0, letterSpacing: 1, textDecoration: "none" }}>← voltar</a>
            </div>
            {logoUrl
              ? <img src={logoUrl} alt={ceg} style={{ height: 64, maxWidth: 320, objectFit: "contain", objectPosition: "left", marginTop: 8, filter: "invert(1)" }} />
              : <h1 style={{ fontSize: "clamp(22px,4vw,38px)", fontWeight: 900, margin: "8px 0 0", letterSpacing: "-0.5px" }}>{ceg}</h1>
            }
          </div>
          {itens && (
            <div style={{ textAlign: "right" }}>
              <div className="greeting-sub" style={{ marginTop: 8 }}>{itens.length} itens · {joiners} joiners</div>
              {msg && <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#BAFF39", marginTop: 6 }}>{msg}</div>}
              <div style={{ display: "flex", gap: 4, marginTop: 10, justifyContent: "flex-end" }}>
                {[["tabela", "⊞"], ["galeria", "⊟"]].map(([mode, icon]) => (
                  <button key={mode} onClick={() => setViewMode(mode)} style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", padding: "4px 10px", borderRadius: 5, cursor: "pointer", border: `1px solid ${viewMode === mode ? "rgba(201,168,240,.4)" : "rgba(245,240,232,.1)"}`, background: viewMode === mode ? "rgba(201,168,240,.12)" : "transparent", color: viewMode === mode ? "#C9A8F0" : "rgba(245,240,232,.3)" }}>
                    {icon} {mode}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Painel de categorias (owner only) */}
        {isOwner && !loading && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "rgba(201,168,240,.05)", border: "1px solid rgba(201,168,240,.15)", borderRadius: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "#C9A8F0", fontFamily: "'DM Mono',monospace", marginBottom: 12 }}>Categorias · fotos</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              {(categorias || []).map(cat => (
                <div key={cat.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 56, height: 72, borderRadius: 8, overflow: "hidden", position: "relative", cursor: "pointer" }}>
                    <img src={cat.foto_url} alt={cat.nome_do_item} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <label style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity .15s", cursor: "pointer", fontSize: 14 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                      ✎
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files[0] && uploadCategoria(cat.nome_do_item, e.target.files[0])} />
                    </label>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: "rgba(245,240,232,.6)", maxWidth: 60, textAlign: "center", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.nome_do_item}</span>
                  <button onClick={() => removerCategoria(cat.id)} style={{ fontSize: 8, fontFamily: "'DM Mono',monospace", background: "transparent", color: "rgba(255,107,107,.5)", border: "none", cursor: "pointer", padding: 0 }}>✕</button>
                </div>
              ))}
              {/* Adicionar nova categoria */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <label style={{ display: "flex", width: 56, height: 72, borderRadius: 8, border: "2px dashed rgba(201,168,240,.3)", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C9A8F0", fontSize: 22, flexDirection: "column", gap: 2 }}>
                  {uploading && !categorias?.find(c => c.nome_do_item === uploading) ? <span style={{ fontSize: 9 }}>...</span> : "+"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                    if (!e.target.files[0]) return;
                    const nome = window.prompt("Nome da categoria (ex: Bang Chan, Changbin...)");
                    if (nome?.trim()) uploadCategoria(nome.trim(), e.target.files[0]);
                  }} />
                </label>
                <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: "rgba(245,240,232,.3)" }}>nova</span>
              </div>
            </div>
          </div>
        )}

        {loading && <div style={{ padding: 40, textAlign: "center", color: "rgba(245,240,232,.52)", fontSize: "var(--fs-xs)" }}>carregando...</div>}

        {!loading && viewMode === "galeria" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {grupos.map(({ cat, itens: gItens }) => (
              <div key={cat ? cat.nome_do_item : "__sem__"}>
                {/* Header do grupo */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  {cat && (
                    <img src={cat.foto_url} alt={cat.nome_do_item} onClick={() => setAmpliada(cat)}
                      style={{ width: 56, height: 72, borderRadius: 8, objectFit: "cover", flexShrink: 0, cursor: "pointer" }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: cat ? "#F5F0E8" : "rgba(245,240,232,.3)", letterSpacing: "0.5px" }}>
                      {cat ? cat.nome_do_item.toUpperCase() : "SEM CATEGORIA"}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(245,240,232,.35)", fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{gItens.length} item(s)</div>
                  </div>
                </div>
                {/* Grid de joiners desse grupo */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                  {gItens.map(item => {
                    const ai = getStepIdx(item.status);
                    return (
                      <div key={item.id} style={{ background: "#181614", border: "1px solid rgba(245,240,232,.07)", borderRadius: 10, overflow: "hidden" }}>
                        {cat && <div style={{ height: 90, overflow: "hidden" }}>
                          <img src={cat.foto_url} alt={item.nome_do_item} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </div>}
                        <div style={{ padding: "8px 10px 10px" }}>
                          <div style={{ fontSize: 9, color: "#C9A8F0", fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>{item.nome || item.cog || "—"}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#F5F0E8", fontFamily: "'DM Mono',monospace", lineHeight: 1.3, marginBottom: 6 }}>{item.nome_do_item}</div>
                          <StatusChip status={item.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && viewMode === "tabela" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr className="col-group-header">
                  <th colSpan={3}></th>
                  <th colSpan={3}>VALORES A PAGAR</th>
                  <th className="status-group" colSpan={2}>STATUS</th>
                </tr>
                <tr className="thead-cols">
                  <th>IMAGEM</th>
                  <th>JOINER</th>
                  <th>NOME DO ITEM</th>
                  <th>ITEM</th>
                  <th>FRETE INTER</th>
                  <th>TAXA RF</th>
                  <th>STATUS</th>
                  <th>INFO</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && <tr><td colSpan={8} className="empty-cell">nenhum item</td></tr>}
                {grupos.map(({ cat, itens: gItens }) => (
                  <Fragment key={cat ? cat.nome_do_item : "__sem__"}>
                    {/* Linha separadora de grupo */}
                    <tr>
                      <td colSpan={8} style={{ background: "rgba(245,240,232,.03)", borderTop: "1px solid rgba(245,240,232,.08)", padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {cat && <img src={cat.foto_url} alt={cat.nome_do_item} style={{ width: 32, height: 40, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />}
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: cat ? "#F5F0E8" : "rgba(245,240,232,.3)", letterSpacing: "0.5px" }}>
                            {cat ? cat.nome_do_item.toUpperCase() : "SEM CATEGORIA"}
                          </span>
                          <span style={{ fontSize: 9, color: "rgba(245,240,232,.3)", fontFamily: "'DM Mono',monospace" }}>{gItens.length} item(s)</span>
                        </div>
                      </td>
                    </tr>
                    {gItens.map(item => {
                      const ai = getStepIdx(item.status);
                      return (
                        <tr key={item.id}>
                          <td style={{ width: 56, padding: "6px 8px" }}>
                            {cat ? (
                              <div style={{ width: 44, height: 56, borderRadius: 6, overflow: "hidden", cursor: "pointer" }}
                                onClick={() => setAmpliada(cat)}>
                                <img src={cat.foto_url} alt={cat.nome_do_item} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            ) : (
                              <div style={{ width: 44, height: 56, borderRadius: 6, background: "rgba(245,240,232,.04)" }} />
                            )}
                          </td>
                          <td className="ceg-detail-joiner">{item.nome || item.cog || "—"}</td>
                          <td><div className="item-title"><InfoContent info={item.nome_do_item} /></div></td>
                          <td><span className="td-val">{Number(item.valor_item) > 0 ? `R$${fmtBRL(item.valor_item)}` : <span className="zero-val">—</span>}</span></td>
                          <td><span className="td-val">{Number(item.frete_inter) > 0 ? `R$${fmtBRL(item.frete_inter)}` : <span className="zero-val">—</span>}</span></td>
                          <td>{Number(item.taxa_rf) > 0 ? <span className="td-val">R${fmtBRL(item.taxa_rf)}</span> : <span className="zero-val">—</span>}</td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              <StatusChip status={item.status} />
                              <ProgressMini activeIdx={ai} />
                            </div>
                          </td>
                          <td>{item.info_adicionais && <div className="item-detail"><InfoContent info={item.info_adicionais} /></div>}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ampliada && (
        <div onClick={() => setAmpliada(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#181614", border: "1px solid rgba(245,240,232,.1)", borderRadius: 16, overflow: "hidden", maxWidth: 400, width: "100%" }}>
            <img src={ampliada.foto_url} alt={ampliada.nome_do_item} style={{ width: "100%", display: "block", maxHeight: "70vh", objectFit: "contain", background: "#0d0c0b" }} />
            <div style={{ padding: "14px 18px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#F5F0E8", fontFamily: "'DM Mono',monospace" }}>{ampliada.nome_do_item}</div>
              <button onClick={() => setAmpliada(null)} style={{ marginTop: 12, background: "transparent", border: "1px solid rgba(245,240,232,.15)", borderRadius: 6, padding: "5px 14px", color: "rgba(245,240,232,.4)", fontFamily: "'DM Mono',monospace", fontSize: 10, cursor: "pointer" }}>fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin: gerenciar galeria de qualquer CEG ──────────────────────────────────
function AdminGaleria() {
  const [cegSelecionada, setCegSelecionada] = useState("");
  const [cegsDisponiveis,setCegsDisponiveis] = useState([]);
  const [fotos,          setFotos]          = useState(null);
  const [uploading,      setUploading]      = useState(false);
  const [editando,       setEditando]       = useState(null);
  const [msg,            setMsg]            = useState("");

  useEffect(() => {
    supabase.from("masterlist").select("ceg").neq("nome","Disponivel")
      .then(({ data }) => {
        const uniq = [...new Set((data||[]).map(r => r.ceg).filter(Boolean))].sort();
        setCegsDisponiveis(uniq);
        if (uniq.length > 0) setCegSelecionada(uniq[0]);
      });
  }, []);

  useEffect(() => {
    if (!cegSelecionada) { setFotos(null); return; }
    setFotos(null);
    supabase.from("item_fotos").select("*").eq("ceg", cegSelecionada).order("ordem").order("id")
      .then(({ data }) => setFotos(data || []));
  }, [cegSelecionada]);

  async function uploadFotos(files) {
    if (!cegSelecionada) return;
    setUploading(true);
    const slug = cegSelecionada.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().slice(0, 30);
    const novas = [];
    for (const file of files) {
      const ext  = file.name.split(".").pop().toLowerCase();
      const path = `${slug}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("fotos-itens").upload(path, file, { upsert: true });
      if (upErr) { alert("Erro: " + upErr.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from("fotos-itens").getPublicUrl(path);
      const { data: nova, error: insErr } = await supabase.from("item_fotos")
        .insert([{ ceg: cegSelecionada, nome_do_item: file.name.replace(/\.[^.]+$/, ""), foto_url: publicUrl, ordem: (fotos || []).length + novas.length }])
        .select().single();
      if (insErr) { alert("Erro ao salvar foto: " + insErr.message); continue; }
      if (nova) novas.push(nova);
    }
    setFotos(prev => [...(prev || []), ...novas]);
    setMsg(`${novas.length} foto(s) adicionada(s) ✓`);
    setTimeout(() => setMsg(""), 3000);
    setUploading(false);
  }

  async function salvarLabel(id, label) {
    await supabase.from("item_fotos").update({ nome_do_item: label, descricao: label }).eq("id", id);
    setFotos(prev => prev.map(f => f.id === id ? { ...f, nome_do_item: label, descricao: label } : f));
    setEditando(null);
  }

  async function removerFoto(id) {
    if (!window.confirm("Remover foto?")) return;
    const { error } = await supabase.from("item_fotos").delete().eq("id", id);
    if (error) { alert("Erro ao remover foto: " + error.message); return; }
    setFotos(prev => prev.filter(f => f.id !== id));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <h3 className="admin-title" style={{ fontSize: 16, margin: 0 }}>Galeria · fotos por CEG</h3>
      </div>

      {/* Seletor de CEG */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(245,240,232,.4)", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>CEG</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={cegSelecionada}
            onChange={e => setCegSelecionada(e.target.value)}
            style={{ flex: 1, background: "#1a1a18", border: "1px solid rgba(245,240,232,.15)", borderRadius: 7, padding: "8px 12px", color: cegSelecionada ? "#F5F0E8" : "rgba(245,240,232,.35)", fontFamily: "'DM Mono',monospace", fontSize: 12, outline: "none", cursor: "pointer" }}
          >
            {cegsDisponiveis.length === 0 && <option value="">carregando CEGs…</option>}
            {cegsDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: "rgba(245,240,232,.25)", marginTop: 5 }}>{cegSelecionada ? `exibindo: ${cegSelecionada} · ${fotos ? fotos.length : "…"} foto(s)` : "selecione uma CEG acima"}</div>
      </div>

      {/* Zona de upload */}
      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, border: "2px dashed rgba(201,168,240,.3)", borderRadius: 10, padding: "28px 20px", cursor: "pointer", marginBottom: 20, background: "rgba(201,168,240,.04)" }}>
        <span style={{ fontSize: 22 }}>+</span>
        <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#C9A8F0" }}>{uploading ? "enviando..." : `adicionar fotos · ${cegSelecionada}`}</span>
        <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: "rgba(245,240,232,.25)" }}>pode selecionar várias de uma vez</span>
        <input type="file" accept="image/*" multiple style={{ display: "none" }} disabled={uploading || !cegSelecionada} onChange={e => e.target.files.length && uploadFotos(Array.from(e.target.files))} />
      </label>

      {msg && <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#BAFF39", marginBottom: 14 }}>{msg}</div>}

      {fotos === null && <div style={{ fontSize: 12, color: "rgba(245,240,232,.3)", fontFamily: "'DM Mono',monospace" }}>carregando...</div>}

      {fotos && fotos.length === 0 && <div style={{ fontSize: 12, color: "rgba(245,240,232,.25)", fontFamily: "'DM Mono',monospace" }}>nenhuma foto para {cegSelecionada}</div>}

      {/* Grid de fotos existentes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
        {(fotos || []).map(foto => (
          <div key={foto.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "rgba(245,240,232,.05)", aspectRatio: "1" }}>
            <img src={foto.foto_url} alt={foto.nome_do_item} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.75) 0%, transparent 50%)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 6, gap: 4, opacity: 0, transition: "opacity .15s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}>
              {editando === foto.id ? (
                <input
                  autoFocus
                  defaultValue={foto.nome_do_item || ""}
                  onKeyDown={e => { if (e.key === "Enter") salvarLabel(foto.id, e.target.value); if (e.key === "Escape") setEditando(null); }}
                  onBlur={e => salvarLabel(foto.id, e.target.value)}
                  style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", background: "rgba(0,0,0,.7)", border: "1px solid rgba(245,240,232,.3)", borderRadius: 4, padding: "3px 6px", color: "#F5F0E8", outline: "none", width: "100%" }}
                />
              ) : (
                <span onClick={() => setEditando(foto.id)} style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: "rgba(245,240,232,.7)", cursor: "text", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{foto.nome_do_item || "sem título"}</span>
              )}
              <button onClick={() => removerFoto(foto.id)} style={{ fontSize: 8, fontFamily: "'DM Mono',monospace", background: "rgba(255,107,107,.15)", color: "#ff6b6b", border: "1px solid rgba(255,107,107,.3)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", alignSelf: "flex-start" }}>✕ remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Galeria pública This & That ──────────────────────────────────────────────
function ThisAndThatGallery() {
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [ampliada, setAmpliada] = useState(null);

  useEffect(() => {
    supabase.from("item_fotos").select("*").eq("ceg", "THIS & THAT").order("ordem", { ascending: true }).order("id", { ascending: true })
      .then(({ data }) => { if (data) setFotos(data); setLoading(false); });
  }, []);

  const filtradas = busca.trim()
    ? fotos.filter(f => f.nome_do_item.toLowerCase().includes(busca.toLowerCase()) || (f.descricao||"").toLowerCase().includes(busca.toLowerCase()))
    : fotos;

  return (
    <div style={{ minHeight:"100vh", background:"#0D0C0B", color:"#F5F0E8", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom:"1px solid rgba(245,240,232,.07)", padding:"28px 24px 24px", display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12, maxWidth:1080, margin:"0 auto" }}>
        <div>
          <div style={{ fontSize:9, letterSpacing:"3px", textTransform:"uppercase", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>ANTICEG · GALERIA</div>
          <h1 style={{ fontSize:"clamp(26px,5vw,44px)", fontWeight:900, letterSpacing:"-1px", margin:0, lineHeight:1 }}>THIS &amp; THAT</h1>
        </div>
        <a href="/" style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.3)", textDecoration:"none", letterSpacing:"1px" }}>← portal</a>
      </div>

      {/* Busca */}
      <div style={{ padding:"20px 24px 0", maxWidth:1080, margin:"0 auto" }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar item..." style={{ width:"100%", maxWidth:340, background:"rgba(245,240,232,.05)", border:"1px solid rgba(245,240,232,.1)", borderRadius:8, padding:"10px 16px", color:"#F5F0E8", fontSize:12, fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box" }} />
        {busca && <span style={{ marginLeft:10, fontSize:11, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>{filtradas.length} resultado(s)</span>}
      </div>

      {/* Grid */}
      <div style={{ padding:"20px 24px 80px", maxWidth:1080, margin:"0 auto" }}>
        {loading && <div style={{ textAlign:"center", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"80px 0" }}>carregando...</div>}
        {!loading && filtradas.length === 0 && <div style={{ textAlign:"center", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"80px 0" }}>Nenhum item ainda.</div>}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:14 }}>
          {filtradas.map(f => (
            <div key={f.id} onClick={() => setAmpliada(f)} style={{ background:"#181614", border:"1px solid rgba(245,240,232,.07)", borderRadius:12, overflow:"hidden", cursor:"pointer", transition:"border-color .15s, transform .15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(245,240,232,.22)"; e.currentTarget.style.transform="translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(245,240,232,.07)"; e.currentTarget.style.transform="translateY(0)"; }}>
              <div style={{ aspectRatio:"1/1", overflow:"hidden", background:"rgba(245,240,232,.04)" }}>
                <img src={f.foto_url} alt={f.nome_do_item} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
              </div>
              <div style={{ padding:"10px 12px 12px" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", lineHeight:1.4 }}>{f.nome_do_item}</div>
                {f.descricao && <div style={{ fontSize:10, color:"rgba(245,240,232,.38)", marginTop:3, fontFamily:"'DM Mono',monospace", lineHeight:1.4 }}>{f.descricao}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal ampliado */}
      {ampliada && (
        <div onClick={() => setAmpliada(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#181614", border:"1px solid rgba(245,240,232,.1)", borderRadius:16, overflow:"hidden", maxWidth:520, width:"100%" }}>
            <img src={ampliada.foto_url} alt={ampliada.nome_do_item} style={{ width:"100%", display:"block", maxHeight:"60vh", objectFit:"contain", background:"#0d0c0b" }} />
            <div style={{ padding:"16px 20px 20px" }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{ampliada.nome_do_item}</div>
              {ampliada.descricao && <div style={{ fontSize:12, color:"rgba(245,240,232,.45)", marginTop:6, fontFamily:"'DM Mono',monospace", lineHeight:1.5 }}>{ampliada.descricao}</div>}
              <button onClick={() => setAmpliada(null)} style={{ marginTop:14, background:"transparent", border:"1px solid rgba(245,240,232,.15)", borderRadius:6, padding:"6px 16px", color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", fontSize:10, cursor:"pointer" }}>fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EnvioTab({ user, itens, proximoEnvio = "", envioAberturaInicio = "", envioAberturaFim = "" }) {
  const WA_GOM = "5524992782023";
  const antigomItens = itens.filter(i => ["ANTIGOM", "Envio Liberado"].includes(i.status));
  const [envioWinW, setEnvioWinW] = useState(window.innerWidth);
  useEffect(() => { const h = () => setEnvioWinW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  const envioIsMobile = envioWinW <= 680;

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
  const [envioSubTab, setEnvioSubTab] = useState("form");
  const [meuEnvios,   setMeuEnvios]   = useState([]);
  const [expandedEnvio, setExpandedEnvio] = useState(new Set());
  const [opcaoEscolhida, setOpcaoEscolhida] = useState({});

  const hoje = new Date().toISOString().slice(0, 10);
  const isAutoUnlocked = !!(envioAberturaInicio && envioAberturaFim && hoje >= envioAberturaInicio && hoje <= envioAberturaFim);
  const efetivamenteUnlocked = unlocked || isAutoUnlocked;

  // grupo de envio
  const [grupoMode,    setGrupoMode]    = useState(null); // null | "criar" | "entrar"
  const [grupoCodigo,  setGrupoCodigo]  = useState("");
  const [grupoInput,   setGrupoInput]   = useState("");
  const [grupoLoading, setGrupoLoading] = useState(false);
  const [grupoErr,     setGrupoErr]     = useState("");
  const [grupoOk,      setGrupoOk]      = useState(false);
  const [grupoTutorial, setGrupoTutorial] = useState(false);

  function gerarCodigoGrupo() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  async function criarGrupo() {
    setGrupoLoading(true);
    const codigo = gerarCodigoGrupo();
    const { error } = await supabase.from("grupos_envio").insert([{
      codigo, host_cog: user.cog,
      destinatario, cpf, cep, endereco, numero,
      complemento: complemento || null, bairro, cidade, estado,
    }]);
    setGrupoLoading(false);
    if (error) { setGrupoErr("Não foi possível criar o grupo — tente novamente."); setGrupoMode(null); return; }
    setGrupoCodigo(codigo);
  }

  async function entrarNoGrupo() {
    const codigo = grupoInput.trim().toUpperCase();
    if (!codigo) return;
    setGrupoLoading(true); setGrupoErr("");
    const { data, error } = await supabase.from("grupos_envio").select("*").eq("codigo", codigo).single();
    if (error || !data) {
      setGrupoErr("Código não encontrado. Confira com a host do grupo.");
      setGrupoLoading(false); return;
    }
    if (data.host_cog === user.cog) {
      setGrupoErr("Você é a host deste grupo — não precisa entrar nele.");
      setGrupoLoading(false); return;
    }
    // preenche endereço da host (só se existir)
    const temEndereco = !!(data.cep || data.endereco);
    if (data.destinatario) setDestinatario(data.destinatario);
    if (data.cpf)          setCpf(data.cpf);
    if (data.cep)          setCep(data.cep);
    if (data.endereco)     setEndereco(data.endereco);
    if (data.numero)       setNumero(data.numero);
    if (data.complemento)  setComplemento(data.complemento);
    if (data.bairro)       setBairro(data.bairro);
    if (data.cidade)       setCidade(data.cidade);
    if (data.estado)       setEstado(data.estado);
    setGrupoCodigo(codigo);
    if (!temEndereco) {
      setGrupoErr("Grupo encontrado, mas a host ainda não salvou o endereço. Peça para ela clicar em \"Salvar endereço no grupo\" primeiro.");
      setGrupoLoading(false); return;
    }
    setGrupoOk(true);
    setGrupoLoading(false);
  }

  useEffect(() => {
    supabase.from("envio_solicitacoes").select("*").eq("joiner_cog", user.cog).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setMeuEnvios(data); });
  }, [user.cog]);



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
    } catch { setErro("Não foi possível buscar o CEP. Preencha o endereço manualmente."); }
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

    // se é host de grupo, salva o endereço no grupo para as amigas buscarem
    if (grupoCodigo && grupoMode === "criar") {
      await supabase.from("grupos_envio").update({ destinatario, cpf, cep, endereco, numero, complemento: complemento || null, bairro, cidade, estado }).eq("codigo", grupoCodigo);
    }

    const { error } = await supabase.from("envio_solicitacoes").insert([{
      joiner_cog:    user.cog,
      joiner_nome:   nome,
      joiner_handle: handle,
      destinatario,
      cpf,
      cep,
      endereco,
      numero,
      complemento:   complemento || null,
      bairro,
      cidade,
      estado,
      itens:         itensSel,
      metodo,
      seguro,
      valor_seguro:  seguro === "sim" ? valorSeguro : null,
      status:        "solicitação de envio",
      ...(grupoCodigo ? { grupo_envio_codigo: grupoCodigo } : {}),
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
  const row2 = { display:"grid", gridTemplateColumns: envioIsMobile ? "1fr" : "1fr 1fr", gap:10 };
  const fld  = { marginBottom:12 };
  const stat = { fontSize:12, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", padding:"9px 0", borderBottom:"1px solid rgba(245,240,232,.06)" };

  const enviadoScreen = (
    <div style={{ textAlign:"center", padding:"40px 16px" }}>
      <div style={{ fontSize:36, marginBottom:16 }}>📦</div>
      <div style={{ fontSize:16, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", marginBottom:14 }}>Solicitação enviada!</div>
      <div style={{ fontSize:12, color:"rgba(245,240,232,.55)", fontFamily:"'DM Mono',monospace", lineHeight:1.9, background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.07)", borderRadius:10, padding:"20px 24px", textAlign:"left" }}>
        Sua solicitação foi recebida com sucesso.<br /><br />
        O prazo de cotação é de <strong style={{ color:"#F5F0E8" }}>5 dias úteis</strong> a partir do preenchimento deste formulário.<br /><br />
        A cotação estará disponível dentro do seu acesso com os valores e taxas.
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginTop:16 }}>
        <button onClick={() => { setEnvioSubTab("solicitacoes"); }} style={{ padding:"9px 24px", background:"var(--laranja)", color:"#111", border:"none", borderRadius:6, fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".05em" }}>
          Ver minhas solicitações →
        </button>
        <button onClick={() => {
          setEnviado(false);
          setSelecionados([]);
          setMetodo(""); setSeguro(""); setValorSeguro("");
          setConfirmou(false); setCiente1(false); setCiente2(false);
          setErro(""); setGrupoMode(null); setGrupoCodigo(""); setGrupoInput(""); setGrupoOk(false);
        }} style={{ padding:"9px 24px", background:"transparent", color:"rgba(245,240,232,.55)", border:"1px solid rgba(245,240,232,.15)", borderRadius:6, fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace", cursor:"pointer", letterSpacing:".05em" }}>
          + Fazer outra solicitação
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-wrap">
      <h2 className="admin-title" style={{ marginBottom:4 }}>◫ Envio Nacional</h2>
      <div className="admin-greeting" style={{ marginBottom:20 }}>
        <span className="admin-greeting-prompt">// </span>
        <span className="admin-greeting-msg">gerencie seus envios nacionais</span>
      </div>
      <div className="admin-layout">
        <nav className="admin-sidebar">
          <div className="admin-sidebar-group">
            <div className="admin-sidebar-group-label">Envio</div>
            <button className={`admin-sidebar-item${envioSubTab === "form" ? " active" : ""}`} onClick={() => setEnvioSubTab("form")}>
              <span>◫</span>Pedir Envio
            </button>
            <button className={`admin-sidebar-item${envioSubTab === "solicitacoes" ? " active" : ""}`} onClick={() => setEnvioSubTab("solicitacoes")}>
              <span>◈</span>Minhas Solicitações
              {meuEnvios.filter(e => e.status === "pagamento em aberto").length > 0 && (
                <span className="admin-sidebar-badge">{meuEnvios.filter(e => e.status === "pagamento em aberto").length}</span>
              )}
            </button>
          </div>
        </nav>

        <div className="admin-content">

        {/* ── PEDIR ENVIO ── */}
        {envioSubTab === "form" && (
          enviado ? enviadoScreen : (<div style={{ paddingBottom:60, position:"relative" }}>

      {/* BANNER DE PRÉVIA quando formulário ainda não abriu */}
      {!efetivamenteUnlocked && (
        <div style={{ position:"sticky", top:0, zIndex:20, background:"rgba(13,13,13,.97)", borderBottom:"1px solid rgba(100,181,246,.3)", padding:"12px 16px", backdropFilter:"blur(12px)", marginBottom:16, display:"flex", flexWrap:"wrap", alignItems:"center", gap:10 }}>
          <div style={{ flex:1, minWidth:180 }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:14, color:"#64B5F6" }}>
              {proximoEnvio ? <>📬 O formulário abre <strong>{proximoEnvio}</strong></> : "🔒 Formulário fechado · aguarde a abertura"}
            </div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"rgba(245,240,232,.3)", marginTop:3 }}>
              Prévia dos seus itens · para solicitar envio aguarde a abertura
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
            <div style={{ display:"flex", gap:6 }}>
              <input type="password" placeholder="senha" value={senha}
                onChange={e => { setSenha(e.target.value); setSenhaErr(false); }}
                onKeyDown={e => { if (e.key === "Enter") { if (senha === "ILOVE2MIN") setUnlocked(true); else setSenhaErr(true); } }}
                style={{ width:120, background:"#0d0d0d", border:`1px solid ${senhaErr ? "var(--laranja)" : "rgba(245,240,232,.2)"}`, borderRadius:6, padding:"6px 10px", color:"#F5F0E8", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none", textAlign:"center" }}
              />
              <button onClick={() => { if (senha === "ILOVE2MIN") setUnlocked(true); else setSenhaErr(true); }}
                style={{ background:"var(--laranja)", color:"#111", border:"none", borderRadius:6, fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace", cursor:"pointer", padding:"6px 14px", whiteSpace:"nowrap" }}>
                ACESSAR →
              </button>
            </div>
            {senhaErr && <div style={{ fontSize:10, color:"var(--laranja)", fontFamily:"'DM Mono',monospace" }}>senha incorreta</div>}
          </div>
        </div>
      )}

      {/* conteúdo do form — visível mas não interativo antes do unlock */}
      <div style={!efetivamenteUnlocked ? { pointerEvents:"none", opacity:0.45, userSelect:"none" } : {}}>

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

      {/* GRUPO — entrar em grupo de amiga (antes do form) */}
      {(grupoMode === "entrar" || grupoOk) && (
        <div style={{ ...sec, border: grupoOk ? "1px solid rgba(201,168,240,.3)" : "1px solid rgba(245,240,232,.07)" }}>
          <div style={{ fontSize:10, letterSpacing:"1.5px", color:"#C9A8F0", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:10 }}>👥 Envio em grupo</div>
          {grupoMode === "entrar" && !grupoOk && (
            <div>
              <div style={{ fontSize:11, color:"rgba(245,240,232,.5)", fontFamily:"'DM Mono',monospace", marginBottom:8 }}>Peça o código da host e cole aqui — o endereço preenche automaticamente.</div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <input value={grupoInput} onChange={e => setGrupoInput(e.target.value.toUpperCase())}
                  placeholder="código (ex: BAFF39)"
                  style={{ ...inp, width:160, textTransform:"uppercase", letterSpacing:"2px", textAlign:"center" }}
                />
                <button onClick={entrarNoGrupo} disabled={grupoLoading}
                  style={{ background:"rgba(201,168,240,.12)", border:"1px solid rgba(201,168,240,.3)", color:"#C9A8F0", borderRadius:7, padding:"7px 16px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", whiteSpace:"nowrap" }}>
                  {grupoLoading ? "..." : "Entrar →"}
                </button>
                <button onClick={() => { setGrupoMode(null); setGrupoInput(""); setGrupoErr(""); }}
                  style={{ background:"none", border:"none", color:"rgba(245,240,232,.25)", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>Cancelar</button>
              </div>
              {grupoErr && <div style={{ marginTop:6, fontSize:10, color:"var(--laranja)", fontFamily:"'DM Mono',monospace" }}>{grupoErr}</div>}
            </div>
          )}
          {grupoOk && <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color:"#C9A8F0" }}>✓</span>
            <div>
              <div style={{ fontSize:11, color:"#C9A8F0", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>Grupo {grupoCodigo} — endereço preenchido!</div>
              <div style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace" }}>Confirme os dados abaixo antes de enviar.</div>
            </div>
          </div>}
        </div>
      )}
      {!grupoMode && !grupoCodigo && (
        <div style={{ marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
            <button onClick={() => { if (!cep || !endereco) { setGrupoErr("Preencha o endereço antes de criar o grupo."); } else { setGrupoMode("criar"); criarGrupo(); } }}
              style={{ background:"rgba(255,114,64,.1)", border:"1px solid rgba(255,114,64,.3)", color:"#FF7240", borderRadius:7, padding:"6px 14px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", whiteSpace:"nowrap" }}>
              🏠 Sou a host — criar grupo
            </button>
            <button onClick={() => { setGrupoErr(""); setGrupoMode("entrar"); }}
              style={{ background:"none", border:"1px solid rgba(201,168,240,.2)", color:"rgba(201,168,240,.6)", borderRadius:7, padding:"6px 14px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", whiteSpace:"nowrap" }}>
              👥 Entrar em grupo de amiga
            </button>
            <button onClick={() => setGrupoTutorial(v => !v)}
              style={{ background:"none", border:"none", color:"rgba(245,240,232,.25)", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", padding:0, marginLeft:"auto", textDecoration:"underline", textDecorationStyle:"dotted", textUnderlineOffset:3 }}>
              {grupoTutorial ? "▲ fechar" : "? como funciona"}
            </button>
          </div>
          {grupoErr && <div style={{ fontSize:10, color:"var(--laranja)", fontFamily:"'DM Mono',monospace", marginTop:4 }}>{grupoErr}</div>}
        </div>
      )}

      {/* TUTORIAL GRUPO */}
      {grupoTutorial && !grupoMode && !grupoCodigo && (
        <div style={{ background:"rgba(201,168,240,.04)", border:"1px solid rgba(201,168,240,.15)", borderRadius:12, padding:"20px 18px", marginBottom:16 }}>
          <div style={{ fontSize:10, letterSpacing:"2px", color:"#C9A8F0", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:16 }}>👥 Como funciona o envio em grupo</div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {/* HOST */}
            <div style={{ background:"rgba(255,114,64,.06)", border:"1px solid rgba(255,114,64,.18)", borderRadius:10, padding:"14px 14px" }}>
              <div style={{ fontSize:9, letterSpacing:"2px", color:"#FF7240", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:10 }}>🏠 Host · quem tem o endereço</div>
              {[
                ["1", "Preencha seus dados e o endereço completo de entrega."],
                ["2", <>Vai aparecer <strong style={{color:"#F5F0E8"}}>\"Criar grupo de envio\"</strong> no final do endereço — clique.</>],
                ["3", "Copie o código de 6 letras e mande para as amigas."],
                ["4", "Escolha seus itens e envie normalmente."],
              ].map(([n, txt]) => (
                <div key={n} style={{ display:"flex", gap:8, marginBottom:8, fontSize:11, color:"rgba(245,240,232,.5)", lineHeight:1.5 }}>
                  <span style={{ background:"rgba(255,114,64,.15)", color:"#FF7240", borderRadius:"50%", width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontFamily:"'DM Mono',monospace", flexShrink:0, marginTop:1 }}>{n}</span>
                  <span>{txt}</span>
                </div>
              ))}
            </div>

            {/* GUEST */}
            <div style={{ background:"rgba(201,168,240,.05)", border:"1px solid rgba(201,168,240,.18)", borderRadius:10, padding:"14px 14px" }}>
              <div style={{ fontSize:9, letterSpacing:"2px", color:"#C9A8F0", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:10 }}>🤝 Amiga · quem entra no grupo</div>
              {[
                ["1", "Peça o código de 6 letras para a host do grupo."],
                ["2", <>Clique em <strong style={{color:"#F5F0E8"}}>\"Entrar em grupo de amiga\"</strong> aqui em cima.</>],
                ["3", "Cole o código — o endereço preenche automaticamente."],
                ["4", "Escolha seus próprios itens e envie."],
              ].map(([n, txt]) => (
                <div key={n} style={{ display:"flex", gap:8, marginBottom:8, fontSize:11, color:"rgba(245,240,232,.5)", lineHeight:1.5 }}>
                  <span style={{ background:"rgba(201,168,240,.15)", color:"#C9A8F0", borderRadius:"50%", width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontFamily:"'DM Mono',monospace", flexShrink:0, marginTop:1 }}>{n}</span>
                  <span>{txt}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[
              ["📦", "Não tem limite de pessoas por grupo — quantas amigas quiser podem usar o mesmo código."],
              ["🛍️", "Cada uma escolhe e paga seus próprios itens — o grupo só compartilha o endereço."],
              ["⚠️", "A host precisa preencher o endereço antes de criar o grupo — o botão só aparece quando o endereço está preenchido."],
            ].map(([icon, txt]) => (
              <div key={icon} style={{ display:"flex", gap:8, fontSize:11, color:"rgba(245,240,232,.35)", lineHeight:1.5 }}>
                <span style={{flexShrink:0}}>{icon}</span><span>{txt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {grupoMode === "criar" && grupoCodigo && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid rgba(201,168,240,.15)", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <div style={{ fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>Código do grupo criado:</div>
          <div style={{ background:"rgba(201,168,240,.08)", border:"1px solid rgba(201,168,240,.3)", borderRadius:8, padding:"8px 18px", fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:900, color:"#C9A8F0", letterSpacing:"3px" }}>
            {grupoCodigo}
          </div>
          <button onClick={() => navigator.clipboard.writeText(grupoCodigo)}
            style={{ background:"none", border:"1px solid rgba(201,168,240,.2)", color:"rgba(201,168,240,.6)", borderRadius:7, padding:"6px 12px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
            Copiar
          </button>
          <button onClick={() => { setGrupoMode(null); setGrupoCodigo(""); }}
            style={{ background:"none", border:"none", color:"rgba(245,240,232,.2)", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
            Cancelar
          </button>
          <div style={{ width:"100%", fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", lineHeight:1.6 }}>
            Compartilhe este código com suas amigas — elas entram pelo botão "Entrar em grupo de amiga" e o endereço preenche automaticamente.
          </div>
        </div>
      )}

      </div>{/* fim wrapper bloqueado — parte 1 */}

      {/* ITENS — sempre clicável */}
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

      <div style={!efetivamenteUnlocked ? { pointerEvents:"none", opacity:0.45, userSelect:"none" } : {}}>
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
      </div>{/* fim wrapper pointer-events */}
    </div>))}

        {/* ── MINHAS SOLICITAÇÕES ── */}
        {envioSubTab === "solicitacoes" && (
          <div>
            {meuEnvios.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 0", fontSize:12, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace" }}>
                Nenhuma solicitação ainda.<br />
                <button onClick={() => setEnvioSubTab("form")} style={{ marginTop:12, padding:"8px 20px", background:"var(--laranja)", color:"#111", border:"none", borderRadius:6, fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
                  Pedir Envio →
                </button>
              </div>
            ) : meuEnvios.map(s => {
              const statusColor  = { "solicitação de envio":"#BAFF39", "cotação em andamento":"#FF5C1A", "pagamento em aberto":"#C9A8F0", "pagamento confirmado":"#FFD166", embalando:"#64B5F6", enviado:"rgba(245,240,232,.4)", cancelado:"rgba(245,240,232,.2)" }[s.status] || "rgba(245,240,232,.4)";
              const statusBorder = { "solicitação de envio":"rgba(186,255,57,.2)", "cotação em andamento":"rgba(255,92,26,.25)", "pagamento em aberto":"rgba(201,168,240,.25)", "pagamento confirmado":"rgba(255,209,102,.25)", embalando:"rgba(100,181,246,.25)", enviado:"rgba(245,240,232,.08)", cancelado:"rgba(245,240,232,.06)" }[s.status] || "rgba(245,240,232,.08)";
              const expanded = expandedEnvio.has(s.id);
              const toggleExpand = () => setExpandedEnvio(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; });
              return (
                <div key={s.id} style={{ background:"var(--card-bg)", border:`1px solid ${statusBorder}`, borderRadius:10, marginBottom:8, overflow:"hidden" }}>
                  <div onClick={toggleExpand} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", cursor:"pointer", gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace" }}>{new Date(s.created_at).toLocaleDateString("pt-BR")} · {s.itens?.length || 0} item(s)</div>
                      <div style={{ fontSize:10, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{s.metodo || "—"}{s.grupo_envio_codigo && <span style={{ marginLeft:8, color:"#C9A8F0" }}>👥 {s.grupo_envio_codigo}</span>}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                      <span style={{ fontSize:9, color:statusColor, border:`1px solid ${statusBorder}`, borderRadius:4, padding:"2px 8px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", whiteSpace:"nowrap" }}>{ENVIO_STATUS_LABEL[s.status] || s.status}</span>
                      <span style={{ fontSize:12, color:"rgba(245,240,232,.4)" }}>{expanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {expanded && <div style={{ padding:"0 16px 16px" }}>
                    <div style={{ height:1, background:"rgba(245,240,232,.06)", marginBottom:8 }} />
                    <EnvioFlowStepper status={s.status} />
                    <div style={{ height:1, background:"rgba(245,240,232,.06)", marginTop:8, marginBottom:12 }} />

                    {/* Código do grupo */}
                    {s.grupo_envio_codigo && (
                      <div style={{ background:"rgba(201,168,240,.06)", border:"1px solid rgba(201,168,240,.2)", borderRadius:8, padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                        <div>
                          <div style={{ fontSize:9, color:"#C9A8F0", fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase", marginBottom:3 }}>👥 Envio em grupo</div>
                          <div style={{ fontSize:16, fontWeight:900, color:"#C9A8F0", fontFamily:"'DM Mono',monospace", letterSpacing:"3px" }}>{s.grupo_envio_codigo}</div>
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(s.grupo_envio_codigo)}
                          style={{ background:"rgba(201,168,240,.12)", border:"1px solid rgba(201,168,240,.25)", color:"#C9A8F0", borderRadius:7, padding:"6px 14px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", whiteSpace:"nowrap" }}>
                          Copiar código
                        </button>
                      </div>
                    )}

                    {s.itens?.length > 0 && (() => {
                      const totalCaixa = s.itens.reduce((a, it) => a + pf(it.valor) + pf(it.taxa) + pf(it.frete), 0);
                      return (
                        <div style={{ marginBottom:10 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                            <div style={{ fontSize:10, color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase" }}>Itens solicitados</div>
                            {totalCaixa > 0 && <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(245,240,232,.4)" }}>Total: <strong style={{ color:"#F5F0E8" }}>R$ {totalCaixa.toFixed(2).replace(".",",")}</strong></div>}
                          </div>
                          {s.itens.map((it, idx) => (
                            <div key={idx} style={{ fontSize:11, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace", padding:"3px 0", borderBottom:"1px solid rgba(245,240,232,.04)" }}>
                              {it.nome || it.nome_do_item || "—"} <span style={{ color:"rgba(245,240,232,.3)" }}>({it.ceg})</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div style={{ fontSize:11, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginBottom: s.cotacao_valor ? 10 : 0 }}>
                      Método: {s.metodo} · Val. declarado: {s.seguro === "sim" ? `R$ ${s.valor_seguro}` : "—"}
                    </div>
                    {s.cotacao_valor && (() => {
                      const opcoes = s.cotacao_opcoes || [];
                      const emb    = pf(s.cotacao_embalagem);
                      const formaCor = { "PAC":"#003DA5","SEDEX":"#E87722","Correios":"#003DA5","Jadlog":"#E63946","JADLOG":"#E63946","Mini Envios":"#6B7280","Busca":"#6B7280" };
                      return (
                        <div style={{ background:"rgba(201,168,240,.06)", border:"1px solid rgba(201,168,240,.2)", borderRadius:9, padding:"14px 16px", marginTop:8, fontFamily:"'DM Mono',monospace" }}>
                          <div style={{ fontSize:10, letterSpacing:"1px", color:"#C9A8F0", textTransform:"uppercase", marginBottom:12 }}>Cotação disponível</div>
                          {opcoes.length > 0 ? (
                            <>
                              {["pagamento em aberto","pagamento confirmado","embalando","enviado"].includes(s.status) && s.modalidade_escolhida ? (
                                <>
                                  <div style={{ background: s.status === "pagamento em aberto" ? "rgba(201,168,240,.06)" : "rgba(186,255,57,.06)", border:`1px solid ${s.status === "pagamento em aberto" ? "rgba(201,168,240,.22)" : "rgba(186,255,57,.22)"}`, borderRadius:8, padding:"12px 14px", marginBottom:8 }}>
                                    <div style={{ fontSize:10, color: s.status === "pagamento em aberto" ? "#C9A8F0" : "#BAFF39", letterSpacing:"1px", marginBottom:4 }}>{s.status === "pagamento em aberto" ? "PAGAMENTO EM ABERTO" : "MODALIDADE CONFIRMADA"}</div>
                                    <div style={{ fontSize:15, fontWeight:900, color:"#F5F0E8" }}>{s.modalidade_escolhida.forma} — R$ {(pf(s.modalidade_escolhida.valor)+emb).toFixed(2).replace(".",",")}</div>
                                    <div style={{ fontSize:10, color:"rgba(245,240,232,.4)", marginTop:3 }}>Até {s.modalidade_escolhida.prazo}{emb > 0 ? ` · frete R$ ${s.modalidade_escolhida.valor} + emb. R$ ${s.cotacao_embalagem}` : ""}</div>
                                  </div>
                                  {s.status === "pagamento em aberto" && (() => {
                                    const PIX_KEY  = "de1a489d-db81-4864-a8cf-74cdd79d9cdc";
                                    const totalPix = (pf(s.modalidade_escolhida.valor)+emb).toFixed(2).replace(".",",");
                                    return (
                                      <>
                                        <div style={{ background:"rgba(186,255,57,.05)", border:"1px solid rgba(186,255,57,.18)", borderRadius:8, padding:"12px 14px", marginTop:8 }}>
                                          <div style={{ fontSize:9, color:"#BAFF39", letterSpacing:"1px", marginBottom:8 }}>CHAVE PIX — MERCADO PAGO</div>
                                          <div style={{ fontSize:10, color:"rgba(245,240,232,.5)", marginBottom:6 }}>Fernanda Gomes Medeiros · R$ {totalPix}</div>
                                          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                                            <div style={{ flex:1, background:"rgba(0,0,0,.35)", border:"1px solid rgba(245,240,232,.12)", borderRadius:5, padding:"7px 10px", fontSize:10, color:"#F5F0E8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{PIX_KEY}</div>
                                            <button onClick={() => { navigator.clipboard.writeText(PIX_KEY); }} style={{ flexShrink:0, padding:"7px 12px", background:"rgba(186,255,57,.14)", color:"#BAFF39", border:"1px solid rgba(186,255,57,.3)", borderRadius:5, fontSize:10, fontWeight:700, cursor:"pointer" }}>Copiar</button>
                                          </div>
                                        </div>
                                        <a href={`https://wa.me/5524992782023?text=${encodeURIComponent(`Olá! Segue o comprovante de pagamento do meu envio.\n\nNome: ${s.joiner_nome}\nModalidade: ${s.modalidade_escolhida.forma} (${s.modalidade_escolhida.prazo})\nValor pago: R$ ${totalPix}`)}`} target="_blank" rel="noopener noreferrer" style={{ display:"block", textAlign:"center", padding:"11px", background:"rgba(201,168,240,.12)", color:"#C9A8F0", border:"1px solid rgba(201,168,240,.3)", borderRadius:7, fontSize:11, fontWeight:700, textDecoration:"none", marginTop:6 }}>
                                          📎 Enviar comprovante no WhatsApp →
                                        </a>
                                      </>
                                    );
                                  })()}
                                </>
                              ) : (
                                <>
                                  {!["enviado","cancelado"].includes(s.status) && <div style={{ fontSize:9, color:"rgba(245,240,232,.3)", marginBottom:6 }}>Toque para selecionar a modalidade</div>}
                                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                    {opcoes.map((o, oi) => {
                                      const sel = opcaoEscolhida[s.id] === oi;
                                      const cor = formaCor[o.forma] || "#6B7280";
                                      const totalOp = (pf(o.valor)+emb).toFixed(2).replace(".",",");
                                      return (
                                        <button key={oi} onClick={() => setOpcaoEscolhida(prev => ({ ...prev, [s.id]: oi }))}
                                          style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderRadius:7, border:`1px solid ${sel ? cor : "rgba(245,240,232,.1)"}`, background: sel ? `${cor}18` : "rgba(0,0,0,.2)", cursor:"pointer", transition:"all .15s" }}>
                                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                            <div style={{ width:8, height:8, borderRadius:"50%", background: sel ? cor : "rgba(245,240,232,.2)", flexShrink:0 }} />
                                            <div style={{ textAlign:"left" }}>
                                              <div style={{ fontSize:11, fontWeight:700, color:"#F5F0E8" }}>{o.forma}</div>
                                              <div style={{ fontSize:9, color:"rgba(245,240,232,.4)" }}>Até {o.prazo}</div>
                                            </div>
                                          </div>
                                          <div style={{ textAlign:"right" }}>
                                            <div style={{ fontSize:13, fontWeight:700, color:sel ? cor : "#F5F0E8" }}>R$ {totalOp}</div>
                                            {emb > 0 && <div style={{ fontSize:9, color:"rgba(245,240,232,.3)" }}>frete {o.valor} + emb. {s.cotacao_embalagem}</div>}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {opcaoEscolhida[s.id] !== undefined && !["enviado","cancelado"].includes(s.status) && (
                                    <button onClick={async () => {
                                      const op = opcoes[opcaoEscolhida[s.id]];
                                      await supabase.from("envio_solicitacoes").update({ modalidade_escolhida: op, status: "pagamento em aberto" }).eq("id", s.id);
                                      setMeuEnvios(prev => prev.map(x => x.id === s.id ? { ...x, modalidade_escolhida: op, status: "pagamento em aberto" } : x));
                                    }} style={{ width:"100%", marginTop:10, padding:"10px", background:"var(--laranja)", color:"#111", border:"none", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                      Confirmar modalidade →
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          ) : (
                            <div style={{ fontSize:11, color:"rgba(245,240,232,.4)" }}>Aguardando cotação...</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>}
                </div>
              );
            })}
          </div>
        )}

        </div>{/* admin-content */}
      </div>{/* admin-layout */}
    </div>
  );
}

function BottomNav({ tab, setTab, isGuest, isAdmin }) {
  const items = [
    { id:"masterlist", icon:"☰", label:"Lista" },
    { id:"cegs",       icon:"◈", label:"CEGs" },
    { id:"calendario", icon:"◫", label:"Datas" },
    ...(!isGuest ? [{ id:"perfil", icon:"○", label:"Perfil" }] : []),
    ...(!isGuest ? [{ id:"envio",  icon:"▢", label:"Envio" }] : []),
    { id:"mercari",    icon:"🎌", label:"Mercari" },
    { id:"regras",     icon:"☆", label:"Regras" },
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
  const TAB_SLUGS = ["masterlist","cegs","calendario","perfil","regras","envio","admin","mercari"];
  const parseUrlParts = () => {
    const parts = window.location.pathname.replace(/^\//, "").split("/");
    const pathTab = parts[0] || "";
    const sub = parts[1] || null;
    const qTab = new URLSearchParams(window.location.search).get("tab") || "";
    const tab = TAB_SLUGS.includes(pathTab) ? pathTab : TAB_SLUGS.includes(qTab) ? qTab : "masterlist";
    return { tab, sub };
  };
  const [tab, setTab] = useState(() => parseUrlParts().tab);
  const [initAdminSubTab] = useState(() => { const p = parseUrlParts(); return p.tab === "admin"  ? p.sub : null; });
  const [initPerfilSubTab] = useState(() => { const p = parseUrlParts(); return p.tab === "perfil" ? p.sub : null; });
  const [initCegSlug] = useState(() => { const parts = window.location.pathname.split("/").filter(Boolean); return parts[0] === "cegs" && parts[1] ? parts[1] : null; });
  const [adminReset, setAdminReset] = useState(0);
  const [openPagamentosSignal, setOpenPagamentosSignal] = useState(0);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPinModal, setAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState("");
  const [adminPinError, setAdminPinError] = useState(false);
  const [adminPinStored, setAdminPinStored] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [pushAtivos, setPushAtivos] = useState([]);
  const [pendingReportIds, setPendingReportIds] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [manutencao, setManutencao] = useState(false);
  const [avisoMasterlist, setAvisoMasterlist] = useState("");
  const [bypassManutencao, setBypassManutencao] = useState(
    () => localStorage.getItem("anticeg_admin_bypass") === "1"
  );
  const [adminPortalInput, setAdminPortalInput] = useState("");
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [showPerfilModal, setShowPerfilModal] = useState(false);
  const [perfilPushAtivo, setPerfilPushAtivo] = useState(true);
  const [calEventos, setCalEventos] = useState(null);
  const [badgePopupQueue, setBadgePopupQueue] = useState([]);
  const [proximoEnvio,        setProximoEnvio]        = useState("");
  const [envioAberturaInicio, setEnvioAberturaInicio] = useState("");
  const [envioAberturaFim,    setEnvioAberturaFim]    = useState("");
  const [bannerEnvioVisivel,  setBannerEnvioVisivel]  = useState(true);

  useEffect(() => {
    supabase.from("config").select("value").eq("key", "manutencao").single()
      .then(({ data }) => { if (data) setManutencao(data.value === "true"); });
    supabase.from("config").select("value").eq("key", "aviso_masterlist").single()
      .then(({ data }) => { if (data?.value) setAvisoMasterlist(data.value); });
    supabase.from("config").select("key,value").in("key", ["proximo_envio","envio_abertura_inicio","envio_abertura_fim","banner_envio_visivel"])
      .then(({ data }) => {
        if (!data) return;
        data.forEach(r => {
          if (r.key === "proximo_envio")        setProximoEnvio(r.value        || "");
          if (r.key === "envio_abertura_inicio") setEnvioAberturaInicio(r.value || "");
          if (r.key === "envio_abertura_fim")    setEnvioAberturaFim(r.value    || "");
          if (r.key === "banner_envio_visivel")  setBannerEnvioVisivel(r.value !== "false");
        });
      });
    supabase.from("config").select("value").eq("key", "perfil_push_ativo").single()
      .then(({ data }) => { if (data) setPerfilPushAtivo(data.value !== "false"); });
    supabase.from("config").select("value").eq("key", "admin_pin").single()
      .then(({ data }) => { if (data?.value) setAdminPinStored(data.value); });
    supabase.from("cal_eventos").select("*").order("data")
      .then(({ data }) => { if (data) setCalEventos(data); });
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
      const { tab: slug } = parseUrlParts();
      if (TAB_SLUGS.includes(slug)) setTab(slug);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  function handleAdminSubTab(subTab) {
    const path = subTab === "home" ? "/admin" : `/admin/${subTab}`;
    history.replaceState(null, "", path);
  }
  function handlePerfilSubTab(subTab) {
    const path = subTab === "dados" ? "/perfil" : `/perfil/${subTab}`;
    history.replaceState(null, "", path);
  }

  function handleAdminBypass() {
    if (isAdminUser(user)) {
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
    if (user && !user.guest && !user.pre_cadastro) {
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
    if (!u.guest && !u.pre_cadastro) {
      if (!localStorage.getItem("anticeg_tutorial_v1")) setShowTutorial(true);
      if (!u.confirmado) setShowPerfilModal(true);
      const { data: notifs } = await supabase.from("notifications")
        .select("*").eq("joiner_cog", u.cog).is("read_at", null).order("created_at", { ascending: false });
      if (notifs?.length > 0) setNotificacoes(notifs);

      const { data: myReports } = await supabase.from("reports")
        .select("item_id, status").eq("joiner_cog", u.cog);
      if (myReports) setPendingReportIds(new Set(myReports.filter(r => r.status === "pendente").map(r => r.item_id)));

      const { data: allPushes } = await supabase.from("pushes").select("*").eq("active", true)
        .or(`joiner_cog.is.null,joiner_cog.eq.${u.cog}`)
        .order("created_at", { ascending: false });
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

  // ── detecta badges novos ao abrir o site (qualquer aba, não só Meu Perfil) ──
  useEffect(() => {
    if (!user || user.guest || !user.cog) return;
    let cancelled = false;
    (async () => {
      const [
        { data: itensData },
        { data: envios },
        { data: reports },
        { data: pagamentos },
        { count: multasCount },
      ] = await Promise.all([
        supabase.from("masterlist").select("ceg, nome_do_item, valor_item, frete_inter, taxa_rf, pago_item, pago_frete, pago_rf").eq("cog", user.cog),
        supabase.from("envio_solicitacoes").select("status").eq("joiner_cog", user.cog),
        supabase.from("reports").select("id").eq("joiner_cog", user.cog),
        supabase.from("pagamento_demandas").select("id").eq("joiner_cog", user.cog),
        supabase.from("multas_pagas").select("id", { count: "exact", head: true }).eq("joiner_cog", user.cog),
      ]);
      if (cancelled) return;
      const computed = computeBadges({ itens: itensData || [], envios: envios || [], pagamentos: pagamentos || [], reports: reports || [], multasPagas: multasCount || 0, cog: user.cog });
      const earnedIds = computed.filter(b => b.earned).map(b => b.id);
      const storeKey = `anticeg_badges_${user.cog}`;
      let prevSeen = null;
      try { prevSeen = JSON.parse(localStorage.getItem(storeKey)); } catch { prevSeen = null; }
      if (prevSeen === null) {
        localStorage.setItem(storeKey, JSON.stringify(earnedIds));
      } else {
        const novos = computed.filter(b => b.earned && !prevSeen.includes(b.id));
        if (novos.length) setBadgePopupQueue(q => [...q, ...novos]);
        // acumula: nunca remove badge já visto (evita popup repetido após reset do Supabase)
        const allSeen = [...new Set([...prevSeen, ...earnedIds])];
        localStorage.setItem(storeKey, JSON.stringify(allSeen));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.cog, user?.guest]);

  function handleVerCegs() {
    setUser({ guest: true });
    setItens([]);
    setTab("cegs");
    history.replaceState(null, "", "/cegs");
    setPage("portal");
  }

  if (window.location.pathname === "/this-and-that") return <ThisAndThatGallery />;

  if (!user && parseUrlParts().tab === "mercari") {
    return (
      <div style={{ background:"#131310", minHeight:"100vh" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", background:"#0D0D0D", borderBottom:"1px solid #2a2a26" }}>
          <a href="/" style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:"var(--offwhite)", textDecoration:"none", letterSpacing:2 }}>ANTI<span style={{color:"var(--laranja)"}}>CEG</span></a>
          <a href="/" style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"rgba(245,240,232,.4)", textDecoration:"none" }}>← voltar</a>
        </div>
        <MercariTab />
      </div>
    );
  }
  if (page === "landing" || !user) return <LandingPage onLogin={handleLogin} onVerCegs={handleVerCegs} />;



  const isAdmin = isAdminUser(user);

  return (
    <div>
      <AccessibilityWidget />
      {badgePopupQueue.length > 0 && (
        <NovoBadgePopup badge={badgePopupQueue[0]} onClose={() => setBadgePopupQueue(q => q.slice(1))} />
      )}
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
              Estamos atualizando os pagamentos e a base de dados. Voltaremos às 19h!
            </div>

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
      {tab !== "admin" && pushAtivos.map((p, i) => (
        <PushBanner
          key={p.id}
          push={p}
          offset={i}
          user={user}
          onOk={async () => {
            await supabase.from("push_reads").insert([{ push_id: p.id, joiner_cog: user.cog }]);
            if (p.joiner_cog) await supabase.from("pushes").delete().eq("id", p.id);
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

      <div style={{ position:"sticky", top:0, zIndex:300 }}>
        {avisoMasterlist && (
          <div style={{ background:"rgba(13,13,13,.97)", borderBottom:"1px solid rgba(186,255,57,.2)", padding:"8px 20px", display:"flex", alignItems:"center", gap:10, backdropFilter:"blur(8px)" }}>
            <span style={{ flexShrink:0, width:6, height:6, borderRadius:"50%", background:"#BAFF39", boxShadow:"0 0 6px #BAFF39" }} />
            <span style={{ flex:1, fontSize:11, color:"#BAFF39", fontFamily:"'DM Mono',monospace", letterSpacing:".04em", fontWeight:600 }}>{avisoMasterlist}</span>
            <span style={{ flexShrink:0, fontSize:9, color:"rgba(186,255,57,.35)", fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase" }}>anticeg</span>
          </div>
        )}
      <div className="topbar">
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
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
      </div>
      <div className="tabs-bar">
        <button className={`tab-btn ${tab === "masterlist" ? "active" : ""}`} onClick={() => changeTab("masterlist")}>☰ Masterlist</button>
<button className={`tab-btn ${tab === "cegs" ? "active" : ""}`} onClick={() => changeTab("cegs")}>◈ CEGs</button>
        <button className={`tab-btn ${tab === "calendario" ? "active" : ""}`} onClick={() => changeTab("calendario")}>◫ Calendário</button>
        {!user.guest && !user.pre_cadastro && <button className={`tab-btn ${tab === "perfil" ? "active" : ""}`} onClick={() => changeTab("perfil")}>⚙ Meu Perfil</button>}
        {!user.guest && !user.pre_cadastro && <button className={`tab-btn ${tab === "envio"  ? "active" : ""}`} onClick={() => changeTab("envio")}>◫ Envio Nacional</button>}
        <button className={`tab-btn ${tab === "mercari" ? "active" : ""}`} onClick={() => changeTab("mercari")}>🎌 Mercari</button>
        <button className={`tab-btn ${tab === "regras" ? "active" : ""}`} onClick={() => changeTab("regras")}>☆ Regras</button>
        {isAdminUser(user) && (
          <button className={`tab-btn ${tab === "admin" ? "active" : ""}`} onClick={() => {
            if (adminPinStored && !adminUnlocked) { setAdminPinModal(true); setAdminPinInput(""); setAdminPinError(false); }
            else { setAdminReset(v => v + 1); changeTab("admin"); }
          }}>⚙ Admin</button>
        )}
      </div>
      {tab === "masterlist" && <MasterlistTab user={user} itens={itens} onLogin={() => setPage("landing")} pushAtivos={pushAtivos} pendingReportIds={pendingReportIds} onReported={itemId => setPendingReportIds(prev => new Set([...prev, itemId]))} avisoMasterlist={avisoMasterlist} proximoEnvio={proximoEnvio} bannerEnvioVisivel={bannerEnvioVisivel} onOpenPagamentos={() => { setTab("perfil"); setOpenPagamentosSignal(s => s + 1); }} onOpenEnvio={() => setTab("envio")} />}
      {tab === "cegs" && (initCegSlug ? <CegSlugPage slug={initCegSlug} user={user} /> : <CegTab user={user} itens={itens} />)}
      {tab === "calendario" && <CalendarTab user={user} itens={itens} calEventos={calEventos} setCalEventos={setCalEventos} />}
      {!user.guest && !user.pre_cadastro && tab === "perfil" && <PerfilTab user={user} onUpdate={setUser} owner={isOwner(user)} openPagamentosSignal={openPagamentosSignal} initialSubTab={initPerfilSubTab} onSubTabChange={handlePerfilSubTab} />}
      {!user.guest && !user.pre_cadastro && tab === "envio" && <EnvioTab user={user} itens={itens} proximoEnvio={proximoEnvio} envioAberturaInicio={envioAberturaInicio} envioAberturaFim={envioAberturaFim} />}
      {tab === "mercari" && <MercariTab />}
      {tab === "regras" && <RegrasTab />}
      {tab === "admin" && isAdminUser(user) && <AdminTab owner={isOwner(user)} userCog={user?.cog || ""} resetSignal={adminReset} calEventos={calEventos} setCalEventos={setCalEventos} initialSubTab={initAdminSubTab} onSubTabChange={handleAdminSubTab} />}

      <BottomNav tab={tab} setTab={changeTab} isGuest={user.guest || user.pre_cadastro} isAdmin={isAdmin} />

      {/* Modal PIN Admin */}
      {adminPinModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }} onClick={() => setAdminPinModal(false)}>
          <div style={{ background:"#111", border:"1px solid rgba(245,240,232,.12)", borderRadius:14, padding:"32px 28px", width:"min(300px, calc(100% - 32px))", display:"flex", flexDirection:"column", gap:16 }} onClick={e => e.stopPropagation()}>
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
