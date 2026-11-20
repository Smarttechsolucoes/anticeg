// PROMO MAKESTAR — álbuns a R$ 30 cada, pagamento imediato, envios em fevereiro/2027.
// A lista de álbuns está em promoMakestarLista.js (gerada da lista enviada pela dona); aqui ficam o preço e os textos.
import { MAKESTAR_BRUTO } from "./promoMakestarLista.js";

export const MAKESTAR_PRECO = 30;
export const fmtReais = n => "R$" + Number(n).toFixed(2).replace(".", ",");

// "opcoes" é o nome que o painel admin (AdminSmolMerch) espera em cada grupo
export const MAKESTAR_GRUPOS = MAKESTAR_BRUTO.map(g => {
  const itens = g.itens.map(([id, artista, titulo]) => ({ id, produto: artista, label: titulo, preco: MAKESTAR_PRECO }));
  return { id: g.id, nome: g.nome, itens, opcoes: itens };
});

// uma linha por álbum (usada no formulário, no painel admin e na exportação)
export const MAKESTAR_OPCOES = MAKESTAR_GRUPOS.flatMap(g => g.itens);

export const MAKESTAR_CFG = {
  tabela: "pedidos_promo_makestar", pasta: "promo-makestar", produto: "PROMO MAKESTAR",
  titulo: "PROMO MAKESTAR", sub: "Álbuns por R$ 30 cada",
  // encerrado em 20/11/2026: o card vai para "Encerrados" e a página não aceita mais pedido
  deadline: new Date("2026-11-20T10:30:00-03:00"), pedidosAte: "20/11/2026",
  preco: MAKESTAR_PRECO,
  // true = "em breve": a página mostra a lista, mas não aceita pedido. Trocar para false quando abrir.
  bloqueado: false,
  // link do grupo de atualizações; se for null o botão não aparece
  grupoWhatsapp: "https://chat.whatsapp.com/FSVT98wH4YA4gWu1WWfe76",
  // um bloco de avisos; **texto** = negrito
  avisos: [
    "Álbuns por **R$ 30 cada**.",
    "**Pagamento imediato**: o pedido é feito já com o pagamento (PIX ou cartão).",
    "**Alto risco de sold out**.",
    "Álbuns que têm **mais de uma versão** serão comprados de forma **aleatória**.",
    "Envios em **fevereiro/2027**.",
  ],
};

// itens do pedido para a exportação "Pedidos dos joiners": uma linha por unidade
export function makestarLinhas(p) {
  return (p.itens || []).flatMap(i => Array.from({ length: Math.max(0, Number(i.qtd) || 0) }, () => ({ item: `PROMO MAKESTAR — ${i.produto} · ${i.opcao}`, preco: i.preco })));
}
