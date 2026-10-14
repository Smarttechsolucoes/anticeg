// Testes do login por @ + senha e da recuperação. Rodar: node --test supabase/functions/_shared/acesso.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { processarLogin, processarRecuperacao, normalizarCog, sessaoSemUsuario, LIMITES_ACESSO } from "./acesso.ts";
import type { DbAcesso, Rede } from "./acesso.ts";

const AGORA = new Date("2026-10-14T15:00:00Z");
const SESSAO = { access_token: "A", refresh_token: "R", expires_in: 3600, expires_at: 1, token_type: "bearer", user: { email: "ana@exemplo.com", id: "u1" } };

function montar(opcoes: { contas?: Record<string, string>; senhaCerta?: string; eventos?: { tipo: string; chave: string; em: string }[]; falhaRede?: boolean } = {}) {
  const contas = opcoes.contas ?? { ana: "ana@exemplo.com" };
  const eventos = opcoes.eventos ?? [];
  const chamadas: { entrar: string[]; recuperar: string[] } = { entrar: [], recuperar: [] };
  const db: DbAcesso = {
    contarTentativas: async (tipo, chave, desde) => eventos.filter(e => e.tipo === tipo && e.chave === chave && e.em >= desde).length,
    registrarTentativa: async (tipo, chave) => { eventos.push({ tipo, chave, em: AGORA.toISOString() }); },
    limparTentativas: async (tipo, chave) => { for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i].tipo === tipo && eventos[i].chave === chave) eventos.splice(i, 1); },
    emailDaConta: async cog => contas[cog] ?? null,
  };
  const rede: Rede = {
    entrarComSenha: async (email, senha) => { chamadas.entrar.push(email); return email === "ana@exemplo.com" && senha === (opcoes.senhaCerta ?? "senha-certa-1") ? { ok: true, sessao: SESSAO } : { ok: false }; },
    pedirRecuperacao: async email => { if (opcoes.falhaRede) throw new Error("provedor fora"); chamadas.recuperar.push(email); },
  };
  return { db, rede, eventos, chamadas };
}

test("login certo devolve só os tokens (nunca o objeto user, que tem o e-mail) e zera as falhas do @", async () => {
  const m = montar({ eventos: [{ tipo: "login", chave: "cog:ana", em: AGORA.toISOString() }] });
  const r = await processarLogin({ cog: "@Ana", senha: "senha-certa-1" }, "1.1.1.1", m.db, m.rede, AGORA);
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.corpo).sort(), ["access_token", "expires_at", "expires_in", "refresh_token", "token_type"]);
  assert.doesNotMatch(JSON.stringify(r.corpo), /ana@exemplo|"user"|u1/);
  assert.equal(m.eventos.filter(e => e.chave === "cog:ana").length, 0);
  assert.deepEqual(sessaoSemUsuario(SESSAO).user, undefined);
});
test("@ inexistente, conta sem ativação e senha errada têm a MESMA resposta (sem enumeração)", async () => {
  const m = montar();
  const a = await processarLogin({ cog: "ana", senha: "errada" }, "1.1.1.1", m.db, m.rede, AGORA);
  const b = await processarLogin({ cog: "naoexiste", senha: "qualquer" }, "1.1.1.1", m.db, m.rede, AGORA);
  const c = await processarLogin({ cog: "", senha: "x" }, "1.1.1.1", m.db, m.rede, AGORA);
  for (const r of [a, b, c]) { assert.equal(r.status, 401); assert.deepEqual(r.corpo, { error: "@ ou senha incorretos." }); }
  assert.equal(m.chamadas.entrar.length, 2);                                         // @ sem conta também gera uma tentativa (tempo parecido)
  assert.equal(m.chamadas.entrar[1], "sem-conta@invalido.anticeg.test");              // e-mail inexistente, nunca de outra pessoa
});
test("o pedido não aceita campos extras nem formato estranho", async () => {
  const m = montar();
  for (const x of [null, "ana", [], { cog: "ana", senha: "s", email: "x@y.com" }, { cog: "ana", senha: "s", to: "x" }]) assert.equal((await processarLogin(x, "1.1.1.1", m.db, m.rede, AGORA)).status, 400);
  assert.equal((await processarLogin({ cog: "ana", senha: "x".repeat(500) }, "1.1.1.1", m.db, m.rede, AGORA)).status, 401);
  assert.equal((await processarLogin({ cog: "a b", senha: "x" }, "1.1.1.1", m.db, m.rede, AGORA)).status, 401);
});
test("bloqueia por @ depois de muitas falhas e continua bloqueando mesmo com a senha certa", async () => {
  const m = montar();
  for (let i = 0; i < LIMITES_ACESSO.loginPorCogEm15min; i++) assert.equal((await processarLogin({ cog: "ana", senha: "errada" + i }, "9.9.9." + i, m.db, m.rede, AGORA)).status, 401);
  const bloqueada = await processarLogin({ cog: "ana", senha: "senha-certa-1" }, "8.8.8.8", m.db, m.rede, AGORA);
  assert.equal(bloqueada.status, 429);
  assert.equal(m.chamadas.entrar.length, LIMITES_ACESSO.loginPorCogEm15min);        // nem tenta quando bloqueado
});
test("bloqueia por endereço de rede (um atacante testando muitos @)", async () => {
  const m = montar();
  for (let i = 0; i < LIMITES_ACESSO.loginPorIpEm15min; i++) await processarLogin({ cog: "alvo" + i, senha: "x" }, "7.7.7.7", m.db, m.rede, AGORA);
  assert.equal((await processarLogin({ cog: "outro", senha: "x" }, "7.7.7.7", m.db, m.rede, AGORA)).status, 429);
  assert.notEqual((await processarLogin({ cog: "ana", senha: "senha-certa-1" }, "6.6.6.6", m.db, m.rede, AGORA)).status, 429);   // outro endereço não é afetado
});
test("o bloqueio expira depois da janela", async () => {
  const velhas = Array.from({ length: 10 }, () => ({ tipo: "login", chave: "cog:ana", em: new Date(AGORA.getTime() - 30 * 60000).toISOString() }));
  const m = montar({ eventos: velhas });
  assert.equal((await processarLogin({ cog: "ana", senha: "senha-certa-1" }, "1.1.1.1", m.db, m.rede, AGORA)).status, 200);
});

test("recuperação: resposta idêntica com ou sem conta, e só manda link quando há conta ativada", async () => {
  const m = montar();
  const com = await processarRecuperacao({ cog: "ana" }, "1.1.1.1", m.db, m.rede, AGORA);
  const sem = await processarRecuperacao({ cog: "naoexiste" }, "1.1.1.1", m.db, m.rede, AGORA);
  const lixo = await processarRecuperacao({ cog: "a b" }, "1.1.1.1", m.db, m.rede, AGORA);
  for (const r of [com, sem, lixo]) { assert.equal(r.status, 200); assert.deepEqual(r.corpo, com.corpo); }
  assert.deepEqual(m.chamadas.recuperar, ["ana@exemplo.com"]);
  assert.doesNotMatch(JSON.stringify(com.corpo), /ana@exemplo/);
});
test("recuperação: limite por @ e por rede, sem mudar a resposta", async () => {
  const m = montar();
  for (let i = 0; i < 6; i++) await processarRecuperacao({ cog: "ana" }, "1.1.1.1", m.db, m.rede, AGORA);
  assert.equal(m.chamadas.recuperar.length, LIMITES_ACESSO.recuperarPorCogPorHora);
  const r = await processarRecuperacao({ cog: "ana" }, "1.1.1.1", m.db, m.rede, AGORA);
  assert.equal(r.status, 200);
});
test("recuperação: se o provedor de e-mail falhar, a resposta continua neutra", async () => {
  const m = montar({ falhaRede: true });
  const r = await processarRecuperacao({ cog: "ana" }, "1.1.1.1", m.db, m.rede, AGORA);
  assert.equal(r.status, 200); assert.equal((r.corpo as { ok: boolean }).ok, true);
  assert.equal((await processarRecuperacao({ cog: "ana", email: "x@y.com" }, "1.1.1.1", m.db, m.rede, AGORA)).status, 400);   // não aceita e-mail escolhido pelo visitante
});
test("normalizarCog", () => { assert.equal(normalizarCog("  @@Ana "), "ana"); assert.equal(normalizarCog(null), ""); });

import { escolherJoinerPorArroba, arrobaSeguroParaBusca, emailDaContaPorArroba } from "./acesso.ts";

test("@ → joiner pelo ID permanente: cog ou twitter, maiúsculas ignoradas", () => {
  const linhas = [{ id: 1, cog: "ana", twitter: "@ana" }, { id: 2, cog: "bia", twitter: "@Bia_oficial" }];
  assert.equal(escolherJoinerPorArroba(linhas, "@ANA"), "1");
  assert.equal(escolherJoinerPorArroba(linhas, "bia_oficial"), "2");
  assert.equal(escolherJoinerPorArroba(linhas, "naoexiste"), null);
  assert.equal(escolherJoinerPorArroba(linhas, ""), null);
});
test("COG ambíguo ('Ela' e 'ela') NÃO resolve para ninguém — nem vincula a pessoa errada", () => {
  const linhas = [{ id: 7, cog: "Ela", twitter: "@Ela" }, { id: 8, cog: "ela", twitter: "@ela" }];
  assert.equal(escolherJoinerPorArroba(linhas, "ela"), null);
});
test("mesma pessoa casando por cog e por twitter conta uma vez só", () => {
  assert.equal(escolherJoinerPorArroba([{ id: 3, cog: "gabi", twitter: "@gabi" }], "gabi"), "3");
});
test("o @ que vai para o filtro do servidor só aceita caracteres simples", () => {
  for (const ruim of ["a,b", "x)or(id.gt.0", "a b", "a*", "%", "x'y"]) assert.equal(arrobaSeguroParaBusca(ruim), false, ruim);
  for (const bom of ["ana", "@Ana.Silva", "a_b-c"]) assert.equal(arrobaSeguroParaBusca(bom), true, bom);
});
test("emailDaContaPorArroba usa joiners.id → contas_joiner.joiner_id (nunca contas_joiner.cog) e só devolve e-mail verificado", async () => {
  const consultas: string[] = [];
  const sb: any = {
    from: (t: string) => ({
      select: (_c: string) => ({
        or: () => ({ limit: async () => { consultas.push(t); return { data: [{ id: 5, cog: "ana", twitter: "@ana" }] }; } }),
        eq: (col: string, val: unknown) => ({ maybeSingle: async () => { consultas.push(`${t}.${col}=${val}`); return { data: { user_id: "u-ana" } }; } }),
      }),
    }),
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: id === "u-ana" ? { email: "ana@exemplo.com", email_confirmed_at: "2026-01-01" } : null } }) } },
  };
  assert.equal(await emailDaContaPorArroba(sb, "@Ana"), "ana@exemplo.com");
  assert.deepEqual(consultas, ["joiners", "contas_joiner.joiner_id=5"]);
  const naoVerificado = { ...sb, auth: { admin: { getUserById: async () => ({ data: { user: { email: "ana@exemplo.com", email_confirmed_at: null } } }) } } };
  assert.equal(await emailDaContaPorArroba(naoVerificado, "ana"), null);
  assert.equal(await emailDaContaPorArroba(sb, "a,b"), null);
});
