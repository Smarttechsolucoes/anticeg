// Regressão do requisito de isolamento: com o N0 aplicado, o VISITANTE não pode listar, ler por @ nem criar notificações pela tabela. PGlite local, dados fictícios.
// Uso: node tests/sql/n0-isolamento-atual.mjs [arquivo_aplicar.sql]   (sem argumento usa o N0 atual; com o N0 ABERTO antigo este teste FALHA, documentando a exposição)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/notificacoes/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const d = new PGlite();
await d.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  create schema auth; create function auth.uid() returns uuid language sql stable as $f$ select null::uuid $f$;
  create table public.admin_roles (user_id uuid primary key); create function public.is_admin() returns boolean language sql stable as $f$ select false $f$;`);
await d.exec(readFileSync(R + (process.argv[2] ?? "N0_tabela_notifications_aplicar.sql"), "utf8"));
const anon = async q => { await d.exec("set role anon"); try { return { rows: (await d.query(q)).rows }; } catch (e) { return { erro: e.message }; } finally { await d.exec("reset role"); } };
await d.exec("insert into public.notifications (joiner_cog, message, type) values ('ana', 'Seu pagamento de R$ 220 foi confirmado', 'pagamento'), ('bia', 'Precisamos do seu endereço para processar seu envio', 'envio_address_request')");
ok(!!(await anon("select joiner_cog, message from public.notifications")).erro, "visitante NÃO lista as notificações de todas as joiners");
ok(!!(await anon("select message from public.notifications where joiner_cog = 'bia'")).erro, "visitante NÃO lê as da bia pela tabela, mesmo informando o @");
ok(!!(await anon("insert into public.notifications (joiner_cog, message, type) values ('ana', 'FALSO: clique em http://golpe.exemplo', 'pagamento') returning id")).erro, "visitante NÃO cria notificação falsa em nome da casa");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
