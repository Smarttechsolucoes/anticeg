// CORREÇÕES PONTUAIS no Supabase, com ENSAIO por padrão. Só grava com APLICAR=1. Cada ação confere o estado ATUAL imediatamente antes de gravar e só mexe nos casos inequívocos; o resto fica como está, com o motivo.
// O log do GitHub é PÚBLICO: só contagens, ids de linha/cadastro/demanda, códigos de item, CEG e nomes de produto. Nunca @, e-mail, nome de pessoa, CPF ou endereço.
// ACAO = email | demandas | todas.   APLICAR = 1 grava.   (Nada é apagado por este script.)
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const ACAO = process.env.ACAO || 'todas', APLICAR = process.env.APLICAR === '1';
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY.'); process.exit(2); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } });
const n = v => String(v ?? '').trim();
const igual = (a, b) => n(a).toLowerCase() === n(b).toLowerCase();
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
console.log(`CORREÇÕES — ação=${ACAO} — ${APLICAR ? 'APLICANDO' : 'ENSAIO (nada é gravado)'} — ${new Date().toISOString()}`);
let falhas = 0;

// ───────────────────────── 1) E-MAIL "#..." (erro de fórmula da planilha) ─────────────────────────
async function corrigirEmail() {
  secao('A) e-mails com erro de fórmula (#N/A...)');
  const EMAIL = /^[^\s@#]+@[^\s@]+\.[^\s@]+$/;
  const jo = await ler('joiners', 'id, cog, email'), contas = await ler('contas_joiner', 'joiner_id', 'joiner_id');
  const bkp = await ler('bkp_unir_joiners', 'id, cog, email'), hist = await ler('joiner_perfil_historico', 'id, joiner_id, campo, valor_antigo, valor_novo, em');
  if (!jo || !contas) return;
  const comConta = new Set(contas.map(c => String(c.joiner_id)));
  const alvo = jo.filter(j => /^#[^@\s]{1,12}$/.test(n(j.email)) && !comConta.has(String(j.id)));
  linha('cadastros com e-mail "#..." e SEM conta ativada', alvo.length);
  linha('cadastros com e-mail "#..." COM conta (não tocados)', jo.filter(j => n(j.email).startsWith('#') && comConta.has(String(j.id))).length);
  if (alvo.length > 100) { console.log('  ABORTADO: mais de 100 alvos (esperado ~28).'); falhas++; return; }
  const emUso = new Map(); for (const j of jo) if (EMAIL.test(n(j.email))) emUso.set(n(j.email).toLowerCase(), (emUso.get(n(j.email).toLowerCase()) || 0) + 1);
  const plano = [];
  for (const j of alvo) {
    const fontes = [];
    for (const b of (bkp || []).filter(b => String(b.id) === String(j.id) && igual(b.cog, j.cog) && EMAIL.test(n(b.email)))) fontes.push({ de: 'bkp_unir_joiners', email: n(b.email).toLowerCase() });
    for (const h of (hist || []).filter(h => String(h.joiner_id) === String(j.id) && /e-?mail/i.test(n(h.campo)) && EMAIL.test(n(h.valor_antigo)))) fontes.push({ de: 'joiner_perfil_historico', email: n(h.valor_antigo).toLowerCase() });
    const distintos = [...new Set(fontes.map(f => f.email))];
    let acao = 'limpar', motivo = 'sem fonte autorizada com e-mail válido', novo = null, de = null;
    if (distintos.length === 1) {
      if (emUso.get(distintos[0])) { motivo = 'o e-mail do backup já é usado por OUTRO cadastro (não restaurado)'; }
      else { acao = 'restaurar'; novo = distintos[0]; de = [...new Set(fontes.map(f => f.de))].join('+'); motivo = 'e-mail válido único no backup do MESMO cadastro (id e @ iguais)'; }
    } else if (distintos.length > 1) motivo = 'fontes com e-mails diferentes (ambíguo): só limpa o valor inválido';
    plano.push({ j, acao, novo, de, motivo });
  }
  const cont = {}; plano.forEach(p => cont[p.acao] = (cont[p.acao] || 0) + 1);
  linha('plano', JSON.stringify(cont));
  plano.forEach(p => console.log(`  cadastro ${p.j.id} (valor atual ${n(p.j.email)}) -> ${p.acao}${p.de ? ' [' + p.de + ']' : ''} | ${p.motivo}`));
  if (!APLICAR) return;
  let feitos = 0;
  for (const p of plano) {
    // reconfere o estado ATUAL antes de gravar: ainda "#...", ainda sem conta
    const { data: atual } = await sb.from('joiners').select('id, email').eq('id', p.j.id).maybeSingle();
    const { data: conta } = await sb.from('contas_joiner').select('joiner_id').eq('joiner_id', p.j.id).limit(1);
    if (!atual || n(atual.email) !== n(p.j.email) || (conta || []).length) { console.log(`  cadastro ${p.j.id}: mudou desde a análise — PULADO`); continue; }
    const { error } = await sb.from('joiners').update({ email: p.novo }).eq('id', p.j.id).eq('email', p.j.email);
    if (error) { console.log(`  cadastro ${p.j.id}: ERRO ${error.message}`); falhas++; } else { feitos++; console.log(`  BACKUP/REVERSÃO cadastro ${p.j.id}: valor anterior "${n(p.j.email)}" (reverter: update joiners set email='${n(p.j.email)}' where id=${p.j.id})`); }
  }
  linha('e-mails corrigidos', feitos);
}

// ───────────────────────── 2) REAPONTAR itens de demanda/repasse para a linha viva do MESMO código e dono ─────────────────────────
async function corrigirDemandas() {
  secao('B) demandas e repasses que citam linha apagada, com a linha viva do mesmo código e dono');
  const ml = await ler('masterlist', 'id, ceg, nome_do_item, cog, id_linha');
  const arq = await ler('masterlist_exclusoes', 'masterlist_id, dados, origem, excluido_em', 'masterlist_id');
  const dem = await ler('pagamento_demandas', 'id, joiner_cog, itens, status');
  const rep = await ler('repassos', 'id, joiner_cog, novo_dono_cog, item_id, ceg, nome_do_item, status');
  if (!ml || !arq || !dem || !rep) return;
  const vivos = new Map(ml.map(m => [String(m.id), m]));
  const porCod = new Map(); for (const m of ml) if (n(m.id_linha)) { if (!porCod.has(n(m.id_linha))) porCod.set(n(m.id_linha), []); porCod.get(n(m.id_linha)).push(m); }
  const arqPorId = new Map(); for (const a of arq) { const k = String(a.masterlist_id); if (!arqPorId.has(k) || String(a.excluido_em) > String(arqPorId.get(k).excluido_em)) arqPorId.set(k, a); }
  // quantas demandas (de qualquer status) já citam cada linha viva
  const citacoes = new Map(); for (const d of dem) for (const e of (Array.isArray(d.itens) ? d.itens : [])) { const k = String(e?.id ?? ''); if (k) { if (!citacoes.has(k)) citacoes.set(k, new Set()); citacoes.get(k).add(d.id); } }
  const alvoDe = (idMorto, snap) => {
    const a = arqPorId.get(String(idMorto)); if (!a) return { ok: false, motivo: 'sem arquivo' };
    const d = a.dados || {}, cod = n(d.id_linha); if (!cod) return { ok: false, motivo: 'arquivada sem código' };
    const vs = porCod.get(cod) || []; if (vs.length !== 1) return { ok: false, motivo: vs.length ? `${vs.length} linhas vivas com o código` : 'código sem linha viva' };
    const t = vs[0]; if (n(t.cog) !== n(d.cog)) return { ok: false, motivo: 'dono da linha viva é diferente' };
    if (!igual(t.ceg, d.ceg) || !igual(t.nome_do_item, d.nome_do_item)) return { ok: false, motivo: 'CEG/item da linha viva diferente do arquivado' };
    if (snap) { if (snap.id_linha && n(snap.id_linha) !== cod) return { ok: false, motivo: 'código do snapshot da demanda difere' }; if (snap.ceg && !igual(snap.ceg, t.ceg)) return { ok: false, motivo: 'CEG do snapshot difere' }; if (snap.nome_do_item && !igual(snap.nome_do_item, t.nome_do_item)) return { ok: false, motivo: 'item do snapshot difere' }; }
    return { ok: true, t, a };
  };
  const planoD = [], descartes = {};
  for (const d of dem) {
    const itens = Array.isArray(d.itens) ? d.itens : [];
    itens.forEach((e, i) => {
      const id = String(e?.id ?? ''); if (!id || vivos.has(id)) return;
      const r = alvoDe(id, e);
      if (!r.ok) { descartes[r.motivo] = (descartes[r.motivo] || 0) + 1; return; }
      if (itens.some(x => String(x?.id) === String(r.t.id))) { descartes['a demanda já cita a linha viva'] = (descartes['a demanda já cita a linha viva'] || 0) + 1; return; }
      const outras = [...(citacoes.get(String(r.t.id)) || [])].filter(x => x !== d.id);
      if (outras.length) { descartes['a linha viva já é citada por outra demanda (possível pagamento em duplicidade)'] = (descartes['a linha viva já é citada por outra demanda (possível pagamento em duplicidade)'] || 0) + 1; return; }
      planoD.push({ demanda: d.id, indice: i, de: id, para: r.t.id, cod: n(r.t.id_linha), ceg: r.t.ceg, item: r.t.nome_do_item, status: d.status, origem: r.a.origem });
    });
  }
  const planoR = [];
  for (const r of rep) {
    const id = String(r.item_id ?? ''); if (!id || vivos.has(id)) continue;
    const x = alvoDe(id, { ceg: r.ceg, nome_do_item: r.nome_do_item });
    if (!x.ok) { descartes['repasse: ' + x.motivo] = (descartes['repasse: ' + x.motivo] || 0) + 1; continue; }
    if (rep.some(o => o.id !== r.id && String(o.item_id) === String(x.t.id))) { descartes['repasse: a linha viva já tem outro repasse'] = (descartes['repasse: a linha viva já tem outro repasse'] || 0) + 1; continue; }
    planoR.push({ repasse: r.id, de: id, para: x.t.id, cod: n(x.t.id_linha), ceg: x.t.ceg, item: x.t.nome_do_item, status: r.status, origem: x.a.origem });
  }
  linha('itens de demanda reapontáveis (inequívocos)', planoD.length); linha('repasses reapontáveis (inequívocos)', planoR.length);
  console.log('  preservados (não inequívocos), por motivo: ' + JSON.stringify(descartes));
  planoD.forEach(p => console.log(`  demanda ${p.demanda} [${p.status}] item#${p.indice}: ${p.de} -> ${p.para} | ${p.cod} | ${p.ceg} | ${p.item} | arquivo=${p.origem}`));
  planoR.forEach(p => console.log(`  repasse ${p.repasse} [${p.status}]: ${p.de} -> ${p.para} | ${p.cod} | ${p.ceg} | ${p.item} | arquivo=${p.origem}`));
  if (!APLICAR) return;
  let okD = 0, okR = 0;
  const porDemanda = new Map(); for (const p of planoD) { if (!porDemanda.has(p.demanda)) porDemanda.set(p.demanda, []); porDemanda.get(p.demanda).push(p); }
  for (const [idDem, ps] of porDemanda) {
    const { data: atual } = await sb.from('pagamento_demandas').select('id, itens').eq('id', idDem).maybeSingle();
    const itens = Array.isArray(atual?.itens) ? atual.itens : null;
    if (!itens || ps.some(p => String(itens[p.indice]?.id) !== p.de)) { console.log(`  demanda ${idDem}: mudou desde a análise — PULADA`); continue; }
    const novos = itens.map((e, i) => { const p = ps.find(x => x.indice === i); return p ? { ...e, id: typeof e.id === 'number' ? Number(p.para) : String(p.para) } : e; });
    const { error } = await sb.from('pagamento_demandas').update({ itens: novos }).eq('id', idDem);
    if (error) { console.log(`  demanda ${idDem}: ERRO ${error.message}`); falhas++; } else { okD += ps.length; ps.forEach(p => console.log(`  BACKUP/REVERSÃO demanda ${idDem} item#${p.indice}: id anterior ${p.de} (reverter: trocar itens[${p.indice}].id de ${p.para} para ${p.de})`)); }
  }
  for (const p of planoR) {
    const { data: atual } = await sb.from('repassos').select('id, item_id').eq('id', p.repasse).maybeSingle();
    if (!atual || String(atual.item_id) !== p.de) { console.log(`  repasse ${p.repasse}: mudou desde a análise — PULADO`); continue; }
    const { error } = await sb.from('repassos').update({ item_id: p.para }).eq('id', p.repasse).eq('item_id', atual.item_id);
    if (error) { console.log(`  repasse ${p.repasse}: ERRO ${error.message}`); falhas++; } else { okR++; console.log(`  BACKUP/REVERSÃO repasse ${p.repasse}: item_id anterior ${p.de} (reverter: update repassos set item_id=${p.de} where id=${p.repasse})`); }
  }
  linha('itens de demanda reapontados', okD); linha('repasses reapontados', okR);
}

if (ACAO === 'email' || ACAO === 'todas') await corrigirEmail();
if (ACAO === 'demandas' || ACAO === 'todas') await corrigirDemandas();
console.log(`\nFim. ${APLICAR ? 'Gravações feitas conforme acima.' : 'ENSAIO: nada foi gravado.'}${falhas ? ` ${falhas} falha(s).` : ''}`);
process.exit(falhas ? 1 : 0);
