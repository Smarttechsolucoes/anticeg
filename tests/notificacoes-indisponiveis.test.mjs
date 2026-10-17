// Guardas estáticas: enquanto o N0 mantém public.notifications fechada, o site não pode ler nem gravar nela. Rodar:  node --test tests/notificacoes-indisponiveis.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("a chave das notificações internas existe e está DESLIGADA", () => {
  assert.ok(/^const NOTIFICACOES_INTERNAS_ATIVAS = false;$/m.test(src));
});

test("toda gravação em notifications passa pelo helper protegido pela chave", () => {
  const inserts = [...src.matchAll(/from\("notifications"\)\s*\.?\s*(insert|upsert|delete)/g)];
  assert.equal(inserts.length, 1, "só o helper pode inserir direto");
  const updates = [...src.matchAll(/from\("notifications"\)\.update\(/g)];
  assert.equal(updates.length, 2, "as duas atualizações 'OK, entendi' ficam dentro do banner, que depende da lista (vazia com a chave desligada)");
  const h = src.indexOf("async function inserirNotificacaoInterna");
  assert.ok(h > 0 && /if \(!NOTIFICACOES_INTERNAS_ATIVAS\) return \{ data: null, error: null \};/.test(src.slice(h, h + 250)), "o helper retorna sem tocar no banco quando desligado");
  assert.equal([...src.matchAll(/inserirNotificacaoInterna\(\[/g)].length, 3, "report resolvido + 2 pedidos de endereço");
});

test("a leitura de notifications só acontece com a chave ligada; desligada, a lista fica vazia", () => {
  const i = src.indexOf('from("notifications")\n        .select') >= 0 ? src.indexOf('from("notifications")\n') : src.indexOf('supabase.from("notifications")\n');
  const ctx = src.slice(src.lastIndexOf("async function carregarAvisos"), src.indexOf("// Avisos: ao restaurar sessão"));
  assert.ok(/if \(NOTIFICACOES_INTERNAS_ATIVAS\) \{[\s\S]*from\("notifications"\)[\s\S]*\} else setNotificacoes\(\[\]\);/.test(ctx), "leitura protegida");
  assert.ok(i > 0);
});

test("push, e-mail e demais avisos continuam como estavam (pushes, push_reads, reports, inserirPush)", () => {
  const ctx = src.slice(src.lastIndexOf("async function carregarAvisos"), src.indexOf("// Avisos: ao restaurar sessão"));
  for (const t of ['from("reports")', 'from("pushes")', 'from("push_reads")']) assert.ok(ctx.includes(t), t);
  assert.ok(src.includes('return supabase.from("pushes").insert(rows);'));
  const marcar = src.slice(src.indexOf("async function marcarResolvido"), src.indexOf("async function marcarResolvido") + 1400);
  assert.ok(marcar.includes("await inserirPush(") && (marcar.includes("sendEmailJoiner(") || marcar.includes("notificarEmail(")), "push e e-mail do report resolvido intactos");
});

test("a admin é avisada de que o aviso dentro do site está indisponível ao solicitar endereço", () => {
  assert.equal([...src.matchAll(/fica indisponível até o lançamento/g)].length, 2);
});
