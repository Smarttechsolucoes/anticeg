// Teste de navegador do ENVIO de comprovante e dos PEDIDOS com o login novo LIGADO (D2 + J5), com a API simulada (Playwright). Não toca no Supabase real.
// Prova que: (1) sem conta ativada a página de pedido NÃO abre o formulário e nada é enviado; (2) com conta ativada o comprovante NÃO sobe direto no Storage: o site pede autorização à função
// comprovante-upload, envia com o token de uso único e só então registra o pedido pela função segura; (3) com o login novo DESLIGADO o site segue como hoje.
// Uso:  VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   (login novo LIGADO)   e   npx vite --port 5199 --strictPort   (DESLIGADO: comportamento de hoje)
// depois `node tests/comprovantes.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const REF = "ghjfsmwwcfpfvrouyrka";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000002", email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-joiner`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j",
  user: { id: "00000000-0000-0000-0000-000000000002", aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

async function fluxo(porta, { comSessao }) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
  await ctx.addInitScript(([sess, ref]) => { localStorage.setItem("anticeg_session_v", "5"); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    if (sess) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess)); }, [comSessao ? sessao() : null, REF]);
  const reg = { funcoes: [], storage: [], rpc: [], diretoStorage: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/functions/v1/comprovante-upload")) { const c = JSON.parse(req.postData() || "{}"); reg.funcoes.push(c); return json(200, { ok: true, bucket: c.bucket, path: c.path, token: "token-de-uso-unico", tipo: "image/png" }); }
    if (u.includes("/storage/v1/object/upload/sign/")) { reg.storage.push({ url: new URL(u).pathname, token: new URL(u).searchParams.get("token"), metodo: m }); return json(200, { Key: "ok" }); }
    if (u.includes("/storage/v1/object/") && m === "POST") { reg.diretoStorage.push(new URL(u).pathname); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "ok" }) }); }
    if (u.includes("/rest/v1/rpc/")) {
      const nome = new URL(u).pathname.split("/").pop(); const corpo = JSON.parse(req.postData() || "{}"); reg.rpc.push({ nome, corpo });
      if (nome === "pedido_loja_criar") return json(200, { ok: true, id: "123" });
      if (nome === "meu_cog") return json(200, comSessao ? "ana" : null);
      return json(200, null);
    }
    if (u.includes("supabase.co/auth/v1/")) { const p = new URL(u).pathname.replace("/auth/v1", ""); if (p === "/user") return json(200, sessao().user); if (p === "/logout") return route.fulfill({ status: 204, body: "" }); return json(200, {}); }
    if (u.includes("supabase.co/rest/v1/")) { const objeto = (req.headers()["accept"] || "").includes("pgrst.object"); return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } }); }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  await page.goto(`http://localhost:${porta}/dazed-seungmin`, { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  return { browser, page, reg, erros };
}
async function preencherEEnviar(page) {
  await page.getByPlaceholder("Seu nome").fill("Teste Fictícia"); await page.getByPlaceholder("seu@email.com").fill("teste@exemplo.com");
  await page.getByRole("button", { name: "+" }).first().click();
  await page.locator('input[type="file"]').setInputFiles({ name: "comprovante.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await page.getByRole("button", { name: /CONFIRMAR PEDIDO/ }).click(); await page.waitForTimeout(1500);
}

{ // login novo LIGADO, SEM conta ativada: não abre o formulário
  const { browser, page, reg, erros } = await fluxo(5197, { comSessao: false });
  ok(await page.getByTestId("exige-conta").count() === 1 && await page.getByPlaceholder("seu@email.com").count() === 0, "sem conta ativada: a página de pedido mostra 'Entre na sua conta' e NÃO mostra o formulário");
  ok(reg.funcoes.length === 0 && reg.diretoStorage.length === 0 && !reg.rpc.some(r => r.nome === "pedido_loja_criar"), "e nada é enviado nem registrado");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await browser.close();
}
{ // login novo LIGADO, com conta ativada (ana)
  const { browser, page, reg, erros } = await fluxo(5197, { comSessao: true });
  ok(await page.getByTestId("exige-conta").count() === 0 && await page.getByPlaceholder("seu@email.com").count() === 1, "com conta ativada: o formulário de pedido abre");
  await preencherEEnviar(page); const corpo = await page.locator("body").innerText();
  ok(reg.funcoes.length === 1 && reg.funcoes[0].bucket === "comprovantes" && /^dazed-seungmin\/\d+\.png$/.test(reg.funcoes[0].path) && reg.funcoes[0].tamanho > 0, "pede autorização à função comprovante-upload com bucket, caminho, tipo e tamanho: " + JSON.stringify(reg.funcoes[0]));
  ok(reg.diretoStorage.length === 0, "NÃO envia direto para o Storage (nenhum POST em /storage/v1/object/comprovantes)");
  ok(reg.storage.length === 1 && reg.storage[0].token === "token-de-uso-unico" && reg.storage[0].url.includes("/comprovantes/"), "envia o arquivo com o token de uso único (upload assinado)");
  const pedido = reg.rpc.find(r => r.nome === "pedido_loja_criar");
  ok(pedido && pedido.corpo.p_tabela === "pedidos_dazed_seungmin" && /\/storage\/v1\/object\/public\/comprovantes\/dazed-seungmin\/\d+\.png$/.test(pedido.corpo.p_dados.comprovante_url), "só depois registra o pedido pela função segura, guardando o endereço do comprovante: " + (pedido ? pedido.corpo.p_dados.comprovante_url.slice(-40) : "sem pedido"));
  ok(corpo.includes("Pedido registrado"), "a tela confirma o pedido");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await browser.close();
}
{ // login novo DESLIGADO (5199): comportamento de hoje (formulário aberto a todos e envio direto)
  const { browser, page, reg } = await fluxo(5199, { comSessao: false });
  ok(await page.getByTestId("exige-conta").count() === 0 && await page.getByPlaceholder("seu@email.com").count() === 1, "com o recurso DESLIGADO a página de pedido abre como hoje");
  await preencherEEnviar(page);
  ok(reg.funcoes.length === 0 && reg.diretoStorage.length === 1, "com o recurso DESLIGADO o site segue como hoje: envio direto, nenhuma função nova");
  await browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
