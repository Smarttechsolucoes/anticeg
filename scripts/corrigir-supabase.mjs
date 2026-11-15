// CORREÇÕES PONTUAIS no Supabase, com ENSAIO por padrão. Só grava com APLICAR=1. Cada ação confere o estado ATUAL imediatamente antes de gravar e só mexe nos casos inequívocos; o resto fica como está, com o motivo.
// O log do GitHub é PÚBLICO: só contagens, ids de linha/cadastro/demanda, códigos de item, CEG e nomes de produto. Nunca @, e-mail, nome de pessoa, CPF ou endereço.
// ACAO = email | demandas | todas | registrar-aplicadas | reverter | verificar-registro.   APLICAR = 1 grava.   (Nada é apagado por este script.)
// ANTES de gravar qualquer correção, o plano com os valores anteriores vai para um registro PRIVADO e durável (bucket privado do Supabase; ver registro-privado.mjs). Se o registro não puder ser gravado e conferido, NADA é gravado no banco.
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { readFileSync } from 'node:fs';
import { gravarRegistro, lerRegistro, listarRegistros, verificarPrivado } from './registro-privado.mjs';

const ACAO = process.env.ACAO || 'todas', APLICAR = process.env.APLICAR === '1', REGISTRO = (process.env.REGISTRO || '').trim();
const RUN = process.env.GITHUB_RUN_ID || 'local', STAMP = new Date().toISOString().replace(/[:.]/g, '-');
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
    // histórico: o que o '#n/a' sobrescreveu foi o e-mail VIGENTE = valor_novo da troca MAIS RECENTE (valor_antigo seria o e-mail anterior a ela, já desatualizado)
    const hs = (hist || []).filter(h => String(h.joiner_id) === String(j.id) && /e-?mail/i.test(n(h.campo))).sort((a, b) => String(b.em).localeCompare(String(a.em)));
    if (hs.length && EMAIL.test(n(hs[0].valor_novo))) fontes.push({ de: 'joiner_perfil_historico (valor vigente)', email: n(hs[0].valor_novo).toLowerCase() });
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
  try {
    const g = await gravarRegistro(sb, `correcoes/${STAMP}_email_plano.json`, { versao: 1, tipo: 'correcao_email', run: RUN, quando: new Date().toISOString(), alteracoes: plano.map(p => ({ tipo: 'joiner_email', joiner_id: p.j.id, cog: p.j.cog, antes: p.j.email, depois: p.novo, acao: p.acao, motivo: p.motivo, fonte: p.de || null })) });
    console.log(`  registro privado do plano gravado e conferido: ${g.caminho} (${g.bytes} bytes; bucket ${g.bucket})`);
  } catch (e) { console.log('  ABORTADO: sem o registro privado nada é gravado no banco. ' + e.message); falhas++; return; }
  let feitos = 0; const resultados = [];
  for (const p of plano) {
    // reconfere o estado ATUAL antes de gravar: ainda "#...", ainda sem conta
    const { data: atual } = await sb.from('joiners').select('id, email').eq('id', p.j.id).maybeSingle();
    const { data: conta } = await sb.from('contas_joiner').select('joiner_id').eq('joiner_id', p.j.id).limit(1);
    if (!atual || n(atual.email) !== n(p.j.email) || (conta || []).length) { console.log(`  cadastro ${p.j.id}: mudou desde a análise — PULADO`); resultados.push({ joiner_id: p.j.id, resultado: 'pulado' }); continue; }
    const { error } = await sb.from('joiners').update({ email: p.novo }).eq('id', p.j.id).eq('email', p.j.email);
    if (error) { console.log(`  cadastro ${p.j.id}: ERRO ${error.message}`); falhas++; resultados.push({ joiner_id: p.j.id, resultado: 'erro' }); } else { feitos++; resultados.push({ joiner_id: p.j.id, resultado: 'aplicado' }); console.log(`  BACKUP/REVERSÃO cadastro ${p.j.id}: valor anterior "${n(p.j.email)}" (reverter: update joiners set email='${n(p.j.email)}' where id=${p.j.id})`); }
  }
  linha('e-mails corrigidos', feitos);
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_email_resultado.json`, { versao: 1, tipo: 'resultado_email', run: RUN, quando: new Date().toISOString(), plano: `correcoes/${STAMP}_email_plano.json`, alteracoes: plano.map(p => ({ tipo: 'joiner_email', joiner_id: p.j.id, cog: p.j.cog, antes: p.j.email, depois: p.novo, resultado: resultados.find(r => r.joiner_id === p.j.id)?.resultado || 'nao_processado' })) }); console.log(`  registro privado do RESULTADO: ${g.caminho}`); } catch (e) { console.log('  AVISO: o registro do resultado não foi gravado: ' + e.message); falhas++; }
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
  // REPASSE APROVADO com a cadeia provada pelos dois lados: o vendedor do repasse é o dono da linha ARQUIVADA, o comprador (novo dono) é o dono da linha VIVA de mesmo código, CEG e item,
  // e há uma única linha arquivada e uma única viva com esse código. O dono da linha na planilha passou do vendedor para o comprador, como o repasse diz.
  const alvoDeRepasse = r => {
    const base = alvoDe(String(r.item_id), { ceg: r.ceg, nome_do_item: r.nome_do_item });
    if (base.ok) return { ...base, via: 'mesmo dono' };
    if (base.motivo !== 'dono da linha viva é diferente') return base;
    const a = arqPorId.get(String(r.item_id)), d = a.dados || {}, cod = n(d.id_linha), t = (porCod.get(cod) || [])[0];
    if (!igual(t.ceg, d.ceg) || !igual(t.nome_do_item, d.nome_do_item)) return { ok: false, motivo: 'CEG/item da linha viva diferente do arquivado' };
    if (r.ceg && !igual(r.ceg, t.ceg)) return { ok: false, motivo: 'CEG do repasse difere' }; if (r.nome_do_item && !igual(r.nome_do_item, t.nome_do_item)) return { ok: false, motivo: 'item do repasse difere' };
    if (n(r.status).toLowerCase() !== 'aprovado') return { ok: false, motivo: 'repasse não aprovado' };
    if (n(r.joiner_cog) !== n(d.cog)) return { ok: false, motivo: 'vendedor do repasse não é o dono arquivado' };
    if (n(r.novo_dono_cog) !== n(t.cog)) return { ok: false, motivo: 'comprador do repasse não é o dono da linha viva' };
    if (new Set(arq.filter(x => n(x.dados?.id_linha) === cod && n(x.dados?.cog) === n(d.cog)).map(x => String(x.masterlist_id))).size !== 1) return { ok: false, motivo: 'mais de uma linha arquivada com esse código e esse vendedor' };
    return { ok: true, t, a, via: 'cadeia do repasse (vendedor=dono arquivado, comprador=dono vivo)' };
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
    const x = alvoDeRepasse(r);
    if (!x.ok) { descartes['repasse: ' + x.motivo] = (descartes['repasse: ' + x.motivo] || 0) + 1; continue; }
    if (rep.some(o => o.id !== r.id && String(o.item_id) === String(x.t.id))) { descartes['repasse: a linha viva já tem outro repasse'] = (descartes['repasse: a linha viva já tem outro repasse'] || 0) + 1; continue; }
    planoR.push({ repasse: r.id, de: id, para: x.t.id, cod: n(x.t.id_linha), ceg: x.t.ceg, item: x.t.nome_do_item, status: r.status, origem: x.a.origem, via: x.via });
  }
  linha('itens de demanda reapontáveis (inequívocos)', planoD.length); linha('repasses reapontáveis (inequívocos)', planoR.length);
  console.log('  preservados (não inequívocos), por motivo: ' + JSON.stringify(descartes));
  planoD.forEach(p => console.log(`  demanda ${p.demanda} [${p.status}] item#${p.indice}: ${p.de} -> ${p.para} | ${p.cod} | ${p.ceg} | ${p.item} | arquivo=${p.origem}`));
  planoR.forEach(p => console.log(`  repasse ${p.repasse} [${p.status}]: ${p.de} -> ${p.para} | ${p.cod} | ${p.ceg} | ${p.item} | arquivo=${p.origem} | prova: ${p.via}`));
  if (!APLICAR) return;
  const demandasAfetadas = {}; for (const p of planoD) { const d = dem.find(x => x.id === p.demanda); demandasAfetadas[p.demanda] = { status: d?.status, itens_antes: d?.itens }; }
  try {
    const g = await gravarRegistro(sb, `correcoes/${STAMP}_demandas_plano.json`, { versao: 1, tipo: 'correcao_demandas', run: RUN, quando: new Date().toISOString(),
      alteracoes: [...planoD.map(p => ({ tipo: 'demanda_item', demanda_id: p.demanda, indice: p.indice, antes_id: p.de, depois_id: p.para, codigo: p.cod, ceg: p.ceg, item: p.item, origem_arquivo: p.origem })), ...planoR.map(p => ({ tipo: 'repasse_item', repasse_id: p.repasse, antes_id: p.de, depois_id: p.para, codigo: p.cod, ceg: p.ceg, item: p.item, origem_arquivo: p.origem, prova: p.via }))], demandas: demandasAfetadas });
    console.log(`  registro privado do plano gravado e conferido: ${g.caminho} (${g.bytes} bytes; bucket ${g.bucket})`);
  } catch (e) { console.log('  ABORTADO: sem o registro privado nada é gravado no banco. ' + e.message); falhas++; return; }
  let okD = 0, okR = 0; const resultadosD = [], resultadosR = [];
  const porDemanda = new Map(); for (const p of planoD) { if (!porDemanda.has(p.demanda)) porDemanda.set(p.demanda, []); porDemanda.get(p.demanda).push(p); }
  for (const [idDem, ps] of porDemanda) {
    const { data: atual } = await sb.from('pagamento_demandas').select('id, itens').eq('id', idDem).maybeSingle();
    const itens = Array.isArray(atual?.itens) ? atual.itens : null;
    if (!itens || ps.some(p => String(itens[p.indice]?.id) !== p.de)) { console.log(`  demanda ${idDem}: mudou desde a análise — PULADA`); ps.forEach(p => resultadosD.push({ demanda_id: idDem, indice: p.indice, resultado: 'pulado' })); continue; }
    const novos = itens.map((e, i) => { const p = ps.find(x => x.indice === i); return p ? { ...e, id: typeof e.id === 'number' ? Number(p.para) : String(p.para) } : e; });
    const { error } = await sb.from('pagamento_demandas').update({ itens: novos }).eq('id', idDem);
    if (error) { console.log(`  demanda ${idDem}: ERRO ${error.message}`); falhas++; ps.forEach(p => resultadosD.push({ demanda_id: idDem, indice: p.indice, resultado: 'erro' })); } else { okD += ps.length; ps.forEach(p => resultadosD.push({ demanda_id: idDem, indice: p.indice, resultado: 'aplicado' })); ps.forEach(p => console.log(`  BACKUP/REVERSÃO demanda ${idDem} item#${p.indice}: id anterior ${p.de} (reverter: trocar itens[${p.indice}].id de ${p.para} para ${p.de})`)); }
  }
  for (const p of planoR) {
    const { data: atual } = await sb.from('repassos').select('id, item_id').eq('id', p.repasse).maybeSingle();
    if (!atual || String(atual.item_id) !== p.de) { console.log(`  repasse ${p.repasse}: mudou desde a análise — PULADO`); resultadosR.push({ repasse_id: p.repasse, resultado: 'pulado' }); continue; }
    const { error } = await sb.from('repassos').update({ item_id: p.para }).eq('id', p.repasse).eq('item_id', atual.item_id);
    if (error) { console.log(`  repasse ${p.repasse}: ERRO ${error.message}`); falhas++; resultadosR.push({ repasse_id: p.repasse, resultado: 'erro' }); } else { okR++; resultadosR.push({ repasse_id: p.repasse, resultado: 'aplicado' }); console.log(`  BACKUP/REVERSÃO repasse ${p.repasse}: item_id anterior ${p.de} (reverter: update repassos set item_id=${p.de} where id=${p.repasse})`); }
  }
  linha('itens de demanda reapontados', okD); linha('repasses reapontados', okR);
  try {
    const alt = [...planoD.map(p => ({ tipo: 'demanda_item', demanda_id: p.demanda, indice: p.indice, antes_id: p.de, depois_id: p.para, resultado: resultadosD.find(r => r.demanda_id === p.demanda && r.indice === p.indice)?.resultado || 'nao_processado' })), ...planoR.map(p => ({ tipo: 'repasse_item', repasse_id: p.repasse, antes_id: p.de, depois_id: p.para, resultado: resultadosR.find(r => r.repasse_id === p.repasse)?.resultado || 'nao_processado' }))];
    const g = await gravarRegistro(sb, `correcoes/${STAMP}_demandas_resultado.json`, { versao: 1, tipo: 'resultado_demandas', run: RUN, quando: new Date().toISOString(), plano: `correcoes/${STAMP}_demandas_plano.json`, alteracoes: alt });
    console.log(`  registro privado do RESULTADO: ${g.caminho}`);
  } catch (e) { console.log('  AVISO: o registro do resultado não foi gravado: ' + e.message); falhas++; }
}

// ───────── 3) REGISTRO RETROATIVO das correções que já foram aplicadas em 15/11/2026 (run 43742627842), conferidas contra o estado ATUAL do banco. Não altera dados do sistema; só grava o registro privado.
const APLICADAS_EMAIL = [37, 64, 75, 103, 16212, 18658, 25970, 75961, 75962, 75964, 75967, 76373, 93759, 162588, 166473, 166489, 171716, 211547, 222363, 239169, 348579, 375438, 375451, 480267, 480268, 480770, 580166, 652899];
const APLICADAS_DEMANDA = [{ demanda_id: 1466, indice: 0, antes_id: 9403, depois_id: 9781 }, { demanda_id: 1470, indice: 0, antes_id: 9402, depois_id: 9784 }, { demanda_id: 1470, indice: 1, antes_id: 9411, depois_id: 9785 }, { demanda_id: 1483, indice: 0, antes_id: 9401, depois_id: 9782 }, { demanda_id: 1500, indice: 0, antes_id: 9356, depois_id: 9783 }];
async function registrarAplicadas() {
  secao('C) registro privado retroativo das correções já aplicadas (run 43742627842)');
  const jo = await ler('joiners', 'id, cog, email'), contas = await ler('contas_joiner', 'joiner_id', 'joiner_id');
  const dem = await ler('pagamento_demandas', 'id, status, itens'), ml = await ler('masterlist', 'id, id_linha, ceg, nome_do_item'), arq = await ler('masterlist_exclusoes', 'masterlist_id, dados, origem', 'masterlist_id');
  if (!jo || !contas || !dem || !ml || !arq) return;
  const comConta = new Set(contas.map(c => String(c.joiner_id)));
  const alteracoes = [];
  for (const id of APLICADAS_EMAIL) {
    const j = jo.find(x => x.id === id);
    const estado = !j ? 'cadastro não encontrado' : (n(j.email) !== '' ? 'o e-mail NÃO está vazio hoje (mudou depois)' : comConta.has(String(id)) ? 'hoje tem conta' : 'conferido');
    alteracoes.push({ tipo: 'joiner_email', joiner_id: id, cog: j?.cog ?? null, antes: '#n/a', depois: null, valor_anterior_fonte: 'log do run 43742627842 ("valor atual #n/a")', estado_atual: estado });
  }
  const demandas = {};
  for (const a of APLICADAS_DEMANDA) {
    const d = dem.find(x => x.id === a.demanda_id); const itens = Array.isArray(d?.itens) ? d.itens : [];
    const t = ml.find(m => m.id === a.depois_id), arquivada = arq.find(x => x.masterlist_id === a.antes_id);
    const cita = String(itens[a.indice]?.id) === String(a.depois_id);
    alteracoes.push({ tipo: 'demanda_item', ...a, codigo: t?.id_linha ?? null, ceg: t?.ceg ?? null, item: t?.nome_do_item ?? null, codigo_arquivado_igual: !!t && !!arquivada && n(arquivada.dados?.id_linha) === n(t.id_linha), origem_arquivo: arquivada?.origem ?? null, estado_atual: cita ? 'conferido (o item cita a linha nova)' : 'o item NÃO cita mais a linha nova (mudou depois)', resultado: 'aplicado' });
    if (!demandas[a.demanda_id]) demandas[a.demanda_id] = { status: d?.status, itens_depois: itens, itens_antes_reconstruido: itens.map((e, i) => { const x = APLICADAS_DEMANDA.find(y => y.demanda_id === a.demanda_id && y.indice === i); return x ? { ...e, id: typeof e.id === 'number' ? x.antes_id : String(x.antes_id) } : e; }) };
  }
  linha('e-mails conferidos (cadastro hoje sem e-mail e sem conta)', alteracoes.filter(a => a.tipo === 'joiner_email' && a.estado_atual === 'conferido').length + ' de ' + APLICADAS_EMAIL.length);
  linha('itens de demanda conferidos (citam a linha nova)', alteracoes.filter(a => a.tipo === 'demanda_item' && a.estado_atual.startsWith('conferido')).length + ' de ' + APLICADAS_DEMANDA.length);
  if (!APLICAR) { console.log('  ENSAIO: o registro não foi gravado.'); return; }
  try {
    const g = await gravarRegistro(sb, `correcoes/2026-11-15_aplicadas_run43742627842_resultado.json`, { versao: 1, tipo: 'resultado_retroativo', run: '43742627842', registrado_no_run: RUN, quando: new Date().toISOString(), observacao: 'Registro feito DEPOIS da aplicação, a partir do log do run e do estado atual do banco. itens_antes_reconstruido = itens_depois com o id antigo do(s) item(ns) alterado(s); nada além do id foi mudado.', alteracoes, demandas });
    console.log(`  registro privado gravado e conferido: ${g.caminho} (${g.bytes} bytes; bucket ${g.bucket})`);
  } catch (e) { console.log('  ERRO: ' + e.message); falhas++; }
}

// ───────── 4) REVERSÃO PRECISA, a partir de um registro privado de RESULTADO (REGISTRO=<caminho>). Mexe SÓ na referência afetada e confere o estado ATUAL antes de gravar.
async function reverter() {
  secao('D) reversão a partir do registro privado');
  if (!REGISTRO) { console.log('  informe REGISTRO=<caminho do arquivo _resultado.json>. Registros existentes:'); (await listarRegistros(sb).catch(e => [e.message])).forEach(x => console.log('   ' + x)); return; }
  const reg = await lerRegistro(sb, REGISTRO);
  // no registro RETROATIVO os e-mails não trazem 'resultado': valem os que foram conferidos contra o estado atual na hora do registro
  const alvo = (reg.alteracoes || []).filter(a => a.resultado === 'aplicado' || (reg.tipo === 'resultado_retroativo' && a.tipo === 'joiner_email' && a.estado_atual === 'conferido'));
  linha('registro', `${REGISTRO} · alterações aplicadas: ${alvo.length}`);
  let rev = 0, pulados = 0;
  for (const a of alvo) {
    if (a.tipo === 'joiner_email') {
      const { data: j } = await sb.from('joiners').select('id, email').eq('id', a.joiner_id).maybeSingle();
      const { data: conta } = await sb.from('contas_joiner').select('joiner_id').eq('joiner_id', a.joiner_id).limit(1);
      if (!j || n(j.email) !== n(a.depois) || (conta || []).length) { console.log(`  cadastro ${a.joiner_id}: o e-mail mudou desde a correção (ou já tem conta) — NÃO revertido`); pulados++; continue; }
      if (!APLICAR) { console.log(`  cadastro ${a.joiner_id}: seria revertido (e-mail volta a "${n(a.antes)}")`); rev++; continue; }
      const { error } = await sb.from('joiners').update({ email: a.antes }).eq('id', a.joiner_id).is('email', null);
      if (error) { console.log(`  cadastro ${a.joiner_id}: ERRO ${error.message}`); falhas++; } else { rev++; console.log(`  cadastro ${a.joiner_id}: revertido`); }
    } else if (a.tipo === 'demanda_item') {
      const { data: d } = await sb.from('pagamento_demandas').select('id, itens').eq('id', a.demanda_id).maybeSingle();
      const itens = Array.isArray(d?.itens) ? d.itens : null;
      if (!itens || String(itens[a.indice]?.id) !== String(a.depois_id)) { console.log(`  demanda ${a.demanda_id} item#${a.indice}: a referência mudou desde a correção — NÃO revertida`); pulados++; continue; }
      if (!APLICAR) { console.log(`  demanda ${a.demanda_id} item#${a.indice}: seria revertida (${a.depois_id} -> ${a.antes_id})`); rev++; continue; }
      const novos = itens.map((e, i) => i === a.indice ? { ...e, id: typeof e.id === 'number' ? Number(a.antes_id) : String(a.antes_id) } : e);   // só o id do item afetado; o resto do que está AGORA na demanda fica como está
      const { error } = await sb.from('pagamento_demandas').update({ itens: novos }).eq('id', a.demanda_id).contains('itens', [{ id: itens[a.indice].id }]);
      const { data: depois } = await sb.from('pagamento_demandas').select('itens').eq('id', a.demanda_id).maybeSingle();
      if (error || String(depois?.itens?.[a.indice]?.id) !== String(a.antes_id)) { console.log(`  demanda ${a.demanda_id} item#${a.indice}: ERRO/não confirmou ${error?.message || ''}`); falhas++; } else { rev++; console.log(`  demanda ${a.demanda_id} item#${a.indice}: revertida (${a.depois_id} -> ${a.antes_id})`); }
    } else if (a.tipo === 'repasse_item') {
      const { data: r } = await sb.from('repassos').select('id, item_id').eq('id', a.repasse_id).maybeSingle();
      if (!r || String(r.item_id) !== String(a.depois_id)) { console.log(`  repasse ${a.repasse_id}: a referência mudou desde a correção — NÃO revertido`); pulados++; continue; }
      if (!APLICAR) { console.log(`  repasse ${a.repasse_id}: seria revertido (${a.depois_id} -> ${a.antes_id})`); rev++; continue; }
      const { error } = await sb.from('repassos').update({ item_id: a.antes_id }).eq('id', a.repasse_id).eq('item_id', r.item_id);
      if (error) { console.log(`  repasse ${a.repasse_id}: ERRO ${error.message}`); falhas++; } else { rev++; console.log(`  repasse ${a.repasse_id}: revertido`); }
    }
  }
  linha(APLICAR ? 'revertidos' : 'reverteria (ENSAIO)', rev); linha('não revertidos (mudaram depois)', pulados);
}

// ───────── 5) o registro é mesmo PRIVADO? (URL pública e chave pública do site não alcançam)
async function verificarRegistro() {
  secao('E) o registro privado é inacessível sem a chave de serviço?');
  const lista = await listarRegistros(sb).catch(e => { console.log('  erro: ' + e.message); return []; });
  linha('arquivos no registro', lista.length); lista.forEach(x => console.log('   ' + x));
  const anon = (() => { try { return (readFileSync(new URL('../src/supabase.js', import.meta.url), 'utf8').match(/CHAVE_PRODUCAO\s*=\s*"([^"]+)"/) || [])[1]; } catch { return null; } })();
  if (!lista.length) return;
  const v = await verificarPrivado(process.env.SUPABASE_URL, anon, lista[0]);
  linha('resultado', JSON.stringify(v)); if (!v.privado) { console.log('  ALERTA: o registro NÃO está privado.'); falhas++; }
}

if (ACAO === 'registrar-aplicadas') await registrarAplicadas();
if (ACAO === 'reverter') await reverter();
if (ACAO === 'verificar-registro') await verificarRegistro();
if (ACAO === 'email' || ACAO === 'todas') await corrigirEmail();
if (ACAO === 'demandas' || ACAO === 'todas') await corrigirDemandas();
console.log(`\nFim. ${APLICAR ? 'Gravações feitas conforme acima.' : 'ENSAIO: nada foi gravado.'}${falhas ? ` ${falhas} falha(s).` : ''}`);
process.exit(falhas ? 1 : 0);
