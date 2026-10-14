// Confirma, PELA API REAL e SOMENTE LENDO, que os comprovantes ANTIGOS deixaram de ser públicos e que a dona ainda consegue ver o dela:
//   1) para cada arquivo da lista, o endereço "público" antigo NÃO pode mais abrir (esperado HTTP 400/404/401/403; HTTP 200/206 = arquivo ainda público = FALHA);
//   2) (opcional) a dona consegue o link assinado do arquivo dela e ele abre; outra joiner NÃO consegue o do arquivo alheio.
// Só pede o primeiro byte (Range: bytes=0-0): nunca baixa o conteúdo, nunca imprime link, token, senha nem e-mail.
// Uso (PowerShell): $env:LANC_URL="https://SEUREF.supabase.co"; $env:LANC_ANON="<chave anon pública>"
//   node scripts/lancamento/verificar-comprovantes-antigos.mjs lista.csv [--amostra 200]
//     (lista.csv = exportação da consulta 2d de supabase/lancamento/J5_inventario_leitura.sql: colunas bucket_id,name; aceita também linhas "bucket/caminho")
//   Verificação da dona (opcional):  $env:LANC_A_COG="ana"; $env:LANC_A_SENHA="..."; $env:LANC_B_COG="bia"; $env:LANC_B_SENHA="..."
//   node scripts/lancamento/verificar-comprovantes-antigos.mjs lista.csv --ver comprovantes/pagamentos/ana.pdf      (arquivo que a conta A possui e a B não)
import { readFileSync, existsSync } from "node:fs";
const URL_ = (process.env.LANC_URL || "").replace(/\/$/, ""), ANON = process.env.LANC_ANON || "";
const papel = (() => { try { return JSON.parse(Buffer.from(ANON.split(".")[1], "base64url").toString()).role; } catch { return ""; } })();
if (!URL_ || !ANON) { console.error("Defina LANC_URL e LANC_ANON (chave PÚBLICA)."); process.exit(2); }
if (papel !== "anon") { console.error("A chave informada não é a pública (anon). Nunca use a chave de serviço aqui."); process.exit(2); }
const args = process.argv.slice(2);
const valorDe = nome => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : null; };
const amostra = Number(valorDe("--amostra") || 0), ver = valorDe("--ver");
const arquivo = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--amostra" && args[i - 1] !== "--ver");
if (!arquivo || !existsSync(arquivo)) { console.error("Informe o arquivo da lista (CSV exportado da consulta 2d do inventário)."); process.exit(2); }

let falhas = 0; const ok = (c, m) => { console.log((c ? "OK     " : "FALHA  ") + m); if (!c) falhas++; };
const BUCKETS = ["comprovantes", "mercari-comprovantes"];
let itens = readFileSync(arquivo, "utf8").split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
  const limpo = l.replace(/^"|"$/g, ""); let b, p;
  const virg = l.match(/^"?([a-z-]+)"?\s*,\s*"?(.*?)"?$/);
  if (virg && BUCKETS.includes(virg[1])) { b = virg[1]; p = virg[2].replace(/""/g, '"'); } else { const i = limpo.indexOf("/"); b = limpo.slice(0, i); p = limpo.slice(i + 1); }
  return BUCKETS.includes(b) && p ? { b, p } : null;
}).filter(Boolean);
if (amostra > 0 && itens.length > amostra) { const passo = itens.length / amostra; itens = Array.from({ length: amostra }, (_, i) => itens[Math.floor(i * passo)]); }
console.log(`Projeto: ${new URL(URL_).host} · ${itens.length} arquivo(s) a conferir\n`);

const primeiroByte = async (url, token) => { try { const r = await fetch(url, { headers: { Range: "bytes=0-0", apikey: ANON, ...(token ? { Authorization: `Bearer ${token}` } : {}) } }); return r.status; } catch { return 0; } };
const abertos = []; let aberto = 0, fechado = 0, i = 0;
async function trabalhador() {
  while (i < itens.length) {
    const { b, p } = itens[i++];
    const status = await primeiroByte(`${URL_}/storage/v1/object/public/${b}/${p.split("/").map(encodeURIComponent).join("/")}`);
    if (status === 200 || status === 206) { aberto++; abertos.push(`${b}/${p}`); } else fechado++;
  }
}
await Promise.all(Array.from({ length: 8 }, trabalhador));
ok(aberto === 0, `links públicos antigos: ${fechado} fechado(s), ${aberto} AINDA ABERTO(S)`);
for (const a of abertos.slice(0, 10)) console.log("       ainda público: " + a);

if (ver) {
  const [b, ...resto] = ver.split("/"); const p = resto.join("/");
  const entrar = async (cog, senha) => { if (!cog || !senha) return null; const r = await fetch(`${URL_}/functions/v1/login-joiner`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ cog: String(cog).replace(/^@/, ""), senha }) }); return (await r.json().catch(() => ({}))).access_token || null; };
  const pedir = async token => { const r = await fetch(`${URL_}/functions/v1/comprovante-url`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ bucket: b, path: p }) }); const j = await r.json().catch(() => ({})); return { status: r.status, url: j.url || null }; };
  console.log("\n── visualização legítima ──");
  const A = await entrar(process.env.LANC_A_COG, process.env.LANC_A_SENHA), B = await entrar(process.env.LANC_B_COG, process.env.LANC_B_SENHA);
  if (!A) console.log("(sem conta A: defina LANC_A_COG/LANC_A_SENHA para provar a visualização da dona)");
  else { const r = await pedir(A); ok(r.status === 200 && !!r.url, `a dona (A) recebe o link assinado de ${b}/…`); if (r.url) { const s = await primeiroByte(r.url); ok(s === 200 || s === 206, `e o link assinado abre (HTTP ${s})`); } }
  if (B) { const r = await pedir(B); ok(r.status === 404 && !r.url, `outra joiner (B) NÃO recebe link do arquivo alheio (HTTP ${r.status})`); }
  const semConta = await fetch(`${URL_}/functions/v1/comprovante-url`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ bucket: b, path: p }) });
  ok(semConta.status === 401, `visitante (chave pública) NÃO recebe link (HTTP ${semConta.status})`);
}
console.log(`\n${falhas ? falhas + " FALHA(S): há comprovante antigo público ou visualização quebrada." : "OK: nenhum link público antigo abre e a visualização legítima funciona."}`);
process.exit(falhas ? 1 : 0);
