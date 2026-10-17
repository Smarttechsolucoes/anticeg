// O "OK" de um aviso pessoal registra a leitura em push_reads e NÃO tenta apagar o push (o DELETE sempre falhava por FK e o E0 não pode depender dele). Rodar:  node --test tests/push-banner.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
test("PushBanner.onOk registra push_reads e não apaga de pushes", () => {
  const i = src.indexOf('await supabase.from("push_reads").insert([{ push_id: p.id');
  assert.ok(i > 0);
  const trecho = src.slice(i, i + 400);
  assert.ok(!/from\("pushes"\)\.delete\(\)/.test(trecho), "sem DELETE em pushes logo após o push_reads");
  assert.ok(trecho.includes("setPushAtivos(prev => prev.filter(x => x.id !== p.id))"), "o aviso sai da tela");
});
