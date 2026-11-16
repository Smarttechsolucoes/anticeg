// Integração do SYNC REAL (scripts/sync-masterlist.js) contra um banco local PGlite e uma planilha (CSV) fictícia. Sem rede, sem Supabase.
// Uso: node tests/sync-retencao-e-limite.mjs   (precisa de @electric-sql/pglite e csv-parse)
// Prova, no comportamento REAL do script (15/11/2026):
//   1) INSERÇÃO SUSPEITA RETIDA: linha da planilha cujo CÓDIGO já existe em linha que a planilha não reconhece (dono diferente), ou que tem o mesmo CEG + item de linha sem par, NÃO é inserida
//      e a linha antiga NÃO é apagada: vira pendência no log. Compra nova sem colisão continua sendo inserida.
//   2) LIMITE DA EXCLUSÃO: mais candidatas LIVRES que o limite => a exclusão protegida aborta (limite_excedido) e não apaga NADA, mas as atualizações e as inserções legítimas JÁ foram feitas e o job termina verde.
//      Candidatas protegidas (pagas) não contam para o limite. Dentro do limite, a exclusão arquiva e apaga só as livres.
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const CAB = "ABA / CEG,NOME,@,EMAIL,NOME DO ITEM,ID,PREÇO ITEM,PREÇO FRETE,PREÇO RF,INFORMAÇÕES,ITEM,FRETE,RF,ITEM DATA,FRETE DATA,RF DATA,Chegou?,NACIONAL";
const csv = linhas => [CAB, ...linhas.map(l => [l.ceg, l.nome, l.tw ?? ("@" + l.cog), l.email ?? "", l.item, l.id ?? "", l.preco ?? "10", "", "", "", l.pago ? "TRUE" : "FALSE", "FALSE", "FALSE", "", "", "", "FALSE", "FALSE"].join(","))].join("\n");
const sql = b => `insert into public.masterlist (id, ceg, cog, nome, nome_do_item, id_linha, valor_item, status, pago_item) values (${b.id}, '${b.ceg}', '${b.cog}', '${b.nome}', '${b.item}', ${b.idl ? `'${b.idl}'` : "null"}, ${b.preco ?? 10}, 'Comprado', ${b.pago ? "true" : "false"});`;
const dir = mkdtempSync(join(tmpdir(), "sync-retencao-"));
let n = 0;
function rodar({ planilha, banco, setupExtra = "", env = {} }) {
  const arq = join(dir, `c${++n}.json`); writeFileSync(arq, JSON.stringify({ csv: csv(planilha), aplicarS1: true, setupSql: banco.map(sql).join("\n") + "\n" + setupExtra }));
  const r = spawnSync(process.execPath, ["tests/helpers/sync-filho.mjs", arq], { cwd: RAIZ, encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } });
  const i = (r.stdout || "").lastIndexOf("@@RESULTADO@@");
  if (i < 0) return { erro: (r.stderr || r.stdout || "sem saída").slice(0, 1500), logs: [], masterlist: [] };
  const o = JSON.parse(r.stdout.slice(i + 13)); o.log = o.logs.join("\n"); return o;
}
const ids = o => o.masterlist.map(x => x.id).sort((a, b) => a - b);
const por = (o, id) => o.masterlist.find(x => x.id === id);

// Banco base: 60 linhas "casadas" com a planilha (ABC-1..60, um dono cada). O tamanho importa: a exclusão protegida recusa planilha com menos de 50% das linhas do banco.
const base = Array.from({ length: 60 }, (_, i) => i + 1).map(i => ({ id: i, ceg: "CEG1", cog: "d" + i, nome: "D" + i, item: "Item " + i, idl: "ABC-" + i }));
const plBase = () => base.map(b => ({ ceg: b.ceg, nome: b.nome, cog: b.cog, item: b.item, id: b.idl }));

{ // 1) o CÓDIGO da planilha já existe numa linha do banco que a planilha não reconhece (dono diferente)  => retida
  const banco = [...base, { id: 520, ceg: "CEG2", cog: "ana", nome: "Ana", item: "Item X", idl: "ODD-7882" }];
  const pl = [...plBase(), { ceg: "CEG2", nome: "Bia", cog: "bia", item: "Item X", id: "ODD-7882" }];   // a planilha deu o item à bia, com o MESMO código
  const o = rodar({ planilha: pl, banco });
  ok(!o.erro && ids(o).length === 61 && !!por(o, 520) && por(o, 520)?.cog === "ana" && por(o, 520)?.id_linha === "ODD-7882", "código repetido com dono diferente: NADA é inserido e a linha 520 (ana) continua intacta" + (o.erro ? " | " + o.erro : ""));
  ok(!o.erro && /INSERÇÕES RETIDAS \(PENDÊNCIA\): 1 linha/.test(o.log) && /ODD-7882 \| CEG2 \| Item X \|.*ids 520/.test(o.log) && /0 inseridos/.test(o.log), "o log registra a pendência (código | CEG | item | motivo | ids do banco) e '0 inseridos'");
  ok(!o.erro && !(o.exclusoes || []).length && !/Candidatas à remoção/.test(o.log), "a linha 520 NÃO é candidata à exclusão (nada arquivado)");
  ok(!/\bana\b|\bbia\b|d\d@/i.test(o.logs.filter(l => /RETIDAS|ODD-7882/.test(l)).join("\n")), "a pendência no log não expõe o dono (nem @, nem nome)");
}
{ // 2) mesmo CEG + item, SEM código em comum, de dono diferente, linha antiga ausente da planilha => retida (pode ser troca de dono ou compra nova: sem prova)
  const banco = [...base, { id: 521, ceg: "CEG2", cog: "ana", nome: "Ana", item: "ZIP UP", idl: "OLD-1" }, { id: 522, ceg: "CEG2", cog: "ana", nome: "Ana", item: "ZIP UP", idl: "OLD-2" }];
  const pl = [...plBase(), { ceg: "CEG2", nome: "Bia", cog: "bia", item: "ZIP UP", id: "NEW-9" }];
  const o = rodar({ planilha: pl, banco });
  ok(!o.erro && ids(o).length === 62 && !!por(o, 521) && !!por(o, 522) && /INSERÇÕES RETIDAS \(PENDÊNCIA\): 1 linha\(s\) da planilha NÃO foram inseridas e 2 linha\(s\) do banco/.test(o.log) && !(o.exclusoes || []).length,
    "mesmo CEG+item sem par: nada inserido, as 2 linhas antigas (521 e 522) ficam e NÃO entram na exclusão" + (o.erro ? " | " + o.erro : ""));
}
{ // 3) controle: compra NOVA sem nenhuma colisão continua sendo inserida; e uma linha que a planilha removeu e nada colide segue a regra de sempre (arquivada)
  const banco = [...base, { id: 523, ceg: "CEG3", cog: "eva", nome: "Eva", item: "Item Sumido", idl: "S-1" }];
  const pl = [...plBase(), { ceg: "CEG4", nome: "Gabi", cog: "gabi", item: "Item Novo", id: "NOVO-1" }];
  const o = rodar({ planilha: pl, banco });
  ok(!o.erro && /1 inseridos/.test(o.log) && o.masterlist.some(x => x.id_linha === "NOVO-1") && !/INSERÇÕES RETIDAS/.test(o.log), "compra nova sem colisão: continua inserida (nenhuma retenção)" + (o.erro ? " | " + o.erro : ""));
  ok(!o.erro && !por(o, 523) && (o.exclusoes || []).some(x => Number(x.masterlist_id) === 523), "linha ausente da planilha, livre e sem colisão: segue a regra de sempre (arquivada e removida pela exclusão protegida)");
}
{ // 4) LIMITE: 30 candidatas LIVRES (> 25) + 1 atualização + 1 inserção legítima => a exclusão aborta, mas a atualização e a inserção JÁ foram feitas; exit code 0
  const livres = Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, ceg: "CEG9", cog: "z" + i, nome: "Z" + i, item: "Sumido " + i, idl: "SUM-" + i }));
  const banco = [...base, ...livres];
  const pl = plBase().map(l => l.cog === "d1" ? { ...l, preco: "99" } : l);
  pl.push({ ceg: "CEG4", nome: "Gabi", cog: "gabi", item: "Item Novo", id: "NOVO-1" });
  const o = rodar({ planilha: pl, banco });
  ok(!o.erro && Number(por(o, 1)?.valor_item) === 99, "limite excedido: a ATUALIZAÇÃO (preço da linha 1) foi gravada" + (o.erro ? " | " + o.erro : ""));
  ok(!o.erro && o.masterlist.some(x => x.id_linha === "NOVO-1"), "limite excedido: a INSERÇÃO legítima (NOVO-1) foi feita");
  ok(!o.erro && livres.every(l => por(o, l.id)) && !(o.exclusoes || []).length && /limite_excedido/.test(o.log), "limite excedido: as 30 candidatas continuam no banco, nada arquivado, motivo limite_excedido no log");
  ok(!o.erro && o.exitCode === 0, "limite excedido: o job termina VERDE (exit 0); é só um aviso" + (o.erro ? " | " + o.erro : ""));
}
{ // 5) Candidatas PROTEGIDAS (pagas) não contam para o limite: 40 pagas + 3 livres => só as 3 livres são arquivadas; as 40 pagas ficam
  const pagas = Array.from({ length: 40 }, (_, i) => ({ id: 200 + i, ceg: "CEG9", cog: "p" + i, nome: "P" + i, item: "Pago " + i, idl: "PAG-" + i, pago: true }));
  const livres = Array.from({ length: 3 }, (_, i) => ({ id: 300 + i, ceg: "CEG9", cog: "l" + i, nome: "L" + i, item: "Livre " + i, idl: "LIV-" + i }));
  const o = rodar({ planilha: plBase(), banco: [...base, ...pagas, ...livres] });
  ok(!o.erro && pagas.every(l => por(o, l.id)) && livres.every(l => !por(o, l.id)) && (o.exclusoes || []).length === 3, "40 pagas + 3 livres ausentes: as 40 pagas ficam; as 3 livres são arquivadas" + (o.erro ? " | " + o.erro : ""));
}
{ // 6) SIMULAÇÃO mede quantas candidatas estão LIVRES e diz se a exclusão abortaria (sem apagar nada)
  const livres = Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, ceg: "CEG9", cog: "z" + i, nome: "Z" + i, item: "Sumido " + i, idl: "SUM-" + i }));
  const pagas = Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, ceg: "CEG9", cog: "p" + i, nome: "P" + i, item: "Pago " + i, idl: "PAG-" + i, pago: true }));
  const o = rodar({ planilha: plBase(), banco: [...base, ...livres, ...pagas], env: { SYNC_DRY_RUN: "1" } });
  ok(!o.erro && /35 candidata\(s\); 30 LIVRE\(S\)/.test(o.log) && /pagamento_registrado":5/.test(o.log) && /ABORTARIA a exclusão/.test(o.log) && !(o.exclusoes || []).length && ids(o).length === 95, "simulação: 35 candidatas, 30 livres + 5 protegidas, 'ABORTARIA', nada apagado" + (o.erro ? " | " + o.erro : ""));
}
{ // 7) CÓPIA PROVADA (1): duas linhas do banco com o MESMO CEG+item+código+dono (uma compra registrada duas vezes) não são "troca de dono": outra pessoa no mesmo CEG+item É inserida
  const banco = [...base, { id: 600, ceg: "CEG7", cog: "carla", nome: "Carla", item: "Item K", idl: "K-1" }, { id: 601, ceg: "CEG7", cog: "carla", nome: "Carla", item: "Item K", idl: "K-1" }];
  const pl = [...plBase(), { ceg: "CEG7", nome: "Carla", cog: "carla", item: "Item K", id: "K-1" }, { ceg: "CEG7", nome: "Dora", cog: "dora", item: "Item K", id: "K-2" }];
  const o = rodar({ planilha: pl, banco });
  ok(!o.erro && o.masterlist.some(x => x.cog === "dora" && x.id_linha === "K-2") && !/INSERÇÕES RETIDAS/.test(o.log) && /CÓPIAS PROVADAS: 1 linha/.test(o.log), "cópia provada (mesmo código e dono): a compra da Dora É inserida, sem retenção" + (o.erro ? " | " + o.erro : ""));
  ok(!o.erro && o.masterlist.some(x => x.cog === "carla" && x.id_linha === "K-1"), "a Carla continua com a linha K-1 (a cópia só sai pela exclusão protegida, que respeita pagamento e limite)");
}
{ // 8) CÓPIA PROVADA (2): o dono da linha antiga é o @ DIGITADO na planilha, e o e-mail da linha resolve para OUTRO cadastro (a mesma pessoa, que já tem a linha pareada): a linha com o @ antigo não é troca de dono
  const banco = [...base, { id: 610, ceg: "CEG8", cog: "ana", nome: "Ana", item: "Item A", idl: "A-1" }, { id: 611, ceg: "CEG8", cog: "ana.antiga", nome: "Ana", item: "Item A" }];
  const pl = [...plBase(), { ceg: "CEG8", nome: "Ana", cog: "ana", tw: "@ana.antiga", email: "ana@x.com", item: "Item A", id: "A-1" }, { ceg: "CEG8", nome: "Bia", cog: "bia", item: "Item A", id: "A-9" }];
  const o = rodar({ planilha: pl, banco, setupExtra: "insert into public.joiners (cog, nome, email, twitter) values ('ana','Ana','ana@x.com','ana');" });
  ok(!o.erro && o.masterlist.some(x => x.cog === "bia" && x.id_linha === "A-9") && !/INSERÇÕES RETIDAS/.test(o.log) && /CÓPIAS PROVADAS: 1 linha/.test(o.log), "apelido (@ antigo) da mesma pessoa: a compra da Bia É inserida" + (o.erro ? " | " + o.erro : ""));
  ok(!o.erro && !!por(o, 610) && por(o, 610)?.cog === "ana", "a linha pareada da Ana (610) fica intacta");
}
{ // 9) REPASSE / TROCA DE DONO sem prova: a Ana tem 2 linhas (T-1 pareada, T-2 sem par) e a planilha dá um item NOVO (T-3) à Bia: pode ser a T-2 trocando de dono => RETIDA
  const banco = [...base, { id: 630, ceg: "CEG6", cog: "ana", nome: "Ana", item: "Item T", idl: "T-1" }, { id: 631, ceg: "CEG6", cog: "ana", nome: "Ana", item: "Item T", idl: "T-2" }];
  const pl = [...plBase(), { ceg: "CEG6", nome: "Ana", cog: "ana", item: "Item T", id: "T-1" }, { ceg: "CEG6", nome: "Bia", cog: "bia", item: "Item T", id: "T-3" }];
  const o = rodar({ planilha: pl, banco });
  ok(!o.erro && !o.masterlist.some(x => x.id_linha === "T-3") && !!por(o, 631) && /INSERÇÕES RETIDAS \(PENDÊNCIA\): 1 linha/.test(o.log) && !/CÓPIAS PROVADAS/.test(o.log), "troca de dono sem prova (T-2 pode ter passado à Bia): NADA é inserido e a 631 fica" + (o.erro ? " | " + o.erro : ""));
}
{ // 10) COMPRA REPETIDA da mesma pessoa + linha de OUTRO dono sem par no mesmo CEG+item: a linha do outro dono não é cópia => RETIDA (a ordem não prova qual é qual)
  const banco = [...base, { id: 640, ceg: "CEG5", cog: "eva", nome: "Eva", item: "Item P", idl: "P-1" }, { id: 641, ceg: "CEG5", cog: "fabi", nome: "Fabi", item: "Item P", idl: "F-1" }];
  const pl = [...plBase(), { ceg: "CEG5", nome: "Eva", cog: "eva", item: "Item P", id: "P-1" }, { ceg: "CEG5", nome: "Eva", cog: "eva", item: "Item P", id: "P-2" }];
  const o = rodar({ planilha: pl, banco });
  ok(!o.erro && !o.masterlist.some(x => x.id_linha === "P-2") && !!por(o, 641) && /INSERÇÕES RETIDAS \(PENDÊNCIA\): 1 linha/.test(o.log), "compra repetida + linha de outro dono sem par: retida (nada inserido, a 641 fica)" + (o.erro ? " | " + o.erro : ""));
}
{ // 11) cópia provada JUNTO com uma linha de outro dono sem par: a segunda continua impedindo a inserção
  const banco = [...base, { id: 650, ceg: "CEG4X", cog: "carla", nome: "Carla", item: "Item Q", idl: "Q-1" }, { id: 651, ceg: "CEG4X", cog: "carla", nome: "Carla", item: "Item Q", idl: "Q-1" }, { id: 652, ceg: "CEG4X", cog: "gil", nome: "Gil", item: "Item Q", idl: "Q-7" }];
  const pl = [...plBase(), { ceg: "CEG4X", nome: "Carla", cog: "carla", item: "Item Q", id: "Q-1" }, { ceg: "CEG4X", nome: "Dora", cog: "dora", item: "Item Q", id: "Q-2" }];
  const o = rodar({ planilha: pl, banco });
  ok(!o.erro && !o.masterlist.some(x => x.id_linha === "Q-2") && !!por(o, 652) && /INSERÇÕES RETIDAS \(PENDÊNCIA\): 1 linha/.test(o.log), "cópia provada + linha de outro dono sem par: continua retida (a 652 fica)" + (o.erro ? " | " + o.erro : ""));
}
console.log(falhas ?`\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
