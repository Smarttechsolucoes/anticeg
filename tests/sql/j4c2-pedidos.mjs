// Teste do J4c-2 (claims, reports, envio_solicitacoes) no laboratório fictício (PGlite, só dados fictícios). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4c2-pedidos.mjs
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
  await d.exec(`insert into public.claims (joiner_cog, joiner_nome, masterlist_id, ceg, nome_do_item, valor, status) values
    ('bia', 'Bia Fictícia', 5, 'CLAIM', 'Set Fictício · Membro 2', 20, 'pendente'), ('bia', 'Bia Fictícia', 3, 'SKZOO', 'Photocard C', 45, 'rejeitado');`);
  const antes = { claims: (await d.query("select count(*)::int c from public.claims")).rows[0].c, rep: (await d.query("select count(*)::int c from public.reports")).rows[0].c, env: (await d.query("select count(*)::int c from public.envio_solicitacoes")).rows[0].c };
  ok((await n(d, "anon", null, "select 1 from public.envio_solicitacoes")) === antes.env && antes.env === 2, "ANTES: o visitante lê TODAS as solicitações de envio, com CPF e endereço (vulnerabilidade reproduzida)");
  const e = await rodar(d, "J4c2_pedidos_claims_aplicar.sql", J); ok(e === null, "J4c-2 aplica sem erro" + (e ? ": " + e : ""));
  const v = Object.fromEntries((await d.query(sql("J4c2_pedidos_claims_verificar.sql", J))).rows.map(r => [r.item, r.valor]));
  ok(v["policies nas 3 tabelas (esperado 13)"] === "13" && v["policies para visitante/PUBLIC (esperado 0)"] === "0" && v["visitante com algum privilégio nas 3 tabelas (esperado false)"] === "false" && v["colunas sensíveis nas visões públicas de claims (esperado 0)"] === "0" && v["gatilhos de campos ligados (esperado 3)"] === "3", "verificação J4c-2 como esperado: " + JSON.stringify(v).slice(0, 220));

  // visitante
  for (const t of ["claims", "reports", "envio_solicitacoes"]) ok(negado(await como(d, "anon", null, `select * from public.${t}`)), `visitante NÃO lê ${t}`);
  ok(negado(await como(d, "anon", null, "update public.claims set status = 'aprovado'")) && negado(await como(d, "anon", null, "delete from public.claims")) && negado(await como(d, "anon", null, "insert into public.claims (joiner_cog, status) values ('x','pendente')")), "visitante NÃO altera, apaga nem cria claims");
  ok((await n(d, "authenticated", 4, "select 1 from public.claims")) === 0 && (await n(d, "authenticated", 4, "select 1 from public.envio_solicitacoes")) === 0, "conta logada SEM vínculo não vê nada");

  // visões públicas
  const q = (await como(d, "anon", null, "select * from public.claims_quadro order by masterlist_id")).rows;
  ok(q.length === 2 && Object.keys(q[0]).sort().join() === "created_at,joiner_nome,masterlist_id,status", "quadro público de claims: só 4 colunas (sem e-mail, COG, valor)");
  ok(q.find(r => r.masterlist_id === 4).joiner_nome === "Ana" && !JSON.stringify(q).includes("Fictícia"), "o quadro mostra o NOME PÚBLICO (nome_site), nunca o nome real");
  ok(!q.some(r => r.status === "rejeitado"), "claims rejeitados não aparecem no quadro");
  const vend = (await como(d, "anon", null, "select * from public.claims_vendidos")).rows;
  ok(vend.length === 1 && Object.keys(vend[0]).sort().join() === "ceg,created_at,id,nome_do_item,valor", "'vendidos': só claims aprovados, sem identificar quem");

  // claims da ana
  ok((await como(d, "authenticated", 2, "select joiner_cog from public.claims")).rows.every(r => r.joiner_cog === "ana") && (await n(d, "authenticated", 2, "select 1 from public.claims")) === 1, "ana vê só os próprios claims");
  ok((await como(d, "authenticated", 2, "insert into public.claims (joiner_cog, joiner_nome, masterlist_id, ceg, nome_do_item, valor, status) values ('ana','Ana',6,'SKZOO','X',1,'pendente') returning id")).rows?.length === 1, "ana cria o próprio claim (pendente) e recebe o id de volta");
  ok(barrado(await como(d, "authenticated", 2, "insert into public.claims (joiner_cog, status) values ('bia','pendente')")), "ana NÃO cria claim no nome da bia");
  ok(barrado(await como(d, "authenticated", 2, "insert into public.claims (joiner_cog, status) values ('ana','aprovado')")), "ana NÃO cria claim já 'aprovado'");
  ok((await como(d, "authenticated", 2, "update public.claims set status = 'aprovado' where joiner_cog = 'ana' and status = 'pendente' returning id")).rows?.length === 0 || barrado(await como(d, "authenticated", 2, "update public.claims set status = 'aprovado' where joiner_cog = 'ana' and status = 'pendente'")), "ana NÃO aprova o próprio claim");
  ok((await d.query("select count(*)::int c from public.claims where joiner_cog = 'ana' and status = 'aprovado'")).rows[0].c === 1, "o único claim aprovado da ana continua sendo o de antes");
  ok((await como(d, "authenticated", 2, "update public.claims set status = 'rejeitado' where joiner_cog = 'ana' and status = 'pendente' returning id")).rows?.length === 1, "ana desfaz (rejeita) o próprio claim pendente");
  ok((await como(d, "authenticated", 2, "update public.claims set status = 'rejeitado' where joiner_cog = 'bia' returning id")).rows?.length === 0, "ana NÃO mexe no claim da bia");
  await d.exec("insert into public.claims (joiner_cog, masterlist_id, ceg, status) values ('ana', 7, 'SKZOO', 'pendente')");
  ok((await como(d, "authenticated", 2, "delete from public.claims where joiner_cog = 'ana' and status = 'pendente' returning id")).rows?.length === 1, "ana apaga o próprio claim pendente (desfazer em caso de erro)");
  ok((await como(d, "authenticated", 2, "delete from public.claims where joiner_cog = 'ana' and status = 'aprovado' returning id")).rows?.length === 0 && (await como(d, "authenticated", 2, "delete from public.claims where joiner_cog = 'bia' returning id")).rows?.length === 0, "ana NÃO apaga claim aprovado nem o de outra");
  ok((await como(d, "authenticated", 1, "update public.claims set status = 'aprovado' where joiner_cog = 'bia' and status = 'pendente' returning id")).rows?.length === 1, "administradora aprova claims");

  // reports
  ok((await como(d, "authenticated", 2, "select joiner_cog from public.reports")).rows.every(r => r.joiner_cog === "ana") && (await n(d, "authenticated", 2, "select 1 from public.reports")) === 1, "ana vê só os próprios reports");
  ok((await como(d, "authenticated", 2, "insert into public.reports (joiner_cog, item_nome, ceg) values ('ana','Photocard A','SKZOO') returning id")).rows?.length === 1 && barrado(await como(d, "authenticated", 2, "insert into public.reports (joiner_cog, item_nome) values ('bia','x')")), "ana cria report só no próprio nome");
  ok(barrado(await como(d, "authenticated", 2, "insert into public.reports (joiner_cog, item_nome, resposta) values ('ana','x','resposta falsa')")), "ana NÃO cria report já com 'resposta da administradora'");
  ok(barrado(await como(d, "authenticated", 2, "update public.reports set resposta = 'tudo certo' where joiner_cog = 'ana'")) && barrado(await como(d, "authenticated", 2, "update public.reports set status = 'resolvido' where joiner_cog = 'ana'")), "ana NÃO escreve a resposta da administradora nem marca como resolvido");
  ok((await como(d, "authenticated", 2, "update public.reports set status = 'pendente', erro_outro = 'ainda errado' where joiner_cog = 'ana' returning id")).rows?.length >= 1, "ana reabre/edita o próprio report");
  ok((await como(d, "authenticated", 2, "update public.reports set erro_outro = 'x' where joiner_cog = 'bia' returning id")).rows?.length === 0 && barrado(await como(d, "authenticated", 2, "update public.reports set joiner_cog = 'bia' where joiner_cog = 'ana'")), "ana NÃO edita report da bia nem troca o dono do dela");
  ok((await como(d, "authenticated", 1, "update public.reports set status = 'resolvido', resposta = 'ok' where joiner_cog = 'bia' returning id")).rows?.length === 1, "administradora responde e resolve");

  // envio
  ok((await como(d, "authenticated", 2, "select joiner_cog, cpf from public.envio_solicitacoes")).rows.length === 1 && (await n(d, "authenticated", 3, "select 1 from public.envio_solicitacoes")) === 1, "cada joiner vê só as próprias solicitações de envio (com o próprio CPF)");
  ok((await como(d, "authenticated", 2, "insert into public.envio_solicitacoes (joiner_cog, destinatario, cpf, status, itens) values ('ana','Ana','000.000.000-01','solicitação de envio','[]') returning id")).rows?.length === 1, "ana cria a solicitação de envio (nasce 'solicitação de envio')");
  ok(barrado(await como(d, "authenticated", 2, "insert into public.envio_solicitacoes (joiner_cog, status) values ('bia','solicitação de envio')")) && barrado(await como(d, "authenticated", 2, "insert into public.envio_solicitacoes (joiner_cog, status) values ('ana','enviado')")), "ana NÃO cria em nome de outra nem já como 'enviado'");
  ok(barrado(await como(d, "authenticated", 2, "insert into public.envio_solicitacoes (joiner_cog, status, rastreio_codigo, cotacao_frete) values ('ana','solicitação de envio','SN123','0')")), "ana NÃO cria solicitação já com rastreio ou cotação");
  const idAna = (await d.query("select id from public.envio_solicitacoes where joiner_cog = 'ana' order by id limit 1")).rows[0].id;
  ok((await como(d, "authenticated", 2, `update public.envio_solicitacoes set modalidade_escolhida = 'SEDEX', status = 'pagamento em aberto' where id = ${idAna} returning id`)).rows?.length === 1, "ana escolhe a modalidade (status vira 'pagamento em aberto')");
  ok((await como(d, "authenticated", 2, `update public.envio_solicitacoes set comprovante_url = 'https://exemplo.invalid/c.png' where id = ${idAna} returning id`)).rows?.length === 1, "ana anexa o comprovante");
  for (const [campo, valor] of [["rastreio_codigo", "'FALSO'"], ["cotacao_frete", "'0'"], ["destinatario", "'Outro'"], ["cpf", "'111'"], ["joiner_cog", "'bia'"], ["status", "'enviado'"], ["status", "'pagamento confirmado'"]])
    ok(barrado(await como(d, "authenticated", 2, `update public.envio_solicitacoes set ${campo} = ${valor} where id = ${idAna}`)), `ana NÃO altera ${campo}${campo === "status" ? " para " + valor : ""} (andamento é da administradora)`);
  ok((await como(d, "authenticated", 2, `update public.envio_solicitacoes set status = 'cancelado' where id = ${idAna} returning id`)).rows?.length === 1, "ana cancela a própria solicitação");
  const idBia = (await d.query("select id from public.envio_solicitacoes where joiner_cog = 'bia' limit 1")).rows[0].id;
  ok((await como(d, "authenticated", 2, `update public.envio_solicitacoes set status = 'cancelado' where id = ${idBia} returning id`)).rows?.length === 0, "ana NÃO cancela a solicitação da bia");
  ok((await como(d, "authenticated", 1, `update public.envio_solicitacoes set status = 'enviado', rastreio_codigo = 'SN9', cotacao_frete = '10' where id = ${idBia} returning id`)).rows?.length === 1, "administradora define cotação, rastreio e andamento");
  ok((await como(d, "service_role", null, `update public.envio_solicitacoes set status = 'embalando' where id = ${idBia} returning id`)).rows?.length === 1, "service_role continua gravando");
  ok((await n(d, "authenticated", 1, "select 1 from public.claims")) >= antes.claims && (await n(d, "authenticated", 1, "select 1 from public.reports")) >= antes.rep, "administradora lê tudo");

  const est = (await d.query("select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4c-2'")).rows;
  ok(est.length >= 6 && !/@exemplo|000\.000/.test(JSON.stringify(est)), "estado anterior registrado, sem dados pessoais");
  ok(/já foi aplicado/.test((await rodar(d, "J4c2_pedidos_claims_aplicar.sql", J)) || ""), "reaplicar é recusado");
  ok(/falta a confirmação/.test((await rodar(d, "J4c2_pedidos_claims_reverter_protegido.sql", J)) || ""), "reversão sem a frase é recusada");
  ok((await rodar(d, "J4c2_pedidos_claims_reverter_protegido.sql", J, "AUTORIZO REABRIR CLAIMS E ENVIOS")) === null && (await n(d, "anon", null, "select 1 from public.envio_solicitacoes")) >= 2 && (await d.query("select to_regclass('public.claims_quadro') v")).rows[0].v === null, "reversão com a frase reabre como era e remove visões e gatilhos");
}
{ const d = await laboratorio(); await aplicarBase(d); await d.exec("drop table public.reports cascade"); ok(/não existe/.test((await rodar(d, "J4c2_pedidos_claims_aplicar.sql", J)) || ""), "J4c-2 ABORTA se uma tabela não existir (nada alterado)"); }
{ const d = await laboratorio(); await aplicarBase(d); await d.exec("delete from public.admin_roles"); ok(/administradora cadastrada/.test((await rodar(d, "J4c2_pedidos_claims_aplicar.sql", J)) || ""), "J4c-2 ABORTA sem administradora cadastrada"); }

// ══ COGs parecidos: 'Ela' (joiner 7) e 'ela' (joiner 8) não veem nem tocam nos dados uma da outra ══════
{
  const d = await laboratorio(); await aplicarBase(d);
  await d.exec(`insert into public.claims (joiner_cog, masterlist_id, ceg, nome_do_item, status) values ('Ela', 4, 'CLAIM', 'Set A', 'pendente'), ('ela', 5, 'CLAIM', 'Set B', 'pendente');
    insert into public.reports (joiner_cog, item_nome) values ('Ela', 'Item da Ela'), ('ela', 'Item da ela');
    insert into public.envio_solicitacoes (joiner_cog, destinatario, cpf, status, itens) values ('Ela', 'Ela', '111', 'solicitação de envio', '[]'), ('ela', 'ela', '222', 'solicitação de envio', '[]');`);
  ok((await rodar(d, "J4c2_pedidos_claims_aplicar.sql", J)) === null, "Ela/ela: J4c-2 aplica");
  const col = async (uid, q) => ((await como(d, "authenticated", uid, q)).rows || []).map(r => r.c).sort().join();
  ok(await col(7, "select joiner_cog c from public.claims") === "Ela" && await col(8, "select joiner_cog c from public.claims") === "ela", "claims: cada uma vê só os próprios");
  ok(await col(7, "select joiner_cog c from public.reports") === "Ela" && await col(8, "select joiner_cog c from public.reports") === "ela", "reports: cada uma vê só os próprios");
  ok(await col(7, "select cpf c from public.envio_solicitacoes") === "111" && await col(8, "select cpf c from public.envio_solicitacoes") === "222", "envios (CPF/endereço): cada uma vê só os próprios");
  ok(barrado(await como(d, "authenticated", 7, "insert into public.claims (joiner_cog, status) values ('ela','pendente')")) && barrado(await como(d, "authenticated", 8, "insert into public.reports (joiner_cog, item_nome) values ('Ela','x')")) && barrado(await como(d, "authenticated", 8, "insert into public.envio_solicitacoes (joiner_cog, status) values ('Ela','solicitação de envio')")), "nenhuma cria claim, report ou envio no nome da outra");
  ok((await como(d, "authenticated", 7, "update public.claims set status = 'rejeitado' where joiner_cog = 'ela' returning id")).rows?.length === 0 && (await como(d, "authenticated", 8, "delete from public.claims where joiner_cog = 'Ela' returning id")).rows?.length === 0, "nenhuma desfaz nem apaga o claim da outra");
  ok((await como(d, "authenticated", 7, "update public.envio_solicitacoes set status = 'cancelado' where joiner_cog = 'ela' returning id")).rows?.length === 0, "a 'Ela' NÃO cancela o envio da 'ela'");
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
