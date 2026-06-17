import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import ws from 'ws';

const SHEET_ID = '1JOH6f_FYs5EVL4M_bNB-1_Bm9FtPN38f';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

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
  const existingMap = {};
  let from = 0;
  while (true) {
    const { data: page } = await supabase
      .from('masterlist')
      .select('id, ceg, nome_do_item, nome, status')
      .range(from, from + 999);
    if (!page || page.length === 0) break;
    page.forEach(item => {
      const key = `${item.ceg}|${item.nome_do_item}|${item.nome}`.toLowerCase();
      existingMap[key] = item;
    });
    if (page.length < 1000) break;
    from += 1000;
  }
  console.log(`${Object.keys(existingMap).length} itens existentes no banco`);

  const rows = records.filter(r =>
    col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim() &&
    col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM').trim()
  );

  console.log(`${rows.length} linhas válidas após filtro`);

  let updated = 0, inserted = 0, erros = 0;

  for (const r of rows) {
    try {
      const ceg      = col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim();
      const nome     = col(r, colMap, 'NOME').trim();
      const nomeItem = col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM').trim();
      const twitter  = col(r, colMap, '@').trim().replace(/^@/, '').toLowerCase();
      const email    = col(r, colMap, 'EMAIL').trim().toLowerCase();
      const chegou    = col(r, colMap, 'Chegou?', 'CHEGOU?').trim().toUpperCase() === 'TRUE';
      const nacional  = col(r, colMap, 'NACIONAL').trim().toUpperCase() === 'TRUE';
      const pagoItem  = col(r, colMap, 'ITEM').trim().toUpperCase() === 'TRUE';
      const pagoFrete = col(r, colMap, 'FRETE').trim().toUpperCase() === 'TRUE';
      const pagoRf    = col(r, colMap, 'RF').trim().toUpperCase() === 'TRUE';

      const cog = byTwitter[twitter] || byEmail[email] || twitter || email.split('@')[0] || null;

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
      };

      const freteVal = parseBRL(col(r, colMap, 'PREÇO FRETE', 'FRETE INTER', 'PRECO FRETE'));
      const rfVal    = parseBRL(col(r, colMap, 'PREÇO RF', 'PRECO RF'));
      const status = nacional       ? 'Enviado Nacional'
                   : chegou         ? 'Envio Liberado'
                   : rfVal > 0      ? 'ANTIGOM'
                   : freteVal > 0   ? 'A Caminho'
                   : 'Comprado';

      const key = `${ceg}|${nomeItem}|${nome}`.toLowerCase();
      const existingItem = existingMap[key];

      if (existingItem) {
        const { error } = await supabase.from('masterlist').update({ ...baseFields, status }).eq('id', existingItem.id);
        if (error) throw error;
        updated++;
      } else {
        const { error } = await supabase.from('masterlist').insert([{ ...baseFields, status }]);
        if (error) throw error;
        inserted++;
      }
    } catch (err) {
      console.error(`Erro:`, err.message);
      erros++;
    }
  }

  console.log(`\n✓ Masterlist: ${updated} atualizados · ${inserted} inseridos · ${erros} erros`);

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
}

main().catch(err => { console.error(err); process.exit(1); });
