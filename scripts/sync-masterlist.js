import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import ws from 'ws';

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
  const { data: joiners } = await supabase.from('joiners').select('cog, email, twitter');
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
      .select('id, ceg, nome_do_item, nome, status')
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
  console.log(`${Object.values(existingMap).reduce((a, v) => a + v.length, 0)} itens existentes no banco`);

  const rows = records.filter(r =>
    col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim() &&
    col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim()
  );

  console.log(`${rows.length} linhas válidas após filtro`);

  let updated = 0, inserted = 0, erros = 0, comData = 0;
  const mudancasStatus = []; // { cog, nomeItem, ceg, statusNovo }
  const novosItens = [];     // { cog, nomeItem, ceg }
  // Rastreia quantas vezes cada chave apareceu na planilha (para duplicatas)
  const sheetKeyCount = {};

  for (const r of rows) {
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
      sheetKeyCount[key] = (sheetKeyCount[key] || 0) + 1;
      const occIdx = sheetKeyCount[key] - 1; // 0 = primeira ocorrência

      const existingArr = existingMap[key] || [];
      const existingItem = existingArr[occIdx]; // pega o item correspondente por ordem

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

  console.log(`\n✓ Masterlist: ${updated} atualizados · ${inserted} inseridos · ${erros} erros · ${comData} com data`);

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

  for (const j of joinersList) {
    const { error } = await supabase.from('joiners')
      .upsert(j, { onConflict: 'cog', ignoreDuplicates: false });
    if (error) { console.error('Erro joiner:', error.message); jErros++; }
    else jUpserted++;
  }

  console.log(`✓ Joiners: ${jUpserted} sincronizados · ${jErros} erros`);

  // Remover registros do banco que não existem mais na planilha
  const totalExistentes = Object.values(existingMap).reduce((a, v) => a + v.length, 0);
  if (rows.length < totalExistentes * 0.5) {
    console.error(`Abortando prune: planilha retornou apenas ${rows.length} linhas vs ${totalExistentes} no banco. Possível CSV parcial.`);
    return;
  }
  const toDelete = [];
  for (const [key, items] of Object.entries(existingMap)) {
    const countInSheet = sheetKeyCount[key] || 0;
    // Se a planilha tem menos ocorrências que o banco, deleta as extras
    for (let i = countInSheet; i < items.length; i++) {
      toDelete.push(items[i].id);
    }
  }

  if (toDelete.length > 0) {
    console.log(`\nRemovendo ${toDelete.length} registro(s) ausentes da planilha...`);
    let deletados = 0, delErros = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error } = await supabase.from('masterlist').delete().in('id', batch);
      if (error) { console.error('Erro ao deletar:', error.message); delErros += batch.length; }
      else deletados += batch.length;
    }
    console.log(`✓ Removidos: ${deletados} · ${delErros} erros`);
  } else {
    console.log(`\n✓ Nenhum registro para remover`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
