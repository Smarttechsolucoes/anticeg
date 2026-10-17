// Testes do papel staff_pagamentos no proxy da planilha (sem rede, sem banco, sem Apps Script). Rodar:  node --test supabase/functions/_shared/planilha.staff.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { tratarPlanilha } from "./planilha.ts";
import type { DbPlanilha, DepsPlanilha, LinhaML, DemandaP } from "./planilha.ts";

const AGORA = new Date("2026-10-18T15:00:00Z");
const min = (m: number) => new Date(AGORA.getTime() - m * 60000).toISOString();
const SEGREDO = "segredo-do-apps-script-123456";
const L = (id: number, id_linha: string, cog: string): LinhaML => ({ id, id_linha, cog, nome: cog, ceg: "ABCD", nome_do_item: "Item " + id });
const DEM = (id: number, cog: string, status: string, itens: unknown, created_at = min(60 * 24 * 3)): DemandaP => ({ id, joiner_cog: cog, status, created_at, itens });

function montar(c: { linhas?: LinhaML[]; demandas?: DemandaP[] } = {}) {
  const enviados: { corpo: Record<string, unknown> }[] = [];
  const db = {
    linhasPorIdLinha: async (ids: string[]) => (c.linhas ?? []).filter(l => ids.includes(String(l.id_linha))),
    demandas: async ({ status, desde }: { status: string[]; desde?: string }) => (c.demandas ?? []).filter(d => status.includes(d.status) && (!desde || d.created_at >= desde)),
    claimsAprovados: async () => [], repassosAprovados: async () => [], reportsRecentes: async () => [], confirmacoesRecentes: async () => [],
    preCadastroRecente: async () => null, joinerPorCog: async () => null, joinersComTwitter: async () => [],
  } as unknown as DbPlanilha;
  const deps: DepsPlanilha = {
    env: n => ({ PLANILHA_URL: "https://script.google.com/macros/s/AAA/exec", PLANILHA_TOKEN: SEGREDO, SUPABASE_SERVICE_ROLE_KEY: "chave-de-servico-xyz" } as Record<string, string>)[n],
    resolverToken: async t => {
      if (t === "token-admin") return { admin: true, cog: null };
      if (t === "token-staff") return { admin: false, staff: true, cog: null };
      if (t === "token-ana") return { admin: false, cog: "ana" };
      return { admin: false, cog: null };
    },
    db, agora: () => AGORA,
    fetch: (async (_u: string, init: { body: string }) => { enviados.push({ corpo: JSON.parse(init.body) }); return new Response(JSON.stringify({ ok: true, updated: 1, sync: true }), { status: 200 }); }) as unknown as typeof fetch,
  };
  const chamar = async (corpo: unknown, token?: string) => {
    const r = await tratarPlanilha(new Request("https://x/functions/v1/planilha-acao", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: JSON.stringify(corpo) }), deps);
    return { status: r.status, json: await r.json().catch(() => null) as any };
  };
  return { chamar, enviados };
}

// demanda PAGA há 3 dias (fora da janela de 180 min), da joiner ana; item 3 é da bia (pagamento de terceiro)
const CEN = () => ({
  linhas: [L(1, "ABCD-PHO-0001", "ana"), L(2, "ABCD-PHO-0002", "ana"), L(3, "ABCD-PHO-0003", "bia")],
  demandas: [DEM(1, "ana", "pago", [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }, { id_linha: "ABCD-PHO-0002", valor_item: 8, frete_inter: 5 }, { id_linha: "ABCD-PHO-0003", valor_item: 7 }]),
              DEM(2, "ana", "rejeitado", [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }])],
});
const confirmar = (itens: unknown[]) => ({ acao: "confirmar", itens });

test("staff confirma na planilha um item de demanda PAGA (fora da janela de 180 min) — o que a administração aprovou", async () => {
  const { chamar, enviados } = montar(CEN());
  const r = await chamar(confirmar([{ id_linha: "ABCD-PHO-0001", valor_item: 10 }, { id_linha: "ABCD-PHO-0002", valor_item: 8, frete_inter: 5 }]), "token-staff");
  assert.equal(r.status, 200);
  assert.equal(enviados.length, 1); assert.equal(enviados[0].corpo.acao, "confirmar"); assert.equal(enviados[0].corpo.token, SEGREDO);
  assert.doesNotMatch(JSON.stringify(r.json), new RegExp(SEGREDO), "a resposta nunca mostra o token do Apps Script");
});

test("admin geral também confirma demanda já PAGA (a RPC roda antes do confirmar)", async () => {
  assert.equal((await montar(CEN()).chamar(confirmar([{ id_linha: "ABCD-PHO-0001", valor_item: 10 }]), "token-admin")).status, 200);
});

test("a joiner NÃO ganha esse poder: item de demanda paga fora da janela continua recusado para ela", async () => {
  const { chamar, enviados } = montar(CEN());
  assert.equal((await chamar(confirmar([{ id_linha: "ABCD-PHO-0001", valor_item: 10 }]), "token-ana")).status, 403);
  assert.equal((await chamar(confirmar([{ id_linha: "ABCD-PHO-0001", valor_item: 10 }]))).status, 403);   // visitante
  assert.deepEqual(enviados, []);
});

test("staff: pagamento de TERCEIRO aceito pela administração é confirmável; componente que a demanda não cobra (frete) e item sem demanda NÃO", async () => {
  const { chamar, enviados } = montar(CEN());
  assert.equal((await chamar(confirmar([{ id_linha: "ABCD-PHO-0003", valor_item: 7 }]), "token-staff")).status, 200, "terceiro (linha da bia, pago por ana)");
  assert.equal((await chamar(confirmar([{ id_linha: "ABCD-PHO-0001", valor_item: 10, frete_inter: 5 }]), "token-staff")).status, 403, "frete que a demanda não cobra");
  assert.equal((await chamar(confirmar([{ id_linha: "ABCD-PHO-9999", valor_item: 1 }]), "token-staff")).status, 403, "item inexistente");
  assert.equal(enviados.length, 1, "só a chamada legítima chegou ao Apps Script");
});

test("staff: demanda EM ANÁLISE também vale (confirmar logo após aprovar, antes de o status gravar) e REJEITADA sozinha não vale", async () => {
  const cen = { linhas: [L(1, "ABCD-PHO-0001", "ana"), L(2, "ABCD-PHO-0002", "ana")], demandas: [DEM(1, "ana", "em_analise", [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }]), DEM(2, "ana", "rejeitado", [{ id_linha: "ABCD-PHO-0002", valor_item: 5 }])] };
  const { chamar } = montar(cen);
  assert.equal((await chamar(confirmar([{ id_linha: "ABCD-PHO-0001", valor_item: 10 }]), "token-staff")).status, 200);
  assert.equal((await chamar(confirmar([{ id_linha: "ABCD-PHO-0002", valor_item: 5 }]), "token-staff")).status, 403, "item só de demanda rejeitada não é confirmável");
});

test("staff cancela SOMENTE item de comprovante REJEITADO; item só de demanda paga é recusado; joiner e visitante nunca cancelam", async () => {
  const { chamar, enviados } = montar(CEN());
  assert.equal((await chamar({ acao: "cancelar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }] }, "token-staff")).status, 200, "item 1 está na demanda rejeitada 2");
  assert.equal((await chamar({ acao: "cancelar", itens: [{ id_linha: "ABCD-PHO-0002", valor_item: 8 }] }, "token-staff")).status, 403, "item 2 só está em demanda paga");
  assert.equal((await chamar({ acao: "cancelar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }] }, "token-ana")).status, 403);
  assert.equal((await chamar({ acao: "cancelar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }] })).status, 403);
  assert.equal(enviados.length, 1);
});

test("staff NÃO herda as outras ações de administração (repassar, aprovar_disponivel, novo_joiner, atualizar_joiner, recebido)", async () => {
  const { chamar, enviados } = montar({ ...CEN() });
  const pedidos = [
    { acao: "repassar", id_linha: "ABCD-PHO-0001", novo_nome: "Carla", novo_twitter: "@carla" },
    { acao: "aprovar_disponivel", id_linha: "ABCD-PHO-0001", novo_nome: "Dora", novo_twitter: "@dora", vencimento: "20/10/2026" },
    { acao: "novo_joiner", nome: "Eva", twitter: "@eva", email: "e@e.com" },
    { acao: "atualizar_joiner", twitter_antigo: "@ana", twitter_novo: "@ana2", nome: "Ana" },
    { acao: "recebido", id_linha: "ABCD-PHO-0001" },
  ];
  for (const p of pedidos) { const r = await chamar(p, "token-staff"); assert.ok(r.status === 401 || r.status === 403 || r.status === 400, `${p.acao} para staff deveria ser recusada, foi ${r.status}`); }
  assert.deepEqual(enviados, [], "nenhuma ação extra chegou ao Apps Script");
});

test("o navegador não escolhe o papel: campos admin/staff/papel no corpo e cabeçalhos x-admin são ignorados", async () => {
  const { chamar, enviados } = montar(CEN());
  const corpo = { acao: "cancelar", itens: [{ id_linha: "ABCD-PHO-0001", valor_item: 10 }], admin: true, staff: true, papel: "admin", is_admin: true, quem: "admin" };
  assert.equal((await chamar(corpo, "token-ana")).status, 403, "joiner com campos de admin no corpo continua recusada");
  assert.equal((await chamar(corpo)).status, 403, "visitante também");
  assert.deepEqual(enviados, []);
});

test("sem a função meu_papel_admin (ST1 ausente) o resolvedor cai no is_admin: simulação do contrato do index.ts", () => {
  // contrato: erro em meu_papel_admin => is_admin() decide; papel 'staff_pagamentos' => { admin:false, staff:true }
  const resolver = async (rpc: (n: string) => Promise<{ data: unknown; error: unknown }>) => {
    const { data: papel, error: erroPapel } = await rpc("meu_papel_admin");
    if (!erroPapel && papel === "admin") return { admin: true, cog: null };
    if (!erroPapel && papel === "staff_pagamentos") return { admin: false, staff: true, cog: null };
    if (erroPapel) { const { data: admin } = await rpc("is_admin"); if (admin === true) return { admin: true, cog: null }; }
    return { admin: false, cog: null };
  };
  return Promise.all([
    resolver(async n => n === "meu_papel_admin" ? { data: "staff_pagamentos", error: null } : { data: false, error: null }).then(r => assert.deepEqual(r, { admin: false, staff: true, cog: null })),
    resolver(async n => n === "meu_papel_admin" ? { data: null, error: { code: "PGRST202" } } : { data: true, error: null }).then(r => assert.deepEqual(r, { admin: true, cog: null })),
    resolver(async n => n === "meu_papel_admin" ? { data: null, error: null } : { data: true, error: null }).then(r => assert.deepEqual(r, { admin: false, cog: null })),   // conta comum com ST1: is_admin nem é consultado
  ]);
});
