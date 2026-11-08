// Teste de navegador: (1) ativação que COMEÇA só pelo e-mail cadastrado (tela inicial) e (2) o "olhinho" de mostrar/ocultar senha. API simulada (Playwright); não toca no Supabase real.
// Uso:  VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois   node tests/joiner-email-olhinho.e2e.mjs
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PORTA = 5197, REF = "ghjfsmwwcfpfvrouyrka";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000005", email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-joiner`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j",
  user: { id: "00000000-0000-0000-0000-000000000005", aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

// cen: { cogDaConta (null = e-mail sem cadastro único), ativarStatus }
async function nova(cen = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.addInitScript(() => { localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1"); });
  const reg = { pedir: [], verify: 0, put: [], rpc: [], loginFn: 0 };
  await ctx.route("**/*", async route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/functions/v1/pedir-codigo-joiner")) { reg.pedir.push(JSON.parse(req.postData() || "{}")); return json(200, { ok: true }); }
    if (u.includes("/functions/v1/login-joiner")) { reg.loginFn++; return json(401, { error: "x" }); }
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/verify") { reg.verify++; const c = JSON.parse(req.postData() || "{}"); return c.token === "123456" ? json(200, sessao()) : json(403, { code: 403, error_code: "otp_expired", msg: "x" }); }
      if (p === "/user" && m === "PUT") { reg.put.push(JSON.parse(req.postData() || "{}").password); return json(200, sessao().user); }
      if (p === "/user") return json(200, sessao().user);
      if (p === "/logout") return route.fulfill({ status: 204, body: "" });
      return json(200, {});
    }
    if (u.includes("/rest/v1/rpc/cog_para_ativar")) { reg.rpc.push("cog_para_ativar"); return json(200, cen.cogDaConta === undefined ? "ana" : cen.cogDaConta); }
    if (u.includes("/rest/v1/rpc/ativar_minha_conta")) { reg.rpc.push("ativar:" + JSON.parse(req.postData() || "{}").p_cog); reg.ativou = true; return json(200, { status: cen.ativarStatus || "ok" }); }
    if (u.includes("/rest/v1/rpc/entrar_com_arroba")) { reg.rpc.push("entrar_com_arroba:" + JSON.parse(req.postData() || "{}").p_identificador); return json(200, { encontrado: true, cog: "ana", nome_site: "Ana", foto_perfil: null, conta_ativa: !!reg.ativou, ativacao_liberada: true }); }
    if (u.includes("/rest/v1/rpc/meu_estado_conta")) return json(200, reg.ativou ? { vinculada: true, concluido: false, joiner_id: 5, cog: "ana", nome_site: "Ana", arroba: "@ana", email_mascarado: "a***@exemplo.com" } : { vinculada: false });
    if (u.includes("/rest/v1/rpc/meu_cog")) return json(200, null);
    if (u.includes("supabase.co/rest/v1/")) { const objeto = (req.headers()["accept"] || "").includes("pgrst.object"); return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } }); }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const ir = async (page, caminho = "/") => { await page.goto(`http://localhost:${PORTA}${caminho}`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); };
const entradaInicial = async (page, valor) => { await page.getByPlaceholder("@ da rede social ou e-mail").fill(valor); await page.getByRole("button", { name: /ENTRAR/ }).click(); await page.waitForTimeout(700); };

{ // 1) entrada inicial pelo E-MAIL: abre a ativação com o e-mail já preenchido e o @ em branco; o pedido vai SÓ com o e-mail
  const T = await nova(); const { page, reg } = T; await ir(page);
  await entradaInicial(page, "  Ana@Exemplo.com ");
  const modal = page.getByTestId("ativacao-modal");
  ok(await modal.count() === 1, "e-mail na tela inicial: abre a ativação (em vez de recusar)");
  ok(await modal.getByLabel("E-mail do cadastro").inputValue() === "ana@exemplo.com", "o e-mail digitado já vem preenchido (minúsculo, sem espaços)");
  ok(await modal.getByLabel("Seu @ cadastrado").inputValue() === "" && (await modal.innerText()).includes("pode deixar em branco"), "o @ fica em branco e é opcional");
  ok(!reg.rpc.some(r => r.startsWith("entrar_com_arroba")), "nada foi consultado antes (nenhuma resposta que revele se o e-mail existe)");
  await modal.getByLabel("Crie sua senha").fill("senha-boa-123"); await modal.getByLabel("Repita a senha").fill("senha-boa-123");
  await modal.getByRole("button", { name: "Enviar código de confirmação" }).click(); await page.waitForTimeout(700);
  ok(reg.pedir.length === 1 && JSON.stringify(reg.pedir[0]) === JSON.stringify({ email: "ana@exemplo.com" }), "o pedido do código vai SÓ com o e-mail (sem @)");
  ok((await modal.innerText()).toLowerCase().includes("código"), "avança para a tela do código");
  await modal.getByLabel(/código/i).first().fill("123456");
  await modal.getByRole("button", { name: /Confirmar/ }).click(); await page.waitForTimeout(1500);
  ok(reg.verify === 1 && reg.put.length === 1 && reg.put[0] === "senha-boa-123", "código confirmado e senha definida");
  ok(JSON.stringify(reg.rpc.filter(r => r !== "meu_cog")).includes("cog_para_ativar") && reg.rpc.includes("ativar:ana"), "sem @ digitado: o servidor informa o @ da conta e só então ativa (ativar_minha_conta)");
  ok(reg.rpc.some(r => r === "entrar_com_arroba:ana"), "depois de ativar, entra pelo @ da conta (acesso simples) e o perfil assume");
  ok(await page.getByTestId("ativacao-modal").count() === 0, "o pop-up de ativação fecha");
  const txt = await page.locator("body").innerText();
  ok(/Confira seus dados|Concluir/i.test(txt), "abre a confirmação do perfil (conta recém-ativada)");
  ok(T.erros.length === 0, "sem erro de script"); await T.browser.close();
}
{ // 2) e-mail sem cadastro único: o servidor não devolve @ => "falta uma conferência", sem ativar
  const T = await nova({ cogDaConta: null }); const { page, reg } = T; await ir(page);
  await entradaInicial(page, "dividido@exemplo.com");
  const modal = page.getByTestId("ativacao-modal");
  await modal.getByLabel("Crie sua senha").fill("senha-boa-123"); await modal.getByLabel("Repita a senha").fill("senha-boa-123");
  await modal.getByRole("button", { name: "Enviar código de confirmação" }).click(); await page.waitForTimeout(600);
  await modal.getByLabel(/código/i).first().fill("123456"); await modal.getByRole("button", { name: /Confirmar/ }).click(); await page.waitForTimeout(1200);
  ok(!reg.rpc.some(r => r.startsWith("ativar:")) && (await modal.innerText()).includes("conferência"), "e-mail sem cadastro único: não ativa nada e pede a conferência da administração");
  await T.browser.close();
}
{ // 3) com @ preenchido o fluxo continua o de sempre (pedido com @ e e-mail)
  const T = await nova(); const { page, reg } = T; await ir(page);
  await entradaInicial(page, "ana");
  const modal = page.getByTestId("ativacao-modal");
  ok(await modal.count() === 1 && await modal.getByLabel("Seu @ cadastrado").inputValue() === "ana", "entrada pelo @ continua abrindo a ativação com o @");
  await modal.getByLabel("E-mail do cadastro").fill("ana@exemplo.com"); await modal.getByLabel("Crie sua senha").fill("senha-boa-123"); await modal.getByLabel("Repita a senha").fill("senha-boa-123");
  await modal.getByRole("button", { name: "Enviar código de confirmação" }).click(); await page.waitForTimeout(700);
  ok(reg.pedir.length === 1 && JSON.stringify(reg.pedir[0]) === JSON.stringify({ cog: "ana", email: "ana@exemplo.com" }), "com @: o pedido segue com @ e e-mail");
  await T.browser.close();
}
{ // 4) olhinho: mostra/oculta SEM enviar o formulário e sem perder o conteúdo (pop-up de ativação e tela de login)
  const T = await nova(); const { page, reg } = T; await ir(page);
  await entradaInicial(page, "ana@exemplo.com");
  const modal = page.getByTestId("ativacao-modal");
  const senha = modal.getByLabel("Crie sua senha"), repetir = modal.getByLabel("Repita a senha");
  await senha.fill("segredo-ABC-123"); await repetir.fill("segredo-ABC-123");
  const olhos = modal.getByTestId("olhinho-senha");
  ok(await olhos.count() === 2 && await senha.getAttribute("type") === "password" && await repetir.getAttribute("type") === "password", "ativação: dois campos de senha, cada um com olhinho, começam ocultos");
  await olhos.nth(0).click();
  ok(await senha.getAttribute("type") === "text" && await senha.inputValue() === "segredo-ABC-123" && await repetir.getAttribute("type") === "password", "olhinho do 1º campo mostra a senha sem perder o texto e sem mexer no outro campo");
  ok(await olhos.nth(0).getAttribute("aria-pressed") === "true" && (await olhos.nth(0).getAttribute("aria-label")) === "Ocultar senha", "o botão avisa o estado (Ocultar senha / aria-pressed)");
  await olhos.nth(0).click();
  ok(await senha.getAttribute("type") === "password" && await senha.inputValue() === "segredo-ABC-123" && (await olhos.nth(0).getAttribute("aria-label")) === "Mostrar senha", "clicar de novo oculta, mantendo o conteúdo");
  await olhos.nth(1).click(); ok(await repetir.getAttribute("type") === "text" && await repetir.inputValue() === "segredo-ABC-123", "olhinho do campo de repetir funciona por conta própria");
  await page.waitForTimeout(400);
  ok(reg.pedir.length === 0 && await modal.getByLabel("E-mail do cadastro").inputValue() === "ana@exemplo.com" && (await modal.innerText()).includes("Enviar código de confirmação"), "alternar o olhinho NÃO envia o formulário nem muda de tela nem apaga os outros campos");
  const caixa = await olhos.nth(0).boundingBox(); ok(caixa && caixa.width >= 40 && caixa.height >= 40, "o olhinho tem área de toque de pelo menos 40 px (celular)");
  // tela de login (senha)
  await modal.getByTestId("ativacao-ja-tenho-conta").click(); await page.waitForTimeout(400);
  const loginSenha = modal.getByLabel("Senha", { exact: true });
  await loginSenha.fill("minha-senha-xyz"); await modal.getByTestId("olhinho-senha").click();
  ok(await loginSenha.getAttribute("type") === "text" && await loginSenha.inputValue() === "minha-senha-xyz" && reg.loginFn === 0, "login: o olhinho mostra a senha sem tentar entrar");
  ok(T.erros.length === 0, "sem erro de script"); await T.browser.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
