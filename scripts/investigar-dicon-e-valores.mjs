// INVESTIGAÇÃO 4 — SOMENTE LEITURA. (a) DICON × D'FESTA: compara os pedidos do formulário (pedidos_dicon_origin) com a MASTERLIST do banco e com a planilha para os donos em foco (a planilha é a fonte oficial; o formulário é evidência complementar).
// (b) valores dos repasses MERCARI/SKZOO e das demandas dos casos financeiros, para a equipe conferir.
// O log do GitHub é PÚBLICO: nada de @, e-mail, nome, CPF, endereço, comprovante. Pessoas = marca h:xxxxxxxx (hash curto do @/cog em minúsculas). Produto, opção, preço e quantidade podem aparecer.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import ws from 'ws';
import { indexarJoiners, resolverLinha } from './resolver-joiner.js';
import { carregarArrobasAntigos } from './arrobas-antigos.js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } });
const n = v => String(v ?? '').trim();
const lc = v => n(v).toLowerCase().replace(/\s+/g, ' ');
const hh = v => createHash('sha256').update(n(v).toLowerCase().replace(/^@/, '')).digest('hex').slice(0, 8);
const anon = v => v == null || n(v) === '' ? '(sem)' : 'h:' + hh(v);
const secao = t => console.log(`\n=== ${t} ===`);
const dia = v => n(v).slice(0, 10);
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
const EMAIL_VALIDO = /^[^\s@#]+@[^\s@]+\.[^\s@]+$/;
const emailLimpo = v => { const e = lc(v); return EMAIL_VALIDO.test(e) ? e : ''; };
const norm = s => String(s).replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
const res = await fetch('https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995'); if (!res.ok) throw new Error(`CSV: ${res.status}`);
const linhasCsv = (await res.text()).replace(/^﻿/, '').split('\n'); const hIdx = linhasCsv.findIndex(l => l.includes('ABA'));
const records = parse(linhasCsv.slice(hIdx).join('\n'), { columns: true, skip_empty_lines: true });
const colMap = {}; Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
const col = (r, ...nomes) => { for (const nm of nomes) { const k = colMap[norm(nm)]; if (k !== undefined) return r[k] ?? ''; } return ''; };
const rows = records.filter(r => n(col(r, 'ABA / CEG', 'CEG')) && n(col(r, 'NOME DO ITEM')));
const joiners = await ler('joiners', 'id, cog, email, twitter');
const idx = indexarJoiners(joiners, await carregarArrobasAntigos(sb, joiners));
const ml = await ler('masterlist', 'id, ceg, cog, nome_do_item, id_linha, valor_item, pago_item, status');
const dem = await ler('pagamento_demandas', 'id, joiner_cog, itens, valor_total, status, created_at, cashback_aplicado');
const rep = await ler('repassos', 'id, created_at, joiner_cog, novo_dono_cog, item_id, status, item_quitado, valor_acordado, nome_do_item');
const S = rows.map(r => ({ cod: n(col(r, 'ID')), ceg: n(col(r, 'ABA / CEG', 'CEG')), item: n(col(r, 'NOME DO ITEM')), dono: lc(resolverLinha({ twitter: n(col(r, '@')), email: emailLimpo(col(r, 'EMAIL')) }, idx).cog), pago: lc(col(r, 'ITEM')) === 'true', preco: n(col(r, 'PREÇO ITEM')) }));
const ehDicon = c => /dicon/i.test(n(c));
console.log(`INVESTIGAÇÃO 4 (somente leitura) — ${new Date().toISOString()}`);

// ───────── A) DICON: pedidos do formulário x masterlist x planilha
secao('A) DICON × D\'FESTA: pedidos do formulário x masterlist x planilha');
const pedidos = await ler('pedidos_dicon_origin', 'id, nome, email, social, itens, qtd_total, valor_total, forma_pagamento, status, created_at', 'created_at');
const porStatus = {}; for (const p of pedidos) porStatus[p.status] = (porStatus[p.status] || 0) + 1;
console.log(`pedidos no formulário: ${pedidos.length} · por status ${JSON.stringify(porStatus)}`);
const donoPedido = p => lc(resolverLinha({ twitter: n(p.social), email: emailLimpo(p.email) }, idx).cog);
const mlD = ml.filter(m => ehDicon(m.ceg)), sD = S.filter(s => ehDicon(s.ceg));
const FOCO = new Set(['29c716f1', '6ac7158e', '4eea4efa', 'cbe8fa7e', '71000f8b', '4a2e4dcf', '4c5b798b', 'e9ae90c6', '30dd7992']);
const donosFoco = new Set([...mlD.map(m => lc(m.cog)), ...sD.map(s => s.dono)].filter(d => d && FOCO.has(hh(d))));
for (const d of [...donosFoco].sort()) {
  console.log(`  ── pessoa ${anon(d)} (cadastro existe: ${joiners.some(j => lc(j.cog) === d) ? 'SIM' : 'não'})`);
  const ped = pedidos.filter(p => donoPedido(p) === d || hh(n(p.social)) === hh(d));
  console.log(`     pedidos do formulário: ${ped.length}`);
  for (const p of ped) console.log(`       pedido ${String(p.id).slice(0, 8)} [${p.status}] ${dia(p.created_at)} ${n(p.forma_pagamento)} total=${Number(p.valor_total).toFixed(2)} qtd=${p.qtd_total} | ${(Array.isArray(p.itens) ? p.itens : []).map(i => `${n(i.produto)} / ${n(i.opcao)} x${i.qtd} @${i.preco}`).join(' ; ')}`);
  for (const s of sD.filter(x => x.dono === d)) console.log(`     planilha: [${s.cod}] ${s.item} ITEM=${s.pago ? 'TRUE' : 'FALSE'} ${s.preco}`);
  for (const m of mlD.filter(x => lc(x.cog) === d)) console.log(`     banco: #${m.id} [${n(m.id_linha) || 'sem código'}] ${m.nome_do_item} pago=${m.pago_item ? 'I' : '-'} valor=${Number(m.valor_item).toFixed(2)}`);
}
// de quem são, na planilha, os códigos 7799/7888/7889 e quem fez pedido que bate com cada um
console.log('  ── os 3 códigos em disputa: dono na planilha x dono no banco x pedido no formulário');
for (const cod of ['DICO-ITE-7799', 'DICO-ITE-7888', 'DICO-ITE-7889']) {
  const s = S.find(x => x.cod === cod), m = ml.find(x => n(x.id_linha) === cod);
  const pedS = s ? pedidos.filter(p => donoPedido(p) === s.dono) : [], pedM = m ? pedidos.filter(p => donoPedido(p) === lc(m.cog)) : [];
  console.log(`     ${cod}: planilha → ${anon(s?.dono)} (pedidos desta pessoa: ${pedS.length}) · banco #${m?.id ?? '-'} → ${anon(m?.cog)} (pedidos desta pessoa: ${pedM.length})`);
}
console.log('  ── linhas do banco do DICON que a planilha não tem (ausentes): pedido do formulário do mesmo dono?');
for (const id of [18292, 18418, 18419, 18420, 18422, 18423]) {
  const m = ml.find(x => x.id === id); if (!m) { console.log(`     #${id}: não existe`); continue; }
  const d = lc(m.cog), ped = pedidos.filter(p => donoPedido(p) === d);
  const casa = ped.filter(p => (Array.isArray(p.itens) ? p.itens : []).some(i => lc(m.nome_do_item).includes(lc(i.produto)) || lc(`${i.produto} ${i.opcao}`).includes(lc(m.nome_do_item))));
  console.log(`     #${id} [${n(m.id_linha)}] ${m.nome_do_item} dono ${anon(d)} · planilha tem linha dele no DICON: ${sD.some(s => s.dono === d) ? 'SIM' : 'não'} · pedidos dele: ${ped.length} (status ${ped.map(p => p.status).join(',') || '-'}; batem com o item: ${casa.length})`);
}

// ───────── B) valores para a equipe conferir
secao('B) valores: repasses MERCARI conflitantes e demandas da #9092');
const CONF = [['#18029', ['403c1287', '70ade74f']], ['#18056', ['2812e31e', '07bbca0e']], ['#18063', ['fcff8585', '9a687127']], ['#18033', ['de4f185f', '7afe01ad']], ['#18068', ['cfdc057d', '816bab33']]];
for (const [item, pref] of CONF) {
  console.log(`  item ${item}:`);
  for (const p of pref) { const r = rep.find(x => String(x.id).startsWith(p)); if (!r) { console.log(`     repasse ${p}: não encontrado`); continue; } const m = ml.find(x => x.id === Number(r.item_id)); console.log(`     repasse ${p} [${r.status}] ${dia(r.created_at)} valor_acordado=${Number(r.valor_acordado).toFixed(2)} quitado=${r.item_quitado} | vendedor ${anon(r.joiner_cog)} → comprador ${anon(r.novo_dono_cog)} | dono atual da linha ${anon(m?.cog)} (${m ? `pago=${m.pago_item ? 'I' : '-'}` : 'sem linha'})`); }
}
for (const id of [1530, 1552, 2005]) {
  const d = dem.find(x => Number(x.id) === id); if (!d) continue;
  console.log(`  demanda ${d.id} [${d.status}] ${dia(d.created_at)} total=${Number(d.valor_total).toFixed(2)} cashback=${Number(d.cashback_aplicado || 0).toFixed(2)} pagadora ${anon(d.joiner_cog)} | itens: ${(Array.isArray(d.itens) ? d.itens : []).map(i => `#${i.id}=${Number(i.valor_item ?? i.valor ?? i.preco ?? 0).toFixed(2)}`).join(' ')}`);
}
console.log('\nFim (somente leitura).');
