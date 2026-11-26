// Testa a função de leitura conferirMeuArroba (appsscript/CONFERIR_MEU_ARROBA.gs) numa MASTERLIST simulada: contagens por fórmula/texto fixo, variações do @, e prova que NÃO escreve nada.
// Uso: node tests/e1-conferir-meu-arroba.test.mjs
import vm from "node:vm";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { novaPlanilha } from "./lib/planilha-simulada.mjs";

let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const p = novaPlanilha("ID-X", ["Dados", "MASTERLIST"]); const D = p.abas.Dados, M = p.abas.MASTERLIST;
D.pôr(1, 1, "@"); D.pôr(2, 1, "@nandaverseo_c"); D.pôr(2, 2, "Nanda");
M.pôr(3, 6, "@");
const add = (n, tw, nome, formula) => { M.pôr(n, 6, tw); if (formula) M.pôr(n, 5, `=VLOOKUP(F${n},Dados!A:B,2,0)`); else M.pôr(n, 5, nome); };
add(4, "@nandaverseo_c", "", true); add(5, "@NandaVerseo_C", "", true); add(6, " @nandaverseo_c ", "Nome Fixo", false); add(7, "nandaverseo_c", "", true);
add(8, "@outra_pessoa", "Outra", false); add(9, "@nandaverseo_c2", "Parecida", false); add(10, "@nandaverseo_c", "", false);
M.escritas.length = 0; D.escritas.length = 0;
const logs = [];
const sb = { SpreadsheetApp: { getActiveSpreadsheet: () => p.ss }, Utilities: { DigestAlgorithm: { SHA_256: "s" }, Charset: { UTF_8: "u" }, computeDigest: (_a, t) => [...createHash("sha256").update(t, "utf8").digest()].map(b => (b > 127 ? b - 256 : b)) }, console: { log: l => logs.push(l) } };
vm.createContext(sb); vm.runInContext(readFileSync(new URL("../appsscript/CONFERIR_MEU_ARROBA.gs", import.meta.url), "utf8"), sb);
vm.runInContext("conferirMeuArroba()", sb);
const t = logs.join("\n");
ok(/linhas com o @ na coluna F = 5 /.test(t), "conta as 5 linhas do @ (com maiúsculas, espaços e sem o @ contam; '@nandaverseo_c2' e '@outra_pessoa' NÃO)");
ok(/NOME por FÓRMULA = 3 /.test(t) && /TEXTO FIXO = 1 /.test(t) && /NOME vazio = 1/.test(t), "separa: 3 por fórmula, 1 texto fixo e 1 com NOME vazio");
ok(/\[fórmula\] Nanda":2/.test(t) && /\[fórmula\] #N\/A":1/.test(t) && /\[texto fixo\] Nome Fixo":1/.test(t), "mostra o que a coluna E exibe (2 fórmulas mostram 'Nanda', 1 mostra #N/A porque o @ da linha não casa, 1 texto fixo)");
ok(/assinatura das posições \(linha \+ F\/T\) = [0-9a-f]{12}/.test(t), "gera a assinatura das posições, para comparar antes/depois");
ok(M.escritas.length === 0 && D.escritas.length === 0, "não escreveu NADA em nenhuma aba");
logs.length = 0; M.pôr(4, 5, "texto digitado por cima"); const a1 = (vm.runInContext("conferirMeuArroba()", sb), logs.join("\n").match(/assinatura[^=]*= (\w+)/)[1]);
logs.length = 0; vm.runInContext("conferirMeuArroba()", sb); ok(logs.join("\n").match(/assinatura[^=]*= (\w+)/)[1] === a1, "a assinatura é estável entre execuções iguais");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
