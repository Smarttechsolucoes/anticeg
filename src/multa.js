// Regra de multa por atraso (R$ por dia, por componente: item, frete ou taxa RF).
// Os dias são contados em DIAS DE CALENDÁRIO no horário de Brasília, igual ao banco (registrar_multa_paga):
// vencia ontem => 1 dia de atraso desde o primeiro minuto de hoje (antes a conta usava meio-dia x meia-noite e só contava o 2º dia).

// R$3 por dia para prazos a partir de 01/10/2026, R$1 para os anteriores
export const MULTA_NOVA_DESDE = "2026-10-01";

const MS_DIA = 86400000;
const hojeBR = (agora = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora); // "2026-10-28"
const emDias = iso => Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / MS_DIA;

export function diasAtraso(vencimento, agora = new Date()) {
  if (!vencimento) return 0;
  const diff = Math.round(emDias(hojeBR(agora)) - emDias(vencimento));
  return diff > 0 ? diff : 0;
}

export function multaPorDia(vencimento) {
  return vencimento && String(vencimento).slice(0, 10) >= MULTA_NOVA_DESDE ? 3 : 1;
}

export function multaAtraso(vencimento, agora = new Date()) {
  return diasAtraso(vencimento, agora) * multaPorDia(vencimento);
}

// dias até vencer: 0 = vence hoje, 1 = amanhã, -1 = venceu ontem
export function diasParaVencer(vencimento, agora = new Date()) {
  if (!vencimento) return null;
  return Math.round(emDias(vencimento) - emDias(hojeBR(agora)));
}
