// ── Catálogo ─────────────────────────────────────────────────────────────────
// Fotos da loja (BigCartel). `w=600` nos cards e `w=2000` só ao ampliar, para carregar rápido no celular.
export const foto = (arq, w = 600) => (arq.startsWith("/") || arq.startsWith("http")) ? arq : `https://assets.bigcartel.com/product_images/${arq}?auto=format&fit=max&w=${w}`;
export const fmtReais = n => "R$" + Number(n).toFixed(2).replace(".", ",");

// Formulário único: os itens do UPDATE (Extended PO) ficam no topo da lista e levam o selo UPDATE.
export const SMOLMERCH_PRODUTOS = [
  // Extended PO (outubro/2026): 3 itens. Ids novos de propósito: os pedidos antigos continuam com o nome e o preço gravados neles.
  { aba: "update", id: "house-id-holder", nome: "Boddaramji House ID Photo Holder", foto: "/smolmerch/house-id-holder-out.jpg", opcoes: [
    { id: "house-id-holder", label: "ID Photo Holder (PVC 7x9cm + argola)", preco: 30 },
  ] },
  { aba: "update", id: "miso-candy-pouch", nome: "Miso PVC Candy Pouch", foto: "/smolmerch/miso-candy-pouch.jpg", opcoes: [
    { id: "miso-candy-pouch", label: "Candy Pouch (8,8x10,4cm + O-ring + charm acrílico)", preco: 32 },
  ] },
  { aba: "update", id: "boddaramji-pc-holder", nome: "Boddaramji PC Holder", foto: "/smolmerch/boddaramji-pc-holder.jpg", opcoes: [
    { id: "boddaramji-pc-holder", label: "PC Holder (acrílico 2mm x3, dupla face + beads)", preco: 32 },
  ] },

  // ── itens do formulário anterior ──
  { aba: "anterior", id: "carabiner", nome: "Boddaramji UFO Carabiner", foto: "417132855/carabiner.jpg", opcoes: [
    { id: "carabiner-miso",     label: "Carabiner (miso)",             preco: 40 },
    { id: "carabiner-completo", label: "Completo (carabiner + pets)",  preco: 55 },
    { id: "carabiner-richard",  label: "Somente Richard",              preco: 5.5 },
  ] },
  { aba: "anterior", id: "han-bday", nome: "Han BDAY", foto: "432579921/han+bday+sets.jpg", opcoes: [
    { id: "han-standee",  label: "Standee Acrílico", preco: 50 },
    { id: "han-adesivo",  label: "Adesivo",          preco: 10 },
    { id: "han-a5-print", label: "A5 Print",         preco: 10 },
  ] },
  { aba: "anterior", id: "miso-keychains", nome: "Miso Keychains", foto: "432580293/new+miso+keychains.jpg", opcoes: [
    { id: "miso-orange-black", label: "Orange Black Miso",  preco: 25 },
    { id: "miso-black-cat",    label: "Me & My Black Cat",  preco: 25 },
  ] },
  { aba: "anterior", id: "deco-stickers", nome: "Deco Stickers", foto: "432579141/Deco+Stickers+NEW.jpg", opcoes: [
    { id: "deco-byeolbit", label: "Byeolbit",      preco: 17 },
    { id: "deco-skz",      label: "Assorted SKZ",  preco: 17 },
    { id: "deco-tasy",     label: "Tasy Stay",     preco: 17 },
  ] },
  { aba: "anterior", id: "miso-sticker-set", nome: "Miso Sticker Set", foto: "432580485/miso+orange+black.jpg", opcoes: [
    { id: "miso-sticker-set", label: "Miso Sticker Set", preco: 13 },
  ] },
  { aba: "anterior", id: "byeolbit-pvc", nome: "ByeolBit PVC PC Holder", foto: "423231669/PG3_Byeolbit+pc+holder.jpg", opcoes: [
    { id: "byeolbit-pvc", label: "PVC PC Holder", preco: 47 },
  ] },
];

// uma linha por opção, com o nome do produto junto (usada no formulário, no painel e na exportação)
export const SMOLMERCH_OPCOES = SMOLMERCH_PRODUTOS.flatMap(p => p.opcoes.map(o => ({ ...o, produto: p.nome, aba: p.aba })));

export const SMOLMERCH_CFG = {
  tabela: "pedidos_smolmerch", pasta: "smolmerch", produto: "SMOL MERCH",
  titulo: "SMOL MERCH", sub: "UPDATE (Extended PO) · Boddaramji · Han BDAY · Miso · Stickers e mais",
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
