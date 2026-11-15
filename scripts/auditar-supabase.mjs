// AUDITORIA SOMENTE LEITURA do Supabase (masterlist e tabelas ligadas). Não grava NADA: só SELECT.
// O log do GitHub deste repositório é PÚBLICO: o script imprime apenas contagens, ids de linha, códigos de item (ID da planilha), CEG e nome do PRODUTO.
// NUNCA imprime @, e-mail, nome de pessoa, CPF ou endereço. A leitura usa a SUPABASE_SERVICE_KEY já configurada como segredo do repositório (não é exibida).
// Uso (só pelo workflow manual "Auditoria Supabase"): node scripts/auditar-supabase.mjs
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } });

const indisponiveis = [];
async function ler(tabela, colunas, ordem = 'id') {
  const out = []; let de = 0;
  for (;;) {
    let q = sb.from(tabela).select(colunas).range(de, de + 999);
    if (ordem) q = q.order(ordem, { ascending: true });
    const { data, error } = await q;
    if (error) {
      if (ordem) return ler(tabela, colunas, null);          // tabela sem a coluna de ordem: tenta sem ordenar
      indisponiveis.push(`${tabela}: ${error.message}`); return null;
    }
    out.push(...data); if (data.length < 1000) break; de += 1000;
  }
  return out;
}
const n = v => String(v ?? '').trim();
const dono = v => n(v).toLowerCase();
const secao = t => console.log(`\n=== ${t} ===`);
const linha = (k, v) => console.log(`${k}: ${v}`);

const ml = await ler('masterlist', 'id, ceg, nome_do_item, nome, cog, id_linha, status, pago_item, pago_frete, pago_rf, valor_item, frete_inter, taxa_rf, na_loja');
const jo = await ler('joiners', 'id, cog, email');
const contas = await ler('contas_joiner', 'joiner_id', 'joiner_id');
const dem = await ler('pagamento_demandas', 'id, itens');
const claims = await ler('claims', 'masterlist_id, status', 'masterlist_id');
const multas = await ler('multas_pagas', 'masterlist_id', 'masterlist_id');
const repasses = await ler('repassos', 'item_id', 'item_id');
const envios = await ler('envio_solicitacoes', 'itens');
const { count: nExcl } = await sb.from('masterlist_exclusoes').select('*', { count: 'exact', head: true });
if (!ml || !jo) { console.error('Sem leitura da masterlist/joiners: nada a auditar.', indisponiveis); process.exit(3); }

// ids citados em itens (jsonb) de demandas / envios
const idsDe = (rows, extrair) => { const m = new Map(); for (const r of rows || []) for (const e of (Array.isArray(r.itens) ? r.itens : [])) { const id = String(e?.id ?? ''); if (id) { if (!m.has(id)) m.set(id, new Set()); m.get(id).add(extrair(r)); } } return m; };
const nDem = idsDe(dem, r => r.id), nEnv = idsDe(envios, () => 'e');
const cntPor = (rows, campo) => { const m = new Map(); for (const r of rows || []) { const k = String(r[campo] ?? ''); if (k) m.set(k, (m.get(k) || 0) + 1); } return m; };
const nClaim = cntPor(claims, 'masterlist_id'), nMulta = cntPor(multas, 'masterlist_id'), nRep = cntPor(repasses, 'item_id');
const refs = id => ({ dem: nDem.get(String(id))?.size || 0, env: nEnv.get(String(id))?.size || 0, claim: nClaim.get(String(id)) || 0, multa: nMulta.get(String(id)) || 0, rep: nRep.get(String(id)) || 0 });
const temRef = r => r.dem + r.env + r.claim + r.multa + r.rep > 0;
const pago = m => !!(m.pago_item || m.pago_frete || m.pago_rf);
const fmtRef = r => `dem=${r.dem} env=${r.env} claim=${r.claim} multa=${r.multa} rep=${r.rep}`;
const porId = new Map(ml.map(m => [String(m.id), m]));

console.log(`AUDITORIA SOMENTE LEITURA — ${new Date().toISOString()} — nada é gravado.`);
if (indisponiveis.length) { secao('tabelas sem leitura'); indisponiveis.forEach(x => console.log('  ' + x)); }

secao('01 totais');
const comCod = ml.filter(m => n(m.id_linha)), semCod = ml.filter(m => !n(m.id_linha));
linha('linhas na masterlist', ml.length); linha('com código (id_linha)', comCod.length); linha('sem código', semCod.length);
linha('códigos distintos', new Set(comCod.map(m => n(m.id_linha))).size); linha('cadastros (joiners)', jo.length);
linha('contas ativadas (contas_joiner)', contas?.length ?? 'sem leitura'); linha('arquivadas em masterlist_exclusoes', nExcl ?? 'sem leitura');
linha('demandas de pagamento', dem?.length ?? 'sem leitura'); linha('claims', claims?.length ?? 'sem leitura'); linha('repasses', repasses?.length ?? 'sem leitura'); linha('solicitações de envio', envios?.length ?? 'sem leitura');

secao('02 códigos repetidos no banco');
const porCod = new Map(); for (const m of comCod) { const k = n(m.id_linha); if (!porCod.has(k)) porCod.set(k, []); porCod.get(k).push(m); }
const rep = [...porCod.entries()].filter(([, v]) => v.length > 1);
linha('códigos que aparecem em mais de uma linha', rep.length); linha('linhas envolvidas', rep.reduce((a, [, v]) => a + v.length, 0));
rep.sort((a, b) => b[1].length - a[1].length).slice(0, 15).forEach(([k, v]) => console.log(`  ${k}: ${v.length} linhas (ids ${v.slice(0, 8).map(x => x.id).join(', ')}${v.length > 8 ? ', ...' : ''})`));

secao('03 linhas SEM código e a irmã COM código (mesmo CEG, item e dono)');
const idxIrma = new Map();
for (const m of comCod) { const k = `${n(m.ceg)}|${n(m.nome_do_item)}|${dono(m.cog)}`; if (!idxIrma.has(k)) idxIrma.set(k, []); idxIrma.get(k).push(m); }
const pares = [], orfas = [];
for (const m of semCod) {
  const k = `${n(m.ceg)}|${n(m.nome_do_item)}|${dono(m.cog)}`;
  const irmas = idxIrma.get(k) || [];
  if (irmas.length) pares.push({ m, irmas, exato: irmas.some(i => n(i.cog) === n(m.cog)) }); else orfas.push(m);
}
linha('sem código COM irmã com código', pares.length); linha('sem código SEM irmã (linhas legítimas ainda sem código)', orfas.length);
const porCeg = new Map(); for (const p of pares) porCeg.set(p.m.ceg, (porCeg.get(p.m.ceg) || 0) + 1);
[...porCeg.entries()].forEach(([c, q]) => console.log(`  CEG ${c}: ${q}`));

// classificação de cada par (a linha SEM código é a antiga; a irmã com código é a que a planilha reconhece hoje)
const ARQUIVAVEL = [], REAPONTAR = [], REVISAR = [];
for (const p of pares) {
  const rc = refs(p.m.id), pc = pago(p.m), loja = !!p.m.na_loja;
  const unicaIrma = p.irmas.length === 1;
  const k = `${n(p.m.ceg)}|${n(p.m.nome_do_item)}|${dono(p.m.cog)}`;
  const quantasSemCod = semCod.filter(x => `${n(x.ceg)}|${n(x.nome_do_item)}|${dono(x.cog)}` === k).length;
  const equilibrado = quantasSemCod <= p.irmas.length;                          // o dono não ficaria com menos linhas do que tem hoje
  const info = { id: p.m.id, irma: p.irmas.map(i => i.id).join('+'), codigo: p.irmas.map(i => n(i.id_linha)).join('+'), ceg: p.m.ceg, item: p.m.nome_do_item, pago: pc, loja, ref: fmtRef(rc), exato: p.exato, irmaPaga: p.irmas.some(pago), irmaRef: p.irmas.map(i => fmtRef(refs(i.id))).join(' / ') };
  if (!pc && !loja && !temRef(rc) && p.exato && unicaIrma && equilibrado) ARQUIVAVEL.push(info);
  else if (!pc && !loja && p.exato && unicaIrma && equilibrado && !temRef(refs(p.irmas[0].id)) && (rc.dem + rc.claim + rc.multa + rc.rep + rc.env) > 0) REAPONTAR.push(info);
  else REVISAR.push(info);
}
secao('04 classificação dos pares');
linha('ARQUIVÁVEIS (sem pagamento, sem referência, loja=não, irmã única com o mesmo dono exato)', ARQUIVAVEL.length);
linha('REAPONTÁVEIS (sem pagamento, referências só na antiga, irmã única e limpa)', REAPONTAR.length);
linha('PARA REVISÃO (pagamento, claim, repasse, loja, dono que difere em maiúsculas ou mais de uma irmã)', REVISAR.length);
const imprimir = (tit, arr, max = 80) => { console.log(`  -- ${tit}`); arr.slice(0, max).forEach(x => console.log(`  ${x.id} -> ${x.irma} [${x.codigo}] | ${x.ceg} | ${x.item} | pago=${x.pago} loja=${x.loja} ${x.ref} | irma: paga=${x.irmaPaga} ${x.irmaRef} | dono exato=${x.exato}`)); if (arr.length > max) console.log(`  ... e mais ${arr.length - max}`); };
imprimir('arquiváveis', ARQUIVAVEL, 100); imprimir('reapontáveis', REAPONTAR); imprimir('para revisão', REVISAR);

secao('05 linhas citadas e seus donos (casos nomeados)');
for (const id of [18342, 18381, 18337, 18338]) {
  const m = porId.get(String(id));
  if (!m) { console.log(`  ${id}: NÃO existe`); continue; }
  console.log(`  ${id}: ceg=${m.ceg} | item=${m.nome_do_item} | código=${n(m.id_linha) || '(sem)'} | pago=${pago(m)} loja=${!!m.na_loja} ${fmtRef(refs(m.id))}`);
}
const dd = (a, b) => { const x = porId.get(String(a)), y = porId.get(String(b)); return x && y ? (n(x.cog) === n(y.cog) ? 'mesmo dono (exato)' : dono(x.cog) === dono(y.cog) ? 'mesmo dono (só difere em maiúsculas)' : 'donos DIFERENTES') : 'n/d'; };
console.log(`  18342 x 18381: ${dd(18342, 18381)} · 18337 x 18338: ${dd(18337, 18338)}`);
const sem = [18337, 18338].map(id => porId.get(String(id))).filter(Boolean);
for (const m of sem) { const irm = ml.filter(x => x.id !== m.id && n(x.ceg) === n(m.ceg) && n(x.nome_do_item) === n(m.nome_do_item)); console.log(`  ${m.id}: mesma CEG+item em ${irm.length} outra(s) linha(s): ${irm.slice(0, 6).map(x => `${x.id}[${n(x.id_linha) || 'sem'}] ${n(x.cog) === n(m.cog) ? 'mesmo dono exato' : dono(x.cog) === dono(m.cog) ? 'mesmo dono (maiúsculas)' : 'dono diferente'}`).join('; ')}`); }

secao('06 e-mail dos cadastros (só contagens)');
const EMAIL = /^[^\s@#]+@[^\s@]+\.[^\s@]+$/;
const comConta = new Set((contas || []).map(c => String(c.joiner_id)));
const jHash = jo.filter(j => n(j.email).startsWith('#')), jInv = jo.filter(j => n(j.email) && !EMAIL.test(n(j.email)));
linha('cadastros com e-mail começando por # (erro de fórmula)', jHash.length);
linha('  dos quais SEM conta ativada (limpáveis)', jHash.filter(j => !comConta.has(String(j.id))).length);
linha('  dos quais COM conta ativada (não tocar)', jHash.filter(j => comConta.has(String(j.id))).length);
console.log(`  ids dos cadastros com "#": ${jHash.map(j => `${j.id}${comConta.has(String(j.id)) ? '(conta)' : ''}=${/^#[A-Za-z/!?0-9]{1,12}$/.test(n(j.email)) ? n(j.email) : '#?'}`).join(', ')}`);
linha('cadastros com e-mail que NÃO parece e-mail (inclui os com #)', jInv.length);
linha('cadastros SEM e-mail', jo.filter(j => !n(j.email)).length);
const emails = new Map(); for (const j of jo) if (n(j.email)) { const k = dono(j.email); emails.set(k, (emails.get(k) || 0) + 1); }
linha('e-mails usados por mais de um cadastro', [...emails.values()].filter(v => v > 1).length);

secao('07 cadastros gêmeos (@ repetido ignorando maiúsculas e espaços)');
const gem = new Map(); for (const j of jo) { const k = dono(j.cog); gem.set(k, (gem.get(k) || 0) + 1); }
linha('@ repetidos', [...gem.values()].filter(v => v > 1).length);

secao('08 referências quebradas');
const quebrDem = [...nDem.keys()].filter(id => !porId.has(id)), quebrEnv = [...nEnv.keys()].filter(id => !porId.has(id));
linha('ids citados em demanda que NÃO existem na masterlist', quebrDem.length); if (quebrDem.length) console.log(`  ids: ${quebrDem.slice(0, 40).join(', ')}`);
linha('ids citados em solicitação de envio que NÃO existem', quebrEnv.length); if (quebrEnv.length) console.log(`  ids: ${quebrEnv.slice(0, 40).join(', ')}`);
linha('claims apontando para linha inexistente', (claims || []).filter(c => c.masterlist_id != null && !porId.has(String(c.masterlist_id))).length);
linha('multas apontando para linha inexistente', (multas || []).filter(c => c.masterlist_id != null && !porId.has(String(c.masterlist_id))).length);
linha('repasses apontando para linha inexistente', (repasses || []).filter(c => c.item_id != null && !porId.has(String(c.item_id))).length);

secao('09 donos');
const cadastros = new Set(jo.map(j => n(j.cog)));
linha('linhas cujo dono (@) não tem cadastro em joiners', ml.filter(m => n(m.cog) && dono(m.cog) !== 'disponivel' && !cadastros.has(n(m.cog))).length);
linha('linhas SEM dono', ml.filter(m => !n(m.cog)).length);

secao('10 valores');
const neg = ml.filter(m => m.valor_item < 0 || m.frete_inter < 0 || m.taxa_rf < 0);
linha('linhas com valor negativo', neg.length);
neg.slice(0, 20).forEach(m => console.log(`  ${m.id} | ${n(m.id_linha) || '-'} | ${m.ceg} | ${m.nome_do_item} | item=${m.valor_item} frete=${m.frete_inter} rf=${m.taxa_rf} | pago=${pago(m)} ${fmtRef(refs(m.id))}`));
linha('linhas com valor nulo', ml.filter(m => m.valor_item == null || m.frete_inter == null || m.taxa_rf == null).length);
linha('linhas cujo nome é erro de fórmula (#N/A...)', ml.filter(m => n(m.nome).startsWith('#')).length);
const st = new Map(); for (const m of ml) st.set(m.status ?? '(nulo)', (st.get(m.status ?? '(nulo)') || 0) + 1);
[...st.entries()].forEach(([s, q]) => console.log(`  status ${s}: ${q}`));
linha('linhas na_loja (criadas pelo site)', ml.filter(m => m.na_loja).length);

console.log('\nFim da auditoria. Nada foi gravado.');
