// ── Formulário FANS PROMO (itens da loja oficial de fãs, compra por conta da organização) ─────────────
// Pagamento IMEDIATO (PIX ou cartão). Se o item não puder ser comprado, o valor é reembolsado na hora.
// Usa o mesmo formulário e o mesmo painel dos outros forms de loja (SmolMerchFormPage / AdminSmolMerch).
// preco: null = a definir (aparece "preço em breve" e não soma no total). Preencher em reais antes de abrir.
// Nomes que terminam em "…" estavam cortados no print: completar quando houver o nome inteiro.
// Fotos: public/fans-promo/<id>.jpg (sem a foto, o card aparece só com o nome).
export const fotoFans = arq => `/fans-promo/${encodeURIComponent(arq)}`;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// 1ª parte: itens sem preço no print (lançamentos)
// 2ª parte: itens em promoção no print
const NOMES = [
  "SKZOO PLUSH 10CM Ver. - SKZ 5'CLOCK",
  "SPECIAL TRADING CARD - SKZ 5'CLOCK",
  "SKZOO SECRET BOUCLE CAN BADGE - SKZ …",
  "SECRET ACRYLIC STAND - SKZ 5'CLOCK",
  "SPECIAL TRADING CARD - celebrATE",
  "SKZOO POWER BANK - dominATE SEOUL",
  "IMAGE PICKET - celebrATE",
  "SPECIAL TICKET SET - celebrATE",
  "ID PHOTO SET - SKZ 5'CLOCK",
  "BALLCAP KEYRING - '合 (HOP)' POP-UP STORE",
  "SKZOO SECRET ACRYLIC CARABINER - …",
  "ID PHOTO SET - celebrATE",

  "SKZOO STANDING PLUSH OUTFIT - …",
  "ACRYLIC STAND - celebrATE",
  "SKZOO TAMAGOTCHI & CASE SET",
  "SKZOO NAME TAG (KARMA VER.) - KARMA",
  "SECRET GLITTER CAN BADGE - ZOOTOPIA2 | …",
  "SKZOO PLUSH STANDING Ver. - SKZO…",
  "SKZOO PLUSH BAG - celebrATE",
  "SKZOO MAGNET PLUSH SET - celebrATE",
  "TOTE BAG - '合 (HOP)' POP-UP STORE",
  "MINI FOLDING PHOTO - '合 (HOP)' POP-UP …",
  "CARDIGAN - SKZ'S MAGIC SCHOOL",
  "T-SHIRT - SKZ'S MAGIC SCHOOL",
  "JOGGER PANTS WHITE - 'PILOT : FOR ★★★★★'",
  "SKZOO HANDHELD FAN - dominATE SEOUL",
  "SKZOO LIGHT STICK COVER VER.2",
  "SKZOO PLUSH MINI Ver.",
  "SKZOO PLUSH ORIGINAL Ver.",
  "MINI CD KEYRING - ATE",
  "NECKLACE by Hyunjin - celebrATE",
  "SOON-DOONG-DORI KEYRING SET by Lee …",
  "UMBRELLA - ATE",
  "REUSABLE BAG - ATE",
  "SHOULDER PLUSH - ZOOTOPIA2 | SKZOO",
  "GYM SACK - MANIAC SPECIAL",
  "SKZOO ROOM SHOES - SKZ'S MAGIC SCHOOL",
  "SKZOO MINI TUBE - SKZ'S MAGIC SCHOOL …",
  "SKZOO PLUSH HUG ME Ver. - SKZOO …",
  "SKZOO ACRYLIC STAND SEOUL Ver. - SKZOO …",
  "SECRET ACRYLIC STAND - STAY in Our Little …",
  "SPECIAL TRADING CARD - STAY in Our Little …",
  "SKZOO CEREMONY BALL CAP PLUSH - …",
  "SKZOO MAGNETIC HOLDER - celebrATE",
  "SKZOO ORIGINAL BACKPACK SILVER Ver. …",
  "SKZOO FACE KEYRING SILVER Ver. - celebrATE",
  "PHOTOCARD HOLDER - celebrATE",
  "PuppyM PLUSH LYING Ver. by Seungmin - …",
  "MAGNETIC CARD WALLET - ATE",
  "Stray Kids ACRYLIC POP HOLDER - ATE",
  "SKZOO PHOTOCARD TINCASE - celebrATE",
  "SKZOO REVERSIBLE FACE POUCH - …",
];

// o mesmo nome pode se repetir em coleções diferentes: o id ganha um sufixo numérico só quando precisa
const vistos = {};
export const FANS_PRODUTOS = NOMES.map(nome => {
  const base = slug(nome);
  vistos[base] = (vistos[base] || 0) + 1;
  const id = vistos[base] > 1 ? `${base}-${vistos[base]}` : base;
  return { id, nome, foto: `${id}.jpg`, opcoes: [{ id, label: nome, preco: null }] };
});

export const FANS_PROMO_CFG = {
  tabela: "pedidos_fans_promo", pasta: "fans-promo", produto: "FANS PROMO",
  titulo: "FANS PROMO", sub: "Itens da loja de fãs · compra por conta da organização",
  // sem prazo definido: pagamento imediato; para fechar, preencher deadline (Date) e pedidosAte (texto)
  deadline: null, pedidosAte: null, pagarAte: null,
  confirmacao: "Estou ciente que o pagamento é IMEDIATO",
  grupoWhatsapp: null,
  // true = "em breve": a página mostra os itens, mas não aceita pedido. Trocar para false quando os preços estiverem preenchidos.
  bloqueado: true,
  ocultarSeCadastrada: false,
  dadosTravados: true,       // joiner cadastrada: dados do cadastro travados, com o botão "Editar"
  cabecalho: true,           // barra ANTICEG no topo
  aoVivo: false,             // sem abas Ao vivo / Histórico
  resumoPedido: true,        // lista os itens marcados embaixo, para conferência
  fotoGrande: true,
  pagamentoAgora: true,      // pagamento imediato: PIX ou cartão (sem "pagar depois")
  // **texto** = negrito
  avisos: [
    "O pagamento é **IMEDIATO**: o pedido é feito já com o pagamento (PIX ou cartão).",
    "Se o item **não puder ser comprado**, o valor é **reembolsado imediatamente**.",
  ],
};
