// DICON × D'FESTA — THE ORIGIN (revistas). R$ 200 cada, envio somente em 2027, prazo de pagamento ainda a definir.
// "Ver completo": imagem oficial de cada grupo (Twitter, como no Dazed Han). Capa de cada membro: colocar em public/dicon-origin/<id>.jpg,
// por exemplo skz-bang-chan.jpg (a página funciona sem elas: mostra só a inicial do nome).
export const DICON_PRECO = 200;
const tw = (arq, tamanho) => `https://pbs.twimg.com/media/${arq}?format=jpg&name=${tamanho}`;
const COMPLETA = { skz: "HWPm2EOaQAAfVnX", bts: "HWPmuTnboAA9Nof", cortis: "HWPm74IaEAAcMkM", gd: "HWPmm4iaMAAUAgv" };
export const fmtReais = n => "R$" + Number(n).toFixed(2).replace(".", ",");

const membros = (prefixo, nomes) => nomes.map(n => ({ id: `${prefixo}-${n.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: n }));

// Cada grupo tem uma visualização completa (só para ver o que vem incluso, não é um item de compra)
// e uma capa por membro (esta sim é comprada). G-DRAGON é solo: uma única capa.
const GRUPOS_BASE = [
  { id: "skz",   nome: "STRAY KIDS", membros: membros("skz",   ["Bang Chan", "Lee Know", "Changbin", "Hyunjin", "Han", "Felix", "Seungmin", "I.N"]) },
  { id: "bts",   nome: "BTS",        membros: membros("bts",   ["RM", "Jin", "SUGA", "j-hope", "Jimin", "V", "Jung Kook"]) },
  { id: "cortis", nome: "CORTIS",    membros: membros("cortis", ["Martin", "James", "Juhoon", "Seonghyeon", "Keonho"]) },
  { id: "gd",    nome: "G-DRAGON",   membros: [{ id: "gd-g-dragon", label: "G-DRAGON" }] },
];

export const DICON_GRUPOS = GRUPOS_BASE.map(g => {
  const membros = g.membros.map(m => ({ ...m, foto: `/dicon-origin/${m.id}.jpg`, preco: DICON_PRECO }));
  // "opcoes" é o nome que o painel admin (AdminSmolMerch) espera em cada produto
  return { ...g, membros, opcoes: membros, completa: tw(COMPLETA[g.id], "large"), completaMiniatura: tw(COMPLETA[g.id], "medium") };
});

// uma linha por capa, com o grupo junto (usada no formulário, no painel e na exportação)
export const DICON_OPCOES = DICON_GRUPOS.flatMap(g => g.membros.map(m => ({ ...m, produto: g.nome })));

export const DICON_CFG = {
  tabela: "pedidos_dicon_origin", pasta: "dicon-origin", produto: "DICON × D'FESTA THE ORIGIN",
  titulo: "DICON × D'FESTA", sub: "THE ORIGIN",
  // sem data de fechamento e sem prazo de pagamento por enquanto: preencher aqui quando definir
  deadline: null, pedidosAte: null, pagarAte: null,
  preco: DICON_PRECO,
  // true = "em breve": a página mostra as capas, mas não aceita pedido. Trocar para false quando abrir.
  bloqueado: true,
  // link do grupo de atualizações; se for null o botão não aparece
  grupoWhatsapp: "https://chat.whatsapp.com/E0KKDrRGuUAI7oofzMtPgs",
  // true = o valor ainda não foi definido: a página mostra "A DEFINIR" no lugar de R$ e não calcula total.
  // Quando definir, ajustar DICON_PRECO e trocar para false.
  valorADefinir: true,
  // dois blocos de avisos; **texto** = negrito
  avisos: [
    [
      "Cada revista: **A DEFINIR**.",
      "Prazo de **PEDIDO**: **10 de novembro**.",
      "Prazo de pagamento: **duas opções disponíveis**.",
    ],
    [
      "A DICON é uma revista pesada, com mais de **1,5 kg**; por isso, o **frete será alto**.",
      "O envio **INTERNACIONAL** será apenas em **FEVEREIRO de 2027**, a depender do envio original.",
      "Você pode **pagar agora** (PIX ou cartão) ou **pagar depois**.",
      "Ao fechar o pedido, ele **não poderá ser cancelado**.",
    ],
  ],
};

// itens do pedido para a exportação "Pedidos dos joiners": uma linha por unidade
export function diconLinhas(p) {
  return (p.itens || []).flatMap(i => Array.from({ length: Math.max(0, Number(i.qtd) || 0) }, () => ({ item: `DICON × D'FESTA THE ORIGIN — ${i.produto} · ${i.opcao}`, preco: i.preco })));
}
