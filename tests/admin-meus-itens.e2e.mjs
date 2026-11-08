// Teste de navegador: a administradora que também é joiner (nandaverseo_c) entra com o @ (acesso simples) e, com a conta ligada ao cadastro, a Masterlist mostra os PRÓPRIOS itens.
// Antes da correção a administradora não passava pelo portão das áreas protegidas (que é quem carrega os dados) e a Masterlist ficava com 0 itens e R$0. API simulada (Playwright).
// Uso:  VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois   node tests/admin-meus-itens.e2e.mjs
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PORTA = 5197, REF = "ghjfsmwwcfpfvrouyrka";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-0000000000aa", email: "dona@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-joiner`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j",
  user: { id: "00000000-0000-0000-0000-0000000000aa", aud: "authenticated", role: "authenticated", email: "dona@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });
const ITENS = [{ id: 1, ceg: "CEG 1", cog: "nandaverseo_c", nome: "Dona", nome_do_item: "ITEM-DA-DONA-ALFA", valor_item: 100, status: "Pago", na_loja: false }, { id: 2, ceg: "CEG 2", cog: "nandaverseo_c", nome: "Dona", nome_do_item: "ITEM-DA-DONA-BETA", valor_item: 50, status: "Pendente", na_loja: false }];
const PERFIL = { id: 1, cog: "nandaverseo_c", nome: "Dona", nome_site: "Dona", email: "dona@exemplo.com", twitter: "@nandaverseo_c", confirmado: true };

// cen: { contaLigada } — contaLigada=false: meus_dados não devolve nada (conta ainda sem vínculo/perfil)
async function nova(cen) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const simples = { cog: "nandaverseo_c", nome: "Dona", nome_site: "Dona", foto_perfil: null, confirmado: true, acesso_simples: true, conta_ativa: true, ativacao_liberada: true };
  await ctx.addInitScript(([u, sess, ref]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_session_at_v2", String(Date.now()));
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    if (sess) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
  }, [simples, cen.semSessao ? null : sessao(), REF]);   // semSessao: só digitou o @ (sem login com senha)
  const reg = { meusDados: 0, masterlist: [] };
  await ctx.route("**/*", async route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body, h = {}) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: h });
    if (u.includes("supabase.co/auth/v1/")) { const p = new URL(u).pathname.replace("/auth/v1", ""); if (p === "/user") return json(200, sessao().user); if (p === "/logout") return route.fulfill({ status: 204, body: "" }); return json(200, {}); }
    if (u.includes("/rest/v1/rpc/is_admin")) return json(200, true);
    if (u.includes("/rest/v1/rpc/meus_dados")) { reg.meusDados++; return json(200, cen.contaLigada ? PERFIL : null); }
    if (u.includes("/rest/v1/rpc/meu_estado_conta")) return json(200, cen.semSessao ? { vinculada: false } : { vinculada: true, concluido: !cen.perfilPendente, joiner_id: 1, cog: "nandaverseo_c", nome_site: "Dona", arroba: "@nandaverseo_c", email_mascarado: "d***@exemplo.com" });
    if (u.includes("/rest/v1/rpc/meu_cog")) return json(200, "nandaverseo_c");
    if (u.includes("supabase.co/rest/v1/")) {
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      if (m === "GET" && /\/rest\/v1\/masterlist/.test(u)) { reg.masterlist.push(decodeURIComponent(new URL(u).search)); return json(200, ITENS, { "content-range": `0-${ITENS.length - 1}/${ITENS.length}` }); }
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}

{ // conta ligada ao cadastro e perfil concluído: a administradora vê os próprios itens
  const T = await nova({ contaLigada: true }); const { page, reg } = T;
  await page.goto(`http://localhost:${PORTA}/masterlist`, { waitUntil: "networkidle" }); await page.waitForTimeout(1800);
  const texto = await page.locator("body").innerText();
  ok(reg.meusDados >= 1, "a administradora com acesso simples consulta meus_dados (o portão das áreas protegidas não roda para ela)");
  ok(reg.masterlist.some(q => /cog=eq\.nandaverseo_c/.test(q)), "a consulta dos itens é SÓ do próprio cog (cog=eq.nandaverseo_c), nunca uma busca ampla");
  ok(texto.includes("ITEM-DA-DONA-ALFA") && texto.includes("ITEM-DA-DONA-BETA"), "a Masterlist mostra os itens dela");
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem("anticeg_user_v2") || "{}"));
  ok(salvo.acesso_simples === false && salvo.cog === "nandaverseo_c", "a identidade passa de acesso simples para conta completa");
  ok(T.erros.length === 0, "sem erro de script"); await T.browser.close();
}
{ // conta ainda sem vínculo/perfil: meus_dados não devolve nada e a tela não inventa itens nem quebra
  const T = await nova({ contaLigada: false }); const { page, reg } = T;
  await page.goto(`http://localhost:${PORTA}/masterlist`, { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  const texto = await page.locator("body").innerText();
  ok(reg.meusDados >= 1 && !reg.masterlist.some(q => /cog=eq/.test(q)), "sem conta ligada: não consulta itens de ninguém");
  ok(!texto.includes("ITEM-DA-DONA-ALFA"), "sem conta ligada: nenhum item aparece");
  ok(T.erros.length === 0, "sem erro de script"); await T.browser.close();
}

{ // a administradora também precisa da senha: digitar só o @ NÃO abre a Masterlist (antes ela abria direto, vazia)
  const T = await nova({ contaLigada: false, semSessao: true }); const { page, reg } = T;
  await page.goto(`http://localhost:${PORTA}/masterlist`, { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  ok(await page.getByTestId("area-protegida").count() === 1, "administradora que digitou só o @: a Masterlist pede a senha (não abre direto)");
  ok(!(await page.locator("body").innerText()).includes("ITEM-DA-DONA-ALFA") && !reg.masterlist.some(q => /cog=eq/.test(q)), "nenhum item é consultado nem aparece sem a senha");
  await T.browser.close();
}
{ // com a senha, mas perfil pendente: a administradora vê a MESMA tela “Confira seus dados” das demais
  const T = await nova({ contaLigada: false, perfilPendente: true }); const { page, reg } = T;
  await page.goto(`http://localhost:${PORTA}/masterlist`, { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  ok(await page.getByTestId("completar-perfil").count() === 1, "administradora com conta ligada e perfil pendente: abre “Confira seus dados”");
  ok(!reg.masterlist.some(q => /cog=eq/.test(q)), "enquanto o perfil não é concluído nenhum item é consultado");
  await T.browser.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
