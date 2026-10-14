// Prova, no navegador, que o ISOLAMENTO funciona: o build de ensaio fala SÓ com o Supabase de ensaio (e mostra a faixa), e o normal segue falando com a produção.
// Uso: VITE_SUPABASE_URL=https://zzzzensaioref.supabase.co VITE_SUPABASE_ANON_KEY=<chave anon de mentira> npx vite --port 5195 --strictPort
//      npx vite --port 5199 --strictPort            (sem variáveis: produção)       e depois: node tests/ambiente-ensaio.e2e.mjs
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PROD = "ghjfsmwwcfpfvrouyrka", ENSAIO = "zzzzensaioref";
async function visitar(porta) {
  const browser = await chromium.launch(); const ctx = await browser.newContext();
  await ctx.addInitScript(() => { localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); });
  const hosts = new Set();
  await ctx.route("**/*", route => {
    const u = route.request().url();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    try { const h = new URL(u).host; if (h.endsWith("supabase.co")) hosts.add(h); } catch { /* ignora */ }
    return route.fulfill({ status: 200, contentType: "application/json", body: route.request().headers()["accept"]?.includes("pgrst.object") ? "{}" : "[]", headers: { "content-range": "*/0" } });
  });
  const page = await ctx.newPage(); await page.goto(`http://localhost:${porta}/`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  const faixa = await page.getByTestId("faixa-ensaio").count();
  await browser.close(); return { hosts: [...hosts], faixa };
}
const e = await visitar(5195);
ok(e.hosts.length > 0 && e.hosts.every(h => h.startsWith(ENSAIO)), "ENSAIO: todas as chamadas ao Supabase vão para o projeto de ensaio: " + e.hosts.join(","));
ok(!e.hosts.some(h => h.includes(PROD)), "ENSAIO: NENHUMA chamada vai para a produção");
ok(e.faixa === 1, "ENSAIO: a faixa 'AMBIENTE DE ENSAIO' aparece");
const p = await visitar(5199);
ok(p.hosts.length > 0 && p.hosts.every(h => h.startsWith(PROD)), "NORMAL (sem variáveis): continua falando com a produção: " + p.hosts.join(","));
ok(p.faixa === 0, "NORMAL: sem faixa");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
