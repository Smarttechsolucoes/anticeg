// Teste do J4c-1 (joiners, pre_cadastros, grupos_envio, push_subscriptions) no laboratório fictício (PGlite, só dados fictícios). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4c1-joiners.mjs
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
  await d.exec(sql("03_dados_ficticios.sql", "laboratorio")); await d.exec(sql("04_tabelas_j4c.sql", "laboratorio"));
  if (semRlsEm) await d.exec(`alter table public.${semRlsEm} disable row level security`);
  await d.exec(sql("A1_base_aplicar.sql", "admin-auth")); await d.exec(sql("A2_senha_apenas_aplicar.sql", "admin-auth"));
  await d.exec(`insert into public.admin_roles (user_id) values ('${U(1)}')`);
  await d.exec(sql("J1_estrutura_aplicar.sql", "joiners-auth"));
  // contas ativadas pelo caminho oficial (e-mail confirmado igual ao cadastro) e uma pelo admin
  const ativar = async (uid, cog) => { await d.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(uid), role: "authenticated" })}', false)`); await d.exec("set role service_role"); await d.query(`select public.ativar_minha_conta('${cog}')`); await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims','',false)"); };
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

{
  const d = await laboratorio(); await aplicarBase(d);
  const total = (await d.query("select count(*)::int c from public.joiners")).rows[0].c;
  ok((await n(d, "anon", null, "select 1 from public.joiners")) === total, "ANTES: o visitante lê TODAS as joiners, com CPF e endereço (vulnerabilidade reproduzida)");
  ok((await como(d, "anon", null, "update public.joiners set saldo_cashback = 9999 where cog = 'ana' returning saldo_cashback")).rows?.length === 1, "ANTES: o visitante consegue alterar saldo de cashback (vulnerabilidade reproduzida)");
  await d.exec("update public.joiners set saldo_cashback = 12.5 where cog = 'ana'");
  const e = await rodar(d, "J4c1_joiners_aplicar.sql", J); ok(e === null, "J4c-1 aplica sem erro" + (e ? ": " + e : ""));
  const v = Object.fromEntries((await d.query(sql("J4c1_joiners_verificar.sql", J))).rows.map(r => [r.item, r.valor]));
  ok(v["policies nas 4 tabelas (esperado 10)"] === "10" && v["policies para visitante/PUBLIC (esperado 0)"] === "0" && v["visitante com algum privilégio nas 4 tabelas (esperado false)"] === "false" && v["funções seguras presentes (esperado 8)"] === "8" && v["trava de colunas da joiners ligada (esperado true)"] === "true", "verificação J4c-1 como esperado: " + JSON.stringify(v).slice(0, 200));
  ok(v["impressão antes | agora (joiners)"].split(" | ")[0] !== "sem registro", "impressão dos dados registrada");

  // visitante e acesso simples
  for (const t of ["joiners", "pre_cadastros", "grupos_envio", "push_subscriptions"]) ok(negado(await como(d, "anon", null, `select * from public.${t}`)), `visitante NÃO lê ${t}`);
  ok(negado(await como(d, "anon", null, "update public.joiners set saldo_cashback = 9999")) && negado(await como(d, "anon", null, "insert into public.joiners (cog) values ('invasor')")) && negado(await como(d, "anon", null, "delete from public.joiners")), "visitante NÃO altera, cria nem apaga joiners");
  ok((await como(d, "anon", null, "select * from public.joiners_publico")).rows.length === total, "a visão pública (só 5 colunas) continua funcionando para o acesso simples");
  ok((await n(d, "authenticated", 4, "select 1 from public.joiners")) === 0 && (await n(d, "authenticated", 4, "select 1 from public.grupos_envio")) === 0, "conta logada SEM vínculo não vê dado de ninguém");

  // ana: só a própria linha
  const lista = (await como(d, "authenticated", 2, "select cog, email, cpf from public.joiners")).rows;
  ok(lista.length === 1 && lista[0].cog === "ana" && lista[0].email === "ana@exemplo.com", "ana enxerga SÓ a própria linha completa (não vê as outras 10)");
  ok((await como(d, "authenticated", 2, "update public.joiners set cep = '99999-999', numero = '77', foto_perfil = 'https://exemplo.invalid/a.png' where cog = 'ana' returning id")).rows?.length === 1, "ana edita os próprios dados de perfil/endereço");
  ok((await como(d, "authenticated", 2, "update public.joiners set whatsapp = '119' where cog = 'bia' returning id")).rows?.length === 0, "ana NÃO edita a linha da bia (0 linhas)");
  for (const [campo, valor] of [["saldo_cashback", "9999"], ["bloqueado", "true"], ["confirmado", "true"], ["cog", "'outra'"], ["nome", "'Outro Nome'"], ["id", "777"]])
    ok(barrado(await como(d, "authenticated", 2, `update public.joiners set ${campo} = ${valor} where cog = 'ana'`)), `ana NÃO muda o próprio ${campo} (só a administradora)`);
  ok((await d.query("select saldo_cashback::float s from public.joiners where cog = 'ana'")).rows[0].s === 12.5, "o saldo da ana continua o mesmo");
  ok(/já está em uso/.test((await como(d, "authenticated", 2, "update public.joiners set email = 'bia.antiga@exemplo.com' where cog = 'ana'")).erro || ""), "ana NÃO troca o e-mail para o de outra joiner");
  ok(/já está em uso/.test((await como(d, "authenticated", 2, "update public.joiners set twitter = '@bia' where cog = 'ana'")).erro || ""), "ana NÃO assume o @ de outra joiner");
  ok(!(await como(d, "authenticated", 2, "update public.joiners set email = 'ana.nova@exemplo.com' where cog = 'ana'")).erro, "ana troca o próprio e-mail para um livre");
  // recrutador: uma vez, e válido
  ok(/inválido/.test((await como(d, "authenticated", 9, "update public.joiners set recrutador = 'ninguem' where cog = 'gabi'")).erro || "") && /inválido/.test((await como(d, "authenticated", 9, "update public.joiners set recrutador = 'gabi' where cog = 'gabi'")).erro || ""), "recrutador inexistente ou a própria pessoa: recusado");
  ok(!(await como(d, "authenticated", 9, "update public.joiners set recrutador = 'ana' where cog = 'gabi'")).erro, "gabi define o recrutador (existente) uma vez");
  ok(/só pode ser definido uma vez/.test((await como(d, "authenticated", 9, "update public.joiners set recrutador = 'bia' where cog = 'gabi'")).erro || ""), "e não troca depois");
  ok(negado(await como(d, "authenticated", 2, "insert into public.joiners (cog, nome) values ('nova', 'Nova')")) && (await como(d, "authenticated", 2, "delete from public.joiners where cog = 'ana' returning id")).rows?.length === 0 && (await d.query("select 1 from public.joiners where cog = 'ana'")).rows.length === 1, "joiner logada NÃO cria nem apaga joiners");
  // administradora e servidor
  ok((await n(d, "authenticated", 1, "select 1 from public.joiners")) >= total, "administradora lê todas as joiners");
  ok((await como(d, "authenticated", 1, "update public.joiners set bloqueado = true, saldo_cashback = 5, nome = 'Ana Fictícia 2' where cog = 'ana' returning id")).rows?.length === 1, "administradora altera bloqueio, saldo e nome");
  await d.exec("update public.joiners set bloqueado = false where cog = 'ana'");
  ok((await como(d, "service_role", null, "update public.joiners set nome = 'Ana Sync' where cog = 'ana' returning id")).rows?.length === 1 && (await como(d, "service_role", null, "select count(*)::int c from public.joiners")).rows[0].c === total, "service_role (sync) continua editando joiners");

  // cadastro novo
  const sc = async (...a) => (await como(d, "anon", null, `select public.solicitar_cadastro(${a.map(x => x === null ? "null" : `'${x}'`).join(",")}) r`)).rows?.[0].r;
  ok((await sc("Nova Pessoa", "@nova.pessoa", "Nova@Exemplo.com", "11988887777", null)).ok === true && (await d.query("select cog, email, twitter, confirmado, id from public.joiners where cog = 'nova.pessoa'")).rows[0].email === "nova@exemplo.com", "visitante pede cadastro: nasce confirmado=false, e-mail normalizado, sem ler nada");
  ok((await d.query("select count(*)::int c from public.pre_cadastros where cog = 'nova.pessoa'")).rows[0].c === 1 && Number((await d.query("select id from public.joiners where cog = 'nova.pessoa'")).rows[0].id) >= 300000, "registra no log de pré-cadastros e não colide com ids existentes");
  const igual = JSON.stringify(await sc("Outra", "ana", "outra@exemplo.com", null, null)) === JSON.stringify(await sc("Nova Pessoa", "nova.pessoa", "nova@exemplo.com", null, null));
  ok(igual && (await d.query("select count(*)::int c from public.joiners where lower(cog) = 'ana'")).rows[0].c === 1, "@ ou e-mail já existentes: resposta neutra e NADA é criado/alterado");
  ok((await d.query("select email from public.joiners where cog = 'ana'")).rows[0].email === "ana.nova@exemplo.com", "pedido de cadastro com o @ de outra pessoa não altera a conta dela");
  ok((await sc("X", "ab", "x@exemplo.com", null, null)).ok === false && (await sc("Xx", "bad cog!", "x@exemplo.com", null, null)).ok === false && (await sc("Xx", "okcog", "sem-arroba", null, null)).ok === false, "dados inválidos são recusados");
  ok((await sc("Rec Teste", "rectest", "rec@exemplo.com", null, "@bia")).ok === true && (await d.query("select recrutador from public.joiners where cog = 'rectest'")).rows[0].recrutador === "bia", "recrutador válido é gravado");
  ok((await sc("Rec Teste", "rectest2", "rec2@exemplo.com", null, "naoexiste")).motivo === "recrutador_invalido", "recrutador inexistente é recusado");
  await d.exec("insert into public.pre_cadastros (nome, cog, email, status) select 'x', 'lote' || g, 'l' || g || '@exemplo.com', 'aprovado' from generate_series(1, 40) g");
  ok((await sc("Muitos", "muitos", "muitos@exemplo.com", null, null)).motivo === "tente_mais_tarde", "trava global: mais de 40 pedidos na última hora é recusado");
  ok((await como(d, "anon", null, "select public.resolver_recrutador('@Bia') r")).rows[0].r.cog === "bia" && (await como(d, "anon", null, "select public.resolver_recrutador('nao') r")).rows[0].r === null && !/@exemplo|000\.000/.test(JSON.stringify((await como(d, "anon", null, "select public.resolver_recrutador('bia') r")).rows[0].r)), "resolver_recrutador devolve só COG e nome público");

  // listas entre joiners
  ok((await como(d, "authenticated", 2, "select * from public.meus_recrutados()")).rows.map(r => r.cog).join() === "bia,gabi", "ana vê quem ela recrutou, só COG e nome público");
  await d.exec("update public.joiners set last_seen = now() where cog in ('ana','bia')");
  const on = (await como(d, "authenticated", 2, "select * from public.joiners_online(10)")).rows;
  ok(on.length === 2 && Object.keys(on[0]).sort().join() === "cog,foto_perfil,nome", "quem está online: só COG, nome público e foto");
  ok((await como(d, "authenticated", 4, "select * from public.joiners_online(10)")).rows.length === 0 && negado(await como(d, "anon", null, "select * from public.joiners_online(10)")), "conta sem vínculo e visitante não listam quem está online");

  // cashback
  await d.exec("update public.joiners set saldo_cashback = 20 where cog = 'ana'");
  ok((await como(d, "authenticated", 2, "select public.debitar_cashback(7.5) r")).rows[0].r == 12.5 && (await d.query("select saldo_cashback::float s from public.joiners where cog = 'bia'")).rows[0].s === 0, "debita só o próprio saldo");
  ok((await como(d, "authenticated", 2, "select public.debitar_cashback(-5) r")).rows[0].r === null && (await d.query("select saldo_cashback::float s from public.joiners where cog = 'ana'")).rows[0].s === 12.5, "valor negativo (tentar aumentar o saldo) é recusado");
  ok((await como(d, "authenticated", 2, "select public.debitar_cashback(100) r")).rows[0].r == 0, "debitar_cashback nunca deixa o saldo negativo");
  ok(negado(await como(d, "anon", null, "select public.debitar_cashback(1)")), "visitante não executa debitar_cashback");

  // pré-cadastros
  ok((await n(d, "authenticated", 2, "select 1 from public.pre_cadastros")) === 0 && negado(await como(d, "anon", null, "update public.pre_cadastros set status = 'aprovado'")), "pré-cadastros: nem visitante nem joiner leem ou alteram");
  ok((await n(d, "authenticated", 1, "select 1 from public.pre_cadastros")) >= 1 && (await como(d, "authenticated", 1, "update public.pre_cadastros set status = 'aprovado' where cog = 'pre1' returning id")).rows?.length === 1, "pré-cadastros: a administradora lê e aprova");

  // grupos de envio
  ok((await n(d, "authenticated", 2, "select 1 from public.grupos_envio")) === 1 && (await n(d, "authenticated", 3, "select 1 from public.grupos_envio")) === 0, "grupo de envio: só a host vê a linha direto (bia, participante, não)");
  ok((await como(d, "authenticated", 3, "select public.grupo_por_codigo(' abc234 ') r")).rows[0].r?.host_cog === "ana" && (await como(d, "authenticated", 3, "select public.grupo_por_codigo('ZZZZZZ') r")).rows[0].r === null, "participante com o código consulta o grupo; código errado não devolve nada");
  ok(negado(await como(d, "anon", null, "select public.grupo_por_codigo('ABC234')")) && (await como(d, "authenticated", 4, "select public.grupo_por_codigo('ABC234') r")).rows[0].r === null, "visitante e conta sem vínculo não consultam grupo");
  ok(!(await como(d, "authenticated", 2, "insert into public.grupos_envio (codigo, host_cog, destinatario) values ('NOVO11','ana','Ana')")).erro && negado(await como(d, "authenticated", 2, "insert into public.grupos_envio (codigo, host_cog, destinatario) values ('NOVO22','bia','Ana')")), "host cria grupo só no próprio nome");

  // push
  ok((await n(d, "authenticated", 2, "select 1 from public.push_subscriptions")) === 1 && (await n(d, "authenticated", 3, "select 1 from public.push_subscriptions")) === 1, "push: cada joiner vê só os próprios aparelhos");
  ok((await como(d, "authenticated", 3, "select public.registrar_push('https://fcm.googleapis.com/fcm/send/ficticio-ana','k','a') r")).rows[0].r === true && (await d.query("select joiner_cog from public.push_subscriptions where endpoint like '%ficticio-ana'")).rows[0].joiner_cog === "bia", "registrar_push move o aparelho para a conta que está logada agora");
  ok((await como(d, "authenticated", 3, "select public.registrar_push('http://inseguro','k','a') r")).rows[0].r === false && (await como(d, "authenticated", 4, "select public.registrar_push('https://x.example/1','k','a') r")).rows[0].r === false, "endereço não-https e conta sem vínculo são recusados");
  ok((await n(d, "authenticated", 1, "select 1 from public.push_subscriptions")) >= 2, "administradora lê os aparelhos para enviar push");

  // estado, reaplicação, reversão
  const est = (await d.query("select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-1'")).rows;
  ok(est.length >= 8 && !/@exemplo|000\.000/.test(JSON.stringify(est)), "estado anterior registrado, sem dados pessoais");
  ok(/já foi aplicado/.test((await rodar(d, "J4c1_joiners_aplicar.sql", J)) || ""), "reaplicar é recusado");
  ok(/falta a confirmação/.test((await rodar(d, "J4c1_joiners_reverter_protegido.sql", J)) || ""), "reversão sem a frase é recusada");
  ok((await rodar(d, "J4c1_joiners_reverter_protegido.sql", J, "AUTORIZO REABRIR DADOS PESSOAIS DAS JOINERS")) === null && (await n(d, "anon", null, "select 1 from public.joiners")) >= total && (await d.query("select to_regprocedure('public.solicitar_cadastro(text,text,text,text,text)') p")).rows[0].p === null, "reversão com a frase reabre como era e remove as funções");
}
{ const d = await laboratorio(); await d.exec("drop table public.grupos_envio cascade"); await aplicarBase(d); ok(/não existe/.test((await rodar(d, "J4c1_joiners_aplicar.sql", J)) || ""), "J4c-1 ABORTA se uma tabela não existir (nada alterado)"); }
{ const d = await laboratorio(); await aplicarBase(d); await d.exec("delete from public.admin_roles"); ok(/administradora cadastrada/.test((await rodar(d, "J4c1_joiners_aplicar.sql", J)) || ""), "J4c-1 ABORTA sem administradora cadastrada"); }
{ const d = await laboratorio(); ok(/J4a não está aplicado/.test((await rodar(d, "J4c1_joiners_aplicar.sql", J)) || ""), "J4c-1 ABORTA sem o J4a"); }

// ══ COGs parecidos: 'Ela' (joiner 7) e 'ela' (joiner 8) não veem nem tocam nos dados uma da outra ══════
{
  const d = await laboratorio(); await aplicarBase(d);
  await d.exec(`insert into public.grupos_envio (codigo, host_cog, destinatario) values ('ELA111','Ela','Ela M'), ('ELA222','ela','ela m');
    insert into public.push_subscriptions (joiner_cog, endpoint, p256dh, auth) values ('Ela','https://fcm.googleapis.com/fcm/send/e1','k','a'), ('ela','https://fcm.googleapis.com/fcm/send/e2','k','a');
    update public.joiners set recrutador = 'Ela' where cog = 'gabi';`);
  ok((await rodar(d, "J4c1_joiners_aplicar.sql", J)) === null, "Ela/ela: J4c-1 aplica");
  const col = async (uid, q) => ((await como(d, "authenticated", uid, q)).rows || []).map(r => r.c).sort().join();
  ok(await col(7, "select codigo c from public.grupos_envio") === "ELA111" && await col(8, "select codigo c from public.grupos_envio") === "ELA222", "grupos de envio: cada host vê só o dela");
  ok(await col(7, "select endpoint c from public.push_subscriptions") === "https://fcm.googleapis.com/fcm/send/e1" && await col(8, "select endpoint c from public.push_subscriptions") === "https://fcm.googleapis.com/fcm/send/e2", "push: cada uma vê só os próprios aparelhos");
  ok(await col(7, "select cog c from public.joiners") === "Ela" && await col(8, "select cog c from public.joiners") === "ela", "joiners: cada uma lê só a própria linha");
  ok(negado(await como(d, "authenticated", 8, "insert into public.grupos_envio (codigo, host_cog) values ('ELA333','Ela')")) && negado(await como(d, "authenticated", 7, "insert into public.grupos_envio (codigo, host_cog) values ('ELA444','ela')")), "nenhuma cria grupo no nome da outra");
  ok((await como(d, "authenticated", 8, "select public.registrar_push('https://fcm.googleapis.com/fcm/send/e1','k','a') r")).rows[0].r === true && (await d.query("select joiner_cog from public.push_subscriptions where endpoint like '%/e1'")).rows[0].joiner_cog === "ela", "registrar_push grava o COG EXATO da conta logada");
  ok(await col(7, "select cog c from public.meus_recrutados()") === "gabi" && await col(8, "select cog c from public.meus_recrutados()") === "", "meus_recrutados: quem a 'Ela' recrutou aparece só para a 'Ela', nunca para a 'ela'");
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
