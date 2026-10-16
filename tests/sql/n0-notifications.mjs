// N0 — cria public.notifications (PGlite local, dados fictícios). Uso: node tests/sql/n0-notifications.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/notificacoes/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
async function banco() {
  const d = new PGlite();
  await d.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;
    create table public.joiners (id int primary key, cog text); grant select on public.joiners to anon;`);
  return d;
}
const imp = async d => (await d.query(`select md5(coalesce((select string_agg(c.relname || coalesce(c.relacl::text, '') || c.relrowsecurity::text, ',' order by c.relname) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname <> 'notifications' and c.relkind = 'r'), '')) as h`)).rows[0].h;
const como = async (d, papel, q) => { await d.exec(`set role ${papel}`); try { return { rows: (await d.query(q)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); } };
const exec = async (d, q) => { try { await d.exec(q); return null; } catch (e) { try { await d.exec("rollback"); } catch {} return e.message; } };
const tenta = (d, f) => exec(d, sql(f));

const d = await banco();
const outras = await imp(d);
ok(await tenta(d, "N0_tabela_notifications_aplicar.sql") === null, "N0 aplica (sem erro)");
ok(await imp(d) === outras, "nenhuma outra tabela/permissão foi alterada");
const v = (await d.query(sql("N0_tabela_notifications_verificar.sql"))).rows;
ok(v.length === 8 && v[0].valor === "true" && v[1].valor === "true" && v[2].valor === "3" && v[3].valor === "false" && v[4].valor === "false" && v[5].valor === "true" && v[6].valor === "7" && v[7].valor === "1", "verificador: 8 linhas com os valores esperados (inclui as 7 colunas que o site usa)");
ok((await como(d, "anon", "insert into public.notifications (joiner_cog, message, type, report_id) values ('ana', 'oi', 'report_resolved', 42) returning id")).rows?.length === 1, "visitante cria notificação (como o site faz)");
ok((await como(d, "anon", "select message from public.notifications where joiner_cog = 'ana'")).rows?.[0]?.message === "oi", "visitante lê notificações");
ok(!(await como(d, "anon", "update public.notifications set read_at = now() where joiner_cog = 'ana'")).erro, "visitante marca como lida (read_at)");
ok(/permission denied/.test((await como(d, "anon", "update public.notifications set message = 'x'")).erro || ""), "visitante NÃO altera a mensagem");
ok(/permission denied/.test((await como(d, "anon", "update public.notifications set joiner_cog = 'bia'")).erro || ""), "visitante NÃO troca o destinatário");
ok(/permission denied/.test((await como(d, "anon", "update public.notifications set report_id = 1")).erro || ""), "visitante NÃO altera o report_id");
await como(d, "anon", "insert into public.notifications (joiner_cog, message, type) values ('zed', 'nova', 'envio_address_request')");
ok((await como(d, "anon", "select * from public.notifications where joiner_cog = 'zed' and read_at is null order by created_at desc")).rows?.length === 1, "consulta do site (cog + read_at is null + order by created_at desc) devolve a não lida");
ok(/permission denied/.test((await como(d, "anon", "delete from public.notifications")).erro || ""), "visitante NÃO apaga");
ok(/permission denied/.test((await como(d, "authenticated", "truncate public.notifications")).erro || ""), "logado NÃO trunca");
ok(/já foi aplicado/.test(await tenta(d, "N0_tabela_notifications_aplicar.sql") || ""), "reaplicar é recusado");
ok(/falta a confirmação/.test(await tenta(d, "N0_tabela_notifications_reverter_protegido.sql") || ""), "reversão SEM a frase é recusada");
{ const t = sql("N0_tabela_notifications_reverter_protegido.sql").replace("confirmacao text := '';", "confirmacao text := 'AUTORIZO APAGAR NOTIFICATIONS VAZIA';");
  ok(/tem \d+ linha/.test(await exec(d, t) || ""), "reversão COM a frase mas tabela com dados: recusa (não perde notificação)");
  await d.exec("delete from public.notifications");
  ok(await exec(d, t) === null && (await d.query("select to_regclass('public.notifications') as t")).rows[0].t === null, "reversão com a tabela vazia: remove"); }
{ const d2 = await banco(); await d2.exec("create table public.notifications (id int)");
  ok(/já existe/.test(await tenta(d2, "N0_tabela_notifications_aplicar.sql") || ""), "se a tabela já existir, N0 recusa e não toca nela"); }
// compatível com o J4c-4c: a sequência do J4c-4c (RLS, apagar policies, revoke, grant, policy admin) roda sobre a tabela criada pelo N0
{ const d3 = await banco(); await d3.exec(sql("N0_tabela_notifications_aplicar.sql"));
  const m = await d3.exec(`do $$ declare r record; begin alter table public.notifications enable row level security;
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'notifications' loop execute format('drop policy %I on public.notifications', r.policyname); end loop;
    revoke all on table public.notifications from anon, public; grant select, insert, update, delete on table public.notifications to authenticated; end $$;`).then(() => null, e => e.message);
  ok(m === null && (await d3.query("select count(*)::int n from pg_policies where tablename = 'notifications'")).rows[0].n === 0, "a etapa do J4c-4c (limpar policies/permissões) funciona sobre a tabela do N0"); }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
