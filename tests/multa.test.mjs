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

// ═════════ PAUSA DO ACRÉSCIMO DIÁRIO NA MIGRAÇÃO (08/11 a 14/11/2026, inclusive, horário de Brasília; a cobrança volta em 15/11) ═════════
import { diasCobradosMulta, diasPausados, MULTA_PAUSA, multaDoItem } from "../src/multa.js";
const BRT = (dia, hhmm = "12:00") => new Date(`${dia}T${hhmm}:00-03:00`);

test("pausa: constantes da decisão (08/11 a 14/11/2026)", () => {
  assert.deepEqual(MULTA_PAUSA, { de: "2026-11-08", ate: "2026-11-14" });
});

test("pausa: o dia 07/11 ainda conta; 08/11 00:00 em Brasília já não soma (fronteira em Brasília, não em UTC)", () => {
  assert.equal(multaAtraso("2026-11-06", em("2026-11-08T02:59:59Z")), 3);      // 07/11 23:59:59 em Brasília: 1 dia de atraso (07/11)
  assert.equal(multaAtraso("2026-11-06", em("2026-11-08T03:00:00Z")), 3);      // 08/11 00:00 em Brasília: o dia 08/11 não soma
  assert.equal(multaAtraso("2026-11-07", em("2026-11-08T03:00:00Z")), 0);      // venceu em 07/11: o 1º dia de atraso seria 08/11, pausado
});

test("pausa: multas acumuladas antes de 08/11 são PRESERVADAS e ficam congeladas até 14/11", () => {
  const venc = "2026-11-04";                                                    // 05, 06 e 07/11 contam: 3 dias × R$3
  assert.equal(multaAtraso(venc, BRT("2026-11-07", "23:59")), 9);
  for (const dia of ["2026-11-08", "2026-11-09", "2026-11-11", "2026-11-13", "2026-11-14"]) assert.equal(multaAtraso(venc, BRT(dia)), 9, `congelada em ${dia}`);
  assert.equal(multaAtraso(venc, BRT("2026-11-14", "23:59")), 9);
});

test("pausa: a cobrança diária volta em 15/11 (00:00 de Brasília) e o 1º dia cobrado é o próprio 15/11", () => {
  assert.equal(multaAtraso("2026-11-04", em("2026-11-15T02:59:59Z")), 9);      // 14/11 23:59:59 em Brasília
  assert.equal(multaAtraso("2026-11-04", em("2026-11-15T03:00:00Z")), 12);     // 15/11 00:00: +1 dia
  assert.equal(multaAtraso("2026-11-04", BRT("2026-11-16")), 15);
  assert.equal(multaAtraso("2026-11-07", BRT("2026-11-15")), 3);               // venceu 07/11: só o 15/11 conta
  assert.equal(multaAtraso("2026-11-14", BRT("2026-11-15")), 3);               // venceu 14/11: atraso começa em 15/11
});

test("pausa: vencimento DENTRO da pausa (ex.: 11/11) só começa a gerar multa em 15/11", () => {
  assert.equal(multaAtraso("2026-11-11", BRT("2026-11-14")), 0);
  assert.equal(multaAtraso("2026-11-11", BRT("2026-11-15")), 3);
  assert.equal(multaAtraso("2026-11-11", BRT("2026-11-17")), 9);
});

test("pausa: os dias dispensados NUNCA são cobrados depois (retroativo)", () => {
  // vencido em 04/11; em 30/11 os dias cobrados são 05, 06 e 07/11 (3) + 15..30/11 (16) = 19
  assert.equal(diasCobradosMulta("2026-11-04", BRT("2026-11-30")), 19);
  assert.equal(multaAtraso("2026-11-04", BRT("2026-11-30")), 57);
  assert.equal(diasPausados("2026-11-04", BRT("2026-11-30")), 7);
  assert.equal(diasAtraso("2026-11-04", BRT("2026-12-10")) - diasCobradosMulta("2026-11-04", BRT("2026-12-10")), 7);
});

test("pausa: o atraso REAL (diasAtraso), diasParaVencer e a taxa por dia NÃO mudam", () => {
  assert.equal(diasAtraso("2026-11-04", BRT("2026-11-11")), 7);               // continua "atrasado há 7 dias" (status)
  assert.equal(diasAtraso("2026-11-07", BRT("2026-11-08")), 1);               // continua atrasado, só sem acréscimo
  assert.equal(diasParaVencer("2026-11-11", BRT("2026-11-09")), 2);
  assert.equal(diasParaVencer("2026-11-04", BRT("2026-11-09")), -5);
  assert.equal(multaPorDia("2026-11-04"), 3);
  assert.equal(multaPorDia("2026-09-30"), 1);
});

test("pausa: prazos antigos (R$1/dia) também ficam congelados e voltam a R$1/dia", () => {
  const venc = "2026-09-28";                                                   // 29/09 a 07/11 = 40 dias
  assert.equal(multaAtraso(venc, BRT("2026-11-07", "23:59")), 40);
  assert.equal(multaAtraso(venc, BRT("2026-11-14", "23:59")), 40);
  assert.equal(multaAtraso(venc, BRT("2026-11-15")), 41);
});

test("pausa: vencimento DEPOIS da pausa não é afetado", () => {
  assert.equal(multaAtraso("2026-11-20", BRT("2026-11-23")), 9);
  assert.equal(diasPausados("2026-11-20", BRT("2026-11-23")), 0);
});

test("pausa: isento continua isento e item sem vencimento continua sem multa", () => {
  assert.equal(multaDoItem({ cog: "ifelixcollector" }, "2026-11-04", BRT("2026-11-30")), 0);
  assert.equal(multaDoItem({ cog: "outra" }, "2026-11-04", BRT("2026-11-30")), 57);
  assert.equal(multaAtraso(null, BRT("2026-11-30")), 0);
  assert.equal(diasCobradosMulta(undefined, BRT("2026-11-30")), 0);
});

test("pausa: varredura dia a dia (vencimentos de 01/10 a 10/12) — nunca diminui, 0 dentro da pausa, no máximo 1 dia por vez, e só difere da regra antiga pelos dias pausados", () => {
  const dia = (base, n) => { const d = new Date(Date.parse(base + "T12:00:00Z") + n * 86400000); return d.toISOString().slice(0, 10); };
  let checados = 0;
  for (let v = 0; v <= 70; v++) {
    const venc = dia("2026-10-01", v);
    let anterior = null;
    for (let t = 0; t <= 80; t++) {
      const hoje = dia("2026-10-25", t), agora = BRT(hoje);
      const cob = diasCobradosMulta(venc, agora), real = diasAtraso(venc, agora), paus = diasPausados(venc, agora);
      assert.equal(cob, real - paus, `${venc} em ${hoje}`);
      assert.ok(paus >= 0 && paus <= 7, `pausados ${venc} em ${hoje}`);
      if (anterior !== null) {
        assert.ok(cob >= anterior, `não diminui: ${venc} em ${hoje}`);
        assert.ok(cob - anterior <= 1, `no máximo +1 por dia: ${venc} em ${hoje}`);
        if (hoje >= MULTA_PAUSA.de && hoje <= MULTA_PAUSA.ate) assert.equal(cob, anterior, `parado dentro da pausa: ${venc} em ${hoje}`);
      }
      if (hoje < MULTA_PAUSA.de) assert.equal(cob, real, `antes da pausa é a regra de sempre: ${venc} em ${hoje}`);
      anterior = cob; checados++;
    }
  }
  assert.ok(checados > 5000);
});
