// CONSULTA POR PESSOA — SOMENTE LEITURA (só SELECTs + leitura pública do CSV da planilha; não grava NADA).
// Entrada: PESSOA = marca h:xxxxxxxx (8 hex do sha256 do @ em minúsculas, sem "@"). O @ nunca entra no workflow nem no log.
// O log do GitHub é PÚBLICO: nada de @, e-mail, nome de pessoa, CPF, endereço. Pessoas = marca; produto, código, valor e status podem aparecer.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import ws from 'ws';
import { indexarJoiners, resolverLinha } from './resolver-joiner.js';
import { carregarArrobasAntigos } from './arrobas-antigos.js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const ALVO = String(process.env.PESSOA || '').trim().toLowerCase().replace(/^h:/, '');
if (!/^[0-9a-f]{8}$/.test(ALVO)) { console.error('PESSOA deve ser a marca de 8 hex.'); process.exit(2); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } });
const CSV_URL = 'https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995';
const n = v => String(v ?? '').trim();
const lc = v => n(v).toLowerCase();
const hh = v => createHash('sha256').update(n(v).toLowerCase().replace(/^@/, '')).digest('hex').slice(0, 8);
const anon = v => v == null || n(v) === '' ? '(sem)' : 'h:' + hh(v);
const sn = b => b ? 'SIM' : 'não';
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
const brl = s => { const c = n(s).replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.'); return parseFloat(c); };

const res = await fetch(CSV_URL); if (!res.ok) throw new Error(`CSV: ${res.status}`);
const linhasCsv = (await res.text()).replace(/^﻿/, '').split('\n'); const hIdx = linhasCsv.findIndex(l => l.includes('ABA'));
const records = parse(linhasCsv.slice(hIdx).join('\n'), { columns: true, skip_empty_lines: true });
const colMap = {}; Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
const col = (r, ...nomes) => { for (const nm of nomes) { const k = colMap[norm(nm)]; if (k !== undefined) return r[k] ?? ''; } return ''; };
const rows = records.filter(r => n(col(r, 'ABA / CEG', 'CEG')) && n(col(r, 'NOME DO ITEM')));

const joiners = await ler('joiners', 'id, cog, email, twitter');
const arrAnt = await carregarArrobasAntigos(sb, joiners);
const idx = indexarJoiners(joiners, arrAnt);
const ml = await ler('masterlist', 'id, ceg, cog, nome_do_item, status, id_linha, valor_item, pago_item, pago_frete, pago_rf, na_loja');
const dem = await ler('pagamento_demandas', 'id, joiner_cog, itens, valor_total, status, created_at');
const rep = await ler('repassos', 'id, created_at, joiner_cog, novo_dono_cog, item_id, status, item_quitado, valor_acordado, nome_do_item');
const multas = await ler('multas_pagas', 'id, masterlist_id, campo, valor_multa');
const claims = await ler('claims', 'id, masterlist_id, status');
const envios = await ler('envio_solicitacoes', 'id, itens, status');
const contas = await ler('contas_joiner', 'joiner_id', 'joiner_id');
const arq = await ler('masterlist_exclusoes', 'masterlist_id, dados, origem, excluido_em', 'masterlist_id');

// linhas da planilha resolvidas pelo MESMO método do sync
const S = rows.map(r => { const twitter = n(col(r, '@')), email = emailLimpo(col(r, 'EMAIL')); const rs = resolverLinha({ twitter, email }, idx); return { cod: n(col(r, 'ID')), ceg: n(col(r, 'ABA / CEG', 'CEG')), item: n(col(r, 'NOME DO ITEM')), status: n(col(r, 'STATUS')), pago: lc(col(r, 'ITEM')) === 'true', preco: brl(col(r, 'PREÇO ITEM')), cog: lc(rs.cog), via: rs.via, conflito: !!rs.conflito, tw: lc(twitter).replace(/^@/, ''), em: email }; });
// segue o CADASTRO, não só o @ digitado: parte do @ (ou cog) informado e inclui o cog a que a planilha o resolve (por e-mail/@ antigo) e todas as linhas que resolvem para esse cog
const semente = S.filter(s => hh(s.tw) === ALVO || (s.cog && hh(s.cog) === ALVO));
const cogs = new Set([...joiners.filter(j => hh(j.twitter) === ALVO || hh(j.cog) === ALVO).map(j => lc(j.cog)), ...semente.map(s => s.cog).filter(Boolean)]);
const doAlvoPlan = S.filter(s => hh(s.tw) === ALVO || (s.cog && cogs.has(s.cog)));
const jo = joiners.filter(j => cogs.has(lc(j.cog)));
console.log(`CONSULTA POR PESSOA (somente leitura) — ${new Date().toISOString()} — pessoa h:${ALVO}`);

secao('1) cadastro (joiners) e conta');
console.log(`cadastros encontrados: ${jo.length} (cog distintos em minúsculas: ${new Set(jo.map(j => lc(j.cog))).size})`);
for (const j of jo) {
  const emPlan = doAlvoPlan.map(s => s.em).filter(Boolean);
  console.log(`  joiner id=${j.id}: cog ${anon(j.cog)} · @ ${anon(j.twitter)} · tem e-mail: ${sn(emailLimpo(j.email))} · e-mail igual ao da planilha: ${emPlan.length ? sn(emPlan.includes(lc(j.email))) : 'planilha sem e-mail'} · tem conta: ${sn(contas.some(c => c.joiner_id === j.id))} · cog em maiúsculas/minúsculas diferente do @: ${sn(n(j.cog) !== n(j.cog).toLowerCase())}`);
}
const gemeos = joiners.filter(j => cogs.has(lc(j.cog)) && !jo.includes(j));
console.log(`outros cadastros com o mesmo cog (gêmeos por maiúsculas): ${gemeos.length}`);
console.log(`@ do cadastro bate com o @ consultado: ${sn(jo.some(j => hh(j.twitter) === ALVO))} · e-mails distintos nas linhas da planilha dela: ${new Set(doAlvoPlan.map(s => s.em).filter(Boolean)).size} · @ distintos: ${new Set(doAlvoPlan.map(s => s.tw)).size} · linhas com conflito de resolução: ${doAlvoPlan.filter(s => s.conflito).length}`);

secao('2) planilha: linhas dela');
for (const s of doAlvoPlan) console.log(`  [${s.cod}] ${s.ceg} | ${s.item} | status "${s.status}" | ITEM=${s.pago ? 'TRUE' : 'FALSE'} | preço ${Number.isNaN(s.preco) ? '(vazio)' : s.preco.toFixed(2)} | resolvida via ${s.via}${s.conflito ? ' CONFLITO' : ''} | @ da linha ${anon(s.tw)} | dono resolvido ${anon(s.cog)}`);
console.log(`total: ${doAlvoPlan.length}`);

secao('3) banco (masterlist): linhas dela');
const mlDela = ml.filter(m => cogs.has(lc(m.cog)));
const refs = id => {
  const k = String(id); const idsEm = it => (Array.isArray(it) ? it : []).map(e => (e && typeof e === 'object') ? String(e.id ?? e.item_id ?? e.masterlist_id ?? '') : String(e ?? ''));
  const d = dem.filter(x => idsEm(x.itens).includes(k)).map(x => `dem${x.id}:${x.status}`);
  const r = rep.filter(x => String(x.item_id) === k).map(x => `rep${String(x.id).slice(0, 8)}:${x.status}`);
  const mu = multas.filter(x => String(x.masterlist_id) === k).length, c = claims.filter(x => String(x.masterlist_id) === k).length;
  const e = envios.filter(x => idsEm(x.itens).includes(k)).map(x => `envio${x.id}:${x.status}`);
  return [d.length && d.join(','), r.length && r.join(','), mu && `multas=${mu}`, c && `claims=${c}`, e.length && e.join(',')].filter(Boolean).join(' · ') || '-';
};
for (const m of mlDela) console.log(`  #${m.id} [${n(m.id_linha) || 'sem código'}] ${m.ceg} | ${m.nome_do_item} | status "${n(m.status)}" | valor ${Number(m.valor_item).toFixed(2)} | pago item/frete/rf ${m.pago_item ? 'I' : '-'}${m.pago_frete ? 'F' : '-'}${m.pago_rf ? 'R' : '-'} | na_loja ${sn(m.na_loja)} | refs: ${refs(m.id)}`);
console.log(`total: ${mlDela.length}`);

secao('4) comparação planilha x banco (por código)');
const porCodBanco = new Map(); for (const m of ml) if (n(m.id_linha)) { const k = n(m.id_linha); if (!porCodBanco.has(k)) porCodBanco.set(k, []); porCodBanco.get(k).push(m); }
let problemas = 0;
for (const s of doAlvoPlan) {
  const b = porCodBanco.get(s.cod) || [];
  if (!b.length) { problemas++; console.log(`  FALTA NO BANCO: [${s.cod}] ${s.item}`); continue; }
  if (b.length > 1) { problemas++; console.log(`  CÓDIGO REPETIDO NO BANCO (${b.length}x): [${s.cod}] donos ${b.map(x => `#${x.id}→${anon(x.cog)}`).join(', ')}`); }
  for (const m of b) {
    const dif = [];
    if (!cogs.has(lc(m.cog))) dif.push(`dono no banco ${anon(m.cog)} ≠ dela`);
    if (!Number.isNaN(s.preco) && Math.abs(Number(m.valor_item) - s.preco) > 0.005) dif.push(`valor banco ${Number(m.valor_item).toFixed(2)} ≠ planilha ${s.preco.toFixed(2)}`);
    if (s.pago !== !!m.pago_item) dif.push(`pago banco ${m.pago_item ? 'I' : '-'} ≠ planilha ${s.pago ? 'TRUE' : 'FALSE'}`);
    if (lc(s.item) !== lc(m.nome_do_item)) dif.push(`nome diferente (banco "${m.nome_do_item}")`);
    if (dif.length) { problemas++; console.log(`  DIVERGE [${s.cod}] #${m.id}: ${dif.join('; ')}`); }
  }
}
const codsPlan = new Set(doAlvoPlan.map(s => s.cod));
for (const m of mlDela) if (!codsPlan.has(n(m.id_linha))) {
  const s = S.find(x => x.cod === n(m.id_linha));
  problemas++; console.log(`  SÓ NO BANCO (dela no banco, não dela na planilha): #${m.id} [${n(m.id_linha) || 'sem código'}] ${m.nome_do_item} · na planilha ${s ? `código existe com dono ${anon(s.cog || s.tw)}` : 'código NÃO existe'} · refs: ${refs(m.id)}`);
}
console.log(problemas ? `divergências: ${problemas}` : '  nenhuma divergência');

secao('5) pagamentos, repasses e arquivadas');
const demDela = dem.filter(d => cogs.has(lc(d.joiner_cog)));
console.log(`demandas de pagamento: ${demDela.length}`);
for (const d of demDela) console.log(`  demanda ${d.id} [${d.status}] ${dia(d.created_at)} total ${Number(d.valor_total).toFixed(2)} · itens ${(Array.isArray(d.itens) ? d.itens : []).length} (${(Array.isArray(d.itens) ? d.itens : []).map(e => (e && typeof e === 'object') ? e.id ?? e.item_id ?? e.masterlist_id : e).join(',')})`);
const repDela = rep.filter(r => cogs.has(lc(r.joiner_cog)) || cogs.has(lc(r.novo_dono_cog)));
console.log(`repasses (como vendedora ou compradora): ${repDela.length}`);
for (const r of repDela) console.log(`  repasse ${String(r.id).slice(0, 8)} [${r.status}] ${dia(r.created_at)} ${cogs.has(lc(r.joiner_cog)) ? 'vendedora' : 'compradora'} item #${r.item_id} ${r.nome_do_item} valor ${r.valor_acordado}`);
const arqDela = arq.filter(a => cogs.has(lc(a.dados?.cog)));
console.log(`linhas arquivadas (excluídas) em nome dela: ${arqDela.length}`);
for (const a of arqDela) console.log(`  arquivada #${a.masterlist_id} [${n(a.dados?.id_linha)}] ${n(a.dados?.nome_do_item)} origem ${a.origem} em ${dia(a.excluido_em)}`);
