// Papel do login admin (sem rede, cliente simulado). Rodar:  node --test tests/admin-papel.test.mjs
import { chamadasBloqueadas } from "./helpers/sem-rede.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { criarAdminAuth } from "../src/adminAuthNucleo.js";

const cliente = ({ sessao = true, papel, erroPapel = null, eAdmin = false, erroAdmin = null } = {}) => ({
  auth: { getSession: async () => ({ data: { session: sessao ? { user: { email: "x@ex.com" } } : null }, error: null }) },
  rpc: async nome => nome === "meu_papel_admin" ? { data: papel ?? null, error: erroPapel } : nome === "is_admin" ? { data: eAdmin, error: erroAdmin } : { data: null, error: { message: "rpc inesperada " + nome } },
});

test("sem sessão: sair", async () => assert.equal((await criarAdminAuth(cliente({ sessao: false })).avaliar()).estado, "sair"));
test("papel 'admin': ok com papel admin", async () => { const r = await criarAdminAuth(cliente({ papel: "admin" })).avaliar(); assert.deepEqual([r.estado, r.papel], ["ok", "admin"]); });
test("papel 'staff_pagamentos': ok restrito, com o papel informado", async () => { const r = await criarAdminAuth(cliente({ papel: "staff_pagamentos" })).avaliar(); assert.deepEqual([r.estado, r.papel], ["ok", "staff_pagamentos"]); });
test("conta comum / papel desconhecido: sem permissão (nunca ok)", async () => {
  for (const papel of [null, "", "dono", "ADMIN", "staff"]) { const r = await criarAdminAuth(cliente({ papel })).avaliar(); assert.equal(r.estado, "sem_permissao", String(papel)); }
});
test("ST1 ainda não aplicado (meu_papel_admin não existe): cai no is_admin() como antes", async () => {
  const fnFalta = { message: "Could not find the function public.meu_papel_admin", code: "PGRST202" };
  const a = await criarAdminAuth(cliente({ erroPapel: fnFalta, eAdmin: true })).avaliar(); assert.deepEqual([a.estado, a.papel], ["ok", "admin"]);
  const b = await criarAdminAuth(cliente({ erroPapel: fnFalta, eAdmin: false })).avaliar(); assert.equal(b.estado, "sem_permissao");
});
test("falha em tudo: erro (nunca libera)", async () => {
  const r = await criarAdminAuth(cliente({ erroPapel: { message: "x" }, erroAdmin: { message: "y" } })).avaliar(); assert.equal(r.estado, "erro");
});
test("nenhum teste usou a rede real", () => assert.equal(chamadasBloqueadas.length, 0));
