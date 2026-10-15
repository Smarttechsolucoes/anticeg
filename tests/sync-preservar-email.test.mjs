// Testes da preservação de e-mail no sync (sem rede, sem Supabase). Rodar:  node --test tests/sync-preservar-email.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { montarUpsertJoiner, carregarIdsComConta } from "../scripts/preservar-email.js";

const J = (email) => ({ cog: "ana", nome: "Ana", email, twitter: "@ana" });
const comConta = new Set([7]);

test("célula vazia na planilha NÃO apaga o e-mail do banco (o campo email nem é enviado)", () => {
  for (const vazio of [null, "", "   ", undefined]) {
    const r = montarUpsertJoiner(J(vazio), { id: 3, email: "ana@exemplo.com" }, { idsComConta: new Set() });
    assert.equal("email" in r, false, `vazio=${JSON.stringify(vazio)}`);
    assert.deepEqual(Object.keys(r).sort(), ["cog", "nome", "twitter"], "os demais campos seguem como sempre");
  }
});

test("joiner com conta ativada: o sync não troca o e-mail verificado nem por um valor preenchido na planilha", () => {
  const r = montarUpsertJoiner(J("outro@exemplo.com"), { id: 7, email: "ana@exemplo.com" }, { idsComConta: comConta });
  assert.equal("email" in r, false);
  assert.equal(r.nome, "Ana");
});

test("sem conta: e-mail novo da planilha continua preenchendo/atualizando (comportamento de hoje), em minúsculas", () => {
  assert.equal(montarUpsertJoiner(J("Nova@Exemplo.com"), { id: 3, email: null }, { idsComConta: comConta }).email, "nova@exemplo.com");
  assert.equal(montarUpsertJoiner(J("corrigido@exemplo.com"), { id: 3, email: "errado@exemplo.com" }, { idsComConta: comConta }).email, "corrigido@exemplo.com");
  assert.equal(montarUpsertJoiner(J("novo@exemplo.com"), undefined, { idsComConta: comConta }).email, "novo@exemplo.com", "joiner que ainda não existe no banco");
});

test("não foi possível consultar as contas: fail-safe, NENHUM e-mail é enviado", () => {
  const r = montarUpsertJoiner(J("novo@exemplo.com"), { id: 3, email: null }, { idsComConta: new Set(), contasIndisponiveis: true });
  assert.equal("email" in r, false);
});

test("o objeto de entrada não é alterado", () => {
  const entrada = J("a@b.com"); const copia = JSON.stringify(entrada);
  montarUpsertJoiner(entrada, { id: 7 }, { idsComConta: comConta });
  assert.equal(JSON.stringify(entrada), copia);
});

const sb = (resp) => ({ from: (t) => ({ select: async () => { sb.chamadas.push(t); return resp; } }) });
sb.chamadas = [];
test("carregarIdsComConta: lista os joiner_id; tabela inexistente = ninguém tem conta; outro erro = indisponível", async () => {
  assert.deepEqual([...(await carregarIdsComConta(sb({ data: [{ joiner_id: 1 }, { joiner_id: 9 }], error: null }))).idsComConta].sort(), [1, 9]);
  assert.equal(sb.chamadas.at(-1), "contas_joiner");
  const falta = await carregarIdsComConta(sb({ data: null, error: { code: "42P01", message: 'relation "contas_joiner" does not exist' } }));
  assert.equal(falta.idsComConta.size, 0); assert.equal(falta.contasIndisponiveis, false);
  const cache = await carregarIdsComConta(sb({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.contas_joiner' in the schema cache" } }));
  assert.equal(cache.contasIndisponiveis, false);
  const outro = await carregarIdsComConta(sb({ data: null, error: { code: "57014", message: "statement timeout" } }));
  assert.equal(outro.contasIndisponiveis, true);
});

test("sync-masterlist.js usa a montagem segura em TODO upsert de joiners e lê o id das joiners", () => {
  const src = readFileSync(new URL("../scripts/sync-masterlist.js", import.meta.url), "utf8");
  assert.match(src, /select\('id, cog, email, twitter'\)/);
  assert.match(src, /montarUpsertJoiner\(j, atual, \{ idsComConta, contasIndisponiveis \}\)/);
  assert.match(src, /\.upsert\(alvo, \{ onConflict: 'cog'/);
  assert.doesNotMatch(src, /\.upsert\(j, /, "nenhum upsert de joiner sem passar pela montagem");
});
