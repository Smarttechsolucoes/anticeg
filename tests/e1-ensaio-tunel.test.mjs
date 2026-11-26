// Ensaio do SCRIPT do ensaio por túnel (scripts/e1-ensaio-tunel.mjs): túnel FALSO, planilha EM MEMÓRIA e um "relógio" que dispara o acionador de horário
// executando o rodarFilaPerfil_ de verdade (o UrlFetchApp simulado só repassa a chamada ao servidor local do ensaio). Nada sai da máquina.
// Uso: node tests/e1-ensaio-tunel.test.mjs
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { novaPlanilha, montarSandbox, servir } from "./lib/planilha-simulada.mjs";

let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const dormir = ms => new Promise(r => setTimeout(r, ms));
const tmp = mkdtempSync(join(tmpdir(), "e1t-"));
const saida = join(tmp, "Codigo.gs");
spawnSync(process.execPath, ["scripts/e1-montar-codigo-teste.mjs", new URL("./fixtures/doPost-esqueleto.gs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), saida], { cwd: raiz });
const codigo = readFileSync(saida, "utf8");
const SEGREDO = "segredo-so-do-ensaio-0123456789abcdef0123456789abcdef";
const vivo = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };

// planilha de teste preparada + web app simulado + "relógio do Google" que dispara o acionador (se ele estiver instalado)
const montar = () => {
  const planilha = novaPlanilha("ID-PLANILHA-TESTE-ab12"), props = {}; const cen = { planilha, props, porta: 0 };
  const sb = montarSandbox(codigo, planilha, props); cen.sb = sb;
  sb.UrlFetchApp = { fetch: (url, opc) => {   // o rodarFilaPerfil_ REAL chama isto; repassamos ao servidor local do ensaio (que está atrás do "túnel")
    fetch(`http://127.0.0.1:${cen.porta}${new URL(url).pathname}`, { method: "POST", headers: opc.headers, body: opc.payload }).catch(() => null);
    return { getResponseCode: () => 200, getContentText: () => "" };
  } };
  vm.runInContext("prepararPlanilhaTeste()", sb);
  const relogio = setInterval(() => { if (planilha.gatilhos.includes("rodarFilaPerfil_")) vm.runInContext("rodarFilaPerfil_()", sb); }, 1500);
  cen.parar = () => clearInterval(relogio);
  cen.configurarEInstalar = urlPublica => { props.PERFIL_SYNC_URL = urlPublica; props.SUPABASE_ANON_KEY = "ensaio"; props.PERFIL_SYNC_SEGREDO = SEGREDO; vm.runInContext("instalarGatilhoFilaPerfil()", sb); };
  return cen;
};
const rodarEnsaio = async (cen, { aoVer, extraEnv = {} } = {}) => {
  const { s, url } = await servir(cen.sb);
  const pidFile = join(tmp, "tunel-" + Math.random().toString(36).slice(2) + ".pid");
  const filho = spawn(process.execPath, ["scripts/e1-ensaio-tunel.mjs"], { cwd: raiz, env: { ...process.env, E1_CONFIRMO_ENSAIO: "1", E1_PLANILHA_URL: url, E1_PLANILHA_TOKEN: cen.props.ANTICEG_TOKEN, PLANILHA_URL: "", E1_SEGREDO: SEGREDO, E1_TUNEL_FAKE: join(raiz, "tests/lib/falso-tunel.mjs"), E1_FAKE_PID_FILE: pidFile, ...extraEnv } });
  let o = "", acionou = false;
  const ler = c => {
    o += c; const p = /127\.0\.0\.1:(\d+), que serve/.exec(o); if (p) cen.porta = Number(p[1]);
    const u = /PERFIL_SYNC_URL\s+= (\S+)/.exec(o); if (u && cen.porta && !acionou && aoVer) { acionou = true; aoVer(u[1]); }
  };
  filho.stdout.on("data", ler); filho.stderr.on("data", ler);
  const code = await new Promise(r => filho.on("close", r));
  cen.parar(); s.close();
  return { code, o, pidFile, url };
};

// ---- recusa sem confirmação
const semConf = await new Promise(r => { const f = spawn(process.execPath, ["scripts/e1-ensaio-tunel.mjs"], { cwd: raiz, env: { ...process.env, E1_CONFIRMO_ENSAIO: "", E1_PLANILHA_URL: "http://x/exec", E1_PLANILHA_TOKEN: "t" } }); let o = ""; f.stderr.on("data", d => (o += d)); f.on("close", code => r({ code, o })); });
ok(semConf.code === 2 && /E1_CONFIRMO_ENSAIO=1/.test(semConf.o), "sem confirmação o ensaio RECUSA");

// ---- caminho feliz
let c = montar();
const feliz = await rodarEnsaio(c, { aoVer: urlPublica => c.configurarEInstalar(urlPublica) });
console.log(feliz.o.split("\n").map(l => "   | " + l).join("\n"));
ok(feliz.code === 0 && /ENSAIO CONCLUÍDO/.test(feliz.o), "caminho feliz: o ensaio conclui");
ok(/'PENDENTE'/.test(feliz.o) && /'SINCRONIZADA' sozinha/.test(feliz.o), "mostra a tarefa saindo de PENDENTE para SINCRONIZADA por disparo de horário");
ok(/1º disparo, fila vazia: lidos 0/.test(feliz.o) && /quem enviou à planilha foi o disparo por horário/.test(feliz.o), "o 1º disparo encontra a fila vazia e um disparo seguinte envia");
ok(/MASTERLIST: as 2 linhas com fórmula mostram o nome novo/.test(feliz.o) && /TEXTO FIXO continua igual/.test(feliz.o) && /nenhuma fórmula mudou/.test(feliz.o), "Dados refletido na MASTERLIST, texto fixo e digest intactos");
ok(/túnel desligado/.test(feliz.o) && /acionador de teste REMOVIDO \(havia 1, agora 0\)/.test(feliz.o) && c.planilha.gatilhos.length === 0, "o túnel é desligado e o acionador de teste é removido (0 acionadores na planilha)");
ok(existsSync(feliz.pidFile) && !vivo(Number(readFileSync(feliz.pidFile, "utf8"))), "o processo do túnel não está mais vivo");
ok(![SEGREDO, c.props.ANTICEG_TOKEN, feliz.url].some(s => s && feliz.o.includes(s)), "a saída não imprime o segredo, o token nem a URL da planilha");
ok(/chamadas recusadas durante o ensaio: 0/.test(feliz.o), "nenhuma chamada recusada no caminho feliz");

// ---- só a rota certa responde
c = montar(); let r = {};
const sonda = await rodarEnsaio(c, { aoVer: async urlPublica => {
  const L = `http://127.0.0.1:${c.porta}`;
  const st = async (m, caminho, h = {}) => (await fetch(L + caminho, { method: m, headers: h, body: m === "POST" ? "{}" : undefined })).status;
  r = { raiz: await st("GET", "/"), admin: await st("POST", "/admin"), rest: await st("GET", "/rest/v1/joiners"), get: await st("GET", "/perfil-sync"), semSegredo: await st("POST", "/perfil-sync"), errado: await st("POST", "/perfil-sync", { "x-cron-secret": "a".repeat(40) }), curto: await st("POST", "/perfil-sync", { "x-cron-secret": "x" }) };
  c.configurarEInstalar(urlPublica);
} });
ok(r.raiz === 404 && r.admin === 404 && r.rest === 404 && r.get === 404, "qualquer outro caminho ou método responde 404 (banco e admin fora do túnel)");
ok(r.semSegredo === 403 && r.errado === 403 && r.curto === 403, "POST /perfil-sync sem segredo, com segredo errado ou curto: 403");
ok(/chamadas recusadas durante o ensaio: 3/.test(sonda.o) && sonda.code === 0, "as chamadas barradas aparecem na contagem (3) e o ensaio ainda conclui");

// ---- sem acionador: tempo esgotado
c = montar();
const lento = await rodarEnsaio(c, { extraEnv: { E1_ESPERA_MIN: "0.04" } });
ok(lento.code === 1 && /nenhum disparo recebido|FALHA o acionador por horário/.test(lento.o), "sem acionador instalado o ensaio FALHA por tempo esgotado");
ok(/túnel desligado/.test(lento.o) && /REMOVIDO \(havia 0, agora 0\)/.test(lento.o) && !vivo(Number(readFileSync(lento.pidFile, "utf8"))), "mesmo falhando, desliga o túnel e confere o acionador");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
