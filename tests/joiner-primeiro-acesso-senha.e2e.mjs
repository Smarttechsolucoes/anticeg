// Teste de navegador do PRIMEIRO ACESSO COM SENHA (cadastro/ativação dentro de /primeiro-acesso), com a API simulada (Playwright). Não toca no Supabase real, não envia código nem e-mail.
// Uso: em dois terminais ->
//   npx vite --port 5199 --strictPort                          (recurso DESLIGADO: o card antigo, sem senha)
//   VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   (recurso LIGADO)
// depois `node tests/joiner-primeiro-acesso-senha.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const LINHA_COMPLETA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", email: "ana@exemplo.com", twitter: "@ana", confirmado: true };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000005", email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-joiner`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j",
  user: { id: "00000000-0000-0000-0000-000000000005", aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

// cen: { codigo, proximo, otpErro, cadastro (resposta de solicitar_cadastro), ativar, perfilPendente }
async function nova(porta, cen = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  await ctx.addInitScript(() => { localStorage.setItem("anticeg_session_v", location.port === "5197" ? "6" : "5"); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1"); });
  const reg = { otp: [], verify: [], put: [], rpc: [], ordem: [], cadastro: [], eventos: [], tabelas: [] };
  await ctx.route("**/*", async route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/functions/v1/pedir-codigo-joiner")) { reg.otp.push(JSON.parse(req.postData() || "{}")); reg.ordem.push("otp"); return cen.otpErro ? json(429, { error: "Muitas tentativas. Espere alguns minutos e tente de novo." }) : json(200, cen.proximo ? { ok: true, proximo: cen.proximo } : { ok: true }); }
    if (u.includes("/functions/v1/email-evento")) { reg.eventos.push(JSON.parse(req.postData() || "{}")); return json(200, { ok: true }); }
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/verify") { const c = JSON.parse(req.postData() || "{}"); reg.verify.push(c); reg.ordem.push("verify"); return c.token === (cen.codigo || "123456") ? json(200, sessao()) : json(403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" }); }
      if (p === "/user" && m === "PUT") { const c = JSON.parse(req.postData() || "{}"); reg.put.push(c.password); reg.ordem.push("senha"); return json(200, sessao().user); }
      if (p === "/user") return json(200, sessao().user);
      if (p === "/logout") return route.fulfill({ status: 204, body: "" });
      return json(200, {});
    }
    if (u.includes("/rest/v1/rpc/")) {
      const nome = new URL(u).pathname.split("/").pop(); const corpo = JSON.parse(req.postData() || "{}"); reg.rpc.push(nome);
      if (nome === "solicitar_cadastro") { reg.cadastro.push(corpo); reg.ordem.push("cadastro"); return json(200, cen.cadastro || { ok: true }); }
      if (nome === "ativar_minha_conta") { reg.ordem.push("ativar"); reg.ativarCog = corpo.p_cog; if ((cen.ativar || "ok") === "ok") reg.ativou = true; return json(200, { status: cen.ativar || "ok" }); }
      if (nome === "cog_para_ativar") return json(200, "ana");
      if (nome === "meu_estado_conta") return json(200, reg.ativou ? { vinculada: true, concluido: !cen.perfilPendente, joiner_id: 5, cog: "ana", nome_site: "Ana", arroba: "@ana", email_mascarado: "a***@exemplo.com" } : { vinculada: false });
      if (nome === "meus_dados") return json(200, reg.ativou && !cen.perfilPendente ? LINHA_COMPLETA : null);
      if (nome === "entrar_com_arroba") return json(200, { encontrado: true, cog: "ana", nome_site: "Ana", foto_perfil: null, conta_ativa: true });
      if (nome === "meu_cog") return json(200, reg.ativou ? "ana" : null);
      return json(200, null);
    }
    if (u.includes("supabase.co/rest/v1/")) {
      reg.tabelas.push(m + " " + new URL(u).pathname.split("/").pop());
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  const consoles = []; page.on("console", m => consoles.push(m.text()));
  return { browser, page, reg, erros, consoles };
}
const ir = async (page, porta, caminho = "/primeiro-acesso") => { await page.goto(`http://localhost:${porta}${caminho}`, { waitUntil: "networkidle" }); await page.waitForTimeout(700); };
const corpo = async page => (await page.locator("body").innerText()).replace(/[ \t\r\n ]+/g, " ");   // o rótulo do card é maiúsculo por CSS: as conferências de título usam minúsculas (ver "baixa")
const baixa = async page => (await corpo(page)).toLowerCase();
const rot = (page, nome) => page.getByLabel(nome, { exact: true });
const preencher = async (page, { nome = "", cog = "", email = "", whats = "", senha = "", repetir = senha } = {}) => {
  if (nome) await rot(page, "Nome").fill(nome); if (cog) await rot(page, "Seu @").fill(cog); if (email) await rot(page, "E-mail").fill(email); if (whats) await rot(page, "WhatsApp").fill(whats);
  if (senha) await rot(page, "Crie sua senha").fill(senha); if (repetir) await rot(page, "Repita a senha").fill(repetir);
};
const enviar = async page => { await page.getByRole("button", { name: /ENVIAR CÓDIGO DE CONFIRMAÇÃO/ }).click(); await page.waitForTimeout(700); };
const confirmar = async (page, codigo) => { await page.getByLabel("Código de confirmação").fill(codigo); await page.getByRole("button", { name: /CONFIRMAR CÓDIGO/ }).click(); await page.waitForTimeout(1500); };

// ── 1) recurso DESLIGADO (5199): o card antigo, sem senha ─────────────────────────────────────
{
  const T = await nova(5199); const { page, reg } = T;
  await ir(page, 5199);
  ok(await page.getByPlaceholder("nome para a claim").count() === 1 && await page.getByRole("button", { name: /CONTINUAR/ }).count() === 1, "recurso desligado: o card de primeiro acesso continua o antigo (CONTINUAR)");
  ok(await page.getByLabel("Crie sua senha").count() === 0 && await page.getByRole("button", { name: /ENVIAR CÓDIGO/ }).count() === 0, "recurso desligado: nenhum campo de senha nem pedido de código");
  ok(reg.otp.length === 0 && reg.cadastro.length === 0, "recurso desligado: nenhuma chamada de conta");
  await T.browser.close();
}

// ── 2) recurso LIGADO (5197): o formulário ────────────────────────────────────────────────────
{
  const T = await nova(5197); const { page, reg, erros } = T;
  await ir(page, 5197);
  const t = await corpo(page);
  ok(t.toLowerCase().includes("primeiro acesso") && t.includes("Crie sua senha para acessar seus pedidos e pagamentos"), "o primeiro acesso mostra a criação de senha (texto do 'Ative sua conta')");
  ok(await rot(page, "Nome").count() === 1 && await rot(page, "Seu @").count() === 1 && await rot(page, "E-mail").count() === 1 && await rot(page, "WhatsApp").count() === 1 && await rot(page, "Quem te indicou").count() === 1, "campos de dados: nome, @, e-mail, whatsapp e indicação");
  ok(await rot(page, "Crie sua senha").count() === 1 && await rot(page, "Repita a senha").count() === 1 && (await rot(page, "Crie sua senha").getAttribute("placeholder")).includes("mínimo 8 caracteres"), "campos de senha: 'crie uma senha (mínimo 8 caracteres)' e 'repita a senha'");
  ok(await page.getByRole("button", { name: /ENVIAR CÓDIGO DE CONFIRMAÇÃO/ }).count() === 1 && await page.getByRole("button", { name: /CONTINUAR/ }).count() === 0, "botão 'Enviar código de confirmação' no lugar do CONTINUAR sem senha");
  // olhinho
  ok(await rot(page, "Crie sua senha").getAttribute("type") === "password", "a senha começa oculta");
  await page.getByTestId("olhinho-senha").first().click();
  ok(await rot(page, "Crie sua senha").getAttribute("type") === "text" && await rot(page, "Repita a senha").getAttribute("type") === "password", "o olhinho mostra só o campo clicado");
  await page.getByTestId("olhinho-senha").first().click();
  // validações: nada vai ao servidor
  await preencher(page, { nome: "Ana", cog: "ana", email: "isso-nao-e-email", senha: "senha-boa-123" }); await enviar(page);
  ok((await corpo(page)).includes("e-mail válido") && reg.otp.length === 0 && reg.cadastro.length === 0, "e-mail inválido: avisa e não envia nada");
  await rot(page, "E-mail").fill("ana@exemplo.com"); await rot(page, "Crie sua senha").fill("curta"); await rot(page, "Repita a senha").fill("curta"); await enviar(page);
  ok((await corpo(page)).includes("pelo menos 8 caracteres") && reg.otp.length === 0, "senha curta: avisa e não envia nada");
  await rot(page, "Crie sua senha").fill("senha-boa-123"); await rot(page, "Repita a senha").fill("outra-senha-123"); await enviar(page);
  ok((await corpo(page)).includes("senhas digitadas são diferentes") && reg.otp.length === 0, "senhas diferentes: avisa e não envia nada");
  await rot(page, "Repita a senha").fill("senha-boa-123"); await rot(page, "Seu @").fill(""); await enviar(page);
  ok((await corpo(page)).includes("preencha nome, @ e e-mail") && reg.otp.length === 0 && reg.cadastro.length === 0, "nome sem @: pede os dados do cadastro novo e não envia nada");
  ok(reg.rpc.length === 0 && !reg.tabelas.some(x => /joiners|masterlist/.test(x)), "nenhuma consulta ao servidor nem tabela privada durante a validação");
  ok(erros.length === 0, "formulário: nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}

// ── 3) CADASTRO NOVO: dados + senha → código → conta ativada e entrada ────────────────────────
{
  const T = await nova(5197, { codigo: "123456" }); const { page, reg, erros, consoles } = T;
  await ir(page, 5197);
  await preencher(page, { nome: "Ana Lima", cog: "@Ana", email: "Ana@Exemplo.com", whats: "11999990000", senha: "senha-boa-123" }); await enviar(page);
  ok(reg.cadastro.length === 1 && reg.cadastro[0].p_nome === "Ana Lima" && reg.cadastro[0].p_cog === "Ana" && reg.cadastro[0].p_email === "ana@exemplo.com" && reg.cadastro[0].p_whatsapp === "11999990000", "cadastro novo: o pedido de cadastro vai pela função segura com os dados informados");
  ok(reg.eventos.length === 1 && reg.eventos[0].evento === "novo_cadastro", "a administração é avisada do cadastro novo");
  ok(reg.otp.length === 1 && reg.otp[0].cog === "ana" && reg.otp[0].email === "ana@exemplo.com", "o código é pedido ao servidor para o e-mail informado");
  ok(JSON.stringify(reg.ordem) === JSON.stringify(["cadastro", "otp"]), "ordem: primeiro o cadastro, depois o pedido do código");
  const t1 = await corpo(page);
  ok(t1.toLowerCase().includes("confirme o seu e-mail") && /a•+@exemplo.com/.test(t1) && !t1.includes("ana@exemplo.com"), "etapa do código: mostra o e-mail só MASCARADO");
  ok(reg.verify.length === 0 && reg.put.length === 0, "antes do código: nada é confirmado nem a senha é gravada");
  ok(await page.getByRole("button", { name: /Reenviar código em/ }).isDisabled(), "reenvio fica bloqueado por 60 segundos");
  // código errado
  await confirmar(page, "000000");
  ok((await corpo(page)).includes("Código inválido ou expirado") && reg.put.length === 0 && !reg.rpc.includes("ativar_minha_conta"), "código errado: recusa, a senha NÃO é gravada e a conta NÃO é ativada");
  ok(!(await page.evaluate(() => localStorage.getItem("anticeg_user_v2"))), "código errado: nenhuma identidade fica guardada");
  // código certo
  await confirmar(page, "123456");
  ok(reg.verify.length === 2 && reg.put.length === 1 && reg.put[0] === "senha-boa-123", "código certo: o código é conferido e a senha é gravada no Auth");
  ok(reg.rpc.includes("ativar_minha_conta") && reg.ativarCog === "ana", "a conta é ligada ao cadastro pelo servidor (ativar_minha_conta)");
  { const o = reg.ordem; ok(o.lastIndexOf("verify") < o.indexOf("senha") && o.indexOf("senha") < o.indexOf("ativar"), "ordem: código conferido → senha gravada → conta ativada"); }
  const user = JSON.parse(await page.evaluate(() => localStorage.getItem("anticeg_user_v2")) || "{}");
  ok(user.cog === "ana" && user.acesso_simples === false && user.email === "ana@exemplo.com", "entra logada com a conta COMPLETA (dados da própria pessoa)");
  ok(new URL(page.url()).pathname === "/", "sai da página pública de primeiro acesso depois de entrar");
  const rastros = JSON.stringify(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie }))) + "\n" + consoles.join("\n");
  ok(!rastros.includes("senha-boa-123"), "a senha digitada não fica em armazenamento do navegador, cookies nem console");
  ok(erros.length === 0, "cadastro novo: nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}

// ── 4) CADASTRO EXISTENTE (só ativação): sem nome, não cria cadastro; e-mail sem @ ─────────────
{
  const T = await nova(5197, { codigo: "123456" }); const { page, reg } = T;
  await ir(page, 5197);
  await preencher(page, { cog: "ana", email: "ana@exemplo.com", senha: "senha-boa-123" }); await enviar(page);
  ok(reg.cadastro.length === 0 && reg.otp.length === 1, "sem nome: NÃO cria cadastro; só pede o código para o cadastro existente");
  await confirmar(page, "123456");
  const user = JSON.parse(await page.evaluate(() => localStorage.getItem("anticeg_user_v2")) || "{}");
  ok(user.cog === "ana" && user.acesso_simples === false, "ativação de cadastro existente: entra com a conta completa");
  await T.browser.close();
}
{
  const T = await nova(5197, { codigo: "123456" }); const { page, reg } = T;
  await ir(page, 5197);
  await preencher(page, { email: "ana@exemplo.com", senha: "senha-boa-123" }); await enviar(page);
  ok(reg.cadastro.length === 0 && reg.otp.length === 1 && JSON.stringify(reg.otp[0]) === JSON.stringify({ email: "ana@exemplo.com" }), "só com o e-mail (sem @): o pedido vai só com o e-mail");
  await confirmar(page, "123456");
  ok(reg.rpc.includes("cog_para_ativar") && reg.ativarCog === "ana", "sem @: o servidor diz qual é o @ da conta depois de provar o e-mail");
  await T.browser.close();
}

// ── 5) quando NENHUM código é enviado / resultados da ativação ────────────────────────────────
for (const [prox, trecho] of [["entrar", "Você já tem conta"], ["aguardando", "ainda não foi liberada"], ["comprovar", "verificação extra"], ["ajuda", "Não conseguimos liberar"]]) {
  const T = await nova(5197, { proximo: prox }); const { page, reg } = T;
  await ir(page, 5197);
  await preencher(page, { cog: "ana", email: "ana@exemplo.com", senha: "senha-boa-123" }); await enviar(page);
  const c = await corpo(page);
  ok(c.toLowerCase().includes("nenhum código foi enviado") && c.includes(trecho) && reg.verify.length === 0, `proximo=${prox}: avisa que nenhum código foi enviado e explica o próximo passo`);
  if (prox === "entrar") { await page.getByRole("button", { name: /ENTRAR/ }).click(); await page.waitForTimeout(700); ok(new URL(page.url()).pathname === "/", "proximo=entrar: o botão leva à tela inicial para entrar"); }
  await T.browser.close();
}
{
  const T = await nova(5197, { codigo: "123456", ativar: "aguardando_liberacao" }); const { page } = T;
  await ir(page, 5197);
  await preencher(page, { cog: "ana", email: "ana@exemplo.com", senha: "senha-boa-123" }); await enviar(page); await confirmar(page, "123456");
  ok((await baixa(page)).includes("ativação em breve") && !(await page.evaluate(() => localStorage.getItem("anticeg_user_v2"))), "ativação ainda não liberada: avisa e NÃO entra");
  await T.browser.close();
}
{
  const T = await nova(5197, { codigo: "123456", ativar: "pendente" }); const { page } = T;
  await ir(page, 5197);
  await preencher(page, { cog: "ana", email: "ana@exemplo.com", senha: "senha-boa-123" }); await enviar(page); await confirmar(page, "123456");
  ok((await baixa(page)).includes("falta só uma conferência") && !(await page.evaluate(() => localStorage.getItem("anticeg_user_v2"))), "ativação pendente: orienta a falar com a administração e NÃO entra");
  await T.browser.close();
}
{
  const T = await nova(5197, { codigo: "123456", perfilPendente: true }); const { page } = T;
  await ir(page, 5197);
  await preencher(page, { cog: "ana", email: "ana@exemplo.com", senha: "senha-boa-123" }); await enviar(page); await confirmar(page, "123456");
  const user = JSON.parse(await page.evaluate(() => localStorage.getItem("anticeg_user_v2")) || "{}");
  ok(user.cog === "ana" && user.acesso_simples === true && !("email" in user), "perfil ainda por concluir: entra só com a identidade mínima (o site pede a conclusão do perfil com a sessão já aberta)");
  await T.browser.close();
}

// ── 6) navegação: corrigir dados, reenviar, já tenho conta, limite de tentativas ───────────────
{
  const T = await nova(5197); const { page, reg } = T;
  await ir(page, 5197);
  await preencher(page, { cog: "ana", email: "ana@exemplo.com", senha: "senha-boa-123" }); await enviar(page);
  await page.getByRole("button", { name: /corrigir dados/ }).click(); await page.waitForTimeout(400);
  ok(await rot(page, "E-mail").inputValue() === "ana@exemplo.com" && await rot(page, "Crie sua senha").inputValue() === "senha-boa-123", "'corrigir dados' volta ao formulário sem perder o que foi digitado");
  await page.getByTestId("cad-ja-tenho-conta").click(); await page.waitForTimeout(700);
  ok(new URL(page.url()).pathname === "/", "'Já tenho conta? Entrar' volta à tela inicial");
  ok(reg.verify.length === 0, "navegar não confirma nada");
  await T.browser.close();
}
{
  const T = await nova(5197, { otpErro: true }); const { page } = T;
  await ir(page, 5197);
  await preencher(page, { cog: "ana", email: "ana@exemplo.com", senha: "senha-boa-123" }); await enviar(page);
  ok((await corpo(page)).includes("Muitas tentativas") && await page.getByRole("button", { name: /ENVIAR CÓDIGO DE CONFIRMAÇÃO/ }).count() === 1, "limite de tentativas: mostra o aviso e continua no formulário");
  await T.browser.close();
}
{
  const T = await nova(5197, { cadastro: { ok: false, motivo: "recrutador_invalido" } }); const { page, reg } = T;
  await ir(page, 5197);
  await preencher(page, { nome: "Ana", cog: "ana", email: "ana@exemplo.com", senha: "senha-boa-123" }); await enviar(page);
  ok((await corpo(page)).includes("Recrutador não encontrado") && reg.otp.length === 0, "cadastro recusado (recrutador inválido): avisa e NÃO pede código");
  await T.browser.close();
}
// página de convite (/recrutador) também tem o cadastro com senha
{
  const T = await nova(5197); const { page } = T;
  await ir(page, 5197, "/recrutador");
  ok(await rot(page, "Crie sua senha").count() === 1 && (await corpo(page)).includes("Entrar na comunidade"), "/recrutador: botão da comunidade e cadastro com senha");
  await T.browser.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
