// Testa os scripts de verificação do lançamento contra uma API SIMULADA (sem rede): protegida = passa; aberta (como o banco de hoje) = falha.
// Rodar: node --test tests/lancamento-scripts.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const ANON = `${b64({ alg: "HS256" })}.${b64({ role: "anon" })}.x`, SERVICO = `${b64({ alg: "HS256" })}.${b64({ role: "service_role" })}.x`;
const rodar = (script, env, extra = []) => spawnSync(process.execPath, ["--import", "./scripts/lancamento/_api-simulada.mjs", script, ...extra], { env: { ...process.env, LANC_URL: "https://exemplo.supabase.co", LANC_ANON: ANON, ...env }, encoding: "utf8" });

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
test("auth-settings: com o cadastro público DESLIGADO passa; LIGADO só avisa (a função pedir-codigo-joiner torna o cadastro público desnecessário)", () => {
  const desligado = rodar("scripts/lancamento/auth-settings.mjs", { MOCK_SIGNUP_OFF: "1" });
  assert.equal(desligado.status, 0, desligado.stdout); assert.match(desligado.stdout, /cadastro público de usuários DESLIGADO/);
  const ligado = rodar("scripts/lancamento/auth-settings.mjs", {});
  assert.equal(ligado.status, 0); assert.match(ligado.stdout, /AVISO\s+cadastro público de usuários está LIGADO/);
  assert.equal(rodar("scripts/lancamento/auth-settings.mjs", { LANC_ANON: SERVICO }).status, 2);
});
test("verificar-comprovantes-antigos: com os buckets privados passa; com link antigo ainda público FALHA e aponta o arquivo", () => {
  const dir = mkdtempSync(join(tmpdir(), "lista-")); const lista = join(dir, "lista.csv");
  writeFileSync(lista, 'bucket_id,name\n"comprovantes","pagamentos/ana.pdf"\ncomprovantes,wmag/1700000000000.jpg\nmercari-comprovantes,ana_1700000000000.jpg\n');
  const bom = rodar("scripts/lancamento/verificar-comprovantes-antigos.mjs", { LANC_A_COG: "ana", LANC_A_SENHA: "sa", LANC_B_COG: "bia", LANC_B_SENHA: "sb" }, [lista, "--ver", "comprovantes/pagamentos/ana.pdf"]);
  assert.equal(bom.status, 0, bom.stdout); assert.match(bom.stdout, /3 fechado\(s\), 0 AINDA ABERTO/); assert.match(bom.stdout, /a dona \(A\) recebe o link assinado/); assert.match(bom.stdout, /outra joiner \(B\) NÃO recebe/);
  assert.doesNotMatch(bom.stdout + bom.stderr, /eyJ|token=|\bsa\b|\bsb\b/, "não imprime link assinado, token nem senha");
  const ruim = rodar("scripts/lancamento/verificar-comprovantes-antigos.mjs", { MOCK_MODO: "aberta" }, [lista]);
  assert.equal(ruim.status, 1); assert.match(ruim.stdout, /3 AINDA ABERTO/); assert.match(ruim.stdout, /ainda público: comprovantes\/pagamentos\/ana\.pdf/);
  assert.equal(rodar("scripts/lancamento/verificar-comprovantes-antigos.mjs", {}, ["nao-existe.csv"]).status, 2);
  assert.equal(rodar("scripts/lancamento/verificar-comprovantes-antigos.mjs", { LANC_ANON: SERVICO }, [lista]).status, 2);
});
