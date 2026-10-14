// Procura credenciais de serviço ou segredos NO QUE VAI PARA O NAVEGADOR (e, com --historico, em todo o histórico do git). SOMENTE LEITURA; nunca imprime o segredo, só o arquivo e o tipo.
// Uso:  node scripts/lancamento/auditar-segredos.mjs            (código-fonte do site: src, public, index.html, dist se existir)
//       node scripts/lancamento/auditar-segredos.mjs --historico  (também varre os commits; mais lento)
//       node scripts/lancamento/auditar-segredos.mjs <pasta>...   (outras pastas, por exemplo a exportação dos Apps Scripts)
// O que é aceitável: a chave PÚBLICA do Supabase (papel "anon"). Qualquer JWT com outro papel (service_role etc.), chave de e-mail, token pessoal ou senha embutida é FALHA.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const RAIZ = process.cwd();
const args = process.argv.slice(2), historico = args.includes("--historico");
const pastas = args.filter(a => !a.startsWith("--"));
const alvos = pastas.length ? pastas : ["src", "public", "index.html", "dist", "vite.config.js"].filter(p => existsSync(resolve(RAIZ, p)));
const RX_JWT = /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g;
const PADROES = [
  ["chave do SendGrid (SG.)", /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/],
  ["token de acesso do Supabase (sbp_)", /\bsbp_[a-f0-9]{30,}\b/],
  ["chave secreta do Supabase (sb_secret_)", /\bsb_secret_[A-Za-z0-9_-]{16,}/],
  ["token do GitHub", /\b(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}/],
  ["chave privada", /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["segredo VAPID privado atribuído", /VAPID_PRIVATE_KEY\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/],
  ["variável VITE com chave de serviço", /VITE_[A-Z_]*(SERVICE|SECRET)[A-Z_]*/],
];
const IGNORAR_DIRS = new Set(["node_modules", ".git"]);
const EXT = /\.(jsx?|mjs|cjs|ts|tsx|html?|css|json|gs|txt|md|env|yml|yaml)$/i;

function papelDoJwt(tok) { try { return JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString()).role || "(sem papel)"; } catch { return "(ilegível)"; } }
function arquivos(p, acc = []) {
  const caminho = resolve(RAIZ, p); if (!existsSync(caminho)) return acc;
  const st = statSync(caminho);
  if (st.isFile()) { acc.push(p); return acc; }
  for (const n of readdirSync(caminho)) { if (IGNORAR_DIRS.has(n)) continue; const sub = join(p, n); const s2 = statSync(resolve(RAIZ, sub)); if (s2.isDirectory()) arquivos(sub, acc); else if (EXT.test(n) && s2.size < 6_000_000) acc.push(sub); }
  return acc;
}
const achados = [];
function examinar(texto, onde) {
  for (const jwt of new Set(texto.match(RX_JWT) || [])) { const papel = papelDoJwt(jwt); if (papel !== "anon") achados.push({ onde, tipo: `JWT com papel "${papel}"` }); }
  for (const [nome, rx] of PADROES) if (rx.test(texto)) achados.push({ onde, tipo: nome });
}
let lidos = 0;
for (const a of alvos) for (const f of arquivos(a)) { try { examinar(readFileSync(resolve(RAIZ, f), "utf8"), f); lidos++; } catch { /* binário */ } }

if (historico) {
  try {
    const commits = execFileSync("git", ["rev-list", "--all"], { cwd: RAIZ, encoding: "utf8", maxBuffer: 1 << 26 }).split("\n").filter(Boolean);
    const vistos = new Set();
    for (const c of commits) {
      const arqs = execFileSync("git", ["ls-tree", "-r", "--name-only", c], { cwd: RAIZ, encoding: "utf8", maxBuffer: 1 << 26 }).split("\n").filter(f => f && !f.startsWith("node_modules/") && EXT.test(f) && !f.startsWith("supabase/") && !f.startsWith("tests/"));
      for (const f of arqs) {
        let id; try { id = execFileSync("git", ["rev-parse", `${c}:${f}`], { cwd: RAIZ, encoding: "utf8" }).trim(); } catch { continue; }
        if (vistos.has(id)) continue; vistos.add(id);
        try { examinar(execFileSync("git", ["show", `${c}:${f}`], { cwd: RAIZ, encoding: "utf8", maxBuffer: 1 << 26 }), `${f} (commit ${c.slice(0, 7)})`); lidos++; } catch { /* arquivo grande */ }
      }
    }
  } catch (e) { console.error("Não consegui varrer o histórico:", String(e.message).slice(0, 120)); }
}

const unicos = [...new Map(achados.map(a => [a.onde + "|" + a.tipo, a])).values()];
console.log(`Arquivos examinados: ${lidos}${historico ? " (inclui o histórico do git)" : ""}`);
for (const a of unicos) console.log(`FALHA  ${a.tipo} em ${a.onde}`);
console.log(unicos.length ? `\n${unicos.length} ACHADO(S): tire o segredo do código e GIRE a credencial.` : "\nNenhuma credencial de serviço ou segredo encontrado (só a chave pública, que é esperada).");
process.exit(unicos.length ? 1 : 0);
