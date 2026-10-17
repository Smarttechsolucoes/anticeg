// Teste do J4c-4f (estoque dos drops: wave_maker_estoque, paper_tales_estoque, promo_13_estoque, odd_fresh_estoque) no laboratório fictício (PGlite).
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4c4f-estoque-drops.mjs
import { laboratorio, como, n, negado, rodar, verificar, ok, fim, J } from "./_lab.mjs";
const barrado = r => negado(r) || r.rows?.length === 0;
const TABELAS = ["wave_maker_estoque", "paper_tales_estoque", "promo_13_estoque", "odd_fresh_estoque"];

// reproduz o que o banco real tem hoje (supabase/sql/*_estoque.sql): leitura pública + UPDATE aberto, sem restrição de papel
async function criarEstoque(d, tabelas) {
  for (const t of tabelas) {
    await d.exec(`create table public.${t} (item_id text primary key, estoque integer not null default 0, contar_desde timestamptz not null default now());
      alter table public.${t} enable row level security;
      create policy select_publico on public.${t} for select using (true);
      create policy update_admin on public.${t} for update using (true);
      grant all on table public.${t} to anon, authenticated, service_role;
      insert into public.${t} (item_id, estoque) values ('KIT 01', 3), ('KIT 02', 5)`);
  }
}

const d = await laboratorio();
await criarEstoque(d, TABELAS.slice(0, 3));        // odd_fresh_estoque NÃO existe neste cenário (como no repositório)

// ANTES (vulnerabilidade de hoje)
ok((await como(d, "anon", null, "update public.paper_tales_estoque set estoque = 9999 returning item_id")).rows?.length === 2, "ANTES: o visitante ALTERA o estoque (vulnerabilidade reproduzida)");
ok((await como(d, "anon", null, "update public.wave_maker_estoque set estoque = 0 returning item_id")).rows?.length === 2, "ANTES: o visitante ZERA o estoque de outro drop (vulnerabilidade reproduzida)");
await d.exec("update public.paper_tales_estoque set estoque = 3 where item_id = 'KIT 01'; update public.paper_tales_estoque set estoque = 5 where item_id = 'KIT 02'; update public.wave_maker_estoque set estoque = 3 where item_id = 'KIT 01'; update public.wave_maker_estoque set estoque = 5 where item_id = 'KIT 02'");
const antes = JSON.stringify((await d.query("select 'w' t, item_id, estoque from public.wave_maker_estoque union all select 'p', item_id, estoque from public.paper_tales_estoque union all select 'o', item_id, estoque from public.promo_13_estoque order by 1, 2")).rows);

const e = await rodar(d, "J4c4f_estoque_drops_aplicar.sql", J); ok(e === null, "J4c-4f aplica sem erro (odd_fresh_estoque ausente é ignorada)" + (e ? ": " + e : ""));
const v = await verificar(d, "J4c4f_estoque_drops_verificar.sql");
ok(v["tabelas de estoque presentes"] === "3" && v["RLS ligado (esperado = presentes)"] === "3" && v["policies (esperado = 2 x presentes)"] === "6" && v["policies de escrita para visitante/PUBLIC (esperado 0)"] === "0" && v["visitante escreve em estoque (esperado false)"] === "false" && v["visitante lê estoque em todas as presentes (esperado true)"] === "true" && Number(v["estado registrado (linhas J4c-4f, esperado >= 4)"]) >= 4, "verificação J4c-4f como esperado: " + JSON.stringify(v));

// visitante: lê, não escreve
for (const t of TABELAS.slice(0, 3)) {
  ok((await n(d, "anon", null, `select * from public.${t}`)) === 2, `visitante LÊ ${t} (o formulário do drop mostra disponível/esgotado)`);
  ok(barrado(await como(d, "anon", null, `update public.${t} set estoque = 9999 returning item_id`)), `visitante NÃO altera ${t}`);
  ok(negado(await como(d, "anon", null, `insert into public.${t} (item_id, estoque) values ('GOLPE', 99)`)) && barrado(await como(d, "anon", null, `delete from public.${t} returning item_id`)), `visitante NÃO insere nem apaga em ${t}`);
}
// joiner ativada: lê, não escreve (nenhuma escrita é copiada para a conta logada)
ok((await n(d, "authenticated", 2, "select * from public.promo_13_estoque")) === 2, "ana (ativada) lê o estoque");
ok(barrado(await como(d, "authenticated", 2, "update public.promo_13_estoque set estoque = 9999 returning item_id")) && barrado(await como(d, "authenticated", 2, "delete from public.wave_maker_estoque returning item_id")) && negado(await como(d, "authenticated", 2, "insert into public.paper_tales_estoque (item_id, estoque) values ('GOLPE', 99)")), "ana NÃO altera, insere nem apaga estoque");
ok(barrado(await como(d, "authenticated", 4, "update public.promo_13_estoque set estoque = 9999 returning item_id")), "conta SEM vínculo NÃO altera estoque");
// administradora preservada
ok((await como(d, "authenticated", 1, "update public.paper_tales_estoque set estoque = estoque - 1 where item_id = 'KIT 01' returning estoque")).rows?.[0]?.estoque === 2, "a administradora ALTERA o estoque (painel preservado)");
ok((await como(d, "authenticated", 1, "insert into public.promo_13_estoque (item_id, estoque) values ('KIT 03', 4) returning item_id")).rows?.length === 1 && (await como(d, "authenticated", 1, "delete from public.promo_13_estoque where item_id = 'KIT 03' returning item_id")).rows?.length === 1, "a administradora insere e remove item de estoque");
await d.exec("update public.paper_tales_estoque set estoque = 3 where item_id = 'KIT 01'");
// nenhum dado mudou
const depois = JSON.stringify((await d.query("select 'w' t, item_id, estoque from public.wave_maker_estoque union all select 'p', item_id, estoque from public.paper_tales_estoque union all select 'o', item_id, estoque from public.promo_13_estoque order by 1, 2")).rows);
ok(antes === depois, "os dados de estoque ficaram idênticos (o script não alterou nenhuma linha)");

// reaplicar é recusado; reversão protegida e ciclo completo
ok(/já foi aplicado/.test(await rodar(d, "J4c4f_estoque_drops_aplicar.sql", J) || ""), "J4c-4f recusa ser aplicado duas vezes");
ok((await rodar(d, "J4c4f_estoque_drops_reverter_protegido.sql", J)) !== null, "reversão SEM a frase de autorização é recusada");
ok(await rodar(d, "J4c4f_estoque_drops_reverter_protegido.sql", J, "AUTORIZO REABRIR ESTOQUE DOS DROPS") === null && (await como(d, "anon", null, "update public.paper_tales_estoque set estoque = 3 returning item_id")).rows?.length === 2, "reversão COM a frase reabre (e só então)");
const e2 = await rodar(d, "J4c4f_estoque_drops_aplicar.sql", J); ok(e2 === null, "J4c-4f reaplica depois de revertido" + (e2 ? ": " + e2 : ""));

// cenário com as 4 tabelas
const q = await laboratorio(); await criarEstoque(q, TABELAS);
ok(await rodar(q, "J4c4f_estoque_drops_aplicar.sql", J) === null, "com as 4 tabelas presentes o J4c-4f aplica");
const v4 = await verificar(q, "J4c4f_estoque_drops_verificar.sql");
ok(v4["tabelas de estoque presentes"] === "4" && v4["policies (esperado = 2 x presentes)"] === "8" && v4["visitante escreve em estoque (esperado false)"] === "false", "4 tabelas: 8 policies e visitante sem escrita");

// guardas
const g = await laboratorio(); await criarEstoque(g, ["wave_maker_estoque"]); await g.exec("alter table public.wave_maker_estoque drop column contar_desde");
ok(/sem as colunas esperadas/.test(await rodar(g, "J4c4f_estoque_drops_aplicar.sql", J) || "") && (await como(g, "anon", null, "update public.wave_maker_estoque set estoque = 1 returning item_id")).rows?.length === 2, "J4c-4f ABORTA e não altera nada se uma tabela não tem as colunas esperadas");
const g0 = await laboratorio(); ok(/Nenhuma tabela de estoque/.test(await rodar(g0, "J4c4f_estoque_drops_aplicar.sql", J) || ""), "J4c-4f ABORTA se nenhuma tabela de estoque existir");
const g2 = await laboratorio(); await criarEstoque(g2, ["wave_maker_estoque"]); await g2.exec("delete from public.admin_roles");
ok(/Não há administradora cadastrada/.test(await rodar(g2, "J4c4f_estoque_drops_aplicar.sql", J) || "") && (await como(g2, "anon", null, "update public.wave_maker_estoque set estoque = 1 returning item_id")).rows?.length === 2, "J4c-4f ABORTA sem administradora cadastrada (ninguém ficaria com permissão de escrita) e não altera nada");
fim();
