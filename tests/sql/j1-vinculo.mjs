// Teste do J1 (vínculo seguro pelo id permanente) (banco simulado com PGlite, só dados fictícios). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j1-vinculo.mjs
process.on("uncaughtException", e => { console.log("ERRO:", String(e.message).slice(0, 500)); process.exit(2); });
process.on("unhandledRejection", e => { console.log("ERRO:", String(e && e.message || e).slice(0, 500)); process.exit(2); });
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const RAIZ = new URL("../../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DJ = RAIZ + "joiners-auth/", DA = RAIZ + "admin-auth/";
const sql = (f, d = DJ) => readFileSync(d + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
// usuários: 1 admin | 2 ana (ok) | 3 bia (e-mail diferente) | 4 cris (cadastro sem e-mail) | 5 duda (e-mail inválido) | 6 casal (e-mail compartilhado)
// 8 ela (COG repetido por maiúscula) | 9 e-mail NÃO confirmado | 10 outra conta com o e-mail da ana | 11 sem cadastro | 12 fabi (ok)
async function banco({ semPk = false, idsRuins = false } = {}) {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $f$;
    create function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    create table public.joiners (id bigint ${semPk ? "" : "primary key"}, cog text, nome text, nome_site text, email text, twitter text);
    alter table public.joiners enable row level security; create policy aberta on public.joiners for all to public using (true) with check (true);
    grant all on all tables in schema public to anon, authenticated, service_role;
    insert into auth.users values
      ('${U(1)}','dona@exemplo.com',now()), ('${U(2)}','ana@exemplo.com',now()), ('${U(3)}','bia.nova@exemplo.com',now()), ('${U(4)}','cris@exemplo.com',now()),
      ('${U(5)}','duda@exemplo.com',now()), ('${U(6)}','casal@exemplo.com',now()), ('${U(7)}','x@exemplo.com',now()), ('${U(8)}','ela@exemplo.com',now()),
      ('${U(9)}','gabi@exemplo.com',null), ('${U(10)}','ANA@Exemplo.com',now()), ('${U(11)}','sem.cadastro@exemplo.com',now()), ('${U(12)}','fabi@exemplo.com',now());
    insert into public.joiners (id, cog, nome, nome_site, email, twitter) values
      (1,'ana','Ana','Ana S','Ana@Exemplo.com ','@ana'), (2,'bia','Bia','Bia','bia.antiga@exemplo.com','@bia'), (3,'cris','Cris','Cris',null,'@cris'), (4,'duda','Duda','Duda','duda-sem-arroba','@duda'),
      (5,'casal1','C1','C1','casal@exemplo.com','@c1'), (6,'casal2','C2','C2','CASAL@exemplo.com','@c2'),
      (7,'Ela','Ela','Ela','ela@exemplo.com','@ela'), (255010,'ela','Ela2','Ela Dois','outro@exemplo.com','@ela2'), (9,'gabi','Gabi','Gabi','gabi@exemplo.com','@gabi'), (10,'fabi','Fabi','Fabi','fabi@exemplo.com','@fabi');
    ${idsRuins ? "insert into public.joiners (id, cog) values (null, 'semid');" : ""}
  `);
  await d.exec(sql("A1_base_aplicar.sql", DA)); await d.exec(sql("A2_senha_apenas_aplicar.sql", DA));
  await d.exec(`insert into public.admin_roles (user_id) values ('${U(1)}')`);
  return d;
}
async function como(d, papel, uid, q) {
  await d.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: U(uid), role: papel, aal: "aal1" }) : ""}', false)`); await d.exec(`set role ${papel}`);
  try { return { rows: (await d.query(q)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
}
const negado = r => !!r.erro && /permission denied|row-level security|sem permiss/.test(r.erro);
async function rodar(d, arq, dir = DJ, frase) { try { await d.exec(frase ? sql(arq, dir).replace("confirmacao text := '';", `confirmacao text := '${frase}';`) : sql(arq, dir)); return null; } catch (e) { await d.exec("rollback").catch(() => {}); return e.message; } }
// J1 isolado: só o servidor executa a ativação (o J4d reabre para authenticated, com a conferência das ondas)
const ativar = async (d, uid, cog) => (await como(d, "service_role", uid, `select public.ativar_minha_conta('${cog}') r`)).rows?.[0]?.r;
const vinc = async d => (await d.query("select user_id::text u, joiner_id j from public.contas_joiner order by joiner_id")).rows;
const pend = async d => (await d.query("select user_id::text u, motivo, status, joiner_id_candidato c from public.vinculos_pendentes order by id")).rows;
const fpJ = async d => JSON.stringify((await d.query("select count(*)::int n, md5(string_agg(id::text||coalesce(cog,'')||coalesce(email,''), ',' order by id)) m from public.joiners")).rows[0]);

{
  const d = await banco(); const antes = await fpJ(d);
  const e = await rodar(d, "J1_estrutura_aplicar.sql"); ok(e === null, "J1 aplica sem erro" + (e ? ": " + e : ""));
  ok(await fpJ(d) === antes, "J1: a tabela joiners ficou IDÊNTICA (linhas e hash)");
  ok(negado(await como(d, "authenticated", 2, "select public.ativar_minha_conta('ana') r")), "J1 isolado: usuário logado (conta preexistente) NÃO executa o vínculo antes do J4d");
  ok(negado(await como(d, "authenticated", 4, "select public.ativar_minha_conta('ana') r")) && (await d.query("select count(*)::int n from public.contas_joiner")).rows[0].n === 0 && (await d.query("select count(*)::int n from public.vinculos_pendentes")).rows[0].n === 0, "J1 isolado: a tentativa não grava vínculo nem pedido pendente");
  ok((await d.query(sql("J1_verificar.sql"))).rows.some(r => /usuário logado executa ativar_minha_conta/.test(r.item) && r.valor === "false"), "J1_verificar: usuário logado executa ativar_minha_conta = false até o J4d");
  ok((await d.query("select count(*)::int n from public.contas_joiner")).rows[0].n === 0, "J1: nenhuma conta é vinculada automaticamente");

  // caso feliz: o vínculo guarda o ID PERMANENTE
  ok((await ativar(d, 2, "ana")).status === "ok" && (await vinc(d)).some(v => String(v.j) === "1" && v.u === U(2)), "ana: e-mail confirmado igual ao cadastrado (ignora maiúsculas e espaços) => vinculada ao joiners.id 1");
  ok((await ativar(d, 2, "ana")).status === "ok" && (await vinc(d)).length === 1, "ativar de novo é idempotente (não duplica)");
  ok((await como(d, "authenticated", 2, "select public.meu_cog() c, public.meu_joiner_id() i")).rows[0].c === "ana", "meu_cog() devolve o COG da conta logada");
  ok(String((await como(d, "authenticated", 2, "select public.meu_joiner_id() i")).rows[0].i) === "1", "meu_joiner_id() devolve o id permanente");
  ok((await como(d, "authenticated", 3, "select public.meu_cog() c")).rows[0].c === null, "meu_cog() é nulo para conta sem vínculo");
  ok((await ativar(d, 12, "@FABI")).status === "ok", "aceita @ e maiúsculas no pedido (@FABI => fabi)");

  // o COG pode mudar: o vínculo acompanha o ID, nunca fica órfão
  await d.exec("update public.joiners set cog = 'ana_nova' where id = 1");
  ok((await como(d, "authenticated", 2, "select public.meu_cog() c")).rows[0].c === "ana_nova", "se o COG da joiner mudar, a conta continua ligada à mesma joiner (meu_cog segue o id)");
  await d.exec("update public.joiners set cog = 'ana' where id = 1");

  // falhas: nunca vincula e nunca revela o motivo
  const casos = [[3, "bia", "email_diferente"], [4, "cris", "email_ausente"], [5, "duda", "email_invalido"], [6, "casal1", "email_compartilhado"], [8, "ela", "cog_ambiguo"], [11, "naoexiste", "cog_inexistente"]];
  const respostas = [];
  for (const [uid, cog] of casos) respostas.push(JSON.stringify(await ativar(d, uid, cog)));
  ok(respostas.every(r => r === '{"status":"pendente"}'), "TODAS as falhas devolvem exatamente a mesma resposta ('pendente'): não dá para descobrir se o @ existe nem por que falhou");
  const p = await pend(d);
  for (const [uid, , motivo] of casos) ok(p.some(x => x.u === U(uid) && x.motivo === motivo && x.status === "aberto"), `vira pedido para o admin: ${motivo}`);
  ok(p.find(x => x.u === U(3)).c !== null && p.find(x => x.u === U(8)).c === null, "o pedido guarda a joiner candidata quando é uma só (bia) e nenhuma quando o COG é ambíguo (ela)");
  ok((await vinc(d)).length === 2, "nenhuma dessas contas foi vinculada (só ana e fabi)");
  ok((await ativar(d, 9, "gabi")).status === "email_nao_verificado" && (await vinc(d)).length === 2, "e-mail NÃO confirmado: recusa e não vincula (nem cria pedido)");
  ok((await ativar(d, 10, "ana")).status === "pendente" && (await pend(d)).some(x => x.u === U(10) && x.motivo === "email_compartilhado" || x.motivo === "cog_ja_vinculado"), "mesma joiner já vinculada a outra conta: não assume, vai para o admin");
  ok((await como(d, "anon", null, "select public.ativar_minha_conta('ana')")).erro?.includes("permission denied"), "visitante anônimo NÃO executa o vínculo");
  ok((await como(d, "service_role", null, "select public.ativar_minha_conta('ana') r")).rows?.[0].r.status === "nao_autenticado", "sem sessão: 'nao_autenticado'");
  ok((await ativar(d, 3, "ana")).status === "pendente" && (await vinc(d)).length === 2, "tentar o COG de outra pessoa com e-mail que não é o dela não funciona");
  ok((await ativar(d, 3, "bia")).status === "pendente" && (await pend(d)).filter(x => x.u === U(3)).length === 1, "pedir repetidamente não acumula: um pedido aberto por conta");

  // permissões das tabelas
  ok(negado(await como(d, "authenticated", 2, "insert into public.contas_joiner (user_id, joiner_id) values ('" + U(3) + "', 2)")), "conta logada NÃO se vincula escrevendo direto na tabela");
  ok(negado(await como(d, "authenticated", 2, "update public.contas_joiner set joiner_id = 2")), "conta logada NÃO altera vínculos");
  ok(negado(await como(d, "anon", null, "select * from public.contas_joiner")) && negado(await como(d, "anon", null, "select * from public.vinculos_pendentes")), "visitante NÃO lê vínculos nem pedidos");
  ok((await como(d, "authenticated", 2, "select joiner_id from public.contas_joiner")).rows.length === 1, "cada conta lê só o próprio vínculo");
  ok((await como(d, "authenticated", 2, "select * from public.vinculos_pendentes")).rows.length === 0, "joiner NÃO enxerga os pedidos pendentes");
  ok((await como(d, "authenticated", 1, "select joiner_id from public.contas_joiner")).rows.length === 2, "administrador lê todos os vínculos");

  // resolução administrativa
  ok(negado(await como(d, "authenticated", 2, "select * from public.admin_vinculos_pendentes()")), "joiner NÃO lista pedidos do admin");
  ok(negado(await como(d, "authenticated", 2, "select public.admin_resolver_vinculo(1, true)")), "joiner NÃO aprova pedidos");
  ok(negado(await como(d, "authenticated", 2, "select * from public.admin_buscar_joiners('ela')")), "joiner NÃO busca joiners como admin");
  ok(negado(await como(d, "authenticated", 2, "select public.admin_desvincular_conta('" + U(3) + "')")), "joiner NÃO desvincula contas");
  const lista = (await como(d, "authenticated", 1, "select * from public.admin_vinculos_pendentes()")).rows;
  ok(lista.length >= 6 && lista.some(x => x.motivo === "email_diferente" && x.email_da_conta === "bia.nova@exemplo.com"), "administrador vê os pedidos, com o e-mail da conta e o motivo");
  const pb = lista.find(x => x.motivo === "email_diferente");
  ok((await como(d, "authenticated", 1, `select public.admin_resolver_vinculo(${pb.id}, true) r`)).rows[0].r.status === "aprovado" && (await vinc(d)).some(v => String(v.j) === "2" && v.u === U(3)), "admin aprova (e-mail diferente, confirmado por outro meio) => bia vinculada, origem admin");
  const pc = lista.find(x => x.motivo === "cog_ambiguo");
  ok(/informe o id da joiner/.test((await como(d, "authenticated", 1, `select public.admin_resolver_vinculo(${pc.id}, true) r`)).erro || ""), "COG repetido: o admin não aprova sem decidir qual joiner");
  const achadas = (await como(d, "authenticated", 1, "select * from public.admin_buscar_joiners('@ela')")).rows;
  ok(achadas.length === 2 && achadas.some(j => String(j.id) === "255010") && achadas.some(j => String(j.id) === "7"), "admin busca 'ela' e vê as DUAS joiners, cada uma com o seu id");
  ok((await como(d, "authenticated", 1, `select public.admin_resolver_vinculo(${pc.id}, true, 255010) r`)).rows[0].r.status === "aprovado" && (await vinc(d)).some(v => String(v.j) === "255010" && v.u === U(8)), "admin escolhe pelo ID exato (255010) e aprova");
  const pd = lista.find(x => x.motivo === "email_compartilhado") || lista.find(x => x.motivo === "cog_ja_vinculado");
  ok(/já está vinculada/.test((await como(d, "authenticated", 1, `select public.admin_resolver_vinculo(${pd.id}, true, 1) r`)).erro || ""), "admin NÃO consegue vincular uma joiner que já tem conta");
  ok((await como(d, "authenticated", 1, `select public.admin_resolver_vinculo(${pd.id}, false) r`)).rows[0].r.status === "recusado", "admin recusa um pedido");
  ok((await como(d, "authenticated", 1, `select public.admin_resolver_vinculo(${pd.id}, false) r`)).rows[0].r.status === "nao_encontrado", "pedido já resolvido não pode ser resolvido de novo");
  ok(/não existe/.test((await como(d, "authenticated", 1, `select public.admin_resolver_vinculo(${lista.find(x => x.motivo === "cog_inexistente").id}, true, 999999) r`)).erro || ""), "admin não vincula a um id inexistente");
  // desvincular por engano
  ok((await como(d, "authenticated", 1, `select public.admin_desvincular_conta('${U(8)}') r`)).rows[0].r.status === "desvinculada" && !(await vinc(d)).some(v => v.u === U(8)), "admin desvincula uma conta ligada por engano");
  ok(await fpJ(d) === antes, "no fim, a tabela joiners continua IDÊNTICA (a joiner e o histórico nunca são tocados)");
  // proteção do histórico: não dá para apagar uma joiner que tem conta
  ok(!!(await d.query("delete from public.joiners where id = 1").then(() => null, e => e.message)), "não é possível apagar uma joiner que tem conta vinculada (histórico protegido)");

  const est = (await d.query("select detalhe from emergencia.c0b_estado_anterior where etapa = 'J1'")).rows;
  ok(est.length === 1 && !/@/.test(est[0].detalhe), "o registro do estado anterior guarda só contagem e hash (nenhum e-mail)");
  ok(/já foi aplicada/.test((await rodar(d, "J1_estrutura_aplicar.sql")) || ""), "reaplicar o J1 é recusado");
  const v = Object.fromEntries((await d.query(sql("J1_verificar.sql"))).rows.map(r => [r.item, r.valor]));
  ok(v["RLS ligado em contas_joiner e vinculos_pendentes (esperado true)"] === "true" && v["anon com algum acesso às 2 tabelas (esperado false)"] === "false" && v["authenticated escreve direto nas 2 tabelas (esperado false)"] === "false" && v["funções security definer com search_path vazio (esperado 7)"] === "7" && v["funções executáveis por anon (esperado 0)"] === "0" && v["vínculo por id permanente (coluna joiner_id existe, sem coluna cog) (esperado true)"] === "true", "verificação J1: tudo como esperado");
  ok(!/@/.test(JSON.stringify(v)), "verificação J1: nenhuma saída mostra e-mail");

  ok(/falta a confirmação/.test((await rodar(d, "J1_reverter_protegido.sql")) || ""), "reversão SEM a frase é recusada");
  ok(/Existem \d+ contas vinculadas/.test((await rodar(d, "J1_reverter_protegido.sql", DJ, "AUTORIZO REMOVER ESTRUTURA DE CONTAS")) || ""), "reversão com vínculos existentes é recusada com a frase curta");
  ok((await rodar(d, "J1_reverter_protegido.sql", DJ, "AUTORIZO REMOVER ESTRUTURA DE CONTAS E VINCULOS")) === null && (await d.query("select to_regclass('public.contas_joiner') is null e")).rows[0].e, "com a frase longa a estrutura é removida");
  ok(await fpJ(d) === antes, "e a tabela joiners continua intacta");
  ok((await rodar(d, "J1_estrutura_aplicar.sql")) === null, "o J1 pode ser reaplicado depois da reversão");
}
{ const d = await banco(); await d.exec("create table public.contas_joiner (x int)"); ok(/já existem/.test((await rodar(d, "J1_estrutura_aplicar.sql")) || ""), "J1 ABORTA se a tabela já existir (não sobrescreve)"); }
{ const d = await banco(); await d.exec("drop table public.joiners cascade"); ok(/public.joiners não existe/.test((await rodar(d, "J1_estrutura_aplicar.sql")) || ""), "J1 ABORTA sem a tabela joiners"); }
{ const d = await banco({ semPk: true, idsRuins: true }); ok(/não serve como identificador/.test((await rodar(d, "J1_estrutura_aplicar.sql")) || ""), "J1 ABORTA se joiners.id tiver valor nulo (identificador não confiável)"); }
{ const d = await banco({ semPk: true }); await d.exec("insert into public.joiners (id, cog) values (1, 'repetida')"); ok(/repetido/.test((await rodar(d, "J1_estrutura_aplicar.sql")) || ""), "J1 ABORTA se joiners.id tiver valor repetido"); }
{ const d = await banco({ semPk: true }); ok((await rodar(d, "J1_estrutura_aplicar.sql")) === null, "J1 aplica mesmo sem constraint de unicidade no id, desde que os valores sejam únicos (sem a trava de apagar)"); }
{ const d = await banco(); await rodar(d, "J1_estrutura_aplicar.sql"); await d.exec(`insert into auth.users values ('${U(20)}','fabi@exemplo.com',now())`);
  ok((await ativar(d, 12, "fabi")).status === "ok" && (await ativar(d, 20, "fabi")).status === "pendente" && (await vinc(d)).filter(v => String(v.j) === "10").length === 1, "duas contas com o mesmo e-mail tentando a mesma joiner: só uma é vinculada, a outra vira pedido"); }

{ // checagem de administrador que nega também NULL (is_admin() indefinido não pode abrir as funções admin)
  const d = await banco(); await rodar(d, "J1_estrutura_aplicar.sql");
  await d.exec("create or replace function public.is_admin() returns boolean language sql stable as $f$ select null::boolean $f$");
  for (const q of ["select * from public.admin_vinculos_pendentes()", "select public.admin_resolver_vinculo(1, false)", "select * from public.admin_buscar_joiners('ana')", "select public.admin_desvincular_conta('" + U(3) + "')"])
    ok(/sem permiss/.test((await como(d, "authenticated", 1, q)).erro || ""), "is_admin() NULL é NEGADO: " + q.slice(0, 50));
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
