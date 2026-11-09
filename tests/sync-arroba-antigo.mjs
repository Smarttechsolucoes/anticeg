// SYNC REAL (scripts/sync-masterlist.js) contra um banco local (PGlite): a planilha ainda mostra o @ ANTIGO de quem trocou de @.
// Prova: o cadastro original e o cog ficam; nada é movido nem criado; o @ de hoje do cadastro não é sobrescrito; mais de um cadastro possível vira CONFLITO registrado (sem mover, criar ou apagar);
// mudanças sucessivas, @ de hoje que vence o antigo, duas rodadas seguidas, histórico ausente (comportamento de antes) e erro de leitura (nada é gravado).
// Uso: node tests/sync-arroba-antigo.mjs   (sem rede, sem Supabase, dados fictícios)
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const CAB = "ABA / CEG,NOME,@,EMAIL,NOME DO ITEM,ID,PREÇO ITEM,PREÇO FRETE,PREÇO RF,INFORMAÇÕES,ITEM,FRETE,RF,ITEM DATA,FRETE DATA,RF DATA,Chegou?,NACIONAL";
const csv = linhas => [CAB, ...linhas.map(l => [l.ceg ?? "CEG1", l.nome, l.arroba, l.email ?? "", l.item, l.id, "10", "", "", "", "FALSE", "FALSE", "FALSE", "", "", "", "FALSE", "FALSE"].join(","))].join("\n");
const q = v => v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'";
const dir = mkdtempSync(join(tmpdir(), "sync-aa-")); let n = 0;

// cen: { joiners:[{cog,nome,email,twitter}], itens:[{cog,nome,item,idl}], trocas:[{cog,de,para}], via:'updates'|'perfil'|'nenhuma'|'quebrada', planilha, aplicarS1 }
function setup(cen) {
  const s = [];
  for (const j of cen.joiners) s.push(`insert into public.joiners (cog, nome, email, twitter) values (${q(j.cog)}, ${q(j.nome)}, ${q(j.email)}, ${q(j.twitter)});`);
  cen.itens.forEach((m, i) => s.push(`insert into public.masterlist (id, ceg, cog, nome, nome_do_item, id_linha, valor_item, status, pago_item) values (${i + 1}, 'CEG1', ${q(m.cog)}, ${q(m.nome)}, ${q(m.item)}, ${q(m.idl)}, 10, null, false);`));
  const via = cen.via ?? "updates";
  if (via === "updates") { s.push("create table public.joiner_updates (id bigint generated always as identity primary key, joiner_cog text, campos jsonb, created_at timestamptz default now());");
    for (const t of cen.trocas || []) s.push(`insert into public.joiner_updates (joiner_cog, campos) values (${q(t.cog)}, ${q(JSON.stringify({ twitter: { de: t.de, para: t.para } }))}::jsonb);`); }
  if (via === "perfil") { s.push("create table public.joiner_perfil_historico (id bigint generated always as identity primary key, joiner_id bigint, campo text, valor_antigo text, valor_novo text);");
    for (const t of cen.trocas || []) s.push(`insert into public.joiner_perfil_historico (joiner_id, campo, valor_antigo, valor_novo) select id, 'twitter', ${q(t.de)}, ${q(t.para)} from public.joiners where cog = ${q(t.cog)};`); }
  if (via === "quebrada") s.push("create table public.joiner_updates (id bigint generated always as identity primary key, outra_coluna text);");   // existe, mas sem as colunas esperadas: erro de leitura que NÃO é "tabela inexistente"
  return s.join("\n");
}
function rodar(cen, setupSql) {
  const arq = join(dir, `c${++n}.json`); writeFileSync(arq, JSON.stringify({ csv: csv(cen.planilha), aplicarS1: !!cen.aplicarS1, setupSql: setupSql ?? setup(cen) }));
  const r = spawnSync(process.execPath, ["tests/helpers/sync-filho.mjs", arq], { cwd: RAIZ, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const i = (r.stdout || "").lastIndexOf("@@RESULTADO@@");
  if (i < 0) return { erro: (r.stderr || r.stdout || "sem saída").slice(0, 600), logs: [] };
  const o = JSON.parse(r.stdout.slice(i + 13)); o.log = o.logs.join("\n"); return o;
}
const dono = (o, idl) => o.masterlist.find(x => x.id_linha === idl)?.cog;
const cogs = o => o.joinersTodos.map(j => j.cog).sort().join(",");
const tw = (o, cog) => o.joinersTodos.find(j => j.cog === cog)?.twitter;
// o estado de uma rodada vira o ponto de partida da seguinte
const estado = (o, cen) => ({ ...cen, joiners: o.joinersTodos.map(j => ({ cog: j.cog, nome: j.nome, email: j.email, twitter: j.twitter })), itens: o.masterlist.map(m => ({ cog: m.cog, nome: m.nome, item: m.nome_do_item, idl: m.id_linha })) });

const X = { cog: "qnny_dool", nome: "Anny", email: "anny@x.com", twitter: "@anny_nova" };
// 1) @ antigo reconhecido: os itens ficam; nenhum cadastro novo; o @ de hoje não é sobrescrito
const c1 = { joiners: [X], itens: [{ cog: "qnny_dool", nome: "Anny", item: "Item 1", idl: "A-1" }], trocas: [{ cog: "qnny_dool", de: "@anny_dool", para: "@anny_nova" }],
  planilha: [{ nome: "Anny", arroba: "@anny_dool", item: "Item 1", id: "A-1" }] };
const r1 = rodar(c1);
ok(!r1.erro && r1.exitCode === 0, "1) a rodada executa e termina com sucesso" + (r1.erro ? " | " + r1.erro : ""));
ok(dono(r1, "A-1") === "qnny_dool" && cogs(r1) === "qnny_dool", "1) planilha com o @ ANTIGO: o item fica com o cadastro original (cog 'qnny_dool') e NENHUM cadastro novo é criado (cadastros: " + cogs(r1) + ")");
ok(tw(r1, "qnny_dool") === "@anny_nova", "1) o @ de hoje do cadastro NÃO é sobrescrito pelo valor atrasado da planilha");
ok(/Planilha com @ antigo.*1 cadastro/.test(r1.log) && !/CONFLITO_SYNC/.test(r1.log), "1) o log avisa que a planilha precisa ser corrigida, sem conflito");
// 2) duas rodadas seguidas: nada muda
const r1b = rodar(estado(r1, c1), setup({ ...estado(r1, c1), trocas: c1.trocas }));
ok(!r1b.erro && dono(r1b, "A-1") === "qnny_dool" && cogs(r1b) === "qnny_dool" && tw(r1b, "qnny_dool") === "@anny_nova" && r1b.masterlist.length === r1.masterlist.length, "2) segunda rodada seguida: mesmo dono, mesmos cadastros, mesmo @, mesmos itens (idempotente)");
// 3) mudanças sucessivas A -> B -> C: qualquer @ antigo leva ao mesmo cadastro
const c3 = { joiners: [{ cog: "x1", nome: "Xis", email: "xis@x.com", twitter: "@c3" }], itens: [{ cog: "x1", nome: "Xis", item: "Item A", idl: "S-1" }, { cog: "x1", nome: "Xis", item: "Item B", idl: "S-2" }],
  trocas: [{ cog: "x1", de: "@a1", para: "@b2" }, { cog: "x1", de: "@b2", para: "@c3" }],
  planilha: [{ nome: "Xis", arroba: "@a1", item: "Item A", id: "S-1" }, { nome: "Xis", arroba: "@b2", item: "Item B", id: "S-2" }] };
const r3 = rodar(c3);
ok(!r3.erro && dono(r3, "S-1") === "x1" && dono(r3, "S-2") === "x1" && cogs(r3) === "x1" && tw(r3, "x1") === "@c3", "3) mudanças sucessivas (a1→b2→c3): a planilha com o 1º ou o 2º @ antigo resolve para o MESMO cadastro; nada criado; @ de hoje preservado");
// 4) o @ antigo de X é HOJE o @ de outra pessoa (Y): o @ de hoje vence, e os itens de X não são tocados
const c4 = { joiners: [{ cog: "x1", nome: "Xis", email: "xis@x.com", twitter: "@c3" }, { cog: "y1", nome: "Ypsilon", email: "y@x.com", twitter: "@b2" }],
  itens: [{ cog: "x1", nome: "Xis", item: "Item X", idl: "X-1" }, { cog: "y1", nome: "Ypsilon", item: "Item Y", idl: "Y-1" }], trocas: [{ cog: "x1", de: "@a1", para: "@b2" }, { cog: "x1", de: "@b2", para: "@c3" }],
  planilha: [{ nome: "Xis", arroba: "@c3", item: "Item X", id: "X-1" }, { nome: "Ypsilon", arroba: "@b2", item: "Item Y", id: "Y-1" }] };
const r4 = rodar(c4);
ok(!r4.erro && dono(r4, "X-1") === "x1" && dono(r4, "Y-1") === "y1" && cogs(r4) === "x1,y1", "4) o @ antigo de X é hoje o @ de Y: o @ de HOJE vence (Y fica com o item de Y; X com o de X)");
// 5) CONFLITO: o mesmo @ antigo está ligado a DOIS cadastros
const c5 = { joiners: [{ cog: "pa", nome: "Pa", email: "pa@x.com", twitter: "@pa_nova" }, { cog: "pb", nome: "Pb", email: "pb@x.com", twitter: "@pb_nova" }], itens: [{ cog: "pa", nome: "Pa", item: "Item PA", idl: "C-1" }],
  trocas: [{ cog: "pa", de: "@h", para: "@pa_nova" }, { cog: "pb", de: "@h", para: "@pb_nova" }], planilha: [{ nome: "Pa", arroba: "@h", item: "Item PA", id: "C-1" }], aplicarS1: true };
const r5 = rodar(c5);
ok(!r5.erro && dono(r5, "C-1") === "pa" && cogs(r5) === "pa,pb" && r5.masterlist.length === 1, "5) @ antigo em DOIS cadastros: o item NÃO é movido, nenhum cadastro é criado e a linha do banco NÃO é apagada (mesmo com a exclusão protegida ligada)");
ok(/CONFLITO_SYNC .*arroba_antigo_em_mais_de_um_cadastro/.test(r5.log) && /CONFLITOS DE DONO/.test(r5.log) && /Removidos|Nenhum registro candidato/.test(r5.log), "5) o conflito fica REGISTRADO no log (tipo, @ e cadastros possíveis) para análise");
// 6) CONFLITO: o @ antigo de X é igual ao COG de outro cadastro (W), que não é X
const c6 = { joiners: [{ cog: "xx", nome: "Xx", email: "xx@x.com", twitter: "@xx_nova" }, { cog: "h2", nome: "Dona do h2", email: "h2@x.com", twitter: "@outro_h2" }], itens: [{ cog: "h2", nome: "Dona do h2", item: "Item H2", idl: "H-1" }],
  trocas: [{ cog: "xx", de: "@h2", para: "@xx_nova" }], planilha: [{ nome: "Dona do h2", arroba: "@h2", item: "Item H2", id: "H-1" }] };
const r6 = rodar(c6);
ok(!r6.erro && dono(r6, "H-1") === "h2" && cogs(r6) === "h2,xx" && /arroba_antigo_e_cog_de_outro_cadastro/.test(r6.log), "6) @ antigo de X = cog de outro cadastro: conflito registrado; o item continua com 'h2' e nada é criado");
// 7) o caso real @b_adss: trocou para @bad; a planilha ainda mostra b_adss (que é o cog): resolve para o mesmo cadastro e o @ de hoje não volta para o antigo
const c7 = { joiners: [{ cog: "b_adss", nome: "Bad", email: "bad@x.com", twitter: "@bad" }, { cog: "bad", nome: "Novo vazio", email: "novo@x.com", twitter: "@bad" }], itens: [{ cog: "b_adss", nome: "Bad", item: "Item B", idl: "B-1" }],
  trocas: [{ cog: "b_adss", de: "@b_adss", para: "@bad" }], planilha: [{ nome: "Bad", arroba: "@b_adss", item: "Item B", id: "B-1" }] };
const r7 = rodar(c7);
ok(!r7.erro && dono(r7, "B-1") === "b_adss" && tw(r7, "b_adss") === "@bad" && cogs(r7) === "b_adss,bad", "7) caso b_adss/bad: o item fica com 'b_adss', o @ dela NÃO volta ao antigo, o cadastro vazio 'bad' não é tocado (nem unido nem apagado)");
// 8) histórico guardado em joiner_perfil_historico (outra fonte)
const c8 = { ...c1, via: "perfil" }; const r8 = rodar(c8);
ok(!r8.erro && dono(r8, "A-1") === "qnny_dool" && cogs(r8) === "qnny_dool", "8) o @ antigo também é reconhecido a partir de joiner_perfil_historico");
// 9) sem histórico (tabelas ausentes): comportamento de ANTES (a pessoa não é reconhecida pelo @ antigo)
const r9 = rodar({ ...c1, via: "nenhuma" });
ok(!r9.erro && /anny_dool/.test(cogs(r9)) && dono(r9, "A-1") === "anny_dool", "9) sem as tabelas de histórico o comportamento é o de antes (documenta o risco que a correção elimina): cadastros: " + cogs(r9));
// 10) erro de leitura que NÃO é 'tabela inexistente': o sync PARA sem gravar nada
const r10 = rodar({ ...c1, via: "quebrada" });
ok(!!r10.erro, "10) erro ao ler o histórico (coluna ausente): o sync PARA e não grava nada (sem resultado de execução)");
// 11) pessoa realmente nova e item novo continuam entrando como sempre
const c11 = { joiners: [X], itens: [{ cog: "qnny_dool", nome: "Anny", item: "Item 1", idl: "A-1" }], trocas: [{ cog: "qnny_dool", de: "@anny_dool", para: "@anny_nova" }],
  planilha: [{ nome: "Anny", arroba: "@anny_dool", item: "Item 1", id: "A-1" }, { nome: "Nova", arroba: "@pessoa_nova", email: "nova@x.com", item: "Item N", id: "N-1" }] };
const r11 = rodar(c11);
ok(!r11.erro && dono(r11, "N-1") === "pessoa_nova" && cogs(r11) === "pessoa_nova,qnny_dool" && dono(r11, "A-1") === "qnny_dool", "11) pessoa nova (sem nenhuma relação) segue entrando como antes; a do @ antigo continua no cadastro original");
// 12) @ diferente do cadastro mas com o MESMO e-mail (sem histórico de @): continua casando pelo e-mail e o @ do cadastro não é sobrescrito
const c12 = { joiners: [{ cog: "ee", nome: "Ee", email: "ee@x.com", twitter: "@ee_atual" }], itens: [{ cog: "ee", nome: "Ee", item: "Item E", idl: "E-1" }], trocas: [], planilha: [{ nome: "Ee", arroba: "@outro_nome", email: "ee@x.com", item: "Item E", id: "E-1" }] };
const r12 = rodar(c12);
ok(!r12.erro && dono(r12, "E-1") === "ee" && cogs(r12) === "ee" && tw(r12, "ee") === "@ee_atual", "12) @ da planilha diferente, mas e-mail igual: casa pelo e-mail, não cria cadastro e não sobrescreve o @ de hoje");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
