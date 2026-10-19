// Uso único: cria o formulário SUIATSU (Stray Kids JAPAN 4th Mini Album) reaproveitando o WaveMakerTab. Aplica sobre src/App.jsx.
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "src", "App.jsx");
const raw = fs.readFileSync(p, "utf8");
const CR = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
function rep(a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(n + " :: " + a.slice(0, 80));
  s = s.replace(a, () => b);
}

// proporção da foto por item (capas em pé x capas quadradas)
rep(`aspectRatio:cfg.proporcao || "2/3", objectFit:"cover", display:"block", opacity: indisp ? .3 : (sel || it.tipos)?1:.75`,
    `aspectRatio:it.proporcao || cfg.proporcao || "2/3", objectFit:"cover", display:"block", opacity: indisp ? .3 : (sel || it.tipos)?1:.75`);

// configuração
rep(`// PROMO 13 — itens do Paper Tale`, `// SUIATSU — Stray Kids JAPAN 4th Mini Album. Lançamento 25/11/2026, envio só em janeiro de 2027.
const SU = "/suiatsu/";
const SUIATSU_CFG = {
  slug: "suiatsu",
  evento: "SUIATSU",
  tabelaEstoque: "suiatsu_estoque",
  titulo: "SUIATSU",
  grupo: "STRAY KIDS · JAPAN 4TH MINI ALBUM",
  subtitulo: "『SUIATSU』 — lançamento em 25 de novembro de 2026",
  capa: null,
  proporcao: "1/1",
  tags: ["LANÇAMENTO 25/NOV/2026", "ENVIO EM JAN/2027", "VALOR APENAS DO ÁLBUM"],
  infos: ["Lançamento: 25 de novembro de 2026", "Envio somente em janeiro de 2027", "Os valores NÃO incluem POB de loja: valor apenas do álbum"],
  box: null,
  itens: [
    { id: "EDIÇÃO LIMITADA A", foto: SU + "limitada-a.jpg", preco: 190, proporcao: "3/4" },
    { id: "EDIÇÃO LIMITADA B", foto: SU + "limitada-b.jpg", preco: 155, proporcao: "3/4" },
    { id: "EDIÇÃO REGULAR", foto: SU + "regular.jpg", preco: 110, proporcao: "3/4" },
    { id: "EDIÇÃO EXCLUSIVA DO FÃ-CLUBE", foto: SU + "fa-clube.svg", preco: 120 },
    { id: "EDIÇÃO SOLO BANG CHAN", foto: SU + "bang-chan.jpg", preco: 125 },
    { id: "EDIÇÃO SOLO LEE KNOW", foto: SU + "lee-know.jpg", preco: 125 },
    { id: "EDIÇÃO SOLO CHANGBIN", foto: SU + "changbin.jpg", preco: 125 },
    { id: "EDIÇÃO SOLO HYUNJIN", foto: SU + "hyunjin.jpg", preco: 125 },
    { id: "EDIÇÃO SOLO HAN", foto: SU + "han.jpg", preco: 125 },
    { id: "EDIÇÃO SOLO FELIX", foto: SU + "felix.jpg", preco: 125 },
    { id: "EDIÇÃO SOLO SEUNGMIN", foto: SU + "seungmin.jpg", preco: 125 },
    { id: "EDIÇÃO SOLO I.N", foto: SU + "in.jpg", preco: 125 },
  ],
  kits: [],
};

// PROMO 13 — itens do Paper Tale`);

// ligações no site
rep(`  const [oddPopupCount,   setOddPopupCount]   = useState(0);\n`, `  const [oddPopupCount,   setOddPopupCount]   = useState(0);\n  const [suiatsuCount,    setSuiatsuCount]    = useState(0);\n`);
rep(`      .then(({ count }) => { if (count) setOddPopupCount(count); });`, `      .then(({ count }) => { if (count) setOddPopupCount(count); });
    supabase.from("formulario_pedidos").select("id", { count: "exact", head: true }).eq("evento", SUIATSU_CFG.evento).eq("status", "pendente")
      .then(({ count }) => { if (count) setSuiatsuCount(count); });`);
rep(`PROMO13_CFG.evento, ODD_POPUP_CFG.evento])`, `PROMO13_CFG.evento, ODD_POPUP_CFG.evento, SUIATSU_CFG.evento])`);
rep(`oddPopupCount + smolmerchCount)}`, `oddPopupCount + suiatsuCount + smolmerchCount)}`);
rep(`                { evento:ODD_POPUP_CFG.evento,         label:ODD_POPUP_CFG.titulo, tab:"odd-fresh-popup-admin", cor:"rgba(201,168,240,.85)", icon:"🍋" },`,
    `                { evento:ODD_POPUP_CFG.evento,         label:ODD_POPUP_CFG.titulo, tab:"odd-fresh-popup-admin", cor:"rgba(201,168,240,.85)", icon:"🍋" },
                { evento:SUIATSU_CFG.evento,           label:SUIATSU_CFG.titulo, tab:"suiatsu-admin", cor:"rgba(201,168,240,.85)", icon:"💿" },`);
rep(`"odd-fresh-popup-admin","smolmerch"].includes(adminMainTab)`, `"odd-fresh-popup-admin","suiatsu-admin","smolmerch"].includes(adminMainTab)`);
rep(`"odd-fresh-popup-admin":ODD_POPUP_CFG.titulo, "smolmerch":"Smol Merch"`, `"odd-fresh-popup-admin":ODD_POPUP_CFG.titulo, "suiatsu-admin":SUIATSU_CFG.titulo, "smolmerch":"Smol Merch"`);
rep(`      {adminMainTab === "odd-fresh-popup-admin" && <AdminWaveMaker cfg={ODD_POPUP_CFG} onCountChange={setOddPopupCount} />}`,
    `      {adminMainTab === "odd-fresh-popup-admin" && <AdminWaveMaker cfg={ODD_POPUP_CFG} onCountChange={setOddPopupCount} />}
      {adminMainTab === "suiatsu-admin" && <AdminWaveMaker cfg={SUIATSU_CFG} onCountChange={setSuiatsuCount} />}`);
rep(`oddPopupCount={oddPopupCount} smolmerchCount`, `oddPopupCount={oddPopupCount} suiatsuCount={suiatsuCount} smolmerchCount`);
rep(`oddPopupCount, smolmerchCount, dropsStats })`, `oddPopupCount, suiatsuCount, smolmerchCount, dropsStats })`);
rep(`    "odd-fresh-popup-admin": { tabela:"formulario_pedidos", evento:ODD_POPUP_CFG.evento,       linhas:p => linhasForm(ODD_POPUP_CFG, p) },`,
    `    "odd-fresh-popup-admin": { tabela:"formulario_pedidos", evento:ODD_POPUP_CFG.evento,       linhas:p => linhasForm(ODD_POPUP_CFG, p) },
    "suiatsu-admin": { tabela:"formulario_pedidos", evento:SUIATSU_CFG.evento,                    linhas:p => linhasForm(SUIATSU_CFG, p) },`);
rep(`evento:ODD_POPUP_CFG.evento , aberto:agora <= ODD_POPUP_PRAZO },`, `evento:ODD_POPUP_CFG.evento , aberto:agora <= ODD_POPUP_PRAZO },
    { id:"suiatsu-admin", label:SUIATSU_CFG.titulo, icon:"💿", count:suiatsuCount, tipo:"forms", cor:"var(--lilas)", evento:SUIATSU_CFG.evento , aberto:true },`);
rep(`  const formularios = [
    {
      key: "odd-fresh-popup",`, `  const formularios = [
    {
      key: "suiatsu",
      ativo: true,
      fechado: false,
      cor: "lilas",
      titulo: "SUIATSU",
      subtitulo: "Stray Kids · JAPAN 4th Mini Album",
      url: null,
      tab: "suiatsu",
      img: "/suiatsu/limitada-a.jpg",
      tags: ["Lançamento 25/11", "Envio em janeiro/2027"],
      info: "Edições Limitada A e B, Regular, Fã-clube e 8 edições Solo",
    },
    {
      key: "odd-fresh-popup",`);
rep(`"odd-fresh","promo-13","odd-fresh-popup"];`, `"odd-fresh","promo-13","odd-fresh-popup","suiatsu"];`);
rep(`          {tab === "odd-fresh-popup" && <WaveMakerTab user={user} cfg={ODD_POPUP_CFG} />}`, `          {tab === "odd-fresh-popup" && <WaveMakerTab user={user} cfg={ODD_POPUP_CFG} />}
          {tab === "suiatsu" && <WaveMakerTab user={user} cfg={SUIATSU_CFG} />}`);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
