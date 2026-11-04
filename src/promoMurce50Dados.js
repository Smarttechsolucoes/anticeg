// ── Catálogo do formulário PROMO-MURCE-50 (merchs da seller Murcekaly) ───────
// Fotos em public/promo-murce-50. Valores já convertidos para reais (informados pela organização).
// Usa o mesmo formulário e o mesmo painel do Murcekaly Itens (SmolMerchFormPage / AdminSmolMerch).
export const fotoPm = arq => `/promo-murce-50/${encodeURIComponent(arq)}`;

const MEMBROS = ["Bang Chan", "Lee Know", "Changbin", "Hyunjin", "Han", "Felix", "Seungmin", "I.N"];
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const PROMO_MURCE_50_PRODUTOS = [
  {
    id: "photocard-set", nome: "PHOTOCARD SET", foto: "PHOTOCARD SET.png",
    avisos: ["Precisa sair OT8: o set só sai se os 8 membros forem fechados."],
    opcoes: MEMBROS.map(m => ({ id: `photocard-set-${slug(m)}`, label: m, preco: 30 })),
  },
  {
    id: "zip-hoodie-do-it", nome: "ZIP UP HOODIE — DO IT POP-UP", foto: "HOODIE DO IT.png",
    // quando a quantidade for definida, colocar maxTotal na opção (o formulário passa a mostrar "restam N" e trava quando esgotar)
    avisos: ["Estoque limitado."],
    opcoes: [{ id: "zip-hoodie-do-it", label: "Zip Up Hoodie", preco: 95 }],
  },
];

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
