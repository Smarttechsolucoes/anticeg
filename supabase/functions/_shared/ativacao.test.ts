// Testes do pedido de código de ativação SEM rede: banco e Auth simulados; nenhum e-mail é enviado.
// Rodar: node --test supabase/functions/_shared/ativacao.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { processarPedidoCodigo, tratarPedidoCodigo, LIMITES_ATIVACAO } from "./ativacao.ts";
import type { DbAtivacao, RedeAtivacao, JoinerAtivacao } from "./ativacao.ts";

const AGORA = new Date("2026-10-14T15:00:00Z");
const JOINERS: JoinerAtivacao[] = [
  { id: 1, cog: "ana", email: "ana@exemplo.com", bloqueado: false }, { id: 2, cog: "bia", email: "bia@exemplo.com", bloqueado: false },
  { id: 3, cog: "Ela", email: "ela@exemplo.com", bloqueado: false }, { id: 4, cog: "ela", email: "ela2@exemplo.com", bloqueado: false },
  { id: 5, cog: "casal1", email: "casal@exemplo.com", bloqueado: false }, { id: 6, cog: "casal2", email: "CASAL@exemplo.com", bloqueado: false },
  { id: 7, cog: "sem", email: null, bloqueado: false }, { id: 8, cog: "bloq", email: "bloq@exemplo.com", bloqueado: true }, { id: 9, cog: "nova", email: "nova@exemplo.com", bloqueado: false },
  { id: 10, cog: "vinc", email: "vinc@exemplo.com", bloqueado: false },
];
function montar(opcoes: { usados?: Record<string, number>; liberadas?: number[]; vinculadas?: number[]; rede?: Partial<RedeAtivacao> } = {}) {
  const usados = { ...(opcoes.usados ?? {}) }; const registrados: string[] = []; const criados: string[] = []; const enviados: string[] = [];
  const db: DbAtivacao = {
    contar: async c => usados[c] ?? 0, registrar: async c => { registrados.push(c); usados[c] = (usados[c] ?? 0) + 1; },
    joinersPorCog: async cog => JOINERS.filter(j => j.cog.toLowerCase() === cog.toLowerCase()),
    quantasComEmail: async e => JOINERS.filter(j => (j.email ?? "").toLowerCase() === e).length,
    jaVinculada: async id => (opcoes.vinculadas ?? [10]).includes(id),
    liberada: async id => (opcoes.liberadas ?? [1, 2, 3, 4, 5, 6, 7, 8, 10]).includes(id),
  };
  const rede: RedeAtivacao = { garantirUsuario: async e => { criados.push(e); }, enviarCodigo: async e => { enviados.push(e); }, ...(opcoes.rede ?? {}) };
  return { db, rede, registrados, criados, enviados };
}
const pedir = (m: ReturnType<typeof montar>, cog: string, email: string, ip = "1.1.1.1") => processarPedidoCodigo({ cog, email }, ip, m.db, m.rede, AGORA);

test("caminho feliz: o código vai SÓ para o e-mail do cadastro, e a resposta é a neutra", async () => {
  const m = montar(); const r = await pedir(m, "@Ana", " ANA@exemplo.com ");
  assert.deepEqual(r, { status: 200, corpo: { ok: true } });
  assert.deepEqual(m.criados, ["ana@exemplo.com"]); assert.deepEqual(m.enviados, ["ana@exemplo.com"]);
});

test("a resposta é IDÊNTICA em todos os casos em que o PAR (@ + e-mail do cadastro) não está certo (sem enumerar @, e-mail, conta ou liberação)", async () => {
  const casos: [string, string, Parameters<typeof montar>[0]?][] = [
    ["naoexiste", "x@exemplo.com"], ["ana", "outra.pessoa@exemplo.com"], ["bia", "ana@exemplo.com"], ["Ela", "ela@exemplo.com"],
    ["sem", "qualquer@exemplo.com"], ["bloq", "outro@exemplo.com"], ["vinc", "outro@exemplo.com"], ["nova", "outro@exemplo.com"], ["casal1", "outro@exemplo.com"],
  ];
  const corpos = new Set<string>();
  for (const [cog, email, o] of casos) {
    const m = montar(o); const r = await pedir(m, cog, email);
    assert.equal(r.status, 200, cog); assert.equal(m.enviados.length, 0, `${cog}: não pode enviar`); assert.equal(m.criados.length, 0, `${cog}: não pode criar conta`);
    corpos.add(JSON.stringify(r));
  }
  assert.equal(corpos.size, 1, "todas as respostas são iguais");
  assert.equal([...corpos][0], JSON.stringify({ status: 200, corpo: { ok: true } }));
});
test("quem ACERTOU o par e NÃO vai receber código ouve o próximo passo (a tela não fica esperando um e-mail que não sai); nada é enviado", async () => {
  const esperado: [string, string, string][] = [["casal1", "casal@exemplo.com", "ajuda"], ["bloq", "bloq@exemplo.com", "ajuda"], ["vinc", "vinc@exemplo.com", "entrar"], ["nova", "nova@exemplo.com", "aguardando"]];
  for (const [cog, email, proximo] of esperado) {
    const m = montar(); const r = await pedir(m, cog, email);
    assert.deepEqual(r, { status: 200, corpo: { ok: true, proximo } }, cog); assert.equal(m.enviados.length, 0, cog); assert.equal(m.criados.length, 0, cog);
  }
});

test("COGs que só mudam de maiúscula (Ela/ela): não envia para nenhuma das duas", async () => {
  for (const [cog, email] of [["Ela", "ela@exemplo.com"], ["ela", "ela2@exemplo.com"]]) { const m = montar(); await pedir(m, cog, email); assert.equal(m.enviados.length, 0, cog); }
});

test("onda não liberada: nada é enviado nem criado; liberada: envia", async () => {
  const fechada = montar({ liberadas: [] }); await pedir(fechada, "ana", "ana@exemplo.com"); assert.equal(fechada.enviados.length, 0); assert.equal(fechada.criados.length, 0);
  const aberta = montar({ liberadas: [1] }); await pedir(aberta, "ana", "ana@exemplo.com"); assert.equal(aberta.enviados.length, 1);
});

test("pedidos malformados viram 400 e não gastam a cota", async () => {
  const m = montar();
  for (const ruim of [null, "texto", [], {}, { cog: "ana" }, { cog: "ana", email: "isto-nao-e-email" }, { cog: "a b", email: "ana@exemplo.com" }, { cog: "ana", email: "ana@exemplo.com", extra: 1 }, { cog: "x".repeat(70), email: "ana@exemplo.com" }]) {
    const r = await processarPedidoCodigo(ruim, "1.1.1.1", m.db, m.rede, AGORA); assert.equal(r.status, 400, JSON.stringify(ruim)?.slice(0, 50));
  }
  assert.equal(m.registrados.length, 0);
});

test("limites por hora: por rede, por @ e por e-mail; tudo o que passa conta (até quando o @ não existe)", async () => {
  const porIp = montar({ usados: { "ip:9.9.9.9": LIMITES_ATIVACAO.porIpPorHora } });
  assert.equal((await pedir(porIp, "ana", "ana@exemplo.com", "9.9.9.9")).status, 429); assert.equal(porIp.enviados.length, 0);
  assert.equal((await pedir(porIp, "ana", "ana@exemplo.com", "8.8.8.8")).status, 200, "outra rede segue");
  const porCog = montar({ usados: { "cog:ana": LIMITES_ATIVACAO.porCogPorHora } }); assert.equal((await pedir(porCog, "ana", "ana@exemplo.com")).status, 429);
  const porEmail = montar({ usados: { "email:ana@exemplo.com": LIMITES_ATIVACAO.porEmailPorHora } }); assert.equal((await pedir(porEmail, "ana", "ana@exemplo.com")).status, 429);
  const m = montar(); await pedir(m, "naoexiste", "x@exemplo.com", "2.2.2.2");
  assert.deepEqual(m.registrados.sort(), ["cog:naoexiste", "email:x@exemplo.com", "ip:2.2.2.2"], "mesmo @ inexistente gasta a cota (não dá para varrer @s de graça)");
  // varredura: 11 tentativas de @s diferentes da mesma rede esgotam a rede
  const v = montar(); let ultimo = 200; for (let i = 0; i < 12; i++) ultimo = (await pedir(v, "naoexiste" + i, `x${i}@exemplo.com`, "3.3.3.3")).status;
  assert.equal(ultimo, 429, "a varredura de @s pela mesma rede é bloqueada");
});

test("falha do Auth ou do banco não muda a resposta (nem vaza detalhe)", async () => {
  const m = montar({ rede: { enviarCodigo: async () => { throw new Error("DETALHE-SECRETO-DO-AUTH"); } } });
  const r = await pedir(m, "ana", "ana@exemplo.com"); assert.deepEqual(r, { status: 200, corpo: { ok: true } });
  const req = new Request("https://x/f", { method: "POST", headers: { "content-type": "application/json", origin: "https://anticeg.vercel.app" }, body: JSON.stringify({ cog: "ana", email: "ana@exemplo.com" }) });
  const quebrado = montar(); quebrado.db.contar = async () => { throw new Error("DETALHE-SECRETO-DO-BANCO"); };
  const resp = await tratarPedidoCodigo(req, { env: () => undefined, db: () => quebrado.db, rede: () => quebrado.rede, agora: () => AGORA }, "1.1.1.1");
  assert.equal(resp.status, 200); const txt = await resp.text(); assert.equal(txt, JSON.stringify({ ok: true })); assert.ok(!txt.includes("DETALHE"));
});

test("CORS só para a origem do site; método errado", async () => {
  const m = montar(); const d = { env: () => undefined, db: () => m.db, rede: () => m.rede, agora: () => AGORA };
  const ok = await tratarPedidoCodigo(new Request("https://x/f", { method: "POST", headers: { origin: "https://anticeg.vercel.app" }, body: "{}" }), d, "1.1.1.1");
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://anticeg.vercel.app");
  const mal = await tratarPedidoCodigo(new Request("https://x/f", { method: "POST", headers: { origin: "https://golpe.example" }, body: "{}" }), d, "1.1.1.1");
  assert.equal(mal.headers.get("access-control-allow-origin"), null);
  assert.equal((await tratarPedidoCodigo(new Request("https://x/f", { method: "GET" }), d, "1.1.1.1")).status, 405);
});

// ─────────────── vínculo confiável (J6) ───────────────
test("VÍNCULO NÃO CONFIÁVEL: e-mail/@ alterado depois da fotografia => NENHUM código é enviado (resposta neutra) e a administração recebe o registro", async () => {
  const m = montar(); const registros: [number, string][] = [];
  m.db.vinculoConfiavel = async id => id !== 2; m.db.registrarSemVinculo = async (id, motivo) => { registros.push([id, motivo]); };
  const ruim = await pedir(m, "bia", "bia@exemplo.com");
  assert.deepEqual(ruim, { status: 200, corpo: { ok: true, proximo: "comprovar" } }, "quem acertou o par ouve que precisa comprovar (nenhum código sai)"); assert.deepEqual(m.enviados, [], "nenhum e-mail foi enviado"); assert.deepEqual(m.criados, [], "nem criou usuário no Auth");
  assert.equal(registros.length, 1); assert.equal(registros[0][0], 2);
  const boa = await pedir(m, "ana", "ana@exemplo.com"); assert.deepEqual(boa, { status: 200, corpo: { ok: true } }); assert.deepEqual(m.enviados, ["ana@exemplo.com"], "quem tem vínculo confiável recebe o código");
});
test("sem vínculo confiável: quem ERROU o par recebe a resposta neutra (não revela o estado de ninguém); quem acertou ouve 'comprovar'; falha ao registrar para a administração não vaza", async () => {
  const m = montar(); m.db.vinculoConfiavel = async () => false; m.db.registrarSemVinculo = async () => { throw new Error("banco indisponível"); };
  const a = await pedir(m, "bia", "errado@exemplo.com"); const b = await pedir(m, "naoexiste", "x@exemplo.com");
  assert.deepEqual(a, b); assert.deepEqual(a, { status: 200, corpo: { ok: true } }); assert.deepEqual(m.enviados, []);
  assert.deepEqual(await pedir(m, "bia", "bia@exemplo.com"), { status: 200, corpo: { ok: true, proximo: "comprovar" } }, "mesmo com o registro para a administração falhando");
});
test("sem a camada de confiança (antes do J6) o comportamento anterior é mantido", async () => {
  const m = montar(); const r = await pedir(m, "ana", "ana@exemplo.com"); assert.deepEqual(m.enviados, ["ana@exemplo.com"]); assert.equal(r.status, 200);
});

// ── entrada SÓ pelo e-mail cadastrado (sem @) ──────────────────────────────────────────────────────────────────────────────────────────────
const pedirSoEmail = (m: ReturnType<typeof montar>, email: string, ip = "1.1.1.1", entrada: Record<string, unknown> = {}) => processarPedidoCodigo({ email, ...entrada }, ip, m.db, m.rede, AGORA);
const comEmail = (m: ReturnType<typeof montar>) => { (m.db as DbAtivacao).joinersPorEmail = async e => JOINERS.filter(j => (j.email ?? "").toLowerCase() === e); return m; };

test("só e-mail: o código vai SÓ para o e-mail do cadastro (o mesmo digitado) e a resposta é a neutra", async () => {
  const m = comEmail(montar()); const r = await pedirSoEmail(m, " ANA@exemplo.com ");
  assert.deepEqual(r, { status: 200, corpo: { ok: true } });
  assert.deepEqual(m.enviados, ["ana@exemplo.com"]); assert.deepEqual(m.criados, ["ana@exemplo.com"]);
});
test("só e-mail: e-mail inexistente ou dividido entre cadastros recebe a resposta NEUTRA; e-mail de UM cadastro que não vai receber código ouve o próximo passo; nada é enviado", async () => {
  const casos: [string, unknown][] = [["ninguem@exemplo.com", { ok: true }], ["casal@exemplo.com", { ok: true }], ["bloq@exemplo.com", { ok: true, proximo: "ajuda" }], ["vinc@exemplo.com", { ok: true, proximo: "entrar" }], ["nova@exemplo.com", { ok: true, proximo: "aguardando" }]];
  for (const [email, corpo] of casos) {
    const m = comEmail(montar()); const r = await pedirSoEmail(m, email);
    assert.deepEqual(r, { status: 200, corpo }, email); assert.deepEqual(m.enviados, [], email); assert.deepEqual(m.criados, [], email);
  }
});
test("só e-mail: se a camada de busca por e-mail não existe, nada é enviado (resposta neutra)", async () => {
  const m = montar(); const r = await pedirSoEmail(m, "ana@exemplo.com"); assert.deepEqual(r, { status: 200, corpo: { ok: true } }); assert.deepEqual(m.enviados, []);
});
test("só e-mail: continua exigindo o vínculo confiável (J1d) e o limite por e-mail e por rede", async () => {
  const m = comEmail(montar()); (m.db as DbAtivacao).vinculoConfiavel = async () => false; await pedirSoEmail(m, "ana@exemplo.com"); assert.deepEqual(m.enviados, []);
  const n = comEmail(montar({ usados: { "email:ana@exemplo.com": LIMITES_ATIVACAO.porEmailPorHora } })); const r = await pedirSoEmail(n, "ana@exemplo.com"); assert.equal(r.status, 429); assert.deepEqual(n.enviados, []);
  const o = comEmail(montar({ usados: { "ip:9.9.9.9": LIMITES_ATIVACAO.porIpPorHora } })); assert.equal((await pedirSoEmail(o, "ana@exemplo.com", "9.9.9.9")).status, 429);
});
test("só e-mail: toda tentativa conta (rede e e-mail), sem inventar chave de @; e-mail inválido é recusado", async () => {
  const m = comEmail(montar()); await pedirSoEmail(m, "ninguem@exemplo.com"); assert.deepEqual(m.registrados, ["ip:1.1.1.1", "email:ninguem@exemplo.com"]);
  assert.equal((await pedirSoEmail(comEmail(montar()), "nao-e-email")).status, 400);
  assert.equal((await pedirSoEmail(comEmail(montar()), "ana@exemplo.com", "1.1.1.1", { extra: 1 })).status, 400);
});
test("com @ e e-mail o comportamento é o de sempre (o @ não é ignorado nem substituído pelo e-mail)", async () => {
  const m = comEmail(montar()); await pedir(m, "bia", "ana@exemplo.com"); assert.deepEqual(m.enviados, []);
  await pedir(m, "ana", "ana@exemplo.com"); assert.deepEqual(m.enviados, ["ana@exemplo.com"]);
});
