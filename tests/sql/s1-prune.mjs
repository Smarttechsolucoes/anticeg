// Teste do S1 (exclusão segura da masterlist) em banco simulado (PGlite) com DADOS FICTÍCIOS. Uso: npm i --no-save @electric-sql/pglite && node tests/sql/s1-prune.mjs
process.on("uncaughtException", e => { console.log("ERRO:", String(e.message).slice(0, 600)); process.exit(2); });
process.on("unhandledRejection", e => { console.log("ERRO:", String(e && e.message || e).slice(0, 600)); process.exit(2); });
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/sync/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };

async function banco() {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create table public.masterlist (id bigint primary key, ceg text, cog text, nome text, nome_do_item text, status text, na_loja boolean default false, id_linha text,
      pago_item boolean default false, pago_frete boolean default false, pago_rf boolean default false);
    create table public.claims (id bigint generated always as identity primary key, joiner_cog text, masterlist_id bigint, ceg text, status text default 'pendente');
    create table public.multas_pagas (id bigint generated always as identity primary key, joiner_cog text, masterlist_id bigint, campo text);
    grant all on all tables in schema public to anon, authenticated, service_role;
    -- linhas da planilha (1..40): normais
    insert into public.masterlist (id, ceg, cog, nome, nome_do_item, status, id_linha) select g, 'CEG' || g, 'joiner' || g, 'Nome ' || g, 'Item ' || g, 'Comprado', 'L' || g from generate_series(1, 40) g;
    -- candidatas à exclusão (ausentes da planilha)
    insert into public.masterlist (id, ceg, cog, nome, nome_do_item, status) values
      (101, 'CEGX', 'antiga1', 'N', 'Livre 1', 'Comprado'), (102, 'CEGX', 'antiga2', 'N', 'Livre 2', 'Comprado'), (103, 'CEGX', 'antiga3', 'N', 'Livre 3', 'Comprado'),
      (110, 'CEGX', 'antiga4', 'N', 'Livre com claim rejeitado', 'Comprado');
    insert into public.masterlist (id, ceg, cog, nome, nome_do_item, status, na_loja, pago_item) values
      (104, 'CEGY', 'disponivel', 'N', 'Slot do site', 'disponivel', false, false),
      (105, 'CLAIM', 'ana', 'N', 'Claim pendente', 'disponivel', false, false),
      (106, 'CEGZ', 'bia', 'N', 'Claim aprovado', 'Comprado', false, false),
      (107, 'CEGZ', 'cris', 'N', 'Já pago', 'Comprado', false, true),
      (108, 'CEGZ', 'duda', 'N', 'Com multa', 'Comprado', false, false),
      (109, 'CEGZ', 'edu', 'N', 'Na loja', 'Comprado', true, false);
    insert into public.claims (joiner_cog, masterlist_id, ceg, status) values ('ana', 105, 'CLAIM', 'pendente'), ('bia', 106, 'CLAIM', 'aprovado'), ('fer', 110, 'CLAIM', 'rejeitado');
    insert into public.multas_pagas (joiner_cog, masterlist_id, campo) values ('duda', 108, 'venc_item');
  `);
  return d;
}
const como = async (d, papel, q, params) => { await d.exec(`set role ${papel}`); try { return { rows: (await d.query(q, params)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); } };
const prune = (d, ids, linhas, lim = 25) => como(d, "service_role", "select public.prune_masterlist($1::bigint[], $2::int, $3::int) r", [ids, linhas, lim]);
const cnt = async (d, w = "true") => (await d.query(`select count(*)::int c from public.masterlist where ${w}`)).rows[0].c;

{
  const d = await banco();
  const antes = (await d.query("select md5(string_agg(m::text, '|' order by id)) h from public.masterlist m where id <= 40 or id in (104,105,106,107,108,109)")).rows[0].h;
  const claimsAntes = (await d.query("select md5(string_agg(c::text, '|' order by id)) h from public.claims c")).rows[0].h;
  await d.exec(sql("S1_prune_protegido_aplicar.sql"));
  ok((await d.query(sql("S1_prune_protegido_verificar.sql"))).rows.filter(r => /existe|executa|fechado|ligado/.test(r.item)).every(r => r.valor === "OK"), "S1 aplica e a verificação dá OK");
  ok(/já foi aplicado/.test(await d.exec(sql("S1_prune_protegido_aplicar.sql")).then(() => "", e => e.message)), "reaplicar é recusado");
  await d.exec("rollback").catch(() => {});

  // quem pode chamar
  for (const papel of ["anon", "authenticated"]) {
    const r = await como(d, papel, "select public.prune_masterlist(array[101]::bigint[], 50, 25)");
    ok(!!r.erro && /permission denied/.test(r.erro) && (await cnt(d, "id = 101")) === 1, `${papel} NÃO consegue chamar a exclusão`);
    ok(!!(await como(d, papel, "select * from public.masterlist_exclusoes")).erro, `${papel} NÃO lê o arquivo de exclusões`);
  }

  // planilha parcial: nada é apagado
  const parcial = (await prune(d, [101, 102, 103], 10)).rows[0].r;
  ok(parcial.abortado && parcial.motivo === "planilha_parcial" && (await cnt(d, "id in (101,102,103)")) === 3, "planilha parcial (menos de 50% do banco): aborta e não apaga nada");
  ok((await prune(d, [101], 0)).rows[0].r.abortado && (await prune(d, [101], null)).rows[0].r.abortado, "planilha vazia/ausente: aborta");

  // exclusão real: todas as candidatas de uma vez (livres + protegidas misturadas)
  const ids = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
  const rel = (await prune(d, ids, 46)).rows[0].r;
  ok(!rel.abortado && rel.apagadas === 4, `apagou só as 4 livres (apagadas=${rel.apagadas})`);
  ok((await cnt(d, "id in (101,102,103,110)")) === 0, "as livres (101,102,103 e 110 com claim só rejeitado) saíram");
  ok((await cnt(d, "id in (104,105,106,107,108,109)")) === 6, "PRESERVADAS: slot 'disponivel', CLAIM com claim pendente, claim aprovado, já paga, com multa e na_loja");
  ok(rel.protegidas === 6 && rel.por_motivo.claim_ativo === 2 && rel.por_motivo.origem_site_disponivel === 1 && rel.por_motivo.pagamento_registrado === 1 && rel.por_motivo.multa_registrada === 1 && rel.por_motivo.na_loja === 1,
     "relatório conta os motivos de proteção: " + JSON.stringify(rel.por_motivo));
  ok(!JSON.stringify(rel).match(/ana|bia|duda|edu|cris/), "o relatório não revela nomes de joiners");
  const depois = (await d.query("select md5(string_agg(m::text, '|' order by id)) h from public.masterlist m where id <= 40 or id in (104,105,106,107,108,109)")).rows[0].h;
  ok(depois === antes, "linhas da planilha e as protegidas ficaram IDÊNTICAS (mesmos ids e conteúdo)");
  ok((await d.query("select md5(string_agg(c::text, '|' order by id)) h from public.claims c")).rows[0].h === claimsAntes, "claims intactos, todos ainda apontam para linhas existentes");
  ok((await d.query("select count(*)::int c from public.claims c where not exists (select 1 from public.masterlist m where m.id = c.masterlist_id) and c.status <> 'rejeitado'")).rows[0].c === 0, "nenhum claim ativo ficou órfão");

  // arquivo permite restaurar com o mesmo id
  const arq = (await d.query("select masterlist_id, dados->>'nome_do_item' item from public.masterlist_exclusoes order by masterlist_id")).rows;
  ok(arq.length === 4 && arq.map(a => a.masterlist_id).join() === "101,102,103,110", "as 4 exclusões ficaram arquivadas com o id original");
  await d.exec("insert into public.masterlist select * from jsonb_populate_recordset(null::public.masterlist, (select jsonb_agg(dados) from public.masterlist_exclusoes where masterlist_id = 101))");
  ok((await cnt(d, "id = 101 and nome_do_item = 'Livre 1'")) === 1, "uma linha arquivada é restaurada com o mesmo id e conteúdo");

  // gatilho: nem service_role apaga linha com claim ativo
  const g = await como(d, "service_role", "delete from public.masterlist where id = 106");
  ok(!!g.erro && /claim ativo/.test(g.erro) && (await cnt(d, "id = 106")) === 1, "DELETE direto de linha com claim ativo é barrado pelo gatilho (até para service_role)");
  ok(!(await como(d, "service_role", "delete from public.masterlist where id = 101")).erro, "DELETE direto de linha sem claim ativo continua permitido (administração normal)");
}

// limite: muitas candidatas livres => nenhuma é apagada
{
  const d = await banco(); await d.exec(sql("S1_prune_protegido_aplicar.sql"));
  await d.exec("insert into public.masterlist (id, ceg, cog, nome, nome_do_item) select 200 + g, 'CEGW', 'x' || g, 'N', 'Livre ' || g from generate_series(1, 30) g");
  const ids = Array.from({ length: 30 }, (_, i) => 201 + i);
  const r = (await prune(d, ids, 80, 1000)).rows[0].r;
  ok(r.abortado && r.motivo === "limite_excedido" && r.limite === 10 && (await cnt(d, "id > 200")) === 30, "30 candidatas livres: o limite (mínimo 10 / 5% da tabela, máx. 25, mesmo pedindo 1000) aborta e NÃO apaga nenhuma");
  const ok25 = (await prune(d, ids.slice(0, 10), 80, 1000)).rows[0].r;
  ok(!ok25.abortado && ok25.apagadas === 10 && (await cnt(d, "id > 200")) === 20, "10 candidatas (dentro do limite) são apagadas e arquivadas");
  await d.exec("insert into public.masterlist (id, ceg, cog, nome, nome_do_item) select 1000 + g, 'CEGV', 'v' || g, 'N', 'Grande ' || g from generate_series(1, 1000) g");
  const g = (await prune(d, Array.from({ length: 20 }, (_, i) => 211 + i), 1080, 1000)).rows[0].r;
  ok(!g.abortado && g.limite === 25 && g.apagadas === 20, "em tabela grande (1.080 linhas) o limite sobe só até 25 e as 20 candidatas livres saem");
}

// reversão protegida
{
  const d = await banco(); await d.exec(sql("S1_prune_protegido_aplicar.sql")); await prune(d, [101], 46);
  const rev = sql("S1_prune_protegido_reverter_protegido.sql");
  const tenta = async frase => d.exec(rev.replace("confirmacao text := '';", `confirmacao text := '${frase}';`)).then(() => "", async e => { await d.exec("rollback").catch(() => {}); return e.message; });
  ok(/Falta a confirmação/.test(await tenta("")), "reversão sem a frase é recusada");
  ok(/restauráveis/.test(await tenta("AUTORIZO REMOVER A PROTECAO DO SYNC")), "com linhas arquivadas, a frase simples é recusada");
  ok((await tenta("AUTORIZO REMOVER A PROTECAO DO SYNC E O ARQUIVO")) === "" && !(await d.query("select to_regprocedure('public.prune_masterlist(bigint[],integer,integer)') p")).rows[0].p, "com a frase ampliada a proteção é removida");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram"); process.exit(falhas ? 1 : 0);
