// ENSAIO do teste real (scripts/e1-teste-copia-planilha.mjs) SEM Google: o código que vai para o Apps Script de teste (montado por scripts/e1-montar-codigo-teste.mjs)
// roda de verdade (módulo vm) numa planilha EM MEMÓRIA, preparada pelo próprio prepararPlanilhaTeste(), atrás de um servidor HTTP local. Nada sai da máquina.
// Prova: a preparação recusa planilha com conteúdo; o script de teste recusa rodar sem confirmação, contra a URL de produção ou contra planilha que não seja a de teste;
// e, apontado para a planilha de teste, passa de ponta a ponta (Dados, MASTERLIST, texto fixo, digest).
// Uso: node tests/e1-teste-copia-dry-run.mjs            (usa o esqueleto do doPost)
//      APPS_SCRIPT_ATUAL=<caminho do .gs real> node tests/e1-teste-copia-dry-run.mjs
import http from "node:http";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// ---- 1) monta o código de teste com o MESMO montador que a dona vai usar
const entrada = process.env.APPS_SCRIPT_ATUAL || new URL("./fixtures/doPost-esqueleto.gs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const saida = join(mkdtempSync(join(tmpdir(), "e1-")), "Codigo.gs");
const montar = spawnSync(process.execPath, ["scripts/e1-montar-codigo-teste.mjs", entrada, saida], { cwd: raiz, encoding: "utf8" });
ok(montar.status === 0, "o montador gera o arquivo único (" + (process.env.APPS_SCRIPT_ATUAL ? "código REAL informado" : "esqueleto do doPost") + ")");
const codigo = readFileSync(saida, "utf8");

// ---- 2) planilha em memória com fórmulas (VLOOKUP) avaliadas na leitura
const norm = v => String(v ?? "").replace(/^\s*@+/, "").trim().toLowerCase();
class Aba {
  constructor(planilha, nome) { this.p = planilha; this.n = nome; this.g = []; this.f = {}; this.escritas = []; }
  getName() { return this.n; }
  getLastRow() { let m = 0; this.g.forEach((l, i) => { if (l?.some(x => x !== "" && x != null)) m = i + 1; }); return m; }
  getLastColumn() { let m = 0; this.g.forEach(l => (l || []).forEach((x, j) => { if (x !== "" && x != null) m = Math.max(m, j + 1); })); return m; }
  clear() { this.g = []; this.f = {}; return this; }
  avaliar(r, c) {
    const f = this.f[`${r},${c}`]; if (!f) return this.g[r - 1]?.[c - 1] ?? "";
    const pt = this.p.sep === ";";   // simula planilha em português: só entende ";" (com vírgula dá erro de análise)
    if (pt && f.includes(",")) return "#ERROR!";
    const m = /^=VLOOKUP\(F(\d+),Dados!A:([BC]),(\d),0\)$/.exec(pt ? f.replace(/;/g, ",") : f); if (!m) return "#ERROR!";
    const chave = String(this.g[Number(m[1]) - 1]?.[5] ?? "").toLowerCase(), dados = this.p.abas.Dados.g;
    const l = dados.find(x => String(x?.[0] ?? "").toLowerCase() === chave); return l ? (l[Number(m[3]) - 1] ?? "") : "#N/A";
  }
  getRange(r, c, nl = 1, nc = 1) {
    const a = this;
    const grade = fn => Array.from({ length: nl }, (_, i) => Array.from({ length: nc }, (_, j) => fn(r + i, c + j)));
    return {
      getValues: () => grade((x, y) => a.avaliar(x, y)), getDisplayValues: () => grade((x, y) => String(a.avaliar(x, y))),
      getDisplayValue: () => String(a.avaliar(r, c)), getFormulas: () => grade((x, y) => a.f[`${x},${y}`] ?? ""), getValue: () => a.avaliar(r, c), getFormula: () => a.f[`${r},${c}`] ?? "", getSheet: () => a,
      setValue: v => a.pôr(r, c, v), setFormula: f => a.pôr(r, c, f), setValues: m => m.forEach((l, i) => l.forEach((v, j) => a.pôr(r + i, c + j, v))),
    };
  }
  pôr(r, c, v) { this.escritas.push([r, c, v]); (this.g[r - 1] ??= [])[c - 1] = v; if (typeof v === "string" && v.startsWith("=")) this.f[`${r},${c}`] = v; else delete this.f[`${r},${c}`]; }
}
const novaPlanilha = (id, abas = ["Planilha1"], sep = ",") => {
  const p = { id, nome: "Planilha sem título", abas: {}, sep };
  abas.forEach(n => (p.abas[n] = new Aba(p, n)));
  p.ss = {
    getId: () => p.id, getName: () => p.nome, rename: n => { p.nome = n; }, getSheetByName: n => p.abas[n] ?? null, getSheets: () => Object.values(p.abas),
    insertSheet: n => (p.abas[n] = new Aba(p, n)), deleteSheet: s => { delete p.abas[s.getName()]; },
  };
  return p;
};
const montarSandbox = (planilha, props) => {
  const sandbox = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ conteudo: s, setMimeType() { return this; } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => planilha.ss, flush() {} }, UrlFetchApp: { fetch() { throw new Error("rede proibida"); } },
    Utilities: { DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" }, getUuid: () => crypto.randomUUID(), computeDigest: (_a, t) => [...createHash("sha256").update(t, "utf8").digest()].map(b => (b > 127 ? b - 256 : b)) },
    console: { log() {}, warn() {}, error() {} }, crypto,
  };
  vm.createContext(sandbox); vm.runInContext(codigo, sandbox); return sandbox;
};
const servir = async sandbox => {
  const doPost = vm.runInContext("doPost", sandbox);
  const s = http.createServer((req, res) => { let b = ""; req.on("data", c => (b += c)); req.on("end", () => { const r = doPost({ postData: { contents: b } }); res.writeHead(200, { "Content-Type": "application/json" }); res.end(r.conteudo); }); });
  await new Promise(r => s.listen(0, "127.0.0.1", r)); return { s, url: `http://127.0.0.1:${s.address().port}/exec` };
};
const rodar = env => new Promise(res => { const p = spawn(process.execPath, ["scripts/e1-teste-copia-planilha.mjs"], { env: { ...process.env, ...env }, cwd: raiz }); let o = ""; p.stdout.on("data", c => (o += c)); p.stderr.on("data", c => (o += c)); p.on("close", code => res({ code, o })); });

// ---- 3) a preparação: recusa planilha com conteúdo; prepara planilha vazia
const real = novaPlanilha("ID-PLANILHA-REAL-9999", ["Dados", "MASTERLIST", "Outra"]); real.abas.Dados.pôr(1, 1, "@"); real.abas.Dados.pôr(2, 1, "@alguem"); real.abas.Dados.escritas.length = 0;
const propsReal = { ANTICEG_TOKEN: "token-real" }; const sbReal = montarSandbox(real, propsReal);
let recusou = false; try { vm.runInContext("prepararPlanilhaTeste()", sbReal); } catch (e) { recusou = /RECUSADO/.test(String(e.message)); }
ok(recusou && real.abas.Dados.escritas.length === 0 && propsReal.E1_PLANILHA_TESTE === undefined, "prepararPlanilhaTeste() RECUSA uma planilha que já tem dados (nada é apagado nem marcado como teste)");
const recusouIdent = JSON.parse(vm.runInContext('doPost({ postData: { contents: JSON.stringify({ acao: "e1_identificar", token: "token-real" }) } }).conteudo', sbReal));
ok(recusouIdent.definitivo === true && /não é a planilha de teste/.test(recusouIdent.erro ?? ""), "mesmo com o código colado numa planilha real, e1_identificar/e1_ler não respondem");

const teste = novaPlanilha("ID-PLANILHA-TESTE-ab12", ["Planilha1"]); const props = {}; const sb = montarSandbox(teste, props);
vm.runInContext("prepararPlanilhaTeste()", sb);
ok(Object.keys(teste.abas).sort().join() === "Dados,MASTERLIST" && teste.nome.startsWith("TESTE E1") && props.E1_PLANILHA_TESTE === "1" && props.E1_PLANILHA_ID === teste.id && String(props.ANTICEG_TOKEN).length >= 40, "prepararPlanilhaTeste(): só as abas Dados e MASTERLIST, nome 'TESTE E1…', propriedades e token de teste criados");
const M = teste.abas.MASTERLIST;
ok(M.getRange(3, 5).getValue() === "NOME" && M.getRange(3, 6).getValue() === "@" && M.getRange(3, 19).getValue() === "EMAIL" && M.getRange(3, 2).getValue() === "ID", "MASTERLIST: cabeçalho na linha 3, com ID em B, NOME em E, @ em F, EMAIL em S");
ok(M.f["4,5"] === "=VLOOKUP(F4,Dados!A:B,2,0)" && M.f["4,19"] === "=VLOOKUP(F4,Dados!A:C,3,0)" && !M.f["6,5"] && M.getRange(6, 5).getValue() === "Nome Fixo Digitado", "MASTERLIST: fórmulas reais em E e S; uma linha com NOME em texto fixo");
ok(teste.abas.Dados.getRange(2, 1).getValue() === "@teste_e1" && M.getRange(4, 5).getValue() === "Teste E1 Antigo", "Dados e MASTERLIST fictícios (a fórmula já mostra o nome antigo)");

// ---- 3a) uma CÓPIA da planilha de teste (conteúdo igual, SEM as propriedades do script): a preparação a reconhece pela assinatura e a adota
const copia = novaPlanilha("ID-COPIA-DA-TESTE-cc77", []);
for (const [n, aba] of Object.entries(teste.abas)) { const nova = new Aba(copia, n); nova.g = JSON.parse(JSON.stringify(aba.g)); nova.f = { ...aba.f }; copia.abas[n] = nova; }
const propsCopia = { ANTICEG_TOKEN: "token-criado-a-mao-na-copia" }; const sbCopia = montarSandbox(copia, propsCopia);
const antesCopia = JSON.stringify(sbCopia && Object.values(copia.abas).map(a => a.g.length));
vm.runInContext("prepararPlanilhaTeste()", sbCopia);
ok(propsCopia.E1_PLANILHA_TESTE === "1" && propsCopia.E1_PLANILHA_ID === copia.id && propsCopia.ANTICEG_TOKEN === "token-criado-a-mao-na-copia", "numa CÓPIA da planilha de teste, a preparação adota a planilha (marca as propriedades) e preserva o token que já existia");
const imitacao = novaPlanilha("ID-IMITACAO-0001", ["Dados", "MASTERLIST"]); imitacao.abas.Dados.pôr(1, 1, "@"); imitacao.abas.Dados.pôr(2, 1, "@teste_e1"); imitacao.abas.MASTERLIST.pôr(1, 1, "Minha planilha real");
const propsImit = { ANTICEG_TOKEN: "x" }; const sbImit = montarSandbox(imitacao, propsImit); let negou = false;
try { vm.runInContext("prepararPlanilhaTeste()", sbImit); } catch (e) { negou = /RECUSADO/.test(String(e.message)); }
ok(negou && propsImit.E1_PLANILHA_TESTE === undefined, "uma planilha com conteúdo que NÃO tem a assinatura exata do teste continua RECUSADA (nada é adotado nem apagado)");

// ---- 3b) planilha EM PORTUGUÊS (só entende ";"): a preparação descobre o separador e a MASTERLIST não fica com erro
const ptb = novaPlanilha("ID-PLANILHA-TESTE-pt99", ["Planilha1"], ";"); const propsPt = {}; const sbPt = montarSandbox(ptb, propsPt);
vm.runInContext("prepararPlanilhaTeste()", sbPt);
const MP = ptb.abas.MASTERLIST;
ok(MP.f["4,5"] === "=VLOOKUP(F4;Dados!A:B;2;0)" && MP.f["4,19"] === "=VLOOKUP(F4;Dados!A:C;3;0)" && MP.getRange(4, 5).getValue() === "Teste E1 Antigo" && MP.getRange(7, 5).getValue() === "Fulana Fictícia", "planilha em português: a preparação regrava com ';' e a MASTERLIST mostra os nomes (sem #ERROR!)");
ok(!/#ERR/.test(MP.getRange(4, 19).getValue()) && MP.getRange(6, 5).getValue() === "Nome Fixo Digitado", "planilha em português: coluna EMAIL sem erro e texto fixo preservado");
const srvPt = await servir(sbPt);
const emPt = await rodar({ E1_PLANILHA_URL: srvPt.url, E1_PLANILHA_TOKEN: propsPt.ANTICEG_TOKEN, E1_CONFIRMO_COPIA: "1", PLANILHA_URL: "" });
ok(emPt.code === 0 && /TESTE REAL CONCLUÍDO/.test(emPt.o), "o teste real também passa de ponta a ponta na planilha em português");
srvPt.s.close();

// ---- 4) o script de teste
const { s, url } = await servir(sb); const TOKEN = props.ANTICEG_TOKEN;
const sem = await rodar({ E1_PLANILHA_URL: url, E1_PLANILHA_TOKEN: TOKEN, E1_CONFIRMO_COPIA: "" });
ok(sem.code === 2 && /E1_CONFIRMO_COPIA=1/.test(sem.o), "sem E1_CONFIRMO_COPIA=1 o script RECUSA");
const prod = await rodar({ E1_PLANILHA_URL: url, E1_PLANILHA_TOKEN: TOKEN, E1_CONFIRMO_COPIA: "1", PLANILHA_URL: url });
ok(prod.code === 2 && /igual à PLANILHA_URL de produção/.test(prod.o), "com a URL igual à de produção o script RECUSA");
ok(teste.abas.Dados.escritas.filter(e => e[0] > 4).length === 0 && teste.abas.Dados.getRange(2, 6).getValue() === "", "as recusas não gravaram nada");

const realSrv = await servir(sbReal);
const emReal = await rodar({ E1_PLANILHA_URL: realSrv.url, E1_PLANILHA_TOKEN: "token-real", E1_CONFIRMO_COPIA: "1", PLANILHA_URL: "" });
ok(emReal.code === 2 && /NÃO é a planilha de teste/.test(emReal.o) && real.abas.Dados.escritas.length === 0, "apontado para uma planilha que NÃO é a de teste, o script RECUSA e não grava nada");
ok(/Diagnóstico: ação e1_identificar/.test(emReal.o) && /prepararPlanilhaTeste não foi executada/.test(emReal.o), "a recusa explica a causa provável (planilha sem preparação)");
realSrv.s.close();
const tokenErrado = await rodar({ E1_PLANILHA_URL: url, E1_PLANILHA_TOKEN: "token-errado-xxxxxxxxxxxxxxxx", E1_CONFIRMO_COPIA: "1", PLANILHA_URL: "" });
ok(tokenErrado.code === 2 && /Diagnóstico/.test(tokenErrado.o) && /token/i.test(tokenErrado.o) && !tokenErrado.o.includes("token-errado-xxxxxxxxxxxxxxxx") && !tokenErrado.o.includes("127.0.0.1"), "com token errado a recusa explica a causa e não imprime o token nem a URL");
const htmlSrv = http.createServer((q, r) => { r.writeHead(200, { "Content-Type": "text/html" }); r.end("<html><body>Faça login para continuar</body></html>"); }); await new Promise(r => htmlSrv.listen(0, "127.0.0.1", r));
const html = await rodar({ E1_PLANILHA_URL: `http://127.0.0.1:${htmlSrv.address().port}/exec`, E1_PLANILHA_TOKEN: TOKEN, E1_CONFIRMO_COPIA: "1", PLANILHA_URL: "" });
ok(html.code === 2 && /NÃO é JSON/.test(html.o) && /Qualquer pessoa/.test(html.o) && !html.o.includes("127.0.0.1"), "se o Google devolver uma página (acesso não é 'Qualquer pessoa'), a recusa aponta essa causa");
htmlSrv.close();

const correto = await rodar({ E1_PLANILHA_URL: url, E1_PLANILHA_TOKEN: TOKEN, E1_CONFIRMO_COPIA: "1", PLANILHA_URL: "", E1_COPIA_SHEET_ID: teste.id });
console.log(correto.o.split("\n").map(l => "   | " + l).join("\n"));
ok(correto.code === 0 && /TESTE REAL CONCLUÍDO/.test(correto.o), "apontado para a planilha de teste, o script passa de ponta a ponta");
const D = teste.abas.Dados;
ok(D.getRange(2, 2).getValue().startsWith("Teste E1 ") && D.getRange(2, 4).getValue() > 0 && D.getRange(2, 5).getValue() === "principal" && /@exemplo\.com$/.test(D.getRange(2, 3).getValue()), "Dados em memória: nome, ID_SITE, principal e e-mail gravados na linha de teste");
ok(D.getRange(3, 2).getValue() === "Fulana Fictícia" && D.getRange(4, 2).getValue() === "Ciclana Fictícia", "as outras linhas fictícias de Dados não mudaram");
ok(M.getRange(6, 5).getValue() === "Nome Fixo Digitado" && M.getRange(4, 5).getValue().startsWith("Teste E1 ") && M.getRange(7, 5).getValue() === "Fulana Fictícia", "MASTERLIST em memória: fórmulas refletem, texto fixo e a outra pessoa intactos");
ok(!correto.o.includes(TOKEN) && !correto.o.includes("127.0.0.1"), "o script não imprime o token nem a URL");
const denovo = await rodar({ E1_PLANILHA_URL: url, E1_PLANILHA_TOKEN: TOKEN, E1_CONFIRMO_COPIA: "1", PLANILHA_URL: "" });
ok(denovo.code === 2 && /reiniciarDadosTeste/.test(denovo.o), "repetir sem reiniciar é recusado, com a instrução de reiniciar");
vm.runInContext("reiniciarDadosTeste()", sb);
ok(D.getRange(2, 2).getValue() === "Teste E1 Antigo" && D.getRange(2, 6).getValue() === "", "reiniciarDadosTeste() devolve os dados ao estado inicial");
// ---- 5) o código de PRODUÇÃO (montador --producao): sem nada de teste, e o web app recusa as ações de teste
const saidaProd = join(mkdtempSync(join(tmpdir(), "e1p-")), "Producao.gs");
const mp = spawnSync(process.execPath, ["scripts/e1-montar-codigo-teste.mjs", "--producao", entrada, saidaProd], { cwd: raiz, encoding: "utf8" });
const codigoProd = readFileSync(saidaProd, "utf8");
ok(mp.status === 0 && !/e1_|E1_|TESTE_E1|prepararPlanilhaTeste|e1TesteAcao_/.test(codigoProd) && /atualizar_cadastro/.test(codigoProd) && /function rodarFilaPerfil_/.test(codigoProd) && /function removerGatilhoFilaPerfil/.test(codigoProd), "montador --producao: só a etapa 1 (atualizar_cadastro + acionador), sem NENHUM código de teste");
const planilhaProd = novaPlanilha("ID-PROD-0001", ["Dados", "MASTERLIST"]); planilhaProd.abas.Dados.pôr(1, 1, "@");
const sandboxProd = (() => { const sb = { PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === "ANTICEG_TOKEN" ? "tok-prod" : null) }) }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ conteudo: s, setMimeType() { return this; } }) }, SpreadsheetApp: { getActiveSpreadsheet: () => planilhaProd.ss, flush() {} }, console: { log() {}, warn() {}, error() {} } }; vm.createContext(sb); vm.runInContext(codigoProd, sb); return sb; })();
const chamar = corpo => JSON.parse(vm.runInContext(`doPost({ postData: { contents: ${JSON.stringify(JSON.stringify(corpo))} } }).conteudo`, sandboxProd));
ok(chamar({ acao: "e1_ler", token: "tok-prod" }).erro === "Ação inválida" && chamar({ acao: "e1_gatilho_fila", token: "tok-prod", remover: true }).erro === "Ação inválida", "o web app de PRODUÇÃO recusa as ações de teste (Ação inválida)");
const inval = chamar({ acao: "atualizar_cadastro", token: "tok-prod", id_site: "0", versao: 1, campos: ["nome"], nome: "X" });
ok(inval.definitivo === true && inval.motivo === "aba_dados_ausente", "a ação atualizar_cadastro existe em produção e responde sem gravar nada (checagem sem efeito)");
ok(planilhaProd.abas.Dados.escritas.length <= 1, "e a checagem não escreveu nada na planilha");

s.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
