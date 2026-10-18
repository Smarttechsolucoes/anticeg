// Gera / revoga os LINKS PESSOAIS do Envio Nacional (uso da equipe técnica, DEPOIS do ENV1 aplicado). O token aparece UMA vez; o banco guarda só o hash.
//   node scripts/envio-links.mjs --gerar --cogs ana,beatriz --dias 14 --saida <arquivo.csv FORA do repositório>
//   node scripts/envio-links.mjs --gerar --arquivo cogs.txt --saida links.csv          (um @/COG por linha)
//   node scripts/envio-links.mjs --revogar --cogs ana                                   (revoga todos os links ativos dessa joiner)
//   node scripts/envio-links.mjs --listar                                               (quantos links ativos existem; não mostra tokens)
// O CSV tem dados pessoais e links secretos: NÃO commitar, enviar cada link só à joiner dona dele (WhatsApp/DM) e apagar o arquivo depois.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const REF = "ghjfsmwwcfpfvrouyrka";
const BASE = process.env.ENVIO_BASE_URL || "https://anticeg.vercel.app";
const a = process.argv.slice(2);
const tem = f => a.includes(f);
const val = f => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };
const q = texto => { const r = execFileSync("npx", ["supabase", "db", "query", "--linked", "--project-ref", REF, "-o", "json", texto], { encoding: "utf8", shell: process.platform === "win32" }); return JSON.parse(r.slice(r.indexOf("{"), r.lastIndexOf("}") + 1)).rows; };
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
const norm = s => String(s || "").trim().replace(/^@+/, "").toLowerCase();
function cogs() {
  const arq = val("--arquivo");
  const bruto = arq ? readFileSync(arq, "utf8").split(/\r?\n/) : String(val("--cogs") || "").split(",");
  const lista = [...new Set(bruto.map(norm).filter(Boolean))];
  if (!lista.length) throw new Error("informe --cogs a,b,c ou --arquivo <arquivo>");
  return lista;
}

if (tem("--listar")) {
  console.log(q("select count(*) filter (where revogado_em is null and expira_em > now()) ativos, count(*) filter (where revogado_em is not null) revogados, count(*) filter (where revogado_em is null and expira_em <= now()) vencidos from emergencia.envio_acessos")[0]);
} else if (tem("--revogar")) {
  for (const c of cogs()) console.log(c, "-> links revogados:", q(`select emergencia.revogar_acesso_envio(${lit(c)}) n`)[0].n);
} else if (tem("--gerar")) {
  const dias = Number(val("--dias") || 14); const saida = val("--saida");
  if (!saida) throw new Error("informe --saida <arquivo.csv> fora do repositório");
  if (/anticeg(-[a-z0-9]+)?[\\/](src|scripts|supabase|tests)/i.test(saida.replace(/\\/g, "/")) ) throw new Error("grave o CSV FORA do repositório");
  if (existsSync(saida)) throw new Error("o arquivo de saída já existe; escolha outro nome");
  const linhas = ["cog;nome;link;validade_dias"];
  for (const c of cogs()) {
    const j = q(`select cog, nome from public.joiners where lower(btrim(cog)) = ${lit(c)} order by (cog = ${lit(c)}) desc, id limit 1`)[0];
    if (!j) { console.log(c, "-> joiner não encontrada: ignorada"); continue; }
    const t = q(`select emergencia.gerar_acesso_envio(${lit(j.cog)}, ${dias}, 'piloto envio') t`)[0].t;
    linhas.push([j.cog, String(j.nome || "").replace(/;/g, ","), `${BASE}/envio?acesso=${t}`, dias].join(";"));
    console.log(j.cog, "-> link gerado");
  }
  writeFileSync(saida, linhas.join("\n") + "\n", { flag: "wx" });
  console.log(`${linhas.length - 1} link(s) em ${saida}. Envie cada um só à joiner dona e apague o arquivo depois.`);
} else { console.error("use --gerar, --revogar ou --listar"); process.exit(2); }
