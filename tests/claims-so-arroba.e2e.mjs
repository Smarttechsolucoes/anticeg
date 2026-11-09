// Teste de navegador das CLAIMS SÓ COM @ (J20), API simulada (Playwright); NÃO toca no Supabase real, não cria conta nem cadastro e não exige nenhum teste manual.
// Prova: (1) sem login e sem cadastro basta o @; (2) quem está logada usa a conta atual (a função recebe o token da conta), sem pedir @, senha, ativação ou perfil;
// (3) nenhum pop-up de ativação/perfil aparece na rota; (4) visitante nunca consulta tabelas privadas e vê aviso nas abas privadas; (5) erros nunca viram sucesso falso.
// Uso: VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois `node tests/claims-so-arroba.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PORTA = 5197, REF = "ghjfsmwwcfpfvrouyrka", UID = "00000000-0000-0000-0000-000000000005";
const ANA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", email: "ana@exemplo.com", twitter: "@ana", confirmado: true };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, email: "ana@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-da-conta`;
const TOKEN = jwt();
const sessao = () => ({ access_token: TOKEN, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-j",
  user: { id: UID, aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });
const EVENTO = { id: 1, nome: "EVENTO DE TESTE", valor: 100, prazo: "10/11", abertura: "2020-01-01T00:00:00Z", membros: ["Han", "Felix"], sets_iniciais: 1, status: "ativo", foto_url: null, limite_por_joiner: 2, sem_novos_sets: false };
const SET = { id: 10, evento_id: 1, numero: 1, status: "aberto" };

// cen: { usuario, sessao: "pendente"|"concluido"|null, resposta, status, quadro }
async function nova(cen = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 420, height: 1100 } });
  await ctx.addInitScript(([u, ref, s]) => {
    if (u) { localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_at_v2", String(Date.now())); }
    localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    if (s) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s));
  }, [cen.usuario ?? null, REF, cen.sessao ? sessao() : null]);
  const reg = { claims: [], urls: [], escritas: [] };
  await ctx.route("**/*", async route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    reg.urls.push(`${m} ${u.replace(/^https:\/\/[^/]+/, "").split("?")[0]}`);
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/functions/v1/claim-enviar")) {
      reg.claims.push({ corpo: JSON.parse(req.postData() || "{}"), auth: req.headers()["authorization"] || "" });
      if (cen.status) return json(cen.status, { error: "Muitas tentativas. Espere alguns minutos e tente de novo." });
      return json(200, cen.resposta ?? { ok: true, ot8: false, gravados: 1, standby: [], falhas: [], conta: !!cen.sessao });
    }
    if (m !== "GET" && !u.includes("/rpc/") && !u.includes("/functions/v1/")) reg.escritas.push(`${m} ${u}`);
    if (u.includes("supabase.co/auth/v1/")) { const p = new URL(u).pathname.replace("/auth/v1", ""); if (p === "/user") return json(200, sessao().user); if (p === "/logout") return route.fulfill({ status: 204, body: "" }); return json(200, sessao()); }
    const rpc = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(u);
    if (rpc) {
      const nome = rpc[1];
      if (nome === "claim_quadro_publico") return json(200, cen.quadro ?? { eventos: [EVENTO], sets: [SET], reservas: [], standby: [] });
      if (nome === "meu_estado_conta") return json(200, cen.sessao ? { vinculada: true, concluido: cen.sessao === "concluido", joiner_id: 5, cog: "ana", nome_site: "Ana", arroba: "@ana", email_mascarado: "a***@exemplo.com" } : { vinculada: false });
      if (nome === "meu_cog") return json(200, cen.sessao === "concluido" ? "ana" : null);
      if (nome === "is_admin") return json(200, false);
      if (nome === "entrar_com_arroba") return json(200, { encontrado: true, cog: "ana", nome_site: "Ana", conta_ativa: false, ativacao_liberada: true });
      return json(200, null);
    }
    if (u.includes("/rest/v1/claim_eventos")) return json(200, cen.sessao === "concluido" ? [EVENTO] : []);
    if (u.includes("/rest/v1/claim_sets")) return json(200, cen.sessao === "concluido" ? [SET] : []);
    if (u.includes("/rest/v1/")) { const objeto = (req.headers()["accept"] || "").includes("pgrst.object"); if (u.includes("/rest/v1/joiners") && objeto) return json(200, ANA); return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } }); }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const ir = async page => { await page.goto(`http://localhost:${PORTA}/claim`, { waitUntil: "networkidle" }); await page.waitForTimeout(1200); };
const corpo = page => page.locator("body").innerText();
const mais = (page, membro) => page.locator(`xpath=//span[normalize-space(text())="${membro}"]/ancestor::div[2]`).first().getByRole("button").nth(1);
const enviar = page => page.getByRole("button", { name: /Enviar claim/ });
const semPopup = async page => (await page.getByTestId("ativacao-modal").count()) === 0 && !/Confira seus dados|Crie sua senha|Ative sua conta/.test(await corpo(page));
const privadas = reg => reg.urls.filter(x => /rest\/v1\/(claims|claim_reservas|claim_reservas_quadro|joiners|contas_joiner|masterlist)\b/.test(x));

{ // 1) SEM login e SEM cadastro: só o @
  const T = await nova(); const { page, reg, erros } = T; await ir(page);
  ok(await page.getByTestId("claim-arroba-form").count() === 1 && await semPopup(page), "visitante sem @ no aparelho: pede só o @ (nenhum pop-up de senha, ativação ou perfil)");
  await page.getByLabel("Seu @").fill("@x y"); await page.getByRole("button", { name: /Continuar/ }).click(); await page.waitForTimeout(200);
  ok(/Digite o seu @/.test(await corpo(page)), "@ com espaço é recusado no navegador");
  await page.getByLabel("Seu @").fill("@NovaPessoa"); await page.getByRole("button", { name: /Continuar/ }).click(); await page.waitForTimeout(1200);
  ok(/Claim como @NovaPessoa/.test(await corpo(page)) && /EVENTO DE TESTE/.test(await corpo(page)), "com o @, a página de claims abre e mostra o evento (quadro público)");
  await mais(page, "Han").click(); await enviar(page).click(); await page.waitForTimeout(900);
  ok(reg.claims.length === 1 && reg.claims[0].corpo.cog === "NovaPessoa" && reg.claims[0].corpo.evento === 1 && JSON.stringify(reg.claims[0].corpo.pedidos) === '{"Han":1}', "a claim sai para o servidor com o @ informado, o evento e o pedido");
  ok(!reg.claims[0].auth.includes("assinatura-da-conta"), "sem login, nenhum token de conta é enviado");
  ok(/Claim enviado com sucesso/.test(await corpo(page)), "mensagem de sucesso só depois da resposta do servidor");
  ok(privadas(reg).length === 0, "visitante NÃO consulta nenhuma tabela privada (claims, reservas com @, cadastros): " + privadas(reg).join(", "));
  ok(!reg.urls.some(x => /auth\/v1\/(signup|otp|verify|token)/.test(x)) && reg.escritas.length === 0, "nenhuma conta, código, senha ou cadastro é criado");
  ok(await semPopup(page), "nenhum pop-up de ativação ou perfil apareceu durante a claim");
  await page.getByRole("button", { name: "HISTÓRICO" }).click(); await page.waitForTimeout(300);
  ok(await page.getByTestId("claim-aviso-privado").count() === 1 && /só aparece quando você entra com a sua senha/.test(await corpo(page)), "histórico (dado privado) continua exigindo senha: só um aviso");
  await page.getByRole("button", { name: "AO VIVO ●" }).click(); await page.waitForTimeout(300);
  ok(await page.getByTestId("claim-aviso-privado").count() === 1 && privadas(reg).length === 0, "o quadro ao vivo também: aviso, sem consultar nada");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : "")); await T.browser.close();
}
{ // 1b) o @ fica guardado neste aparelho e pode ser trocado
  const T = await nova(); const { page } = T; await ir(page);
  await page.getByLabel("Seu @").fill("guardada"); await page.getByRole("button", { name: /Continuar/ }).click(); await page.waitForTimeout(800);
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(900);
  ok(/Claim como @guardada/.test(await corpo(page)), "depois de recarregar, o @ continua valendo neste aparelho");
  await page.getByRole("button", { name: "trocar @" }).click(); await page.waitForTimeout(200);
  ok(await page.getByTestId("claim-arroba-form").count() === 1, "'trocar @' volta a pedir o @"); await T.browser.close();
}
{ // 2) @ já no aparelho (acesso simples), sem sessão: sem pop-up, claim pelo @
  const T = await nova({ usuario: ANA }); const { page, reg } = T; await ir(page);
  ok(await semPopup(page) && /EVENTO DE TESTE/.test(await corpo(page)), "acesso simples (só @): a página abre sem pop-up de ativação");
  await mais(page, "Felix").click(); await enviar(page).click(); await page.waitForTimeout(900);
  ok(reg.claims.length === 1 && reg.claims[0].corpo.cog === "ana" && /Claim enviado com sucesso/.test(await corpo(page)), "a claim sai com o @ já informado (sem perguntar de novo)");
  await T.browser.close();
}
{ // 3) LOGADA com perfil PENDENTE: usa a conta atual, sem tela de perfil
  const T = await nova({ usuario: ANA, sessao: "pendente" }); const { page, reg } = T; await ir(page);
  ok(await semPopup(page) && !/Confira seus dados|Concluir meus dados/.test(await corpo(page)), "conta com perfil pendente: nenhuma tela de confirmação de dados nem pop-up");
  ok(/EVENTO DE TESTE/.test(await corpo(page)), "o evento aparece (quadro público, porque o perfil pendente não lê as tabelas)");
  await mais(page, "Han").click(); await mais(page, "Han").click(); await enviar(page).click(); await page.waitForTimeout(900);
  ok(reg.claims.length === 1 && reg.claims[0].auth.includes("assinatura-da-conta"), "a função recebe o token da CONTA atual (é ele que define o @, no servidor)");
  ok(JSON.stringify(reg.claims[0].corpo.pedidos) === '{"Han":2}' && /Claim enviado com sucesso/.test(await corpo(page)), "claim registrada normalmente");
  ok(!reg.urls.some(x => /auth\/v1\/(signup|otp|verify)/.test(x)), "nenhuma senha nem código pedidos"); await T.browser.close();
}
{ // 4) LOGADA com perfil concluído: usa as tabelas da conta; histórico disponível
  const T = await nova({ usuario: ANA, sessao: "concluido" }); const { page, reg } = T; await ir(page);
  ok(/EVENTO DE TESTE/.test(await corpo(page)) && await semPopup(page), "conta completa: evento lido pelas tabelas da conta, sem pop-up");
  await mais(page, "Han").click(); await enviar(page).click(); await page.waitForTimeout(900);
  ok(reg.claims.length === 1 && reg.claims[0].auth.includes("assinatura-da-conta") && /Claim enviado com sucesso/.test(await corpo(page)), "claim direto com a conta atual, sem pedir @, senha ou confirmação");
  await page.getByRole("button", { name: "HISTÓRICO" }).click(); await page.waitForTimeout(400);
  ok(await page.getByTestId("claim-aviso-privado").count() === 0, "com sessão, o histórico NÃO mostra o aviso de privacidade (a aba abre)"); await T.browser.close();
}
{ // 5) erros nunca viram sucesso falso
  for (const [nome, cen, texto] of [["cadastro bloqueado", { resposta: { ok: false, motivo: "bloqueada", conta: false } }, /bloqueada/], ["sem vaga", { resposta: { ok: false, motivo: "sem_vaga", conta: false } }, /Não há mais vagas/], ["evento fechado", { resposta: { ok: false, motivo: "evento_fechado", conta: false } }, /não está aberto/], ["@ inválido no servidor", { resposta: { ok: false, motivo: "cog_invalido", conta: false } }, /Informe o seu @/], ["limite de tentativas (429)", { status: 429 }, /Não foi possível enviar agora/]]) {
    const T = await nova({ usuario: ANA, ...cen }); await ir(T.page); await mais(T.page, "Han").click(); await enviar(T.page).click(); await T.page.waitForTimeout(900);
    const t = await corpo(T.page); ok(texto.test(t) && !/Claim enviado/.test(t), `${nome}: mensagem clara e nenhum sucesso falso`); await T.browser.close();
  }
  const S = await nova({ usuario: ANA, resposta: { ok: true, ot8: false, gravados: 1, standby: ["Han"], falhas: [], conta: false } }); await ir(S.page); await mais(S.page, "Han").click(); await enviar(S.page).click(); await S.page.waitForTimeout(900);
  ok(/entrou no standby automático/.test(await corpo(S.page)), "standby: a mensagem explica"); await S.browser.close();
}
{ // 6) privacidade do quadro: nenhum @ ou nome de outra pessoa na tela do visitante
  const quadro = { eventos: [EVENTO], sets: [SET], reservas: [{ id: 1, evento_id: 1, set_id: 10, joiner_cog: null, joiner_nome: null, membro: "Han", status: "pendente" }], standby: [] };
  const T = await nova({ usuario: ANA, quadro }); await ir(T.page); const t = await corpo(T.page);
  ok(!/@outra|Fulana|joiner_/.test(t), "o quadro público do visitante não traz @ nem nome de outras pessoas"); await T.browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
