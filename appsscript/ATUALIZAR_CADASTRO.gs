// ETAPA 1 DO CADASTRO — peça para COLAR no projeto do Apps Script (nova versão de implantação). NÃO substitui o script: acrescenta uma função e duas linhas no doPost (ver ATUALIZAR_CADASTRO.md).
// Também traz o AGENDADOR (gatilho por tempo do próprio Apps Script) que chama a função perfil-sync a cada minuto, sem depender de botão. Só roda se você executar instalarGatilhoFilaPerfil() uma vez.

// ── ATUALIZAR CADASTRO (etapa 1) ─────────────────────────────────────────────────────────────────────────────────────────────────
// Aba Dados: A = @, B = nome cadastral, C = e-mail, D = ID_SITE (joiners.id), E = PAPEL (principal | alias), F = VERSAO (número da última tarefa aplicada).
// Regras: (1) só grava B e/ou C (conforme "campos") e, na primeira vez, D/E da linha ÚNICA que casa pelo @; (2) nunca toca em fórmulas nem na MASTERLIST; (3) versão igual ou mais antiga que a da linha é IGNORADA
// (a alteração nova já está lá); (4) duplicata real, linha ausente/ambígua ou célula com fórmula = resposta DEFINITIVA {definitivo: true, motivo} e NADA é gravado; (5) as linhas "alias" do mesmo ID recebem a mesma cópia.
function atualizarCadastro_(spreadsheet, p, gravarOpcional) {
  const gravar = typeof gravarOpcional === "function" ? gravarOpcional : function (celula, valor) { celula.setValue(valor); };   // no doPost real vem o "gravar" que registra o que já foi escrito
  const falha = function (motivo, texto) { return { erro: texto, definitivo: true, motivo: motivo }; };
  const idSite = String(p.id_site == null ? "" : p.id_site).trim();
  const versao = Number(p.versao);
  const campos = Array.isArray(p.campos) ? p.campos.filter(function (c) { return c === "nome" || c === "email"; }) : [];
  if (!/^[0-9]{1,15}$/.test(idSite) || !(versao > 0) || Math.floor(versao) !== versao || campos.length === 0) return falha("dados_invalidos", "id_site, versao ou campos inválidos");
  const nome = p.nome == null ? "" : String(p.nome).trim();
  const email = p.email == null ? "" : String(p.email).trim().toLowerCase();
  if (campos.indexOf("nome") >= 0 && (nome.length < 1 || nome.length > 120 || /[\u0000-\u001f<>]/.test(nome))) return falha("dados_invalidos", "nome inválido");
  if (campos.indexOf("email") >= 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return falha("dados_invalidos", "e-mail inválido");
  const dados = spreadsheet.getSheetByName("Dados");
  if (!dados || dados.getLastRow() < 2) return falha("aba_dados_ausente", "Aba Dados vazia ou não encontrada");
  const total = dados.getLastRow() - 1;
  const linhas = dados.getRange(2, 1, total, 6).getValues();
  const norm = function (v) { return String(v == null ? "" : v).replace(/^\s*@+/, "").trim().toLowerCase(); };
  const papel = function (r) { const e = String(r[4] == null ? "" : r[4]).trim().toLowerCase(); return e === "alias" ? "alias" : "principal"; };
  const doId = [], semId = [];
  linhas.forEach(function (r, i) { if (String(r[3] == null ? "" : r[3]).trim() === idSite) doId.push(i); });
  let alvo = -1, preencherId = false;
  if (doId.length > 0) {
    const principais = doId.filter(function (i) { return papel(linhas[i]) === "principal"; });
    if (principais.length > 1) return falha("duplicata_principal", "Mais de uma linha principal para o mesmo ID_SITE");
    if (principais.length === 0) return falha("alias_sem_principal", "Só há linha alias para este ID_SITE");
    alvo = principais[0];
  } else {
    const alvoTw = norm(p.twitter);
    if (!alvoTw) return falha("linha_nao_encontrada", "Sem ID_SITE na planilha e sem @ para localizar a linha");
    const achadas = [];
    linhas.forEach(function (r, i) { if (norm(r[0]) === alvoTw) achadas.push(i); });
    if (achadas.length === 0) return falha("linha_nao_encontrada", "Nenhuma linha em Dados com este @");
    if (achadas.length > 1) return falha("linha_ambigua", "O mesmo @ aparece em mais de uma linha de Dados");
    alvo = achadas[0];
    const idAtual = String(linhas[alvo][3] == null ? "" : linhas[alvo][3]).trim();
    if (idAtual && idAtual !== idSite) return falha("id_site_diferente", "A linha encontrada pertence a outro ID_SITE");
    preencherId = true;
  }
  // @ repetido em outra linha que não é alias deste ID = duplicata real
  const tw = norm(linhas[alvo][0]);
  const repetida = linhas.some(function (r, i) { return i !== alvo && tw !== "" && norm(r[0]) === tw && !(String(r[3] == null ? "" : r[3]).trim() === idSite && papel(r) === "alias"); });
  if (repetida) return falha("duplicata_arroba", "O mesmo @ aparece em outra linha de Dados");
  const aliases = doId.filter(function (i) { return i !== alvo && papel(linhas[i]) === "alias"; });
  const celulas = function (i) { return { b: dados.getRange(i + 2, 2), c: dados.getRange(i + 2, 3), d: dados.getRange(i + 2, 4), e: dados.getRange(i + 2, 5), f: dados.getRange(i + 2, 6) }; };
  const quais = [alvo].concat(aliases);
  for (let k = 0; k < quais.length; k++) {
    const c = celulas(quais[k]);
    if ((campos.indexOf("nome") >= 0 && c.b.getFormula()) || (campos.indexOf("email") >= 0 && c.c.getFormula())) return falha("celula_com_formula", "A célula de destino em Dados tem fórmula; não foi alterada");
  }
  const atual = Number(linhas[alvo][5]) || 0;
  if (versao <= atual) return { ok: true, acao: "atualizar_cadastro", ignorado: "versao_antiga", versao_na_planilha: atual };
  let alteradas = 0;
  quais.forEach(function (i) {
    const c = celulas(i), r = linhas[i];
    if (campos.indexOf("nome") >= 0 && String(r[1] == null ? "" : r[1]) !== nome) { gravar(c.b, nome); alteradas++; }
    if (campos.indexOf("email") >= 0 && String(r[2] == null ? "" : r[2]).trim().toLowerCase() !== email) { gravar(c.c, email); alteradas++; }
  });
  if (preencherId) { const c0 = celulas(alvo); gravar(c0.d, Number(idSite)); if (!String(linhas[alvo][4] == null ? "" : linhas[alvo][4]).trim()) gravar(c0.e, "principal"); }
  gravar(celulas(alvo).f, versao);
  SpreadsheetApp.flush();
  return { ok: true, acao: "atualizar_cadastro", linha: alvo + 2, celulas_alteradas: alteradas, aliases: aliases.length };
}

// ── AGENDADOR DA FILA (opcional; não roda sozinho até você executar instalarGatilhoFilaPerfil() uma vez) ──────────────────────────────────────────
// Propriedades do script (Configurações do projeto > Propriedades do script): PERFIL_SYNC_URL (https://<projeto>.supabase.co/functions/v1/perfil-sync), SUPABASE_ANON_KEY (chave PÚBLICA do site),
// PERFIL_SYNC_SEGREDO (segredo longo, o MESMO guardado nos segredos da função perfil-sync). O segredo só autoriza processar a fila (a resposta traz só contagens); não lê nem grava nenhum dado pessoal.
function rodarFilaPerfil_() {
  const p = PropertiesService.getScriptProperties();
  const url = p.getProperty("PERFIL_SYNC_URL"), anon = p.getProperty("SUPABASE_ANON_KEY"), segredo = p.getProperty("PERFIL_SYNC_SEGREDO");
  if (!url || !anon || !segredo) { console.warn("rodarFilaPerfil_: propriedades do script ausentes; nada foi chamado."); return; }
  try {
    const r = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: "{}", muteHttpExceptions: true, headers: { Authorization: "Bearer " + anon, apikey: anon, "x-cron-secret": segredo } });
    console.log("rodarFilaPerfil_: HTTP " + r.getResponseCode() + " " + String(r.getContentText()).slice(0, 200));   // só contagens; o segredo nunca é registrado
  } catch (erro) { console.warn("rodarFilaPerfil_: falha de rede: " + String(erro).replace(segredo, "[oculto]")); }
}
function instalarGatilhoFilaPerfil() {
  removerGatilhoFilaPerfil();
  ScriptApp.newTrigger("rodarFilaPerfil_").timeBased().everyMinutes(1).create();
}
function removerGatilhoFilaPerfil() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "rodarFilaPerfil_") ScriptApp.deleteTrigger(t); });
}
