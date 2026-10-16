// N0 v2 (tabela FECHADA + leitura por @ + só administradora cria). PGlite local, dados fictícios. Uso: node tests/sql/n0-notifications.mjs
// Prova o ISOLAMENTO: visitante/logado sem acesso direto; sem listagem entre joiners; sem curinga; sem notificação falsa; marcar como lida só no @ certo; compatível com o J4c-4c; reversão protegida.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/notificacoes/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
async function banco({ admin = true, aplicar = true } = {}) {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $f$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create table public.joiners (id int primary key, cog text); grant select on public.joiners to anon;
  `);
  if (admin) await d.exec(`create table public.admin_roles (user_id uuid primary key); insert into public.admin_roles values ('${U(1)}');
    create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $f$ select exists (select 1 from public.admin_roles r where r.user_id = (select auth.uid())) $f$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;`);
  if (aplicar) await d.exec(sql("N0_tabela_notifications_aplicar.sql"));
  return d;
}
const exec = async (d, q) => { try { await d.exec(q); return null; } catch (e) { try { await d.exec("rollback"); } catch {} return e.message; } };
const como = async (d, papel, uid, q, params) => {
  await d.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: U(uid), role: papel }) : ""}', false)`); await d.exec(`set role ${papel}`);
  try { return { rows: (await d.query(q, params)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
};
const nega = r => !!r.erro && /permission denied|row-level security/.test(r.erro);
const sembanco = async (d, q) => (await d.query(q)).rows;

const d = await banco();
const v = (await d.query(sql("N0_tabela_notifications_verificar.sql"))).rows.map(r => r.valor);
ok(v.length === 9 && JSON.stringify(v) === JSON.stringify(["true", "true", "1", "false", "false", "true", "2", "7", "1"]), "verificador: 9 linhas com os valores esperados " + JSON.stringify(v));

// dados de duas joiners, criados pela administradora (como o painel fará)
const adm = (q, p) => como(d, "authenticated", 1, q, p);
await adm("insert into public.notifications (joiner_cog, message, type, report_id) values ('ana', 'Seu report foi resolvido', 'report_resolved', 7)");
await adm("insert into public.notifications (joiner_cog, message, type) values ('bia', 'Precisamos do seu endereço', 'envio_address_request'), ('bia', 'Segunda de bia', 'teste')");

// ── VISITANTE: nada direto ───────────────────────────────────────────────────────────────
ok(nega(await como(d, "anon", null, "select * from public.notifications")), "visitante NÃO lista a tabela (nem informando o @)");
ok(nega(await como(d, "anon", null, "select message from public.notifications where joiner_cog = 'bia'")), "visitante NÃO lê as notificações da bia direto na tabela");
ok(nega(await como(d, "anon", null, "insert into public.notifications (joiner_cog, message, type) values ('ana', 'FALSO: clique no link', 'pagamento')")), "visitante NÃO cria notificação falsa");
ok(nega(await como(d, "anon", null, "update public.notifications set read_at = now()")) && nega(await como(d, "anon", null, "delete from public.notifications")) && nega(await como(d, "anon", null, "truncate public.notifications")), "visitante NÃO altera, apaga nem trunca");
// ── LEITURA POR @ ────────────────────────────────────────────────────────────────────────
const ana = (await como(d, "anon", null, "select * from public.minhas_notificacoes('ana')")).rows;
ok(ana.length === 1 && ana[0].joiner_cog === "ana" && ana[0].report_id === 7, "o @ ana recebe só a dela (1), com report_id");
const bia = (await como(d, "anon", null, "select * from public.minhas_notificacoes('bia')")).rows;
ok(bia.length === 2 && bia.every(x => x.joiner_cog === "bia") && bia[0].created_at >= bia[1].created_at, "o @ bia recebe só as dela (2), mais recentes primeiro");
for (const [nome, arg] of [["curinga %", "'%'"], ["curinga _", "'_'"], ["vazio", "''"], ["espaços", "'   '"], ["nulo", "null"], ["@ inexistente", "'ninguem'"], ["maiúsculas diferentes (Ana)", "'Ana'"]]) {
  ok((await como(d, "anon", null, `select * from public.minhas_notificacoes(${arg})`)).rows?.length === 0, `leitura com ${nome}: não lista ninguém`);
}
ok((await como(d, "anon", null, "select * from public.minhas_notificacoes($1)", ["ana' or '1'='1"])).rows?.length === 0, "tentativa de injeção no @ não lista ninguém");
// limite e só não lidas
await d.exec("insert into public.notifications (joiner_cog, message, type) select 'cris', 'n' || g, 'teste' from generate_series(1, 30) g");
ok((await como(d, "anon", null, "select * from public.minhas_notificacoes('cris')")).rows.length === 20, "no máximo 20 por consulta");
// ── MARCAR COMO LIDA ─────────────────────────────────────────────────────────────────────
const idAna = ana[0].id, idBia = bia[0].id;
ok((await como(d, "anon", null, "select public.marcar_notificacao_lida($1, 'bia') r", [idAna])).rows[0].r === false, "marcar a notificação da ana informando o @ bia é RECUSADO");
ok((await sembanco(d, `select read_at from public.notifications where id = ${idAna}`))[0].read_at === null, "…e a da ana continua não lida");
ok((await como(d, "anon", null, "select public.marcar_notificacao_lida($1, 'ana') r", [idAna])).rows[0].r === true, "marcar com o @ certo funciona");
ok((await como(d, "anon", null, "select public.marcar_notificacao_lida($1, 'ana') r", [idAna])).rows[0].r === false, "marcar de novo devolve false (idempotente)");
ok((await como(d, "anon", null, "select * from public.minhas_notificacoes('ana')")).rows.length === 0 && (await como(d, "anon", null, "select * from public.minhas_notificacoes('bia')")).rows.length === 2, "depois de lida some da lista da ana; as da bia seguem intactas");
ok((await como(d, "anon", null, "select public.marcar_notificacao_lida(null, 'bia') a, public.marcar_notificacao_lida($1, null) b, public.marcar_notificacao_lida($1, '') c", [idBia])).rows[0].a === false, "parâmetros nulos/vazios são recusados");
// ── LOGADO (conta qualquer) ──────────────────────────────────────────────────────────────
ok(nega(await como(d, "authenticated", 2, "select * from public.notifications")), "logada (não admin) NÃO lê a tabela direto");
ok(nega(await como(d, "authenticated", 2, "insert into public.notifications (joiner_cog, message, type) values ('ana', 'falsa', 'pagamento')")), "logada que NÃO é administradora NÃO cria notificação");
ok(nega(await como(d, "authenticated", null, "insert into public.notifications (joiner_cog, message, type) values ('ana', 'falsa', 'pagamento')")), "logado sem sessão válida NÃO cria notificação");
ok((await como(d, "authenticated", 2, "select * from public.minhas_notificacoes('bia')")).rows.length === 2, "logada usa a mesma leitura por @ (modelo visitante, até o J4c-4c)");
ok(nega(await como(d, "authenticated", 1, "select * from public.notifications")) && nega(await como(d, "authenticated", 1, "delete from public.notifications")), "nem a administradora lê/apaga direto pela API (só cria)");
// service_role
ok((await como(d, "service_role", null, "select count(*)::int n from public.notifications")).rows[0].n >= 33, "service_role (servidor) acessa tudo");

// ── GUARDAS, REVERSÃO E J4c-4c ───────────────────────────────────────────────────────────
ok(/já foi aplicado/.test(await exec(d, sql("N0_tabela_notifications_aplicar.sql")) || ""), "reaplicar é recusado");
{ const d2 = await banco({ aplicar: false }); await d2.exec("create table public.notifications (id int)");
  ok(/já existe/.test(await exec(d2, sql("N0_tabela_notifications_aplicar.sql")) || ""), "se a tabela já existir, recusa e não toca nela"); }
{ const d3 = await banco({ admin: false, aplicar: false }); ok(/is_admin\(\) não existe/.test(await exec(d3, sql("N0_tabela_notifications_aplicar.sql")) || ""), "sem is_admin(), recusa"); }
{ const d4 = await banco({ aplicar: false }); await d4.exec("create function public.minhas_notificacoes(text) returns int language sql as $$ select 1 $$");
  ok(/Já existe função/.test(await exec(d4, sql("N0_tabela_notifications_aplicar.sql")) || ""), "se já existir função com o mesmo nome, recusa"); }
ok(/falta a confirmação/.test(await exec(d, sql("N0_tabela_notifications_reverter_protegido.sql")) || ""), "reversão SEM a frase é recusada");
const rev = sql("N0_tabela_notifications_reverter_protegido.sql").replace("confirmacao text := '';", "confirmacao text := 'AUTORIZO APAGAR NOTIFICATIONS VAZIA';");
ok(/tem \d+ linha/.test(await exec(d, rev) || ""), "reversão COM a frase mas com notificações reais: RECUSA (nada é perdido)");
// compatível com a etapa do J4c-4c (limpar policies, revogar, conceder ao logado, policy de admin) — e as funções continuam funcionando
{ const e = await exec(d, `do $$ declare r record; begin alter table public.notifications enable row level security;
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'notifications' loop execute format('drop policy %I on public.notifications', r.policyname); end loop;
    revoke all on table public.notifications from anon, public; grant select, insert, update, delete on table public.notifications to authenticated;
    create policy admin_tudo on public.notifications for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin())); end $$;`);
  ok(e === null && (await como(d, "anon", null, "select * from public.minhas_notificacoes('bia')")).rows.length === 2, "a etapa do J4c-4c roda sobre a tabela do N0 e a leitura por @ continua funcionando");
  ok((await como(d, "authenticated", 2, "select * from public.notifications")).rows?.length === 0, "…e depois dela a logada (não admin) continua sem ver NENHUMA linha (a RLS devolve vazio): a abertura para a dona da conta vem só com as policies por joiner do J4c-4c"); }
await d.exec("delete from public.notifications");
ok(await exec(d, rev) === null && (await d.query("select to_regclass('public.notifications') t, to_regprocedure('public.minhas_notificacoes(text)') f")).rows[0].t === null, "reversão com a tabela VAZIA remove tabela e funções");
ok(await exec(d, sql("N0_tabela_notifications_aplicar.sql")) === null, "o N0 pode ser aplicado de novo depois de revertido");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
