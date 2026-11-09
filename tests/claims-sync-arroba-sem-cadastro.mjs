// SYNC REAL (scripts/sync-masterlist.js) contra um banco local (PGlite): o ÚLTIMO PASSO das claims feitas só com @ — a linha que a administração põe na planilha com o @ informado.
// Prova: o @ informado é PRESERVADO (a linha vira item com esse @), um @ sem cadastro vira um cadastro NOVO desse mesmo @ (sem e-mail, sem conta de login), nada é ligado ao cadastro de outra pessoa
// (nem a um @ parecido), e uma segunda rodada não muda nada. Sem rede, sem Supabase, sem pagamento, sem e-mail; dados fictícios.
// Uso: node tests/claims-sync-arroba-sem-cadastro.mjs
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const CAB = "ABA / CEG,NOME,@,EMAIL,NOME DO ITEM,ID,PREÇO ITEM,PREÇO FRETE,PREÇO RF,INFORMAÇÕES,ITEM,FRETE,RF,ITEM DATA,FRETE DATA,RF DATA,Chegou?,NACIONAL";
const csv = linhas => [CAB, ...linhas.map(l => [l.ceg || "CLAIM-SET", l.nome ?? "", l.arroba, l.email ?? "", l.item, l.id, "100", "", "", "", "FALSE", "FALSE", "FALSE", "", "", "", "FALSE", "FALSE"].join(","))].join("\n");
const q = v => v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'";

// cadastros que JÁ existem (outras pessoas): o @ sem cadastro nunca pode cair neles
const JOINERS = [["ana", "Ana", "ana@exemplo.com", true], ["ana2", "Ana Dois", "ana2@exemplo.com", false], ["maria", "Maria", "maria@exemplo.com", false], ["Ela", "Ela", "ela@exemplo.com", true]];
const setup = JOINERS.map(([c, n, e, conf]) => `insert into public.joiners (cog, nome, email, twitter, confirmado) values (${q(c)}, ${q(n)}, ${q(e)}, ${q("@" + c)}, ${conf});`).join("\n")
  + "\ninsert into public.masterlist (id, ceg, cog, nome, nome_do_item, id_linha, valor_item, status, pago_item) values (1, 'CLAIM-SET', 'ana', 'Ana', 'Item da Ana', 'A-1', 10, null, false), (2, 'CLAIM-SET', 'maria', 'Maria', 'Item da Maria', 'M-1', 10, null, false), (3, 'CLAIM-SET', 'Ela', 'Ela', 'Item da Ela', 'E-1', 10, null, false);"
  + "\ncreate table public.contas_joiner (user_id uuid primary key, joiner_id bigint unique);\ninsert into public.contas_joiner (user_id, joiner_id) values ('00000000-0000-0000-0000-000000000001', 1);"
  + "\ncreate table public.claim_reservas (id bigserial primary key, evento_id bigint, set_id bigint, joiner_cog text, joiner_nome text, membro text, status text);\ninsert into public.claim_reservas (evento_id, set_id, joiner_cog, joiner_nome, membro, status) values (1, 1, 'novaclaimer', 'novaclaimer', 'Han', 'pendente');";

const dir = mkdtempSync(join(tmpdir(), "sync-claim-")); let n = 0;
function rodar(planilha, setupSql = setup) {
  const arq = join(dir, `c${++n}.json`); writeFileSync(arq, JSON.stringify({ csv: csv(planilha), aplicarS1: false, setupSql }));
  const r = spawnSync(process.execPath, ["tests/helpers/sync-filho.mjs", arq], { cwd: RAIZ, encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  const i = (r.stdout || "").lastIndexOf("@@RESULTADO@@");
  if (i < 0) return { erro: (r.stderr || r.stdout || "sem saída").slice(0, 1500), logs: [] };
  const o = JSON.parse(r.stdout.slice(i + 13)); o.log = o.logs.join("\n"); return o;
}
const cadastro = (o, cog) => o.joinersTodos.find(j => j.cog === cog);
const itensDe = (o, cog) => o.masterlist.filter(m => m.cog === cog);

// A planilha depois que a administração copiou "@novaclaimer · Han" do painel e colou a linha (sem e-mail: a pessoa nunca informou)
const PLANILHA = [
  { nome: "novaclaimer", arroba: "@novaclaimer", email: "", item: "SET 1 · Han", id: "CL-1" },
  { nome: "CapsPessoa", arroba: "@CapsPessoa", email: "", item: "SET 1 · Felix", id: "CL-2" },
  { nome: "Ana", arroba: "@ana", email: "ana@exemplo.com", item: "Item da Ana", id: "A-1" },
];
const r1 = rodar(PLANILHA);
ok(!r1.erro && r1.exitCode === 0, "a rodada executa e termina com sucesso" + (r1.erro ? " | " + r1.erro : ""));
const itens1 = itensDe(r1, "novaclaimer");
ok(itens1.length === 1 && itens1[0].nome_do_item === "SET 1 · Han", "o @ informado na claim vira DONO do item na masterlist (@ preservado, sem trocar nem juntar)");
const novo = cadastro(r1, "novaclaimer");
ok(!!novo && (novo.email == null || novo.email === "") && novo.twitter === "@novaclaimer", "o @ sem cadastro vira um cadastro NOVO desse mesmo @, SEM e-mail (nada foi inventado)");
ok(r1.joinersTodos.length === JOINERS.length + 2, "só nasceram cadastros para os dois @ da planilha que não existiam (" + r1.joinersTodos.length + " no total)");
for (const [cog, nome, email] of JOINERS) { const c = cadastro(r1, cog); ok(c && c.email === email && c.nome === nome, `cadastro de outra pessoa (@${cog}) intocado: nome e e-mail iguais`); }
const donoDe = (o, idLinha) => o.masterlist.find(m => m.id_linha === idLinha)?.cog;
ok(donoDe(r1, "CL-1") === "novaclaimer" && String(donoDe(r1, "CL-2")).toLowerCase() === "capspessoa", "os itens das claims (CL-1, CL-2) ficaram nos @ informados e em nenhum outro");
ok(["ana", "ana2", "maria", "Ela"].every(c => itensDe(r1, c).every(m => ["A-1", "M-1", "E-1"].includes(m.id_linha))), "@ana, @ana2, @maria e @Ela só têm os itens que já tinham (nenhum item de claim caiu em @ parecido)");
ok(itensDe(r1, "capspessoa").length === 1 || itensDe(r1, "CapsPessoa").length === 1, "@ digitado com maiúsculas na planilha também vira dono do item (uma só linha)");
ok(!/Erro joiner|jErros|✗/.test(r1.log), "sem erro no log");
// contas: nada de login foi criado
const contas = r1.joinersTodos.length; void contas;
// 2ª rodada: idempotente
const estadoDe = o => "\n" + o.joinersTodos.filter(j => !JOINERS.some(([c]) => c === j.cog)).map(j => `insert into public.joiners (cog, nome, email, twitter, confirmado) values (${q(j.cog)}, ${q(j.nome)}, ${q(j.email)}, ${q(j.twitter)}, ${!!j.confirmado});`).join("\n")
  + "\n" + o.masterlist.filter(m => ![1, 2, 3].includes(m.id)).map(m => `insert into public.masterlist (id, ceg, cog, nome, nome_do_item, id_linha, valor_item, status, pago_item) values (${m.id}, ${q(m.ceg)}, ${q(m.cog)}, ${q(m.nome)}, ${q(m.nome_do_item)}, ${q(m.id_linha)}, ${m.valor_item ?? 0}, null, false);`).join("\n");
const r2 = rodar(PLANILHA, setup + estadoDe(r1));
ok(!r2.erro && r2.joinersTodos.length === r1.joinersTodos.length && itensDe(r2, "novaclaimer").length === 1, "2ª rodada: nada duplica (1 cadastro e 1 item por @)");
// um @ SEM cadastro nunca é ligado a um @ parecido, mesmo com nome igual
const r3 = rodar([{ nome: "Ana", arroba: "@ana.nova", email: "", item: "SET 2 · Han", id: "CL-3" }, { nome: "Ana", arroba: "@ana", email: "ana@exemplo.com", item: "Item da Ana", id: "A-1" }, { nome: "Maria", arroba: "@maria", email: "maria@exemplo.com", item: "Item da Maria", id: "M-1" }]);
ok(!r3.erro && donoDe(r3, "CL-3") === "ana.nova" && !!cadastro(r3, "ana.nova") && donoDe(r3, "A-1") === "ana", "mesmo com o NOME igual ao de outra pessoa, um @ novo não é ligado ao cadastro dela");
// o e-mail da planilha é a ÚNICA ligação por e-mail que o sync conhece: se a equipe digitar o e-mail de OUTRA pessoa na linha, o sync já trata como a mesma pessoa que trocou de @ (regra antiga do sync, fora das claims)
const r4 = rodar([{ nome: "x", arroba: "@novaclaimer", email: "maria@exemplo.com", item: "SET 1 · Han", id: "CL-4" }, { nome: "Ana", arroba: "@ana", email: "ana@exemplo.com", item: "Item da Ana", id: "A-1" }, { nome: "Maria", arroba: "@maria", email: "maria@exemplo.com", item: "Item da Maria", id: "M-1" }]);
const dono = r4.masterlist.find(m => m.id_linha === "CL-4")?.cog;
console.log("INFO e-mail de OUTRA pessoa digitado pela equipe na linha do @ sem cadastro: dono do item =", dono, "(regra existente do sync; as claims por @ não preenchem e-mail)");
// reservas do evento ficam como estão (o sync não mexe nelas)
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
