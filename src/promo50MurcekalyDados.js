// ── Catálogo do formulário PROMO 50 MURCEKALY (merchs e photocards da seller Murcekaly) ──────────────
// Fotos em public/promo-50-murcekaly. Valores em reais, já convertidos (informados pela organização).
// Usa o mesmo formulário e o mesmo painel do Murcekaly Itens / PROMO-MURCE-50 (SmolMerchFormPage / AdminSmolMerch).
// preco: null = a definir (aparece "preço em breve" e não soma no total). Estoque: maxTotal na opção.
// Item/opção que aparece com SOLD no print da seller fica de fora.
export const fotoP50 = arq => `/promo-50-murcekaly/${encodeURIComponent(arq)}`;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const opcoes = (idProduto, nomes, preco = null) => nomes.map(n => ({ id: `${idProduto}-${slug(n)}`, label: n, preco }));
const unica = (idProduto, label, preco) => [{ id: idProduto, label, preco }];

const SKZ = ["Bang Chan", "Lee Know", "Changbin", "Hyunjin", "Han", "Felix", "Seungmin", "I.N"];
const ATEEZ = ["Hongjoong", "Seonghwa", "Yunho", "Yeosang", "San", "Mingi", "Wooyoung", "Jongho"];
// personagens SKZOO: Wolf Chan (Bang Chan), Leebit (Lee Know), Dwaekki (Changbin), Jiniret (Hyunjin), Han Quokka (Han), BbokAri (Felix), PuppyM (Seungmin), FoxI.Ny (I.N)
const SKZOO = ["Wolf Chan", "Leebit", "Dwaekki", "Jiniret", "Han Quokka", "BbokAri", "PuppyM", "FoxI.Ny"];
const SKZOO_MEMBRO = ["Bang Chan (Wolf Chan)", "Lee Know (Leebit)", "Changbin (Dwaekki)", "Hyunjin (Jiniret)", "Han (Han Quokka)", "Felix (BbokAri)", "Seungmin (PuppyM)", "I.N (FoxI.Ny)"];

// photocards de uma rodada: um por membro, na ordem do print; `sold` = posições (0 a 7) com SOLD no print, que ficam de fora
function rodada(id, nome, foto, preco, membros, sold = []) {
  const fora = sold.map(i => membros[i]);
  return {
    id, nome, foto,
    ...(fora.length ? { avisos: [`Esgotado: ${fora.join(", ")}.`] } : {}),
    opcoes: opcoes(id, membros.filter((_, i) => !sold.includes(i)), preco),
  };
}

const LISTA = [
  // ── NACIFIC ATEEZ (R$ 15 cada) ──
  rodada("ateez-r1", "ATEEZ NACIFIC R1", "ateez-r1.jpg", 15, ATEEZ, [6]),
  rodada("ateez-r2", "ATEEZ NACIFIC R2", "ateez-r2.jpg", 15, ATEEZ),
  rodada("ateez-r3-id", "ATEEZ NACIFIC R3 — ID PHOTOCARD", "ateez-r3-id.jpg", 15, ATEEZ),
  rodada("ateez-r4", "ATEEZ NACIFIC R4", "ateez-r4.jpg", 15, ATEEZ),
  rodada("ateez-r5-universe", "ATEEZ NACIFIC R5 — UNIVERSE VER.", "ateez-r5-universe.jpg", 15, ATEEZ),
  rodada("ateez-r5-eclipse", "ATEEZ NACIFIC R5 — ECLIPSE VER.", "ateez-r5-eclipse.jpg", 15, ATEEZ),
  rodada("ateez-r6-double", "ATEEZ NACIFIC R6 — DOUBLE SIDED", "ateez-r6-double.jpg", 15, ATEEZ),
  rodada("ateez-r6-student", "ATEEZ NACIFIC R6 — STUDENT ID", "ateez-r6-student.jpg", 15, ATEEZ),
  rodada("ateez-r7-type1", "ATEEZ NACIFIC R7 — TYPE 1", "ateez-r7-type1.jpg", 15, ATEEZ),
  rodada("ateez-r7-type2", "ATEEZ NACIFIC R7 — TYPE 2", "ateez-r7-type2.jpg", 15, ATEEZ),
  rodada("ateez-r9-cherry", "ATEEZ NACIFIC R9 — CHERRY VER.", "ateez-r9-cherry.jpg", 15, ATEEZ),
  rodada("ateez-r9-glaze", "ATEEZ NACIFIC R9 — GLAZE VER.", "ateez-r9-glaze.jpg", 15, ATEEZ),
  {
    id: "ateez-round2-id-photo", nome: "ATEEZ NACIFIC ROUND 2 — ID PHOTO", foto: "ateez-id-photo-r2.jpg",
    avisos: ["R$ 7 cada foto, ou o set completo (8 fotos) por R$ 35."],
    opcoes: [...opcoes("ateez-round2-id-photo", ATEEZ, 7), { id: "ateez-round2-id-photo-set-completo", label: "Set completo (8 fotos)", preco: 35 }],
  },

  // ── NACIFIC Stray Kids (R$ 10 cada, qualquer uma) ──
  rodada("skz-r9", "STRAY KIDS NACIFIC R9", "skz-r9.jpg", 10, SKZ, [0, 3]),
  rodada("skz-r10", "STRAY KIDS NACIFIC R10 — DOUBLE SIDED", "skz-r10.jpg", 10, SKZ),
  rodada("skz-r11", "STRAY KIDS NACIFIC R11 — HOLOGRAM", "skz-r11.jpg", 10, SKZ),
  rodada("skz-r12", "STRAY KIDS NACIFIC R12", "skz-r12.jpg", 10, SKZ, [0, 5]),
  rodada("skz-r13", "STRAY KIDS NACIFIC R13", "skz-r13.jpg", 10, SKZ),
  rodada("skz-r14", "STRAY KIDS NACIFIC R14", "skz-r14.jpg", 10, SKZ),
  rodada("skz-r15", "STRAY KIDS NACIFIC R15", "skz-r15.jpg", 10, SKZ),
  rodada("skz-r18", "STRAY KIDS NACIFIC R18 — DOUBLE SIDED", "skz-r18.jpg", 10, SKZ),
  rodada("skz-r19", "STRAY KIDS NACIFIC R19", "skz-r19.jpg", 10, SKZ),
  rodada("skz-r20", "STRAY KIDS NACIFIC R20", "skz-r20.jpg", 10, SKZ),
  rodada("skz-r22", "STRAY KIDS NACIFIC R22 — DOUBLE SIDED", "skz-r22.jpg", 10, SKZ),
  { id: "skz-r9-id-ot8", nome: "STRAY KIDS NACIFIC R9 — ID PHOTO (OT8)", foto: "skz-id-r9.jpg", avisos: ["Só sai o set completo (OT8): as 8 fotos."], opcoes: unica("skz-r9-id-ot8", "Set OT8 (8 fotos)", 26) },
  { id: "skz-r16-id-ot8", nome: "STRAY KIDS NACIFIC R16 — ID PHOTO (OT8)", foto: "skz-id-r16.jpg", avisos: ["Só sai o set completo (OT8): as 8 fotos."], opcoes: unica("skz-r16-id-ot8", "Set OT8 (8 fotos)", 26) },
  { id: "skz-round21", nome: "STRAY KIDS NACIFIC ROUND 21", foto: "skz-round21.jpg", avisos: ["Cada opção é um set com 2 photocards do membro."], opcoes: opcoes("skz-round21", SKZ, 15) },

  // ── Stray Kids: itens avulsos ──
  { id: "individual-acrylic-standee", nome: "INDIVIDUAL ACRYLIC STANDEE", foto: "standee.jpg", opcoes: opcoes("individual-acrylic-standee", SKZ, 28) },
  {
    id: "zip-up-hoodie-do-it", nome: "ZIP UP HOODIE — DO IT POP-UP", foto: "hoodie-do-it.jpg",
    avisos: ["Tamanho único (FREE): largura do peito 58 cm, manga 80 cm, comprimento total 73 cm.", "Material: poliéster, algodão e papel."],
    opcoes: unica("zip-up-hoodie-do-it", "Zip Up Hoodie", 120),
  },
  {
    id: "blind-box-fanmade", nome: "FIRST PRIORITY BLIND BOX FIGURE (FANMADE)", foto: "blind-box.jpg",
    avisos: ["Escolha a versão. Estoque limitado por versão."],
    opcoes: [
      { id: "blind-box-fanmade-anger-dorumouse", label: "Anger Dorumouse", preco: 140, maxTotal: 3 },
      { id: "blind-box-fanmade-march-chick", label: "March Chick", preco: 140, maxTotal: 3 },
      { id: "blind-box-fanmade-the-gilded-hatter", label: "The Gilded Hatter", preco: 140, maxTotal: 1 },
      { id: "blind-box-fanmade-cheshire-cry-cat", label: "Cheshire Cry Cat", preco: 140, maxTotal: 1 },
    ],
  },
  { id: "beads-strap-felix", nome: "BEADS STRAP BY FELIX", foto: "beads-strap-felix.jpg", opcoes: unica("beads-strap-felix", "Beads Strap by Felix", 160) },
  { id: "ball-cap-han", nome: "BALL CAP BY HAN", foto: "ball-cap-han.jpg", opcoes: unica("ball-cap-han", "Ball Cap by Han", 250) },
  { id: "hippers-set", nome: "HIPPERS SET (HIPPER + PHOTOCARD)", foto: "hippers-set.jpg", avisos: ["Cada set é de 1 membro: escolha qual."], opcoes: opcoes("hippers-set", SKZOO_MEMBRO, 65) },

  // ── Álbuns (R$ 30 cada) ──
  { id: "album-karma", nome: "STRAY KIDS — KARMA (COMPACT VER.) SEALED", foto: "album-karma.jpg", opcoes: unica("album-karma", "Compact Ver.", 30) },
  { id: "album-wayv", nome: "WAYV — GIVE ME THAT SEALED", foto: "album-wayv.jpg", opcoes: [{ id: "album-wayv-a-ver", label: "A Ver.", preco: 30 }, { id: "album-wayv-b-ver", label: "B Ver.", preco: 30 }] },
  { id: "album-riize", nome: "RIIZE — ODYSSEY (SHOTARO VER.) SEALED", foto: "album-riize.jpg", opcoes: unica("album-riize", "Shotaro Ver.", 30) },
  { id: "album-p1harmony", nome: "P1HARMONY — HARMONY: ALL IN SEALED", foto: "album-p1harmony.jpg", opcoes: unica("album-p1harmony", "Flow In Ver.", 30) },
  { id: "album-cix", nome: "CIX — 0 OR 1 SEALED", foto: "album-cix.jpg", opcoes: [{ id: "album-cix-humanoid", label: "Humanoid Ver.", preco: 30 }, { id: "album-cix-android", label: "Android Ver.", preco: 30 }] },
  { id: "album-txt", nome: "TXT — MINISODE 1: BLUE HOUR SEALED", foto: "album-txt.jpg", opcoes: [{ id: "album-txt-ar", label: "AR Ver.", preco: 30 }, { id: "album-txt-vr", label: "VR Ver.", preco: 30 }] },
  { id: "album-itzy", nome: "ITZY — KILL MY DOUBT SEALED", foto: "album-itzy.jpg", opcoes: ["Limited Ver.", "A Ver.", "B Ver.", "C Ver.", "D Ver."].map(v => ({ id: `album-itzy-${slug(v)}`, label: v, preco: 30 })) },
  { id: "album-kickflip", nome: "KICKFLIP — FLIP IT, KICK IT! (UMM GREAT VER.)", foto: "album-kickflip.jpg", opcoes: unica("album-kickflip", "Umm Great Ver.", 30) },
  { id: "album-nflying", nome: "N.FLYING — EVERLASTING SEALED", foto: "album-nflying.jpg", opcoes: [{ id: "album-nflying-last", label: "Last Ver.", preco: 30 }, { id: "album-nflying-ever", label: "Ever Ver.", preco: 30 }] },

  // ── SKZOO — Everywhere All Around the World ──
  { id: "skzoo-reel-face", nome: "SKZOO REEL FACE (SET ONLY)", foto: "skzoo-reel-face.jpg", avisos: ["Estoque limitado."], opcoes: opcoes("skzoo-reel-face", ["Leebit", "Dwaekki", "Jiniret", "Han Quokka", "BbokAri", "PuppyM", "FoxI.Ny"], 65) },
  { id: "skzoo-acrylic-stand-seoul", nome: "SKZOO ACRYLIC STAND — SEOUL VER.", foto: "skzoo-acrylic-stand-seoul.jpg", opcoes: unica("skzoo-acrylic-stand-seoul", "Acrylic Stand Seoul Ver.", 35) },
  { id: "skzoo-plush-collect-book", nome: "SKZOO PLUSH COLLECT BOOK (SÓ O BOOK)", foto: "skzoo-plush-collect-book.jpg", avisos: ["Tamanho: 9 cm x 11 cm."], opcoes: opcoes("skzoo-plush-collect-book", SKZOO, 68) },
  { id: "skzoo-keyring-seoul", nome: "SKZOO KEYRING — SEOUL VER.", foto: "skzoo-keyring-seoul.jpg", opcoes: opcoes("skzoo-keyring-seoul", ["Dwaekki", "FoxI.Ny"], 50) },
  { id: "skzoo-lightstick-cover-v2", nome: "SKZOO LIGHTSTICK COVER VER. 2", foto: "skzoo-lightstick-cover.jpg", avisos: ["Esgotado: Wolf Chan."], opcoes: opcoes("skzoo-lightstick-cover-v2", SKZOO.slice(1), 65) },
  { id: "racing-jacket-seoul", nome: "RACING JACKET — SEOUL VER.", foto: "racing-jacket.jpg", opcoes: unica("racing-jacket-seoul", "Racing Jacket", 240) },
  {
    id: "baseball-jersey-seoul", nome: "BASEBALL JERSEY — SEOUL VER.", foto: "baseball-jersey.jpg",
    avisos: ["Tamanho único (FREE): ombro 52 cm, peito 60 cm, manga 27 cm, comprimento total 82 cm.", "Material: poliéster."],
    opcoes: unica("baseball-jersey-seoul", "Baseball Jersey", 185),
  },
  { id: "skzoo-acrylic-gel-pen", nome: "SKZOO ACRYLIC GEL PEN", foto: "skzoo-gel-pen.jpg", opcoes: opcoes("skzoo-acrylic-gel-pen", SKZOO, 35) },

  // ── Starlight Super Club (SG2026) ──
  { id: "sg2026-set", nome: "SG2026 SET (OT8)", foto: "sg2026-set.jpg", opcoes: unica("sg2026-set", "SG2026 Set OT8", 135) },
  { id: "sg2026-desk-calendar", nome: "SG2026 DESK CALENDAR", foto: "sg2026-desk-calendar.jpg", opcoes: unica("sg2026-desk-calendar", "Desk Calendar", 15) },
  { id: "sg2026-diary", nome: "SG2026 DIARY", foto: "sg2026-diary.jpg", opcoes: unica("sg2026-diary", "Diary", 25) },
  { id: "sg2026-memo-pad", nome: "SG2026 MEMO PAD", foto: "sg2026-memo-pad.jpg", opcoes: unica("sg2026-memo-pad", "Memo Pad", 15) },
  { id: "pvc-clear-pouch", nome: "PVC CLEAR POUCH", foto: "pvc-clear-pouch.jpg", opcoes: unica("pvc-clear-pouch", "PVC Clear Pouch", 25) },
  { id: "removable-sticker", nome: "REMOVABLE STICKER", opcoes: unica("removable-sticker", "Removable Sticker", 10) },

  // ── The Street Kids (SG25) ──
  { id: "sg25-mini-l-holder", nome: "SG25 MINI L-HOLDER", foto: "sg25-mini-l-holder.jpg", opcoes: unica("sg25-mini-l-holder", "Mini L-Holder", 5) },
  { id: "sg25-metal-logo-keyring", nome: "SG2025 METAL LOGO KEYRING", foto: "sg25-metal-logo-keyring.jpg", opcoes: unica("sg25-metal-logo-keyring", "Metal Logo Keyring", 8) },
  { id: "sg25-set", nome: "SG25 SET", foto: "sg25-set.jpg", opcoes: unica("sg25-set", "SG25 Set", 90) },
];

// abas do formulário: ATEEZ, ÁLBUNS e STRAY KIDS (tudo o que não é ATEEZ nem álbum: photocards, merch, SKZOO, SG2026, SG25...)
export const SECOES_P50 = ["ATEEZ", "ÁLBUNS", "STRAY KIDS"];
const secaoDe = p => p.id.startsWith("ateez-") ? "ATEEZ" : p.id.startsWith("album-") ? "ÁLBUNS" : "STRAY KIDS";
export const PROMO_50_MURCEKALY_PRODUTOS = LISTA.map(p => ({ ...p, secao: secaoDe(p) }))
  .sort((a, b) => SECOES_P50.indexOf(a.secao) - SECOES_P50.indexOf(b.secao));   // sort é estável: a ordem dentro de cada aba é a de cima

// menor e maior preço entre as opções que já têm valor
const PRECOS_P50 = PROMO_50_MURCEKALY_PRODUTOS.flatMap(p => p.opcoes.map(o => o.preco)).filter(v => typeof v === "number");
export const PROMO_50_MURCEKALY_FAIXA = { min: Math.min(...PRECOS_P50), max: Math.max(...PRECOS_P50) };

export const PROMO_50_MURCEKALY_CFG = {
  tabela: "pedidos_promo_50_murcekaly", pasta: "promo-50-murcekaly", produto: "PROMO 50 MURCEKALY",
  titulo: "PROMO 50 MURCEKALY", sub: "",
  secoes: SECOES_P50,        // abas no formulário
  // o formulário fecha na sexta-feira 20/11/2026 às 10h (Brasília)
  deadline: new Date("2026-11-20T10:00:00-03:00"), pedidosAte: "SEXTA-FEIRA (20/11) ÀS 10H", pagarAte: null,
  confirmacao: "Estou ciente que o prazo de pagamento é IMEDIATO",   // caixa obrigatória no fim do formulário
  grupoWhatsapp: "https://chat.whatsapp.com/Lux5FicJErLBTZPBQPJfq9",
  // true = "em breve": a página mostra os itens, mas não aceita pedido. Trocar para false quando abrir.
  bloqueado: false,
  itensComFoto: true,        // painel admin: visão "Itens" com foto, nome e quantidade pedida
  ocultarSeCadastrada: false,
  historicoSoMeu: true,      // Histórico = só os pedidos da própria joiner; Ao vivo = todos, com a posição dela na fila
  dadosTravados: true,       // joiner cadastrada: dados do cadastro travados, com o botão "Editar"
  cabecalho: true,           // barra ANTICEG no topo
  aoVivo: true,              // abas Pedido · Ao vivo · Histórico (@ sempre como @***)
  resumoPedido: true,        // lista os itens marcados embaixo, para conferência
  fotoGrande: true,          // mostra a foto inteira (sem cortar) em cada produto
  pagamentoAgora: false,     // só "pagar depois"
  // **texto** = negrito
  avisos: [
    "O forms fica aberto até **sexta-feira às 10h**.",
    "CEG **LONGA** e **DEMORADA**, a seller é enrolada!",
    "O prazo de pagamento é **IMEDIATO** após a confirmação da seller.",
    "O estoque é **LIMITADO**: o risco de sold-out é grande.",
    "Os itens saem da **Indonésia** para o Brasil.",
    "Haverá **frete internacional** e **taxa da Receita Federal**.",
    "**Não haverá possibilidade de cancelar a claim.** Se estiver em dúvida, não marque.",
    "CEG: https://chat.whatsapp.com/Lux5FicJErLBTZPBQPJfq9",
  ],
};
