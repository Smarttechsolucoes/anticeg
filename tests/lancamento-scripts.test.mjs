// Testa os scripts de verificação do lançamento contra uma API SIMULADA (sem rede): protegida = passa; aberta (como o banco de hoje) = falha.
// Rodar: node --test tests/lancamento-scripts.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const ANON = `${b64({ alg: "HS256" })}.${b64({ role: "anon" })}.x`, SERVICO = `${b64({ alg: "HS256" })}.${b64({ role: "service_role" })}.x`;
const rodar = (script, env) => spawnSync(process.execPath, ["--import", "./scripts/lancamento/_api-simulada.mjs", script], { env: { ...process.env, LANC_URL: "https://exemplo.supabase.co", LANC_ANON: ANON, ...env }, encoding: "utf8" });

test("verificar-api: banco protegido passa (visitante, duas contas e isolamento)", () => {
  const r = rodar("scripts/lancamento/verificar-api.mjs", { LANC_A_COG: "ana", LANC_A_SENHA: "senha-a", LANC_B_COG: "bia", LANC_B_SENHA: "senha-b" });
  assert.equal(r.status, 0, r.stdout.slice(-600));
  assert.match(r.stdout, /TODAS AS VERIFICAÇÕES PASSARAM/); assert.match(r.stdout, /ISOLAMENTO/);
  assert.doesNotMatch(r.stdout + r.stderr, /eyJ|senha-a|senha-b/, "nunca imprime token nem senha");
});
test("verificar-api: banco ABERTO (como hoje) falha e aponta as tabelas", () => {
  const r = rodar("scripts/lancamento/verificar-api.mjs", { MOCK_MODO: "aberta" });
  assert.equal(r.status, 1); assert.match(r.stdout, /FALHA\s+visitante LÊ joiners/); assert.match(r.stdout, /FALHA\(S\)/);
});
test("verificar-api: recusa chave de serviço e falta de variáveis", () => {
  assert.equal(rodar("scripts/lancamento/verificar-api.mjs", { LANC_ANON: SERVICO }).status, 2);
  assert.equal(rodar("scripts/lancamento/verificar-api.mjs", { LANC_URL: "" }).status, 2);
});
test("auth-settings: cadastro ligado passa; cadastro desligado FALHA (a ativação não funcionaria)", () => {
  assert.equal(rodar("scripts/lancamento/auth-settings.mjs", {}).status, 0);
  const r = rodar("scripts/lancamento/auth-settings.mjs", { MOCK_SIGNUP_OFF: "1" });
  assert.equal(r.status, 1); assert.match(r.stdout, /FALHA\s+cadastro de novos usuários do Auth LIGADO/);
  assert.equal(rodar("scripts/lancamento/auth-settings.mjs", { LANC_ANON: SERVICO }).status, 2);
});
