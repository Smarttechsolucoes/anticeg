// Testes do tratamento de resposta do Apps Script. Rodar:  node --test tests/planilha-api.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chamarPlanilha, interpretarResposta, mensagemPlanilha, esperadosConfirmacao } from "../src/planilhaApi.js";

const CFG = { url: "https://projeto.supabase.co/functions/v1/planilha-acao", apikey: "chave-publica", token: "jwt-de-quem-esta-logado" };
const resp = (obj, { ok = true, status = 200, texto } = {}) => async () => ({ ok, status, text: async () => texto ?? JSON.stringify(obj) });
const chamar = (obj, extra = {}, opts) => chamarPlanilha("confirmar", { itens: [] }, { config: CFG, fetchImpl: resp(obj, opts), ...extra });

test("sucesso: versão nova e versão antiga do script", async () => {
  const nova = await chamar({ ok: true, updated: 2, nao_processados: [], sync: true }, { esperados: 2 });
  assert.equal(nova.ok, true); assert.equal(nova.estado, "sucesso"); assert.equal(nova.sincronizacaoPendente, false);
  const antiga = await chamar({ ok: true, acao: "confirmar", updated: 2 }, { esperados: 2 });
  assert.equal(antiga.ok, true);
  const umaLinha = await chamarPlanilha("recebido", { id_linha: "A-1" }, { config: CFG, fetchImpl: resp({ ok: true, linha: 7 }) });
  assert.equal(umaLinha.ok, true);
});

test("ID ambíguo (uma linha): recusado, identifica as linhas, NÃO é sucesso", async () => {
  const r = await chamarPlanilha("recebido", { id_linha: "MERC-ITE-4351" }, { config: CFG, fetchImpl: resp({ erro: "id_linha ambíguo: ...", ambiguo: true, id_linha: "MERC-ITE-4351", linhas: [4, 5] }) });
  assert.equal(r.ok, false); assert.equal(r.estado, "recusado"); assert.deepEqual(r.naoProcessados[0].linhas, [4, 5]); assert.equal(r.naoProcessados[0].motivo, "id_ambiguo");
  assert.match(mensagemPlanilha(r, { perfil: "admin" }), /NÃO foi atualizada[\s\S]*MERC-ITE-4351[\s\S]*linhas 4, 5/);
});

test("lote parcial: estado parcial, itens não processados listados com nome do item", async () => {
  const r = await chamar({ ok: false, updated: 2, parcial: true, nao_processados: [{ id_linha: "X-1", motivo: "id_ambiguo", linhas: [4, 5], ceg: "MERCARI", nome_do_item: "Item Mercari" }], erro: "Atualização PARCIAL: 1 item(ns)" });
  assert.equal(r.ok, false); assert.equal(r.estado, "parcial"); assert.equal(r.atualizados, 2);
  const joiner = mensagemPlanilha(r), admin = mensagemPlanilha(r, { perfil: "admin" });
  assert.match(joiner, /só em parte/); assert.match(joiner, /MERCARI — Item Mercari/); assert.doesNotMatch(joiner, /linhas 4/);
  assert.match(admin, /PARCIAL[\s\S]*MERCARI — Item Mercari \(o código \(ID\) está repetido na planilha; linhas 4, 5\)/);
});

test("lote totalmente recusado: estado recusado, nenhum sucesso", async () => {
  const r = await chamar({ ok: false, updated: 0, nao_processados: [{ id_linha: "A", motivo: "nao_encontrado" }, { id_linha: "B", motivo: "id_ambiguo", linhas: [1, 2] }] });
  assert.equal(r.estado, "recusado"); assert.equal(r.ok, false); assert.equal(r.naoProcessados.length, 2);
});

test("script ANTIGO que silenciosamente atualizou menos do que o esperado é detectado pela contagem", async () => {
  const itens = [{ valor_item: 10 }, { frete_inter: 5 }, { valor_item: 0 }];
  assert.equal(esperadosConfirmacao(itens), 2);
  const parcial = await chamar({ ok: true, updated: 1 }, { esperados: 2 });
  assert.equal(parcial.estado, "parcial"); assert.match(parcial.erro, /1 de 2/);
  const nenhum = await chamar({ ok: true, updated: 0 }, { esperados: 2 });
  assert.equal(nenhum.estado, "recusado");
});

test("planilha alterada mas SYNC falhou: ok continua true, mas o aviso aparece", async () => {
  const r = await chamar({ ok: true, updated: 1, nao_processados: [], sync: false, aviso: "A planilha foi atualizada, mas a sincronização ..." }, { esperados: 1 });
  assert.equal(r.ok, true); assert.equal(r.sincronizacaoPendente, true);
  assert.match(mensagemPlanilha(r, { perfil: "admin" }), /atualizada, mas a sincronização com o site falhou/);
  assert.match(mensagemPlanilha(r), /pode demorar alguns minutos/);
});

test("sem tudo certo não há mensagem (nada a avisar)", async () => {
  const r = await chamar({ ok: true, updated: 1, nao_processados: [], sync: true }, { esperados: 1 });
  assert.equal(mensagemPlanilha(r), null); assert.equal(mensagemPlanilha(r, { perfil: "admin" }), null);
});

test("erro do script (token, colunas, não achou): recusado com o texto do erro", async () => {
  const r = await chamar({ erro: "Token inválido" });
  assert.equal(r.estado, "recusado"); assert.equal(r.erro, "Token inválido"); assert.match(mensagemPlanilha(r, { perfil: "admin" }), /Token inválido/);
});

test("rede, HTTP, JSON inválido e timeout: 'indeterminado' (não afirma sucesso nem falha), nunca lança", async () => {
  const falha = async () => { throw new TypeError("Failed to fetch"); };
  const a = await chamarPlanilha("recebido", {}, { config: CFG, fetchImpl: falha });
  assert.equal(a.estado, "indeterminado"); assert.equal(a.ok, false);
  const b = await chamarPlanilha("recebido", {}, { config: CFG, fetchImpl: resp({}, { ok: false, status: 500 }) }); assert.equal(b.estado, "indeterminado"); assert.match(b.erro, /500/);
  const c = await chamarPlanilha("recebido", {}, { config: CFG, fetchImpl: resp(null, { texto: "<html>Erro</html>" }) }); assert.equal(c.estado, "indeterminado");
  const lento = (url, opts) => new Promise((_, rej) => opts.signal.addEventListener("abort", () => { const e = new Error("abort"); e.name = "AbortError"; rej(e); }));
  const d = await chamarPlanilha("recebido", {}, { config: CFG, fetchImpl: lento, timeoutMs: 20 }); assert.equal(d.estado, "indeterminado"); assert.match(d.erro, /demorou demais/);
  assert.match(mensagemPlanilha(a, { perfil: "admin" }), /não foi possível confirmar/); assert.match(mensagemPlanilha(a), /Não conseguimos confirmar/);
});

test("itens sem código (ID) são informados mesmo quando a planilha respondeu sucesso", async () => {
  const r = await chamar({ ok: true, updated: 1, nao_processados: [], sync: true }, { esperados: 1 });
  const msg = mensagemPlanilha(r, { itensSemId: [{ ceg: "BTS", nome_do_item: "Lightstick", id_linha: "" }] });
  assert.match(msg, /não têm código na planilha[\s\S]*BTS — Lightstick/);
});

test("a requisição vai para a FUNÇÃO do Supabase com o login de quem usa o site; o corpo leva só ação e dados (nenhum token da planilha)", async () => {
  let capturado;
  await chamarPlanilha("recebido", { id_linha: "A-1" }, { config: CFG, fetchImpl: async (url, o) => { capturado = { url, o }; return { ok: true, status: 200, text: async () => '{"ok":true}' }; } });
  assert.equal(capturado.url, CFG.url); assert.equal(capturado.o.method, "POST"); assert.equal(capturado.o.headers["Content-Type"], "application/json");
  assert.equal(capturado.o.headers.apikey, "chave-publica"); assert.equal(capturado.o.headers.Authorization, "Bearer jwt-de-quem-esta-logado");
  assert.deepEqual(JSON.parse(capturado.o.body), { acao: "recebido", id_linha: "A-1" });
  await chamarPlanilha("recebido", {}, { config: { ...CFG, token: null }, fetchImpl: async (url, o) => { capturado = { url, o }; return { ok: true, status: 200, text: async () => '{"ok":true}' }; } });
  assert.equal(capturado.o.headers.Authorization, "Bearer chave-publica", "sem login, vai a chave pública e a função decide");
});

test("recusa da função (4xx com mensagem) = RECUSADO com o motivo; 5xx e 502 'indeterminado' = indeterminado; nenhum dos dois é sucesso", async () => {
  const negado = await chamarPlanilha("cancelar", { itens: [] }, { config: CFG, fetchImpl: resp({ erro: "somente a administração", negado: true }, { ok: false, status: 403 }) });
  assert.equal(negado.estado, "recusado"); assert.equal(negado.ok, false); assert.match(negado.erro, /somente a administração/);
  assert.match(mensagemPlanilha(negado, { perfil: "admin" }), /NÃO foi atualizada/);
  const indet = await chamarPlanilha("confirmar", { itens: [] }, { config: CFG, fetchImpl: resp({ erro: "A planilha não respondeu. Não foi possível confirmar se foi atualizada.", indeterminado: true }, { ok: false, status: 502 }) });
  assert.equal(indet.estado, "indeterminado"); assert.equal(indet.ok, false); assert.match(indet.erro, /não foi possível confirmar/i);
  const semCorpo = await chamarPlanilha("confirmar", {}, { config: CFG, fetchImpl: resp(null, { ok: false, status: 401, texto: "" }) });
  assert.equal(semCorpo.estado, "indeterminado");
});

test("a chamada NÃO é repetida sozinha: um pedido = uma requisição, mesmo com resposta indeterminada", async () => {
  let n = 0;
  const r = await chamarPlanilha("confirmar", { itens: [] }, { config: CFG, fetchImpl: async () => { n++; throw new TypeError("Failed to fetch"); } });
  assert.equal(r.estado, "indeterminado"); assert.equal(n, 1);
});

test("interpretarResposta: resposta vazia ou não-objeto é indeterminado", () => {
  assert.equal(interpretarResposta("x", null).estado, "indeterminado"); assert.equal(interpretarResposta("x", "texto").estado, "indeterminado");
});

test("GUARDA: nenhuma chamada ao Apps Script fora do módulo e nenhum `.catch(() => {})` engolindo a resposta", () => {
  for (const f of ["src/App.jsx", "src/LandingPage.jsx"]) {
    const codigo = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.equal((codigo.match(/script\.google\.com\/macros/g) || []).length, 0, f + " ainda chama o Apps Script direto");
    assert.equal((codigo.match(/anticeg-pag-2026/g) || []).length, 0, f + " ainda tem o token solto");
  }
});

test("escrita parcial com updated=0 (script gravou algo e falhou): estado parcial, nunca 'recusado'/'nada alterado'", async () => {
  const r = await chamar({ ok: false, updated: 0, parcial: true, nao_processados: [{ id_linha: "X-1", motivo: "escrita_parcial", linhas: [8], ceg: "UNIC", nome_do_item: "Photocard" }], erro: "Atualização PARCIAL: 1 item(ns) não processado(s)" });
  assert.equal(r.ok, false); assert.equal(r.estado, "parcial");
  const adm = mensagemPlanilha(r, { perfil: "admin" });
  assert.match(adm, /PARCIAL/); assert.doesNotMatch(adm, /NÃO foi atualizada/); assert.match(adm, /gravação parou no meio/); assert.doesNotMatch(adm, /0 item/);
});

test("exceção do script depois de gravar (novo_joiner/repassar sem lista de itens): parcial com o texto do script; sem parcial continua recusa", async () => {
  const p = await chamar({ ok: false, parcial: true, erro: "Operação interrompida DEPOIS de gravar parte dos dados (x). A planilha foi alterada em parte: confira antes de repetir.", sync: true });
  assert.equal(p.estado, "parcial"); assert.match(mensagemPlanilha(p, { perfil: "admin" }), /alterada em parte/);
  const j = await chamar({ ok: false, parcial: true, cadastro_criado: true, codigo_gerado: false, erro: "Cadastro CRIADO (aba Dados e MASTERLIST linha 9317), mas o NUM/ID NÃO foi gerado." });
  assert.equal(j.estado, "parcial"); assert.equal(j.ok, false);
  const recusa = await chamar({ erro: "id_linha não encontrado" });
  assert.equal(recusa.estado, "recusado");
});

test("GUARDA: o código do navegador não contém o token do Apps Script nem o endereço do Web App", () => {
  for (const f of ["src/planilhaApi.js", "src/App.jsx", "src/LandingPage.jsx"]) {
    const codigo = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.doesNotMatch(codigo, /anticeg-pag-2026/, f + " ainda tem o token"); assert.doesNotMatch(codigo, /script.google.com/, f + " ainda tem o endereço do Apps Script");
    assert.doesNotMatch(codigo, /VITE_PLANILHA_(URL|TOKEN)/, f + " ainda lê token/endereço do ambiente do navegador");
  }
});

test("GUARDA: as ações de ADMINISTRAÇÃO chamam a planilha com o login da administradora (admin: true); as demais, com o da joiner", () => {
  const trechos = {};
  for (const arq of ["src/App.jsx", "src/LandingPage.jsx"]) {
    const partes = readFileSync(new URL("../" + arq, import.meta.url), "utf8").split('chamarPlanilha("').slice(1);
    for (const p of partes) { const acao = p.slice(0, p.indexOf('"')); const ate = p.indexOf(".then("); (trechos[acao] ||= []).push(p.slice(0, ate > 0 ? ate : 600)); }
  }
  assert.deepEqual(Object.keys(trechos).sort(), ["aprovar_disponivel", "atualizar_joiner", "cancelar", "confirmar", "novo_joiner", "recebido", "repassar"]);
  for (const acao of ["cancelar", "repassar", "aprovar_disponivel"]) assert.ok(trechos[acao].every(t => t.includes("admin: true")), acao + " precisa de admin: true");
  for (const acao of ["confirmar", "recebido", "atualizar_joiner"]) assert.ok(trechos[acao].every(t => !t.includes("admin: true")), acao + " não deve usar o login de admin");
  // novo_joiner existe nos dois mundos: aprovação da administradora (admin: true) e pedido de cadastro do visitante (sem admin)
  assert.ok(trechos.novo_joiner.some(t => t.includes("admin: true")) && trechos.novo_joiner.some(t => !t.includes("admin: true")));
});
