// Teste de navegador da JORNADA COMPLETA da conta (Playwright, API simulada; não toca no Supabase real), no computador e no celular:
//   ativar -> código -> confirmação do perfil -> site aberto, SEM pedir login de novo, SEM tela vazia e SEM recarregar;
//   "Voltar às áreas públicas" sem acesso a dado protegido; login com "Esqueci minha senha" junto ao campo; leitura (fonte) e uso com o teclado aberto no celular.
// Uso:  VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois   node tests/joiner-jornada.e2e.mjs
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PORTA = 5197, REF = "ghjfsmwwcfpfvrouyrka", UID = "00000000-0000-0000-0000-000000000005";
const ANA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", twitter: "@ana", confirmado: true, acesso_simples: true };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura`;
const tokens = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j" });
const sessao = () => ({ ...tokens(), user: { id: UID, aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });
const VISTAS = {
  computador: { viewport: { width: 1100, height: 900 } },
  celular: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

async function nova(vista, cen = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext(VISTAS[vista]);
  await ctx.addInitScript(([u, ref, s]) => {
    if (u) { localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_at_v2", String(Date.now())); }
    localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    if (s) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s));
  }, [ANA, REF, cen.comSessao ? sessao() : null]);
  const est = { ativou: !!cen.comSessao, concluido: !cen.perfilPendente, nome: cen.nomeSite === undefined ? "Ana" : cen.nomeSite };
  const reg = { rpc: [], put: [] };
  await ctx.route("**/*", async route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/functions/v1/pedir-codigo-joiner")) return json(200, { ok: true });
    if (u.includes("/functions/v1/pedir-ajuda-ativacao")) return json(200, { ok: true });
    if (u.includes("/functions/v1/recuperar-senha-joiner")) return json(200, { ok: true });
    if (u.includes("/functions/v1/login-joiner")) return json(401, { error: "@ ou senha incorretos." });
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/verify") return json(200, sessao());
      if (p === "/user" && m === "PUT") { reg.put.push(JSON.parse(req.postData() || "{}").password); return json(200, sessao().user); }
      if (p === "/user") return json(200, sessao().user);
      if (p === "/logout") return route.fulfill({ status: 204, body: "" });
      return json(200, {});
    }
    const rpc = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(u);
    if (rpc) {
      const nome = rpc[1], corpo = req.postData() ? JSON.parse(req.postData()) : {}; reg.rpc.push(nome);
      if (nome === "meu_estado_conta") return json(200, !est.ativou ? { vinculada: false } : { vinculada: true, concluido: est.concluido, joiner_id: 5, cog: "ana", nome_site: est.nome, arroba: "@ana", email_mascarado: "a***@exemplo.com" });
      if (nome === "ativar_minha_conta") { await new Promise(r => setTimeout(r, cen.latencia ?? 700)); est.ativou = true; return json(200, { status: "ok" }); }
      if (nome === "completar_meu_perfil") { await new Promise(r => setTimeout(r, 300)); est.concluido = true; est.nome = corpo.p_nome_site; return json(200, { vinculada: true, concluido: true, cog: "ana", nome_site: corpo.p_nome_site }); }
      if (nome === "meu_cog") return json(200, est.ativou && est.concluido ? "ana" : null);
      if (nome === "is_admin") return json(200, false);
      if (nome === "entrar_com_arroba") return json(200, { encontrado: true, cog: "ana", nome_site: "Ana", ativacao_liberada: true });
      return json(200, null);
    }
    if (u.includes("supabase.co/rest/v1/")) { const objeto = (req.headers()["accept"] || "").includes("pgrst.object"); return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } }); }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros, est };
}
const ir = async (page, caminho) => { await page.goto(`http://localhost:${PORTA}${caminho}`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); };
const semRolagemLateral = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const dentroDaTela = async (page, loc) => { await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(), v = page.viewportSize(); return !!b && b.y >= 0 && b.y + b.height <= v.height + 1 && b.x >= 0 && b.x + b.width <= v.width + 1; };
const fonte = (loc) => loc.evaluate(el => getComputedStyle(el).fontFamily);
// o que a pessoa REALMENTE vê: o elemento existe e é ele (não um pop-up por cima) que está no ponto central
const visivelAoUsuario = (page, testid) => page.evaluate(id => { const el = document.querySelector(`[data-testid="${id}"]`); if (!el) return false; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; const topo = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, window.innerHeight - 2)); return !!topo && el.contains(topo); }, testid);

for (const vista of Object.keys(VISTAS)) {
  console.log(`\n=== ${vista} ===`);
  { // ATIVAR -> CÓDIGO -> PERFIL -> SITE
    const { browser, page, erros } = await nova(vista, { perfilPendente: true });
    await ir(page, "/masterlist");
    await page.evaluate(() => { window.__marca = "mesma-pagina"; });                     // some se a página for recarregada
    const modal = page.getByTestId("ativacao-modal");
    ok(await modal.count() === 1 && (await modal.innerText()).includes("Ative sua conta"), `[${vista}] a ativação abre com o título “Ative sua conta”`);
    ok(await semRolagemLateral(page), `[${vista}] sem rolagem lateral na ativação`);
    const intro = page.getByTestId("ativacao-intro");
    ok(!/mono/i.test(await fonte(intro)) && /system-ui|Segoe|Roboto|sans-serif/i.test(await fonte(intro)), `[${vista}] o parágrafo usa a fonte sem serifa (não a monoespaçada)`);
    ok(/mono/i.test(await fonte(modal.getByRole("heading", { level: 2 }))), `[${vista}] o título mantém a fonte da identidade visual`);
    await page.getByLabel("E-mail do cadastro").fill("ana@exemplo.com"); await page.getByLabel("Crie sua senha").fill("senha-segura-123"); await page.getByLabel("Repita a senha").fill("senha-segura-123");
    ok((await page.getByLabel("E-mail do cadastro").evaluate(el => parseFloat(getComputedStyle(el).fontSize))) >= 16, `[${vista}] campos com fonte de 16px (o iOS não amplia a tela ao digitar)`);
    await page.getByRole("button", { name: "Enviar código de confirmação" }).click(); await page.waitForTimeout(500);
    ok(await page.getByLabel("Código de confirmação").count() === 1, `[${vista}] chega à tela do código`);
    await page.getByLabel("Código de confirmação").fill("123456"); await page.getByRole("button", { name: "Confirmar código" }).click();
    // durante a espera da ativação nada de login nem de tela vazia
    let viuLogin = false, viuAvisoVelho = false, vezes = 0;
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(75); vezes++; if (await visivelAoUsuario(page, "area-protegida")) viuLogin = true; if (await visivelAoUsuario(page, "area-perfil-pendente")) viuAvisoVelho = true; }
    ok(!viuLogin && !viuAvisoVelho && vezes === 40, `[${vista}] em nenhum momento depois do código a pessoa vê a tela de login nem o aviso “Conclua os seus dados…” (a página de trás nunca aparece)`);
    ok(await modal.count() === 0 && await page.getByTestId("completar-perfil").count() === 1, `[${vista}] segue direto para a confirmação do perfil`);
    const perfil = page.getByTestId("completar-perfil");
    ok((await perfil.innerText()).includes("Confira seus dados"), `[${vista}] o perfil tem o título “Confira seus dados”`);
    ok((await page.getByTestId("perfil-nome").inputValue()) === "Ana", `[${vista}] o nome para claim existente vem preenchido para revisão`);
    ok(await page.getByTestId("perfil-arroba").evaluate(el => el.tagName !== "INPUT") && await page.getByTestId("perfil-pedir-arroba").count() === 1 && await page.getByTestId("perfil-trocar-email").count() === 1, `[${vista}] o @ é somente leitura e os caminhos de correção (@ e e-mail) continuam`);
    ok(await semRolagemLateral(page), `[${vista}] sem rolagem lateral no perfil`);
    await page.getByTestId("perfil-nome").fill("Ana Claim");
    await page.getByTestId("perfil-concluir").click();
    let viuVazia = false, viuLogin2 = false;
    for (let i = 0; i < 30; i++) { await page.waitForTimeout(75); if (await visivelAoUsuario(page, "area-perfil-pendente")) viuVazia = true; if (await visivelAoUsuario(page, "area-protegida")) viuLogin2 = true; }
    ok(await page.getByTestId("completar-perfil").count() === 0, `[${vista}] depois de “Concluir e entrar” a tela de perfil fecha`);
    ok(!viuVazia && !viuLogin2 && await page.getByTestId("area-perfil-pendente").count() === 0, `[${vista}] o site abre normalmente, sem a mensagem “Conclua os seus dados…”, sem login e sem tela vazia`);
    ok(await page.getByTestId("area-protegida").count() === 0 && await page.getByPlaceholder("Buscar item...").count() === 1, `[${vista}] a MASTERLIST abre sem pedir login`);
    ok(await page.evaluate(() => window.__marca) === "mesma-pagina", `[${vista}] sem recarregar a página`);
    ok(erros.length === 0, `[${vista}] nenhum erro de JavaScript` + (erros.length ? ": " + erros[0].slice(0, 100) : ""));
    await browser.close();
  }
  { // CÓDIGO: o essencial cabe antes das orientações; com o teclado aberto (tela baixa) os botões continuam acessíveis
    const { browser, page } = await nova(vista, { perfilPendente: true });
    if (vista === "celular") await page.setViewportSize({ width: 390, height: 420 });     // altura aproximada com o teclado aberto
    await ir(page, "/masterlist");
    const modal = page.getByTestId("ativacao-modal");
    ok(await modal.evaluate(el => el.scrollHeight >= el.clientHeight && ["auto", "scroll"].includes(getComputedStyle(el).overflowY)), `[${vista}] o fundo da ativação rola (teclado aberto não prende a tela)`);
    await page.getByLabel("E-mail do cadastro").fill("ana@exemplo.com"); await page.getByLabel("Crie sua senha").fill("senha-segura-123"); await page.getByLabel("Repita a senha").fill("senha-segura-123");
    const enviar = page.getByRole("button", { name: "Enviar código de confirmação" });
    ok(await dentroDaTela(page, enviar), `[${vista}] o botão “Enviar código de confirmação” é alcançável (rolando)`);
    await enviar.click(); await page.waitForTimeout(500);
    const campo = page.getByLabel("Código de confirmação"), botao = page.getByRole("button", { name: "Confirmar código" }), aviso = page.getByTestId("ativacao-aviso-spam");
    await campo.focus();
    ok(await dentroDaTela(page, campo) && await dentroDaTela(page, botao), `[${vista}] campo do código e “Confirmar código” ficam acessíveis${vista === "celular" ? " mesmo com a tela baixa (teclado aberto)" : ""}`);
    ok((await campo.boundingBox()).y < (await aviso.boundingBox()).y, `[${vista}] o campo do código vem antes das orientações`);
    await campo.fill("123456"); await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
    ok(await page.getByTestId("completar-perfil").count() === 1, `[${vista}] “Enter” no campo do código confirma (teclado do celular)`);
    const nome = page.getByTestId("perfil-nome"), concluir = page.getByTestId("perfil-concluir");
    await nome.focus();
    ok(await dentroDaTela(page, nome) && await dentroDaTela(page, concluir), `[${vista}] no perfil, o nome e “Concluir e entrar” ficam acessíveis${vista === "celular" ? " com o teclado aberto" : ""}`);
    ok(await semRolagemLateral(page), `[${vista}] sem rolagem lateral`);
    await browser.close();
  }
  { // VOLTAR ÀS ÁREAS PÚBLICAS: sem acesso a dado protegido
    const { browser, page, reg } = await nova(vista, {});
    await ir(page, "/masterlist");
    await page.getByTestId("ativacao-modal").getByRole("button", { name: "Voltar às áreas públicas", exact: true }).click(); await page.waitForTimeout(1200);
    ok(await page.evaluate(() => window.location.pathname) === "/cegs" && await page.getByTestId("ativacao-modal").count() === 0, `[${vista}] “Voltar às áreas públicas” leva a uma área pública e fecha o pop-up`);
    await ir(page, "/masterlist");
    ok(await page.getByTestId("area-protegida").count() === 1 && await page.getByPlaceholder("Buscar item...").count() === 0, `[${vista}] a área com dados pessoais continua pedindo a senha (nenhum dado protegido aparece)`);
    ok(!reg.rpc.includes("ativar_minha_conta") && reg.put.length === 0, `[${vista}] nenhuma conta foi criada nem senha gravada nesse caminho`);
    await browser.close();
  }
  { // LOGIN: título, “Esqueci minha senha” junto ao campo de senha, leitura
    const { browser, page } = await nova(vista, {});
    await page.addInitScript(() => sessionStorage.setItem("anticeg_ativacao_dispensada", "1"));
    await ir(page, "/masterlist");
    const cartao = page.getByTestId("area-protegida");
    ok((await cartao.innerText()).includes("Entre na sua conta") && !(await cartao.innerText()).includes("Área protegida"), `[${vista}] o login tem o título “Entre na sua conta”`);
    const senha = page.getByLabel("Senha", { exact: true }), esqueci = page.getByRole("button", { name: "Esqueci minha senha" }), entrar = page.getByRole("button", { name: "Entrar", exact: true });
    const ys = (await senha.boundingBox()), ye = (await esqueci.boundingBox()), yb = (await entrar.boundingBox());
    ok(ye.y > ys.y && ye.y < yb.y && ye.y - (ys.y + ys.height) < 40, `[${vista}] “Esqueci minha senha” fica logo abaixo do campo de senha, antes do botão Entrar`);
    ok(!/mono/i.test(await fonte(cartao.locator("p").first())), `[${vista}] o texto do login usa a fonte sem serifa`);
    ok(await semRolagemLateral(page), `[${vista}] sem rolagem lateral no login`);
    await esqueci.click(); await page.waitForTimeout(300);
    ok(await page.getByRole("button", { name: "Enviar link de redefinição" }).count() === 1, `[${vista}] “Esqueci minha senha” abre a recuperação`);
    await browser.close();
  }
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
