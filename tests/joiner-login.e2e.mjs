// Teste de navegador do J3: áreas protegidas, login com @ + senha, e-mail alternativo, recuperação e troca de senha (Playwright, API simulada).
// Não toca no Supabase real. Uso:
//   npx vite --port 5199 --strictPort                          (padrão: recurso DESLIGADO, o site se comporta como hoje)
//   VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   (recurso LIGADO)
// depois `node tests/joiner-login.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const REF = "ghjfsmwwcfpfvrouyrka";
const ANA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", email: "registrado@exemplo.com", twitter: "@ana", confirmado: true };
const OWNER = { id: 1, cog: "nandaverseo_c", nome: "Dona", nome_site: "Dona", email: "dona@exemplo.com", twitter: "@nandaverseo_c", confirmado: true };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000005", email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600, marca: "assinatura-joiner" })}.${Buffer.from("assinatura-valida").toString("base64url")}`;
const tokens = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j" });
const sessao = () => ({ ...tokens(), user: { id: "00000000-0000-0000-0000-000000000005", aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

function tokenDaJoiner(h) { try { const p = JSON.parse(Buffer.from(h.replace(/^Bearers+/i, "").split(".")[1], "base64url").toString()); return p.marca === "assinatura-joiner"; } catch { return false; } }

// cen: { usuario, versao, comSessao, cogDaConta, senhaCerta, limite, hash, destino }
async function nova(porta, cen) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(([u, v, sess, ref, destino]) => {
    if (u) { localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_at_v2", String(Date.now())); }
    localStorage.setItem("anticeg_session_v", v);
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    sessionStorage.setItem("anticeg_ativacao_dispensada", "1");     // o pop-up de ativação (J2) já foi tratado: aqui testamos o bloqueio
    if (destino) sessionStorage.setItem("anticeg_destino", destino);
    if (sess) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
  }, [cen.usuario === undefined ? ANA : cen.usuario, cen.versao || "5", cen.comSessao ? sessao() : null, REF, cen.destino || null]);
  const reg = { login: [], recuperar: [], put: [], emailLogin: [], rpc: [], restAuth: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/functions/v1/login-joiner")) { const c = JSON.parse(req.postData() || "{}"); reg.login.push(c); if (cen.limite) return json(429, { error: "Muitas tentativas." }); return c.senha === cen.senhaCerta ? json(200, tokens()) : json(401, { error: "@ ou senha incorretos." }); }
    if (u.includes("/functions/v1/recuperar-senha-joiner")) { reg.recuperar.push(JSON.parse(req.postData() || "{}")); return json(200, { ok: true, mensagem: "x" }); }
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/token" && u.includes("grant_type=password")) { const c = JSON.parse(req.postData() || "{}"); reg.emailLogin.push(c.email); return c.password === cen.senhaCerta ? json(200, sessao()) : json(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }); }
      if (p === "/user" && m === "PUT") { const c = JSON.parse(req.postData() || "{}"); reg.put.push(c.password); return json(200, sessao().user); }
      if (p === "/user") return json(200, sessao().user);
      if (p === "/logout") return route.fulfill({ status: 204, body: "" });
      return json(200, {});
    }
    if (u.includes("/rest/v1/rpc/is_admin")) return json(200, !!cen.ehAdmin && tokenDaJoiner(req.headers()["authorization"] || ""));
    if (u.includes("/rest/v1/rpc/meu_cog")) { const logada = tokenDaJoiner(req.headers()["authorization"] || ""); reg.rpc.push(logada); return json(200, logada ? (cen.cogDaConta ?? "ana") : null); }
    if (u.includes("supabase.co/rest/v1/")) {
      if (m === "GET") reg.restAuth.push(req.headers()["authorization"] || "");
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      if (u.includes("/rest/v1/joiners") && objeto) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cen.usuario ?? ANA) });
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const ir = async (page, porta, caminho, hash = "") => { await page.goto(`http://localhost:${porta}${caminho}${hash}`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); };
const corpo = page => page.locator("body").innerText();
const prompt = page => page.getByTestId("area-protegida");
const entrar = async (page, senha) => { await page.getByLabel("Senha", { exact: true }).fill(senha); await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(900); };

// ── 1) recurso DESLIGADO (5199): nada muda ────────────────────────────────────────────────────
{
  const T = await nova(5199, { versao: "4" });
  await ir(T.page, 5199, "/masterlist");
  ok(await prompt(T.page).count() === 0, "recurso desligado: nenhuma área é bloqueada (o site é igual ao de hoje)");
  await T.browser.close();
}

// ── 2) recurso LIGADO (5197): bloqueio, login, e-mail alternativo ─────────────────────────────
{
  const T = await nova(5197, { senhaCerta: "senha-boa-123" }); const { page, reg, erros } = T;
  await ir(page, 5197, "/masterlist");
  ok(await prompt(page).count() === 1, "modo simples (só @): a MASTERLIST pede senha");
  ok((await page.getByLabel("Seu @").inputValue()) === "@ana" && !(await prompt(page).innerText()).includes("registrado@exemplo.com"), "o pedido mostra o @ e nunca o e-mail do cadastro");
  for (const caminho of ["/perfil", "/envio", "/disponiveis", "/prevenda", "/wave-maker", "/claim"]) { await ir(page, 5197, caminho); ok(await prompt(page).count() === 1, `modo simples: ${caminho} pede senha`); }
  for (const caminho of ["/cegs", "/calendario", "/regras"]) { await ir(page, 5197, caminho); ok(await prompt(page).count() === 0, `áreas públicas continuam abertas sem senha: ${caminho}`); }

  await ir(page, 5197, "/masterlist");
  await entrar(page, "errada");
  ok((await corpo(page)).includes("@ ou senha incorretos.") && await prompt(page).count() === 1, "senha errada: mensagem neutra e a área continua fechada");
  await entrar(page, "senha-boa-123");
  ok(await prompt(page).count() === 0, "senha certa: a área abre no mesmo endereço (volta ao que a pessoa queria)");
  ok(reg.login.length === 2 && reg.login.every(c => Object.keys(c).sort().join() === "cog,senha" && c.cog === "ana"), "o navegador envia só {cog, senha}; o e-mail nunca trafega");
  ok(await page.evaluate(() => window.location.pathname) === "/masterlist", "continua na MASTERLIST");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}
{ // muitas tentativas
  const T = await nova(5197, { senhaCerta: "x", limite: true });
  await ir(T.page, 5197, "/masterlist"); await entrar(T.page, "qualquer");
  ok((await corpo(T.page)).includes("Muitas tentativas") && await prompt(T.page).count() === 1, "limite do servidor: mensagem amigável e a área continua fechada");
  await T.browser.close();
}
{ // e-mail + senha como alternativa
  const T = await nova(5197, { senhaCerta: "senha-boa-123" }); const { page, reg } = T;
  await ir(page, 5197, "/masterlist");
  await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
  await page.getByLabel("E-mail da conta").fill(" Ana@Exemplo.com "); await entrar(page, "errada");
  ok((await corpo(page)).includes("@ ou senha incorretos.") && await prompt(page).count() === 1, "e-mail + senha errada: recusado");
  await entrar(page, "senha-boa-123");
  ok(await prompt(page).count() === 0 && reg.emailLogin.at(-1) === "ana@exemplo.com", "e-mail + senha certa: abre a área");
  await T.browser.close();
}
{ // e-mail de OUTRA conta
  const T = await nova(5197, { senhaCerta: "senha-boa-123", cogDaConta: "bia" }); const { page } = T;
  await ir(page, 5197, "/masterlist");
  await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
  await page.getByLabel("E-mail da conta").fill("bia@exemplo.com"); await entrar(page, "senha-boa-123");
  ok((await corpo(page)).includes("não corresponde a este @") && await prompt(page).count() === 1, "e-mail e senha de OUTRA joiner: não abre a área deste @");
  await T.browser.close();
}
{ // esqueci minha senha e ativar conta
  const T = await nova(5197, {}); const { page, reg } = T;
  await ir(page, 5197, "/masterlist");
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page.getByRole("button", { name: "Enviar link de redefinição" }).click(); await page.waitForTimeout(600);
  ok(reg.recuperar.length === 1 && Object.keys(reg.recuperar[0]).join() === "cog" && reg.recuperar[0].cog === "ana", "recuperação: o navegador envia só o @");
  ok((await prompt(page).innerText()).includes("Se existir uma conta ativada") && !(await prompt(page).innerText()).includes("registrado@exemplo.com"), "recuperação: resposta neutra, sem mostrar e-mail");
  await page.getByRole("button", { name: "Voltar" }).click();
  await page.getByRole("button", { name: "Primeiro acesso? Ative sua conta" }).click(); await page.waitForTimeout(500);
  ok(await page.getByTestId("ativacao-modal").count() === 1, "'Primeiro acesso? Ative sua conta' abre o pop-up de ativação");
  await T.browser.close();
}
{ // administradora e conta já ativada
  const T = await nova(5197, { usuario: OWNER }); await ir(T.page, 5197, "/masterlist");
  ok(await prompt(T.page).count() === 0, "administradora: nenhuma área é bloqueada");
  await T.browser.close();
  const U = await nova(5197, { comSessao: true, cogDaConta: "ana" }); await ir(U.page, 5197, "/masterlist");
  ok(await prompt(U.page).count() === 0, "conta já ativada e logada: a área abre direto");
  await U.browser.close();
  const V = await nova(5197, { comSessao: true, cogDaConta: "bia" }); await ir(V.page, 5197, "/masterlist");
  ok(await prompt(V.page).count() === 1, "sessão de OUTRO @ neste aparelho: a área continua fechada");
  await V.browser.close();
}
{ // troca de senha no perfil
  const T = await nova(5197, { comSessao: true, cogDaConta: "ana" }); const { page, reg } = T;
  await ir(page, 5197, "/perfil");
  const cartao = page.getByTestId("trocar-senha-joiner");
  ok(await cartao.count() === 1, "perfil: a conta ativada vê 'Trocar minha senha'");
  await cartao.getByRole("button", { name: "Trocar minha senha" }).click();
  await cartao.getByLabel("Nova senha", { exact: true }).fill("curta"); await cartao.getByLabel("Repita a nova senha").fill("curta"); await cartao.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(300);
  ok((await cartao.innerText()).includes("pelo menos 8") && reg.put.length === 0, "troca: senha curta recusada sem chamar o servidor");
  await cartao.getByLabel("Nova senha", { exact: true }).fill("senha-nova-123"); await cartao.getByLabel("Repita a nova senha").fill("senha-nova-123"); await cartao.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(600);
  ok(reg.put.at(-1) === "senha-nova-123" && (await cartao.innerText()).includes("Senha alterada."), "troca: senha válida enviada e confirmada");
  await T.browser.close();
}
{ // link de recuperação do e-mail
  const T = await nova(5197, { usuario: null, versao: "5", destino: "/perfil" }); const { page, reg } = T;
  const t = tokens();
  await ir(page, 5197, "/", `#access_token=${t.access_token}&expires_in=3600&refresh_token=${t.refresh_token}&token_type=bearer&type=recovery`);
  ok(await page.getByTestId("recuperacao-modal").count() === 1, "link de recuperação: abre a tela de nova senha (mesmo sem estar logada no site)");
  await page.getByLabel("Nova senha", { exact: true }).fill("curta"); await page.getByLabel("Repita a nova senha").fill("curta"); await page.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(300);
  ok((await corpo(page)).includes("pelo menos 8") && reg.put.length === 0, "recuperação: senha curta recusada");
  await page.getByLabel("Nova senha", { exact: true }).fill("outra-senha-123"); await page.getByLabel("Repita a nova senha").fill("outra-senha-123"); await page.getByRole("button", { name: "Salvar nova senha" }).click(); await page.waitForTimeout(600);
  ok(reg.put.at(-1) === "outra-senha-123" && (await corpo(page)).includes("Senha alterada"), "recuperação: nova senha salva");
  await page.getByRole("button", { name: "Continuar" }).click(); await page.waitForTimeout(900);
  ok(await page.evaluate(() => window.location.pathname) === "/perfil", "depois de redefinir, volta para a página que a joiner tentava acessar (/perfil)");
  await T.browser.close();
}

{ // administradora com o recurso ligado: UMA sessão para tudo (o banco decide por is_admin())
  const T = await nova(5197, { usuario: OWNER, senhaCerta: "senha-boa-123", ehAdmin: true, cogDaConta: "nandaverseo_c" }); const { page, reg } = T;
  await ir(page, 5197, "/admin");
  ok(await page.getByTestId("admin-auth-card").count() === 1, "administradora: a aba Admin pede o login seguro (e-mail e senha)");
  await page.getByLabel("E-mail do administrador").fill("dona@exemplo.com"); await page.getByLabel("Senha", { exact: true }).fill("senha-boa-123"); await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(1200);
  ok(await page.getByTestId("admin-auth-ok").count() === 1, "administradora: 'Acesso de administrador verificado' com o recurso ligado");
  ok(reg.restAuth.some(a => tokenDaJoiner(a)), "UMA sessão para tudo: depois do login, as consultas do site já saem com a conta da administradora (o banco libera por is_admin())");
  await T.browser.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
