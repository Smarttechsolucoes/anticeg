// Testes da troca de e-mail com prova (J13), SEM rede: banco e e-mail simulados; nenhum e-mail é enviado de verdade.
// Rodar: node --test supabase/functions/_shared/troca_email.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { processarTroca, tratarTroca, sha256Hex, codigoDerivado, lerToken, assinarToken, LIMITES_TROCA } from "./troca_email.ts";
import type { DbTroca, ResultadoConferir, ResultadoConcluir, ViaTroca } from "./troca_email.ts";
import type { JoinerAtivacao } from "./ativacao.ts";

const SEGREDO = "segredo-de-teste-com-mais-de-16-caracteres";
const AGORA = new Date("2026-11-09T15:00:00Z");
const JOINERS: JoinerAtivacao[] = [
  { id: 1, cog: "ana", email: "ana@antigo.com", bloqueado: false }, { id: 2, cog: "bia", email: "bia@antigo.com", bloqueado: false },
  { id: 3, cog: "bloq", email: "bloq@antigo.com", bloqueado: true }, { id: 4, cog: "casal1", email: "casal@antigo.com", bloqueado: false },
  { id: 5, cog: "casal2", email: "casal@antigo.com", bloqueado: false }, { id: 6, cog: "conta", email: "conta@antigo.com", bloqueado: false },
  { id: 7, cog: "sem", email: null, bloqueado: false },
];
interface Pedido { id: number; joiner: number; via: ViaTroca; novo: string; hAntigo: string | null; hNovo: string; antigoOk: boolean; novoOk: boolean; tentA: number; tentN: number }
function montar(o: { usados?: Record<string, number>; erroAbrir?: string; decisao?: "aplicada" | "aguardando_identidade"; falhaEnvio?: boolean } = {}) {
  const usados = { ...(o.usados ?? {}) }; const pedidos: Pedido[] = []; const enviados: { para: string; assunto: string; texto: string; html: string }[] = []; const concluidos: number[] = [];
  const db: DbTroca = {
    contar: async c => usados[c] ?? 0, registrar: async c => { usados[c] = (usados[c] ?? 0) + 1; },
    joinersPorCog: async cog => JOINERS.filter(j => j.cog.toLowerCase() === cog.toLowerCase()),
    quantasComEmail: async e => JOINERS.filter(j => (j.email ?? "").toLowerCase() === e).length,
    abrir: async (joiner, via, novo, hA, hN) => { if (o.erroAbrir) throw new Error(o.erroAbrir); const id = pedidos.length + 100; pedidos.push({ id, joiner, via, novo, hAntigo: hA, hNovo: hN, antigoOk: false, novoOk: false, tentA: 0, tentN: 0 }); return id; },
    conferir: async (id, lado, h): Promise<ResultadoConferir> => {
      const p = pedidos.find(x => x.id === id); if (!p) return "invalido";
      const t = lado === "antigo" ? p.tentA : p.tentN; if (t >= 5) return "bloqueado";
      if (h === (lado === "antigo" ? p.hAntigo : p.hNovo)) { if (lado === "antigo") p.antigoOk = true; else p.novoOk = true; return "ok"; }
      if (lado === "antigo") p.tentA++; else p.tentN++; return t + 1 >= 5 ? "bloqueado" : "errado";
    },
    concluir: async (id): Promise<ResultadoConcluir> => { const p = pedidos.find(x => x.id === id)!; concluidos.push(id); if (!p.novoOk || (p.via === "email_antigo" && !p.antigoOk)) return "incompleto"; return o.decisao ?? "aguardando_identidade"; },
  };
  const enviar = async (para: string, assunto: string, texto: string, html: string) => { if (o.falhaEnvio) throw new Error("provedor recusou"); enviados.push({ para, assunto, texto, html }); };
  return { db, enviar, usados, pedidos, enviados, concluidos };
}
const ctx = (m: ReturnType<typeof montar>, ip = "1.1.1.1") => ({ db: m.db, enviar: m.enviar, segredo: SEGREDO, ip, agora: AGORA });
const iniciar = (m: ReturnType<typeof montar>, c: Record<string, unknown>, ip?: string) => processarTroca({ acao: "iniciar", ...c }, ctx(m, ip));
const confirmar = (m: ReturnType<typeof montar>, c: Record<string, unknown>, ip?: string) => processarTroca({ acao: "confirmar", ...c }, ctx(m, ip));
const codigoDe = async (m: ReturnType<typeof montar>, token: string, lado: "antigo" | "novo") => { const t = (await lerToken(SEGREDO, token, AGORA))!; return codigoDerivado(SEGREDO, lado, t.n); };

test("via e-mail antigo: o código do ANTIGO sai para o e-mail do cadastro; o do NOVO só depois de provar o antigo; aplicar é decisão do banco", async () => {
  const m = montar({ decisao: "aplicada" });
  const r = await iniciar(m, { cog: "@Ana", email: " ANA@antigo.com ", novo_email: "Novo@Exemplo.com", via: "email_antigo" });
  assert.equal(r.status, 200); const token = r.corpo.token as string; assert.ok(token);
  assert.deepEqual(m.enviados.map(e => e.para), ["ana@antigo.com"], "só o e-mail do cadastro recebeu; o novo ainda NÃO");
  assert.equal(m.pedidos[0].novo, "novo@exemplo.com");
  const cA = await codigoDe(m, token, "antigo"), cN = await codigoDe(m, token, "novo");
  assert.equal((await confirmar(m, { token, lado: "antigo", codigo: "000000" })).corpo.resultado, "errado");
  const ok = await confirmar(m, { token, lado: "antigo", codigo: cA });
  assert.equal(ok.corpo.resultado, "antigo_ok"); assert.equal(ok.corpo.novo_mascarado, "n•••@e•••.com");
  assert.deepEqual(m.enviados.map(e => e.para), ["ana@antigo.com", "novo@exemplo.com"], "agora sim o código foi para o e-mail novo");
  const fim = await confirmar(m, { token, lado: "novo", codigo: cN });
  assert.equal(fim.corpo.resultado, "aplicada");
  assert.equal(JSON.stringify([r, ok, fim]).includes("@antigo.com"), false, "nenhuma resposta contém o e-mail antigo");
  assert.equal(JSON.stringify([r, ok, fim]).includes("novo@exemplo.com"), false, "nenhuma resposta contém o e-mail novo completo");
});

test("a decisão que o banco devolve é repassada: aguardando_identidade quando não aplica; 'falta_antigo' se tentar o novo sem provar o antigo", async () => {
  const m = montar({ decisao: "aguardando_identidade" });
  const token = (await iniciar(m, { cog: "ana", email: "ana@antigo.com", novo_email: "n@exemplo.com", via: "email_antigo" })).corpo.token as string;
  const cA = await codigoDe(m, token, "antigo"), cN = await codigoDe(m, token, "novo");
  assert.equal((await confirmar(m, { token, lado: "novo", codigo: cN })).corpo.resultado, "falta_antigo");
  await confirmar(m, { token, lado: "antigo", codigo: cA });
  assert.equal((await confirmar(m, { token, lado: "novo", codigo: cN })).corpo.resultado, "aguardando_identidade");
});

test("via sem acesso: o código vai SÓ para o e-mail novo, e nunca aparece 'aplicada' (o banco devolve aguardando_identidade)", async () => {
  const m = montar();
  const r = await iniciar(m, { cog: "bia", novo_email: "bia.nova@exemplo.com", via: "sem_acesso" });
  const token = r.corpo.token as string;
  assert.deepEqual(m.enviados.map(e => e.para), ["bia.nova@exemplo.com"]); assert.equal(m.pedidos[0].hAntigo, null);
  assert.equal((await confirmar(m, { token, lado: "antigo", codigo: "123456" })).status, 400, "não existe 'antigo' nesta via");
  assert.equal((await confirmar(m, { token, lado: "novo", codigo: await codigoDe(m, token, "novo") })).corpo.resultado, "aguardando_identidade");
});

test("os e-mails não citam o @ do cadastro; o do endereço novo não cita o antigo; só o antigo vê o novo MASCARADO", async () => {
  const m = montar();
  const token = (await iniciar(m, { cog: "ana", email: "ana@antigo.com", novo_email: "n.pessoa@exemplo.com", via: "email_antigo" })).corpo.token as string;
  await confirmar(m, { token, lado: "antigo", codigo: await codigoDe(m, token, "antigo") });
  const [paraAntigo, paraNovo] = m.enviados;
  for (const e of m.enviados) { assert.equal(/ana\b/i.test(e.texto.replace(/anticeg/gi, "")), false, "não cita o @"); assert.match(e.texto, /\b\d{6}\b/); assert.match(e.html, /\b\d{6}\b/); }
  assert.match(paraAntigo.texto, /n•••@e•••\.com/); assert.equal(paraAntigo.texto.includes("n.pessoa@exemplo.com"), false);
  assert.equal(paraNovo.texto.includes("antigo.com"), false);
});

test("par errado, @ inexistente, bloqueada (sem_acesso) e erro do banco recebem resposta da MESMA FORMA, sem enviar nada", async () => {
  const casos: Record<string, unknown>[] = [
    { cog: "naoexiste", email: "x@exemplo.com", novo_email: "n@exemplo.com", via: "email_antigo" },
    { cog: "ana", email: "outro@exemplo.com", novo_email: "n@exemplo.com", via: "email_antigo" },
    { cog: "sem", email: "qualquer@exemplo.com", novo_email: "n@exemplo.com", via: "email_antigo" },
    { cog: "naoexiste", novo_email: "n@exemplo.com", via: "sem_acesso" },
    { cog: "bloq", novo_email: "n@exemplo.com", via: "sem_acesso" },
  ];
  const formas = new Set<string>();
  for (const c of casos) {
    const m = montar(); const r = await iniciar(m, c);
    assert.equal(r.status, 200); assert.equal(m.enviados.length, 0, "nada enviado"); assert.equal(m.pedidos.length, 0, "nenhum pedido");
    formas.add(Object.keys(r.corpo).sort().join(",") + "|" + (r.corpo.via));
    assert.match(String(r.corpo.token), /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  }
  assert.equal(formas.size, 2, "só muda o campo via (que a própria pessoa informou)");
  const quebra = montar({ erroAbrir: "falha qualquer" }); const r = await iniciar(quebra, { cog: "bia", novo_email: "n@exemplo.com", via: "sem_acesso" });
  assert.deepEqual(Object.keys(r.corpo).sort(), ["ok", "token", "via"]);
});

test("o token falso nunca é aceito e responde como código errado; token adulterado e vencido também", async () => {
  const m = montar(); const falso = (await iniciar(m, { cog: "naoexiste", novo_email: "n@exemplo.com", via: "sem_acesso" })).corpo.token as string;
  assert.deepEqual((await confirmar(m, { token: falso, lado: "novo", codigo: "123456" })).corpo, { ok: true, resultado: "errado" });
  const real = (await iniciar(m, { cog: "bia", novo_email: "n2@exemplo.com", via: "sem_acesso" })).corpo.token as string;
  const adulterado = real.replace(/^[^.]+/, c => c.slice(0, -2) + (c.endsWith("AA") ? "BB" : "AA"));
  assert.equal(await lerToken(SEGREDO, adulterado, AGORA), null);
  assert.ok(await lerToken(SEGREDO, real, AGORA));
  assert.equal(await lerToken(SEGREDO, real, new Date(AGORA.getTime() + (LIMITES_TROCA.validadeMin + 1) * 60000)), null, "vencido");
  assert.equal(await lerToken("outro-segredo-qualquer-123456", real, AGORA), null, "outro segredo");
  assert.equal(await lerToken(SEGREDO, await assinarToken(SEGREDO, { p: 1.5, n: "x", m: "a@b.co", v: "sem_acesso", e: 9999999999 }), AGORA), null);
});

test("quem ACERTOU o par e não pode seguir sabe o próximo passo (e nenhum e-mail sai)", async () => {
  const casos: [Record<string, unknown>, string, Parameters<typeof montar>[0]?][] = [
    [{ cog: "bloq", email: "bloq@antigo.com" }, "ajuda"], [{ cog: "casal1", email: "casal@antigo.com" }, "ajuda"],
    [{ cog: "ana", email: "ana@antigo.com" }, "entrar", { erroAbrir: "conta_ativa" }], [{ cog: "ana", email: "ana@antigo.com" }, "limite", { erroAbrir: "limite_diario" }],
    [{ cog: "ana", email: "ana@antigo.com" }, "ajuda", { erroAbrir: "email_em_uso" }],
  ];
  for (const [c, esperado, o] of casos) {
    const m = montar(o); const r = await iniciar(m, { ...c, novo_email: "n@exemplo.com", via: "email_antigo" });
    assert.deepEqual(r.corpo, { ok: true, proximo: esperado }); assert.equal(m.enviados.length, 0);
  }
});

test("códigos: 5 tentativas erradas bloqueiam; o código certo depois do bloqueio também não vale", async () => {
  const m = montar(); const token = (await iniciar(m, { cog: "bia", novo_email: "n@exemplo.com", via: "sem_acesso" })).corpo.token as string;
  const certo = await codigoDe(m, token, "novo");
  const rs: unknown[] = []; for (let i = 0; i < 5; i++) rs.push((await confirmar(m, { token, lado: "novo", codigo: certo === "111111" ? "222222" : "111111" })).corpo.resultado);
  assert.deepEqual(rs, ["errado", "errado", "errado", "errado", "bloqueado"]);
  assert.equal((await confirmar(m, { token, lado: "novo", codigo: certo })).corpo.resultado, "bloqueado");
});

test("o código só guarda hash e é reproduzível pelo servidor (nonce + segredo); o do antigo é diferente do novo", async () => {
  const m = montar(); const token = (await iniciar(m, { cog: "ana", email: "ana@antigo.com", novo_email: "n@exemplo.com", via: "email_antigo" })).corpo.token as string;
  const cA = await codigoDe(m, token, "antigo"), cN = await codigoDe(m, token, "novo");
  assert.notEqual(cA, cN); assert.match(cA, /^\d{6}$/);
  assert.equal(m.pedidos[0].hAntigo, await sha256Hex(cA)); assert.equal(m.pedidos[0].hNovo, await sha256Hex(cN));
  assert.equal(JSON.stringify(m.pedidos).includes(cA) && JSON.stringify(m.pedidos).includes(`"${cA}"`), false);
});

test("limites por rede, @ e e-mail novo (toda tentativa conta); confirmar tem limite por rede; o reenvio ao e-mail novo tem teto por pedido", async () => {
  const cheio = (chave: string, n: number) => montar({ usados: { [chave]: n } });
  for (const [chave, n] of [["troca-ip:1.1.1.1", LIMITES_TROCA.iniciarPorIpPorHora], ["troca-cog:ana", LIMITES_TROCA.iniciarPorCogPorHora], ["troca-novo:n@exemplo.com", LIMITES_TROCA.iniciarPorNovoEmailPorHora]] as const) {
    const m = cheio(chave, n); const r = await iniciar(m, { cog: "ana", email: "ana@antigo.com", novo_email: "n@exemplo.com", via: "email_antigo" });
    assert.equal(r.status, 429, chave); assert.equal(m.enviados.length, 0);
  }
  const m = cheio("troca-conf-ip:1.1.1.1", LIMITES_TROCA.confirmarPorIpPorHora); assert.equal((await confirmar(m, { token: "a.b", lado: "novo", codigo: "123456" })).status, 429);
  const m2 = montar(); const token = (await iniciar(m2, { cog: "ana", email: "ana@antigo.com", novo_email: "n@exemplo.com", via: "email_antigo" })).corpo.token as string;
  const cA = await codigoDe(m2, token, "antigo"); const id = m2.pedidos[0].id;
  m2.usados[`troca-envio:${id}`] = LIMITES_TROCA.envioNovoPorPedido;
  assert.equal((await confirmar(m2, { token, lado: "antigo", codigo: cA })).corpo.resultado, "limite_envio");
  assert.equal(m2.enviados.length, 1, "só o do antigo; o novo foi barrado pelo teto");
});

test("falha do provedor: o início responde igual (nada afirmado); depois de provar o antigo, a falha do envio ao novo é dita com honestidade", async () => {
  const m = montar({ falhaEnvio: true }); const r = await iniciar(m, { cog: "ana", email: "ana@antigo.com", novo_email: "n@exemplo.com", via: "email_antigo" });
  assert.deepEqual(Object.keys(r.corpo).sort(), ["ok", "token", "via"]); assert.equal(m.enviados.length, 0);
  const token = r.corpo.token as string; const cA = await codigoDe(m, token, "antigo");
  assert.equal((await confirmar(m, { token, lado: "antigo", codigo: cA })).corpo.resultado, "falha_envio");
});

test("validação: chaves extras, via/novo e-mail inválidos, novo = antigo, código fora do formato; HTTP: 405, CORS, 503 sem segredo", async () => {
  const m = montar();
  for (const c of [{ cog: "ana", email: "ana@antigo.com", novo_email: "ana@antigo.com", via: "email_antigo" }, { cog: "ana", novo_email: "n@exemplo.com", via: "email_antigo" }, { cog: "ana", novo_email: "invalido", via: "sem_acesso" },
    { cog: "ana", novo_email: "n@exemplo.com", via: "outra" }, { cog: "ana", novo_email: "n@exemplo.com", via: "sem_acesso", extra: 1 }, { cog: "", novo_email: "n@exemplo.com", via: "sem_acesso" }]) assert.equal((await iniciar(m, c)).status, 400);
  assert.equal((await confirmar(m, { token: "a.b", lado: "novo", codigo: "12345" })).status, 400);
  assert.equal((await processarTroca({ acao: "x" }, ctx(m))).status, 400);
  assert.equal((await processarTroca(null, ctx(m))).status, 400);
  const deps = (env: Record<string, string>) => ({ env: (n: string) => env[n], db: () => m.db, enviar: () => m.enviar });
  assert.equal((await tratarTroca(new Request("https://x.test", { method: "GET" }), deps({ DICA_SEGREDO: SEGREDO }), "1.1.1.1")).status, 405);
  assert.equal((await tratarTroca(new Request("https://x.test", { method: "POST", body: "{}" }), deps({}), "1.1.1.1")).status, 503);
  const op = await tratarTroca(new Request("https://x.test", { method: "OPTIONS", headers: { origin: "https://anticeg.vercel.app" } }), deps({ DICA_SEGREDO: SEGREDO }), "1.1.1.1");
  assert.equal(op.headers.get("access-control-allow-origin"), "https://anticeg.vercel.app");
  assert.equal(m.enviados.length, 0);
});
