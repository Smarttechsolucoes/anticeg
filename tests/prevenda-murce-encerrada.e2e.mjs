// O cartão PROMO-MURCE-50 (prazo encerrado em 05/11 às 12h) fica em "Encerradas" na aba de pré-venda, com a etiqueta ENCERRADO e sem o botão "Preencher formulário".
// Uso: npx vite --port 5199 --strictPort (recurso de contas DESLIGADO) e depois  node tests/prevenda-murce-encerrada.e2e.mjs
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const ANA = { id: 5, cog: "ana", nome: "Ana Lima", nome_site: "Ana", email: "ana@exemplo.com", twitter: "@ana", confirmado: true };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 1400 } });
await ctx.addInitScript(u => { localStorage.setItem("anticeg_user_v2", JSON.stringify(u)); localStorage.setItem("anticeg_session_v", "5"); localStorage.setItem("anticeg_session_at_v2", String(Date.now())); localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); localStorage.setItem("anticeg_a2hs_asked", "1"); }, ANA);
await ctx.route("**/*", r => { const u = r.request().url(); if (u.startsWith("http://localhost:5199")) return r.continue(); if (u.includes("supabase.co/rest")) { const objeto = (r.request().headers()["accept"] || "").includes("pgrst.object"); return r.fulfill({ status: 200, contentType: "application/json", body: objeto ? JSON.stringify(ANA) : "[]", headers: { "content-range": "*/0" } }); } return r.fulfill({ status: 204, body: "" }); });
const page = await ctx.newPage(); const erros = []; page.on("pageerror", e => erros.push(String(e)));
await page.goto("http://localhost:5199/prevenda", { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
const titulo = page.getByText("PROMO-MURCE-50", { exact: true });
const aba = nome => page.getByRole("button", { name: new RegExp(nome) });
// Abertas (aba inicial): o cartão NÃO está
if (await aba("Abertas").count()) await aba("Abertas").first().click(); await page.waitForTimeout(300);
ok(await titulo.count() === 0, "em 'Abertas' o cartão PROMO-MURCE-50 NÃO aparece");
await aba("Encerradas").first().click(); await page.waitForTimeout(400);
ok(await titulo.count() === 1, "em 'Encerradas' o cartão PROMO-MURCE-50 aparece");
const cartao = page.locator("div").filter({ has: titulo }).last();
const texto = await page.locator("body").innerText();
const trecho = texto.slice(texto.indexOf("PROMO-MURCE-50"), texto.indexOf("PROMO-MURCE-50") + 400);
ok(/ENCERRADO/.test(trecho) && !/ABERTO\b/.test(trecho.split("\n").slice(0, 2).join(" ")), "o cartão mostra a etiqueta ENCERRADO");
ok(!/PREENCHER FORMUL/i.test(trecho) && /VER FORMUL/i.test(trecho), "o cartão não tem 'Preencher formulário' (só 'Ver formulário')");
ok(erros.length === 0, "nenhum erro de JavaScript" + (erros.length ? " | " + erros[0].slice(0, 120) : ""));
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
