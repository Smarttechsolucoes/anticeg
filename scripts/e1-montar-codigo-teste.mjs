// Monta o ARQUIVO ÚNICO para colar no Apps Script da planilha de TESTE (Código.gs):
//   código atual do Apps Script (a cópia que você passar) + as edições do doPost + ATUALIZAR_CADASTRO.gs + TESTE_E1.gs.
// Não lê rede nem segredo. A saída vai para o caminho que você indicar (use uma pasta FORA do repositório).
// Uso: node scripts/e1-montar-codigo-teste.mjs <apps-script-atual.gs> <saida-Codigo.gs>
import { readFileSync, writeFileSync } from "node:fs";

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) { console.error("Uso: node scripts/e1-montar-codigo-teste.mjs <apps-script-atual.gs> <saida.gs>"); process.exit(2); }
const ler = u => readFileSync(u, "utf8").replace(/\r\n/g, "\n");
let base = ler(entrada);

const A = '"atualizar_joiner",\n      "recebido",';
const B = '    const sheet = spreadsheet.getSheetByName("MASTERLIST");';
if (!base.includes(A) || base.split(B).length !== 2) { console.error("O código informado não tem os pontos esperados do doPost (lista de ações e leitura da MASTERLIST). Nada foi gerado."); process.exit(1); }
if (base.includes("atualizar_cadastro")) { console.error("O código informado já tem atualizar_cadastro. Use a cópia SEM as edições."); process.exit(1); }

base = base.replace(A, '"atualizar_joiner",\n      "atualizar_cadastro",\n      "e1_identificar",\n      "e1_ler",\n      "e1_gatilho_fila",\n      "recebido",');
base = base.replace(B, `    if (payload.acao === "atualizar_cadastro") {
      return resposta(atualizarCadastro_(spreadsheet, payload, gravar));
    }
    if (payload.acao === "e1_identificar" || payload.acao === "e1_ler" || payload.acao === "e1_gatilho_fila") {
      return resposta(e1TesteAcao_(spreadsheet, payload));
    }

${B}`);

const cadastro = ler(new URL("../appsscript/ATUALIZAR_CADASTRO.gs", import.meta.url));
const teste = ler(new URL("../appsscript/TESTE_E1.gs", import.meta.url));
writeFileSync(saida, `${base}\n\n// ===== ETAPA 1: ATUALIZAR_CADASTRO.gs =====\n${cadastro}\n\n// ===== SÓ TESTE: TESTE_E1.gs =====\n${teste}\n`);
console.log("Gerado:", saida, "(" + (base.split("\n").length + cadastro.split("\n").length + teste.split("\n").length) + " linhas). Cole inteiro no Apps Script da planilha de TESTE.");
