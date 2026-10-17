// Isolamento dos previews da Vercel (PR #26): a trava de build e o bloqueio das páginas estáticas. Rodar:  node --test tests/isolar-preview.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROD = "ghjfsmwwcfpfvrouyrka", ENSAIO = "zzzzensaioref";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const chave = (ref, role) => `${b64({ alg: "HS256" })}.${b64({ ref, role })}.s`;
const build = env => {
  const e = { ...process.env, VERCEL_ENV: "", AMBIENTE_ENSAIO: "", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", ...env };
  return spawnSync(process.execPath, ["scripts/checar-ambiente.mjs"], { env: e, encoding: "utf8" }).status;
};
const URL_ENSAIO = `https://${ENSAIO}.supabase.co`;

test("produção (e uso local normal) não muda: a trava deixa passar", () => {
  assert.equal(build({}), 0);
  assert.equal(build({ VERCEL_ENV: "production" }), 0);
});
test("preview sem variáveis é RECUSADO (senão usaria o banco de produção)", () => {
  assert.equal(build({ VERCEL_ENV: "preview" }), 1);
  assert.equal(build({ AMBIENTE_ENSAIO: "1" }), 1);
});
test("preview apontando para a produção (URL ou chave) é RECUSADO", () => {
  assert.equal(build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: `https://${PROD}.supabase.co`, VITE_SUPABASE_ANON_KEY: chave(PROD, "anon") }), 1);
  assert.equal(build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: URL_ENSAIO, VITE_SUPABASE_ANON_KEY: chave(PROD, "anon") }), 1);
});
test("preview com chave de serviço (service_role) é RECUSADO", () => {
  assert.equal(build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: URL_ENSAIO, VITE_SUPABASE_ANON_KEY: chave(ENSAIO, "service_role") }), 1);
});
test("preview com URL e chave anon do ensaio é aceito", () => {
  assert.equal(build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: URL_ENSAIO, VITE_SUPABASE_ANON_KEY: chave(ENSAIO, "anon") }), 0);
});

test("o build sempre passa pela trava", () => {
  assert.match(JSON.parse(readFileSync("package.json", "utf8")).scripts.build, /^node scripts\/checar-ambiente\.mjs && vite build$/);
});

test("nenhum arquivo do site (src) tem URL do Supabase de produção fixa, fora de supabase.js", () => {
  const out = spawnSync("git", ["grep", "-l", PROD, "--", "src"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  assert.deepEqual(out, ["src/supabase.js"]);
});

for (const pagina of ["public/links.html", "public/mercari-embed/index.html"]) {
  test(`${pagina}: preview da Vercel não conecta no Supabase de produção`, () => {
    const s = readFileSync(pagina, "utf8");
    assert.ok(s.includes("location.hostname.endsWith('.vercel.app') && location.hostname !== 'anticeg.vercel.app'"), "guarda por hostname");
    if (pagina.includes("mercari")) assert.ok(s.includes("PREVIEW_BLOQUEADO ? 'https://preview-bloqueado.invalid'"), "no preview a base vira um domínio inexistente: nenhuma leitura/escrita/upload chega à produção");
    else assert.ok(/if \(location\.hostname\.endsWith\('\.vercel\.app'\)[^\n]*\) return;\s*\n\s*var \{ createClient \}/.test(s.replace(/\r/g, "")), "a conexão nem é criada no preview");
  });
}
