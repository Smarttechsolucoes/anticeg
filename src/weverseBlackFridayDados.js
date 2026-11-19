// ── Formulário WEVERSE BLACK FRIDAY ───────────────────────────────────────────────────────────────
// A pessoa paga R$ 10 (PIX, imediato) para ter acesso ao endereço da organização na Coreia do Sul.
// A compra na Weverse é de responsabilidade do cliente; as informações seguem no grupo do WhatsApp.
// Usa o mesmo formulário e o mesmo painel dos outros forms de loja (SmolMerchFormPage / AdminSmolMerch).
export const fotoWbf = arq => `/weverse-black-friday/${encodeURIComponent(arq)}`;

export const WBF_LINK_GRUPO = "https://chat.whatsapp.com/Hp2pUaXtOiO9fhmL1TfzkC";

export const WBF_PRODUTOS = [
  {
    id: "acesso-endereco", nome: "ACESSO AO ENDEREÇO NA COREIA DO SUL", foto: "endereco-oculto.jpg", maxPorOpcao: 1,   // foto com o endereço, o código e o telefone COBERTOS
    avisos: ["Um acesso por pessoa."],
    opcoes: [{ id: "acesso-endereco-weverse-black-friday", label: "Acesso ao endereço (Weverse Black Friday)", preco: 10 }],
  },
];

export const WBF_CFG = {
  tabela: "pedidos_weverse_black_friday", pasta: "weverse-black-friday", produto: "WEVERSE BLACK FRIDAY",
  titulo: "WEVERSE BLACK FRIDAY", sub: "Acesso ao endereço na Coreia do Sul",
  // prazo ainda não informado: sem data, o formulário não fecha sozinho
  deadline: null, pedidosAte: null, pagarAte: null,
  grupoWhatsapp: WBF_LINK_GRUPO,
  bloqueado: false,
  ocultarSeCadastrada: false,
  dadosTravados: true,       // joiner cadastrada: dados do cadastro travados, com o botão "Editar"
  cabecalho: true,           // barra ANTICEG no topo
  aoVivo: false,             // sem abas Ao vivo / Histórico
  resumoPedido: true,        // lista o item marcado embaixo, para conferência
  fotoGrande: true,
  pagamentoAgora: true,
  acesso: true,              // depois que o pagamento for CONFIRMADO, o endereço aparece nesta página (vem do banco, não do código)
  aposPedido: "Assim que confirmarmos o seu pagamento, o endereço aparece aqui, nesta mesma página (entre de novo no link), e também será passado no grupo.",
  soPix: true,               // só PIX, pagamento imediato (sem "pagar depois" e sem cartão)
  confirmacao: "Estou ciente que a compra é de minha responsabilidade e que os dados precisam ser compatíveis com as informações enviadas após o pagamento",
  // **texto** = negrito
  avisos: [
    "Você paga **R$10** para ter acesso ao endereço da **COMUNIDADE** na Coreia do Sul.",
    "O pagamento é **IMEDIATO** e somente por **PIX**: anexe o comprovante.",
    "A compra na Weverse é de **responsabilidade do cliente**, caso não compre nada, será **reembolsado**.",
    "O valor pago **não se aplica para compras futuras**, apenas para essa Black Friday.",
    "Os dados da compra precisam ser **compatíveis com as informações que serão enviadas após o pagamento**.",
    "As informações sobre essas compras serão passadas no grupo do WhatsApp: " + WBF_LINK_GRUPO,
  ],
};
