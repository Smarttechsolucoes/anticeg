// ── Catálogo ─────────────────────────────────────────────────────────────────
// Fotos da loja (BigCartel). `w=600` nos cards e `w=2000` só ao ampliar, para carregar rápido no celular.
export const foto = (arq, w = 600) => (arq.startsWith("/") || arq.startsWith("http")) ? arq : `https://assets.bigcartel.com/product_images/${arq}?auto=format&fit=max&w=${w}`;
export const fmtReais = n => "R$" + Number(n).toFixed(2).replace(".", ",");

export const SMOLMERCH_PRODUTOS = [
  // Extended PO (outubro/2026): 3 itens. Ids novos de propósito: os pedidos antigos continuam com o nome e o preço gravados neles.
  { id: "house-id-holder-out", nome: "Boddaramji House ID Photo Holder", foto: "/smolmerch/house-id-holder-out.jpg", opcoes: [
    { id: "house-id-holder-out", label: "ID Photo Holder (PVC 7x9cm + argola)", preco: 26 },
  ] },
  { id: "miso-candy-pouch", nome: "Miso PVC Candy Pouch", foto: "/smolmerch/miso-candy-pouch.jpg", opcoes: [
    { id: "miso-candy-pouch", label: "Candy Pouch (8,8x10,4cm + O-ring + charm acrílico)", preco: 32 },
  ] },
  { id: "boddaramji-pc-holder", nome: "Boddaramji PC Holder", foto: "/smolmerch/boddaramji-pc-holder.jpg", opcoes: [
    { id: "boddaramji-pc-holder", label: "PC Holder (acrílico 2mm x3, dupla face + beads)", preco: 32 },
  ] },
];

// uma linha por opção, com o nome do produto junto (usada no formulário, no painel e na exportação)
export const SMOLMERCH_OPCOES = SMOLMERCH_PRODUTOS.flatMap(p => p.opcoes.map(o => ({ ...o, produto: p.nome })));

export const SMOLMERCH_CFG = {
  tabela: "pedidos_smolmerch", pasta: "smolmerch", produto: "SMOL MERCH",
  titulo: "SMOL MERCH", sub: "Extended PO · Boddaramji House · Miso Candy Pouch · PC Holder",
  deadline: new Date("2026-10-19T23:59:59-03:00"), pedidosAte: "19/10/2026", pagarAte: "20/10",
  // false = o formulário só registra o pedido; a pessoa paga depois (sem PIX/cartão no formulário).
  // Para voltar a aceitar pagamento no formulário, troque para true.
  pagamentoAgora: false,
  // **texto** = negrito
  avisos: [
    "O formulário fica aberto até **19 de outubro**.",
    "O pagamento será no dia **20 de outubro** (a forma de pagar será avisada).",
    "Ao fechar o pedido, ele **não poderá ser cancelado**.",
    "O frete e a previsão de envio serão **avisados em breve**.",
  ],
};

// itens do pedido para a exportação "Pedidos dos joiners": uma linha por unidade
export function smolmerchLinhas(p) {
  return (p.itens || []).flatMap(i => Array.from({ length: Math.max(0, Number(i.qtd) || 0) }, () => ({ item: `${i.produto} — ${i.opcao}`, preco: i.preco })));
}
