// Testes do tratamento HTTP de e-mail e push SEM rede real: o "fetch" do provedor é simulado e nenhum e-mail ou push é enviado.
// Rodar: node --test supabase/functions/_shared/handlers.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { tratarEmail, tratarPush, cabecalhosCors } from "./handlers.ts";
import type { DepsEmail, DepsPush } from "./handlers.ts";
import type { Db } from "./notificacoes.ts";

const AGORA = new Date("2026-10-14T15:00:00Z");
const CHAVE_SG = "SG.chave-secreta-do-provedor";
const SERVICO = "chave-de-servico";

function montarEmail(opcoes: { env?: Record<string, string | undefined>; sgOk?: boolean; demandas?: unknown[]; tokens?: Record<string, { admin: boolean; cog: string | null }> } = {}) {
  const envios: { evento: string; referencia: string; destinatario: string }[] = [];
  const chamadasProvedor: { url: string; corpo: Record<string, any>; auth: string }[] = [];
  const desfeitos: string[][] = [];
  const demandas = (opcoes.demandas ?? [{ id: 101, joiner_cog: "ana", status: "em_analise", created_at: new Date(AGORA.getTime() - 120000).toISOString(), valor_total: 50, itens: [{ nome_do_item: "Item", ceg: "X", valor_item: 50 }], motivo_rejeicao: null },
    { id: 102, joiner_cog: "bia", status: "rejeitado", created_at: new Date(AGORA.getTime() - 3600000).toISOString(), valor_total: 10, itens: [], motivo_rejeicao: "Valor errado" }]) as any[];
  const db: Db = {
    preCadastroRecente: async cog => cog === "nova" ? { cog: "nova", nome: "Nova", email: "nova@exemplo.com", created_at: new Date(AGORA.getTime() - 60000).toISOString() } : null,
    demanda: async id => demandas.find(d => d.id === id) ?? null,
    report: async () => null,
    joinersPorCog: async cog => [{ cog: "ana", nome: "Ana", email: "ana@exemplo.com" }, { cog: "bia", nome: "Bia", email: "bia@exemplo.com" }].filter(j => j.cog === cog.toLowerCase()),
    pendenciasDoJoiner: async () => [],
    contarEnvios: async () => 0,
    registrarEnvio: async e => { if (envios.some(x => x.evento === e.evento && x.referencia === e.referencia)) return false; envios.push(e); return true; },
  };
  const env: Record<string, string | undefined> = { SENDGRID_API_KEY: CHAVE_SG, SENDER_EMAIL: "no-reply@exemplo.com", SENDER_NAME: "Anti CEG", SUPABASE_SERVICE_ROLE_KEY: SERVICO, ...(opcoes.env ?? {}) };
  const tokens = opcoes.tokens ?? { "jwt-admin": { admin: true, cog: null }, "jwt-ana": { admin: false, cog: "ana" }, "jwt-bia": { admin: false, cog: "bia" } };
  const deps: DepsEmail = {
    env: n => env[n], db: () => db, agora: () => AGORA,
    resolverToken: async t => { if (!tokens[t]) throw new Error("token inválido"); return tokens[t]; },
    fetch: (async (url: string, init: any) => { chamadasProvedor.push({ url, corpo: JSON.parse(init.body), auth: init.headers.Authorization }); return new Response("{}", { status: opcoes.sgOk === false ? 500 : 202 }); }) as unknown as typeof fetch,
    desfazerEnvio: async (evento, dest) => { desfeitos.push([evento, dest]); const i = envios.findIndex(x => x.evento === evento && x.destinatario === dest); if (i >= 0) envios.splice(i, 1); },
  };
  return { deps, envios, chamadasProvedor, desfeitos };
}
const post = (corpo: unknown, cab: Record<string, string> = {}) => new Request("https://x.supabase.co/functions/v1/email-evento", { method: "POST", headers: { "content-type": "application/json", ...cab }, body: JSON.stringify(corpo) });

test("CORS: só a origem do site recebe permissão; qualquer outra não recebe o cabeçalho", async () => {
  const m = montarEmail();
  const ok = await tratarEmail(new Request("https://x/f", { method: "OPTIONS", headers: { origin: "https://anticeg.vercel.app" } }), m.deps);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://anticeg.vercel.app");
  const mau = await tratarEmail(new Request("https://x/f", { method: "OPTIONS", headers: { origin: "https://golpe.example" } }), m.deps);
  assert.equal(mau.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(cabecalhosCors(null, "https://a.com")["Access-Control-Allow-Origin"], undefined);
});
test("só aceita POST", async () => {
  const m = montarEmail();
  for (const metodo of ["GET", "PUT", "DELETE"]) assert.equal((await tratarEmail(new Request("https://x/f", { method: metodo }), m.deps)).status, 405);
});
test("sem a chave do provedor configurada: 500 e nada é enviado", async () => {
  const m = montarEmail({ env: { SENDGRID_API_KEY: undefined } });
  assert.equal((await tratarEmail(post({ evento: "comprovante_recebido", demanda_id: 101 }), m.deps)).status, 500);
  assert.equal(m.chamadasProvedor.length, 0);
});
test("pedido no formato ANTIGO (to_email/assunto/corpo) é recusado e NADA chega ao provedor", async () => {
  const m = montarEmail();
  const r = await tratarEmail(post({ to_email: "vitima@x.com", assunto: "Golpe", corpo: "<a href=x>clique</a>" }), m.deps);
  assert.equal(r.status, 400); assert.equal(m.chamadasProvedor.length, 0);
});
test("comprovante recebido (modo legado, sem login): 1 e-mail ao CADASTRO, assunto e corpo do sistema, e a chave do provedor nunca aparece na resposta", async () => {
  const m = montarEmail();
  const r = await tratarEmail(post({ evento: "comprovante_recebido", demanda_id: 101 }, { authorization: "Bearer chave-anonima-publica" }), m.deps);
  assert.equal(r.status, 200);
  const texto = await r.text();
  assert.deepEqual(JSON.parse(texto), { ok: true });
  assert.doesNotMatch(texto, /SG\.|ana@exemplo|Comprovante/);
  assert.equal(m.chamadasProvedor.length, 1);
  const c = m.chamadasProvedor[0];
  assert.equal(c.url, "https://api.sendgrid.com/v3/mail/send"); assert.equal(c.auth, `Bearer ${CHAVE_SG}`);
  assert.equal(c.corpo.personalizations[0].to[0].email, "ana@exemplo.com"); assert.equal(c.corpo.from.email, "no-reply@exemplo.com");
  assert.match(c.corpo.subject, /Comprovante recebido/);
});
test("o mesmo comprovante não gera um segundo e-mail", async () => {
  const m = montarEmail();
  await tratarEmail(post({ evento: "comprovante_recebido", demanda_id: 101 }), m.deps);
  const r2 = await tratarEmail(post({ evento: "comprovante_recebido", demanda_id: 101 }), m.deps);
  assert.equal(r2.status, 409); assert.equal(m.chamadasProvedor.length, 1);
});
test("falha do provedor: 502 SEM vazar detalhes, e a vaga é devolvida para uma nova tentativa legítima", async () => {
  const m = montarEmail({ sgOk: false });
  const r = await tratarEmail(post({ evento: "comprovante_recebido", demanda_id: 101 }), m.deps);
  assert.equal(r.status, 502); assert.deepEqual(await r.json(), { error: "falha no provedor de e-mail" });
  assert.deepEqual(m.desfeitos, [["comprovante_recebido", "ana@exemplo.com"]]); assert.equal(m.envios.length, 0);
});
test("depois do lançamento (PERMITIR_COMPROVANTE_ANONIMO=false): anônimo é recusado, e a própria joiner logada funciona", async () => {
  const m = montarEmail({ env: { PERMITIR_COMPROVANTE_ANONIMO: "false" } });
  assert.equal((await tratarEmail(post({ evento: "comprovante_recebido", demanda_id: 101 }, { authorization: "Bearer chave-anonima-publica" }), m.deps)).status, 401);
  assert.equal(m.chamadasProvedor.length, 0);
  assert.equal((await tratarEmail(post({ evento: "comprovante_recebido", demanda_id: 101 }, { authorization: "Bearer jwt-ana" }), m.deps)).status, 200);
  assert.equal(m.chamadasProvedor.length, 1);
});
test("uma joiner logada NÃO aciona o e-mail da demanda de OUTRA joiner", async () => {
  const m = montarEmail({ env: { PERMITIR_COMPROVANTE_ANONIMO: "false" } });
  const r = await tratarEmail(post({ evento: "comprovante_recebido", demanda_id: 101 }, { authorization: "Bearer jwt-bia" }), m.deps);
  assert.equal(r.status, 403); assert.equal(m.chamadasProvedor.length, 0); assert.equal(m.envios.length, 0);
});
test("eventos de administração: administradora e serviço passam; joiner logada e anônimo não", async () => {
  const pedido = { evento: "comprovante_recusado", demanda_id: 102 };
  const sem = montarEmail(); assert.equal((await tratarEmail(post(pedido), sem.deps)).status, 401);
  const joiner = montarEmail(); assert.equal((await tratarEmail(post(pedido, { authorization: "Bearer jwt-bia" }), joiner.deps)).status, 403);
  const falso = montarEmail(); assert.equal((await tratarEmail(post(pedido, { authorization: "Bearer jwt-que-nao-existe" }), falso.deps)).status, 401);
  assert.equal(sem.chamadasProvedor.length + joiner.chamadasProvedor.length + falso.chamadasProvedor.length, 0);
  const adm = montarEmail(); assert.equal((await tratarEmail(post(pedido, { authorization: "Bearer jwt-admin" }), adm.deps)).status, 200);
  assert.match(adm.chamadasProvedor[0].corpo.content[0].value, /Valor errado/); assert.equal(adm.chamadasProvedor[0].corpo.personalizations[0].to[0].email, "bia@exemplo.com");
  const srv = montarEmail(); assert.equal((await tratarEmail(post(pedido, { authorization: `Bearer ${SERVICO}` }), srv.deps)).status, 200);
});

function montarPush(opcoes: { env?: Record<string, string | undefined>; erroEnvio?: { statusCode: number } } = {}) {
  const enviados: { payload: string; endpoint: string }[] = [];
  const env: Record<string, string | undefined> = { VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", SUPABASE_SERVICE_ROLE_KEY: SERVICO, ...(opcoes.env ?? {}) };
  const deps: DepsPush = {
    env: n => env[n],
    resolverToken: async t => { if (t === "jwt-admin") return { admin: true, cog: null }; if (t === "jwt-ana") return { admin: false, cog: "ana" }; throw new Error("inválido"); },
    enviar: async (sub, payload) => { if (opcoes.erroEnvio) throw Object.assign(new Error("push"), opcoes.erroEnvio); enviados.push({ payload, endpoint: sub.endpoint }); },
  };
  return { deps, enviados };
}
const pedidoPush = { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "k", auth: "a" } }, title: "T", body: "B", url: "/masterlist" };
const postPush = (corpo: unknown, cab: Record<string, string> = {}) => new Request("https://x/functions/v1/push-evento", { method: "POST", headers: { "content-type": "application/json", ...cab }, body: JSON.stringify(corpo) });

test("push: anônimo e joiner logada são recusados (401) e nada é enviado", async () => {
  const m = montarPush();
  assert.equal((await tratarPush(postPush(pedidoPush), m.deps)).status, 401);
  assert.equal((await tratarPush(postPush(pedidoPush, { authorization: "Bearer chave-anonima-publica" }), m.deps)).status, 401);
  assert.equal((await tratarPush(postPush(pedidoPush, { authorization: "Bearer jwt-ana" }), m.deps)).status, 401);
  assert.equal(m.enviados.length, 0);
});
test("push: administradora e serviço enviam; endereço e URL são validados", async () => {
  const m = montarPush();
  assert.equal((await tratarPush(postPush(pedidoPush, { authorization: "Bearer jwt-admin" }), m.deps)).status, 200);
  assert.equal((await tratarPush(postPush(pedidoPush, { authorization: `Bearer ${SERVICO}` }), m.deps)).status, 200);
  assert.equal(m.enviados.length, 2);
  const mau = await tratarPush(postPush({ ...pedidoPush, subscription: { ...pedidoPush.subscription, endpoint: "https://169.254.169.254/x" } }, { authorization: "Bearer jwt-admin" }), m.deps);
  assert.equal(mau.status, 400); assert.equal(m.enviados.length, 2);
  await tratarPush(postPush({ ...pedidoPush, url: "//golpe.example" }, { authorization: "Bearer jwt-admin" }), m.deps);
  assert.equal(JSON.parse(m.enviados[2].payload).url, "/");
});
test("push: inscrição expirada vira 410; sem VAPID vira 500; método errado 405", async () => {
  assert.equal((await tratarPush(postPush(pedidoPush, { authorization: "Bearer jwt-admin" }), montarPush({ erroEnvio: { statusCode: 410 } }).deps)).status, 410);
  assert.equal((await tratarPush(postPush(pedidoPush, { authorization: "Bearer jwt-admin" }), montarPush({ env: { VAPID_PRIVATE_KEY: undefined } }).deps)).status, 500);
  assert.equal((await tratarPush(new Request("https://x/f", { method: "GET" }), montarPush().deps)).status, 405);
});

test("novo_cadastro pelo handler: vai para o ADMIN_NOTIFY_EMAIL da configuração; sem a configuração, 422 e nada é enviado", async () => {
  const com = montarEmail({ env: { ADMIN_NOTIFY_EMAIL: "admin@exemplo.com" } });
  const r = await tratarEmail(post({ evento: "novo_cadastro", joiner_cog: "nova" }, { authorization: "Bearer chave-anonima-publica" }), com.deps);
  assert.equal(r.status, 200); assert.equal(com.chamadasProvedor[0].corpo.personalizations[0].to[0].email, "admin@exemplo.com");
  const sem = montarEmail();
  const r2 = await tratarEmail(post({ evento: "novo_cadastro", joiner_cog: "nova" }), sem.deps);
  assert.equal(r2.status, 422); assert.equal(sem.chamadasProvedor.length, 0);
});

test("MODO SECO: valida tudo, não chama o provedor, não exige chave e devolve a vaga (o envio real depois continua possível)", async () => {
  const m = montarEmail({ env: { EMAIL_MODO_SECO: "true", SENDGRID_API_KEY: undefined, SENDER_EMAIL: undefined } });
  const r = await tratarEmail(post({ evento: "comprovante_recebido", demanda_id: 101 }, { authorization: "Bearer chave-anonima-publica" }), m.deps);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, seco: true });
  assert.equal(m.chamadasProvedor.length, 0); assert.equal(m.envios.length, 0);
  // a autorização continua valendo no modo seco
  const proibido = await tratarEmail(post({ evento: "lembrete_pagamento", joiner_cog: "ana" }), m.deps);
  assert.equal(proibido.status, 401);
  const antigo = await tratarEmail(post({ to_email: "x@y.com", assunto: "a", corpo: "b" }), m.deps);
  assert.equal(antigo.status, 400);
  // depois de desligar o modo seco, o mesmo comprovante ainda pode ser enviado de verdade
  const real = montarEmail({ env: {} }); real.envios.push(...m.envios);
  assert.equal((await tratarEmail(post({ evento: "comprovante_recebido", demanda_id: 101 }), real.deps)).status, 200);
  assert.equal(real.chamadasProvedor.length, 1);
});
