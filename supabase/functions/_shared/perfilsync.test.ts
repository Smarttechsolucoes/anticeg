// Testes da fila de saída do perfil SEM rede: planilha e banco simulados.
// Rodar: node --test supabase/functions/_shared/perfilsync.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { processarFila, tratarPerfilSync } from "./perfilsync.ts";
import type { DepsPerfilSync, ItemPerfil } from "./perfilsync.ts";

const SEGREDO = "segredo-do-apps-script-123";
const item = (id: number, extra: Partial<ItemPerfil> = {}): ItemPerfil => ({ id, joiner_id: id, tipo: "email", dados: { twitter: "@ana", email_novo: "ana.nova@exemplo.com" }, tentativas: 0, ...extra });
function montar(itens: ItemPerfil[], resposta: (corpo: Record<string, unknown>) => { status: number; json: unknown } | Promise<{ status: number; json: unknown }> = () => ({ status: 200, json: { ok: true, updated: 1 } })) {
  const marcas: [number, boolean, string | null][] = []; const chamadas: Record<string, unknown>[] = [];
  const deps: DepsPerfilSync = {
    env: n => ({ PLANILHA_URL: "https://script.google.com/macros/s/AAA/exec", PLANILHA_TOKEN: SEGREDO, SUPABASE_SERVICE_ROLE_KEY: "chave-servico" } as Record<string, string>)[n],
    resolverToken: async t => { if (t === "token-admin") return { admin: true, cog: null }; if (t === "token-ana") return { admin: false, cog: "ana" }; throw new Error("inválido"); },
    proximos: async () => itens, marcar: async (id, ok, erro) => { marcas.push([id, ok, erro]); },
    planilha: async (_u, corpo) => { chamadas.push(corpo); return await resposta(corpo); },
  };
  return { deps, marcas, chamadas };
}
const chamar = (deps: DepsPerfilSync, token?: string, metodo = "POST") => tratarPerfilSync(new Request("https://x/functions/v1/perfil-sync", { method: metodo, headers: token ? { authorization: "Bearer " + token } : {} }), deps);

test("envia o e-mail novo à aba Dados pela ação atualizar_joiner (com o @ da pessoa) e marca como enviado", async () => {
  const m = montar([item(1)]); const r = await processarFila(m.deps);
  assert.deepEqual(r, { lidos: 1, enviados: 1, falharam: 0, parou: false });
  assert.deepEqual(m.chamadas[0], { acao: "atualizar_joiner", token: SEGREDO, twitter_antigo: "@ana", email_novo: "ana.nova@exemplo.com" });
  assert.deepEqual(m.marcas, [[1, true, null]]);
});
test("falha da planilha FICA REGISTRADA (sem perder o item), o segredo nunca aparece na mensagem e a planilha fora do ar não é martelada", async () => {
  const m = montar([item(1), item(2), item(3), item(4), item(5)], () => ({ status: 200, json: { erro: "Joiner não encontrado " + SEGREDO } }));
  const r = await processarFila(m.deps);
  assert.equal(r.enviados, 0); assert.equal(r.falharam, 3); assert.equal(r.parou, true, "depois de 3 falhas seguidas para de insistir");
  assert.equal(m.chamadas.length, 3); assert.ok(m.marcas.every(([, ok, erro]) => ok === false && !String(erro).includes(SEGREDO)), "falha marcada e sem o segredo");
});
test("erro de rede vira falha registrada; item inválido é falha registrada (não derruba os outros)", async () => {
  let n = 0;
  const m = montar([item(1), item(2, { dados: {} }), item(3)], async () => { n++; if (n === 1) throw new Error("rede"); return { status: 200, json: { ok: true } }; });
  const r = await processarFila(m.deps);
  assert.equal(r.enviados, 1); assert.equal(r.falharam, 2);
  assert.deepEqual(m.marcas.map(([id, ok]) => [id, ok]), [[1, false], [2, false], [3, true]]);
});
test("sem PLANILHA_URL/PLANILHA_TOKEN: erro e nada é chamado", async () => {
  const m = montar([item(1)]); m.deps.env = () => undefined;
  await assert.rejects(processarFila(m.deps), /não configurada/); assert.equal(m.chamadas.length, 0);
});
test("quem pode chamar: administradora e servidor; visitante, conta comum e token inválido recebem 403; GET 405; a resposta tem só contagens", async () => {
  const m = montar([item(1)]);
  for (const tk of [undefined, "token-ana", "invalido"]) assert.equal((await chamar(m.deps, tk)).status, 403);
  assert.equal(m.chamadas.length, 0, "nada chega à planilha para quem não pode");
  const a = await chamar(m.deps, "token-admin"); assert.equal(a.status, 200); const corpo = await a.json(); assert.deepEqual(Object.keys(corpo).sort(), ["enviados", "falharam", "lidos", "parou"]);
  assert.equal((await chamar(m.deps, "chave-servico")).status, 200);
  assert.equal((await chamar(m.deps, "token-admin", "GET")).status, 405);
});

// ------------------------------------------------------------------ E1: tarefas de cadastro (nome/e-mail -> Dados), estado atual + versão, falha definitiva x transitória
const estado = (extra: Record<string, unknown> = {}) => ({ id_site: 239, twitter: "@ana", nome: "Ana Souza", email: "ana@exemplo.com", versao: 7, campos: ["nome"], ...extra });
const itemTarefa = (id: number, tarefa: number): ItemPerfil => ({ id, joiner_id: 239, tipo: "cadastro", dados: { tarefa_id: tarefa }, tentativas: 0 });
function montarCadastro(itens: ItemPerfil[], resposta: (corpo: Record<string, unknown>) => { status: number; json: unknown } | Promise<{ status: number; json: unknown }>, est: (id: number) => unknown = () => estado()) {
  const m = montar(itens, resposta); const marcas4: [number, boolean, string | null, boolean | undefined][] = [];
  m.deps.marcar = async (id, ok, erro, definitivo) => { marcas4.push([id, ok, erro, definitivo]); };
  m.deps.estado = async (t) => est(t) as never;
  return { ...m, marcas4 };
}
test("tarefa de cadastro: envia o ESTADO atual com a versão da tarefa e só os campos alterados (ação atualizar_cadastro)", async () => {
  const m = montarCadastro([itemTarefa(1, 7)], () => ({ status: 200, json: { ok: true } }));
  const r = await processarFila(m.deps);
  assert.deepEqual(r, { lidos: 1, enviados: 1, falharam: 0, parou: false });
  assert.deepEqual(m.chamadas[0], { acao: "atualizar_cadastro", token: SEGREDO, id_site: 239, twitter: "@ana", nome: "Ana Souza", email: "ana@exemplo.com", versao: 7, campos: ["nome"] });
  assert.deepEqual(m.marcas4, [[1, true, null, false]]);
});
test("falha DEFINITIVA da planilha (linha não encontrada/ambígua) é marcada como definitiva e NÃO conta para 'planilha fora do ar'", async () => {
  const m = montarCadastro([1, 2, 3, 4, 5].map(i => itemTarefa(i, i)), () => ({ status: 200, json: { erro: "Linha não encontrada", definitivo: true, motivo: "linha_nao_encontrada" } }));
  const r = await processarFila(m.deps);
  assert.equal(r.lidos, 5); assert.equal(r.falharam, 5); assert.equal(r.parou, false, "não para: o problema é de cada cadastro, não da planilha");
  assert.ok(m.marcas4.every(x => x[1] === false && x[3] === true && String(x[2]).startsWith("linha_nao_encontrada:")));
});
test("falha TRANSITÓRIA (planilha ocupada, HTTP 500, resposta ilegível) NÃO é definitiva e, repetida, para o lote", async () => {
  const m = montarCadastro([1, 2, 3, 4, 5].map(i => itemTarefa(i, i)), () => ({ status: 200, json: { erro: "A planilha está ocupada", ocupado: true } }));
  const r = await processarFila(m.deps);
  assert.equal(r.parou, true); assert.equal(r.falharam, 3); assert.ok(m.marcas4.every(x => x[3] === false));
  const m2 = montarCadastro([itemTarefa(1, 1)], () => ({ status: 500, json: null })); await processarFila(m2.deps);
  assert.deepEqual(m2.marcas4[0].slice(0, 2), [1, false]); assert.equal(m2.marcas4[0][3], false); assert.match(String(m2.marcas4[0][2]), /HTTP 500/);
});
test("tarefa que não existe mais: falha definitiva sem chamar a planilha", async () => {
  const m = montarCadastro([itemTarefa(1, 99)], () => ({ status: 200, json: { ok: true } }), () => null);
  await processarFila(m.deps);
  assert.equal(m.chamadas.length, 0); assert.deepEqual([m.marcas4[0][1], m.marcas4[0][3]], [false, true]); assert.match(String(m.marcas4[0][2]), /^tarefa_nao_encontrada/);
});
test("o segredo nunca aparece na mensagem de falha e o motivo só tem letras minúsculas, números e _", async () => {
  const m = montarCadastro([itemTarefa(1, 1)], () => ({ status: 200, json: { erro: "falhou " + SEGREDO, definitivo: true, motivo: "Motivo Ruim!" + SEGREDO } }));
  await processarFila(m.deps);
  assert.ok(!JSON.stringify(m.marcas4).includes(SEGREDO));
});
test("a fila antiga de e-mail continua como era (ação atualizar_joiner, sem 'definitivo')", async () => {
  const m = montarCadastro([item(1)], () => ({ status: 200, json: { ok: true } }));
  await processarFila(m.deps);
  assert.equal(m.chamadas[0].acao, "atualizar_joiner");
});

// ------------------------------------------------------------------ agendador por segredo (Apps Script a cada minuto), sem o botão do admin
test("agendador: com o segredo correto a fila é processada SEM login de administradora; segredo errado/ausente/curto é recusado (403)", async () => {
  const SEG = "segredo-do-agendador-0123456789abcdef";
  const com = (cab: Record<string, string>, env: Record<string, string> = { PERFIL_SYNC_SEGREDO: SEG }) => {
    const m = montarCadastro([itemTarefa(1, 7)], () => ({ status: 200, json: { ok: true } })); const base = m.deps.env;
    m.deps.env = n => env[n] ?? base(n);
    return { m, res: tratarPerfilSync(new Request("https://x/functions/v1/perfil-sync", { method: "POST", headers: { authorization: "Bearer chave-anon-publica", ...cab } }), m.deps) };
  };
  const ok1 = com({ "x-cron-secret": SEG }); const r1 = await ok1.res;
  assert.equal(r1.status, 200); assert.deepEqual(await r1.json(), { lidos: 1, enviados: 1, falharam: 0, parou: false }); assert.deepEqual(ok1.m.marcas4, [[1, true, null, false]]);
  for (const [nome, cab, env] of [["errado", { "x-cron-secret": SEG + "x" }, undefined], ["ausente", {}, undefined], ["segredo curto configurado", { "x-cron-secret": "curto" }, { PERFIL_SYNC_SEGREDO: "curto" }], ["sem segredo configurado", { "x-cron-secret": SEG }, { PERFIL_SYNC_SEGREDO: "" }]] as [string, Record<string, string>, Record<string, string> | undefined][]) {
    const x = com(cab, env); const r = await x.res; assert.equal(r.status, 403, nome); assert.equal(x.m.chamadas.length, 0, nome + ": a planilha não foi chamada");
  }
  assert.ok(!JSON.stringify(await (await com({ "x-cron-secret": SEG }).res).json()).includes(SEG), "a resposta nunca traz o segredo");
});
