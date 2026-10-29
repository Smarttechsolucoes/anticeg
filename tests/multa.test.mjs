// Testes da regra de multa (sem rede, sem Supabase). Rodar:  node --test tests/multa.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { diasAtraso, multaPorDia, multaAtraso, diasParaVencer } from "../src/multa.js";

// instantes escolhidos em horários de Brasília (UTC-3)
const em = iso => new Date(iso);

test("venceu ONTEM: já conta 1 dia (R$3) desde o começo do dia — o caso do Tin Case", () => {
  assert.equal(diasAtraso("2026-10-27", em("2026-10-28T03:00:00Z")), 1);   // 00:00 em Brasília
  assert.equal(diasAtraso("2026-10-27", em("2026-10-28T18:25:00Z")), 1);   // 15h25 em Brasília
  assert.equal(multaAtraso("2026-10-27", em("2026-10-28T18:25:00Z")), 3);
});

test("vence HOJE e vence amanhã: sem atraso e sem multa", () => {
  assert.equal(diasAtraso("2026-10-28", em("2026-10-28T18:00:00Z")), 0);
  assert.equal(multaAtraso("2026-10-28", em("2026-10-28T18:00:00Z")), 0);
  assert.equal(multaAtraso("2026-10-29", em("2026-10-28T18:00:00Z")), 0);
});

test("dias crescem 1 por dia e a multa é R$3/dia para prazos de outubro em diante", () => {
  assert.equal(diasAtraso("2026-10-20", em("2026-10-28T18:00:00Z")), 8);
  assert.equal(multaAtraso("2026-10-20", em("2026-10-28T18:00:00Z")), 24);
  assert.equal(multaPorDia("2026-10-01"), 3);
  assert.equal(multaPorDia("2026-11-15"), 3);
});

test("prazos anteriores a 01/10 continuam em R$1/dia", () => {
  assert.equal(multaPorDia("2026-09-30"), 1);
  assert.equal(multaAtraso("2026-09-28", em("2026-10-28T18:00:00Z")), 30);
});

test("o dia é o de Brasília: 22h em Brasília ainda é o mesmo dia, 00h01 já é o seguinte", () => {
  assert.equal(diasAtraso("2026-10-27", em("2026-10-28T01:30:00Z")), 0);   // 27/10 22h30 em Brasília
  assert.equal(diasAtraso("2026-10-27", em("2026-10-28T03:01:00Z")), 1);   // 28/10 00h01 em Brasília
});

test("sem vencimento: sem atraso, sem multa; diasParaVencer devolve null", () => {
  assert.equal(diasAtraso(null), 0);
  assert.equal(multaAtraso(undefined), 0);
  assert.equal(diasParaVencer(null), null);
});

test("diasParaVencer: hoje=0, amanhã=1, ontem=-1 (e bate com diasAtraso)", () => {
  const agora = em("2026-10-28T18:00:00Z");
  assert.equal(diasParaVencer("2026-10-28", agora), 0);
  assert.equal(diasParaVencer("2026-10-29", agora), 1);
  assert.equal(diasParaVencer("2026-10-27", agora), -1);
  assert.equal(diasAtraso("2026-10-27", agora), -diasParaVencer("2026-10-27", agora));
});

test("virada de horário de verão / mês / ano não quebra a contagem", () => {
  assert.equal(diasAtraso("2026-12-31", em("2027-01-02T15:00:00Z")), 2);
  assert.equal(diasAtraso("2026-02-27", em("2026-03-01T15:00:00Z")), 2);
});

test("joiner isento (ifelixcollector) nunca tem multa", async () => {
  const { multaDoItem, isentoMulta } = await import("../src/multa.js");
  const agora = new Date("2026-10-29T15:00:00Z");
  assert.equal(isentoMulta("ifelixcollector"), true);
  assert.equal(isentoMulta("IFelixCollector"), true);
  assert.equal(isentoMulta("outra"), false);
  assert.equal(multaDoItem({ cog: "ifelixcollector" }, "2026-10-15", agora), 0);
  assert.equal(multaDoItem({ cog: "outra" }, "2026-10-15", agora), 14 * 3);
});
