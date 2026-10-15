// Teste de navegador do pop-up de ativação das joiners (J2), com a API de autenticação simulada (Playwright). Não toca no Supabase real.
// Uso: em dois terminais ->
//   npx vite --port 5199 --strictPort                                   (padrão: recurso DESLIGADO, o site se comporta como hoje)
//   VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort            (recurso LIGADO)
// depois `node tests/joiner-ativacao.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const REF = "ghjfsmwwcfpfvrouyrka";
const ANA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", email: "registrado@exemplo.com", twitter: "@ana", confirmado: true };
const OWNER = { id: 1, cog: "nandaverseo_c", nome: "Dona", nome_site: "Dona", email: "dona@exemplo.com", twitter: "@nandaverseo_c", confirmado: true };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = sub => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-joiner`;
const sessao = () => ({ access_token: jwt("00000000-0000-0000-0000-000000000005"), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j",
  user: { id: "00000000-0000-0000-0000-000000000005", aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

// cen: { usuario, versao, comSessao, cogDaConta, codigo, ativar, putErro, otpErro }
async function nova(porta, cen) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(([u, v, sess, ref]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", v); localStorage.setItem("anticeg_session_at_v2", String(Date.now()));
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    if (sess) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
  }, [cen.usuario, cen.versao, cen.comSessao ? sessao() : null, REF]);
  const reg = { otp: [], verify: [], put: [], rpc: [], ordem: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/otp") { reg.otp.push(JSON.parse(req.postData() || "{}")); reg.ordem.push("otp"); return cen.otpErro ? json(429, { code: 429, error_code: "over_email_send_rate_limit", msg: "email rate limit exceeded" }) : json(200, {}); }
      if (p === "/verify") { const c = JSON.parse(req.postData() || "{}"); reg.verify.push(c); reg.ordem.push("verify"); return c.token === cen.codigo ? json(200, sessao()) : json(403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" }); }
      if (p === "/user" && m === "PUT") { const c = JSON.parse(req.postData() || "{}"); reg.put.push(c.password); reg.ordem.push("senha"); return cen.putErro ? json(422, { code: 422, error_code: "weak_password", msg: "Password is known to be weak" }) : json(200, sessao().user); }
      if (p === "/user") return json(200, sessao().user);
      if (p === "/logout") return route.fulfill({ status: 204, body: "" });
      return json(200, {});
    }
    if (u.includes("/rest/v1/rpc/meu_cog")) { reg.rpc.push("meu_cog"); return json(200, cen.cogDaConta ?? null); }
    if (u.includes("/rest/v1/rpc/ativar_minha_conta")) { reg.rpc.push("ativar:" + JSON.parse(req.postData() || "{}").p_cog); reg.ordem.push("ativar"); return json(200, { status: cen.ativar || "ok" }); }
    if (u.includes("supabase.co/rest/v1/")) {
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      if (u.includes("/rest/v1/joiners") && objeto) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cen.usuario) });
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const abrir = async (page, porta) => { await page.goto(`http://localhost:${porta}/masterlist`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); };
const corpo = page => page.locator("body").innerText();
const modal = page => page.getByTestId("ativacao-modal");
const preencher = async (page, { email = "ana@exemplo.com", senha = "senha-boa-123", repetir = senha } = {}) => {
  await page.getByLabel("E-mail do cadastro").fill(email); await page.getByLabel("Crie sua senha").fill(senha); await page.getByLabel("Repita a senha").fill(repetir);
  await page.getByRole("button", { name: "Enviar código de confirmação" }).click(); await page.waitForTimeout(500);
};

// ── 1) recurso DESLIGADO (porta 5199): nada muda ──────────────────────────────────────────────
{
  const T = await nova(5199, { usuario: ANA, versao: "4" }); const { page } = T;
  await abrir(page, 5199);
  ok(await modal(page).count() === 0, "recurso desligado: NENHUM pop-up aparece");
  ok(!(await corpo(page)).includes("Atualização cadastral"), "recurso desligado: o site segue como hoje");
  ok(T.reg.rpc.length === 0 && T.reg.otp.length === 0, "recurso desligado: nenhuma chamada de conta é feita");
  await T.browser.close();
}

// ── 2) recurso LIGADO (porta 5197) ────────────────────────────────────────────────────────────
{
  const T = await nova(5197, { usuario: ANA, versao: "5", codigo: "123456", ativar: "ok" }); const { page, reg, erros } = T;
  await abrir(page, 5197);
  ok(await modal(page).count() === 1, "primeiro acesso só com @: o pop-up obrigatório aparece");
  ok((await page.getByLabel("Seu @ cadastrado").inputValue()) === "ana", "o @ já vem preenchido para confirmar");
  ok(await modal(page).getByRole("button", { name: /fechar|×/i }).count() === 0, "o pop-up não tem botão de fechar (é obrigatório)");
  ok(!(await modal(page).innerText()).includes("registrado@exemplo.com"), "o e-mail registrado no cadastro NÃO aparece no pop-up");
  // validações no navegador: nada é enviado
  await preencher(page, { email: "isso-nao-e-email" });
  ok((await corpo(page)).includes("e-mail válido") && reg.otp.length === 0, "e-mail inválido: avisa e não envia nada");
  await preencher(page, { senha: "curta", repetir: "curta" });
  ok((await corpo(page)).includes("pelo menos 8") && reg.otp.length === 0, "senha curta: recusada, nada enviado");
  await preencher(page, { senha: "senha-boa-123", repetir: "senha-boa-124" });
  ok((await corpo(page)).includes("diferentes") && reg.otp.length === 0, "senhas diferentes: recusadas, nada enviado");
  await preencher(page, { senha: "12345678", repetir: "12345678" });
  ok((await corpo(page)).includes("menos óbvia") && reg.otp.length === 0, "senha óbvia: recusada");
  // pedido do código
  await preencher(page, { email: " Ana@Exemplo.com " });
  ok(reg.otp.length === 1 && reg.otp[0].email === "ana@exemplo.com" && reg.otp[0].create_user === true && reg.otp[0].data?.cog_pedido === "ana", "pede o código para o e-mail digitado (normalizado) e leva o @ como PEDIDO, não como prova");
  ok(/a•+@exemplo.com/.test(await modal(page).innerText()) && (await modal(page).innerText()).includes("Se os dados estiverem corretos"), "tela do código mostra o e-mail mascarado e a frase neutra (não revela se o @ existe)");
  ok(await page.getByRole("button", { name: /Reenviar código em/ }).isDisabled(), "reenvio fica bloqueado por 60 segundos");
  ok(reg.put.length === 0 && reg.rpc.filter(r => r.startsWith("ativar")).length === 0, "até aqui: a senha NÃO foi gravada e nenhum vínculo foi pedido (só depois do código)");
  // código errado
  await page.getByLabel("Código de confirmação").fill("999999"); await page.getByRole("button", { name: "Confirmar e ativar minha conta" }).click(); await page.waitForTimeout(500);
  ok((await corpo(page)).includes("Código inválido ou expirado") && reg.put.length === 0 && !reg.ordem.includes("ativar"), "código errado: recusado, a senha NÃO é gravada e nenhum vínculo é pedido");
  // código certo
  await page.getByLabel("Código de confirmação").fill("123456"); await page.getByRole("button", { name: "Confirmar e ativar minha conta" }).click(); await page.waitForTimeout(900);
  ok(reg.ordem.slice(-3).join(">") === "verify>senha>ativar", "ordem segura: confere o código, SÓ DEPOIS grava a senha e depois pede o vínculo");
  ok(reg.put.at(-1) === "senha-boa-123" && reg.rpc.includes("ativar:ana"), "grava a senha escolhida e pede o vínculo do @ ana");
  ok((await modal(page).innerText()).includes("Conta ativada") && (await modal(page).innerText()).includes("continuam no seu @"), "mensagem de sucesso: histórico preservado");
  await page.getByRole("button", { name: "Continuar" }).click(); await page.waitForTimeout(300);
  ok(await modal(page).count() === 0, "ao continuar, o pop-up fecha");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}
{ // cadastro incompleto/conflitante: o servidor devolve 'pendente'
  const T = await nova(5197, { usuario: ANA, versao: "5", codigo: "123456", ativar: "pendente" }); const { page } = T;
  await abrir(page, 5197); await preencher(page);
  await page.getByLabel("Código de confirmação").fill("123456"); await page.getByRole("button", { name: "Confirmar e ativar minha conta" }).click(); await page.waitForTimeout(800);
  const t = await modal(page).innerText();
  ok(t.includes("Nada se perdeu") && t.includes("Fale com a administração") && t.includes("modo limitado"), "pendente: mensagem amigável (nada se perde, falar com a administração, modo limitado)");
  ok(!/duplicad|compartilhad|ausente|inválido|conflit/i.test(t), "pendente: a tela NÃO revela o motivo (sem enumerar e-mails ou cadastros)");
  await page.getByRole("button", { name: "Continuar no modo limitado" }).click(); await page.waitForTimeout(300);
  ok(await modal(page).count() === 0, "continua navegando no modo limitado");
  await T.browser.close();
}
{ // não tenho o e-mail do cadastro
  const T = await nova(5197, { usuario: ANA, versao: "5" }); const { page, reg } = T;
  await abrir(page, 5197);
  await page.getByRole("button", { name: /Meu e-mail não está no cadastro/ }).click();
  ok((await modal(page).innerText()).includes("Vamos regularizar") && reg.otp.length === 0, "caminho 'não lembro o e-mail': orienta a falar com a administração, sem enviar nada");
  await page.getByRole("button", { name: "Continuar no modo limitado" }).click(); await page.waitForTimeout(300);
  ok(await modal(page).count() === 0, "e segue no modo limitado");
  await T.browser.close();
}
{ // limite de envios do e-mail
  const T = await nova(5197, { usuario: ANA, versao: "5", otpErro: true }); const { page } = T;
  await abrir(page, 5197); await preencher(page);
  ok((await corpo(page)).includes("Muitas tentativas") && await page.getByLabel("Código de confirmação").count() === 0, "limite do servidor: mensagem amigável e continua na tela de dados");
  await T.browser.close();
}
{ // senha recusada pelo servidor depois do código
  const T = await nova(5197, { usuario: ANA, versao: "5", codigo: "123456", putErro: true }); const { page, reg } = T;
  await abrir(page, 5197); await preencher(page);
  await page.getByLabel("Código de confirmação").fill("123456"); await page.getByRole("button", { name: "Confirmar e ativar minha conta" }).click(); await page.waitForTimeout(700);
  ok((await corpo(page)).includes("Senha fraca demais") && !reg.ordem.includes("ativar"), "senha fraca recusada pelo servidor: avisa e NÃO pede o vínculo");
  await T.browser.close();
}
{ // já ativada: não aparece
  const T = await nova(5197, { usuario: ANA, versao: "5", comSessao: true, cogDaConta: "ana" }); const { page } = T;
  await abrir(page, 5197);
  ok(await modal(page).count() === 0, "conta já ativada (sessão + vínculo ao mesmo @): o pop-up NÃO aparece");
  await T.browser.close();
}
{ // sessão de OUTRA pessoa neste aparelho
  const T = await nova(5197, { usuario: ANA, versao: "5", comSessao: true, cogDaConta: "bia" }); const { page } = T;
  await abrir(page, 5197);
  ok(await modal(page).count() === 1, "sessão ligada a OUTRO @: o pop-up aparece (não herda a conta de outra pessoa)");
  await T.browser.close();
}
{ // administradora: nunca vê o pop-up
  const T = await nova(5197, { usuario: OWNER, versao: "5" }); const { page } = T;
  await abrir(page, 5197);
  ok(await modal(page).count() === 0, "administradora: o pop-up NÃO aparece");
  await T.browser.close();
}
{ // invalidar sessões antigas: joiner sai, administradora fica
  const A = await nova(5197, { usuario: ANA, versao: "4" });
  await abrir(A.page, 5197);
  ok((await A.page.evaluate(() => localStorage.getItem("anticeg_user_v2"))) === null && (await A.page.evaluate(() => localStorage.getItem("anticeg_session_v"))) === "5", "lançamento: a sessão antiga (versão 4) de uma joiner é invalidada");
  await A.browser.close();
  const B = await nova(5197, { usuario: OWNER, versao: "4" });
  await abrir(B.page, 5197);
  ok(JSON.parse(await B.page.evaluate(() => localStorage.getItem("anticeg_user_v2")) || "null")?.cog === "nandaverseo_c", "lançamento: a sessão da administradora NÃO é invalidada");
  await B.browser.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
