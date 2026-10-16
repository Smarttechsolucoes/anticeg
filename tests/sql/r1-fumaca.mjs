// Valida o R1_teste_fumaca_desfeito.sql em banco local com dados fictícios. Uso: node tests/sql/r1-fumaca.mjs
// Prova: (1) o teste de fumaça passa com o R1 correto; (2) NADA fica gravado (impressão das tabelas igual); (3) ele PEGA um R1 quebrado (função sem checagem de admin); (4) antes do R1 ele falha de forma clara.
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
const imp = async d => (await d.query(`select md5(coalesce((select string_agg(m::text, '|' order by id) from public.masterlist m), '') || '#' || coalesce((select string_agg(p::text, '|' order by id) from public.pagamento_demandas p), '') || '#' || (select count(*)::text from public.multas_pagas)    ) as h`)).rows[0].h;
const rodar = async (d, arq) => { try { await d.exec(sql(arq)); return "sem erro"; } catch (e) { return e.message; } };

{ // 1) R1 correto
  const d = await banco(); await d.exec(sql("R1_admin_pagamentos_aplicar.sql"));
  const antes = await imp(d); const m = await rodar(d, "R1_teste_fumaca_desfeito.sql");
  ok(m.startsWith("R1 FUMAÇA OK"), "fumaça passa com o R1 correto");
  ok(!/FALHA/.test(m.replace("R1 FUMAÇA OK", "")), "nenhuma linha FALHA no relatório");
  for (const t of ["visitante negado", "logada sem ser admin negada", "admin confirmou", "admin reabriu", "admin rejeitou", "item de outra joiner pede confirmação", "marcar pago manual", "item inexistente"]) ok(m.includes(t), `relatório cobre: ${t}`);
  ok(await imp(d) === antes, "NADA ficou gravado (masterlist, demandas e multas idênticas; a numeração de ids avança, o que é normal e inofensivo)");
  ok((await d.query("select count(*)::int n from public.pagamento_demandas")).rows[0].n === 1, "nenhuma demanda de teste sobrou");
}
{ // 2) R1 quebrado: a função de marcar pago sem checagem de admin é pega
  const d = await banco(); await d.exec(sql("R1_admin_pagamentos_aplicar.sql"));
  await d.exec(`create or replace function public.admin_marcar_pago(p_item_id bigint, p_item boolean default false, p_frete boolean default false, p_rf boolean default false) returns jsonb language plpgsql security definer set search_path = '' as $f$ begin update public.masterlist set pago_item = pago_item or p_item, pago_frete = pago_frete or p_frete where id = p_item_id; return jsonb_build_object('status', 'ok'); end $f$;
                grant execute on function public.admin_marcar_pago(bigint, boolean, boolean, boolean) to authenticated;`);
  const m = await rodar(d, "R1_teste_fumaca_desfeito.sql");
  ok(m.startsWith("R1 FUMAÇA FALHA") && m.includes("logada sem ser admin conseguiu marcar pago"), "pega função sem checagem de admin");
}
{ // 3) função liberada ao visitante por engano: a checagem de admin dentro dela ainda nega (defesa em camadas)
  const d = await banco(); await d.exec(sql("R1_admin_pagamentos_aplicar.sql"));
  await d.exec(`grant execute on function public.admin_definir_status_pagamento(bigint, text, text, boolean) to anon;`);
  const m = await rodar(d, "R1_teste_fumaca_desfeito.sql");
  ok(m.startsWith("R1 FUMAÇA OK") && m.includes("visitante negado (P0001)"), "mesmo com EXECUTE liberado ao visitante, a função nega (checagem de admin interna)");
}
{ // 3b) guardas: gatilho inesperado ligado => o teste ABORTA antes de gravar
  const d = await banco(); await d.exec(sql("R1_admin_pagamentos_aplicar.sql"));
  await d.exec(`create function public.f_estranha() returns trigger language plpgsql as $f$ begin return new; end $f$;
                create trigger trg_estranho after update on public.masterlist for each row execute function public.f_estranha();`);
  const antes = await imp(d); const m = await rodar(d, "R1_teste_fumaca_desfeito.sql");
  ok(m.startsWith("R1 FUMAÇA ABORTADO") && m.includes("trg_estranho") && await imp(d) === antes, "gatilho inesperado ligado: aborta sem gravar nada");
}
{ // 3c) guardas: gatilho esperado, mas com efeito externo (pg_notify) => aborta
  const d = await banco(); await d.exec(sql("R1_admin_pagamentos_aplicar.sql"));
  await d.exec(`create or replace function public.registrar_multa_paga() returns trigger language plpgsql as $f$ begin perform pg_notify('x', 'y'); return new; end $f$;`);
  const m = await rodar(d, "R1_teste_fumaca_desfeito.sql");
  ok(m.startsWith("R1 FUMAÇA ABORTADO") && m.includes("efeito externo"), "gatilho de multa com pg_notify: aborta");
}
{ // 3d) guardas: gatilho desligado (como o B7 deixou o de pagamento) não bloqueia; regra (RULE) bloqueia
  const d = await banco(); await d.exec(sql("R1_admin_pagamentos_aplicar.sql"));
  await d.exec(`create function public.f_est() returns trigger language plpgsql as $f$ begin return new; end $f$;
                create trigger trg_confirmar_pagamento after update on public.pagamento_demandas for each row execute function public.f_est();
                alter table public.pagamento_demandas disable trigger trg_confirmar_pagamento;`);
  ok((await rodar(d, "R1_teste_fumaca_desfeito.sql")).startsWith("R1 FUMAÇA OK"), "gatilho DESLIGADO (como o B7) não impede o teste");
  await d.exec(`create rule r_x as on update to public.masterlist do also select 1;`);
  ok((await rodar(d, "R1_teste_fumaca_desfeito.sql")).includes("regras (RULE)"), "regra (RULE) na tabela: aborta");
}
{ // 4) sem o R1 aplicado
  const d = await banco(); const m = await rodar(d, "R1_teste_fumaca_desfeito.sql");
  ok(!m.startsWith("R1 FUMAÇA OK"), "antes do R1 o teste NÃO passa (" + m.split("\n")[0].slice(0, 70) + ")");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
