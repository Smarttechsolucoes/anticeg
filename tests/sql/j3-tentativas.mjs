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
  create sequence public.sequencia_alheia;`);
await d.exec(sql("J3_tentativas_aplicar.sql")); ok(true, "J3 aplica sem erro");
const v = Object.fromEntries((await d.query(sql("J3_tentativas_verificar.sql"))).rows.map(r => [r.item, r.valor]));
ok(Object.values(v).length === 6, "verificador devolve 6 linhas");
ok(v["tentativas_acesso existe, RLS ligado (esperado true)"] === "true" && v["anon/authenticated com algum acesso (esperado false)"] === "false" && v["service_role com acesso (esperado true)"] === "true" && v["estado registrado (linhas J3, esperado 1)"] === "1", "verificador: tabela, RLS, permissões e registro");
ok(v["service_role usa a sequência da coluna id (esperado true)"] === "true" && v["anon/authenticated usam a sequência (esperado false)"] === "false", "verificador: sequência só do service_role");
const seq = (await d.query("select pg_get_serial_sequence('public.tentativas_acesso','id') s")).rows[0].s;
ok(/tentativas_acesso_id_seq/.test(seq), "nome real da sequência obtido do catálogo: " + seq);
ok((await d.query("select has_sequence_privilege('service_role','public.outra_id_seq','USAGE') a, has_sequence_privilege('service_role','public.sequencia_alheia','USAGE') b")).rows[0].a === false, "service_role NÃO ganhou acesso às outras sequências (identity de outra tabela)");
ok((await d.query("select has_sequence_privilege('service_role','public.sequencia_alheia','USAGE') b")).rows[0].b === false, "nem à sequência avulsa");
await d.exec("set role service_role"); await d.exec("insert into public.tentativas_acesso (tipo, chave) values ('login','cog:ana'), ('recuperar','ip:1.1.1.1')");
ok((await d.query("select count(*)::int n from public.tentativas_acesso")).rows[0].n === 2, "service_role insere e lê (gera os ids pela sequência)"); await d.exec("reset role");
for (const papel of ["anon", "authenticated"]) { await d.exec(`set role ${papel}`); let neg = false; try { await d.query("select * from public.tentativas_acesso"); } catch (e) { neg = /permission denied/.test(e.message); } await d.exec("reset role"); ok(neg, papel + " não lê tentativas_acesso"); }
let e2 = ""; try { await d.exec(sql("J3_tentativas_aplicar.sql")); } catch (e) { e2 = e.message; await d.exec("rollback").catch(() => {}); } ok(/já existe|já foi aplicada/.test(e2), "reaplicar o J3 é recusado");
await d.exec(sql("J3_tentativas_reverter_protegido.sql").replace("confirmacao text := '';", "confirmacao text := 'AUTORIZO REMOVER CONTROLE DE TENTATIVAS';")).catch(e => console.log("(reversão:", e.message.slice(0, 120) + ")"));
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
