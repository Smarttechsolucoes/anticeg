// Teste de navegador das telas "Quero mudar de e-mail" (J13) e "Quero manter meu e-mail e comprovar meu cadastro" (J14), no pop-up de ativação.
// API simulada (Playwright); NÃO toca no Supabase real e nenhum e-mail existe aqui. Prova, entre outras coisas: o texto nunca afirma envio que não aconteceu;
// "e-mail verificado", "pedido aguardando análise" e "acesso liberado" aparecem separados e só como cumpridos quando o servidor disse; só a via "descrever outra prova".
// Uso: VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois `node tests/joiner-troca-email.e2e.mjs`.
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const REF = "ghjfsmwwcfpfvrouyrka", PORTA = 5197;
const ANA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", email: "registrado@exemplo.com", twitter: "@ana", confirmado: true };
const TOKEN = "eyJwIjoxMDAsIm4iOiJhYmMifQ.c2VndW5kYS1wYXJ0ZS1kZS10ZXN0ZS0xMjM0NTY";

// cen: { respostas: { iniciar:[...], confirmar:[...], comprovar:[...] } } (cada chamada consome a próxima resposta; a última se repete), erro429
async function nova(cen = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  await ctx.addInitScript(([u, ref]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "6"); localStorage.setItem("anticeg_session_at_v2", String(Date.now()));
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1"); void ref;
  }, [ANA, REF]);
  const reg = { iniciar: [], confirmar: [], comprovar: [], ajuda: [], otp: [] };
  const fila = { iniciar: [...(cen.respostas?.iniciar || [])], confirmar: [...(cen.respostas?.confirmar || [])], comprovar: [...(cen.respostas?.comprovar || [])] };
  const proxima = k => (fila[k].length > 1 ? fila[k].shift() : fila[k][0]);
  await ctx.route("**/*", async route => {
    const req = route.request(), u = req.url();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const corpo = () => JSON.parse(req.postData() || "{}");
    if (u.includes("/functions/v1/trocar-email-joiner")) {
      const c = corpo();
      if (cen.erro429) return json(429, { error: "Muitas tentativas." });
      if (c.acao === "iniciar") { reg.iniciar.push(c); return json(200, proxima("iniciar") ?? { ok: true, via: c.via, token: TOKEN }); }
      reg.confirmar.push(c); return json(200, proxima("confirmar") ?? { ok: true, resultado: "errado" });
    }
    if (u.includes("/functions/v1/comprovar-cadastro")) { reg.comprovar.push(corpo()); return cen.erro429 ? json(429, { error: "Muitas tentativas." }) : json(200, proxima("comprovar") ?? { ok: true, etapa: "pedido_recebido" }); }
    if (u.includes("/functions/v1/pedir-ajuda-ativacao")) { reg.ajuda.push(corpo()); return json(200, { ok: true }); }
    if (u.includes("/functions/v1/pedir-codigo-joiner")) { reg.otp.push(corpo()); return json(200, cen.otp ?? { ok: true }); }
    if (u.includes("/functions/v1/ativacao-dica")) return json(200, { ok: true, dica: "r•••@e•••.com" });
    if (u.includes("/rest/v1/rpc/entrar_com_arroba")) return json(200, null);
    if (u.includes("supabase.co/auth/v1/")) { const p = new URL(u).pathname.replace("/auth/v1", ""); if (p === "/logout") return route.fulfill({ status: 204, body: "" }); return json(200, {}); }
    if (u.includes("/rest/v1/rpc/meu_cog")) return json(200, null);
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
const corpo = page => page.locator("body").innerText();
const modal = page => page.getByTestId("ativacao-modal");
const abrir = async page => { await page.goto(`http://localhost:${PORTA}/masterlist`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); };
const estado = (page, id) => page.getByTestId(id).getAttribute("data-estado");
const irParaTroca = async (page, { via = "email_antigo", atual = "registrado@exemplo.com", novo = "novo.email@exemplo.com" } = {}) => {
  await modal(page).getByTestId("ativacao-quero-trocar").click(); await page.waitForTimeout(250);
  if (via === "sem_acesso") await page.getByTestId("troca-via-sem-acesso").check();
  await modal(page).getByLabel("Seu @ cadastrado").fill("ana");
  if (via === "email_antigo") await modal(page).getByLabel("E-mail atual do cadastro").fill(atual);
  await modal(page).getByLabel("E-mail novo").fill(novo);
  await modal(page).getByRole("button", { name: "Continuar" }).click(); await page.waitForTimeout(500);
};
const digitar = async (page, cod) => { await page.getByTestId("troca-codigo").fill(cod); await modal(page).getByRole("button", { name: "Confirmar código" }).click(); await page.waitForTimeout(500); };

{ // pontos de entrada nas três telas do pop-up
  const T = await nova({ respostas: { comprovar: [{ ok: true, etapa: "pedido_recebido" }] }, otp: { ok: true, proximo: "comprovar" } }); const { page, erros } = T; await abrir(page);
  ok(await modal(page).getByTestId("ativacao-quero-trocar").count() === 1 && await modal(page).getByTestId("ativacao-quero-comprovar").count() === 1, "tela inicial: as duas opções aparecem (“Quero mudar de e-mail” e “Quero manter meu e-mail e comprovar meu cadastro”)");
  await modal(page).getByLabel("Seu @ cadastrado").fill("ana"); await modal(page).getByLabel("E-mail do cadastro").fill("registrado@exemplo.com");
  await modal(page).getByLabel("Crie sua senha").fill("senha-boa-123"); await modal(page).getByLabel("Repita a senha").fill("senha-boa-123");
  await modal(page).getByRole("button", { name: "Enviar código de confirmação" }).click(); await page.waitForTimeout(600);
  ok(await page.getByTestId("ativacao-sem-codigo").count() === 1 && /Nenhum código foi enviado/.test(await corpo(page)), "tela 'Nenhum código foi enviado' (proximo: comprovar)");
  ok(await page.getByTestId("ativacao-sem-codigo-comprovar").count() === 1 && await page.getByTestId("ativacao-sem-codigo-trocar").count() === 1 && await page.getByTestId("ativacao-sem-codigo-ajuda").count() === 1, "…oferece comprovar, mudar de e-mail e pedir ajuda");
  await page.getByTestId("ativacao-sem-codigo-comprovar").click(); await page.waitForTimeout(300);
  ok(await page.getByTestId("comprovar-dados").count() === 1, "o botão leva à tela de comprovação");
  ok(((await page.getByTestId("comprovar-dados").getByLabel("Seu @ cadastrado").inputValue()) === "ana") && ((await page.getByTestId("comprovar-dados").getByLabel("E-mail do cadastro").inputValue()) === "registrado@exemplo.com"), "@ e e-mail já digitados vêm preenchidos");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : "")); await T.browser.close();
}
{ // via e-mail antigo → aplicada
  const T = await nova({ respostas: { confirmar: [{ ok: true, resultado: "errado" }, { ok: true, resultado: "antigo_ok", novo_mascarado: "n•••@e•••.com" }, { ok: true, resultado: "aplicada" }] } }); const { page, reg, erros } = T; await abrir(page);
  await irParaTroca(page);
  ok(reg.iniciar.length === 1 && reg.iniciar[0].acao === "iniciar" && reg.iniciar[0].via === "email_antigo" && reg.iniciar[0].cog === "ana" && reg.iniciar[0].email === "registrado@exemplo.com" && reg.iniciar[0].novo_email === "novo.email@exemplo.com", "o pedido sai com @, e-mail do cadastro, e-mail novo e a via");
  ok(await page.getByTestId("troca-antigo").count() === 1, "primeiro passo: código do e-mail do cadastro");
  const t1 = await page.getByTestId("troca-texto-codigo-antigo").innerText();
  ok(/Se o @ e o e-mail do cadastro que você informou conferirem/.test(t1) && !/enviamos|foi enviado|enviei/i.test(t1) && /nenhum código tenha sido enviado/.test(t1), "o texto é CONDICIONAL: não afirma que algum código foi enviado");
  ok(!(await corpo(page)).includes("registrado@exemplo.com"), "o e-mail do cadastro aparece só mascarado" + "");
  await digitar(page, "123"); ok(/6 números/.test(await corpo(page)) && reg.confirmar.length === 0, "código com formato errado: recusado no navegador, nada enviado ao servidor");
  await digitar(page, "000000"); ok(/não confere/.test(await corpo(page)) && await page.getByTestId("troca-antigo").count() === 1, "código errado: mensagem clara e continua no mesmo passo");
  await digitar(page, "111111");
  ok(reg.confirmar.at(-1).lado === "antigo" && reg.confirmar.at(-1).codigo === "111111" && reg.confirmar.at(-1).token === TOKEN, "o código certo do e-mail antigo é conferido com o token do pedido");
  ok(await page.getByTestId("troca-novo").count() === 1 && /Enviamos um código para n•••@e•••\.com/.test(await page.getByTestId("troca-texto-codigo-novo").innerText()), "só DEPOIS de o servidor confirmar o antigo, a tela diz que enviou o código ao e-mail novo (mascarado)");
  ok(await page.getByTestId("troca-aviso-antigo-ok").count() === 1, "mostra que o e-mail do cadastro foi confirmado");
  await digitar(page, "222222");
  ok(reg.confirmar.at(-1).lado === "novo", "o código do e-mail novo é conferido");
  ok(await page.getByTestId("troca-fim-aplicada").count() === 1 && /E-mail trocado/.test(await corpo(page)), "tela final: e-mail trocado");
  ok(await estado(page, "situacao-email") === "sim" && await estado(page, "situacao-acesso") === "sim" && /Nenhum pedido pendente/.test(await page.getByTestId("situacao-pedido").innerText()), "situação: e-mail verificado ✓, nenhum pedido pendente, acesso liberado ✓");
  await page.getByTestId("troca-ir-ativar").click(); await page.waitForTimeout(300);
  ok(await modal(page).getByLabel("E-mail do cadastro").inputValue() === "novo.email@exemplo.com", "“Ativar com o e-mail novo” volta ao formulário com o e-mail novo preenchido");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : "")); await T.browser.close();
}
{ // via sem acesso → aguardando identidade (nunca aplica sozinho)
  const T = await nova({ respostas: { confirmar: [{ ok: true, resultado: "aguardando_identidade" }] } }); const { page, reg, erros } = T; await abrir(page);
  await modal(page).getByTestId("ativacao-quero-trocar").click(); await page.getByTestId("troca-via-sem-acesso").check();
  ok(/nunca é feita sozinha/.test(await page.getByTestId("troca-texto-sem-acesso").innerText()) && await modal(page).getByLabel("E-mail atual do cadastro").count() === 0, "sem acesso: avisa que NUNCA é feita sozinha e não pede o e-mail antigo");
  await irParaTroca2(page);
  async function irParaTroca2(p) { await modal(p).getByLabel("Seu @ cadastrado").fill("ana"); await modal(p).getByLabel("E-mail novo").fill("novo.email@exemplo.com"); await modal(p).getByRole("button", { name: "Continuar" }).click(); await p.waitForTimeout(500); }
  ok(reg.iniciar[0].via === "sem_acesso" && !("email" in reg.iniciar[0]) && reg.iniciar[0].novo_email === "novo.email@exemplo.com", "o pedido sai SEM e-mail antigo e com a via sem_acesso");
  ok(await page.getByTestId("troca-novo").count() === 1 && await page.getByTestId("troca-antigo").count() === 0, "vai direto ao código do e-mail novo");
  const t = await page.getByTestId("troca-texto-codigo-novo").innerText();
  ok(/Se os dados informados puderem seguir por aqui/.test(t) && !/Enviamos/.test(t), "o texto é condicional (não afirma envio)");
  await digitar(page, "222222");
  ok(await page.getByTestId("troca-fim-aguardando").count() === 1, "tela final: troca em análise");
  ok(await estado(page, "situacao-email") === "sim" && await estado(page, "situacao-pedido") === "pendente" && await estado(page, "situacao-acesso") === "nao", "situação: e-mail verificado ✓, pedido aguardando análise (…), acesso NÃO liberado");
  const f = await corpo(page);
  ok(/não troca/.test(f) && /nenhum código de ativação foi enviado/i.test(f) && /nenhum cadastro novo foi criado/.test(f) && !/E-mail trocado/.test(f), "explica que confirmar o e-mail novo não troca nem libera, e que nada foi enviado/criado");
  await page.getByLabel("Contato para resposta").fill("whatsapp 11 90000-0000"); await page.getByRole("button", { name: "Enviar contato" }).click(); await page.waitForTimeout(500);
  ok(reg.ajuda.length === 1 && reg.ajuda[0].cog === "ana" && reg.ajuda[0].contato === "whatsapp 11 90000-0000" && /troca de e-mail aguardando análise/.test(reg.ajuda[0].mensagem), "o contato vai pelo pedido de ajuda de sempre, com a menção ao pedido de troca");
  ok(await page.getByTestId("troca-contato-enviado").count() === 1, "confirma que o contato foi enviado (só depois do servidor aceitar)");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : "")); await T.browser.close();
}
{ // par errado: o servidor devolve o token de aparência igual; a tela nunca diz que algo foi enviado, e qualquer código dá "não confere"
  const T = await nova({ respostas: { confirmar: [{ ok: true, resultado: "errado" }] } }); const { page } = T; await abrir(page);
  await irParaTroca(page, { atual: "outro@exemplo.com" });
  ok(await page.getByTestId("troca-antigo").count() === 1 && !/Enviamos|foi enviado|enviado para/.test(await corpo(page)), "par errado: a tela é a mesma e não afirma envio");
  await digitar(page, "123456"); ok(/não confere/.test(await corpo(page)), "qualquer código resulta em 'não confere'"); await T.browser.close();
}
{ // falha do provedor depois do antigo, bloqueio, expiração, limite
  const T = await nova({ respostas: { confirmar: [{ ok: true, resultado: "falha_envio" }, { ok: true, resultado: "antigo_ok", novo_mascarado: "n•••@e•••.com" }] } }); const { page, reg } = T; await abrir(page); await irParaTroca(page);
  await digitar(page, "111111");
  ok(/não conseguimos enviar o código ao e-mail novo agora/.test(await corpo(page)) && await page.getByTestId("troca-reenviar").count() === 1 && await page.getByTestId("troca-fim-aplicada").count() === 0, "falha do envio ao e-mail novo: diz a verdade e oferece tentar de novo");
  await page.getByTestId("troca-reenviar").click(); await page.waitForTimeout(500);
  ok(reg.confirmar.at(-1).lado === "antigo" && reg.confirmar.at(-1).codigo === "111111" && /Enviamos um código para n•••@e•••\.com/.test(await corpo(page)), "tentar de novo repete a conferência do e-mail antigo e só então afirma o envio");
  await T.browser.close();
  for (const [resultado, texto] of [["bloqueado", /muitas tentativas erradas/], ["expirado", /expirou/], ["limite_envio", /limite de envios/]]) {
    const U = await nova({ respostas: { confirmar: [{ ok: true, resultado }] } }); await abrir(U.page); await irParaTroca(U.page); await digitar(U.page, "111111");
    ok(texto.test(await corpo(U.page)) && await U.page.getByTestId("troca-dados").count() === 1, `resultado '${resultado}': mensagem clara e a pessoa volta ao começo`); await U.browser.close();
  }
  const E = await nova({ erro429: true }); await abrir(E.page); await irParaTroca(E.page);
  ok(/Muitas tentativas|Não foi possível seguir/.test(await corpo(E.page)) && await E.page.getByTestId("troca-dados").count() === 1, "limite do servidor (429): mensagem e a tela não avança"); await E.browser.close();
}
{ // respostas inesperadas do servidor não viram afirmações: resultado desconhecido = falha; e-mail completo vindo do servidor não é exibido
  const T = await nova({ respostas: { confirmar: [{ ok: true, resultado: "qualquer_coisa" }] } }); await abrir(T.page); await irParaTroca(T.page); await digitar(T.page, "111111");
  ok(/Não foi possível seguir agora/.test(await corpo(T.page)) && await T.page.getByTestId("troca-novo").count() === 0 && await T.page.getByTestId("troca-fim-aplicada").count() === 0, "resultado desconhecido do servidor: mensagem de falha, nada é afirmado"); await T.browser.close();
  const U = await nova({ respostas: { confirmar: [{ ok: true, resultado: "antigo_ok", novo_mascarado: "completo.vazado@exemplo.com" }] } }); await abrir(U.page); await irParaTroca(U.page); await digitar(U.page, "111111");
  ok(!(await corpo(U.page)).includes("completo.vazado@exemplo.com"), "um e-mail completo devolvido pelo servidor NÃO é mostrado"); await U.browser.close();
}
{ // quem acertou o par e não pode seguir por aqui
  for (const [proximo, texto] of [["entrar", /já tem conta/], ["ajuda", /Nenhum código foi enviado/], ["limite", /pedidos de troca demais/]]) {
    const T = await nova({ respostas: { iniciar: [{ ok: true, proximo }] } }); const { page } = T; await abrir(page); await irParaTroca(page);
    ok(await page.getByTestId("troca-sem-pedido").count() === 1 && texto.test(await page.getByTestId("troca-sem-pedido-texto").innerText()), `proximo '${proximo}': explica o motivo`);
    ok(await page.getByTestId("troca-sem-pedido-ajuda").count() === 1, `proximo '${proximo}': oferece pedir ajuda`); await T.browser.close();
  }
}
{ // comprovação: só a via "descrever outra prova"; nenhum código; três situações separadas
  const T = await nova({ respostas: { comprovar: [{ ok: true, etapa: "pedido_recebido" }] } }); const { page, reg, erros } = T; await abrir(page);
  await modal(page).getByTestId("ativacao-quero-comprovar").click(); await page.waitForTimeout(250);
  const f = await page.getByTestId("comprovar-dados").innerText();
  ok(/Nenhum código é enviado agora/.test(f) && !/mensagem direta|\bDM\b|X \(|desafio/i.test(f), "a tela diz que nenhum código é enviado e NÃO oferece mensagem direta/desafio no X");
  ok(await page.getByTestId("comprovar-exemplos").count() === 1 && /comprovante de um pagamento anterior/.test(await page.getByTestId("comprovar-exemplos").innerText()), "dá exemplos de outras provas");
  const enviar = () => modal(page).getByRole("button", { name: "Enviar para análise" }).click();
  await modal(page).getByLabel("Seu @ cadastrado").fill("ana"); await modal(page).getByLabel("E-mail do cadastro").fill("registrado@exemplo.com");
  await modal(page).getByLabel("Descreva outra prova").fill("curto"); await enviar(); await page.waitForTimeout(300);
  ok(/pelo menos 20 letras/.test(await corpo(page)) && reg.comprovar.length === 0, "descrição curta: recusada no navegador, nada enviado");
  await modal(page).getByLabel("Descreva outra prova").fill("Paguei o pedido da Smol em outubro; tenho o comprovante de R$ 120."); await enviar(); await page.waitForTimeout(300);
  ok(/Deixe um contato/.test(await corpo(page)) && reg.comprovar.length === 0, "sem contato: recusado no navegador (a administração precisa de um jeito de responder)");
  await modal(page).getByLabel("Contato para resposta").fill("whatsapp 11 90000-0000"); await enviar(); await page.waitForTimeout(500);
  const c = reg.comprovar[0];
  ok(reg.comprovar.length === 1 && c.cog === "ana" && c.email === "registrado@exemplo.com" && /^Paguei o pedido da Smol/.test(c.detalhe) && /\n\nContato: whatsapp 11 90000-0000$/.test(c.detalhe) && !("via" in c) && !("desafio" in c), "o pedido leva @, e-mail, a descrição e o contato; sem via de DM nem desafio");
  ok(await page.getByTestId("comprovar-recebido").count() === 1, "tela final: descrição enviada");
  const r = await page.getByTestId("comprovar-recebido-texto").innerText();
  ok(/Se o @ e o e-mail conferirem/.test(r) && /Nenhum código foi enviado/.test(r) && /nada foi liberado ainda/.test(r), "texto condicional, sem afirmar envio de código nem liberação");
  ok(await estado(page, "situacao-email") === "nao" && await estado(page, "situacao-pedido") === "pendente" && await estado(page, "situacao-acesso") === "nao", "situação: e-mail NÃO verificado (–), descrição enviada (…), acesso NÃO liberado (–)");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : "")); await T.browser.close();
  for (const [etapa, id, texto] of [["pedir_codigo", "comprovar-pedir-codigo", /já pode receber o código/], ["entrar", "comprovar-entrar", /já tem conta/], ["limite_diario", "comprovar-ajuda", /pedidos demais/], ["ajuda", "comprovar-ajuda", /Peça ajuda/]]) {
    const U = await nova({ respostas: { comprovar: [{ ok: true, etapa }] } }); const p = U.page; await abrir(p);
    await modal(p).getByTestId("ativacao-quero-comprovar").click(); await modal(p).getByLabel("Seu @ cadastrado").fill("ana"); await modal(p).getByLabel("E-mail do cadastro").fill("registrado@exemplo.com");
    await modal(p).getByLabel("Descreva outra prova").fill("Paguei o pedido da Smol em outubro; tenho o comprovante."); await modal(p).getByLabel("Contato para resposta").fill("whatsapp 11 90000-0000");
    await modal(p).getByRole("button", { name: "Enviar para análise" }).click(); await p.waitForTimeout(500);
    ok(await p.getByTestId(`comprovar-etapa-${etapa}`).count() === 1 && texto.test(await p.getByTestId("comprovar-etapa-texto").innerText()) && await p.getByTestId(id).count() === 1, `etapa '${etapa}': mensagem e ação certas`);
    if (etapa === "pedir_codigo") { await p.getByTestId(id).click(); await p.waitForTimeout(300); ok(await modal(p).getByLabel("E-mail do cadastro").inputValue() === "registrado@exemplo.com" && await modal(p).getByRole("button", { name: "Enviar código de confirmação" }).count() === 1, "pedir o código volta ao formulário de ativação com o e-mail"); }
    await U.browser.close();
  }
  const E = await nova({ erro429: true }); await abrir(E.page); await modal(E.page).getByTestId("ativacao-quero-comprovar").click();
  await modal(E.page).getByLabel("Seu @ cadastrado").fill("ana"); await modal(E.page).getByLabel("E-mail do cadastro").fill("registrado@exemplo.com");
  await modal(E.page).getByLabel("Descreva outra prova").fill("Paguei o pedido da Smol em outubro; tenho o comprovante."); await modal(E.page).getByLabel("Contato para resposta").fill("whatsapp 11 90000-0000");
  await modal(E.page).getByRole("button", { name: "Enviar para análise" }).click(); await E.page.waitForTimeout(500);
  ok(/Muitas tentativas|Não foi possível enviar o seu pedido/.test(await corpo(E.page)) && await E.page.getByTestId("comprovar-recebido").count() === 0, "erro do servidor: mensagem e NÃO finge que o pedido foi enviado"); await E.browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
