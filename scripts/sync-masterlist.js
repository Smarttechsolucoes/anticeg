import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import ws from 'ws';
import { montarUpsertJoiner, carregarIdsComConta, carregarIdsEmailTrocado, emailPlanilhaDivergeDoTrocado } from './preservar-email.js';
import { casarPorIdLinha, casarChavesRepetidas } from './casar-itens.js';
import { indexarJoiners, resolverLinha, cogDoUpsert, joinerExistente } from './resolver-joiner.js';
import { carregarArrobasAntigos } from './arrobas-antigos.js';

const SHEET_ID = '1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=2116437995`;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { realtime: { transport: ws } }
);

function parseBRL(str) {
  if (!str || str.trim() === '') return 0;
  let cleaned = str.replace(/R\$\s*/g, '').trim();
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{3}/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '');
  }
  return parseFloat(cleaned) || 0;
}

// O sync só manda UPDATE para a linha que MUDOU (antes mandava 7,5 mil UPDATEs por execução, mesmo sem mudança nenhuma: ~20 min de carga no banco).
// Compara exatamente os campos que o UPDATE gravaria. Na dúvida, atualiza: coluna que não veio do banco (undefined) ou valor que não bate = "mudou".
// SYNC_ATUALIZAR_TUDO=1 volta ao comportamento antigo (atualiza todas).
const CAMPOS_COMPARADOS = ['ceg', 'cog', 'nome', 'nome_do_item', 'id_linha', 'valor_item', 'frete_inter', 'taxa_rf', 'info_adicionais',
  'pago_item', 'pago_frete', 'pago_rf', 'venc_item', 'venc_frete', 'venc_rf', 'status'];
const CAMPOS_NUMERICOS = new Set(['valor_item', 'frete_inter', 'taxa_rf']);
function linhaMudou(existente, novo) {
  for (const c of CAMPOS_COMPARADOS) {
    const noBanco = existente[c];
    if (noBanco === undefined) return true;
    const daPlanilha = novo[c] ?? null;
    if (CAMPOS_NUMERICOS.has(c)) {
      if (noBanco === null || daPlanilha === null || Math.round(Number(noBanco) * 100) !== Math.round(Number(daPlanilha) * 100)) return true;
    } else if (noBanco !== daPlanilha) return true;
  }
  return false;
}

// Normaliza nome de coluna: minúsculo, sem espaços extras, sem BOM
function norm(str) {
  return str.replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Busca valor no registro pelo nome normalizado da coluna
function col(record, colMap, ...names) {
  for (const name of names) {
    const key = colMap[norm(name)];
    if (key !== undefined) return record[key] ?? '';
  }
  return '';
}

async function main() {
  console.log('Buscando planilha...');
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Falha ao buscar CSV: ${res.status}`);
  const text = await res.text();

  // Encontra a linha do cabeçalho real procurando por "ABA"
  const allLines = text.replace(/^﻿/, '').split('\n');
  const headerIdx = allLines.findIndex(l => l.includes('ABA'));
  if (headerIdx === -1) throw new Error('Cabeçalho não encontrado no CSV');
  console.log(`Cabeçalho na linha ${headerIdx + 1}: ${allLines[headerIdx].slice(0, 80)}`);
  const csvFromHeader = allLines.slice(headerIdx).join('\n');
  const records = parse(csvFromHeader, { columns: true, skip_empty_lines: true });
  console.log(`${records.length} linhas encontradas na planilha`);

  if (records.length === 0) { console.log('Planilha vazia.'); return; }

  // Monta mapa de colunas normalizadas → nome real
  const colMap = {};
  Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
  console.log('Colunas:', Object.keys(colMap).join(' | '));

  // Carregar joiners para lookup
  const { data: joiners, error: erroJoiners } = await supabase.from('joiners').select('id, cog, email, twitter, confirmado').order('id', { ascending: true });
  // Sem esta leitura o sync não sabe quem já existe nem quem tem conta: continuaria às cegas e poderia trocar o e-mail verificado de uma conta. Melhor parar sem gravar nada.
  if (erroJoiners || !Array.isArray(joiners)) throw new Error(`Não consegui ler as joiners (${erroJoiners?.message || 'sem dados'}). Nada foi gravado.`);
  // Quem disputa o mesmo @/e-mail (ex.: "Seopookie" e "seopookie"): a regra de desempate é fixa e o upsert nunca cria gêmeo (ver resolver-joiner.js).
  // @ ANTIGOS registrados nas trocas: se a planilha ainda mostra o @ de antes, a pessoa continua sendo a MESMA (o cadastro e o cog originais ficam; nada é movido nem criado).
  // Se mais de um cadastro é possível (@ antigo ligado a dois cadastros, ou igual ao cog/@ de outro), o sync NÃO decide: registra o conflito e deixa tudo como está.
  const arrobasAntigos = await carregarArrobasAntigos(supabase, joiners);
  const idxJoiners = indexarJoiners(joiners, arrobasAntigos);
  const conflitos = [];                                   // { onde, tipo, chave, candidatos, detalhe }
  const avisosArrobaAntigo = new Set();                   // cogs cuja planilha ainda mostra o @ antigo (a planilha precisa ser corrigida; nada é sobrescrito)
  const registrarConflito = (onde, resolucao, detalhe) => conflitos.push({ onde, tipo: resolucao.conflito.tipo, chave: resolucao.conflito.chave, candidatos: resolucao.conflito.candidatos, detalhe });

  // Carregar masterlist existente paginada (Supabase limita 1000 por query)
  // existingMap: chave → array de itens (suporta duplicatas)
  // Um erro ou uma leitura vazia NUNCA pode virar "o banco está vazio": em 03/11 uma leitura vazia fez este sync inserir 7.532 cópias de linhas que já existiam.
  const { count: totalEsperado, error: erroContagem } = await supabase.from('masterlist').select('id', { count: 'exact', head: true });
  if (erroContagem || totalEsperado == null) throw new Error(`Não consegui contar a masterlist (${erroContagem?.message || 'sem contagem'}). Nada foi gravado.`);
  const existingMap = {};
  let from = 0;
  while (true) {
    let page = null, erroPagina = null;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      ({ data: page, error: erroPagina } = await supabase
        .from('masterlist')
        .select('id, ceg, nome_do_item, nome, status, pago_item, pago_frete, pago_rf, id_linha, cog, valor_item, frete_inter, taxa_rf, info_adicionais, venc_item, venc_frete, venc_rf')
        .order('id', { ascending: true })
        .range(from, from + 999));
      if (!erroPagina) break;
      await new Promise(r => setTimeout(r, 2000 * tentativa));
    }
    if (erroPagina) throw new Error(`Falha ao ler a masterlist a partir da linha ${from}: ${erroPagina.message}. Nada foi gravado.`);
    if (!page || page.length === 0) break;
    page.forEach(item => {
      const key = `${item.ceg}|${item.nome_do_item}|${item.nome}`.toLowerCase();
      if (!existingMap[key]) existingMap[key] = [];
      existingMap[key].push(item);
    });
    if (page.length < 1000) break;
    from += 1000;
  }
  const totalNoBanco = Object.values(existingMap).reduce((a, v) => a + v.length, 0); // ANTES do casamento por código: é a base da trava de planilha parcial
  console.log(`${totalNoBanco} itens existentes no banco`);
  // A leitura tem que bater com a contagem do banco (tolera a diferença de linhas criadas pelo site no meio do caminho).
  if (Math.abs(totalNoBanco - totalEsperado) > Math.max(25, totalEsperado * 0.01)) {
    throw new Error(`Leitura incompleta: li ${totalNoBanco} linhas, mas o banco tem ${totalEsperado}. Nada foi gravado.`);
  }

  const rows = records.filter(r =>
    col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim() &&
    col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim()
  );

  console.log(`${rows.length} linhas válidas após filtro`);

  // Trava contra inserção em massa: banco muito menor que a planilha = leitura falhou ou banco vazio, não "tudo é novo".
  if (totalNoBanco < rows.length * 0.5 && process.env.SYNC_PERMITIR_BANCO_VAZIO !== '1') {
    throw new Error(`O banco tem ${totalNoBanco} linhas e a planilha ${rows.length}: parece leitura incompleta ou banco vazio. Nada foi gravado. Se for uma carga inicial de verdade, rode com SYNC_PERMITIR_BANCO_VAZIO=1.`);
  }
  const MAX_INSERCOES = Number(process.env.SYNC_MAX_INSERCOES || 500); // limite de linhas novas por execução (a maior carga legítima de 2026 foi 299)
  let bloqueadasPorLimite = 0;

  // Casa primeiro pelo CÓDIGO da planilha (coluna ID = id_linha): a linha continua a MESMA (mesmo id) mesmo que o nome do item, o nome de exibição ou o dono mudem.
  // Sem isso a regra antiga (ceg|item|nome) insere uma linha nova e apaga a antiga, e as demandas de pagamento ficam apontando para um id que não existe mais.
  // O DONO da linha da planilha é calculado como no laço abaixo (@ → joiner cadastrada; senão o próprio @/e-mail): um id NUNCA muda de dono por causa de um código.
  const cogDe = r => resolverLinha({ twitter: col(r, colMap, '@'), email: col(r, colMap, 'EMAIL') }, idxJoiners).cog;   // conflito => null (a linha não casa com nada e não é tocada)
  const casamento = casarPorIdLinha(
    rows.map(r => ({ idLinha: col(r, colMap, 'ID').trim(), ceg: col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim(), item: col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim(), cog: cogDe(r) })),
    Object.values(existingMap).flat()
  );
  // as linhas já reivindicadas saem do casamento por chave/ordem (e, por consequência, nunca entram na exclusão)
  for (const k of Object.keys(existingMap)) existingMap[k] = existingMap[k].filter(x => !casamento.reivindicados.has(x.id));
  // Desempate pelo DONO entre linhas SEM código com a MESMA chave (ex.: duas joiners com o mesmo nome de exibição): evita que os donos TROQUEM de id quando a ordem da planilha muda.
  const desempate = casarChavesRepetidas(
    rows.map((r, indice) => ({ indice, r })).filter(x => !casamento.porIndice.has(x.indice))
        .map(x => ({ indice: x.indice, chave: `${col(x.r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim()}|${col(x.r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim()}|${col(x.r, colMap, 'NOME').trim()}`.toLowerCase(), cog: cogDe(x.r) })),
    Object.entries(existingMap).flatMap(([k, arr]) => arr.map(x => ({ id: x.id, chave: k, cog: x.cog, item: x })))
  );
  for (const k of Object.keys(existingMap)) existingMap[k] = existingMap[k].filter(x => !desempate.reivindicados.has(x.id));
  let desempatadasPeloDono = 0;
  let casadosPorCodigo = 0, renomeadosPorCodigo = 0;

  let updated = 0, inserted = 0, erros = 0, comData = 0, semMudanca = 0;
  const atualizarTudo = process.env.SYNC_ATUALIZAR_TUDO === '1';
  const mudancasStatus = []; // { cog, nomeItem, ceg, statusNovo }
  const novosItens = [];     // { cog, nomeItem, ceg }
  // Rastreia quantas vezes cada chave apareceu na planilha (para duplicatas)
  const sheetKeyCount = {};

  for (const [idxLinha, r] of rows.entries()) {
    try {
      const ceg      = col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim();
      const nome     = col(r, colMap, 'NOME').trim();
      const nomeItem = col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim();
      const twitter  = col(r, colMap, '@').trim().replace(/^@/, '').toLowerCase();
      const email    = col(r, colMap, 'EMAIL').trim().toLowerCase();
      const chegou    = col(r, colMap, 'Chegou?', 'CHEGOU?').trim().toUpperCase() === 'TRUE';
      const nacional  = col(r, colMap, 'NACIONAL').trim().toUpperCase() === 'TRUE';
      const pagoItem  = col(r, colMap, 'ITEM').trim().toUpperCase() === 'TRUE';
      const pagoFrete = col(r, colMap, 'FRETE').trim().toUpperCase() === 'TRUE';
      const pagoRf    = col(r, colMap, 'RF').trim().toUpperCase() === 'TRUE';
      const idLinha   = col(r, colMap, 'ID').trim() || null;

      const resol = resolverLinha({ twitter, email }, idxJoiners);
      if (resol.conflito) {
        // mais de um cadastro possível: NÃO move item, NÃO cria cadastro, NÃO atualiza a linha. A linha do banco (se existir) é protegida da exclusão (conta como presente na planilha).
        registrarConflito('masterlist', resol, { ceg, item: nomeItem, id_linha: col(r, colMap, 'ID').trim() || null });
        const chaveProtegida = `${ceg}|${nomeItem}|${nome}`.toLowerCase();
        sheetKeyCount[chaveProtegida] = (sheetKeyCount[chaveProtegida] || 0) + 1;
        continue;
      }
      const cog = resol.cog;
      if (resol.via === 'arroba_antigo') avisosArrobaAntigo.add(cog);

      const parseDate = str => {
        if (!str || !str.trim()) return null;
        const s = str.trim();
        const brFull = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (brFull) return `${brFull[3]}-${brFull[2].padStart(2,'0')}-${brFull[1].padStart(2,'0')}`;
        const brShort = s.match(/^(\d{1,2})\/(\d{1,2})$/);
        if (brShort) return `${new Date().getFullYear()}-${brShort[2].padStart(2,'0')}-${brShort[1].padStart(2,'0')}`;
        const isoMatch = s.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isoMatch) return s;
        return null;
      };

      const baseFields = {
        ceg, cog, nome,
        nome_do_item:    nomeItem,
        id_linha:        idLinha,
        valor_item:      parseBRL(col(r, colMap, 'PREÇO ITEM', 'PRECO ITEM')),
        frete_inter:     parseBRL(col(r, colMap, 'PREÇO FRETE', 'FRETE INTER', 'PRECO FRETE')),
        taxa_rf:         parseBRL(col(r, colMap, 'PREÇO RF', 'PRECO RF')),
        info_adicionais: col(r, colMap, 'INFORMAÇÕES', 'INFORMACOES').trim() || null,
        pago_item:  pagoItem,
        pago_frete: pagoFrete,
        pago_rf:    pagoRf,
        venc_item:  parseDate(col(r, colMap, 'ITEM DATA')),
        venc_frete: parseDate(col(r, colMap, 'FRETE DATA')),
        venc_rf:    parseDate(col(r, colMap, 'RF DATA')),
      };

      const freteVal = parseBRL(col(r, colMap, 'PREÇO FRETE', 'FRETE INTER', 'PRECO FRETE'));
      const rfVal    = parseBRL(col(r, colMap, 'PREÇO RF', 'PRECO RF'));
      const status = nacional       ? 'Enviado Nacional'
                   : chegou         ? 'Envio Liberado'
                   : rfVal > 0      ? 'ANTIGOM'
                   : freteVal > 0   ? 'A Caminho'
                   : 'Comprado';

      const key = `${ceg}|${nomeItem}|${nome}`.toLowerCase();
      let existingItem = casamento.porIndice.get(idxLinha); // 1º: pelo código da planilha (mesmo id e mesmo dono)
      const doDesempate = !existingItem && desempate.porIndice.has(idxLinha);
      if (doDesempate) { existingItem = desempate.porIndice.get(idxLinha).item; desempatadasPeloDono++; }
      else if (existingItem) {
        casadosPorCodigo++;
        if (`${existingItem.ceg}|${existingItem.nome_do_item}|${existingItem.nome}`.toLowerCase() !== key) renomeadosPorCodigo++;
      } else {
        sheetKeyCount[key] = (sheetKeyCount[key] || 0) + 1;
        const occIdx = sheetKeyCount[key] - 1; // 0 = primeira ocorrência
        const existingArr = existingMap[key] || [];
        existingItem = existingArr[occIdx]; // pega o item correspondente por ordem
      }

      if (baseFields.venc_item || baseFields.venc_frete || baseFields.venc_rf) comData++;
      if (existingItem) {
        if (!atualizarTudo && !linhaMudou(existingItem, { ...baseFields, status })) {
          semMudanca++;
        } else {
          const { error } = await supabase.from('masterlist').update({ ...baseFields, status }).eq('id', existingItem.id);
          if (error) throw error;
          if (existingItem.status !== status && cog) {
            mudancasStatus.push({ cog, nomeItem, ceg, statusNovo: status });
          }
          updated++;
        }
      } else {
        if (inserted >= MAX_INSERCOES) { bloqueadasPorLimite++; continue; }
        const { error } = await supabase.from('masterlist').insert([{ ...baseFields, status }]);
        if (error) throw error;
        if (cog && cog.toLowerCase() !== 'disponivel') novosItens.push({ cog, nomeItem, ceg });
        inserted++;
      }
    } catch (err) {
      console.error(`Erro:`, err.message);
      erros++;
    }
  }

  console.log(`Sem mudança (nenhum UPDATE enviado): ${semMudanca}`);
  console.log(`\n✓ Masterlist: ${updated} atualizados · ${inserted} inseridos · ${erros} erros · ${comData} com data · ${casadosPorCodigo} casados pelo código (${renomeadosPorCodigo} com nome/CEG alterado, mantendo o id) · ${desempatadasPeloDono} desempatadas pelo dono`);

  if (bloqueadasPorLimite > 0) {
    console.error(`LIMITE DE INSERÇÕES (${MAX_INSERCOES}) ATINGIDO: ${bloqueadasPorLimite} linha(s) novas NÃO foram inseridas. Confira a planilha e o banco; para liberar de propósito, rode com SYNC_MAX_INSERCOES maior.`);
    process.exitCode = 5;
  }

  const PUSH_URL = `${process.env.SUPABASE_URL}/functions/v1/push-evento`;   // send-push (antiga, aberta) foi descontinuada: o push-evento aceita o mesmo corpo e a chave de serviço do sync
  // Interruptor das notificações do sync: DESLIGADO por padrão. Só envia push (mudança de status e item novo) com SYNC_ENVIAR_PUSH=1
  // (no GitHub: Settings > Secrets and variables > Actions > Variables > SYNC_ENVIAR_PUSH = 1).
  const ENVIAR_PUSH = process.env.SYNC_ENVIAR_PUSH === '1';
  if (!ENVIAR_PUSH) console.log(`Push desligado (SYNC_ENVIAR_PUSH != 1): ${mudancasStatus.length} mudança(s) de status e ${novosItens.length} item(ns) novo(s) NÃO serão notificados.`);

  // Enviar push para joiners com mudança de status
  if (ENVIAR_PUSH && mudancasStatus.length > 0) {
    const STATUS_LABEL = {
      'Comprado':        'Comprado ✓',
      'A Caminho':       'A Caminho 🚛',
      'ANTIGOM':         'Na ANTIGOM 📦',
      'Envio Liberado':  'Envio liberado! ✅',
      'Enviado Nacional':'Enviado Nacional 🚀',
      'Disponível':      'Disponível para retirada',
    };
    const cogsMudados = [...new Set(mudancasStatus.map(m => m.cog))];
    const { data: subs } = await supabase.from('push_subscriptions')
      .select('joiner_cog, endpoint, p256dh, auth')
      .in('joiner_cog', cogsMudados);

    const subsByCog = {};
    (subs || []).forEach(s => {
      if (!subsByCog[s.joiner_cog]) subsByCog[s.joiner_cog] = [];
      subsByCog[s.joiner_cog].push(s);
    });
    let pushEnviados = 0, pushErros = 0;

    for (const { cog, nomeItem, ceg, statusNovo } of mudancasStatus) {
      const cogSubs = subsByCog[cog] || [];
      const label = STATUS_LABEL[statusNovo] || statusNovo;
      for (const s of cogSubs) {
        try {
          const res = await fetch(PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              title: `ANTICEG — ${ceg}`,
              body: `${nomeItem}: ${label}`,
              url: '/masterlist',
            }),
          });
          if (res.ok) pushEnviados++; else pushErros++;
        } catch { pushErros++; }
      }
    }
    console.log(`✓ Push: ${mudancasStatus.length} mudança(s) · ${pushEnviados} notificações enviadas · ${pushErros} erros`);
  }

  // Enviar push para joiners com novo item inserido
  if (ENVIAR_PUSH && novosItens.length > 0) {
    const cogsNovos = [...new Set(novosItens.map(m => m.cog))];
    const { data: subsNovos } = await supabase.from('push_subscriptions')
      .select('joiner_cog, endpoint, p256dh, auth')
      .in('joiner_cog', cogsNovos);

    const subsByNovoCog = {};
    (subsNovos || []).forEach(s => {
      if (!subsByNovoCog[s.joiner_cog]) subsByNovoCog[s.joiner_cog] = [];
      subsByNovoCog[s.joiner_cog].push(s);
    });

    let novosPushEnviados = 0, novosPushErros = 0;
    for (const { cog, nomeItem, ceg } of novosItens) {
      const cogSubs = subsByNovoCog[cog] || [];
      for (const s of cogSubs) {
        try {
          const res = await fetch(PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              title: `ANTICEG — ${ceg}`,
              body: `Novo item cadastrado: ${nomeItem}`,
              url: '/masterlist',
            }),
          });
          if (res.ok) novosPushEnviados++; else novosPushErros++;
        } catch { novosPushErros++; }
      }
    }
    console.log(`✓ Push novos: ${novosItens.length} item(s) · ${novosPushEnviados} notificações enviadas · ${novosPushErros} erros`);
  }

  // Sincronizar joiners únicos da planilha
  const joinersMap = {};
  for (const r of rows) {
    const twitter = col(r, colMap, '@').trim();
    const email   = col(r, colMap, 'EMAIL').trim().toLowerCase();
    const nome    = col(r, colMap, 'NOME').trim();
    const handle  = twitter.replace(/^@/, '').toLowerCase();
    const key     = handle || email;
    if (key && !joinersMap[key]) {
      joinersMap[key] = {
        cog:     handle || email.split('@')[0],
        nome,
        email:   email || null,
        twitter: twitter || null,
      };
    }
  }

  const joinersList = Object.values(joinersMap);
  console.log(`\nSincronizando ${joinersList.length} joiners únicos...`);
  let jUpserted = 0, jErros = 0;

  // E-mail: célula vazia da planilha nunca apaga o e-mail do banco, e quem já tem conta ativada (e-mail verificado) não tem o e-mail trocado pelo sync.
  const { idsComConta, contasIndisponiveis } = await carregarIdsComConta(supabase);
  if (contasIndisponiveis) console.error('Aviso: não foi possível consultar contas_joiner — nenhum e-mail será enviado pelo sync nesta rodada (preservação total).');
  let emailsPreservados = 0;
  // E-mail trocado pela administração/prova verificada: o sync não o desfaz com o valor antigo da planilha (ver preservar-email.js, regras 5 e 6)
  const { idsEmailTrocado, trocadosIndisponiveis } = await carregarIdsEmailTrocado(supabase);
  if (trocadosIndisponiveis) console.error('Aviso: não foi possível consultar as trocas de e-mail — nenhum e-mail será enviado pelo sync nesta rodada (preservação total).');
  const divergentesDoTrocado = [];

  for (const j of joinersList) {
    // A pessoa da linha é resolvida pela MESMA regra dos itens: @ de hoje → e-mail → @ ANTIGO registrado → pessoa nova. Mais de um cadastro possível = conflito (nada é criado nem alterado).
    const resol = resolverLinha({ twitter: j.twitter, email: j.email }, idxJoiners);
    if (resol.conflito) { registrarConflito('joiner', resol, { cog_da_planilha: j.cog }); continue; }
    const nova = resol.via === 'novo';
    const atual = nova ? joinerExistente(j.cog, idxJoiners) : joinerExistente(resol.cog, idxJoiners);
    // Joiner que já existe (mesmo @ com outras maiúsculas, ou @ antigo) é atualizada pelo COG que ela já tem: o upsert nunca cria um gêmeo.
    const alvo = montarUpsertJoiner({ ...j, cog: nova ? cogDoUpsert(j.cog, idxJoiners) : resol.cog }, atual, { idsComConta, contasIndisponiveis, idsEmailTrocado, trocadosIndisponiveis });
    // planilha com @ antigo (ou @ que só casa pelo e-mail): o @ de hoje do cadastro NÃO é sobrescrito pelo valor atrasado da planilha; o aviso diz qual planilha precisa ser corrigida
    if (resol.via === 'arroba_antigo' || resol.via === 'email') { delete alvo.twitter; avisosArrobaAntigo.add(resol.cog); }
    if (emailPlanilhaDivergeDoTrocado(j, atual, idsEmailTrocado)) divergentesDoTrocado.push(atual.cog);
    if (atual?.email && !('email' in alvo)) emailsPreservados++;
    const { error } = await supabase.from('joiners')
      .upsert(alvo, { onConflict: 'cog', ignoreDuplicates: false });
    if (error) { console.error('Erro joiner:', error.message); jErros++; }
    else jUpserted++;
  }

  console.log(`✓ Joiners: ${jUpserted} sincronizados · ${jErros} erros · ${emailsPreservados} e-mail(s) existente(s) preservado(s)`);
  // Conflitos de dono (mais de um cadastro possível) e planilhas com @ antigo: nada foi movido, criado ou sobrescrito por causa deles. Fica registrado no log e no resumo da execução (GitHub) para análise.
  if (avisosArrobaAntigo.size > 0) console.log(`✓ Planilha com @ antigo/diferente do cadastro (o @ do cadastro foi preservado; corrija a planilha): ${avisosArrobaAntigo.size} cadastro(s): ${[...avisosArrobaAntigo].slice(0, 40).join(', ')}`);
  if (conflitos.length > 0) {
    const unicos = new Map(conflitos.map(c => [`${c.tipo}|${c.chave}|${(c.candidatos || []).join(',')}`, c]));
    console.log(`⚠ CONFLITOS DE DONO (mais de um cadastro possível): ${conflitos.length} linha(s) em ${unicos.size} caso(s). NADA foi movido, criado ou alterado por causa deles.`);
    for (const c of unicos.values()) console.log(`CONFLITO_SYNC ${JSON.stringify({ tipo: c.tipo, chave: c.chave, candidatos: c.candidatos, onde: c.onde, exemplo: c.detalhe })}`);
    console.log(`::warning title=Sync: ${unicos.size} conflito(s) de dono::Mais de um cadastro possível para linhas da planilha; nada foi movido nem criado. Veja as linhas CONFLITO_SYNC neste log.`);
    try {
      if (process.env.GITHUB_STEP_SUMMARY) {
        const linhas = ['### Conflitos de dono no sync (nada foi movido, criado ou alterado)', '', '| tipo | chave | cadastros possíveis |', '|---|---|---|', ...[...unicos.values()].map(c => `| ${c.tipo} | ${c.chave} | ${(c.candidatos || []).join(', ')} |`), ''];
        (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, linhas.join('\n'));
      }
    } catch { /* o resumo é só um complemento do log */ }
  }
  if (idsEmailTrocado.size > 0) console.log(`✓ E-mail trocado por administração/prova verificada (protegido do sync): ${idsEmailTrocado.size} cadastro(s); ${divergentesDoTrocado.length} com a planilha ainda mostrando outro e-mail (nada foi sobrescrito; corrija a planilha): ${divergentesDoTrocado.slice(0, 30).join(', ')}`);

  // Erros por linha NÃO podem passar por "sync íntegro": o job fica vermelho (código 4) para alguém olhar.
  // Os logs de cada erro acima continuam como estavam, e as demais atualizações já foram feitas (nada é desfeito).
  if (erros > 0 || jErros > 0) {
    console.error(`✗ Sync com erros por linha: ${erros} na masterlist · ${jErros} em joiners — o job termina com falha (código 4).`);
    process.exitCode = 4;
  }


  // Remover registros do banco que não existem mais na planilha — SEMPRE pela função atômica prune_masterlist (supabase/sync/S1_*.sql).
  // Ela mesma recusa planilha parcial, preserva claims/linhas do site/pagas, aplica limite por execução e arquiva o que apagar.
  // Se a função não existir (S1 não aplicado) NÃO apagamos nada: nunca há exclusão direta por este script.
  const totalExistentes = totalNoBanco; // total REAL do banco (as linhas casadas pelo código saíram do existingMap)
  const toDelete = [];
  for (const [key, items] of Object.entries(existingMap)) {
    const countInSheet = sheetKeyCount[key] || 0;
    // Se a planilha tem menos ocorrências que o banco, as extras são CANDIDATAS (a função decide quais podem sair)
    for (let i = countInSheet; i < items.length; i++) toDelete.push(items[i].id);
  }

  if (toDelete.length === 0) { console.log(`
✓ Nenhum registro candidato à remoção`); return; }
  console.log(`
${toDelete.length} registro(s) ausentes da planilha (de ${totalExistentes} no banco): enviando para a exclusão protegida...`);
  // Lista as candidatas (só id, código, CEG, item, status e pago; sem dono nem e-mail) para quem for revisar à mão por que não estão na planilha.
  const LISTA_MAX = 300;
  const itensPorId = new Map(Object.values(existingMap).flat().map(x => [x.id, x]));
  console.log('Candidatas à remoção (id | código | CEG | item | status | pago item/frete/rf):');
  toDelete.slice(0, LISTA_MAX).forEach(id => {
    const x = itensPorId.get(id) || {};
    console.log(`  ${id} | ${x.id_linha || '-'} | ${x.ceg} | ${x.nome_do_item} | ${x.status} | ${x.pago_item ? 'S' : 'n'}/${x.pago_frete ? 'S' : 'n'}/${x.pago_rf ? 'S' : 'n'}`);
  });
  if (toDelete.length > LISTA_MAX) console.log(`  ... e mais ${toDelete.length - LISTA_MAX}`);
  const { data: rel, error: errPrune } = await supabase.rpc('prune_masterlist', { p_ids: toDelete, p_linhas_planilha: rows.length, p_limite: 25 });
  if (errPrune) { console.error('Exclusão protegida indisponível — NADA foi apagado:', errPrune.message); return; }
  if (rel.abortado) {
    console.error(`Exclusão ABORTADA pela proteção (${rel.motivo}) — nada foi apagado.`, JSON.stringify(rel));
    if (rel.motivo === 'limite_excedido') {
      // Há mais linhas ausentes da planilha do que o limite por execução (25). Nada foi apagado e todo o resto do sync já foi feito: isto é um AVISO (o job fica verde),
      // não uma falha. A lista "Candidatas à remoção" acima mostra quais são, para revisão manual.
      console.log(`::warning title=Sync: ${toDelete.length} linha(s) ausentes da planilha::Exclusão protegida não apagou nada (limite_excedido). Veja a lista "Candidatas à remoção" neste log.`);
      return;
    }
    process.exitCode = 3;   // qualquer outro motivo (ex.: planilha parcial) continua vermelho para alguém olhar; as demais atualizações já foram feitas
    return;
  }
  console.log(`✓ Removidos: ${rel.apagadas} · preservados por proteção: ${rel.protegidas} ${JSON.stringify(rel.por_motivo)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
