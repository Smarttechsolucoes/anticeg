// Valida o N0_teste_fumaca_desfeito.sql (v2, fechada) em PGlite local, dados fictícios. Uso: node tests/sql/n0-fumaca.mjs
// Prova: passa com o N0 correto; NADA fica gravado; pega permissões erradas; falha de forma clara se o N0 não foi aplicado.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/notificacoes/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = "00000000-0000-0000-0000-000000000001";
async function banco(aplicar = true) {
  const d = new PGlite();
  await d.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $f$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create table public.admin_roles (user_id uuid primary key); insert into public.admin_roles values ('${U}');
    create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $f$ select exists (select 1 from public.admin_roles r where r.user_id = (select auth.uid())) $f$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;`);
  if (aplicar) await d.exec(sql("N0_tabela_notifications_aplicar.sql"));
  return d;
}
const rodar = async (d, f) => { try { await d.exec(sql(f)); return "sem erro"; } catch (e) { try { await d.exec("rollback"); } catch {} return e.message; } };
const F = "N0_teste_fumaca_desfeito.sql";
const imp = async d => (await d.query(`select md5(coalesce((select string_agg(relname || coalesce(relacl::text, '') || relrowsecurity::text, ',' order by relname) from pg_class where relnamespace = 'public'::regnamespace), '') || coalesce((select string_agg(policyname || cmd || coalesce(qual, '') || coalesce(with_check, ''), ',' order by policyname) from pg_policies), '') || (select count(*)::text from public.notifications)) h`)).rows[0].h;
{ const d = await banco(); const antes = await imp(d); const m = await rodar(d, F);
  ok(m.startsWith("N0 FUMAÇA OK"), "passa com o N0 correto");
  for (const t of ["visitante NÃO lê a tabela", "visitante NÃO cria notificação", "visitante NÃO altera nem marca direto", "visitante NÃO apaga", "logada sem ser administradora NÃO cria", "logada NÃO lê a tabela direto", "administradora cria notificações",
                   "o @ A recebe só a notificação dele", "nenhuma notificação de outro @", "curinga", "@ nulo", "@ vazio", "marcar a notificação do A informando o @ B é RECUSADO", "marcar com o @ certo funciona", "depois de lida, some da lista do A", "a notificação do B continua intacta"]) ok(m.includes(t), `relatório cobre: ${t}`);
  ok(await imp(d) === antes && (await d.query("select count(*)::int n from public.notifications")).rows[0].n === 0, "NADA ficou gravado (tabela vazia; permissões e policies idênticas)"); }
{ const d = await banco(); await d.exec("grant select on public.notifications to anon;"); const m = await rodar(d, F);
  ok(m.startsWith("N0 FUMAÇA FALHA") && m.includes("visitante leu a tabela"), "pega SELECT liberado ao visitante"); }
{ const d = await banco(); await d.exec("create policy aberta on public.notifications for insert to authenticated with check (true);"); const m = await rodar(d, F);
  ok(m.startsWith("N0 FUMAÇA FALHA") && m.includes("logada sem ser admin criou notificação"), "pega policy de INSERT aberta (qualquer logada criaria notificação falsa)"); }
{ const d = await banco(); await d.exec(`create or replace function public.minhas_notificacoes(p_cog text) returns setof public.notifications language sql stable security definer set search_path = '' as $$ select * from public.notifications order by id limit 20 $$;`);
  const m = await rodar(d, F); ok(m.startsWith("N0 FUMAÇA FALHA") && /recebeu|apareceu/.test(m), "pega função que lista notificações de OUTROS @s"); }
{ const d = await banco(); await d.exec(`create or replace function public.marcar_notificacao_lida(p_id bigint, p_cog text) returns boolean language plpgsql security definer set search_path = '' as $$ begin update public.notifications set read_at = now() where id = p_id; return true; end $$;`);
  const m = await rodar(d, F); ok(m.startsWith("N0 FUMAÇA FALHA") && m.includes("marcou a notificação de outra joiner"), "pega função que marca como lida a notificação de outra joiner"); }
{ const d = await banco(false); const m = await rodar(d, F); ok(/não existe/.test(m) && !m.startsWith("N0 FUMAÇA OK"), "sem o N0 aplicado: falha de forma clara"); }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
