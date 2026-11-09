// Sondagem das funções de e-mail e push, SOMENTE com a chave pública do site. Não envia e-mail nem push (todas as chamadas usam dados inválidos de propósito).
// Uso: node scripts/testar-notificacoes.mjs
import { readFileSync } from "node:fs";
const fonte = readFileSync(new URL("../src/supabase.js", import.meta.url), "utf8");
// por padrão sonda a produção; para o projeto de ENSAIO: $env:SONDAR_URL e $env:SONDAR_CHAVE (chave pública anon do ensaio)
const BASE = (process.env.SONDAR_URL || fonte.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0]).replace(/\/$/, "");
const CHAVE = process.env.SONDAR_CHAVE || fonte.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0];
// Os casos SEM login (chave pública) e COM login (um usuário de verdade) são DIFERENTES: depois do lançamento o visitante recebe 401 ANTES de qualquer validação,
// e só quem está logada chega à validação (400). Para sondar o segundo caso informe o token de uma sessão qualquer: $env:SONDAR_TOKEN (nunca é impresso).
// Sem o token, esses casos aparecem como NÃO VERIFICADO (não são marcados como OK nem escondidos). Projeto de ENSAIO ainda no modo legado: $env:SONDAR_MODO_LEGADO=1.
const TOKEN = process.env.SONDAR_TOKEN || "";
const LEGADO = process.env.SONDAR_MODO_LEGADO === "1";
let falhas = 0, naoVerificadas = 0;
async function chamar(funcao, corpo, token = CHAVE) {
  try {
    const r = await fetch(`${BASE}/functions/v1/${funcao}`, { method: "POST", headers: { apikey: CHAVE, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
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
linha("SEM login, comprovante com id INVÁLIDO (-1): " + (LEGADO ? "modo legado valida e recusa (400)" : "barrado ANTES de validar (401)"), await chamar("email-evento", { evento: "comprovante_recebido", demanda_id: -1 }), [LEGADO ? 400 : 401]);
if (TOKEN) linha("COM login, comprovante com id INVÁLIDO (-1): recusado pela validação (400)", await chamar("email-evento", { evento: "comprovante_recebido", demanda_id: -1 }, TOKEN), [400]);
else { naoVerificadas++; console.log("NÃO VERIFICADO COM login, comprovante com id INVÁLIDO (-1) deveria ser 400: falta $env:SONDAR_TOKEN (o caso é coberto por teste de unidade em _shared/handlers.test.ts, não por esta sondagem)"); }
linha("comprovante com id válido mas inexistente (modo legado 404 | depois do lançamento 401)", await chamar("email-evento", { evento: "comprovante_recebido", demanda_id: 999999999 }), [404, 401]);
linha("aviso de cadastro novo para um @ inexistente (404; 401 depois do lançamento)", await chamar("email-evento", { evento: "novo_cadastro", joiner_cog: "__inexistente__" }), [404, 401]);
linha("push sem login de administradora", await chamar("push-evento", { subscription: { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "a", auth: "b" } }, title: "t", body: "b" }), [401]);

console.log("\n== funções de COMPROVANTE (Fase A; visitante recebe 401 e NADA é criado) ==");
const cu = await chamar("comprovante-upload", { bucket: "comprovantes", nome: "x.jpg", tipo: "image/jpeg", tamanho: 10 });
if (cu.status === 404) console.log("AVISO comprovante-upload ainda NÃO está implantada (HTTP 404).");
linha("comprovante-upload sem login é recusado", cu, [401]);
linha("comprovante-url sem login é recusado", await chamar("comprovante-url", { bucket: "comprovantes", path: "x/y.jpg" }), [401]);

console.log("\n== funções ANTIGAS (a brecha: devem ficar 410 depois da validação) ==");
const velhaEmail = await chamar("send-email", {});           // corpo vazio: nunca envia
const velhaPush = await chamar("send-push", {});             // corpo vazio: nunca envia
// as funções antigas precisam responder 410 (ou 404 se nunca existiram naquele projeto); 400 = AINDA ATIVA = falha
linha("send-email descontinuada (410), sem enviar nada", velhaEmail, [410, 404]);
linha("send-push descontinuada (410), sem enviar nada", velhaPush, [410, 404]);

if (naoVerificadas) console.log(`\n${naoVerificadas} verificação(ões) NÃO VERIFICADA(S) (nem OK nem falha): informe $env:SONDAR_TOKEN para executá-las`);
console.log(falhas ? `\n${falhas} verificação(ões) FORA DO ESPERADO` : "\nTodas as verificações executadas estão como esperado");
process.exit(falhas ? 1 : 0);   // antes saía sempre com 0 e escondia as falhas
