// Teste do J4 (administradora em todas as tabelas, peças públicas e lote 1 de RLS) sobre o laboratório fictício (banco simulado com PGlite, só dados fictícios). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4-rls.mjs
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
  await d.exec(sql("03_dados_ficticios.sql", "laboratorio"));
  if (semRlsEm) await d.exec(`alter table public.${semRlsEm} disable row level security`);
  await d.exec(sql("A1_base_aplicar.sql", "admin-auth")); await d.exec(sql("A2_senha_apenas_aplicar.sql", "admin-auth"));
  await d.exec(`insert into public.admin_roles (user_id) values ('${U(1)}')`);
  await d.exec(sql("J1_estrutura_aplicar.sql", "joiners-auth"));
  // contas ativadas pelo caminho oficial (e-mail confirmado igual ao cadastro) e uma pelo admin
  const ativar = async (uid, cog) => { await d.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(uid), role: "authenticated" })}', false)`); await d.exec("set role service_role"); await d.query(`select public.ativar_minha_conta('${cog}')`); await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims','',false)"); };
  await ativar(2, "ana"); await ativar(9, "gabi");
  await d.exec(`insert into public.contas_joiner (user_id, joiner_id, origem) values ('${U(3)}', 2, 'admin')`);   // bia: e-mail diferente, vinculada pelo admin
  // COGs parecidos: 'Ela' (joiner 7) e 'ela' (joiner 8) são pessoas DIFERENTES; as contas são ligadas pelo admin, por id
  await d.exec(`insert into public.contas_joiner (user_id, joiner_id, origem) values ('${U(7)}', 7, 'admin'), ('${U(8)}', 8, 'admin');
    insert into public.pagamento_demandas (joiner_cog, itens, valor_total, status) values ('Ela','[]',1,'em_analise'), ('ela','[]',2,'em_analise');
    insert into public.masterlist (id, ceg, cog, nome, nome_do_item, status) values (7,'SKZOO','ela','Ela Minúscula','Photocard E','Comprado');
    insert into public.multas_pagas (joiner_cog, masterlist_id, campo, dias_atraso, valor_multa) values ('Ela',6,'item',1,1), ('ela',7,'item',2,2);`);
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

// ══ J4-0: administradora em todas as tabelas ═════════════════════════════════════════════════
{
  const d = await laboratorio({ semRlsEm: "claims" });
  const antesMl = (await como(d, "service_role", null, "select count(*)::int c from public.masterlist")).rows[0].c;
  ok((await rodar(d, "J4_0_admin_em_todas_aplicar.sql", J)) === null, "J4-0 aplica sem erro");
  const v = Object.fromEntries((await d.query(sql("J4_0_admin_em_todas_verificar.sql", J))).rows.map(r => [r.item, r.valor]));
  ok(Number(v["tabelas com a policy admin_tudo"]) >= 5 && v["admin_tudo fora do padrão (esperado 0)"] === "0", "J4-0: admin_tudo criada nas tabelas com RLS, todas só para is_admin()");
  ok(/claims/.test(v["tabelas SEM RLS (a tratar nos lotes)"]) && !(await d.query("select 1 from pg_policies where tablename='claims' and policyname='admin_tudo'")).rows.length, "J4-0: tabela SEM RLS é só listada, NÃO é tocada (ligar RLS nela quebraria o site)");
  ok(v["authenticated NÃO ganhou UPDATE de tabela inteira em masterlist/pagamento_demandas/multas_pagas (esperado false)"] === "false", "J4-0: não reabre as colunas travadas da masterlist");
  ok((await como(d, "authenticated", 1, "select count(*)::int c from public.masterlist")).rows[0].c === antesMl, "J4-0: a administradora logada enxerga toda a masterlist");
  ok((await n(d, "authenticated", 2, "select 1 from public.joiners")) === 0, "J4-0: uma joiner logada NÃO ganha acesso por este passo (continua sem policy para o papel dela)");
  ok((await n(d, "anon", null, "select 1 from public.masterlist")) === antesMl, "J4-0: o visitante segue como hoje (passo aditivo)");
  ok(negado(await como(d, "authenticated", 1, "update public.masterlist set pago_item = true where id = 1")), "J4-0: nem a administradora edita pago_* (só o sync)");
  ok(/já foi aplicada/.test((await rodar(d, "J4_0_admin_em_todas_aplicar.sql", J)) || ""), "reaplicar o J4-0 é recusado");
  ok(/falta a confirmação/.test((await rodar(d, "J4_0_admin_em_todas_reverter_protegido.sql", J)) || ""), "reversão sem a frase é recusada");
  ok((await rodar(d, "J4_0_admin_em_todas_reverter_protegido.sql", J, "AUTORIZO REMOVER ACESSO DA ADMIN")) === null && (await n(d, "authenticated", 1, "select 1 from public.joiners")) === 0, "reversão com a frase remove a policy e o acesso da administradora");
}

// ══ J4a: peças públicas ══════════════════════════════════════════════════════════════════════
{
  const d = await laboratorio();
  ok((await rodar(d, "J4a_publico_aplicar.sql", J)) === null, "J4a aplica sem erro");
  const v = Object.fromEntries((await d.query(sql("J4a_publico_verificar.sql", J))).rows.map(r => [r.item, r.valor]));
  ok(v["coluna sensível na visão pública (esperado 0)"] === "0" && v["anon executa meus_dados (esperado false)"] === "false" && v["funções security definer com search_path vazio (esperado 4)"] === "4", "verificação J4a como esperado");
  const pub = (await como(d, "anon", null, "select * from public.joiners_publico order by cog")).rows;
  ok(pub.length === 11 && Object.keys(pub[0]).sort().join() === "cog,foto_perfil,nome_site,recrutador,twitter", "visão pública: só 5 colunas seguras");
  ok(!!(await como(d, "anon", null, "select email from public.joiners_publico")).erro, "visitante NÃO consegue pedir e-mail pela visão pública");
  const ana = (await como(d, "anon", null, "select public.entrar_com_arroba('@ANA') r")).rows[0].r;
  ok(ana.encontrado === true && ana.cog === "ana" && ana.conta_ativa === true && Object.keys(ana).sort().join() === "cog,conta_ativa,encontrado,foto_perfil,nome_site", "acesso simples: só identidade mínima + se a conta está ativa");
  ok(!/@exemplo|000\.000|1190000|Rua /.test(JSON.stringify(ana)), "acesso simples: NENHUM dado pessoal (e-mail, CPF, endereço, telefone)");
  ok((await como(d, "anon", null, "select public.entrar_com_arroba('cris') r")).rows[0].r.conta_ativa === false, "joiner sem conta ativada: o acesso simples avisa 'conta_ativa: false'");
  for (const x of ["naoexiste", "ela", "@", "", "a b", "ana@exemplo.com", "bloq"]) ok((await como(d, "anon", null, `select public.entrar_com_arroba('${x}') r`)).rows[0].r.encontrado === false, `acesso simples recusa: '${x}' (inexistente, ambíguo, vazio, e-mail ou bloqueada) com a mesma resposta`);
  ok((await como(d, "anon", null, "select public.entrar_com_arroba('@Bia') r")).rows[0].r.encontrado === true, "acha também pelo @ do twitter (maiúsculas ignoradas)");
  ok(negado(await como(d, "anon", null, "select public.meus_dados()")), "visitante NÃO executa meus_dados()");
  const meus = (await como(d, "authenticated", 2, "select public.meus_dados() r")).rows[0].r;
  ok(meus.cog === "ana" && meus.email === "ana@exemplo.com" && meus.cpf === "000.000.000-01", "joiner logada recebe a PRÓPRIA linha completa");
  ok((await como(d, "authenticated", 4, "select public.meus_dados() r")).rows[0].r === null, "conta sem vínculo não recebe linha nenhuma");
  ok((await como(d, "anon", null, "select public.contar_recrutados('ana') c")).rows[0].c === 1, "contar_recrutados devolve só o número");
  ok((await rodar(d, "J4a_publico_reverter_protegido.sql", J, "AUTORIZO REMOVER PECAS PUBLICAS")) === null && (await d.query("select to_regclass('public.joiners_publico') is null e")).rows[0].e, "reversão protegida remove as peças");
}

// ══ J4b lote 1: dados individuais ════════════════════════════════════════════════════════════
{
  const d = await laboratorio();
  await rodar(d, "J4_0_admin_em_todas_aplicar.sql", J); await rodar(d, "J4a_publico_aplicar.sql", J);
  const antes = { pag: (await d.query("select count(*)::int c from public.pagamento_demandas")).rows[0].c, ml: (await d.query("select count(*)::int c from public.masterlist")).rows[0].c };
  ok((await n(d, "anon", null, "select 1 from public.pagamento_demandas")) === antes.pag, "ANTES: o visitante lê TODOS os pagamentos (vulnerabilidade reproduzida)");
  const e = await rodar(d, "J4b_lote1_aplicar.sql", J); ok(e === null, "J4b lote 1 aplica sem erro" + (e ? ": " + e : ""));
  const v = Object.fromEntries((await d.query(sql("J4b_lote1_verificar.sql", J))).rows.map(r => [r.item, r.valor]));
  ok(v["policies nas 3 tabelas (esperado 9)"] === "9" && v["policies para visitante/PUBLIC (esperado 0)"] === "0" && v["visitante com algum privilégio nas 3 tabelas (esperado false)"] === "false" && v["colunas travadas da masterlist editáveis por conta logada (esperado 0)"] === "0", "verificação J4b como esperado");

  // visitante e "acesso simples só com @": nada
  for (const t of ["pagamento_demandas", "multas_pagas", "masterlist"]) ok(negado(await como(d, "anon", null, `select * from public.${t}`)), `visitante NÃO lê ${t}`);
  ok(negado(await como(d, "anon", null, "insert into public.pagamento_demandas (joiner_cog, itens, valor_total) values ('ana','[]',1)")), "visitante NÃO cria demanda de pagamento");
  ok(negado(await como(d, "anon", null, "update public.masterlist set cog = 'anon' where id = 4")), "visitante NÃO assume slot");
  // conta sem vínculo (e-mail confirmado mas não ativada): nada
  ok((await n(d, "authenticated", 4, "select 1 from public.pagamento_demandas")) === 0 && (await n(d, "authenticated", 4, "select 1 from public.masterlist where lower(cog) <> 'disponivel'")) === 0, "conta logada SEM vínculo não vê dado de ninguém");
  // ana: só o que é dela
  ok((await como(d, "authenticated", 2, "select joiner_cog from public.pagamento_demandas")).rows.every(r => r.joiner_cog === "ana") && (await n(d, "authenticated", 2, "select 1 from public.pagamento_demandas")) === 1, "ana vê só o próprio pagamento (o da bia fica invisível)");
  ok((await como(d, "authenticated", 2, "select cog from public.masterlist where lower(cog) <> 'disponivel'")).rows.every(r => r.cog === "ana") && (await n(d, "authenticated", 2, "select 1 from public.masterlist where lower(cog) <> 'disponivel'")) === 2, "ana vê só os próprios itens (não vê os da bia nem da Ela)");
  ok((await n(d, "authenticated", 2, "select 1 from public.masterlist where lower(cog) = 'disponivel'")) === 2, "ana vê os slots 'disponivel' (necessário para o claim)");
  ok((await n(d, "authenticated", 2, "select 1 from public.multas_pagas")) === 1 && (await n(d, "authenticated", 3, "select 1 from public.multas_pagas")) === 1, "multas: cada uma vê só a sua");
  // criar demanda
  ok((await como(d, "authenticated", 2, "insert into public.pagamento_demandas (joiner_cog, itens, valor_total, comprovante_url) values ('ana','[]',10,'x') returning status")).rows?.[0].status === "em_analise", "ana cria a própria demanda e ela nasce 'em_analise'");
  ok(negado(await como(d, "authenticated", 2, "insert into public.pagamento_demandas (joiner_cog, itens, valor_total) values ('bia','[]',10)")), "ana NÃO cria demanda no nome da bia");
  ok(negado(await como(d, "authenticated", 2, "insert into public.pagamento_demandas (joiner_cog, itens, valor_total, status) values ('ana','[]',10,'pago')")), "ana NÃO cria demanda já como 'pago'");
  ok(negado(await como(d, "authenticated", 2, "update public.pagamento_demandas set status = 'pago'")), "ana NÃO altera status de pagamento");
  ok(negado(await como(d, "authenticated", 2, "insert into public.multas_pagas (joiner_cog, masterlist_id, campo, dias_atraso, valor_multa) values ('ana',1,'item',1,0)")), "ninguém além do servidor cria multa");
  // claim
  ok((await como(d, "authenticated", 2, "update public.masterlist set cog = 'ana', nome = 'Ana Fictícia' where id = 5 returning id")).rows?.length === 1, "ana assume um slot 'disponivel' para si (claim)");
  ok((await como(d, "authenticated", 2, "update public.masterlist set cog = 'bia' where id = 4 returning id")).rows?.length === 0 || negado(await como(d, "authenticated", 2, "update public.masterlist set cog = 'bia' where id = 4")), "ana NÃO consegue entregar um slot para outra pessoa");
  ok(negado(await como(d, "authenticated", 2, "update public.masterlist set cog = 'ana' where id = 3")) || (await como(d, "authenticated", 2, "update public.masterlist set cog = 'ana' where id = 3 returning id")).rows?.length === 0, "ana NÃO toma o item da bia");
  ok((await d.query("select cog from public.masterlist where id = 3")).rows[0].cog === "bia", "o item da bia continua com a bia");
  ok(negado(await como(d, "authenticated", 2, "update public.masterlist set pago_item = true where id = 1")), "colunas travadas (pago_*) seguem travadas para a joiner");
  ok((await como(d, "authenticated", 2, "insert into public.masterlist (id, ceg, cog, nome, nome_do_item) values (90, 'CLAIM', 'disponivel', 'disponivel', 'Novo slot') returning id")).rows?.length === 1, "joiner abre o próximo slot de um set (CLAIM/disponivel), como o fluxo atual");
  ok(negado(await como(d, "authenticated", 2, "insert into public.masterlist (id, ceg, cog, nome, nome_do_item) values (91, 'SKZOO', 'ana', 'x', 'Item inventado')")), "joiner NÃO cria item arbitrário na masterlist");
  // administradora e servidor
  ok((await n(d, "authenticated", 1, "select 1 from public.pagamento_demandas")) >= antes.pag && (await n(d, "authenticated", 1, "select 1 from public.masterlist")) >= antes.ml, "administradora lê tudo");
  ok((await como(d, "service_role", null, "update public.masterlist set pago_item = true where id = 1 returning id")).rows?.length === 1, "service_role (sync) continua marcando pago");
  ok((await como(d, "service_role", null, "insert into public.multas_pagas (joiner_cog, masterlist_id, campo, dias_atraso, valor_multa) values ('ana',1,'item',2,2) returning id")).rows?.length === 1, "service_role (gatilho de multa) continua gravando");
  const est = (await d.query("select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4b-1'")).rows;
  ok(est.length >= 10 && !/@exemplo|000\.000/.test(JSON.stringify(est)), "estado anterior registrado, sem dados pessoais");
  ok(/já foi aplicado/.test((await rodar(d, "J4b_lote1_aplicar.sql", J)) || ""), "reaplicar o lote é recusado");
  // reversão
  ok(/falta a confirmação/.test((await rodar(d, "J4b_lote1_reverter_protegido.sql", J)) || ""), "reversão sem a frase é recusada");
  ok((await rodar(d, "J4b_lote1_reverter_protegido.sql", J, "AUTORIZO REABRIR DADOS DO LOTE 1")) === null && (await n(d, "anon", null, "select 1 from public.pagamento_demandas")) >= antes.pag, "reversão com a frase reabre exatamente como era (comprovado)");
  ok(negado(await como(d, "anon", null, "update public.masterlist set pago_item = true where id = 1")), "mesmo revertido, as colunas travadas (B1/B4) continuam travadas");
}
{ const d = await laboratorio(); await d.exec("drop table public.multas_pagas cascade"); ok(/não existe/.test((await rodar(d, "J4b_lote1_aplicar.sql", J)) || ""), "J4b ABORTA se uma tabela do lote não existir (nada alterado)"); }
{ const d = await laboratorio(); await d.exec("delete from public.admin_roles"); ok(/administradora cadastrada/.test((await rodar(d, "J4b_lote1_aplicar.sql", J)) || ""), "J4b ABORTA sem administradora cadastrada (ninguém administraria)"); ok((await n(d, "anon", null, "select 1 from public.masterlist")) > 0, "J4b abortado: estado original intacto"); }

// ══ COGs parecidos: 'Ela' e 'ela' NÃO podem ver nem tocar os dados uma da outra ═══════════════════════
{
  const d = await laboratorio(); await rodar(d, "J4_0_admin_em_todas_aplicar.sql", J);
  ok((await rodar(d, "J4a_publico_aplicar.sql", J)) === null && (await rodar(d, "J4b_lote1_aplicar.sql", J)) === null, "Ela/ela: J4a e J4b aplicam");
  const cogs = async (uid, q) => ((await como(d, "authenticated", uid, q)).rows || []).map(r => r.c).sort().join();
  ok((await como(d, "authenticated", 7, "select public.meu_cog() c")).rows[0].c === "Ela" && (await como(d, "authenticated", 8, "select public.meu_cog() c")).rows[0].c === "ela", "as duas contas ficam ligadas às pessoas certas (por id): Ela e ela");
  ok(await cogs(7, "select joiner_cog c from public.pagamento_demandas") === "Ela" && await cogs(8, "select joiner_cog c from public.pagamento_demandas") === "ela", "pagamentos: a 'Ela' vê só os dela e a 'ela' só os dela");
  ok(await cogs(7, "select joiner_cog c from public.multas_pagas") === "Ela" && await cogs(8, "select joiner_cog c from public.multas_pagas") === "ela", "multas: cada uma vê só as suas");
  ok(await cogs(7, "select cog c from public.masterlist where lower(cog) <> 'disponivel'") === "Ela" && await cogs(8, "select cog c from public.masterlist where lower(cog) <> 'disponivel'") === "ela", "masterlist: cada uma vê só os próprios itens");
  ok(negado(await como(d, "authenticated", 7, "insert into public.pagamento_demandas (joiner_cog, itens, valor_total) values ('ela','[]',9)")) && negado(await como(d, "authenticated", 8, "insert into public.pagamento_demandas (joiner_cog, itens, valor_total) values ('Ela','[]',9)")), "nenhuma cria demanda no nome da outra");
  ok((await como(d, "authenticated", 7, "update public.masterlist set cog = 'Ela' where id = 5 returning id")).rows?.length === 1, "a 'Ela' assume um slot para o COG dela");
  ok(negado(await como(d, "authenticated", 7, "update public.masterlist set cog = 'ela' where id = 4")) || (await como(d, "authenticated", 7, "update public.masterlist set cog = 'ela' where id = 4 returning id")).rows?.length === 0, "a 'Ela' NÃO joga um slot para o COG da 'ela'");
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
