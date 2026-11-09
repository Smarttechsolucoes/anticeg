// Teste de navegador da FILA POR PESSOA do painel (Admin → Contas): pedido + prova + ação no mesmo cartão (API simulada, Playwright; não toca no Supabase real).
// Cobre: ordem e conteúdo dos cartões, o que conferir, texto da pessoa só como texto, aplicar/cancelar troca, aprovar/recusar comprovação e painel sem as funções novas.
// Uso: VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois `node tests/admin-fila-pessoas.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const REF = "ghjfsmwwcfpfvrouyrka", PORTA = 5197;
const OWNER = { id: 1, cog: "nandaverseo_c", nome: "Dona", nome_site: "Dona", email: "dona@exemplo.com", twitter: "@nandaverseo_c", confirmado: true };
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: ADMIN_ID, email: "dona@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-admin`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-1",
  user: { id: ADMIN_ID, aud: "authenticated", role: "authenticated", email: "dona@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

const HTML_PERIGOSO = "<img src=x onerror=\"window.__xss=1\"> comprovante de pagamento da Smol em outubro, R$ 120";
async function nova(cen = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  await ctx.addInitScript(([u, sess, ref]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_session_at_v2", String(Date.now()));
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
  }, [OWNER, sessao(), REF]);
  const est = {
    aConfirmar: [{ joiner_id: 7, cog: "bia", nome_site: "Bia", dominio: "exemplo.com", tem_conta: false, itens: 3, pedido_de_ajuda: true }, { joiner_id: 8, cog: "caio", nome_site: null, dominio: "outro.com", tem_conta: false, itens: 0, pedido_de_ajuda: false },
      { joiner_id: 10, cog: "eva", nome_site: null, dominio: "exemplo.com", tem_conta: false, itens: 1, pedido_de_ajuda: true }],
    trocas: [{ id: 5, joiner_id: 7, cog: "bia", via: "sem_acesso", desfecho: "sem_acesso", novo_dominio: "gmail.com", novo_verificado_em: "2026-11-09T15:00:00Z", criado_em: "2026-11-09T14:50:00Z" }],
    comps: [{ id: 6, joiner_id: 8, cog: "caio", via: "sem_perfil", desafio_validado: false, detalhe: HTML_PERIGOSO, itens: 4, criado_em: "2026-11-09T10:00:00Z", expira_em: "2026-11-16T10:00:00Z" }],
    solic: [{ id: 41, joiner_id: 9, cog: "duda", tipo: "ativacao_ajuda", valor_pedido: "whatsapp 11 90000-0000", mensagem: "não recebi o código", status: "aberta", criado_em: "2026-11-08T12:00:00Z" }],
  };
  const reg = { aplicar: [], cancelar: [], aprovar: [], recusar: [], resolver: [], rpc: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("supabase.co/auth/v1/")) { const p = new URL(u).pathname.replace("/auth/v1", ""); if (p === "/user") return json(200, sessao().user); if (p === "/logout") return route.fulfill({ status: 204, body: "" }); return json(200, sessao()); }
    const rpc = (u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/) || [])[1];
    if (rpc) {
      reg.rpc.push(rpc); const corpo = JSON.parse(req.postData() || "{}");
      if (rpc === "is_admin") return json(200, true);
      if (rpc === "admin_vinculos_a_confirmar") return json(200, est.aConfirmar);
      if (rpc === "admin_perfil_solicitacoes") return json(200, est.solic);
      if (rpc === "admin_trocas_email_pendentes") return cen.semFuncoes ? json(404, { code: "PGRST202", message: "Could not find the function public.admin_trocas_email_pendentes" }) : json(200, est.trocas);
      if (rpc === "admin_comprovacoes_pendentes") return cen.semFuncoes ? json(404, { code: "PGRST202", message: "Could not find the function public.admin_comprovacoes_pendentes" }) : json(200, est.comps);
      if (rpc === "admin_aplicar_troca_email") {
        reg.aplicar.push(corpo);
        if (String(corpo.p_email_informado).trim().toLowerCase() !== "bia.nova@gmail.com") return json(400, { code: "P0001", message: "o e-mail informado NÃO é o do pedido; nada foi alterado. Confira com a pessoa o endereço completo" });
        est.trocas = est.trocas.filter(t => t.id !== corpo.p_id); return json(200, { ok: true, vinculo_confirmado: corpo.p_confirmar_vinculo });
      }
      if (rpc === "admin_cancelar_troca_email") { reg.cancelar.push(corpo); est.trocas = est.trocas.filter(t => t.id !== corpo.p_id); return route.fulfill({ status: 204, body: "" }); }
      if (rpc === "admin_aprovar_comprovacao") { reg.aprovar.push(corpo); est.comps = est.comps.filter(c => c.id !== corpo.p_id); return json(200, { ok: true, liberado: true }); }
      if (rpc === "admin_recusar_comprovacao") { reg.recusar.push(corpo); est.comps = est.comps.filter(c => c.id !== corpo.p_id); return route.fulfill({ status: 204, body: "" }); }
      if (rpc === "admin_resolver_solicitacao") { reg.resolver.push(corpo); est.solic = est.solic.map(s => s.id === corpo.p_id ? { ...s, status: corpo.p_status } : s); return route.fulfill({ status: 204, body: "" }); }
      return json(200, []);
    }
    if (u.includes("supabase.co/rest/v1/")) {
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      if (u.includes("/rest/v1/joiners") && objeto) return json(200, OWNER);
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  const dialogos = []; page.on("dialog", async d => { dialogos.push({ tipo: d.type(), msg: d.message() }); if (cen.recusarDialogo) await d.dismiss(); else await d.accept(cen.notas?.shift() ?? ""); });
  return { browser, page, reg, erros, dialogos };
}
const abrirContas = async page => {
  await page.goto(`http://localhost:${PORTA}/admin`, { waitUntil: "networkidle" }); await page.waitForTimeout(900);
  const modalAtivacao = page.getByTestId("ativacao-modal");
  if (await modalAtivacao.count()) { await modalAtivacao.getByTestId("fechar-acesso").click().catch(() => {}); await page.waitForTimeout(1500); await page.goto(`http://localhost:${PORTA}/admin`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); }
  await page.waitForSelector(".admin-sidebar-group", { timeout: 15000 }).catch(() => {});
  await page.locator("button.admin-sidebar-item", { hasText: /Contas$/ }).first().click({ timeout: 8000 }); await page.waitForTimeout(900);
};
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

{ // a fila reúne pedido + prova + ação por pessoa, com o que conferir; nenhum e-mail completo aparece
  const T = await nova(); const { page, erros } = T; await abrirContas(page);
  const fila = page.getByTestId("admin-fila-pessoas");
  ok(await fila.count() === 1, "a 'Fila por pessoa' aparece em Admin → Contas");
  const cartoes = await fila.locator("[data-testid^='fila-pessoa-']").evaluateAll(els => els.map(e => e.getAttribute("data-testid")));
  ok(JSON.stringify(cartoes) === JSON.stringify(["fila-pessoa-8", "fila-pessoa-7", "fila-pessoa-9", "fila-pessoa-10"]), "ordem: comprovação (mais antiga) e troca primeiro, depois a solicitação, depois quem só pediu ajuda: " + cartoes.join(","));
  const bia = page.getByTestId("fila-pessoa-7"), t7 = await bia.innerText();
  ok(t7.includes("@bia") && /pedido de troca de e-mail/i.test(t7) && t7.includes("@gmail.com") && t7.includes("verificado por código") && /NÃO tem acesso ao e-mail antigo/.test(t7), "troca: mostra o provedor do e-mail novo, que foi verificado, e que NÃO há acesso ao antigo");
  ok(/o que você precisa conferir/i.test(t7) && /só prova que a pessoa lê ESSE endereço, não QUEM ela é/.test(t7) && t7.includes("O que fazer:"), "troca: diz o que fazer e o que conferir (o e-mail novo não prova quem é)");
  ok(t7.includes("Bia") && t7.includes("3 item(ns)"), "troca: o cartão traz nome e itens do cadastro");
  const caio = page.getByTestId("fila-pessoa-8"), t8 = await caio.innerText();
  ok(/pedido de comprovação/i.test(t8) && /NÃO é prova/.test(t8) && t8.includes("4 item(ns) no cadastro") && t8.includes("Aprovar") && t8.includes("Recusar"), "comprovação: texto marcado como NÃO prova, itens do cadastro e as ações no mesmo cartão");
  ok(await page.getByTestId("fila-detalhe").evaluate(el => el.querySelector("img") === null && el.textContent.includes("<img src=x")), "o texto da pessoa aparece como TEXTO (HTML não é interpretado)");
  ok(await page.evaluate(() => window.__xss === undefined), "nenhum script do texto da pessoa foi executado");
  ok(((await fila.innerText()).match(EMAIL) || []).length === 0, "nenhum e-mail completo aparece na fila (só o provedor)");
  const t9 = await page.getByTestId("fila-pessoa-9").innerText();
  ok(t9.includes("whatsapp 11 90000-0000") && t9.includes("não recebi o código") && t9.includes("Resolvido"), "solicitação aberta: contato, mensagem e ação no mesmo cartão");
  ok((await page.getByTestId("fila-pessoa-10").innerText()).includes("Confirmar vínculo"), "quem só pediu ajuda: orienta confirmar o vínculo");
  ok(await bia.getByRole("button", { name: "Confirmar vínculo" }).count() === 0, "quem tem pedido de troca NÃO mostra 'Confirmar vínculo' (o vínculo do e-mail antigo não é o que se decide)");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : "")); await T.browser.close();
}
{ // aplicar a troca: exige e-mail e anotação; e-mail errado é recusado pelo servidor e nada muda; certo aplica SEM confirmar o vínculo
  const T = await nova(); const { page, reg, dialogos } = T; await abrirContas(page);
  const bia = page.getByTestId("fila-pessoa-7"); const aplicar = bia.getByRole("button", { name: "Aplicar troca" });
  ok(await aplicar.isDisabled(), "'Aplicar troca' começa desligado (falta e-mail e anotação)");
  await bia.getByLabel(/E-mail novo informado pela pessoa/).fill("outro.endereco@gmail.com"); await bia.getByLabel(/Como você confirmou/).fill("ok");
  ok(await aplicar.isDisabled(), "anotação curta (menos de 5 letras) mantém desligado");
  await bia.getByLabel(/Como você confirmou/).fill("WhatsApp em 09/11 pelo @ de sempre"); await aplicar.click(); await page.waitForTimeout(700);
  ok(dialogos.some(d => d.tipo === "confirm" && /O vínculo NÃO será confirmado/.test(d.msg)), "pede confirmação e avisa que o vínculo NÃO será confirmado");
  ok(reg.aplicar.length === 1 && reg.aplicar[0].p_confirmar_vinculo === false, "e-mail errado: a chamada foi feita SEM confirmar vínculo");
  ok((await page.locator("body").innerText()).includes("Nada foi alterado") && await page.getByTestId("fila-pessoa-7").count() === 1, "o servidor recusou: aparece o erro e o pedido continua na fila");
  await bia.getByLabel(/E-mail novo informado pela pessoa/).fill("  Bia.Nova@Gmail.com "); await aplicar.click(); await page.waitForTimeout(900);
  ok(reg.aplicar.length === 2 && reg.aplicar[1].p_id === 5 && reg.aplicar[1].p_confirmar_vinculo === false && /WhatsApp em 09\/11/.test(reg.aplicar[1].p_nota), "e-mail certo: aplica o pedido #5, com a anotação, sem confirmar o vínculo");
  const corpo = await page.locator("body").innerText();
  ok(corpo.includes("vínculo continua SEM confirmação") && await page.getByTestId("fila-troca").count() === 0, "mensagem clara de que o vínculo segue sem confirmação; a troca sai da fila");
  await T.browser.close();
}
{ // aplicar com vínculo marcado + cancelar pedido
  const T = await nova(); const { page, reg, dialogos } = T; await abrirContas(page);
  const bia = page.getByTestId("fila-pessoa-7");
  await bia.getByLabel(/E-mail novo informado pela pessoa/).fill("bia.nova@gmail.com"); await bia.getByLabel(/Como você confirmou/).fill("videochamada em 09/11"); await bia.getByLabel(/também confirmar o vínculo/).check();
  await bia.getByRole("button", { name: "Aplicar troca" }).click(); await page.waitForTimeout(800);
  ok(dialogos.some(d => /O vínculo também será CONFIRMADO/.test(d.msg)) && reg.aplicar[0]?.p_confirmar_vinculo === true, "marcando o vínculo, o aviso muda e o servidor recebe p_confirmar_vinculo = true");
  ok((await page.locator("body").innerText()).includes("vínculo confirmado: ela já pode pedir o código"), "mensagem final diz que ela já pode pedir o código");
  await T.browser.close();
  const U = await nova({ notas: ["pedido não foi ela"] }); await abrirContas(U.page);
  await U.page.getByTestId("fila-pessoa-7").getByRole("button", { name: "Cancelar pedido" }).click(); await U.page.waitForTimeout(700);
  ok(U.reg.cancelar.length === 1 && U.reg.cancelar[0].p_id === 5 && U.reg.cancelar[0].p_nota === "pedido não foi ela" && U.reg.aplicar.length === 0, "cancelar o pedido: registra o motivo e não aplica nada");
  await U.browser.close();
}
{ // comprovação: aprovar exige anotação; recusar pede o motivo; dizer "Cancelar" na confirmação não faz nada
  const T = await nova({ notas: ["não bate com os pagamentos"] }); const { page, reg } = T; await abrirContas(page);
  const caio = page.getByTestId("fila-pessoa-8"); const aprovar = caio.getByRole("button", { name: "Aprovar" });
  ok(await aprovar.isDisabled(), "'Aprovar' começa desligado (falta anotar a prova aceita)");
  await caio.getByLabel(/Prova aceita/).fill("comprovante conferido em 09/11"); ok(!(await aprovar.isDisabled()), "com a anotação, 'Aprovar' liga");
  await caio.getByRole("button", { name: "Recusar" }).click(); await page.waitForTimeout(700);
  ok(reg.recusar.length === 1 && reg.recusar[0].p_id === 6 && reg.recusar[0].p_nota === "não bate com os pagamentos" && reg.aprovar.length === 0, "recusar: pede o motivo e registra; nada é aprovado");
  await T.browser.close();
  const U = await nova(); await abrirContas(U.page); const c2 = U.page.getByTestId("fila-pessoa-8");
  await c2.getByLabel(/Prova aceita/).fill("comprovante conferido em 09/11"); await c2.getByRole("button", { name: "Aprovar" }).click(); await U.page.waitForTimeout(800);
  ok(U.dialogos.some(d => d.tipo === "confirm" && /sai para o e-mail que JÁ está no cadastro/.test(d.msg)) && U.reg.aprovar.length === 1 && U.reg.aprovar[0].p_id === 6 && U.reg.aprovar[0].p_nota === "comprovante conferido em 09/11", "aprovar: confirma, explica que o código sai para o e-mail do cadastro e registra a prova aceita");
  ok((await U.page.locator("body").innerText()).includes("Comprovação do @caio aprovada"), "mensagem de sucesso");
  await U.browser.close();
  const V = await nova({ recusarDialogo: true }); await abrirContas(V.page); const c3 = V.page.getByTestId("fila-pessoa-8");
  await c3.getByLabel(/Prova aceita/).fill("comprovante conferido em 09/11"); await c3.getByRole("button", { name: "Aprovar" }).click(); await V.page.waitForTimeout(600);
  ok(V.reg.aprovar.length === 0, "dizer 'Cancelar' na confirmação NÃO aprova"); await V.browser.close();
}
{ // solicitação dentro do cartão; sem as funções novas o painel continua igual
  const T = await nova({ notas: ["respondi por whatsapp"] }); const { page, reg } = T; await abrirContas(page);
  await page.getByTestId("fila-pessoa-9").getByRole("button", { name: "Resolvido" }).click(); await page.waitForTimeout(700);
  ok(reg.resolver.length === 1 && reg.resolver[0].p_id === 41 && reg.resolver[0].p_status === "resolvida" && reg.resolver[0].p_nota === "respondi por whatsapp", "resolver a solicitação pelo cartão usa a mesma função de sempre e registra o que foi feito");
  await T.browser.close();
  const S = await nova({ semFuncoes: true }); await abrirContas(S.page);
  const t = await S.page.getByTestId("admin-fila-pessoas").innerText();
  ok(!(await S.page.locator("body").innerText()).includes("Não foi possível carregar tudo") && await S.page.getByTestId("fila-pessoa-7").count() === 1 && await S.page.getByTestId("fila-troca").count() === 0, "sem as funções J13/J14 o painel carrega normalmente (a ausência não é falha)");
  ok(/fila por pessoa \(3/i.test(t), "e a fila só traz quem tem solicitação ou pediu ajuda");
  await S.browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
