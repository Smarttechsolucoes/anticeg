// SYNC REAL (scripts/sync-masterlist.js) contra um banco local (PGlite): o e-mail TROCADO pela administração ou por pedido com prova verificada não é desfeito pela rodada seguinte.
// Uso: node tests/sync-email-trocado.mjs   (sem rede, sem Supabase, dados fictícios)
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const CAB = "ABA / CEG,NOME,@,EMAIL,NOME DO ITEM,ID,PREÇO ITEM,PREÇO FRETE,PREÇO RF,INFORMAÇÕES,ITEM,FRETE,RF,ITEM DATA,FRETE DATA,RF DATA,Chegou?,NACIONAL";
const csv = linhas => [CAB, ...linhas.map(l => [l.ceg, l.nome, l.arroba, l.email ?? "", l.item, l.id, "10", "", "", "", "FALSE", "FALSE", "FALSE", "", "", "", "FALSE", "FALSE"].join(","))].join("\n");
const q = v => v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'";

const JOINERS = [   // id 1 = ana (e-mail trocado pela administração), 2 = bia (sem troca), 3 = caio (troca verificada pelo fluxo novo), 4 = dani (e-mail trocado, planilha vazia)
  ["ana", "Ana", "ana.nova@exemplo.com"], ["bia", "Bia", "bia.antiga@exemplo.com"], ["caio", "Caio", "caio.novo@exemplo.com"], ["dani", "Dani", "dani.nova@exemplo.com"],
];
const PLANILHA = [   // a planilha ainda mostra os e-mails ANTIGOS de ana e caio; bia teve o e-mail corrigido na planilha; dani sem e-mail na planilha
  { ceg: "CEG1", nome: "Ana Planilha", arroba: "@ana", email: "ana.antiga@exemplo.com", item: "Item A", id: "A-1" },
  { ceg: "CEG1", nome: "Bia", arroba: "@bia", email: "bia.corrigida@exemplo.com", item: "Item B", id: "B-1" },
  { ceg: "CEG1", nome: "Caio", arroba: "@caio", email: "caio.antigo@exemplo.com", item: "Item C", id: "C-1" },
  { ceg: "CEG1", nome: "Dani", arroba: "@dani", email: "", item: "Item D", id: "D-1" },
];
const setup = (aud = true, auditoria = "create table public.contas_auditoria (id bigint generated always as identity primary key, joiner_id bigint, acao text not null);") =>
  JOINERS.map(([c, n, e]) => `insert into public.joiners (cog, nome, email, twitter) values (${q(c)}, ${q(n)}, ${q(e)}, ${q("@" + c)});`).join("\n") +
  "\n" + PLANILHA.map((l, i) => `insert into public.masterlist (id, ceg, cog, nome, nome_do_item, id_linha, valor_item, status, pago_item) values (${i + 1}, 'CEG1', ${q(l.arroba.slice(1))}, ${q(l.nome)}, ${q(l.item)}, ${q(l.id)}, 10, null, false);`).join("\n") +
  (aud ? `\n${auditoria}\ninsert into public.contas_auditoria (joiner_id, acao) values (1, 'trocar_email'), (3, 'troca_email_verificada'), (4, 'trocar_email'), (2, 'outra_acao');` : "");

const dir = mkdtempSync(join(tmpdir(), "sync-eml-")); let n = 0;
function rodar(setupSql, planilha = PLANILHA) {
  const arq = join(dir, `c${++n}.json`); writeFileSync(arq, JSON.stringify({ csv: csv(planilha), aplicarS1: false, setupSql }));
  const r = spawnSync(process.execPath, ["tests/helpers/sync-filho.mjs", arq], { cwd: RAIZ, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const i = (r.stdout || "").lastIndexOf("@@RESULTADO@@");
  if (i < 0) return { erro: (r.stderr || r.stdout || "sem saída").slice(0, 1500), logs: [] };
  const o = JSON.parse(r.stdout.slice(i + 13)); o.log = o.logs.join("\n"); return o;
}
const email = (o, cog) => o.joinersTodos.find(j => j.cog === cog)?.email;
const nome = (o, cog) => o.joinersTodos.find(j => j.cog === cog)?.nome;

// 1) com o registro de trocas: ana, caio e dani mantêm o e-mail trocado; bia (sem troca) segue a planilha como hoje
const r1 = rodar(setup());
ok(!r1.erro && r1.exitCode === 0, "1ª rodada executa e termina com sucesso" + (r1.erro ? " | " + r1.erro : ""));
ok(email(r1, "ana") === "ana.nova@exemplo.com", "ana (troca pela administração): o e-mail trocado NÃO foi desfeito pelo valor antigo da planilha");
ok(email(r1, "caio") === "caio.novo@exemplo.com", "caio (troca verificada pelo fluxo novo): idem");
ok(email(r1, "dani") === "dani.nova@exemplo.com", "dani (planilha sem e-mail): continua com o e-mail dela");
ok(email(r1, "bia") === "bia.corrigida@exemplo.com", "bia (sem troca controlada; a ação 'outra_acao' não conta): a planilha continua atualizando, como hoje");
ok(nome(r1, "ana") === "Ana Planilha", "os OUTROS campos de ana seguem a planilha como sempre (nada deixou de sincronizar)");
ok(/protegido do sync\): 3 cadastro\(s\); 2 com a planilha ainda mostrando outro e-mail/.test(r1.log) && /ana, caio|caio, ana/.test(r1.log), "o log avisa quais têm a planilha com outro e-mail (ana e caio), sem sobrescrever nada");
ok(!/Erro joiner|jErros|✗/.test(r1.log), "sem erro no log");

// 2) segunda rodada a partir do estado final: idempotente
const estado = o => JOINERS.map(([c]) => `insert into public.joiners (cog, nome, email, twitter) values (${q(c)}, ${q(nome(o, c))}, ${q(email(o, c))}, ${q("@" + c)});`).join("\n") + "\n" + setup(true).split("\n").slice(JOINERS.length).join("\n");
const r2 = rodar(estado(r1));
ok(!r2.erro && r2.exitCode === 0 && email(r2, "ana") === "ana.nova@exemplo.com" && email(r2, "caio") === "caio.novo@exemplo.com" && email(r2, "bia") === "bia.corrigida@exemplo.com", "2ª rodada: mesmos e-mails (idempotente)");

// 3) quando a planilha for corrigida para o mesmo e-mail, não há aviso nem alteração
const planCorrigida = PLANILHA.map(l => l.arroba === "@ana" ? { ...l, email: "ana.nova@exemplo.com" } : l.arroba === "@caio" ? { ...l, email: "caio.novo@exemplo.com" } : l);
const r3 = rodar(setup(), planCorrigida);
ok(!r3.erro && /3 cadastro\(s\); 0 com a planilha/.test(r3.log), "planilha já corrigida: 0 divergências no aviso");
ok(email(r3, "ana") === "ana.nova@exemplo.com" && email(r3, "caio") === "caio.novo@exemplo.com", "planilha corrigida: e-mails continuam os mesmos");

// 4) sem a tabela de auditoria (J4c0 ausente): comportamento de hoje (a planilha atualiza), sem erro
const r4 = rodar(setup(false));
ok(!r4.erro && r4.exitCode === 0 && email(r4, "ana") === "ana.antiga@exemplo.com", "sem contas_auditoria: nada muda no comportamento de hoje (a planilha atualiza) e o job não falha");

// 5) consulta de trocas indisponível (erro que não é 'tabela inexistente'): fail-safe, NENHUM e-mail é enviado nesta rodada
const r5 = rodar(setup(true, "create table public.contas_auditoria (id bigint generated always as identity primary key, outra_coluna bigint, acao text); insert into public.contas_auditoria (outra_coluna, acao) values (1, 'trocar_email');").replace(/insert into public\.contas_auditoria \(joiner_id, acao\) values .*;/, ""));
ok(!r5.erro && r5.exitCode === 0 && email(r5, "bia") === "bia.antiga@exemplo.com" && email(r5, "ana") === "ana.nova@exemplo.com", "consulta indisponível: fail-safe (nenhum e-mail é gravado pelo sync nesta rodada; nada se perde)");
ok(/não foi possível consultar as trocas de e-mail/.test(r5.log), "o log explica o fail-safe");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
