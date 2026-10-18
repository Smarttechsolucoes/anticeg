# Atualiza e amplia os testes do envio para o autoatendimento (ENV2). Uso único.
import os
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
def ler(p): return open(os.path.join(RAIZ, p), encoding="utf-8").read()
def gravar(p, s): open(os.path.join(RAIZ, p), "w", encoding="utf-8").write(s)
def rep(s, a, b, n=1):
    assert s.count(a) == n, (a[:80], s.count(a)); return s.replace(a, b)

s = ler("tests/envio-acesso.e2e.mjs")
s = rep(s, 'const reg = { envioReq: [], escritas: [], uploads: [], rpc: [], alerts: [], joinersGet: [], joinersWrite: [] };', 'const reg = { envioReq: [], escritas: [], uploads: [], rpc: [], alerts: [], joinersGet: [], joinersWrite: [], funcoes: [] };')
s = rep(s, '    if (u.includes("/rest/v1/joiners")) {', '''    if (u.includes("/functions/v1/envio-acesso")) {
      if (m === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }, body: "ok" });
      let c = {}; try { c = JSON.parse(req.postData() || "{}"); } catch { /* ignora */ } reg.funcoes.push(c);
      const CORS = { "access-control-allow-origin": "*" };
      if (c.acao === "pedir") return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify({ ok: true, mensagem: "Se este @ tem e-mail cadastrado, enviamos um código de 6 dígitos para esse e-mail." }) });
      if (c.acao === "validar") return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(c.codigo === "123456" ? { ok: true, token: TOKEN } : { ok: false, erro: "Código inválido ou expirado. Confira o e-mail ou peça um código novo." }) });
      return route.fulfill({ status: 400, contentType: "application/json", headers: CORS, body: "{}" });
    }
    if (u.includes("/rest/v1/joiners")) {''')
s = rep(s, '      if (nome === "envio_salvar_dados") return json(200, true);', '      if (nome === "envio_salvar_dados") return json(200, true);\n      if (nome === "envio_sair") return json(200, true);')
s = rep(s, '  ok(txt.includes("LINK PESSOAL") && txt.includes("Pedir meu link pelo WhatsApp"), "sem link: a aba pede o link pessoal e oferece pedir pelo WhatsApp");',
           '  ok(txt.includes("CONFIRMAR O SEU ACESSO") && txt.includes("Enviar código ao meu e-mail") && !txt.includes("Pedir meu link") && !txt.includes("registrado@exemplo.com"), "sem acesso: a aba oferece o código por e-mail (sem WhatsApp, sem link manual) e não mostra e-mail");')
s = rep(s, 'ok(!txt.includes("LINK PESSOAL") && txt.includes("Envio Nacional") && txt.includes("Minhas Solicitações"), "link válido: o envio abre (conferência, pedir envio e minhas solicitações)");',
           'ok(!txt.includes("CONFIRMAR O SEU ACESSO") && txt.includes("Envio Nacional") && txt.includes("Minhas Solicitações"), "acesso válido: o envio abre (conferência, pedir envio e minhas solicitações)");')
s = rep(s, 'ok(txt.includes("pertence a outra joiner") && T.reg.envioReq', 'ok(txt.includes("acesso de outra joiner") && txt.includes("CONFIRMAR O SEU ACESSO") && T.reg.envioReq')
s = rep(s, 'ok((await corpo(T.page)).includes("não está mais válido") && T.reg.envioReq', 'ok((await corpo(T.page)).includes("O seu acesso venceu") && T.reg.envioReq')
s = rep(s, 'ok(!(await corpo(T.page)).includes("LINK PESSOAL"), "pacote do banco ainda não aplicado', 'ok(!(await corpo(T.page)).includes("CONFIRMAR O SEU ACESSO"), "pacote do banco ainda não aplicado')
novo = '''// ── 7) AUTOATENDIMENTO: código no e-mail cadastrado, sem login e senha, sem WhatsApp
{
  const T = await nova({ solicitacoes: [SOL()] }); await ir(T.page, "/envio");
  ok((await corpo(T.page)).includes("CONFIRMAR O SEU ACESSO") && (await corpo(T.page)).includes("@ana"), "autoatendimento: a aba mostra o @ da sessão e oferece o código (o @ sozinho não abre nada)");
  ok(T.reg.envioReq.filter(r => r.tabela !== "envio_solicitacoes").length === 0, "autoatendimento: antes do código nenhuma tabela de envio é consultada");
  await T.page.getByRole("button", { name: /Enviar código ao meu e-mail/ }).click(); await T.page.waitForTimeout(700);
  ok(T.reg.funcoes.length === 1 && T.reg.funcoes[0].acao === "pedir" && T.reg.funcoes[0].cog === "ana" && Object.keys(T.reg.funcoes[0]).sort().join() === "acao,cog", "autoatendimento: o pedido leva só {acao, cog}; nada de e-mail ou telefone trafega do navegador");
  const txt = await corpo(T.page);
  ok(txt.includes("enviamos um código de 6 dígitos") && /Reenviar código \\(\\d+s\\)/.test(txt), "autoatendimento: mensagem neutra e reenvio com espera");
  ok(!/[A-Za-z0-9._-]+@[A-Za-z0-9-]+\\.[a-z]{2,}/.test(txt), "autoatendimento: nenhum e-mail aparece na tela antes da confirmação");
  await T.page.getByLabel("Código de 6 dígitos").fill("000000"); await T.page.getByRole("button", { name: /Confirmar/ }).click(); await T.page.waitForTimeout(600);
  ok((await corpo(T.page)).includes("Código inválido ou expirado") && T.reg.envioReq.filter(r => r.tabela !== "envio_solicitacoes").length === 0 && !(await T.page.evaluate(() => Object.values(localStorage).includes("0123456789abcdef".repeat(3)))), "código errado: mensagem genérica, nenhum acesso concedido");
  await T.page.getByLabel("Código de 6 dígitos").fill("123 456"); await T.page.getByRole("button", { name: /Confirmar/ }).click(); await T.page.waitForTimeout(1800);
  ok(T.reg.funcoes.at(-1).acao === "validar" && T.reg.funcoes.at(-1).codigo === "123456", "código certo: o navegador envia só {acao, cog, codigo}");
  ok((await corpo(T.page)).includes("Minhas Solicitações") && !(await corpo(T.page)).includes("CONFIRMAR O SEU ACESSO"), "código certo: o Envio Nacional abre sozinho, sem a equipe");
  ok(T.reg.rpc.some(r => r.nome === "envio_meu_acesso" && r.token === TOKEN) && T.reg.envioReq.length > 0 && T.reg.envioReq.slice(-3).every(r => r.token === TOKEN), "depois do código, as consultas passam a levar o acesso");
  await T.page.getByRole("button", { name: /Sair deste acesso/ }).click(); await T.page.waitForTimeout(800);
  ok(T.reg.rpc.some(r => r.nome === "envio_sair" && r.token === TOKEN) && (await corpo(T.page)).includes("CONFIRMAR O SEU ACESSO") && !(await T.page.evaluate(() => Object.values(localStorage).includes("0123456789abcdef".repeat(3)))), "sair: o acesso é revogado no servidor e apagado deste aparelho");
  ok(T.erros.length === 0, "autoatendimento: nenhum erro de JavaScript" + (T.erros[0] ? ": " + T.erros[0] : ""));
  await T.browser.close();
}
'''
s = rep(s, "// ── 6) JOINERS1", novo + "// ── 6) JOINERS1")
gravar("tests/envio-acesso.e2e.mjs", s)

t = ler("tests/envio-acesso.test.mjs")
t += '''
// ---- ENV2: autoatendimento por código no e-mail
test("salvar: só aceita token válido e fica disponível em seguida", () => {
  const arm = armazenamentoFalso(); const g = criarGuardaToken({ armazenamento: arm, janela: null });
  assert.equal(g.salvar("lixo"), false); assert.equal(g.ler(), null);
  assert.equal(g.salvar(TOKEN), true); assert.equal(g.ler(), TOKEN); assert.equal(arm.getItem(CHAVE_TOKEN), TOKEN);
});
test("a porta do Envio usa o código do e-mail e não depende de WhatsApp nem de link distribuído", () => {
  assert.ok(app.includes("function EnvioAcessoPorCodigo(") && app.includes("functions.invoke(\\"envio-acesso\\"") && app.includes("salvarTokenEnvio(t)"));
  assert.equal(app.includes("Pedir meu link pelo WhatsApp"), false);
  assert.equal(/user-email">\\{user\\.email/.test(app), false);
});
'''
gravar("tests/envio-acesso.test.mjs", t)
print("testes atualizados")
