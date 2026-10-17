// Preview inerte (alternativa ao ambiente de ensaio): decisão do banco, trava de build e páginas estáticas. Rodar:  node --test tests/preview-inerte.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { decidirBanco, URL_INERTE, URL_PRODUCAO, REF_PRODUCAO } from "../src/ambiente.js";

const ENSAIO = "zzzzensaioref", URL_ENSAIO = `https://${ENSAIO}.supabase.co`;

test("site oficial (e uso local) continua falando com a produção", () => {
  for (const host of ["anticeg.vercel.app", "anticeg-smarttechsolucoes-projects.vercel.app", "localhost", "", "www.anticegs.com.br"])
    assert.deepEqual(decidirBanco({ host }), { url: URL_PRODUCAO, inerte: false, alternativo: false }, host);
});
test("QUALQUER preview da Vercel fica inerte, inclusive deploy único e alias de branch", () => {
  for (const host of ["anticeg-8gfshpvwr-smarttechsolucoes-projects.vercel.app", "anticeg-git-lancamento-consolidado-smarttechsolucoes-projects.vercel.app", "qualquer-coisa.vercel.app", "ANTICEG-XYZ.VERCEL.APP"])
    assert.deepEqual(decidirBanco({ host }), { url: URL_INERTE, inerte: true, alternativo: false }, host);
});
test("build marcado como preview fica inerte mesmo se o host for desconhecido", () => {
  assert.equal(decidirBanco({ host: "localhost", buildPreview: true }).url, URL_INERTE);
});
test("preview com variável apontando para a PRODUÇÃO continua inerte (a variável é ignorada)", () => {
  assert.equal(decidirBanco({ host: "x.vercel.app", urlEnv: URL_PRODUCAO }).url, URL_INERTE);
  assert.equal(decidirBanco({ buildPreview: true, urlEnv: `https://${REF_PRODUCAO}.supabase.co` }).inerte, true);
});
test("projeto de ensaio configurado de propósito é aceito no preview", () => {
  assert.deepEqual(decidirBanco({ host: "x.vercel.app", urlEnv: URL_ENSAIO }), { url: URL_ENSAIO, inerte: false, alternativo: true });
});
test("a URL inerte nunca resolve (.invalid)", () => { assert.ok(new URL(URL_INERTE).hostname.endsWith(".invalid")); });

const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const chave = (ref, role) => `${b64({ alg: "HS256" })}.${b64({ ref, role })}.s`;
const build = env => spawnSync(process.execPath, ["scripts/checar-ambiente.mjs"], { env: { ...process.env, VERCEL_ENV: "", AMBIENTE_ENSAIO: "", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", ...env }, encoding: "utf8" });

test("trava de build: produção e uso local não mudam", () => { assert.equal(build({}).status, 0); assert.equal(build({ VERCEL_ENV: "production" }).status, 0); });
test("trava de build: preview SEM variáveis passa (inerte) e avisa", () => {
  const r = build({ VERCEL_ENV: "preview" }); assert.equal(r.status, 0); assert.match(r.stdout, /INERTE/);
});
test("trava de build: preview com variável da produção, chave de serviço ou projetos misturados é RECUSADO", () => {
  assert.equal(build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: URL_PRODUCAO, VITE_SUPABASE_ANON_KEY: chave(REF_PRODUCAO, "anon") }).status, 1);
  assert.equal(build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: URL_ENSAIO, VITE_SUPABASE_ANON_KEY: chave(REF_PRODUCAO, "anon") }).status, 1);
  assert.equal(build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: URL_ENSAIO, VITE_SUPABASE_ANON_KEY: chave(ENSAIO, "service_role") }).status, 1);
  assert.equal(build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: URL_ENSAIO }).status, 1, "só a URL");
  assert.equal(build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: "https://outro.supabase.co", VITE_SUPABASE_ANON_KEY: chave(ENSAIO, "anon") }).status, 1, "chave e URL de projetos diferentes");
});
test("trava de build: preview com projeto de ensaio correto passa", () => {
  assert.equal(build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: URL_ENSAIO, VITE_SUPABASE_ANON_KEY: chave(ENSAIO, "anon") }).status, 0);
});
test("o build passa sempre pela trava e o vite define o marcador de preview", () => {
  assert.match(JSON.parse(readFileSync("package.json", "utf8")).scripts.build, /^node scripts\/checar-ambiente\.mjs && vite build$/);
  assert.match(readFileSync("vite.config.js", "utf8"), /__PREVIEW_VERCEL__: JSON\.stringify\(process\.env\.VERCEL_ENV === 'preview'\)/);
});
test("nenhum arquivo de src tem URL de produção fixa, fora de ambiente.js", () => {
  const out = spawnSync("git", ["grep", "-l", REF_PRODUCAO, "--", "src"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  assert.deepEqual(out, ["src/ambiente.js"]);   // ambiente.js é o único lugar com o ref da produção
});
for (const pagina of ["public/links.html", "public/mercari-embed/index.html"]) {
  test(`${pagina}: preview da Vercel não conecta na produção`, () => {
    const s = readFileSync(pagina, "utf8").replace(/\r/g, "");
    assert.ok(s.includes("location.hostname.endsWith('.vercel.app') && !['anticeg.vercel.app', 'anticeg-smarttechsolucoes-projects.vercel.app'].includes(location.hostname)"));
  });
}
