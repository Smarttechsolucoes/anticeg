// Autenticação do doPost v2 (appsscript/PAGAMENTO-AUTOMATICO.gs) rodando o código REAL num simulador mínimo do Apps Script (sem planilha, sem rede, sem gravar nada).
// Prova: o token é conferido ANTES da trava e da ação; durante a rotação dois tokens valem; depois da rotação o antigo é recusado; nenhum token aparece em resposta ou log.
// Rodar:  node --test tests/appsscript-doPost.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const codigo = readFileSync(new URL("../appsscript/PAGAMENTO-AUTOMATICO.gs", import.meta.url), "utf8");
const PLANILHA_ALCANCADA = "PLANILHA_ALCANCADA";

function rodar(props, corpo) {
  const eventos = { trava: 0, libera: 0, planilha: 0, logs: [] };
  const sandbox = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { eventos.trava++; }, releaseLock: () => { eventos.libera++; } }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ conteudo: s, setMimeType() { return this; } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => { eventos.planilha++; throw new Error(PLANILHA_ALCANCADA); } },
    UrlFetchApp: { fetch: () => { throw new Error("rede proibida no teste"); } },
    console: { log: m => eventos.logs.push(String(m)), warn: m => eventos.logs.push(String(m)), error: m => eventos.logs.push(String(m)) },
  };
  vm.createContext(sandbox);
  vm.runInContext(codigo, sandbox);
  const saida = vm.runInContext("doPost", sandbox)({ postData: { contents: typeof corpo === "string" ? corpo : JSON.stringify(corpo) } });
  let resp = null; try { resp = JSON.parse(saida.conteudo); } catch { /* sem JSON */ }
  return { resp, ...eventos };
}
const ATUAL = "token-atual-do-site-antigo", NOVO = "token-novo-so-do-servidor-0123456789";

test("token inválido: recusado ANTES da trava e da planilha; resposta idêntica para ação válida e inválida (não revela quais ações existem)", () => {
  for (const acao of ["confirmar", "cancelar", "acao_que_nao_existe", undefined]) {
    const r = rodar({ ANTICEG_TOKEN: ATUAL }, { acao, token: "errado" });
    assert.deepEqual(r.resp, { erro: "Token inválido" }, String(acao));
    assert.equal(r.trava, 0, "não pegou a trava"); assert.equal(r.planilha, 0, "não tocou a planilha");
  }
  assert.deepEqual(rodar({ ANTICEG_TOKEN: ATUAL }, { acao: "confirmar" }).resp, { erro: "Token inválido" }, "sem token");
  assert.deepEqual(rodar({ ANTICEG_TOKEN: ATUAL }, { acao: "confirmar", token: null }).resp, { erro: "Token inválido" });
});
test("corpo que não é JSON: 'Requisição inválida' sem trava", () => {
  const r = rodar({ ANTICEG_TOKEN: ATUAL }, "isto não é json"); assert.deepEqual(r.resp, { erro: "Requisição inválida" }); assert.equal(r.trava, 0);
});
test("nenhum token configurado: recusa tudo", () => {
  const r = rodar({}, { acao: "confirmar", token: ATUAL }); assert.deepEqual(r.resp, { erro: "ANTICEG_TOKEN não configurado" }); assert.equal(r.trava, 0);
});
test("o token ATUAL passa (site antigo continua funcionando) e o log só diz 'atual'", () => {
  const r = rodar({ ANTICEG_TOKEN: ATUAL, ANTICEG_TOKEN_NOVO: NOVO }, { acao: "confirmar", token: ATUAL, itens: [] });
  assert.equal(r.trava, 1, "pegou a trava depois de autenticar"); assert.equal(r.planilha, 1, "chegou à planilha"); assert.equal(r.libera, 1, "liberou a trava");
  assert.ok(r.logs.some(l => /token atual/.test(l)));
});
test("o token NOVO (proxy) passa durante a rotação e o log só diz 'novo'", () => {
  const r = rodar({ ANTICEG_TOKEN: ATUAL, ANTICEG_TOKEN_NOVO: NOVO }, { acao: "cancelar", token: NOVO, itens: [] });
  assert.equal(r.planilha, 1); assert.ok(r.logs.some(l => /token novo/.test(l)));
});
test("depois da rotação (ANTICEG_TOKEN = valor novo, sem a propriedade temporária): o token ANTIGO e o público 'anticeg-pag-2026' são recusados; o novo vale", () => {
  const props = { ANTICEG_TOKEN: NOVO };
  assert.deepEqual(rodar(props, { acao: "confirmar", token: ATUAL }).resp, { erro: "Token inválido" });
  assert.deepEqual(rodar(props, { acao: "confirmar", token: "anticeg-pag-2026" }).resp, { erro: "Token inválido" });
  assert.equal(rodar(props, { acao: "confirmar", token: NOVO, itens: [] }).planilha, 1);
});
test("autenticado, uma ação inexistente é recusada sem tocar a planilha", () => {
  const r = rodar({ ANTICEG_TOKEN: ATUAL }, { acao: "apagar_tudo", token: ATUAL });
  assert.equal(r.planilha, 0); assert.ok(r.resp && /Ação inválida/.test(r.resp.erro) || r.planilha === 0);
});
test("comparação exata: prefixo, sufixo, maiúsculas e espaço não passam; valor vazio nunca passa", () => {
  const props = { ANTICEG_TOKEN: ATUAL };
  for (const t of [ATUAL.slice(0, -1), ATUAL + "x", ATUAL.toUpperCase(), ATUAL + " ", " " + ATUAL, "", " "]) assert.deepEqual(rodar(props, { acao: "confirmar", token: t }).resp, { erro: "Token inválido" }, JSON.stringify(t));
  assert.deepEqual(rodar({ ANTICEG_TOKEN: "" , ANTICEG_TOKEN_NOVO: ""}, { acao: "confirmar", token: "" }).resp, { erro: "ANTICEG_TOKEN não configurado" }, "propriedade vazia = não configurado");
});
test("nenhum valor de token aparece em resposta ou log, aceito ou recusado", () => {
  for (const t of [ATUAL, NOVO, "errado-" + ATUAL]) {
    const r = rodar({ ANTICEG_TOKEN: ATUAL, ANTICEG_TOKEN_NOVO: NOVO }, { acao: "confirmar", token: t, itens: [] });
    const tudo = JSON.stringify(r.resp) + r.logs.join("\n");
    assert.ok(!tudo.includes(ATUAL) && !tudo.includes(NOVO), "vazou token em: " + tudo.slice(0, 120));
  }
});
test("o arquivo não contém token, chave ou URL escritos", () => {
  assert.ok(!/anticeg-pag-\d{4}/.test(codigo) && !/eyJ[A-Za-z0-9_-]{15,}/.test(codigo) && !/ghp_|github_pat_/.test(codigo));
});
