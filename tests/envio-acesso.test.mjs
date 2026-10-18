// Testes do acesso ao envio nacional (front): token, captura do link, e varredura do código para garantir que as travas não regridem.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criarGuardaToken, tokenValido, normalizarCogEnvio, CHAVE_TOKEN } from "../src/envioAcessoPuro.js";

const TOKEN = "0123456789abcdef".repeat(3);
function janelaFalsa(href) {
  const j = { location: { href }, history: { state: null, replaceState(_s, _t, nova) { j.novaUrl = nova; } } };
  return j;
}
function armazenamentoFalso() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; }

test("tokenValido: só 48 caracteres hexadecimais minúsculos", () => {
  assert.equal(tokenValido(TOKEN), true);
  for (const x of [null, undefined, "", "abc", TOKEN.toUpperCase(), TOKEN + "0", TOKEN.slice(1), "z".repeat(48), 123]) assert.equal(tokenValido(x), false);
});
test("normalizarCogEnvio tira @ e caixa", () => assert.equal(normalizarCogEnvio("  @Fulana_X "), "fulana_x"));
test("capturar: guarda o token, tira ?acesso= da barra de endereço e mantém o resto da URL", () => {
  const arm = armazenamentoFalso(), j = janelaFalsa("https://anticeg.vercel.app/envio?acesso=" + TOKEN + "&x=1#topo");
  const g = criarGuardaToken({ armazenamento: arm, janela: j });
  assert.equal(g.capturar(), TOKEN);
  assert.equal(j.novaUrl, "/envio?x=1#topo");
  assert.equal(arm.getItem(CHAVE_TOKEN), TOKEN);
  assert.equal(g.ler(), TOKEN);
});
test("capturar: token inválido não é guardado, mas o parâmetro sai da URL", () => {
  const arm = armazenamentoFalso(), j = janelaFalsa("https://x/envio?acesso=lixo");
  const g = criarGuardaToken({ armazenamento: arm, janela: j });
  assert.equal(g.capturar(), null);
  assert.equal(j.novaUrl, "/envio");
  assert.equal(g.ler(), null);
});
test("capturar: sem parâmetro não mexe na URL nem apaga o token guardado", () => {
  const arm = armazenamentoFalso(); arm.setItem(CHAVE_TOKEN, TOKEN);
  const j = janelaFalsa("https://x/envio");
  const g = criarGuardaToken({ armazenamento: arm, janela: j });
  assert.equal(g.capturar(), null);
  assert.equal(j.novaUrl, undefined);
  assert.equal(g.ler(), TOKEN);
});
test("sem armazenamento (navegador bloqueado): o token vale na memória desta aba", () => {
  const quebrado = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); }, removeItem() { throw new Error("bloqueado"); } };
  const g = criarGuardaToken({ armazenamento: quebrado, janela: janelaFalsa("https://x/envio?acesso=" + TOKEN) });
  assert.equal(g.capturar(), TOKEN);
  assert.equal(g.ler(), TOKEN);
  g.limpar();
  assert.equal(g.ler(), null);
});

// ---- varredura do App.jsx (garante que as correções não regridam)
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const TABELAS = ["envio_solicitacoes", "grupos_envio", "joiner_storage", "envio_requests", "envio_rounds", "joiner_conferencias", "rastreios"];
test("a senha fixa do envio não existe mais no código", () => assert.equal(app.includes("ILOVE2MIN"), false));
test("nenhuma tabela de envio é acessada pelo cliente anônimo comum (só supabaseEnvio() ou clienteAdmin())", () => {
  for (const t of TABELAS) assert.equal(new RegExp("\\bsupabase\\.from\\(\"" + t + "\"\\)").test(app), false, t);
});
test("a administração usa clienteAdmin() nas tabelas de envio e a joiner usa supabaseEnvio()", () => {
  assert.ok((app.match(/clienteAdmin\(\)\.from\("(envio_solicitacoes|joiner_storage|rastreios|envio_rounds|envio_requests|joiner_conferencias|grupos_envio)"\)/g) || []).length >= 30);
  assert.ok((app.match(/supabaseEnvio\(\)\.(from|rpc|storage)/g) || []).length >= 20);
});
test("confirmar envio não usa id de storage como id da masterlist", () => {
  const i = app.indexOf("async function confirmarEnvio(s)"); const trecho = app.slice(i, i + 900);
  assert.ok(trecho.includes("it.ceg === \"Storage GOM\"") && trecho.includes(".eq(\"id_linha\", it.id_linha)"));
});
test("comprovantes de envio vão para o bucket privado e o banco guarda só o caminho", () => {
  assert.ok(app.includes("storage.from(\"envio-comprovantes\").upload("));
  assert.equal(/storage\.from\("comprovantes"\)\.upload\(path, cf\.file/.test(app), false);
});
test("o Envio Nacional tem porta de acesso por link pessoal", () => {
  assert.ok(app.includes("function EnvioTabInterno(") && app.includes("rpc(\"envio_meu_acesso\")") && app.includes("temTokenEnvio()"));
});

// ---- JOINERS1: CPF e endereço fora da leitura/gravação do visitante
import { COLUNAS_JOINER_PUBLICAS } from "../src/joinersColunas.js";
const sqlJ1 = readFileSync(new URL("../supabase/envio/JOINERS1_aplicar.sql", import.meta.url), "utf8");
test("a lista de colunas públicas do front é igual à do SQL (grant select) e cobre as 24 colunas junto com as 9 protegidas", () => {
  const grant = /grant select \(([^)]*)\) on public\.joiners to anon/.exec(sqlJ1)[1].split(",").map(x => x.trim()).sort();
  assert.deepEqual(COLUNAS_JOINER_PUBLICAS.split(",").sort(), grant);
  const protegidas = ["cpf", "cep", "rua", "numero", "complemento", "bairro", "cidade", "estado", "nome_entrega"];
  assert.equal(grant.length + protegidas.length, 24);
  for (const c of protegidas) assert.equal(grant.includes(c), false, c);
});
test("nenhum select(*) em joiners fora da conta admin", () => {
  for (const f of ["../src/App.jsx", "../src/LandingPage.jsx", "../src/recrutador.js", "../src/joinerAuth.js"]) {
    const fonte = readFileSync(new URL(f, import.meta.url), "utf8");
    for (const m of fonte.matchAll(/(\w+(?:\(\))?)\.from\("joiners"\)\s*\.select\("\*"\)/g)) assert.equal(m[1], "clienteAdmin()", f + ": " + m[0]);
  }
});
test("o Perfil grava CPF/endereço pelo servidor e não direto na tabela", () => {
  assert.ok(app.includes("rpc(\"envio_salvar_dados\""));
  assert.equal(/from\("joiners"\)\.update\(payload\)/.test(app), false);
});
