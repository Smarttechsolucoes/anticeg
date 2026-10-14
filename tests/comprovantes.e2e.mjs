// Teste de navegador do ENVIO de comprovante com o login novo LIGADO (J5), com a API simulada (Playwright). Não toca no Supabase real.
// Prova que o comprovante NÃO sobe direto no Storage: o site pede autorização à função comprovante-upload, envia com o token de uso único e só então registra o pedido pela função segura.
// Uso:  VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   (login novo LIGADO)   e   npx vite --port 5199 --strictPort   (DESLIGADO: comportamento de hoje)
// depois `node tests/comprovantes.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };

async function fluxo(porta) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
  await ctx.addInitScript(() => { localStorage.setItem("anticeg_session_v", "5"); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1"); });
  const reg = { funcoes: [], storage: [], rpc: [], diretoStorage: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/functions/v1/comprovante-upload")) { const c = JSON.parse(req.postData() || "{}"); reg.funcoes.push(c); return json(200, { ok: true, bucket: c.bucket, path: c.path, token: "token-de-uso-unico", tipo: "image/png" }); }
    if (u.includes("/storage/v1/object/upload/sign/")) { reg.storage.push({ url: new URL(u).pathname, token: new URL(u).searchParams.get("token"), metodo: m, tipo: req.headers()["content-type"] }); return json(200, { Key: "ok" }); }
    if (u.includes("/storage/v1/object/") && m === "POST") { reg.diretoStorage.push(new URL(u).pathname); return json(403, { message: "row-level security" }); }
    if (u.includes("/rest/v1/rpc/")) {
      const nome = new URL(u).pathname.split("/").pop(); const corpo = JSON.parse(req.postData() || "{}"); reg.rpc.push({ nome, corpo });
      if (nome === "pedido_loja_criar") return json(200, { ok: true, id: "123" });
      return json(200, null);
    }
    if (u.includes("supabase.co/auth/v1/")) return json(200, {});
    if (u.includes("supabase.co/rest/v1/")) { const objeto = (req.headers()["accept"] || "").includes("pgrst.object"); return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } }); }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  await page.goto(`http://localhost:${porta}/dazed-seungmin`, { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  await page.getByPlaceholder("Seu nome").fill("Teste Fictícia"); await page.getByPlaceholder("seu@email.com").fill("teste@exemplo.com");
  await page.getByRole("button", { name: "+" }).first().click();                         // 1 unidade da primeira capa
  await page.locator('input[type="file"]').setInputFiles({ name: "comprovante.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await page.getByRole("button", { name: /CONFIRMAR PEDIDO/ }).click(); await page.waitForTimeout(1500);
  const corpo = await page.locator("body").innerText();
  return { browser, reg, erros, corpo };
}

{ // login novo LIGADO (5197)
  const { browser, reg, erros, corpo } = await fluxo(5197);
  ok(reg.funcoes.length === 1 && reg.funcoes[0].bucket === "comprovantes" && /^dazed-seungmin\/\d+\.png$/.test(reg.funcoes[0].path) && reg.funcoes[0].tamanho > 0, "pede autorização à função comprovante-upload com bucket, caminho, tipo e tamanho: " + JSON.stringify(reg.funcoes[0]));
  ok(reg.diretoStorage.length === 0, "NÃO envia direto para o Storage (nenhum POST em /storage/v1/object/comprovantes)");
  ok(reg.storage.length === 1 && reg.storage[0].token === "token-de-uso-unico" && reg.storage[0].url.includes("/comprovantes/"), "envia o arquivo com o token de uso único (upload assinado)");
  const pedido = reg.rpc.find(r => r.nome === "pedido_loja_criar");
  ok(pedido && pedido.corpo.p_tabela === "pedidos_dazed_seungmin" && /\/storage\/v1\/object\/public\/comprovantes\/dazed-seungmin\/\d+\.png$/.test(pedido.corpo.p_dados.comprovante_url), "só depois registra o pedido pela função segura, guardando o endereço do comprovante: " + (pedido ? pedido.corpo.p_dados.comprovante_url.slice(-40) : "sem pedido"));
  ok(corpo.includes("Pedido registrado"), "a tela confirma o pedido");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await browser.close();
}
{ // login novo DESLIGADO (5199): comportamento de hoje (envio direto)
  const { browser, reg } = await fluxo(5199);
  ok(reg.funcoes.length === 0 && reg.diretoStorage.length === 1, "com o recurso DESLIGADO o site segue como hoje: envio direto, nenhuma função nova");
  await browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
