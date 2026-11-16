// INVESTIGAÇÃO DE PREÇO EM BRANCO — SOMENTE LEITURA. Diferencia "preço desconhecido" (célula em branco) de "preço zero" (R$ 0,00) e mostra o que o sync grava hoje (parseBRL('') = 0).
// O log do GitHub é PÚBLICO: só contagens, ids, códigos, CEG e itens. Nunca @, e-mail, nome de pessoa, CPF ou endereço.
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import ws from 'ws';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } });
const n = v => String(v ?? '').trim();
const secao = t => console.log(`\n=== ${t} ===`);
async function ler(tabela, colunas, ordem = 'id') {
  const out = []; let de = 0;
  for (;;) {
    let q = sb.from(tabela).select(colunas).range(de, de + 999); if (ordem) q = q.order(ordem, { ascending: true });
    const { data, error } = await q;
    if (error) { if (ordem) return ler(tabela, colunas, null); console.log(`  (sem leitura de ${tabela}: ${error.message})`); return []; }
    out.push(...data); if (data.length < 1000) break; de += 1000;
  }
  return out;
}
const norm = s => String(s).replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
const res = await fetch('https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995'); if (!res.ok) throw new Error(`CSV: ${res.status}`);
const linhasCsv = (await res.text()).replace(/^﻿/, '').split('\n'); const hIdx = linhasCsv.findIndex(l => l.includes('ABA'));
const records = parse(linhasCsv.slice(hIdx).join('\n'), { columns: true, skip_empty_lines: true });
const colMap = {}; Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
const col = (r, ...nomes) => { for (const nm of nomes) { const k = colMap[norm(nm)]; if (k !== undefined) return r[k] ?? ''; } return ''; };
const rows = records.filter(r => n(col(r, 'ABA / CEG', 'CEG')) && n(col(r, 'NOME DO ITEM')));
const ml = await ler('masterlist', 'id, ceg, nome_do_item, id_linha, valor_item, frete_inter, taxa_rf, pago_item, pago_frete, pago_rf, status');
const dem = await ler('pagamento_demandas', 'id, itens, status');
const porCod = new Map(ml.filter(m => n(m.id_linha)).map(m => [n(m.id_linha), m]));
const classe = cel => { const t = n(cel); if (!t) return 'em_branco'; if (/^#/.test(t)) return 'erro_de_formula'; const v = parseFloat(t.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')); if (Number.isNaN(v)) return 'ilegivel'; return v === 0 ? 'zero_explicito' : v < 0 ? 'negativo' : 'positivo'; };
console.log(`INVESTIGAÇÃO DE PREÇOS (somente leitura) — ${new Date().toISOString()} — planilha ${rows.length} linhas · masterlist ${ml.length}`);

secao('1) o que a planilha tem na coluna PREÇO ITEM');
const cont = {}; for (const r of rows) { const c = classe(col(r, 'PREÇO ITEM', 'PRECO ITEM')); cont[c] = (cont[c] || 0) + 1; }
console.log(`  ${JSON.stringify(cont)}`);

secao('2) o que o banco tem em valor_item');
console.log(`  valor_item NULO: ${ml.filter(m => m.valor_item === null).length} · igual a 0: ${ml.filter(m => m.valor_item !== null && Number(m.valor_item) === 0).length} · positivo: ${ml.filter(m => Number(m.valor_item) > 0).length} · negativo: ${ml.filter(m => Number(m.valor_item) < 0).length}`);

secao('3) linhas da planilha com preço EM BRANCO ou erro: o que o banco tem hoje (o sync grava 0 nesses casos)');
const brancas = rows.filter(r => ['em_branco', 'erro_de_formula', 'ilegivel'].includes(classe(col(r, 'PREÇO ITEM', 'PRECO ITEM'))));
const grupos = { 'banco=0': 0, 'banco=POSITIVO (o próximo sync gravaria 0 por cima)': 0, 'banco=NULO': 0, 'sem linha no banco': 0 }; const positivos = [], porCeg = {};
for (const r of brancas) {
  const cod = n(col(r, 'ID')), m = porCod.get(cod); const ceg = n(col(r, 'ABA / CEG', 'CEG')); porCeg[ceg] = (porCeg[ceg] || 0) + 1;
  if (!m) grupos['sem linha no banco']++; else if (m.valor_item === null) grupos['banco=NULO']++; else if (Number(m.valor_item) === 0) grupos['banco=0']++; else { grupos['banco=POSITIVO (o próximo sync gravaria 0 por cima)']++; positivos.push(`#${m.id}[${cod}]=${Number(m.valor_item).toFixed(2)}`); }
}
console.log(`  linhas com preço em branco/erro: ${brancas.length} · ${JSON.stringify(grupos)}`);
console.log(`  por CEG: ${JSON.stringify(porCeg)}`);
if (positivos.length) console.log(`  banco com valor POSITIVO e planilha em branco (${positivos.length}): ${positivos.slice(0, 60).join(', ')}`);

secao('4) linhas do banco com valor 0 que têm pagamento marcado ou demanda (cobrança já feita sobre preço zero?)');
const zero = ml.filter(m => m.valor_item !== null && Number(m.valor_item) === 0);
const idsEm = itens => (Array.isArray(itens) ? itens : []).map(e => (e && typeof e === 'object') ? String(e.id ?? e.item_id ?? '') : String(e ?? '')).filter(Boolean);
const comPago = zero.filter(m => m.pago_item), comDemanda = zero.filter(m => dem.some(d => idsEm(d.itens).includes(String(m.id))));
console.log(`  linhas com valor_item = 0: ${zero.length} · com pago_item marcado: ${comPago.length} · citadas em demanda: ${comDemanda.length}${comDemanda.length ? ' (' + comDemanda.slice(0, 30).map(m => `#${m.id}`).join(', ') + ')' : ''}`);

secao('5) o caso #18489 (DICO-ITE-8051)');
const m = ml.find(x => x.id === 18489), r = rows.find(x => n(col(x, 'ID')) === 'DICO-ITE-8051');
console.log(`  banco: ${m ? `#${m.id} valor_item=${m.valor_item} pago=${m.pago_item ? 'I' : '-'} status=${m.status}` : 'não existe'} · planilha: ${r ? `célula PREÇO ITEM = ${classe(col(r, 'PREÇO ITEM', 'PRECO ITEM'))}` : 'sem linha'}`);
const irmas = rows.filter(x => n(col(x, 'NOME DO ITEM')) === n(r ? col(r, 'NOME DO ITEM') : '') && n(col(x, 'ABA / CEG', 'CEG')) === n(r ? col(r, 'ABA / CEG', 'CEG') : ''));
const precos = {}; for (const x of irmas) { const k = n(col(x, 'PREÇO ITEM', 'PRECO ITEM')) || '(em branco)'; precos[k] = (precos[k] || 0) + 1; }
console.log(`  mesmas linhas de CEG + item na planilha: ${irmas.length} · preços: ${JSON.stringify(precos)}`);
console.log('\nFim (somente leitura).');
