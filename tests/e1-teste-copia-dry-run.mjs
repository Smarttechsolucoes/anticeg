// ENSAIO do script do teste real (scripts/e1-teste-copia-planilha.mjs): roda o script de verdade contra um servidor HTTP LOCAL que imita a implantação de teste do Apps Script
// (o doPost real, numa planilha em memória). Prova que o script funciona e que ele RECUSA rodar sem confirmação ou contra a URL de produção. Nada sai da máquina.
// Uso: node tests/e1-teste-copia-dry-run.mjs
import http from "node:http";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const lerTxt = u => readFileSync(u, "utf8").split("\r\n").join("\n");
const base = lerTxt(new URL("./fixtures/doPost-esqueleto.gs", import.meta.url));
const codigo = base.replace('"atualizar_joiner",\n      "recebido",', '"atualizar_joiner",\n      "atualizar_cadastro",\n      "recebido",')
  .replace('    const sheet = spreadsheet.getSheetByName("MASTERLIST");', '    if (payload.acao === "atualizar_cadastro") {\n      return resposta(atualizarCadastro_(spreadsheet, payload, gravar));\n    }\n\n    const sheet = spreadsheet.getSheetByName("MASTERLIST");')
  + "\n" + lerTxt(new URL("../appsscript/ATUALIZAR_CADASTRO.gs", import.meta.url));
class Aba { constructor(n, l) { this.n = n; this.g = l.map(x => x.slice()); this.escritas = []; } getName() { return this.n; } getLastRow() { return this.g.length; }
  getRange(r, c, nl = 1, nc = 1) { const a = this; return { getValues: () => Array.from({ length: nl }, (_, i) => Array.from({ length: nc }, (_, j) => a.g[r - 1 + i]?.[c - 1 + j] ?? "")), getValue: () => a.g[r - 1]?.[c - 1] ?? "", getFormula: () => "", setValue: v => { a.escritas.push([r, c, v]); (a.g[r - 1] ??= [])[c - 1] = v; }, getSheet: () => a }; } }
const TOKEN = "token-da-implantacao-de-teste-0123456789";
const dados = new Aba("Dados", [["@", "NOME", "EMAIL", "ID_SITE", "PAPEL", "VERSAO"], ["@teste_e1", "Teste E1 Antigo", "", "", "", ""]]);
const sandbox = { PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === "ANTICEG_TOKEN" ? TOKEN : null), setProperty() {} }) }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ conteudo: s, setMimeType() { return this; } }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => ({ Dados: dados, MASTERLIST: new Aba("MASTERLIST", [["x"]]) }[n] ?? null) }), flush() {} }, UrlFetchApp: { fetch() { throw new Error("rede proibida"); } }, console: { log() {}, warn() {}, error() {} } };
vm.createContext(sandbox); vm.runInContext(codigo, sandbox); const doPost = vm.runInContext("doPost", sandbox);
const servidor = http.createServer((req, res) => { let b = ""; req.on("data", c => (b += c)); req.on("end", () => { const s = doPost({ postData: { contents: b } }); res.writeHead(200, { "Content-Type": "application/json" }); res.end(s.conteudo); }); });
await new Promise(r => servidor.listen(0, "127.0.0.1", r)); const url = `http://127.0.0.1:${servidor.address().port}/exec`;
const rodar = env => new Promise(res => { const p = spawn(process.execPath, ["scripts/e1-teste-copia-planilha.mjs"], { env: { ...process.env, ...env }, cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") }); let o = ""; p.stdout.on("data", c => (o += c)); p.stderr.on("data", c => (o += c)); p.on("close", code => res({ code, o })); });

const sem = await rodar({ E1_PLANILHA_URL: url, E1_PLANILHA_TOKEN: TOKEN, E1_CONFIRMO_COPIA: "" });
ok(sem.code === 2 && /E1_CONFIRMO_COPIA=1/.test(sem.o) && dados.escritas.length === 0, "sem E1_CONFIRMO_COPIA=1 o script RECUSA e não grava nada");
const prod = await rodar({ E1_PLANILHA_URL: url, E1_PLANILHA_TOKEN: TOKEN, E1_CONFIRMO_COPIA: "1", PLANILHA_URL: url });
ok(prod.code === 2 && /igual à PLANILHA_URL de produção/.test(prod.o) && dados.escritas.length === 0, "com a URL igual à de produção o script RECUSA");
const real = await rodar({ E1_PLANILHA_URL: url, E1_PLANILHA_TOKEN: TOKEN, E1_CONFIRMO_COPIA: "1", PLANILHA_URL: "" });
console.log(real.o.split("\n").map(l => "   | " + l).join("\n"));
ok(real.code === 0 && /TESTE REAL CONCLUÍDO/.test(real.o), "contra o servidor local (doPost real) o script passa de ponta a ponta");
ok(dados.g[1][1].startsWith("Teste E1 ") && dados.g[1][3] > 0 && dados.g[1][4] === "principal" && /@exemplo\.com$/.test(dados.g[1][2]), "Dados da planilha simulada: nome, ID_SITE, principal e e-mail gravados");
ok(!real.o.includes(TOKEN) && !real.o.includes("127.0.0.1"), "o script não imprime o token nem a URL");
servidor.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
