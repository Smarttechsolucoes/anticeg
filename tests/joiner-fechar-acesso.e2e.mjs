// Teste de navegador: X / "Voltar" nas telas de acesso (pop-up de ativação, login, "Confira seus dados") levam às áreas públicas SEM liberar dado protegido e SEM concluir o perfil.
// API simulada (Playwright); não toca no Supabase real.
// Uso:  VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois   node tests/joiner-fechar-acesso.e2e.mjs
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PORTA = 5197, REF = "ghjfsmwwcfpfvrouyrka";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000005", email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-joiner`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j",
  user: { id: "00000000-0000-0000-0000-000000000005", aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });
const SIMPLES = { cog: "ana", nome: "Ana", nome_site: "Ana", foto_perfil: null, confirmado: true, acesso_simples: true, conta_ativa: true, ativacao_liberada: true };

// cen: { comSessao, perfilPendente, semUsuario }
async function nova(cen = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.addInitScript(([u, sess, ref]) => {
    if (u) { localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_session_at_v2", String(Date.now())); }
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    if (sess) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
  }, [cen.semUsuario ? null : SIMPLES, cen.comSessao ? sessao() : null, REF]);
  const reg = { rpc: [], privadas: [], pedir: 0 };
  await ctx.route("**/*", async route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body, h = {}) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: h });
    if (u.includes("/functions/v1/pedir-codigo-joiner")) { reg.pedir++; return json(200, { ok: true }); }
    if (u.includes("supabase.co/auth/v1/")) { const p = new URL(u).pathname.replace("/auth/v1", ""); if (p === "/user") return json(200, sessao().user); if (p === "/logout") return route.fulfill({ status: 204, body: "" }); return json(200, {}); }
    if (u.includes("/rest/v1/rpc/meu_estado_conta")) return json(200, cen.perfilPendente ? { vinculada: true, concluido: false, joiner_id: 5, cog: "ana", nome_site: "Ana", arroba: "@ana", email_mascarado: "a***@exemplo.com" } : { vinculada: false });
    if (u.includes("/rest/v1/rpc/entrar_com_arroba")) return json(200, { encontrado: true, cog: "ana", nome_site: "Ana", foto_perfil: null, conta_ativa: !!cen.perfilPendente, ativacao_liberada: true });
    if (u.includes("/rest/v1/rpc/")) { reg.rpc.push(new URL(u).pathname.split("/").pop()); return json(200, null); }
    if (u.includes("supabase.co/rest/v1/")) {
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      if (/\/rest\/v1\/(masterlist|joiners|pagamento_demandas|claims)/.test(u) && m === "GET" && !objeto) reg.privadas.push(new URL(u).pathname);
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const ir = async (page, caminho = "/") => { await page.goto(`http://localhost:${PORTA}${caminho}`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); };
const caminho = page => page.evaluate(() => window.location.pathname);

{ // 1) pop-up de ativação em área protegida: X leva às áreas públicas, não manda pedido nem libera nada
  const T = await nova(); const { page, reg } = T; await ir(page, "/masterlist");
  const modal = page.getByTestId("ativacao-modal");
  ok(await modal.count() === 1 && await modal.getByTestId("fechar-acesso").count() === 1, "o pop-up de ativação tem X");
  const x = await modal.getByTestId("fechar-acesso").boundingBox(); ok(x && x.width >= 40 && x.height >= 40, "o X tem área de toque de pelo menos 40 px");
  await modal.getByTestId("fechar-acesso").click(); await page.waitForTimeout(1500);
  ok(await caminho(page) === "/cegs" && await page.getByTestId("ativacao-modal").count() === 0, "X: fecha o pop-up e leva à área pública (/cegs)");
  ok(reg.pedir === 0 && reg.privadas.length === 0, "X não envia pedido de código nem consulta dado protegido");
  await ir(page, "/masterlist");
  ok(await page.getByTestId("ativacao-modal").count() === 0 && await page.getByTestId("area-protegida").count() === 1, "voltar à área protegida: continua fechada (pede senha), sem liberar nada");
  await T.browser.close();
}
{ // 2) X também na tela do código e na tela de ajuda
  const T = await nova(); const { page } = T; await ir(page, "/cegs");
  await page.evaluate(() => window.dispatchEvent(new Event("anticeg:abrir-ativacao"))); await page.waitForTimeout(500);
  const modal = page.getByTestId("ativacao-modal");
  await modal.getByLabel("E-mail do cadastro").fill("ana@exemplo.com"); await modal.getByLabel("Crie sua senha").fill("senha-boa-123"); await modal.getByLabel("Repita a senha").fill("senha-boa-123");
  await modal.getByRole("button", { name: "Enviar código de confirmação" }).click(); await page.waitForTimeout(700);
  ok(await modal.getByTestId("fechar-acesso").count() === 1, "tela do código: tem X");
  await modal.getByTestId("fechar-acesso").click(); await page.waitForTimeout(600);
  ok(await page.getByTestId("ativacao-modal").count() === 0 && await caminho(page) === "/cegs", "X na tela do código: fecha e fica na área pública");
  await T.browser.close();
}
{ // 3) login (área protegida): "Voltar às áreas públicas"
  const T = await nova(); const { page } = T; await ir(page, "/masterlist");
  await page.getByTestId("ativacao-modal").getByTestId("fechar-acesso").click(); await page.waitForTimeout(1200);
  await ir(page, "/masterlist");
  ok(await page.getByTestId("area-protegida").count() === 1 && await page.getByTestId("login-voltar-publicas").count() === 1, "tela “Entre na sua conta”: tem “Voltar às áreas públicas”");
  await page.getByTestId("login-voltar-publicas").click(); await page.waitForTimeout(1200);
  ok(await caminho(page) === "/cegs" && await page.getByTestId("area-protegida").count() === 0, "“Voltar às áreas públicas” leva a /cegs");
  await T.browser.close();
}
{ // 4) "Confira seus dados": X leva às áreas públicas SEM concluir o perfil; a tela não volta sozinha; "Concluir meus dados" a reabre
  const T = await nova({ comSessao: true, perfilPendente: true }); const { page, reg } = T; await ir(page, "/masterlist");
  ok(await page.getByTestId("completar-perfil").count() === 1 && await page.getByTestId("completar-perfil").getByTestId("fechar-acesso").count() === 1, "“Confira seus dados” tem X");
  await page.getByTestId("completar-perfil").getByTestId("fechar-acesso").click(); await page.waitForTimeout(1500);
  ok(await caminho(page) === "/cegs" && await page.getByTestId("completar-perfil").count() === 0, "X: leva à área pública e a tela do perfil não reaparece sozinha");
  ok(!reg.rpc.includes("completar_meu_perfil") && reg.privadas.length === 0, "X NÃO conclui o perfil e NÃO consulta dado protegido");
  await ir(page, "/masterlist");
  ok(await page.getByTestId("area-perfil-pendente").count() === 1 && await page.getByTestId("completar-perfil").count() === 0, "na área protegida: aviso “Conclua os seus dados”, sem liberar nada");
  await page.getByRole("button", { name: "Concluir meus dados" }).click(); await page.waitForTimeout(600);
  ok(await page.getByTestId("completar-perfil").count() === 1, "“Concluir meus dados” reabre a tela do perfil");
  ok(!reg.rpc.includes("completar_meu_perfil"), "nada foi concluído automaticamente");
  ok(T.erros.length === 0, "sem erro de script"); await T.browser.close();
}
{ // 5) ativação que começa pelo e-mail (tela inicial): X volta às áreas públicas
  const T = await nova({ semUsuario: true }); const { page, reg } = T; await ir(page, "/");
  await page.getByPlaceholder("@ da rede social ou e-mail").fill("ana@exemplo.com"); await page.getByRole("button", { name: /ENTRAR/ }).click(); await page.waitForTimeout(700);
  const modal = page.getByTestId("ativacao-modal");
  ok(await modal.count() === 1 && await modal.getByTestId("fechar-acesso").count() === 1, "ativação pelo e-mail: tem X");
  await modal.getByTestId("fechar-acesso").click(); await page.waitForTimeout(1500);
  ok(await page.getByTestId("ativacao-modal").count() === 0 && await caminho(page) === "/cegs", "X na ativação pelo e-mail: volta à área pública");
  ok(reg.pedir === 0 && reg.privadas.length === 0, "nenhum pedido de código nem dado protegido");
  await T.browser.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
