// Testes do envio e da visualização de comprovantes SEM rede: o Storage e o banco são simulados; nenhum arquivo é enviado ou aberto de verdade.
// Rodar: node --test supabase/functions/_shared/comprovantes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { caminhoValido, validarPedidoUpload, tratarUploadComprovante, tratarUrlComprovante, LIMITE_BYTES, LIMITES_UPLOAD } from "./comprovantes.ts";
import type { DepsUpload, DepsUrl } from "./comprovantes.ts";

const SERVICO = "chave-de-servico";
const TOKENS: Record<string, { admin: boolean; cog: string | null }> = { "jwt-admin": { admin: true, cog: null }, "jwt-ana": { admin: false, cog: "ana" }, "jwt-bia": { admin: false, cog: "bia" }, "anon-key": { admin: false, cog: null } };

function montarUpload(opcoes: { env?: Record<string, string | undefined>; existentes?: string[]; usados?: Record<string, number> } = {}) {
  const usados = opcoes.usados ?? {}; const registrados: string[] = []; const donos: Record<string, string | null> = {}; const assinados: string[] = []; const existentes = new Set(opcoes.existentes ?? []);
  const env: Record<string, string | undefined> = { SUPABASE_SERVICE_ROLE_KEY: SERVICO, ...(opcoes.env ?? {}) };
  const deps: DepsUpload = {
    env: n => env[n],
    resolverToken: async t => { if (!TOKENS[t]) throw new Error("token inválido"); return TOKENS[t]; },
    contar: async chave => usados[chave] ?? 0,
    registrar: async (chave, a) => { registrados.push(chave); donos[a.bucket + "/" + a.path] = a.cog; usados[chave] = (usados[chave] ?? 0) + 1; },
    assinar: async (bucket, path) => { if (existentes.has(bucket + "/" + path)) return null; assinados.push(bucket + "/" + path); return { token: "token-de-uso-unico", path }; },
  };
  return { deps, registrados, assinados, donos };
}
const postUp = (corpo: unknown, auth?: string, extra: Record<string, string> = {}) => new Request("https://x.supabase.co/functions/v1/comprovante-upload", { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer " + auth } : {}), ...extra }, body: JSON.stringify(corpo) });
const pedido = (extra: Record<string, unknown> = {}) => ({ bucket: "comprovantes", path: "wmag/1700000000000.jpg", tipo: "image/jpeg", tamanho: 500000, ...extra });

test("caminho: aceita os formatos que o site usa e recusa travessia, barra inicial e caracteres estranhos", () => {
  for (const ok of ["wmag/1700000000000.jpg", "ana/1700000000000.png", "repassos/ana/1700000000000.pdf", "ana_1700000000000.jpg", "envio/42/comprovante_1700000000000.jpeg", "lightstick/ana-silva_1700.heic", "nandaverseo_c/1.webp"]) assert.equal(caminhoValido(ok), true, ok);
  for (const ruim of ["../segredo.jpg", "/abs/x.jpg", "a//b.jpg", "a/../b.jpg", "a/b c.jpg", "a/b?x=1.jpg", "a/b;rm.jpg", "", ".oculto/x.jpg", "a/b/c/d/e/f.jpg", "a/" + "x".repeat(90) + ".jpg", "a\\b.jpg"]) assert.equal(caminhoValido(ruim), false, ruim);
});

test("pedido de envio: bucket, tipo, tamanho e campos extras", () => {
  assert.equal(validarPedidoUpload(pedido()).ok, true);
  assert.equal(validarPedidoUpload(pedido({ bucket: "mercari-comprovantes", path: "ana_1700.png", tipo: "image/png" })).ok, true);
  assert.equal(validarPedidoUpload(pedido({ bucket: "avatars" })).ok, false, "outro bucket");
  assert.equal(validarPedidoUpload(pedido({ bucket: "anti-store" })).ok, false);
  assert.equal(validarPedidoUpload(pedido({ path: "wmag/x.exe", tipo: "application/octet-stream" })).ok, false, "extensão proibida");
  assert.equal(validarPedidoUpload(pedido({ path: "wmag/x.html", tipo: "text/html" })).ok, false);
  assert.equal(validarPedidoUpload(pedido({ path: "wmag/x.svg", tipo: "image/svg+xml" })).ok, false, "svg pode carregar script");
  assert.equal(validarPedidoUpload(pedido({ path: "wmag/x.jpg", tipo: "text/html" })).ok, false, "tipo não combina com a extensão");
  assert.equal(validarPedidoUpload(pedido({ tipo: "" })).ok, true, "navegador sem tipo: a extensão decide");
  assert.equal(validarPedidoUpload(pedido({ tipo: "application/octet-stream" })).ok, true);
  assert.equal(validarPedidoUpload(pedido({ tamanho: LIMITE_BYTES + 1 })).ok, false, "acima de 10 MB");
  assert.equal(validarPedidoUpload(pedido({ tamanho: 0 })).ok, false);
  assert.equal(validarPedidoUpload(pedido({ tamanho: "abc" })).ok, false);
  assert.equal(validarPedidoUpload({ ...pedido(), upsert: true }).ok, false, "campo extra (ex.: upsert) é recusado");
  assert.equal(validarPedidoUpload(null).ok, false);
  assert.equal(validarPedidoUpload([pedido()]).ok, false);
});

test("envio: visitante, joiner e administradora recebem token; o resultado não vaza nada além do necessário", async () => {
  for (const auth of [undefined, "anon-key", "jwt-ana", "jwt-admin"]) {
    const m = montarUpload();
    const r = await tratarUploadComprovante(postUp(pedido(), auth), m.deps, "1.2.3.4");
    assert.equal(r.status, 200, String(auth));
    const corpo = await r.json();
    assert.deepEqual(Object.keys(corpo).sort(), ["bucket", "ok", "path", "tipo", "token"]);
    assert.equal(corpo.path, "wmag/1700000000000.jpg");
    assert.deepEqual(m.assinados, ["comprovantes/wmag/1700000000000.jpg"]);
  }
});

test("envio: grava a DONA do arquivo (COG da conta); visitante e administradora ficam sem dona", async () => {
  const a = montarUpload(); await tratarUploadComprovante(postUp(pedido(), "jwt-ana"), a.deps, "1.1.1.1");
  assert.deepEqual(a.donos, { "comprovantes/wmag/1700000000000.jpg": "ana" });
  const v = montarUpload(); await tratarUploadComprovante(postUp(pedido()), v.deps, "1.1.1.1");
  assert.deepEqual(v.donos, { "comprovantes/wmag/1700000000000.jpg": null });
  const adm = montarUpload(); await tratarUploadComprovante(postUp(pedido(), "jwt-admin"), adm.deps, "1.1.1.1");
  assert.deepEqual(adm.donos, { "comprovantes/wmag/1700000000000.jpg": null });
});

test("envio: NUNCA sobrescreve um arquivo que já existe", async () => {
  const m = montarUpload({ existentes: ["comprovantes/wmag/1700000000000.jpg"] });
  const r = await tratarUploadComprovante(postUp(pedido(), "jwt-ana"), m.deps, "1.2.3.4");
  assert.equal(r.status, 409); assert.equal(m.registrados.length, 0);
});

test("envio: pedidos inválidos viram 400 e não gastam a cota", async () => {
  const m = montarUpload();
  for (const ruim of [pedido({ bucket: "avatars" }), pedido({ path: "../x.jpg" }), pedido({ path: "a/x.exe" }), pedido({ tamanho: LIMITE_BYTES + 1 }), { ...pedido(), upsert: true }, "texto", null]) {
    const r = await tratarUploadComprovante(postUp(ruim, "jwt-ana"), m.deps, "1.2.3.4");
    assert.equal(r.status, 400, JSON.stringify(ruim)?.slice(0, 40));
  }
  assert.equal(m.registrados.length, 0);
});

test("envio: limite por hora (visitante por rede, joiner por conta); administradora sem limite", async () => {
  const m = montarUpload({ usados: { "ip:9.9.9.9": LIMITES_UPLOAD.anonimoPorHora, "cog:ana": LIMITES_UPLOAD.joinerPorHora, "cog:bia": 3 } });
  assert.equal((await tratarUploadComprovante(postUp(pedido()), m.deps, "9.9.9.9")).status, 429, "visitante acima do limite");
  assert.equal((await tratarUploadComprovante(postUp(pedido()), m.deps, "8.8.8.8")).status, 200, "outra rede continua");
  assert.equal((await tratarUploadComprovante(postUp(pedido(), "jwt-ana"), m.deps, "9.9.9.9")).status, 429, "joiner acima do limite");
  assert.equal((await tratarUploadComprovante(postUp(pedido(), "jwt-bia"), m.deps, "9.9.9.9")).status, 200, "outra joiner continua");
  const adm = montarUpload({ usados: { admin: 9999 } });
  assert.equal((await tratarUploadComprovante(postUp(pedido(), "jwt-admin"), adm.deps, "1.1.1.1")).status, 200, "administradora sem limite");
});

test("envio: com PERMITIR_COMPROVANTE_ANONIMO=false só conta logada envia", async () => {
  const m = montarUpload({ env: { PERMITIR_COMPROVANTE_ANONIMO: "false" } });
  assert.equal((await tratarUploadComprovante(postUp(pedido()), m.deps, "1.1.1.1")).status, 401);
  assert.equal((await tratarUploadComprovante(postUp(pedido(), "anon-key"), m.deps, "1.1.1.1")).status, 401, "a chave pública não é conta");
  assert.equal((await tratarUploadComprovante(postUp(pedido(), "token-falso"), m.deps, "1.1.1.1")).status, 401, "token inválido vale como visitante");
  assert.equal((await tratarUploadComprovante(postUp(pedido(), "jwt-ana"), m.deps, "1.1.1.1")).status, 200);
});

test("envio: CORS só para a origem do site; método errado; erro interno não vaza detalhe", async () => {
  const m = montarUpload();
  const ok = await tratarUploadComprovante(postUp(pedido(), "jwt-ana", { origin: "https://anticeg.vercel.app" }), m.deps, "1.1.1.1");
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://anticeg.vercel.app");
  const mal = await tratarUploadComprovante(postUp(pedido(), "jwt-ana", { origin: "https://site-malicioso.example" }), m.deps, "1.1.1.1");
  assert.equal(mal.headers.get("access-control-allow-origin"), null);
  assert.equal((await tratarUploadComprovante(new Request("https://x/y", { method: "GET" }), m.deps, "1.1.1.1")).status, 405);
  const quebrado = montarUpload(); quebrado.deps.assinar = async () => { throw new Error("DETALHE-SECRETO-DO-STORAGE"); };
  const r = await tratarUploadComprovante(postUp(pedido(), "jwt-ana"), quebrado.deps, "1.1.1.1");
  assert.equal(r.status, 500); assert.ok(!(await r.text()).includes("DETALHE-SECRETO"));
});

// ── visualização ─────────────────────────────────────────────────────────────
function montarUrl(donas: Record<string, string[]> = { "ana": ["comprovantes/wmag/1700000000000.jpg"], "bia": ["comprovantes/pagamentos/bia.pdf"] }) {
  const consultas: string[] = []; const links: string[] = [];
  const deps: DepsUrl = {
    env: n => ({ SUPABASE_SERVICE_ROLE_KEY: SERVICO } as Record<string, string>)[n],
    resolverToken: async t => { if (!TOKENS[t]) throw new Error("token inválido"); return TOKENS[t]; },
    podeVer: async (token, bucket, path) => { consultas.push(token); const cog = TOKENS[token]?.cog; return !!cog && (donas[cog] ?? []).includes(bucket + "/" + path); },
    assinarLeitura: async (bucket, path, seg) => { if (path.startsWith("inexistente")) return null; links.push(`${bucket}/${path}@${seg}`); return `https://x.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=abc`; },
  };
  return { deps, consultas, links };
}
const postUrl = (corpo: unknown, auth?: string) => new Request("https://x.supabase.co/functions/v1/comprovante-url", { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer " + auth } : {}) }, body: JSON.stringify(corpo) });

test("visualização: visitante NÃO recebe link (nem com a chave pública)", async () => {
  const m = montarUrl();
  for (const auth of [undefined, "anon-key", "token-falso"]) assert.equal((await tratarUrlComprovante(postUrl({ bucket: "comprovantes", path: "wmag/1700000000000.jpg" }, auth), m.deps)).status, 401, String(auth));
  assert.equal(m.links.length, 0);
});

test("visualização: a dona vê o comprovante dela e NÃO o de outra pessoa (mesma resposta de 'não existe')", async () => {
  const m = montarUrl();
  const dela = await tratarUrlComprovante(postUrl({ bucket: "comprovantes", path: "wmag/1700000000000.jpg" }, "jwt-ana"), m.deps);
  assert.equal(dela.status, 200); assert.match((await dela.json()).url, /token=abc/);
  assert.deepEqual(m.links, ["comprovantes/wmag/1700000000000.jpg@600"], "link curto de 10 minutos");
  const alheio = await tratarUrlComprovante(postUrl({ bucket: "comprovantes", path: "pagamentos/bia.pdf" }, "jwt-ana"), m.deps);
  assert.equal(alheio.status, 404);
  const inexistente = await tratarUrlComprovante(postUrl({ bucket: "comprovantes", path: "inexistente/x.jpg" }, "jwt-ana"), m.deps);
  assert.equal(inexistente.status, 404, "mesma resposta para o que não é dela e para o que não existe");
  assert.equal(m.links.length, 1);
});

test("visualização: administradora vê qualquer comprovante; serviço também", async () => {
  const m = montarUrl();
  assert.equal((await tratarUrlComprovante(postUrl({ bucket: "comprovantes", path: "pagamentos/bia.pdf" }, "jwt-admin"), m.deps)).status, 200);
  assert.equal((await tratarUrlComprovante(postUrl({ bucket: "mercari-comprovantes", path: "ana_1.jpg" }, SERVICO), m.deps)).status, 200);
  assert.equal(m.consultas.length, 0, "a administradora não passa pela checagem de dono");
});

test("visualização: bucket e caminho inválidos, campos extras", async () => {
  const m = montarUrl();
  for (const ruim of [{ bucket: "avatars", path: "x.jpg" }, { bucket: "comprovantes", path: "../x" }, { bucket: "comprovantes", path: "/x" }, { bucket: "comprovantes" }, { bucket: "comprovantes", path: "a/b.jpg", expira: 99999 }, null, "texto"])
    assert.equal((await tratarUrlComprovante(postUrl(ruim, "jwt-admin"), m.deps)).status, 400, JSON.stringify(ruim));
  assert.equal(m.links.length, 0);
  // arquivos antigos podem ter espaço no nome: a leitura aceita
  assert.equal((await tratarUrlComprovante(postUrl({ bucket: "comprovantes", path: "pagamentos/Comprovante final.pdf" }, "jwt-admin"), m.deps)).status, 200);
});
