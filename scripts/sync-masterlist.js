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

  const records = parse(text, { columns: true, skip_empty_lines: true, bom: true });
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

  // Carregar masterlist existente para preservar campos de pagamento
  const { data: existing } = await supabase
    .from('masterlist')
    .select('id, ceg, nome_do_item, nome, status');

  const existingMap = {};
  (existing || []).forEach(item => {
    const key = `${item.ceg}|${item.nome_do_item}|${item.nome}`.toLowerCase();
    existingMap[key] = item;
  });

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
      const chegou   = col(r, colMap, 'Chegou?', 'CHEGOU?').trim().toUpperCase() === 'TRUE';

      const cog = byTwitter[twitter] || byEmail[email] || twitter || email.split('@')[0] || null;

      const baseFields = {
        ceg, cog, nome,
        nome_do_item:    nomeItem,
        valor_item:      parseBRL(col(r, colMap, 'PREÇO ITEM', 'PRECO ITEM')),
        frete_inter:     parseBRL(col(r, colMap, 'FRETE INTER')),
        taxa_rf:         parseBRL(col(r, colMap, 'PREÇO RF', 'PRECO RF')),
        info_adicionais: col(r, colMap, 'INFORMAÇÕES', 'INFORMACOES').trim() || null,
      };

      const key = `${ceg}|${nomeItem}|${nome}`.toLowerCase();
      const existingItem = existingMap[key];

      if (existingItem) {
        const updateFields = { ...baseFields };
        if (chegou) updateFields.status = 'Envio Liberado';
        const { error } = await supabase.from('masterlist').update(updateFields).eq('id', existingItem.id);
        if (error) throw error;
        updated++;
      } else {
        const { error } = await supabase.from('masterlist')
          .insert([{ ...baseFields, status: chegou ? 'Envio Liberado' : 'Pré-venda' }]);
        if (error) throw error;
        inserted++;
      }
    } catch (err) {
      console.error(`Erro:`, err.message);
      erros++;
    }
  }

  console.log(`\n✓ Sync concluído: ${updated} atualizados · ${inserted} inseridos · ${erros} erros`);
}

main().catch(err => { console.error(err); process.exit(1); });
