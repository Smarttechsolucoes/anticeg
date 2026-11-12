// Testes da ativação automática (J22), SEM rede: banco e e-mail simulados; nenhum e-mail é enviado de verdade.
// Rodar: node --test supabase/functions/_shared/ativacao_auto.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { processarAuto, LIMITES_AUTO } from "./ativacao_auto.ts";
import type { DbAuto, RedeAuto, ResultadoConcluir } from "./ativacao_auto.ts";
import type { JoinerAtivacao } from "./ativacao.ts";

const AGORA = new Date("2026-11-12T15:00:00Z");
const J = (id: number, cog: string, email: string | null, bloqueado = false): JoinerAtivacao => ({ id, cog, email, bloqueado });
function montar(o: { joiners?: JoinerAtivacao[]; contaDe?: number[]; naoLiberadas?: number[]; tentativas?: Record<string, number>; codigoCerto?: string; concluir?: ResultadoConcluir; usuario?: string | null } = {}) {
  const joiners = o.joiners ?? [J(1, "ana", "ana@gmail.com"), J(2, "bia", null), J(3, "cris", "cris@x.com"), J(4, "dora", "dup@x.com"), J(5, "edu", "dup@x.com"), J(6, "fe", "fe@x.com", true), J(7, "gui", "gui@x.com"), J(8, "ela", "a@x.com"), J(9, "Ela", "b@x.com")];
  const log = { enviados: [] as string[], criados: [] as string[], avisos: [] as string[], concluidos: [] as string[], registros: [] as string[] };
  const db: DbAuto = {
    contar: async (chave) => o.tentativas?.[chave] ?? 0,
    registrar: async (chave) => { log.registros.push(chave); },
    joinersPorCog: async (cog) => joiners.filter(j => j.cog.toLowerCase() === cog.toLowerCase()),
    quantasComEmail: async (email) => joiners.filter(j => String(j.email ?? "").toLowerCase() === email).length,
    jaVinculada: async (id) => (o.contaDe ?? [7]).includes(id),
    liberada: async (id) => !(o.naoLiberadas ?? []).includes(id),
  };
  const rede: RedeAuto = {
    garantirUsuario: async (e) => { log.criados.push(e); },
    enviarCodigo: async (e) => { log.enviados.push(e); },
    verificarCodigo: async (e, c) => (c === (o.codigoCerto ?? "123456") ? { access_token: "at-" + e, refresh_token: "rt" } : null),
    usuarioDoToken: async () => (o.usuario === undefined ? "uuid-1" : o.usuario),
    concluir: async (_u, cog) => { log.concluidos.push(cog); return o.concluir ?? { status: "ok" }; },
    avisarTroca: async (e) => { log.avisos.push(e); },
  };
  const rodar = (entrada: unknown, jwt: string | null = null) => processarAuto(entrada, jwt, "1.2.3.4", db, rede, AGORA);
  return { rodar, log };
}

test("consultar: cadastro com e-mail único -> mostra só a máscara, nunca o e-mail completo", async () => {
  const { rodar } = montar();
  const r = await rodar({ acao: "consultar", cog: "@Ana" });
  assert.equal(r.corpo.proximo, "confirmar_email");
  assert.match(String(r.corpo.email_mascarado), /•••|\*\*\*/);
  assert.ok(!JSON.stringify(r.corpo).includes("ana@gmail.com"));
});
test("consultar: sem e-mail, @ inexistente e @ repetido por maiúscula -> informar_email (não revela se o @ existe)", async () => {
  const { rodar } = montar();
  for (const cog of ["bia", "naoexiste", "ela"]) assert.equal((await rodar({ acao: "consultar", cog })).corpo.proximo, "informar_email", cog);
});
test("consultar: já tem conta -> entrar; bloqueado e e-mail repartido -> ajuda", async () => {
  const { rodar } = montar();
  assert.equal((await rodar({ acao: "consultar", cog: "gui" })).corpo.proximo, "entrar");
  assert.equal((await rodar({ acao: "consultar", cog: "fe" })).corpo.proximo, "ajuda");
  assert.equal((await rodar({ acao: "consultar", cog: "dora" })).corpo.proximo, "ajuda");
});
test("enviar para o e-mail do cadastro: vai SÓ para ele", async () => {
  const { rodar, log } = montar();
  const r = await rodar({ acao: "enviar", cog: "ana", usar_cadastrado: true });
  assert.deepEqual(r.corpo, { ok: true });
  assert.deepEqual(log.enviados, ["ana@gmail.com"]);
});
test("enviar para o e-mail informado: cadastro sem e-mail (bia) e troca de e-mail (cris)", async () => {
  const { rodar, log } = montar();
  await rodar({ acao: "enviar", cog: "bia", email: " Bia@Nova.com " });
  await rodar({ acao: "enviar", cog: "cris", email: "cris@novo.com" });
  assert.deepEqual(log.enviados, ["bia@nova.com", "cris@novo.com"]);
});
test("enviar: e-mail informado que já é de OUTRO cadastro -> ajuda, nada enviado", async () => {
  const { rodar, log } = montar();
  const r = await rodar({ acao: "enviar", cog: "bia", email: "cris@x.com" });
  assert.equal(r.corpo.proximo, "ajuda");
  assert.equal(log.enviados.length, 0);
});
test("enviar: conflitos nunca enviam (repartido, bloqueado, já tem conta, não liberada, @ inexistente)", async () => {
  const { rodar, log } = montar({ naoLiberadas: [3] });
  assert.equal((await rodar({ acao: "enviar", cog: "dora", email: "novo1@x.com" })).corpo.proximo, "ajuda");
  assert.equal((await rodar({ acao: "enviar", cog: "fe", email: "novo2@x.com" })).corpo.proximo, "ajuda");
  assert.equal((await rodar({ acao: "enviar", cog: "gui", email: "novo3@x.com" })).corpo.proximo, "entrar");
  assert.equal((await rodar({ acao: "enviar", cog: "cris", email: "novo4@x.com" })).corpo.proximo, "aguardando");
  assert.deepEqual((await rodar({ acao: "enviar", cog: "naoexiste", email: "novo5@x.com" })).corpo, { ok: true });
  assert.equal(log.enviados.length, 0);
});
test("enviar: pedido precisa de EXATAMENTE um entre usar_cadastrado e email; campos extras recusados", async () => {
  const { rodar, log } = montar();
  for (const e of [{ acao: "enviar", cog: "ana" }, { acao: "enviar", cog: "ana", usar_cadastrado: true, email: "a@b.com" }, { acao: "enviar", cog: "ana", email: "invalido" }, { acao: "enviar", cog: "ana", usar_cadastrado: true, extra: 1 }])
    assert.equal((await rodar(e)).status, 400, JSON.stringify(e));
  assert.equal(log.enviados.length, 0);
});
test("limites: passou do limite por @ ou por e-mail -> 429 e nada enviado", async () => {
  const a = montar({ tentativas: { "cog:ana": LIMITES_AUTO.porCogPorHora } });
  assert.equal((await a.rodar({ acao: "enviar", cog: "ana", usar_cadastrado: true })).status, 429);
  const b = montar({ tentativas: { "email:x@y.com": LIMITES_AUTO.porEmailPorHora } });
  assert.equal((await b.rodar({ acao: "enviar", cog: "bia", email: "x@y.com" })).status, 429);
  assert.equal(a.log.enviados.length + b.log.enviados.length, 0);
});
test("verificar: código certo devolve a sessão; errado ou vencido -> 400 sem sessão; o e-mail do cadastro é usado quando não é informado", async () => {
  const { rodar } = montar();
  const ok = await rodar({ acao: "verificar", cog: "ana", codigo: "123 456" });
  assert.equal(ok.status, 200); assert.equal(ok.corpo.access_token, "at-ana@gmail.com");
  assert.equal((await rodar({ acao: "verificar", cog: "bia", email: "Bia@Nova.com", codigo: "123456" })).corpo.access_token, "at-bia@nova.com");
  assert.equal((await rodar({ acao: "verificar", cog: "ana", codigo: "000000" })).status, 400);
  assert.equal((await rodar({ acao: "verificar", cog: "bia", codigo: "123456" })).status, 400, "sem e-mail no cadastro e sem e-mail informado não há o que verificar");
  assert.equal((await rodar({ acao: "verificar", cog: "ana", codigo: "12" })).status, 400);
});
test("verificar: tentativas de código são limitadas por @", async () => {
  const { rodar } = montar({ tentativas: { "verificar:ana": LIMITES_AUTO.verificarPorCogPorHora } });
  assert.equal((await rodar({ acao: "verificar", cog: "ana", codigo: "123456" })).status, 429);
});
test("concluir: exige o token de quem está logada; liga a conta; avisa o e-mail ANTIGO só quando houve troca", async () => {
  const sem = montar({ usuario: null });
  assert.equal((await sem.rodar({ acao: "concluir", cog: "ana" }, null)).status, 401);
  assert.equal((await sem.rodar({ acao: "concluir", cog: "ana" }, "jwt-invalido")).status, 401);
  assert.equal(sem.log.concluidos.length, 0);

  const igual = montar({ concluir: { status: "ok", email_trocado: false, email_antigo: null } });
  assert.deepEqual((await igual.rodar({ acao: "concluir", cog: "ana" }, "jwt")).corpo, { ok: true, resultado: "ok" });
  assert.equal(igual.log.avisos.length, 0);

  const troca = montar({ concluir: { status: "ok", email_trocado: true, email_antigo: "cris@x.com" } });
  const r = await troca.rodar({ acao: "concluir", cog: "cris" }, "jwt");
  assert.equal(r.corpo.resultado, "ok");
  assert.deepEqual(troca.log.avisos, ["cris@x.com"]);
  assert.ok(!JSON.stringify(r.corpo).includes("cris@x.com"), "a resposta não devolve o e-mail antigo");
});
test("concluir: conflito do banco vira 'pendente' (a administração vê); não liberada vira 'aguardando'", async () => {
  assert.equal((await montar({ concluir: { status: "pendente" } }).rodar({ acao: "concluir", cog: "ana" }, "jwt")).corpo.resultado, "pendente");
  assert.equal((await montar({ concluir: { status: "aguardando_liberacao" } }).rodar({ acao: "concluir", cog: "ana" }, "jwt")).corpo.resultado, "aguardando");
});
test("a falha ao avisar o e-mail antigo não derruba a ativação", async () => {
  const m = montar({ concluir: { status: "ok", email_trocado: true, email_antigo: "cris@x.com" } });
  const r = await processarAuto({ acao: "concluir", cog: "cris" }, "jwt", "1.1.1.1", {
    contar: async () => 0, registrar: async () => {}, joinersPorCog: async () => [], quantasComEmail: async () => 0, jaVinculada: async () => false, liberada: async () => true,
  }, { garantirUsuario: async () => {}, enviarCodigo: async () => {}, verificarCodigo: async () => null, usuarioDoToken: async () => "u", concluir: async () => ({ status: "ok", email_trocado: true, email_antigo: "cris@x.com" }), avisarTroca: async () => { throw new Error("sendgrid fora"); } }, AGORA);
  assert.equal(r.corpo.resultado, "ok"); void m;
});
test("ação desconhecida, @ inválido ou entrada inválida -> 400", async () => {
  const { rodar } = montar();
  for (const e of [{ acao: "x", cog: "ana" }, { acao: "consultar", cog: "" }, { acao: "consultar", cog: "a b" }, { acao: "consultar", cog: "ana", extra: 1 }, null, [], "x"]) assert.equal((await rodar(e)).status, 400, JSON.stringify(e));
});
