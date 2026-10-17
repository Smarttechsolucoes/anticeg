// Testes do proxy seguro da planilha (sem rede, sem banco, sem Apps Script). Rodar:  node --test supabase/functions/_shared/planilha.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { tratarPlanilha } from "./planilha.ts";
import type { DbPlanilha, DepsPlanilha, LinhaML, DemandaP } from "./planilha.ts";

const AGORA = new Date("2026-10-16T15:00:00Z");
const min = (m: number) => new Date(AGORA.getTime() - m * 60000).toISOString();
const SEGREDO = "segredo-do-apps-script-123456";

interface Cenario {
  linhas?: LinhaML[]; demandas?: DemandaP[]; claims?: { masterlist_id: number; joiner_cog: string | null }[]; repassos?: { item_id: number }[];
  reports?: { item_id: number; joiner_cog: string | null; created_at: string }[]; confirmacoes?: { joiner_cog: string | null; twitter_novo: string | null; email_novo: string | null; created_at: string }[];
  pre?: { cog: string; nome: string | null; email: string | null; created_at: string } | null; joiners?: { cog: string; twitter: string | null }[];
}
const L = (id: number, id_linha: string, cog: string, extra: Partial<LinhaML> = {}): LinhaML => ({ id, id_linha, cog, nome: cog, ceg: "ABCD", nome_do_item: "Item " + id, ...extra });
const DEM = (id: number, cog: string, status: string, itens: unknown, created_at = min(10)): DemandaP => ({ id, joiner_cog: cog, status, created_at, itens });

function montar(c: Cenario = {}, { env = {}, resposta, quem = { admin: false, cog: null as string | null }, falharFetch = false }: { env?: Record<string, string>; resposta?: () => Response; quem?: { admin: boolean; cog: string | null }; falharFetch?: boolean } = {}) {
  const enviados: { url: string; corpo: Record<string, unknown> }[] = [];
  const db: DbPlanilha = {
    linhasPorIdLinha: async ids => (c.linhas ?? []).filter(l => ids.includes(String(l.id_linha))),
    demandas: async ({ status, desde }) => (c.demandas ?? []).filter(d => status.includes(d.status) && (!desde || d.created_at >= desde)),
    claimsAprovados: async ids => (c.claims ?? []).filter(x => ids.includes(x.masterlist_id)),
    repassosAprovados: async ids => (c.repassos ?? []).filter(x => ids.includes(x.item_id)),
    reportsRecentes: async (ids, desde) => (c.reports ?? []).filter(x => ids.includes(x.item_id) && x.created_at >= desde),
    confirmacoesRecentes: async desde => (c.confirmacoes ?? []).filter(x => x.created_at >= desde),
    preCadastroRecente: async () => c.pre ?? null,
    joinerPorCog: async cog => (c.joiners ?? []).find(j => j.cog === cog) ?? null,
    joinersComTwitter: async tw => (c.joiners ?? []).filter(j => String(j.twitter ?? "").replace(/^@/, "").toLowerCase() === tw).map(j => ({ cog: j.cog })),
  };
  const deps: DepsPlanilha = {
    env: n => ({ PLANILHA_URL: "https://script.google.com/macros/s/AAA/exec", PLANILHA_TOKEN: SEGREDO, SUPABASE_SERVICE_ROLE_KEY: "chave-de-servico-xyz", ...env } as Record<string, string>)[n],
    resolverToken: async t => { if (t === "token-expirado") throw new Error("expirado"); if (t === "token-admin") return { admin: true, cog: null }; if (t === "token-ana") return { admin: false, cog: "ana" }; if (t === "token-bia") return { admin: false, cog: "bia" }; return quem; },
    db, agora: () => AGORA,
    fetch: (async (url: string, init: { body: string }) => {
      if (falharFetch) throw new Error("rede");
      enviados.push({ url: String(url), corpo: JSON.parse(init.body) });
      return resposta ? resposta() : new Response(JSON.stringify({ ok: true, updated: 1, sync: true }), { status: 200 });
    }) as unknown as typeof fetch,
  };
  const chamar = async (corpo: unknown, token?: string, extra: Record<string, string> = {}) => {
    const r = await tratarPlanilha(new Request("https://x/functions/v1/planilha-acao", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}), ...extra }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }), deps);
    return { status: r.status, json: await r.json().catch(() => null) as any, texto: "" };
  };
  return { chamar, enviados };
}

// ─────────────── entrada, segredo e passagem ───────────────
test("método e formato: OPTIONS responde CORS só para origens permitidas; GET 405; corpo inválido 400; ação desconhecida 400; corpo grande 413", async () => {
  const { chamar } = montar();
  const o = await tratarPlanilha(new Request("https://x", { method: "OPTIONS", headers: { origin: "https://anticeg.vercel.app" } }), { ...({} as DepsPlanilha), env: () => undefined });
  assert.equal(o.headers.get("access-control-allow-origin"), "https://anticeg.vercel.app");
  const o2 = await tratarPlanilha(new Request("https://x", { method: "OPTIONS", headers: { origin: "https://golpe.com" } }), { ...({} as DepsPlanilha), env: () => undefined });
  assert.equal(o2.headers.get("access-control-allow-origin"), null);
  const g = await tratarPlanilha(new Request("https://x", { method: "GET" }), { ...({} as DepsPlanilha), env: () => undefined }); assert.equal(g.status, 405);
  assert.equal((await chamar("isto não é json")).status, 400);
  assert.equal((await chamar([1, 2])).status, 400);
  assert.equal((await chamar({ acao: "apagar_tudo" })).status, 400);
  assert.equal((await chamar({ acao: "confirmar", lixo: "x".repeat(70000) })).status, 413);
});

test("sem PLANILHA_URL/PLANILHA_TOKEN configurados: 500 sem detalhes e nada é chamado", async () => {
  const { chamar, enviados } = montar({}, { env: { PLANILHA_TOKEN: "" } });
  const r = await chamar({ acao: "novo_joiner", nome: "A", twitter: "@a" }, "token-admin");
  assert.equal(r.status, 500); assert.deepEqual(enviados, []);
});

test("a chave de serviço NÃO é aceita como credencial", async () => {
  const { chamar, enviados } = montar();
  const r = await chamar({ acao: "novo_joiner", nome: "Zoe", twitter: "@zoe" }, "chave-de-servico-xyz");
  assert.equal(r.status, 403); assert.deepEqual(enviados, []);
});

test("o token do Apps Script é do SERVIDOR: o que o navegador manda em token/url/acao extra é ignorado, só campos da lista branca seguem, e o segredo nunca volta", async () => {
  const { chamar, enviados } = montar({ pre: { cog: "zoe", nome: "Zoe", email: "z@e.com", created_at: min(2) } });
  const r = await chamar({ acao: "novo_joiner", nome: "Zoe", twitter: "@zoe", email: "z@e.com", token: "anticeg-pag-2026", url: "https://golpe", itens: [1], extra: "x" });
  assert.equal(r.status, 200);
  assert.equal(enviados.length, 1); assert.equal(enviados[0].url, "https://script.google.com/macros/s/AAA/exec");
  assert.deepEqual(Object.keys(enviados[0].corpo).sort(), ["acao", "email", "nome", "token", "twitter"]);
  assert.equal(enviados[0].corpo.token, SEGREDO);
  assert.ok(!JSON.stringify(r.json).includes(SEGREDO));
});

test("resposta do Apps Script passa como está (parcial, não processados, sync); falha de rede, HTTP de erro ou resposta ilegível viram 502 'indeterminado' sem sucesso falso", async () => {
  const parcial = { ok: false, parcial: true, updated: 0, nao_processados: [{ id_linha: "X-1", motivo: "escrita_parcial" }], sync: true, erro: "Atualização PARCIAL" };
  const cen = { linhas: [L(1, "X-1", "ana")], demandas: [DEM(1, "ana", "em_analise", [{ id_linha: "X-1", valor_item: 10 }])] };
  const a = await montar(cen, { resposta: () => new Response(JSON.stringify(parcial), { status: 200 }) }).chamar({ acao: "confirmar", itens: [{ id_linha: "X-1", valor_item: 10 }] });
  assert.equal(a.status, 200); assert.deepEqual(a.json, parcial);
  const b = await montar(cen, { falharFetch: true }).chamar({ acao: "confirmar", itens: [{ id_linha: "X-1", valor_item: 10 }] });
  assert.equal(b.status, 502); assert.equal(b.json.indeterminado, true);
  const c = await montar(cen, { resposta: () => new Response("erro", { status: 500 }) }).chamar({ acao: "confirmar", itens: [{ id_linha: "X-1", valor_item: 10 }] });
  assert.equal(c.status, 502); assert.equal(c.json.indeterminado, true);
  const d = await montar(cen, { resposta: () => new Response("<html>", { status: 200 }) }).chamar({ acao: "confirmar", itens: [{ id_linha: "X-1", valor_item: 10 }] });
  assert.equal(d.status, 502); assert.match(d.json.erro, /ilegível/);
});

// ─────────────── confirmar ───────────────
const CEN_PAG = () => ({ linhas: [L(1, "ABCD-PHO-0001", "ana"), L(2, "ABCD-PHO-0002", "ana"), L(3, "ABCD-PHO-0003", "bia")], demandas: [DEM(1, "ana", "em_analise", [{ id_linha: "ABCD-PHO-0001", valor_item: 10, frete_inter: 0 }, { id_linha: "ABCD-PHO-0002", valor_item: 8, frete_inter: 5 }])] });
test("confirmar: só o que consta de um pagamento EM ANÁLISE recente da dona; valores acima do registrado, item de outra pessoa, sem pagamento ou pagamento antigo são recusados", async () => {
  const ok = await montar(CEN_PAG()).chamar({ acao: "confirmar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }, { id_linha: "ABCD-PHO-0002", valor_item: 8, frete_inter: 5 }] });
  assert.equal(ok.status, 200);
  const frete = await montar(CEN_PAG()).chamar({ acao: "confirmar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10, frete_inter: 5 }] });
  assert.equal(frete.status, 403, "o pagamento registrado não tinha frete nesse item");
  const alheio = await montar(CEN_PAG()).chamar({ acao: "confirmar", itens: [{ id_linha: "ABCD-PHO-0003", valor_item: 10 }] });
  assert.equal(alheio.status, 403);
  const semPag = await montar({ ...CEN_PAG(), demandas: [] }).chamar({ acao: "confirmar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }] });
  assert.equal(semPag.status, 403);
  const velho = await montar({ ...CEN_PAG(), demandas: [DEM(1, "ana", "em_analise", [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }], min(400))] }).chamar({ acao: "confirmar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }] });
  assert.equal(velho.status, 403);
  const rejeitado = await montar({ ...CEN_PAG(), demandas: [DEM(1, "ana", "rejeitado", [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }])] }).chamar({ acao: "confirmar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }] });
  assert.equal(rejeitado.status, 403, "pagamento já rejeitado não pode ser confirmado");
  const invalido = await montar(CEN_PAG()).chamar({ acao: "confirmar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: -5 }] });
  assert.equal(invalido.status, 400);
  assert.equal((await montar(CEN_PAG()).chamar({ acao: "confirmar", itens: [] })).status, 400);
  assert.equal((await montar(CEN_PAG()).chamar({ acao: "confirmar", itens: Array.from({ length: 101 }, () => ({ id_linha: "ABCD-PHO-0001", valor_item: 1 })) })).status, 400);
});
test("confirmar com login das joiners exigido: anônimo 401; a conta precisa ser a dona do pagamento", async () => {
  const E = { PLANILHA_EXIGIR_CONTA: "true" };
  const corpo = { acao: "confirmar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }] };
  assert.equal((await montar(CEN_PAG(), { env: E }).chamar(corpo)).status, 401);
  assert.equal((await montar(CEN_PAG(), { env: E }).chamar(corpo, "token-bia")).status, 403, "bia não confirma o pagamento da ana");
  assert.equal((await montar(CEN_PAG(), { env: E }).chamar(corpo, "token-ana")).status, 200);
  assert.equal((await montar(CEN_PAG(), { env: E }).chamar(corpo, "token-admin")).status, 401, "a administradora não usa a ação de confirmar da joiner");
});

test("confirmar: mesmo que a ana tenha um pagamento em análise listando um item que está no nome da BIA, o item da bia não é marcado (a dona da linha precisa ser quem pagou)", async () => {
  const cen = { ...CEN_PAG(), demandas: [DEM(1, "ana", "em_analise", [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }, { id_linha: "ABCD-PHO-0003", valor_item: 10 }])] };
  const r = await montar(cen).chamar({ acao: "confirmar", itens: [{ id_linha: "ABCD-PHO-0003", valor_item: 10 }] });
  assert.equal(r.status, 403);
});

// ─────────────── cancelar ───────────────
test("cancelar: somente a administradora, e só itens de comprovante REJEITADO", async () => {
  const cen = { linhas: [L(1, "ABCD-PHO-0001", "ana")], demandas: [DEM(1, "ana", "rejeitado", [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }], min(5000))] };
  const corpo = { acao: "cancelar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }] };
  assert.equal((await montar(cen).chamar(corpo)).status, 403, "visitante");
  assert.equal((await montar(cen).chamar(corpo, "token-ana")).status, 403, "joiner, mesmo a dona");
  assert.equal((await montar(cen).chamar(corpo, "token-admin")).status, 200);
  assert.equal((await montar({ ...cen, demandas: [DEM(1, "ana", "em_analise", [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }])] }).chamar(corpo, "token-admin")).status, 403, "comprovante ainda em análise não é desmarcado");
  assert.equal((await montar(cen).chamar({ acao: "cancelar", itens: [{ id_linha: "ABCD-PHO-0009", valor_item: 10 }] }, "token-admin")).status, 403, "item fora de qualquer rejeição");
});

// ─────────────── recebido ───────────────
test("recebido: a dona (conta) ou, sem login, quem tem um relato RECENTE do dono; item de outra pessoa nunca; dica de CEG/item desambigua", async () => {
  const cen = { linhas: [L(1, "DUP-1", "ana", { ceg: "SKZOO", nome_do_item: "Plush Lee" }), L(2, "DUP-1", "bia", { ceg: "SKZOO", nome_do_item: "Plush Han" })], reports: [{ item_id: 1, joiner_cog: "ana", created_at: min(3) }] };
  const E = { PLANILHA_EXIGIR_CONTA: "true" };
  const dica = { acao: "recebido", id_linha: "DUP-1", ceg: "SKZOO", nome_do_item: "Plush Lee" };
  assert.equal((await montar(cen, { env: E }).chamar(dica, "token-ana")).status, 200);
  assert.equal((await montar(cen, { env: E }).chamar(dica, "token-bia")).status, 403, "bia não marca o item da ana");
  assert.equal((await montar(cen, { env: E }).chamar(dica)).status, 401);
  assert.equal((await montar(cen).chamar(dica)).status, 200, "sem login ainda: há relato recente da dona");
  assert.equal((await montar({ ...cen, reports: [] }).chamar(dica)).status, 403, "sem relato recente");
  assert.equal((await montar({ ...cen, reports: [{ item_id: 1, joiner_cog: "ana", created_at: min(120) }] }).chamar(dica)).status, 403, "relato antigo");
  assert.equal((await montar(cen, { env: E }).chamar({ acao: "recebido", id_linha: "DUP-1" }, "token-ana")).status, 403, "sem dica, o ID repetido abrange itens de outra pessoa");
  assert.equal((await montar(cen).chamar({ acao: "recebido", id_linha: "NAO-EXISTE" })).status, 403);
});

// ─────────────── repassar e aprovar_disponivel ───────────────
test("repassar: só a administradora, com repasse APROVADO e o novo dono já gravado no item", async () => {
  const cen = { linhas: [L(5, "ABCD-PHO-0005", "carla")], repassos: [{ item_id: 5 }] };
  const corpo = { acao: "repassar", id_linha: "ABCD-PHO-0005", novo_nome: "Carla", novo_twitter: "@carla" };
  assert.equal((await montar(cen).chamar(corpo)).status, 403);
  assert.equal((await montar(cen).chamar(corpo, "token-ana")).status, 403);
  const ok = montar(cen); const r = await ok.chamar(corpo, "token-admin"); assert.equal(r.status, 200);
  assert.deepEqual(ok.enviados[0].corpo, { acao: "repassar", id_linha: "ABCD-PHO-0005", ceg: "", nome_do_item: "", novo_nome: "Carla", novo_twitter: "@carla", token: SEGREDO });
  assert.equal((await montar({ ...cen, repassos: [] }).chamar(corpo, "token-admin")).status, 403, "sem repasse aprovado");
  assert.equal((await montar(cen).chamar({ ...corpo, novo_twitter: "@outra" }, "token-admin")).status, 403, "o item não pertence ao novo dono informado");
  assert.equal((await montar(cen).chamar({ ...corpo, novo_nome: "" }, "token-admin")).status, 400);
});
test("aprovar_disponivel: só a administradora, com claim APROVADO daquele novo dono", async () => {
  const cen = { linhas: [L(7, "ABCD-PHO-0007", "dora")], claims: [{ masterlist_id: 7, joiner_cog: "dora" }] };
  const corpo = { acao: "aprovar_disponivel", id_linha: "ABCD-PHO-0007", novo_nome: "Dora", novo_twitter: "@dora", vencimento: "20/10/2026" };
  assert.equal((await montar(cen).chamar(corpo, "token-ana")).status, 403);
  assert.equal((await montar(cen).chamar(corpo, "token-admin")).status, 200);
  assert.equal((await montar({ ...cen, claims: [] }).chamar(corpo, "token-admin")).status, 403);
  assert.equal((await montar({ ...cen, claims: [{ masterlist_id: 7, joiner_cog: "outra" }] }).chamar(corpo, "token-admin")).status, 403, "claim aprovado é de outra pessoa");
  assert.equal((await montar(cen).chamar({ ...corpo, vencimento: "" }, "token-admin")).status, 400);
});

// ─────────────── atualizar_joiner ───────────────
test("atualizar_joiner: precisa de uma alteração de cadastro RECENTE com estes dados; o @ antigo não pode ser de outra pessoa; a administradora passa", async () => {
  const cen = { confirmacoes: [{ joiner_cog: "ana", twitter_novo: "@ana_nova", email_novo: "ana@exemplo.com", created_at: min(2) }], joiners: [{ cog: "ana", twitter: "@ana_nova" }, { cog: "bia", twitter: "@bia" }] };
  const corpo = { acao: "atualizar_joiner", twitter_antigo: "@ana_velha", twitter_novo: "@ana_nova", email_novo: "ana@exemplo.com", nome_novo: "Ana" };
  const ok = montar(cen); assert.equal((await ok.chamar(corpo)).status, 200);
  assert.deepEqual(Object.keys(ok.enviados[0].corpo).sort(), ["acao", "email_novo", "token", "twitter_antigo", "twitter_novo"], "nome_novo e demais campos não seguem");
  assert.equal((await montar(cen).chamar({ ...corpo, twitter_antigo: "@bia" })).status, 403, "tentativa de trocar o @ da bia");
  assert.equal((await montar({ ...cen, confirmacoes: [] }).chamar(corpo)).status, 403, "sem alteração de cadastro recente");
  assert.equal((await montar({ ...cen, confirmacoes: [{ ...cen.confirmacoes[0], created_at: min(90) }] }).chamar(corpo)).status, 403);
  assert.equal((await montar(cen).chamar({ ...corpo, email_novo: "golpe@x.com" })).status, 403, "e-mail diferente do registrado");
  assert.equal((await montar({ ...cen, joiners: [{ cog: "ana", twitter: "@ana_velha" }, { cog: "bia", twitter: "@bia" }] }).chamar(corpo)).status, 403, "o cadastro da ana ainda tem o @ antigo: a planilha não segue um @ que o cadastro não tem");
  assert.equal((await montar({ ...cen, joiners: [{ cog: "bia", twitter: "@bia" }] }).chamar(corpo)).status, 403, "cadastro da dona inexistente");
  const E = { PLANILHA_EXIGIR_CONTA: "true" };
  assert.equal((await montar(cen, { env: E }).chamar(corpo)).status, 401);
  assert.equal((await montar(cen, { env: E }).chamar(corpo, "token-ana")).status, 200);
  assert.equal((await montar(cen, { env: E }).chamar(corpo, "token-bia")).status, 403, "bia não usa a alteração da ana");
  assert.equal((await montar({ confirmacoes: [] }).chamar(corpo, "token-admin")).status, 200, "a administradora altera sem alteração recente");
  assert.equal((await montar(cen).chamar({ acao: "atualizar_joiner", twitter_antigo: "@x y", twitter_novo: "@z" })).status, 400);
  assert.equal((await montar(cen).chamar({ acao: "atualizar_joiner", twitter_antigo: "@ana_velha" })).status, 400);
});

// ─────────────── novo_joiner ───────────────
test("novo_joiner: a administradora, ou um pedido de cadastro RECENTE com os mesmos dados; qualquer outro caso é recusado", async () => {
  const pre = { cog: "zoe", nome: "Zoe Silva", email: "zoe@exemplo.com", created_at: min(3) };
  const corpo = { acao: "novo_joiner", nome: "Zoe Silva", twitter: "@zoe", email: "zoe@exemplo.com" };
  assert.equal((await montar({ pre }).chamar(corpo)).status, 200, "visitante com pedido recente");
  assert.equal((await montar({ pre: null }).chamar(corpo)).status, 403, "sem pedido de cadastro");
  assert.equal((await montar({ pre: { ...pre, created_at: min(300) } }).chamar(corpo)).status, 403, "pedido antigo");
  assert.equal((await montar({ pre }).chamar({ ...corpo, nome: "Outra Pessoa" })).status, 403, "nome diferente");
  assert.equal((await montar({ pre }).chamar({ ...corpo, email: "outro@exemplo.com" })).status, 403, "e-mail diferente");
  assert.equal((await montar({ pre: null }).chamar(corpo, "token-admin")).status, 200, "administradora aprovando");
  assert.equal((await montar({ pre: null }).chamar(corpo, "token-ana")).status, 403, "joiner comum sem pedido recente");
  assert.equal((await montar({ pre }).chamar({ ...corpo, twitter: "@bad handle" })).status, 400);
  const e = montar({ pre }); await e.chamar(corpo); assert.equal(e.enviados[0].corpo.twitter, "@zoe");
});

test("token expirado/ inválido vira anônimo (não erro 500) e continua sujeito às mesmas regras", async () => {
  const cen = { linhas: [L(1, "X-1", "ana")], repassos: [{ item_id: 1 }] };
  const r = await montar(cen).chamar({ acao: "repassar", id_linha: "X-1", novo_nome: "Ana", novo_twitter: "@ana" }, "token-expirado");
  assert.equal(r.status, 403);
});

// ─────────────── MATRIZ: as 7 ações × identidade × modo (sem login das joiners | com login exigido) ───────────────
test("MATRIZ de autorização: cada ação, para visitante, dona do item, outra joiner e administradora, nos dois modos", async () => {
  const cen: Cenario = {
    linhas: [L(1, "A-1", "ana"), L(2, "B-1", "bia"), L(3, "C-1", "dani"), L(4, "D-1", "eva")],
    demandas: [DEM(1, "ana", "em_analise", [{ id_linha: "A-1", valor_item: 10 }]), DEM(2, "bia", "rejeitado", [{ id_linha: "B-1", valor_item: 10 }])],
    reports: [{ item_id: 1, joiner_cog: "ana", created_at: min(5) }],
    repassos: [{ item_id: 3 }], claims: [{ masterlist_id: 4, joiner_cog: "eva" }],
    confirmacoes: [{ joiner_cog: "ana", twitter_novo: "@ana_nova", email_novo: null, created_at: min(3) }],
    joiners: [{ cog: "ana", twitter: "@ana_nova" }, { cog: "bia", twitter: "@bia" }],
    pre: { cog: "nova", nome: "Nova Joiner", email: null, created_at: min(2) },
  };
  const item = [{ id_linha: "A-1", ceg: "ABCD", nome_do_item: "Item 1", valor_item: 10, frete_inter: 0, taxa_rf: 0 }];
  const itemB = [{ id_linha: "B-1", ceg: "ABCD", nome_do_item: "Item 2", valor_item: 10, frete_inter: 0, taxa_rf: 0 }];
  const acoes: Record<string, Record<string, unknown>> = {
    confirmar: { acao: "confirmar", itens: item },
    cancelar: { acao: "cancelar", itens: itemB },
    recebido: { acao: "recebido", id_linha: "A-1", ceg: "ABCD", nome_do_item: "Item 1" },
    repassar: { acao: "repassar", id_linha: "C-1", novo_nome: "Dani", novo_twitter: "@dani" },
    aprovar_disponivel: { acao: "aprovar_disponivel", id_linha: "D-1", novo_nome: "Eva", novo_twitter: "@eva", vencimento: "01/12" },
    atualizar_joiner: { acao: "atualizar_joiner", twitter_antigo: "@ana_velha", twitter_novo: "@ana_nova" },
    novo_joiner: { acao: "novo_joiner", nome: "Nova Joiner", twitter: "@nova", email: "" },
  };
  // [visitante, ana (dona), bia (outra joiner), administradora]
  const esperado: Record<string, { legado: number[]; login: number[] }> = {
    confirmar:          { legado: [200, 200, 403, 200], login: [401, 200, 403, 401] },   // com login exigido, confirmar/recebido são ações DA JOINER: a administradora não as usa (menor privilégio)
    cancelar:           { legado: [403, 403, 403, 200], login: [403, 403, 403, 200] },
    recebido:           { legado: [200, 200, 403, 200], login: [401, 200, 403, 401] },
    repassar:           { legado: [403, 403, 403, 200], login: [403, 403, 403, 200] },
    aprovar_disponivel: { legado: [403, 403, 403, 200], login: [403, 403, 403, 200] },
    atualizar_joiner:   { legado: [200, 200, 403, 200], login: [401, 200, 403, 200] },
    novo_joiner:        { legado: [200, 200, 200, 200], login: [200, 200, 200, 200] },
  };
  const ids = [undefined, "token-ana", "token-bia", "token-admin"];
  for (const [nome, corpo] of Object.entries(acoes)) {
    for (const modo of ["legado", "login"] as const) {
      for (let i = 0; i < ids.length; i++) {
        const r = await montar(cen, { env: modo === "login" ? { PLANILHA_EXIGIR_CONTA: "true" } : {} }).chamar(corpo, ids[i]);
        assert.equal(r.status, esperado[nome][modo][i], `${nome} · ${modo} · ${["visitante", "ana (dona)", "bia (outra)", "administradora"][i]}`);
      }
    }
  }
});

// ─────────────── tentativas de CONTORNAR as permissões administrativas ───────────────
test("contorno: nenhuma combinação de cabeçalho, campo extra, caixa da ação, token expirado ou chave de serviço faz uma não-administradora executar cancelar/repassar/aprovar_disponivel", async () => {
  const cen: Cenario = {
    linhas: [L(2, "B-1", "bia"), L(3, "C-1", "dani"), L(4, "D-1", "eva")],
    demandas: [DEM(2, "bia", "rejeitado", [{ id_linha: "B-1", valor_item: 10 }])],
    repassos: [{ item_id: 3 }], claims: [{ masterlist_id: 4, joiner_cog: "eva" }],
  };
  const itemB = [{ id_linha: "B-1", ceg: "ABCD", nome_do_item: "Item 2", valor_item: 10, frete_inter: 0, taxa_rf: 0 }];
  const admins: Record<string, unknown>[] = [
    { acao: "cancelar", itens: itemB },
    { acao: "repassar", id_linha: "C-1", novo_nome: "Dani", novo_twitter: "@dani" },
    { acao: "aprovar_disponivel", id_linha: "D-1", novo_nome: "Eva", novo_twitter: "@eva", vencimento: "01/12" },
  ];
  const disfarces: { rotulo: string; token?: string; extra?: Record<string, string>; mais?: Record<string, unknown> }[] = [
    { rotulo: "visitante com cabeçalho x-admin", extra: { "x-admin": "true", "x-user-role": "admin" } },
    { rotulo: "visitante com campos admin/quem/cog no corpo", mais: { admin: true, quem: "admin", cog: "admin", role: "admin", is_admin: true } },
    { rotulo: "joiner (ana) com os mesmos campos", token: "token-ana", mais: { admin: true, quem: "admin", cog: "ana" } },
    { rotulo: "joiner (bia) dona do comprovante rejeitado", token: "token-bia" },
    { rotulo: "token expirado de administradora", token: "token-expirado" },
    { rotulo: "chave de serviço como credencial", token: "chave-de-servico-xyz" },
    { rotulo: "cabeçalho Authorization malformado", extra: { authorization: "token-admin" } },
  ];
  for (const corpo of admins) for (const d of disfarces) {
    const m = montar(cen, { env: { PLANILHA_EXIGIR_CONTA: "true" } });
    const r = await m.chamar({ ...corpo, ...(d.mais ?? {}) }, d.token, d.extra);
    assert.ok(r.status === 403 || r.status === 401, `${corpo.acao} · ${d.rotulo} -> ${r.status}`);
    assert.equal(m.enviados.length, 0, `${corpo.acao} · ${d.rotulo}: nada pode ter ido ao Apps Script`);
    const m2 = montar(cen);
    const r2 = await m2.chamar({ ...corpo, ...(d.mais ?? {}) }, d.token, d.extra);
    assert.ok(r2.status === 403 || r2.status === 401, `(modo legado) ${corpo.acao} · ${d.rotulo} -> ${r2.status}`);
    assert.equal(m2.enviados.length, 0);
  }
  for (const acao of ["CANCELAR", "cancelar ", "Cancelar", "__proto__", "constructor", "toString", "", null, 1, ["cancelar"], { x: 1 }]) {
    const m = montar(cen); const r = await m.chamar({ acao, itens: itemB }, "token-admin");
    assert.equal(r.status, 400, `ação ${JSON.stringify(acao)} deve ser inválida`); assert.equal(m.enviados.length, 0);
  }
  // a administradora, mesmo com credencial válida, só consegue o que o BANCO já registrou (nada de item arbitrário)
  const m = montar(cen);
  assert.equal((await m.chamar({ acao: "cancelar", itens: [{ ...itemB[0], id_linha: "OUTRO-1" }] }, "token-admin")).status, 403, "item que não está em comprovante rejeitado");
  assert.equal((await m.chamar({ acao: "repassar", id_linha: "C-1", novo_nome: "X", novo_twitter: "@outro" }, "token-admin")).status, 403, "novo dono diferente do gravado");
  assert.equal((await m.chamar({ acao: "aprovar_disponivel", id_linha: "D-1", novo_nome: "X", novo_twitter: "@fulana", vencimento: "01/12" }, "token-admin")).status, 403, "claim de outra pessoa");
  assert.equal(m.enviados.length, 0);
});
