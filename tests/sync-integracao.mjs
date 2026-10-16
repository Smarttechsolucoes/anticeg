// Integração do SYNC REAL (scripts/sync-masterlist.js) com S2 (casamento por código) + S1 (exclusão protegida), contra um banco local PGlite e uma planilha (CSV) fictícia. Sem rede, sem Supabase.
// Uso: node tests/sync-integracao.mjs   (precisa de @electric-sql/pglite e csv-parse instalados)
// Prova, no comportamento REAL do script: o id é preservado quando só o nome muda (linhas com código único); linhas sem código/códigos repetidos seguem a regra antiga;
//   S1 ausente => nada é apagado; S1 presente => exclusão protegida e arquivada; claims/pagos protegidos; nada duplica por causa do S2; planilha parcial não apaga.
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
// script do sync ANTES do S1 e do S2 (commit 8aac0bc, o último da main antes do PR #24), usado só para mostrar o comportamento ANTERIOR
const gitMain = spawnSync("git", ["show", "8aac0bc:scripts/sync-masterlist.js"], { encoding: "utf8", cwd: RAIZ }).stdout;
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const CAB = "ABA / CEG,NOME,@,EMAIL,NOME DO ITEM,ID,PREÇO ITEM,PREÇO FRETE,PREÇO RF,INFORMAÇÕES,ITEM,FRETE,RF,ITEM DATA,FRETE DATA,RF DATA,Chegou?,NACIONAL";
const csv = linhas => [CAB, ...linhas.map(l => [l.ceg, l.nome, "@" + l.cog, "", l.item, l.id ?? "", l.preco ?? "10", "", "", "", l.pago ? "TRUE" : "FALSE", "FALSE", "FALSE", "", "", "", "FALSE", "FALSE"].join(","))].join("\n");

// banco ANTES: 6 linhas. 1,2,6 com código único; 3 sem código; 4 e 5 com o MESMO código (ambíguo no banco)
const BASE = [
  { id: 1, ceg: "CEG1", cog: "ana", nome: "Ana", item: "Item A", idl: "ABC-1" },
  { id: 2, ceg: "CEG1", cog: "bia", nome: "Bia", item: "Item B", idl: "ABC-2", pago: true },
  { id: 3, ceg: "CEG1", cog: "cris", nome: "Cris", item: "Item C", idl: null },
  { id: 4, ceg: "CEG2", cog: "duda", nome: "Duda", item: "Item D", idl: "DUP-1" },
  { id: 5, ceg: "CEG2", cog: "edu", nome: "Edu", item: "Item E", idl: "DUP-1" },
  { id: 6, ceg: "CEG2", cog: "fer", nome: "Fer", item: "Item F", idl: "ABC-6" },
];
const setupBase = (extra = "") => BASE.map(b => `insert into public.masterlist (id, ceg, cog, nome, nome_do_item, id_linha, valor_item, status, pago_item) values (${b.id}, '${b.ceg}', '${b.cog}', '${b.nome}', '${b.item}', ${b.idl ? `'${b.idl}'` : "null"}, 10, 'Comprado', ${b.pago ? "true" : "false"});`).join("\n")
  + `\ninsert into public.claims (masterlist_id, status) values (6, 'aprovado');\n` + extra;
const planilhaBase = () => BASE.map(b => ({ ceg: b.ceg, nome: b.nome, cog: b.cog, item: b.item, id: b.idl, pago: b.pago }));

const dir = mkdtempSync(join(tmpdir(), "sync-int-"));
let n = 0;
function rodar({ planilha, aplicarS1 = false, setup = setupBase(), scriptSource }) {
  const arq = join(dir, `c${++n}.json`); writeFileSync(arq, JSON.stringify({ csv: csv(planilha), aplicarS1, setupSql: setup, scriptSource }));
  const r = spawnSync(process.execPath, ["tests/helpers/sync-filho.mjs", arq], { cwd: RAIZ, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const i = (r.stdout || "").lastIndexOf("@@RESULTADO@@");
  if (i < 0) return { erro: (r.stderr || r.stdout || "sem saída").slice(0, 1500), logs: [], masterlist: [] };
  const o = JSON.parse(r.stdout.slice(i + 13)); o.log = o.logs.join("\n");
  if (process.env.SYNC_DEBUG) console.log(`--- cenário ${n}: ids=${JSON.stringify(ids(o))} exit=${o.exitCode} exclusoes=${JSON.stringify(o.exclusoes)}\n` + o.logs.filter(l => /Masterlist:|candidato|Removid|ABORT|protegida|ausentes da planilha/.test(l)).join("\n"));
  return o;
}
const ids = o => o.masterlist.map(x => x.id).sort((a, b) => a - b);
const por = (o, id) => o.masterlist.find(x => x.id === id);
const existe = (o, nome) => o.masterlist.filter(x => x.nome_do_item === nome).length;
const mudar = (pl, idl, campos) => pl.map(l => l.id === idl ? { ...l, ...campos } : l);

{ // 0) linha de base: planilha igual ao banco => nada muda
  const o = rodar({ planilha: planilhaBase(), aplicarS1: true });
  ok(!o.erro && JSON.stringify(ids(o)) === "[1,2,3,4,5,6]", "base: planilha igual ao banco => mesmos 6 ids, nada inserido nem apagado" + (o.erro ? " | " + o.erro : ""));
  ok(/0 inseridos/.test(o.log) && /Nenhum registro candidato/.test(o.log), "base: log informa 0 inseridos e nenhum candidato à remoção");
}
{ // 1) item com código renomeado na planilha: ANTES (main atual) recria; DEPOIS (S2) mantém o id — com S1 aplicado e também com S1 ausente
  const pl = mudar(planilhaBase(), "ABC-1", { item: "Item A RENOMEADO" });
  const antes = rodar({ planilha: pl, aplicarS1: false, scriptSource: gitMain });
  ok(!antes.erro && !por(antes, 1) && existe(antes, "Item A RENOMEADO") === 1 && por(antes, 9000)?.nome_do_item === "Item A RENOMEADO", "ANTES (script da main): renomear APAGA a linha 1 e recria o item com id NOVO (9000) — é o que quebra o vínculo das demandas" + (antes.erro ? " | " + antes.erro : ""));
  for (const s1 of [true, false]) {
    const o = rodar({ planilha: pl, aplicarS1: s1 });
    ok(!o.erro && JSON.stringify(ids(o)) === "[1,2,3,4,5,6]" && por(o, 1).nome_do_item === "Item A RENOMEADO", `S2 (${s1 ? "com" : "sem"} S1): renomear MANTÉM o id 1 e atualiza o nome; nenhuma linha nova, nada apagado` + (o.erro ? " | " + o.erro : ""));
    ok(/1 com nome\/CEG alterado, mantendo o id/.test(o.log), `S2 (${s1 ? "com" : "sem"} S1): o log informa as linhas casadas pelo código`);
  }
}
{ // 2) nome de exibição alterado numa linha PAGA com código: id e pagamento preservados
  const o = rodar({ planilha: mudar(planilhaBase(), "ABC-2", { nome: "Bianca Nova", pago: true }), aplicarS1: true });
  ok(!o.erro && JSON.stringify(ids(o)) === "[1,2,3,4,5,6]" && por(o, 2).nome === "Bianca Nova" && por(o, 2).pago_item === true, "S2+S1: alterar o nome de exibição de uma linha paga mantém o id e o pagamento");
}
{ // 3) linha SEM código renomeada: comportamento antigo (nova + candidata à exclusão); S1 arquiva a antiga; S1 ausente não apaga nada
  const pl = BASE.map(b => ({ ceg: b.ceg, nome: b.nome, cog: b.cog, item: b.id === 3 ? "Item C RENOMEADO" : b.item, id: b.idl, pago: b.pago }));
  const comS1 = rodar({ planilha: pl, aplicarS1: true });
  ok(!comS1.erro && existe(comS1, "Item C RENOMEADO") === 1 && !por(comS1, 3) && (comS1.exclusoes || []).some(e => e.masterlist_id === 3), "sem código + S1: vale a regra antiga (linha nova) e a antiga SAI arquivada pelo S1 — sem duplicar");
  const semS1 = rodar({ planilha: pl, aplicarS1: false });
  ok(!semS1.erro && existe(semS1, "Item C RENOMEADO") === 1 && !!por(semS1, 3) && /Exclusão protegida indisponível — NADA foi apagado/.test(semS1.log), "sem código + S1 AUSENTE: nada é apagado (a linha antiga fica; duplicata temporária, igual ao comportamento seguro do S1)");
}
{ // 4) linha sem código, paga, renomeada + S1: protegida (duplicata conhecida e documentada)
  const setup = setupBase() + "\nupdate public.masterlist set pago_item = true where id = 3;";
  const pl = BASE.map(b => ({ ceg: b.ceg, nome: b.nome, cog: b.cog, item: b.id === 3 ? "Item C RENOMEADO" : b.item, id: b.idl, pago: b.pago || b.id === 3 }));
  const o = rodar({ planilha: pl, aplicarS1: true, setup });
  ok(!o.erro && !!por(o, 3) && existe(o, "Item C RENOMEADO") === 1 && /preservados por proteção: 1/.test(o.log), "sem código + paga + S1: a antiga é PRESERVADA pelo S1 (limitação conhecida: duplicata até alguém dar um código à linha)");
}
{ // 5) código repetido NO BANCO (linhas 4 e 5), único na planilha: o S2 não casa; a linha 5 (outra joiner) nunca é confundida com a 4
  const pl = planilhaBase().map(l => l.cog === "duda" ? { ...l, item: "Item D RENOMEADO" } : l.cog === "edu" ? { ...l, id: "" } : l);
  const o = rodar({ planilha: pl, aplicarS1: true });
  ok(!o.erro && por(o, 5)?.nome_do_item === "Item E" && por(o, 5)?.cog === "edu", "código repetido no banco: a linha 5 (outra joiner) NÃO é tocada nem confundida com a 4");
  ok(existe(o, "Item D RENOMEADO") === 1 && !por(o, 4) && (o.exclusoes || []).some(e => e.masterlist_id === 4) && /3 casados pelo código \(0 com nome/.test(o.log), "código repetido no banco: a renomeação da 4 cai na regra antiga (linha nova; a antiga sai arquivada pelo S1); só as 3 linhas de código único foram casadas, sem renomeação");
}
{ // 6) código repetido NA PLANILHA (duas linhas com ABC-1): o S2 não casa nenhuma; cada uma segue a regra antiga (mesma chave => mesma linha, sem recriar)
  const pl = [...planilhaBase(), { ceg: "CEG1", nome: "Gabi", cog: "gabi", item: "Item G", id: "ABC-1" }];
  const o = rodar({ planilha: pl, aplicarS1: true });
  ok(!o.erro && por(o, 1)?.nome_do_item === "Item A" && existe(o, "Item G") === 1 && ids(o).length === 7 && /2 casados pelo código/.test(o.log), "código repetido na planilha: o código repetido NÃO casa (só ABC-2 e ABC-6 casaram); a linha 1 segue pela chave e a nova entra como NOVA, sem tomar o id da linha 1");
}
{ // 7) CEG diferente para o mesmo código: não casa (é outro item); entra como linha nova e a antiga segue a regra antiga/S1
  const pl = mudar(planilhaBase(), "ABC-1", { ceg: "OUTRO CEG" });
  const o = rodar({ planilha: pl, aplicarS1: true });
  ok(!o.erro && o.masterlist.filter(x => x.ceg === "OUTRO CEG").length === 1 && /2 casados pelo código/.test(o.log) && (o.exclusoes || []).some(e => e.masterlist_id === 1), "CEG diferente: NÃO casa pelo código (só 2 casaram); entra como linha nova e a antiga sai pela regra antiga/S1, arquivada");
  ok(!o.masterlist.some(x => x.id === 1 && x.ceg === "OUTRO CEG"), "CEG diferente: a linha 1 NÃO é reaproveitada para o outro CEG");
}
{ // 8) linha com claim, com código, renomeada: id preservado, claim intacto
  const o = rodar({ planilha: mudar(planilhaBase(), "ABC-6", { item: "Item F RENOMEADO" }), aplicarS1: true });
  ok(!o.erro && por(o, 6)?.nome_do_item === "Item F RENOMEADO" && o.claims.length === 1 && o.claims[0].masterlist_id === 6 && JSON.stringify(ids(o)) === "[1,2,3,4,5,6]", "com claim e código: o id 6 é mantido e o claim continua ligado à mesma linha");
}
{ // 9) planilha PARCIAL (só 2 linhas): S1 recusa a exclusão (job vermelho) e nada é apagado; sem S1 também nada
  const parcial = planilhaBase().slice(0, 2);
  const a = rodar({ planilha: parcial, aplicarS1: true });
  ok(!a.erro && JSON.stringify(ids(a)) === "[1,2,3,4,5,6]" && a.exitCode === 3 && /ABORTADA/.test(a.log), "planilha parcial + S1: exclusão ABORTADA (código 3) e nenhuma linha apagada");
  const b = rodar({ planilha: parcial, aplicarS1: false });
  ok(!b.erro && JSON.stringify(ids(b)) === "[1,2,3,4,5,6]", "planilha parcial + S1 ausente: nenhuma linha apagada");
}
{ // 10) ORDEM DE IMPLANTAÇÃO: código novo ANTES do SQL do S1 => nunca apaga e nunca falha; depois o SQL => passa a excluir de forma protegida
  const pl = BASE.map(b => ({ ceg: b.ceg, nome: b.nome, cog: b.cog, item: b.id === 3 ? "Item C RENOMEADO" : b.item, id: b.idl, pago: b.pago }));
  const antesDoSql = rodar({ planilha: pl, aplicarS1: false });
  ok(!antesDoSql.erro && antesDoSql.exitCode === 0 && JSON.stringify(ids(antesDoSql).slice(0, 6)) === "[1,2,3,4,5,6]", "ordem: script novo ANTES do SQL S1 => execução verde (código 0), nenhuma exclusão");
  const depois = rodar({ planilha: pl, aplicarS1: true });
  ok(!depois.erro && !por(depois, 3) && depois.exitCode === 0, "ordem: com o SQL S1 aplicado a mesma planilha passa a excluir a linha obsoleta, de forma protegida e arquivada");
}
{ // 11) idempotência: duas execuções seguidas com a mesma planilha renomeada não geram novas linhas
  const pl = mudar(planilhaBase(), "ABC-1", { item: "Item A RENOMEADO" });
  const setup2 = setupBase() + "\nupdate public.masterlist set nome_do_item = 'Item A RENOMEADO' where id = 1;";
  const o = rodar({ planilha: pl, aplicarS1: true, setup: setup2 });
  ok(!o.erro && JSON.stringify(ids(o)) === "[1,2,3,4,5,6]" && /0 inseridos/.test(o.log), "segunda execução (já renomeado): 0 inseridos, mesmos ids");
}
{ // 12) ORDEM INVERSA: o SQL do S1 aplicado enquanto o sync ANTIGO (exclusão direta) ainda está no ar: o gatilho do S1 barra a exclusão de linhas com claim; o job NÃO cai
  const pl = planilhaBase().filter(l => l.id !== "ABC-6" && l.item !== "Item C");   // sai da planilha: a linha 6 (com claim) e a 3 (livre)
  const antigoComS1 = rodar({ planilha: pl, aplicarS1: true, scriptSource: gitMain });
  ok(!antigoComS1.erro && antigoComS1.exitCode === 0 && !!por(antigoComS1, 6) && /Erro ao deletar/.test(antigoComS1.log), "sync ANTIGO + SQL S1: a exclusão do lote que contém a linha com claim é BARRADA pelo gatilho; o job segue verde (código 0) e a linha 6 e o claim ficam");
  ok(antigoComS1.claims.length === 1 && antigoComS1.claims[0].masterlist_id === 6, "sync ANTIGO + SQL S1: o claim continua ligado à linha 6");
  const antigoSemS1 = rodar({ planilha: pl, aplicarS1: false, scriptSource: gitMain });
  ok(!antigoSemS1.erro && !por(antigoSemS1, 6) && !por(antigoSemS1, 3), "(situação de hoje) sync ANTIGO sem S1: apaga as duas linhas, inclusive a com claim — o risco que o S1 elimina");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);

