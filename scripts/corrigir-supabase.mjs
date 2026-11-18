// CORREÇÕES PONTUAIS no Supabase, com ENSAIO por padrão. Só grava com APLICAR=1. Cada ação confere o estado ATUAL imediatamente antes de gravar e só mexe nos casos inequívocos; o resto fica como está, com o motivo.
// O log do GitHub é PÚBLICO: só contagens, ids de linha/cadastro/demanda, códigos de item, CEG e nomes de produto. Nunca @, e-mail, nome de pessoa, CPF ou endereço.
// ACAO = email | demandas | todas | registrar-aplicadas | reverter | verificar-registro | arquivar-copias (IDS=...) | sync-indevido | arquivar-pares (PARES=dup:preservada,...) | liberar-itens (IDS=...: passa para "disponível" linhas que a planilha marca sem dono) | trocar-email (IDS=<id do cadastro> EMAIL_HASH=<8 hex>: ordem explícita; o e-mail sai da planilha).   APLICAR = 1 grava.   (Só a ação arquivar-copias retira linhas da masterlist, uma a uma e pela função prune_masterlist, que guarda a foto completa em masterlist_exclusoes.)
// ANTES de gravar qualquer correção, o plano com os valores anteriores vai para um registro PRIVADO e durável (bucket privado do Supabase; ver registro-privado.mjs). Se o registro não puder ser gravado e conferido, NADA é gravado no banco.
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { indexarJoiners, resolverLinha } from './resolver-joiner.js';
import { carregarArrobasAntigos } from './arrobas-antigos.js';
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
    // O dono da linha ARQUIVADA tem que ser o vendedor (arquivada antes da venda) ou o comprador (arquivada depois dela): em qualquer caso, alguém do próprio repasse.
    if (n(d.cog) !== n(r.joiner_cog) && n(d.cog) !== n(r.novo_dono_cog)) return { ok: false, motivo: 'vendedor do repasse não é o dono arquivado' };
    // CADEIA até o dono da linha viva: o comprador do repasse é o dono vivo, ou há repasses APROVADOS sobre a própria linha viva que levam, elo a elo (vendedor do seguinte = comprador do anterior), até o dono vivo.
    const cadeia = [n(r.joiner_cog), n(r.novo_dono_cog)], usados = new Set(); let atual = n(r.novo_dono_cog);
    for (let passo = 0; n(atual) !== n(t.cog); passo++) {
      const seguintes = rep.filter(o => o.id !== r.id && String(o.item_id) === String(t.id) && n(o.status).toLowerCase() === 'aprovado' && n(o.joiner_cog) === atual && !usados.has(o.id));
      if (passo >= 5 || seguintes.length !== 1) return { ok: false, motivo: 'comprador do repasse não é o dono da linha viva' };
      usados.add(seguintes[0].id); atual = n(seguintes[0].novo_dono_cog); cadeia.push(atual);
    }
    // Toda linha arquivada com esse código tem que ser do MESMO CEG/item e de alguém da cadeia (cópias do sync e linhas manuais do mesmo vendedor/comprador). Outro dono ou outro item = sem prova.
    const arqDoCodigo = arq.filter(x => n(x.dados?.id_linha) === cod);
    if (arqDoCodigo.some(x => !igual(x.dados?.ceg, t.ceg) || !igual(x.dados?.nome_do_item, t.nome_do_item) || !cadeia.includes(n(x.dados?.cog)))) return { ok: false, motivo: 'há linha arquivada com esse código de outro dono ou outro item' };
    // Outros repasses sobre a linha viva só são aceitos se forem elos DESTA cadeia; qualquer outro é ambíguo.
    if (rep.some(o => o.id !== r.id && String(o.item_id) === String(t.id) && !usados.has(o.id))) return { ok: false, motivo: 'a linha viva tem outro repasse fora da cadeia' };
    return { ok: true, t, a, via: cadeia.length > 2 ? `cadeia de ${usados.size + 1} repasses aprovados até o dono vivo` : 'cadeia do repasse (vendedor/comprador = dono arquivado, comprador=dono vivo)', cadeiaOk: true };
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
    if (!x.cadeiaOk && rep.some(o => o.id !== r.id && String(o.item_id) === String(x.t.id))) { descartes['repasse: a linha viva já tem outro repasse'] = (descartes['repasse: a linha viva já tem outro repasse'] || 0) + 1; continue; }
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
    } else if (a.tipo === 'linha_arquivada') {
      const { data: viva } = await sb.from('masterlist').select('id').eq('id', a.masterlist_id).maybeSingle();
      const { data: arq } = await sb.from('masterlist_exclusoes').select('masterlist_id').eq('masterlist_id', a.masterlist_id).limit(1);
      if (viva || !(arq || []).length) { console.log(`  linha ${a.masterlist_id}: ${viva ? 'já existe de novo na masterlist' : 'não está no arquivo'} — NÃO restaurada`); pulados++; continue; }
      if (!APLICAR) { console.log(`  linha ${a.masterlist_id}: seria restaurada a partir da foto do registro`); rev++; continue; }
      const { error } = await sb.from('masterlist').insert([a.antes]);
      if (error) { console.log(`  linha ${a.masterlist_id}: ERRO ${error.message}`); falhas++; } else { rev++; console.log(`  linha ${a.masterlist_id}: restaurada (a foto continua em masterlist_exclusoes)`); }
    } else if (a.tipo === 'joiner_email_troca') {
      const { data: j } = await sb.from('joiners').select('id, email').eq('id', a.joiner_id).maybeSingle();
      const { data: conta } = await sb.from('contas_joiner').select('joiner_id').eq('joiner_id', a.joiner_id).limit(1);
      if (!j || n(j.email).toLowerCase() !== n(a.depois).toLowerCase() || (conta || []).length) { console.log(`  cadastro ${a.joiner_id}: o e-mail mudou desde a troca (ou já tem conta) — NÃO revertido`); pulados++; continue; }
      if (!APLICAR) { console.log(`  cadastro ${a.joiner_id}: seria revertido (e-mail volta ao anterior)`); rev++; continue; }
      const { error } = await sb.from('joiners').update({ email: a.antes ?? null }).eq('id', a.joiner_id).eq('email', j.email);
      if (error) { console.log(`  cadastro ${a.joiner_id}: ERRO ${error.message}`); falhas++; } else { rev++; console.log(`  cadastro ${a.joiner_id}: revertido`); }
    } else if (a.tipo === 'campo_masterlist') {
      const { data: atual } = await sb.from('masterlist').select(`id, ${a.campo}`).eq('id', a.masterlist_id);
      if (!atual || atual.length !== 1 || atual[0][a.campo] !== a.depois) { console.log(`  linha ${a.masterlist_id} ${a.campo}: o valor mudou desde a correção — NÃO revertido`); pulados++; continue; }
      if (!APLICAR) { console.log(`  linha ${a.masterlist_id} ${a.campo}: seria revertido (${a.depois} -> ${a.antes})`); rev++; continue; }
      const { error } = await sb.from('masterlist').update({ [a.campo]: a.antes }).eq('id', a.masterlist_id).eq(a.campo, a.depois);
      if (error) { console.log(`  linha ${a.masterlist_id} ${a.campo}: ERRO ${error.message}`); falhas++; } else { rev++; console.log(`  linha ${a.masterlist_id} ${a.campo}: revertido`); }
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

// ───────── 6) ARQUIVAR CÓPIAS PROVADAS (IDS=id,id,...), uma a uma. Só arquiva linha LIVRE (sem pagamento, claim, multa, loja, demanda, repasse, envio ou loja-repasse) E com prova de que é cópia de outra linha:
//   (β) mesma compra registrada duas vezes: outra linha viva com o MESMO CEG + item + código + dono, e a planilha tem esse código desse dono; ou
//   (α) o dono da linha é o @/e-mail DIGITADO numa linha da planilha do mesmo CEG + item que resolve para OUTRO cadastro (a mesma pessoa), e esse cadastro já tem linhas para TODAS as suas linhas da planilha desse CEG + item.
// Não mexe no limite do prune (usa prune_masterlist com o limite padrão de 25 e no máximo 10 ids por execução). Antes de apagar, a FOTO COMPLETA vai para o registro privado; depois confere que a linha saiu da masterlist e entrou em masterlist_exclusoes.
async function arquivarCopias() {
  secao('F) arquivar CÓPIAS PROVADAS, uma a uma (só livres; foto completa no registro privado; limite do prune intacto)');
  const IDS = [...new Set((process.env.IDS || '').split(/[,\s]+/).filter(Boolean).map(Number))];
  if (!IDS.length || IDS.some(x => !Number.isInteger(x))) { console.log('  informe IDS=<ids separados por vírgula>'); falhas++; return; }
  if (IDS.length > 10) { console.log('  mais de 10 ids: recusado (o arquivamento é caso a caso, nunca em lote)'); falhas++; return; }
  const ml = await ler('masterlist', 'id, ceg, cog, nome, nome_do_item, status, id_linha, pago_item, pago_frete, pago_rf, na_loja');
  const jo = await ler('joiners', 'id, cog, email, twitter'), dem = await ler('pagamento_demandas', 'id, itens'), rep = await ler('repassos', 'id, item_id');
  const env = await ler('envio_solicitacoes', 'id, itens'), loj = await ler('lojinha_repasses', 'id, masterlist_id');
  if (!ml || !jo || !dem || !rep || !env || !loj) { console.log('  leitura incompleta: nada feito'); falhas++; return; }
  const lc = v => n(v).toLowerCase().replace(/\s+/g, ' ');
  const emailLimpo = v => { const e = lc(v); return /^[^\s@#]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : ''; };
  const norm = t => String(t).replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const resp = await fetch('https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995');
  if (!resp.ok) { console.log('  não consegui ler a planilha'); falhas++; return; }
  const linhasCsv = (await resp.text()).replace(/^﻿/, '').split('\n'); const hIdx = linhasCsv.findIndex(l => l.includes('ABA'));
  if (hIdx === -1) { console.log('  cabeçalho da planilha não encontrado'); falhas++; return; }
  const records = parse(linhasCsv.slice(hIdx).join('\n'), { columns: true, skip_empty_lines: true });
  const colMap = {}; Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
  const col = (r, ...nomes) => { for (const nm of nomes) { const k = colMap[norm(nm)]; if (k !== undefined) return r[k] ?? ''; } return ''; };
  const rows = records.filter(r => n(col(r, 'ABA / CEG', 'CEG')) && n(col(r, 'NOME DO ITEM')));
  const idx = indexarJoiners(jo, await carregarArrobasAntigos(sb, jo));
  const itemKey = (ceg, item) => `${lc(ceg)}|${lc(item)}`;
  const S = rows.map(r => { const rs = resolverLinha({ twitter: n(col(r, '@')), email: emailLimpo(col(r, 'EMAIL')) }, idx); return { cod: n(col(r, 'ID')), item: itemKey(col(r, 'ABA / CEG', 'CEG'), col(r, 'NOME DO ITEM')), dono: lc(rs.cog), tw: lc(col(r, '@')).replace(/^@/, ''), em: emailLimpo(col(r, 'EMAIL')) }; });
  const idsEm = itens => (Array.isArray(itens) ? itens : []).map(e => (e && typeof e === 'object') ? String(e.id ?? e.item_id ?? e.masterlist_id ?? '') : String(e ?? '')).filter(Boolean);
  const refs = id => { const k = String(id); return [dem.some(x => idsEm(x.itens).includes(k)) && 'demanda', rep.some(x => String(x.item_id) === k) && 'repasse', env.some(x => idsEm(x.itens).includes(k)) && 'envio', loj.some(x => String(x.masterlist_id) === k) && 'loja-repasse'].filter(Boolean); };
  const pago = x => !!(x.pago_item || x.pago_frete || x.pago_rf);
  const porItem = new Map(); for (const m of ml) { const k = itemKey(m.ceg, m.nome_do_item); if (!porItem.has(k)) porItem.set(k, []); porItem.get(k).push(m); }
  const arquivando = new Set(), plano = [], preservadas = [];
  for (const id of IDS.sort((a, b) => a - b)) {
    const x = ml.find(m => m.id === id); if (!x) { preservadas.push({ id, motivo: 'a linha não existe mais' }); continue; }
    const { data: mot, error: eM } = await sb.rpc('masterlist_motivos_protecao', { p_id: id });
    if (eM) { preservadas.push({ id, motivo: 'sem leitura da proteção' }); continue; }
    if (mot && mot.length) { preservadas.push({ id, motivo: 'protegida: ' + mot.join(',') }); continue; }
    const rf = refs(id); if (rf.length) { preservadas.push({ id, motivo: 'tem referência: ' + rf.join(',') }); continue; }
    const k = itemKey(x.ceg, x.nome_do_item), c = lc(x.cog), cd = n(x.id_linha);
    if (!c) { preservadas.push({ id, motivo: 'linha sem dono' }); continue; }
    const outras = (porItem.get(k) || []).filter(y => y.id !== x.id && !arquivando.has(y.id));
    const irmas = cd ? outras.filter(y => n(y.id_linha) === cd && lc(y.cog) === c) : [];
    let via = null;
    if (irmas.length && S.some(s => s.cod === cd && s.dono === c) && irmas.some(y => pago(y) || refs(y.id).length || y.id < x.id)) via = `mesma compra registrada duas vezes (mesmo CEG, item, código e dono; irmã ${irmas.map(y => '#' + y.id).join(',')} permanece)`;
    else {
      const rs = S.filter(s => s.item === k && s.dono && s.dono !== c && (s.tw === c || s.em === c)); const donos = [...new Set(rs.map(s => s.dono))];
      if (donos.length === 1) {
        const O = donos[0], naPlan = S.filter(s => s.item === k && s.dono === O).length, deO = outras.filter(y => lc(y.cog) === O);
        if (naPlan > 0 && deO.length >= naPlan && (!cd || deO.some(y => n(y.id_linha) === cd))) via = `@/e-mail antigo da mesma pessoa (o cadastro dono na planilha já tem ${deO.length} linha(s) para ${naPlan} na planilha neste CEG + item)`;
      }
    }
    if (!via) { preservadas.push({ id, motivo: 'sem prova de cópia' }); continue; }
    arquivando.add(id); plano.push({ id, codigo: cd || null, ceg: x.ceg, item: x.nome_do_item, via });
  }
  linha('ids informados', IDS.length); linha('arquivar (cópia provada e livre)', plano.length);
  plano.forEach(p => console.log(`  #${p.id} | ${p.codigo || '-'} | ${p.ceg} | ${p.item} | prova: ${p.via}`));
  preservadas.forEach(p => console.log(`  PRESERVADA #${p.id}: ${p.motivo}`));
  if (!plano.length) return;
  if (!APLICAR) { console.log('  ENSAIO: nada foi gravado.'); return; }
  // foto completa das linhas ANTES de apagar, no registro privado (se não gravar e conferir, NADA é apagado)
  const { data: fotos, error: eF } = await sb.from('masterlist').select('*').in('id', plano.map(p => p.id));
  if (eF || (fotos || []).length !== plano.length) { console.log(`  não consegui a foto completa das linhas (${eF?.message || 'contagem difere'}): NADA foi feito`); falhas++; return; }
  const alteracoes = plano.map(p => ({ tipo: 'linha_arquivada', masterlist_id: p.id, codigo: p.codigo, prova: p.via, antes: fotos.find(f => f.id === p.id) }));
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_arquivar_plano.json`, { versao: 1, tipo: 'correcao_arquivar_copias', run: RUN, quando: new Date().toISOString(), alteracoes, preservadas }); console.log(`  registro privado do plano gravado e conferido: ${g.caminho} (${g.bytes} bytes; bucket ${g.bucket})`); }
  catch (e) { console.log('  ERRO: ' + e.message + ' — NADA foi apagado'); falhas++; return; }
  const { data: rel, error: eP } = await sb.rpc('prune_masterlist', { p_ids: plano.map(p => p.id), p_linhas_planilha: rows.length, p_limite: 25 });
  if (eP || !rel || rel.abortado) { console.log(`  a função recusou: ${eP?.message || JSON.stringify(rel)} — nada foi apagado`); falhas++; return; }
  console.log(`  prune_masterlist: ${JSON.stringify(rel)}`);
  const { data: restam } = await sb.from('masterlist').select('id').in('id', plano.map(p => p.id));
  const { data: arqs } = await sb.from('masterlist_exclusoes').select('masterlist_id').in('masterlist_id', plano.map(p => p.id));
  const sairam = new Set(plano.map(p => p.id)); (restam || []).forEach(r => sairam.delete(r.id)); const arquivadas = new Set((arqs || []).map(a => a.masterlist_id));
  for (const a of alteracoes) a.resultado = sairam.has(a.masterlist_id) && arquivadas.has(a.masterlist_id) ? 'aplicado' : 'nao_confirmado';
  alteracoes.forEach(a => console.log(`  #${a.masterlist_id}: ${a.resultado}`));
  if (alteracoes.some(a => a.resultado !== 'aplicado')) falhas++;
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_arquivar_resultado.json`, { versao: 1, tipo: 'resultado_arquivar_copias', run: RUN, plano: `correcoes/${STAMP}_arquivar_plano.json`, quando: new Date().toISOString(), alteracoes }); console.log(`  registro privado do RESULTADO: ${g.caminho}`); }
  catch (e) { console.log('  ERRO ao gravar o resultado: ' + e.message); falhas++; }
}

// ───────── 7) EFEITOS DO SYNC SEM PROTEÇÕES de 16/11/2026 17:59 UTC: DOCUMENTAR tudo e corrigir SÓ o que o próprio banco prova.
//   Pagamento: o pago_item volta a TRUE somente se uma demanda com status "pago" cita o item (evidência financeira confirmada). Sem demanda paga, a planilha (fonte oficial) fica valendo e o caso é só documentado.
//   Status: volta ao valor anterior somente se há solicitação de envio "enviado" citando o item (o item já saiu). Sem isso, a planilha fica valendo.
//   Dono: NÃO é alterado aqui (a planilha é a fonte oficial dos pedidos); o balanço de linhas por dono na planilha x banco é só documentado.
// Valores anteriores (pago_item=true e status) vêm do log público da simulação controlada (ids e rótulos, sem dados pessoais). Cada gravação reconfere o estado ATUAL; foto antes/depois no registro privado.
const SYNC_PAGOS = [5340, 7125, 5436, 18285, 5084, 5085, 18445, 8838, 8839, 8840, 8841, 8842, 8833, 8834, 8835, 8836, 8837];
const SYNC_STATUS = [{ id: 338, antes: 'Enviado Nacional' }, { id: 369, antes: 'Enviado Nacional' }, { id: 2829, antes: 'Envio Liberado' }];
const SYNC_DONOS = [{ id: 9222, antes: 'h:d5525f6c' }, { id: 7232, antes: 'h:79651e7e' }];
async function corrigirSyncIndevido() {
  secao('G) efeitos do sync sem proteções (16/11 17:59 UTC): documentar e corrigir só o comprovado');
  const ml = await ler('masterlist', 'id, ceg, cog, nome_do_item, status, id_linha, pago_item, pago_frete, pago_rf');
  const jo = await ler('joiners', 'id, cog, email, twitter'), dem = await ler('pagamento_demandas', 'id, joiner_cog, itens, status, created_at, valor_total');
  const env = await ler('envio_solicitacoes', 'id, itens, status'), multas = await ler('multas_pagas', 'id, masterlist_id, campo, valor_multa, joiner_cog'), rep = await ler('repassos', 'id, item_id, status');
  if (!ml || !jo || !dem || !env || !multas || !rep) { console.log('  leitura incompleta: nada feito'); falhas++; return; }
  const { createHash } = await import('node:crypto');
  const marca = v => (v == null || n(v) === '') ? '(sem)' : 'h:' + createHash('sha256').update(n(v).toLowerCase().replace(/^@/, '')).digest('hex').slice(0, 8);
  const idsEm = itens => (Array.isArray(itens) ? itens : []).map(e => (e && typeof e === 'object') ? String(e.id ?? e.item_id ?? e.masterlist_id ?? '') : String(e ?? '')).filter(Boolean);
  const por = new Map(ml.map(m => [m.id, m]));
  const plano = [], documentadas = [];

  console.log('  — 1) PAGAMENTOS (os 17 que a planilha desmarcaria):');
  for (const id of SYNC_PAGOS) {
    const m = por.get(id); if (!m) { console.log(`    #${id}: não existe`); continue; }
    const pagas = dem.filter(d => idsEm(d.itens).includes(String(id)) && n(d.status).toLowerCase() === 'pago');
    const outras = dem.filter(d => idsEm(d.itens).includes(String(id)) && n(d.status).toLowerCase() !== 'pago').map(d => `${d.id}:${d.status}`);
    const mesmoPagador = pagas.map(d => n(d.joiner_cog).toLowerCase() === n(m.cog).toLowerCase());
    if (m.pago_item === true) { console.log(`    #${id} [${n(m.id_linha)}]: já está marcado (nada a fazer)`); continue; }
    if (pagas.length) {
      plano.push({ tipo: 'campo_masterlist', masterlist_id: id, campo: 'pago_item', antes: false, depois: true, prova: `demanda(s) paga(s) citando o item: ${pagas.map(d => `${d.id} (${n(d.created_at).slice(0, 10)}, R$ ${Number(d.valor_total).toFixed(2)})`).join(', ')}` });
      console.log(`    #${id} [${n(m.id_linha)}] ${n(m.ceg)} | ${n(m.nome_do_item)}: RESTAURAR pago_item=true — demanda(s) paga(s) ${pagas.map(d => d.id).join(',')}; pagador = dono: ${mesmoPagador.join('/')}${pagas.length > 1 ? ' · ATENÇÃO: mais de uma demanda paga cita o mesmo item (possível pagamento em duplicidade, só documentado)' : ''}${outras.length ? ' · outras demandas: ' + outras.join(',') : ''}`);
    } else {
      documentadas.push({ tipo: 'pagamento_sem_evidencia', masterlist_id: id });
      console.log(`    #${id} [${n(m.id_linha)}] ${n(m.ceg)} | ${n(m.nome_do_item)}: PRESERVADO sem a marcação — nenhuma demanda paga cita o item; a planilha (oficial) diz não pago${outras.length ? ' · demandas não pagas: ' + outras.join(',') : ''}`);
    }
  }

  console.log('  — 2) STATUS que voltou para "Comprado":');
  for (const s of SYNC_STATUS) {
    const m = por.get(s.id); if (!m) { console.log(`    #${s.id}: não existe`); continue; }
    const enviados = env.filter(e => idsEm(e.itens).includes(String(s.id)) && n(e.status).toLowerCase() === 'enviado');
    if (m.status !== 'Comprado') { console.log(`    #${s.id}: status hoje "${m.status}" (já não é Comprado)`); continue; }
    if (enviados.length) {
      plano.push({ tipo: 'campo_masterlist', masterlist_id: s.id, campo: 'status', antes: 'Comprado', depois: s.antes, prova: `solicitação(ões) de envio "enviado" citando o item: ${enviados.map(e => e.id).join(', ')}` });
      console.log(`    #${s.id} [${n(m.id_linha)}] ${n(m.ceg)} | ${n(m.nome_do_item)}: RESTAURAR status "${s.antes}" — envio(s) "enviado" ${enviados.map(e => e.id).join(',')}`);
    } else console.log(`    #${s.id} [${n(m.id_linha)}] ${n(m.ceg)} | ${n(m.nome_do_item)}: PRESERVADO "Comprado" — nenhuma solicitação de envio "enviado" cita o item (antes: "${s.antes}"); a planilha (oficial) manda`);
  }

  console.log('  — 3) DONOS (só documentação; a planilha é a fonte oficial):');
  for (const d of SYNC_DONOS) {
    const m = por.get(d.id); if (!m) { console.log(`    #${d.id}: não existe`); continue; }
    const ref = [...dem.filter(x => idsEm(x.itens).includes(String(d.id))).map(x => `demanda ${x.id}:${x.status} pagadora ${marca(x.joiner_cog)}`), ...rep.filter(x => String(x.item_id) === String(d.id)).map(x => `repasse ${String(x.id).slice(0, 8)}:${x.status}`), ...multas.filter(x => x.masterlist_id === d.id).map(x => `multa ${x.campo} ${Number(x.valor_multa).toFixed(2)} (joiner ${marca(x.joiner_cog)})`)];
    const mesmaChave = ml.filter(x => n(x.ceg).toLowerCase() === n(m.ceg).toLowerCase() && n(x.nome_do_item).toLowerCase() === n(m.nome_do_item).toLowerCase());
    const porDono = {}; for (const x of mesmaChave) { const k = marca(x.cog); porDono[k] = (porDono[k] || 0) + 1; }
    console.log(`    #${d.id} [${n(m.id_linha)}] ${n(m.ceg)} | ${n(m.nome_do_item)}: dono antes ${d.antes} -> hoje ${marca(m.cog)} · pago=${m.pago_item ? 'I' : '-'} · ${ref.length ? ref.join(' · ') : 'sem demandas, repasses nem multas'}`);
    console.log(`       linhas deste CEG+item no banco por dono (hoje): ${JSON.stringify(porDono)}`);
    documentadas.push({ tipo: 'dono_segue_planilha', masterlist_id: d.id, antes: d.antes, hoje: marca(m.cog) });
  }
  linha('correções comprovadas', plano.length); linha('apenas documentadas', documentadas.length);
  if (!plano.length) return;
  if (!APLICAR) { console.log('  ENSAIO: nada foi gravado.'); return; }
  const alteracoes = plano.map(p => ({ ...p }));
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_sync_indevido_plano.json`, { versao: 1, tipo: 'correcao_sync_indevido', run: RUN, quando: new Date().toISOString(), contexto: 'sync sem proteções de 2026-11-16T17:59Z (run 43924147264)', alteracoes, documentadas }); console.log(`  registro privado do plano gravado e conferido: ${g.caminho} (${g.bytes} bytes; bucket ${g.bucket})`); }
  catch (e) { console.log('  ERRO: ' + e.message + ' — NADA foi gravado'); falhas++; return; }
  for (const a of alteracoes) {
    const { data: atual } = await sb.from('masterlist').select(`id, ${a.campo}`).eq('id', a.masterlist_id);
    if (!atual || atual.length !== 1 || atual[0][a.campo] !== a.antes) { a.resultado = 'pulado: mudou desde o plano'; console.log(`  #${a.masterlist_id} ${a.campo}: ${a.resultado}`); continue; }
    const { error } = await sb.from('masterlist').update({ [a.campo]: a.depois }).eq('id', a.masterlist_id).eq(a.campo, a.antes);
    const { data: depois } = await sb.from('masterlist').select(`id, ${a.campo}`).eq('id', a.masterlist_id);
    if (error || !depois || depois[0]?.[a.campo] !== a.depois) { a.resultado = 'erro: ' + (error?.message || 'não confirmou'); falhas++; } else a.resultado = 'aplicado';
    console.log(`  #${a.masterlist_id} ${a.campo}: ${a.resultado}`);
  }
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_sync_indevido_resultado.json`, { versao: 1, tipo: 'resultado_sync_indevido', run: RUN, plano: `correcoes/${STAMP}_sync_indevido_plano.json`, quando: new Date().toISOString(), alteracoes, documentadas }); console.log(`  registro privado do RESULTADO: ${g.caminho}`); }
  catch (e) { console.log('  ERRO ao gravar o resultado: ' + e.message); falhas++; }
}

// ───────── 8) ARQUIVAR PARES EXPLÍCITOS (PARES="duplicada:preservada,..."; máx. 10). NÃO é regra geral: só os pares informados, cada um reprovado na hora. A única tolerância de nome é o sufixo " SKZ" no fim do item,
// e só vale dentro de um par informado. Reconfere no estado ATUAL, para cada par:
//   mesmo CEG, mesmo dono, mesmo produto (ignorando só o " SKZ" final), mesmo valor; a duplicada está LIVRE (sem pagamento/claim/multa/loja/demanda/repasse/envio) e o código dela não existe na planilha;
//   a preservada existe e o código dela está na planilha com o MESMO dono; arquivar não deixa o dono com menos linhas no banco do que linhas na planilha para esse CEG + item.
// A preservada NUNCA é tocada (inclusive se estiver paga). Foto completa da duplicada e da preservada no registro privado ANTES; usa prune_masterlist com o limite padrão; confere depois (preservada intacta).
async function arquivarPares() {
  secao('H) arquivar PARES explícitos (duplicada : preservada), cada um reprovado na hora');
  const pares = String(process.env.PARES || '').split(/[,\s]+/).filter(Boolean).map(p => p.split(':').map(Number));
  if (!pares.length || pares.some(p => p.length !== 2 || p.some(x => !Number.isInteger(x)))) { console.log('  informe PARES=duplicada:preservada,duplicada:preservada,...'); falhas++; return; }
  if (pares.length > 10) { console.log('  mais de 10 pares: recusado'); falhas++; return; }
  const ml = await ler('masterlist', '*');
  const jo = await ler('joiners', 'id, cog, email, twitter'), dem = await ler('pagamento_demandas', 'id, itens'), rep = await ler('repassos', 'id, item_id');
  const env = await ler('envio_solicitacoes', 'id, itens'), loj = await ler('lojinha_repasses', 'id, masterlist_id');
  if (!ml || !jo || !dem || !rep || !env || !loj) { console.log('  leitura incompleta: nada feito'); falhas++; return; }
  const lc = v => n(v).toLowerCase().replace(/\s+/g, ' ');
  const semSkz = t => lc(t).replace(/\s+skz$/, '');
  const emailLimpo = v => { const e = lc(v); return /^[^\s@#]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : ''; };
  const norm = t => String(t).replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const resp = await fetch('https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995');
  if (!resp.ok) { console.log('  não consegui ler a planilha'); falhas++; return; }
  const linhasCsv = (await resp.text()).replace(/^﻿/, '').split('\n'); const hIdx = linhasCsv.findIndex(l => l.includes('ABA'));
  if (hIdx === -1) { console.log('  cabeçalho da planilha não encontrado'); falhas++; return; }
  const records = parse(linhasCsv.slice(hIdx).join('\n'), { columns: true, skip_empty_lines: true });
  const colMap = {}; Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
  const col = (r, ...nomes) => { for (const nm of nomes) { const k = colMap[norm(nm)]; if (k !== undefined) return r[k] ?? ''; } return ''; };
  const rows = records.filter(r => n(col(r, 'ABA / CEG', 'CEG')) && n(col(r, 'NOME DO ITEM')));
  const idx = indexarJoiners(jo, await carregarArrobasAntigos(sb, jo));
  const S = rows.map(r => { const rs = resolverLinha({ twitter: n(col(r, '@')), email: emailLimpo(col(r, 'EMAIL')) }, idx); return { cod: n(col(r, 'ID')), ceg: lc(col(r, 'ABA / CEG', 'CEG')), item: semSkz(col(r, 'NOME DO ITEM')), dono: lc(rs.cog) }; });
  const idsEm = itens => (Array.isArray(itens) ? itens : []).map(e => (e && typeof e === 'object') ? String(e.id ?? e.item_id ?? e.masterlist_id ?? '') : String(e ?? '')).filter(Boolean);
  const refs = id => { const k = String(id); return [dem.some(x => idsEm(x.itens).includes(k)) && 'demanda', rep.some(x => String(x.item_id) === k) && 'repasse', env.some(x => idsEm(x.itens).includes(k)) && 'envio', loj.some(x => String(x.masterlist_id) === k) && 'loja-repasse'].filter(Boolean); };
  const pago = x => !!(x.pago_item || x.pago_frete || x.pago_rf);
  const por = new Map(ml.map(m => [m.id, m]));
  const dupIds = new Set(pares.map(p => p[0]));
  const plano = [], recusadas = [];
  for (const [dupId, keepId] of pares) {
    const d = por.get(dupId), k = por.get(keepId);
    const recusa = m => { recusadas.push({ duplicada: dupId, preservada: keepId, motivo: m }); };
    if (!d || !k) { recusa('uma das linhas não existe'); continue; }
    if (dupIds.has(keepId)) { recusa('a preservada também está na lista de arquivar'); continue; }
    if (n(d.ceg) !== n(k.ceg) || lc(d.cog) !== lc(k.cog) || !lc(d.cog)) { recusa('CEG ou dono diferente (ou sem dono)'); continue; }
    if (semSkz(d.nome_do_item) !== semSkz(k.nome_do_item)) { recusa('produto diferente (mesmo ignorando o SKZ final)'); continue; }
    if (Math.round(Number(d.valor_item || 0) * 100) !== Math.round(Number(k.valor_item || 0) * 100)) { recusa('valor diferente'); continue; }
    if (pago(d)) { recusa('a duplicada tem pagamento registrado'); continue; }
    const { data: mot, error: eM } = await sb.rpc('masterlist_motivos_protecao', { p_id: dupId });
    if (eM || (mot && mot.length)) { recusa('protegida: ' + (eM?.message || mot.join(','))); continue; }
    const rf = refs(dupId); if (rf.length) { recusa('a duplicada tem referência: ' + rf.join(',')); continue; }
    const cd = n(d.id_linha), ck = n(k.id_linha);
    if (!ck || cd === ck) { recusa('a preservada não tem código próprio'); continue; }
    if (cd && S.some(s => s.cod === cd)) { recusa('o código da duplicada existe na planilha'); continue; }
    const sk = S.find(s => s.cod === ck); if (!sk || sk.dono !== lc(k.cog)) { recusa('o código da preservada não está na planilha com o mesmo dono'); continue; }
    const chave = semSkz(k.nome_do_item), naPlanilha = S.filter(s => s.ceg === lc(k.ceg) && s.item === chave && s.dono === lc(k.cog)).length;
    const noBanco = ml.filter(m => lc(m.ceg) === lc(k.ceg) && semSkz(m.nome_do_item) === chave && lc(m.cog) === lc(k.cog)).length;
    const arquivandoNoGrupo = pares.filter(([a]) => { const x = por.get(a); return x && lc(x.ceg) === lc(k.ceg) && semSkz(x.nome_do_item) === chave && lc(x.cog) === lc(k.cog); }).length;
    if (noBanco - arquivandoNoGrupo < naPlanilha) { recusa(`arquivar deixaria o dono com menos linhas (${noBanco - arquivandoNoGrupo}) do que a planilha tem (${naPlanilha})`); continue; }
    plano.push({ duplicada: dupId, preservada: keepId, codigo_duplicada: cd || null, codigo_preservada: ck, ceg: d.ceg, item: d.nome_do_item, preservada_paga: pago(k), prova: `mesmo CEG, dono, produto (ignorando o " SKZ" final) e valor; duplicada livre e sem referências; planilha tem ${naPlanilha} linha(s) do dono neste item e o banco ficará com ${noBanco - arquivandoNoGrupo}` });
  }
  linha('pares informados', pares.length); linha('pares aprovados', plano.length);
  plano.forEach(p => console.log(`  arquivar #${p.duplicada} [${p.codigo_duplicada || '-'}] | preservar #${p.preservada} [${p.codigo_preservada}]${p.preservada_paga ? ' (PAGA, intocada)' : ''} | ${p.ceg} | ${p.item} | ${p.prova}`));
  recusadas.forEach(r => console.log(`  RECUSADO #${r.duplicada}:#${r.preservada}: ${r.motivo}`));
  if (!plano.length) return;
  if (!APLICAR) { console.log('  ENSAIO: nada foi gravado.'); return; }
  const idsDup = plano.map(p => p.duplicada), idsKeep = plano.map(p => p.preservada);
  const { data: fotos, error: eF } = await sb.from('masterlist').select('*').in('id', [...idsDup, ...idsKeep]);
  if (eF || (fotos || []).length !== idsDup.length + idsKeep.length) { console.log(`  não consegui a foto completa (${eF?.message || 'contagem difere'}): NADA foi feito`); falhas++; return; }
  const alteracoes = plano.map(p => ({ tipo: 'linha_arquivada', masterlist_id: p.duplicada, codigo: p.codigo_duplicada, prova: p.prova, preservada: p.preservada, antes: fotos.find(f => f.id === p.duplicada) }));
  const fotosPreservadas = idsKeep.map(id => fotos.find(f => f.id === id));
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_arquivar_pares_plano.json`, { versao: 1, tipo: 'correcao_arquivar_pares', run: RUN, quando: new Date().toISOString(), alteracoes, fotos_das_preservadas: fotosPreservadas, recusadas }); console.log(`  registro privado do plano gravado e conferido: ${g.caminho} (${g.bytes} bytes; bucket ${g.bucket})`); }
  catch (e) { console.log('  ERRO: ' + e.message + ' — NADA foi apagado'); falhas++; return; }
  const { data: rel, error: eP } = await sb.rpc('prune_masterlist', { p_ids: idsDup, p_linhas_planilha: rows.length, p_limite: 25 });
  if (eP || !rel || rel.abortado) { console.log(`  a função recusou: ${eP?.message || JSON.stringify(rel)} — nada foi apagado`); falhas++; return; }
  console.log(`  prune_masterlist: ${JSON.stringify(rel)}`);
  const { data: restam } = await sb.from('masterlist').select('*').in('id', [...idsDup, ...idsKeep]);
  const { data: arqs } = await sb.from('masterlist_exclusoes').select('masterlist_id').in('masterlist_id', idsDup);
  const vivas = new Map((restam || []).map(r => [r.id, r])); const arquivadas = new Set((arqs || []).map(a => a.masterlist_id));
  for (const a of alteracoes) {
    const keep = vivas.get(a.preservada), foto = fotosPreservadas.find(f => f.id === a.preservada);
    const intacta = !!keep && ['pago_item', 'pago_frete', 'pago_rf', 'cog', 'status', 'id_linha', 'valor_item'].every(c => String(keep[c] ?? '') === String(foto[c] ?? ''));
    a.resultado = !vivas.has(a.masterlist_id) && arquivadas.has(a.masterlist_id) && intacta ? 'aplicado' : 'nao_confirmado';
    console.log(`  #${a.masterlist_id}: ${a.resultado} · preservada #${a.preservada}: ${intacta ? 'intacta' : 'ALTERADA OU AUSENTE'}${foto.pago_item ? ' (pago_item continua ' + keep?.pago_item + ')' : ''}`);
  }
  if (alteracoes.some(a => a.resultado !== 'aplicado')) falhas++;
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_arquivar_pares_resultado.json`, { versao: 1, tipo: 'resultado_arquivar_pares', run: RUN, plano: `correcoes/${STAMP}_arquivar_pares_plano.json`, quando: new Date().toISOString(), alteracoes }); console.log(`  registro privado do RESULTADO: ${g.caminho}`); }
  catch (e) { console.log('  ERRO ao gravar o resultado: ' + e.message); falhas++; }
}

// ───────── I) liberar itens: a PLANILHA marca o item como "disponível" (sem dono) e o banco ainda o mantém com um dono. Passa a linha para "disponível" (cog e nome), o mesmo formato das demais linhas sem dono. Nada é apagado.
async function liberarItens() {
  secao('I) liberar itens que a planilha marca como "disponível" (IDS explícitos), cada um reprovado na hora');
  const ids = String(process.env.IDS || '').split(/[,\s]+/).filter(Boolean).map(Number);
  if (!ids.length || ids.some(x => !Number.isInteger(x))) { console.log('  informe IDS=id,id,...'); falhas++; return; }
  if (ids.length > 10) { console.log('  mais de 10 ids: recusado'); falhas++; return; }
  const ml = await ler('masterlist', '*');
  const dem = await ler('pagamento_demandas', 'id, itens'), rep = await ler('repassos', 'id, item_id');
  const env = await ler('envio_solicitacoes', 'id, itens'), loj = await ler('lojinha_repasses', 'id, masterlist_id');
  if (!ml || !dem || !rep || !env || !loj) { console.log('  leitura incompleta: nada feito'); falhas++; return; }
  const semAcento = v => n(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = t => String(t).replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const resp = await fetch('https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995');
  if (!resp.ok) { console.log('  não consegui ler a planilha'); falhas++; return; }
  const linhasCsv = (await resp.text()).replace(/^﻿/, '').split('\n'); const hIdx = linhasCsv.findIndex(l => l.includes('ABA'));
  if (hIdx === -1) { console.log('  cabeçalho da planilha não encontrado'); falhas++; return; }
  const records = parse(linhasCsv.slice(hIdx).join('\n'), { columns: true, skip_empty_lines: true });
  const colMap = {}; Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
  const col = (r, nm) => r[colMap[norm(nm)]] ?? '';
  const rows = records.filter(r => n(col(r, 'ABA / CEG')) && n(col(r, 'NOME DO ITEM')));
  const idsEm = itens => (Array.isArray(itens) ? itens : []).map(e => (e && typeof e === 'object') ? String(e.id ?? e.item_id ?? e.masterlist_id ?? '') : String(e ?? '')).filter(Boolean);
  const refs = id => { const k = String(id); return [dem.some(x => idsEm(x.itens).includes(k)) && 'demanda', rep.some(x => String(x.item_id) === k) && 'repasse', env.some(x => idsEm(x.itens).includes(k)) && 'envio', loj.some(x => String(x.masterlist_id) === k) && 'loja-repasse'].filter(Boolean); };
  const pago = x => !!(x.pago_item || x.pago_frete || x.pago_rf);
  const LIVRE = 'disponível';
  const por = new Map(ml.map(m => [m.id, m]));
  const plano = [], recusadas = [];
  for (const id of ids) {
    const m = por.get(id); const recusa = t => recusadas.push({ id, motivo: t });
    if (!m) { recusa('a linha não existe'); continue; }
    if (semAcento(m.cog) === 'disponivel') { recusa('já está disponível'); continue; }
    const cod = n(m.id_linha); if (!cod) { recusa('a linha não tem código'); continue; }
    const doCod = rows.filter(r => n(col(r, 'ID')) === cod);
    if (!doCod.length) { recusa('o código não existe na planilha'); continue; }
    if (!doCod.every(r => semAcento(col(r, '@')) === 'disponivel' && semAcento(col(r, 'NOME')) === 'disponivel')) { recusa('a planilha tem este código com dono (não é "disponível" em todas as linhas)'); continue; }
    if (pago(m)) { recusa('tem pagamento registrado'); continue; }
    const { data: mot, error: eM } = await sb.rpc('masterlist_motivos_protecao', { p_id: id });
    if (eM || (mot && mot.length)) { recusa('protegida: ' + (eM?.message || mot.join(','))); continue; }
    const rf = refs(id); if (rf.length) { recusa('tem referência: ' + rf.join(',')); continue; }
    plano.push({ id, codigo: cod, ceg: m.ceg, item: m.nome_do_item, valor: Number(m.valor_item || 0), status: m.status, cog_antes: m.cog, nome_antes: m.nome, linhas_planilha: doCod.length, outras_no_banco: ml.filter(x => n(x.id_linha) === cod && x.id !== id).length });
  }
  linha('ids informados', ids.length); linha('aprovados', plano.length);
  plano.forEach(p => console.log(`  liberar #${p.id} [${p.codigo}] | ${p.ceg} | ${p.item} | valor ${p.valor.toFixed(2)} | status "${n(p.status)}" | planilha: ${p.linhas_planilha} linha(s) "disponível" · outras linhas do banco com o mesmo código: ${p.outras_no_banco}`));
  recusadas.forEach(r => console.log(`  RECUSADO #${r.id}: ${r.motivo}`));
  if (!plano.length) return;
  if (!APLICAR) { console.log('  ENSAIO: nada foi gravado.'); return; }
  const alteracoes = plano.flatMap(p => [
    { tipo: 'campo_masterlist', masterlist_id: p.id, campo: 'cog', antes: p.cog_antes, depois: LIVRE, codigo: p.codigo },
    { tipo: 'campo_masterlist', masterlist_id: p.id, campo: 'nome', antes: p.nome_antes, depois: LIVRE, codigo: p.codigo }]);
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_liberar_itens_plano.json`, { versao: 1, tipo: 'correcao_liberar_itens', run: RUN, quando: new Date().toISOString(), alteracoes, recusadas }); console.log(`  registro privado do plano gravado e conferido: ${g.caminho}`); }
  catch (e) { console.log('  ERRO: ' + e.message + ' — NADA foi gravado'); falhas++; return; }
  for (const p of plano) {
    const { error } = await sb.from('masterlist').update({ cog: LIVRE, nome: LIVRE }).eq('id', p.id).eq('cog', p.cog_antes).eq('nome', p.nome_antes).eq('pago_item', false).eq('pago_frete', false).eq('pago_rf', false);
    if (error) { console.log(`  #${p.id}: ERRO ${error.message}`); falhas++; }
  }
  const { data: depois } = await sb.from('masterlist').select('*').in('id', plano.map(p => p.id));
  for (const p of plano) {
    const d = (depois || []).find(x => x.id === p.id);
    const ok = !!d && d.cog === LIVRE && d.nome === LIVRE && String(d.id_linha) === p.codigo && Number(d.valor_item || 0) === p.valor && String(d.status ?? '') === String(p.status ?? '') && !pago(d);
    for (const a of alteracoes.filter(x => x.masterlist_id === p.id)) a.resultado = ok ? 'aplicado' : 'nao_confirmado';
    console.log(`  #${p.id}: ${ok ? 'aplicado (dono agora "disponível"; código, valor e status intactos)' : 'NÃO CONFIRMADO'}`);
    if (!ok) falhas++;
  }
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_liberar_itens_resultado.json`, { versao: 1, tipo: 'resultado_liberar_itens', run: RUN, plano: `correcoes/${STAMP}_liberar_itens_plano.json`, quando: new Date().toISOString(), alteracoes }); console.log(`  registro privado do RESULTADO: ${g.caminho}`); }
  catch (e) { console.log('  ERRO ao gravar o resultado: ' + e.message); falhas++; }
}

// ───────── J) trocar o e-mail do cadastro (ordem explícita da administração). O e-mail novo NUNCA entra como parâmetro (o log do workflow é público): vem só o id do cadastro e o HASH do e-mail; o script acha o e-mail nas linhas da planilha que pertencem a este cadastro e confere o hash.
// Não envia e-mail a ninguém (nem aviso ao e-mail antigo, nem código). Não cria conta. Grava um registro privado com o valor anterior; reversível pela ação "reverter".
async function trocarEmail() {
  secao('J) trocar o e-mail de UM cadastro (id explícito + hash do e-mail novo), reprovado na hora');
  const jid = Number(String(process.env.IDS || '').trim()), hash = String(process.env.EMAIL_HASH || '').trim().toLowerCase();
  if (!Number.isInteger(jid) || !/^[0-9a-f]{8}$/.test(hash)) { console.log('  informe IDS=<id do cadastro> e EMAIL_HASH=<8 hex do sha256 do e-mail novo em minúsculas>'); falhas++; return; }
  const hmail = e => createHash('sha256').update(n(e).toLowerCase()).digest('hex').slice(0, 8);
  const lc = v => n(v).toLowerCase().replace(/\s+/g, ' ');
  const emailLimpo = v => { const e = lc(v); return /^[^\s@#]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : ''; };
  const norm = t => String(t).replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const jo = await ler('joiners', 'id, cog, email, twitter'), contas = await ler('contas_joiner', 'joiner_id', 'joiner_id');
  if (!jo || !contas) { console.log('  leitura incompleta: nada feito'); falhas++; return; }
  const j = jo.find(x => x.id === jid); if (!j) { console.log('  o cadastro não existe'); falhas++; return; }
  if (contas.some(c => c.joiner_id === jid)) { console.log('  RECUSADO: o cadastro já tem conta (a troca de e-mail de quem já tem conta segue o fluxo do site)'); falhas++; return; }
  const resp = await fetch('https://docs.google.com/spreadsheets/d/1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs/export?format=csv&gid=2116437995');
  if (!resp.ok) { console.log('  não consegui ler a planilha'); falhas++; return; }
  const linhasCsv = (await resp.text()).replace(/^﻿/, '').split('\n'); const hIdx = linhasCsv.findIndex(l => l.includes('ABA'));
  if (hIdx === -1) { console.log('  cabeçalho da planilha não encontrado'); falhas++; return; }
  const records = parse(linhasCsv.slice(hIdx).join('\n'), { columns: true, skip_empty_lines: true });
  const colMap = {}; Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
  const col = (r, nm) => r[colMap[norm(nm)]] ?? '';
  const rows = records.filter(r => n(col(r, 'ABA / CEG')) && n(col(r, 'NOME DO ITEM')));
  const idx = indexarJoiners(jo, await carregarArrobasAntigos(sb, jo));
  const dela = rows.filter(r => { const rs = resolverLinha({ twitter: n(col(r, '@')), email: emailLimpo(col(r, 'EMAIL')) }, idx); return lc(rs.cog) === lc(j.cog); });
  const candidatos = [...new Set(dela.map(r => emailLimpo(col(r, 'EMAIL'))).filter(e => e && hmail(e) === hash))];
  linha('linhas da planilha que pertencem a este cadastro', dela.length);
  if (candidatos.length !== 1) { console.log(`  RECUSADO: o hash corresponde a ${candidatos.length} e-mail(s) nas linhas da planilha deste cadastro (precisa ser exatamente 1)`); falhas++; return; }
  const novo = candidatos[0], atual = lc(j.email);
  if (novo === atual) { console.log('  nada a fazer: o cadastro já está com este e-mail'); return; }
  const outros = jo.filter(x => x.id !== jid && lc(x.email) === novo);
  if (outros.length) { console.log(`  RECUSADO: este e-mail já está em outro(s) cadastro(s) (${outros.length}) — caso de ajuda, não de troca`); falhas++; return; }
  let authComEmail = 0;
  for (let p = 1; p < 60; p++) { const { data, error } = await sb.auth.admin.listUsers({ page: p, perPage: 1000 }); if (error) { console.log(`  não consegui listar as contas (${error.message}): nada feito`); falhas++; return; } authComEmail += (data.users || []).filter(u => lc(u.email) === novo).length; if ((data.users || []).length < 1000) break; }
  if (authComEmail) { console.log('  RECUSADO: já existe uma conta de acesso com este e-mail (ligada a outro cadastro ou solta)'); falhas++; return; }
  const mesmoArroba = jo.filter(x => lc(x.twitter).replace(/^@/, '') === lc(j.twitter).replace(/^@/, '') && n(j.twitter)).length;
  const { data: libAntes, error: eLA } = await sb.rpc('vinculo_liberado', { p_joiner_id: jid });
  linha('cadastro', `#${jid} · tinha e-mail: ${atual ? 'SIM' : 'não'} · cadastros com o mesmo @: ${mesmoArroba} · liberado para ativar ANTES: ${eLA ? 'não consegui consultar (' + eLA.message + ')' : libAntes}`);
  console.log(`  e-mail novo (hash ${hash}) está em ${dela.filter(r => emailLimpo(col(r, 'EMAIL')) === novo).length} linha(s) da planilha deste cadastro; nenhum outro cadastro nem conta usa este e-mail`);
  if (!APLICAR) { console.log('  ENSAIO: nada foi gravado.'); return; }
  const alteracoes = [{ tipo: 'joiner_email_troca', joiner_id: jid, antes: j.email ?? null, depois: novo, liberado_antes: eLA ? null : libAntes }];
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_trocar_email_plano.json`, { versao: 1, tipo: 'correcao_trocar_email', run: RUN, quando: new Date().toISOString(), alteracoes }); console.log(`  registro privado do plano gravado e conferido: ${g.caminho}`); }
  catch (e) { console.log('  ERRO: ' + e.message + ' — NADA foi gravado'); falhas++; return; }
  let q = sb.from('joiners').update({ email: novo }).eq('id', jid); q = j.email == null ? q.is('email', null) : q.eq('email', j.email);
  const { error: eU } = await q; if (eU) { console.log(`  ERRO ao gravar: ${eU.message}`); falhas++; return; }
  const { data: dep } = await sb.from('joiners').select('id, email, cog, twitter').eq('id', jid).maybeSingle();
  let ok = !!dep && lc(dep.email) === novo && dep.cog === j.cog && n(dep.twitter) === n(j.twitter);
  const { data: libDepois, error: eLD } = await sb.rpc('vinculo_liberado', { p_joiner_id: jid });
  linha('liberado para ativar DEPOIS', eLD ? 'não consegui consultar (' + eLD.message + ')' : libDepois);
  if (ok && libAntes === true && libDepois === false) {
    const { error: eR } = await sb.from('joiners').update({ email: j.email ?? null }).eq('id', jid).eq('email', novo);
    console.log(`  a troca faria o cadastro PERDER a liberação: desfeita automaticamente${eR ? ' (ERRO ao desfazer: ' + eR.message + ')' : ''}`); ok = false; falhas++;
  }
  alteracoes[0].resultado = ok ? 'aplicado' : 'nao_confirmado'; alteracoes[0].liberado_depois = eLD ? null : libDepois;
  console.log(`  cadastro #${jid}: ${ok ? 'e-mail trocado (cog e @ intactos)' : 'NÃO APLICADO/NÃO CONFIRMADO'}`);
  try { const g = await gravarRegistro(sb, `correcoes/${STAMP}_trocar_email_resultado.json`, { versao: 1, tipo: 'resultado_trocar_email', run: RUN, plano: `correcoes/${STAMP}_trocar_email_plano.json`, quando: new Date().toISOString(), alteracoes }); console.log(`  registro privado do RESULTADO: ${g.caminho}`); }
  catch (e) { console.log('  ERRO ao gravar o resultado: ' + e.message); falhas++; }
}

if (ACAO === 'registrar-aplicadas') await registrarAplicadas();
if (ACAO === 'arquivar-pares') await arquivarPares();
if (ACAO === 'liberar-itens') await liberarItens();
if (ACAO === 'trocar-email') await trocarEmail();
if (ACAO === 'sync-indevido') await corrigirSyncIndevido();
if (ACAO === 'arquivar-copias') await arquivarCopias();
if (ACAO === 'reverter') await reverter();
if (ACAO === 'verificar-registro') await verificarRegistro();
if (ACAO === 'email' || ACAO === 'todas') await corrigirEmail();
if (ACAO === 'demandas' || ACAO === 'todas') await corrigirDemandas();
console.log(`\nFim. ${APLICAR ? 'Gravações feitas conforme acima.' : 'ENSAIO: nada foi gravado.'}${falhas ? ` ${falhas} falha(s).` : ''}`);
process.exit(falhas ? 1 : 0);
