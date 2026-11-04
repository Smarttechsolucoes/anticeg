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
    opcoes: [...opcoes("acrylic-carabiner-circle", SKZOO, 15).map(o => ({ ...o, label: `Circle — ${o.label}` })), ...opcoes("acrylic-carabiner-heart", SKZOO, 15).map(o => ({ ...o, label: `Heart — ${o.label}` }))] },
  { id: "collect-plush-case", nome: "COLLECT PLUSH CASE", foto: "COLLECT PLUSH CASE.png", avisos: ["Somente a case (sem o plush)."], opcoes: opcoes("collect-plush-case", SKZOO, 37) },
  { id: "skzoo-magnetic-holder", nome: "SKZOO MAGNETIC HOLDER", foto: "SKZOO MAGNETIC HOLDER.png", opcoes: opcoes("skzoo-magnetic-holder", SKZOO, 37) },
  { id: "skzoo-hippers", nome: "SKZOO HIPPERS — DO IT POP-UP", foto: "skzoo hippers do it pop-up.png", opcoes: opcoes("skzoo-hippers", SKZOO, 22) },
  { id: "mini-block-keyring", nome: "MINI BLOCK KEYRING", foto: "mini block keyring.png", opcoes: opcoes("mini-block-keyring", MEMBROS, 22) },
  { id: "outfit", nome: "OUTFIT (ROUPINHA DE PLUSH)", foto: "OUTFIT.jpg", opcoes: opcoes("outfit", SKZOO, 45) },
  // Itens em que a foto não mostra todos os personagens: só os disponíveis (os que aparecem com SOLD ou riscados ficaram de fora).
  { id: "sleep-mask", nome: "SLEEP MASK", foto: "SLEEP MASK.png", opcoes: opcoes("sleep-mask", ["Leebit", "Dwaekki", "Jiniret", "Han Quokka", "BbokAri", "FoxI.Ny"], 45) },
  { id: "plush-bagpack", nome: "PLUSH BAGPACK", foto: "plush bagpack.png", opcoes: opcoes("plush-bagpack", ["Wolf Chan", "Leebit", "Han Quokka", "FoxI.Ny"], 115) },
  { id: "reversible-face-pouch", nome: "REVERSIBLE FACE POUCH", foto: "REVERSIBLE face pouch.png", opcoes: opcoes("reversible-face-pouch", ["Leebit", "Dwaekki", "Jiniret", "BbokAri", "PuppyM", "FoxI.Ny"], 60) },
  // CONFIRMAR: na foto só 4 chaveiros estão sem SOLD e os plushes brancos são parecidos
  { id: "silver-keyring", nome: "SILVER KEYRING", foto: "SILVER KEYRING.png", opcoes: opcoes("silver-keyring", ["Dwaekki", "Han Quokka", "PuppyM", "FoxI.Ny"], 37) },
  { id: "skzoo-name-tag", nome: "SKZOO NAME TAG", foto: "skzoo name tag.png", opcoes: opcoes("skzoo-name-tag", ["Dwaekki", "Jiniret", "Han Quokka", "BbokAri", "PuppyM", "FoxI.Ny"], 60) },
  { id: "box-tape", nome: "BOX TAPE — STAY IN OUR LITTLE HOUSE", foto: "BOX TAPE.png", opcoes: opcoes("box-tape", ["Amarelo", "Rosa"], 10) },
  // Itens novos. Só entram os que aparecem em estoque na foto (o que está com SOLD ou ausente ficou de fora).
  { id: "standing-skzoo", nome: "STANDING SKZOO (PLUSH)", foto: "STANDING SKZOO.png", avisos: ["Na foto, o Jiniret aparece como SOLD."], opcoes: opcoes("standing-skzoo", ["Wolf Chan", "Leebit", "Dwaekki", "Han Quokka", "BbokAri", "PuppyM", "FoxI.Ny"], 60) },
  { id: "ball-cap", nome: "BALL CAP (BONÉ)", foto: "BALLCAP.png", avisos: ["Último estoque."], opcoes: opcoes("ball-cap", ["Wolf Chan", "Leebit", "Dwaekki", "Jiniret", "Han Quokka", "BbokAri", "PuppyM"], 80) },
  // CONFIRMAR: os personagens de cada beanie não estão identificados na foto; os modelos seguem a ordem da foto
  { id: "beanie", nome: "BEANIE", foto: "BEANIE.png", avisos: ["Modelos 1 a 8 na ordem da foto: da esquerda para a direita, de cima para baixo."], opcoes: opcoes("beanie", ["Modelo 1", "Modelo 2", "Modelo 3", "Modelo 4", "Modelo 5", "Modelo 6", "Modelo 7", "Modelo 8"], 65) },
  // CONFIRMAR: cores que aparecem na foto (branco, rosa e bege)
  { id: "hood-blanket-leebit", nome: "HOOD BLANKET — LEEBIT", foto: "BLANKET LEEBIT.png", opcoes: opcoes("hood-blanket-leebit", ["Branco", "Rosa", "Bege"], 110) },
  { id: "fankit-5th-gen", nome: "FANKIT 5TH GEN — OVER THE STAY RAIN", foto: "fankit 5th gen.png", opcoes: [{ id: "fankit-5th-gen", label: "Fankit", preco: 165 }] },
  { id: "force-sg-2026", nome: "FORCE — SEASON'S GREETINGS 2026 (JAPÃO)", foto: "force sg 2026.png", opcoes: [{ id: "force-sg-2026", label: "Season's Greetings", preco: 135 }] },
];

// menor e maior preço entre as opções que já têm valor
const PRECOS_PM = PROMO_MURCE_50_PRODUTOS.flatMap(p => p.opcoes.map(o => o.preco)).filter(v => typeof v === "number");
export const PROMO_MURCE_50_FAIXA = { min: Math.min(...PRECOS_PM), max: Math.max(...PRECOS_PM) };

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
