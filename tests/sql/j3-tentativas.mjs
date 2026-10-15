// J3 (v2): permissão restrita à sequência da própria tabela (PGlite local, dados fictícios)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/joiners-auth/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = f => readFileSync(R + f, "utf8");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const d = new PGlite();
await d.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  create table public.outra (id bigint generated always as identity primary key, x int);
  -- reproduz o Supabase: sequências novas do schema public nascem abertas para anon, authenticated e service_role
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  create sequence public.sequencia_alheia;
  create table public.outra2 (id bigint generated always as identity primary key);`);
const acl = async () => JSON.stringify((await d.query("select relname, relacl::text from pg_class where relkind = 'S' and relname in ('outra_id_seq','sequencia_alheia','outra2_id_seq') order by relname")).rows);
const aclAntes = await acl();
ok(/anon/.test(aclAntes), "cenário: sequências alheias nascem ABERTAS para anon (como no Supabase)");
await d.exec(sql("J3_tentativas_aplicar.sql")); ok(true, "J3 aplica sem erro");
const v = Object.fromEntries((await d.query(sql("J3_tentativas_verificar.sql"))).rows.map(r => [r.item, r.valor]));
ok(Object.values(v).length === 6, "verificador devolve 6 linhas");
ok(v["tentativas_acesso existe, RLS ligado (esperado true)"] === "true" && v["anon/authenticated com algum acesso (esperado false)"] === "false" && v["service_role com acesso (esperado true)"] === "true" && v["estado registrado (linhas J3, esperado 1)"] === "1", "verificador: tabela, RLS, permissões e registro");
ok(v["service_role usa a sequência da coluna id (esperado true)"] === "true" && v["anon/authenticated usam a sequência (esperado false)"] === "false", "verificador: sequência só do service_role");
const seq = (await d.query("select pg_get_serial_sequence('public.tentativas_acesso','id') s")).rows[0].s;
ok(/tentativas_acesso_id_seq/.test(seq), "nome real da sequência obtido do catálogo: " + seq);
ok(await acl() === aclAntes, "as OUTRAS sequências ficaram exatamente como estavam (privilégios idênticos)");
const aclSeq = (await d.query("select relacl::text a from pg_class where relname = 'tentativas_acesso_id_seq'")).rows[0].a;
ok(!/anon|authenticated/.test(aclSeq) && /service_role=rU\//.test(aclSeq), "sequência da tabela: sem anon/authenticated; service_role só USAGE+SELECT (" + aclSeq + ")");
ok((await d.query("select has_sequence_privilege('public'::name,'public.tentativas_acesso_id_seq','USAGE') x").catch(() => ({rows:[{x:false}]}))).rows[0].x === false, "PUBLIC sem acesso à sequência");
await d.exec("set role service_role"); await d.exec("insert into public.tentativas_acesso (tipo, chave) values ('login','cog:ana'), ('recuperar','ip:1.1.1.1')");
ok((await d.query("select count(*)::int n from public.tentativas_acesso")).rows[0].n === 2, "service_role insere e lê (gera os ids pela sequência)"); await d.exec("reset role");
for (const papel of ["anon", "authenticated"]) { await d.exec(`set role ${papel}`); let neg = false; try { await d.query("select * from public.tentativas_acesso"); } catch (e) { neg = /permission denied/.test(e.message); } await d.exec("reset role"); ok(neg, papel + " não lê tentativas_acesso"); }
let e2 = ""; try { await d.exec(sql("J3_tentativas_aplicar.sql")); } catch (e) { e2 = e.message; await d.exec("rollback").catch(() => {}); } ok(/já existe|já foi aplicada/.test(e2), "reaplicar o J3 é recusado");
await d.exec(sql("J3_tentativas_reverter_protegido.sql").replace("confirmacao text := '';", "confirmacao text := 'AUTORIZO REMOVER CONTROLE DE TENTATIVAS';")).catch(e => console.log("(reversão:", e.message.slice(0, 120) + ")"));
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
