// SONDA SOMENTE LEITURA do que um VISITANTE (chave pública, sem token) enxerga nas tabelas de envio e nos buckets. Usa HEAD (sem baixar dados) e lê só o Content-Range.
// GO/NO-GO: depois do ENV1, as 7 tabelas devem mostrar 0 (ou NEGADO); rastreios deve ser NEGADO; storage-itens não pode ser listável.
//   node scripts/envio-sondar-visitante.mjs [--com-token <token>]     (com token: deve ver SÓ as linhas da dona do link)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const fonte = readFileSync(join(raiz, "src", "supabase.js"), "utf8");
const CHAVE = process.env.SUPABASE_ANON_KEY || fonte.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0];
const URL_BASE = (process.env.SUPABASE_URL || "https://" + JSON.parse(Buffer.from(CHAVE.split(".")[1], "base64url").toString()).ref + ".supabase.co").replace(/\/$/, "");
if (JSON.parse(Buffer.from(CHAVE.split(".")[1], "base64url").toString()).role !== "anon") { console.error("a chave não é anon: recusado"); process.exit(1); }
const i = process.argv.indexOf("--com-token"); const token = i >= 0 ? process.argv[i + 1] : null;
const cab = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, Prefer: "count=exact", ...(token ? { "x-envio-token": token } : {}) };
async function head(tab) { const col = tab === "grupos_envio" ? "codigo" : "id"; const r = await fetch(`${URL_BASE}/rest/v1/${tab}?select=${col}&limit=1`, { method: "HEAD", headers: cab }); const n = (r.headers.get("content-range") || "").split("/")[1]; return r.status >= 400 ? `NEGADO (${r.status})` : `visível: ${n ?? "?"}`; }
let falhas = 0;
for (const [t, esperado] of [["envio_solicitacoes", "vazio"], ["grupos_envio", "vazio"], ["joiner_storage", "vazio"], ["envio_requests", "vazio"], ["joiner_conferencias", "vazio"], ["rastreios", "negado"]]) {
  const r = await head(t);
  const bom = token ? (esperado === "negado" ? r.startsWith("NEGADO") : true) : (esperado === "negado" ? r.startsWith("NEGADO") : /visível: 0$/.test(r) || r.startsWith("NEGADO"));
  if (!bom) falhas++;
  console.log((bom ? "OK    " : "FALHA ") + t.padEnd(22) + r);
}
const lista = await fetch(`${URL_BASE}/storage/v1/object/list/storage-itens`, { method: "POST", headers: { ...cab, "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 1 }) });
const corpo = lista.ok ? await lista.json().catch(() => []) : [];
const listavel = Array.isArray(corpo) && corpo.length > 0;
if (listavel) falhas++;
console.log((listavel ? "FALHA " : "OK    ") + "storage-itens".padEnd(22) + (listavel ? "visitante LISTA arquivos" : "visitante não lista arquivos"));
console.log(falhas ? `\n${falhas} FALHA(S): NO-GO` : "\nTudo conforme: visitante sem acesso aos dados de envio");
process.exit(falhas ? 1 : 0);
