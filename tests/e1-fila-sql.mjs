// Confere o SQL de leitura da fila (E1_fila_antes_de_ativar_somente_leitura.sql) num Postgres local: roda as partes A, B e C (C só depois do E1), mostra o que o perfil-sync pegaria
// e prova que a consulta NÃO altera nada e NÃO devolve nome nem e-mail.
// Uso: npm i --no-save @electric-sql/pglite && node tests/e1-fila-sql.mjs
import { PGlite } from "@electric-sql/pglite";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const saida = join(mkdtempSync(join(tmpdir(), "e1f-")), "ensaio.sql");
spawnSync(process.execPath, ["scripts/e1-gerar-sql-ensaio.mjs", saida], { cwd: raiz });
const arquivo = readFileSync(new URL("../supabase/cadastro-tarefas/E1_fila_antes_de_ativar_somente_leitura.sql", import.meta.url), "utf8").replace(/\r/g, "");
const partes = arquivo.split(/^-- ([ABC])\) /m);   // [pré, "A", corpoA, "B", corpoB, "C", corpoC]
const corpo = l => partes[partes.indexOf(l) + 1].split("\n").slice(1).join("\n");   // tira o resto da linha do título (ela vira texto solto ao separar)
const A = corpo("A"), B = corpo("B"), C = corpo("C").split("\n").map(l => l.replace(/^-- (?=select|  from|  where|  order)/, "")).join("\n");

ok(!/\b(insert|update|delete|drop|alter|truncate|create|grant)\b/i.test(arquivo.replace(/^--.*$/gm, "")), "o arquivo só tem SELECT (nenhum comando de escrita fora dos comentários)");
const d = new PGlite();
await d.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;
  create schema auth; grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);
await d.exec(readFileSync(saida, "utf8"));
const U = "11111111-1111-1111-1111-111111111111";
await d.exec(`insert into auth.users values ('${U}', 'ensaio.e1@exemplo.com', now())`);
const id = (await d.query("select public.e1_ensaio_semear($1,'teste_e1') id", [U])).rows[0].id;

const q = async sql => (await d.query(sql)).rows;
let a = await q(A), b = await q(B);
ok(a.length === 0 && b.length === 0, "fila vazia: A e B não devolvem linhas (é o resultado que libera ativar)");
await d.exec(`select set_config('request.jwt.claims', '{"sub":"${U}","role":"authenticated"}', false); set role authenticated`);
await d.query("select public.salvar_meu_cadastro('Nome Secreto De Teste')");
await d.exec("reset role; select set_config('request.jwt.claims', '', false)");
const antes = JSON.stringify(await q("select * from public.perfil_sync_pendente order by id")) + JSON.stringify(await q("select * from public.cadastro_tarefas order by id"));
a = await q(A); b = await q(B); const c = await q(C);
ok(a.length === 1 && a[0].tipo === "cadastro" && a[0].status === "pendente" && Number(a[0].itens) === 1, "com 1 alteração na fila, A mostra 1 item 'cadastro' pendente");
ok(b.length === 1 && Number(b[0].item_da_fila) > 0 && b[0].tarefa_id && /ESTADO ATUAL/.test(b[0].o_que_faria), "B lista o item que seria processado e o que ele faria");
ok(c.length === 1 && c[0].planilha_status === "pendente" && c[0].campos.join() === "nome" && c[0].lida === false, "C lista a tarefa pendente com os campos (nome) e se já foi lida");
ok(![...a, ...b, ...c].some(l => JSON.stringify(l).includes("Nome Secreto")) && !JSON.stringify([...a, ...b, ...c]).includes("@exemplo.com"), "nenhuma das consultas devolve nome nem e-mail");
const depois = JSON.stringify(await q("select * from public.perfil_sync_pendente order by id")) + JSON.stringify(await q("select * from public.cadastro_tarefas order by id"));
ok(antes === depois, "as consultas não alteraram nada");

// ---- o SQL do primeiro teste controlado (E1_primeiro_teste_controlado.sql), como o editor de SQL da produção o executaria (papel confiável, sem sessão de usuário)
const modelo = readFileSync(new URL("../supabase/cadastro-tarefas/E1_primeiro_teste_controlado.sql", import.meta.url), "utf8").replace(/\r/g, "").replaceAll("<COG>", "teste_e1").replaceAll("<NOME_ATUAL>", "Nome Secreto De Teste");
const comandos = modelo.split("\n").filter(l => !/^--/.test(l)).join("\n").split(";").map(c => c.trim()).filter(Boolean);   // os comandos não comentados, em ordem (um comando pode ocupar várias linhas)
ok(comandos.length === 5, "o arquivo tem os passos executáveis (1 conferir, 2 testar, 3 restaurar, 4 duas conferências) e o plano B e o abortar ficam comentados");
const dep0 = Number((await q("select count(*)::int n from public.cadastro_tarefas"))[0].n);
const p1 = await q(comandos[0]); ok(p1.length === 1 && p1[0].nome === "Nome Secreto De Teste", "passo 1: encontra exatamente 1 cadastro com o nome esperado");
const p2 = await q(comandos[1]); ok(p2.length === 1 && p2[0].nome === "Nome Secreto De Teste (teste E1)", "passo 2: troca o nome de UMA linha");
let t2 = (await q("select origem, planilha_status, lida_em is null as nao_lida, campos from public.cadastro_tarefas order by id desc limit 1"))[0];
ok(t2.planilha_status === "pendente" && t2.nao_lida && t2.origem === "administracao_ou_servidor" && t2.campos.nome.para === "Nome Secreto De Teste (teste E1)", "passo 2: nasce UMA tarefa PENDENTE, não lida (aparece como pendência em Atualizações)");
const p2b = await q(comandos[1]); ok(p2b.length === 0, "rodar o passo 2 de novo não altera nada (a trava exige o nome original)");
const p3 = await q(comandos[2]); ok(p3.length === 1 && p3[0].nome === "Nome Secreto De Teste", "passo 3: desfaz (volta ao nome original)");
ok(Number((await q("select count(*)::int n from public.cadastro_tarefas"))[0].n) === dep0 + 2, "cada alteração gera exatamente uma tarefa (2 no total: teste e desfazer)");
const v1 = await q(comandos[3]), v2 = await q(comandos[4]);
ok(v1.length === 1 && v1[0].nome_voltou === true, "passo 4: confirma que o nome do banco voltou ao original (nome_voltou = true)");
ok(v2.length >= 2 && v2[0].de === "Nome Secreto De Teste (teste E1)" && v2[0].para === "Nome Secreto De Teste" && v2[1].de === "Nome Secreto De Teste" && v2[1].para === "Nome Secreto De Teste (teste E1)", "passo 4: lista as 2 tarefas (desfazer e teste) com o de/para esperado");
const planoB = modelo.split("\n").find(l => /^-- update public\.joiners set nome = .* where id = /.test(l)).replace(/^-- /, "").replace("<ID_DO_PASSO_1>", String(p1[0].id));
await q("update public.joiners set nome = 'Alguem mexeu' where cog = 'teste_e1'");
const semTrava = await q(comandos[2]); ok(semTrava.length === 0, "se alguém mudou o nome no meio do teste, o passo 3 não altera nada (devolve 0 linhas)");
const b2 = await q(planoB); ok(b2.length === 1 && b2[0].nome === "Nome Secreto De Teste", "plano B restaura o original pelo id quando o passo 3 não encontra a linha");
const b3 = await q(planoB); ok(b3.length === 0, "rodar o plano B de novo não altera nada (já está no original)");
const errada = await q("update public.joiners set nome = 'X' where cog = 'teste_e1' and nome = 'outro nome' returning id"); ok(errada.length === 0, "a trava 'and nome = ...' impede alterar quando o nome não é o esperado");
await d.close(); process.exitCode = falhas ? 1 : 0;
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
