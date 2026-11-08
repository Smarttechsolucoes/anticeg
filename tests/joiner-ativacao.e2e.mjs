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
  const reg = { otp: [], verify: [], put: [], rpc: [], ordem: [], ajuda: [] };
  await ctx.route("**/*", async route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    // o pedido do código vai para a FUNÇÃO do servidor (nunca direto ao Auth): ela decide se envia e responde sempre igual
    if (u.includes("/functions/v1/pedir-codigo-joiner")) { reg.otp.push(JSON.parse(req.postData() || "{}")); reg.ordem.push("otp"); return cen.otpErro ? json(429, { error: "Muitas tentativas. Espere alguns minutos e tente de novo." }) : json(200, { ok: true }); }
    if (u.includes("/functions/v1/pedir-ajuda-ativacao")) { reg.ajuda.push(JSON.parse(req.postData() || "{}")); return cen.ajudaErro ? json(429, { error: "Muitos pedidos. Espere alguns minutos e tente de novo." }) : json(200, { ok: true }); }
    if (u.includes("/rest/v1/rpc/entrar_com_arroba")) { reg.rpc.push("entrar_com_arroba"); return cen.liberacaoServidor === undefined ? json(200, null) : json(200, { encontrado: true, cog: "ana", nome_site: "Ana", foto_perfil: null, conta_ativa: false, ativacao_liberada: cen.liberacaoServidor }); }
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/otp") { reg.otpDireto = (reg.otpDireto || 0) + 1; return json(200, {}); }
      if (p === "/verify") { const c = JSON.parse(req.postData() || "{}"); reg.verify.push(c); reg.ordem.push("verify"); return c.token === cen.codigo ? json(200, sessao()) : json(403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" }); }
      if (p === "/user" && m === "PUT") { const c = JSON.parse(req.postData() || "{}"); reg.put.push(c.password); reg.ordem.push("senha"); return cen.putErro ? json(422, { code: 422, error_code: "weak_password", msg: "Password is known to be weak" }) : json(200, sessao().user); }
      if (p === "/user") return json(200, sessao().user);
      if (p === "/logout") return route.fulfill({ status: 204, body: "" });
      return json(200, {});
    }
    if (cen.simularEstado && u.includes("/rest/v1/rpc/meu_estado_conta")) return json(200, reg.ativou ? { vinculada: true, concluido: false, joiner_id: 5, cog: "ana", nome_site: "Ana", arroba: "@ana", email_mascarado: "a***@exemplo.com" } : { vinculada: false });
    if (u.includes("/rest/v1/rpc/meu_cog")) { reg.rpc.push("meu_cog"); return json(200, cen.cogDaConta ?? null); }
    if (u.includes("/rest/v1/rpc/ativar_minha_conta")) { reg.rpc.push("ativar:" + JSON.parse(req.postData() || "{}").p_cog); reg.ordem.push("ativar"); if (cen.latenciaAtivar) await new Promise(r => setTimeout(r, cen.latenciaAtivar)); if ((cen.ativar || "ok") === "ok") reg.ativou = true; return json(200, { status: cen.ativar || "ok" }); }
    if (u.includes("supabase.co/rest/v1/")) {
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      if (u.includes("/rest/v1/joiners") && objeto) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cen.usuario) });
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  const consoles = []; page.on("console", m => consoles.push(m.text()));
  return { browser, page, reg, erros, consoles };
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
  const T = await nova(5197, { usuario: ANA, versao: "6", codigo: "123456", ativar: "ok", simularEstado: true, latenciaAtivar: 600 }); const { page, reg, erros, consoles } = T;   // latência: reproduz a corrida entre a leitura do estado e o fim da ativação
  // a senha digitada NUNCA pode estar em armazenamento persistente do navegador, em cookies ou no console (logs)
  const rastros = async () => JSON.stringify(await page.evaluate(async () => {
    const dump = s => { const o = {}; for (let i = 0; i < s.length; i++) o[s.key(i)] = s.getItem(s.key(i)); return o; };
    let idb = []; try { idb = (await indexedDB.databases?.()) || []; } catch { /* sem IndexedDB */ }
    return { local: dump(localStorage), session: dump(sessionStorage), cookie: document.cookie, idb };
  })) + "\n" + consoles.join("\n");
  await abrir(page, 5197);
  ok(await modal(page).count() === 1, "primeiro acesso só com @: o pop-up obrigatório aparece");
  { const t = await modal(page).innerText(); ok(t.includes("Ative sua conta") && await page.getByTestId("ativacao-intro").innerText() === "Crie sua senha para acessar seus pedidos e pagamentos. Seu histórico continua no mesmo cadastro.", "título “Ative sua conta” e a introdução enxuta");
    ok((await page.getByLabel("E-mail do cadastro").getAttribute("placeholder")) === "seuemail@exemplo.com", "placeholder do e-mail: seuemail@exemplo.com");
    ok(await modal(page).getByRole("button", { name: "Voltar às áreas públicas", exact: true }).count() === 1 && !t.includes("Agora não"), "“Voltar às áreas públicas” no lugar de “Agora não: continuar só com o @”"); }
  ok((await page.getByLabel("Seu @ cadastrado").inputValue()) === "ana", "o @ já vem preenchido para confirmar");
  ok(await modal(page).getByTestId("fechar-acesso").count() === 1, "o pop-up tem X (leva às áreas públicas, sem liberar dado nem concluir nada)");
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
  ok(reg.otp.length === 1 && reg.otp[0].email === "ana@exemplo.com" && reg.otp[0].cog === "ana" && !("create_user" in reg.otp[0]) && !reg.otpDireto, "pede o código AO SERVIDOR (função), com o e-mail digitado normalizado e o @ como PEDIDO, não como prova; nunca direto ao Auth");
  ok(/a•+@exemplo.com/.test(await modal(page).innerText()) && (await page.getByTestId("ativacao-texto-codigo").innerText()) === "Se os dados informados corresponderem a um cadastro liberado para ativação, você receberá um código nesse e-mail." && !/enviamos|enviado/i.test(await page.getByTestId("ativacao-texto-codigo").innerText()), "tela do código mostra o e-mail mascarado e a frase neutra (não revela se o @ existe e NÃO afirma que o código foi enviado)");
  ok(await page.getByRole("button", { name: /Reenviar código em/ }).isDisabled(), "reenvio fica bloqueado por 60 segundos");
  { const av = page.getByTestId("ativacao-aviso-spam"), t = await modal(page).innerText();
    ok(await av.count() === 1 && (await av.innerText()) === "Confira também Spam ou Lixo Eletrônico. Se pedir outro código, use o mais recente.", "uma ÚNICA orientação: “Confira também Spam ou Lixo Eletrônico. Se pedir outro código, use o mais recente.”");
    ok((t.match(/Lixo Eletrônico/g) || []).length === 1 && !/Não é spam|Não encontrou/.test(t), "sem repetição do aviso de spam (aparece uma vez só)");
    const y = async el => (await el.boundingBox()).y, yEmail = await y(page.getByText("E-mail informado:")), yCampo = await y(page.getByLabel("Código de confirmação")), yBotao = await y(page.getByRole("button", { name: "Confirmar código" })), yAviso = await y(av);
    ok(yEmail < yCampo && yCampo < yBotao && yBotao < yAviso, "ordem na tela: e-mail informado, campo do código, botão principal e só depois a orientação");
    ok(await page.getByRole("button", { name: "Confirmar código" }).count() === 1 && await page.getByRole("button", { name: /Reenviar código/ }).count() === 1 && await page.getByRole("button", { name: "Corrigir dados" }).count() === 1 && (await page.getByTestId("ativacao-nao-recebi").innerText()) === "Preciso de ajuda", "um botão principal (Confirmar código); Reenviar código, Corrigir dados e Preciso de ajuda como ações secundárias");
    { const dica = page.getByTestId("ativacao-dica-ajuda"), yDica = await y(dica), yAjuda = await y(page.getByTestId("ativacao-nao-recebi"));
      ok((await dica.innerText()) === "Não recebeu o código? Toque em “Preciso de ajuda”." && yDica < yAjuda && yAjuda - yDica < 120 && yAviso < yDica, "a frase “Não recebeu o código? Toque em ‘Preciso de ajuda’.” aparece logo acima do link de ajuda (depois da orientação única de Spam)");
      ok(await page.getByTestId("ativacao-texto-codigo").innerText() === "Se os dados informados corresponderem a um cadastro liberado para ativação, você receberá um código nesse e-mail." && !/enviamos|enviado/i.test(await page.getByTestId("ativacao-texto-codigo").innerText()), "a resposta continua neutra (a frase de ajuda não altera o texto principal)"); }
    const peso = async nome => (await page.getByRole("button", { name: nome }).evaluate(el => { const c = getComputedStyle(el); return { fundo: c.backgroundColor, borda: c.borderTopWidth, sub: c.textDecorationLine }; }));
    const pp = await peso("Confirmar código"), ps = await peso(/Reenviar código/);
    ok(pp.fundo !== "rgba(0, 0, 0, 0)" && ps.fundo === "rgba(0, 0, 0, 0)" && ps.borda === "0px" && ps.sub.includes("underline"), "as ações secundárias têm menos peso visual (sem caixa, só texto sublinhado)");
    ok(await page.getByTestId("ativacao-reenviado").count() === 0, "antes de reenviar, a mensagem de outro código não aparece"); }
  ok(reg.put.length === 0 && reg.rpc.filter(r => r.startsWith("ativar")).length === 0, "até aqui: a senha NÃO foi gravada e nenhum vínculo foi pedido (só depois do código)");
  ok(!JSON.stringify(reg).includes("senha-boa-123") && !(await rastros()).includes("senha-boa-123"), "com a senha digitada e o código pedido: ela NÃO foi enviada ao servidor (função/Auth) e NÃO está no localStorage, sessionStorage, cookies nem no console");
  // código errado
  await page.getByLabel("Código de confirmação").fill("999999"); await page.getByRole("button", { name: "Confirmar código" }).click(); await page.waitForTimeout(500);
  ok((await corpo(page)).includes("Código inválido ou expirado") && reg.put.length === 0 && !reg.ordem.includes("ativar"), "código errado: recusado, a senha NÃO é gravada e nenhum vínculo é pedido");
  // código certo
  await page.getByLabel("Código de confirmação").fill("123456"); await page.getByRole("button", { name: "Confirmar código" }).click(); await page.waitForTimeout(900);
  ok(reg.ordem.slice(-3).join(">") === "verify>senha>ativar", "ordem segura: confere o código, SÓ DEPOIS grava a senha e depois pede o vínculo");
  ok(reg.put.at(-1) === "senha-boa-123" && reg.rpc.includes("ativar:ana"), "grava a senha escolhida e pede o vínculo do @ ana");
  await page.waitForTimeout(900);
  ok(await modal(page).count() === 0 && await page.getByTestId("area-protegida").count() === 0, "depois da ativação: o pop-up fecha e NÃO aparece a tela de login (mesmo com a resposta do servidor demorando)");
  ok(await page.getByTestId("completar-perfil").count() === 1 && (await page.getByTestId("completar-perfil").innerText()).includes("Confira seus dados"), "segue direto para a confirmação do perfil (“Confira seus dados”)");
  ok((await page.getByTestId("perfil-nome").inputValue()) === "Ana", "o nome para claim existente já vem preenchido para a pessoa revisar");
  ok(!(await rastros()).includes("senha-boa-123") && reg.put.filter(p => p === "senha-boa-123").length === 1, "depois de ativar: a senha foi ao Auth uma única vez (após verificar o código) e continua fora de armazenamento persistente, cookies e console");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}
{ // cadastro incompleto/conflitante: o servidor devolve 'pendente'
  const T = await nova(5197, { usuario: ANA, versao: "6", codigo: "123456", ativar: "pendente" }); const { page } = T;
  await abrir(page, 5197); await preencher(page);
  await page.getByLabel("Código de confirmação").fill("123456"); await page.getByRole("button", { name: "Confirmar código" }).click(); await page.waitForTimeout(800);
  const t = await modal(page).innerText();
  ok(t.includes("Nada se perdeu") && t.includes("Fale com a administração") && t.includes("modo limitado"), "pendente: mensagem amigável (nada se perde, falar com a administração, modo limitado)");
  ok(!/duplicad|compartilhad|ausente|inválido|conflit/i.test(t), "pendente: a tela NÃO revela o motivo (sem enumerar e-mails ou cadastros)");
  await page.getByRole("button", { name: "Continuar no modo limitado" }).click(); await page.waitForTimeout(300);
  ok(await modal(page).count() === 0, "continua navegando no modo limitado");
  await T.browser.close();
}
{ // reenviar: manda outro pedido ao servidor e lembra de usar o código mais recente
  const T = await nova(5197, { usuario: ANA, versao: "6" }); const { page, reg } = T;
  await page.clock.install(); await abrir(page, 5197); await preencher(page);
  const antes = reg.otp.length;
  for (let i = 0; i < 62; i++) { await page.clock.fastForward(1000); await page.waitForTimeout(20); }   // cada segundo agenda o próximo: avança um de cada vez
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Reenviar código" }).click(); await page.waitForTimeout(500);
  ok(reg.otp.length === antes + 1, "reenviar faz um novo pedido de código ao servidor");
  const m = page.getByTestId("ativacao-reenviado");
  ok(await m.count() === 1 && /Pedimos outro código/.test(await m.innerText()) && !/enviamos|enviado/i.test(await m.innerText()) && await page.getByTestId("ativacao-aviso-spam").count() === 1 && ((await modal(page).innerText()).match(/Lixo Eletrônico/g) || []).length === 1, "depois de reenviar: “Pedimos outro código…” (sem afirmar que foi enviado) e a orientação de Spam continua UMA só vez na tela");
  ok(await page.getByRole("button", { name: /Reenviar código em/ }).isDisabled(), "o reenvio volta a ficar bloqueado por 60 segundos");
  await T.browser.close();
}
{ // não tenho o e-mail do cadastro / não recebi o código: pedido de ajuda com caminho claro de atendimento
  const T = await nova(5197, { usuario: ANA, versao: "6" }); const { page, reg } = T;
  await abrir(page, 5197);
  await page.getByRole("button", { name: /Meu e-mail não está no cadastro/ }).click();
  const t = await modal(page).innerText();
  ok(t.includes("Pedir ajuda à administração") && t.includes("Não precisa criar outro cadastro") && reg.otp.length === 0 && reg.ajuda.length === 0, "caminho 'não lembro o e-mail': abre o formulário de ajuda, sem enviar nada ainda");
  await page.getByRole("button", { name: "Enviar pedido de ajuda" }).click(); await page.waitForTimeout(300);
  ok((await corpo(page)).includes("Informe um contato") && reg.ajuda.length === 0, "ajuda sem contato: recusada no navegador, nada enviado");
  await page.getByLabel("Contato para resposta").fill("whatsapp 11 90000-0000"); await page.getByLabel("O que aconteceu").fill("meu e-mail antigo não existe mais");
  await page.getByRole("button", { name: "Enviar pedido de ajuda" }).click(); await page.waitForTimeout(500);
  ok(reg.ajuda.length === 1 && reg.ajuda[0].cog === "ana" && reg.ajuda[0].contato === "whatsapp 11 90000-0000" && reg.ajuda[0].mensagem === "meu e-mail antigo não existe mais" && Object.keys(reg.ajuda[0]).sort().join() === "cog,contato,mensagem", "o pedido vai ao SERVIDOR só com @, contato e mensagem");
  ok(await page.getByTestId("ativacao-ajuda-enviada").count() === 1 && reg.otp.length === 0, "confirmação mostrada; nenhum código foi enviado por causa do pedido de ajuda");
  await page.getByRole("button", { name: "Continuar no modo limitado" }).click(); await page.waitForTimeout(300);
  ok(await modal(page).count() === 0, "e segue no modo limitado");
  await T.browser.close();
}
{ // não recebi o código: botão na tela do código
  const T = await nova(5197, { usuario: ANA, versao: "6" }); const { page, reg } = T;
  await abrir(page, 5197); await preencher(page);
  await page.getByTestId("ativacao-nao-recebi").click(); await page.waitForTimeout(200);
  ok(await page.getByTestId("ativacao-ajuda").count() === 1, "tela do código: 'Preciso de ajuda' abre o pedido de ajuda");
  await page.getByRole("button", { name: "Voltar", exact: true }).click(); await page.waitForTimeout(200);
  ok(await page.getByLabel("Código de confirmação").count() === 1 && reg.ajuda.length === 0, "voltar retorna à tela do código sem enviar nada");
  await T.browser.close();
}
{ // limite do pedido de ajuda
  const T = await nova(5197, { usuario: ANA, versao: "6", ajudaErro: true }); const { page } = T;
  await abrir(page, 5197);
  await page.getByTestId("ativacao-pedir-ajuda").click(); await page.getByLabel("Contato para resposta").fill("whatsapp 11 90000-0000");
  await page.getByRole("button", { name: "Enviar pedido de ajuda" }).click(); await page.waitForTimeout(500);
  ok((await corpo(page)).includes("Muitas tentativas") && await page.getByTestId("ativacao-ajuda-enviada").count() === 0, "limite do servidor no pedido de ajuda: mensagem amigável, continua no formulário");
  await T.browser.close();
}
{ // limite de envios do e-mail
  const T = await nova(5197, { usuario: ANA, versao: "6", otpErro: true }); const { page } = T;
  await abrir(page, 5197); await preencher(page);
  ok((await corpo(page)).includes("Muitas tentativas") && await page.getByLabel("Código de confirmação").count() === 0, "limite do servidor: mensagem amigável e continua na tela de dados");
  await T.browser.close();
}
{ // senha recusada pelo servidor depois do código
  const T = await nova(5197, { usuario: ANA, versao: "6", codigo: "123456", putErro: true }); const { page, reg } = T;
  await abrir(page, 5197); await preencher(page);
  await page.getByLabel("Código de confirmação").fill("123456"); await page.getByRole("button", { name: "Confirmar código" }).click(); await page.waitForTimeout(700);
  ok((await corpo(page)).includes("Senha fraca demais") && !reg.ordem.includes("ativar"), "senha fraca recusada pelo servidor: avisa e NÃO pede o vínculo");
  await T.browser.close();
}
{ // já ativada: não aparece
  const T = await nova(5197, { usuario: ANA, versao: "6", comSessao: true, cogDaConta: "ana" }); const { page } = T;
  await abrir(page, 5197);
  ok(await modal(page).count() === 0, "conta já ativada (sessão + vínculo ao mesmo @): o pop-up NÃO aparece");
  await T.browser.close();
}
{ // sessão de OUTRA pessoa neste aparelho
  const T = await nova(5197, { usuario: ANA, versao: "6", comSessao: true, cogDaConta: "bia" }); const { page } = T;
  await abrir(page, 5197);
  ok(await modal(page).count() === 1, "sessão ligada a OUTRO @: o pop-up aparece (não herda a conta de outra pessoa)");
  await T.browser.close();
}
{ // administradora: nunca vê o pop-up
  const T = await nova(5197, { usuario: OWNER, versao: "6" }); const { page } = T;
  await abrir(page, 5197);
  ok(await modal(page).count() === 0, "administradora: o pop-up NÃO aparece");
  await T.browser.close();
}
{ // invalidar sessões antigas: joiner sai, administradora fica
  const A = await nova(5197, { usuario: ANA, versao: "4" });
  await abrir(A.page, 5197);
  ok((await A.page.evaluate(() => localStorage.getItem("anticeg_user_v2"))) === null && (await A.page.evaluate(() => localStorage.getItem("anticeg_session_v"))) === "6", "lançamento: a sessão antiga (versão 4) de uma joiner é invalidada");
  await A.browser.close();
  const B = await nova(5197, { usuario: OWNER, versao: "4" });
  await abrir(B.page, 5197);
  ok(JSON.parse(await B.page.evaluate(() => localStorage.getItem("anticeg_user_v2")) || "null")?.cog === "nandaverseo_c", "lançamento: a sessão da administradora NÃO é invalidada");
  await B.browser.close();
}

{ // ativação ainda NÃO liberada para o grupo dela: sem pop-up automático, com aviso amigável quando ela procura ativar
  const T = await nova(5197, { usuario: { ...ANA, ativacao_liberada: false }, versao: "6", liberacaoServidor: false }); const { page, reg } = T;
  await page.goto("http://localhost:5197/", { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  ok(await modal(page).count() === 0, "ativação não liberada: o pop-up NÃO aparece sozinho (ela segue navegando só com o @)");
  await page.evaluate(() => window.dispatchEvent(new Event("anticeg:abrir-ativacao"))); await page.waitForTimeout(400);
  ok(await page.getByTestId("ativacao-aguardando").count() === 1 && (await modal(page).innerText()).includes("liberada em breve") && reg.otp.length === 0, "ao procurar ativar: aviso 'será liberada em breve', sem formulário e sem enviar e-mail");
  await T.browser.close();
}
{ // a onda dela foi liberada depois que ela digitou o @: o site confere no servidor e o pop-up passa a aparecer
  const T = await nova(5197, { usuario: { ...ANA, ativacao_liberada: false }, versao: "6", liberacaoServidor: true }); const { page } = T;
  await page.goto("http://localhost:5197/", { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  ok(await modal(page).count() === 1 && await page.getByLabel("Crie sua senha").count() === 1, "onda liberada no servidor: o pop-up de ativação passa a aparecer (sem precisar digitar o @ de novo)");
  await T.browser.close();
}
{ // o servidor responde que ainda aguarda a liberação (corrida: liberação recuada depois do código)
  const T = await nova(5197, { usuario: ANA, versao: "6", codigo: "123456", ativar: "aguardando_liberacao" }); const { page } = T;
  await abrir(page, 5197); await preencher(page);
  await page.getByLabel("Código de confirmação").fill("123456"); await page.getByRole("button", { name: "Confirmar código" }).click(); await page.waitForTimeout(900);
  ok(await page.getByTestId("ativacao-aguardando").count() === 1, "se o servidor ainda segura a ativação, a tela mostra o aviso de espera (e nenhum acesso é concedido)");
  await T.browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
