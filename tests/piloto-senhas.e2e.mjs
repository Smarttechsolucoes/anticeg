// Teste de navegador da página /piloto-senha/ (piloto de senhas), com a API simulada (Playwright). Não toca no Supabase real.
// Uso:  npx vite --port 5196 --strictPort   e depois   node tests/piloto-senhas.e2e.mjs
// O que prova: o fluxo (código por e-mail → senha → login → sair → trocar → recuperar), o caso negativo (joiner fora da lista),
// que a página SÓ fala com os 3 endpoints de acesso + 2 RPCs de conta (nada de pedidos, pagamentos, comprovantes, planilha),
// e que a sessão do piloto fica separada da do site principal.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PORTA = 5196, REF = "ghjfsmwwcfpfvrouyrka";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000005", email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura`;
const USER = { id: "00000000-0000-0000-0000-000000000005", aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-piloto", user: USER });
const PERMITIDAS = [/\/functions\/v1\/(pedir-codigo-joiner|login-joiner|recuperar-senha-joiner)$/, /\/auth\/v1\/(verify|user|logout|token)$/, /\/rest\/v1\/rpc\/(ativar_minha_conta|meu_cog)$/];

// cen: { codigo, ativar, cogDaConta, loginOk, putErro }
async function nova(cen = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const reg = { fn: [], verify: [], put: [], rpc: [], ordem: [], externas: [], carregados: [] };
  let logado = false;
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) { reg.carregados.push(new URL(u).pathname); return route.continue(); }
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    reg.externas.push(m + " " + new URL(u).pathname);
    if (u.includes("/functions/v1/pedir-codigo-joiner")) { reg.fn.push(["pedir", JSON.parse(req.postData() || "{}")]); reg.ordem.push("otp"); return json(200, { ok: true }); }   // resposta SEMPRE igual, esteja ou não na lista
    if (u.includes("/functions/v1/login-joiner")) { const c = JSON.parse(req.postData() || "{}"); reg.fn.push(["login", c]); if (cen.loginOk && c.senha === "senha-boa-123") { logado = true; return json(200, { access_token: jwt(), refresh_token: "r-piloto", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer" }); } return json(401, { error: "@ ou senha incorretos." }); }
    if (u.includes("/functions/v1/recuperar-senha-joiner")) { reg.fn.push(["recuperar", JSON.parse(req.postData() || "{}")]); return json(200, { ok: true }); }
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/verify") { const c = JSON.parse(req.postData() || "{}"); reg.verify.push(c); reg.ordem.push("verify"); if (c.token === cen.codigo) { logado = true; return json(200, sessao()); } return json(403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" }); }
      if (p === "/user" && m === "PUT") { reg.put.push(JSON.parse(req.postData() || "{}").password); reg.ordem.push("senha"); return cen.putErro ? json(422, { code: 422, error_code: "weak_password", msg: "weak" }) : json(200, USER); }
      if (p === "/user") return json(200, USER);
      if (p === "/logout") { logado = false; reg.ordem.push("logout"); return route.fulfill({ status: 204, body: "" }); }
      return json(200, {});
    }
    if (u.includes("/rest/v1/rpc/meu_cog")) { reg.rpc.push("meu_cog"); return json(200, logado || cen.sessaoInicial ? (cen.cogDaConta ?? "ana") : null); }
    if (u.includes("/rest/v1/rpc/ativar_minha_conta")) { reg.rpc.push("ativar:" + JSON.parse(req.postData() || "{}").p_cog); reg.ordem.push("ativar"); return json(200, { status: cen.ativar || "ok" }); }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });       // qualquer outra coisa chega aqui e será acusada pelo teste
  });
  if (cen.sessaoInicial) await ctx.addInitScript(s => localStorage.setItem("anticeg-piloto-auth", JSON.stringify(s)), sessao());
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const abrir = async (page, caminho = "/piloto-senha/") => { await page.goto(`http://localhost:${PORTA}${caminho}`, { waitUntil: "networkidle" }); await page.waitForTimeout(500); };
const corpo = page => page.locator("body").innerText();
const T = (page, id) => page.getByTestId(id);
const proibidas = reg => reg.externas.filter(e => !PERMITIDAS.some(r => r.test(e.split(" ")[1])));

// ── 1) primeiro acesso completo: código → senha → conta ativa → trocar → sair → entrar ────────────────────────────────
{
  const { browser, page, reg, erros } = await nova({ codigo: "123456", loginOk: true });
  await abrir(page);
  ok(/Teste de senha/.test(await corpo(page)) && /não libera pedidos, pagamentos, comprovantes/.test(await corpo(page)), "a página abre com o aviso de que não libera pedidos, pagamentos, comprovantes nem planilha");
  ok(await page.locator('meta[name="robots"]').getAttribute("content") === "noindex, nofollow, noarchive", "a página pede para não ser indexada");
  await T(page, "campo-cog").fill("@Ana"); await T(page, "campo-email").fill("ana@exemplo.com"); await T(page, "enviar-codigo").click(); await page.waitForTimeout(500);
  ok(reg.fn.length === 1 && reg.fn[0][0] === "pedir" && reg.fn[0][1].cog === "ana" && reg.fn[0][1].email === "ana@exemplo.com", "o pedido de código vai ao SERVIDOR (função), com @ normalizado e o e-mail digitado: " + JSON.stringify(reg.fn[0]));
  ok(/Se os dados estiverem corretos/.test(await corpo(page)), "a mensagem depois do pedido é neutra (não confirma se o @ ou o e-mail existem)");
  await T(page, "campo-codigo").fill("123456"); await T(page, "campo-senha-nova").fill("senha-boa-123"); await T(page, "campo-senha-repetir").fill("senha-boa-123"); await T(page, "ativar").click(); await page.waitForTimeout(700);
  ok(JSON.stringify(reg.ordem) === JSON.stringify(["otp", "verify", "senha", "ativar"]) && reg.put[0] === "senha-boa-123" && reg.rpc.includes("ativar:ana"), "ordem: código → confirma o e-mail → grava a senha → pede o vínculo ao servidor: " + reg.ordem.join(","));
  ok(/Conta ativa: @ana/.test(await corpo(page)), "depois do vínculo mostra só 'Conta ativa'");
  ok(await page.evaluate(() => !!localStorage.getItem("anticeg-piloto-auth")) && await page.evaluate(ref => localStorage.getItem(`sb-${ref}-auth-token`) === null, REF), "a sessão fica na chave PRÓPRIA do piloto; a chave do site principal não é escrita");
  await T(page, "abrir-trocar").click(); await T(page, "campo-senha-nova").fill("senha-nova-456"); await T(page, "campo-senha-repetir").fill("senha-nova-456"); await T(page, "salvar-senha").click(); await page.waitForTimeout(500);
  ok(reg.put.at(-1) === "senha-nova-456" && /Senha alterada/.test(await corpo(page)), "trocar senha estando logada funciona");
  await T(page, "sair").click(); await page.waitForTimeout(500);
  ok(reg.ordem.at(-1) === "logout" && await T(page, "aba-entrar").count() === 1 && await page.evaluate(() => localStorage.getItem("anticeg-piloto-auth") === null), "sair encerra a sessão e apaga a chave do piloto");
  await T(page, "campo-cog").fill("ana"); await T(page, "campo-senha").fill("senha-ruim"); await T(page, "entrar").click(); await page.waitForTimeout(500);
  ok(/@ ou senha incorretos/.test(await corpo(page)) && await T(page, "conta-ativa").count() === 0, "login com senha errada: mensagem única e nada é liberado");
  await T(page, "campo-senha").fill("senha-boa-123"); await T(page, "entrar").click(); await page.waitForTimeout(700);
  ok(/Conta ativa: @ana/.test(await corpo(page)) && reg.fn.some(f => f[0] === "login" && f[1].cog === "ana"), "login com @ + senha pelo servidor funciona");
  ok(proibidas(reg).length === 0, "a página só falou com os endpoints permitidos (acesso e conta). Fora da lista: " + JSON.stringify(proibidas(reg)));
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await browser.close();
}

// ── 2) NEGATIVO: joiner fora da lista → o servidor responde igual e a ativação NÃO conclui ──────────────────────────────
{
  const { browser, page, reg } = await nova({ codigo: "654321", ativar: "aguardando_liberacao" });
  await abrir(page);
  await T(page, "campo-cog").fill("fora_da_lista"); await T(page, "campo-email").fill("fora@exemplo.com"); await T(page, "enviar-codigo").click(); await page.waitForTimeout(500);
  const textoForaDaLista = await corpo(page);
  ok(/Se os dados estiverem corretos/.test(textoForaDaLista), "fora da lista: a MESMA mensagem neutra (a página não revela quem está na lista)");
  await T(page, "campo-codigo").fill("654321"); await T(page, "campo-senha-nova").fill("senha-boa-123"); await T(page, "campo-senha-repetir").fill("senha-boa-123"); await T(page, "ativar").click(); await page.waitForTimeout(700);
  ok(/ainda não foi liberado/.test(await corpo(page)) && await T(page, "conta-ativa").count() === 0, "fora da lista: o servidor responde 'aguardando liberação' e a conta NÃO aparece como ativa");
  ok(reg.ordem.at(-1) === "logout" && await page.evaluate(() => localStorage.getItem("anticeg-piloto-auth") === null), "fora da lista: a sessão aberta pelo código é encerrada (nada fica ligado ao aparelho)");
  ok(proibidas(reg).length === 0, "fora da lista: também nenhuma chamada fora dos endpoints permitidos");
  await browser.close();
}
{
  const { browser, page } = await nova({ codigo: "111111", ativar: "pendente" });
  await abrir(page);
  await T(page, "campo-cog").fill("outra"); await T(page, "campo-email").fill("o@exemplo.com"); await T(page, "enviar-codigo").click(); await page.waitForTimeout(400);
  await T(page, "campo-codigo").fill("111111"); await T(page, "campo-senha-nova").fill("senha-boa-123"); await T(page, "campo-senha-repetir").fill("senha-boa-123"); await T(page, "ativar").click(); await page.waitForTimeout(700);
  ok(/Avise a administração/.test(await corpo(page)) && await T(page, "conta-ativa").count() === 0, "vínculo 'pendente' (ex.: e-mail diferente ou compartilhado): nada é ativado e a pessoa é orientada");
  await browser.close();
}
{
  const { browser, page } = await nova({ codigo: "222222" });
  await abrir(page);
  await T(page, "campo-cog").fill("ana"); await T(page, "campo-email").fill("ana@exemplo.com"); await T(page, "enviar-codigo").click(); await page.waitForTimeout(400);
  await T(page, "campo-codigo").fill("000000"); await T(page, "campo-senha-nova").fill("senha-boa-123"); await T(page, "campo-senha-repetir").fill("senha-boa-123"); await T(page, "ativar").click(); await page.waitForTimeout(600);
  ok(await T(page, "conta-ativa").count() === 0 && (await T(page, "aviso").count()) === 1, "código errado: não ativa e mostra erro");
  await T(page, "campo-senha-nova").fill("curta"); await T(page, "campo-senha-repetir").fill("curta"); await T(page, "ativar").click(); await page.waitForTimeout(400);
  ok(/mínimo|caracteres/i.test(await corpo(page)), "senha curta é recusada antes de qualquer chamada");
  await browser.close();
}

// ── 3) recuperação de senha por link ────────────────────────────────────────────────────────────────────────────────
{
  const { browser, page, reg } = await nova({ loginOk: true });
  await abrir(page);
  await T(page, "aba-esqueci").click(); await T(page, "campo-cog").fill("ana"); await T(page, "recuperar").click(); await page.waitForTimeout(500);
  ok(reg.fn.some(f => f[0] === "recuperar" && f[1].cog === "ana") && /Se existir uma conta ativada/.test(await corpo(page)), "esqueci a senha: pedido ao servidor e resposta neutra (não revela se existe conta)");
  const hash = `#access_token=${jwt()}&expires_in=3600&refresh_token=r-link&token_type=bearer&type=recovery`;
  await page.goto("about:blank");                                   // o link do e-mail abre numa carga NOVA (não é só troca de #)
  await page.goto(`http://localhost:${PORTA}/piloto-senha/${hash}`, { waitUntil: "networkidle" }); await page.waitForTimeout(900);
  ok(await T(page, "nova-senha-link").count() === 1, "abrindo o link de recuperação aparece a tela de senha nova");
  ok(await page.evaluate(ref => localStorage.getItem(`sb-${ref}-auth-token`) === null, REF), "o link de recuperação NÃO é absorvido pelo cliente do site principal");
  await T(page, "campo-senha-nova").fill("senha-recuperada-789"); await T(page, "campo-senha-repetir").fill("senha-recuperada-789"); await T(page, "salvar-senha").click(); await page.waitForTimeout(700);
  ok(reg.put.at(-1) === "senha-recuperada-789" && /Senha alterada\. Agora entre/.test(await corpo(page)) && reg.ordem.at(-1) === "logout", "senha nova gravada; a sessão do link termina e o teste seguinte é entrar com a senha nova");
  ok(proibidas(reg).length === 0, "recuperação: nenhuma chamada fora dos endpoints permitidos");
  await browser.close();
}

// ── 4) sessão existente é reconhecida; o site principal não carrega nada do piloto ────────────────────────────────────────
{
  const { browser, page } = await nova({ sessaoInicial: true, cogDaConta: "ana" });
  await abrir(page);
  ok(/Conta ativa: @ana/.test(await corpo(page)), "com sessão do piloto já aberta, a página reconhece a conta (sem nova ativação)");
  await browser.close();
}
{
  const { browser, page, reg } = await nova();
  await abrir(page, "/");
  ok(!reg.carregados.some(p => /PilotoSenha|piloto-main/i.test(p)), "o site principal NÃO carrega o código do piloto");
  ok(!reg.externas.some(e => /rpc\/(ativar_minha_conta|meu_cog)|pedir-codigo-joiner|login-joiner/.test(e)), "o site principal não faz nenhuma chamada de conta nova");
  await browser.close();
}

// ── 5) o navegador não conhece quem está autorizado ────────────────────────────────────────────────────────────────────
{
  const codigo = ["src/PilotoSenha.jsx", "piloto-senha/index.html", "src/piloto-main.jsx"].map(f => readFileSync(new URL("../" + f, import.meta.url), "utf8")).join("\n");
  ok(!/al\.melo|nicknowsaurus|lyrichangbin|gnabjubs|ttalilitinha/i.test(codigo) && !/\b(187751|7213)\b/.test(codigo), "nenhum nome ou ID da lista autorizada existe no código do navegador (a lista é só do servidor)");
  const pagina = readFileSync(new URL("../src/PilotoSenha.jsx", import.meta.url), "utf8");
  ok(!/\.from\(|\.storage\b|\bfetch\(|rest\/v1|XMLHttpRequest/.test(pagina), "o código da página não consulta tabelas, storage nem faz requisições próprias (só usa o cliente de acesso)");
  const imports = [...pagina.matchAll(/^import .* from "([^"]+)";/gm)].map(m => m[1]).sort();
  ok(JSON.stringify(imports) === JSON.stringify(["./joinerAuth.js", "./supabase.js", "@supabase/supabase-js", "react"]), "a página só importa react, o supabase-js, o cliente principal (só as constantes públicas) e o joinerAuth: " + imports.join(", "));
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
