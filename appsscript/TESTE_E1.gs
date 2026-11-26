// ==========================================================================================================
// SÓ PARA A PLANILHA DE TESTE DA ETAPA 1. NUNCA cole este arquivo no Apps Script da planilha real.
// (Mesmo que colasse: as ações abaixo só respondem se a propriedade E1_PLANILHA_TESTE = "1" e E1_PLANILHA_ID = id desta planilha,
//  e essas propriedades só são criadas por prepararPlanilhaTeste(), que RECUSA rodar em planilha que já tenha dados.)
//
// O que faz:
//   prepararPlanilhaTeste()  - roda UMA vez, no editor, na planilha NOVA e vazia: cria as abas Dados e MASTERLIST com cabeçalhos, fórmulas e dados FICTÍCIOS.
//   gerarTokenTeste()        - cria o token da implantação de teste (fica só em Propriedades do script; nunca é escrito no log).
//   reiniciarDadosTeste()    - volta os dados fictícios ao estado inicial (só funciona na planilha de teste).
//   e1_identificar / e1_ler / e1_gatilho_fila - ações do doPost (token obrigatório) para o script de teste CONFIRMAR em qual planilha está e ler o resultado,
//                              sem precisar compartilhar a planilha publicamente.
// ==========================================================================================================

function e1Norm_(v) { return String(v == null ? "" : v).replace(/^\s*@+/, "").trim().toLowerCase(); }

function e1Hash_(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8)
    .map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join("");
}

function e1EhPlanilhaTeste_(ss) {
  const p = PropertiesService.getScriptProperties();
  return p.getProperty("E1_PLANILHA_TESTE") === "1" && p.getProperty("E1_PLANILHA_ID") === ss.getId();
}

function e1Formula_(celula, montar) {
  celula.setFormula(montar(","));
  SpreadsheetApp.flush();
  if (/^#ERRO/i.test(String(celula.getDisplayValue()))) { celula.setFormula(montar(";")); SpreadsheetApp.flush(); }
}

function e1EscreverDados_(ss) {
  let dados = ss.getSheetByName("Dados"), master = ss.getSheetByName("MASTERLIST");
  if (!dados) dados = ss.insertSheet("Dados");
  if (!master) master = ss.insertSheet("MASTERLIST");
  ss.getSheets().forEach(function (s) { if (s.getName() !== "Dados" && s.getName() !== "MASTERLIST") ss.deleteSheet(s); });
  dados.clear(); master.clear();

  dados.getRange(1, 1, 4, 6).setValues([
    ["@", "NOME", "EMAIL", "ID_SITE", "PAPEL", "VERSAO"],
    ["@teste_e1", "Teste E1 Antigo", "", "", "", ""],
    ["@fulana_ficticia", "Fulana Fictícia", "fulana@exemplo.com", "", "", ""],
    ["@ciclana_ficticia", "Ciclana Fictícia", "ciclana@exemplo.com", "", "", ""],
  ]);

  // MASTERLIST: cabeçalho na LINHA 3 (como na real). Posições conferidas com a real: B=ID, E=NOME, F=@, S=EMAIL. As demais colunas só ilustram (o teste não usa).
  const cab = ["ABA / CEG", "ID", "NOME DO ITEM", "PREÇO ITEM", "NOME", "@", "PREÇO FRETE", "PREÇO RF", "INFORMAÇÕES", "ITEM", "FRETE", "RF", "ITEM DATA", "FRETE DATA", "RF DATA", "Chegou?", "NACIONAL", "", "EMAIL"];
  const linha = function (n, id, item, nomeFixo, tw) {
    const r = new Array(19).fill("");
    r[0] = "TESTE E1"; r[1] = id; r[2] = item; r[4] = nomeFixo ? nomeFixo : ""; r[5] = tw;   // as fórmulas entram abaixo, com setFormula (sintaxe em inglês, vale em qualquer idioma da planilha)
    return r;
  };
  master.getRange(1, 1).setValue("TESTE E1 - planilha FICTÍCIA (não é a real)");
  master.getRange(3, 1, 1, 19).setValues([cab]);
  master.getRange(4, 1, 4, 19).setValues([
    linha(4, "TESTE-E1-0001", "Item fictício A", "", "@teste_e1"),
    linha(5, "TESTE-E1-0002", "Item fictício B", "", "@teste_e1"),
    linha(6, "TESTE-E1-0003", "Item fictício C (NOME EM TEXTO FIXO)", "Nome Fixo Digitado", "@teste_e1"),
    linha(7, "TESTE-E1-0004", "Item fictício D (outra pessoa)", "", "@fulana_ficticia"),
  ]);
  // As fórmulas são gravadas com setFormula e o separador é DESCOBERTO: planilhas em português (e outros idiomas com vírgula decimal) só entendem ";", as demais entendem ",".
  // Tenta com vírgula; se o Google devolver erro de análise (#ERROR!), regrava com ponto e vírgula.
  [[4, true], [5, true], [6, false], [7, true]].forEach(function (x) {
    if (x[1]) e1Formula_(master.getRange(x[0], 5), function (sep) { return "=VLOOKUP(F" + x[0] + sep + "Dados!A:B" + sep + "2" + sep + "0)"; });
    e1Formula_(master.getRange(x[0], 19), function (sep) { return "=VLOOKUP(F" + x[0] + sep + "Dados!A:C" + sep + "3" + sep + "0)"; });
  });
  SpreadsheetApp.flush();
}

/** Roda UMA vez, no editor, numa planilha NOVA e VAZIA. Recusa se achar qualquer dado (nunca apaga uma planilha de verdade). */
function prepararPlanilhaTeste() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!e1EhPlanilhaTeste_(ss)) {
    ss.getSheets().forEach(function (s) {
      if (s.getLastRow() > 1 || s.getLastColumn() > 1 || String(s.getRange(1, 1).getValue()) !== "") {
        throw new Error("RECUSADO: esta planilha já tem conteúdo (aba '" + s.getName() + "'). A preparação só roda numa planilha NOVA e vazia.");
      }
    });
    ss.rename("TESTE E1 - fictícia - NÃO USAR");
    const p = PropertiesService.getScriptProperties();
    p.setProperty("E1_PLANILHA_TESTE", "1");
    p.setProperty("E1_PLANILHA_ID", ss.getId());
  }
  e1EscreverDados_(ss);
  gerarTokenTeste();
  console.log("Planilha de teste pronta: abas Dados e MASTERLIST com dados fictícios. Próximo passo: Implantar › Nova implantação › App da Web.");
}

function reiniciarDadosTeste() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!e1EhPlanilhaTeste_(ss)) throw new Error("RECUSADO: esta não é a planilha de teste E1.");
  e1EscreverDados_(ss);
  console.log("Dados fictícios reiniciados.");
}

/** Cria o token de teste (só se ainda não existir). O valor NÃO vai para o log: copie em Configurações do projeto › Propriedades do script. */
function gerarTokenTeste() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty("ANTICEG_TOKEN")) p.setProperty("ANTICEG_TOKEN", Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, ""));
  console.log("Token de teste existe em Propriedades do script (ANTICEG_TOKEN). Ele não é exibido aqui.");
}

/** Ações de teste do doPost (o token já foi conferido pelo doPost antes de chegar aqui). */
function e1TesteAcao_(ss, p) {
  if (!e1EhPlanilhaTeste_(ss)) return { erro: "Ação de teste indisponível: esta não é a planilha de teste E1.", definitivo: true };
  const abas = ss.getSheets().map(function (s) { return s.getName(); });
  if (p.acao === "e1_identificar") {
    return { ok: true, teste: true, nome: ss.getName(), abas: abas, id_final: ss.getId().slice(-4) };
  }
  if (p.acao === "e1_gatilho_fila") {
    // confere (e, se pedido, REMOVE) o acionador de horário da fila nesta planilha de teste; só mexe nos acionadores de rodarFilaPerfil_
    const antes = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === "rodarFilaPerfil_"; }).length;
    if (p.remover === true) removerGatilhoFilaPerfil();
    const depois = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === "rodarFilaPerfil_"; }).length;
    return { ok: true, gatilhos_antes: antes, gatilhos_depois: depois, removeu: p.remover === true };
  }
  const arroba = e1Norm_(p.twitter);
  const dados = ss.getSheetByName("Dados"), master = ss.getSheetByName("MASTERLIST");
  if (!dados || !master) return { erro: "Faltam as abas Dados/MASTERLIST.", definitivo: true };
  const ld = dados.getLastRow(), dv = ld >= 2 ? dados.getRange(2, 1, ld - 1, 6).getValues() : [];
  const dadosLinhas = [];
  dv.forEach(function (r, i) { if (e1Norm_(r[0]) === arroba) dadosLinhas.push({ linha: i + 2, nome: r[1], email: r[2], id_site: r[3], papel: r[4], versao: r[5] }); });
  const lm = master.getLastRow(), lc = Math.max(master.getLastColumn(), 19);
  const valores = master.getRange(1, 1, lm, lc).getValues(), exibidos = master.getRange(1, 1, lm, lc).getDisplayValues(), formulas = master.getRange(1, 1, lm, lc).getFormulas();
  const linhasMaster = [];
  for (let i = 3; i < lm; i++) {
    if (e1Norm_(valores[i][5]) === arroba) linhasMaster.push({ linha: i + 1, nome: exibidos[i][4], email: exibidos[i][18], formula_nome: formulas[i][4], formula_email: formulas[i][18] });
  }
  const constantes = [], fs = [];
  for (let i = 0; i < lm; i++) for (let j = 0; j < lc; j++) { if (formulas[i][j] === "") constantes.push(i + ":" + j + "=" + valores[i][j]); else fs.push(i + ":" + j + "=" + formulas[i][j]); }
  return { ok: true, dados: dadosLinhas, master: linhasMaster, digesto_constantes: e1Hash_(constantes.join("\n")), digesto_formulas: e1Hash_(fs.join("\n")), linhas_master: lm - 3 };
}
