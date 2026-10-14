// Teste de navegador do PRIMEIRO ACESSO / cadastro novo com o recurso LIGADO (API simulada, Playwright). Não toca no Supabase real.
// Pontos: o e-mail nunca serve para entrar; o cadastro vai pela função segura (solicitar_cadastro); nenhuma tabela privada é lida/gravada (joiners, pre_cadastros...).
// Uso: VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort   e depois   node tests/joiner-cadastro.e2e.mjs
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PORTA = 5197;

async function nova({ cadastro = { ok: true } } = {}) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem("anticeg_session_v", "5"); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); });
  const reg = { rpc: [], tabelas: [], functions: [] };
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url(), m = req.method();
    if (u.startsWith(`http://localhost:${PORTA}`)) return route.continue();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/functions/v1/")) { reg.functions.push(new URL(u).pathname.split("/").pop()); return json(200, {}); }
    if (u.includes("supabase.co/auth/v1/")) return json(200, {});
    if (u.includes("/rest/v1/rpc/")) {
      const nome = new URL(u).pathname.split("/").pop(); const corpo = JSON.parse(req.postData() || "{}"); reg.rpc.push({ nome, corpo });
      if (nome === "solicitar_cadastro") return json(200, cadastro);
      if (nome === "entrar_com_arroba") {
        const h = String(corpo.p_identificador || "").replace(/^@+/, "").toLowerCase();
        return json(200, ["ana", "novapessoa"].includes(h) ? { encontrado: true, cog: h, nome_site: h, foto_perfil: null, conta_ativa: h === "ana" } : { encontrado: false });
      }
      if (nome === "resolver_recrutador") return json(200, String(corpo.p_texto).replace(/^@/, "") === "ana" ? { cog: "ana", nome: "Ana" } : null);
      return json(200, null);
    }
    if (u.includes("supabase.co/rest/v1/")) {
      const tabela = new URL(u).pathname.split("/").pop(); reg.tabelas.push(m + " " + tabela);
      const objeto = (req.headers()["accept"] || "").includes("pgrst.object");
      return route.fulfill({ status: 200, contentType: "application/json", body: objeto ? "{}" : "[]", headers: { "content-range": "*/0" } });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
  return { browser, page, reg, erros };
}
const PRIVADAS = ["joiners", "pre_cadastros", "masterlist", "pagamento_demandas", "multas_pagas", "envio_solicitacoes", "grupos_envio", "push_subscriptions"];
const tocouPrivada = tabs => tabs.filter(x => PRIVADAS.some(tb => x.split(" ")[1] === tb));
const corpo = page => page.locator("body").innerText();
const preencher = async (page, { nome = "", cog = "", email = "", rec = "" }) => {
  await page.getByPlaceholder("nome para a claim").fill(nome); await page.getByPlaceholder("@ da rede social (sem @)").fill(cog);
  await page.getByPlaceholder("e-mail").fill(email); await page.getByPlaceholder(/@ de quem te indicou/).fill(rec);
};
const continuar = async page => { await page.getByRole("button", { name: /CONTINUAR/ }).click(); await page.waitForTimeout(1200); };

// 1) só e-mail: nunca entra
{
  const T = await nova(); const { page, reg } = T;
  await page.goto(`http://localhost:${PORTA}/primeiro-acesso`, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await preencher(page, { email: "ana@exemplo.com" }); await continuar(page);
  ok((await corpo(page)).includes("Digite o seu @") && reg.rpc.every(r => r.nome !== "entrar_com_arroba" && r.nome !== "solicitar_cadastro") && tocouPrivada(reg.tabelas).length === 0, "só com e-mail: NÃO entra, não cria nada e nenhuma tabela privada é consultada");
  await T.browser.close();
}
// 2) conta existente: só o @ -> acesso simples (sem criar cadastro, sem ler dados)
{
  const T = await nova(); const { page, reg, erros } = T;
  await page.goto(`http://localhost:${PORTA}/primeiro-acesso`, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await preencher(page, { cog: "@Ana", email: "ana@exemplo.com" }); await continuar(page);
  ok(reg.rpc.every(r => r.nome !== "solicitar_cadastro") && reg.rpc.some(r => r.nome === "entrar_com_arroba"), "@ + e-mail sem nome: entra pelo @ (acesso simples) e NÃO pede cadastro");
  ok(tocouPrivada(reg.tabelas).length === 0, "conta existente: nenhuma tabela privada é lida (a conta só é ativada pelo código enviado ao e-mail)");
  const guardado = JSON.parse(await page.evaluate(() => localStorage.getItem("anticeg_user_v2")) || "{}");
  ok(guardado.cog === "ana" && !("email" in guardado) && !("cpf" in guardado), "o navegador guarda só a identidade mínima");
  ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? ": " + erros[0] : ""));
  await T.browser.close();
}
// 3) cadastro novo: vai pela função segura e entra em acesso simples
{
  const T = await nova(); const { page, reg } = T;
  await page.goto(`http://localhost:${PORTA}/primeiro-acesso`, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await preencher(page, { nome: "Nova Pessoa", cog: "@novapessoa", email: "Nova@Exemplo.com", rec: "@ana" }); await continuar(page);
  const sc = reg.rpc.find(r => r.nome === "solicitar_cadastro");
  ok(!!sc && sc.corpo.p_cog === "novapessoa" && sc.corpo.p_email === "nova@exemplo.com" && sc.corpo.p_nome === "Nova Pessoa" && sc.corpo.p_recrutador === "@ana", "cadastro novo chama solicitar_cadastro com os dados (e-mail em minúsculas)");
  ok(tocouPrivada(reg.tabelas).length === 0, "cadastro novo: NENHUM insert/select direto em joiners ou pre_cadastros: " + JSON.stringify(tocouPrivada(reg.tabelas)));
  ok(reg.functions.every(f => f !== "send-email"), "não usa mais a função antiga send-email");
  const guardado = JSON.parse(await page.evaluate(() => localStorage.getItem("anticeg_user_v2")) || "{}");
  ok(guardado.cog === "novapessoa" && guardado.acesso_simples === true, "depois do pedido entra em acesso simples (o pop-up de ativação cuida do resto)");
  await T.browser.close();
}
// 4) o servidor recusa
for (const [motivo, texto] of [["recrutador_invalido", "Recrutador não encontrado"], ["tente_mais_tarde", "Muitos pedidos"], ["dados_invalidos", "Confira os dados"]]) {
  const T = await nova({ cadastro: { ok: false, motivo } }); const { page, reg } = T;
  await page.goto(`http://localhost:${PORTA}/primeiro-acesso`, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await preencher(page, { nome: "Nova Pessoa", cog: "novapessoa", email: "nova@exemplo.com" }); await continuar(page);
  ok((await corpo(page)).includes(texto) && reg.rpc.every(r => r.nome !== "entrar_com_arroba"), `servidor recusa (${motivo}): mostra "${texto}" e não entra`);
  await T.browser.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
