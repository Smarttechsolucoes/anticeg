// DEMONSTRAÇÃO DE PONTA A PONTA da etapa 1 (tudo SIMULADO e FICTÍCIO; nada toca em produção, na planilha real nem na rede):
//   a joiner salva o nome -> o banco confirma -> nasce UMA tarefa em Atualizações -> a função perfil-sync (código REAL) envia -> o Apps Script (código REAL) atualiza Dados!B/C
//   -> as linhas da MASTERLIST com fórmula refletem; as de texto fixo não mudam. Depois: falhas, retentativas na MESMA tarefa e falha que volta como pendência.
// Usa: banco PGlite com J1d/J4c1/J6 reais + E1; perfil-sync (supabase/functions/_shared/perfilsync.ts); appsscript/PAGAMENTO-AUTOMATICO.gs numa planilha em memória com as fórmulas reais (VLOOKUP).
// Uso: npm i --no-save @electric-sql/pglite && node tests/cadastro-etapa1-ponta-a-ponta.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { processarFila, tratarPerfilSync } from "../supabase/functions/_shared/perfilsync.ts";

const R = new URL("../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const arq = f => readFileSync(R + f, "utf8").replace(/\r/g, "");
// Apps Script = esqueleto do doPost de 07/11 (ou o script real, com APPS_SCRIPT_ATUAL=<caminho>) + as duas edições de appsscript/ATUALIZAR_CADASTRO.md + o pedaço ATUALIZAR_CADASTRO.gs
const lerTxt = u => readFileSync(u, "utf8").split("\r\n").join("\n");
const baseTxt = process.env.APPS_SCRIPT_ATUAL ? lerTxt(process.env.APPS_SCRIPT_ATUAL) : lerTxt(new URL("./fixtures/doPost-esqueleto.gs", import.meta.url));
const gs = baseTxt.replace('"atualizar_joiner",\n      "recebido",', '"atualizar_joiner",\n      "atualizar_cadastro",\n      "recebido",')
  .replace('    const sheet = spreadsheet.getSheetByName("MASTERLIST");', '    if (payload.acao === "atualizar_cadastro") {\n      return resposta(atualizarCadastro_(spreadsheet, payload, gravar));\n    }\n\n    const sheet = spreadsheet.getSheetByName("MASTERLIST");')
  + "\n" + lerTxt(new URL("../appsscript/ATUALIZAR_CADASTRO.gs", import.meta.url));
const fatia = (txt, inicio, fim = "\nend $$;") => { const i = txt.indexOf(inicio); if (i < 0) throw new Error("não achei: " + inicio); return txt.slice(i, txt.indexOf(fim, i) + fim.length); };
let falhas = 0; const ok = (c, m) => { console.log((c ? "  OK   " : "  FALHA ") + m); if (!c) falhas++; };
const passo = t => console.log("\n▶ " + t);
process.on("uncaughtException", e => { console.log("ERRO:", String(e.stack || e.message).slice(0, 900)); process.exit(2); });
process.on("unhandledRejection", e => { console.log("ERRO:", String(e && e.stack || e).slice(0, 900)); process.exit(2); });
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

// ---------- banco
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
const ADM = U(1), ANA = U(2);
await q("insert into auth.users values ($1,'admin@exemplo.com',now()), ($2,'ana@exemplo.com',now())", [ADM, ANA]);
const [{ id: anaId }] = await q("insert into public.joiners (cog, nome, nome_site, email, twitter) values ('ana','Ana Antiga','Ana','ana@exemplo.com','@ana') returning id");
await q("insert into emergencia.emails_confiaveis values ($1, emergencia.h('ana@exemplo.com'), emergencia.h_arroba('@ana'), now(), 'lab')", [anaId]);
await q("insert into public.contas_joiner (user_id, joiner_id, perfil_concluido_em) values ($1,$2,now())", [ANA, anaId]);

// ---------- planilha simulada (Dados + MASTERLIST com as fórmulas reais) e Apps Script REAL
class Aba {
  constructor(nome, linhas, formulas = {}) { this.nome = nome; this.g = linhas.map(l => l.slice()); this.f = formulas; this.escritas = []; }
  getName() { return this.nome; } getLastRow() { return this.g.length; }
  getRange(r, c, nl = 1, nc = 1) { const a = this; return { getValues: () => Array.from({ length: nl }, (_, i) => Array.from({ length: nc }, (_, j) => a.g[r - 1 + i]?.[c - 1 + j] ?? "")), getValue: () => a.g[r - 1]?.[c - 1] ?? "", getFormula: () => a.f[`${r},${c}`] ?? "", setValue: v => { a.escritas.push([r, c, v]); (a.g[r - 1] ??= [])[c - 1] = v; }, getSheet: () => a }; }
}
const dados = new Aba("Dados", [["@", "NOME", "EMAIL", "ID_SITE", "PAPEL", "VERSAO"], ["@ana", "Ana Antiga", "ana@exemplo.com", "", "", ""], ["@outra", "Outra", "outra@exemplo.com", "", "", ""]]);
const mlLinhas = [["NUM", "ID", "STATUS", "CEG", "NOME", "@", ...Array(12).fill(""), "EMAIL"]], mlF = {};
[["@ana", false], ["@ana", false], ["@ana", "Nome Fixo Digitado"], ["@outra", false]].forEach(([tw, fixo]) => { const n = mlLinhas.length + 1; const r = Array(19).fill(""); r[5] = tw; if (fixo) r[4] = fixo; mlLinhas.push(r); if (!fixo) mlF[`${n},5`] = `=VLOOKUP(F${n},Dados!A:B,2,0)`; mlF[`${n},19`] = `=VLOOKUP(F${n},Dados!A:C,3,0)`; });
const master = new Aba("MASTERLIST", mlLinhas, mlF);
const procv = (chave, col) => { const l = dados.g.slice(1).find(r => String(r[0]).toLowerCase() === String(chave).toLowerCase()); return l ? l[col - 1] : "#N/A"; };
const vistaMaster = () => master.g.slice(1).map((r, i) => ({ tw: r[5], nome: master.f[`${i + 2},5`] ? procv(r[5], 2) : r[4], email: master.f[`${i + 2},19`] ? procv(r[5], 3) : r[18] }));
const TOKEN = "token-de-teste-0123456789", SEGREDO = "segredo-do-agendador-0123456789abcdef", ANON = "chave-anon-publica-ficticia"; let planilhaOcupada = false, chamadasPlanilha = 0;
const buscas = [], gatilhos = [];     // chamadas HTTP feitas pelo agendador (Apps Script) e gatilhos criados
const props = { ANTICEG_TOKEN: TOKEN, PERFIL_SYNC_URL: "https://projeto-ficticio.supabase.co/functions/v1/perfil-sync", SUPABASE_ANON_KEY: ANON, PERFIL_SYNC_SEGREDO: SEGREDO };
const sandbox = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty() {} }) },
  ScriptApp: { newTrigger: fn => ({ timeBased: () => ({ everyMinutes: n => ({ create: () => gatilhos.push([fn, n]) }) }) }), getProjectTriggers: () => [], deleteTrigger() {} },
  LockService: { getScriptLock: () => ({ waitLock: () => { if (planilhaOcupada) throw new Error("ocupada"); }, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ conteudo: s, setMimeType() { return this; } }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => ({ Dados: dados, MASTERLIST: master }[n] ?? null) }), flush() {} },
  UrlFetchApp: { fetch: (url, o) => { buscas.push({ url, o }); return { getResponseCode: () => 200, getContentText: () => "{}" }; } }, console: { log() {}, warn() {}, error() {} },
};
vm.createContext(sandbox); vm.runInContext(gs, sandbox); const doPost = vm.runInContext("doPost", sandbox);

// ---------- perfil-sync REAL ligado ao banco e à planilha simulada
const depsSync = {
  env: n => ({ PLANILHA_URL: "https://script.google.com/macros/s/FICTICIO/exec", PLANILHA_TOKEN: TOKEN, PERFIL_SYNC_SEGREDO: SEGREDO }[n]),
  resolverToken: async () => ({ admin: false, cog: null }),
  proximos: async lim => (await como("service_role", null, "select * from public.perfil_sync_proximos($1)", [lim])).rows,
  marcar: async (id, ok2, erro, def) => { await como("service_role", null, "select public.perfil_sync_marcar($1,$2,$3,$4)", [id, ok2, erro, def === true]); },
  estado: async t => (await como("service_role", null, "select public.perfil_sync_estado($1) e", [t])).rows[0]?.e ?? null,
  planilha: async (_u, corpo) => { chamadasPlanilha++; const s = doPost({ postData: { contents: JSON.stringify(corpo) } }); return { status: 200, json: JSON.parse(s.conteudo) }; },
};
const esperar = async () => { await d.exec("update public.perfil_sync_pendente set tentado_em = tentado_em - interval '1 day' where tentado_em is not null"); };   // pula a espera de retentativa (2, 4, 8 min...)
const lista = async () => (await como("authenticated", ADM, "select * from public.admin_cadastro_tarefas(50)", [], true)).rows;
const pend = async () => (await como("authenticated", ADM, "select public.admin_cadastro_pendentes() n", [], true)).rows[0].n;

console.log("DEMONSTRAÇÃO — etapa 1 do cadastro (dados fictícios)");

passo("1. A joiner (conta ativada) altera o NOME CADASTRAL e salva");
const r1 = (await como("authenticated", ANA, "select public.salvar_meu_cadastro('Ana Souza Lima') r")).rows[0].r;
console.log("   banco respondeu:", JSON.stringify(r1));
ok(r1.ok === true && r1.nome === "Ana Souza Lima", "o banco confirmou a gravação e devolveu o valor gravado → a tela pode dizer 'Salvo no site'");
ok((await q("select nome from public.joiners where cog='ana'"))[0].nome === "Ana Souza Lima", "joiners.nome tem o nome novo");

passo("2. Aparece UMA tarefa em Atualizações, não lida, com a planilha pendente");
let t = (await lista())[0];
console.log(`   tarefa #${t.id} @${t.cog}: ${JSON.stringify(t.campos)} · planilha=${t.planilha_status} · lida=${t.lida_em ? "sim" : "não"} · pendente=${t.pendente}`);
ok((await lista()).length === 1 && t.planilha_status === "pendente" && !t.lida_em && t.pendente && await pend() === 1, "1 tarefa, planilha 'pendente', não lida, conta 1 pendência no selo");
ok(vistaMaster().filter(x => x.tw === "@ana").map(x => x.nome).join("|") === "Ana Antiga|Ana Antiga|Nome Fixo Digitado", "a planilha AINDA mostra o nome antigo (a atualização ainda não foi enviada)");

passo("3. A função perfil-sync envia → Apps Script grava em Dados → MASTERLIST reflete pelas fórmulas");
const lote1 = await processarFila(depsSync);
console.log("   perfil-sync:", JSON.stringify(lote1));
ok(lote1.enviados === 1 && lote1.falharam === 0, "1 enviado, 0 falhas");
ok(dados.g[1][1] === "Ana Souza Lima" && dados.g[1][3] === anaId && dados.g[1][4] === "principal" && dados.g[1][5] === t.id, "Dados!B = nome novo; D=ID_SITE e E=principal preenchidos na 1ª vez; F=versão");
ok(vistaMaster().filter(x => x.tw === "@ana").map(x => x.nome).join("|") === "Ana Souza Lima|Ana Souza Lima|Nome Fixo Digitado", "MASTERLIST: as linhas com fórmula mostram o nome novo; a de TEXTO FIXO não muda");
ok(master.escritas.length === 0 && master.f["2,5"] === "=VLOOKUP(F2,Dados!A:B,2,0)", "nenhuma escrita na MASTERLIST; fórmulas intactas");
t = (await lista())[0];
ok(t.planilha_status === "sincronizada" && t.planilha_tentativas === 1 && !t.lida_em && t.pendente, "tarefa 'sincronizada' MAS continua não lida (os dois estados são separados)");
await como("authenticated", ADM, "select public.admin_cadastro_marcar_lida($1)", [t.id], true);
ok(await pend() === 0 && (await lista())[0].planilha_status === "sincronizada", "a administradora lê: sem pendência, planilha continua 'sincronizada'");

passo("4. Planilha ocupada: a MESMA tarefa é retentada e só 'precisa de atenção' depois de esgotar");
await como("authenticated", ANA, "select public.salvar_meu_cadastro('Ana Souza')");
const t2 = (await lista()).find(x => x.id !== t.id);
await como("authenticated", ADM, "select public.admin_cadastro_marcar_lida($1)", [t2.id], true);
planilhaOcupada = true;
for (let i = 0; i < 2; i++) { await esperar(); await processarFila(depsSync); }
let a = (await lista()).find(x => x.id === t2.id);
console.log(`   depois de 2 envios com a planilha ocupada: planilha=${a.planilha_status}, tentativas=${a.planilha_tentativas}, tarefas=${(await lista()).length}`);
ok(a.planilha_status === "pendente" && a.planilha_tentativas === 2 && (await lista()).length === 2, "mesma tarefa, tentativas=2, continua 'pendente', sem tarefa nova");
planilhaOcupada = false; await esperar(); await processarFila(depsSync);
a = (await lista()).find(x => x.id === t2.id);
ok(a.planilha_status === "sincronizada" && a.planilha_tentativas === 3 && dados.g[1][1] === "Ana Souza", "planilha voltou: a mesma tarefa fecha como 'sincronizada' (tentativas=3) e Dados!B tem o nome novo");

passo("5. Falha que exige intervenção (linha de Dados apagada): volta como PENDÊNCIA mesmo já lida");
await como("authenticated", ANA, "select public.salvar_meu_cadastro('Ana S. Lima')");
const t3 = (await lista()).find(x => ![t.id, t2.id].includes(x.id));
await como("authenticated", ADM, "select public.admin_cadastro_marcar_lida($1)", [t3.id], true);
const linhaAna = dados.g.splice(1, 1)[0];                      // alguém apagou a linha da Ana em Dados
const antes = chamadasPlanilha; await esperar(); const lote3 = await processarFila(depsSync);
a = (await lista()).find(x => x.id === t3.id);
console.log(`   perfil-sync: ${JSON.stringify(lote3)} · planilha=${a.planilha_status} · motivo=${a.planilha_motivo}`);
ok(chamadasPlanilha === antes + 1 && a.planilha_status === "atencao" && a.planilha_motivo === "linha_nao_encontrada" && a.planilha_tentativas === 1, "falha DEFINITIVA na 1ª tentativa (sem insistir à toa): 'precisa de atenção', motivo 'linha_nao_encontrada'");
ok(a.lida_em && a.pendente && await pend() === 1, "a tarefa já estava lida e VOLTOU a contar como pendência (selo = 1)");
await como("authenticated", ADM, "select public.admin_cadastro_marcar_atencao_vista($1)", [t3.id], true);
ok(await pend() === 0 && (await lista()).find(x => x.id === t3.id).planilha_status === "atencao", "'vi a falha': sai da pendência, mas a planilha segue 'precisa de atenção'");
dados.g.splice(1, 0, linhaAna);                                 // a administradora corrige a planilha e manda reprocessar
await como("authenticated", ADM, "select public.admin_cadastro_reprocessar($1)", [t3.id], true);
await processarFila(depsSync);
a = (await lista()).find(x => x.id === t3.id);
ok(a.planilha_status === "sincronizada" && dados.g[1][1] === "Ana S. Lima" && (await lista()).length === 3, "reprocessar na MESMA tarefa: 'sincronizada' e Dados!B atualizado");

passo("6. E-mail novo confirmado pelo Auth → Dados!C → MASTERLIST!S");
await q("update auth.users set email = 'ana.nova@exemplo.com', email_confirmed_at = now() where id = $1", [ANA]);
const te = (await lista()).find(x => x.campos.email);
ok(te && te.origem === "conta_verificada" && te.planilha_status === "pendente", "a confirmação do e-mail no Auth gerou a tarefa (origem 'conta_verificada')");
await processarFila(depsSync);
ok(dados.g[1][2] === "ana.nova@exemplo.com" && vistaMaster().filter(x => x.tw === "@ana" && x.nome !== "Nome Fixo Digitado").every(x => x.email === "ana.nova@exemplo.com"), "Dados!C e a coluna S da MASTERLIST têm o e-mail novo");
ok((await lista()).find(x => x.id === te.id).planilha_status === "sincronizada", "tarefa do e-mail 'sincronizada'");

passo("7. Alteração antiga NÃO sobrescreve a nova (versão)");
const antiga = JSON.parse(doPost({ postData: { contents: JSON.stringify({ acao: "atualizar_cadastro", token: TOKEN, id_site: anaId, twitter: "@ana", nome: "Nome Velho", email: "x@x.com", versao: 1, campos: ["nome"] }) } }).conteudo);
ok(antiga.ignorado === "versao_antiga" && dados.g[1][1] === "Ana S. Lima", "envio com versão antiga é ignorado; Dados mantém o nome mais novo");

passo("8. Fila processada SEM clicar no botão do admin: o gatilho por tempo do Apps Script chama a função com o segredo");
await como("authenticated", ANA, "select public.salvar_meu_cadastro('Ana Sem Botao')");
const t8 = (await lista()).find(x => x.campos.nome?.para === "Ana Sem Botao");
ok(t8 && t8.planilha_status === "pendente" && dados.g[1][1] === "Ana S. Lima", "nova alteração fica 'pendente' e a planilha ainda não mudou (ninguém clicou em nada)");
vm.runInContext("instalarGatilhoFilaPerfil()", sandbox);
ok(gatilhos.length === 1 && gatilhos[0][0] === "rodarFilaPerfil_" && gatilhos[0][1] === 1, "instalarGatilhoFilaPerfil cria UM gatilho por tempo, a cada 1 minuto (só roda se alguém executar)");
vm.runInContext("rodarFilaPerfil_()", sandbox);                                  // o que o gatilho faz a cada minuto
const b = buscas[0];
ok(buscas.length === 1 && b.url === props.PERFIL_SYNC_URL && b.o.headers["x-cron-secret"] === SEGREDO && b.o.headers.Authorization === "Bearer " + ANON, "o gatilho chama a função com a chave PÚBLICA e o segredo próprio (nenhum login de administradora)");
const resp = await tratarPerfilSync(new Request(b.url, { method: "POST", headers: b.o.headers, body: b.o.payload }), depsSync);   // o handler REAL do perfil-sync
const corpo8 = await resp.json();
console.log("   perfil-sync respondeu:", resp.status, JSON.stringify(corpo8));
ok(resp.status === 200 && corpo8.enviados === 1, "a função aceitou o segredo e processou a fila: 1 enviado");
ok(dados.g[1][1] === "Ana Sem Botao" && vistaMaster().filter(x => x.tw === "@ana").map(x => x.nome).join("|") === "Ana Sem Botao|Ana Sem Botao|Nome Fixo Digitado", "Dados!B e a MASTERLIST (por fórmula) já mostram o nome novo, sem botão");
ok((await lista()).find(x => x.id === t8.id).planilha_status === "sincronizada", "a tarefa ficou 'sincronizada' sozinha");
const semSegredo = await tratarPerfilSync(new Request(b.url, { method: "POST", headers: { Authorization: "Bearer " + ANON, "x-cron-secret": "errado" }, body: "{}" }), depsSync);
ok(semSegredo.status === 403 && !JSON.stringify(buscas).includes("errado"), "com segredo errado a função recusa (403)");

passo("9. Nada do que importa foi tocado");
ok((await q("select cog from public.joiners where id = $1", [anaId]))[0].cog === "ana" && master.escritas.length === 0, "cog intacto e zero escritas na MASTERLIST durante toda a demonstração");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nDEMONSTRAÇÃO CONCLUÍDA: TODOS OS PASSOS PASSARAM");
process.exit(falhas ? 1 : 0);
