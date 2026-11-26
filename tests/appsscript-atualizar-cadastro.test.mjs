// Ação "atualizar_cadastro" (etapa 1) do Apps Script rodando o código REAL num simulador de planilha em memória (sem rede, sem Google, sem gravar nada em lugar nenhum).
// A MASTERLIST simulada tem as MESMAS fórmulas da real (E = VLOOKUP(F, Dados!A:B, 2, 0) e S = VLOOKUP(F, Dados!A:C, 3, 0)) e linhas com texto fixo, para provar o reflexo "Dados -> MASTERLIST".
// Rodar:  node --test tests/appsscript-atualizar-cadastro.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

// O script publicado não está no repositório: por padrão usa o esqueleto de tests/fixtures; com APPS_SCRIPT_ATUAL=<caminho do .gs> as MESMAS duas edições de appsscript/ATUALIZAR_CADASTRO.md são aplicadas ao script de verdade.
const lerTxt = u => readFileSync(u, "utf8").split("\r\n").join("\n");
const baseTxt = process.env.APPS_SCRIPT_ATUAL ? lerTxt(process.env.APPS_SCRIPT_ATUAL) : lerTxt(new URL("./fixtures/doPost-esqueleto.gs", import.meta.url));
const pedaco = lerTxt(new URL("../appsscript/ATUALIZAR_CADASTRO.gs", import.meta.url));
const comAcao = baseTxt.replace('"atualizar_joiner",\n      "recebido",', '"atualizar_joiner",\n      "atualizar_cadastro",\n      "recebido",');
if (comAcao === baseTxt) throw new Error("âncora das ações permitidas não encontrada no script base");
const comRamo = comAcao.replace('    const sheet = spreadsheet.getSheetByName("MASTERLIST");', '    if (payload.acao === "atualizar_cadastro") {\n      return resposta(atualizarCadastro_(spreadsheet, payload, gravar));\n    }\n\n    const sheet = spreadsheet.getSheetByName("MASTERLIST");');
if (comRamo === comAcao) throw new Error("âncora da MASTERLIST não encontrada no script base");
const codigo = comRamo + "\n" + pedaco;
const TOKEN = "token-de-teste-0123456789";

class Aba {
  constructor(nome, linhas, formulas = {}) { this.nome = nome; this.g = linhas.map(l => l.slice()); this.f = formulas; this.escritas = []; }
  getName() { return this.nome; }
  getLastRow() { return this.g.length; }
  getRange(r, c, nl = 1, nc = 1) {
    const aba = this;
    return {
      getValues: () => Array.from({ length: nl }, (_, i) => Array.from({ length: nc }, (_, j) => (aba.g[r - 1 + i]?.[c - 1 + j] ?? ""))),
      getValue: () => aba.g[r - 1]?.[c - 1] ?? "",
      getFormula: () => aba.f[`${r},${c}`] ?? "",
      setValue: v => { aba.escritas.push([r, c, v]); (aba.g[r - 1] ??= [])[c - 1] = v; },
      getSheet: () => aba,
    };
  }
}
// Dados: A @ | B nome | C e-mail | D ID_SITE | E PAPEL | F VERSAO (linha 1 = cabeçalho)
const dadosBase = () => [
  ["@", "NOME", "EMAIL", "ID_SITE", "PAPEL", "VERSAO"],
  ["@ana", "Ana Antiga", "ana@antigo.com", "", "", ""],
  ["@bia", "Bia", "bia@exemplo.com", "", "", ""],
  ["@linhows", "Amy", "", 239, "principal", ""],
  ["@ookkutsuu", "Amy", "", 239, "alias", ""],
  ["@dup", "Dup Um", "d1@exemplo.com", "", "", ""],
  ["@dup", "Dup Dois", "d2@exemplo.com", "", "", ""],
];
// MASTERLIST: 1 cabeçalho; E = nome (fórmula ou texto fixo), F = @, S = e-mail (fórmula) — só as colunas necessárias, nas posições reais (E=5, F=6, S=19)
function masterlist() {
  const linhas = [["NUM", "ID", "STATUS", "CEG", "NOME", "@", ...Array(12).fill(""), "EMAIL"]]; const formulas = {};
  const add = (tw, nomeFixo) => { const n = linhas.length + 1; const r = Array(19).fill(""); r[5] = tw; if (nomeFixo) r[4] = nomeFixo; linhas.push(r); if (!nomeFixo) formulas[`${n},5`] = `=VLOOKUP(F${n},Dados!A:B,2,0)`; formulas[`${n},19`] = `=VLOOKUP(F${n},Dados!A:C,3,0)`; };
  add("@ana"); add("@ana"); add("@ana", "Texto Fixo"); add("@ookkutsuu"); add("@linhows"); add("@bia");
  return new Aba("MASTERLIST", linhas, formulas);
}
const buscar = (dados, chave, col) => { const l = dados.g.slice(1).find(r => String(r[0]).toLowerCase() === String(chave).toLowerCase()); return l ? (l[col - 1] === "" ? "" : l[col - 1]) : "#N/A"; };
const lerMaster = (m, dados) => m.g.slice(1).map((r, i) => ({ tw: r[5], nome: m.f[`${i + 2},5`] ? buscar(dados, r[5], 2) : r[4], email: m.f[`${i + 2},19`] ? buscar(dados, r[5], 3) : r[18] }));

function cenario({ dados = dadosBase(), props = { ANTICEG_TOKEN: TOKEN }, ocupada = false, formulasDados = {} } = {}) {
  const abaDados = new Aba("Dados", dados, formulasDados), m = masterlist(); const log = { trava: 0 };
  const sandbox = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { log.trava++; if (ocupada) throw new Error("ocupada"); }, releaseLock: () => {} }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ conteudo: s, setMimeType() { return this; } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => ({ Dados: abaDados, MASTERLIST: m }[n] ?? null) }), flush() {} },
    UrlFetchApp: { fetch: () => { throw new Error("rede proibida no teste"); } },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.createContext(sandbox); vm.runInContext(codigo, sandbox);
  const doPost = vm.runInContext("doPost", sandbox);
  const enviar = corpo => JSON.parse(doPost({ postData: { contents: JSON.stringify({ token: TOKEN, acao: "atualizar_cadastro", ...corpo }) } }).conteudo);
  return { enviar, dados: abaDados, master: m, log, doPost };
}
const corpoBase = (extra = {}) => ({ id_site: 10, twitter: "@ana", nome: "Ana Souza", email: "ana@exemplo.com", versao: 5, campos: ["nome"], ...extra });

test("nome cadastral: grava Dados!B, preenche D/E/F da linha única e a MASTERLIST acompanha pelas fórmulas; texto fixo e fórmulas intactos", () => {
  const c = cenario(); const r = c.enviar(corpoBase());
  assert.equal(r.ok, true); assert.equal(r.linha, 2);
  assert.deepEqual(c.dados.g[1], ["@ana", "Ana Souza", "ana@antigo.com", 10, "principal", 5], "B mudou; C não; D/E/F preenchidos");
  const ml = lerMaster(c.master, c.dados);
  assert.deepEqual(ml.filter(x => x.tw === "@ana").map(x => x.nome), ["Ana Souza", "Ana Souza", "Texto Fixo"], "linhas com fórmula refletem; a de texto fixo NÃO muda");
  assert.equal(c.master.escritas.length, 0, "nenhuma escrita na MASTERLIST");
  assert.equal(c.master.f["2,5"], "=VLOOKUP(F2,Dados!A:B,2,0)", "fórmulas da MASTERLIST intactas");
});
test("e-mail: grava só Dados!C (minúsculas) e a coluna S da MASTERLIST acompanha", () => {
  const c = cenario(); const r = c.enviar(corpoBase({ campos: ["email"], email: "Ana.Nova@Exemplo.com" }));
  assert.equal(r.ok, true); assert.equal(c.dados.g[1][1], "Ana Antiga", "nome intacto"); assert.equal(c.dados.g[1][2], "ana.nova@exemplo.com");
  assert.ok(lerMaster(c.master, c.dados).filter(x => x.tw === "@ana" && x.nome !== "Texto Fixo").every(x => x.email === "ana.nova@exemplo.com"));
});
test("versão: igual ou mais antiga é IGNORADA (a nova já está lá), mais nova grava; repetir a mesma alteração não regrava", () => {
  const c = cenario(); c.enviar(corpoBase({ versao: 5 }));
  const antiga = c.enviar(corpoBase({ versao: 4, nome: "Nome Velho" })); const igual = c.enviar(corpoBase({ versao: 5, nome: "Nome Velho" }));
  assert.equal(antiga.ignorado, "versao_antiga"); assert.equal(igual.ignorado, "versao_antiga"); assert.equal(c.dados.g[1][1], "Ana Souza");
  const nova = c.enviar(corpoBase({ versao: 6, nome: "Ana Souza" })); assert.equal(nova.ok, true); assert.equal(nova.celulas_alteradas, 0, "mesmo valor: nada regravado"); assert.equal(c.dados.g[1][5], 6);
});
test("achada pelo ID_SITE mesmo com o @ trocado: a linha principal e as linhas ALIAS do mesmo ID recebem a mesma cópia (caso 239168)", () => {
  const c = cenario(); const antes = lerMaster(c.master, c.dados).filter(x => x.tw === "@ookkutsuu")[0];
  assert.equal(antes.nome, "Amy");
  const r = c.enviar({ id_site: 239, twitter: "@linhows", nome: "Amy Nova", email: "amy@exemplo.com", versao: 9, campos: ["nome", "email"] });
  assert.equal(r.ok, true); assert.equal(r.aliases, 1);
  assert.deepEqual([c.dados.g[3][1], c.dados.g[4][1], c.dados.g[3][2], c.dados.g[4][2]], ["Amy Nova", "Amy Nova", "amy@exemplo.com", "amy@exemplo.com"]);
  const ml = lerMaster(c.master, c.dados).filter(x => x.tw === "@ookkutsuu" || x.tw === "@linhows");
  assert.ok(ml.every(x => x.nome === "Amy Nova" && x.email === "amy@exemplo.com"), "as linhas da MASTERLIST com o @ antigo e com o novo mostram o mesmo nome/e-mail");
});
test("falhas DEFINITIVAS: nada é gravado e a resposta traz motivo (linha ausente, ambígua, duplicata, principais repetidos, só alias, outro ID, fórmula)", () => {
  const casos = [
    ["linha_nao_encontrada", cenario(), corpoBase({ id_site: 77, twitter: "@ninguem" })],
    ["linha_ambigua", cenario(), corpoBase({ id_site: 78, twitter: "@dup" })],
    ["id_site_diferente", cenario(), corpoBase({ id_site: 79, twitter: "@linhows" })],
    ["duplicata_principal", (() => { const d = dadosBase(); d.push(["@outro", "X", "x@x.com", 239, "principal", ""]); return cenario({ dados: d }); })(), { id_site: 239, twitter: "@linhows", nome: "Amy Nova", email: "a@a.com", versao: 9, campos: ["nome"] }],
    ["alias_sem_principal", (() => { const d = dadosBase(); d[3][4] = "alias"; return cenario({ dados: d }); })(), { id_site: 239, twitter: "@linhows", nome: "Amy Nova", email: "a@a.com", versao: 9, campos: ["nome"] }],
    ["duplicata_arroba", (() => { const d = dadosBase(); d[1][3] = 10; d[1][4] = "principal"; d.push(["@Ana", "Outra Ana", "o@o.com", 55, "principal", ""]); return cenario({ dados: d }); })(), corpoBase()],
    ["celula_com_formula", cenario({ formulasDados: { "2,2": "=A1&\"x\"" } }), corpoBase()],
  ];
  for (const [motivo, c, corpo] of casos) {
    const copia = JSON.stringify(c.dados.g), r = c.enviar(corpo);
    assert.equal(r.definitivo, true, motivo); assert.equal(r.motivo, motivo); assert.equal(c.dados.escritas.length, 0, motivo + ": NADA gravado"); assert.equal(JSON.stringify(c.dados.g), copia);
  }
});
test("pedido inválido: sem campos, id/versão ruins, nome com <, e-mail inválido — definitivo 'dados_invalidos', nada gravado", () => {
  const c = cenario();
  for (const corpo of [corpoBase({ campos: [] }), corpoBase({ campos: ["cpf"] }), corpoBase({ id_site: "abc" }), corpoBase({ versao: 0 }), corpoBase({ versao: 1.5 }), corpoBase({ nome: "Ana <b>" }), corpoBase({ campos: ["email"], email: "sem-arroba" })]) {
    const r = c.enviar(corpo); assert.equal(r.motivo, "dados_invalidos", JSON.stringify(corpo));
  }
  assert.equal(c.dados.escritas.length, 0);
});
test("planilha ocupada: resposta 'ocupado' (transitória, sem 'definitivo') e nada gravado; token errado é recusado e nada é gravado", () => {
  const c = cenario({ ocupada: true }); const r = c.enviar(corpoBase());
  assert.equal(r.ocupado, true); assert.equal(r.definitivo, undefined); assert.equal(c.dados.escritas.length, 0);
  const d = cenario(); const saida = JSON.parse(d.doPost({ postData: { contents: JSON.stringify({ token: "errado", acao: "atualizar_cadastro", ...corpoBase() }) } }).conteudo);
  assert.deepEqual(saida, { erro: "Token inválido" }); assert.equal(d.dados.escritas.length, 0);
});
test("a ação antiga atualizar_joiner continua funcionando (compatibilidade)", () => {
  const c = cenario(); const r = JSON.parse(c.doPost({ postData: { contents: JSON.stringify({ token: TOKEN, acao: "atualizar_joiner", twitter_antigo: "@bia", email_novo: "bia.nova@exemplo.com" }) } }).conteudo);
  assert.equal(r.ok, true); assert.equal(c.dados.g[2][2], "bia.nova@exemplo.com");
});
