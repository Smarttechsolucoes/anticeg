// Piloto de senhas: a lista autorizada é decidida SÓ no servidor. Testes do pedido de código (pedir-codigo-joiner) com banco e Auth simulados — sem rede, sem e-mail de verdade.
// Rodar:  node --test supabase/functions/_shared/piloto.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { processarPedidoCodigo, garantirUsuarioAdmin, LIMITES_ATIVACAO } from "./ativacao.ts";
import type { DbAtivacao, JoinerAtivacao, RedeAtivacao } from "./ativacao.ts";

const AGORA = new Date("2026-10-20T15:00:00Z");
const CINCO = [{ id: 2, cog: "al.melo", email: "al.melo@exemplo.com" }, { id: 272, cog: "nicknowsaurus", email: "nicolle@exemplo.com" }, { id: 42, cog: "lyrichangbin", email: "lyric@exemplo.com" },
  { id: 187751, cog: "gnabjubs", email: "gnab@exemplo.com" }, { id: 7213, cog: "ttalilitinha", email: "tali@exemplo.com" }];
const LIBERADAS = new Set(CINCO.map(c => c.id));                                   // no banco real: tabela ativacao_ondas + ativacao_estado (função ativacao_liberada)
const JOINERS: (JoinerAtivacao & { bloqueado: boolean })[] = [
  ...CINCO.map(c => ({ ...c, bloqueado: false })),
  { id: 500, cog: "fora_da_lista", email: "fora@exemplo.com", bloqueado: false },
  { id: 600, cog: "ela", email: "ela1@exemplo.com", bloqueado: false }, { id: 601, cog: "Ela", email: "ela2@exemplo.com", bloqueado: false },
  { id: 700, cog: "dup_a", email: "compartilhado@exemplo.com", bloqueado: false }, { id: 701, cog: "dup_b", email: "compartilhado@exemplo.com", bloqueado: false },
  { id: 800, cog: "bloqueada", email: "bloq@exemplo.com", bloqueado: true },
];
const VINCULADAS = new Set<number>([900]);

function montar({ vinculadas = VINCULADAS, liberadas = LIBERADAS, usuarioFalha = false, joiners = JOINERS } = {}) {
  const tentativas: string[] = [], chamadas: string[] = [];
  const db: DbAtivacao = {
    contar: async (chave) => tentativas.filter(t => t === chave).length,
    registrar: async (chave) => { tentativas.push(chave); },
    joinersPorCog: async (cog) => joiners.filter(j => String(j.cog).toLowerCase() === cog) as never,
    quantasComEmail: async (email) => joiners.filter(j => String(j.email).toLowerCase() === email).length,
    jaVinculada: async (id) => vinculadas.has(id),
    liberada: async (id) => liberadas.has(id),                                      // decisão do SERVIDOR
  };
  const rede: RedeAtivacao = {
    garantirUsuario: async (email) => { chamadas.push("usuario:" + email); if (usuarioFalha) throw new Error("não foi possível preparar a conta"); },
    enviarCodigo: async (email) => { chamadas.push("codigo:" + email); },
  };
  return { db, rede, tentativas, chamadas };
}
const pedir = (m: ReturnType<typeof montar>, cog: string, email: string, ip = "1.2.3.4") => processarPedidoCodigo({ cog, email }, ip, m.db, m.rede, AGORA);

test("as cinco da lista: o código vai SÓ para o e-mail do cadastro de cada uma (uma conta e um envio por pessoa)", async () => {
  for (const c of CINCO) {
    const m = montar(); const r = await pedir(m, "@" + c.cog.toUpperCase(), c.email.toUpperCase());
    assert.deepEqual(r, { status: 200, corpo: { ok: true } });
    assert.deepEqual(m.chamadas, ["usuario:" + c.email, "codigo:" + c.email], c.cog);
  }
});

test("NEGATIVO — joiner FORA da lista: mesma resposta, NENHUMA conta criada no Auth e NENHUM e-mail enviado", async () => {
  const m = montar(); const r = await pedir(m, "fora_da_lista", "fora@exemplo.com");
  assert.deepEqual(r, { status: 200, corpo: { ok: true } });
  assert.deepEqual(m.chamadas, [], "não criou usuário no Auth nem pediu código");
  assert.ok(m.tentativas.some(t => t === "cog:fora_da_lista"), "mas a tentativa conta para o limite");
});

test("NEGATIVO — a lista é do servidor: se a onda é pausada (ninguém liberado), nem as cinco recebem código", async () => {
  for (const c of CINCO) { const m = montar({ liberadas: new Set() }); await pedir(m, c.cog, c.email); assert.deepEqual(m.chamadas, [], c.cog); }
});

test("NEGATIVO — outros casos que nunca enviam: e-mail digitado diferente do cadastro, e-mail dividido, já vinculada, bloqueada, @ ambíguo (Ela/ela), inexistente", async () => {
  const casos: [string, string, ReturnType<typeof montar>][] = [
    ["al.melo", "outra.pessoa@exemplo.com", montar()],
    ["dup_a", "compartilhado@exemplo.com", montar({ liberadas: new Set([700, 701]) })],
    ["lyrichangbin", "lyric@exemplo.com", montar({ vinculadas: new Set([42]) })],
    ["bloqueada", "bloq@exemplo.com", montar({ liberadas: new Set([800]) })],
    ["ela", "ela1@exemplo.com", montar({ liberadas: new Set([600, 601]) })],
    ["nao_existe", "x@exemplo.com", montar()],
  ];
  for (const [cog, email, m] of casos) { const r = await pedir(m, cog, email); assert.deepEqual(r, { status: 200, corpo: { ok: true } }, cog); assert.deepEqual(m.chamadas, [], cog + " não pode enviar nada"); }
});

test("a nicknowsaurus depois de o cadastro antigo ser excluído: o e-mail dela é único (1 cadastro) e o código sai; com o antigo (2 cadastros) NÃO sairia", async () => {
  const unico = montar(); await pedir(unico, "nicknowsaurus", "nicolle@exemplo.com");
  assert.deepEqual(unico.chamadas, ["usuario:nicolle@exemplo.com", "codigo:nicolle@exemplo.com"]);
  const comAntigo = montar({ joiners: [...JOINERS, { id: 12, cog: "biachinicks", email: "nicolle@exemplo.com", bloqueado: false }] });
  await pedir(comAntigo, "nicknowsaurus", "nicolle@exemplo.com");
  assert.deepEqual(comAntigo.chamadas, [], "sem o cadastro antigo excluído o servidor não envia: é a trava que impede a ambiguidade");
});

test("se não conseguir preparar a conta no Auth, NÃO envia código (e a resposta continua neutra)", async () => {
  const falha = montar({ usuarioFalha: true }); const r = await pedir(falha, "al.melo", "al.melo@exemplo.com");
  assert.deepEqual(r, { status: 200, corpo: { ok: true } });
  assert.deepEqual(falha.chamadas, ["usuario:al.melo@exemplo.com"], "falha ao preparar a conta: nenhum envio");
});

// ── criação da conta no Auth: fluxo ADMINISTRATIVO, sem cadastro público, sem senha, sem tocar em conta existente ──────────────────────
function adminFalso(resposta: (a: { email: string; email_confirm: boolean }) => { message: string } | null) {
  const chamadas: unknown[] = [], outras: string[] = [];
  const admin = new Proxy({ createUser: async (a: { email: string; email_confirm: boolean }) => { chamadas.push(a); return { error: resposta(a) }; } } as Record<string, unknown>, {
    get: (alvo, nome: string) => nome in alvo ? alvo[nome] : (() => { outras.push(nome); throw new Error("método de administração inesperado: " + nome); }),
  });
  return { sb: { auth: { admin } } as never, chamadas, outras };
}
test("conta nova: createUser administrativo com e-mail JÁ CONFIRMADO e SEM senha (o Auth gera uma aleatória que ninguém conhece); nada além disso", async () => {
  const a = adminFalso(() => null);
  assert.equal(await garantirUsuarioAdmin(a.sb, "al.melo@exemplo.com"), "criado");
  assert.deepEqual(a.chamadas, [{ email: "al.melo@exemplo.com", email_confirm: true }], "só e-mail e email_confirm: nenhuma senha, nenhum metadado");
  assert.ok(!("password" in (a.chamadas[0] as object)) && !("password_hash" in (a.chamadas[0] as object)));
  assert.deepEqual(a.outras, []);
});
test("NEGATIVO — e-mail que já tem conta (ex.: a da @lyrichangbin): o Auth recusa a criação, a função só reconhece 'já existia' e NÃO chama nenhum método que altere conta (nem senha, nem confirmação, nem ban, nem exclusão)", async () => {
  for (const msg of ["A user with this email address has already been registered", "User already registered", "email_exists: exists"]) {
    const a = adminFalso(() => ({ message: msg }));
    assert.equal(await garantirUsuarioAdmin(a.sb, "lyric@exemplo.com"), "ja_existia", msg);
    assert.equal(a.chamadas.length, 1, "uma única chamada"); assert.deepEqual(a.outras, [], "nenhum updateUserById, deleteUser, generateLink etc.");
  }
});
test("NEGATIVO — qualquer outro erro do Auth interrompe: sem conta preparada não há envio de código", async () => {
  const a = adminFalso(() => ({ message: "Database error creating new user" }));
  await assert.rejects(garantirUsuarioAdmin(a.sb, "x@exemplo.com"), /não foi possível preparar a conta/);
});
test("fluxo sem cadastro público: o código do servidor só usa createUser administrativo e /auth/v1/otp com create_user:false; não existe signUp, signInWithOtp, invite nem generateLink", () => {
  const idx = readFileSync(new URL("../pedir-codigo-joiner/index.ts", import.meta.url), "utf8");
  const ati = readFileSync(new URL("./ativacao.ts", import.meta.url), "utf8");
  assert.match(idx, /garantirUsuarioAdmin\(sb as never, email\)/); assert.match(ati, /createUser\(\{ email, email_confirm: true \}\)/);
  assert.doesNotMatch(ati + idx, /email_confirm: false/, "conta NÃO confirmada quebra o envio com o cadastro público desligado");
  assert.match(idx, /create_user: false/, "o pedido do código nunca cria usuário por conta própria");
  assert.match(idx, /\/auth\/v1\/otp/); assert.doesNotMatch(ati + idx, /signUp|signInWithOtp|auth\/v1\/signup|inviteUserByEmail|generateLink|updateUserById|deleteUser|ban_duration/);
  const outros = ["../login-joiner/index.ts", "../recuperar-senha-joiner/index.ts", "./acesso.ts"].map(f => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(outros, /signUp|signInWithOtp|auth\/v1\/signup|createUser|inviteUserByEmail|generateLink|updateUserById/, "login e recuperação não criam nem alteram conta");
  assert.match(outros, /auth\/v1\/token\?grant_type=password/); assert.match(outros, /auth\/v1\/recover/);
});

test("a resposta é IDÊNTICA em todos os casos (o navegador não descobre quem está na lista, quem tem conta nem de quem é o e-mail)", async () => {
  const entradas: [string, string][] = [["al.melo", "al.melo@exemplo.com"], ["fora_da_lista", "fora@exemplo.com"], ["al.melo", "errado@exemplo.com"], ["nao_existe", "x@exemplo.com"], ["dup_a", "compartilhado@exemplo.com"]];
  const respostas = new Set<string>();
  for (const [c, e] of entradas) respostas.add(JSON.stringify(await pedir(montar(), c, e)));
  assert.equal(respostas.size, 1);
});

test("o cliente não escolhe a lista: campos extras (liberada, id, onda, lista) são recusados", async () => {
  for (const extra of [{ liberada: true }, { id: 500 }, { onda: 1 }, { lista: [500] }, { joiner_id: 500 }]) {
    const m = montar(); const r = await processarPedidoCodigo({ cog: "fora_da_lista", email: "fora@exemplo.com", ...extra }, "1.2.3.4", m.db, m.rede, AGORA);
    assert.equal(r.status, 400); assert.deepEqual(m.chamadas, []);
  }
});

test("limites por hora: depois de 5 pedidos para o mesmo @ a resposta é 429 e nada é enviado", async () => {
  const m = montar();
  for (let i = 0; i < LIMITES_ATIVACAO.porCogPorHora; i++) await pedir(m, "al.melo", "al.melo@exemplo.com", "9.9.9." + i);
  const antes = m.chamadas.length; const r = await pedir(m, "al.melo", "al.melo@exemplo.com", "8.8.8.8");
  assert.equal(r.status, 429); assert.equal(m.chamadas.length, antes);
});

test("o código do navegador e das funções NÃO contém a lista: nenhum @ nem ID autorizado aparece em ativacao.ts, no index da função nem na página do piloto", () => {
  const arquivos = ["ativacao.ts", "../pedir-codigo-joiner/index.ts", "../login-joiner/index.ts", "../recuperar-senha-joiner/index.ts", "acesso.ts"];
  for (const a of arquivos) {
    const t = readFileSync(new URL(a, import.meta.url), "utf8");
    assert.doesNotMatch(t, /al\.melo|nicknowsaurus|lyrichangbin|gnabjubs|ttalilitinha/i, a); assert.doesNotMatch(t, /\b(187751|7213|272)\b/, a);
  }
  const idx = readFileSync(new URL("../pedir-codigo-joiner/index.ts", import.meta.url), "utf8");
  assert.match(idx, /rpc\("ativacao_liberada", \{ p_joiner_id: id \}\)/, "a liberação é consultada no banco (ativacao_liberada) a cada pedido");
});
