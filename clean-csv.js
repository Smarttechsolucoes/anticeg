import fs from 'fs';

const input = process.argv[2];
if (!input) { console.error('Uso: node clean-csv.js arquivo.csv'); process.exit(1); }

const raw = fs.readFileSync(input, 'utf8');

// Parser CSV simples que respeita campos entre aspas
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i+1] === '"') { field += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      row.push(field.trim()); field = '';
    } else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(field.trim()); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

function cleanMoney(v) {
  if (!v) return '';
  const s = v.replace(/R\$\s*/g, '').replace(',', '.').trim();
  return isNaN(parseFloat(s)) ? '' : parseFloat(s).toFixed(2);
}

function cleanVal(v) {
  if (!v || v === '#N/A') return '';
  return v.trim();
}

function escapeCSV(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const rows = parseCSV(raw);

// Linha 0: título "ANTICEG · MASTERLIST" → pular
// Linha 1: grupos de colunas → pular
// Linha 2: cabeçalhos reais
// Linha 3+: dados

const headers = rows[2]; // CEG, COG, NOME, NOME DO ITEM, QUANTIDADE, VALOR ITEM (R$)...

const colMap = {
  'CEG': 'ceg',
  'COG': 'cog',
  'NOME': 'nome',
  'NOME DO ITEM': 'nome_do_item',
  // QUANTIDADE ignorada
  'VALOR ITEM (R$)': 'valor_item',
  'FRETE INTER (R$)': 'frete_inter',
  'TAXA RF (R$)': 'taxa_rf',
  'NACIONAL (R$)': 'nacional',
  'VENC. ITEM': 'venc_item',
  'VENC. FRETE': 'venc_frete',
  'VENC. TAXA': 'venc_taxa',
  'VENC. NACIONAL': 'venc_nacional',
  'PAG. ITEM': 'pag_item',
  'PAG. FRETE': 'pag_frete',
  'PAG. TAXA': 'pag_taxa',
  'PAG. NACIONAL': 'pag_nacional',
  'STATUS': 'status',
};

// Tenta mapear cabeçalho real (pode ter encoding diferente)
const colIndexes = {};
headers.forEach((h, i) => {
  const clean = h.replace(/[^\x20-\x7E]/g, match => {
    // Tenta encontrar pelo conteúdo
    return '';
  }).trim();
  // Match por substring para tolerar encoding
  for (const [key, dbCol] of Object.entries(colMap)) {
    if (h.toUpperCase().includes(key.toUpperCase().slice(0, 6))) {
      colIndexes[dbCol] = i;
    }
  }
});

// Fallback: posição fixa conforme estrutura do CSV
const POS = {
  ceg: 0, cog: 1, nome: 2, nome_do_item: 3,
  // idx 4 = QUANTIDADE (ignorar)
  valor_item: 5, frete_inter: 6, taxa_rf: 7, nacional: 8,
  venc_item: 9, venc_frete: 10, venc_taxa: 11, venc_nacional: 12,
  pag_item: 13, pag_frete: 14, pag_taxa: 15, pag_nacional: 16,
  status: 17,
  // idx 18 = info_adicionais (pode não existir em todas linhas)
};
// info_adicionais é a última coluna
POS.info_adicionais = 18;

const OUTPUT_COLS = ['ceg','cog','nome','nome_do_item','valor_item','frete_inter','taxa_rf','nacional',
  'venc_item','venc_frete','venc_taxa','venc_nacional',
  'pag_item','pag_frete','pag_taxa','pag_nacional','status','info_adicionais'];

const moneyFields = new Set(['valor_item','frete_inter','taxa_rf','nacional']);

const out = [OUTPUT_COLS.join(',')];

// Dados a partir da linha 3 (index 3)
for (let r = 3; r < rows.length; r++) {
  const row = rows[r];
  if (row.every(c => !c)) continue; // linha vazia

  const values = OUTPUT_COLS.map(col => {
    const idx = POS[col];
    const raw = row[idx] || '';
    if (moneyFields.has(col)) return cleanMoney(raw);
    return escapeCSV(cleanVal(raw));
  });

  // Pula linha se não tiver nome_do_item
  if (!values[3]) continue;

  out.push(values.join(','));
}

const outFile = input.replace('.csv', '_clean.csv');
fs.writeFileSync(outFile, out.join('\n'), 'utf8');
console.log(`✓ ${out.length - 1} linhas salvas em: ${outFile}`);
