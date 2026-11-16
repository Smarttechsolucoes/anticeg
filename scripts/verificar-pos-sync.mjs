// VERIFICAÇÃO POSTERIOR A UM SYNC — SOMENTE LEITURA (SELECTs, leitura da API admin de usuários só para comparar e-mail e a leitura pública do CSV). Não grava NADA.
// Contexto: em 16/11/2026 às 17:59 UTC o "Sync Masterlist" rodou de verdade com o código SEM as proteções do modo controlado. Aqui se confere o que mudou e o que é evidência financeira.
// O log do GitHub é PÚBLICO: só ids, códigos, CEG, item, marcas (h:xxxxxxxx = hash curto do @/cog em minúsculas), contagens e sim/não. Nunca @, e-mail, nome, CPF ou endereço.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import ws from 'ws';
import { indexarJoiners, resolverLinha } from './resolver-joiner.js';
import { carregarArrobasAntigos } from './arrobas-antigos.js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } });
const JANELA = process.env.JANELA_INICIO || '2026-11-16T17:59:00Z';
const n = v => String(v ?? '').trim();
const lc = v => n(v).toLowerCase().replace(/\s+/g, ' ');
const anon = v => v == null || n(v) === '' ? '(sem)' : 'h:' + createHash('sha256').update(n(v).toLowerCase().replace(/^@/, '')).digest('hex').slice(0, 8);
const secao = t => console.log(`\n=== ${t} ===`);
const dia = v => n(v).slice(0, 16);
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
const idsEm = itens => (Array.isArray(itens) ? itens : []).map(e => (e && typeof e === 'object') ? String(e.id ?? e.item_id ?? e.masterlist_id ?? '') : String(e ?? '')).filter(Boolean);

// ── planilha atual (fonte oficial)
const EMAIL_VALIDO = /^[^\s@#]+@[^\s@]+\.[^\s@]+$/;
const emailLimpo = v => { const e = lc(v); return EMAIL_VALIDO.test(e) ? e : ''; };
const norm = s => String(s).replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
const res = await fetch('https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995'); if (!res.ok) throw new Error(`CSV: ${res.status}`);
const linhasCsv = (await res.text()).replace(/^﻿/, '').split('\n'); const hIdx = linhasCsv.findIndex(l => l.includes('ABA'));
const records = parse(linhasCsv.slice(hIdx).join('\n'), { columns: true, skip_empty_lines: true });
const colMap = {}; Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
const col = (r, ...nomes) => { for (const nm of nomes) { const k = colMap[norm(nm)]; if (k !== undefined) return r[k] ?? ''; } return ''; };
const rows = records.filter(r => n(col(r, 'ABA / CEG', 'CEG')) && n(col(r, 'NOME DO ITEM')));

const ml = await ler('masterlist', '*');
const joiners = await ler('joiners', '*');
const idx = indexarJoiners(joiners, await carregarArrobasAntigos(sb, joiners));
const S = rows.map(r => { const rs = resolverLinha({ twitter: n(col(r, '@')), email: emailLimpo(col(r, 'EMAIL')) }, idx); return { cod: n(col(r, 'ID')), ceg: n(col(r, 'ABA / CEG', 'CEG')), item: n(col(r, 'NOME DO ITEM')), dono: lc(rs.cog), pago: lc(col(r, 'ITEM')) === 'true', chegou: lc(col(r, 'Chegou?')) === 'true', nacional: lc(col(r, 'NACIONAL')) === 'true', frete: lc(col(r, 'FRETE')) === 'true', rf: lc(col(r, 'RF')) === 'true' }; });
const sPorCod = new Map(S.filter(s => s.cod).map(s => [s.cod, s]));
const arq = await ler('masterlist_exclusoes', 'masterlist_id, origem, excluido_em', 'masterlist_id');
const dem = await ler('pagamento_demandas', 'id, joiner_cog, itens, valor_total, status, created_at');
const rep = await ler('repassos', 'id, created_at, joiner_cog, novo_dono_cog, item_id, status, item_quitado, valor_acordado');
const multas = await ler('multas_pagas', 'id, masterlist_id, campo, valor_multa, created_at');
const envios = await ler('envio_solicitacoes', 'id, itens, status');
const claims = await ler('claims', 'id, masterlist_id, status');
const por = new Map(ml.map(m => [m.id, m]));
console.log(`VERIFICAÇÃO PÓS-SYNC (somente leitura) — ${new Date().toISOString()} — janela do sync indevido a partir de ${JANELA} — masterlist ${ml.length} · joiners ${joiners.length} · planilha ${S.length}`);
const colunasMl = Object.keys(ml[0] || {}); const colunasJo = Object.keys(joiners[0] || {});
console.log(`colunas da masterlist com data: ${colunasMl.filter(c => /_at$|data|atualiz/i.test(c)).join(', ') || '(nenhuma)'} · colunas dos joiners com data: ${colunasJo.filter(c => /_at$|atualiz/i.test(c)).join(', ') || '(nenhuma)'}`);
const evidencias = id => {
  const k = String(id), p = [];
  const d = dem.filter(x => idsEm(x.itens).includes(k)).map(x => `${x.id}:${x.status}:${dia(x.created_at)}`); if (d.length) p.push(`demandas[${d}]`);
  const r = rep.filter(x => String(x.item_id) === k).map(x => `${String(x.id).slice(0, 8)}:${x.status}:quitado=${x.item_quitado}`); if (r.length) p.push(`repasses[${r}]`);
  const mu = multas.filter(x => String(x.masterlist_id) === k).map(x => `${x.campo}:${Number(x.valor_multa).toFixed(2)}`); if (mu.length) p.push(`multas[${mu}]`);
  const e = envios.filter(x => idsEm(x.itens).includes(k)).map(x => `${x.id}:${x.status}`); if (e.length) p.push(`envios[${e}]`);
  const c = claims.filter(x => String(x.masterlist_id) === k).length; if (c) p.push(`claims=${c}`);
  return p.length ? p.join(' ') : 'sem referências';
};
const flags = m => `${m.pago_item ? 'I' : '-'}${m.pago_frete ? 'F' : '-'}${m.pago_rf ? 'R' : '-'}`;

secao('0) o que a masterlist registra de mudança na janela');
const datadas = colunasMl.filter(c => /^(updated_at|atualizado_em|modificado_em)$/i.test(c));
if (datadas.length) { const c = datadas[0]; const mud = ml.filter(m => n(m[c]) >= JANELA.slice(0, 19)); console.log(`  linhas com ${c} >= janela: ${mud.length}`); } else console.log('  a masterlist não tem coluna de data de atualização: o que mudou só se reconstrói pelos logs e pela evidência.');
const novas = [...ml].sort((x, y) => y.id - x.id).slice(0, 157);   // as 157 linhas de maior id = as inserções do sync de hoje (o ensaio previa 157)
console.log(`  as 157 linhas de maior id vão de #${novas[novas.length - 1]?.id} a #${novas[0]?.id}`);

secao('1) os 17 pagamentos que a planilha desmarcaria: estado hoje x evidência financeira x planilha atual');
const PAGOS = [5340, 7125, 5436, 18285, 5084, 5085, 18445, 8838, 8839, 8840, 8841, 8842, 8833, 8834, 8835, 8836, 8837];
for (const id of PAGOS) {
  const m = por.get(id); if (!m) { console.log(`  #${id}: não existe`); continue; }
  const s = sPorCod.get(n(m.id_linha));
  console.log(`  #${id} [${n(m.id_linha)}] ${n(m.ceg)} | ${n(m.nome_do_item)} | banco pago=${flags(m)} | planilha: ${s ? `ITEM=${s.pago ? 'TRUE' : 'FALSE'} (dono da planilha ${s.dono === lc(m.cog) ? 'IGUAL' : 'DIFERENTE'} do banco)` : 'sem linha com esse código'} | ${evidencias(id)}`);
}

secao('2) donos de #9222 e #7232 (antes -> o que a planilha trazia)');
for (const [id, antes, planilha] of [[9222, 'd5525f6c', 'c1c7b373'], [7232, '79651e7e', 'acbb5aeb']]) {
  const m = por.get(id); const hoje = m ? anon(m.cog).slice(2) : null; const s = m ? sPorCod.get(n(m.id_linha)) : null;
  console.log(`  #${id} [${n(m?.id_linha) || '-'}] ${n(m?.ceg)} | ${n(m?.nome_do_item)} | dono hoje ${m ? anon(m.cog) : 'não existe'} (antes h:${antes}: ${hoje === antes ? 'IGUAL' : 'DIFERENTE'}; planilha h:${planilha}: ${hoje === planilha ? 'IGUAL' : 'diferente'}) | pago=${m ? flags(m) : '-'} | ${m ? evidencias(id) : ''}`);
  if (m) {
    const donos = [antes, planilha].map(h => joiners.find(j => anon(j.cog).slice(2) === h));
    const demandasDe = dem.filter(x => idsEm(x.itens).includes(String(id))).map(x => `${x.id}(pagadora ${anon(x.joiner_cog)})`);
    console.log(`     cadastros: antes ${donos[0] ? 'existe' : 'não existe'} · planilha ${donos[1] ? 'existe' : 'não existe'} · demandas que citam a linha e sua pagadora: ${demandasDe.join(', ') || 'nenhuma'}`);
    console.log(`     código ${n(m.id_linha)}: linhas com esse código no banco ${ml.filter(x => n(x.id_linha) === n(m.id_linha)).length} · linhas da planilha com esse código ${S.filter(x => x.cod === n(m.id_linha)).length}`);
  }
}

secao('3) status de #2829, #338 e #369');
for (const id of [2829, 338, 369]) {
  const m = por.get(id); if (!m) { console.log(`  #${id}: não existe`); continue; }
  const s = sPorCod.get(n(m.id_linha));
  console.log(`  #${id} [${n(m.id_linha)}] ${n(m.ceg)} | ${n(m.nome_do_item)} | status hoje: ${m.status} | pago=${flags(m)} | planilha: ${s ? `ITEM=${s.pago} Chegou?=${s.chegou} NACIONAL=${s.nacional} FRETE=${s.frete} RF=${s.rf}` : 'sem linha com esse código'} | ${evidencias(id)}`);
}

secao('4) casos pendentes: estado atual (devem estar como antes do sync)');
for (const id of [18287, 18416, 18417, 18410, 18342, 18381, 18029, 18056, 18063, 18033, 18068, 9092, 9622, 9300, 18303, 18018, 18015]) { const m = por.get(id); console.log(`  #${id} [${n(m?.id_linha) || '-'}] ${m ? `${n(m.ceg)} | ${n(m.nome_do_item)} | dono ${anon(m.cog)} | pago=${flags(m)} | ${m.status}` : 'não existe'}`); }

secao('5) as 6 duplicatas arquivadas e a MURC-MER-8016');
for (const id of [17808, 17815, 17816, 17859, 18337, 18338]) console.log(`  #${id}: ${por.has(id) ? 'DE NOVO na masterlist' : 'fora da masterlist'} · no arquivo: ${arq.some(a => a.masterlist_id === id) ? 'sim' : 'NÃO'}`);
for (const cod of ['MURC-ITE-7425', 'MURC-MER-7432', 'MURC-MER-7433', 'MURC-MER-7476']) console.log(`  linhas com o código ${cod}: ${ml.filter(m => n(m.id_linha) === cod).map(m => `#${m.id}(${anon(m.cog)})`).join(', ') || 'nenhuma'}`);
const m8016 = ml.filter(m => n(m.id_linha) === 'MURC-MER-8016');
console.log(`  MURC-MER-8016: ${m8016.length} linha(s) ${m8016.map(m => `#${m.id} dono ${anon(m.cog)} pago=${flags(m)}`).join(', ')}`);
for (const cod of ['DICO-ITE-7799', 'DICO-ITE-7888', 'DICO-ITE-7889', 'ODDF-ITE-7882', 'SKZO-MER-8048', 'SKZO-MER-6927', 'SKZO-MER-8084']) console.log(`  ${cod}: ${ml.filter(m => n(m.id_linha) === cod).map(m => `#${m.id} dono ${anon(m.cog)}`).join(', ') || 'não existe no banco'}`);
const cont = new Map(); for (const m of ml) if (n(m.id_linha)) cont.set(n(m.id_linha), (cont.get(n(m.id_linha)) || 0) + 1);
const rep2 = novas.filter(m => n(m.id_linha) && cont.get(n(m.id_linha)) > 1);
console.log(`  das ${novas.length} linhas novas, com código repetido no banco: ${rep2.length}${rep2.length ? ' (' + rep2.slice(0, 20).map(m => `#${m.id} ${m.id_linha}`).join(', ') + ')' : ''}`);

secao('6) cadastros (joiners) e contas: alterações indevidas de e-mail ou vínculo?');
const contas = await ler('contas_joiner', '*', null);
console.log(`  colunas de contas_joiner: ${Object.keys(contas[0] || {}).join(', ') || '(vazia/sem leitura)'} · contas: ${contas.length}`);
const comConta = new Set(contas.map(c => c.joiner_id));
const colUid = Object.keys(contas[0] || {}).find(c => /user_id|auth_id|uid/i.test(c));
let usuarios = new Map();
if (colUid) {
  for (let pagina = 1; pagina < 40; pagina++) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) usuarios.set(u.id, u);
    if (data.users.length < 1000) break;
  }
  console.log(`  usuários do Auth lidos: ${usuarios.size}`);
}
let dif = 0, semUsuario = 0, igual = 0; const difIds = [];
for (const c of contas) {
  const j = joiners.find(x => x.id === c.joiner_id); const u = colUid ? usuarios.get(c[colUid]) : null;
  if (!j || !u) { semUsuario++; continue; }
  if (lc(j.email) === lc(u.email)) igual++; else { dif++; difIds.push(j.id); }
}
console.log(`  contas com e-mail do cadastro IGUAL ao do Auth: ${igual} · DIFERENTE: ${dif}${dif ? ' (cadastros ' + difIds.slice(0, 40).join(', ') + ')' : ''} · sem conferência: ${semUsuario}`);
const jan = JANELA.slice(0, 19);
const aud = await ler('contas_auditoria', '*', 'id');
const colData = Object.keys(aud[0] || {}).find(c => /created_at|criado_em|quando|em$/i.test(c));
if (colData) {
  const recentes = aud.filter(a => n(a[colData]) >= jan);
  const porAcao = {}; for (const a of recentes) porAcao[a.acao] = (porAcao[a.acao] || 0) + 1;
  console.log(`  registros de contas_auditoria desde a janela: ${recentes.length} ${JSON.stringify(porAcao)}`);
  const trocas = aud.filter(a => ['trocar_email', 'troca_email_verificada'].includes(a.acao)); const idsTroca = new Set(trocas.map(a => a.joiner_id));
  console.log(`  cadastros com e-mail trocado (protegidos): ${idsTroca.size}`);
} else console.log('  contas_auditoria sem coluna de data identificável');
const jDatados = colunasJo.find(c => /^(updated_at|atualizado_em)$/i.test(c));
if (jDatados) { const mud = joiners.filter(j => n(j[jDatados]) >= jan); const comC = mud.filter(j => comConta.has(j.id)); console.log(`  cadastros atualizados na janela (${jDatados}): ${mud.length} · dos quais com conta ativada: ${comC.length}`); }
else console.log('  os joiners não têm coluna de atualização: a alteração só se verifica por regra (contas = e-mail do Auth).');
const semEmail = joiners.filter(j => !n(j.email)).length, arrobaVazio = joiners.filter(j => !n(j.twitter)).length;
console.log(`  cadastros sem e-mail hoje: ${semEmail} · sem @: ${arrobaVazio} · com e-mail que não parece e-mail: ${joiners.filter(j => n(j.email) && !EMAIL_VALIDO.test(lc(j.email))).length}`);
console.log('\nFim (somente leitura).');
