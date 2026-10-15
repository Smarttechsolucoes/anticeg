// R1 — restaura a confirmação de pagamentos com autorização no servidor (PGlite local, só dados fictícios). Uso: node tests/sql/r1-pagamentos.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/pagamentos/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

async function banco({ funcaoAntiga = true } = {}) {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $f$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users values ('${U(1)}', 'dona@exemplo.com'), ('${U(2)}', 'joiner@exemplo.com');
    create table public.admin_roles (user_id uuid primary key);
    insert into public.admin_roles values ('${U(1)}');
    create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $f$ select exists (select 1 from public.admin_roles r where r.user_id = (select auth.uid())) $f$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;
    create table public.masterlist (id bigint primary key, cog text, valor_item numeric default 0, frete_inter numeric default 0, taxa_rf numeric default 0, pago_item boolean default false, pago_frete boolean default false, pago_rf boolean default false, nome text);
    create table public.pagamento_demandas (id bigint generated always as identity primary key, joiner_cog text, itens jsonb, valor_total numeric, status text default 'em_analise', motivo_rejeicao text);
    insert into public.masterlist (id, cog, valor_item, frete_inter, taxa_rf) values (1, 'ana', 100, 20, 0), (2, 'ana', 50, 0, 5), (3, 'bia', 70, 0, 0);
    insert into public.pagamento_demandas (joiner_cog, itens, valor_total) values
      ('ana', '[{"id":1,"valor_item":100,"frete_inter":20,"taxa_rf":0},{"id":2,"valor_item":50,"frete_inter":0,"taxa_rf":5},{"id":999,"valor_item":10}]', 175),
      ('bia', '[{"id":3,"valor_item":70}]', 70);
    -- como o C0: ninguém (nem logado) altera estas tabelas direto
    grant select on public.masterlist, public.pagamento_demandas to anon, authenticated;
    grant select, update, insert on public.masterlist, public.pagamento_demandas to service_role;
    ${funcaoAntiga ? `create function public.set_pagamento_demanda_status(demanda_id bigint, novo_status text, motivo_rejeicao text default null) returns void language plpgsql security definer as $f$ begin update public.pagamento_demandas set status = novo_status where id = demanda_id; end $f$;
    grant execute on function public.set_pagamento_demanda_status(bigint, text, text) to anon, authenticated;` : ""}
  `);
  return d;
}
async function como(d, papel, uid, q) {
  await d.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: U(uid), role: papel }) : ""}', false)`); await d.exec(`set role ${papel}`);
  try { return { rows: (await d.query(q)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
}
const rodar = async (d, arq, frase) => { try { await d.exec(frase ? sql(arq).replace("confirmacao text := '';", `confirmacao text := '${frase}';`) : sql(arq)); return null; } catch (e) { await d.exec("rollback").catch(() => {}); return String(e.message); } };
const pag = async (d) => (await d.query("select id, status, motivo_rejeicao from public.pagamento_demandas order by id")).rows;
const ml = async (d) => (await d.query("select id, pago_item i, pago_frete f, pago_rf r from public.masterlist order by id")).rows.map(x => `${x.id}:${+x.i}${+x.f}${+x.r}`).join(" ");
const negado = r => !!r.erro && /permission denied|sem permiss/.test(r.erro);
const ver = async d => Object.fromEntries((await d.query(sql("R1_admin_pagamentos_verificar.sql"))).rows.map(r => [r.item, r.valor]));
const permissoes = async d => JSON.stringify((await d.query("select relname, relacl::text a from pg_class where relname in ('masterlist','pagamento_demandas') order by 1")).rows);

{ // antes do R1: a função antiga é aberta (o problema) e o logado não altera direto
  const d = await banco();
  ok((await como(d, "anon", null, "select public.set_pagamento_demanda_status(1, 'pago')")).erro === undefined, "ANTES: o visitante conseguia marcar pago pela função antiga (o buraco)");
  ok(negado(await como(d, "authenticated", 1, "update public.pagamento_demandas set status = 'pago' where id = 2")), "ANTES: UPDATE direto pelo logado é negado (C0)");
}
{ // aplicar
  const d = await banco(); const p0 = await permissoes(d);
  ok((await rodar(d, "R1_admin_pagamentos_aplicar.sql")) === null, "R1 aplica sem erro");
  ok(await permissoes(d) === p0, "permissões de pagamento_demandas e masterlist idênticas (tabela e coluna)");
  const v = await ver(d);
  ok(Object.keys(v).length === 8, "verificador devolve 8 linhas");
  ok(v["funções novas seguras: security definer com search_path vazio (esperado 2)"] === "2", "verificador: 2 funções seguras");
  ok(v["o visitante executa alguma função nova (esperado false)"] === "false", "verificador: visitante não executa");
  ok(v["a administradora logada executa as duas (a negação a não-admin é feita dentro delas) (esperado true)"] === "true", "verificador: logada executa");
  ok(v["função antiga set_pagamento_demanda_status executável por visitante ou logado (esperado false)"] === "false", "verificador: função antiga fechada");
  ok(v["UPDATE em pagamento_demandas para visitante ou logado (esperado false: o C0 continua valendo)"] === "false" && v["UPDATE na coluna masterlist.pago_item para visitante ou logado (esperado false)"] === "false", "verificador: C0 intacto");
  ok(v["administradoras cadastradas (admin_roles) — quem pode usar os botões"] === "1", "verificador: administradoras = 1");

  // autorização no servidor
  ok(negado(await como(d, "anon", null, "select public.admin_definir_status_pagamento(1, 'pago')")), "visitante NÃO confirma pagamento");
  ok(negado(await como(d, "authenticated", 2, "select public.admin_definir_status_pagamento(1, 'pago')")), "logada que NÃO é administradora NÃO confirma");
  ok(negado(await como(d, "authenticated", null, "select public.admin_definir_status_pagamento(1, 'pago')")), "logado sem sessão válida NÃO confirma");
  ok(negado(await como(d, "authenticated", 2, "select public.admin_marcar_pago(3, true)")) && negado(await como(d, "anon", null, "select public.admin_marcar_pago(3, true)")), "marcar pago manual: não-admin e visitante negados");
  ok(negado(await como(d, "anon", null, "select public.set_pagamento_demanda_status(1, 'pago')")) && negado(await como(d, "authenticated", 2, "select public.set_pagamento_demanda_status(1, 'pago')")), "a função antiga não executa mais para visitante nem logado");
  ok((await ml(d)) === "1:000 2:000 3:000" && (await pag(d))[0].status === "em_analise", "nada mudou depois de todas as tentativas negadas");

  // is_admin() NULL é negado
  await d.exec("create or replace function public.is_admin() returns boolean language sql stable as $f$ select null::boolean $f$");
  ok(/sem permiss/.test((await como(d, "authenticated", 1, "select public.admin_definir_status_pagamento(1, 'pago')")).erro || "") && /sem permiss/.test((await como(d, "authenticated", 1, "select public.admin_marcar_pago(3, true)")).erro || ""), "is_admin() NULL é NEGADO nas duas funções");
  await d.exec("create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $f$ select exists (select 1 from public.admin_roles r where r.user_id = (select auth.uid())) $f$");

  // a administradora
  ok(/status inválido/.test((await como(d, "authenticated", 1, "select public.admin_definir_status_pagamento(1, 'qualquer')")).erro || ""), "status inválido é recusado");
  ok(/não encontrada/.test((await como(d, "authenticated", 1, "select public.admin_definir_status_pagamento(12345, 'pago')")).erro || ""), "demanda inexistente é recusada");
  const c = await como(d, "authenticated", 1, "select public.admin_definir_status_pagamento(1, 'pago') r");
  ok(c.rows?.[0].r.status === "pago" && c.rows[0].r.itens_marcados === 2 && c.rows[0].r.itens_nao_encontrados === 1, "administradora confirma: 2 itens marcados, 1 id inexistente apontado");
  ok((await pag(d))[0].status === "pago", "status da demanda = pago");
  ok((await ml(d)) === "1:110 2:101 3:000", "masterlist: só o que tem valor foi marcado (item+frete / item+RF); a outra joiner não mudou");
  ok((await como(d, "authenticated", 1, "select public.admin_definir_status_pagamento(1, 'pago') r")).rows[0].r.alterado === false, "confirmar de novo é idempotente (sem alteração)");
  ok((await como(d, "authenticated", 1, "select public.admin_definir_status_pagamento(2, 'rejeitado', '  comprovante ilegível  ') r")).rows[0].r.status === "rejeitado" && (await pag(d))[1].motivo_rejeicao === "comprovante ilegível" && (await ml(d)) === "1:110 2:101 3:000", "rejeitar guarda o motivo (aparado) e não marca nada");
  ok((await como(d, "authenticated", 1, "select public.admin_definir_status_pagamento(2, 'em_analise', 'ignorado') r")).rows[0].r.status === "em_analise" && (await pag(d))[1].motivo_rejeicao === null, "reabrir volta a em_analise e limpa o motivo");
  ok((await como(d, "authenticated", 1, "select public.admin_marcar_pago(3, true, false, false) r")).rows[0].r.status === "ok" && (await ml(d)) === "1:110 2:101 3:100", "marcar pago manual liga só o pedido");
  ok((await como(d, "authenticated", 1, "select public.admin_marcar_pago(3, false, false, false) r")).rows[0].r.status === "nada_a_marcar" && (await ml(d)) === "1:110 2:101 3:100", "marcar com tudo falso não desmarca nada");
  ok((await como(d, "authenticated", 1, "select public.admin_marcar_pago(777, true) r")).rows[0].r.status === "nao_encontrado", "item inexistente é informado");
  ok(await permissoes(d) === p0, "depois de tudo, permissões de tabela/coluna continuam idênticas");
  ok(/R1 já foi aplicado/.test((await rodar(d, "R1_admin_pagamentos_aplicar.sql")) || ""), "reaplicar o R1 é recusado");

  // reverter
  ok((await rodar(d, "R1_admin_pagamentos_reverter_protegido.sql")) !== null, "reversão SEM a frase é recusada");
  ok((await rodar(d, "R1_admin_pagamentos_reverter_protegido.sql", "AUTORIZO REVERTER PAGAMENTOS ADMIN")) === null, "reversão COM a frase funciona");
  ok(!(await d.query("select to_regprocedure('public.admin_marcar_pago(bigint, boolean, boolean, boolean)') f")).rows[0].f, "funções novas removidas");
  ok((await como(d, "anon", null, "select public.set_pagamento_demanda_status(1, 'pago')")).erro === undefined, "a função antiga volta com as permissões de antes (como registrado)");
}
{ // guardas
  const d = await banco(); await d.exec("drop function public.is_admin()");
  ok(/is_admin\(\) não existe/.test((await rodar(d, "R1_admin_pagamentos_aplicar.sql")) || ""), "R1 ABORTA sem is_admin()");
}
{ const d = await banco(); await d.exec("alter table public.masterlist drop column pago_rf"); ok(/Esperava as colunas id, pago_item/.test((await rodar(d, "R1_admin_pagamentos_aplicar.sql")) || ""), "R1 ABORTA se faltar coluna pago_*"); }
{ // sem a função antiga no banco: aplica do mesmo jeito
  const d = await banco({ funcaoAntiga: false });
  ok((await rodar(d, "R1_admin_pagamentos_aplicar.sql")) === null, "R1 aplica mesmo sem a função antiga");
  ok((await ver(d))["função antiga set_pagamento_demanda_status executável por visitante ou logado (esperado false)"] === "false (não existe)", "verificador: função antiga 'não existe'");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
