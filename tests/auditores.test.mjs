// Testes dos auditores de segredos e de Apps Script (sem rede; arquivos de exemplo inventados).
// Rodar: node --test tests/auditores.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { analisarArquivo } from "../scripts/lancamento/auditar-appsscript.mjs";

const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = papel => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: papel, ref: "exemplo" })}.assinatura-falsa-1234`;

test("Apps Script sem Supabase: continua funcionando", () => {
  const r = analisarArquivo("GERADORDEIDS.gs", "function gerar(){ var s = SpreadsheetApp.getActive(); s.getRange('A1').setValue(Utilities.getUuid()); }");
  assert.equal(r.usaSupabase, false); assert.match(r.veredito, /NÃO ACESSA/);
});
test("Apps Script com chave de SERVIÇO: ignora o RLS e continua funcionando", () => {
  const r = analisarArquivo("SYNC-TRIGGER.gs", `var K='${jwt("service_role")}'; UrlFetchApp.fetch('https://x.supabase.co/rest/v1/masterlist?select=*',{headers:{apikey:K,Authorization:'Bearer '+K}});`);
  assert.ok(r.papeis.includes("service_role")); assert.match(r.veredito, /SERVIÇO/); assert.deepEqual(r.tabelas, ["masterlist"]);
});
test("Apps Script com chave PÚBLICA em tabela fechada: QUEBRA depois do RLS", () => {
  const r = analisarArquivo("PAGAMENTO-AUTOMATICO.gs", `var K='${jwt("anon")}'; UrlFetchApp.fetch('https://x.supabase.co/rest/v1/pagamento_demandas',{method:'patch',headers:{apikey:K}}); UrlFetchApp.fetch('https://x.supabase.co/rest/v1/masterlist');`);
  assert.match(r.veredito, /^QUEBRA/); assert.deepEqual(r.motivo.sort(), ["masterlist", "pagamento_demandas"]); assert.equal(r.escrita, true);
});
test("Apps Script com chave pública só em conteúdo público: passa", () => {
  const r = analisarArquivo("STATUS-SYNC.gs", `var K='${jwt("anon")}'; UrlFetchApp.fetch('https://x.supabase.co/rest/v1/cal_eventos?select=*',{headers:{apikey:K}});`);
  assert.match(r.veredito, /conteúdo público/);
});
test("Apps Script com chave guardada nas propriedades: pede verificação (não adivinha)", () => {
  const r = analisarArquivo("X.gs", "var k=PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY'); UrlFetchApp.fetch('https://x.supabase.co/rest/v1/joiners',{headers:{apikey:k}});");
  assert.match(r.veredito, /^VERIFICAR/);
});
test("o auditor nunca imprime a chave", () => {
  const pasta = mkdtempSync(join(tmpdir(), "as-")); const chave = jwt("service_role");
  writeFileSync(join(pasta, "A.gs"), `var K='${chave}'; UrlFetchApp.fetch('https://x.supabase.co/rest/v1/joiners',{headers:{apikey:K}});`);
  const r = spawnSync(process.execPath, ["scripts/lancamento/auditar-appsscript.mjs", pasta], { encoding: "utf8" });
  assert.equal(r.status, 0); assert.ok(!r.stdout.includes(chave) && !r.stdout.includes("eyJ"));
});

test("auditar-segredos: acha chave de serviço e chave de e-mail, aceita a chave pública, e nunca imprime o segredo", () => {
  const pasta = mkdtempSync(join(tmpdir(), "seg-")); mkdirSync(join(pasta, "ok"));
  writeFileSync(join(pasta, "ok", "publico.js"), `export const K = "${jwt("anon")}";`);
  const limpo = spawnSync(process.execPath, ["scripts/lancamento/auditar-segredos.mjs", join(pasta, "ok")], { encoding: "utf8" });
  assert.equal(limpo.status, 0, limpo.stdout);
  const servico = jwt("service_role"), email = "SG." + "a".repeat(22) + "." + "b".repeat(43);
  writeFileSync(join(pasta, "vaza.js"), `const s = "${servico}"; const e = "${email}";`);
  const r = spawnSync(process.execPath, ["scripts/lancamento/auditar-segredos.mjs", pasta], { encoding: "utf8" });
  assert.equal(r.status, 1); assert.match(r.stdout, /service_role/); assert.match(r.stdout, /SendGrid/);
  assert.ok(!r.stdout.includes(servico) && !r.stdout.includes(email), "nunca imprime o segredo");
});
