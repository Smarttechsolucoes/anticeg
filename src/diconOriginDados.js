// DICON × D'FESTA — THE ORIGIN (revistas). R$ 200 cada, envio somente em 2027, prazo de pagamento ainda a definir.
// "Ver completo": imagem oficial de cada grupo (Twitter, como no Dazed Han). Capa de cada membro: colocar em public/dicon-origin/<id>.jpg,
// por exemplo skz-bang-chan.jpg (a página funciona sem elas: mostra só a inicial do nome).
// preço-base (opção à vista); o valor de cada pedido vem da opção de prazo escolhida (DICON_CFG.prazos)
export const DICON_PRECO = 210;
const tw = (arq, tamanho) => `https://pbs.twimg.com/media/${arq}?format=jpg&name=${tamanho}`;
// POB de cada loja, por grupo (imagens do Twitter, como a visualização completa)
const POB = {
  skz:    { weverse: "HWQawyRWkAEWj5m", kakaotalk: "HWQawyXW4AAwhCw", diconmall: "HWQawyPWUAEk2Q3" },
  bts:    { weverse: "HWQYjAFaQAAdgpy", kakaotalk: "HWQYkvGb0AAtOLU", diconmall: "HWQYoYIaEAAeyDr" },
  cortis: { weverse: "HWQZHpRaQAE1ruE", kakaotalk: "HWQZKKxb0AAsPkM", diconmall: "HWQZNuXbAAAJrG0" },
  gd:     { weverse: "HWQYQ7Xa8AAj4Ma", kakaotalk: "HWQYTqxa0AAR1Kn", diconmall: "HWQYXCybQAAiYUD" },
};
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
  return { ...g, membros, opcoes: membros, completa: tw(COMPLETA[g.id], "large"), completaMiniatura: tw(COMPLETA[g.id], "medium"),
    // pobs[idDaLoja] = { miniatura, grande }
    pobs: Object.fromEntries(Object.entries(POB[g.id]).map(([loja, arq]) => [loja, { miniatura: tw(arq, "medium"), grande: tw(arq, "large") }])) };
});

// uma linha por capa, com o grupo junto (usada no formulário, no painel e na exportação)
export const DICON_OPCOES = DICON_GRUPOS.flatMap(g => g.membros.map(m => ({ ...m, produto: g.nome })));

export const DICON_CFG = {
  tabela: "pedidos_dicon_origin", pasta: "dicon-origin", produto: "DICON × D'FESTA THE ORIGIN",
  titulo: "DICON × D'FESTA", sub: "THE ORIGIN",
  // prazo de pedido: 10/11/2026. Sem prazo único de pagamento: cada opção de prazo (abaixo) tem as suas datas
  deadline: new Date("2026-11-10T23:59:59-03:00"), pedidosAte: "10/11/2026", pagarAte: null,
  preco: DICON_PRECO,
  // true = "em breve": a página mostra as capas, mas não aceita pedido. Trocar para false quando abrir.
  bloqueado: false,
  // link do grupo de atualizações; se for null o botão não aparece
  grupoWhatsapp: "https://chat.whatsapp.com/E0KKDrRGuUAI7oofzMtPgs",
  // true = o valor ainda não foi definido: a página mostra "A DEFINIR" no lugar de R$ e não calcula total.
  valorADefinir: false,
  // opções de prazo do checkout. preco = valor de CADA revista nessa opção; parcelas = quanto (por revista) e até quando.
  prazos: [
    { id: "avista",    titulo: "À vista",         preco: 210, parcelas: [{ valor: 210, ate: "13/11" }] },
    { id: "parcelado", titulo: "Parcelado em 2x", preco: 300, parcelas: [{ valor: 150, ate: "13/11" }, { valor: 150, ate: "10/12" }] },
  ],
  // todas as revistas acompanham POB; a pessoa escolhe em qual loja (as imagens do POB de cada grupo estão em DICON_GRUPOS[].pobs)
  lojas: [
    { id: "weverse",   nome: "WeVerse" },
    { id: "kakaotalk", nome: "KakaoTalk" },
    { id: "diconmall", nome: "DiconMall" },
    // sem POB: valor fixo por revista, sempre à vista e até a data indicada (qualquer que seja o prazo escolhido)
    { id: "sempob", nome: "SEM POB", semPob: true, preco: 190, ate: "13/11" },
  ],
  // dois blocos de avisos; **texto** = negrito
  avisos: [
    [
      "Cada revista: **R$210** (pagamento até **13/11**) ou **R$300** em 2x de **R$150** (**13/11** e **10/12**).",
      "Opção **SEM POB**: **R$190** (pagamento até **13/11**).",
      "Prazo de **PEDIDO**: **10 de novembro**.",
      "Todas as revistas acompanham **POB** (escolha a loja), a não ser que você escolha **SEM POB**.",
      "O **POB é aleatório** e **não é respectivo ao membro da capa**.",
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
  // prazo e loja do POB vão dentro de cada item (pedidos antigos não têm: aí ficam de fora do texto)
  return (p.itens || []).flatMap(i => Array.from({ length: Math.max(0, Number(i.qtd) || 0) }, () => ({ item: `DICON × D'FESTA THE ORIGIN — ${i.produto} · ${i.opcao}${i.prazo ? ` · ${i.prazo}` : ""}${i.loja ? ` · ${/^sem/i.test(i.loja) ? "" : "POB "}${i.loja}` : ""}`, preco: i.preco })));
}
