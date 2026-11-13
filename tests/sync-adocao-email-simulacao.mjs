// Integração do SYNC REAL (scripts/sync-masterlist.js) contra um banco local PGlite e uma planilha (CSV) fictícia. Sem rede, sem Supabase.
// Uso: node tests/sync-adocao-email-simulacao.mjs   (precisa de @electric-sql/pglite e csv-parse instalados: npm i --no-save @electric-sql/pglite csv-parse)
// Prova, no comportamento REAL do script (13/11/2026):
//   1) ADOÇÃO DO CÓDIGO: linha antiga SEM código + planilha com o código novo e o NOME de exibição mudado => antes o sync inseria uma CÓPIA e deixava a antiga para trás; agora a antiga recebe o código (mesmo id). Idempotente.
//   2) E-MAIL "#N/A" / inválido da planilha não sobrescreve o e-mail do cadastro (antes gravava "#n/a"); e-mail válido novo continua atualizando; "#N/A" no NOME não vira nome do cadastro.
//   3) SIMULAÇÃO (SYNC_DRY_RUN=1): faz o casamento todo e relata o plano, mas NÃO grava nada (nem masterlist, nem joiners, nem exclusão protegida).
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
// script do sync ANTES desta correção (commit 2d538b2 = main de 13/11/2026), usado só para mostrar o comportamento ANTERIOR
const scriptAntigo = spawnSync("git", ["show", "2d538b2:scripts/sync-masterlist.js"], { encoding: "utf8", cwd: RAIZ }).stdout;
if (!scriptAntigo.includes("createClient")) { console.error("não consegui ler o script antigo (git show 2d538b2)"); process.exit(2); }
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const CAB = "ABA / CEG,NOME,@,EMAIL,NOME DO ITEM,ID,PREÇO ITEM,PREÇO FRETE,PREÇO RF,INFORMAÇÕES,ITEM,FRETE,RF,ITEM DATA,FRETE DATA,RF DATA,Chegou?,NACIONAL";
const csv = linhas => [CAB, ...linhas.map(l => [l.ceg, l.nome, "@" + l.cog, l.email ?? "", l.item, l.id ?? "", l.preco ?? "10", "", "", "", l.pago ? "TRUE" : "FALSE", "FALSE", "FALSE", l.itemData ?? "", "", "", "FALSE", "FALSE"].join(","))].join("\n");

// banco ANTES: a linha 3 (cris) nasceu SEM código, quando a planilha ainda não tinha o ID
const BASE = [
  { id: 1, ceg: "CEG1", cog: "ana", nome: "Ana", item: "Item A", idl: "ABC-1" },
  { id: 2, ceg: "CEG1", cog: "bia", nome: "Bia", item: "Item B", idl: "ABC-2", pago: true },
  { id: 3, ceg: "CEG1", cog: "cris", nome: "Cris", item: "Item C", idl: null },
  { id: 6, ceg: "CEG2", cog: "fer", nome: "Fer", item: "Item F", idl: "ABC-6" },
];
const sql = b => `insert into public.masterlist (id, ceg, cog, nome, nome_do_item, id_linha, valor_item, status, pago_item) values (${b.id}, '${b.ceg}', '${b.cog}', '${b.nome}', '${b.item}', ${b.idl ? `'${b.idl}'` : "null"}, 10, 'Comprado', ${b.pago ? "true" : "false"});`;
const setupBase = (extra = "") => BASE.map(sql).join("\n") + "\n" + extra;
const planilhaBase = () => BASE.map(b => ({ ceg: b.ceg, nome: b.nome, cog: b.cog, item: b.item, id: b.idl, pago: b.pago }));
// a planilha de hoje: a cris GANHOU o código ABC-3 e o nome de exibição passou de "Cris" para "Cristina" (a chave ceg|item|nome deixa de casar)
const comCodigoNovo = (pl = planilhaBase()) => pl.map(l => l.cog === "cris" ? { ...l, nome: "Cristina", id: "ABC-3" } : l);

const dir = mkdtempSync(join(tmpdir(), "sync-adocao-"));
let n = 0;
function rodar({ planilha, aplicarS1 = false, setup = setupBase(), scriptSource, env = {} }) {
  const arq = join(dir, `c${++n}.json`); writeFileSync(arq, JSON.stringify({ csv: csv(planilha), aplicarS1, setupSql: setup, scriptSource }));
  const r = spawnSync(process.execPath, ["tests/helpers/sync-filho.mjs", arq], { cwd: RAIZ, encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } });
  const i = (r.stdout || "").lastIndexOf("@@RESULTADO@@");
  if (i < 0) return { erro: (r.stderr || r.stdout || "sem saída").slice(0, 1500), logs: [], masterlist: [], joiners: [] };
  const o = JSON.parse(r.stdout.slice(i + 13)); o.log = o.logs.join("\n");
  if (process.env.SYNC_DEBUG) console.log(`--- cenário ${n}: ids=${JSON.stringify(ids(o))} exit=${o.exitCode}\n` + o.logs.filter(l => /Masterlist:|SIMULA|INSERIDAS|candidato|Removid|ABORT/.test(l)).join("\n"));
  return o;
}
const ids = o => o.masterlist.map(x => x.id).sort((a, b) => a - b);
const por = (o, id) => o.masterlist.find(x => x.id === id);
const cont = (o, item) => o.masterlist.filter(x => x.nome_do_item === item).length;
const joiner = (o, cog) => o.joiners.find(j => j.cog === cog);

{ // 1) a causa das duplicações de 13/11 e a correção
  const pl = comCodigoNovo();
  const antes = rodar({ planilha: pl, scriptSource: scriptAntigo });
  ok(!antes.erro && cont(antes, "Item C") === 2 && por(antes, 3)?.id_linha === null && antes.masterlist.some(x => x.id_linha === "ABC-3" && x.id !== 3),
    "ANTES (main de 13/11): a linha 3 fica SEM código e o sync INSERE uma CÓPIA com o código ABC-3 — a duplicação" + (antes.erro ? " | " + antes.erro : ""));
  for (const s1 of [true, false]) {
    const o = rodar({ planilha: pl, aplicarS1: s1 });
    ok(!o.erro && JSON.stringify(ids(o)) === "[1,2,3,6]" && cont(o, "Item C") === 1 && por(o, 3)?.id_linha === "ABC-3" && por(o, 3)?.nome === "Cristina" && por(o, 3)?.cog === "cris",
      `DEPOIS (${s1 ? "com" : "sem"} S1): a linha 3 RECEBE o código e o novo nome — mesmo id, mesmo dono, nenhuma cópia` + (o.erro ? " | " + o.erro : ""));
    ok(/0 inseridos/.test(o.log) && /1 linha\(s\) antiga\(s\) sem código adotada\(s\)/.test(o.log) && /Nenhum registro candidato/.test(o.log) && !(o.exclusoes || []).length, `DEPOIS (${s1 ? "com" : "sem"} S1): o log informa 1 adoção, 0 inseridos e nada candidato à remoção`);
  }
  // idempotência: o banco já como ficou depois da 1ª execução => a 2ª não cria nem adota nada
  const jaAdotado = setupBase("update public.masterlist set id_linha = 'ABC-3', nome = 'Cristina' where id = 3;");
  const segunda = rodar({ planilha: pl, aplicarS1: true, setup: jaAdotado });
  ok(!segunda.erro && JSON.stringify(ids(segunda)) === "[1,2,3,6]" && /0 inseridos/.test(segunda.log) && /0 linha\(s\) antiga\(s\) sem código adotada\(s\)/.test(segunda.log) && /4 casados pelo código/.test(segunda.log),
    "2ª execução seguida (banco já adotado): 0 inseridos, 0 adoções, as 4 linhas casam pelo código — idempotente" + (segunda.erro ? " | " + segunda.erro : ""));
}
{ // 2) linha com PAGAMENTO e CLAIM: a adoção preserva id, pagamento e claim
  const setup = setupBase("update public.masterlist set pago_item = true where id = 3;\ninsert into public.claims (masterlist_id, status) values (3, 'aprovado');");
  const pl = comCodigoNovo().map(l => l.cog === "cris" ? { ...l, pago: true } : l);
  const o = rodar({ planilha: pl, aplicarS1: true, setup });
  ok(!o.erro && por(o, 3)?.id_linha === "ABC-3" && por(o, 3)?.pago_item === true && o.claims.length === 1 && o.claims[0].masterlist_id === 3 && JSON.stringify(ids(o)) === "[1,2,3,6]",
    "linha paga e com claim: a adoção mantém o id 3, o pagamento e o claim ligado à mesma linha" + (o.erro ? " | " + o.erro : ""));
}
{ // 3) casos em que NÃO pode adotar (na dúvida, vale o comportamento antigo)
  const donoOutro = comCodigoNovo().map(l => l.cog === "cris" ? { ...l, cog: "dani", nome: "Dani" } : l);
  const a = rodar({ planilha: donoOutro });
  ok(!a.erro && por(a, 3)?.cog === "cris" && por(a, 3)?.id_linha === null && a.masterlist.some(x => x.cog === "dani" && x.id_linha === "ABC-3"), "dono DIFERENTE: a linha 3 (cris) NÃO é adotada pela dani; a dani recebe a sua linha nova" + (a.erro ? " | " + a.erro : ""));
  const itemOutro = comCodigoNovo().map(l => l.cog === "cris" ? { ...l, item: "Item C OUTRO" } : l);
  const b = rodar({ planilha: itemOutro });
  ok(!b.erro && por(b, 3)?.id_linha === null && por(b, 3)?.nome_do_item === "Item C" && cont(b, "Item C OUTRO") === 1, "item DIFERENTE: a linha 3 NÃO é adotada (entra uma linha nova)" + (b.erro ? " | " + b.erro : ""));
  const codigoNoBanco = comCodigoNovo().map(l => l.cog === "cris" ? { ...l, id: "ABC-1" } : l);   // o código ABC-1 já pertence à linha 1 (ana)
  const c = rodar({ planilha: codigoNoBanco });
  ok(!c.erro && por(c, 1)?.cog === "ana" && por(c, 3)?.id_linha === null, "código que o banco JÁ tem em outra linha: nada é adotado nem trocado de dono" + (c.erro ? " | " + c.erro : ""));
}
{ // 4) COMPRA REPETIDA legítima: duas unidades iguais da mesma pessoa, ambas sem código no banco; a planilha dá um código a cada uma => cada uma casa pela CHAVE, 0 cópias, 0 adoções
  const setup = setupBase(sql({ id: 31, ceg: "CEG1", cog: "cris", nome: "Cris", item: "Item C", idl: null }));
  const pl = [...planilhaBase().map(l => l.cog === "cris" ? { ...l, id: "ABC-3" } : l), { ceg: "CEG1", nome: "Cris", cog: "cris", item: "Item C", id: "ABC-31" }];
  const o = rodar({ planilha: pl, aplicarS1: true, setup });
  ok(!o.erro && JSON.stringify(ids(o)) === "[1,2,3,6,31]" && por(o, 3)?.id_linha === "ABC-3" && por(o, 31)?.id_linha === "ABC-31" && /0 inseridos/.test(o.log) && /0 linha\(s\) antiga\(s\) sem código adotada\(s\)/.test(o.log),
    "compra repetida (2 unidades iguais): as duas continuam, cada uma com o seu código, 0 inseridos e 0 adoções" + (o.erro ? " | " + o.erro : ""));
}
{ // 5) e-mail "#N/A" e inválido da planilha NÃO sobrescrevem o e-mail do cadastro; e-mail válido novo continua atualizando
  const joinersSql = `insert into public.joiners (cog, nome, email, twitter) values ('ana', 'Ana', 'ana@real.com', '@ana'), ('bia', 'Bia', 'bia@velho.com', '@bia'), ('cris', 'Cris', 'cris@velho.com', '@cris'), ('fer', 'Fer', 'fer@velho.com', '@fer');`;
  const pl = planilhaBase().map(l => ({ ana: { ...l, email: "#N/A" }, bia: { ...l, email: "bia@novo.com" }, cris: { ...l, email: "sem-arroba" }, fer: { ...l, email: "" } })[l.cog] || l);
  pl.push({ ceg: "CEG3", nome: "#N/A", cog: "eva", item: "Item E", id: "ABC-E", email: "#N/A" });
  const antes = rodar({ planilha: pl, scriptSource: scriptAntigo, setup: setupBase(joinersSql) });
  ok(!antes.erro && joiner(antes, "ana")?.email === "#n/a", "ANTES (main de 13/11): o e-mail real da ana (ana@real.com) é SOBRESCRITO por \"#n/a\"" + (antes.erro ? " | " + antes.erro : ""));
  const o = rodar({ planilha: pl, setup: setupBase(joinersSql) });
  ok(!o.erro && joiner(o, "ana")?.email === "ana@real.com", "DEPOIS: \"#N/A\" no EMAIL não toca o e-mail da ana" + (o.erro ? " | " + o.erro : ""));
  ok(joiner(o, "bia")?.email === "bia@novo.com", "DEPOIS: e-mail válido NOVO continua atualizando (bia)");
  ok(joiner(o, "cris")?.email === "cris@velho.com", "DEPOIS: e-mail inválido (sem @) não toca o e-mail da cris");
  ok(joiner(o, "fer")?.email === "fer@velho.com", "DEPOIS: célula vazia continua preservando o e-mail (fer)");
  ok(joiner(o, "eva") && joiner(o, "eva").nome !== "#N/A" && !String(joiner(o, "eva").email || "").startsWith("#"), "DEPOIS: \"#N/A\" no NOME e no EMAIL de uma pessoa nova não vira nome nem e-mail do cadastro");
}
{ // 6) SIMULAÇÃO (SYNC_DRY_RUN=1): relata o plano e NÃO grava nada
  const pl = [...comCodigoNovo(), { ceg: "CEG9", nome: "Gabi", cog: "gabi", item: "Item Novo", id: "NOVO-1" }].filter(l => l.cog !== "bia");   // 1 adoção, 1 nova, 1 ausente (a bia, paga)
  const joinersSql = "insert into public.joiners (cog, nome, email, twitter) values ('ana', 'Ana', 'ana@real.com', '@ana');";
  const o = rodar({ planilha: pl, aplicarS1: true, setup: setupBase(joinersSql), env: { SYNC_DRY_RUN: "1" } });
  ok(!o.erro && JSON.stringify(ids(o)) === "[1,2,3,6]" && por(o, 3)?.id_linha === null && por(o, 3)?.nome === "Cris" && !(o.exclusoes || []).length, "simulação: a masterlist fica EXATAMENTE como estava (nada atualizado, inserido nem apagado)" + (o.erro ? " | " + o.erro : ""));
  ok(o.joiners.length === 1 && o.joiners[0].cog === "ana", "simulação: nenhuma joiner foi criada/alterada");
  ok(/=== SIMULAÇÃO/.test(o.log) && /1 linha\(s\) antiga\(s\) sem código adotada/.test(o.log) && /SIMULAÇÃO: \d+ linha\(s\) SERIAM atualizadas e 1 SERIAM inseridas/.test(o.log) && /NOVO-1 \| CEG9 \| Item Novo/.test(o.log) && /a exclusão protegida NÃO foi chamada/.test(o.log),
    "simulação: o log relata a adoção, a linha que SERIA inserida (sem dono) e que a exclusão protegida não foi chamada");
  ok(!/ana@real|gabi/i.test(o.logs.filter(l => /INSERIDAS|NOVO-1/.test(l)).join("\n")), "simulação: o plano de inserções não expõe dono nem e-mail");
  const real = rodar({ planilha: pl, aplicarS1: true, setup: setupBase(joinersSql) });
  ok(!real.erro && !!por(real, 3) && por(real, 3).id_linha === "ABC-3" && real.masterlist.some(x => x.id_linha === "NOVO-1") && !!por(real, 2), "(controle) sem a simulação o mesmo cenário grava: adota a 3, insere a nova e a bia (paga) é PRESERVADA pela exclusão protegida" + (real.erro ? " | " + real.erro : ""));
}
{ // 7) DATA SEM ANO ("20/12"): o ano que o banco já tem para o mesmo dia/mês é MANTIDO (antes, toda data assim era reescrita com o ano da execução)
  const setup = setupBase("update public.masterlist set venc_item = '2025-12-20' where id = 1;");
  const pl = planilhaBase().map(l => l.cog === "ana" ? { ...l, itemData: "20/12" } : l);
  const antes = rodar({ planilha: pl, scriptSource: scriptAntigo, setup });
  const ano = new Date().getFullYear();
  ok(!antes.erro && String(antes.masterlist.find(x => x.id === 1)?.venc_item).slice(0, 10) === `${ano}-12-20`, "ANTES: a data \"20/12\" (banco: 2025-12-20) é REESCRITA com o ano da execução (" + ano + ")" + (antes.erro ? " | " + antes.erro : ""));
  const o = rodar({ planilha: pl, setup });
  ok(!o.erro && String(o.masterlist.find(x => x.id === 1)?.venc_item).slice(0, 10) === "2025-12-20", "DEPOIS: a data \"20/12\" mantém o ano que o banco já tem (2025-12-20)" + (o.erro ? " | " + o.erro : ""));
  const nova = rodar({ planilha: pl, setup: setupBase() });
  ok(!nova.erro && String(nova.masterlist.find(x => x.id === 1)?.venc_item).slice(0, 10) === `${ano}-12-20`, "DEPOIS: data realmente NOVA (o banco não tinha) usa o ano atual (" + ano + ")" + (nova.erro ? " | " + nova.erro : ""));
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
