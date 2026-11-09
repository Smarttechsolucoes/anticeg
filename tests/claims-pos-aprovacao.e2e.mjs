// Teste de navegador do CAMINHO DEPOIS DA APROVAÇÃO de uma claim feita só com @ (J20): aprovação (set) → item/planilha (texto copiado) no painel da administradora. API simulada (Playwright); não toca no Supabase real, sem pagamento, e-mail ou pedido.
// Prova: o @ informado sem cadastro aparece como está, entra no texto copiado para a planilha, o set pode ser confirmado e o membro cancelado, sem consultar cadastro algum nem criar conta.
// Uso: VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois `node tests/claims-pos-aprovacao.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const REF = "ghjfsmwwcfpfvrouyrka", PORTA = 5197;
const OWNER = { id: 1, cog: "nandaverseo_c", nome: "Dona", nome_site: "Dona", email: "dona@exemplo.com", twitter: "@nandaverseo_c", confirmado: true };
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: ADMIN_ID, email: "dona@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-admin`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-1",
  user: { id: ADMIN_ID, aud: "authenticated", role: "authenticated", email: "dona@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

const EVENTO = { id: 61, nome: "EVENTO PÓS-APROVAÇÃO", valor: 100, prazo: "10/11", abertura: "2026-11-09T12:00:00Z", membros: ["Han", "Felix"], sets_iniciais: 1, status: "ativo", foto_url: null, limite_por_joiner: 2, sem_novos_sets: false, created_at: "2026-11-09T11:00:00Z" };
const R = (id, cog, membro, status = "pendente", extra = {}) => ({ id, evento_id: 61, set_id: 10, joiner_cog: cog, joiner_nome: cog, membro, status, is_admin: false, created_at: `2026-11-09T12:0${id}:00Z`, ...extra });
const ADMIN_GOM = { id: 99, evento_id: 61, set_id: 10, joiner_cog: "nandaverseo_c", joiner_nome: "GOM", membro: "Han", status: "aprovado", is_admin: true, created_at: "2026-11-09T11:00:00Z" };

async function nova(cen = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: `http://localhost:${PORTA}` }).catch(() => {});
  await ctx.addInitScript(([u, sess, ref]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_session_at_v2", String(Date.now()));
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
  }, [OWNER, sessao(), REF]);
  const est = { sets: [{ id: 10, evento_id: 61, numero: 1, status: cen.statusSet || "fechado" }], reservas: [R(1, "quemnaotemcadastro", "Han"), R(2, "Ana", "Felix"), ...(cen.extras || [])] };
  const reg = { patches: [], urls: [], posts: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    reg.urls.push(`${m} ${decodeURIComponent(u).replace(/^https:\/\/[^/]+/, "")}`);
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("supabase.co/auth/v1/")) { const p = new URL(u).pathname.replace("/auth/v1", ""); if (p === "/user") return json(200, sessao().user); if (p === "/logout") return route.fulfill({ status: 204, body: "" }); return json(200, sessao()); }
    const rpc = (u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/) || [])[1];
    if (rpc) return rpc === "is_admin" ? json(200, true) : json(200, []);
    if (m === "PATCH") { reg.patches.push({ url: decodeURIComponent(u), corpo: JSON.parse(req.postData() || "{}") }); const t = /\/rest\/v1\/(claim_sets|claim_reservas)\?.*id=eq\.(\d+)/.exec(decodeURIComponent(u)); if (t) { const id = Number(t[2]); const corpo = JSON.parse(req.postData() || "{}"); const lista = t[1] === "claim_sets" ? est.sets : est.reservas; lista.forEach(x => { if (x.id === id) Object.assign(x, corpo); }); } return route.fulfill({ status: 204, body: "" }); }
    if (m === "POST") { reg.posts.push(decodeURIComponent(u)); return json(201, []); }
    if (u.includes("/rest/v1/claim_eventos")) return json(200, [EVENTO]);
    if (u.includes("/rest/v1/claim_sets")) return json(200, est.sets);
    if (u.includes("/rest/v1/claim_reservas")) {
      const url = decodeURIComponent(u); let lista = est.reservas.filter(x => x.status !== "cancelado");
      if (/set_id=is\.null/.test(url)) lista = lista.filter(x => x.set_id == null); else if (/set_id=in\./.test(url) || /set_id=eq\./.test(url)) lista = lista.filter(x => x.set_id != null);
      if (/is_admin=eq\.false/.test(url) || /is_admin=neq\.true/.test(url)) lista = lista.filter(x => !x.is_admin);
      const cog = /joiner_cog=eq\.([^&]+)/.exec(url); if (cog) lista = lista.filter(x => x.joiner_cog === cog[1]);
      const mb = /membro=eq\.([^&]+)/.exec(url); if (mb) lista = lista.filter(x => x.membro === mb[1]);
      return json(200, [ADMIN_GOM, ...lista].filter(x => !(cog || mb) || !x.is_admin));
    }
    if (u.includes("supabase.co/rest/v1/")) { const objeto = (req.headers()["accept"] || "").includes("pgrst.object"); if (u.includes("/rest/v1/joiners") && objeto) return json(200, OWNER); return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } }); }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  const dialogos = []; page.on("dialog", async d => { dialogos.push({ tipo: d.type(), msg: d.message() }); await d.accept(""); });
  return { browser, page, reg, erros, dialogos, est };
}
const abrirClaims = async page => {
  await page.goto(`http://localhost:${PORTA}/admin`, { waitUntil: "networkidle" }); await page.waitForTimeout(900);
  const modalAtivacao = page.getByTestId("ativacao-modal");
  if (await modalAtivacao.count()) { await modalAtivacao.getByTestId("fechar-acesso").click().catch(() => {}); await page.waitForTimeout(1500); await page.goto(`http://localhost:${PORTA}/admin`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); }
  await page.waitForSelector(".admin-sidebar-group", { timeout: 15000 }).catch(() => {});
  await page.locator("button.admin-sidebar-item", { hasText: /Claims/ }).first().click({ timeout: 8000 }); await page.waitForTimeout(1200);
  await page.getByText("EVENTO PÓS-APROVAÇÃO", { exact: true }).click(); await page.waitForTimeout(600);
};

{ // APROVAÇÃO: o @ informado aparece como está e o conjunto pode ser confirmado
  const T = await nova(); const { page, reg, dialogos, erros } = T; await abrirClaims(page);
  const t0 = await page.locator("body").innerText();
  ok(t0.includes("@quemnaotemcadastro") && t0.includes("@Ana"), "o painel mostra o @ INFORMADO da claim sem cadastro (@quemnaotemcadastro) ao lado do de quem tem cadastro");
  ok(/SET 1/.test(t0) && /✓ fechado/.test(t0), "o set com a claim aparece como fechado, pronto para confirmar");
  await page.getByRole("button", { name: "copiar" }).first().click(); await page.waitForTimeout(500);
  const copiado = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  ok(/SET 1 · EVENTO PÓS-APROVAÇÃO/.test(copiado) && /@quemnaotemcadastro · Han/.test(copiado) && /@Ana · Felix/.test(copiado), "PLANILHA: o texto copiado para a planilha traz o @ informado exatamente (@quemnaotemcadastro · Han) e o de quem tem cadastro: " + JSON.stringify(copiado).slice(0, 140));
  await page.getByRole("button", { name: /CONFIRMAR SET/ }).first().click(); await page.waitForTimeout(900);
  const conf = reg.patches.find(p => /claim_sets/.test(p.url) && p.corpo.status === "confirmado");
  ok(!!conf && /id=eq\.10/.test(conf.url) && dialogos.some(d => d.tipo === "confirm" && /Confirmar este set/.test(d.msg)), "APROVAÇÃO: confirmar o set grava status 'confirmado' no set (com confirmação da administradora)");
  ok(reg.urls.filter(x => /quemnaotemcadastro/i.test(x) && /(joiners|contas_joiner|rpc)/.test(x)).length === 0, "NENHUMA consulta a cadastros ou contas com o @ sem cadastro: nada foi ligado a outra pessoa");
  // a única escrita (POST) da tela é a configuração própria do painel (tabela config); nada de conta, código, e-mail, pedido ou pagamento
  const ruins = [...reg.posts.filter(x => !/\/rest\/v1\/config(\?|$)/.test(x)), ...reg.urls.filter(x => /(auth\/v1\/(signup|otp|verify|recover)|functions\/v1\/(send-email|send-push|email-evento|push-evento|pedir-codigo|trocar-email|comprovar|claim-enviar))/.test(x)), ...reg.urls.filter(x => /(pagamento_demandas|pedidos_|contas_joiner)/.test(x) && !/^(GET|HEAD) /.test(x))];
  ok(ruins.length === 0, "nenhum e-mail, código, conta, pedido ou pagamento foi criado" + (ruins.length ? " | " + ruins.slice(0, 3).join(" ; ") : ""));
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : "")); await T.browser.close();
}
{ // cancelar o membro da claim sem cadastro (antes da confirmação) usa o @ informado
  const T = await nova({ statusSet: "aberto" }); const { page, reg } = T; await abrirClaims(page);
  await page.locator("xpath=//span[normalize-space(.)='@quemnaotemcadastro']/following-sibling::button[1]").first().click(); await page.waitForTimeout(900);
  const cancel = reg.patches.find(p => /claim_reservas/.test(p.url) && p.corpo.status === "cancelado");
  ok(!!cancel, "cancelar o membro da claim sem cadastro funciona (a reserva vira 'cancelado')");
  ok(reg.urls.some(x => /claim_reservas.*joiner_cog=eq\.quemnaotemcadastro/.test(x)), "a busca da reserva usa o @ informado, sem passar por cadastro"); await T.browser.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
