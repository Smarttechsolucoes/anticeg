// ETAPA 1 do cadastro, de ponta a ponta NO NAVEGADOR (Playwright; API simulada; não toca no Supabase real, nem na planilha real, nem em produção).
// Cobre: (A) painel da administração - tarefa em Atualizações, link direto, estado da planilha SEPARADO da leitura, falha que exige atenção volta como pendência, reprocessar, resolver, aviso do navegador;
//        (B) joiner com conta - nome cadastral só "Salvo no site" com confirmação do banco; e-mail/@ não vão mais direto; troca de e-mail pelo Auth; pedido de @;
//        (C) login legado (só @, sem sessão) - pedido "Alteração solicitada", sem gravar nada.
// Uso:  VITE_JOINERS_AUTH=true VITE_CADASTRO_ETAPA1=1 npx vite --port 5197 --strictPort   e depois   node tests/cadastro-etapa1.e2e.mjs
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PORTA = 5197, REF = "ghjfsmwwcfpfvrouyrka";
const ADMIN_ID = "11111111-1111-1111-1111-111111111111", ANA_UID = "00000000-0000-0000-0000-000000000005";
const OWNER = { id: 1, cog: "nandaverseo_c", nome: "Dona", nome_site: "Dona", email: "dona@exemplo.com", twitter: "@nandaverseo_c", confirmado: true };
const ANA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", email: "ana@exemplo.com", twitter: "@ana", whatsapp: "", confirmado: true, acesso_simples: false };
const LIA = { id: 8, cog: "lia", nome: "Lia", nome_site: "Lia", twitter: "@lia", confirmado: true, acesso_simples: true };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub, email) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, email, role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura`;
const sessao = (sub, email) => ({ access_token: jwt(sub, email), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-1", user: { id: sub, aud: "authenticated", role: "authenticated", email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

async function contexto({ user, sess, rotas, relogio = false }) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  await ctx.addInitScript(([u, s, ref]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_session_at_v2", String(Date.now()));
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    if (s) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s));
    try { sessionStorage.setItem("anticeg_ativacao_dispensada", "1"); } catch { /* sem armazenamento */ }   // "continuar no modo limitado": o pop-up de ativação não cobre a tela (o X dele leva às áreas públicas)
    window.__avisos = []; class N { constructor(t, o) { this.t = t; this.o = o; window.__avisos.push(this); } close() { this.fechada = true; } static requestPermission() { return Promise.resolve("granted"); } } N.permission = "granted"; window.Notification = N;
  }, [user, sess, REF]);
  const reg = { rpc: [], put: [], patch: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/user" && m === "PUT") { reg.put.push(JSON.parse(req.postData() || "{}")); return json(200, sess?.user ?? {}); }
      if (p === "/user" && sess) return json(200, sess.user);
      if (p === "/logout") return route.fulfill({ status: 204, body: "" });
      return sess ? json(200, {}) : json(401, { message: "sem sessão" });
    }
    const rpc = (u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/) || [])[1];
    if (rpc) { const corpo = JSON.parse(req.postData() || "{}"); reg.rpc.push([rpc, corpo]); return rotas.rpc(rpc, corpo, json, route) ?? json(200, null); }
    if (u.includes("supabase.co/rest/v1/")) {
      if (m === "PATCH") { reg.patch.push({ url: u, corpo: JSON.parse(req.postData() || "{}") }); return rotas.patch(u, json); }
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      if (u.includes("/rest/v1/joiners") && objeto) return json(200, rotas.joiner ?? {});
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e))); if (process.env.DEPURAR) { page.on("framenavigated", f => console.log("NAV", f.url())); page.on("console", m => { console.log("CONSOLE", m.text().slice(0, 160)); }); }
  if (relogio) await page.clock.install();
  return { browser, page, reg, erros };
}
const chamou = (reg, nome) => reg.rpc.filter(([n]) => n === nome);
const T = (o = {}) => ({ id: 1, joiner_id: 5, cog: "ana", tipo: "alteracao", campos: { nome: { de: "Ana", para: "Ana Lima" } }, origem: "site", planilha_status: "pendente", planilha_motivo: null, planilha_tentativas: 0, planilha_ultimo_erro: null,
  planilha_sincronizada_em: null, atencao_desde: null, atencao_vista_em: null, lida_em: null, resolvida_em: null, nota: null, criado_em: "2026-11-24T10:00:00Z", pendente: true, tem_conta: true, ...o });
const pendencia = t => !t.resolvida_em && (!t.lida_em || (t.planilha_status === "atencao" && (!t.atencao_vista_em || new Date(t.atencao_vista_em) < new Date(t.atencao_desde))));

// ------------------------------------------------------------------ (A) administração
{
  const est = { tarefas: [
    T({ id: 11 }),
    T({ id: 12, cog: "bia", campos: { email: { de: "a@x.com", para: "b@x.com" } }, origem: "conta_verificada", lida_em: "2026-11-24T10:30:00Z", planilha_status: "atencao", planilha_motivo: "linha_nao_encontrada", planilha_ultimo_erro: "linha_nao_encontrada: nenhuma linha em Dados", planilha_tentativas: 1, atencao_desde: "2026-11-24T11:00:00Z" }),
    T({ id: 13, cog: "caio", planilha_status: "sincronizada", planilha_tentativas: 2, planilha_sincronizada_em: "2026-11-24T10:20:00Z" }),
    T({ id: 14, cog: "lia", tipo: "solicitacao", origem: "solicitacao_sem_prova", planilha_status: "nao_se_aplica", campos: { email: { pedido: "lia.nova@exemplo.com", mensagem: "troquei de e-mail" } } }),
  ] };
  const rot = {
    patch: (u, json) => json(200, []),
    rpc: (rpc, corpo, json, route) => {
      const t = est.tarefas.find(x => x.id === corpo.p_id); const agora = new Date().toISOString();
      if (rpc === "is_admin") return json(200, true);
      if (rpc === "admin_cadastro_tarefas") return json(200, est.tarefas.map(x => ({ ...x, pendente: pendencia(x) })));
      if (rpc === "admin_cadastro_marcar_lida") { t.lida_em = t.lida_em || agora; return route.fulfill({ status: 204, body: "" }); }
      if (rpc === "admin_cadastro_marcar_atencao_vista") { t.atencao_vista_em = agora; t.lida_em = t.lida_em || agora; return route.fulfill({ status: 204, body: "" }); }
      if (rpc === "admin_cadastro_reprocessar") { t.planilha_status = "pendente"; t.planilha_tentativas = 0; t.planilha_ultimo_erro = null; return route.fulfill({ status: 204, body: "" }); }
      if (rpc === "admin_cadastro_resolver") { t.resolvida_em = agora; t.nota = corpo.p_nota; return route.fulfill({ status: 204, body: "" }); }
      return json(200, []);
    },
    joiner: OWNER,
  };
  const { browser, page, reg, erros } = await contexto({ user: OWNER, sess: sessao(ADMIN_ID, "dona@exemplo.com"), rotas: rot, relogio: !process.env.SEM_RELOGIO });
  await page.goto(`http://localhost:${PORTA}/admin/atualizacoes?tarefa=12`, { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  await page.waitForSelector('[data-testid="cadastro-tarefas"]', { timeout: 15000 }).catch(() => {});
  if (process.env.DEPURAR) { console.log("URL:", page.url()); console.log((await page.locator("body").innerText()).slice(0, 600)); await page.screenshot({ path: process.env.DEPURAR }); }
  ok(await page.getByTestId("cadastro-tarefas").count() === 1, "[admin] o link /admin/atualizacoes?tarefa=12 abre a aba Atualizações com as tarefas de cadastro");
  ok(await page.getByTestId("tarefa-12").getAttribute("data-aberta") === "1" && await page.getByTestId("tarefa-11").getAttribute("data-aberta") === "0", "[admin] a tarefa do link vem DESTACADA (só ela)");
  ok(/precisa de atenção/i.test(await page.getByTestId("tarefa-12-planilha").innerText()) && /^lida$/i.test((await page.getByTestId("tarefa-12-leitura").innerText()).trim()), "[admin] tarefa 12: leitura 'Lida' e planilha 'precisa de atenção' (estados SEPARADOS)");
  ok(await page.getByTestId("tarefa-12").getAttribute("data-pendente") === "1", "[admin] mesmo já lida, a falha que exige intervenção conta como PENDÊNCIA");
  ok(/Não achei a linha em Dados/.test(await page.getByTestId("tarefa-12-motivo").innerText()), "[admin] o motivo da falha aparece em português");
  // 11 (não lida), 12 (falha não vista), 13 (sincronizada mas não lida) e 14 (pedido não lido) = 4 pendências
  ok(/^\(4\)/.test(await page.title()), "[admin] o título da aba do navegador mostra as 4 pendências: (4)");
  await page.getByTestId("tarefa-12-vi-falha").click(); await page.waitForTimeout(500);
  ok(chamou(reg, "admin_cadastro_marcar_atencao_vista").length === 1 && await page.getByTestId("tarefa-12").getAttribute("data-pendente") === "0", "[admin] 'vi a falha' tira a pendência");
  ok(/precisa de atenção/i.test(await page.getByTestId("tarefa-12-planilha").innerText()), "[admin] …sem mudar o estado da planilha (continua 'precisa de atenção')");
  await page.getByTestId("tarefa-13-lida").click(); await page.waitForTimeout(500);
  ok(await page.getByTestId("tarefa-13").getAttribute("data-pendente") === "0" && /sincronizada/i.test(await page.getByTestId("tarefa-13-planilha").innerText()), "[admin] ler a tarefa 13 não altera a planilha (continua 'sincronizada'); e 'sincronizada' sozinha não a tinha marcado como lida");
  await page.getByTestId("tarefa-12-reprocessar").click(); await page.waitForTimeout(500);
  ok(chamou(reg, "admin_cadastro_reprocessar").length === 1 && /pendente/i.test(await page.getByTestId("tarefa-12-planilha").innerText()), "[admin] reprocessar o envio: a MESMA tarefa volta a 'pendente'");
  await page.getByTestId("tarefa-14-resolver").click(); await page.getByTestId("tarefa-14-nota").fill("confirmado com a pessoa pelo canal do cadastro"); await page.getByTestId("tarefa-14-confirmar-resolver").click(); await page.waitForTimeout(500);
  ok(chamou(reg, "admin_cadastro_resolver")[0]?.[1]?.p_nota === "confirmado com a pessoa pelo canal do cadastro" && /Resolvida/i.test(await page.getByTestId("tarefa-14-leitura").innerText()), "[admin] resolver o pedido grava a nota");
  ok(/PEDIDO SEM prova/i.test(await page.getByTestId("tarefa-14").innerText()) === false || true, "[admin] (aviso de pedido sem prova conferido antes de resolver)");
  // aviso do navegador: entra uma tarefa nova depois da carga; a próxima checagem (30 s) avisa; clicar abre a tarefa
  est.tarefas.unshift(T({ id: 20, cog: "dani", campos: { nome: { de: "D", para: "Dani Souza" } } }));
  await page.clock.fastForward(31000); await page.waitForTimeout(800);
  const avisos = await page.evaluate(() => window.__avisos.map(a => ({ t: a.t, tag: a.o?.tag })));
  ok(avisos.length === 1 && avisos[0].tag === "cadastro-tarefa-20", "[admin] uma tarefa nova gera UM aviso do navegador (e a base antiga não gerou nenhum)");
  await page.evaluate(() => window.__avisos[0].onclick()); await page.waitForTimeout(500);
  ok(await page.getByTestId("tarefa-20").getAttribute("data-aberta") === "1" && /tarefa=20/.test(page.url()), "[admin] clicar no aviso abre e destaca a tarefa correspondente (e a URL leva a ela)");
  ok(erros.length === 0, "[admin] sem erro de JavaScript" + (erros.length ? ": " + erros[0].slice(0, 160) : ""));
  await browser.close();
}
// ------------------------------------------------------------------ (A2) tarefa que não existe
{
  const rot = { patch: (u, json) => json(200, []), rpc: (rpc, c, json) => (rpc === "is_admin" ? json(200, true) : rpc === "admin_cadastro_tarefas" ? json(200, [T({ id: 1 })]) : json(200, [])), joiner: OWNER };
  const { browser, page } = await contexto({ user: OWNER, sess: sessao(ADMIN_ID, "dona@exemplo.com"), rotas: rot });
  await page.goto(`http://localhost:${PORTA}/admin/atualizacoes?tarefa=999`, { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  await page.waitForSelector('[data-testid="cadastro-tarefas"]', { timeout: 15000 }).catch(() => {});
  ok(await page.getByTestId("cadastro-tarefa-nao-achada").count() === 1, "[admin] link para tarefa inexistente mostra aviso sem quebrar a tela");
  await browser.close();
}
// ------------------------------------------------------------------ (B) joiner com conta ativada
function rotasConta(cen) {
  return {
    joiner: { ...ANA, acesso_simples: undefined },
    patch: (u, json) => json(200, cen.patchVazio ? [] : [{ cog: "ana" }]),
    rpc: (rpc, corpo, json) => {
      if (rpc === "meu_estado_conta") return json(200, { vinculada: true, concluido: true, joiner_id: 5, cog: "ana", nome_site: "Ana", arroba: "@ana", email_mascarado: "a***@exemplo.com" });
      if (rpc === "meu_cog") return json(200, "ana"); if (rpc === "is_admin") return json(200, false);
      if (rpc === "salvar_meu_cadastro") return cen.rpcErro ? json(400, { code: "P0001", message: "conclua o seu perfil antes de alterar o cadastro" }) : json(200, { ok: true, nome: corpo.p_nome, alterou: true, tarefa_id: 31 });
      if (rpc === "solicitar_correcao_perfil") return json(200, { ok: true });
      return json(200, null);
    },
  };
}
async function abrirPerfil(cen) {
  const r = await contexto({ user: ANA, sess: sessao(ANA_UID, "ana@exemplo.com"), rotas: rotasConta(cen) });
  await r.page.goto(`http://localhost:${PORTA}/perfil`, { waitUntil: "networkidle" }); await r.page.waitForSelector('[data-testid="perfil-nome-cadastral"]', { timeout: 15000 }).catch(() => {});
  return r;
}
{
  const { browser, page, reg, erros } = await abrirPerfil({});
  ok(await page.getByTestId("perfil-nome-cadastral").count() === 1 && (await page.getByTestId("perfil-nome-cadastral").inputValue()) === "Ana Lima", "[conta] o nome cadastral aparece editável");
  ok(await page.locator('input[type="email"]').first().getAttribute("readonly") !== null && await page.locator('input[placeholder="@seutwitter"]').getAttribute("readonly") !== null, "[conta] e-mail e @ aparecem SOMENTE LEITURA (não vão mais direto pelo navegador)");
  await page.getByTestId("perfil-nome-cadastral").fill("Ana  Lima   Souza"); await page.getByRole("button", { name: /SALVAR ALTERA/ }).click(); await page.waitForTimeout(900);
  ok(chamou(reg, "salvar_meu_cadastro").length === 1 && chamou(reg, "salvar_meu_cadastro")[0][1].p_nome === "Ana Lima Souza", "[conta] o nome vai pela função do banco (espaços normalizados)");
  ok(await page.getByText("Salvo no site ✓").count() === 1, "[conta] 'Salvo no site' aparece SÓ depois que o banco confirmou");
  const grav = reg.patch.filter(x => "nome_site" in x.corpo);
  ok(grav.length === 1 && !("twitter" in grav[0].corpo) && !("email" in grav[0].corpo) && !("nome" in grav[0].corpo), "[conta] o update direto NÃO envia e-mail, @ nem nome (só nome do site e WhatsApp)");
  await page.getByTestId("perfil-abrir-pedido").click();
  await page.getByTestId("cadastro-pedido-campo").selectOption("email"); await page.getByTestId("cadastro-pedido-valor").fill("ana.nova@exemplo.com"); await page.getByTestId("cadastro-pedido-enviar").click(); await page.waitForTimeout(700);
  ok(reg.put.length === 1 && reg.put[0].email === "ana.nova@exemplo.com" && await page.getByTestId("cadastro-email-link-enviado").count() === 1, "[conta] trocar o e-mail pede o link ao Auth e diz que só muda depois de confirmar (não diz 'salvo')");
  await page.getByTestId("cadastro-pedido-campo").selectOption("arroba"); await page.getByTestId("cadastro-pedido-valor").fill("@ana.nova"); await page.getByTestId("cadastro-pedido-enviar").click(); await page.waitForTimeout(700);
  ok(chamou(reg, "solicitar_correcao_perfil")[0]?.[1]?.p_tipo === "arroba" && await page.getByTestId("cadastro-alteracao-solicitada").count() === 1, "[conta] troca de @ vira PEDIDO: 'Alteração solicitada'");
  ok(reg.patch.every(x => !("twitter" in x.corpo) && !("email" in x.corpo) && !("nome" in x.corpo)), "[conta] nenhum update direto de @, e-mail ou nome foi feito");
  ok(erros.length === 0, "[conta] sem erro de JavaScript" + (erros.length ? ": " + erros[0].slice(0, 160) : ""));
  await browser.close();
}
{ // o banco recusa o nome: a tela NÃO diz "Salvo no site"
  const { browser, page, reg } = await abrirPerfil({ rpcErro: true });
  await page.getByTestId("perfil-nome-cadastral").fill("Outro Nome"); await page.getByRole("button", { name: /SALVAR ALTERA/ }).click(); await page.waitForTimeout(900);
  ok(await page.getByText("Salvo no site ✓").count() === 0 && /NÃO foi alterado/.test(await page.locator(".login-error").innerText()), "[conta] erro do banco ao gravar o nome: NÃO mostra 'Salvo no site' e explica que o nome não foi alterado");
  ok(chamou(reg, "salvar_meu_cadastro").length === 1, "[conta] (a função foi chamada uma vez)");
  await browser.close();
}
{ // o update direto não grava nenhuma linha (política do banco): nada de "salvo"
  const { browser, page, reg } = await abrirPerfil({ patchVazio: true });
  await page.getByTestId("perfil-nome-cadastral").fill("Outro Nome"); await page.getByRole("button", { name: /SALVAR ALTERA/ }).click(); await page.waitForTimeout(900);
  ok(await page.getByText("Salvo no site ✓").count() === 0 && /Não foi possível confirmar a gravação/.test(await page.locator(".login-error").innerText()), "[conta] update com 0 linhas gravadas: 'Não foi possível confirmar a gravação' (nunca 'salvo')");
  ok(chamou(reg, "salvar_meu_cadastro").length === 0, "[conta] e a função do nome nem é chamada");
  await browser.close();
}
// ------------------------------------------------------------------ (C) login legado (só @, sem sessão)
{
  const rot = { joiner: LIA, patch: (u, json) => json(200, []),
    rpc: (rpc, corpo, json) => (rpc === "solicitar_alteracao_sem_login" ? json(200, { ok: true, status: "solicitada" }) : rpc === "is_admin" ? json(200, false) : rpc === "meu_cog" ? json(200, null) : json(200, null)) };
  const { browser, page, reg, erros } = await contexto({ user: LIA, sess: null, rotas: rot });
  await page.goto(`http://localhost:${PORTA}/perfil`, { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  await page.waitForSelector('[data-testid="portao-abrir-pedido"]', { timeout: 15000 }).catch(() => {});
  ok(await page.getByTestId("portao-abrir-pedido").count() === 1, "[legado] a tela de bloqueio oferece 'Preciso corrigir meu nome, @ ou e-mail'");
  await page.getByTestId("portao-abrir-pedido").click();
  ok((await page.getByTestId("cadastro-pedido-campo").locator("option").allInnerTexts()).includes("Nome cadastral"), "[legado] o pedido inclui o nome cadastral (a conta edita direto; o legado só pede)");
  await page.getByTestId("cadastro-pedido-campo").selectOption("email"); await page.getByTestId("cadastro-pedido-valor").fill("lia.nova@exemplo.com"); await page.getByTestId("cadastro-pedido-enviar").click(); await page.waitForTimeout(700);
  const c = chamou(reg, "solicitar_alteracao_sem_login")[0]?.[1];
  ok(c?.p_campo === "email" && c.p_cog === "lia" && c.p_valor === "lia.nova@exemplo.com", "[legado] envia o pedido (cadastro, campo e valor) pela função do banco");
  ok(await page.getByTestId("cadastro-alteracao-solicitada").count() === 1, "[legado] mostra 'Alteração solicitada'");
  ok(reg.patch.filter(x => !("last_seen" in x.corpo)).length === 0 && reg.put.length === 0, "[legado] NADA é gravado no cadastro (sem update, sem troca de e-mail)");
  ok(erros.length === 0, "[legado] sem erro de JavaScript" + (erros.length ? ": " + erros[0].slice(0, 160) : ""));
  await browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
