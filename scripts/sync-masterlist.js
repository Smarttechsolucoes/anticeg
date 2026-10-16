import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import ws from 'ws';
import { montarUpsertJoiner, carregarIdsComConta } from './preservar-email.js';
import { casarPorIdLinha } from './casar-itens.js';

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
  const { data: joiners } = await supabase.from('joiners').select('id, cog, email, twitter');
  const byTwitter = {}, byEmail = {};
  (joiners || []).forEach(j => {
    if (j.twitter) byTwitter[j.twitter.replace(/^@/, '').toLowerCase()] = j.cog;
    if (j.email)   byEmail[j.email.toLowerCase()] = j.cog;
  });

  // Carregar masterlist existente paginada (Supabase limita 1000 por query)
  // existingMap: chave → array de itens (suporta duplicatas)
  const existingMap = {};
  let from = 0;
  while (true) {
    const { data: page } = await supabase
      .from('masterlist')
      .select('id, ceg, nome_do_item, nome, status, pago_item, pago_frete, pago_rf, id_linha')
      .order('id', { ascending: true })
      .range(from, from + 999);
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

  const rows = records.filter(r =>
    col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim() &&
    col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim()
  );

  console.log(`${rows.length} linhas válidas após filtro`);

  // Casa primeiro pelo CÓDIGO da planilha (coluna ID = id_linha): a linha continua a MESMA (mesmo id) mesmo que o nome do item, o nome de exibição ou o dono mudem.
  // Sem isso a regra antiga (ceg|item|nome) insere uma linha nova e apaga a antiga, e as demandas de pagamento ficam apontando para um id que não existe mais.
  const casamento = casarPorIdLinha(
    rows.map(r => ({ idLinha: col(r, colMap, 'ID').trim(), ceg: col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim() })),
    Object.values(existingMap).flat()
  );
  // as linhas já reivindicadas saem do casamento por chave/ordem (e, por consequência, nunca entram na exclusão)
  for (const k of Object.keys(existingMap)) existingMap[k] = existingMap[k].filter(x => !casamento.reivindicados.has(x.id));
  let casadosPorCodigo = 0, renomeadosPorCodigo = 0;

  let updated = 0, inserted = 0, erros = 0, comData = 0;
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

      const cog = byTwitter[twitter] || byEmail[email] || twitter || email.split('@')[0] || null;

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
      let existingItem = casamento.porIndice.get(idxLinha); // 1º: pelo código da planilha (mesmo id)
      if (existingItem) {
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
        const { error } = await supabase.from('masterlist').update({ ...baseFields, status }).eq('id', existingItem.id);
        if (error) throw error;
        if (existingItem.status !== status && cog) {
          mudancasStatus.push({ cog, nomeItem, ceg, statusNovo: status });
        }
        updated++;
      } else {
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

  console.log(`\n✓ Masterlist: ${updated} atualizados · ${inserted} inseridos · ${erros} erros · ${comData} com data · ${casadosPorCodigo} casados pelo código (${renomeadosPorCodigo} com nome/CEG alterado, mantendo o id)`);

  const PUSH_URL = `${process.env.SUPABASE_URL}/functions/v1/send-push`;

  // Enviar push para joiners com mudança de status
  if (mudancasStatus.length > 0) {
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
  if (novosItens.length > 0) {
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
  const joinerPorCog = {}, joinerPorCogMin = {};
  (joiners || []).forEach(x => { if (x.cog) { joinerPorCog[x.cog] = x; joinerPorCogMin[x.cog.toLowerCase()] = joinerPorCogMin[x.cog.toLowerCase()] || x; } });
  let emailsPreservados = 0;

  for (const j of joinersList) {
    const atual = joinerPorCog[j.cog] || joinerPorCogMin[String(j.cog || '').toLowerCase()];
    const alvo = montarUpsertJoiner(j, atual, { idsComConta, contasIndisponiveis });
    if (atual?.email && !('email' in alvo)) emailsPreservados++;
    const { error } = await supabase.from('joiners')
      .upsert(alvo, { onConflict: 'cog', ignoreDuplicates: false });
    if (error) { console.error('Erro joiner:', error.message); jErros++; }
    else jUpserted++;
  }

  console.log(`✓ Joiners: ${jUpserted} sincronizados · ${jErros} erros · ${emailsPreservados} e-mail(s) existente(s) preservado(s)`);


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
  const { data: rel, error: errPrune } = await supabase.rpc('prune_masterlist', { p_ids: toDelete, p_linhas_planilha: rows.length, p_limite: 25 });
  if (errPrune) { console.error('Exclusão protegida indisponível — NADA foi apagado:', errPrune.message); return; }
  if (rel.abortado) {
    console.error(`Exclusão ABORTADA pela proteção (${rel.motivo}) — nada foi apagado.`, JSON.stringify(rel));
    process.exitCode = 3;   // o job fica vermelho para alguém olhar; as demais atualizações já foram feitas
    return;
  }
  console.log(`✓ Removidos: ${rel.apagadas} · preservados por proteção: ${rel.protegidas} ${JSON.stringify(rel.por_motivo)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
