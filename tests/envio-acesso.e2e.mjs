// Teste de NAVEGADOR (Playwright, API do Supabase SIMULADA: nenhuma rede real, nenhuma cobrança, nenhum envio real) do Envio Nacional por link pessoal.
// Uso:  npx vite --port 5301 --strictPort   (outro terminal)  e depois:  node tests/envio-acesso.e2e.mjs
import { chromium } from "playwright";
const PORTA = 5301;
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const TOKEN = "0123456789abcdef".repeat(3);
const ANA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", email: "registrado@exemplo.com", twitter: "@ana", confirmado: true };
const DADOS = { nome: "Ana Lima", nome_entrega: "Ana Lima", cpf: "12345678901", cep: "01001000", rua: "Praca da Se", numero: "10", bairro: "Se", cidade: "Sao Paulo", estado: "SP", twitter: "@ana" };
const OPCOES = [{ forma: "PAC", valor: "20", prazo: "8 dias" }, { forma: "SEDEX", valor: "40", prazo: "3 dias" }];
const SOL = (extra = {}) => ({ id: 77, created_at: new Date().toISOString(), joiner_cog: "ana", joiner_nome: "Ana Lima", destinatario: "Ana Lima", itens: [{ nome: "Foto 1", ceg: "Storage GOM" }], metodo: "PAC", seguro: "nao",
  status: "pagamento em aberto", cotacao_opcoes: OPCOES, cotacao_valor: "20,00", cotacao_embalagem: null, modalidade_escolhida: null, comprovante_url: null, ...extra });

async function nova(cen) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript(([u]) => {
    localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_at_v2", String(Date.now())); localStorage.setItem("anticeg_session_v", "4");
    localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
  }, [ANA]);
  const reg = { envioReq: [], escritas: [], uploads: [], rpc: [], alerts: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method(), h = req.headers();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body, extra = {}) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "content-range": "*/0", ...extra } });
    if (!u.includes("supabase.co")) return route.fulfill({ status: 204, body: "" });
    const tabelaEnvio = /\/rest\/v1\/(envio_solicitacoes|grupos_envio|joiner_storage|envio_requests|envio_rounds|joiner_conferencias|rastreios)/.exec(u);
    if (tabelaEnvio) reg.envioReq.push({ tabela: tabelaEnvio[1], metodo: m, token: h["x-envio-token"] || null });
    if (u.includes("/rest/v1/rpc/")) {
      const nome = u.split("/rpc/")[1].split("?")[0]; reg.rpc.push({ nome, token: h["x-envio-token"] || null });
      if (nome === "envio_meu_acesso") return cen.acesso === "erro" ? json(404, { code: "PGRST202", message: "x" }) : json(200, cen.acesso === undefined ? { cog: "ana" } : cen.acesso);
      if (nome === "envio_meus_dados") return json(200, DADOS);
      if (nome === "envio_solicitar_rodada") return json(200, { id: 1, joiner_cog: "ana", status: "aguardando", envio_rounds: { numero: 1, status: "em_processo" } });
      return json(200, null);
    }
    if (u.includes("/storage/v1/object/")) { reg.uploads.push({ url: u, metodo: m, token: h["x-envio-token"] || null }); return json(200, { Key: "ok" }); }
    if (tabelaEnvio && m !== "GET") {
      let corpo = {}; try { corpo = JSON.parse(req.postData() || "{}"); } catch { /* ignora */ }
      reg.escritas.push({ tabela: tabelaEnvio[1], metodo: m, corpo, token: h["x-envio-token"] || null });
      if (cen.recusarEscrita) return json(403, { code: "42501", message: "Alteração não permitida" });
      return route.fulfill({ status: m === "POST" ? 201 : 204, contentType: "application/json", body: m === "POST" ? JSON.stringify([{ id: 99, ...corpo }]) : "" });
    }
    const objeto = (h["accept"] || "").includes("pgrst.object");
    if (u.includes("/rest/v1/envio_solicitacoes")) return json(200, cen.solicitacoes || []);
    if (u.includes("/rest/v1/envio_requests")) { const rq = { id: 1, joiner_cog: "ana", status: "aguardando", envio_rounds: { numero: 1, status: "em_processo" } }; return json(200, objeto ? rq : [rq]); }
    if (u.includes("/rest/v1/joiner_storage")) return json(200, [{ id: 1, joiner_cog: "ana", foto_url: "https://x/y.png", descricao: "Foto 1", ativo: true, created_at: new Date().toISOString() }]);
    if (u.includes("/rest/v1/joiners") && objeto) return json(200, ANA);
    return json(200, objeto ? {} : []);
  });
  const page = await ctx.newPage(); const erros = [];
  page.on("pageerror", e => erros.push(String(e))); page.on("dialog", async d => { reg.alerts.push(d.message()); await d.dismiss(); });
  return { browser, page, reg, erros, ctx };
}
const ir = async (page, caminho) => { await page.goto(`http://localhost:${PORTA}${caminho}`, { waitUntil: "networkidle" }); await page.waitForTimeout(1100); };
const corpo = page => page.locator("body").innerText();

// ── 1) sem link: porta fechada, nenhuma consulta às tabelas de envio
{
  const T = await nova({}); await ir(T.page, "/envio");
  const txt = await corpo(T.page);
  ok(txt.includes("LINK PESSOAL") && txt.includes("Pedir meu link pelo WhatsApp"), "sem link: a aba pede o link pessoal e oferece pedir pelo WhatsApp");
  ok(T.reg.envioReq.filter(r => r.tabela !== "envio_solicitacoes").length === 0 && T.reg.envioReq.every(r => r.token === null), "sem link: a aba não consulta nenhuma tabela de envio (só os contadores do perfil, sem token, que o banco responde vazio)");
  ok(T.erros.length === 0, "sem link: nenhum erro de JavaScript" + (T.erros[0] ? ": " + T.erros[0] : ""));
  await T.browser.close();
}
// ── 2) link válido: token capturado, URL limpa, cabeçalho em todas as consultas, formulário abre
{
  const T = await nova({ solicitacoes: [SOL()] }); await ir(T.page, `/envio?acesso=${TOKEN}`);
  ok(!(await T.page.evaluate(() => location.href)).includes("acesso="), "link válido: o token sai da barra de endereço");
  ok(await T.page.evaluate(() => Object.values(localStorage).includes("0123456789abcdef".repeat(3))), "link válido: o token fica guardado só neste aparelho");
  const txt = await corpo(T.page);
  ok(!txt.includes("LINK PESSOAL") && txt.includes("Envio Nacional") && txt.includes("Minhas Solicitações"), "link válido: o envio abre (conferência, pedir envio e minhas solicitações)");
  ok(T.reg.rpc.some(r => r.nome === "envio_meu_acesso" && r.token === TOKEN) && T.reg.rpc.some(r => r.nome === "envio_meus_dados" && r.token === TOKEN), "o servidor confere o acesso e entrega os dados de entrega salvos, com o token no cabeçalho");
  ok(T.reg.envioReq.length > 0 && T.reg.envioReq.every(r => r.token === TOKEN), "TODAS as consultas às tabelas de envio levam o token (" + T.reg.envioReq.length + ")");
  // 2b) escolher a modalidade
  await T.page.getByRole("button", { name: /Minhas Solicitações/ }).click(); await T.page.waitForTimeout(500);
  await T.page.getByText("PGTO. EM ABERTO").first().click(); await T.page.waitForTimeout(400);
  const botaoOpcao = T.page.getByRole("button", { name: /PAC/ }).first();
  if (await botaoOpcao.count()) {
    await botaoOpcao.click(); await T.page.getByRole("button", { name: /Confirmar modalidade/ }).click(); await T.page.waitForTimeout(600);
    const w = T.reg.escritas.find(e => e.tabela === "envio_solicitacoes" && e.metodo === "PATCH");
    ok(!!w && w.token === TOKEN && w.corpo.modalidade_escolhida?.forma === "PAC" && w.corpo.status === "pagamento em aberto" && Object.keys(w.corpo).sort().join() === "modalidade_escolhida,status", "escolher modalidade: só modalidade_escolhida e status, com o token");
  } else ok(false, "escolher modalidade: botão da modalidade não apareceu (a lista de solicitações não abriu)");
  ok(T.erros.length === 0, "link válido: nenhum erro de JavaScript" + (T.erros[0] ? ": " + T.erros[0] : ""));
  await T.browser.close();
}
// ── 2c) pedir o envio: dados vêm do servidor pelo token e a solicitação sai com o token
{
  const T = await nova({}); await ir(T.page, `/envio?acesso=${TOKEN}`);
  await T.page.getByRole("button", { name: /Pedir Envio/ }).click(); await T.page.waitForTimeout(700);
  const valores = await T.page.locator("input").evaluateAll(es => es.map(e => e.value));
  ok(valores.includes("12345678901") && valores.includes("01001000") && valores.includes("Praca da Se"), "pedir envio: CPF e endereço salvos vêm do SERVIDOR pelo token (não da leitura aberta de joiners)");
  ok(!(await corpo(T.page)).includes("Formulário fechado"), "pedir envio: rodada liberada pela equipe abre o formulário (sem senha)");
  await T.page.locator("select").nth(1).selectOption({ label: "Correios" });
  await T.page.getByRole("button", { name: "Não", exact: true }).click();
  for (const t of ["Confirmo que revisei", "não se responsabiliza por dados incorretos", "serão enviados todos os itens", "não será possível incluir itens"]) await T.page.getByText(t, { exact: false }).first().click();
  await T.page.getByRole("button", { name: /SOLICITAR ENVIO/ }).click(); await T.page.waitForTimeout(800);
  const w = T.reg.escritas.find(e => e.tabela === "envio_solicitacoes" && e.metodo === "POST");
  const c0 = Array.isArray(w?.corpo) ? w.corpo[0] : w?.corpo;
  ok(!!w && w.token === TOKEN && c0?.joiner_cog === "ana" && c0?.status === "solicitação de envio" && c0?.cpf === "12345678901", "solicitação criada com o token, para a própria joiner, status inicial correto");
  ok(!Object.keys(c0 || {}).some(k => k.startsWith("cotacao") || k.startsWith("rastreio") || k === "comprovante_url" || k === "modalidade_escolhida"), "a solicitação não carrega cotação, rastreio, comprovante nem modalidade (são da administração)");
  ok((await corpo(T.page)).includes("Solicitação enviada"), "a joiner vê a confirmação de que a solicitação foi recebida");
  ok(T.erros.length === 0, "pedir envio: nenhum erro de JavaScript" + (T.erros[0] ? ": " + T.erros[0] : ""));
  await T.browser.close();
}
// ── 3) comprovante: vai para o bucket PRIVADO e o banco guarda só o caminho
{
  const T = await nova({ solicitacoes: [SOL({ modalidade_escolhida: OPCOES[0] })] }); await ir(T.page, `/envio?acesso=${TOKEN}`);
  await T.page.getByRole("button", { name: /Minhas Solicitações/ }).click(); await T.page.waitForTimeout(500);
  await T.page.getByText("PGTO. EM ABERTO").first().click(); await T.page.waitForTimeout(400);
  const campo = T.page.locator('input[type="file"]').first();
  if (await campo.count()) {
    await campo.setInputFiles({ name: "pix.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 teste") });
    await T.page.getByRole("button", { name: /Enviar comprovante/ }).click(); await T.page.waitForTimeout(800);
    const up = T.reg.uploads.find(x => x.metodo === "POST");
    ok(!!up && /\/storage\/v1\/object\/envio-comprovantes\/77\/comprovante_\d{10,}\.pdf$/.test(up.url) && up.token === TOKEN, "comprovante: enviado ao bucket privado envio-comprovantes/<id>/comprovante_<hora>.pdf, com o token");
    const w = T.reg.escritas.find(e => e.tabela === "envio_solicitacoes" && e.metodo === "PATCH");
    ok(!!w && /^77\/comprovante_\d{10,}\.pdf$/.test(w.corpo.comprovante_url || ""), "comprovante: no banco fica só o caminho (nunca um link público)");
  } else ok(false, "comprovante: o campo de arquivo não apareceu");
  ok(T.erros.length === 0, "comprovante: nenhum erro de JavaScript" + (T.erros[0] ? ": " + T.erros[0] : ""));
  await T.browser.close();
}
// ── 4) o servidor recusa a escrita: a tela NÃO finge sucesso
{
  const T = await nova({ solicitacoes: [SOL()], recusarEscrita: true }); await ir(T.page, `/envio?acesso=${TOKEN}`);
  await T.page.getByRole("button", { name: /Minhas Solicitações/ }).click(); await T.page.waitForTimeout(500);
  await T.page.getByText("PGTO. EM ABERTO").first().click(); await T.page.waitForTimeout(400);
  const botaoOpcao = T.page.getByRole("button", { name: /SEDEX/ }).first();
  if (await botaoOpcao.count()) {
    await botaoOpcao.click(); await T.page.getByRole("button", { name: /Confirmar modalidade/ }).click(); await T.page.waitForTimeout(600);
    ok(T.reg.alerts.some(a => a.includes("Não foi possível confirmar a modalidade")) && !(await corpo(T.page)).includes("MODALIDADE CONFIRMADA"), "escrita recusada: a joiner recebe aviso e a tela não mostra a modalidade como confirmada");
  } else ok(false, "escrita recusada: botão da modalidade não apareceu");
  await T.browser.close();
}
// ── 5) link de outra joiner / link inválido / pacote do banco ainda não aplicado
{
  const T = await nova({ acesso: { cog: "outra_pessoa" } }); await ir(T.page, `/envio?acesso=${TOKEN}`);
  const txt = await corpo(T.page);
  ok(txt.includes("pertence a outra joiner") && T.reg.envioReq.filter(r => r.tabela !== "envio_solicitacoes").length === 0, "link de outra joiner: recusado, a aba não consulta as tabelas de envio");
  await T.browser.close();
}
{
  const T = await nova({ acesso: null }); await ir(T.page, `/envio?acesso=${TOKEN}`);
  ok((await corpo(T.page)).includes("não está mais válido") && T.reg.envioReq.filter(r => r.tabela !== "envio_solicitacoes").length === 0, "link vencido/revogado: mensagem clara e a aba não consulta as tabelas de envio");
  await T.browser.close();
}
{
  const T = await nova({ acesso: "erro" }); await ir(T.page, `/envio?acesso=${TOKEN}`);
  ok(!(await corpo(T.page)).includes("LINK PESSOAL"), "pacote do banco ainda não aplicado (PGRST202): quem tem link continua entrando (ordem de publicação segura)");
  await T.browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES DE NAVEGADOR PASSARAM");
process.exit(falhas ? 1 : 0);
