// Teste LOCAL (PGlite, dados fictícios) das garantias novas do E0: config preservado para o administrador, impressão digital dos privilégios e auto-verificação que DESFAZ tudo se algo fora do previsto mudar.
// Uso: node supabase/emergencia/teste-local/teste-e0-guarda.mjs   (precisa de @electric-sql/pglite)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("../", import.meta.url));
const sql = f => readFileSync(dir + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };

async function banco() {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    create table public.joiners (id int primary key, cog text); create table public.claims (id int primary key); create table public.masterlist (id int primary key);
    create table public.config (key text primary key, value text); create table public.pedidos_x (id int primary key); create table public.bkp_unir_a (id int); create table public.bkp_unir_b (id int, cpf text);
    alter table public.joiners enable row level security; create policy aberta on public.joiners for all using (true);
    grant all on all tables in schema public to anon, authenticated;
    revoke delete on public.config from anon;                              -- como em produção depois do B8
    grant select (id) on public.pedidos_x to anon;
  `);
  await d.exec(sql("E00_ferramentas_backup.sql"));
  return d;
}
const como = async (d, papel, q) => { await d.exec(`set role ${papel}`); try { await d.query(q); return null; } catch (e) { return e.message; } finally { await d.exec("reset role"); } };
const tenta = async (d, q) => { try { await d.exec(q); return null; } catch (e) { try { await d.exec("rollback"); } catch {} return e.message; } };
const impressao = async d => (await d.query(`select md5(coalesce((select string_agg(c.relname || coalesce(c.relacl::text, '') || coalesce((select string_agg(a.attname || a.attacl::text, ',' order by a.attname) from pg_attribute a where a.attrelid = c.oid and a.attacl is not null), ''), ';' order by c.relname) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'), '')) h`)).rows[0].h;
const E0 = sql("E0_aplicar.sql");
const injetar = trecho => E0.replace("-- Conferência final DENTRO da transação", trecho + "\n-- Conferência final DENTRO da transação");

{ // normal
  const d = await banco();
  ok(await tenta(d, E0) === null, "E0 aplica");
  ok(await como(d, "authenticated", "delete from public.config where key = 'zzz'") === null, "config: o administrador logado (authenticated) CONTINUA apagando chaves");
  ok(/permission denied/.test(await como(d, "anon", "delete from public.config where key = 'zzz'") || ""), "config: o visitante não apaga");
  ok(await como(d, "authenticated", "delete from public.claims where id = -1") === null && await como(d, "anon", "delete from public.masterlist where id = -1") === null, "lista de DELETE preservado intacta (claims, masterlist)");
  ok(/permission denied/.test(await como(d, "anon", "delete from public.pedidos_x where id = -1") || "") && /permission denied/.test(await como(d, "authenticated", "delete from public.pedidos_x where id = -1") || ""), "DELETE fora da lista revogado de anon e authenticated");
  ok(/permission denied/.test(await como(d, "anon", "select * from public.bkp_unir_b") || "") && /permission denied/.test(await como(d, "authenticated", "select * from public.bkp_unir_a") || ""), "bkp_unir_* sem acesso");
  ok(await como(d, "anon", "select id from public.pedidos_x") === null && await como(d, "anon", "insert into public.joiners values (1, 'a')") === null && await como(d, "anon", "update public.joiners set cog = 'b'") === null, "SELECT por coluna, INSERT e UPDATE inalterados");
  const rv = await d.exec(sql("E0_verificar.sql")); const u = rv[rv.length - 1].rows[0];
  ok(u.anon_apaga_config === false && u.authenticated_apaga_config === true && u.tabelas_da_lista_ainda_apagaveis === 2 && u.tabelas_com_truncate === 0, "E0_verificar (seção 5): anon não apaga config, authenticated apaga, lista preservada (2 existem neste cenário), 0 TRUNCATE");
  const r2 = rv[1].rows[0]; ok(r2.bkp_ainda_legiveis_por_anon === 0 && r2.tabelas_com_truncate_anon === 0, "E0_verificar (seção 2): 0 bkp legível e 0 TRUNCATE");
}
const mutacoes = [
  ["revogar SELECT de anon em joiners (fora do previsto)", "revoke select on public.joiners from anon;", /alterou \d+ privilégio/],
  ["reabrir DELETE em pedidos_x depois das revogações", "grant delete on public.pedidos_x to anon;", /DELETE ainda presente fora do previsto: pedidos_x/],
  ["deixar um bkp_unir_* legível", "grant select on public.bkp_unir_a to anon;", /tabela\(s\) bkp_unir_\* ainda acessível/],
  ["deixar TRUNCATE em claims", "grant truncate on public.claims to anon;", /ainda com TRUNCATE\/REFERENCES\/TRIGGER/],
  ["tirar o DELETE do authenticated em masterlist (lista preservada)", "revoke delete on public.masterlist from authenticated;", /alterou \d+ privilégio/],
  ["tirar INSERT de authenticated em claims", "revoke insert on public.claims from authenticated;", /alterou \d+ privilégio/],
];
for (const [nome, trecho, esperado] of mutacoes) {
  const d = await banco(); const antes = await impressao(d);
  const e = await tenta(d, injetar(trecho));
  ok(esperado.test(e || ""), `guarda pega: ${nome}`);
  ok(await impressao(d) === antes && /permission denied/.test(await como(d, "anon", "select * from public.bkp_unir_b") || "") === false, `…e a transação INTEIRA é desfeita (permissões idênticas às de antes; bkp ainda legível pois o E0 não valeu)`);
}
{ // reversão continua funcionando com o E0 novo
  const d = await banco(); await d.exec(E0);
  const rev = sql("E0_reverter.sql").replace("confirmacao     text    := '';", "confirmacao     text    := 'AUTORIZO REABRIR EXPOSICOES';").replace("reabrir_backups boolean := false;", "reabrir_backups boolean := true;").replace("reabrir_delete  boolean := false;", "reabrir_delete  boolean := true;").replace("reabrir_outros  boolean := false;", "reabrir_outros  boolean := true;");
  ok(await tenta(d, rev) === null && await como(d, "anon", "select * from public.bkp_unir_b") === null && await como(d, "anon", "delete from public.pedidos_x where id = -1") === null, "reversão total do E0 novo restaura bkp e DELETE");
  ok(await tenta(d, E0) === null, "e o E0 pode ser reaplicado depois");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
