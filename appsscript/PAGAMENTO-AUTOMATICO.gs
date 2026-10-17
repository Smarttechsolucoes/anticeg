const AVISO_SYNC_ = "A planilha foi atualizada, mas a sincronização com o site falhou. O site pode demorar a refletir a mudança; a próxima sincronização agendada corrige.";
const HEADER_ROW = 3;
const COL_ID_LINHA = 2;

// ── AUTENTICAÇÃO (v2) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Durante a rotação do token o Web App aceita DOIS valores: ANTICEG_TOKEN (o atual, ainda usado pelo site antigo) e ANTICEG_TOKEN_NOVO (o que só o servidor do site conhece).
// Depois da migração: apagar a propriedade ANTICEG_TOKEN_NOVO e colocar o valor novo em ANTICEG_TOKEN (o token antigo deixa de valer). Nunca registra o valor de nenhum token.
function comparar_(a, b) {
  const x = String(a == null ? "" : a), y = String(b == null ? "" : b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return r === 0;
}
function autenticar_(informado) {
  const props = PropertiesService.getScriptProperties();
  const atual = props.getProperty("ANTICEG_TOKEN"), novo = props.getProperty("ANTICEG_TOKEN_NOVO");
  if (!atual && !novo) return { ok: false, erro: "ANTICEG_TOKEN não configurado" };
  if (novo && comparar_(informado, novo)) return { ok: true, qual: "novo" };
  if (atual && comparar_(informado, atual)) return { ok: true, qual: "atual" };
  return { ok: false, erro: "Token inválido" };
}

function doPost(e) {
  // A autenticação vem ANTES da trava e da ação: quem não tem o token não ocupa a fila da planilha nem descobre quais ações existem.
  let payloadPrevio;
  try { payloadPrevio = JSON.parse(e.postData.contents); } catch (erroJson) { return resposta({ erro: "Requisição inválida" }); }
  const auth = autenticar_(payloadPrevio && payloadPrevio.token);
  if (!auth.ok) return resposta({ erro: auth.erro });
  console.log("doPost: autenticado com o token " + auth.qual);   // só "atual"/"novo": mostra se o site antigo ainda chama direto (para decidir a hora de rotacionar)

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (erroTrava) {
    // sem a trava nada foi lido nem gravado: responde JSON (o site entende) em vez da página de erro do Google
    return resposta({ erro: "A planilha está ocupada com outra operação. Nada foi alterado; tente novamente em instantes.", ocupado: true });
  }

  // Registro do que JÁ foi gravado nesta chamada (qualquer célula ou linha). Se uma falha vier depois, a resposta nunca diz que "nada mudou".
  const estado = { gravou: false, masterlist: false };
  const gravar = function (celula, valor) {
    celula.setValue(valor);
    estado.gravou = true;
    if (celula.getSheet().getName() === "MASTERLIST") estado.masterlist = true;
  };

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

    if (!acoesPermitidas.includes(payload.acao)) {
      return resposta({ erro: "Ação inválida" });
    }

    // (token já validado por autenticar_ antes da trava)

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // ────────────────────────────────────────
    // ATUALIZAR JOINER — SOMENTE ABA DADOS
    // ────────────────────────────────────────
    if (payload.acao === "atualizar_joiner") {
      const twitterAntigo = String(
        payload.twitter_antigo || ""
      ).trim();

      const twitterNovo = String(
        payload.twitter_novo || ""
      ).trim();

      const emailNovo = String(
        payload.email_novo || ""
      ).trim();

      if (!twitterAntigo) {
        return resposta({ erro: "twitter_antigo ausente" });
      }

      if (!twitterNovo && !emailNovo) {
        return resposta({ erro: "Nenhuma alteração informada" });
      }

      const dadosSheet = spreadsheet.getSheetByName("Dados");

      if (!dadosSheet || dadosSheet.getLastRow() < 2) {
        return resposta({
          erro: "Aba Dados vazia ou não encontrada"
        });
      }

      const totalDados = dadosSheet.getLastRow() - 1;

      const dadosData = dadosSheet
        .getRange(2, 1, totalDados, 3)
        .getValues();

      const normalizarTwitter = valor =>
        String(valor || "")
          .replace(/^@/, "")
          .trim()
          .toLowerCase();

      const twitterAntigoNormalizado =
        normalizarTwitter(twitterAntigo);

      const idx = dadosData.findIndex(([twitter]) =>
        normalizarTwitter(twitter) ===
        twitterAntigoNormalizado
      );

      if (idx === -1) {
        return resposta({ erro: "Joiner não encontrado" });
      }

      const linhaDados = idx + 2;

      if (twitterNovo) {
        const twitterNovoNormalizado =
          normalizarTwitter(twitterNovo);

        const twitterJaExiste = dadosData.some(
          ([twitter], i) =>
            i !== idx &&
            normalizarTwitter(twitter) ===
              twitterNovoNormalizado
        );

        if (twitterJaExiste) {
          return resposta({
            erro: "O novo @ já está cadastrado"
          });
        }

        gravar(dadosSheet.getRange(linhaDados, 1), "@" + twitterNovoNormalizado);
      }

      if (emailNovo) {
        gravar(dadosSheet.getRange(linhaDados, 3), emailNovo.toLowerCase());
      }

      SpreadsheetApp.flush();

      return resposta({
        ok: true,
        acao: "atualizar_joiner",
        updated: 1
      });
    }

    // ────────────────────────────────────────
    // MASTERLIST
    // ────────────────────────────────────────
    const sheet = spreadsheet.getSheetByName("MASTERLIST");

    if (!sheet) {
      return resposta({
        erro: "Aba MASTERLIST não encontrada"
      });
    }

    const totalLinhas = sheet.getLastRow() - HEADER_ROW;

    if (totalLinhas <= 0) {
      return resposta({ updated: 0 });
    }

    const headers = sheet
      .getRange(
        HEADER_ROW,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];

    const colMap = {};

    headers.forEach((header, index) => {
      const nomeHeader = String(header)
        .trim()
        .toUpperCase();

      colMap[nomeHeader] = index + 1;
    });

    const idsNaPlanilha = sheet
      .getRange(
        HEADER_ROW + 1,
        COL_ID_LINHA,
        totalLinhas,
        1
      )
      .getValues();

    // ────────────────────────────────────────
    // NOVO JOINER
    // ────────────────────────────────────────
    if (payload.acao === "novo_joiner") {
      const nome = String(
        payload.nome || ""
      ).trim();

      const twitter = String(
        payload.twitter || ""
      ).trim();

      const email = String(
        payload.email || ""
      ).trim();

      if (!nome || !twitter) {
        return resposta({
          erro: "Nome e @ são obrigatórios"
        });
      }

      const dadosSheet =
        spreadsheet.getSheetByName("Dados");

      if (!dadosSheet) {
        return resposta({
          erro: "Aba Dados não encontrada"
        });
      }

      const colCeg =
        colMap["ABA / CEG"] ||
        colMap["CEG"] ||
        colMap["ABA/CEG"];

      const colNome = colMap["NOME"];
      const colAt = colMap["@"];

      const colNomeItem =
        colMap["NOME DO ITEM"] ||
        colMap["NOME_DO_ITEM"];

      if (
        !colCeg ||
        !colNome ||
        !colAt ||
        !colNomeItem
      ) {
        return resposta({
          erro:
            "Colunas necessárias para novo joiner não encontradas"
        });
      }

      const twitterNormalizado = twitter
        .replace(/^@/, "")
        .trim()
        .toLowerCase();

      const twitterFormatado =
        "@" + twitterNormalizado;

      const dadosExistentes =
        dadosSheet.getDataRange().getValues();

      const joinerJaExiste =
        dadosExistentes.some(([twitterSalvo]) => {
          const twitterSalvoNormalizado =
            String(twitterSalvo || "")
              .replace(/^@/, "")
              .trim()
              .toLowerCase();

          return (
            twitterSalvoNormalizado ===
            twitterNormalizado
          );
        });

      if (joinerJaExiste) {
        return resposta({
          erro: "Este @ já está cadastrado"
        });
      }

      const novaLinha = sheet.getLastRow() + 1;
      // Garante espaço na MASTERLIST ANTES de gravar na aba Dados: se a grade estiver cheia (ou o limite de células do Google for atingido),
      // o erro acontece aqui e o cadastro NÃO fica pela metade (antes, o joiner entrava em Dados e a MASTERLIST falhava depois).
      if (typeof gerador_garantirLinha === "function") gerador_garantirLinha(sheet, novaLinha);

      dadosSheet.appendRow([
        twitterFormatado,
        nome,
        email.toLowerCase()
      ]);
      estado.gravou = true;

      gravar(sheet.getRange(novaLinha, colCeg), "MEMBRO NOVO");

      gravar(sheet.getRange(novaLinha, colNome), nome);

      gravar(sheet.getRange(novaLinha, colAt), twitterFormatado);

      gravar(sheet.getRange(novaLinha, colNomeItem), "PERFIL NOVO");

      // O doPost ja segura o ScriptLock. A funcao NAO tenta pegar uma segunda trava.
      const codigos = preencherCodigos(sheet, novaLinha, 1, false, true);

      SpreadsheetApp.flush();
      const syncOk = sincronizar_();

      // ok:true SÓ se o cadastro ficou completo (Dados + MASTERLIST + NUM/ID). Sem código = sucesso PARCIAL: os registros ficam (não repetir o cadastro).
      const codigoGerado = !!(codigos && codigos.gerados > 0);
      const pendencias = codigos && codigos.puladas ? codigos.puladas : [];
      const respostaJoiner = {
        ok: codigoGerado,
        acao: "novo_joiner",
        linha: novaLinha,
        cadastro_criado: true,
        codigo_gerado: codigoGerado,
        pendencias_codigo: pendencias.length,
        sync: syncOk,
        aviso: syncOk ? undefined : AVISO_SYNC_
      };
      if (!codigoGerado) {
        respostaJoiner.parcial = true;
        respostaJoiner.erro = "Cadastro CRIADO (aba Dados e MASTERLIST linha " + novaLinha + "), mas o NUM/ID NÃO foi gerado" +
          (pendencias.length ? ": " + pendencias[0].motivo : "") + ". Os registros permanecem; não repita o cadastro. A rotina automática completa o código se os gatilhos estiverem instalados; senão, corrija à mão.";
      }
      return resposta(respostaJoiner);
    }

    // ────────────────────────────────────────
    // REPASSAR
    // ────────────────────────────────────────
    if (payload.acao === "repassar") {
      const idLinha = String(
        payload.id_linha || ""
      ).trim();

      const novoNome = String(
        payload.novo_nome || ""
      ).trim();

      const novoTwitter = String(
        payload.novo_twitter || ""
      ).trim();

      if (!idLinha) {
        return resposta({
          erro: "id_linha ausente"
        });
      }

      if (!novoNome || !novoTwitter) {
        return resposta({
          erro:
            "Nome e @ do novo dono são obrigatórios"
        });
      }

      // Recusa ID AMBÍGUO (repetido na planilha) em vez de pegar a primeira linha: uma linha errada seria alterada e o sync copiaria isso para o site.
      const busca = localizarLinhaPorId_(sheet, colMap, idsNaPlanilha, idLinha, payload);
      if (busca.status === "ambiguo") return respostaAmbigua_(idLinha, busca);
      if (busca.status === "ausente") {
        return resposta({
          erro: "id_linha não encontrado"
        });
      }
      const idx = busca.idx;

      const colNome = colMap["NOME"];
      const colAt = colMap["@"];

      if (!colNome || !colAt) {
        return resposta({
          erro: "Colunas NOME ou @ não encontradas"
        });
      }

      const linha = HEADER_ROW + 1 + idx;

      gravar(sheet.getRange(linha, colNome), novoNome);

      gravar(sheet.getRange(linha, colAt), novoTwitter);

      SpreadsheetApp.flush();
      const sync = sincronizar_();

      return resposta({
        ok: true,
        sync,
        aviso: sync ? undefined : AVISO_SYNC_,
        acao: "repassar",
        linha,
        id_linha: idLinha
      });
    }

    // ────────────────────────────────────────
    // RECEBIDO
    // ────────────────────────────────────────
    if (payload.acao === "recebido") {
      const idLinha = String(
        payload.id_linha || ""
      ).trim();

      if (!idLinha) {
        return resposta({
          erro: "id_linha ausente"
        });
      }

      // Recusa ID AMBÍGUO (repetido na planilha) em vez de pegar a primeira linha: uma linha errada seria alterada e o sync copiaria isso para o site.
      const busca = localizarLinhaPorId_(sheet, colMap, idsNaPlanilha, idLinha, payload);
      if (busca.status === "ambiguo") return respostaAmbigua_(idLinha, busca);
      if (busca.status === "ausente") {
        return resposta({
          erro: "id_linha não encontrado"
        });
      }
      const idx = busca.idx;

      const colNacional = colMap["NACIONAL"];

      if (!colNacional) {
        return resposta({
          erro: "Coluna NACIONAL não encontrada"
        });
      }

      const linha = HEADER_ROW + 1 + idx;

      gravar(sheet.getRange(linha, colNacional), true);

      SpreadsheetApp.flush();
      const sync = sincronizar_();

      return resposta({
        ok: true,
        sync,
        aviso: sync ? undefined : AVISO_SYNC_,
        acao: "recebido",
        linha,
        id_linha: idLinha
      });
    }

    // ────────────────────────────────────────
    // APROVAR DISPONÍVEL
    // ────────────────────────────────────────
    if (payload.acao === "aprovar_disponivel") {
      const idLinha = String(
        payload.id_linha || ""
      ).trim();

      const novoNome = String(
        payload.novo_nome || ""
      ).trim();

      const novoTwitter = String(
        payload.novo_twitter || ""
      ).trim();

      const vencimento = String(
        payload.vencimento || ""
      ).trim();

      if (!idLinha) {
        return resposta({
          erro: "id_linha ausente"
        });
      }

      if (!novoNome || !novoTwitter) {
        return resposta({
          erro: "Nome e @ obrigatórios"
        });
      }

      if (!vencimento) {
        return resposta({
          erro: "Vencimento obrigatório"
        });
      }

      // Recusa ID AMBÍGUO (repetido na planilha) em vez de pegar a primeira linha: uma linha errada seria alterada e o sync copiaria isso para o site.
      const busca = localizarLinhaPorId_(sheet, colMap, idsNaPlanilha, idLinha, payload);
      if (busca.status === "ambiguo") return respostaAmbigua_(idLinha, busca);
      if (busca.status === "ausente") {
        return resposta({
          erro: "id_linha não encontrado"
        });
      }
      const idx = busca.idx;

      const colCeg =
        colMap["ABA / CEG"] ||
        colMap["CEG"] ||
        colMap["ABA/CEG"];

      const colNome = colMap["NOME"];
      const colAt = colMap["@"];
      // a MASTERLIST não tem coluna "VENCIMENTO": as datas são ITEM DATA / FRETE DATA / RF DATA (o sync lê "ITEM DATA" como venc_item)
      const colVencimento =
        colMap["ITEM DATA"] || colMap["VENCIMENTO"];

      if (
        !colCeg ||
        !colNome ||
        !colAt ||
        !colVencimento
      ) {
        return resposta({
          erro:
            "Colunas CEG, NOME, @ ou ITEM DATA não encontradas"
        });
      }

      const linha = HEADER_ROW + 1 + idx;

      gravar(sheet.getRange(linha, colCeg), "LOJA");

      gravar(sheet.getRange(linha, colNome), novoNome);

      gravar(sheet.getRange(linha, colAt), novoTwitter);

      gravar(sheet.getRange(linha, colVencimento), vencimento);

      SpreadsheetApp.flush();
      const sync = sincronizar_();

      return resposta({
        ok: true,
        sync,
        aviso: sync ? undefined : AVISO_SYNC_,
        acao: "aprovar_disponivel",
        linha,
        id_linha: idLinha,
        vencimento
      });
    }

    // ────────────────────────────────────────
    // CONFIRMAR / CANCELAR
    // ────────────────────────────────────────
    const itens = Array.isArray(payload.itens)
      ? payload.itens
      : [];

    if (itens.length === 0) {
      return resposta({ ok: true, updated: 0, nao_processados: [] });
    }

    const colItem = colMap["ITEM"];
    const colFrete = colMap["FRETE"];
    const colRf = colMap["RF"];

    if (!colItem || !colFrete || !colRf) {
      return resposta({
        erro:
          "Colunas ITEM/FRETE/RF não encontradas"
      });
    }

    const confirmar =
      payload.acao === "confirmar";

    // FASE 1 — só LEITURA: resolve a linha de cada item. Nenhuma célula é escrita e nenhum sync é disparado aqui.
    const planejados = [];           // itens resolvidos: { id_linha, linha, escritas: [[coluna, valor], ...] }
    const naoProcessados = [];       // tudo que NÃO será escrito, com o motivo (nunca some em silêncio)
    const semAlteracao = [];         // itens sem valor a marcar (não é erro)

    for (const item of itens) {
      const idLinha = String(
        (item && item.id_linha) || ""
      ).trim();

      if (!idLinha) {
        naoProcessados.push({ id_linha: "", motivo: "sem_id_linha", detalhe: "item sem id_linha: a planilha não pode ser atualizada", ceg: item && item.ceg, nome_do_item: item && item.nome_do_item });
        continue;
      }

      // ID repetido na planilha: só segue se CEG + nome do item (enviados pelo site) apontarem para UMA única linha; senão recusa este item.
      const busca = localizarLinhaPorId_(sheet, colMap, idsNaPlanilha, idLinha, item);
      if (busca.status === "ambiguo") {
        naoProcessados.push({ id_linha: idLinha, motivo: "id_ambiguo", linhas: busca.linhas, detalhe: "id_linha aparece em " + busca.linhas.length + " linhas (" + busca.linhas.join(", ") + ")", ceg: item.ceg, nome_do_item: item.nome_do_item });
        console.warn("confirmar/cancelar RECUSADO: id_linha " + idLinha + " aparece nas linhas " + busca.linhas.join(", ") + ". Nada foi alterado para este item.");
        continue;
      }
      if (busca.status === "ausente") {
        naoProcessados.push({ id_linha: idLinha, motivo: "nao_encontrado", detalhe: "id_linha não existe na MASTERLIST", ceg: item.ceg, nome_do_item: item.nome_do_item });
        continue;
      }

      const escritas = [];
      if (Number(item.valor_item || 0) > 0) escritas.push([colItem, confirmar]);
      if (Number(item.frete_inter || 0) > 0) escritas.push([colFrete, confirmar]);
      if (Number(item.taxa_rf || 0) > 0) escritas.push([colRf, confirmar]);
      if (!escritas.length) { semAlteracao.push(idLinha); continue; }

      planejados.push({ id_linha: idLinha, linha: HEADER_ROW + 1 + busca.idx, escritas: escritas, ceg: item.ceg, nome_do_item: item.nome_do_item });
    }

    // FASE 2 — escreve SÓ os itens resolvidos. Se uma escrita falhar, os itens seguintes não são tentados e tudo é informado.
    let updated = 0;
    const processados = [];
    let interrompido = false;
    let gravouAlgo = false;          // alguma célula foi gravada, mesmo que o item não tenha terminado
    for (const plano of planejados) {
      if (interrompido) {
        naoProcessados.push({ id_linha: plano.id_linha, motivo: "nao_tentado", detalhe: "uma escrita anterior falhou; este item não foi tentado", ceg: plano.ceg, nome_do_item: plano.nome_do_item });
        continue;
      }
      const gravadas = [];
      try {
        for (const [coluna, valor] of plano.escritas) {
          gravar(sheet.getRange(plano.linha, coluna), valor);
          gravadas.push(coluna);
        }
        updated++;
        processados.push(plano.id_linha);
      } catch (erroEscrita) {
        interrompido = true;
        if (gravadas.length > 0) gravouAlgo = true;   // item PARCIALMENTE gravado: a planilha mudou e precisa de sync, sem compensação automática
        naoProcessados.push({ id_linha: plano.id_linha, motivo: gravadas.length > 0 ? "escrita_parcial" : "erro_ao_gravar", detalhe: "falha ao gravar na linha " + plano.linha + " (" + gravadas.length + " de " + plano.escritas.length + " campos gravados" + (gravadas.length > 0 ? "; confira a linha na planilha" : "") + "): " + erroEscrita.message, linhas: [plano.linha], ceg: plano.ceg, nome_do_item: plano.nome_do_item });
      }
    }

    SpreadsheetApp.flush();

    // O sync roda se QUALQUER célula foi escrita (item completo ou parcial); itens recusados sem escrita nunca disparam sync.
    const houveEscrita = updated > 0 || gravouAlgo;
    const sync = houveEscrita ? sincronizar_() : null;

    const resultado = {
      ok: naoProcessados.length === 0,
      acao: payload.acao,
      updated,
      processados,
      nao_processados: naoProcessados,
      parcial: houveEscrita && naoProcessados.length > 0,
      ambiguos: naoProcessados.filter(function (n) { return n.motivo === "id_ambiguo"; }).map(function (n) { return { id_linha: n.id_linha, linhas: n.linhas }; }),
      sem_alteracao: semAlteracao,
      sync: sync
    };
    if (naoProcessados.length) {
      resultado.erro = (houveEscrita ? "Atualização PARCIAL: " : "Nada foi atualizado: ") + naoProcessados.length + " item(ns) não processado(s) (" +
        naoProcessados.map(function (n) { return (n.id_linha || "sem id") + " → " + n.motivo; }).join("; ") + ").";
    }
    if (sync === false) resultado.aviso = AVISO_SYNC_;
    return resposta(resultado);

  } catch (err) {
    if (estado.gravou) {
      // A falha veio DEPOIS de alguma gravação: a planilha mudou em parte. Não há repetição nem compensação automática; pede o sync se a MASTERLIST foi tocada.
      const sync = estado.masterlist ? sincronizar_() : null;
      return resposta({
        ok: false,
        parcial: true,
        erro: "Operação interrompida DEPOIS de gravar parte dos dados (" + err.message + "). A planilha foi alterada em parte: confira antes de repetir.",
        sync: sync,
        aviso: sync === false ? AVISO_SYNC_ : undefined
      });
    }
    return resposta({
      erro: err.message
    });

  } finally {
    lock.releaseLock();
  }
}

/**
 * Acha a linha do id_linha. Devolve { status: "ok", idx } | { status: "ausente" } | { status: "ambiguo", linhas }.
 * Se o ID aparece em mais de uma linha, só desambigua quando o pedido traz ceg E nome_do_item e EXATAMENTE UMA das linhas bate nos dois;
 * em qualquer outra situação recusa (nunca escolhe "a primeira").
 */
function localizarLinhaPorId_(sheet, colMap, idsNaPlanilha, idLinha, dica) {
  const alvo = String(idLinha || "").trim();
  const candidatos = [];
  idsNaPlanilha.forEach(function (linha, i) { if (String(linha[0]).trim() === alvo) candidatos.push(i); });
  if (candidatos.length === 0) return { status: "ausente" };
  if (candidatos.length === 1) return { status: "ok", idx: candidatos[0] };

  const norm = function (t) { return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim(); };
  const colCeg = colMap["ABA / CEG"] || colMap["CEG"] || colMap["ABA/CEG"], colNomeItem = colMap["NOME DO ITEM"] || colMap["NOME_DO_ITEM"];
  const dicaCeg = dica ? norm(dica.ceg) : "", dicaItem = dica ? norm(dica.nome_do_item) : "";
  if (dicaCeg && dicaItem && colCeg && colNomeItem) {
    const bateram = candidatos.filter(function (i) {
      const linha = HEADER_ROW + 1 + i;
      return norm(sheet.getRange(linha, colCeg).getDisplayValues()[0][0]) === dicaCeg && norm(sheet.getRange(linha, colNomeItem).getDisplayValues()[0][0]) === dicaItem;
    });
    if (bateram.length === 1) return { status: "ok", idx: bateram[0], desambiguado: true };
  }
  return { status: "ambiguo", linhas: candidatos.map(function (i) { return HEADER_ROW + 1 + i; }) };
}

function respostaAmbigua_(idLinha, busca) {
  console.warn("RECUSADO: id_linha " + idLinha + " aparece nas linhas " + busca.linhas.join(", ") + ". Nada foi alterado.");
  return resposta({
    erro: "id_linha ambíguo: " + idLinha + " aparece em " + busca.linhas.length + " linhas (" + busca.linhas.join(", ") + "). Nada foi alterado.",
    ambiguo: true,
    id_linha: idLinha,
    linhas: busca.linhas
  });
}

/** Dispara o sync sem derrubar a resposta: a planilha JÁ foi alterada; se o gatilho falhar, o próximo sync agendado recupera. */
function sincronizar_() {
  try { triggerSync(); return true; } catch (err) { console.error("triggerSync falhou: " + err.message); return false; }
}

function resposta(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
