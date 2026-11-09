// Teste de navegador do formulário ODD & FRESH POP-UP com PAGAMENTO IMEDIATO (PIX ou cartão) — API simulada (Playwright); NÃO toca no Supabase real e nenhum pagamento acontece.
// Prova: aberto sem data para fechar; total correto; PIX e cartão exigem comprovante; sem comprovante nada é registrado; falha no envio não finge sucesso.
// Uso: VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois `node tests/odd-popup-pagamento.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PORTA = 5197, REF = "ghjfsmwwcfpfvrouyrka", UID = "00000000-0000-0000-0000-000000000005";
const ANA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", email: "ana@exemplo.com", twitter: "@ana", confirmado: true };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j",
  user: { id: UID, aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function nova(cen = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 420, height: 1000 } });
  await ctx.addInitScript(([u, ref, s]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_at_v2", String(Date.now()));
    localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s));
  }, [ANA, REF, sessao()]);
  const reg = { insert: [], upload: [], put: 0 };
  await ctx.route("**/*", async route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/functions/v1/comprovante-upload")) { const c = JSON.parse(req.postData() || "{}"); reg.upload.push(c); return cen.uploadErro ? json(400, { error: "arquivo não permitido" }) : json(200, { ok: true, bucket: c.bucket, path: c.path, token: "tok", tipo: "image/png" }); }
    if (u.includes("/storage/v1/object/upload/sign")) { reg.put++; return json(200, { Key: "comprovantes/x" }); }
    if (u.includes("supabase.co/auth/v1/")) { const p = new URL(u).pathname.replace("/auth/v1", ""); if (p === "/user") return json(200, sessao().user); if (p === "/logout") return route.fulfill({ status: 204, body: "" }); return json(200, {}); }
    const rpc = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(u);
    if (rpc) { const nome = rpc[1]; if (nome === "meu_estado_conta") return json(200, { vinculada: true, concluido: true, joiner_id: 5, cog: "ana", nome_site: "Ana", arroba: "@ana", email_mascarado: "a***@exemplo.com" }); if (nome === "meu_cog") return json(200, "ana"); if (nome === "is_admin") return json(200, false); return json(200, null); }
    if (u.includes("/rest/v1/formulario_pedidos") && m === "POST") { reg.insert.push(JSON.parse(req.postData() || "[]")[0]); return cen.insertErro ? json(400, { message: "falha" }) : json(201, [{ id: 777 }]); }
    if (u.includes("supabase.co/rest/v1/")) { const objeto = (req.headers()["accept"] || "").includes("pgrst.object"); return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } }); }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const abrir = async page => { await page.goto(`http://localhost:${PORTA}/odd-fresh-popup`, { waitUntil: "networkidle" }); await page.waitForTimeout(1200); };
const corpo = page => page.locator("body").innerText();
const selecionar = async page => { const bt = page.getByRole("button", { name: "SELECIONAR", exact: true }); await bt.nth(6).click(); await bt.nth(0).click(); await page.waitForTimeout(300); };   // BANDANA (80) e HOODIE (395)
const enviar = page => page.getByRole("button", { name: /Enviar pedido e comprovante/ });

{ // aberto, total, PIX
  const T = await nova(); const { page, reg, erros } = T; await abrir(page);
  const t0 = await corpo(page);
  ok(!/PEDIDOS ENCERRADOS|Pedidos encerrados/.test(t0), "o formulário está ABERTO (sem aviso de encerrado)");
  ok(/PAGAMENTO IMEDIATO/i.test(t0) && !/05\/NOV|08\/NOV|até: 05|até: 08/i.test(t0), "mostra 'pagamento imediato' e NÃO mostra mais as datas de 05/NOV e 08/NOV");
  ok(await page.getByTestId("wm-pagamento").count() === 0, "sem item escolhido, o bloco de pagamento não aparece");
  await selecionar(page);
  ok(/Total: R\$ 475,00/.test(await page.getByTestId("wm-total").innerText()), "total = HOODIE R$395 + BANDANA R$80 = R$ 475,00");
  ok(await enviar(page).isDisabled(), "o botão de enviar fica desligado até escolher a forma e anexar o comprovante");
  await page.getByTestId("wm-forma-pix").click();
  const pix = await page.getByTestId("wm-pix").innerText();
  ok(/R\$ 475,00/.test(pix) && /de1a489d-db81-4864-a8cf-74cdd79d9cdc/.test(pix), "PIX: mostra o valor e a chave");
  ok(await enviar(page).isDisabled(), "PIX sem comprovante: continua desligado");
  await page.getByTestId("wm-comprovante").setInputFiles({ name: "comprovante.png", mimeType: "image/png", buffer: PNG });
  ok(!(await enviar(page).isDisabled()), "com a forma e o comprovante, o botão liga");
  await enviar(page).click(); await page.waitForTimeout(1500);
  ok(reg.upload.length === 1 && reg.upload[0].bucket === "comprovantes" && /^odd-fresh-popup\/\d+\.png$/.test(reg.upload[0].path) && reg.put === 1, "o comprovante sobe pelo envio autorizado (pasta odd-fresh-popup) antes do pedido");
  const i = reg.insert[0];
  ok(reg.insert.length === 1 && i.evento === "ODD & FRESH POP-UP" && i.joiner_cog === "ana" && i.forma_pagamento === "pix" && i.valor_total === 475 && /odd-fresh-popup\/\d+\.png/.test(i.comprovante_url) && i.status === "pendente", "o pedido grava forma 'pix', valor 475, comprovante e status pendente");
  ok(/Itens: .*HOODIE.*· Qtd: 1 · Pagamento: PIX · Total: R\$ 475,00/.test(i.observacoes) || (/HOODIE/.test(i.observacoes) && /Pagamento: PIX · Total: R\$ 475,00/.test(i.observacoes)), "as observações trazem itens, forma e total (aparecem no painel e no histórico)");
  ok(await page.getByTestId("wm-enviado").count() === 1 && /comprovante enviados/.test(await page.getByTestId("wm-enviado").innerText()), "mensagem de sucesso fala de pedido e comprovante");
  ok(await page.getByTestId("wm-pagamento").count() === 1 && await page.getByRole("button", { name: /Enviar outro pedido/ }).isDisabled(), "depois de enviar, o formulário pede nova forma e novo comprovante (não reaproveita)");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : "")); await T.browser.close();
}
{ // cartão
  const T = await nova(); const { page, reg } = T; await abrir(page); await selecionar(page);
  await page.getByTestId("wm-forma-cartao").click();
  const c = await page.getByTestId("wm-cartao").innerText();
  ok(/R\$ 475,00/.test(c) && /anexe o comprovante/.test(c), "cartão: mostra o valor a pagar e avisa que o comprovante é anexado depois de pagar");
  ok(await page.getByTestId("wm-cartao-link").getAttribute("href") === "https://linknabio.gg/anticeg-comu", "cartão: o link é a página de pagamento de sempre");
  ok(await enviar(page).isDisabled(), "cartão sem comprovante: desligado");
  await page.getByTestId("wm-comprovante").setInputFiles({ name: "cartao.png", mimeType: "image/png", buffer: PNG }); await enviar(page).click(); await page.waitForTimeout(1500);
  ok(reg.insert.length === 1 && reg.insert[0].forma_pagamento === "cartao" && reg.insert[0].valor_total === 475 && /Pagamento: Cartão · Total: R\$ 475,00/.test(reg.insert[0].observacoes), "cartão: grava forma 'cartao', valor e comprovante");
  await T.browser.close();
}
{ // falhas: nada é registrado sem comprovante e nada finge sucesso
  const T = await nova({ uploadErro: true }); const { page, reg } = T; await abrir(page); await selecionar(page);
  await page.getByTestId("wm-forma-pix").click(); await page.getByTestId("wm-comprovante").setInputFiles({ name: "c.png", mimeType: "image/png", buffer: PNG }); await enviar(page).click(); await page.waitForTimeout(1200);
  ok(reg.insert.length === 0 && /Erro ao enviar o comprovante/.test(await corpo(page)) && await page.getByTestId("wm-enviado").count() === 0, "falha no envio do comprovante: NENHUM pedido é registrado e aparece o erro");
  await T.browser.close();
  const U = await nova({ insertErro: true }); await abrir(U.page); await selecionar(U.page);
  await U.page.getByTestId("wm-forma-pix").click(); await U.page.getByTestId("wm-comprovante").setInputFiles({ name: "c.png", mimeType: "image/png", buffer: PNG }); await enviar(U.page).click(); await U.page.waitForTimeout(1200);
  ok(/Erro ao enviar/.test(await corpo(U.page)) && await U.page.getByTestId("wm-enviado").count() === 0, "falha ao registrar o pedido: mostra o erro e não finge sucesso");
  await U.browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
