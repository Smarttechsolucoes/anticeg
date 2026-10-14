// Sondagem das funções de e-mail e push, SOMENTE com a chave pública do site. Não envia e-mail nem push (todas as chamadas usam dados inválidos de propósito).
// Uso: node scripts/testar-notificacoes.mjs
import { readFileSync } from "node:fs";
const fonte = readFileSync(new URL("../src/supabase.js", import.meta.url), "utf8");
// por padrão sonda a produção; para o projeto de ENSAIO: $env:SONDAR_URL e $env:SONDAR_CHAVE (chave pública anon do ensaio)
const BASE = (process.env.SONDAR_URL || fonte.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0]).replace(/\/$/, "");
const CHAVE = process.env.SONDAR_CHAVE || fonte.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0];
let falhas = 0;
async function chamar(funcao, corpo) {
  try {
    const r = await fetch(`${BASE}/functions/v1/${funcao}`, { method: "POST", headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    let msg = ""; try { msg = (await r.json()).error || ""; } catch { /* sem corpo */ }
    return { status: r.status, msg };
  } catch (e) { return { status: 0, msg: String(e).slice(0, 60) }; }
}
function linha(rotulo, obtido, esperados) {
  const ok = esperados.includes(obtido.status);
  if (!ok) falhas++;
  console.log(`${ok ? "OK   " : "FALHA"} ${rotulo}: HTTP ${obtido.status}${obtido.msg ? ` (${obtido.msg})` : ""}  [esperado ${esperados.join(" ou ")}]`);
}

console.log("== funções NOVAS (precisam estar implantadas) ==");
const novas = await chamar("email-evento", { evento: "comprovante_recebido", demanda_id: -1 });
if (novas.status === 404) console.log("AVISO email-evento ainda NÃO está implantada (HTTP 404). Os testes abaixo só valem depois do deploy.");
linha("e-mail no formato ANTIGO (to_email/assunto/corpo) é recusado", await chamar("email-evento", { to_email: "x@y.com", assunto: "a", corpo: "b" }), [400]);
linha("campo extra junto do evento é recusado", await chamar("email-evento", { evento: "comprovante_recebido", demanda_id: -1, to_email: "x@y.com" }), [400]);
linha("evento de administração sem login", await chamar("email-evento", { evento: "lembrete_pagamento", joiner_cog: "__inexistente__" }), [401]);
linha("evento inexistente", await chamar("email-evento", { evento: "toString" }), [400]);
linha("comprovante com id inexistente (modo legado 404 | depois do lançamento 401)", await chamar("email-evento", { evento: "comprovante_recebido", demanda_id: -1 }), [404, 401]);
linha("aviso de cadastro novo para um @ inexistente (404; 401 depois do lançamento)", await chamar("email-evento", { evento: "novo_cadastro", joiner_cog: "__inexistente__" }), [404, 401]);
linha("push sem login de administradora", await chamar("push-evento", { subscription: { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "a", auth: "b" } }, title: "t", body: "b" }), [401]);

console.log("\n== funções ANTIGAS (a brecha: devem ficar 410 depois da validação) ==");
const velhaEmail = await chamar("send-email", {});           // corpo vazio: nunca envia
const velhaPush = await chamar("send-push", {});             // corpo vazio: nunca envia
console.log(`send-email: HTTP ${velhaEmail.status}${velhaEmail.msg ? ` (${velhaEmail.msg})` : ""}  ${velhaEmail.status === 410 ? "=> descontinuada (brecha fechada)" : velhaEmail.status === 400 ? "=> AINDA ATIVA (aceita pedidos públicos)" : ""}`);
console.log(`send-push : HTTP ${velhaPush.status}${velhaPush.msg ? ` (${velhaPush.msg})` : ""}  ${velhaPush.status === 410 ? "=> descontinuada (brecha fechada)" : velhaPush.status === 400 ? "=> AINDA ATIVA (aceita pedidos públicos)" : ""}`);

console.log(falhas ? `\n${falhas} verificação(ões) fora do esperado` : "\nFunções novas como esperado");
process.exit(0);
