// ── Catálogo ─────────────────────────────────────────────────────────────────
// Fotos da loja (BigCartel). `w=600` nos cards e `w=2000` só ao ampliar, para carregar rápido no celular.
export const foto = (arq, w = 600) => `https://assets.bigcartel.com/product_images/${arq}?auto=format&fit=max&w=${w}`;
export const fmtReais = n => "R$" + Number(n).toFixed(2).replace(".", ",");

export const SMOLMERCH_PRODUTOS = [
  { id: "carabiner", nome: "Boddaramji UFO Carabiner", foto: "417132855/carabiner.jpg", opcoes: [
    { id: "carabiner-miso",     label: "Carabiner (miso)",             preco: 40 },
    { id: "carabiner-completo", label: "Completo (carabiner + pets)",  preco: 55 },
    { id: "carabiner-richard",  label: "Somente Richard",              preco: 5.5 },
  ] },
  { id: "han-bday", nome: "Han BDAY", foto: "432579921/han+bday+sets.jpg", opcoes: [
    { id: "han-standee",  label: "Standee Acrílico", preco: 50 },
    { id: "han-adesivo",  label: "Adesivo",          preco: 10 },
    { id: "han-a5-print", label: "A5 Print",         preco: 10 },
  ] },
  { id: "miso-keychains", nome: "Miso Keychains", foto: "432580293/new+miso+keychains.jpg", opcoes: [
    { id: "miso-orange-black", label: "Orange Black Miso",  preco: 25 },
    { id: "miso-black-cat",    label: "Me & My Black Cat",  preco: 25 },
  ] },
  { id: "deco-stickers", nome: "Deco Stickers", foto: "432579141/Deco+Stickers+NEW.jpg", opcoes: [
    { id: "deco-byeolbit", label: "Byeolbit",      preco: 17 },
    { id: "deco-skz",      label: "Assorted SKZ",  preco: 17 },
    { id: "deco-tasy",     label: "Tasy Stay",     preco: 17 },
  ] },
  { id: "miso-sticker-set", nome: "Miso Sticker Set", foto: "432580485/miso+orange+black.jpg", opcoes: [
    { id: "miso-sticker-set", label: "Miso Sticker Set", preco: 13 },
  ] },
  { id: "house-id-holder", nome: "Boddaramji House ID Photo Holder", foto: "423228876/20260409_095606.jpg", opcoes: [
    { id: "house-id-holder", label: "ID Photo Holder", preco: 30 },
  ] },
  { id: "washi-tapes", nome: "Washi Tapes", foto: "423230922/Washi+Tapes.jpg", opcoes: [
    { id: "washi-minsung", label: "Minsung Quotes", preco: 18 },
    { id: "washi-ditto",   label: "Skzoo Dittos",   preco: 18 },
  ] },
  { id: "skzoo-pc-holders", nome: "SKZOO Acrylic Photocard Holders (7x13)", foto: "423232119/PG3_PC+Holders.jpg", opcoes: [
    { id: "skzoo-pc-wolfchan", label: "Wolf Chan",  preco: 40 },
    { id: "skzoo-pc-leebit",   label: "Leebit",     preco: 40 },
    { id: "skzoo-pc-dwaekki",  label: "Dwaekki",    preco: 40 },
    { id: "skzoo-pc-jiniret",  label: "Jiniret",    preco: 40 },
    { id: "skzoo-pc-quokka",   label: "Han Quokka", preco: 40 },
    { id: "skzoo-pc-bbokari",  label: "BbokAri",    preco: 40 },
    { id: "skzoo-pc-puppym",   label: "PuppyM",     preco: 40 },
    { id: "skzoo-pc-foxiny",   label: "FoxI.Ny",    preco: 40 },
  ] },
  { id: "pudding-choco", nome: "Lino Pudding & Han Choco", foto: "423229755/PG1_pudding+choco.jpg", opcoes: [
    { id: "lino-pudding", label: "Lino Pudding Keychain", preco: 30 },
    { id: "han-choco",    label: "Han Choco Keychain",    preco: 30 },
  ] },
  { id: "byeolbit-pvc", nome: "ByeolBit PVC PC Holder", foto: "423231669/PG3_Byeolbit+pc+holder.jpg", opcoes: [
    { id: "byeolbit-pvc", label: "PVC PC Holder", preco: 47 },
  ] },
];

// uma linha por opção, com o nome do produto junto (usada no formulário, no painel e na exportação)
export const SMOLMERCH_OPCOES = SMOLMERCH_PRODUTOS.flatMap(p => p.opcoes.map(o => ({ ...o, produto: p.nome })));

export const SMOLMERCH_CFG = {
  tabela: "pedidos_smolmerch", pasta: "smolmerch", produto: "SMOL MERCH",
  titulo: "SMOL MERCH", sub: "Boddaramji · Han BDAY · Miso · Stickers e mais",
  deadline: new Date("2026-10-16T23:59:59-03:00"), pedidosAte: "16/10/2026", pagarAte: "20/10",
  // false = o formulário só registra o pedido; a pessoa paga depois (sem PIX/cartão no formulário).
  // Para voltar a aceitar pagamento no formulário, troque para true.
  pagamentoAgora: false,
  // **texto** = negrito
  avisos: [
    "O formulário fica aberto até **16 de outubro**.",
    "O pagamento será **liberado em breve**.",
    "Ao fechar o pedido, ele **não poderá ser cancelado**.",
    "O frete e a previsão de envio serão **avisados em breve**.",
  ],
};

// itens do pedido para a exportação "Pedidos dos joiners": uma linha por unidade
export function smolmerchLinhas(p) {
  return (p.itens || []).flatMap(i => Array.from({ length: Math.max(0, Number(i.qtd) || 0) }, () => ({ item: `${i.produto} — ${i.opcao}`, preco: i.preco })));
}
