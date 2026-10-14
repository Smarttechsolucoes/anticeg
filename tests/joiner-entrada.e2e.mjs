// Teste de navegador da ENTRADA nova (acesso simples só com @) e do login completo, com a API simulada (Playwright). Não toca no Supabase real.
// O ponto principal: no acesso simples o site NÃO lê a linha da joiner nem os itens dela (nenhum dado pessoal sai do banco).
// Uso:
//   npx vite --port 5199 --strictPort                          (recurso DESLIGADO: comportamento de hoje)
//   VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   (recurso LIGADO)
// depois `node tests/joiner-entrada.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const REF = "ghjfsmwwcfpfvrouyrka";
const LINHA_COMPLETA = { id: 1, cog: "ana", nome: "Ana Fictícia", nome_site: "Ana", email: "ana@exemplo.com", twitter: "@ana", cpf: "000.000.000-01", rua: "Rua Falsa", confirmado: true };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000002", email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600, marca: "assinatura-joiner" })}.${Buffer.from("assinatura-valida").toString("base64url")}`;
const tokens = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j" });
const sessao = () => ({ ...tokens(), user: { id: "00000000-0000-0000-0000-000000000002", aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });
function logada(h) { try { return JSON.parse(Buffer.from(String(h).replace(/^Bearer\s+/i, "").split(".")[1], "base64url").toString()).marca === "assinatura-joiner"; } catch { return false; } }

async function nova(porta) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem("anticeg_session_v", "5"); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1"); sessionStorage.setItem("anticeg_ativacao_dispensada", "1"); });
  const reg = { rpc: [], tabelas: [], loginFn: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/functions/v1/login-joiner")) { const c = JSON.parse(req.postData() || "{}"); reg.loginFn.push(c); return c.senha === "senha-boa-123" ? json(200, tokens()) : json(401, { error: "@ ou senha incorretos." }); }
    if (u.includes("supabase.co/auth/v1/")) {
      const p = new URL(u).pathname.replace("/auth/v1", "");
      if (p === "/user") return json(200, sessao().user);
      if (p === "/logout") return route.fulfill({ status: 204, body: "" });
      return json(200, {});
    }
    if (u.includes("/rest/v1/rpc/")) {
      const nome = new URL(u).pathname.split("/").pop(); const corpo = JSON.parse(req.postData() || "{}"); reg.rpc.push(nome + ":" + JSON.stringify(corpo));
      if (nome === "entrar_com_arroba") {
        const h = String(corpo.p_identificador || "").replace(/^@+/, "").toLowerCase();
        return json(200, h === "ana" ? { encontrado: true, cog: "ana", nome_site: "Ana", foto_perfil: null, conta_ativa: true } : { encontrado: false });
      }
      if (nome === "meu_cog") return json(200, logada(req.headers()["authorization"] || "") ? "ana" : null);
      if (nome === "meus_dados") return json(200, logada(req.headers()["authorization"] || "") ? LINHA_COMPLETA : null);
      return json(200, null);
    }
    if (u.includes("supabase.co/rest/v1/")) {
      const tabela = new URL(u).pathname.split("/").pop(); reg.tabelas.push(m + " " + tabela + (new URL(u).search.includes("select=*") ? " (select *)" : ""));
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const PRIVADAS = ["joiners", "masterlist", "notifications", "reports", "pagamento_demandas", "multas_pagas", "envio_solicitacoes", "pushes", "push_reads",
  // J4c-4: tudo que passa a ser protegido pelo banco no lançamento (o acesso simples, só com @, não pode tocar em nenhuma)
  "claims", "grupos_envio", "push_subscriptions", "formulario_pedidos", "mercari_pedidos", "lojinha_repasses", "repassos", "claim_eventos", "claim_sets", "claim_reservas", "claim_reservas_quadro",
  "feedbacks", "joiner_storage", "joiner_conferencias", "joiner_updates", "envio_rounds", "envio_requests", "confirmacoes", "rastreios", "estoque_itens", "estoque_compras", "ceg_config", "antiv_badges",
  "pedidos_revista", "pedidos_popup", "pedidos_wmag", "pedidos_wmag_leeknow", "pedidos_dazed_seungmin", "pedidos_smolmerch", "pedidos_bazaar_in", "pedidos_lightstick", "pedidos_popcorn_sleeve", "pedidos_singba", "pedidos_skzoo_rio"];
const tocouPrivada = tabs => tabs.filter(x => PRIVADAS.some(tb => x.split(" ")[1] === tb));
const corpo = page => page.locator("body").innerText();
const entrar = async (page, valor) => { await page.getByPlaceholder("@ da rede social ou e-mail").fill(valor); await page.getByRole("button", { name: /ENTRAR/ }).first().click(); await page.waitForTimeout(1000); };

// ── recurso DESLIGADO (5199): o login continua como hoje (lê a joiner pelo banco) ─────────────
{
  const T = await nova(5199);
  await T.page.goto("http://localhost:5199/", { waitUntil: "networkidle" }); await T.page.waitForTimeout(500);
  await entrar(T.page, "@ana");
  ok(T.reg.rpc.every(r => !r.startsWith("entrar_com_arroba")) && T.reg.tabelas.some(t => t.includes("joiners")), "recurso desligado: o login usa o caminho de hoje (nada de função nova)");
  await T.browser.close();
}

// ── recurso LIGADO (5197): acesso simples só com @ ─────────────────────────────────────────────
{
  const T = await nova(5197); const { page, reg, erros } = T;
  await page.goto("http://localhost:5197/", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await entrar(page, "ana@exemplo.com");
  ok((await corpo(page)).includes("Digite o seu @") && reg.rpc.length === 0 && tocouPrivada(reg.tabelas).length === 0, "login por E-MAIL é recusado no acesso simples e nenhuma tabela privada é consultada");
  await entrar(page, "naoexiste");
  ok((await corpo(page)).includes("Acesso não encontrado"), "@ inexistente: 'Acesso não encontrado' (mesma resposta de sempre)");
  await entrar(page, "@Ana");
  ok(reg.rpc.some(r => r.startsWith("entrar_com_arroba")), "o @ é conferido pela função segura do servidor");
  ok(tocouPrivada(reg.tabelas).length === 0, "ACESSO SIMPLES: NENHUMA tabela privada é lida ou gravada (joiners, masterlist, pagamentos, multas, notificações, avisos...): " + JSON.stringify(tocouPrivada(reg.tabelas)));
  const guardado = JSON.parse(await page.evaluate(() => localStorage.getItem("anticeg_user_v2")) || "{}");
  ok(guardado.cog === "ana" && !("email" in guardado) && !("cpf" in guardado) && !("rua" in guardado), "o navegador guarda só a identidade mínima (sem e-mail, CPF ou endereço)");
  ok((await corpo(page)).includes("ana") && !(await corpo(page)).includes("ana@exemplo.com") && !(await corpo(page)).includes("000.000.000-01"), "a tela não mostra e-mail nem CPF no acesso simples");
  // área privada pede senha; ao entrar, traz os dados da própria conta
  await page.goto("http://localhost:5197/masterlist", { waitUntil: "networkidle" }); await page.waitForTimeout(900);
  ok(await page.getByTestId("area-protegida").count() === 1, "a MASTERLIST pede senha no acesso simples");
  await page.getByLabel("Senha", { exact: true }).fill("errada"); await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(800);
  ok(await page.getByTestId("area-protegida").count() === 1 && !reg.rpc.some(r => r.startsWith("meus_dados")), "senha errada: nada de dados privados é buscado");
  await page.getByLabel("Senha", { exact: true }).fill("senha-boa-123"); await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForTimeout(1500);
  ok(await page.getByTestId("area-protegida").count() === 0, "senha certa: a área abre");
  ok(reg.rpc.some(r => r.startsWith("meus_dados")) && reg.tabelas.some(t => t.includes("masterlist")), "só DEPOIS do login completo o site busca a própria linha (meus_dados) e os itens");
  const completo = JSON.parse(await page.evaluate(() => localStorage.getItem("anticeg_user_v2")) || "{}");
  ok(completo.cog === "ana" && completo.email === "ana@exemplo.com" && completo.acesso_simples === false, "com a conta completa, os dados da própria joiner passam a existir no navegador dela");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}

// ── MODO LIMITADO (só com @): percorre TODAS as áreas protegidas e as públicas e confirma que nenhuma lê ou grava tabela privada ─────────
{
  const T = await nova(5197); const { page, reg, erros } = T;
  await page.goto("http://localhost:5197/", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await entrar(page, "@Ana");
  const protegidas = ["masterlist", "perfil", "envio", "disponiveis", "claims", "prevenda", "wave-maker", "run-it-vol-2", "paper-tales", "odd-fresh", "promo-13", "mercari"];
  for (const slug of protegidas) {
    reg.tabelas.length = 0;
    await page.goto(`http://localhost:5197/${slug}`, { waitUntil: "networkidle" }); await page.waitForTimeout(700);
    ok(await page.getByTestId("area-protegida").count() === 1 && tocouPrivada(reg.tabelas).length === 0, `MODO LIMITADO: /${slug} pede senha e não toca em tabela privada ${JSON.stringify(tocouPrivada(reg.tabelas))}`);
  }
  for (const rota of ["calendario", "regras", "cegs", ""]) {
    reg.tabelas.length = 0;
    await page.goto(`http://localhost:5197/${rota}`, { waitUntil: "networkidle" }); await page.waitForTimeout(700);
    ok(tocouPrivada(reg.tabelas).length === 0, `MODO LIMITADO: /${rota} (área pública) não toca em tabela privada ${JSON.stringify(tocouPrivada(reg.tabelas))}`);
  }
  ok(erros.length === 0, "MODO LIMITADO: nenhum erro de JavaScript em nenhuma das áreas" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
