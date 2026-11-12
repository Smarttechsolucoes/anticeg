// Testes do "Enviar código" do painel, SEM rede: banco e e-mail simulados; nenhum e-mail é enviado de verdade.
// Rodar: node --test supabase/functions/_shared/admin_codigo.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { processarEnvioAdmin } from "./admin_codigo.ts";
import type { DbAdminCodigo, JoinerAdminCodigo } from "./admin_codigo.ts";

function montar(o: { admin?: boolean; joiner?: JoinerAdminCodigo | null; quantas?: number; conta?: boolean; liberada?: boolean; confiavel?: boolean; auditoriaFalha?: boolean; envioFalha?: boolean } = {}) {
  const log = { enviados: [] as string[], criados: [] as string[], auditorias: [] as unknown[] };
  const joiner = o.joiner === undefined ? { id: 7, cog: "ana", email: "Ana@Gmail.com", bloqueado: false } : o.joiner;
  const db: DbAdminCodigo = {
    ehAdmin: async () => o.admin ?? true,
    quem: async () => "uuid-admin",
    joinerPorId: async () => joiner,
    quantasComEmail: async () => o.quantas ?? 1,
    jaVinculada: async () => o.conta ?? false,
    liberada: async () => o.liberada ?? true,
    vinculoConfiavel: async () => o.confiavel ?? true,
    auditar: async (_id, d) => { if (o.auditoriaFalha) throw new Error("sem registro"); log.auditorias.push(d); },
  };
  const rede = {
    garantirUsuario: async (e: string) => { log.criados.push(e); },
    enviarCodigo: async (e: string) => { if (o.envioFalha) throw new Error("recusado"); log.enviados.push(e); },
  };
  return { db, rede, log };
}

test("administradora: envia para o e-mail do cadastro (minúsculo) e registra antes", async () => {
  const { db, rede, log } = montar();
  const r = await processarEnvioAdmin({ joiner_id: 7 }, db, rede);
  assert.equal(r.status, 200);
  assert.deepEqual(log.enviados, ["ana@gmail.com"]);
  assert.deepEqual(log.criados, ["ana@gmail.com"]);
  assert.equal(log.auditorias.length, 1);
  assert.deepEqual(r.corpo, { ok: true, dominio: "gmail.com", avisos: [] });
  assert.ok(!JSON.stringify(r.corpo).includes("ana@"), "a resposta não devolve o e-mail completo");
});

test("quem não é administradora recebe 403 e nada é consultado nem enviado", async () => {
  const { db, rede, log } = montar({ admin: false });
  const r = await processarEnvioAdmin({ joiner_id: 7 }, db, rede);
  assert.equal(r.status, 403);
  assert.equal(log.enviados.length + log.auditorias.length, 0);
});

test("pedido inválido: campo extra (e-mail digitado), id não inteiro ou ausente", async () => {
  for (const entrada of [{ joiner_id: 7, email: "outro@x.com" }, { joiner_id: "7" }, { joiner_id: 0 }, { joiner_id: 1.5 }, {}, null, [], "x"]) {
    const { db, rede, log } = montar();
    const r = await processarEnvioAdmin(entrada, db, rede);
    assert.equal(r.status, 400, JSON.stringify(entrada));
    assert.equal(log.enviados.length, 0);
  }
});

test("cadastro inexistente: 404", async () => {
  const { db, rede, log } = montar({ joiner: null });
  assert.equal((await processarEnvioAdmin({ joiner_id: 9 }, db, rede)).status, 404);
  assert.equal(log.enviados.length, 0);
});

test("recusas (409) que não enviam nada", async () => {
  const casos: [string, Parameters<typeof montar>[0]][] = [
    ["sem_email", { joiner: { id: 7, cog: "ana", email: "", bloqueado: false } }],
    ["sem_email", { joiner: { id: 7, cog: "ana", email: "não-é-email", bloqueado: false } }],
    ["bloqueado", { joiner: { id: 7, cog: "ana", email: "ana@gmail.com", bloqueado: true } }],
    ["email_compartilhado", { quantas: 2 }],
    ["ja_tem_conta", { conta: true }],
  ];
  for (const [motivo, o] of casos) {
    const { db, rede, log } = montar(o);
    const r = await processarEnvioAdmin({ joiner_id: 7 }, db, rede);
    assert.equal(r.status, 409, motivo);
    assert.equal(r.corpo.motivo, motivo);
    assert.equal(log.enviados.length + log.criados.length + log.auditorias.length, 0, motivo);
  }
});

test("não liberada / vínculo não confiável: envia, mas AVISA que a ativação ficará pendente", async () => {
  const { db, rede, log } = montar({ liberada: false, confiavel: false });
  const r = await processarEnvioAdmin({ joiner_id: 7 }, db, rede);
  assert.equal(r.status, 200);
  assert.equal((r.corpo.avisos as string[]).length, 2);
  assert.equal(log.enviados.length, 1);
});

test("se o registro falha, NADA é enviado", async () => {
  const { db, rede, log } = montar({ auditoriaFalha: true });
  await assert.rejects(processarEnvioAdmin({ joiner_id: 7 }, db, rede));
  assert.equal(log.enviados.length + log.criados.length, 0);
});

test("envio recusado pelo serviço: 502, sem afirmar que chegou", async () => {
  const { db, rede } = montar({ envioFalha: true });
  const r = await processarEnvioAdmin({ joiner_id: 7 }, db, rede);
  assert.equal(r.status, 502);
  assert.equal(r.corpo.motivo, "envio_falhou");
});
