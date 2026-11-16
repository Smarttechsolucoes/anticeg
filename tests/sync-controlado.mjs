// Integração do SYNC REAL (scripts/sync-masterlist.js) contra um banco local PGlite e uma planilha (CSV) fictícia. Sem rede, sem Supabase.
// Uso: node tests/sync-controlado.mjs   (precisa de @electric-sql/pglite e csv-parse)
// Prova a EXECUÇÃO CONTROLADA (16/11/2026): SYNC_SEM_EXCLUSAO, SYNC_PROTEGER (dono e pagamento), SYNC_JOINERS, SYNC_REGISTRO (plano antes, resultado e validação depois; sem registro nada é gravado)
// e que as linhas retidas (casos pendentes) não sofrem atualização indevida de dono, pagamento ou status.
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const CAB = "ABA / CEG,NOME,@,EMAIL,NOME DO ITEM,ID,PREÇO ITEM,PREÇO FRETE,PREÇO RF,INFORMAÇÕES,ITEM,FRETE,RF,ITEM DATA,FRETE DATA,RF DATA,Chegou?,NACIONAL";
const csv = linhas => [CAB, ...linhas.map(l => [l.ceg, l.nome, l.tw ?? ("@" + l.cog), l.email ?? "", l.item, l.id ?? "", l.preco ?? "10", "", "", "", l.pago ? "TRUE" : "FALSE", "FALSE", "FALSE", "", "", "", l.chegou ? "TRUE" : "FALSE", "FALSE"].join(","))].join("\n");
const sql = b => `insert into public.masterlist (id, ceg, cog, nome, nome_do_item, id_linha, valor_item, frete_inter, taxa_rf, status, pago_item) values (${b.id}, '${b.ceg}', '${b.cog}', '${b.nome}', '${b.item}', ${b.idl ? `'${b.idl}'` : "null"}, ${b.preco ?? 10}, 0, 0, '${b.status ?? "Comprado"}', ${b.pago ? "true" : "false"});`;
const dir = mkdtempSync(join(tmpdir(), "sync-controlado-"));
let n = 0;
function rodar({ planilha, banco, setupExtra = "", env = {}, semStorage = false }) {
  const arq = join(dir, `c${++n}.json`); writeFileSync(arq, JSON.stringify({ csv: csv(planilha), aplicarS1: true, semStorage, setupSql: banco.map(sql).join("\n") + "\n" + setupExtra }));
  const r = spawnSync(process.execPath, ["tests/helpers/sync-filho.mjs", arq], { cwd: RAIZ, encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } });
  const i = (r.stdout || "").lastIndexOf("@@RESULTADO@@");
  if (i < 0) return { erro: (r.stderr || r.stdout || "sem saída").slice(0, 1500), logs: [], masterlist: [], registros: {} };
  const o = JSON.parse(r.stdout.slice(i + 13)); o.log = o.logs.join("\n"); return o;
}
const por = (o, id) => o.masterlist.find(x => x.id === id);
const base = Array.from({ length: 60 }, (_, i) => i + 1).map(i => ({ id: i, ceg: "CEG1", cog: "d" + i, nome: "D" + i, item: "Item " + i, idl: "ABC-" + i }));
const plBase = () => base.map(b => ({ ceg: b.ceg, nome: b.nome, cog: b.cog, item: b.item, id: b.idl }));

{ // 1) SYNC_SEM_EXCLUSAO: 3 linhas livres ausentes da planilha, DENTRO do limite: sem o interruptor seriam arquivadas; com ele NADA é excluído e a função nem é chamada
  const livres = [300, 301, 302].map(id => ({ id, ceg: "CEG9", cog: "z" + id, nome: "Z" + id, item: "Sumido " + id, idl: "SUM-" + id }));
  const sem = rodar({ planilha: plBase(), banco: [...base, ...livres] });
  ok(!sem.erro && livres.every(l => !por(sem, l.id)) && (sem.exclusoes || []).length === 3, "controle (sem o interruptor): as 3 livres ausentes SÃO arquivadas" + (sem.erro ? " | " + sem.erro : ""));
  const o = rodar({ planilha: plBase(), banco: [...base, ...livres], env: { SYNC_SEM_EXCLUSAO: "1" } });
  ok(!o.erro && livres.every(l => por(o, l.id)) && !(o.exclusoes || []).length && /EXCLUSÕES DESLIGADAS \(SYNC_SEM_EXCLUSAO=1\): 3 linha/.test(o.log) && !/Removidos|Exclusão ABORTADA/.test(o.log), "SYNC_SEM_EXCLUSAO=1: as 3 livres continuam, nada arquivado, prune_masterlist não chamada" + (o.erro ? " | " + o.erro : ""));
}
{ // 2) SYNC_PROTEGER: atualização por chave que TROCARIA O DONO (mesmo CEG+item+nome de exibição, dono diferente na planilha) é bloqueada; sem a proteção o dono troca
  const banco = [...base, { id: 400, ceg: "CEG2", cog: "ana", nome: "Mesmo", item: "Item Y" }];
  const pl = [...plBase(), { ceg: "CEG2", nome: "Mesmo", cog: "bia", item: "Item Y", preco: "10" }];
  const sem = rodar({ planilha: pl, banco });
  ok(!sem.erro && por(sem, 400)?.cog === "bia", "controle (sem proteção): a atualização por chave troca o dono da 400 (ana → bia)" + (sem.erro ? " | " + sem.erro : ""));
  const o = rodar({ planilha: pl, banco, env: { SYNC_PROTEGER: "1" } });
  ok(!o.erro && por(o, 400)?.cog === "ana" && /PROTEÇÃO ATIVA \(SYNC_PROTEGER=1\): 1 linha\(s\) NÃO atualizadas porque o dono mudaria \(ids 400\)/.test(o.log), "SYNC_PROTEGER=1: a 400 continua da ana e o log registra o bloqueio" + (o.erro ? " | " + o.erro : ""));
}
{ // 3) SYNC_PROTEGER: pagamento marcado no banco NÃO é desmarcado pela planilha atrasada; o resto da atualização (preço) é aplicado
  const banco = [...base.filter(b => b.id !== 2), { id: 2, ceg: "CEG1", cog: "d2", nome: "D2", item: "Item 2", idl: "ABC-2", pago: true, status: "Comprado" }];
  const pl = plBase().map(l => l.id === "ABC-2" ? { ...l, preco: "55", pago: false } : l);
  const sem = rodar({ planilha: pl, banco });
  ok(!sem.erro && por(sem, 2)?.pago_item === false && Number(por(sem, 2)?.valor_item) === 55, "controle (sem proteção): a planilha desmarca o pagamento da 2" + (sem.erro ? " | " + sem.erro : ""));
  const o = rodar({ planilha: pl, banco, env: { SYNC_PROTEGER: "1" } });
  ok(!o.erro && por(o, 2)?.pago_item === true && Number(por(o, 2)?.valor_item) === 55 && /1 marcação\(ões\) de pagamento mantida\(s\).*2:pago_item/.test(o.log), "SYNC_PROTEGER=1: o pagamento da 2 continua marcado e o preço é atualizado (55)" + (o.erro ? " | " + o.erro : ""));
}
{ // 4) CASOS PENDENTES ISOLADOS: a linha retida (520, paga, dono ana) NÃO sofre atualização de dono, pagamento nem status, com ou sem as proteções
  const banco = [...base, { id: 520, ceg: "CEG2", cog: "ana", nome: "Ana", item: "Item X", idl: "ODD-7882", pago: true, status: "Envio Liberado" }];
  const pl = [...plBase(), { ceg: "CEG2", nome: "Bia", cog: "bia", item: "Item X", id: "ODD-7882", pago: false }];
  for (const env of [{}, { SYNC_PROTEGER: "1", SYNC_SEM_EXCLUSAO: "1" }]) {
    const o = rodar({ planilha: pl, banco, env });
    const x = por(o, 520);
    ok(!o.erro && x?.cog === "ana" && x?.pago_item === true && x?.status === "Envio Liberado" && !o.masterlist.some(l => l.cog === "bia"), `linha retida isolada (${Object.keys(env).length ? "com proteções" : "sem proteções"}): dono, pagamento e status intactos e nada inserido` + (o.erro ? " | " + o.erro : ""));
  }
}
{ // 5) SYNC_REGISTRO: plano (valores anteriores) ANTES, resultado e validação DEPOIS; 1 atualização + 1 inserção
  const pl = [...plBase().map(l => l.id === "ABC-5" ? { ...l, preco: "77" } : l), { ceg: "CEG4", nome: "Gabi", cog: "gabi", item: "Item Novo", id: "NOVO-1" }];
  const o = rodar({ planilha: pl, banco: base, env: { SYNC_REGISTRO: "1", SYNC_PROTEGER: "1", SYNC_SEM_EXCLUSAO: "1", SYNC_JOINERS: "nenhum" } });
  const plano = Object.entries(o.registros || {}).find(([k]) => /sync\/.*_plano\.json$/.test(k)), res = Object.entries(o.registros || {}).find(([k]) => /sync\/.*_resultado\.json$/.test(k));
  const p = plano ? JSON.parse(plano[1]) : null, r = res ? JSON.parse(res[1]) : null;
  ok(!o.erro && Number(por(o, 5)?.valor_item) === 77 && o.masterlist.filter(x => x.id_linha === "NOVO-1").length === 1, "registro: a atualização (preço da 5 → 77) e a inserção (NOVO-1, uma única vez) foram feitas" + (o.erro ? " | " + o.erro : ""));
  ok(!!p && p.atualizacoes.length === 1 && p.atualizacoes[0].id === 5 && Number(p.atualizacoes[0].antes.valor_item) === 10 && Number(p.atualizacoes[0].depois.valor_item) === 77 && p.insercoes.length === 1, "o PLANO privado tem o valor anterior (10) e o novo (77) e a inserção planejada");
  ok(!!r && r.atualizacoes[0].resultado === "aplicado" && r.validacao.atualizacoes_conferidas === 1 && r.validacao.insercoes.length === 1 && r.validacao.insercoes[0].unica === true, "o RESULTADO privado confirma a atualização conferida e a inserção única");
  ok(!o.erro && /VALIDAÇÃO POSTERIOR: 1 de 1 atualizações conferidas \(divergentes: 0\) · 1 de 1 inserções aparecem UMA única vez/.test(o.log) && o.exitCode === 0, "o log traz a validação posterior e o job termina verde");
}
{ // 6) SYNC_REGISTRO com o registro privado INDISPONÍVEL: NADA é gravado (nem atualização, nem inserção)
  const pl = [...plBase().map(l => l.id === "ABC-5" ? { ...l, preco: "77" } : l), { ceg: "CEG4", nome: "Gabi", cog: "gabi", item: "Item Novo", id: "NOVO-1" }];
  const o = rodar({ planilha: pl, banco: base, env: { SYNC_REGISTRO: "1", SYNC_SEM_EXCLUSAO: "1", SYNC_JOINERS: "nenhum" }, semStorage: true });
  ok(!o.erro && Number(por(o, 5)?.valor_item) === 10 && !o.masterlist.some(x => x.id_linha === "NOVO-1") && /Registro privado indisponível — NADA foi gravado/.test(o.log) && o.exitCode === 6, "sem registro privado: a 5 continua em 10, NOVO-1 não existe e o job falha (código 6)" + (o.erro ? " | " + o.erro : ""));
}
{ // 7) SYNC_REGISTRO: se a linha mudou entre o plano e a gravação (aqui: simulado por valor igual ao 'depois'), o estado atual é conferido; linha já no valor novo não é regravada de forma divergente
  const pl = plBase().map(l => l.id === "ABC-7" ? { ...l, preco: "33" } : l);
  const o = rodar({ planilha: pl, banco: base, env: { SYNC_REGISTRO: "1", SYNC_SEM_EXCLUSAO: "1", SYNC_JOINERS: "nenhum" } });
  const res = Object.entries(o.registros || {}).find(([k]) => /_resultado\.json$/.test(k));
  ok(!o.erro && !!res && JSON.parse(res[1]).atualizacoes.every(a => a.resultado === "aplicado") && Number(por(o, 7)?.valor_item) === 33, "uma atualização simples: aplicada e registrada" + (o.erro ? " | " + o.erro : ""));
}
{ // 8) SYNC_JOINERS: 'somente-novos' cria o cadastro que não existe e NÃO altera o existente; 'nenhum' não cria nem altera; padrão ('todos') altera
  const setup = "insert into public.joiners (cog, nome, email, twitter) values ('ana','Antigo','ana@x.com','@ana');";
  const pl = [...plBase(), { ceg: "CEG7", nome: "Ana Nova", cog: "ana", item: "Item J1", id: "J-1" }, { ceg: "CEG7", nome: "Pessoa Nova", cog: "novinha", item: "Item J2", id: "J-2" }];
  const nome = (o, cog) => (o.joiners || []).find(j => j.cog === cog)?.nome;
  const todos = rodar({ planilha: pl, banco: base, setupExtra: setup });
  ok(!todos.erro && nome(todos, "ana") === "Ana Nova" && nome(todos, "novinha") === "Pessoa Nova", "controle (todos): altera o nome da ana e cria a novinha" + (todos.erro ? " | " + todos.erro : ""));
  const sn = rodar({ planilha: pl, banco: base, setupExtra: setup, env: { SYNC_JOINERS: "somente-novos" } });
  ok(!sn.erro && nome(sn, "ana") === "Antigo" && nome(sn, "novinha") === "Pessoa Nova" && /modo somente-novos: \d+ cadastro\(s\) NOVO\(s\)/.test(sn.log), "somente-novos: a ana continua 'Antigo' e a novinha é criada" + (sn.erro ? " | " + sn.erro : ""));
  const ne = rodar({ planilha: pl, banco: base, setupExtra: setup, env: { SYNC_JOINERS: "nenhum" } });
  ok(!ne.erro && nome(ne, "ana") === "Antigo" && nome(ne, "novinha") === undefined, "nenhum: a ana continua 'Antigo' e a novinha NÃO é criada" + (ne.erro ? " | " + ne.erro : ""));
}
{ // 9) SYNC_PROTEGER: o status NÃO volta para trás (Envio Liberado → Comprado por planilha atrasada); o resto da atualização (preço) segue
  const banco = [...base.filter(b => b.id !== 9), { id: 9, ceg: "CEG1", cog: "d9", nome: "D9", item: "Item 9", idl: "ABC-9", status: "Envio Liberado" }];
  const pl = plBase().map(l => l.id === "ABC-9" ? { ...l, preco: "44" } : l);
  const sem = rodar({ planilha: pl, banco });
  ok(!sem.erro && por(sem, 9)?.status === "Comprado", "controle (sem proteção): o status da 9 volta para Comprado" + (sem.erro ? " | " + sem.erro : ""));
  const o = rodar({ planilha: pl, banco, env: { SYNC_PROTEGER: "1" } });
  ok(!o.erro && por(o, 9)?.status === "Envio Liberado" && Number(por(o, 9)?.valor_item) === 44 && /1 status mantido\(s\) porque voltaria para trás \(ids 9\)/.test(o.log), "SYNC_PROTEGER=1: a 9 continua Envio Liberado e o preço é atualizado (44)" + (o.erro ? " | " + o.erro : ""));
}
{ // 10) SYNC_PROTEGER: inserção EXCEDENTE (o dono ficaria com mais linhas no banco do que na planilha neste CEG+item) é retida; sem a proteção entraria
  const banco = [...base, { id: 700, ceg: "CEG5", cog: "eva", nome: "Eva", item: "Item P", idl: "P-1" }, { id: 701, ceg: "CEG5", cog: "eva", nome: "Eva", item: "Item P", idl: "P-1" }];
  const pl = [...plBase(), { ceg: "CEG5", nome: "Eva", cog: "eva", item: "Item P", id: "P-1" }, { ceg: "CEG5", nome: "Eva Segundo", cog: "eva", item: "Item P", id: "P-2" }];
  const sem = rodar({ planilha: pl, banco });
  ok(!sem.erro && sem.masterlist.some(x => x.id_linha === "P-2") && /INSERÇÕES EXCEDENTES: 1 de 1/.test(sem.log), "controle (sem proteção): a P-2 entra e o log avisa que é excedente" + (sem.erro ? " | " + sem.erro : ""));
  const o = rodar({ planilha: pl, banco, env: { SYNC_PROTEGER: "1" } });
  ok(!o.erro && !o.masterlist.some(x => x.id_linha === "P-2") && /INSERÇÕES EXCEDENTES: 1 de 1.*RETIDAS pela proteção/.test(o.log) && /INSERÇÕES RETIDAS \(PENDÊNCIA\): 1 linha/.test(o.log), "SYNC_PROTEGER=1: a P-2 fica retida como pendência" + (o.erro ? " | " + o.erro : ""));
}
console.log(falhas ?`\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
