// TESTE REAL do fluxo por link em PRODUÇÃO com DADOS ISOLADOS (joiner sintética zz_teste_envio). Nenhuma joiner real é tocada; nenhuma cobrança; funções (e-mail/push), Apps Script e ViaCEP são bloqueados.
// Cria os dados de teste, valida a segurança pela API real (cabeçalho do link), roda o fluxo no navegador (pedir envio, escolher modalidade, anexar comprovante) e SEMPRE limpa no final.
// Uso: node tests/envio-link-real.mjs [--site https://anticeg.vercel.app] [--pasta <dir temporário FORA do repositório>]
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const a = process.argv.slice(2); const val = f => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };
const SITE = (val("--site") || "https://anticeg.vercel.app").replace(/\/$/, ""); const PASTA = val("--pasta"); if (!PASTA) { console.error("informe --pasta"); process.exit(2); }
mkdirSync(PASTA, { recursive: true });
const REF = "ghjfsmwwcfpfvrouyrka"; const API = `https://${REF}.supabase.co`; const COG = "zz_teste_envio";
const fonte = readFileSync(new URL("../src/supabase.js", import.meta.url), "utf8"); const CHAVE = fonte.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0];
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK    " : "FALHA ") + m); if (!c) falhas++; };
const cli = (...args) => execFileSync("npx", ["supabase", ...args], { encoding: "utf8", shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] });
let n = 0;
function sql(texto) { const arq = join(PASTA, `q${++n}.sql`); writeFileSync(arq, texto); const r = cli("db", "query", "--linked", "--project-ref", REF, "-o", "json", "-f", arq); const j = r.slice(r.indexOf("{"), r.lastIndexOf("}") + 1); return JSON.parse(j).rows; }
const H = (token) => ({ apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json", ...(token ? { "x-envio-token": token } : {}) });
const rest = async (path, { metodo = "GET", token, corpo, prefer } = {}) => { const r = await fetch(API + path, { method: metodo, headers: { ...H(token), ...(prefer ? { Prefer: prefer } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* ignora */ } return { st: r.status, j, t }; };

let roundId = null, token = null, solId = null, arquivoPrivado = null;
try {
  // ── dados isolados
  sql(`insert into public.joiners (cog, nome, email, twitter, whatsapp, confirmado) values ('${COG}', 'Teste Envio (apagar)', 'teste-envio@exemplo.com', '@${COG}', null, true);
       insert into public.joiner_storage (joiner_cog, foto_url, descricao, ativo) values ('${COG}', 'https://exemplo.com/teste.png', 'ITEM DE TESTE (apagar)', true);`);
  token = sql(`select emergencia.gerar_acesso_envio('${COG}', 1, 'teste isolado') as t`)[0].t;
  roundId = sql(`insert into public.envio_rounds (numero, status) values ((select coalesce(max(numero), 0) + 1 from public.envio_rounds), 'em_processo') returning id`)[0].id;
  sql(`insert into public.envio_requests (joiner_cog, round_id, posicao_no_round, status) values ('${COG}', ${roundId}, 1, 'aguardando')`);
  ok(/^[0-9a-f]{48}$/.test(token), "dados isolados criados (joiner de teste, item de storage, link de 1 dia, rodada liberada)");

  // ── API real: o cabeçalho do link chega ao banco?
  let r = await rest(`/rest/v1/envio_requests?select=id&joiner_cog=eq.${COG}`);
  ok(r.st === 200 && r.j.length === 0, "API real, sem link: nenhuma linha (visitante)");
  r = await rest(`/rest/v1/envio_requests?select=id,joiner_cog`, { token });
  ok(r.st === 200 && r.j.length === 1 && r.j[0].joiner_cog === COG, "API real, com o link de teste: o banco reconhece o cabeçalho e devolve SÓ a linha da joiner de teste");
  r = await rest(`/rest/v1/envio_requests?select=id`, { token: "0".repeat(48) });
  ok(r.st === 200 && r.j.length === 0, "API real, link falso: nenhuma linha");
  r = await rest(`/rest/v1/rpc/envio_meu_acesso`, { metodo: "POST", token, corpo: {} });
  ok(r.st === 200 && r.j?.cog === COG, "API real: envio_meu_acesso identifica a joiner pelo link");
  r = await rest(`/rest/v1/rpc/envio_meu_acesso`, { metodo: "POST", corpo: {} });
  ok(r.st === 200 && r.j === null, "API real: sem link o servidor não identifica ninguém");
  r = await rest(`/rest/v1/envio_solicitacoes?select=id&limit=5`, { token });
  ok(r.st === 200 && r.j.length === 0, "API real: o link de teste não enxerga as solicitações das joiners reais");
  r = await rest(`/rest/v1/envio_solicitacoes`, { metodo: "POST", token, prefer: "return=representation", corpo: { joiner_cog: "starsceg", joiner_nome: "x", destinatario: "x", cpf: "0", cep: "0", endereco: "x", numero: "1", bairro: "x", cidade: "x", estado: "SP", itens: [], metodo: "PAC", seguro: "nao", status: "solicitação de envio" } });
  ok(r.st >= 400, "API real: o link de teste NÃO consegue criar solicitação para outra joiner (HTTP " + r.st + ")");
  r = await rest(`/rest/v1/rastreios?select=id&limit=1`, { token });
  ok(r.st >= 400, "API real: rastreios continua negado mesmo com link (HTTP " + r.st + ")");
  r = await rest(`/rest/v1/joiners?select=cpf&limit=1`, { token });
  ok(r.st >= 400, "API real: CPF de joiners continua negado ao visitante mesmo com link (HTTP " + r.st + ")");

  // ── navegador real: pedir envio, escolher modalidade, anexar comprovante
  const publico = (await rest(`/rest/v1/joiners?select=id,cog,nome,email,twitter,whatsapp,foto_perfil,last_seen,bloqueado,confirmado,last_notified_at,saldo_cashback,nome_site,telefone,recrutador&cog=eq.${COG}&limit=1`)).j[0];
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  await ctx.addInitScript(([u]) => { localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_at_v2", String(Date.now())); localStorage.setItem("anticeg_session_v", "4"); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1"); }, [publico]);
  const reg = { bloqueados: [], negados: [], escritas: [] };
  const RPC_OK = /\/rest\/v1\/rpc\/(envio_meu_acesso|envio_meus_dados|envio_solicitar_rodada|envio_grupo_por_codigo)$/;
  await ctx.route("**/*", route => {
    const rq = route.request(), u = rq.url(), m = rq.method(), h = rq.headers();
    if (u.includes("script.google.com") || u.includes("/functions/v1/") || u.includes("viacep.com.br")) { reg.bloqueados.push(`${m} ${u.split("?")[0].slice(0, 80)}`); return route.abort(); }
    if (u.startsWith(API) && !["GET", "HEAD", "OPTIONS"].includes(m)) {
      const comToken = h["x-envio-token"] === token, p = u.replace(API, "").split("?")[0];
      const permitido = (m === "PATCH" && u.includes(`/rest/v1/joiners?cog=eq.${COG}`)) ||
        (comToken && ((RPC_OK.test(p)) || /^\/rest\/v1\/(envio_solicitacoes|joiner_conferencias|envio_requests|grupos_envio)$/.test(p) || /^\/storage\/v1\/object\/envio-comprovantes\//.test(p)));
      if (!permitido) { reg.bloqueados.push(`${m} ${p}`); return route.fulfill({ status: 204, body: "" }); }
      reg.escritas.push(`${m} ${p}`);
    }
    return route.continue();
  });
  const page = await ctx.newPage(); const erros = []; const dialogos = [];
  page.on("pageerror", e => erros.push(String(e).slice(0, 160))); page.on("dialog", async d => { dialogos.push(d.message()); await d.dismiss(); });
  page.on("response", resp => { if (resp.url().startsWith(API) && resp.status() >= 400 && resp.request().method() !== "OPTIONS" && !resp.url().includes("admin_pin")) reg.negados.push(`${resp.status()} ${resp.request().method()} ${resp.url().replace(API, "").slice(0, 100)}`); });
  const corpo = () => page.locator("body").innerText();
  const fechaAviso = async () => { const b = page.getByRole("button", { name: /OK, ENTENDI/ }); if (await b.count()) { await b.first().dispatchEvent("click").catch(() => {}); await page.waitForTimeout(400); } };
  await page.goto(`${SITE}/envio?acesso=${token}`, { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(2000); await fechaAviso();
  ok(!(await corpo()).includes("LINK PESSOAL") && (await corpo()).includes("Pedir Envio"), "navegador real: o link de teste abre o Envio Nacional");
  if (!(await corpo()).includes("Pedir Envio")) console.log("   [diagnóstico] tela:", (await corpo()).replace(/\s+/g, " ").slice(0, 500), "| negados:", JSON.stringify(reg.negados.slice(0, 5)), "| erros:", JSON.stringify(erros.slice(0, 3)));
  ok(!(await page.evaluate(() => location.href)).includes("acesso="), "navegador real: o token saiu da barra de endereço");

  await page.getByRole("button", { name: /Pedir Envio/ }).dispatchEvent("click"); await page.waitForTimeout(800);
  ok(!(await corpo()).includes("Formulário fechado"), "navegador real: rodada liberada abre o formulário (sem senha)");
  if ((await page.locator("input").count()) === 0) console.log("   [diagnóstico] sem campos. tela:", (await corpo()).replace(/\s+/g, " ").slice(0, 700), "| negados:", JSON.stringify(reg.negados.slice(0, 6)), "| erros:", JSON.stringify(erros.slice(0, 3)));
  const campos = page.locator("input");
  await campos.nth(0).fill("Destinatario Teste"); await page.locator('input[placeholder="000.000.000-00"]').fill("00000000000"); await page.locator('input[placeholder="00000-000"]').fill("01001000");
  await page.waitForTimeout(500);
  const total = await campos.count(); void total;
  const rua = page.locator("input").nth(3); await rua.fill("Rua de Teste"); await page.locator("input").nth(4).fill("1"); await page.locator("input").nth(6).fill("Bairro Teste"); await page.locator("input").nth(7).fill("Cidade Teste");
  await page.locator("select").nth(0).selectOption("SP"); await page.locator("select").nth(1).selectOption({ label: "Correios" });
  await page.getByRole("button", { name: "Não", exact: true }).click();
  for (const t of ["Confirmo que revisei", "não se responsabiliza por dados incorretos", "serão enviados todos os itens", "não será possível incluir itens"]) await page.getByText(t, { exact: false }).first().click();
  await page.getByRole("button", { name: /SOLICITAR ENVIO/ }).click(); await page.waitForTimeout(2500);
  const linhas = sql(`select id, status, joiner_cog, cpf is not null cpf_ok, cotacao_valor is null sem_cotacao, comprovante_url is null sem_comp from public.envio_solicitacoes where joiner_cog = '${COG}'`);
  ok(linhas.length === 1 && linhas[0].status === "solicitação de envio" && linhas[0].sem_cotacao && linhas[0].sem_comp, "navegador real: a solicitação foi criada pelo link, com status inicial e sem cotação nem comprovante");
  solId = linhas[0]?.id;

  // a administração (aqui, o acesso direto ao banco) cota
  sql(`update public.envio_solicitacoes set cotacao_opcoes = '[{"forma":"PAC","valor":"20","prazo":"8 dias"},{"forma":"SEDEX","valor":"40","prazo":"3 dias"}]'::jsonb, cotacao_valor = '20,00', status = 'pagamento em aberto' where id = ${solId} and joiner_cog = '${COG}'`);
  await page.goto(`${SITE}/envio`, { waitUntil: "networkidle" }); await page.waitForTimeout(1800); await fechaAviso();
  await page.getByRole("button", { name: /Minhas Solicitações/ }).dispatchEvent("click"); await page.waitForTimeout(700);
  if (!(await page.getByText("PGTO. EM ABERTO").count())) console.log("   [diagnóstico] lista:", (await corpo()).replace(/\s+/g, " ").slice(-700), "| negados:", JSON.stringify(reg.negados.slice(0, 5)));
  await page.getByText("PGTO. EM ABERTO").first().click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: /PAC/ }).first().click(); await page.getByRole("button", { name: /Confirmar modalidade/ }).click(); await page.waitForTimeout(1800);
  let est = sql(`select modalidade_escolhida->>'forma' forma, status from public.envio_solicitacoes where id = ${solId}`)[0];
  ok(est.forma === "PAC" && est.status === "pagamento em aberto", "navegador real: a joiner escolheu a modalidade cotada (PAC)");

  // comprovante (arquivo de teste), bucket privado
  await page.goto(`${SITE}/envio`, { waitUntil: "networkidle" }); await page.waitForTimeout(1500); await fechaAviso();
  await page.getByRole("button", { name: /Minhas Solicitações/ }).dispatchEvent("click"); await page.waitForTimeout(600);
  await page.getByText("PGTO. EM ABERTO").first().click(); await page.waitForTimeout(500);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "teste.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% comprovante de TESTE (apagar)\n") });
  await page.getByRole("button", { name: /Enviar comprovante/ }).click(); await page.waitForTimeout(3000);
  est = sql(`select comprovante_url from public.envio_solicitacoes where id = ${solId}`)[0];
  arquivoPrivado = est.comprovante_url;
  ok(/^\d+\/comprovante_\d{10,}\.pdf$/.test(arquivoPrivado || ""), "navegador real: comprovante anexado; no banco fica só o caminho do bucket privado (" + arquivoPrivado + ")");
  const obj = sql(`select count(*)::int n from storage.objects where bucket_id = 'envio-comprovantes' and name = '${arquivoPrivado}'`)[0].n;
  ok(obj === 1, "navegador real: o arquivo existe no bucket privado envio-comprovantes");
  const pub = await fetch(`${API}/storage/v1/object/public/envio-comprovantes/${arquivoPrivado}`);
  ok(pub.status >= 400, "o comprovante NÃO abre por link público (HTTP " + pub.status + ")");

  // cancelamento e travas pela API real
  r = await rest(`/rest/v1/envio_solicitacoes?id=eq.${solId}`, { metodo: "PATCH", token, corpo: { status: "enviado" } });
  ok(r.st >= 400, "API real: a joiner NÃO consegue marcar a própria solicitação como enviada (HTTP " + r.st + ")");
  r = await rest(`/rest/v1/envio_solicitacoes?id=eq.${solId}`, { metodo: "PATCH", token, corpo: { modalidade_escolhida: { forma: "PAC", valor: "0,01", prazo: "8 dias" } } });
  ok(r.st >= 400, "API real: a joiner NÃO consegue adulterar o preço da modalidade (HTTP " + r.st + ")");
  r = await rest(`/rest/v1/envio_solicitacoes?id=eq.${solId}`, { metodo: "PATCH", token, prefer: "return=representation", corpo: { status: "cancelado" } });
  ok(r.st === 200 && r.j?.[0]?.status === "cancelado", "API real: a joiner cancela a própria solicitação de teste");

  ok(erros.length === 0, "navegador real: nenhum erro de JavaScript" + (erros[0] ? ": " + erros[0] : ""));
  ok(reg.negados.length === 0, "navegador real: nenhuma requisição negada" + (reg.negados[0] ? ": " + reg.negados.slice(0, 4).join(" | ") : ""));
  console.log("   escritas feitas pelo navegador:", reg.escritas.length, "| bloqueadas pela guarda:", JSON.stringify(reg.bloqueados.slice(0, 6)), "| avisos na tela:", JSON.stringify(dialogos.slice(0, 3)));
  await browser.close();
} catch (e) {
  console.log("ERRO NO TESTE:", String(e.message || e).slice(0, 400)); falhas++;
} finally {
  // ── limpeza SEMPRE
  try {
    if (arquivoPrivado) { try { cli("storage", "rm", "--linked", "--experimental", "--yes", "--project-ref", REF, `ss:///envio-comprovantes/${arquivoPrivado}`); } catch (e) { console.log("aviso: remover arquivo de teste falhou:", String(e.message).slice(0, 120)); } }
    sql(`delete from public.envio_solicitacoes where joiner_cog = '${COG}';
         delete from public.joiner_storage where joiner_cog = '${COG}';
         delete from public.joiner_conferencias where joiner_cog = '${COG}';
         delete from public.envio_requests where joiner_cog = '${COG}';
         delete from public.grupos_envio where host_cog = '${COG}';
         ${roundId ? `delete from public.envio_rounds where id = ${roundId} and not exists (select 1 from public.envio_requests where round_id = ${roundId});` : ""}
         delete from emergencia.envio_acessos where joiner_cog = '${COG}';
         delete from public.joiners where cog = '${COG}';`);
    const resto = sql(`select (select count(*) from public.joiners where cog = '${COG}') j, (select count(*) from public.envio_solicitacoes where joiner_cog = '${COG}') s, (select count(*) from emergencia.envio_acessos where joiner_cog = '${COG}') t, (select count(*) from public.envio_rounds where id = ${roundId || 0}) r`)[0];
    ok(Object.values(resto).every(v => Number(v) === 0), "limpeza: nenhum dado de teste restou " + JSON.stringify(resto));
  } catch (e) { console.log("ERRO NA LIMPEZA (rode TESTE_ISOLADO_limpar.sql):", String(e.message || e).slice(0, 300)); falhas++; }
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nFLUXO POR LINK (REAL, DADOS ISOLADOS): TUDO CONFORME");
process.exit(falhas ? 1 : 0);
