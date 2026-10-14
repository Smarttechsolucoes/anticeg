// Teste do J4c-3 (lojas públicas e formulários) no laboratório fictício (PGlite, só dados fictícios). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4c3-lojas.mjs
process.on("uncaughtException", e => { console.log("ERRO:", String(e.message).slice(0, 600)); process.exit(2); });
process.on("unhandledRejection", e => { console.log("ERRO:", String(e && e.message || e).slice(0, 600)); process.exit(2); });
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = (f, d) => readFileSync(R + d + "/" + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
// contas: 1 administradora | 2 ana (ativada, joiner 1) | 3 bia (ativada, joiner 2) | 4 conta SEM vínculo | 9 gabi (ativada)
async function laboratorio({ comJ4_0 = true, semRlsEm = null } = {}) {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $f$;
    create function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    insert into auth.users values ('${U(1)}','dona@exemplo.com',now()), ('${U(2)}','ana@exemplo.com',now()), ('${U(3)}','bia.antiga@exemplo.com',now()), ('${U(4)}','sem.vinculo@exemplo.com',now()), ('${U(9)}','gabi@exemplo.com',now()), ('${U(7)}','ela.conta@exemplo.com',now()), ('${U(8)}','ela2.conta@exemplo.com',now());
  `);
  await d.exec(sql("01_schema_minimo.sql", "laboratorio")); await d.exec(sql("02_politicas_de_hoje_simuladas.sql", "laboratorio"));
  // "hoje": os papéis do Supabase têm os privilégios padrão; as travas por coluna da masterlist (B1/B4) já existem
  await d.exec(`grant all on all tables in schema public to anon, authenticated, service_role; grant all on all sequences in schema public to anon, authenticated, service_role;`);
  await d.exec(`revoke update on public.masterlist from anon, authenticated; grant update (ceg, cog, nome, nome_do_item, valor_item, frete_inter, taxa_rf, status, info_adicionais, na_loja, id_linha) on public.masterlist to anon, authenticated;
                revoke update, delete on public.pagamento_demandas from anon, authenticated; revoke insert, update, delete on public.multas_pagas from anon, authenticated;`);
  await d.exec(sql("03_dados_ficticios.sql", "laboratorio")); await d.exec(sql("04_tabelas_j4c.sql", "laboratorio")); await d.exec(sql("06_lojas_publicas.sql", "laboratorio"));
  if (semRlsEm) await d.exec(`alter table public.${semRlsEm} disable row level security`);
  await d.exec(sql("A1_base_aplicar.sql", "admin-auth")); await d.exec(sql("A2_senha_apenas_aplicar.sql", "admin-auth"));
  await d.exec(`insert into public.admin_roles (user_id) values ('${U(1)}')`);
  await d.exec(sql("J1_estrutura_aplicar.sql", "joiners-auth"));
  // contas ativadas pelo caminho oficial (e-mail confirmado igual ao cadastro) e uma pelo admin
  const ativar = async (uid, cog) => { await d.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(uid), role: "authenticated" })}', false)`); await d.exec("set role authenticated"); await d.query(`select public.ativar_minha_conta('${cog}')`); await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims','',false)"); };
  await ativar(2, "ana"); await ativar(9, "gabi");
  await d.exec(`insert into public.contas_joiner (user_id, joiner_id, origem) values ('${U(3)}', 2, 'admin')`);   // bia: e-mail diferente, vinculada pelo admin
  await d.exec(`insert into public.contas_joiner (user_id, joiner_id, origem) values ('${U(7)}', 7, 'admin'), ('${U(8)}', 8, 'admin');`);
  return d;
}
async function como(d, papel, uid, q) {
  await d.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: U(uid), role: papel, aal: "aal1" }) : ""}', false)`); await d.exec(`set role ${papel}`);
  try { return { rows: (await d.query(q)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
}
const negado = r => !!r.erro && /permission denied|row-level security|sem permiss/.test(r.erro);
async function rodar(d, arq, dir, frase) { try { await d.exec(frase ? sql(arq, dir).replace("confirmacao text := '';", `confirmacao text := '${frase}';`) : sql(arq, dir)); return null; } catch (e) { await d.exec("rollback").catch(() => {}); return e.message; } }
const J = "joiners-auth";
const n = async (d, papel, uid, q) => (await como(d, papel, uid, q)).rows?.length;

const barrado = r => !!r.erro && /permission denied|row-level security|sem permiss|não permitida/.test(r.erro);
const aplicarBase = async d => { for (const a of ["J4_0_admin_em_todas_aplicar.sql", "J4a_publico_aplicar.sql"]) { const e = await rodar(d, a, J); if (e) throw new Error(a + ": " + e); } };
// como 'como', mas com o e-mail verificado da conta no token (o Supabase coloca "email" no JWT)
async function comoEmail(d, uid, email, q) {
  await d.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(uid), role: "authenticated", aal: "aal1", email })}', false)`); await d.exec("set role authenticated");
  try { return { rows: (await d.query(q)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
}
const LOJAS = ["pedidos_revista", "pedidos_popup", "pedidos_wmag", "pedidos_wmag_leeknow", "pedidos_dazed_seungmin", "pedidos_smolmerch", "pedidos_bazaar_in", "pedidos_lightstick", "pedidos_popcorn_sleeve", "pedidos_singba", "pedidos_skzoo_rio"];

{
  const d = await laboratorio(); await aplicarBase(d);
  const antes = (await d.query("select count(*)::int c from public.pedidos_revista")).rows[0].c;
  ok((await n(d, "anon", null, "select 1 from public.pedidos_revista")) === antes, "ANTES: o visitante lê TODOS os pedidos da loja, com nome e e-mail (vulnerabilidade reproduzida)");
  ok((await como(d, "anon", null, "update public.pedidos_revista set status = 'confirmado' returning id")).rows?.length === antes, "ANTES: o visitante marca qualquer pedido como 'confirmado' (vulnerabilidade reproduzida)");
  await d.exec("update public.pedidos_revista set status = 'aguardando' where email = 'cliente1@exemplo.com'");
  const e = await rodar(d, "J4c3_lojas_aplicar.sql", J); ok(e === null, "J4c-3 aplica sem erro" + (e ? ": " + e : ""));
  const v = Object.fromEntries((await d.query(sql("J4c3_lojas_verificar.sql", J))).rows.map(r => [r.item, r.valor]));
  ok(v["tabelas do lote presentes"] === "12" && v["com admin_tudo (esperado = presentes)"] === "12" && v["policies para visitante/PUBLIC (esperado 0)"] === "0" && v["visitante com algum privilégio nas tabelas do lote (esperado false)"] === "false" && v["pedido_loja_criar presente, segura e FECHADA ao visitante (esperado true)"] === "true" && v["colunas pessoais na visão pública do formulário (esperado 0)"] === "0", "verificação J4c-3 como esperado: " + JSON.stringify(v).slice(0, 260));

  // visitante
  for (const t of [...LOJAS, "formulario_pedidos"]) ok(negado(await como(d, "anon", null, `select * from public.${t}`)), `visitante NÃO lê ${t}`);
  ok(negado(await como(d, "anon", null, "update public.pedidos_revista set status = 'confirmado'")) && negado(await como(d, "anon", null, "delete from public.pedidos_popup")) && negado(await como(d, "anon", null, "insert into public.pedidos_revista (nome, email, status) values ('x','x@x.com','confirmado')")), "visitante NÃO confirma, apaga nem insere direto");
  ok(negado(await como(d, "anon", null, "insert into public.formulario_pedidos (evento, joiner_cog, status) values ('WAVE MAKER - SG JAPAN 2027','ana','pendente')")), "visitante NÃO cria pedido de formulário");

  // compra pela loja (função segura)
  // D2: quem compra é a joiner ATIVADA (ana); visitante e conta sem vínculo não compram
  ok(negado(await como(d, "anon", null, `select public.pedido_loja_criar('pedidos_revista', '{"nome":"x","email":"x@x.com"}'::jsonb)`)), "D2: o VISITANTE não executa pedido_loja_criar (nem com dados válidos)");
  { const r = (await como(d, "authenticated", 4, `select public.pedido_loja_criar('pedidos_revista', '{"nome":"x","email":"x@x.com","status":"aguardando"}'::jsonb) r`)).rows?.[0]?.r; ok(r?.ok === false && r.motivo === "login_necessario", "D2: conta criada SEM vínculo a uma joiner NÃO cria pedido: " + JSON.stringify(r)); }
  const criar = async (t, dados) => (await como(d, "authenticated", 2, `select public.pedido_loja_criar('${t}', '${JSON.stringify(dados).replace(/'/g, "''")}'::jsonb) r`)).rows?.[0].r;
  const c1 = await criar("pedidos_revista", { nome: "Compradora", email: "compradora@exemplo.com", qtd_total: 1, valor_total: 100, forma_pagamento: "pix", status: "aguardando" });
  ok(c1.ok === true && /^\d+$/.test(c1.id), "a loja registra o pedido pela função e recebe SÓ o número do pedido: " + JSON.stringify(c1));
  ok((await d.query(`select status, email from public.pedidos_revista where id = ${c1.id}`)).rows[0].status === "aguardando", "o pedido nasce 'aguardando'");
  ok((await criar("pedidos_revista", { nome: "x", email: "x@x.com", status: "confirmado" })).motivo === "status_invalido" && (await criar("pedidos_revista", { nome: "x", email: "x@x.com", status: "pago" })).motivo === "status_invalido", "pedido que já nasce 'confirmado' ou 'pago' é RECUSADO");
  ok((await criar("config", { key: "x", value: "y" })).motivo === "loja_invalida" && (await criar("joiners", { cog: "x" })).motivo === "loja_invalida" && (await criar("pedidos_revista; drop table x", {})).motivo === "loja_invalida", "só as lojas da lista: tabelas como config e joiners (ou injeção) são recusadas");
  const c2 = await criar("pedidos_revista", { id: 1, created_at: "2000-01-01", nome: "Forja", email: "forja@exemplo.com", coluna_que_nao_existe: "x" });
  ok(c2.ok === true && Number(c2.id) !== 1 && (await d.query(`select created_at > now() - interval '1 hour' as novo from public.pedidos_revista where id = ${c2.id}`)).rows[0].novo === true, "id numérico e data forjados são ignorados, e coluna inexistente não quebra");
  const uuid = "11111111-1111-4111-8111-111111111111";
  ok((await criar("pedidos_smolmerch", { id: uuid, nome: "S", email: "s@exemplo.com", qtd_total: 1, valor_total: 50, status: "aguardando" })).id === uuid, "SmolMerch (id UUID gerado no navegador) segue funcionando");
  ok((await criar("pedidos_lightstick", { nome: "L", contato: "l@exemplo.com", joiner_cog: null, status: "aguardando" })).ok === true && (await criar("pedidos_singba", { nome: "S", contato: "s", itens: [{ opcao: "a" }], quantidade: 1, status: "aguardando", metodo_pagamento: "pix" })).ok === true && (await criar("pedidos_skzoo_rio", { cog: "ana", nome: "Ana", itens: [], total_reais: 10, status: "pendente" })).ok === true && (await criar("pedidos_popup", { nome: "P", email: "p@exemplo.com", week: "01", itens: [], status: "pendente" })).ok === true, "lightstick, singba, skzoo rio e popup também compram pela função");
  ok((await criar("pedidos_revista", {})).motivo === "dados_invalidos", "pedido vazio é recusado");
  await d.exec("insert into public.pedidos_wmag (nome, email) select 'spam', 'spam@exemplo.com' from generate_series(1, 200)");
  ok((await criar("pedidos_wmag", { nome: "Mais um", email: "m@exemplo.com" })).motivo === "tente_mais_tarde", "trava de 200 pedidos por hora por loja");

  // conta logada: só o que é dela
  ok((await comoEmail(d, 2, "ana@exemplo.com", "select email c from public.pedidos_revista")).rows.map(r => r.c).join() === "ana@exemplo.com", "ana (e-mail verificado) vê só o pedido de revista feito com o e-mail dela");
  ok((await comoEmail(d, 2, "ana@exemplo.com", "select email c from public.pedidos_popup")).rows.map(r => r.c).join() === "ana@exemplo.com", "ana vê só o pedido de popup dela");
  ok((await comoEmail(d, 3, "bia.antiga@exemplo.com", "select 1 from public.pedidos_revista")).rows.length === 0, "bia (outro e-mail) não vê o pedido da ana");
  ok((await comoEmail(d, 4, "sem.vinculo@exemplo.com", "select 1 from public.pedidos_lightstick")).rows.length === 0, "conta sem vínculo não vê pedido por COG");
  ok((await comoEmail(d, 2, "ana@exemplo.com", "select joiner_cog c from public.pedidos_lightstick")).rows.map(r => r.c).join() === "ana", "lightstick: ana vê só o dela (pelo COG exato)");
  ok((await comoEmail(d, 2, "ana@exemplo.com", "select cog c from public.pedidos_skzoo_rio")).rows.every(r => r.c === "ana"), "skzoo rio: ana vê só os dela (nenhum da bia)");
  ok((await comoEmail(d, 7, "ela.conta@exemplo.com", "select joiner_cog c from public.pedidos_lightstick")).rows.map(r => r.c).join() === "Ela" && (await comoEmail(d, 8, "ela2.conta@exemplo.com", "select joiner_cog c from public.pedidos_lightstick")).rows.map(r => r.c).join() === "ela", "COGs parecidos: 'Ela' e 'ela' veem cada uma só o seu pedido");
  ok(barrado(await comoEmail(d, 2, "ana@exemplo.com", "update public.pedidos_revista set status = 'confirmado' where email = 'ana@exemplo.com'")) || (await comoEmail(d, 2, "ana@exemplo.com", "update public.pedidos_revista set status = 'confirmado' where email = 'ana@exemplo.com' returning id")).rows?.length === 0, "ana NÃO confirma o próprio pedido (só a administradora)");
  ok(barrado(await comoEmail(d, 2, "ana@exemplo.com", "insert into public.pedidos_revista (nome, email, status) values ('x','ana@exemplo.com','confirmado')")), "conta logada NÃO insere pedido direto");

  // formulários
  const fcol = async (uid, email) => (await comoEmail(d, uid, email, "select joiner_cog c from public.formulario_pedidos")).rows.map(r => r.c).join();
  ok(await fcol(2, "ana@exemplo.com") === "ana" && await fcol(3, "bia.antiga@exemplo.com") === "bia" && await fcol(7, "ela.conta@exemplo.com") === "Ela" && await fcol(8, "ela2.conta@exemplo.com") === "ela", "formulários: ana, bia, Ela e ela veem cada uma só o próprio pedido");
  ok((await comoEmail(d, 2, "ana@exemplo.com", "insert into public.formulario_pedidos (evento, joiner_cog, joiner_nome, modalidade, observacoes, status) values ('RUN IT VOL 2','ana','Ana','Envio','Qtd: 1','pendente') returning id")).rows?.length === 1, "ana cria o próprio pedido de formulário (pendente)");
  ok(barrado(await comoEmail(d, 2, "ana@exemplo.com", "insert into public.formulario_pedidos (evento, joiner_cog, status) values ('RUN IT VOL 2','bia','pendente')")) && barrado(await comoEmail(d, 2, "ana@exemplo.com", "insert into public.formulario_pedidos (evento, joiner_cog, status) values ('RUN IT VOL 2','ana','confirmado')")) && barrado(await comoEmail(d, 7, "ela.conta@exemplo.com", "insert into public.formulario_pedidos (evento, joiner_cog, status) values ('RUN IT VOL 2','ela','pendente')")), "ana não cria no nome da bia nem já 'confirmado'; a 'Ela' não cria no nome da 'ela'");
  ok(barrado(await comoEmail(d, 2, "ana@exemplo.com", "update public.formulario_pedidos set status = 'confirmado'")) || (await comoEmail(d, 2, "ana@exemplo.com", "update public.formulario_pedidos set status = 'confirmado' returning id")).rows?.length === 0, "ana NÃO confirma o próprio pedido de formulário");
  const pub = (await como(d, "anon", null, "select * from public.formulario_pedidos_publico where evento = 'WAVE MAKER - SG JAPAN 2027' order by id")).rows;
  ok(pub.length === 4 && Object.keys(pub[0]).sort().join() === "created_at,evento,id,modalidade,observacoes,status", "visão pública (estoque e fila): só 6 colunas, sem COG, nome nem e-mail");
  ok(pub[0].observacoes === "Qtd: 2" && !JSON.stringify(pub).includes("secreto"), "a visão só devolve 'Qtd: N' — o texto livre das observações não vaza");
  ok((await como(d, "anon", null, "select count(*)::int c from public.formulario_pedidos_publico where status = 'pendente' and evento = 'WAVE MAKER - SG JAPAN 2027'")).rows[0].c === 3, "a fila (contagem de pendentes) continua funcionando para o visitante");

  // administradora e servidor
  ok((await n(d, "authenticated", 1, "select 1 from public.pedidos_revista")) >= antes && (await n(d, "authenticated", 1, "select 1 from public.formulario_pedidos")) >= 4, "administradora lê tudo");
  ok((await como(d, "authenticated", 1, "update public.pedidos_revista set status = 'confirmado' where email = 'ana@exemplo.com' returning id")).rows?.length === 1, "administradora confirma pedido");
  ok((await como(d, "service_role", null, "update public.pedidos_popup set status = 'confirmado' returning id")).rows?.length >= 1, "service_role continua funcionando");

  // estado, reaplicação, reversão
  const est = (await d.query("select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-3'")).rows;
  ok(est.length >= 20 && !/ana@exemplo|cliente1@/.test(JSON.stringify(est)), "estado anterior registrado, sem dados pessoais");
  ok(/já foi aplicado/.test((await rodar(d, "J4c3_lojas_aplicar.sql", J)) || ""), "reaplicar é recusado");
  ok(/falta a confirmação/.test((await rodar(d, "J4c3_lojas_reverter_protegido.sql", J)) || ""), "reversão sem a frase é recusada");
  ok((await rodar(d, "J4c3_lojas_reverter_protegido.sql", J, "AUTORIZO REABRIR PEDIDOS DAS LOJAS")) === null && (await n(d, "anon", null, "select 1 from public.pedidos_revista")) > 0 && (await d.query("select to_regprocedure('public.pedido_loja_criar(text,jsonb)') p")).rows[0].p === null, "reversão com a frase reabre como era e remove a função e a visão");
}
{ const d = await laboratorio(); await aplicarBase(d); await d.exec("drop table public.formulario_pedidos cascade"); ok(/não existe/.test((await rodar(d, "J4c3_lojas_aplicar.sql", J)) || ""), "J4c-3 ABORTA se formulario_pedidos não existir (nada alterado)"); }
{ const d = await laboratorio(); await aplicarBase(d); await d.exec("delete from public.admin_roles"); ok(/administradora cadastrada/.test((await rodar(d, "J4c3_lojas_aplicar.sql", J)) || ""), "J4c-3 ABORTA sem administradora cadastrada"); }
{ const d = await laboratorio(); ok(/J4a não está aplicado|J1\/A1/.test((await rodar(d, "J4c3_lojas_aplicar.sql", J)) || ""), "J4c-3 ABORTA sem o J4a"); }
{ const d = await laboratorio(); await aplicarBase(d); await d.exec("alter table public.pedidos_singba drop column status cascade"); ok(/não tem a coluna status/.test((await rodar(d, "J4c3_lojas_aplicar.sql", J)) || ""), "J4c-3 ABORTA se uma loja não tem a coluna status"); }

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
