// ── Catálogo do formulário de photocards ─────────────────────────────────────
// Fotos em /public/photocard. Preço null = ainda a definir (aparece "preço em breve" e não soma no total).
export const fotoPc = arq => `/photocard/${arq}`;

const MEMBROS = ["Bang Chan", "Lee Know", "Changbin", "Hyunjin", "Han", "Felix", "Seungmin", "I.N"];
const SKZOO   = ["Wolf Chan", "Leebit", "Dwaekki", "Foxl.ny", "Han Quokka", "Bbokari", "PuppyM", "Jiniret"];

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const porNome = (idProduto, nomes) => nomes.map(n => ({ id: `${idProduto}-${slug(n)}`, label: n, preco: null }));
// UNIT: cada dupla/trio é uma opção, R$7
const PRECO_UNIT = 7;
const unit = (idProduto, combos) => combos.map(c => ({ id: `${idProduto}-${slug(c)}`, label: c, preco: PRECO_UNIT }));

export const PHOTOCARD_PRODUTOS = [
  { id: "ate-boom-unit",      nome: "ATE — BOOM UNIT",          foto: "ate-boom-unit.png",         opcoes: unit("ate-boom-unit", ["Bang Chan + Changbin","I.N + Lee Know","Seungmin + Hyunjin","Felix + Han"]) },
  { id: "ate-chk-chk-unit",   nome: "ATE — CHK CHK UNIT",       foto: "ate-chk-chk-unit.png",      opcoes: unit("ate-chk-chk-unit", ["Bang Chan + Felix","Hyunjin + Lee Know","I.N + Changbin","Han + Seungmin"]) },
  { id: "hop-limited-unit",   nome: "HOP — LIMITED UNIT",       foto: "hop-limited-unit.png",      opcoes: unit("hop-limited-unit", ["Bang Chan + Felix","Lee Know + Seungmin","Changbin + Hyunjin","I.N + Han"]) },
  { id: "hop-standard-unit",  nome: "HOP — STANDARD UNIT",      foto: "hop-standard-unit.png",     opcoes: unit("hop-standard-unit", ["Bang Chan + Lee Know","Felix + Changbin","Hyunjin + Han","I.N + Seungmin"]) },
  { id: "karma-limited-unit", nome: "KARMA — LIMITED UNIT",     foto: "karma-limited-unit.png",    opcoes: unit("karma-limited-unit", ["Lee Know + Changbin + Bang Chan","Hyunjin + I.N","Felix + Han + Seungmin"]) },
  { id: "rockstar-unit",      nome: "ROCKSTAR — UNIT",          foto: "rockstar-unit.png",         opcoes: unit("rockstar-unit", ["Bang Chan + Changbin","Felix + Lee Know","Han + Hyunjin","Seungmin + I.N"]) },
  { id: "hop-pc",             nome: "HOP — PC",                 foto: "hop-pc.png",                opcoes: porNome("hop-pc", MEMBROS) },
  { id: "hop-pc-random",      nome: "HOP — PC RANDOM",          foto: "hop-pc-random.png",         opcoes: porNome("hop-pc-random", MEMBROS) },
  { id: "hop-set",            nome: "HOP — SET",                foto: "hop-set.png",               opcoes: porNome("hop-set", MEMBROS) },
  { id: "hop-monochrome",     nome: "HOP — MONOCHROME VER.",    foto: "monochrome-ver-hop.png",    opcoes: porNome("hop-monochrome", MEMBROS) },
  { id: "hop-pc-album",       nome: "HOP — PC ALBUM VER.",      foto: "pc-album-ver-hop.png",      opcoes: porNome("hop-pc-album", MEMBROS) },
  { id: "hop-pob-pc-album",   nome: "HOP — POB PC ALBUM VER.",  foto: "pob-pc-album-ver-hop.png",  opcoes: porNome("hop-pob-pc-album", MEMBROS) },
  { id: "limited-pc-album",   nome: "LIMITED PC ALBUM SET",     foto: "limited-pc-album-set.png",  opcoes: porNome("limited-pc-album", MEMBROS) },
  { id: "bdm-pob",            nome: "BDM — POB",                foto: "bdm-pob.png",               opcoes: porNome("bdm-pob", MEMBROS) },
  { id: "tin-case-skzoo",     nome: "TIN CASE SKZOO",           foto: "tin-case-skzoo.png",        opcoes: porNome("tin-case-skzoo", SKZOO) },
];

export const PHOTOCARD_CFG = {
  tabela: "pedidos_photocard", pasta: "photocard", produto: "PHOTOCARDS",
  titulo: "PHOTOCARDS", sub: "Stray Kids · ATE · HOP · KARMA · ROCKSTAR · BDM · Tin Case SKZOO",
  deadline: null, pedidosAte: null, pagarAte: null,
  // rascunho: o formulário ainda não recebe pedidos
  bloqueado: true,
  fotoGrande: true, // mostra a foto inteira (sem cortar) em cada produto
  pagamentoAgora: false,
  avisos: [
    "Formulário **em montagem**: preços e prazos serão informados em breve.",
    "Ao fechar o pedido, ele **não poderá ser cancelado**.",
  ],
};
