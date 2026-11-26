// ESQUELETO de teste: reproduz a estrutura do doPost publicado em 07/11 (trava, "gravar", acoesPermitidas, conferência do token, aba Dados, MASTERLIST, resposta) SEM as regras de pedidos.
// Serve só para provar onde as duas edições de appsscript/ATUALIZAR_CADASTRO.md entram. Para testar contra o script de verdade: APPS_SCRIPT_ATUAL=<caminho do .gs> node --test tests/appsscript-atualizar-cadastro.test.mjs
function doPost(e) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (erroTrava) { return resposta({ erro: "A planilha está ocupada com outra operação. Nada foi alterado; tente novamente em instantes.", ocupado: true }); }
  const estado = { gravou: false, masterlist: false };
  const gravar = function (celula, valor) { celula.setValue(valor); estado.gravou = true; if (celula.getSheet().getName() === "MASTERLIST") estado.masterlist = true; };
  try {
    const payload = JSON.parse(e.postData.contents);

    const acoesPermitidas = [
      "confirmar",
      "cancelar",
      "repassar",
      "novo_joiner",
      "atualizar_joiner",
      "recebido",
      "aprovar_disponivel"
    ];

    if (!acoesPermitidas.includes(payload.acao)) { return resposta({ erro: "Ação inválida" }); }
    const tokenEsperado = PropertiesService.getScriptProperties().getProperty("ANTICEG_TOKEN");
    if (!tokenEsperado) { return resposta({ erro: "ANTICEG_TOKEN não configurado" }); }
    if (payload.token !== tokenEsperado) { return resposta({ erro: "Token inválido" }); }
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    if (payload.acao === "atualizar_joiner") {
      const dados = spreadsheet.getSheetByName("Dados");
      const linhas = dados.getRange(2, 1, dados.getLastRow() - 1, 3).getValues();
      const norm = function (v) { return String(v || "").replace(/^@/, "").trim().toLowerCase(); };
      const idx = linhas.findIndex(function (r) { return norm(r[0]) === norm(payload.twitter_antigo); });
      if (idx === -1) { return resposta({ erro: "Joiner não encontrado" }); }
      if (payload.email_novo) { gravar(dados.getRange(idx + 2, 3), String(payload.email_novo).toLowerCase()); }
      return resposta({ ok: true, acao: "atualizar_joiner", updated: 1 });
    }

    // ────────────────────────────────────────
    // MASTERLIST
    // ────────────────────────────────────────
    const sheet = spreadsheet.getSheetByName("MASTERLIST");

    if (!sheet) { return resposta({ erro: "Aba MASTERLIST não encontrada" }); }
    return resposta({ updated: 0 });
  } finally {
    lock.releaseLock();
  }
}
function resposta(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
