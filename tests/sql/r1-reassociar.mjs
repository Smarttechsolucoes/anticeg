// R1.1 — reassociação de itens recriados pelo sync (id novo, mesmo id_linha). PGlite local, só dados fictícios. Uso: node tests/sql/r1-reassociar.mjs
// Prova: item recriado é reassociado SÓ com id_linha único + mesmo ceg + mesmo nome + mesmos valores; nunca marca outro item; a confirmação continua parando antes de gravar até o aceite;
// terceiros e desfazimento continuam corretos; permissões idênticas; guardas, reversão e reaplicação.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/pagamentos/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

async function banco({ r1 = true, r11 = true } = {}) {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema emergencia; grant usage on schema emergencia to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema emergencia grant all on tables to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $f$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users values ('${U(1)}', 'dona@exemplo.com'), ('${U(2)}', 'joiner@exemplo.com');
    create table public.admin_roles (user_id uuid primary key); insert into public.admin_roles values ('${U(1)}');
    create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $f$ select exists (select 1 from public.admin_roles r where r.user_id = (select auth.uid())) $f$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;
    create table public.multas_pagas (id serial primary key, masterlist_id bigint);
    create table public.masterlist (id bigint primary key, cog text, ceg text, nome_do_item text, id_linha text, valor_item numeric default 0, frete_inter numeric default 0, taxa_rf numeric default 0,
                                    pago_item boolean default false, pago_frete boolean default false, pago_rf boolean default false, nome text);
    create table public.pagamento_demandas (id bigint generated always as identity primary key, joiner_cog text, itens jsonb, valor_total numeric, status text default 'em_analise', motivo_rejeicao text);
    revoke all on all tables in schema public from anon, authenticated; grant select on public.masterlist, public.pagamento_demandas to anon, authenticated;
    grant select, update, insert on public.masterlist, public.pagamento_demandas to service_role; grant insert, select on public.multas_pagas to service_role;
    -- masterlist ATUAL: linhas já recriadas pelo sync (ids novos). 7238/7239 = os itens da tiredlevi_ (como na produção)
    insert into public.masterlist (id, cog, ceg, nome_do_item, id_linha, valor_item, pago_item) values
      (7238, 'tiredlevi_', 'V&T', 'set jisung run it', 'VT-ITE-226041304', 132, true),
      (7239, 'tiredlevi_', 'RUN IT SEOUL', 'set innie run it', 'RUNI-PHO-3256', 88, true),
      (7300, 'ana', 'W MAG', 'capa a', 'WM-A-1', 100, false),
      (7301, 'ana', 'W MAG', 'capa b', 'WM-B-1', 100, false),
      (7302, 'ana', 'W MAG', 'capa c', 'DUP-1', 50, false),
      (7303, 'bia', 'W MAG', 'capa c', 'DUP-1', 50, false),
      (7304, 'bia', 'W MAG', 'capa d', 'WM-D-1', 70, false),
      (7305, 'ana', 'W MAG', 'capa e', 'WM-E-1', 40, false),
      (7306, 'ana', 'W MAG', 'capa f', '', 40, false);
  `);
  if (r1) await d.exec(sql("R1_admin_pagamentos_aplicar.sql"));
  if (r1 && r11) await d.exec(sql("R1_1_reassociar_itens_aplicar.sql"));
  return d;
}
const adm = async (d, q, uid = 1) => {
  await d.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(uid), role: "authenticated" })}', false)`); await d.exec("set role authenticated");
  try { const r = await d.query(q); return r.rows[0]?.r ?? r.rows; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims', '', false)"); }
};
const dem = async (d, cog, itens) => (await d.query("insert into public.pagamento_demandas (joiner_cog, itens, valor_total) values ($1, $2::jsonb, 1) returning id", [cog, JSON.stringify(itens)])).rows[0].id;
const it = (id, idl, ceg, nome, v = 0, f = 0, r = 0) => ({ id, id_linha: idl, ceg, nome_do_item: nome, valor_item: v, frete_inter: f, taxa_rf: r });
const def = (d, id, st, motivo = null, t = false, a = false) => adm(d, `select public.admin_definir_status_pagamento(${id}, '${st}', ${motivo === null ? "null" : `'${motivo}'`}, ${t}, ${a}) r`);
const flags = async (d, id) => { const x = (await d.query("select pago_item i, pago_frete f, pago_rf r from public.masterlist where id = $1", [id])).rows[0]; return `${+x.i}${+x.f}${+x.r}`; };
const status = async (d, id) => (await d.query("select status from public.pagamento_demandas where id = $1", [id])).rows[0].status;
const tenta = async (d, q) => { try { await d.exec(q); return null; } catch (e) { try { await d.exec("rollback"); } catch {} return e.message; } };
const acl = async d => (await d.query("select coalesce(proacl::text,'') a, pg_get_userbyid(proowner) o from pg_proc where proname = 'admin_definir_status_pagamento'")).rows.map(r => r.a + "|" + r.o).join(";");

{ // A) o caso real: demanda 779 (ids 6183/6184 -> hoje 7238/7239)
  const d = await banco(); const D = await dem(d, "tiredlevi_", [it(6183, "VT-ITE-226041304", "V&T", "set jisung run it", 132), it(6184, "RUNI-PHO-3256", "RUN IT SEOUL", "set innie run it", 88)]);
  const b = await def(d, D, "pago");
  ok(b.status === "confirmar_itens_ausentes" && b.reassociaveis?.length === 2 && b.ids.length === 0, "A: itens recriados são ENCONTRADOS pelo id_linha e a confirmação PARA para o aceite");
  ok(JSON.stringify(b.reassociaveis.map(x => [x.id_antigo, x.id_novo])) === "[[6183,7238],[6184,7239]]" && b.reassociaveis[0].cog === "tiredlevi_" && b.reassociaveis[0].ceg === "V&T", "A: mostra id antigo -> id atual, CEG, item e dono");
  ok(await status(d, D) === "em_analise" && await flags(d, 7238) === "100", "A: NADA foi gravado antes do aceite");
  const c = await def(d, D, "pago", null, false, true);
  ok(c.status === "pago" && c.itens_reassociados === 2 && c.itens_marcados === 2 && c.itens_nao_encontrados === 0, "A: com aceite confirma usando os itens ATUAIS (2 reassociados, 0 ausentes)");
  ok(await flags(d, 7238) === "100" && await flags(d, 7239) === "100", "A: itens já pagos continuam pagos (nada foi desmarcado nem trocado)");
  ok((await d.query("select count(*)::int n from emergencia.pagamento_marcacoes")).rows[0].n === 0, "A: nada a registrar (já estavam marcados), então nada será desfeito ao reabrir");
  ok((await d.query("select itens from public.pagamento_demandas where id = $1", [D])).rows[0].itens[0].id === 6183, "A: o JSON da demanda NÃO foi reescrito (histórico preservado)");
}
{ // B) marcação pelo id ATUAL e desfazimento
  const d = await banco(); const D = await dem(d, "ana", [it(4001, "WM-A-1", "W MAG", "capa a", 100)]);
  const b = await def(d, D, "pago"); ok(b.reassociaveis?.[0]?.id_novo === 7300, "B: reassocia 4001 -> 7300");
  const c = await def(d, D, "pago", null, false, true);
  ok(c.itens_reassociados === 1 && await flags(d, 7300) === "100" && (await d.query("select masterlist_id, campo from emergencia.pagamento_marcacoes where demanda_id = $1", [D])).rows[0].masterlist_id === 7300, "B: marca o item ATUAL (7300) e registra a marcação nele");
  const r = await def(d, D, "rejeitado", "ilegível"); ok(r.itens_desmarcados === 1 && await flags(d, 7300) === "000", "B: rejeitar depois desfaz a marcação do item atual");
}
{ // C) nunca marcar o item errado: divergências impedem a reassociação
  const casos = [
    ["nome diferente", it(4002, "WM-A-1", "W MAG", "capa OUTRA", 100), 7300],
    ["ceg diferente", it(4003, "WM-B-1", "OUTRO CEG", "capa b", 100), 7301],
    ["valor diferente", it(4004, "WM-B-1", "W MAG", "capa b", 99), 7301],
    ["id_linha repetido (2 linhas)", it(4005, "DUP-1", "W MAG", "capa c", 50), 7302],
    ["id_linha inexistente", it(4006, "NAO-EXISTE", "W MAG", "capa a", 100), 7300],
    ["demanda sem id_linha", it(4007, null, "W MAG", "capa a", 100), 7300],
    ["id_linha vazio", it(4008, "", "W MAG", "capa a", 100), 7300],
  ];
  for (const [nome, item, alvo] of casos) {
    const d = await banco(); const D = await dem(d, "ana", [item]);
    const b = await def(d, D, "pago");
    ok(b.status === "confirmar_itens_ausentes" && (b.reassociaveis || []).length === 0 && b.ids.length === 1, `C: ${nome} => NÃO reassocia (fica como ausente)`);
    const c = await def(d, D, "pago", null, false, true);
    ok(c.status === "pago" && c.itens_marcados === 0 && c.itens_nao_encontrados === 1 && await flags(d, alvo) === "000", `C: ${nome} => com aceite NADA é marcado (o item parecido ${alvo} continua intacto)`);
  }
}
{ // D) valor só importa onde há cobrança: campo zerado na demanda não é comparado
  const d = await banco(); const D = await dem(d, "ana", [it(4010, "WM-A-1", "W MAG", "capa a", 100, 0, 0)]);
  ok((await def(d, D, "pago")).reassociaveis?.length === 1, "D: frete/rf zerados na demanda não impedem a reassociação (só o que foi cobrado é comparado)");
  const d2 = await banco(); const D2 = await dem(d2, "ana", [it(4011, "WM-A-1", "W MAG", "capa a", 100, 25, 0)]);
  ok((await def(d2, D2, "pago")).reassociaveis?.length === 0, "D: frete cobrado na demanda mas a linha atual tem frete 0 => NÃO reassocia");
}
{ // E) terceiros vale para o dono da linha ATUAL, antes do aceite de ausentes
  const d = await banco(); const D = await dem(d, "ana", [it(4020, "WM-D-1", "W MAG", "capa d", 70)]);
  const t = await def(d, D, "pago"); ok(t.status === "confirmar_terceiros" && JSON.stringify(t.outras_joiners) === '["bia"]', "E: item reassociado de OUTRA joiner (bia) pede confirmação de terceiros primeiro");
  const a = await def(d, D, "pago", null, true, false); ok(a.status === "confirmar_itens_ausentes" && a.reassociaveis[0].id_novo === 7304, "E: depois pede o aceite da reassociação");
  const c = await def(d, D, "pago", null, true, true); ok(c.status === "pago" && await flags(d, 7304) === "100", "E: com os dois aceites confirma e marca o item atual");
}
{ // F) mistura: um existe, um reassociável, um sem vínculo
  const d = await banco(); const D = await dem(d, "ana", [it(7305, "WM-E-1", "W MAG", "capa e", 40), it(4030, "WM-A-1", "W MAG", "capa a", 100), it(4031, "XX", "W MAG", "capa a", 100)]);
  const b = await def(d, D, "pago"); ok(b.reassociaveis.length === 1 && JSON.stringify(b.ids) === "[4031]" && b.itens_nao_encontrados === 2, "F: 1 reassociável + 1 sem vínculo apontados separadamente; o existente segue normal");
  const c = await def(d, D, "pago", null, false, true);
  ok(c.itens_marcados === 2 && c.itens_reassociados === 1 && c.itens_nao_encontrados === 1 && await flags(d, 7305) === "100" && await flags(d, 7300) === "100", "F: marca o existente e o reassociado; o sem vínculo é só informado");
}
{ // G) cobertura por id_linha: demanda com id antigo e demanda com id novo cobrem o MESMO item
  const d = await banco(); const A = await dem(d, "ana", [it(7301, "WM-B-1", "W MAG", "capa b", 100)]); const B = await dem(d, "ana", [it(4040, "WM-B-1", "W MAG", "capa b", 100)]);
  await def(d, A, "pago"); await def(d, B, "pago", null, false, true);
  const ra = await def(d, A, "rejeitado"); ok(ra.itens_mantidos === 1 && ra.itens_desmarcados === 0 && await flags(d, 7301) === "100", "G: rejeitar A mantém o item (B cobre o mesmo item pelo id_linha, mesmo com id antigo)");
  const rb = await def(d, B, "rejeitado"); ok(rb.itens_desmarcados === 1 && await flags(d, 7301) === "000", "G: rejeitar B depois desfaz (ninguém mais cobre)");
}
{ // H) comportamento do R1 preservado: sem id_linha continua ausente; itens sem id ('outros') não bloqueiam; autorização
  const d = await banco(); const D = await dem(d, "ana", [{ id: null, nome_do_item: "outros", valor_item: 10 }]);
  ok((await def(d, D, "pago")).status === "pago", "H: item 'outros' (sem id) continua não bloqueando");
  ok(/sem permiss/.test((await adm(d, `select public.admin_definir_status_pagamento(${D}, 'em_analise') r`, 2)).erro || ""), "H: logada que não é admin continua negada");
  await d.exec("set role anon"); const e = await d.query("select public.admin_definir_status_pagamento(1, 'pago')").then(() => "executou", x => x.message); await d.exec("reset role");
  ok(/permission denied/.test(e), "H: visitante continua negado");
}
{ // J) item reassociado de OUTRA joiner: o aceite de "ausentes" NUNCA substitui a confirmação de terceiros
  const d = await banco(); const D = await dem(d, "ana", [it(4020, "WM-D-1", "W MAG", "capa d", 70)]);   // WM-D-1 = 7304, da bia
  const so_ausentes = await def(d, D, "pago", null, false, true);
  ok(so_ausentes.status === "confirmar_terceiros" && JSON.stringify(so_ausentes.outras_joiners) === '["bia"]', "J: com SÓ o aceite de ausentes, a função devolve 'confirmar_terceiros' (não confirma)");
  ok(await status(d, D) === "em_analise" && await flags(d, 7304) === "000" && (await d.query("select count(*)::int n from emergencia.pagamento_marcacoes")).rows[0].n === 0, "J: …e nada foi gravado (status, pago_* e registro intactos)");
  const so_terceiros = await def(d, D, "pago", null, true, false);
  ok(so_terceiros.status === "confirmar_itens_ausentes" && await flags(d, 7304) === "000", "J: com SÓ o aceite de terceiros, ainda para na reassociação e nada é gravado");
  const ambos = await def(d, D, "pago", null, true, true);
  ok(ambos.status === "pago" && await flags(d, 7304) === "100", "J: só com os DOIS aceites confirma e marca o item atual da outra joiner");
}
{ // K) código duplicado: mesmo com os dois aceites NUNCA reassocia nem marca nenhuma das linhas homônimas
  const d = await banco(); const D = await dem(d, "ana", [it(4050, "DUP-1", "W MAG", "capa c", 50)]);   // DUP-1 = 7302 (ana) e 7303 (bia)
  const b = await def(d, D, "pago", null, true, true);
  ok(b.status === "pago" && b.itens_marcados === 0 && b.itens_reassociados === 0 && b.itens_nao_encontrados === 1, "K: código duplicado com os dois aceites: confirma a demanda, mas NÃO reassocia (1 ausente, 0 marcados)");
  ok(await flags(d, 7302) === "000" && await flags(d, 7303) === "000" && (await d.query("select count(*)::int n from emergencia.pagamento_marcacoes")).rows[0].n === 0, "K: nenhuma das duas linhas com o código duplicado foi marcada e nada foi registrado");
}
{ // L) o aceite correto é por demanda: um aceite dado em uma não vale para outra (parâmetros por chamada, sem estado)
  const d = await banco(); const A = await dem(d, "ana", [it(4060, "WM-A-1", "W MAG", "capa a", 100)]); const B = await dem(d, "ana", [it(4061, "WM-B-1", "W MAG", "capa b", 100)]);
  await def(d, A, "pago", null, false, true);
  const b = await def(d, B, "pago");
  ok(b.status === "confirmar_itens_ausentes" && await flags(d, 7301) === "000", "L: o aceite dado à demanda A não vale para a B (a B continua parando antes de gravar)");
}
{ // I) aplicar: permissões idênticas, guardas, verificador, reversão e reaplicação
  const d1 = await banco({ r11: false }); const antes = await acl(d1);
  ok(await tenta(d1, sql("R1_1_reassociar_itens_aplicar.sql")) === null, "I: R1.1 aplica");
  ok(await acl(d1) === antes, "I: ACL e dono da função IDÊNTICOS aos de antes");
  const v = (await d1.query(sql("R1_1_reassociar_itens_verificar.sql"))).rows;
  ok(v.length === 8 && v[0].valor === "true" && v[1].valor === "true" && v[2].valor === "false" && v[3].valor === "true" && v[4].valor === "1" && v[5].valor === "true" && v[6].valor === "2" && v[7].valor === "false", "I: verificador devolve 8 linhas com os valores esperados");
  ok(/já foi aplicado/.test(await tenta(d1, sql("R1_1_reassociar_itens_aplicar.sql")) || ""), "I: reaplicar é recusado");
  const d0 = await banco({ r1: false }); ok(/R1 não está aplicado/.test(await tenta(d0, sql("R1_1_reassociar_itens_aplicar.sql")) || ""), "I: sem o R1 aplicado, o R1.1 recusa");
  ok(/falta a confirmação/.test(await tenta(d1, sql("R1_1_reassociar_itens_reverter_protegido.sql")) || ""), "I: reversão SEM a frase é recusada");
  const rev = sql("R1_1_reassociar_itens_reverter_protegido.sql").replace("confirmacao text := '';", "confirmacao text := 'AUTORIZO REVERTER REASSOCIACAO';");
  ok(await tenta(d1, rev) === null, "I: reversão COM a frase funciona");
  ok(await acl(d1) === antes, "I: depois de reverter, ACL e dono continuam idênticos");
  const D = await dem(d1, "tiredlevi_", [it(6183, "VT-ITE-226041304", "V&T", "set jisung run it", 132)]);
  const b = await def(d1, D, "pago"); ok(b.status === "confirmar_itens_ausentes" && b.reassociaveis === undefined && b.ids.length === 1, "I: depois de reverter volta ao comportamento do R1 (ausente, sem reassociação)");
  ok(await tenta(d1, sql("R1_1_reassociar_itens_aplicar.sql")) === null && (await def(d1, D, "pago")).reassociaveis?.length === 1, "I: o R1.1 pode ser aplicado de novo depois de revertido");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
