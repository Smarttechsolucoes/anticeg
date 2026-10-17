// Inventário de segurança dos Apps Scripts: usa SÓ código fictício; o auditor nunca imprime segredos. Rodar:  node --test tests/inventariar-appsscript.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { inventariar } from "../scripts/lancamento/inventariar-appsscript.mjs";

const FICTICIO = `
function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  if (d.token !== "anticeg-pag-2026") return ContentService.createTextOutput("no");
  if (d.acao === "cancelar") { sheet.getRange(2,3).setValue(false); }
  if (d.acao === "limpar") { sheet.deleteRow(5); }
  UrlFetchApp.fetch("https://api.github.com/repos/x/y/dispatches", { headers: { Authorization: "token ghp_" + "abcdefghijklmnopqrstuvwxyz0123456789" } });
}
function criar() { ScriptApp.newTrigger("sincronizar").timeBased().everyMinutes(5).create(); }
`;
const SEM_TOKEN = `function doGet(e){ return ContentService.createTextOutput(JSON.stringify(sheet.getValues())); }`;

test("detecta Web App, ações, token fixo, destinos, gatilhos e escrita", () => {
  const r = inventariar("a.gs", FICTICIO);
  assert.deepEqual(r.webApp, ["doPost"]);
  assert.deepEqual(r.acoes, ["cancelar", "limpar"]);
  assert.equal(r.validaToken, true);
  assert.ok(r.destinos.includes("api.github.com"));
  assert.deepEqual(r.gatilhos, ["sincronizar"]);
  assert.equal(r.gravaPlanilha, true); assert.equal(r.apagaLinhas, true);
  assert.ok(r.alertas.some(a => /token do site/.test(a) || /mesmo token/.test(a)));
  assert.ok(r.alertas.some(a => /apaga\/limpa/.test(a)));
});
test("Web App sem verificação de token gera alerta", () => {
  const r = inventariar("b.gs", SEM_TOKEN);
  assert.ok(r.alertas.some(a => /não encontrei verificação de token/.test(a)));
});
test("nunca devolve o valor do segredo, só tipo e tamanho", () => {
  const texto = 'var t = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";';
  const r = inventariar("c.gs", texto);
  assert.ok(r.segredos.some(s => s.tipo === "token do GitHub" && s.tamanho > 20));
  assert.ok(!JSON.stringify(r).includes("abcdefghijklmnopqrstuvwxyz"));
  assert.ok(r.alertas.some(a => /segredo escrito no código/.test(a)));
});
test("arquivo limpo não tem alertas", () => {
  const r = inventariar("d.gs", "function util(){ return 1; }");
  assert.deepEqual(r.alertas, []);
});
