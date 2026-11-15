// AUDITORIA SOMENTE LEITURA, parte 2: (a) esquema do banco (nomes de tabelas e colunas, SEM dados) para achar backups/históricos;
// (b) referências que apontam para linhas da masterlist que NÃO existem mais (demandas, envios, claims, multas, repasses), classificadas contra o arquivo masterlist_exclusoes.
// O log do GitHub é PÚBLICO: só contagens, ids de linha, códigos de item, CEG, nome de produto e NOMES DE COLUNAS/CHAVES. Nunca @, e-mail, nome de pessoa, CPF ou endereço. Nada é gravado.
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const sb = createClient(URL, KEY, { auth: { persistSession: false }, realtime: { transport: ws } });
const n = v => String(v ?? '').trim();
const secao = t => console.log(`\n=== ${t} ===`);
const linha = (k, v) => console.log(`${k}: ${v}`);
async function ler(tabela, colunas, ordem = 'id') {
  const out = []; let de = 0;
  for (;;) {
    let q = sb.from(tabela).select(colunas).range(de, de + 999); if (ordem) q = q.order(ordem, { ascending: true });
    const { data, error } = await q;
    if (error) { if (ordem) return ler(tabela, colunas, null); console.log(`  (sem leitura de ${tabela}: ${error.message})`); return null; }
    out.push(...data); if (data.length < 1000) break; de += 1000;
  }
  return out;
}

// (a) ESQUEMA — só nomes
secao('11 esquema (tabelas e colunas; sem dados)');
try {
  const r = await fetch(`${URL}/rest/v1/`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/openapi+json' } });
  const j = await r.json();
  const defs = j.definitions || j.components?.schemas || {};
  for (const [t, d] of Object.entries(defs).sort()) console.log(`  ${t}(${Object.keys(d.properties || {}).join(', ')})`);
} catch (e) { console.log('  esquema indisponível: ' + e.message); }

// (b) REFERÊNCIAS QUEBRADAS x ARQUIVO
const ml = await ler('masterlist', 'id, ceg, nome_do_item, cog, id_linha, pago_item, pago_frete, pago_rf');
const arq = await ler('masterlist_exclusoes', 'masterlist_id, dados, origem, excluido_em', 'masterlist_id');
const dem = await ler('pagamento_demandas', '*');
const envios = await ler('envio_solicitacoes', '*', null);
const claims = await ler('claims', '*', null);
const multas = await ler('multas_pagas', '*', null);
const repasses = await ler('repassos', '*', null);
if (!ml || !arq) { console.error('sem leitura da masterlist/arquivo'); process.exit(3); }

secao('12 formato das referências (só nomes de chaves)');
const chaves = (rows, f) => { const s = new Set(); for (const r of rows || []) for (const k of Object.keys(f(r) || {})) s.add(k); return [...s].join(', '); };
console.log(`  demanda: colunas = ${chaves(dem, r => r)}`);
console.log(`  demanda.itens[]: chaves = ${chaves((dem || []).flatMap(d => Array.isArray(d.itens) ? d.itens : []), r => r)}`);
console.log(`  envio.itens[]: chaves = ${chaves((envios || []).flatMap(d => Array.isArray(d.itens) ? d.itens : []), r => r)}`);
console.log(`  claims: colunas = ${chaves(claims, r => r)}`);
console.log(`  multas_pagas: colunas = ${chaves(multas, r => r)}`);
console.log(`  repassos: colunas = ${chaves(repasses, r => r)}`);
console.log(`  masterlist_exclusoes.dados: chaves = ${chaves(arq.slice(0, 300), r => r.dados)}`);
const origens = new Map(); for (const a of arq) origens.set(a.origem ?? '(nula)', (origens.get(a.origem ?? '(nula)') || 0) + 1);
console.log('  arquivo por origem: ' + [...origens.entries()].map(([k, v]) => `${k}=${v}`).join(' · '));

const vivos = new Map(ml.map(m => [String(m.id), m]));
const porCodigo = new Map(); for (const m of ml) if (n(m.id_linha)) { const k = n(m.id_linha); if (!porCodigo.has(k)) porCodigo.set(k, []); porCodigo.get(k).push(m); }
const arqPorId = new Map(); for (const a of arq) { const k = String(a.masterlist_id); if (!arqPorId.has(k)) arqPorId.set(k, []); arqPorId.get(k).push(a); }

// classifica um id que não existe mais
function classificar(id) {
  const as = arqPorId.get(String(id));
  if (!as) return { tipo: 'sem_arquivo' };
  const a = as.sort((x, y) => String(y.excluido_em).localeCompare(String(x.excluido_em)))[0];
  const d = a.dados || {}; const cod = n(d.id_linha);
  const base = { origem: a.origem ?? '(nula)', ceg: d.ceg, item: d.nome_do_item, cod };
  if (!cod) return { tipo: 'arquivado_sem_codigo', ...base };
  const vs = porCodigo.get(cod) || [];
  if (!vs.length) return { tipo: 'arquivado_codigo_sem_vivo', ...base };
  const mesmoDono = vs.filter(v => n(v.cog) === n(d.cog));
  if (vs.length === 1 && mesmoDono.length === 1) return { tipo: 'reapontavel', alvo: vs[0].id, ...base };
  if (vs.length > 1) return { tipo: 'codigo_repetido_no_vivo', ...base, qtd: vs.length };
  return { tipo: 'vivo_com_dono_diferente', ...base };
}
const quebradas = (rows, extrair) => { const out = []; for (const r of rows || []) for (const id of extrair(r)) if (id != null && id !== '' && !vivos.has(String(id))) out.push({ r, id: String(id) }); return out; };
const refs = {
  'demandas': quebradas(dem, d => (Array.isArray(d.itens) ? d.itens : []).map(e => e?.id)),
  'envios': quebradas(envios, d => (Array.isArray(d.itens) ? d.itens : []).map(e => e?.id)),
  'claims': quebradas(claims, c => [c.masterlist_id]),
  'multas': quebradas(multas, c => [c.masterlist_id]),
  'repasses': quebradas(repasses, c => [c.item_id]),
};
secao('13 referências para linhas que NÃO existem mais, classificadas pelo arquivo');
const cache = new Map(); const cls = id => cache.get(id) || (cache.set(id, classificar(id)), cache.get(id));
for (const [nome, lista] of Object.entries(refs)) {
  const ids = [...new Set(lista.map(x => x.id))];
  const cont = {}; for (const id of ids) cont[cls(id).tipo] = (cont[cls(id).tipo] || 0) + 1;
  const orig = {}; for (const id of ids) { const c = cls(id); if (c.origem) orig[c.origem] = (orig[c.origem] || 0) + 1; }
  console.log(`  ${nome}: ${lista.length} referência(s) a ${ids.length} id(s) inexistente(s) | por tipo: ${JSON.stringify(cont)} | origem do arquivo: ${JSON.stringify(orig)}`);
}
// claims: o que mais importa (reserva do cliente). status e estado da linha arquivada
const st = {}; for (const { r } of refs.claims) st[r.status ?? '(nulo)'] = (st[r.status ?? '(nulo)'] || 0) + 1;
linha('  claims quebradas por status', JSON.stringify(st));
secao('14 claims quebradas — uma a uma (id da linha | tipo | origem | código | CEG | item | alvo vivo)');
const vistos = new Set();
for (const { r, id } of refs.claims) { if (vistos.has(id)) continue; vistos.add(id); const c = cls(id); console.log(`  ${id} | ${c.tipo} | ${c.origem || '-'} | ${c.cod || '-'} | ${c.ceg || '-'} | ${c.item || '-'} | ${c.alvo ?? '-'}${c.qtd ? ' (' + c.qtd + ' vivos)' : ''} | status=${r.status ?? '-'}`); }
secao('15 demandas quebradas — por demanda (id | itens quebrados | tipos | status da demanda)');
const porDem = new Map(); for (const { r, id } of refs.demandas) { if (!porDem.has(r.id)) porDem.set(r.id, { r, ids: [] }); porDem.get(r.id).ids.push(id); }
const stDem = {}; for (const { r } of porDem.values()) stDem[r.status ?? '(sem coluna status)'] = (stDem[r.status ?? '(sem coluna status)'] || 0) + 1;
linha('  demandas com item quebrado', porDem.size); linha('  por status da demanda', JSON.stringify(stDem));
for (const [id, { r, ids }] of [...porDem.entries()].slice(0, 40)) { const t = {}; for (const i of ids) t[cls(i).tipo] = (t[cls(i).tipo] || 0) + 1; console.log(`  demanda ${id} | ${ids.length} quebrado(s) de ${Array.isArray(r.itens) ? r.itens.length : '?'} | ${JSON.stringify(t)} | status=${r.status ?? '-'}`); }
if (porDem.size > 40) console.log(`  ... e mais ${porDem.size - 40}`);
console.log('\nFim da auditoria 2. Nada foi gravado.');
