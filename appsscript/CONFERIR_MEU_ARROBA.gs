// SOMENTE LEITURA. Conferência do primeiro teste de escrita (etapa F): conta, na MASTERLIST, as linhas cujo @ (coluna F) é o do cadastro de teste e quantas têm FÓRMULA ou TEXTO FIXO no NOME (coluna E).
// Não escreve em nenhuma célula (só lê e registra no "Registro de execução"). Rode ANTES do teste, DEPOIS do passo 2 (as linhas com fórmula passam a mostrar o nome de teste) e DEPOIS da restauração: o resultado do fim tem que ser igual ao do começo.
// Posições da MASTERLIST real (conferidas): cabeçalho na linha 3; E = NOME; F = @.
function conferirMeuArroba() {
  const ALVO = "nandaverseo_c";   // o @ do cadastro de teste, sem o "@", em minúsculas
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("MASTERLIST");
  if (!aba) { console.log("conferirMeuArroba: aba MASTERLIST não encontrada"); return; }
  const primeira = 4, n = aba.getLastRow() - primeira + 1;
  if (n < 1) { console.log("conferirMeuArroba: MASTERLIST sem linhas de dados"); return; }
  const F = aba.getRange(primeira, 6, n, 1).getValues();
  const colE = aba.getRange(primeira, 5, n, 1), Ef = colE.getFormulas(), Ev = colE.getDisplayValues();
  let total = 0, comFormula = 0, textoFixo = 0, nomeVazio = 0;
  const valores = {}, marcas = [];
  for (let i = 0; i < n; i++) {
    const tw = String(F[i][0] == null ? "" : F[i][0]).replace(/^\s*@+/, "").trim().toLowerCase();
    if (tw !== ALVO) continue;
    total++;
    const temFormula = Ef[i][0] !== "";
    const v = String(Ev[i][0] == null ? "" : Ev[i][0]);
    if (temFormula) comFormula++; else if (v.trim() === "") nomeVazio++; else textoFixo++;
    valores[(temFormula ? "[fórmula] " : "[texto fixo] ") + v] = (valores[(temFormula ? "[fórmula] " : "[texto fixo] ") + v] || 0) + 1;
    marcas.push((primeira + i) + (temFormula ? "F" : "T"));
  }
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, marcas.join(","), Utilities.Charset.UTF_8);
  const digesto = bytes.map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join("").slice(0, 12);
  console.log("conferirMeuArroba: linhas com o @ na coluna F = " + total + " | NOME por FÓRMULA = " + comFormula + " | TEXTO FIXO = " + textoFixo + " | NOME vazio = " + nomeVazio);
  console.log("conferirMeuArroba: o que a coluna E mostra (valor: quantidade) = " + JSON.stringify(valores));
  console.log("conferirMeuArroba: assinatura das posições (linha + F/T) = " + digesto);
}
