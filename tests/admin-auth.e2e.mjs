// Teste de navegador do login de administrador (Playwright, API de autenticação simulada). Não toca no Supabase real.
// Uso: em dois terminais -> `npx vite --port 5199 --strictPort` e `VITE_ADMIN_AUTH_OBRIGATORIA=true npx vite --port 5198 --strictPort`; depois `node tests/admin-auth.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const SHOTS = process.env.SHOTS;
const USER = { id: 1, cog: "nandaverseo_c", nome: "Teste Admin", nome_site: "Teste", email: "teste@exemplo.com", twitter: "@nandaverseo_c", confirmado: true };
const ANON_KEY_FRAGMENT = "eyJ"; // a chave anônima começa assim; o token do admin tem outro valor
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";

const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = aal => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: ADMIN_ID, email: "dona@exemplo.com", role: "authenticated", aal, amr: [{ method: "password", timestamp: 1 }], session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-${aal}`;
const sessao = (aal, fatores) => ({ access_token: jwt(aal), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-" + aal,
  user: { id: ADMIN_ID, aud: "authenticated", role: "authenticated", email: "dona@exemplo.com", factors: fatores, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });
const FATOR_OK = { id: "f-ok", factor_type: "totp", status: "verified", friendly_name: "app", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };

// cenário: { senhaCerta, fatores (do usuário), codigoCerto, ehAdmin }
async function nova(porta, cen) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  await ctx.addInitScript(u => { localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "4"); localStorage.setItem("anticeg_session_at_v2", String(Date.now())); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1"); }, USER);
  const reg = { rpc: [], restAuth: [], logout: 0, enrolls: 0, unenrolls: 0 };
  const est = { fatores: cen.fatores.slice(), aal: "aal1", logado: false };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/token" && u.includes("grant_type=password")) {
        const corpo = JSON.parse(req.postData() || "{}");
        if (corpo.password !== cen.senhaCerta) return json(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        est.logado = true; est.aal = "aal1"; return json(200, sessao("aal1", est.fatores));
      }
      if (p === "/user" && m === "GET") return json(200, sessao(est.aal, est.fatores).user);
      if (p === "/user" && m === "PUT") { const c = JSON.parse(req.postData() || "{}"); reg.putSenha = (reg.putSenha || []).concat([c.password]); if (c.password === "mesma-senha-atual-1") return json(422, { code: 422, error_code: "same_password", msg: "New password should be different from the old password." }); return json(200, sessao(est.aal, est.fatores).user); }
      if (p === "/factors" && m === "POST") { reg.enrolls++; est.fatores = est.fatores.concat([{ id: "f-novo", factor_type: "totp", status: "unverified", friendly_name: "novo" }]);
        return json(200, { id: "f-novo", type: "totp", friendly_name: "novo", totp: { qr_code: "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10'/></svg>", secret: "SEGREDOTESTE123", uri: "otpauth://totp/x" } }); }
      if (/^\/factors\/[^/]+$/.test(p) && m === "DELETE") { reg.unenrolls++; est.fatores = est.fatores.filter(f => f.id !== p.split("/")[2]); return json(200, { id: p.split("/")[2] }); }
      if (/\/challenge$/.test(p)) return json(200, { id: "c1", expires_at: Math.floor(Date.now() / 1000) + 300 });
      if (/\/verify$/.test(p)) {
        const corpo = JSON.parse(req.postData() || "{}");
        if (corpo.code !== cen.codigoCerto) return json(400, { code: 400, error_code: "mfa_verification_failed", msg: "Invalid TOTP code entered" });
        est.fatores = est.fatores.map(f => ({ ...f, status: "verified" })); est.aal = "aal2";
        return json(200, sessao("aal2", est.fatores));
      }
      if (p === "/logout") { reg.logout++; est.logado = false; return route.fulfill({ status: 204, body: "" }); }
      return json(200, {});
    }
    if (u.includes("supabase.co/rest/v1/rpc/is_admin")) { reg.rpc.push(req.headers()["authorization"] || ""); return json(200, cen.ehAdmin); }
    if (u.includes("supabase.co/rest/v1/")) {
      if (req.method() === "GET") reg.restAuth.push(req.headers()["authorization"] || "");
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      if (u.includes("/rest/v1/joiners") && objeto) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(USER) });
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, ctx, page, reg, est, erros };
}
const abrir = async (page, porta) => { await page.goto(`http://localhost:${porta}/admin`, { waitUntil: "networkidle" }); await page.waitForTimeout(500); };
const corpo = page => page.locator("body").innerText();
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };

// ── 1) modo AVISO (porta 5199): painel segue funcionando; login opcional ────────────────────────
{
  const T = await nova(5199, { senhaCerta: "senha-certa-123", fatores: [], codigoCerto: "123456", ehAdmin: true }); const { page, reg, erros } = T;
  await abrir(page, 5199);
  ok(await page.getByTestId("admin-auth-aviso").count() === 1, "modo aviso: aparece a barra 'Acesso seguro (MFA) ainda não verificado'");
  ok((await corpo(page)).includes("Pagamentos"), "modo aviso: o painel de admin continua aparecendo e funcionando (sem bloqueio)");
  await shot(page, "1-aviso");
  await page.getByRole("button", { name: "Entrar com MFA" }).click();
  ok(await page.getByLabel("E-mail do administrador").count() === 1, "clicar em 'Entrar com MFA' abre o formulário");
  // senha errada
  await page.getByLabel("E-mail do administrador").fill("dona@exemplo.com"); await page.getByLabel("Senha").fill("errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(500);
  ok((await corpo(page)).includes("E-mail ou senha incorretos."), "senha errada: mensagem clara e sem detalhes técnicos");
  ok(reg.rpc.length === 0, "senha errada: nenhuma verificação de admin foi feita");
  // senha certa, sem fator -> cadastro
  await page.getByLabel("Senha").fill("senha-certa-123"); await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(600);
  ok((await corpo(page)).includes("Ative a verificação em duas etapas"), "login ok sem app cadastrado: pede para ativar a verificação em duas etapas");
  ok(reg.rpc.length === 0, "aal1: o painel ainda NÃO considera a pessoa admin (nenhuma consulta is_admin antes do MFA)");
  await page.getByRole("button", { name: "Gerar QR Code" }).click(); await page.waitForTimeout(600);
  ok(await page.getByAltText("QR Code para o app autenticador").count() === 1 && (await corpo(page)).includes("SEGREDOTESTE123"), "mostra o QR Code e a chave para digitar à mão");
  await shot(page, "2-qr");
  await page.getByLabel("Código de 6 dígitos").fill("000000"); await page.getByRole("button", { name: "Ativar" }).click(); await page.waitForTimeout(500);
  ok((await corpo(page)).includes("Código inválido ou expirado"), "código errado: mensagem clara");
  ok(await page.getByTestId("admin-auth-ok").count() === 0, "código errado: não libera");
  await page.getByLabel("Código de 6 dígitos").fill("12"); await page.getByRole("button", { name: "Ativar" }).click(); await page.waitForTimeout(300);
  ok((await corpo(page)).includes("Digite os 6 números"), "código incompleto: avisa sem chamar o servidor");
  await page.getByLabel("Código de 6 dígitos").fill("123 456"); await page.getByRole("button", { name: "Ativar" }).click(); await page.waitForTimeout(800);
  ok(await page.getByTestId("admin-auth-ok").count() === 1 && (await corpo(page)).includes("Sessão segura verificada (MFA)"), "código certo: 'Sessão segura verificada (MFA)'");
  ok(reg.rpc.length >= 1 && reg.rpc.every(a => a.includes("assinatura-aal2")), "is_admin() só foi chamado com o token aal2 (depois do MFA)");
  await shot(page, "3-ok");
  // trocar a própria senha
  await page.getByTestId("admin-auth-ok").getByRole("button", { name: "Trocar senha" }).click();
  await page.getByLabel("Nova senha", { exact: true }).fill("curta"); await page.getByLabel("Repita a nova senha").fill("curta"); await page.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(300);
  ok((await corpo(page)).includes("pelo menos 12 caracteres") && !reg.putSenha, "trocar senha: senha curta é recusada sem chamar o servidor");
  await page.getByLabel("Nova senha", { exact: true }).fill("uma-senha-bem-longa-1"); await page.getByLabel("Repita a nova senha").fill("outra-senha-bem-longa-2"); await page.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(300);
  ok((await corpo(page)).includes("diferentes") && !reg.putSenha, "trocar senha: as duas digitações diferentes são recusadas sem chamar o servidor");
  await page.getByLabel("Nova senha", { exact: true }).fill("mesma-senha-atual-1"); await page.getByLabel("Repita a nova senha").fill("mesma-senha-atual-1"); await page.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(500);
  ok((await corpo(page)).includes("precisa ser diferente da atual"), "trocar senha: o servidor recusa senha igual à atual e a mensagem é clara");
  await page.getByLabel("Nova senha", { exact: true }).fill("uma-senha-bem-longa-1"); await page.getByLabel("Repita a nova senha").fill("uma-senha-bem-longa-1"); await page.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(600);
  ok((await corpo(page)).includes("Senha alterada.") && reg.putSenha.at(-1) === "uma-senha-bem-longa-1", "trocar senha: senha válida é enviada e aparece \"Senha alterada.\"");
  ok(await page.getByTestId("admin-auth-ok").count() === 1, "trocar senha: a sessão segura continua ativa depois da troca");
  await page.getByRole("button", { name: "Fechar" }).click(); await page.waitForTimeout(200);
  // isolamento: o site continua usando só a chave anônima
  await page.waitForTimeout(300); const antes = reg.restAuth.length;
  await page.getByText("Pagamentos", { exact: false }).first().click().catch(() => {}); await page.waitForTimeout(600);
  const usaramToken = reg.restAuth.filter(a => a.includes("assinatura-")).length;
  ok(reg.restAuth.length > 0 && usaramToken === 0, `ISOLAMENTO: nenhuma das ${reg.restAuth.length} consultas do site usou o token do admin (continuam com a chave anônima)`);
  // sessão persiste ao recarregar
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(800);
  ok(await page.getByTestId("admin-auth-ok").count() === 1, "recarregar a página: a sessão MFA continua válida");
  // sair
  await page.getByTestId("admin-auth-ok").getByRole("button", { name: "Sair" }).click(); await page.waitForTimeout(600);
  ok(await page.getByTestId("admin-auth-aviso").count() === 1 && T.reg.logout === 1, "sair: volta ao aviso e encerra a sessão no servidor");
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(500);
  ok(await page.getByTestId("admin-auth-aviso").count() === 1, "depois de sair e recarregar: continua sem sessão");
  ok(erros.length === 0, "nenhum erro de JavaScript na página" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}

// ── 2) já tem app cadastrado: pede só o código ───────────────────────────────────────────────
{
  const T = await nova(5199, { senhaCerta: "s", fatores: [FATOR_OK], codigoCerto: "654321", ehAdmin: true }); const { page, reg } = T;
  await abrir(page, 5199);
  await page.getByRole("button", { name: "Entrar com MFA" }).click();
  await page.getByLabel("E-mail do administrador").fill("dona@exemplo.com"); await page.getByLabel("Senha").fill("s");
  await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(600);
  ok((await corpo(page)).includes("Confirme com o app autenticador"), "com app já cadastrado: pede apenas o código de 6 dígitos");
  ok(await page.getByAltText("QR Code para o app autenticador").count() === 0 && T.reg.enrolls === 0, "não gera QR Code novo quando já existe fator verificado");
  await page.getByLabel("Código de 6 dígitos").fill("111111"); await page.getByRole("button", { name: "Confirmar" }).click(); await page.waitForTimeout(500);
  ok((await corpo(page)).includes("Código inválido ou expirado"), "código errado: recusado");
  await page.getByLabel("Código de 6 dígitos").fill("654321"); await page.getByRole("button", { name: "Confirmar" }).click(); await page.waitForTimeout(800);
  ok(await page.getByTestId("admin-auth-ok").count() === 1, "código certo: liberado");
  await T.browser.close();
}

// ── 3) MFA ok, mas a conta NÃO é admin ──────────────────────────────────────────────────────
{
  const T = await nova(5199, { senhaCerta: "s", fatores: [FATOR_OK], codigoCerto: "654321", ehAdmin: false }); const { page } = T;
  await abrir(page, 5199);
  await page.getByRole("button", { name: "Entrar com MFA" }).click();
  await page.getByLabel("E-mail do administrador").fill("outra@exemplo.com"); await page.getByLabel("Senha").fill("s");
  await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(500);
  await page.getByLabel("Código de 6 dígitos").fill("654321"); await page.getByRole("button", { name: "Confirmar" }).click(); await page.waitForTimeout(800);
  ok((await corpo(page)).includes("Conta sem permissão"), "conta com MFA mas fora de admin_roles: 'Conta sem permissão'");
  ok(await page.getByTestId("admin-auth-ok").count() === 0, "não mostra 'sessão segura' para quem não é admin");
  await T.browser.close();
}

// ── 4) modo OBRIGATÓRIO (porta 5198): sem login o painel NÃO abre ────────────────────────────
{
  const T = await nova(5198, { senhaCerta: "s", fatores: [FATOR_OK], codigoCerto: "654321", ehAdmin: true }); const { page } = T;
  await abrir(page, 5198);
  const t0 = await corpo(page);
  ok(await page.getByTestId("admin-auth-card").count() === 1 && !t0.includes("Pagamentos"), "modo obrigatório: sem login só aparece o formulário; o painel NÃO é renderizado");
  await shot(page, "4-bloqueado");
  await page.getByLabel("E-mail do administrador").fill("dona@exemplo.com"); await page.getByLabel("Senha").fill("s");
  await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(500);
  ok(!(await corpo(page)).includes("Pagamentos"), "modo obrigatório: só com senha (aal1) o painel continua fechado");
  await page.getByLabel("Código de 6 dígitos").fill("654321"); await page.getByRole("button", { name: "Confirmar" }).click(); await page.waitForTimeout(900);
  ok((await corpo(page)).includes("Pagamentos") && await page.getByTestId("admin-auth-ok").count() === 1, "modo obrigatório: com senha + código MFA + is_admin o painel abre");
  await T.browser.close();
}
{ // obrigatório e NÃO admin: continua fechado
  const T = await nova(5198, { senhaCerta: "s", fatores: [FATOR_OK], codigoCerto: "654321", ehAdmin: false }); const { page } = T;
  await abrir(page, 5198);
  await page.getByLabel("E-mail do administrador").fill("outra@exemplo.com"); await page.getByLabel("Senha").fill("s");
  await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(500);
  await page.getByLabel("Código de 6 dígitos").fill("654321"); await page.getByRole("button", { name: "Confirmar" }).click(); await page.waitForTimeout(900);
  ok(!(await corpo(page)).includes("Pagamentos") && (await corpo(page)).includes("Conta sem permissão"), "modo obrigatório: conta que não é admin NÃO abre o painel, mesmo com MFA");
  await T.browser.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
