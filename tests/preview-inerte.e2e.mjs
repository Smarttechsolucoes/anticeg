// Navegador: um build de PREVIEW (VERCEL_ENV=preview, sem variáveis) não faz NENHUMA chamada à produção e mostra a faixa; o build normal segue falando com a produção.
// Uso:  VERCEL_ENV=preview npx vite --port 5196 --strictPort   |   npx vite --port 5198 --strictPort   e depois:  node tests/preview-inerte.e2e.mjs
import { chromium } from "playwright";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const PROD = "ghjfsmwwcfpfvrouyrka";
async function visitar(porta) {
  const browser = await chromium.launch(); const ctx = await browser.newContext();
  await ctx.addInitScript(() => { localStorage.setItem("anticeg_tutorial_v1", "1"); localStorage.setItem("anticeg_push_asked", "1"); });
  const hosts = new Set(); const escritas = [];
  await ctx.route("**/*", route => {
    const req = route.request(), u = req.url();
    if (u.startsWith(`http://localhost:${porta}`)) return route.continue();
    try { const h = new URL(u).host; if (h.endsWith("supabase.co") || h.endsWith(".invalid")) hosts.add(h); if (req.method() !== "GET" && /supabase|invalid/.test(h)) escritas.push(req.method() + " " + h); } catch { /* ignora */ }
    if (new URL(u).host.endsWith(".invalid")) return route.abort("namenotresolved");
    return route.fulfill({ status: 200, contentType: "application/json", body: req.headers()["accept"]?.includes("pgrst.object") ? "{}" : "[]", headers: { "content-range": "*/0" } });
  });
  const page = await ctx.newPage(); await page.goto(`http://localhost:${porta}/`, { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  const faixa = await page.getByTestId("faixa-preview-inerte").count();
  await browser.close(); return { hosts: [...hosts], faixa, escritas };
}
const p = await visitar(5196), n = await visitar(5198);
ok(p.faixa === 1, "PREVIEW: a faixa 'PREVIEW · SEM BANCO' aparece");
ok(!p.hosts.some(h => h.includes(PROD)), "PREVIEW: NENHUMA chamada vai para a produção (hosts: " + p.hosts.join(",") + ")");
ok(p.hosts.length > 0 && p.hosts.every(h => h.endsWith(".invalid")), "PREVIEW: todo acesso a banco vai para o endereço inexistente");
ok(p.escritas.every(e => !e.includes(PROD)), "PREVIEW: nenhuma escrita na produção");
ok(n.hosts.length > 0 && n.hosts.every(h => h.startsWith(PROD)), "NORMAL: continua falando com a produção: " + n.hosts.join(","));
ok(n.faixa === 0, "NORMAL: sem faixa");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
