import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const SHEET_ID = '1JOH6f_FYs5EVL4M_bNB-1_Bm9FtPN38f';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function parseBRL(str) {
  if (!str || str.trim() === '') return 0;
  let cleaned = str.replace(/R\$\s*/g, '').trim();
  // formato pt-BR: "1.234,56" → 1234.56
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(cleaned) || 0;
}

async function main() {
  console.log('Buscando planilha...');
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Falha ao buscar CSV: ${res.status}`);
  const text = await res.text();

  const records = parse(text, { columns: true, skip_empty_lines: true });
  console.log(`${records.length} linhas encontradas na planilha`);

  // Carregar todos os joiners para lookup por @ e e-mail
  const { data: joiners } = await supabase.from('joiners').select('cog, email, twitter');
  const byTwitter = {};
  const byEmail = {};
  (joiners || []).forEach(j => {
    if (j.twitter) byTwitter[j.twitter.replace(/^@/, '').toLowerCase()] = j.cog;
    if (j.email)   byEmail[j.email.toLowerCase()] = j.cog;
  });

  // Carregar masterlist existente para preservar campos de pagamento e status manual
  const { data: existing } = await supabase
    .from('masterlist')
    .select('id, ceg, nome_do_item, nome, status, pag_item, pag_frete, pag_taxa, venc_item, venc_frete, venc_taxa');

  const existingMap = {};
  (existing || []).forEach(item => {
    const key = `${item.ceg}|${item.nome_do_item}|${item.nome}`.toLowerCase();
    existingMap[key] = item;
  });

  const rows = records.filter(r => r['ABA / CEG']?.trim() && r['NOME DO ITEM']?.trim());

  let updated = 0, inserted = 0, erros = 0;

  for (const r of rows) {
    try {
      const twitterRaw = (r['@'] || '').trim().replace(/^@/, '').toLowerCase();
      const emailRaw   = (r['EMAIL'] || '').trim().toLowerCase();
      const nome       = (r['NOME'] || '').trim();
      const ceg        = (r['ABA / CEG'] || '').trim();
      const nomeItem   = (r['NOME DO ITEM'] || '').trim();

      const cog = byTwitter[twitterRaw] || byEmail[emailRaw] || twitterRaw || emailRaw.split('@')[0] || null;
      const chegou = (r['Chegou?'] || '').trim().toUpperCase() === 'TRUE';

      const key = `${ceg}|${nomeItem}|${nome}`.toLowerCase();
      const existingItem = existingMap[key];

      const baseFields = {
        ceg,
        cog,
        nome,
        nome_do_item: nomeItem,
        valor_item:   parseBRL(r['PREÇO ITEM']),
        frete_inter:  parseBRL(r['FRETE INTER']),
        taxa_rf:      parseBRL(r['PREÇO RF']),
        info_adicionais: (r['INFORMAÇÕES'] || '').trim() || null,
      };

      if (existingItem) {
        const updateFields = { ...baseFields };
        // Só sobrescreve status se Chegou? = TRUE (evita apagar status manual)
        if (chegou) updateFields.status = 'Envio Liberado';

        const { error } = await supabase
          .from('masterlist')
          .update(updateFields)
          .eq('id', existingItem.id);

        if (error) throw error;
        updated++;
      } else {
        const { error } = await supabase
          .from('masterlist')
          .insert([{ ...baseFields, status: chegou ? 'Envio Liberado' : 'Pré-venda' }]);

        if (error) throw error;
        inserted++;
      }
    } catch (err) {
      console.error(`Erro na linha "${r['NOME DO ITEM']}":`, err.message);
      erros++;
    }
  }

  console.log(`\n✓ Sync concluído: ${updated} atualizados · ${inserted} inseridos · ${erros} erros`);
}

main().catch(err => { console.error(err); process.exit(1); });
