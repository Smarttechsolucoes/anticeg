// Regra de multa por atraso (R$ por dia, por componente: item, frete ou taxa RF).
// Os dias são contados em DIAS DE CALENDÁRIO no horário de Brasília, igual ao banco (registrar_multa_paga):
// vencia ontem => 1 dia de atraso desde o primeiro minuto de hoje (antes a conta usava meio-dia x meia-noite e só contava o 2º dia).

// R$3 por dia para prazos a partir de 01/10/2026, R$1 para os anteriores
export const MULTA_NOVA_DESDE = "2026-10-01";

// Joiners que NUNCA pagam multa (o mesmo vale no banco: supabase/p0-02/V6_sem_multa_ifelixcollector_aplicar.sql)
export const COGS_ISENTOS_MULTA = ["ifelixcollector"];
export const isentoMulta = cog => !!cog && COGS_ISENTOS_MULTA.includes(String(cog).toLowerCase());

const MS_DIA = 86400000;
const hojeBR = (agora = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora); // "2026-10-28"
const emDias = iso => Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / MS_DIA;

export function diasAtraso(vencimento, agora = new Date()) {
  if (!vencimento) return 0;
  const diff = Math.round(emDias(hojeBR(agora)) - emDias(vencimento));
  return diff > 0 ? diff : 0;
}

// PAUSA DO ACRÉSCIMO DIÁRIO NA MIGRAÇÃO PARA O ACESSO COM SENHA (decisão de 08/11/2026): de 14/11 a 20/11/2026, INCLUSIVE, no horário de Brasília, o dia NÃO soma multa; a cobrança diária volta em 21/11.
// Só o acréscimo é pausado: as multas acumuladas até 13/11 continuam, os dias pausados nunca são cobrados depois (a conta é "dias de atraso menos dias pausados", sempre) e vencimentos, pagamentos e valores dos itens não mudam.
// `diasAtraso` continua sendo o atraso REAL (decide "atrasado" ou "no prazo"); quem calcula VALOR de multa usa `diasCobradosMulta`.
export const MULTA_PAUSA = { de: "2026-11-14", ate: "2026-11-20" };

// quantos dos dias de atraso (datas d com vencimento < d <= hoje) caem dentro da pausa
export function diasPausados(vencimento, agora = new Date()) {
  if (!vencimento) return 0;
  const inicio = Math.max(emDias(vencimento) + 1, emDias(MULTA_PAUSA.de));
  const fim = Math.min(emDias(hojeBR(agora)), emDias(MULTA_PAUSA.ate));
  return fim >= inicio ? Math.round(fim - inicio + 1) : 0;
}

// dias que realmente geram multa
export function diasCobradosMulta(vencimento, agora = new Date()) {
  return Math.max(0, diasAtraso(vencimento, agora) - diasPausados(vencimento, agora));
}

export function multaPorDia(vencimento) {
  return vencimento && String(vencimento).slice(0, 10) >= MULTA_NOVA_DESDE ? 3 : 1;
}

export function multaAtraso(vencimento, agora = new Date()) {
  return diasCobradosMulta(vencimento, agora) * multaPorDia(vencimento);
}

// multa do item de um joiner (0 para os isentos); `item` é a linha da masterlist (precisa do cog)
export function multaDoItem(item, vencimento, agora = new Date()) {
  return isentoMulta(item && item.cog) ? 0 : multaAtraso(vencimento, agora);
}

// dias até vencer: 0 = vence hoje, 1 = amanhã, -1 = venceu ontem
export function diasParaVencer(vencimento, agora = new Date()) {
  if (!vencimento) return null;
  return Math.round(emDias(vencimento) - emDias(hojeBR(agora)));
}
