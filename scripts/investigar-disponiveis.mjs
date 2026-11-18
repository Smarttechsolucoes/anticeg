// SOMENTE LEITURA. Como o banco trata as linhas que a planilha marca como "disponível" (sem dono). Log público: só contagens, códigos, ids e produtos.
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import ws from 'ws';
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } });
const n = v => String(v ?? '').trim(); const lc = v => n(v).toLowerCase();
const semAcento = v => lc(v).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => String(s).replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
async function ler(t, c, o = 'id') { const out = []; for (let de = 0; ; de += 1000) { const { data, error } = await sb.from(t).select(c).order(o, { ascending: true }).range(de, de + 999); if (error) throw new Error(`${t}: ${error.message}`); out.push(...data); if (data.length < 1000) break; } return out; }
const res = await fetch('https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995'); if (!res.ok) throw new Error('CSV ' + res.status);
const linhas = (await res.text()).replace(/^﻿/, '').split('\n'); const h = linhas.findIndex(l => l.includes('ABA'));
const recs = parse(linhas.slice(h).join('\n'), { columns: true, skip_empty_lines: true });
const cm = {}; Object.keys(recs[0]).forEach(k => { cm[norm(k)] = k; }); const col = (r, nm) => r[cm[norm(nm)]] ?? '';
const disp = recs.filter(r => n(col(r, 'NOME DO ITEM')) && semAcento(col(r, '@')) === 'disponivel' && semAcento(col(r, 'NOME')) === 'disponivel');
const ml = await ler('masterlist', 'id, ceg, cog, nome_do_item, id_linha, status, valor_item, pago_item, pago_frete, pago_rf, na_loja');
const porCod = new Map(); for (const m of ml) if (n(m.id_linha)) { const k = n(m.id_linha); (porCod.get(k) || porCod.set(k, []).get(k)).push(m); }
console.log(`planilha: ${disp.length} linhas sem dono ("disponível")`);
const cont = { 'sem linha no banco': 0, 'banco com dono "disponivel"': 0, 'banco com OUTRO dono': 0 }; const outros = [];
for (const r of disp) { const b = porCod.get(n(col(r, 'ID'))) || []; if (!b.length) cont['sem linha no banco']++; else if (b.every(m => semAcento(m.cog) === 'disponivel')) cont['banco com dono "disponivel"']++; else { cont['banco com OUTRO dono']++; outros.push({ cod: n(col(r, 'ID')), b }); } }
console.log(JSON.stringify(cont));
const pagos = outros.filter(o => o.b.some(m => m.pago_item || m.pago_frete || m.pago_rf));
console.log(`dos que têm OUTRO dono no banco: ${outros.length} · com pagamento registrado: ${pagos.length}`);
for (const o of outros) for (const m of o.b) console.log(`  #${m.id} [${o.cod}] ${m.ceg} | ${m.nome_do_item} | valor ${Number(m.valor_item).toFixed(2)} | status "${n(m.status)}" | pago ${m.pago_item ? 'I' : '-'}${m.pago_frete ? 'F' : '-'}${m.pago_rf ? 'R' : '-'}`);
console.log(`banco: ${ml.filter(m => semAcento(m.cog) === 'disponivel').length} linhas com dono "disponivel"`);

// ── formato das linhas "disponivel" no banco (colunas e valores mais comuns; essas linhas não têm dono, logo não há dado pessoal) + estado dos alvos (só vazio/preenchido)
if (process.env.IDS_ALVO) {
  const todas = await ler('masterlist', '*');
  const dispo = todas.filter(m => semAcento(m.cog) === 'disponivel');
  const colunas = Object.keys(todas[0]);
  console.log(`\ncolunas da masterlist (${colunas.length}): ${colunas.join(', ')}`);
  console.log(`linhas "disponivel": ${dispo.length}`);
  for (const c of colunas) {
    if (['id', 'created_at', 'updated_at'].includes(c)) continue;
    const cnt = new Map(); for (const m of dispo) { const v = JSON.stringify(m[c] ?? null); cnt.set(v, (cnt.get(v) || 0) + 1); }
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, k]) => `${v.length > 40 ? v.slice(0, 40) + '…' : v}×${k}`);
    console.log(`  ${c}: ${top.join(' | ')}${cnt.size > 3 ? ` (+${cnt.size - 3} outros)` : ''}`);
  }
  for (const id of process.env.IDS_ALVO.split(',').map(Number)) {
    const m = todas.find(x => x.id === id); if (!m) { console.log(`\n#${id}: não existe`); continue; }
    console.log(`\n#${id} (campos de identificação: vazio/preenchido): ` + colunas.filter(c => /nome$|^nome|email|twitter|cog|cpf|telefone|endereco|insta|joiner/i.test(c) && !/nome_do_item/.test(c)).map(c => `${c}=${m[c] == null || n(m[c]) === '' ? 'vazio' : 'preenchido'}`).join(', '));
  }
}
