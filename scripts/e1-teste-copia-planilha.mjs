// TESTE REAL da etapa 1 contra uma CÓPIA ISOLADA do Google Sheets com uma implantação de TESTE do Apps Script.
// O banco é LOCAL (PGlite, só dados fictícios); só a planilha é de verdade (a CÓPIA). Nada toca no Supabase de produção nem na planilha real.
// Passo a passo para montar a cópia: supabase/cadastro-tarefas/TESTE_REAL_COPIA.md
//
//   E1_CONFIRMO_COPIA=1 E1_PLANILHA_URL=<URL /exec da implantação de teste> E1_PLANILHA_TOKEN=<token da implantação de teste> [E1_COPIA_SHEET_ID=<id da planilha de teste, opcional>] node scripts/e1-teste-copia-planilha.mjs
//
// Trava de segurança: só mexe em cadastros FICTÍCIOS (@ que começam com "teste_e1"); em qualquer outra planilha (inclusive a real) esses @ não existem e o Apps Script responde "linha não encontrada" SEM gravar nada.
// Nenhum token, URL ou e-mail é impresso.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { processarFila } from "../supabase/functions/_shared/perfilsync.ts";

const URL_PLANILHA = process.env.E1_PLANILHA_URL, TOKEN = process.env.E1_PLANILHA_TOKEN, SHEET_ID = process.env.E1_COPIA_SHEET_ID || "";
const ARROBA = (process.env.E1_ARROBA_TESTE || "teste_e1").replace(/^@/, ""), AUSENTE = ARROBA + "_ausente";
if (process.env.E1_CONFIRMO_COPIA !== "1") { console.error("Recusado: defina E1_CONFIRMO_COPIA=1 para confirmar que a URL é a de uma CÓPIA de teste."); process.exit(2); }
if (!URL_PLANILHA || !TOKEN) { console.error("Faltam E1_PLANILHA_URL e E1_PLANILHA_TOKEN (da implantação de TESTE)."); process.exit(2); }
if (!ARROBA.startsWith("teste_e1")) { console.error("O @ de teste precisa começar com teste_e1."); process.exit(2); }
if (process.env.PLANILHA_URL && process.env.PLANILHA_URL === URL_PLANILHA) { console.error("Recusado: E1_PLANILHA_URL é igual à PLANILHA_URL de produção."); process.exit(2); }

const R = new URL("../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const arq = f => readFileSync(R + f, "utf8").replace(/\r/g, "");
const fatia = (txt, inicio, fim = "\nend $$;") => { const i = txt.indexOf(inicio); if (i < 0) throw new Error("não achei: " + inicio); return txt.slice(i, txt.indexOf(fim, i) + fim.length); };
let falhas = 0; const ok = (c, m) => { console.log((c ? "  OK   " : "  FALHA ") + m); if (!c) falhas++; };
const passo = t => console.log("\n▶ " + t);
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

// ---- 0) ANTES de abrir o banco: confirmar que a URL é a da planilha de TESTE (criada do zero) e que está no estado inicial
const sair = async c => { process.exitCode = c; await new Promise(r => setTimeout(r, 400)); process.exit(c); };   // espera as conexões fecharem (evita o erro do libuv no Windows)
let diag = null;   // o que o Apps Script respondeu (sem segredo), para explicar uma recusa
const acaoTeste = async (acao) => {
  const r = await fetch(URL_PLANILHA, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ acao, token: TOKEN, twitter: "@" + ARROBA }) });
  const txt = await r.text(); const tipo = r.headers.get("content-type") ?? "";
  let json = null; try { json = JSON.parse(txt); } catch { /* não é JSON */ }
  const limpo = String(txt).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").split(TOKEN).join("[oculto]").split(URL_PLANILHA).join("[url]").slice(0, 140);
  diag = { acao, status: r.status, tipo: tipo.split(";")[0], json: !!json, erro: typeof json?.erro === "string" ? json.erro.slice(0, 160) : null, trecho: json ? null : limpo };
  return json;
};
const explicar = () => {
  if (!diag) return "";
  const l = [`Diagnóstico: ação ${diag.acao} → HTTP ${diag.status}, ${diag.json ? "JSON" : "resposta que NÃO é JSON (" + (diag.tipo || "sem tipo") + ")"}${diag.erro ? ", erro do Apps Script: “" + diag.erro + "”" : ""}${diag.trecho ? ", começo da resposta: “" + diag.trecho + "”" : ""}`];
  if (!diag.json) l.push("→ Provável: a implantação não está com acesso \"Qualquer pessoa\" (o Google devolveu uma página de login/erro), ou a URL não é a que termina em /exec.");
  else if (/token/i.test(diag.erro ?? "")) l.push("→ Provável: o token digitado não é o de ANTICEG_TOKEN desta planilha (ou ANTICEG_TOKEN não foi criado). Rode gerarTokenTeste e copie de novo.");
  else if (/a[cç][aã]o inv/i.test(diag.erro ?? "")) l.push("→ Provável: a implantação é de uma versão ANTIGA do código (sem e1_identificar). Implantar › Gerenciar implantações › editar (lápis) › Versão: Nova versão › Implantar.");
  else if (/n[aã]o [eé] a planilha de teste/i.test(diag.erro ?? "")) l.push("→ Provável: prepararPlanilhaTeste não foi executada NESTA planilha (faltam as propriedades E1_PLANILHA_TESTE/E1_PLANILHA_ID).");
  else l.push("→ Me mande esta linha de diagnóstico (ela não contém token nem URL).");
  return l.join("\n");
};
console.log("TESTE REAL (planilha = CÓPIA; banco = local fictício)");
passo("0. Confirmar que o Apps Script de teste aponta para a planilha de TESTE (criada do zero)");
const ident = await acaoTeste("e1_identificar");
ok(ident?.ok === true && ident.teste === true, "o Apps Script confirma: é a planilha de teste E1 (propriedades criadas pela preparação)");
ok(Array.isArray(ident?.abas) && ident.abas.length === 2 && ident.abas.includes("Dados") && ident.abas.includes("MASTERLIST"), "a planilha tem SÓ as abas Dados e MASTERLIST");
ok(/^TESTE E1/.test(ident?.nome ?? ""), "o nome da planilha começa com 'TESTE E1'");
if (SHEET_ID) ok(SHEET_ID.endsWith(ident?.id_final ?? "\u0000"), "o final do id da planilha confere com E1_COPIA_SHEET_ID");
if (!(ident?.ok === true && ident.teste === true && ident.abas?.length === 2 && /^TESTE E1/.test(ident.nome ?? ""))) { console.error("\nRECUSADO: o endereço informado NÃO é a planilha de teste. Nada foi gravado.\n" + explicar()); await sair(2); }
const base0 = await acaoTeste("e1_ler");
if (!base0?.ok || base0.dados.length !== 1 || base0.dados[0].versao !== "") { console.error("\nA planilha de teste não está no estado inicial (já foi usada). Rode reiniciarDadosTeste() no Apps Script da planilha de teste e repita. Nada foi gravado."); await sair(2); }
ok(base0.master.length === 3 && base0.master.filter(m => m.formula_nome).length === 2 && base0.master.filter(m => !m.formula_nome).length === 1, "estado inicial: 3 linhas da MASTERLIST com o @ de teste (2 com fórmula no NOME, 1 com texto fixo)");
const textoFixoAntes = base0.master.find(m => !m.formula_nome).nome;

const d = new PGlite();
await d.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin; grant usage on schema public to anon, authenticated, service_role;
  create schema auth; create schema emergencia; grant usage on schema auth to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('lab.uid', true), '')::uuid $$; grant execute on function auth.uid() to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function emergencia.h(t text) returns text language sql immutable set search_path = '' as $$ select encode(sha256(convert_to(lower(btrim(coalesce(t, ''))), 'UTF8')), 'hex') $$;
  create function emergencia.h_arroba(t text) returns text language sql immutable set search_path = '' as $$ select emergencia.h(ltrim(btrim(coalesce(t, '')), '@')) $$;
  create table emergencia.emails_confiaveis (joiner_id bigint primary key, email_hash text not null, arroba_hash text not null, registrado_em timestamptz not null default now(), origem text not null);
  create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('lab.admin', true), '') = '1' $$;
  create table public.joiners (id bigint generated always as identity primary key, cog text unique, nome text, nome_site text, whatsapp text, email text, twitter text, recrutador text, saldo_cashback numeric default 0, confirmado boolean default true);
  create table public.contas_joiner (user_id uuid primary key, joiner_id bigint not null unique references public.joiners(id), vinculado_em timestamptz default now(), origem text default 'email_verificado', perfil_concluido_em timestamptz);
  grant select, insert, update, delete on all tables in schema public to service_role;
`);
await d.exec(fatia(arq("joiners-auth/J1d_email_confiavel_aplicar.sql"), "create function emergencia.joiners_antes_trocar_identidade()"));
await d.exec(`create trigger joiners_antes_trocar_identidade before update of email, twitter on public.joiners for each row execute function emergencia.joiners_antes_trocar_identidade();`);
const j6 = arq("joiners-auth/J6_perfil_obrigatorio_aplicar.sql"); await d.exec(j6.slice(j6.indexOf("-- 3) sinal local"), j6.indexOf("-- 9b)")));
await d.exec(fatia(arq("joiners-auth/J4c1_joiners_aplicar.sql"), "create function public.trg_joiners_protege_colunas()") + "\nrevoke all on function public.trg_joiners_protege_colunas() from public, anon, authenticated;\ncreate trigger trg_joiners_protege_colunas before update on public.joiners for each row execute function public.trg_joiners_protege_colunas();");
await d.exec(`grant select, insert, update on public.joiners to authenticated; grant select on public.contas_joiner to authenticated; grant all on all sequences in schema public to anon, authenticated, service_role;`);
await d.exec(arq("cadastro-tarefas/E1_cadastro_tarefas_aplicar.sql"));
const q = async (sql, p = []) => (await d.query(sql, p)).rows;
const como = async (papel, uid, sql, p = [], admin = false) => {
  await d.exec(`select set_config('lab.uid', '${uid || ""}', false), set_config('lab.admin', '${admin ? 1 : 0}', false); set role ${papel}`);
  try { return { rows: (await d.query(sql, p)).rows }; } catch (e) { return { erro: String(e.message) }; } finally { await d.exec("reset role; select set_config('lab.uid', '', false), set_config('lab.admin', '0', false)"); }
};
const ADM = U(1), CONTA = U(2), CONTA2 = U(3);
await q("insert into auth.users values ($1,'admin@exemplo.com',now()), ($2,'teste.e1@exemplo.com',now()), ($3,'ausente.e1@exemplo.com',now())", [ADM, CONTA, CONTA2]);
const novo = async (cog, uid, email) => {
  const [{ id }] = await q("insert into public.joiners (cog, nome, nome_site, email, twitter) values ($1,'Teste E1 Antigo','T',$2,$3) returning id", [cog, email, "@" + cog]);
  await q("insert into emergencia.emails_confiaveis values ($1, emergencia.h($2), emergencia.h_arroba($3), now(), 'lab')", [id, email, "@" + cog]);
  await q("insert into public.contas_joiner (user_id, joiner_id, perfil_concluido_em) values ($1,$2,now())", [uid, id]); return id;
};
const idTeste = await novo(ARROBA, CONTA, "teste.e1@exemplo.com"), idAusente = await novo(AUSENTE, CONTA2, "ausente.e1@exemplo.com");

// ---- perfil-sync REAL, falando com o Apps Script de TESTE pela rede
const deps = {
  env: n => ({ PLANILHA_URL: URL_PLANILHA, PLANILHA_TOKEN: TOKEN }[n]),
  resolverToken: async () => ({ admin: false, cog: null }),
  proximos: async lim => (await como("service_role", null, "select * from public.perfil_sync_proximos($1)", [lim])).rows,
  marcar: async (id, ok2, erro, def) => { await como("service_role", null, "select public.perfil_sync_marcar($1,$2,$3,$4)", [id, ok2, erro, def === true]); },
  estado: async t => (await como("service_role", null, "select public.perfil_sync_estado($1) e", [t])).rows[0]?.e ?? null,
  planilha: async (u, corpo) => {
    const r = await fetch(u, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(corpo) });
    let json = null; try { json = JSON.parse(await r.text()); } catch { /* resposta ilegível */ }
    return { status: r.status, json };
  },
};
const lista = async () => (await como("authenticated", ADM, "select * from public.admin_cadastro_tarefas(50)", [], true)).rows;
const sufixo = new Date().toISOString().slice(11, 19).replace(/:/g, "");

passo("1. Gravação confirmada → tarefa em Atualizações");
const nomeNovo = `Teste E1 ${sufixo}`;
const r1 = (await como("authenticated", CONTA, "select public.salvar_meu_cadastro($1) r", [nomeNovo])).rows[0].r;
ok(r1.ok === true && r1.nome === nomeNovo, "o banco confirmou a gravação e devolveu o valor gravado");
let t = (await lista()).find(x => x.joiner_id === idTeste);
ok(t && t.planilha_status === "pendente" && !t.lida_em && t.pendente, "tarefa em Atualizações: planilha 'pendente', não lida, conta como pendência");

passo("2. Sincronização automática (a função perfil-sync, sem botão) → Apps Script de TESTE → Dados da CÓPIA");
const lote = await processarFila(deps);
console.log("   perfil-sync:", JSON.stringify(lote));
t = (await lista()).find(x => x.joiner_id === idTeste);
ok(lote.enviados === 1 && t.planilha_status === "sincronizada", "o Apps Script de teste respondeu ok e a tarefa ficou 'sincronizada'");
const l1 = await acaoTeste("e1_ler");
ok(l1.dados[0]?.nome === nomeNovo && String(l1.dados[0].id_site) === String(idTeste) && l1.dados[0].papel === "principal", "Dados da CÓPIA: B = nome novo, D = ID_SITE, E = principal");
const comFormula = l1.master.filter(m => m.formula_nome), fixa = l1.master.find(m => !m.formula_nome);
ok(comFormula.length === 2 && comFormula.every(m => m.nome === nomeNovo), "MASTERLIST: as 2 linhas com fórmula passaram a mostrar o nome novo (reflexo de Dados)");
ok(fixa?.nome === textoFixoAntes && textoFixoAntes === "Nome Fixo Digitado", "MASTERLIST: a célula com TEXTO FIXO continua igual");
ok(l1.digesto_constantes === base0.digesto_constantes && l1.digesto_formulas === base0.digesto_formulas, "MASTERLIST: nenhuma célula digitada e nenhuma fórmula mudou (digest da planilha inteira)");

passo("3. E-mail confirmado pelo Auth → Dados!C");
await q("update auth.users set email = $2, email_confirmed_at = now() where id = $1", [CONTA, `teste.e1.${sufixo}@exemplo.com`]);
const lote2 = await processarFila(deps); t = (await lista()).find(x => x.joiner_id === idTeste && x.campos.email);
ok(lote2.enviados === 1 && t?.planilha_status === "sincronizada", "tarefa do e-mail 'sincronizada'");
const l2 = await acaoTeste("e1_ler");
ok(l2.dados[0]?.email === `teste.e1.${sufixo}@exemplo.com`, "Dados da CÓPIA: C = e-mail novo");
ok(l2.master.filter(m => m.formula_nome).every(m => m.email === `teste.e1.${sufixo}@exemplo.com`), "MASTERLIST: a coluna EMAIL (fórmula) reflete o e-mail novo");
ok(l2.master.find(m => !m.formula_nome).nome === textoFixoAntes && l2.digesto_constantes === base0.digesto_constantes && l2.digesto_formulas === base0.digesto_formulas, "MASTERLIST: texto fixo e demais células seguem iguais");

passo("4. Versão antiga não sobrescreve a nova");
const antiga = await deps.planilha(URL_PLANILHA, { acao: "atualizar_cadastro", token: TOKEN, id_site: idTeste, twitter: "@" + ARROBA, nome: "Nome Velho", email: "velho@exemplo.com", versao: 1, campos: ["nome"] });
ok(antiga.json?.ignorado === "versao_antiga", "o Apps Script de teste ignorou a versão antiga");

passo("5. Falha que exige intervenção: cadastro fictício SEM linha na cópia");
await como("authenticated", CONTA2, "select public.salvar_meu_cadastro('Teste E1 Ausente')");
await processarFila(deps); const ta = (await lista()).find(x => x.joiner_id === idAusente);
const l5 = await acaoTeste("e1_ler");
ok(l5.digesto_constantes === base0.digesto_constantes && l5.dados.length === 1, "a falha do cadastro ausente não gravou nada (MASTERLIST igual e nenhuma linha nova para ele)");
ok(ta?.planilha_status === "atencao" && ta.planilha_motivo === "linha_nao_encontrada" && ta.planilha_tentativas === 1, "'precisa de atenção' com motivo 'linha_nao_encontrada' já na 1ª tentativa, e nada foi gravado na cópia");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTESTE REAL CONCLUÍDO: tudo conferido automaticamente (Dados, MASTERLIST, texto fixo e digest); olhe também a planilha de teste");
await d.close();
process.exitCode = falhas ? 1 : 0;
