// Migra os 22 comprovantes ANTIGOS de envio do bucket PÚBLICO "comprovantes" (envio/<id>/…) para o bucket PRIVADO "envio-comprovantes" (<id>/comprovante_<hora>.<ext>).
// Só roda DEPOIS do ENV1 (que cria o bucket privado). Cada etapa é separada e pode ser conferida antes da seguinte:
//   --listar                      (somente leitura) mostra o que seria migrado
//   --copiar    --pasta <dir>     baixa cada arquivo para <dir> (BACKUP LOCAL, fora do repositório) e envia a cópia ao bucket privado; confere que chegou
//   --atualizar --pasta <dir>     grava no banco o novo caminho (transação, só nas linhas que ainda apontam para o link público; confere a contagem)
//   --apagar-originais --confirmo --pasta <dir>   remove os originais do bucket público, SÓ se as 22 cópias privadas existirem e o banco já apontar para elas
// Nada é apagado antes de a cópia privada e o banco estarem conferidos. Usa o CLI do Supabase já logado (projeto ligado).
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REF = "ghjfsmwwcfpfvrouyrka";
const args = process.argv.slice(2);
const tem = f => args.includes(f);
const valor = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const pasta = valor("--pasta");
const sh = (cmd, a) => execFileSync(cmd, a, { encoding: "utf8", shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] });
const sql = q => { const r = sh("npx", ["supabase", "db", "query", "--linked", "--project-ref", REF, "-o", "json", JSON.stringify(q)]); return JSON.parse(r.slice(r.indexOf("{"), r.lastIndexOf("}") + 1)).rows; };
const sqlArquivo = (arq) => { const r = sh("npx", ["supabase", "db", "query", "--linked", "--project-ref", REF, "-o", "json", "-f", arq]); return r; };
const ss = (b, p) => `ss:///${b}/${p}`;

function itens() {
  const linhas = sql("select id, comprovante_url from public.envio_solicitacoes where comprovante_url ~ '^https?://' order by id");
  return linhas.map(l => {
    const m = /\/object\/public\/comprovantes\/(envio\/[^?#]+)$/.exec(l.comprovante_url);
    if (!m) throw new Error("link inesperado na solicitação " + l.id + " (não é do bucket comprovantes/envio): nada foi feito");
    const origem = decodeURIComponent(m[1]);
    const ext = (/\.([A-Za-z0-9]{2,5})$/.exec(origem) || [])[1]?.toLowerCase();
    if (!["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"].includes(ext)) throw new Error("extensão não permitida no bucket privado: solicitação " + l.id + " (" + origem + "). Resolver à mão; nada foi feito");
    const hora = (/comprovante_(\d{10,})\./.exec(origem) || [])[1] || String(Date.now());
    return { id: l.id, link: l.comprovante_url, origem, destino: `${l.id}/comprovante_${hora}.${ext}`, ext };
  });
}
const lista = itens();
console.log(`${lista.length} comprovante(s) antigo(s) de envio em bucket público.`);

if (tem("--listar") || args.length === 0) {
  for (const i of lista) console.log(`  solicitação ${i.id}: ${i.origem}  ->  envio-comprovantes/${i.destino}`);
  console.log("(somente leitura: nada foi alterado)");
  process.exit(0);
}
if (!pasta) { console.error("informe --pasta <diretório FORA do repositório> para o backup local"); process.exit(2); }
mkdirSync(pasta, { recursive: true });
const manifesto = join(pasta, "manifesto.json");

if (tem("--copiar")) {
  let ok = 0;
  for (const i of lista) {
    const local = join(pasta, `${i.id}.${i.ext}`);
    if (!existsSync(local)) sh("npx", ["supabase", "storage", "cp", "--linked", "--project-ref", REF, ss("comprovantes", i.origem), local]);
    if (!existsSync(local)) throw new Error("download falhou: solicitação " + i.id);
    sh("npx", ["supabase", "storage", "cp", "--linked", "--project-ref", REF, local, ss("envio-comprovantes", i.destino)]);
    const pasta1 = i.destino.split("/")[0];
    const ls = sh("npx", ["supabase", "storage", "ls", "--linked", "--project-ref", REF, ss("envio-comprovantes", pasta1)]);
    if (!ls.includes(i.destino.split("/")[1])) throw new Error("a cópia privada não apareceu: solicitação " + i.id + ". Parado; nada foi apagado.");
    ok++; console.log(`  copiado ${ok}/${lista.length}: solicitação ${i.id}`);
  }
  writeFileSync(manifesto, JSON.stringify(lista, null, 2));
  console.log("Cópias privadas conferidas. Backup local em", pasta, "(contém comprovantes: NÃO commitar). Próximo: --atualizar");
  process.exit(0);
}

if (tem("--atualizar")) {
  if (!existsSync(manifesto)) throw new Error("rode --copiar antes (manifesto ausente)");
  const m = JSON.parse(readFileSync(manifesto, "utf8"));
  if (m.length !== lista.length) throw new Error("o número de comprovantes mudou desde a cópia: refaça --copiar");
  const q = "begin;\n" + m.map(i => `update public.envio_solicitacoes set comprovante_url = '${i.destino}' where id = ${Number(i.id)} and comprovante_url = '${i.link.replace(/'/g, "''")}';`).join("\n") +
    `\ndo $$ begin if (select count(*) from public.envio_solicitacoes where comprovante_url ~ '^[0-9]+/comprovante_[0-9]{10,}\\.[a-z0-9]{2,5}$') < ${m.length} then raise exception 'migração: contagem não confere, desfeito'; end if; if exists (select 1 from public.envio_solicitacoes where comprovante_url ~ '^https?://') then raise exception 'migração: ainda há link público, desfeito'; end if; end $$;\ncommit;\n`;
  const arq = join(pasta, "atualizar.sql"); writeFileSync(arq, q);
  sqlArquivo(arq);
  console.log(`Banco atualizado: ${m.length} solicitação(ões) apontam para o bucket privado. Próximo (depois de abrir um comprovante pelo painel admin): --apagar-originais --confirmo`);
  process.exit(0);
}

if (tem("--apagar-originais")) {
  if (!tem("--confirmo")) throw new Error("falta --confirmo");
  if (!existsSync(manifesto)) throw new Error("rode --copiar e --atualizar antes");
  const m = JSON.parse(readFileSync(manifesto, "utf8"));
  const pendentes = sql("select count(*)::int n from public.envio_solicitacoes where comprovante_url ~ '^https?://'")[0].n;
  if (pendentes !== 0) throw new Error("ainda há comprovantes apontando para link público no banco: rode --atualizar. Nada apagado.");
  for (const i of m) {
    const ls = sh("npx", ["supabase", "storage", "ls", "--linked", "--project-ref", REF, ss("envio-comprovantes", i.destino.split("/")[0])]);
    if (!ls.includes(i.destino.split("/")[1])) throw new Error("cópia privada ausente para a solicitação " + i.id + ". Nada apagado.");
    if (!existsSync(join(pasta, `${i.id}.${i.ext}`))) throw new Error("backup local ausente para a solicitação " + i.id + ". Nada apagado.");
  }
  for (const i of m) { sh("npx", ["supabase", "storage", "rm", "--linked", "--project-ref", REF, ss("comprovantes", i.origem)]); console.log("  removido o original público da solicitação", i.id); }
  console.log("Originais públicos removidos. Os arquivos continuam no bucket privado e no backup local.");
  process.exit(0);
}
console.error("use --listar, --copiar, --atualizar ou --apagar-originais --confirmo");
process.exit(2);
