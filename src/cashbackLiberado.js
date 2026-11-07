// Uso do saldo de reembolso (cashback) no pagamento. Sem login o banco não sabe de quem é o saldo, então o uso fica BLOQUEADO até o login estar ativo
// (supabase/seguranca/Q6e). Os saldos continuam guardados e aparecem normalmente; só a opção de "aplicar" fica indisponível.
export const CASHBACK_LIBERADO = import.meta.env.VITE_JOINERS_AUTH === "true";
