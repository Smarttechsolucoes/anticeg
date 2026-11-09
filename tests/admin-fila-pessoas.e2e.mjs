// Teste de navegador da LISTA DE PENDÊNCIAS do painel (Admin → Contas): uma linha por pessoa, filtros, busca e detalhe dentro da linha (API simulada, Playwright; não toca no Supabase real).
// Cobre: ordem, contagens, filtros, busca, o que conferir, texto da pessoa só como texto, aplicar/cancelar troca, aprovar/recusar comprovação, confirmar vínculo, listas por tipo e celular.
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
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: cen.largura || 1200, height: 1000 } });
  await ctx.addInitScript(([u, sess, ref]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_session_at_v2", String(Date.now()));
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
  }, [OWNER, sessao(), REF]);
  const V = (id, cog, nome, dominio, itens, ajuda) => ({ joiner_id: id, cog, nome_site: nome, dominio, tem_conta: false, itens, pedido_de_ajuda: ajuda });
  const est = {
    aConfirmar: [V(7, "bia", "Bia", "exemplo.com", 3, true), V(8, "caio", null, "outro.com", 0, false), V(10, "eva", null, "exemplo.com", 1, true), V(11, "fabi", "Fabi Souza", "exemplo.com", 2, false), V(12, "gabi", null, null, 0, false)],
    trocas: [{ id: 5, joiner_id: 7, cog: "bia", via: "sem_acesso", desfecho: "sem_acesso", novo_dominio: "gmail.com", novo_verificado_em: "2026-11-09T15:00:00Z", criado_em: "2026-11-09T14:50:00Z" }],
    comps: [{ id: 6, joiner_id: 8, cog: "caio", via: "sem_perfil", desafio_validado: false, detalhe: HTML_PERIGOSO, itens: 4, criado_em: "2026-11-09T10:00:00Z", expira_em: "2026-11-16T10:00:00Z" }],
    solic: [{ id: 41, joiner_id: 9, cog: "duda", tipo: "ativacao_ajuda", valor_pedido: "whatsapp 11 90000-0000", mensagem: "não recebi o código", status: "aberta", criado_em: "2026-11-08T12:00:00Z" },
      { id: 42, joiner_id: 13, cog: "contaativa", tipo: "ativacao_ajuda", valor_pedido: "outro.endereco@gmail.com", mensagem: "O código não chegou, tentei várias vezes", status: "aberta", criado_em: "2026-11-08T17:35:00Z" },
      { id: 43, joiner_id: 13, cog: "contaativa", tipo: "ativacao_sem_vinculo", valor_pedido: null, mensagem: "e-mail/@ do cadastro alterado depois da fotografia confiável", status: "aberta", criado_em: "2026-11-08T15:49:00Z" }],
  };
  const MOT = [{ joiner_id: 7, codigo: "sem_email_valido" }, { joiner_id: 8, codigo: "historico_troca_email", ultimo_registro: "2026-10-01", posterior_a_fotografia: false }, { joiner_id: 10, codigo: "email_compartilhado" }, { joiner_id: 11, codigo: "diverge_fotografia" }, { joiner_id: 12, codigo: "sem_email_valido" }];
  const reg = { aplicar: [], cancelar: [], aprovar: [], recusar: [], resolver: [], confirmar: [], rpc: [] };
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
      if (rpc === "admin_vinculos_motivos") return json(200, MOT);
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
      if (rpc === "admin_confirmar_vinculo") {
        reg.confirmar.push(corpo);
        if (String(corpo.p_email_informado).trim().toLowerCase() !== "fabi@exemplo.com") return json(400, { code: "P0001", message: "o e-mail informado NÃO é o do cadastro; não confirmei" });
        est.aConfirmar = est.aConfirmar.filter(v => v.joiner_id !== corpo.p_joiner_id); return route.fulfill({ status: 204, body: "" });
      }
      return json(200, []);
    }
    if (u.includes("/rest/v1/contas_joiner")) return json(200, [{ joiner_id: 13 }]);   // só a pessoa 13 já tem conta
    if (u.includes("/rest/v1/joiners") && u.includes("id=in.")) return json(200, [{ id: 9, nome_site: "Duda", email: "duda@exemplo.com" }, { id: 13, nome_site: "Conta Ativa", email: "conta.ativa@gmail.com" }]);
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
const linha = (page, id) => page.getByTestId(`fila-pessoa-${id}`);
const abrir = async (page, id) => { const l = linha(page, id); if ((await l.locator("button.lc-topo").getAttribute("aria-expanded")) !== "true") await l.locator("button.lc-topo").click(); await page.waitForTimeout(250); return l; };
const ids = page => page.locator("[data-testid^='fila-pessoa-']").evaluateAll(els => els.map(e => e.getAttribute("data-testid").replace("fila-pessoa-", "")));

{ // lista única: ordem, colunas, contagens e uma linha aberta por vez
  const T = await nova(); const { page, erros } = T; await abrirContas(page);
  const raiz = page.getByTestId("admin-fila-pessoas");
  ok(await raiz.count() === 1, "a lista de pendências aparece em Admin → Contas");
  ok(JSON.stringify(await ids(page)) === JSON.stringify(["8", "7", "9", "10", "11", "12", "13"]), "ordem: com prova (a mais antiga primeiro), depois pediram ajuda, depois sem pedido: " + (await ids(page)).join(","));
  ok(await raiz.locator("button.lc-topo[aria-expanded='true']").count() === 0, "as linhas começam FECHADAS (uma linha por pessoa, sem o cartão inteiro aberto)");
  const t0 = await linha(page, 8).innerText();
  ok(t0.includes("@caio") && /Histórico de troca/.test(t0) && /Com prova/.test(t0) && /4 itens/.test(t0) && /hoje|\d+ d/.test(t0), "cada linha mostra @, motivo, situação, itens e espera");
  ok(/Sem e-mail válido/.test(await linha(page, 12).innerText()) && /Sem pedido/.test(await linha(page, 12).innerText()) && /—/.test(await linha(page, 12).innerText()), "quem não pediu nada aparece como 'Sem pedido', sem data de espera");
  const chips = await raiz.locator(".lc-chip").allInnerTexts();
  ok(chips.join("|").replace(/\s+/g, " ") === "Todos 7|Com prova 2|Pediram ajuda 2|Sem pedido 2|Já têm conta 1", "contagens por situação: " + chips.join("|").replace(/\s+/g, " "));
  await abrir(page, 8); await abrir(page, 7);
  ok(await raiz.locator("button.lc-topo[aria-expanded='true']").count() === 1 && await linha(page, 8).locator("button.lc-topo").getAttribute("aria-expanded") === "false", "só uma linha fica aberta por vez");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : "")); await T.browser.close();
}
{ // filtros e busca
  const T = await nova(); const { page } = T; await abrirContas(page); const raiz = page.getByTestId("admin-fila-pessoas");
  await raiz.locator(".lc-chip", { hasText: "Com prova" }).click(); await page.waitForTimeout(200);
  ok(JSON.stringify(await ids(page)) === JSON.stringify(["8", "7"]) && /2 de 2 pessoas/.test(await page.getByTestId("lc-contagem").innerText()), "filtro 'Com prova' mostra só quem anexou prova");
  await raiz.locator(".lc-chip", { hasText: "Todos" }).click();
  await raiz.getByLabel("Motivo do bloqueio").selectOption("sem_email"); await page.waitForTimeout(200);
  ok(JSON.stringify(await ids(page)) === JSON.stringify(["7", "12"]), "filtro por motivo 'Sem e-mail válido': " + (await ids(page)).join(","));
  const chips = (await raiz.locator(".lc-chip").allInnerTexts()).join("|").replace(/\s+/g, " ");
  ok(chips === "Todos 2|Com prova 1|Pediram ajuda 0|Sem pedido 1|Já têm conta 0", "as contagens das situações acompanham o filtro de motivo: " + chips);
  await raiz.getByLabel("Motivo do bloqueio").selectOption(""); await raiz.getByLabel("Buscar por @ ou nome").fill("fabi souza"); await page.waitForTimeout(200);
  ok(JSON.stringify(await ids(page)) === JSON.stringify(["11"]), "a busca acha por nome (sem diferenciar maiúsculas)");
  await raiz.getByLabel("Buscar por @ ou nome").fill("CAIO"); await page.waitForTimeout(200);
  ok(JSON.stringify(await ids(page)) === JSON.stringify(["8"]), "a busca acha por @");
  await raiz.getByLabel("Buscar por @ ou nome").fill("ninguem-assim"); await page.waitForTimeout(200);
  ok(/Ninguém com esses filtros/.test(await raiz.innerText()), "sem resultado: mensagem clara");
  await T.browser.close();
}
{ // detalhe: o que aconteceu, o que conferir, texto da pessoa só como texto, nenhum e-mail completo
  const T = await nova(); const { page } = T; await abrirContas(page);
  const bia = await abrir(page, 7), t7 = await bia.innerText();
  ok(/Pedido em/.test(t7) && t7.includes("@gmail.com") && /verificado por código/.test(t7) && /NÃO tem acesso ao e-mail antigo/.test(t7), "troca: mostra o provedor do e-mail novo (verificado), o motivo e que não tem acesso ao antigo");
  ok(/o que você precisa conferir/i.test(t7) && /só prova que a pessoa lê ESSE endereço, não QUEM ela é/.test(t7) && t7.includes("O que fazer:"), "troca: diz o que fazer e o que conferir");
  ok(await bia.getByRole("button", { name: "Confirmar vínculo" }).count() === 0, "quem tem pedido de troca NÃO mostra 'Confirmar vínculo'");
  const caio = await abrir(page, 8), t8 = await caio.innerText();
  ok(/NÃO é prova/.test(t8) && t8.includes("4 item(ns) no cadastro") && t8.includes("Aprovar") && t8.includes("Recusar"), "comprovação: texto marcado como NÃO prova, itens e ações no mesmo lugar");
  ok(await page.getByTestId("fila-detalhe").evaluate(el => el.querySelector("img") === null && el.textContent.includes("<img src=x")), "o texto da pessoa aparece como TEXTO (HTML não é interpretado)");
  ok(await page.evaluate(() => window.__xss === undefined), "nenhum script do texto da pessoa foi executado");
  ok(((await page.getByTestId("admin-fila-pessoas").innerText()).match(EMAIL) || []).length === 0, "nenhum e-mail completo aparece na lista (só o provedor)");
  const duda = await abrir(page, 9), t9 = await duda.innerText();
  ok(t9.includes("whatsapp 11 90000-0000") && t9.includes("não recebi o código") && t9.includes("Resolvido"), "solicitação aberta: contato, mensagem e ação no detalhe");
  ok(/Sem motivo registrado/.test(await duda.innerText()) && /Duda/.test(await duda.innerText()), "sem motivo de bloqueio registrado: a linha diz isso; o nome vem do cadastro");
  await T.browser.close();
}
{ // quem já tem conta (pessoa que já ativou a conta): a tela não inventa zero, mostra que ela já ativou e o que fazer
  const T = await nova(); const { page, reg } = T; await abrirContas(page);
  const topo = await linha(page, 13).innerText();
  ok(/Já tem conta/.test(topo) && /Já ativou a conta/.test(topo) && /Conta Ativa/.test(topo), "a linha mostra 'Já tem conta', o motivo 'Já ativou a conta' e o nome vindo do cadastro");
  ok(!/0 itens/.test(topo) && /—/.test(topo), "itens desconhecidos aparecem como '—', nunca como '0 itens'");
  const sty = await abrir(page, 13), td = await sty.innerText();
  ok(!/sem e-mail válido/i.test(td) && /@gmail\.com/.test(td) && /já tem conta/.test(td), "o detalhe não diz 'sem e-mail válido' e mostra o provedor real");
  ok(/JÁ TEM CONTA/.test(td) && /só de ativação/.test(td) && /Resolvido/.test(td), "o que conferir explica que ela já tem conta e que basta fechar os pedidos");
  ok(await sty.getByRole("button", { name: "Confirmar vínculo" }).count() === 0, "quem já tem conta NÃO mostra 'Confirmar vínculo'");
  ok((await sty.getByTestId("fila-solicitacao").count()) === 2, "as duas solicitações aparecem, cada uma com seus botões");
  const raiz = page.getByTestId("admin-fila-pessoas");
  await raiz.locator(".lc-chip", { hasText: "Já têm conta" }).click(); await page.waitForTimeout(200);
  ok(JSON.stringify(await ids(page)) === JSON.stringify(["13"]), "o filtro 'Já têm conta' mostra só quem já ativou (para fechar os pedidos de uma vez)");
  await T.browser.close(); void reg;
}
{ // aplicar a troca: e-mail errado é recusado, certo aplica SEM confirmar o vínculo
  const T = await nova(); const { page, reg, dialogos } = T; await abrirContas(page);
  const bia = await abrir(page, 7); const aplicar = bia.getByRole("button", { name: "Aplicar troca" });
  ok(await aplicar.isDisabled(), "'Aplicar troca' começa desligado (falta e-mail e anotação)");
  await bia.getByLabel(/E-mail novo informado pela pessoa/).fill("outro.endereco@gmail.com"); await bia.getByLabel(/Como você confirmou/).fill("ok");
  ok(await aplicar.isDisabled(), "anotação curta (menos de 5 letras) mantém desligado");
  await bia.getByLabel(/Como você confirmou/).fill("WhatsApp em 09/11 pelo @ de sempre"); await aplicar.click(); await page.waitForTimeout(700);
  ok(dialogos.some(d => d.tipo === "confirm" && /O vínculo NÃO será confirmado/.test(d.msg)), "pede confirmação e avisa que o vínculo NÃO será confirmado");
  ok(reg.aplicar.length === 1 && reg.aplicar[0].p_confirmar_vinculo === false, "e-mail errado: a chamada foi feita SEM confirmar vínculo");
  ok((await page.locator("body").innerText()).includes("Nada foi alterado") && await linha(page, 7).count() === 1, "o servidor recusou: aparece o erro e o pedido continua na lista");
  await bia.getByLabel(/E-mail novo informado pela pessoa/).fill("  Bia.Nova@Gmail.com "); await aplicar.click(); await page.waitForTimeout(900);
  ok(reg.aplicar.length === 2 && reg.aplicar[1].p_id === 5 && reg.aplicar[1].p_confirmar_vinculo === false && /WhatsApp em 09\/11/.test(reg.aplicar[1].p_nota), "e-mail certo: aplica o pedido #5, com a anotação, sem confirmar o vínculo");
  ok((await page.locator("body").innerText()).includes("vínculo continua SEM confirmação") && await page.getByTestId("fila-troca").count() === 0, "mensagem clara de que o vínculo segue sem confirmação; a troca sai da lista");
  await T.browser.close();
}
{ // aplicar com vínculo marcado, cancelar pedido
  const T = await nova(); const { page, reg, dialogos } = T; await abrirContas(page);
  const bia = await abrir(page, 7);
  await bia.getByLabel(/E-mail novo informado pela pessoa/).fill("bia.nova@gmail.com"); await bia.getByLabel(/Como você confirmou/).fill("videochamada em 09/11"); await bia.getByLabel(/também confirmar o vínculo/).check();
  await bia.getByRole("button", { name: "Aplicar troca" }).click(); await page.waitForTimeout(800);
  ok(dialogos.some(d => /O vínculo também será CONFIRMADO/.test(d.msg)) && reg.aplicar[0]?.p_confirmar_vinculo === true, "marcando o vínculo, o aviso muda e o servidor recebe p_confirmar_vinculo = true");
  ok((await page.locator("body").innerText()).includes("vínculo confirmado: ela já pode pedir o código"), "mensagem final diz que ela já pode pedir o código");
  await T.browser.close();
  const U = await nova({ notas: ["pedido não foi ela"] }); await abrirContas(U.page); const b2 = await abrir(U.page, 7);
  await b2.getByRole("button", { name: "Cancelar pedido" }).click(); await U.page.waitForTimeout(700);
  ok(U.reg.cancelar.length === 1 && U.reg.cancelar[0].p_id === 5 && U.reg.cancelar[0].p_nota === "pedido não foi ela" && U.reg.aplicar.length === 0, "cancelar o pedido: registra o motivo e não aplica nada");
  await U.browser.close();
}
{ // comprovação: aprovar exige anotação; recusar pede o motivo; dizer "Cancelar" na confirmação não faz nada
  const T = await nova({ notas: ["não bate com os pagamentos"] }); const { page, reg } = T; await abrirContas(page);
  const caio = await abrir(page, 8); const aprovar = caio.getByRole("button", { name: "Aprovar" });
  ok(await aprovar.isDisabled(), "'Aprovar' começa desligado (falta anotar a prova aceita)");
  await caio.getByLabel(/Prova aceita/).fill("comprovante conferido em 09/11"); ok(!(await aprovar.isDisabled()), "com a anotação, 'Aprovar' liga");
  await caio.getByRole("button", { name: "Recusar" }).click(); await page.waitForTimeout(700);
  ok(reg.recusar.length === 1 && reg.recusar[0].p_id === 6 && reg.recusar[0].p_nota === "não bate com os pagamentos" && reg.aprovar.length === 0, "recusar: pede o motivo e registra; nada é aprovado");
  await T.browser.close();
  const U = await nova(); await abrirContas(U.page); const c2 = await abrir(U.page, 8);
  await c2.getByLabel(/Prova aceita/).fill("comprovante conferido em 09/11"); await c2.getByRole("button", { name: "Aprovar" }).click(); await U.page.waitForTimeout(800);
  ok(U.dialogos.some(d => d.tipo === "confirm" && /sai para o e-mail que JÁ está no cadastro/.test(d.msg)) && U.reg.aprovar.length === 1 && U.reg.aprovar[0].p_id === 6 && U.reg.aprovar[0].p_nota === "comprovante conferido em 09/11", "aprovar: confirma, explica que o código sai para o e-mail do cadastro e registra a prova aceita");
  ok((await U.page.locator("body").innerText()).includes("Comprovação do @caio aprovada"), "mensagem de sucesso");
  await U.browser.close();
  const V = await nova({ recusarDialogo: true }); await abrirContas(V.page); const c3 = await abrir(V.page, 8);
  await c3.getByLabel(/Prova aceita/).fill("comprovante conferido em 09/11"); await c3.getByRole("button", { name: "Aprovar" }).click(); await V.page.waitForTimeout(600);
  ok(V.reg.aprovar.length === 0, "dizer 'Cancelar' na confirmação NÃO aprova"); await V.browser.close();
}
{ // confirmar vínculo de quem ainda não pediu nada; solicitação resolvida pelo detalhe
  const T = await nova({ notas: ["respondi por whatsapp"] }); const { page, reg } = T; await abrirContas(page);
  const fabi = await abrir(page, 11); const conf = fabi.getByRole("button", { name: "Confirmar vínculo" });
  ok(await conf.isDisabled(), "'Confirmar vínculo' começa desligado (falta o e-mail e a anotação)");
  await fabi.getByLabel(/E-mail completo informado pela pessoa/).fill("errado@exemplo.com"); await fabi.getByLabel(/Como você confirmou/).fill("WhatsApp em 09/11"); await conf.click(); await page.waitForTimeout(700);
  ok(reg.confirmar.length === 1 && reg.confirmar[0].p_joiner_id === 11 && /NÃO é o do cadastro/.test(await page.locator("body").innerText()) && await linha(page, 11).count() === 1, "e-mail errado: o servidor recusa, aparece o erro e a pessoa continua na lista");
  await fabi.getByLabel(/E-mail completo informado pela pessoa/).fill(" Fabi@Exemplo.com "); await conf.click(); await page.waitForTimeout(900);
  ok(reg.confirmar.length === 2 && reg.confirmar[1].p_nota === "WhatsApp em 09/11" && (await page.locator("body").innerText()).includes("Vínculo do @fabi confirmado") && await linha(page, 11).count() === 0, "e-mail certo: vínculo confirmado, mensagem de sucesso e a pessoa sai da lista");
  const duda = await abrir(page, 9); await duda.getByRole("button", { name: "Resolvido" }).click(); await page.waitForTimeout(700);
  ok(reg.resolver.length === 1 && reg.resolver[0].p_id === 41 && reg.resolver[0].p_status === "resolvida" && reg.resolver[0].p_nota === "respondi por whatsapp", "resolver a solicitação pelo detalhe usa a mesma função de sempre e registra o que foi feito");
  await T.browser.close();
}
{ // listas por tipo e outras ferramentas continuam acessíveis (recolhidas); sem as funções novas o painel carrega
  const T = await nova(); const { page } = T; await abrirContas(page);
  const tipo = page.getByTestId("admin-listas-tipo");
  ok(await tipo.count() === 1 && await page.getByTestId("admin-outras-ferramentas").count() === 1, "as listas por tipo e as outras ferramentas existem, recolhidas");
  await tipo.locator("summary").click(); await page.waitForTimeout(200);
  const sol = page.getByTestId("admin-solicitacoes"), vinc = page.getByTestId("admin-vinculos-confirmar");
  ok((await sol.innerText()).includes("não recebi o código") && (await vinc.innerText()).includes("@bia") && (await vinc.innerText()).includes("@fabi"), "abrindo 'Listas por tipo', as solicitações e os vínculos a confirmar continuam lá");
  await T.browser.close();
  const S = await nova({ semFuncoes: true }); await abrirContas(S.page);
  ok(!(await S.page.locator("body").innerText()).includes("Não foi possível carregar tudo") && await linha(S.page, 7).count() === 1 && /Pendências por pessoa \(7/i.test(await S.page.getByTestId("admin-fila-pessoas").innerText()), "sem as funções J13/J14 o painel carrega normalmente (a ausência não é falha)");
  await S.browser.close();
}
{ // celular: sem rolagem lateral e a linha continua legível
  const T = await nova({ largura: 390 }); const { page } = T; await abrirContas(page);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no celular não há rolagem lateral");
  await abrir(page, 8);
  ok(await page.evaluate(() => { const d = document.querySelector(".lc-det"); return !!d && d.scrollWidth <= d.clientWidth + 1; }), "no celular o detalhe cabe na largura (colunas empilhadas)");
  await T.browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
