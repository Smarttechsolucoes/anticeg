// INVESTIGAÇÃO 2 — SOMENTE LEITURA (só SELECTs e a leitura pública do CSV da planilha; não grava NADA, nem na planilha nem no banco).
// Complementa investigar-pendencias.mjs: compara DONO, e-mail e @ entre a planilha e o banco usando a MESMA regra do sync (resolver-joiner.js), para dizer se um caso é a mesma pessoa/compra ou não.
// O log do GitHub é PÚBLICO: nada de @, e-mail, nome de pessoa, CPF, endereço. Pessoas aparecem só como marca (h:xxxxxxxx = hash curto do @ em minúsculas, igual ao do sync) e comparações como sim/não.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import ws from 'ws';
import { indexarJoiners, resolverLinha } from './resolver-joiner.js';
import { carregarArrobasAntigos } from './arrobas-antigos.js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } });
const CSV_URL = 'https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995';
const n = v => String(v ?? '').trim();
const lc = v => n(v).toLowerCase();
const anon = v => v == null || n(v) === '' ? '(sem)' : 'h:' + createHash('sha256').update(n(v).toLowerCase().replace(/^@/, '')).digest('hex').slice(0, 8);
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

// ── planilha (mesma leitura do sync)
const ERRO_FORMULA = /^#/;
const EMAIL_VALIDO = /^[^\s@#]+@[^\s@]+\.[^\s@]+$/;
const emailLimpo = v => { const e = lc(v); return EMAIL_VALIDO.test(e) ? e : ''; };
const norm = s => String(s).replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
const res = await fetch(CSV_URL); if (!res.ok) throw new Error(`Falha ao buscar CSV: ${res.status}`);
const linhasCsv = (await res.text()).replace(/^﻿/, '').split('\n');
const hIdx = linhasCsv.findIndex(l => l.includes('ABA')); if (hIdx === -1) throw new Error('Cabeçalho não encontrado');
const records = parse(linhasCsv.slice(hIdx).join('\n'), { columns: true, skip_empty_lines: true });
const colMap = {}; Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
const col = (r, ...nomes) => { for (const nm of nomes) { const k = colMap[norm(nm)]; if (k !== undefined) return r[k] ?? ''; } return ''; };
const rows = records.filter(r => n(col(r, 'ABA / CEG', 'CEG')) && n(col(r, 'NOME DO ITEM')));

const ml = await ler('masterlist', 'id, ceg, cog, nome, nome_do_item, status, id_linha, valor_item, pago_item, pago_frete, pago_rf, na_loja');
const joiners = await ler('joiners', 'id, cog, email, twitter');
const arq = await ler('masterlist_exclusoes', 'masterlist_id, dados, origem, excluido_em', 'masterlist_id');
const dem = await ler('pagamento_demandas', 'id, joiner_cog, itens, valor_total, status, created_at');
const rep = await ler('repassos', 'id, created_at, joiner_cog, novo_dono_cog, item_id, ceg, nome_do_item, status, item_quitado, valor_acordado');
const multas = await ler('multas_pagas', 'id, masterlist_id');
const claims = await ler('claims', 'id, masterlist_id');
const idx = indexarJoiners(joiners, await carregarArrobasAntigos(sb, joiners));
const joinerPorCog = new Map(joiners.map(j => [lc(j.cog), j]));
const vivos = new Map(ml.map(m => [String(m.id), m]));
const arqPorId = new Map(); for (const a of arq) { const k = String(a.masterlist_id); if (!arqPorId.has(k) || String(a.excluido_em) > String(arqPorId.get(k).excluido_em)) arqPorId.set(k, a); }
const idsEm = itens => (Array.isArray(itens) ? itens : []).map(e => (e && typeof e === 'object') ? String(e.id ?? e.item_id ?? e.masterlist_id ?? '') : String(e ?? '')).filter(Boolean);
const brl = s => { const c = n(s).replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.'); return parseFloat(c) || 0; };

// linha da planilha → { cog resolvido (como o sync), via, @ e e-mail só para comparar }
const S = rows.map(r => {
  const twitter = n(col(r, '@')), email = emailLimpo(col(r, 'EMAIL')); const rs = resolverLinha({ twitter, email }, idx);
  return { r, cod: n(col(r, 'ID')), ceg: n(col(r, 'ABA / CEG', 'CEG')), item: n(col(r, 'NOME DO ITEM')), cog: rs.cog, via: rs.via, conflito: !!rs.conflito, tw: lc(twitter).replace(/^@/, ''), em: email, pago: lc(col(r, 'ITEM')) === 'true', preco: brl(col(r, 'PREÇO ITEM')) };
});
console.log(`INVESTIGAÇÃO 2 (somente leitura) — ${new Date().toISOString()} — planilha ${S.length} linhas · masterlist ${ml.length} · joiners ${joiners.length}`);

const refsDe = id => {
  const k = String(id);
  const d = dem.filter(x => idsEm(x.itens).includes(k)).map(x => `${x.id}:${x.status}`);
  const r = rep.filter(x => String(x.item_id) === k).map(x => `${x.id.slice(0, 8)}:${x.status}`);
  const mu = multas.filter(x => String(x.masterlist_id) === k).length, c = claims.filter(x => String(x.masterlist_id) === k).length;
  const p = [d.length && `demandas[${d}]`, r.length && `repasses[${r}]`, mu && `multas=${mu}`, c && `claims=${c}`].filter(Boolean);
  return p.length ? p.join(' ') : 'SEM referências';
};
const fl = m => `#${m.id} [${n(m.id_linha) || 'sem código'}] pago=${m.pago_item ? 'I' : '-'}${m.pago_frete ? 'F' : '-'}${m.pago_rf ? 'R' : '-'} valor=${Number(m.valor_item || 0).toFixed(2)}${m.na_loja ? ' NA_LOJA' : ''}`;

// ───────── A) unidades por pessoa: planilha x banco (MERCARI TOKYO DOME e SKZOO EAAW · ONLINE)
secao('A) UNIDADES POR PESSOA (mesmo CEG + item): quantas a planilha tem x quantas o banco tem');
const alvoA = (ceg, item) => (lc(ceg) === 'mercari' && /tokyo dome/i.test(item)) || (lc(ceg) === lc('SKZOO EAAW · ONLINE') && /secret keyring|face shoulder bag/i.test(item));
const grupos = new Map();   // chave ceg|item|dono → { sheet:[], db:[] }
const pega = k => { if (!grupos.has(k)) grupos.set(k, { sheet: [], db: [] }); return grupos.get(k); };
for (const s of S) if (alvoA(s.ceg, s.item)) pega(`${lc(s.ceg)}|${lc(s.item)}|${lc(s.cog)}`).sheet.push(s);
for (const m of ml) if (alvoA(m.ceg, m.nome_do_item)) pega(`${lc(m.ceg)}|${lc(m.nome_do_item)}|${lc(m.cog)}`).db.push(m);
let nSurplus = 0, nIguais = 0, nSemPlanilha = 0;
for (const [k, g] of [...grupos].sort((a, b) => a[0].localeCompare(b[0]))) {
  const [ceg, item, dono] = k.split('|');
  const planilhaPagas = g.sheet.filter(s => s.pago).length, bancoPagas = g.db.filter(m => m.pago_item).length;
  const rotulo = g.sheet.length === 0 ? 'SEM LINHA NA PLANILHA' : g.db.length > g.sheet.length ? `BANCO TEM ${g.db.length - g.sheet.length} A MAIS` : g.db.length === g.sheet.length ? 'mesma quantidade' : 'planilha tem mais';
  if (g.sheet.length === 0) nSemPlanilha++; else if (g.db.length > g.sheet.length) nSurplus++; else nIguais++;
  console.log(`  ${ceg} | ${item} | dono ${anon(dono)} (cadastro existe: ${sn(joinerPorCog.has(dono))}) | planilha ${g.sheet.length} (pagas ${planilhaPagas}) · banco ${g.db.length} (pagas ${bancoPagas}) → ${rotulo}`);
  for (const s of g.sheet) console.log(`       planilha: [${s.cod || 'sem código'}] ITEM=${s.pago ? 'TRUE' : 'FALSE'} preço=${s.preco.toFixed(2)} (dono achado via ${s.via})`);
  for (const m of g.db.sort((a, b) => a.id - b.id)) console.log(`       banco:    ${fl(m)} | ${refsDe(m.id)}`);
}
console.log(`  resumo: sem linha na planilha ${nSemPlanilha} · banco com a mais ${nSurplus} · quantidade igual ${nIguais}`);

// ───────── B) as inserções retidas: a linha da planilha x as linhas do banco que colidem
secao('B) INSERÇÕES RETIDAS: dono da planilha x dono das linhas do banco que colidem');
const retidos = ['ODDF-ITE-7882', 'DICO-ITE-7799', 'DICO-ITE-7888', 'DICO-ITE-7889', 'MURC-MER-8016', 'SKZO-MER-8048', 'THIS-ITE-226041282'];
for (const cod of retidos) {
  const ss = S.filter(s => s.cod === cod);
  console.log(`  código ${cod}: ${ss.length} linha(s) na planilha · ${ml.filter(m => n(m.id_linha) === cod).length} no banco`);
  if (cod === 'THIS-ITE-226041282') {
    const porDono = new Map(); for (const s of ss) porDono.set(lc(s.cog), (porDono.get(lc(s.cog)) || 0) + 1);
    let semPar = 0; for (const [d, q] of porDono) { const doBanco = ml.filter(m => n(m.id_linha) === cod && lc(m.cog) === d); if (doBanco.length < q) { semPar++; console.log(`     dono ${anon(d)}: planilha ${q} · banco ${doBanco.length} (ids ${doBanco.map(m => m.id)}) | cadastro existe: ${sn(joinerPorCog.has(d))}`); } }
    console.log(`     donos da planilha com menos linhas no banco do que na planilha: ${semPar} de ${porDono.size}`); continue;
  }
  for (const s of ss) {
    const j = s.cog ? joinerPorCog.get(lc(s.cog)) : null;
    console.log(`     planilha: ${s.ceg} | ${s.item} | dono ${anon(s.cog)} via ${s.via}${s.conflito ? ' (CONFLITO)' : ''} | cadastro existe: ${sn(!!j)} | ITEM=${s.pago ? 'TRUE' : 'FALSE'} preço=${s.preco.toFixed(2)}`);
    const colide = ml.filter(m => n(m.id_linha) === cod || (lc(m.ceg) === lc(s.ceg) && lc(m.nome_do_item) === lc(s.item)));
    for (const m of colide.sort((a, b) => a.id - b.id)) {
      const jm = joinerPorCog.get(lc(m.cog));
      const mesmoDono = lc(m.cog) === lc(s.cog);
      const mesmoEmail = !!(jm && s.em && lc(jm.email) === s.em), mesmoTw = !!(jm && s.tw && lc(jm.twitter).replace(/^@/, '') === s.tw);
      const linhaDaPlan = S.some(x => x.cod && x.cod === n(m.id_linha));
      console.log(`        banco ${fl(m)} dono ${anon(m.cog)} | mesmo dono: ${sn(mesmoDono)} · e-mail do cadastro = e-mail da planilha: ${sn(mesmoEmail)} · @ do cadastro = @ da planilha: ${sn(mesmoTw)} · o código dessa linha existe na planilha: ${sn(linhaDaPlan)} | ${refsDe(m.id)}`);
    }
  }
}

// ───────── C) repasses não reapontados e a demanda em possível duplicidade
secao('C) REPASSES e DEMANDAS: cadeia de donos (marcas, sem nomes)');
const repAlvo = ['0639dd4e', '6b0ec76f', '9d48f675', 'de142cf4', 'f4d8c44f'];
for (const pref of repAlvo) {
  const r = rep.find(x => String(x.id).startsWith(pref)); if (!r) { console.log(`  repasse ${pref}: não encontrado`); continue; }
  const a = arqPorId.get(String(r.item_id)); const cod = n(a?.dados?.id_linha);
  const vivasCod = cod ? ml.filter(m => n(m.id_linha) === cod) : [];
  const arqCod = cod ? arq.filter(x => n(x.dados?.id_linha) === cod) : [];
  console.log(`  repasse ${r.id.slice(0, 8)} [${r.status}] criado ${dia(r.created_at)} quitado=${r.item_quitado} | vendedor ${anon(r.joiner_cog)} → comprador ${anon(r.novo_dono_cog)} | item #${r.item_id} código ${cod || '(sem)'}`);
  console.log(`     linha arquivada #${r.item_id}: ${a ? `origem ${a.origem}, dono ${anon(a.dados?.cog)}, dono = vendedor: ${sn(lc(a.dados?.cog) === lc(r.joiner_cog))}` : 'sem arquivo'}`);
  console.log(`     arquivadas com esse código: ${arqCod.length} (${arqCod.map(x => `#${x.masterlist_id} ${x.origem} dono ${anon(x.dados?.cog)}`).join('; ')})`);
  for (const v of vivasCod) console.log(`     viva #${v.id}: dono ${anon(v.cog)} · dono = comprador: ${sn(lc(v.cog) === lc(r.novo_dono_cog))} · pago=${v.pago_item ? 'I' : '-'} | ${refsDe(v.id)}`);
  for (const v of vivasCod) for (const o of rep.filter(x => x.id !== r.id && String(x.item_id) === String(v.id))) console.log(`     outro repasse ${o.id.slice(0, 8)} [${o.status}] criado ${dia(o.created_at)}: vendedor ${anon(o.joiner_cog)} → comprador ${anon(o.novo_dono_cog)} | vendedor dele = comprador deste: ${sn(lc(o.joiner_cog) === lc(r.novo_dono_cog))} · comprador dele = dono vivo: ${sn(lc(o.novo_dono_cog) === lc(v.cog))}`);
}
console.log('  --- demandas em possível duplicidade (linha viva citada por duas demandas)');
for (const id of [1552, 1530]) {
  const d = dem.find(x => Number(x.id) === id); if (!d) { console.log(`  demanda ${id}: não encontrada`); continue; }
  console.log(`  demanda ${d.id} [${d.status}] criada ${dia(d.created_at)} total=${Number(d.valor_total).toFixed(2)} | pagadora ${anon(d.joiner_cog)}`);
  for (const i of idsEm(d.itens)) { const v = vivos.get(i), a = arqPorId.get(i); const dono = v ? v.cog : a?.dados?.cog; console.log(`     item #${i} ${v ? 'VIVO' : a ? `arquivado (${a.origem})` : 'sem registro'}: ${v ? `[${n(v.id_linha)}] ` : a ? `[${n(a.dados?.id_linha)}] ` : ''}dono ${anon(dono)} · dono = pagadora: ${sn(lc(dono) === lc(d.joiner_cog))}`); }
}
console.log('\nFim (somente leitura).');
