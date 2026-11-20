// ── Formulário FANS PROMO (itens da loja oficial de fãs, compra por conta da organização) ─────────────
// Pagamento IMEDIATO (PIX ou cartão). Se o item não puder ser comprado, o valor é reembolsado na hora.
// Usa o mesmo formulário e o mesmo painel dos outros forms de loja (SmolMerchFormPage / AdminSmolMerch).
// preco: em reais (ver PRECOS abaixo; 0 = sem preço, não abrir o formulário assim).
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
[1, 6, 13, 15, 16, 18, 19, 20, 26, 27, 28, 29, 35, 37, 38, 39, 43, 44, 45, 46, 49, 50, 51, 52].forEach(n => { TIPO[n] = "escolha"; });
[7, 14, 30].forEach(n => { TIPO[n] = "membro"; });
[2, 3, 4, 5, 11, 17, 41, 42].forEach(n => { TIPO[n] = "aleatorio"; });
[8, 9, 12, 22, 32].forEach(n => { TIPO[n] = "conjunto"; });
const ETIQUETA = { escolha: "ESCOLHA O MEMBRO", membro: "ESCOLHA O MEMBRO", aleatorio: "ALEATÓRIO", conjunto: "SET COMPLETO" };

// Preços em reais informados pela organização em 20/11/2026 (por nome do item; vale para todas as opções do item).
const PRECOS = {
  "SKZOO STANDING PLUSH OUTFIT - celebrATE": 102,
  "ACRYLIC STAND - celebrATE": 98,
  "SKZOO NAME TAG (KARMA VER.) - KARMA": 115,
  "SECRET GLITTER CAN BADGE - ZOOTOPIA2 | SKZOO": 17,
  "SKZOO PLUSH STANDING Ver. - SKZOO Everywhere All Around The World": 119,
  "SKZOO PLUSH BAG - celebrATE": 267,
  "SKZOO MAGNET PLUSH SET - celebrATE": 123,
  "TOTE BAG - '合 (HOP)' POP-UP STORE": 112,
  "MINI FOLDING PHOTO - '合 (HOP)' POP-UP STORE": 53,
  "CARDIGAN - SKZ'S MAGIC SCHOOL": 199,
  "T-SHIRT - SKZ'S MAGIC SCHOOL": 119,
  "JOGGER PANTS WHITE - 'PILOT : FOR ★★★★★'": 217,
  "SKZOO LIGHT STICK COVER VER.2": 86,
  "SKZOO PLUSH MINI Ver.": 110,
  "SKZOO PLUSH ORIGINAL Ver.": 119,
  "MINI CD KEYRING - ATE": 77,
  "NECKLACE by Hyunjin - celebrATE": 157,
  "SOON-DOONG-DORI KEYRING SET by Lee Know - celebrATE": 208,
  "UMBRELLA - ATE": 106,
  "REUSABLE BAG - ATE": 40,
  "SHOULDER PLUSH - ZOOTOPIA2 | SKZOO": 84,
  "GYM SACK - MANIAC SPECIAL": 67,
  "SKZOO ROOM SHOES - SKZ'S MAGIC SCHOOL": 119,
  "SKZOO MINI TUBE - SKZ'S MAGIC SCHOOL in BUSAN": 22,
  "SKZOO PLUSH HUG ME Ver. - SKZOO Everywhere All Around The World": 310,
  "SKZOO ACRYLIC STAND SEOUL Ver. - SKZOO Everywhere All Around The World": 62,
  "SECRET ACRYLIC STAND - STAY in Our Little House": 62,
  "SPECIAL TRADING CARD - STAY in Our Little House": 20,
  "SKZOO CEREMONY BALL CAP PLUSH - KARMA": 115,
  "SKZOO MAGNETIC HOLDER - celebrATE": 89,
  "SKZOO ORIGINAL BACKPACK SILVER Ver. - celebrATE": 110,
  "SKZOO FACE KEYRING SILVER Ver. - celebrATE": 72,
  "PHOTOCARD HOLDER - celebrATE": 102,
  "PuppyM PLUSH LYING Ver. by Seungmin - celebrATE": 275,
  "MAGNETIC CARD WALLET - ATE": 94,
  "Stray Kids ACRYLIC POP HOLDER - ATE": 40,
  "SKZOO PHOTOCARD TINCASE - celebrATE": 64,
  "SKZOO REVERSIBLE FACE POUCH - celebrATE": 153,
  "SKZOO PLUSH 10CM Ver. - SKZ 5'CLOCK": 68,
  "SPECIAL TRADING CARD - SKZ 5'CLOCK": 17,
  "SKZOO SECRET BOUCLE CAN BADGE - SKZ 5'CLOCK": 34,
  "SECRET ACRYLIC STAND - SKZ 5'CLOCK": 55,
  "SPECIAL TRADING CARD - celebrATE": 17,
  "IMAGE PICKET - celebrATE": 43,
  "SPECIAL TICKET SET - celebrATE": 51,
  "ID PHOTO SET - SKZ 5'CLOCK": 26,
  "BALLCAP KEYRING - '合 (HOP)' POP-UP STORE": 106,
  "SKZOO SECRET ACRYLIC CARABINER - celebrATE": 42,
  "ID PHOTO SET - celebrATE": 26,
};

// o mesmo nome pode se repetir em coleções diferentes: o id ganha um sufixo numérico só quando precisa
const vistos = {};
// itens que a organização decidiu NÃO vender neste formulário (ficam na lista acima só para manter a numeração do TIPO)
const RETIRADOS = ["SKZOO POWER BANK - dominATE SEOUL", "SKZOO TAMAGOTCHI & CASE SET", "SKZOO HANDHELD FAN - dominATE SEOUL"];
export const FANS_PRODUTOS = NOMES.map((nome, i) => {
  const base = slug(nome);
  vistos[base] = (vistos[base] || 0) + 1;
  const id = vistos[base] > 1 ? `${base}-${vistos[base]}` : base;
  const tipo = TIPO[i + 1];
  const lista = tipo === "escolha" ? SKZOO_MEMBRO : tipo === "membro" ? MEMBROS : null;
  const opcoes = lista ? lista.map(l => ({ id: `${id}-${slug(l)}`, label: l, preco: PRECOS[nome] ?? 0 })) : [{ id, label: nome, preco: PRECOS[nome] ?? 0 }];
  return { id, nome, foto: `${id}.jpg`, ...(ETIQUETA[tipo] ? { etiqueta: ETIQUETA[tipo] } : {}), ...(lista ? { botao: "ESCOLHER MEMBRO →" } : {}), opcoes };
}).filter(p => !RETIRADOS.includes(p.nome));

const _precos = FANS_PRODUTOS.flatMap(p => p.opcoes.map(o => o.preco));
export const FANS_FAIXA = { min: Math.min(..._precos), max: Math.max(..._precos) };

export const FANS_PROMO_CFG = {
  tabela: "pedidos_fans_promo", pasta: "fans-promo", produto: "FANS PROMO",
  titulo: "FANS PROMO", sub: "Itens da loja de fãs · compra por conta da organização",
  // formulário aberto até 22 de novembro (fecha sozinho no fim do dia, horário de Brasília)
  deadline: new Date("2026-11-22T23:59:59-03:00"), pedidosAte: "22/11/2026", pagarAte: null,
  confirmacao: "Estou ciente que o pagamento é IMEDIATO e da política de reembolso (no cartão, a taxa da máquina não é reembolsada)",
  grupoWhatsapp: "https://chat.whatsapp.com/JVCGH5uHyks8AtcrhVj5Ah",
  // true = "em breve": a página mostra os itens, mas não aceita pedido. Trocar para false quando os preços estiverem preenchidos.
  bloqueado: true,
  ocultarSeCadastrada: false,
  dadosTravados: true,       // joiner cadastrada: dados do cadastro travados, com o botão "Editar"
  cabecalho: true,           // barra ANTICEG no topo
  aoVivo: false,             // sem abas Ao vivo / Histórico
  resumoPedido: true,        // lista os itens marcados embaixo, para conferência
  fotoGrande: true,
  colunas: 3,                // 3 itens por linha
  pagamentoAgora: true,      // pagamento imediato
  soAgora: true,             // só "pagar agora" (PIX ou cartão); sem "pagar depois"
  avisoPix: "Reembolso no PIX: o valor será reembolsado integralmente.",
  avisoCartao: "Reembolso no cartão: somente o valor do item. A taxa da máquina NÃO será reembolsada, pois é um valor que NÃO chega para a GOM.",
  // **texto** = negrito
  avisos: [
    "》Sempre esteja ciente das regras da comunidade, caso não lembre: [clique aqui](/regras).",
    "Forms aberto até: **22 de novembro**",
    "**Pagamento imediato.**",
    {
      texto: "Leia a **política de reembolso**.",
      titulo: "POLÍTICA DE REEMBOLSO",
      detalhe: [
        "Caso o item **não seja comprado por falta de estoque**, o reembolso será **integral em até 48h**, individualmente no privado. As informações serão divulgadas no **grupo da CEG** informado no formulário.",
        "**Pagamentos no cartão:** reembolso **somente do valor do item**. A taxa da máquina **NÃO** será reembolsada, pois é um valor que **NÃO** chega para a GOM.",
        "**PIX:** o valor será reembolsado **integralmente**.",
      ],
    },
    "**Grupo da CEG** (as informações do reembolso saem lá): https://chat.whatsapp.com/JVCGH5uHyks8AtcrhVj5Ah",
    "Ainda sem data de envio internacional.",
  ],
  legendaItens: "**ALEATÓRIO** = o modelo é sorteado, não dá para escolher. **ESCOLHER MEMBRO** = abre a escolha da quantidade de cada membro/personagem. **SET COMPLETO** = vem o conjunto inteiro.",
};
