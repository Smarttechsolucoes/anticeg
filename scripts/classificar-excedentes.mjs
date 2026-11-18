// CLASSIFICAÇÃO DOS EXCEDENTES — SOMENTE LEITURA (SELECTs, RPC masterlist_motivos_protecao e CSV público; não grava NADA).
// Para cada id em IDS (candidatas sem par na planilha): referências (demandas, repasses, envios, loja, multas, claims), pagamento, par provável (linha irmã pareada com a planilha) e quanto sobra no grupo CEG+item+dono.
// Log PÚBLICO: só ids, códigos, CEG, item, marcas (h:xxxxxxxx) e contagens.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import ws from 'ws';
import { indexarJoiners, resolverLinha } from './resolver-joiner.js';
import { carregarArrobasAntigos } from './arrobas-antigos.js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const IDS = String(process.env.IDS || '').split(/[,\s]+/).filter(Boolean).map(Number);
if (!IDS.length) { console.error('Informe IDS (ids das candidatas, separados por vírgula).'); process.exit(2); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } });
const CSV_URL = 'https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995';
const n = v => String(v ?? '').trim();
const lc = v => n(v).toLowerCase().replace(/\s+/g, ' ');
const anon = v => v == null || n(v) === '' ? '(sem)' : 'h:' + createHash('sha256').update(n(v).toLowerCase().replace(/^@/, '')).digest('hex').slice(0, 8);
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
const res = await fetch(CSV_URL); if (!res.ok) throw new Error(`Falha ao buscar CSV: ${res.status}`);
const linhasCsv = (await res.text()).replace(/^﻿/, '').split('\n');
const hIdx = linhasCsv.findIndex(l => l.includes('ABA')); if (hIdx === -1) throw new Error('Cabeçalho não encontrado');
const records = parse(linhasCsv.slice(hIdx).join('\n'), { columns: true, skip_empty_lines: true });
const colMap = {}; Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
const col = (r, ...nomes) => { for (const nm of nomes) { const k = colMap[norm(nm)]; if (k !== undefined) return r[k] ?? ''; } return ''; };
const rows = records.filter(r => n(col(r, 'ABA / CEG', 'CEG')) && n(col(r, 'NOME DO ITEM')));

const ml = await ler('masterlist', 'id, ceg, cog, nome, nome_do_item, status, id_linha, valor_item, pago_item, pago_frete, pago_rf, na_loja');
const joiners = await ler('joiners', 'id, cog, email, twitter');
const dem = await ler('pagamento_demandas', 'id, itens, status');
const rep = await ler('repassos', 'id, item_id, status');
const envios = await ler('envio_solicitacoes', 'id, itens, status');
const lojinha = await ler('lojinha_repasses', 'id, masterlist_id, status');
const idx = indexarJoiners(joiners, await carregarArrobasAntigos(sb, joiners));
const idsEm = itens => (Array.isArray(itens) ? itens : []).map(e => (e && typeof e === 'object') ? String(e.id ?? e.item_id ?? e.masterlist_id ?? '') : String(e ?? '')).filter(Boolean);
const itemKey = (ceg, item) => `${lc(ceg)}|${lc(item)}`;
const cod = x => n(x.id_linha);
const S = rows.map(r => { const rs = resolverLinha({ twitter: n(col(r, '@')), email: emailLimpo(col(r, 'EMAIL')) }, idx); return { cod: n(col(r, 'ID')), item: itemKey(col(r, 'ABA / CEG', 'CEG'), col(r, 'NOME DO ITEM')), dono: lc(rs.cog), tw: lc(col(r, '@')).replace(/^@/, ''), em: emailLimpo(col(r, 'EMAIL')), pago: lc(col(r, 'ITEM')) === 'true' }; });
const vivos = new Map(ml.map(m => [m.id, m]));
const porItem = new Map(); for (const m of ml) { const k = itemKey(m.ceg, m.nome_do_item); if (!porItem.has(k)) porItem.set(k, []); porItem.get(k).push(m); }
const refsDe = id => {
  const k = String(id), p = [];
  const d = dem.filter(x => idsEm(x.itens).includes(k)).map(x => `${x.id}:${x.status}`); if (d.length) p.push(`demandas[${d}]`);
  const r = rep.filter(x => String(x.item_id) === k).map(x => `${String(x.id).slice(0, 8)}:${x.status}`); if (r.length) p.push(`repasses[${r}]`);
  const e = envios.filter(x => idsEm(x.itens).includes(k)).map(x => `${x.id}:${x.status}`); if (e.length) p.push(`envios[${e}]`);
  const l = lojinha.filter(x => String(x.masterlist_id) === k).map(x => `${x.id}:${x.status}`); if (l.length) p.push(`loja[${l}]`);
  return p;
};

const multas = await ler('multas_pagas', 'id, masterlist_id');
const claims = await ler('claims', 'id, masterlist_id, status');
const cents = v => Math.round(Number(v || 0) * 100);
const marcas = x => `${x.pago_item ? 'I' : '-'}${x.pago_frete ? 'F' : '-'}${x.pago_rf ? 'R' : '-'}`;
const contido = (a, b) => [['pago_item'], ['pago_frete'], ['pago_rf']].every(([f]) => !a[f] || b[f]); // tudo o que a cópia tem marcado, o par também tem
const refsTodas = id => { const p = refsDe(id); const m = multas.filter(x => String(x.masterlist_id) === String(id)).length; const c = claims.filter(x => String(x.masterlist_id) === String(id)).map(x => x.status); if (m) p.push(`multas[${m}]`); if (c.length) p.push(`claims[${c}]`); return p; };
const demPagas = id => dem.filter(x => idsEm(x.itens).includes(String(id)) && lc(x.status) === 'pago').length;

console.log(`CLASSIFICAÇÃO DOS EXCEDENTES (somente leitura) — ${new Date().toISOString()} — ${IDS.length} id(s) · masterlist ${ml.length} · planilha ${S.length} linhas`);
const out = [], resumo = {}, porCeg = {};
for (const id of IDS) {
  const x = vivos.get(id); if (!x) { out.push({ id, classe: 'JA_NAO_EXISTE' }); resumo.JA_NAO_EXISTE = (resumo.JA_NAO_EXISTE || 0) + 1; continue; }
  const k = itemKey(x.ceg, x.nome_do_item), c = lc(x.cog);
  const grupo = (porItem.get(k) || []).filter(y => lc(y.cog) === c);
  const planGrupo = S.filter(s => s.item === k && s.dono === c).length;
  const planCegItem = S.filter(s => s.item === k).length;
  const sobra = grupo.length - planGrupo;
  const refs = refsTodas(id), dp = demPagas(id);
  const { data: mot } = await sb.rpc('masterlist_motivos_protecao', { p_id: id });
  // par provável: outra linha do MESMO dono, CEG, item, valor e status, com código que a planilha reconhece para o mesmo dono
  const pares = grupo.filter(y => y.id !== id && cents(y.valor_item) === cents(x.valor_item) && n(y.status) === n(x.status) && cod(y) && S.some(s => s.cod === cod(y) && s.dono === c));
  const parSemRef = pares.filter(y => !IDS.includes(y.id));
  let classe, nota = '';
  if (!c) classe = 'SEM_DONO';
  else if (planGrupo === 0 && planCegItem === 0) classe = refs.length || marcas(x) !== '---' ? 'ITEM_FORA_DA_PLANILHA_COM_PAGAMENTO_OU_REF' : 'ITEM_FORA_DA_PLANILHA_LIVRE';
  else if (planGrupo === 0) classe = refs.length || marcas(x) !== '---' ? 'DONO_SEM_LINHA_COM_PAGAMENTO_OU_REF' : 'DONO_SEM_LINHA_LIVRE';
  else if (sobra <= 0) classe = 'NAO_SOBRA';
  else if (parSemRef.length && !refs.length && contido(x, parSemRef[0])) { classe = 'ESPELHO_PROVADO'; nota = `par #${parSemRef.map(y => y.id).join(',#')} marcas ${marcas(parSemRef[0])}`; }
  else if (parSemRef.length && !refs.length) { classe = 'COPIA_COM_PAGAMENTO_PROPRIO'; nota = `par #${parSemRef.map(y => y.id).join(',#')} marcas ${marcas(parSemRef[0])}`; }
  else if (parSemRef.length) { classe = 'COPIA_COM_REFERENCIA'; nota = `par #${parSemRef.map(y => y.id).join(',#')} marcas ${marcas(parSemRef[0])}`; }
  else classe = refs.length ? 'EXCEDENTE_COM_REFERENCIA_SEM_PAR' : 'EXCEDENTE_SEM_PAR';
  resumo[classe] = (resumo[classe] || 0) + 1;
  porCeg[x.ceg] = porCeg[x.ceg] || {}; porCeg[x.ceg][classe] = (porCeg[x.ceg][classe] || 0) + 1;
  out.push({ id, classe, linha: `#${id} | ${cod(x) || '-'} | ${x.ceg} | ${x.nome_do_item} | ${x.status} | ${anon(x.cog)} | marcas ${marcas(x)} | valor ${Number(x.valor_item || 0).toFixed(2)} | planilha ${planGrupo} · banco ${grupo.length} | demandas pagas ${dp} | ${refs.length ? refs.join(' ') : 'SEM referências'} | proteção ${(mot || []).join(',') || 'nenhuma'} | ${nota}` });
}
console.log(`\nresumo por classe: ${JSON.stringify(resumo)}`);
console.log(`\npor CEG: ${JSON.stringify(porCeg)}`);
for (const cl of Object.keys(resumo)) {
  console.log(`\n=== ${cl} (${resumo[cl]}) ===`);
  for (const o of out.filter(o => o.classe === cl).sort((a, b) => a.id - b.id)) console.log('  ' + (o.linha || `#${o.id}`));
}
console.log('\nFim (somente leitura).');
