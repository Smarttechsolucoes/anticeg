// Planilha do Google EM MEMÓRIA (com VLOOKUP avaliado e idioma que aceita "," ou ";") + o código do Apps Script de teste rodando num módulo vm, atrás de um servidor HTTP local.
// Só para testes automatizados. Nada sai da máquina.
import http from "node:http";
import vm from "node:vm";
import { createHash } from "node:crypto";

export class Aba {
  constructor(planilha, nome) { this.p = planilha; this.n = nome; this.g = []; this.f = {}; this.escritas = []; }
  getName() { return this.n; }
  getLastRow() { let m = 0; this.g.forEach((l, i) => { if (l?.some(x => x !== "" && x != null)) m = i + 1; }); return m; }
  getLastColumn() { let m = 0; this.g.forEach(l => (l || []).forEach((x, j) => { if (x !== "" && x != null) m = Math.max(m, j + 1); })); return m; }
  clear() { this.g = []; this.f = {}; return this; }
  avaliar(r, c) {
    const f = this.f[`${r},${c}`]; if (!f) return this.g[r - 1]?.[c - 1] ?? "";
    const pt = this.p.sep === ";";
    if (pt && f.includes(",")) return "#ERROR!";
    const m = /^=VLOOKUP\(F(\d+),Dados!A:([BC]),(\d),0\)$/.exec(pt ? f.replace(/;/g, ",") : f); if (!m) return "#ERROR!";
    const chave = String(this.g[Number(m[1]) - 1]?.[5] ?? "").toLowerCase(), dados = this.p.abas.Dados.g;
    const l = dados.find(x => String(x?.[0] ?? "").toLowerCase() === chave); return l ? (l[Number(m[3]) - 1] ?? "") : "#N/A";
  }
  getRange(r, c, nl = 1, nc = 1) {
    const a = this;
    const grade = fn => Array.from({ length: nl }, (_, i) => Array.from({ length: nc }, (_, j) => fn(r + i, c + j)));
    return {
      getValues: () => grade((x, y) => a.avaliar(x, y)), getDisplayValues: () => grade((x, y) => String(a.avaliar(x, y))), getDisplayValue: () => String(a.avaliar(r, c)),
      getFormulas: () => grade((x, y) => a.f[`${x},${y}`] ?? ""), getValue: () => a.avaliar(r, c), getFormula: () => a.f[`${r},${c}`] ?? "", getSheet: () => a,
      setValue: v => a.pôr(r, c, v), setFormula: f => a.pôr(r, c, f), setValues: m => m.forEach((l, i) => l.forEach((v, j) => a.pôr(r + i, c + j, v))),
    };
  }
  pôr(r, c, v) { this.escritas.push([r, c, v]); (this.g[r - 1] ??= [])[c - 1] = v; if (typeof v === "string" && v.startsWith("=")) this.f[`${r},${c}`] = v; else delete this.f[`${r},${c}`]; }
}

export const novaPlanilha = (id, abas = ["Planilha1"], sep = ",") => {
  const p = { id, nome: "Planilha sem título", abas: {}, sep, gatilhos: [] };
  abas.forEach(n => (p.abas[n] = new Aba(p, n)));
  p.ss = {
    getId: () => p.id, getName: () => p.nome, rename: n => { p.nome = n; }, getSheetByName: n => p.abas[n] ?? null, getSheets: () => Object.values(p.abas),
    insertSheet: n => (p.abas[n] = new Aba(p, n)), deleteSheet: s => { delete p.abas[s.getName()]; },
  };
  return p;
};

export const montarSandbox = (codigo, planilha, props) => {
  const sandbox = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ conteudo: s, setMimeType() { return this; } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => planilha.ss, flush() {} }, UrlFetchApp: { fetch() { throw new Error("rede proibida"); } },
    ScriptApp: {
      getProjectTriggers: () => planilha.gatilhos.map(h => ({ getHandlerFunction: () => h })),
      deleteTrigger: t => { const i = planilha.gatilhos.indexOf(t.getHandlerFunction()); if (i >= 0) planilha.gatilhos.splice(i, 1); },
      newTrigger: h => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => planilha.gatilhos.push(h) }) }) }),
    },
    Utilities: { DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" }, getUuid: () => crypto.randomUUID(), computeDigest: (_a, t) => [...createHash("sha256").update(t, "utf8").digest()].map(b => (b > 127 ? b - 256 : b)) },
    console: { log() {}, warn() {}, error() {} }, crypto,
  };
  vm.createContext(sandbox); vm.runInContext(codigo, sandbox); return sandbox;
};

export const servir = async sandbox => {
  const doPost = vm.runInContext("doPost", sandbox);
  const s = http.createServer((req, res) => { let b = ""; req.on("data", c => (b += c)); req.on("end", () => { const r = doPost({ postData: { contents: b } }); res.writeHead(200, { "Content-Type": "application/json" }); res.end(r.conteudo); }); });
  await new Promise(r => s.listen(0, "127.0.0.1", r)); return { s, url: `http://127.0.0.1:${s.address().port}/exec` };
};
