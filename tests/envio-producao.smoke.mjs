// TESTE REAL (produção, só leitura) com o @ da dona: abre as telas principais com a API VERDADEIRA e aponta qualquer erro de permissão ou de JavaScript.
// Guarda de escrita: TODA requisição que não seja leitura é BLOQUEADA, exceto o PATCH do last_seen do PRÓPRIO @ (autorizado). Funções (e-mail/push) e Apps Script são bloqueados.
// Uso:  node tests/envio-producao.smoke.mjs [--site https://anticeg.vercel.app] [--cog nandaverseo_c] [--token <48 hex>] [--saida relatorio.json]
//   com --token (link de TESTE de um joiner de teste): também abre /envio?acesso=... e confere o cabeçalho/estado (sem criar nada).
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
const a = process.argv.slice(2); const val = f => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };
const SITE = (val("--site") || "https://anticeg.vercel.app").replace(/\/$/, ""); const COG = val("--cog") || "nandaverseo_c"; const TOKEN = val("--token"); const SAIDA = val("--saida");
const fonte = readFileSync(new URL("../src/supabase.js", import.meta.url), "utf8");
const CHAVE = fonte.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0];
const REF = JSON.parse(Buffer.from(CHAVE.split(".")[1], "base64url").toString()).ref; const API = `https://${REF}.supabase.co`;
const COLUNAS = "id,cog,nome,email,twitter,whatsapp,foto_perfil,last_seen,bloqueado,confirmado,last_notified_at,saldo_cashback,nome_site,telefone,recrutador";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK    " : "FALHA ") + m); if (!c) falhas++; };

// o "login" por @: a mesma leitura que o site faz (colunas públicas), para montar a sessão local
const r = await fetch(`${API}/rest/v1/joiners?select=${COLUNAS}&cog=eq.${COG}&limit=1`, { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } });
const linhas = r.ok ? await r.json() : [];
ok(r.ok && linhas.length === 1, `login por @: leitura das colunas públicas de @${COG} (HTTP ${r.status})`);
if (!linhas.length) process.exit(1);
const usuario = linhas[0];

const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(([u]) => {
  localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_at_v2", String(Date.now())); localStorage.setItem("anticeg_session_v", "4");
  localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1");
}, [usuario]);
const rel = { negados: [], bloqueados: [], leituras: {}, escritasPermitidas: 0, erros: [], consoles: [] };
await ctx.route("**/*", route => {
  const req = route.request(), u = req.url(), m = req.method();
  if (u.includes("script.google.com") || u.includes("/functions/v1/")) { rel.bloqueados.push(`${m} ${u.split("?")[0].replace(API, "")}`); return route.abort(); }
  if (u.startsWith(API) && !["GET", "HEAD", "OPTIONS"].includes(m)) {
    let corpo = {}; try { corpo = JSON.parse(req.postData() || "{}"); } catch { /* ignora */ }
    const proprioLastSeen = m === "PATCH" && u.includes(`/rest/v1/joiners?cog=eq.${COG}`) && Object.keys(corpo).join() === "last_seen";
    if (proprioLastSeen) { rel.escritasPermitidas++; return route.continue(); }
    rel.bloqueados.push(`${m} ${u.split("?")[0].replace(API, "")} ${JSON.stringify(corpo).slice(0, 80)}`); return route.fulfill({ status: 204, body: "" });
  }
  return route.continue();
});
const page = await ctx.newPage();
page.on("pageerror", e => rel.erros.push(String(e).slice(0, 160)));
page.on("console", c => { if (c.type() === "error") rel.consoles.push(c.text().slice(0, 160)); });
page.on("response", resp => {
  const u = resp.url(); if (!u.startsWith(API)) return;
  const tab = (/\/rest\/v1\/([a-z_]+)/.exec(u) || /\/rpc\/([a-z_]+)/.exec(u) || /\/storage\/v1\/([a-z/]+)/.exec(u) || [])[1] || "outro";
  rel.leituras[tab] = (rel.leituras[tab] || 0) + 1;
  if (resp.status() >= 400 && resp.request().method() !== "OPTIONS") rel.negados.push(`${resp.status()} ${resp.request().method()} ${u.replace(API, "").slice(0, 110)}`);
});
const ir = async (caminho) => { await page.goto(SITE + caminho, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {}); await page.waitForTimeout(1800); };
const corpo = () => page.locator("body").innerText();

for (const [rotulo, caminho] of [["MASTERLIST", "/masterlist"], ["Disponíveis / Claims", "/disponiveis"], ["Claim", "/claim"], ["Meu Perfil", "/perfil"], ["CEGs", "/cegs"]]) {
  const antes = rel.erros.length; await ir(caminho);
  const txt = await corpo();
  ok(txt.length > 200 && rel.erros.length === antes, `${rotulo} (${caminho}): abre e não gera erro de JavaScript`);
}
// Perfil → Endereço
await ir("/perfil");
const botaoEnd = page.getByRole("button", { name: /Endere/ }).first();
if (await botaoEnd.count()) { await botaoEnd.click(); await page.waitForTimeout(800); const t = await corpo(); ok(t.includes("ficam protegidos") || t.includes("SALVAR ENDEREÇO") || t.includes("Endereço de entrega"), "Perfil → Endereço: mostra o aviso de proteção (ou o formulário, com link)"); } else ok(false, "Perfil → Endereço: botão não encontrado");
// Envio sem link / com link de teste
await ir("/envio");
ok((await corpo()).includes("LINK PESSOAL") || (await corpo()).includes("Envio Nacional"), "Envio Nacional: a aba responde (aviso do link pessoal ou formulário)");
if (TOKEN) {
  await ir(`/envio?acesso=${TOKEN}`);
  const t = await corpo();
  ok(!t.includes("LINK PESSOAL") && t.includes("Minhas Solicitações"), "Envio Nacional com o link de TESTE: abre o envio (conferência, pedir envio, minhas solicitações)");
}
ok(rel.negados.filter(n => !/\/rest\/v1\/(envio_|grupos_envio|joiner_storage|joiner_conferencias)/.test(n) && !/key=eq\.admin_pin/.test(n)).length === 0, "nenhuma leitura negada (401/403/400) fora das tabelas de envio sem link (o 406 antigo de config?key=admin_pin é conhecido e inofensivo)");
ok(rel.erros.length === 0, "nenhum erro de JavaScript em nenhuma tela" + (rel.erros[0] ? ": " + rel.erros[0] : ""));
console.log("\nescritas permitidas (last_seen do próprio @):", rel.escritasPermitidas);
console.log("requisições BLOQUEADAS pela guarda:", rel.bloqueados.length, rel.bloqueados.slice(0, 12));
console.log("leituras negadas:", rel.negados.length, rel.negados.slice(0, 12));
console.log("tabelas lidas:", JSON.stringify(rel.leituras));
if (rel.consoles.length) console.log("erros de console:", rel.consoles.slice(0, 8));
if (SAIDA) writeFileSync(SAIDA, JSON.stringify({ falhas, ...rel }, null, 2));
await browser.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nSMOKE REAL: TUDO CONFORME");
process.exit(falhas ? 1 : 0);
