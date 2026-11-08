// Teste de navegador do fluxo OPERACIONAL do lançamento: Admin → Contas (API simulada, Playwright; não toca no Supabase real).
// Cobre: listar a pendência de vínculo → confirmar COM o canal anotado → a lista se atualiza → o pedido de ajuda é resolvido; recusa sem anotação; erro do servidor aparece sem fingir sucesso.
// Uso: VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois `node tests/admin-contas.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const REF = "ghjfsmwwcfpfvrouyrka", PORTA = 5197;
const OWNER = { id: 1, cog: "nandaverseo_c", nome: "Dona", nome_site: "Dona", email: "dona@exemplo.com", twitter: "@nandaverseo_c", confirmado: true };
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: ADMIN_ID, email: "dona@exemplo.com", role: "authenticated", aal: "aal1", session_id: "s1", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-admin`;
const sessao = () => ({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-1",
  user: { id: ADMIN_ID, aud: "authenticated", role: "authenticated", email: "dona@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

async function nova(cen) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  await ctx.addInitScript(([u, sess, ref]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_session_at_v2", String(Date.now()));
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
  }, [OWNER, sessao(), REF]);
  const est = { aConfirmar: [{ joiner_id: 7, cog: "bia", nome_site: null, dominio: "exemplo.com", tem_conta: false, itens: 3, pedido_de_ajuda: true }, { joiner_id: 8, cog: "caio", nome_site: "Caio", dominio: "outro.com", tem_conta: false, itens: 0, pedido_de_ajuda: false }],
    solic: [{ id: 41, joiner_id: 7, cog: "bia", tipo: "ativacao_ajuda", valor_pedido: "whatsapp 11 90000-0000", mensagem: "não recebi o código", status: "aberta", criado_em: "2026-11-18T12:00:00Z" }] };
  const reg = { confirmar: [], resolver: [], rpc: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("supabase.co/auth/v1/")) { const p = new URL(u).pathname.replace("/auth/v1", ""); if (p === "/user") return json(200, sessao().user); if (p === "/logout") return route.fulfill({ status: 204, body: "" }); return json(200, {}); }
    const rpc = (u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/) || [])[1];
    if (rpc) {
      reg.rpc.push(rpc); const corpo = JSON.parse(req.postData() || "{}");
      if (rpc === "is_admin") return json(200, true);
      if (rpc === "admin_vinculos_a_confirmar") return json(200, est.aConfirmar);
      if (rpc === "admin_vinculos_motivos") return cen.semMotivos ? json(404, { code: "PGRST202", message: "Could not find the function public.admin_vinculos_motivos" }) : json(200, [{ joiner_id: 7, codigo: "historico_alteracao", ultimo_registro: "2026-11-07", posterior_a_fotografia: false }, { joiner_id: 8, codigo: "email_compartilhado", ultimo_registro: null, posterior_a_fotografia: false }]);
      if (rpc === "admin_perfil_solicitacoes") return json(200, est.solic);
      if (rpc === "admin_confirmar_vinculo") {
        reg.confirmar.push(corpo);
        if (cen.erroConfirmar) return json(400, { code: "P0001", message: "e-mail dividido com outro cadastro: resolva antes (trocar e-mail)" });
        if (String(corpo.p_email_informado || "").trim().toLowerCase() !== "bia@exemplo.com") return json(400, { code: "P0001", message: "o e-mail informado NÃO é o do cadastro; não confirme (use Trocar e-mail com o e-mail que a pessoa informou)" });
        est.aConfirmar = est.aConfirmar.filter(v => v.joiner_id !== corpo.p_joiner_id); return route.fulfill({ status: 204, body: "" });
      }
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
  const dialogos = []; page.on("dialog", async d => { dialogos.push({ tipo: d.type(), msg: d.message() }); await d.accept(cen.notas?.shift() ?? ""); });
  return { browser, page, reg, erros, dialogos };
}
const abrirContas = async page => {
  await page.goto(`http://localhost:${PORTA}/admin`, { waitUntil: "networkidle" }); await page.waitForTimeout(900);
  const modalAtivacao = page.getByTestId("ativacao-modal");   // administradora sem conta ligada vê o pop-up de ativação (com X) como as demais: fecha para chegar ao painel
  if (await modalAtivacao.count()) { await modalAtivacao.getByTestId("fechar-acesso").click().catch(() => {}); await page.waitForTimeout(1500); await page.goto(`http://localhost:${PORTA}/admin`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); }
  await page.waitForSelector(".admin-sidebar-group", { timeout: 15000 }).catch(() => {});
  const item = page.locator("button.admin-sidebar-item", { hasText: /Contas$/ }).first();
  await item.click({ timeout: 8000 }); await page.waitForTimeout(900);
};

{ // fluxo feliz: lista → confirma com anotação → some da lista; pedido de ajuda resolvido
  const T = await nova({ notas: [" Bia@Exemplo.com ", "confirmei por whatsapp em 18/11 (mensagem do @ bia)", "respondi por whatsapp"] }); const { page, reg, erros, dialogos } = T;
  await abrirContas(page);
  const caixa = page.getByTestId("admin-vinculos-confirmar");
  ok(await caixa.count() === 1, "a seção 'Vínculos aguardando confirmação' aparece em Admin → Contas");
  const t0 = await caixa.innerText();
  ok(t0.includes("(2)") && t0.includes("@bia") && t0.includes("@caio") && t0.includes("pediu ajuda") && t0.includes("@exemplo.com") && !t0.includes("***") && t0.includes("DIGITE o e-mail completo"), "lista as 2 pendências, destaca quem pediu ajuda e mostra só o domínio do e-mail, nunca o endereço nem uma máscara");
  ok(((await caixa.innerText()).match(/[\w.+-]+@[\w.-]+\.\w+/g) || []).length === 0, "nenhum e-mail aparece na seção de vínculos (só o domínio)");
  await caixa.getByRole("button", { name: "Confirmar vínculo" }).first().click(); await page.waitForTimeout(700);
  ok(dialogos.length >= 2 && dialogos[0].tipo === "prompt" && /e-mail COMPLETO que a pessoa \(@bia\) informou/.test(dialogos[0].msg) && /Como você confirmou/.test(dialogos[1].msg), "pede PRIMEIRO o e-mail completo informado pela pessoa e DEPOIS a anotação do canal");
  ok(reg.confirmar.length === 1 && reg.confirmar[0].p_joiner_id === 7 && reg.confirmar[0].p_nota === "confirmei por whatsapp em 18/11 (mensagem do @ bia)" && reg.confirmar[0].p_email_informado === "Bia@Exemplo.com", "o servidor recebe o cadastro certo (#7), o e-mail completo informado (a conferência é do servidor) e a anotação do canal");
  const t1 = await caixa.innerText();
  ok(t1.includes("(1)") && !t1.includes("@bia") && t1.includes("@caio"), "depois de confirmar, a pessoa sai da lista e a outra continua");
  ok((await page.locator("body").innerText()).includes("Vínculo do @bia confirmado"), "mensagem de sucesso para a administradora");
  const sol = page.getByTestId("admin-solicitacoes");
  ok((await sol.innerText()).includes("não recebi o código") && (await sol.innerText()).includes("whatsapp 11 90000-0000"), "o pedido de ajuda aparece com o contato e a mensagem");
  await sol.getByRole("button", { name: "Resolvido" }).click(); await page.waitForTimeout(600);
  ok(reg.resolver.length === 1 && reg.resolver[0].p_id === 41 && reg.resolver[0].p_status === "resolvida" && reg.resolver[0].p_nota === "respondi por whatsapp", "resolver o pedido de ajuda registra o que foi feito");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}
{ // anotação curta: nada é enviado
  const T = await nova({ notas: ["bia@exemplo.com", "ok"] }); const { page, reg } = T;
  await abrirContas(page);
  await page.getByTestId("admin-vinculos-confirmar").getByRole("button", { name: "Confirmar vínculo" }).first().click(); await page.waitForTimeout(500);
  ok(reg.confirmar.length === 0 && (await page.locator("body").innerText()).includes("Anote como confirmou"), "anotação curta (menos de 5 letras): recusada no navegador, nada enviado, lista intacta");
  await T.browser.close();
}
{ // cancelar o prompt: nada é enviado
  const T = await nova({}); const { page, reg } = T;
  await page.exposeFunction("__noop", () => {});
  page.removeAllListeners("dialog"); page.on("dialog", d => d.dismiss());
  await abrirContas(page);
  await page.getByTestId("admin-vinculos-confirmar").getByRole("button", { name: "Confirmar vínculo" }).first().click(); await page.waitForTimeout(500);
  ok(reg.confirmar.length === 0 && (await page.getByTestId("admin-vinculos-confirmar").innerText()).includes("(2)"), "cancelar a anotação: nada é confirmado");
  await T.browser.close();
}
{ // e-mail informado diferente do cadastro (inclusive com a mesma máscara): o servidor recusa, nada muda, a tela explica o que fazer
  const T = await nova({ notas: ["bi.a@exemplo.com", "confirmei por whatsapp em 18/11"] }); const { page, reg } = T;
  await abrirContas(page);
  await page.getByTestId("admin-vinculos-confirmar").getByRole("button", { name: "Confirmar vínculo" }).first().click(); await page.waitForTimeout(700);
  const corpo = await page.locator("body").innerText();
  ok(reg.confirmar.length === 1 && corpo.includes("NÃO é o do cadastro") && corpo.includes("Trocar e-mail") && (await page.getByTestId("admin-vinculos-confirmar").innerText()).includes("(2)") && !corpo.includes("Vínculo do @bia confirmado"), "e-mail informado diferente: recusado, a pendência continua e a tela manda usar 'Trocar e-mail'");
  await T.browser.close();
}
{ // e-mail sem @ digitado: nem chega ao servidor
  const T = await nova({ notas: ["isso nao e email"] }); const { page, reg } = T;
  await abrirContas(page);
  await page.getByTestId("admin-vinculos-confirmar").getByRole("button", { name: "Confirmar vínculo" }).first().click(); await page.waitForTimeout(500);
  ok(reg.confirmar.length === 0 && (await page.locator("body").innerText()).includes("Digite o e-mail completo"), "e-mail sem @: recusado no navegador, nada enviado");
  await T.browser.close();
}
{ // o servidor recusa (ex.: e-mail dividido): a tela mostra o erro e NÃO finge sucesso
  const T = await nova({ erroConfirmar: true, notas: ["bia@exemplo.com", "confirmei por whatsapp em 18/11"] }); const { page } = T;
  await abrirContas(page);
  await page.getByTestId("admin-vinculos-confirmar").getByRole("button", { name: "Confirmar vínculo" }).first().click(); await page.waitForTimeout(700);
  const corpo = await page.locator("body").innerText();
  ok(corpo.includes("Não foi possível confirmar") && corpo.includes("e-mail dividido") && (await page.getByTestId("admin-vinculos-confirmar").innerText()).includes("(2)") && !corpo.includes("Vínculo do @bia confirmado"), "recusa do servidor: mensagem de erro, a pendência continua na lista, sem falso sucesso");
  await T.browser.close();
}
{ // motivo por cadastro + texto geral corrigido (histórico de pedido de troca NÃO é mudança depois da fotografia)
  const T = await nova({}); const { page, erros } = T;
  await abrirContas(page);
  const caixa = page.getByTestId("admin-vinculos-confirmar"); const texto = await caixa.innerText();
  ok(!/foram alterados depois da fotografia|alterado depois da fotografia/.test(texto), "o texto geral NÃO afirma mais que e-mail/@ foram alterados depois da fotografia");
  ok(texto.includes("NÃO há histórico de pedido de troca") && texto.includes("histórico de pedido de troca (o e-mail/@ de hoje são os mesmos da fotografia"), "o texto geral explica: histórico de troca = registro antigo, não mudança depois da fotografia");
  const motivos = await caixa.getByTestId("vinculo-motivo").allInnerTexts();
  ok(motivos.length === 2, "cada cadastro da lista mostra o seu motivo");
  ok(motivos[0].includes("histórico de pedido de troca de e-mail/@") && motivos[0].includes("07/11/2026") && motivos[0].includes("nada mudou depois da fotografia"), "histórico de troca: mostra a data do último registro e que NADA mudou depois da fotografia");
  ok(motivos[1].includes("e-mail compartilhado com outro cadastro"), "e-mail compartilhado: motivo próprio");
  ok(((await caixa.innerText()).match(/[\w.+-]+@[\w.-]+\.\w+/g) || []).length === 0, "os motivos não mostram e-mail");
  ok(erros.length === 0, "nenhum erro de JavaScript"); await T.browser.close();
}
{ // antes do J9 (função ainda não existe): a lista continua igual, sem motivo e sem erro na tela
  const T = await nova({ semMotivos: true }); const { page, erros } = T;
  await abrirContas(page);
  const caixa = page.getByTestId("admin-vinculos-confirmar");
  ok(await caixa.getByTestId("vinculo-motivo").count() === 0 && (await caixa.innerText()).includes("(2)"), "sem a função de motivos: a lista aparece igual, só sem o motivo");
  ok(!(await page.locator("body").innerText()).includes("Não foi possível carregar tudo"), "a ausência da função de motivos não vira erro na tela");
  ok(erros.length === 0, "nenhum erro de JavaScript"); await T.browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
