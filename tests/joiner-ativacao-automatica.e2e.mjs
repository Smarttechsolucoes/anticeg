// Teste de navegador da ATIVAÇÃO AUTOMÁTICA (J22), com a API simulada (Playwright). Não toca no Supabase real.
// Uso: VITE_JOINERS_AUTH=true VITE_ATIVACAO_AUTO=true npx vite --port 5195 --strictPort   e depois `node tests/joiner-ativacao-automatica.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PORTA = 5195, REF = "ghjfsmwwcfpfvrouyrka", UID = "00000000-0000-0000-0000-000000000005";
const ANA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", email: "registrado@exemplo.com", twitter: "@ana", confirmado: true };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, email: "novo@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinaturajoiner`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j",
  user: { id: UID, aud: "authenticated", role: "authenticated", email: "novo@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

// cen: { consulta (corpo da resposta de "consultar"), indisponivel, enviarResp, codigoCerto, concluir, putErro }
async function nova(cen) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(([u, ref]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_session_at_v2", String(Date.now()));
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
  }, [ANA, REF]);
  const reg = { auto: [], put: [], ordem: [], antigo: [] };
  await ctx.route("**/*", async route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }, body: JSON.stringify(body) });
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, PUT, GET, OPTIONS" }, body: "" });
    if (u.includes("/functions/v1/ativacao-automatica")) {
      const c = JSON.parse(req.postData() || "{}"); reg.auto.push(c); reg.ordem.push(c.acao);
      if (cen.indisponivel) return json(404, { error: "Function not found" });
      if (c.acao === "consultar") return json(200, cen.consulta);
      if (c.acao === "enviar") return json(200, cen.enviarResp ?? { ok: true });
      if (c.acao === "verificar") return c.codigo === (cen.codigoCerto ?? "123456") ? json(200, { ok: true, access_token: sessao().access_token, refresh_token: "r-j" }) : json(400, { error: "Código incorreto ou vencido. Peça outro código." });
      if (c.acao === "concluir") return json(200, { ok: true, resultado: cen.concluir ?? "ok" });
      return json(400, { error: "pedido inválido" });
    }
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/user" && m === "PUT") { const c = JSON.parse(req.postData() || "{}"); reg.put.push(c.password); reg.ordem.push("senha"); return cen.putErro ? json(422, { code: 422, error_code: "weak_password", msg: "Password is known to be weak" }) : json(200, sessao().user); }
      if (p === "/user") return json(200, sessao().user);
      if (p === "/logout") return route.fulfill({ status: 204, body: "" });
      return json(200, {});
    }
    if (u.includes("/rest/v1/rpc/meu_estado_conta")) return json(200, { vinculada: false });
    if (u.includes("supabase.co/rest/v1/")) {
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      if (u.includes("/rest/v1/joiners") && objeto) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ANA) });
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const abrir = async page => { await page.goto(`http://localhost:${PORTA}/masterlist`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); };
const corpo = page => page.locator("body").innerText();
const modal = page => page.getByTestId("ativacao-modal");
const continuar = async page => { await modal(page).getByRole("button", { name: "Continuar" }).click(); await page.waitForTimeout(500); };
const digitarCodigoESenha = async (page, codigo = "123456", senha = "senha-boa-123") => {
  await page.getByLabel("Código de confirmação").fill(codigo); await page.getByLabel("Crie sua senha").fill(senha); await page.getByLabel("Repita a senha").fill(senha);
  await modal(page).getByRole("button", { name: "Confirmar e ativar" }).click(); await page.waitForTimeout(900);
};

{ // 1) cadastro COM e-mail: só o @, e-mail mascarado, confirma, código, senha
  const T = await nova({ consulta: { ok: true, proximo: "confirmar_email", email_mascarado: "r•••@e•••.com" } }); const { page, reg, erros } = T; await abrir(page);
  ok(await page.getByTestId("auto-cog").count() === 1 && await modal(page).getByLabel("Seu @").count() === 1, "abre só com o campo do @ (sem e-mail nem senha nesta etapa)");
  ok((await modal(page).getByLabel("Seu @").inputValue()) === "ana", "o @ já vem preenchido");
  await continuar(page);
  ok(await page.getByTestId("auto-confirmar").count() === 1 && (await page.getByTestId("auto-mascara").innerText()) === "r•••@e•••.com", "mostra o e-mail do cadastro SÓ mascarado");
  ok(!(await modal(page).innerText()).includes("registrado@exemplo.com"), "o e-mail completo do cadastro não aparece no pop-up");
  ok(reg.ordem.join() === "consultar", "só consultou: nenhum código foi enviado ainda");
  await page.getByTestId("auto-sim-meu").click(); await page.waitForTimeout(500);
  ok(JSON.stringify(reg.auto[1]) === JSON.stringify({ acao: "enviar", cog: "ana", usar_cadastrado: true }), "'Sim, é o meu e-mail' manda SÓ o @ e usar_cadastrado (nunca um e-mail)");
  ok(await page.getByTestId("auto-codigo").count() === 1 && /Se os dados conferirem/.test(await page.getByTestId("auto-texto-codigo").innerText()), "tela do código: texto condicional (não afirma que chegou)");
  await digitarCodigoESenha(page);
  ok(reg.ordem.join() === "consultar,enviar,verificar,senha,concluir", "ordem: consultar, enviar, conferir código, gravar senha, concluir. Foi: " + reg.ordem.join());
  ok(JSON.stringify(reg.auto[2]) === JSON.stringify({ acao: "verificar", cog: "ana", codigo: "123456" }) && reg.put[0] === "senha-boa-123", "o código é conferido no servidor sem e-mail digitado; a senha vai só ao Auth");
  ok(!JSON.stringify(reg.auto).includes("senha-boa-123"), "a senha NUNCA vai para a função de ativação");
  ok(erros.length === 0, "nenhum erro de página: " + erros.join(" | "));
  await T.browser.close();
}
{ // 2) cadastro SEM e-mail: ela digita o e-mail
  const T = await nova({ consulta: { ok: true, proximo: "informar_email" } }); const { page, reg } = T; await abrir(page); await continuar(page);
  ok(await page.getByTestId("auto-outro").count() === 1, "sem e-mail no cadastro: pede o e-mail");
  await modal(page).getByLabel("Seu e-mail").fill("e-invalido"); await modal(page).getByRole("button", { name: "Enviar código" }).click(); await page.waitForTimeout(300);
  ok(/e-mail válido/.test(await corpo(page)) && reg.ordem.join() === "consultar", "e-mail inválido: avisa e não envia");
  await modal(page).getByLabel("Seu e-mail").fill(" Novo@Exemplo.com "); await modal(page).getByRole("button", { name: "Enviar código" }).click(); await page.waitForTimeout(500);
  ok(JSON.stringify(reg.auto[1]) === JSON.stringify({ acao: "enviar", cog: "ana", email: "novo@exemplo.com" }), "manda o e-mail digitado em minúsculas");
  await digitarCodigoESenha(page);
  ok(JSON.stringify(reg.auto[2]) === JSON.stringify({ acao: "verificar", cog: "ana", email: "novo@exemplo.com", codigo: "123456" }) && reg.ordem.at(-1) === "concluir", "o código é conferido para o e-mail digitado e a conta é concluída");
  await T.browser.close();
}
{ // 3) "Não é o meu e-mail": troca de e-mail
  const T = await nova({ consulta: { ok: true, proximo: "confirmar_email", email_mascarado: "r•••@e•••.com" } }); const { page, reg } = T; await abrir(page); await continuar(page);
  await page.getByTestId("auto-nao-meu").click(); await page.waitForTimeout(300);
  ok(await page.getByTestId("auto-outro").count() === 1 && reg.ordem.join() === "consultar", "'Não é o meu e-mail' leva a digitar outro, sem enviar nada");
  await T.browser.close();
}
{ // 4) servidor diz ajuda / entrar: a tela explica e nunca afirma envio
  for (const [prox, texto] of [["ajuda", /Não conseguimos liberar o código automaticamente/], ["entrar", /Você já tem conta/]]) {
    const T = await nova({ consulta: { ok: true, proximo: prox } }); const { page } = T; await abrir(page); await continuar(page);
    ok(await page.getByTestId("ativacao-sem-codigo").count() === 1 && texto.test(await corpo(page)), `proximo=${prox}: mostra a tela 'sem código' com a orientação certa`);
    await T.browser.close();
  }
}
{ // 5) código errado: erro claro, senha NÃO é gravada
  const T = await nova({ consulta: { ok: true, proximo: "informar_email" }, codigoCerto: "999999" }); const { page, reg } = T; await abrir(page); await continuar(page);
  await modal(page).getByLabel("Seu e-mail").fill("novo@exemplo.com"); await modal(page).getByRole("button", { name: "Enviar código" }).click(); await page.waitForTimeout(400);
  await digitarCodigoESenha(page, "123456");
  ok(/Código incorreto ou vencido/.test(await corpo(page)) && reg.put.length === 0 && !reg.ordem.includes("concluir"), "código errado: mostra o erro, não grava senha e não conclui");
  await T.browser.close();
}
{ // 6) senha recusada pelo Auth depois do código aceito: nova tentativa NÃO repete o código
  const T = await nova({ consulta: { ok: true, proximo: "informar_email" }, putErro: true }); const { page, reg } = T; await abrir(page); await continuar(page);
  await modal(page).getByLabel("Seu e-mail").fill("novo@exemplo.com"); await modal(page).getByRole("button", { name: "Enviar código" }).click(); await page.waitForTimeout(400);
  await digitarCodigoESenha(page);
  const verificacoes1 = reg.ordem.filter(x => x === "verificar").length;
  ok(/Senha fraca/.test(await corpo(page)) && verificacoes1 === 1 && !reg.ordem.includes("concluir"), "senha fraca: avisa e não conclui");
  await modal(page).getByLabel("Crie sua senha").fill("outra-senha-boa-456"); await modal(page).getByLabel("Repita a senha").fill("outra-senha-boa-456");
  await modal(page).getByRole("button", { name: "Confirmar e ativar" }).click(); await page.waitForTimeout(700);
  ok(reg.ordem.filter(x => x === "verificar").length === 1 && reg.put.length === 2, "nova tentativa de senha NÃO pede o código de novo (já foi aceito)");
  await T.browser.close();
}
{ // 7) conflito do banco: resultado 'pendente' vira a tela de pendência (a administração vê)
  const T = await nova({ consulta: { ok: true, proximo: "informar_email" }, concluir: "pendente" }); const { page } = T; await abrir(page); await continuar(page);
  await modal(page).getByLabel("Seu e-mail").fill("novo@exemplo.com"); await modal(page).getByRole("button", { name: "Enviar código" }).click(); await page.waitForTimeout(400);
  await digitarCodigoESenha(page);
  ok(await page.getByTestId("auto-codigo").count() === 0, "resultado pendente: sai da tela do código (não finge que ativou)");
  await T.browser.close();
}
{ // 8) função ainda não publicada: volta ao formulário antigo
  const T = await nova({ indisponivel: true }); const { page } = T; await abrir(page); await continuar(page);
  ok(await modal(page).getByLabel("Seu @ cadastrado").count() === 1 && await modal(page).getByLabel("E-mail do cadastro").count() === 1, "função indisponível: volta ao formulário antigo (nada quebra)");
  await T.browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
