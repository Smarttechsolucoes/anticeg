// ── Catálogo do formulário PROMO-MURCE-50 (merchs da seller Murcekaly) ───────
// Fotos em public/promo-murce-50. Valores em reais, já convertidos (informados pela organização).
// preco: null = ainda a definir (aparece "preço em breve" e não soma no total). Estoque: maxTotal na opção.
// Usa o mesmo formulário e o mesmo painel do Murcekaly Itens (SmolMerchFormPage / AdminSmolMerch).
export const fotoPm = arq => `/promo-murce-50/${encodeURIComponent(arq)}`;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const opcoes = (idProduto, nomes, preco = null) => nomes.map(n => ({ id: `${idProduto}-${slug(n)}`, label: n, preco }));

const MEMBROS = ["Bang Chan", "Lee Know", "Changbin", "Hyunjin", "Han", "Felix", "Seungmin", "I.N"];
// personagens SKZOO: Wolf Chan (Bang Chan), Leebit (Lee Know), Dwaekki (Changbin), Jiniret (Hyunjin), Han Quokka (Han), BbokAri (Felix), PuppyM (Seungmin), FoxI.Ny (I.N)
const SKZOO = ["Wolf Chan", "Leebit", "Dwaekki", "Jiniret", "Han Quokka", "BbokAri", "PuppyM", "FoxI.Ny"];

export const PROMO_MURCE_50_PRODUTOS = [
  {
    id: "photocard-set", nome: "PHOTOCARD SET", foto: "PHOTOCARD SET.png",
    avisos: ["Precisa sair OT8: o set só sai se os 8 membros forem fechados."],
    opcoes: opcoes("photocard-set", MEMBROS, 30),
  },
  {
    id: "zip-hoodie-do-it", nome: "ZIP UP HOODIE — DO IT POP-UP", foto: "HOODIE DO IT.png",
    // quando a quantidade for definida, colocar maxTotal na opção (o formulário passa a mostrar "restam N" e trava quando esgotar)
    avisos: ["Estoque limitado."],
    opcoes: [{ id: "zip-hoodie-do-it", label: "Zip Up Hoodie", preco: 95 }],
  },
  { id: "acrylic-carabiner", nome: "ACRYLIC CARABINER", foto: "ACRYLIC CARABINER.png",
    opcoes: [...opcoes("acrylic-carabiner-circle", SKZOO).map(o => ({ ...o, label: `Circle — ${o.label}` })), ...opcoes("acrylic-carabiner-heart", SKZOO).map(o => ({ ...o, label: `Heart — ${o.label}` }))] },
  { id: "collect-plush-case", nome: "COLLECT PLUSH CASE", foto: "COLLECT PLUSH CASE.png", avisos: ["Somente a case (sem o plush)."], opcoes: opcoes("collect-plush-case", SKZOO) },
  { id: "skzoo-magnetic-holder", nome: "SKZOO MAGNETIC HOLDER", foto: "SKZOO MAGNETIC HOLDER.png", opcoes: opcoes("skzoo-magnetic-holder", SKZOO) },
  { id: "skzoo-hippers", nome: "SKZOO HIPPERS — DO IT POP-UP", foto: "skzoo hippers do it pop-up.png", opcoes: opcoes("skzoo-hippers", SKZOO) },
  { id: "mini-block-keyring", nome: "MINI BLOCK KEYRING", foto: "mini block keyring.png", opcoes: opcoes("mini-block-keyring", MEMBROS) },
  { id: "outfit", nome: "OUTFIT (ROUPINHA DE PLUSH)", foto: "OUTFIT.jpg", opcoes: opcoes("outfit", SKZOO) },
  // Itens em que a foto não mostra todos os personagens: só os disponíveis (os que aparecem com SOLD ou riscados ficaram de fora).
  { id: "sleep-mask", nome: "SLEEP MASK", foto: "SLEEP MASK.png", opcoes: opcoes("sleep-mask", ["Leebit", "Dwaekki", "Jiniret", "Han Quokka", "BbokAri", "FoxI.Ny"]) },
  { id: "plush-bagpack", nome: "PLUSH BAGPACK", foto: "plush bagpack.png", opcoes: opcoes("plush-bagpack", ["Wolf Chan", "Leebit", "Han Quokka", "FoxI.Ny"]) },
  { id: "reversible-face-pouch", nome: "REVERSIBLE FACE POUCH", foto: "REVERSIBLE face pouch.png", opcoes: opcoes("reversible-face-pouch", ["Leebit", "Dwaekki", "Jiniret", "BbokAri", "PuppyM", "FoxI.Ny"]) },
  // CONFIRMAR: na foto só 4 chaveiros estão sem SOLD e os plushes brancos são parecidos
  { id: "silver-keyring", nome: "SILVER KEYRING", foto: "SILVER KEYRING.png", opcoes: opcoes("silver-keyring", ["Dwaekki", "Han Quokka", "PuppyM", "FoxI.Ny"]) },
  { id: "skzoo-name-tag", nome: "SKZOO NAME TAG", foto: "skzoo name tag.png", opcoes: opcoes("skzoo-name-tag", ["Dwaekki", "Jiniret", "Han Quokka", "BbokAri", "PuppyM", "FoxI.Ny"]) },
  { id: "box-tape", nome: "BOX TAPE — STAY IN OUR LITTLE HOUSE", foto: "BOX TAPE.png", opcoes: opcoes("box-tape", ["Amarelo", "Rosa"]) },
  { id: "fankit-5th-gen", nome: "FANKIT 5TH GEN — OVER THE STAY RAIN", foto: "fankit 5th gen.png", opcoes: [{ id: "fankit-5th-gen", label: "Fankit", preco: null }] },
  { id: "force-sg-2026", nome: "FORCE — SEASON'S GREETINGS 2026 (JAPÃO)", foto: "force sg 2026.png", opcoes: [{ id: "force-sg-2026", label: "Season's Greetings", preco: null }] },
];

export const PROMO_MURCE_50_CFG = {
  tabela: "pedidos_promo_murce_50", pasta: "promo-murce-50", produto: "PROMO-MURCE-50",
  titulo: "PROMO-MURCE-50", sub: "",
  deadline: null, pedidosAte: null, pagarAte: null,
  grupoWhatsapp: "https://chat.whatsapp.com/Lux5FicJErLBTZPBQPJfq9",
  // true = "em breve": a página mostra os itens, mas não aceita pedido. Trocar para false quando abrir.
  bloqueado: true,
  itensComFoto: true,        // painel admin: visão "Itens" com foto, nome e quantidade pedida
  ocultarSeCadastrada: true, // joiner cadastrada: sem os campos de claim, nome, e-mail e @
  cabecalho: true,           // barra ANTICEG no topo
  aoVivo: true,              // abas Pedido · Ao vivo · Histórico (@ sempre como @***)
  resumoPedido: true,        // lista os itens marcados embaixo, para conferência
  fotoGrande: true,          // mostra a foto inteira (sem cortar) em cada produto
  pagamentoAgora: false,     // só "pagar depois"
  // **texto** = negrito
  avisos: [
    "Prazo de pagamento: **imediato após a confirmação da seller**.",
  ],
};
