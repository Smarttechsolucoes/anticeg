// Teste de navegador do login de administrador (e-mail + senha), com a API de autenticação simulada (Playwright). Não toca no Supabase real.
// Uso: em dois terminais ->
//   VITE_ADMIN_AUTH_OBRIGATORIA=false npx vite --port 5199 --strictPort   (modo aviso: painel abre, login opcional, PIN antigo continua)
//   npx vite --port 5198 --strictPort                                     (padrão: painel só abre depois do login, sem PIN)
// depois `node tests/admin-auth.e2e.mjs`. Para ver o layout: VP=390x800 SHOTS=<pasta> node tests/admin-auth.e2e.mjs
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const SHOTS = process.env.SHOTS;
const USER = { id: 1, cog: "nandaverseo_c", nome: "Teste Admin", nome_site: "Teste", email: "teste@exemplo.com", twitter: "@nandaverseo_c", confirmado: true };
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";

const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: ADMIN_ID, email: "dona@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-admin`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-1",
  user: { id: ADMIN_ID, aud: "authenticated", role: "authenticated", email: "dona@exemplo.com", factors: [], app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

// cenário: { senhaCerta, ehAdmin }
async function nova(porta, cen) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: (() => { const [w, h] = (process.env.VP || "1100x1000").split("x").map(Number); return { width: w, height: h }; })() });
  await ctx.addInitScript(u => { localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "4"); localStorage.setItem("anticeg_session_at_v2", String(Date.now())); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1"); }, USER);
  const reg = { rpc: [], restAuth: [], logout: 0, putSenha: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/token" && u.includes("grant_type=password")) {
        const corpo = JSON.parse(req.postData() || "{}");
        if (corpo.password !== cen.senhaCerta) return json(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        return json(200, sessao());
      }
      if (p === "/user" && m === "GET") return json(200, sessao().user);
      if (p === "/user" && m === "PUT") {
        const c = JSON.parse(req.postData() || "{}"); reg.putSenha.push(c.password);
        if (c.password === "mesma-senha-atual-1") return json(422, { code: 422, error_code: "same_password", msg: "New password should be different from the old password." });
        return json(200, sessao().user);
      }
      if (p === "/logout") { reg.logout++; return route.fulfill({ status: 204, body: "" }); }
      return json(200, {});
    }
    if (u.includes("supabase.co/rest/v1/rpc/is_admin")) { reg.rpc.push(req.headers()["authorization"] || ""); return json(200, cen.ehAdmin); }
    if (u.includes("supabase.co/rest/v1/")) {
      if (m === "GET") reg.restAuth.push(req.headers()["authorization"] || "");
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      if (u.includes("/rest/v1/config") && u.includes("admin_pin") && objeto) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: "123456" }) });
      if (u.includes("/rest/v1/joiners") && objeto) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(USER) });
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const abrir = async (page, porta) => { await page.goto(`http://localhost:${porta}/admin`, { waitUntil: "networkidle" }); await page.waitForTimeout(500); };
const corpo = page => page.locator("body").innerText();
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };
const entrar = async (page, email, senha) => { await page.getByLabel("E-mail do administrador").fill(email); await page.getByLabel("Senha", { exact: true }).fill(senha); await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(700); };

// ── 1) modo AVISO (porta 5199): painel abre; login opcional ───────────────────────────────────
{
  const T = await nova(5199, { senhaCerta: "senha-certa-123", ehAdmin: true }); const { page, reg, erros } = T;
  await abrir(page, 5199);
  ok(await page.getByTestId("admin-auth-aviso").count() === 1, "modo aviso: aparece a barra 'Acesso de administrador ainda não verificado'");
  ok((await corpo(page)).includes("Pagamentos"), "modo aviso: o painel de admin continua abrindo (sem bloqueio)");
  await shot(page, "1-aviso");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  ok(await page.getByLabel("E-mail do administrador").count() === 1 && await page.getByLabel("Código de 6 dígitos").count() === 0, "o formulário pede só e-mail e senha (sem código, sem QR Code)");
  await shot(page, "1b-form");
  await entrar(page, "dona@exemplo.com", "errada");
  ok((await corpo(page)).includes("E-mail ou senha incorretos.") && reg.rpc.length === 0, "senha errada: mensagem clara e nenhuma verificação de admin");
  await entrar(page, "dona@exemplo.com", "senha-certa-123");
  ok(await page.getByTestId("admin-auth-ok").count() === 1 && (await corpo(page)).includes("Acesso de administrador verificado"), "senha certa: 'Acesso de administrador verificado'");
  ok(reg.rpc.length >= 1 && reg.rpc.every(a => a.includes("assinatura-admin")), "is_admin() foi consultado com o token da conta de admin");
  ok(!(await corpo(page)).includes("QR Code") && !(await corpo(page)).includes("autenticador"), "nenhuma menção a QR Code ou app autenticador");
  await shot(page, "2-ok");
  // trocar a própria senha
  await page.getByTestId("admin-auth-ok").getByRole("button", { name: "Trocar senha" }).click();
  await page.getByLabel("Nova senha", { exact: true }).fill("curta"); await page.getByLabel("Repita a nova senha").fill("curta"); await page.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(300);
  ok((await corpo(page)).includes("pelo menos 12 caracteres") && reg.putSenha.length === 0, "trocar senha: senha curta recusada sem chamar o servidor");
  await page.getByLabel("Nova senha", { exact: true }).fill("uma-senha-bem-longa-1"); await page.getByLabel("Repita a nova senha").fill("outra-senha-bem-longa-2"); await page.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(300);
  ok((await corpo(page)).includes("diferentes") && reg.putSenha.length === 0, "trocar senha: digitações diferentes recusadas sem chamar o servidor");
  await page.getByLabel("Nova senha", { exact: true }).fill("mesma-senha-atual-1"); await page.getByLabel("Repita a nova senha").fill("mesma-senha-atual-1"); await page.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(500);
  ok((await corpo(page)).includes("precisa ser diferente da atual"), "trocar senha: o servidor recusa senha igual à atual, com mensagem clara");
  await page.getByLabel("Nova senha", { exact: true }).fill("uma-senha-bem-longa-1"); await page.getByLabel("Repita a nova senha").fill("uma-senha-bem-longa-1"); await page.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(600);
  ok((await corpo(page)).includes("Senha alterada.") && reg.putSenha.at(-1) === "uma-senha-bem-longa-1" && await page.getByTestId("admin-auth-ok").count() === 1, "trocar senha: senha válida enviada, 'Senha alterada.' e a sessão continua");
  await page.getByRole("button", { name: "Fechar" }).click(); await page.waitForTimeout(200);
  // isolamento
  await page.getByText("Pagamentos", { exact: false }).first().click().catch(() => {}); await page.waitForTimeout(600);
  ok(reg.restAuth.length > 0 && reg.restAuth.filter(a => a.includes("assinatura-")).length === 0, `ISOLAMENTO: nenhuma das ${reg.restAuth.length} consultas do site usou o token do admin (seguem com a chave anônima)`);
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(800);
  ok(await page.getByTestId("admin-auth-ok").count() === 1, "recarregar a página: continua logado (não pede senha de novo)");
  await page.getByTestId("admin-auth-ok").getByRole("button", { name: "Sair" }).click(); await page.waitForTimeout(600);
  ok(await page.getByTestId("admin-auth-aviso").count() === 1 && reg.logout === 1, "sair: volta ao aviso e encerra a sessão no servidor");
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(500);
  ok(await page.getByTestId("admin-auth-aviso").count() === 1, "depois de sair e recarregar: continua sem sessão");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}

// ── 2) conta que NÃO é admin ──────────────────────────────────────────────────────────────────
{
  const T = await nova(5199, { senhaCerta: "s", ehAdmin: false }); const { page } = T;
  await abrir(page, 5199);
  await page.getByRole("button", { name: "Entrar", exact: true }).click(); await entrar(page, "outra@exemplo.com", "s");
  ok((await corpo(page)).includes("Conta sem permissão") && await page.getByTestId("admin-auth-ok").count() === 0, "conta fora de admin_roles: 'Conta sem permissão'");
  await T.browser.close();
}

// ── 3) modo PADRÃO (porta 5198): o painel só abre depois do login ─────────────────────────────
{
  const T = await nova(5198, { senhaCerta: "s", ehAdmin: true }); const { page } = T;
  await abrir(page, 5198);
  ok(await page.getByTestId("admin-auth-card").count() === 1 && !(await corpo(page)).includes("Pagamentos"), "sem login: só o formulário aparece; o painel NÃO é renderizado");
  await shot(page, "3-bloqueado");
  await entrar(page, "dona@exemplo.com", "errada");
  ok(!(await corpo(page)).includes("Pagamentos"), "senha errada: o painel continua fechado");
  await entrar(page, "dona@exemplo.com", "s");
  ok((await corpo(page)).includes("Pagamentos") && await page.getByTestId("admin-auth-ok").count() === 1, "senha certa de admin: o painel abre");
  await T.browser.close();
}
{
  const T = await nova(5198, { senhaCerta: "s", ehAdmin: false }); const { page } = T;
  await abrir(page, 5198); await entrar(page, "outra@exemplo.com", "s");
  ok(!(await corpo(page)).includes("Pagamentos") && (await corpo(page)).includes("Conta sem permissão"), "conta que não é admin NÃO abre o painel, mesmo logada");
  await T.browser.close();
}

// ── 4) o PIN: modo aviso mantém; modo padrão não pede ─────────────────────────────────────────
for (const [porta, padrao] of (Number((process.env.VP || "1100x1000").split("x")[0]) < 700 ? [] : [[5199, false], [5198, true]])) { // em tela estreita as abas de cima ficam escondidas (o site usa a barra de baixo)
  const T = await nova(porta, { senhaCerta: "s", ehAdmin: true }); const { page } = T;
  await page.goto(`http://localhost:${porta}/`, { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  await page.locator(".tab-btn", { hasText: "Admin" }).first().click(); await page.waitForTimeout(500);
  const t = await corpo(page);
  if (padrao) ok(!t.includes("insira o PIN de acesso") && await page.getByTestId("admin-auth-card").count() === 1, "modo padrão: NÃO pede PIN; vai direto para e-mail e senha");
  else ok(t.includes("insira o PIN de acesso"), "modo aviso: o PIN continua como hoje (nada muda até o login obrigatório)");
  await T.browser.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
