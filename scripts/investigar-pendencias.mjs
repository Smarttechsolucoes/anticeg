// INVESTIGAÇÃO SOMENTE LEITURA das pendências ambíguas: pares "linha antiga sem código x irmã com código" (MERCARI TOKYO DOME, 18342/18381), grupos 18337/18338,
// itens de demanda e repasses que citam linha apagada mas NÃO foram reapontados, e as linhas das 4 inserções suspeitas. Só SELECTs; não grava nada.
// O log do GitHub é PÚBLICO: nada de @, e-mail, nome de pessoa, CPF, endereço, URL de comprovante. O dono aparece só como rótulo relativo (D1, D2...) dentro de cada grupo.
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } });
const n = v => String(v ?? '').trim();
const igual = (a, b) => n(a).toLowerCase() === n(b).toLowerCase();
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
const ml = await ler('masterlist', 'id, ceg, cog, nome, nome_do_item, status, id_linha, valor_item, frete_inter, taxa_rf, pago_item, pago_frete, pago_rf, na_loja, venc_item, venc_frete, venc_rf');
const arq = await ler('masterlist_exclusoes', 'masterlist_id, dados, origem, excluido_em', 'masterlist_id');
const dem = await ler('pagamento_demandas', 'id, joiner_cog, itens, valor_total, status, created_at, obs, cashback_aplicado');
const rep = await ler('repassos', 'id, created_at, joiner_cog, novo_dono_cog, item_id, ceg, nome_do_item, item_status, status, item_quitado, valor_acordado');
const claims = await ler('claims', 'id, masterlist_id, status, joiner_cog');
const multas = await ler('multas_pagas', 'id, masterlist_id, campo, valor_multa, created_at');
const envios = await ler('envio_solicitacoes', 'id, itens, status');
const lojinha = await ler('lojinha_repasses', 'id, masterlist_id, status');
const vivos = new Map(ml.map(m => [String(m.id), m]));
const arqPorId = new Map(); for (const a of arq) { const k = String(a.masterlist_id); if (!arqPorId.has(k) || String(a.excluido_em) > String(arqPorId.get(k).excluido_em)) arqPorId.set(k, a); }
const idsEm = itens => (Array.isArray(itens) ? itens : []).map(e => (e && typeof e === 'object') ? String(e.id ?? e.item_id ?? e.masterlist_id ?? '') : String(e ?? '')).filter(Boolean);
const dinheiro = v => v == null ? '-' : Number(v).toFixed(2);
const pg = m => `${m.pago_item ? 'I' : '-'}${m.pago_frete ? 'F' : '-'}${m.pago_rf ? 'R' : '-'}`;
const fmtLinha = m => `#${m.id} [${n(m.id_linha) || 'sem código'}] ${m.status} pago=${pg(m)} item=${dinheiro(m.valor_item)} frete=${dinheiro(m.frete_inter)} taxa=${dinheiro(m.taxa_rf)}${m.na_loja ? ' NA_LOJA' : ''}`;
// referências a uma linha: demandas (id/status), claims, multas, repasses, envios, lojinha
function refs(id) {
  const k = String(id);
  const d = dem.filter(x => idsEm(x.itens).includes(k)).map(x => `${x.id}:${x.status}`);
  const c = claims.filter(x => String(x.masterlist_id) === k).map(x => `${x.id}:${x.status}`);
  const mu = multas.filter(x => String(x.masterlist_id) === k).map(x => `${x.id}:${x.campo}:${dinheiro(x.valor_multa)}`);
  const r = rep.filter(x => String(x.item_id) === k).map(x => `${x.id}:${x.status}`);
  const e = envios.filter(x => idsEm(x.itens).includes(k)).map(x => `${x.id}:${x.status}`);
  const l = lojinha.filter(x => String(x.masterlist_id) === k).map(x => `${x.id}:${x.status}`);
  const partes = [d.length && `demandas[${d}]`, c.length && `claims[${c}]`, mu.length && `multas[${mu}]`, r.length && `repasses[${r}]`, e.length && `envios[${e}]`, l.length && `lojinha[${l}]`].filter(Boolean);
  return partes.length ? partes.join(' ') : 'SEM referências';
}
const nRefs = id => { const k = String(id); return dem.filter(x => idsEm(x.itens).includes(k)).length + claims.filter(x => String(x.masterlist_id) === k).length + multas.filter(x => String(x.masterlist_id) === k).length + rep.filter(x => String(x.item_id) === k).length + envios.filter(x => idsEm(x.itens).includes(k)).length + lojinha.filter(x => String(x.masterlist_id) === k).length; };
const mesmoValor = (a, b) => ['valor_item', 'frete_inter', 'taxa_rf'].every(c => Math.round(Number(a[c] || 0) * 100) === Math.round(Number(b[c] || 0) * 100));
console.log(`INVESTIGAÇÃO (somente leitura) — ${new Date().toISOString()} — masterlist ${ml.length} · arquivo ${arq.length} · demandas ${dem.length} · repasses ${rep.length}`);

// ───────── 1) pares: linha SEM código e irmã COM código (mesmo CEG + item + dono)
secao('1) PARES: linha antiga SEM código x irmã COM código (mesmo CEG, item e dono)');
const gKey = m => `${n(m.ceg).toLowerCase()}|${n(m.nome_do_item).toLowerCase()}|${n(m.cog)}`;
const grupos = new Map(); for (const m of ml) { const k = gKey(m); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(m); }
const pares = [];
for (const g of grupos.values()) { const sem = g.filter(m => !n(m.id_linha)), com = g.filter(m => n(m.id_linha)); if (sem.length && com.length) pares.push({ g, sem, com }); }
console.log(`grupos com linha(s) sem código e linha(s) com código: ${pares.length}`);
const veredito = { 'cópia provável (antiga referenciada, irmã sem referência e mesmos valores)': 0, 'irmã também referenciada': 0, 'valores diferentes': 0, 'outro': 0 };
for (const { g, sem, com } of pares) {
  const o = sem[0];
  console.log(`  ${n(o.ceg)} | ${n(o.nome_do_item)} | ${g.length} linha(s) do mesmo dono no banco`);
  for (const m of g) console.log(`     ${fmtLinha(m)} | ${refs(m.id)}`);
  const s = com[0];
  let v = 'outro';
  if (sem.length === 1 && com.length === 1) {
    if (!mesmoValor(o, s)) v = 'valores diferentes';
    else if (nRefs(o.id) > 0 && nRefs(s.id) === 0) v = 'cópia provável (antiga referenciada, irmã sem referência e mesmos valores)';
    else if (nRefs(s.id) > 0) v = 'irmã também referenciada';
  }
  veredito[v]++; console.log(`     -> ${v}`);
}
console.log('  resumo: ' + JSON.stringify(veredito));

// ───────── 2) grupos pontuais: 18342/18381 e 18337/18338 (CEG + item iguais, qualquer dono; dono só como rótulo)
secao('2) CASOS NOMEADOS: mesmas linhas de CEG + item, com o dono como rótulo relativo');
for (const alvo of [18342, 18381, 18337, 18338]) {
  const a = vivos.get(String(alvo)); if (!a) { console.log(`  #${alvo}: NÃO existe mais no banco${arqPorId.has(String(alvo)) ? ' (arquivada)' : ''}`); continue; }
  const irm = ml.filter(m => igual(m.ceg, a.ceg) && igual(m.nome_do_item, a.nome_do_item));
  const rotulos = new Map(); const rot = c => { if (!rotulos.has(n(c))) rotulos.set(n(c), 'D' + (rotulos.size + 1)); return rotulos.get(n(c)); };
  console.log(`  #${alvo}: ${n(a.ceg)} | ${n(a.nome_do_item)} | ${irm.length} linha(s) com o mesmo CEG+item (qualquer dono)`);
  for (const m of irm.sort((x, y) => x.id - y.id)) console.log(`     ${m.id === alvo ? '>>' : '  '} dono=${rot(m.cog)} ${fmtLinha(m)} | ${refs(m.id)}`);
}

// ───────── 3) itens de demanda e repasses que citam linha apagada, arquivada com o MESMO código de uma linha viva, mas NÃO reapontados
secao('3) demandas e repasses com a linha viva do mesmo código, NÃO reapontados (checagem extra falhou)');
const porCod = new Map(); for (const m of ml) if (n(m.id_linha)) { if (!porCod.has(n(m.id_linha))) porCod.set(n(m.id_linha), []); porCod.get(n(m.id_linha)).push(m); }
const arqPorCod = new Map(); for (const a of arq) { const c = n(a.dados?.id_linha); if (c) { if (!arqPorCod.has(c)) arqPorCod.set(c, []); arqPorCod.get(c).push(a); } }
const citacoes = new Map(); for (const d of dem) for (const id of new Set(idsEm(d.itens))) { if (!citacoes.has(id)) citacoes.set(id, []); citacoes.get(id).push(d); }
let nItens = 0; const classes = {};
for (const d of dem) {
  idsEm(d.itens).forEach((id, i) => {
    if (vivos.has(id)) return;
    const a = arqPorId.get(id); if (!a) return;
    const cod = n(a.dados?.id_linha); if (!cod) return;
    const vs = porCod.get(cod) || []; if (vs.length !== 1) return;
    const t = vs[0]; const dd = a.dados || {};
    if (n(t.cog) !== n(dd.cog) || !igual(t.ceg, dd.ceg) || !igual(t.nome_do_item, dd.nome_do_item)) return;
    const itens = Array.isArray(d.itens) ? d.itens : [];
    if (itens.some(x => String(x?.id) === String(t.id))) return;
    const outras = (citacoes.get(String(t.id)) || []).filter(x => x.id !== d.id);
    if (!outras.length) return;           // (esses foram reapontados)
    nItens++;
    const arquivadasMesmoCod = (arqPorCod.get(cod) || []).filter(x => n(x.dados?.cog) === n(dd.cog));
    const mesmaPessoa = outras.map(o => n(o.joiner_cog) === n(d.joiner_cog));
    const e0 = (Array.isArray(itens) ? itens[i] : null) || {};
    const snapValor = e0.valor_item ?? e0.valor ?? null;
    const classe = mesmaPessoa.every(Boolean) ? 'mesma pessoa em outra demanda' : 'outra pessoa cita a linha viva';
    classes[classe] = (classes[classe] || 0) + 1;
    console.log(`  demanda ${d.id} [${d.status}] item#${i}: morta #${id} (arquivada ${dd.status}, ${a.origem}, pago=${dd.pago_item ? 'I' : '-'}${dd.pago_frete ? 'F' : '-'}${dd.pago_rf ? 'R' : '-'}) -> viva #${t.id} [${cod}] ${t.status} pago=${pg(t)} | ${arquivadasMesmoCod.length} arquivada(s) e ${vs.length} viva(s) com esse código e dono | snapshot valor=${snapValor ?? '-'} vs viva=${dinheiro(t.valor_item)}`);
    outras.forEach((o, k) => console.log(`       a viva #${t.id} também é citada pela demanda ${o.id} [${o.status}] (${mesmaPessoa[k] ? 'mesma pessoa' : 'OUTRA pessoa'}; criada ${n(o.created_at).slice(0, 10)}; esta demanda criada ${n(d.created_at).slice(0, 10)}; valor_total ${dinheiro(o.valor_total)} x ${dinheiro(d.valor_total)}; cashback ${dinheiro(o.cashback_aplicado)} x ${dinheiro(d.cashback_aplicado)})`));
  });
}
console.log(`  total de itens de demanda nesta situação: ${nItens} · ${JSON.stringify(classes)}`);
let nRep = 0;
for (const r of rep) {
  const id = String(r.item_id ?? ''); if (!id || vivos.has(id)) continue;
  const a = arqPorId.get(id); if (!a) continue; const cod = n(a.dados?.id_linha); if (!cod) continue;
  const vs = porCod.get(cod) || []; if (vs.length !== 1) continue; const t = vs[0], dd = a.dados || {};
  if (!igual(t.ceg, dd.ceg) || !igual(t.nome_do_item, dd.nome_do_item)) continue;
  const motivos = []; if (n(t.cog) !== n(dd.cog)) motivos.push('o dono da linha viva é DIFERENTE do arquivado');
  const outro = rep.filter(o => o.id !== r.id && String(o.item_id) === String(t.id)); if (outro.length) motivos.push(`a viva já tem outro repasse (${outro.map(o => o.id + ':' + o.status)})`);
  if (!motivos.length) continue;
  nRep++;
  console.log(`  repasse ${r.id} [${r.status}] item_status=${n(r.item_status)} quitado=${r.item_quitado} valor=${dinheiro(r.valor_acordado)}: morta #${id} (arquivada ${dd.status}, ${a.origem}) -> viva #${t.id} [${cod}] ${t.status} pago=${pg(t)} | ${motivos.join('; ')} | dono(repasse) igual ao dono arquivado: ${n(r.joiner_cog) === n(dd.cog)}; novo dono igual ao dono da viva: ${n(r.novo_dono_cog) === n(t.cog)}`);
}
console.log(`  total de repasses nesta situação: ${nRep}`);

// ───────── 4) as 4 inserções suspeitas: as linhas do banco que colidem, com referências
secao('4) INSERÇÕES SUSPEITAS: linhas do banco que colidem (por código ou por CEG + item)');
for (const cod of ['ODDF-ITE-7882', 'MURC-MER-8016', 'SKZO-MER-8048']) {
  const porCodigo = ml.filter(m => n(m.id_linha) === cod);
  console.log(`  código ${cod}: ${porCodigo.length} linha(s) no banco${porCodigo.length ? '' : ' (nenhuma)'}${arqPorCod.has(cod) ? ` · ${arqPorCod.get(cod).length} arquivada(s)` : ''}`);
  porCodigo.forEach(m => console.log(`     ${fmtLinha(m)} | ${refs(m.id)}`));
}
for (const [ceg, item] of [['Murcekaly Itens', 'ZIP UP HOODIE — DO IT POP-UP — Zip Up Hoodie'], ['SKZOO EAAW · ONLINE', 'SKZOO Secret Keyring Toy Ver.'], ['ODD & FRESH', 'Changbin ODD&FRESH ONLINE KREAM'], ['THIS & THAT', 'Han STARRIVER FANSIGN R3']]) {
  const g = ml.filter(m => igual(m.ceg, ceg) && igual(m.nome_do_item, item));
  const rotulos = new Map(); const rot = c => { if (!rotulos.has(n(c))) rotulos.set(n(c), 'D' + (rotulos.size + 1)); return rotulos.get(n(c)); };
  console.log(`  ${ceg} | ${item}: ${g.length} linha(s) no banco`);
  g.sort((a, b) => a.id - b.id).slice(0, 25).forEach(m => console.log(`     dono=${rot(m.cog)} ${fmtLinha(m)} | ${refs(m.id)}`));
  const arqG = arq.filter(a => igual(a.dados?.ceg, ceg) && igual(a.dados?.nome_do_item, item)); if (arqG.length) console.log(`     arquivadas com o mesmo CEG+item: ${arqG.length} (ids ${arqG.slice(0, 12).map(a => a.masterlist_id).join(', ')}${arqG.length > 12 ? ', ...' : ''}; origens ${[...new Set(arqG.map(a => a.origem))].join(', ')})`);
}
console.log('\nFim (somente leitura).');
