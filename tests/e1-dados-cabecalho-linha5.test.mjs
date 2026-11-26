// A aba Dados real pode ter o cabeçalho FORA da linha 1 (ex.: linha 5, com cadastros nas linhas 2 a 4 e outros abaixo). O código da etapa 1 (atualizarCadastro_) não usa a posição do cabeçalho:
// lê da linha 2 até a última e acha a pessoa pelo ID_SITE (coluna D) ou pelo @ (coluna A). Este teste prova isso com esse formato, e mostra o que NÃO é achado (a linha 1).
// Uso: node tests/e1-dados-cabecalho-linha5.test.mjs
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { novaPlanilha } from "./lib/planilha-simulada.mjs";

let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const codigo = readFileSync(new URL("../appsscript/ATUALIZAR_CADASTRO.gs", import.meta.url), "utf8");
const sb = { SpreadsheetApp: { flush() {} }, console }; vm.createContext(sb); vm.runInContext(codigo, sb);
const montar = () => {
  const p = novaPlanilha("ID-X", ["Dados"]); const D = p.abas.Dados;
  const linhas = [
    ["@linha1_titulo", "Fica na linha 1", "t1@exemplo.com"],            // linha 1: o código NUNCA lê
    ["@ana_acima", "Ana Acima", "ana@exemplo.com"],                       // linhas 2 a 4: cadastros ACIMA do cabeçalho
    ["@bia_acima", "Bia Acima", "bia@exemplo.com"],
    ["@cris_acima", "Cris Acima", "cris@exemplo.com"],
    ["@", "NOME", "EMAIL", "ID_SITE", "PAPEL", "VERSAO"],                  // linha 5: o cabeçalho
    ["@dani_abaixo", "Dani Abaixo", "dani@exemplo.com"],                  // linhas 6+: cadastros ABAIXO do cabeçalho
    ["@eva_abaixo", "Eva Abaixo", "eva@exemplo.com"],
  ];
  linhas.forEach((l, i) => l.forEach((v, j) => D.pôr(i + 1, j + 1, v))); D.escritas.length = 0;
  return { p, D };
};
const pedido = (tw, id, nome, versao = 1) => ({ id_site: String(id), twitter: tw, versao, campos: ["nome"], nome });
const chamar = (p, corpo) => vm.runInContext("atualizarCadastro_", sb)(p.ss, corpo);

let { p, D } = montar();
let r = chamar(p, pedido("@bia_acima", 101, "Bia Nova"));
ok(r.ok === true && r.linha === 3 && D.getRange(3, 2).getValue() === "Bia Nova" && D.getRange(3, 4).getValue() === 101 && D.getRange(3, 5).getValue() === "principal", "cadastro ACIMA do cabeçalho (linha 3): achado pelo @, nome gravado em B3 e D/E preenchidos");
ok(D.getRange(5, 2).getValue() === "NOME" && D.getRange(5, 4).getValue() === "ID_SITE" && D.getRange(5, 6).getValue() === "VERSAO", "a linha do cabeçalho (5) não é alterada");
r = chamar(p, pedido("@dani_abaixo", 102, "Dani Nova"));
ok(r.ok === true && r.linha === 6 && D.getRange(6, 2).getValue() === "Dani Nova", "cadastro ABAIXO do cabeçalho (linha 6) também é achado");
r = chamar(p, pedido("@ana_acima", 103, "Ana Nova", 2)); ok(r.ok === true && r.linha === 2 && D.getRange(2, 2).getValue() === "Ana Nova", "cadastro da linha 2 (a primeira lida) é achado");
r = chamar(p, pedido("@bia_acima", 101, "Bia Mais Nova", 5));
ok(r.ok === true && r.linha === 3 && D.getRange(3, 2).getValue() === "Bia Mais Nova", "depois de preenchida a ligação (D = ID_SITE), a mesma pessoa é achada pelo número, não pelo @");
r = chamar(p, pedido("@linha1_titulo", 104, "Nao Deve"));
ok(r.definitivo === true && r.motivo === "linha_nao_encontrada" && D.getRange(1, 2).getValue() === "Fica na linha 1", "um cadastro na LINHA 1 NÃO é achado (o código lê a partir da linha 2): falha definitiva, nada gravado");
r = chamar(p, pedido("@", 105, "Nao Deve"));
ok(r.definitivo === true && r.motivo === "linha_nao_encontrada" && D.getRange(5, 2).getValue() === "NOME", "o '@' do cabeçalho não vira cadastro (um @ vazio nunca casa)");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
