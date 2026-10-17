// Inventário de SEGURANÇA dos Apps Scripts exportados (complementa auditar-appsscript.mjs, que cuida do Supabase). SOMENTE LEITURA: lê arquivos locais, não se conecta a nada e NUNCA imprime um segredo (só o tipo e o tamanho).
// Uso:  node scripts/lancamento/inventariar-appsscript.mjs appsscripts/
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";

const SEGREDOS = [
  ["token do GitHub", /\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9]{20,})\b/g],
  ["JWT (Supabase ou outro)", /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g],
  ["chave SendGrid", /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g],
  ["chave Google API", /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ["chave privada", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["token fixo do site (anticeg-pag-…)", /anticeg-pag-[A-Za-z0-9-]+/g],
];

export function inventariar(nome, texto) {
  const achados = [];
  for (const [tipo, rx] of SEGREDOS) { const m = texto.match(rx) || []; if (m.length) achados.push({ tipo, ocorrencias: m.length, tamanho: m[0].length }); }
  const entradas = [...new Set([...texto.matchAll(/function\s+(doGet|doPost)\s*\(/g)].map(m => m[1]))];
  const acoes = [...new Set([...texto.matchAll(/(?:acao|action)\s*(?:===?|==)\s*['"]([a-z_0-9]+)['"]/gi)].map(m => m[1]))].sort();
  const case_ = [...new Set([...texto.matchAll(/case\s+['"]([a-z_0-9]+)['"]\s*:/gi)].map(m => m[1]))].sort();
  const validaToken = /(?:\.token|\btoken)\s*(?:===?|!==?)\s*|PropertiesService[\s\S]{0,80}getProperty\(\s*['"][A-Za-z_]*TOKEN[A-Za-z_]*['"]\s*\)/i.test(texto);
  const tokenNoCodigo = achados.some(a => a.tipo.startsWith("token fixo"));
  const destinos = [...new Set([...texto.matchAll(/UrlFetchApp\.fetch\(\s*[`'"]([^`'"]{4,120})/g)].map(m => { try { return new URL(m[1].replace(/\$\{[^}]*\}/g, "x")).host; } catch { return m[1].slice(0, 40); } }))];
  const propriedades = [...new Set([...texto.matchAll(/getProperty\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g)].map(m => m[1]))];
  const gatilhos = [...new Set([...texto.matchAll(/ScriptApp\.newTrigger\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g)].map(m => m[1]))];
  const gravaPlanilha = /\.(setValue|setValues|appendRow|deleteRow|deleteRows|clearContent|insertRow|insertRowAfter|insertRowBefore)\(/.test(texto);
  const apagaLinhas = /\.(deleteRow|deleteRows|clearContent)\(/.test(texto);
  const alertas = [];
  if (achados.some(a => ["token do GitHub", "chave privada", "chave SendGrid", "chave Google API"].includes(a.tipo))) alertas.push("segredo escrito no código (mova para PropertiesService)");
  if (achados.some(a => a.tipo.startsWith("JWT"))) alertas.push("JWT no código: confira o papel com auditar-appsscript.mjs (service_role jamais deve ficar escrito)");
  if (entradas.length && !validaToken) alertas.push("é Web App (doGet/doPost) e não encontrei verificação de token");
  if (tokenNoCodigo) alertas.push("o mesmo token do site aparece no código (rotacionar junto com o site)");
  if (entradas.length && apagaLinhas) alertas.push("Web App que apaga/limpa linhas: conferir quem pode chamar");
  return { arquivo: nome, webApp: entradas, acoes: [...new Set([...acoes, ...case_])], validaToken, segredos: achados, destinos, propriedades, gatilhos, gravaPlanilha, apagaLinhas, alertas };
}

function listar(p) {
  const st = statSync(p); if (st.isFile()) return [p];
  return readdirSync(p).flatMap(n => { const q = join(p, n); return statSync(q).isDirectory() ? [] : (/\.(gs|js|txt|json)$/i.test(n) ? [q] : []); });
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const pasta = process.argv[2];
  if (!pasta || !existsSync(pasta)) { console.error("Informe a pasta com os .gs exportados. Ex.: node scripts/lancamento/inventariar-appsscript.mjs appsscripts/"); process.exit(2); }
  const arquivos = listar(pasta); let comAlerta = 0;
  for (const f of arquivos) {
    const r = inventariar(basename(f), readFileSync(f, "utf8"));
    console.log(`\n■ ${r.arquivo}\n  Web App: ${r.webApp.join(", ") || "não"} · ações: ${r.acoes.join(", ") || "—"} · verifica token: ${r.validaToken ? "sim" : "NÃO"}\n  Grava na planilha: ${r.gravaPlanilha ? "sim" : "não"}${r.apagaLinhas ? " (apaga/limpa linhas)" : ""} · gatilhos: ${r.gatilhos.join(", ") || "—"}\n  Chama: ${r.destinos.join(", ") || "—"} · propriedades lidas: ${r.propriedades.join(", ") || "—"}\n  Segredos escritos no código: ${r.segredos.map(s => `${s.tipo} ×${s.ocorrencias} (${s.tamanho} caracteres)`).join("; ") || "nenhum"}`);
    for (const a of r.alertas) console.log("  ⚠ " + a);
    if (r.alertas.length) comAlerta++;
  }
  console.log(`\n${arquivos.length} arquivo(s); ${comAlerta} com alerta.`);
  process.exit(comAlerta ? 1 : 0);
}
