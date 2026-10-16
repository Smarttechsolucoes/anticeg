// N0 v3 (ESTRUTURAL: tabela fechada, sem funções, sem policies). PGlite local, dados fictícios. Uso: node tests/sql/n0-notifications.mjs
// Prova: ninguém (visitante, logada, administradora) acessa pela API; nenhuma função pública; só o servidor acessa; guardas, reversão sem perda e compatibilidade com policies por joiner (J4c-4c).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/notificacoes/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
async function banco({ aplicar = true } = {}) {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $f$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create table public.admin_roles (user_id uuid primary key); insert into public.admin_roles values ('${U(1)}');
    create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $f$ select exists (select 1 from public.admin_roles r where r.user_id = (select auth.uid())) $f$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;
  `);
  if (aplicar) await d.exec(sql("N0_tabela_notifications_aplicar.sql"));
  return d;
}
const exec = async (d, q) => { try { await d.exec(q); return null; } catch (e) { try { await d.exec("rollback"); } catch {} return e.message; } };
const como = async (d, papel, uid, q, params) => {
  await d.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: U(uid), role: papel }) : ""}', false)`); await d.exec(`set role ${papel}`);
  try { return { rows: (await d.query(q, params)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
};
const nega = r => !!r.erro && /permission denied|row-level security/.test(r.erro);

const d = await banco();
const v = (await d.query(sql("N0_tabela_notifications_verificar.sql"))).rows.map(r => r.valor);
ok(JSON.stringify(v) === JSON.stringify(["true", "true", "0", "false", "false", "true", "0", "7", "1"]), "verificador: 9 linhas com os valores esperados " + JSON.stringify(v));
await d.exec("insert into public.notifications (joiner_cog, message, type, report_id) values ('ana', 'Seu report foi resolvido', 'report_resolved', 7), ('bia', 'Precisamos do seu endereço', 'envio_address_request', null)");

// ── NINGUÉM acessa pela API ───────────────────────────────────────────────────────────────
const papeis = [["visitante", "anon", null], ["logada comum", "authenticated", 2], ["administradora logada", "authenticated", 1], ["logado sem sessão válida", "authenticated", null]];
for (const [nome, papel, uid] of papeis) {
  ok(nega(await como(d, papel, uid, "select * from public.notifications")), `${nome}: NÃO lista a tabela`);
  ok(nega(await como(d, papel, uid, "select message from public.notifications where joiner_cog = 'bia'")), `${nome}: NÃO lê as da bia nem informando o @`);
  ok(nega(await como(d, papel, uid, "insert into public.notifications (joiner_cog, message, type) values ('ana', 'FALSA: clique no link', 'pagamento')")), `${nome}: NÃO cria notificação falsa`);
  ok(nega(await como(d, papel, uid, "update public.notifications set read_at = now()")) && nega(await como(d, papel, uid, "delete from public.notifications")) && nega(await como(d, papel, uid, "truncate public.notifications")), `${nome}: NÃO altera, apaga nem trunca`);
}
ok((await d.query("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname in ('minhas_notificacoes', 'marcar_notificacao_lida')")).rows[0].n === 0, "nenhuma função pública de notificação existe (nada para explorar informando o @ de outra pessoa)");
ok((await como(d, "service_role", null, "select count(*)::int n from public.notifications")).rows[0].n === 2 && !(await como(d, "service_role", null, "insert into public.notifications (joiner_cog, message, type) values ('cris', 'do servidor', 'teste')")).erro, "só o servidor (service_role) lê e escreve");

// ── GUARDAS ──────────────────────────────────────────────────────────────────────────────
ok(/já foi aplicado/.test(await exec(d, sql("N0_tabela_notifications_aplicar.sql")) || ""), "reaplicar é recusado");
{ const d2 = await banco({ aplicar: false }); await d2.exec("create table public.notifications (id int)"); ok(/já existe/.test(await exec(d2, sql("N0_tabela_notifications_aplicar.sql")) || ""), "se a tabela já existir, recusa e não toca nela"); }
{ const d3 = await banco({ aplicar: false }); await d3.exec("create function public.minhas_notificacoes(text) returns int language sql as $$ select 1 $$"); ok(/versão antiga do N0/.test(await exec(d3, sql("N0_tabela_notifications_aplicar.sql")) || ""), "se existir a função da versão antiga, recusa (não cria tabela por cima)"); }

// ── REVERSÃO PROTEGIDA ───────────────────────────────────────────────────────────────────
ok(/falta a confirmação/.test(await exec(d, sql("N0_tabela_notifications_reverter_protegido.sql")) || ""), "reversão SEM a frase é recusada");
const rev = sql("N0_tabela_notifications_reverter_protegido.sql").replace("confirmacao text := '';", "confirmacao text := 'AUTORIZO APAGAR NOTIFICATIONS VAZIA';");
ok(/tem \d+ linha/.test(await exec(d, rev) || ""), "reversão COM a frase mas com notificações reais: RECUSA (nada é perdido)");

// ── COMPATÍVEL com o J4c-4c: policies por joiner (a joiner só vê as dela) sobre esta tabela ─
await d.exec(`create function public.cog_e_da_conta(c text) returns boolean language sql stable as $f$ select c = current_setting('app.cog', true) $f$; grant execute on function public.cog_e_da_conta(text) to authenticated;`);
{ const e = await exec(d, `do $$ declare r record; begin alter table public.notifications enable row level security;
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'notifications' loop execute format('drop policy %I on public.notifications', r.policyname); end loop;
    revoke all on table public.notifications from anon, public; grant select, insert, update, delete on table public.notifications to authenticated;
    create policy admin_tudo on public.notifications for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
    create policy joiner_le_proprias on public.notifications for select to authenticated using (public.cog_e_da_conta(joiner_cog)); end $$;`);
  ok(e === null, "a etapa do J4c-4c (RLS, policies admin e por joiner) roda sobre a tabela do N0");
  await d.exec("select set_config('app.cog', 'ana', false)");
  const ana = await como(d, "authenticated", 2, "select joiner_cog from public.notifications");
  ok(ana.rows?.length === 1 && ana.rows[0].joiner_cog === "ana", "com a policy por joiner: a conta da ana vê SÓ a notificação dela (isolamento real por conta)");
  ok(nega(await como(d, "anon", null, "select * from public.notifications")), "…e o visitante continua sem nada"); }
await d.exec("delete from public.notifications");
ok(await exec(d, rev) === null && (await d.query("select to_regclass('public.notifications') t")).rows[0].t === null, "reversão com a tabela VAZIA remove a tabela");
ok(await exec(d, sql("N0_tabela_notifications_aplicar.sql")) === null, "o N0 pode ser aplicado de novo depois de revertido");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
