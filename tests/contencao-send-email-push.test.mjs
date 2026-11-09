// Contenção de send-email e send-push (funções antigas abertas): nenhum código do site ou do sync pode depender delas; as substitutas fazem o que as antigas faziam de legítimo.
// Rodar: node --test tests/contencao-send-email-push.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const lerArq = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("as funções antigas, como estão no repositório, só respondem 410 e não enviam nada", () => {
  for (const f of ["send-email", "send-push"]) {
    const src = lerArq(`supabase/functions/${f}/index.ts`);
    assert.match(src, /status: 410/); assert.doesNotMatch(src, /sendgrid|webpush|fetch\(|createClient|Deno\.env/i, f + " não pode ter lógica de envio");
  }
});
test("nenhum código do site (src/) invoca send-email ou send-push", () => {
  for (const f of ["src/LandingPage.jsx", "src/App.jsx", "src/AdminContas.jsx", "src/JoinerAuth.jsx", "src/SmolMerch.jsx"]) {
    let src = ""; try { src = lerArq(f); } catch { continue; }
    assert.doesNotMatch(src, /invoke\(\s*["'`]send-(email|push)["'`]/, f);
    assert.doesNotMatch(src, /functions\/v1\/send-(email|push)/, f);
  }
});
test("o aviso 'conferir planilha' da landing page vai pelo evento do servidor, sem destinatário nem texto vindos do navegador", () => {
  const src = lerArq("src/LandingPage.jsx");
  assert.match(src, /invoke\("email-evento", \{ body: \{ evento: "planilha_atencao", joiner_cog: cog \} \}\)/);
  assert.doesNotMatch(src, /to_email|corpo:|assunto:/, "o navegador não escolhe destinatário, assunto nem corpo");
});
test("o sync envia push pelo push-evento (mesmo corpo, chave de serviço) e nunca pela função antiga", () => {
  const src = lerArq("scripts/sync-masterlist.js");
  assert.match(src, /PUSH_URL = `\$\{process\.env\.SUPABASE_URL\}\/functions\/v1\/push-evento`/);
  assert.doesNotMatch(src, /functions\/v1\/send-(push|email)/);
  assert.match(src, /'Authorization': `Bearer \$\{process\.env\.SUPABASE_SERVICE_KEY\}`/, "continua autenticando com a chave de serviço");
  assert.match(src, /subscription: \{ endpoint: s\.endpoint, keys: \{ p256dh: s\.p256dh, auth: s\.auth \} \}/);
});
test("o push-evento aceita o corpo que o sync envia (subscription + title + body + url) quando a chamada é do serviço", async () => {
  const { validarPush } = await import("../supabase/functions/_shared/notificacoes.ts");
  const corpo = { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p".repeat(40), auth: "a".repeat(16) } }, title: "ANTICEG — CEG1", body: "Item: Comprado ✓", url: "/masterlist" };
  const r = validarPush(corpo, "servico"); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(validarPush(corpo, "anonimo").ok, false, "visitante não envia");
});
