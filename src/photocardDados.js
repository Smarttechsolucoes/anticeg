// ── Catálogo do formulário de photocards ─────────────────────────────────────
// Fotos em /public/photocard. Preço null = ainda a definir (aparece "preço em breve" e não soma no total).
export const fotoPc = arq => `/photocard/${arq}`;

const MEMBROS = ["Bang Chan", "Lee Know", "Changbin", "Hyunjin", "Han", "Felix", "Seungmin", "I.N"];
const SKZOO   = ["Wolf Chan", "Leebit", "Dwaekki", "Foxl.ny", "Han Quokka", "Bbokari", "PuppyM", "Jiniret"];

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const porNome = (idProduto, nomes, preco = null) => nomes.map(n => ({ id: `${idProduto}-${slug(n)}`, label: n, preco }));
// UNIT: cada dupla/trio é uma opção, R$7
const PRECO_UNIT = 7;
const AVISOS_UNIT = ["Não precisa fechar set: pode pedir só as duplas/trios que quiser.", "Se chegarmos a 30 unidades de photocard de unit, o valor diminui."];
const unit = (idProduto, combos) => combos.map(c => ({ id: `${idProduto}-${slug(c)}`, label: c, preco: PRECO_UNIT }));

export const PHOTOCARD_PRODUTOS = [
  { id: "ate-boom-unit",      nome: "ATE — BOOM UNIT",          foto: "ate-boom-unit.png",         avisos: AVISOS_UNIT, opcoes: unit("ate-boom-unit", ["Bang Chan + Changbin","I.N + Lee Know","Seungmin + Hyunjin","Felix + Han"]) },
  { id: "ate-chk-chk-unit",   nome: "ATE — CHK CHK UNIT",       foto: "ate-chk-chk-unit.png",      avisos: AVISOS_UNIT, opcoes: unit("ate-chk-chk-unit", ["Bang Chan + Felix","Hyunjin + Lee Know","I.N + Changbin","Han + Seungmin"]) },
  { id: "hop-limited-unit",   nome: "HOP — LIMITED UNIT",       foto: "hop-limited-unit.png",      avisos: AVISOS_UNIT, opcoes: unit("hop-limited-unit", ["Bang Chan + Felix","Lee Know + Seungmin","Changbin + Hyunjin","I.N + Han"]) },
  { id: "hop-standard-unit",  nome: "HOP — STANDARD UNIT",      foto: "hop-standard-unit.png",     avisos: AVISOS_UNIT, opcoes: unit("hop-standard-unit", ["Bang Chan + Lee Know","Felix + Changbin","Hyunjin + Han","I.N + Seungmin"]) },
  { id: "karma-limited-unit", nome: "KARMA — LIMITED UNIT",     foto: "karma-limited-unit.png",    avisos: AVISOS_UNIT, opcoes: unit("karma-limited-unit", ["Lee Know + Changbin + Bang Chan","Hyunjin + I.N","Felix + Han + Seungmin"]) },
  { id: "rockstar-unit",      nome: "ROCKSTAR — UNIT",          foto: "rockstar-unit.png",         avisos: AVISOS_UNIT, opcoes: unit("rockstar-unit", ["Bang Chan + Changbin","Felix + Lee Know","Han + Hyunjin","Seungmin + I.N"]) },
  { id: "hop-pc",             nome: "Standard Album Photocard HOP", foto: "hop-pc.png",                opcoes: porNome("hop-pc", MEMBROS, 15) },
  { id: "hop-pc-random",      nome: "HOP — PC RANDOM",          foto: "hop-pc-random.png",         avisos: ["Hyunjin só sai se fechar o set OT8 (os 8 membros)."], opcoes: porNome("hop-pc-random", MEMBROS, 20).map(o => o.label === "Hyunjin" ? { ...o, exigeTodos: true, exigeTodosTexto: "só sai fechando o set OT8" } : o) },
  { id: "hop-set",            nome: "HOP — SET",                foto: "hop-set.png",               opcoes: [{ id: "hop-set-ot8", label: "OT8 (set completo)", preco: 50 }, ...porNome("hop-set", MEMBROS, 7)], avisos: ["Precisa sair OT8: o set só sai se os 8 membros forem fechados."] },
  { id: "hop-monochrome",     nome: "HOP — MONOCHROME VER.",    foto: "monochrome-ver-hop.png",    avisos: ["Seungmin só sai se fechar o set OT8 (os 8 membros)."], opcoes: porNome("hop-monochrome", MEMBROS, 15).map(o => o.label === "Seungmin" ? { ...o, exigeTodos: true, exigeTodosTexto: "só sai fechando o set OT8" } : o) },
  { id: "hop-pc-album",       nome: "HOP — PC ALBUM VER.",      foto: "pc-album-ver-hop.png",      opcoes: porNome("hop-pc-album", MEMBROS, 15) },
  { id: "hop-pob-pc-album",   nome: "HOP — POB PC ALBUM VER.",  foto: "pob-pc-album-ver-hop.png",  avisos: ["Han só sai se fechar o set OT8 (os 8 membros)."], opcoes: porNome("hop-pob-pc-album", MEMBROS, 15).map(o => o.label === "Han" ? { ...o, exigeTodos: true, exigeTodosTexto: "só sai fechando o set OT8" } : o) },
  { id: "limited-pc-album",   nome: "LIMITED PC ALBUM SET",     foto: "limited-pc-album-set.png",  maxPorOpcao: 3, todasOuNenhuma: true, avisos: ["Os 5 cards saem juntos (set de R$125).", "Disponível: 3 de cada card."], opcoes: porNome("limited-pc-album", ["Bang Chan", "Lee Know", "Hyunjin", "Han", "Felix"], 25) },
  { id: "bdm-pob",            nome: "BDM — POB",                foto: "bdm-pob.png",               maxPorOpcao: 1, todasOuNenhuma: true, avisos: ["Os 3 membros saem juntos: 1 set disponível (1 de cada)."], opcoes: porNome("bdm-pob", ["Lee Know", "Hyunjin", "Felix"], 50) },
  { id: "tin-case-skzoo",     nome: "TIN CASE SKZOO",           foto: "tin-case-skzoo.png",        avisos: ["Pode esgotar a qualquer momento.", "Não precisa fechar set: pode pedir só as unidades que quiser."], opcoes: porNome("tin-case-skzoo", SKZOO, 15) },
];

export const PHOTOCARD_CFG = {
  tabela: "pedidos_murce_itens", pasta: "murce-itens", produto: "MURCEKALY ITENS",
  titulo: "MURCEKALY ITENS", sub: "", selo: "",
  deadline: new Date("2026-10-28T09:00:00-03:00"), pedidosAte: "28/10 às 9h", pagarAte: null,
  grupoWhatsapp: "https://chat.whatsapp.com/Lux5FicJErLBTZPBQPJfq9",
  bloqueado: false,
  abreEm: new Date("2026-10-27T19:00:00-03:00"), abreEmRotulo: "19H", // pedidos só a partir das 19h; o botão mostra a contagem
  ocultarSeCadastrada: true, // joiner cadastrada: sem os campos de claim, nome, e-mail e @
  cabecalho: true,   // barra ANTICEG no topo
  aoVivo: true,      // abas Pedido · Ao vivo · Histórico (@ sempre como @***)
  resumoPedido: true, // lista os itens marcados embaixo, para conferência
  fotoGrande: true, // mostra a foto inteira (sem cortar) em cada produto
  pagamentoAgora: false,
  avisos: [
    "Os pedidos abrem hoje, **27 de outubro às 19h**.",
    "Alguns cards estão amarrados em set por regras de compra da seller.",
    "**CEG DEMORADA**.",
    "Pagamento imediato **APÓS a confirmação dos itens**.",
    "O formulário fecha no dia **28 de outubro às 9h da manhã** e não será reaberto novamente.",
    "O estoque é **LIMITADO** e não foi informada a quantidade de cada item: o risco de sold-out é grande.",
    "Os itens saem da **Indonésia** para o **Brasil**.",
    "Haverá **frete internacional** e **taxa da Receita Federal**.",
    "**Não haverá possibilidade de cancelar** a claim. Se estiver em dúvida, não marque.",
  ],
};
