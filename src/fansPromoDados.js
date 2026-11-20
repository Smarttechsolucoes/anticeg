// ── Formulário FANS PROMO (itens da loja oficial de fãs, compra por conta da organização) ─────────────
// Pagamento IMEDIATO (PIX ou cartão). Se o item não puder ser comprado, o valor é reembolsado na hora.
// Usa o mesmo formulário e o mesmo painel dos outros forms de loja (SmolMerchFormPage / AdminSmolMerch).
// preco: 0 = PROVISÓRIO (a dona ainda vai informar os valores). Preencher em reais antes de abrir; com o form bloqueado ninguém consegue pedir.
// Nomes completos, conferidos contra a página da loja de fãs.
// Fotos: public/fans-promo/<id>.jpg (sem a foto, o card aparece só com o nome).
export const fotoFans = arq => `/fans-promo/${encodeURIComponent(arq)}`;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// 1ª parte: itens sem preço no print (lançamentos)
// 2ª parte: itens em promoção no print
const NOMES = [
  "SKZOO PLUSH 10CM Ver. - SKZ 5'CLOCK",
  "SPECIAL TRADING CARD - SKZ 5'CLOCK",
  "SKZOO SECRET BOUCLE CAN BADGE - SKZ 5'CLOCK",
  "SECRET ACRYLIC STAND - SKZ 5'CLOCK",
  "SPECIAL TRADING CARD - celebrATE",
  "SKZOO POWER BANK - dominATE SEOUL",
  "IMAGE PICKET - celebrATE",
  "SPECIAL TICKET SET - celebrATE",
  "ID PHOTO SET - SKZ 5'CLOCK",
  "BALLCAP KEYRING - '合 (HOP)' POP-UP STORE",
  "SKZOO SECRET ACRYLIC CARABINER - celebrATE",
  "ID PHOTO SET - celebrATE",

  "SKZOO STANDING PLUSH OUTFIT - celebrATE",
  "ACRYLIC STAND - celebrATE",
  "SKZOO TAMAGOTCHI & CASE SET",
  "SKZOO NAME TAG (KARMA VER.) - KARMA",
  "SECRET GLITTER CAN BADGE - ZOOTOPIA2 | SKZOO",
  "SKZOO PLUSH STANDING Ver. - SKZOO Everywhere All Around The World",
  "SKZOO PLUSH BAG - celebrATE",
  "SKZOO MAGNET PLUSH SET - celebrATE",
  "TOTE BAG - '合 (HOP)' POP-UP STORE",
  "MINI FOLDING PHOTO - '合 (HOP)' POP-UP STORE",
  "CARDIGAN - SKZ'S MAGIC SCHOOL",
  "T-SHIRT - SKZ'S MAGIC SCHOOL",
  "JOGGER PANTS WHITE - 'PILOT : FOR ★★★★★'",
  "SKZOO HANDHELD FAN - dominATE SEOUL",
  "SKZOO LIGHT STICK COVER VER.2",
  "SKZOO PLUSH MINI Ver.",
  "SKZOO PLUSH ORIGINAL Ver.",
  "MINI CD KEYRING - ATE",
  "NECKLACE by Hyunjin - celebrATE",
  "SOON-DOONG-DORI KEYRING SET by Lee Know - celebrATE",
  "UMBRELLA - ATE",
  "REUSABLE BAG - ATE",
  "SHOULDER PLUSH - ZOOTOPIA2 | SKZOO",
  "GYM SACK - MANIAC SPECIAL",
  "SKZOO ROOM SHOES - SKZ'S MAGIC SCHOOL",
  "SKZOO MINI TUBE - SKZ'S MAGIC SCHOOL in BUSAN",
  "SKZOO PLUSH HUG ME Ver. - SKZOO Everywhere All Around The World",
  "SKZOO ACRYLIC STAND SEOUL Ver. - SKZOO Everywhere All Around The World",
  "SECRET ACRYLIC STAND - STAY in Our Little House",
  "SPECIAL TRADING CARD - STAY in Our Little House",
  "SKZOO CEREMONY BALL CAP PLUSH - KARMA",
  "SKZOO MAGNETIC HOLDER - celebrATE",
  "SKZOO ORIGINAL BACKPACK SILVER Ver. - celebrATE",
  "SKZOO FACE KEYRING SILVER Ver. - celebrATE",
  "PHOTOCARD HOLDER - celebrATE",
  "PuppyM PLUSH LYING Ver. by Seungmin - celebrATE",
  "MAGNETIC CARD WALLET - ATE",
  "Stray Kids ACRYLIC POP HOLDER - ATE",
  "SKZOO PHOTOCARD TINCASE - celebrATE",
  "SKZOO REVERSIBLE FACE POUCH - celebrATE",
];

// Como cada item é vendido (posição na lista acima, começando em 1). Classificação feita pelo nome e pela foto: CONFERIR com a dona.
//   escolha   = dá para escolher o personagem SKZOO (e o membro dele): uma opção por personagem
//   membro    = dá para escolher o membro: uma opção por membro
//   aleatorio = o modelo é sorteado, não dá para escolher (uma opção só)
//   conjunto  = vem o set completo (uma opção só)
//   (os demais são produto único: uma opção só)
const SKZOO_MEMBRO = ["Bang Chan (Wolf Chan)", "Lee Know (Leebit)", "Changbin (Dwaekki)", "Hyunjin (Jiniret)", "Han (Han Quokka)", "Felix (BbokAri)", "Seungmin (PuppyM)", "I.N (FoxI.Ny)"];
const MEMBROS = ["Bang Chan", "Lee Know", "Changbin", "Hyunjin", "Han", "Felix", "Seungmin", "I.N"];
const TIPO = {};
[1, 6, 13, 15, 16, 18, 19, 20, 26, 27, 28, 29, 38, 39, 43, 44, 45, 46, 49, 50, 51, 52].forEach(n => { TIPO[n] = "escolha"; });
[7, 14, 30].forEach(n => { TIPO[n] = "membro"; });
[2, 3, 4, 5, 11, 17, 41, 42].forEach(n => { TIPO[n] = "aleatorio"; });
[8, 9, 12, 22, 32].forEach(n => { TIPO[n] = "conjunto"; });
const ETIQUETA = { escolha: "ESCOLHA O MEMBRO", membro: "ESCOLHA O MEMBRO", aleatorio: "ALEATÓRIO", conjunto: "SET COMPLETO" };

// o mesmo nome pode se repetir em coleções diferentes: o id ganha um sufixo numérico só quando precisa
const vistos = {};
export const FANS_PRODUTOS = NOMES.map((nome, i) => {
  const base = slug(nome);
  vistos[base] = (vistos[base] || 0) + 1;
  const id = vistos[base] > 1 ? `${base}-${vistos[base]}` : base;
  const tipo = TIPO[i + 1];
  const lista = tipo === "escolha" ? SKZOO_MEMBRO : tipo === "membro" ? MEMBROS : null;
  const opcoes = lista ? lista.map(l => ({ id: `${id}-${slug(l)}`, label: l, preco: 0 })) : [{ id, label: nome, preco: 0 }];
  return { id, nome, foto: `${id}.jpg`, ...(ETIQUETA[tipo] ? { etiqueta: ETIQUETA[tipo] } : {}), ...(lista ? { botao: "ESCOLHER MEMBRO →" } : {}), opcoes };
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
  colunas: 3,                // 3 itens por linha
  pagamentoAgora: true,      // pagamento imediato: PIX ou cartão (sem "pagar depois")
  // **texto** = negrito
  avisos: [
    "O pagamento é **IMEDIATO**: o pedido é feito já com o pagamento (PIX ou cartão).",
    "Se o item **não puder ser comprado**, o valor é **reembolsado imediatamente**.",
    "**ALEATÓRIO** = o modelo é sorteado, não dá para escolher. **ESCOLHA O MEMBRO** = marque a quantidade de cada membro/personagem. **SET COMPLETO** = vem o conjunto inteiro.",
  ],
};
