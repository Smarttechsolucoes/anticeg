// Valida o R1_teste_permissoes_nao_destrutivo.sql em banco local com dados fictícios. Uso: node tests/sql/r1-permissoes.mjs
// Prova: (1) passa com o R1 correto; (2) NADA muda (tabelas, multas e sequências idênticas: não há INSERT); (3) pega R1 quebrado; (4) falha antes do R1 estar aplicado.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/pagamentos/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

async function banco() {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $f$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users values ('${U(1)}', 'dona@exemplo.com');
    create table public.admin_roles (user_id uuid primary key); insert into public.admin_roles values ('${U(1)}');
    create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $f$ select exists (select 1 from public.admin_roles r where r.user_id = (select auth.uid())) $f$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;
    create table public.multas_pagas (id serial primary key, masterlist_id bigint);
    create table public.masterlist (id bigint primary key, cog text, valor_item numeric default 0, frete_inter numeric default 0, taxa_rf numeric default 0, pago_item boolean default false, pago_frete boolean default false, pago_rf boolean default false, nome text);
    create function public.registrar_multa_paga() returns trigger language plpgsql as $f$ begin if new.pago_item and not coalesce(old.pago_item, false) then insert into public.multas_pagas (masterlist_id) values (new.id); end if; return new; end $f$;
    create trigger trg_registrar_multa_paga after update on public.masterlist for each row execute function public.registrar_multa_paga();
    create table public.pagamento_demandas (id bigint generated always as identity primary key, joiner_cog text, itens jsonb, valor_total numeric, status text default 'em_analise', motivo_rejeicao text);
    insert into public.masterlist (id, cog, valor_item, frete_inter) values (1, 'ana', 100, 20), (2, 'bia', 70, 0);
    insert into public.pagamento_demandas (joiner_cog, itens, valor_total) values ('ana', '[{"id":1,"valor_item":100}]', 100);
    grant select on public.masterlist, public.pagamento_demandas to anon, authenticated;
    grant select, update, insert on public.masterlist, public.pagamento_demandas to service_role;
    grant insert, select on public.multas_pagas to service_role;
    create function public.set_pagamento_demanda_status(demanda_id bigint, novo_status text) returns void language plpgsql security definer as $f$ begin update public.pagamento_demandas set status = novo_status where id = demanda_id; end $f$;
    grant execute on function public.set_pagamento_demanda_status(bigint, text) to anon, authenticated;
  `);
  return d;
}
const imp = async d => (await d.query(`select md5(coalesce((select string_agg(m::text, '|' order by id) from public.masterlist m), '') || '#' || coalesce((select string_agg(p::text, '|' order by id) from public.pagamento_demandas p), '') || '#' || (select count(*)::text from public.multas_pagas) || '#' || coalesce((select string_agg(sequencename || last_value::text, ',' order by sequencename) from pg_sequences where schemaname = 'public'), '')) as h`)).rows[0].h;
const rodar = async (d, arq) => { try { await d.exec(sql(arq)); return "sem erro"; } catch (e) { try { await d.exec("rollback"); } catch {} return e.message; } };
const F = "R1_teste_permissoes_nao_destrutivo.sql";
{ const d = await banco(); await d.exec(sql("R1_admin_pagamentos_aplicar.sql"));
  const antes = await imp(d); const m = await rodar(d, F);
  ok(m.startsWith("R1 PERMISSÕES OK"), "passa com o R1 correto");
  for (const t of ["visitante negado em admin_definir_status_pagamento", "visitante negado em admin_marcar_pago", "logada sem ser admin negada", "administradora passa pela autorização e para em", "nao_encontrado em admin_marcar_pago", "status inválido recusado"]) ok(m.includes(t), `relatório cobre: ${t}`);
  ok(await imp(d) === antes, "NADA mudou (dados, multas e até as sequências idênticas)"); }
{ const d = await banco(); await d.exec(sql("R1_admin_pagamentos_aplicar.sql"));
  await d.exec(`create or replace function public.admin_marcar_pago(p_item_id bigint, p_item boolean default false, p_frete boolean default false, p_rf boolean default false) returns jsonb language plpgsql security definer set search_path = '' as $f$ begin return jsonb_build_object('status', 'nao_encontrado'); end $f$; grant execute on function public.admin_marcar_pago(bigint, boolean, boolean, boolean) to authenticated;`);
  const m = await rodar(d, F); ok(m.startsWith("R1 PERMISSÕES FALHA") && m.includes("logada sem ser admin passou da autorização (admin_marcar_pago)"), "pega função sem checagem de admin"); }
{ const d = await banco(); await d.exec(sql("R1_admin_pagamentos_aplicar.sql")); await d.exec("grant execute on function public.admin_definir_status_pagamento(bigint, text, text, boolean) to anon;");
  const m = await rodar(d, F); ok(m.startsWith("R1 PERMISSÕES FALHA") && m.includes("visitante: erro inesperado P0001"), "EXECUTE liberado ao visitante por engano é reportado (mesmo que a função ainda negue)"); }
{ const d = await banco(); const m = await rodar(d, F); ok(!m.startsWith("R1 PERMISSÕES OK"), "antes do R1 aplicado não passa"); }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
