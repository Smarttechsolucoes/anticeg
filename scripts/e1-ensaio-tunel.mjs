// ENSAIO do acionador por horário SEM Supabase de teste: a perfil-sync REAL roda no seu computador com um banco FICTÍCIO (PGlite) e é exposta por um túnel temporário do cloudflared
// SÓ na rota POST /perfil-sync, e só responde a quem tem o segredo exclusivo deste ensaio (gerado agora e copiado para a área de transferência; não é impresso).
// O acionador de 1 minuto do Apps Script da planilha de TESTE chama o túnel. O script NÃO processa a fila: ele cria a alteração e ESPERA o disparo por horário.
// Mostra pendente -> sincronizada, confere Dados/MASTERLIST/texto fixo, desliga o túnel e REMOVE o acionador de teste (confirmando 0 acionadores).
// O banco, o admin e qualquer outra rota NÃO ficam no túnel (qualquer outro caminho/método responde 404).
// Variáveis (digite nos prompts): E1_CONFIRMO_ENSAIO=1, E1_PLANILHA_URL, E1_PLANILHA_TOKEN; E1_CLOUDFLARED (caminho do executável); opcionais: E1_ESPERA_MIN (padrão 10).
import { PGlite } from "@electric-sql/pglite";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { tratarPerfilSync } from "../supabase/functions/_shared/perfilsync.ts";

const env = n => process.env[n] || "";
const URL_PLANILHA = env("E1_PLANILHA_URL"), TOKEN = env("E1_PLANILHA_TOKEN"), ARROBA = "teste_e1";
const ESPERA_MS = Number(env("E1_ESPERA_MIN") || 10) * 60000;
const sair = async c => { process.exitCode = c; await new Promise(r => setTimeout(r, 400)); process.exit(c); };   // espera as conexões fecharem (evita o erro do libuv no Windows)
const recusar = async m => { console.error("Recusado: " + m); await sair(2); };
if (env("E1_CONFIRMO_ENSAIO") !== "1") await recusar("defina E1_CONFIRMO_ENSAIO=1 para confirmar que a planilha é a de TESTE e que o ensaio é com dados fictícios.");
if (!URL_PLANILHA || !TOKEN) await recusar("faltam E1_PLANILHA_URL e E1_PLANILHA_TOKEN (da implantação de TESTE).");
if (env("PLANILHA_URL") && env("PLANILHA_URL") === URL_PLANILHA) await recusar("E1_PLANILHA_URL é igual à PLANILHA_URL de produção.");

let falhas = 0; const ok = (c, m) => { console.log((c ? "  OK   " : "  FALHA ") + m); if (!c) falhas++; };
const passo = t => console.log("\n▶ " + t);
const hora = () => new Date().toTimeString().slice(0, 8);
const dormir = ms => new Promise(r => setTimeout(r, ms));

// ---- 0) ANTES de abrir banco ou túnel: confirmar que a URL é a da planilha de TESTE e que está no estado inicial
let diag = null;
const acaoTeste = async (acao, extra = {}, tentativa = 1) => {
  const r = await fetch(URL_PLANILHA, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ acao, token: TOKEN, twitter: "@" + ARROBA, ...extra }) });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* não é JSON */ }
  diag = { acao, status: r.status, json: !!json, erro: typeof json?.erro === "string" ? json.erro.slice(0, 160) : null };
  if (json?.ocupado === true && tentativa < 6) { console.log("   (planilha de teste ocupada; aguardando 10 s e tentando de novo " + tentativa + "/5)"); await dormir(10000); return acaoTeste(acao, extra, tentativa + 1); }
  return json;
};
const dica = () => {
  if (!diag) return "";
  if (!diag.json) return "
→ Provável: a URL não é a de uma implantação /exec com acesso \"Qualquer pessoa\" (o Google devolveu uma página).";
  if (/token/i.test(diag.erro ?? "")) return "
→ Provável: o token digitado não é o ANTICEG_TOKEN do projeto desta URL.";
  if (/a[cç][aã]o inv/i.test(diag.erro ?? "")) return "
→ Provável: a implantação é de uma versão ANTIGA do código. Implantar › Gerenciar implantações › lápis › Nova versão › Implantar (não use \"Nova implantação\": ela muda a URL).";
  if (/n[aã]o [eé] a planilha de teste|indispon/i.test(diag.erro ?? "")) return "
→ Provável: esta URL é de OUTRO projeto/planilha, onde prepararPlanilhaTeste não foi executada (faltam E1_PLANILHA_TESTE e E1_PLANILHA_ID em Propriedades do script). Use a URL da implantação da planilha de teste original, ou rode prepararPlanilhaTeste na planilha nova e vazia.";
  return "";
};
console.log("ENSAIO DO ACIONADOR POR HORÁRIO (perfil-sync real + banco fictício local + túnel temporário + planilha de TESTE)");
passo("0. Confirmar a planilha de TESTE e o estado inicial");
const ident = await acaoTeste("e1_identificar");
const ehTeste = ident?.ok === true && ident.teste === true && ident.abas?.length === 2 && /^TESTE E1/.test(ident.nome ?? "");
ok(ehTeste, "o Apps Script confirma: planilha de teste E1, só com Dados e MASTERLIST");
if (!ehTeste) { console.error("\nRECUSADO: o endereço informado NÃO é a planilha de teste. Nada foi gravado." + (diag ? "\nDiagnóstico: ação " + diag.acao + " → HTTP " + diag.status + (diag.json ? ", JSON" : ", resposta que NÃO é JSON") + (diag.erro ? ", erro: “" + diag.erro + "”" : "") : "") + dica()); await sair(2); }
const base0 = await acaoTeste("e1_ler");
if (!base0?.ok || base0.dados.length !== 1 || base0.dados[0].versao !== "") { console.error("\nA planilha de teste não está no estado inicial. Rode reiniciarDadosTeste() no Apps Script dela e repita. Nada foi gravado."); await sair(2); }
const textoFixoAntes = base0.master.find(m => !m.formula_nome)?.nome;
ok(base0.master.length === 3 && textoFixoAntes === "Nome Fixo Digitado", "estado inicial da planilha: 2 linhas com fórmula e 1 de texto fixo");
const g0 = await acaoTeste("e1_gatilho_fila");
if (g0?.ok !== true) { console.error("\nO Apps Script de teste não conhece a ação e1_gatilho_fila: cole o Codigo.gs NOVO, salve e crie uma NOVA VERSÃO da implantação (Implantar › Gerenciar implantações › lápis › Nova versão). Nada foi gravado."); await sair(2); }
console.log(`   (acionadores de teste existentes agora: ${g0.gatilhos_antes})`);

// ---- 1) banco FICTÍCIO local (mesma base que o laboratório testa)
const R = new URL("../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const arq = f => readFileSync(R + f, "utf8").replace(/\r/g, "");
const fatia = (txt, inicio, fim = "\nend $$;") => { const i = txt.indexOf(inicio); if (i < 0) throw new Error("não achei: " + inicio); return txt.slice(i, txt.indexOf(fim, i) + fim.length); };
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
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

let cadeia = Promise.resolve();   // todas as operações do banco em fila (um único cliente local): evita misturar papéis entre o servidor e o acompanhamento
const serial = fn => { const p = cadeia.then(fn, fn); cadeia = p.catch(() => {}); return p; };
const q = (sql, p = []) => serial(async () => (await d.query(sql, p)).rows);
const como = (papel, uid, sql, p = [], admin = false) => serial(async () => {
  await d.exec(`select set_config('lab.uid', '${uid || ""}', false), set_config('lab.admin', '${admin ? 1 : 0}', false); set role ${papel}`);
  try { return { rows: (await d.query(sql, p)).rows }; } catch (e) { return { erro: String(e.message) }; } finally { await d.exec("reset role; select set_config('lab.uid', '', false), set_config('lab.admin', '0', false)"); }
});
const ADM = U(1), CONTA = U(2);
await q("insert into auth.users values ($1,'admin@exemplo.com',now()), ($2,'teste.e1@exemplo.com',now())", [ADM, CONTA]);
const [{ id: idTeste }] = await q("insert into public.joiners (cog, nome, nome_site, email, twitter) values ($1,'Teste E1 Antigo','T','teste.e1@exemplo.com',$2) returning id", [ARROBA, "@" + ARROBA]);
await q("insert into emergencia.emails_confiaveis values ($1, emergencia.h('teste.e1@exemplo.com'), emergencia.h_arroba($2), now(), 'ensaio')", [idTeste, "@" + ARROBA]);
await q("insert into public.contas_joiner (user_id, joiner_id, perfil_concluido_em) values ($1,$2,now())", [CONTA, idTeste]);
const lista = async () => (await como("authenticated", ADM, "select * from public.admin_cadastro_tarefas(50)", [], true)).rows;

// ---- 2) a perfil-sync REAL, com segredo exclusivo deste ensaio
const SEGREDO = (env("E1_SEGREDO").length >= 24 ? env("E1_SEGREDO") : randomBytes(32).toString("hex"));
const deps = {
  env: n => ({ PERFIL_SYNC_SEGREDO: SEGREDO, PLANILHA_URL: URL_PLANILHA, PLANILHA_TOKEN: TOKEN }[n]),
  resolverToken: async () => ({ admin: false, cog: null }),   // qualquer chamada SEM o segredo cai aqui e é recusada (403)
  proximos: async lim => (await como("service_role", null, "select * from public.perfil_sync_proximos($1)", [lim])).rows,
  marcar: async (id, ok2, erro, def) => { await como("service_role", null, "select public.perfil_sync_marcar($1,$2,$3,$4)", [id, ok2, erro, def === true]); },
  estado: async t => (await como("service_role", null, "select public.perfil_sync_estado($1) e", [t])).rows[0]?.e ?? null,
  planilha: async (u, corpo) => {
    const r = await fetch(u, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(corpo) });
    let json = null; try { json = JSON.parse(await r.text()); } catch { /* resposta ilegível */ }
    return { status: r.status, json };
  },
};
const disparos = [];   // só o que é seguro mostrar: hora, status e contagens
let fila = Promise.resolve();
const servidor = http.createServer((req, res) => {
  const fim = (codigo, corpo = "{}") => { res.writeHead(codigo, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(corpo); };
  if (!(req.method === "POST" && req.url === "/perfil-sync")) { req.resume(); return fim(404); }   // ÚNICA rota exposta
  const partes = []; let tam = 0, grande = false;
  req.on("data", c => { tam += c.length; if (tam > 4096) grande = true; else partes.push(c); });
  req.on("end", () => {
    if (grande) return fim(413);
    fila = fila.then(async () => {
      const cab = new Headers(); for (const k of ["x-cron-secret", "authorization", "content-type"]) if (req.headers[k]) cab.set(k, String(req.headers[k]));
      const r = await tratarPerfilSync(new Request("http://local/perfil-sync", { method: "POST", headers: cab, body: Buffer.concat(partes) }), deps);
      const corpo = await r.text(); let cont = null; try { cont = JSON.parse(corpo); } catch { /* sem contagens */ }
      const reg = { quando: Date.now(), hora: hora(), status: r.status, lidos: cont?.lidos, enviados: cont?.enviados, falharam: cont?.falharam }; disparos.push(reg);
      console.log(`   [${reg.hora}] disparo recebido → HTTP ${r.status}` + (r.status === 200 ? ` (lidos ${cont?.lidos}, enviados ${cont?.enviados}, falharam ${cont?.falharam})` : " (recusado)"));
      fim(r.status, corpo);
    }).catch(() => fim(500));
  });
});
await new Promise(r => servidor.listen(0, "127.0.0.1", r));
const porta = servidor.address().port;

// ---- 3) túnel temporário (só encaminha para a porta local acima, que só serve POST /perfil-sync)
let tunel = null, urlTunel = "";
const matarTunel = () => { if (tunel?.pid) { try { process.platform === "win32" ? spawnSync("taskkill", ["/PID", String(tunel.pid), "/T", "/F"]) : tunel.kill("SIGTERM"); } catch { /* já encerrado */ } } tunel = null; };
let encerrando = false;
const encerrar = async codigo => {
  if (encerrando) return; encerrando = true;
  passo("Encerramento: desligar o túnel e remover o acionador de teste");
  { const rec = disparos.filter(x => x.status !== 200).length; console.log(`   chamadas recusadas durante o ensaio: ${rec}` + (rec ? " (alguém sem o segredo tentou; foram barradas com 403)" : "")); }
  const urlParaConferir = urlTunel;
  matarTunel(); servidor.closeAllConnections?.();
  if (urlParaConferir) {
    await dormir(2500);
    // o servidor local ainda está de pé neste ponto: se o túnel continuasse ligado, esta chamada chegaria a ele e voltaria o 403 dele (JSON "somente a administração"); desligado, o Cloudflare responde erro (530/1033) ou nada
    let respondeu = false; try { const r = await fetch(urlParaConferir + "/perfil-sync", { method: "POST", headers: { "x-cron-secret": "x" }, signal: AbortSignal.timeout(8000) }); respondeu = r.status === 403 && /somente a administra/.test(await r.text()); } catch { /* sem resposta = desligado */ }
    ok(!respondeu, "túnel desligado: o endereço público não responde mais");
  } else console.log("   (túnel não chegou a ser aberto)");
  let rem = null; for (let i = 0; i < 3 && !rem?.ok; i++) { rem = await acaoTeste("e1_gatilho_fila", { remover: true }).catch(() => null); if (!rem?.ok) await dormir(5000); }
  ok(rem?.ok === true && rem.gatilhos_depois === 0, rem?.ok ? `acionador de teste REMOVIDO (havia ${rem.gatilhos_antes}, agora ${rem.gatilhos_depois})` : "NÃO consegui remover o acionador: execute removerGatilhoFilaPerfil() no Apps Script de teste e confira em Acionadores");
  await new Promise(r => servidor.close(() => r())).catch(() => {}); await d.close().catch(() => {});
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nENSAIO CONCLUÍDO: um disparo por horário levou a tarefa de 'pendente' a 'sincronizada', sem clique no admin; a planilha refletiu; túnel desligado; acionador removido.");
  await sair(falhas ? 1 : codigo);
};
process.on("SIGINT", () => { console.log("\n(interrompido: encerrando com segurança)"); falhas++; encerrar(1); });

try {
  passo("1. Abrir o túnel temporário (só a rota POST /perfil-sync)");
  const cmd = env("E1_CLOUDFLARED") || "cloudflared";
  const argv = env("E1_TUNEL_FAKE") ? [env("E1_TUNEL_FAKE"), "--url", `http://127.0.0.1:${porta}`] : ["tunnel", "--url", `http://127.0.0.1:${porta}`, "--no-autoupdate"];
  tunel = spawn(env("E1_TUNEL_FAKE") ? process.execPath : cmd, argv, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: env("E1_TUNEL_FAKE") ? { ...process.env, E1_SEGREDO: SEGREDO } : { ...process.env, E1_SEGREDO: "" } });
  tunel.on("error", e => { console.error("Não consegui iniciar o túnel: " + e.message); });
  const achou = new Promise(res => { const ler = c => { const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(String(c)); if (m) res(m[0]); }; tunel.stdout.on("data", ler); tunel.stderr.on("data", ler); tunel.on("exit", () => res("")); });
  urlTunel = await Promise.race([achou, dormir(60000).then(() => "")]);
  console.log(`   (o túnel encaminha SÓ para 127.0.0.1:${porta}, que serve apenas POST /perfil-sync; qualquer outro caminho responde 404)`);
  ok(!!urlTunel, "túnel aberto" + (urlTunel ? "" : " (o cloudflared não devolveu o endereço em 60 s)"));
  if (!urlTunel) throw new Error("sem túnel");

  passo("2. FAÇA AGORA no Apps Script da planilha de TESTE (≈2 min)");
  const copiou = spawnSync("clip", { input: SEGREDO, windowsHide: true }).status === 0;
  console.log("   Configurações do projeto › Propriedades do script › crie/edite estas 3 propriedades:");
  console.log(`     PERFIL_SYNC_URL      = ${urlTunel}/perfil-sync`);
  console.log("     SUPABASE_ANON_KEY    = ensaio            (qualquer texto; este servidor ignora)");
  console.log("     PERFIL_SYNC_SEGREDO  = " + (copiou ? "(já copiado para a sua área de transferência: cole com Ctrl+V)" : SEGREDO));
  console.log("   Depois, no editor, execute a função  instalarGatilhoFilaPerfil  (autorize se pedir). O disparo é de 1 em 1 minuto.");
  console.log(`   Aguardando o 1º disparo por horário (limite ${ESPERA_MS / 60000} min)...`);
  const inicioEspera = Date.now();
  while (!disparos.some(x => x.status === 200) && Date.now() - inicioEspera < ESPERA_MS) await dormir(1000);
  const primeiro = disparos.find(x => x.status === 200);
  ok(!!primeiro, "o acionador por horário do Apps Script chegou ao túnel com o segredo correto (1º disparo, fila vazia: lidos " + (primeiro?.lidos ?? "?") + ")");
  if (!primeiro) throw new Error("nenhum disparo recebido");

  passo("3. A joiner fictícia salva o nome (caminho real do site: salvar_meu_cadastro)");
  const nomeNovo = `Teste E1 ${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
  const t0 = Date.now(), nDisparosAntes = disparos.length;
  const r1 = (await como("authenticated", CONTA, "select public.salvar_meu_cadastro($1) r", [nomeNovo])).rows[0].r;
  ok(r1.ok === true && r1.nome === nomeNovo, "o banco confirmou a gravação e devolveu o valor gravado");
  let t = (await lista()).find(x => x.joiner_id === idTeste);
  ok(t?.planilha_status === "pendente" && !t.lida_em, `[${hora()}] tarefa em Atualizações: planilha 'PENDENTE' (aguardando o próximo disparo por horário)`);

  passo("4. Esperar o próximo disparo por horário (sem clique no admin; este script não processa a fila)");
  let ultimo = t.planilha_status;
  while (Date.now() - t0 < ESPERA_MS) {
    await dormir(2000); t = (await lista()).find(x => x.joiner_id === idTeste);
    if (t.planilha_status !== ultimo) { ultimo = t.planilha_status; console.log(`   [${hora()}] +${Math.round((Date.now() - t0) / 1000)}s  estado da tarefa: ${t.planilha_status}`); }
    if (t.planilha_status === "sincronizada" || t.planilha_status === "atencao") break;
  }
  const segundos = Math.round((Date.now() - t0) / 1000);
  ok(t.planilha_status === "sincronizada", `a tarefa saiu de 'pendente' para 'SINCRONIZADA' sozinha, ~${segundos}s depois` + (t.planilha_status === "atencao" ? ` (parou em 'atenção': ${t.planilha_motivo})` : ""));
  const quemProcessou = disparos.slice(nDisparosAntes).find(x => x.status === 200 && x.enviados >= 1);
  ok(!!quemProcessou, `quem enviou à planilha foi o disparo por horário das ${quemProcessou?.hora ?? "?"} (enviados ${quemProcessou?.enviados ?? 0})`);

  passo("5. Dados e MASTERLIST na planilha de teste");
  const lerAte = async cond => { let r; for (let i = 0; i < 11; i++) { r = await acaoTeste("e1_ler"); if (r?.ok && cond(r)) return r; if (i < 10) await dormir(3000); } return r; };
  const depois = await lerAte(r => (r.master ?? []).filter(m => m.formula_nome).every(m => m.nome === nomeNovo));
  ok(depois.dados?.[0]?.nome === nomeNovo && String(depois.dados[0].id_site) === String(idTeste) && depois.dados[0].papel === "principal", "Dados: B = nome novo, D = ID_SITE, E = principal");
  const comFormula = (depois.master ?? []).filter(m => m.formula_nome), fixa = (depois.master ?? []).find(m => !m.formula_nome);
  ok(comFormula.length === 2 && comFormula.every(m => m.nome === nomeNovo), "MASTERLIST: as 2 linhas com fórmula mostram o nome novo");
  ok(fixa?.nome === textoFixoAntes, "MASTERLIST: a linha de TEXTO FIXO continua igual");
  ok(depois.digesto_constantes === base0.digesto_constantes && depois.digesto_formulas === base0.digesto_formulas, "MASTERLIST: nenhuma célula digitada e nenhuma fórmula mudou (digest da planilha inteira)");
} catch (e) {
  console.error("\nInterrompido: " + String(e.message).slice(0, 200)); falhas++;
}
await encerrar(0);
