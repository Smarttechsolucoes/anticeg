// Uso único: cria o formulário "ODD & FRESH POP-UP" (aba, painel admin, lista de pré-venda) e
// ensina o WaveMakerTab a mostrar preço "a definir" e itens com tipos. Aplica sobre src/App.jsx.
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

// ---------- 1) configuração do formulário ----------
rep(`// PROMO 13 — itens do Paper Tale`, `// ODD & FRESH POP-UP — itens do pop-up, valores ainda a definir. Itens com "tipos" são escolhidos por tipo.
const ODD_PU = "/odd-fresh-popup/";
const ODD_TIPOS_8 = ["Wolf Chan", "Leebit", "Dwaekki", "Jiniret", "Han Quokka", "BbokAri", "PuppyM", "FoxI.Ny"];
const ODD_TIPOS_9 = [...ODD_TIPOS_8, "Tasy"];
const ODD_POPUP_CFG = {
  slug: "odd-fresh-popup",
  evento: "ODD & FRESH POP-UP",
  tabelaEstoque: "odd_fresh_popup_estoque",
  titulo: "ODD & FRESH POP-UP",
  grupo: "STRAY KIDS · POP-UP",
  subtitulo: "Itens do pop-up ODD & FRESH",
  capa: "/odd-fresh/capa.jpg",
  capaAltura: 320,
  proporcao: "1/1",
  tags: ["PEDIDOS ATÉ 09/NOV", "VALORES A DEFINIR"],
  infos: ["Pedidos aceitos até: 09 de novembro", "Valores a definir", "Roupas: tamanho único (as medidas ainda não foram disponibilizadas)"],
  box: null,
  itens: [
    { id: "HOODIE", foto: ODD_PU + "hoodie.png", preco: null, nota: "Tamanho único" },
    { id: "LONG SLEEVE", foto: ODD_PU + "long-sleeve.png", preco: null, nota: "Tamanho único" },
    { id: "T-SHIRT SEOUL VER.", foto: ODD_PU + "t-shirt-seoul-ver.png", preco: null, nota: "Tamanho único" },
    { id: "SWEAT PANTS", foto: ODD_PU + "sweat-pants.png", preco: null, nota: "Tamanho único" },
    { id: "WINDBREAKER", foto: ODD_PU + "windbreaker.png", preco: null, nota: "Tamanho único" },
    { id: "BALL CAP SEOUL VER.", foto: ODD_PU + "ball-cap-seoul-ver.png", preco: null },
    { id: "BANDANA SEOUL VER.", foto: ODD_PU + "bandana-seoul-ver.png", preco: null },
    { id: "TOTE BAG", foto: ODD_PU + "tote-bag.png", preco: null },
    { id: "POSTER BOOK", foto: ODD_PU + "poster-book.png", preco: null },
    { id: "PHOTO SET", foto: ODD_PU + "photo-set.png", preco: null, tipos: ODD_TIPOS_8 },
    { id: "ACRYLIC STOPPER", foto: ODD_PU + "acrylic-stopper.png", preco: null, tipos: ODD_TIPOS_8 },
    { id: "PHOTOCARD HOLDER SET", foto: ODD_PU + "photocard-holder-set.png", preco: null, tipos: ODD_TIPOS_8 },
    { id: "SKZOO BOWL", foto: ODD_PU + "skzoo-bowl.png", preco: null, tipos: ODD_TIPOS_8 },
    { id: "SKZOO CAN BADGE HOLDER SET", foto: ODD_PU + "skzoo-can-badge-holder-set.png", preco: null, tipos: ODD_TIPOS_8 },
    { id: "SKZOO CHARM HOOK", foto: ODD_PU + "skzoo-charm-hook.png", preco: null, tipos: ODD_TIPOS_8 },
    { id: "SKZOO FIGURE PHONE STAND", foto: ODD_PU + "skzoo-figure-phone-stand.png", preco: null, tipos: ODD_TIPOS_8 },
    { id: "SKZOO FIGURE TUMBLER", foto: ODD_PU + "skzoo-figure-tumbler.png", preco: null, tipos: ODD_TIPOS_8 },
    { id: "SKZOO MOOD LAMP", foto: ODD_PU + "skzoo-mood-lamp.png", preco: null, tipos: ODD_TIPOS_8 },
    { id: "SKZOO PLUSH MINI CAKE VER.", foto: ODD_PU + "skzoo-plush-mini-cake-ver.png", preco: null, tipos: ODD_TIPOS_8 },
    { id: "CAKE POUCH", foto: ODD_PU + "cake-pouch.png", preco: null, tipos: ODD_TIPOS_9 },
    { id: "SCRUBBER", foto: ODD_PU + "scrubber.png", preco: null, tipos: ODD_TIPOS_9 },
    { id: "RUG", foto: ODD_PU + "rug.png", preco: null, tipos: ODD_TIPOS_9 },
    { id: "SKZOO SECRET MINI CHARM", foto: ODD_PU + "skzoo-secret-mini-charm.png", preco: null, nota: "Aleatório: 1 de 8" },
  ],
  kits: [],
  get fechado() { return new Date() > ODD_POPUP_PRAZO; },
};
const ODD_POPUP_PRAZO = new Date("2026-11-09T23:59:59-03:00");

// PROMO 13 — itens do Paper Tale`);

// ---------- 2) WaveMakerTab: preço a definir + tipos ----------
rep("  const fmtPreco = n => `R$${n}`;\n  const [modalidade, setModalidade] = useState(null);",
    "  const fmtPreco = n => n == null ? \"a definir\" : `R$${n}`;\n  const [modalidade, setModalidade] = useState(null);");
rep("  const ITENS_WM = cfg.itens;\n", "  const ITENS_WM = cfg.itens;\n  // item pelo id; itens com tipos são guardados como \"ITEM - TIPO\"\n  const achaItem = id => ITENS_WM.find(x => x.id === id || (x.tipos && id.startsWith(x.id + \" - \")));\n");
rep("          const sel = itensSel.includes(it.id);\n", "          const sel = it.tipos ? itensSel.some(x => x.startsWith(it.id + \" - \")) : itensSel.includes(it.id);\n");
// nota (tamanho único, aleatório) logo abaixo do preço do item solto
rep(`{fmtPreco(it.preco)}</div>
                {!indisp && rest !== null && (`, `{fmtPreco(it.preco)}</div>
                {it.nota && <div style={{ fontFamily:mono, fontSize:9, color:"rgba(245,240,232,.45)", letterSpacing:".3px", marginTop:2 }}>{it.nota}</div>}
                {!indisp && rest !== null && (`);
// chips de tipo no lugar do botão SELECIONAR
const ancora = `<button onClick={() => { setModalidade("ITENS SOLTOS"); toggleItem(it.id); }}`;
const iA = s.indexOf(ancora);
if (iA < 0 || s.indexOf(ancora, iA + 1) >= 0) throw new Error("ancora botão item solto");
const iT = s.lastIndexOf("{indisp ? (", iA);
if (iT < 0 || iA - iT > 900) throw new Error("ternário indisp do item solto");
const chips = `{it.tipos ? (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                    {it.tipos.map(t => {
                      const tid = it.id + " - " + t;
                      const on = itensSel.includes(tid);
                      const r = restante(tid);
                      const off = r !== null && r <= 0;
                      return (
                        <button key={t} disabled={off} onClick={() => { setModalidade("ITENS SOLTOS"); toggleItem(tid); }}
                          style={{ border:\`1px solid \${on?"var(--lilas)":"rgba(201,168,240,.3)"}\`, borderRadius:6, padding:"4px 7px", background:on?"var(--lilas)":"transparent", color:on?"#000":off?"rgba(245,240,232,.25)":"rgba(201,168,240,.85)", fontFamily:mono, fontSize:9, fontWeight:700, cursor:off?"not-allowed":"pointer", textDecoration:off?"line-through":"none" }}>
                          {on ? "✓ " : ""}{t}
                        </button>
                      );
                    })}
                  </div>
                ) : indisp ? (`;
s = s.slice(0, iT) + chips + s.slice(iT + "{indisp ? (".length);

// resumo do pedido
rep(`                const it = ITENS_WM.find(x => x.id === id);
                return it ? (`, `                const it = achaItem(id);
                return it ? (`);
rep(`<span style={{ fontFamily:mono, fontSize:11, color:"var(--offwhite)" }}>{it.id}</span>
                    <span style={{ fontFamily:mono, fontSize:11, color:"var(--laranja)", fontWeight:700 }}>{fmtPreco(it.preco)}</span>`,
    `<span style={{ fontFamily:mono, fontSize:11, color:"var(--offwhite)" }}>{id}</span>
                    <span style={{ fontFamily:mono, fontSize:11, color:"var(--laranja)", fontWeight:700 }}>{fmtPreco(it.preco)}</span>`);
rep(`const subtotal = itensSel.reduce((s,id) => { const it = ITENS_WM.find(x => x.id === id); return s + (it ? it.preco : 0); }, 0) * qtdEf;`,
    `const semPreco = itensSel.some(id => achaItem(id)?.preco == null);
                const subtotal = itensSel.reduce((s,id) => { const it = achaItem(id); return s + (it ? (it.preco ?? 0) : 0); }, 0) * qtdEf;`);
rep("{cfg.desconto ? fmtReais(total) : `R$${total}`}", "{semPreco ? \"a definir\" : cfg.desconto ? fmtReais(total) : `R$${total}`}");

// admin: itens com tipos também ganham foto/preço pelo nome composto
rep("  const WM_ITENS = Object.fromEntries(cfg.itens.map(x => [x.id, { ...x, preco: comDesconto(cfg, x.preco) }]));",
    "  const WM_ITENS = Object.fromEntries(cfg.itens.flatMap(x => (x.tipos ? x.tipos.map(t => [x.id + \" - \" + t, x]) : [[x.id, x]])).map(([k, x]) => [k, { ...x, preco: comDesconto(cfg, x.preco) }]));");

// ---------- 3) ligações no site ----------
rep("  const [promo13Count,     setPromo13Count]     = useState(0);\n",
    "  const [promo13Count,     setPromo13Count]     = useState(0);\n  const [oddPopupCount,   setOddPopupCount]   = useState(0);\n");
rep(`    supabase.from("formulario_pedidos").select("id", { count: "exact", head: true }).eq("evento", PROMO13_CFG.evento).eq("status", "pendente")
      .then(({ count }) => { if (count) setPromo13Count(count); });`, `    supabase.from("formulario_pedidos").select("id", { count: "exact", head: true }).eq("evento", PROMO13_CFG.evento).eq("status", "pendente")
      .then(({ count }) => { if (count) setPromo13Count(count); });
    supabase.from("formulario_pedidos").select("id", { count: "exact", head: true }).eq("evento", ODD_POPUP_CFG.evento).eq("status", "pendente")
      .then(({ count }) => { if (count) setOddPopupCount(count); });`);
rep("PT_CFG.evento, ODD_CFG.evento, PROMO13_CFG.evento])", "PT_CFG.evento, ODD_CFG.evento, PROMO13_CFG.evento, ODD_POPUP_CFG.evento])");
rep("oddFreshCount + promo13Count + smolmerchCount)}", "oddFreshCount + promo13Count + oddPopupCount + smolmerchCount)}");
rep(`                { evento:PROMO13_CFG.evento,           label:PROMO13_CFG.titulo, tab:"promo-13-admin", cor:"rgba(201,168,240,.85)", icon:"🏷️" },`,
    `                { evento:PROMO13_CFG.evento,           label:PROMO13_CFG.titulo, tab:"promo-13-admin", cor:"rgba(201,168,240,.85)", icon:"🏷️" },
                { evento:ODD_POPUP_CFG.evento,         label:ODD_POPUP_CFG.titulo, tab:"odd-fresh-popup-admin", cor:"rgba(201,168,240,.85)", icon:"🍋" },`);
rep(`"odd-fresh-admin","promo-13-admin","smolmerch"].includes(adminMainTab)`, `"odd-fresh-admin","promo-13-admin","odd-fresh-popup-admin","smolmerch"].includes(adminMainTab)`);
rep(`"promo-13-admin":PROMO13_CFG.titulo, "smolmerch":"Smol Merch"`, `"promo-13-admin":PROMO13_CFG.titulo, "odd-fresh-popup-admin":ODD_POPUP_CFG.titulo, "smolmerch":"Smol Merch"`);
rep(`      {adminMainTab === "promo-13-admin"    && <AdminWaveMaker cfg={PROMO13_CFG} onCountChange={setPromo13Count} />}`,
    `      {adminMainTab === "promo-13-admin"    && <AdminWaveMaker cfg={PROMO13_CFG} onCountChange={setPromo13Count} />}
      {adminMainTab === "odd-fresh-popup-admin" && <AdminWaveMaker cfg={ODD_POPUP_CFG} onCountChange={setOddPopupCount} />}`);
rep("oddFreshCount={oddFreshCount} promo13Count={promo13Count} smolmerchCount", "oddFreshCount={oddFreshCount} promo13Count={promo13Count} oddPopupCount={oddPopupCount} smolmerchCount");
rep("oddFreshCount, promo13Count, smolmerchCount, dropsStats })", "oddFreshCount, promo13Count, oddPopupCount, smolmerchCount, dropsStats })");
rep(`    "promo-13-admin":    { tabela:"formulario_pedidos", evento:PROMO13_CFG.evento,          linhas:p => linhasForm(PROMO13_CFG, p) },`,
    `    "promo-13-admin":    { tabela:"formulario_pedidos", evento:PROMO13_CFG.evento,          linhas:p => linhasForm(PROMO13_CFG, p) },
    "odd-fresh-popup-admin": { tabela:"formulario_pedidos", evento:ODD_POPUP_CFG.evento,       linhas:p => linhasForm(ODD_POPUP_CFG, p) },`);
rep(`evento:PROMO13_CFG.evento , aberto:true },`, `evento:PROMO13_CFG.evento , aberto:true },
    { id:"odd-fresh-popup-admin", label:ODD_POPUP_CFG.titulo, icon:"🍋", count:oddPopupCount, tipo:"forms",    cor:"var(--lilas)",         evento:ODD_POPUP_CFG.evento , aberto:agora <= ODD_POPUP_PRAZO },`);

// lista de pré-venda (primeira da lista)
rep(`  const formularios = [
    {
      key: "promo-13",`, `  const formularios = [
    {
      key: "odd-fresh-popup",
      ativo: true,
      fechado: now > ODD_POPUP_PRAZO,
      cor: "lilas",
      titulo: "ODD & FRESH POP-UP",
      subtitulo: "Stray Kids Pop-up · itens do pop-up",
      url: null,
      tab: "odd-fresh-popup",
      img: ODD_POPUP_CFG.capa,
      tags: ["Pedidos até 09/11", "Valores a definir"],
      info: "Roupas em tamanho único · escolha o tipo de cada item no formulário",
    },
    {
      key: "promo-13",`);
rep(`"odd-fresh","promo-13"];`, `"odd-fresh","promo-13","odd-fresh-popup"];`);
rep(`          {tab === "promo-13" && <WaveMakerTab user={user} cfg={PROMO13_CFG} />}`, `          {tab === "promo-13" && <WaveMakerTab user={user} cfg={PROMO13_CFG} />}
          {tab === "odd-fresh-popup" && <WaveMakerTab user={user} cfg={ODD_POPUP_CFG} />}`);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
