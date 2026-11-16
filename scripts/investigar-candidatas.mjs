// INVESTIGAÇÃO 3 — SOMENTE LEITURA (SELECTs, RPC de leitura masterlist_motivos_protecao e a leitura pública do CSV; não grava NADA).
// Examina UMA A UMA as candidatas à exclusão do prune (ids em IDS, separados por vírgula): proteções, referências (demandas, repasses, envios, loja) e se há PROVA de que a linha é cópia de outra.
// O log do GitHub é PÚBLICO: só ids, códigos, CEG, item e marcas (h:xxxxxxxx) e sim/não. Nunca @, e-mail, nome de pessoa, CPF ou endereço.
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

console.log(`INVESTIGAÇÃO 3 (somente leitura) — ${new Date().toISOString()} — ${IDS.length} candidata(s) informada(s) · masterlist ${ml.length} · planilha ${S.length} linhas`);
const livres = [], protegidas = {}, naoExistem = [];
for (const id of IDS) {
  const x = vivos.get(id); if (!x) { naoExistem.push(id); continue; }
  const { data: mot, error } = await sb.rpc('masterlist_motivos_protecao', { p_id: id });
  if (error) { console.log(`  #${id}: sem leitura da proteção (${error.message})`); continue; }
  if (mot && mot.length) { for (const m of mot) protegidas[m] = (protegidas[m] || 0) + 1; continue; }
  livres.push(x);
}
console.log(`livres: ${livres.length} · protegidas por motivo: ${JSON.stringify(protegidas)} · já não existem: ${naoExistem.length ? naoExistem.join(',') : 0}`);

const grupos = {};
console.log('\n=== LIVRES, UMA A UMA (id | código | CEG | item | status | dono | referências | prova) ===');
for (const x of livres.sort((a, b) => a.id - b.id)) {
  const k = itemKey(x.ceg, x.nome_do_item), c = lc(x.cog), mesmaChave = porItem.get(k) || [];
  const refs = refsDe(x.id);
  const naPlanilhaPorCodigo = cod(x) ? S.filter(s => s.cod === cod(x)) : [];
  // (β) mesma compra registrada duas vezes: outra linha viva com o MESMO CEG+item+código+dono
  const irmas = cod(x) ? mesmaChave.filter(y => y.id !== x.id && cod(y) === cod(x) && lc(y.cog) === c) : [];
  // (α) o dono desta linha é o @/e-mail DIGITADO numa linha da planilha do mesmo CEG+item que resolve para OUTRO cadastro
  const rs = c ? S.filter(s => s.item === k && s.dono && s.dono !== c && (s.tw === c || s.em === c)) : [];
  const donosAlias = [...new Set(rs.map(s => s.dono))];
  let alias = null;
  if (donosAlias.length === 1) { const O = donosAlias[0]; alias = { O, naPlanilha: S.filter(s => s.item === k && s.dono === O).length, noBanco: mesmaChave.filter(y => y.id !== x.id && lc(y.cog) === O).length }; }
  // sem dono / sem cadastro / ausente da planilha
  const donoNaPlanilha = S.filter(s => s.item === k && s.dono === c).length;
  const cadastro = joiners.some(j => lc(j.cog) === c);
  let classe;
  if (refs.length) classe = 'COM REFERÊNCIA (não arquivar)';
  else if (irmas.length) classe = `COPIA_MESMO_CODIGO (irmãs ${irmas.map(y => `#${y.id}${y.pago_item ? '(paga)' : ''}`).join(',')}; planilha tem esse código ${naPlanilhaPorCodigo.length}x${naPlanilhaPorCodigo.some(s => s.dono === c) ? ' do mesmo dono' : ''})`;
  else if (alias && alias.noBanco >= alias.naPlanilha && alias.naPlanilha > 0 && (!cod(x) || mesmaChave.some(y => y.id !== x.id && lc(y.cog) === alias.O && cod(y) === cod(x)))) classe = `COPIA_APELIDO (mesma pessoa de ${anon(alias.O)}: planilha ${alias.naPlanilha} · banco ${alias.noBanco} pareadas)`;
  else if (c && (() => {
    // mesma pessoa, mesmo CEG e mesmo produto com PEQUENA diferença de nome (só para diagnóstico; o arquivamento exige o par explícito e a checagem completa)
    const frouxo = t => lc(t).replace(/[^a-z0-9à-ú ]/g, ' ').replace(/\s+(skz|ver|version)$/, '').replace(/\s+/g, ' ').trim();
    const gemeas = mesmaChave.filter(y => y.id !== x.id && lc(y.cog) === c && frouxo(y.nome_do_item) === frouxo(x.nome_do_item) && Number(y.valor_item || 0) === Number(x.valor_item || 0) && cod(y) && S.some(s => s.cod === cod(y) && s.dono === c));
    if (!gemeas.length) return false;
    const naPlan = S.filter(s => s.item.split('|')[0] === lc(x.ceg) && frouxo(s.item.split('|')[1]) === frouxo(x.nome_do_item) && s.dono === c).length;
    const noBanco = ml.filter(y => lc(y.ceg) === lc(x.ceg) && lc(y.cog) === c && frouxo(y.nome_do_item) === frouxo(x.nome_do_item)).length;
    classe = `COPIA_NOME_DIFERENTE (par provável #${gemeas.map(y => y.id).join(',#')}${gemeas.some(y => y.pago_item) ? ' paga' : ''}; planilha ${naPlan} · banco ${noBanco}${noBanco > naPlan ? ' → sobra ' + (noBanco - naPlan) : ' → NÃO sobra'}; código ${cod(x) ? (S.some(s => s.cod === cod(x)) ? 'está na planilha' : 'ausente da planilha') : 'inexistente'})`;
    return true;
  })()) { /* classe definida acima */ }
  else if (!c) classe = 'SEM DONO';
  else if (donoNaPlanilha === 0 && naPlanilhaPorCodigo.length === 0) classe = `AUSENTE DA PLANILHA (dono ${cadastro ? 'com' : 'SEM'} cadastro; nenhuma linha dele neste CEG+item; código ${cod(x) ? 'não está na planilha' : 'inexistente'})`;
  else if (naPlanilhaPorCodigo.length && !naPlanilhaPorCodigo.some(s => s.dono === c)) classe = `CODIGO_DE_OUTRO_DONO_NA_PLANILHA (a planilha dá o código a ${naPlanilhaPorCodigo.map(s => anon(s.dono)).join(',')})`;
  else classe = `DUVIDA (dono ${donoNaPlanilha} linha(s) na planilha x ${mesmaChave.filter(y => lc(y.cog) === c).length} no banco neste CEG+item)`;
  const g = classe.split(' ')[0]; grupos[g] = (grupos[g] || 0) + 1;
  console.log(`  #${x.id} | ${cod(x) || '-'} | ${x.ceg} | ${x.nome_do_item} | ${x.status} | ${anon(x.cog)} | ${refs.length ? refs.join(' ') : 'SEM referências'} | ${classe}`);
}
console.log(`\nresumo por classe: ${JSON.stringify(grupos)}`);
console.log('\nFim (somente leitura).');
