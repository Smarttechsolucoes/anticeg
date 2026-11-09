// Testes da preservação de e-mail no sync (sem rede, sem Supabase). Rodar:  node --test tests/sync-preservar-email.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { montarUpsertJoiner, carregarIdsComConta, carregarIdsEmailTrocado, emailPlanilhaDivergeDoTrocado } from "../scripts/preservar-email.js";

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
  assert.match(src, /select\('id, cog, email, twitter, confirmado'\)/);
  assert.match(src, /montarUpsertJoiner\(\{ \.\.\.j, cog: cogDoUpsert\(j\.cog, idxJoiners\) \}, atual, \{ idsComConta, contasIndisponiveis, idsEmailTrocado, trocadosIndisponiveis \}\)/);
  assert.match(src, /\.upsert\(alvo, \{ onConflict: 'cog'/);
  assert.doesNotMatch(src, /\.upsert\(j, /, "nenhum upsert de joiner sem passar pela montagem");
});

// ---- e-mail TROCADO pela administração ou por pedido com prova verificada: o sync não o desfaz
const trocados = new Set([11]);
test("e-mail trocado de forma controlada: o sync NÃO o troca de volta pelo valor antigo da planilha", () => {
  const r = montarUpsertJoiner(J("antigo@exemplo.com"), { id: 11, email: "novo@exemplo.com" }, { idsComConta: new Set(), idsEmailTrocado: trocados });
  assert.equal("email" in r, false); assert.equal(r.nome, "Ana", "os demais campos seguem como sempre");
  assert.equal(montarUpsertJoiner(J("antigo@exemplo.com"), { id: 12, email: "x@exemplo.com" }, { idsComConta: new Set(), idsEmailTrocado: trocados }).email, "antigo@exemplo.com", "quem NÃO teve troca controlada segue como hoje");
  assert.equal(montarUpsertJoiner(J("antigo@exemplo.com"), { id: 11, email: "novo@exemplo.com" }, { idsComConta: new Set() }).email, "antigo@exemplo.com", "sem a lista (J4c0 ausente) nada muda no comportamento de hoje");
});
test("não foi possível consultar as trocas de e-mail: fail-safe, NENHUM e-mail é enviado", () => {
  const r = montarUpsertJoiner(J("novo@exemplo.com"), { id: 3, email: null }, { idsComConta: new Set(), trocadosIndisponiveis: true });
  assert.equal("email" in r, false);
});
test("aviso de divergência: só quando o cadastro é protegido E a planilha ainda mostra outro e-mail", () => {
  assert.equal(emailPlanilhaDivergeDoTrocado(J("antigo@exemplo.com"), { id: 11, email: "novo@exemplo.com" }, trocados), true);
  assert.equal(emailPlanilhaDivergeDoTrocado(J("NOVO@exemplo.com "), { id: 11, email: "novo@exemplo.com" }, trocados), false, "já igual (sem maiúscula/espaço)");
  assert.equal(emailPlanilhaDivergeDoTrocado(J(""), { id: 11, email: "novo@exemplo.com" }, trocados), false, "célula vazia");
  assert.equal(emailPlanilhaDivergeDoTrocado(J("antigo@exemplo.com"), { id: 12, email: "x@exemplo.com" }, trocados), false, "não protegido");
});
const sbAud = (paginas, erro) => ({ from: () => { const q = { in: () => q, order: () => q, range: async (a) => erro ? { data: null, error: erro } : { data: paginas[a / 1000] ?? [], error: null } }; return { select: () => q }; } });
test("carregarIdsEmailTrocado: lê as páginas; tabela inexistente = ninguém; outro erro = indisponível", async () => {
  const p0 = Array.from({ length: 1000 }, (_, i) => ({ joiner_id: i + 1 })), p1 = [{ joiner_id: 5000 }, { joiner_id: null }];
  const r = await carregarIdsEmailTrocado(sbAud([p0, p1])); assert.equal(r.idsEmailTrocado.size, 1001); assert.equal(r.idsEmailTrocado.has(5000), true); assert.equal(r.trocadosIndisponiveis, false);
  assert.equal((await carregarIdsEmailTrocado(sbAud([], { code: "42P01", message: "does not exist" }))).trocadosIndisponiveis, false);
  assert.equal((await carregarIdsEmailTrocado(sbAud([], { code: "57014", message: "statement timeout" }))).trocadosIndisponiveis, true);
});
