import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import ws from 'ws';
import { montarUpsertJoiner, carregarIdsComConta, carregarIdsEmailTrocado, emailPlanilhaDivergeDoTrocado } from './preservar-email.js';
import { casarPorIdLinha, casarChavesRepetidas, adotarCodigoSemChave } from './casar-itens.js';
import { indexarJoiners, resolverLinha, cogDoUpsert, joinerExistente } from './resolver-joiner.js';
import { carregarArrobasAntigos } from './arrobas-antigos.js';
import { gravarRegistro } from './registro-privado.mjs';

const SHEET_ID = '1jMwVDT1AQBJpvZP6kVhDD0z8zZxBrHU3KuyRA-G4HBs';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=2116437995`;
// SIMULAÇÃO (SYNC_DRY_RUN=1): lê a planilha e o banco, faz TODO o casamento e conta o que seria atualizado/inserido/apagado, mas NÃO grava nada (nem masterlist, nem joiners, nem push, nem a exclusão protegida).
const SIMULACAO = process.env.SYNC_DRY_RUN === '1';
// EXECUÇÃO CONTROLADA (todos desligados por padrão: o comportamento normal do sync não muda):
//  SYNC_SEM_EXCLUSAO=1  interruptor PRÓPRIO: nenhuma exclusão (prune_masterlist nem é chamada), independente do limite de 25.
//  SYNC_PROTEGER=1      atualização NUNCA troca o dono da linha (a linha inteira fica como está) e NUNCA desmarca pagamento (pago_* true continua true).
//  SYNC_JOINERS=todos|somente-novos|nenhum   somente-novos: cria cadastro que não existe e NÃO altera nenhum cadastro existente; nenhum: não mexe em joiners.
//  SYNC_REGISTRO=1      grava o PLANO (valores anteriores) e o RESULTADO no registro privado; se o plano não for gravado e conferido, NADA é gravado no banco. Ignorado na simulação.
const SEM_EXCLUSAO = process.env.SYNC_SEM_EXCLUSAO === '1';
const PROTEGER = process.env.SYNC_PROTEGER === '1';
const MODO_JOINERS = ['todos', 'somente-novos', 'nenhum'].includes(process.env.SYNC_JOINERS) ? process.env.SYNC_JOINERS : 'todos';
const REGISTRO = process.env.SYNC_REGISTRO === '1' && !SIMULACAO;
const STATUS_ORDEM = { 'Comprado': 0, 'A Caminho': 1, 'ANTIGOM': 2, 'Envio Liberado': 3, 'Enviado Nacional': 4 };   // só para o SYNC_PROTEGER: status conhecido que voltaria para trás é mantido
const ADIAR_ESCRITA = SIMULACAO || REGISTRO;   // atualizações são planejadas primeiro (registro) e só depois executadas

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { realtime: { transport: ws } }
);

function parseBRL(str) {
  if (!str || str.trim() === '') return 0;
  let cleaned = str.replace(/R\$\s*/g, '').trim();
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{3}/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '');
  }
  return parseFloat(cleaned) || 0;
}

// O sync só manda UPDATE para a linha que MUDOU (antes mandava 7,5 mil UPDATEs por execução, mesmo sem mudança nenhuma: ~20 min de carga no banco).
// Compara exatamente os campos que o UPDATE gravaria. Na dúvida, atualiza: coluna que não veio do banco (undefined) ou valor que não bate = "mudou".
// SYNC_ATUALIZAR_TUDO=1 volta ao comportamento antigo (atualiza todas).
const CAMPOS_COMPARADOS = ['ceg', 'cog', 'nome', 'nome_do_item', 'id_linha', 'valor_item', 'frete_inter', 'taxa_rf', 'info_adicionais',
  'pago_item', 'pago_frete', 'pago_rf', 'venc_item', 'venc_frete', 'venc_rf', 'status'];
const CAMPOS_NUMERICOS = new Set(['valor_item', 'frete_inter', 'taxa_rf']);
// Quais campos o UPDATE mudaria (mesma comparação de linhaMudou, campo a campo).
function camposMudados(existente, novo) {
  const out = [];
  for (const c of CAMPOS_COMPARADOS) {
    const noBanco = existente[c];
    if (noBanco === undefined) { out.push(c); continue; }
    const daPlanilha = novo[c] ?? null;
    if (CAMPOS_NUMERICOS.has(c)) { if (noBanco === null || daPlanilha === null || Math.round(Number(noBanco) * 100) !== Math.round(Number(daPlanilha) * 100)) out.push(c); }
    else if (noBanco !== daPlanilha) out.push(c);
  }
  return out;
}
function linhaMudou(existente, novo) {
  for (const c of CAMPOS_COMPARADOS) {
    const noBanco = existente[c];
    if (noBanco === undefined) return true;
    const daPlanilha = novo[c] ?? null;
    if (CAMPOS_NUMERICOS.has(c)) {
      if (noBanco === null || daPlanilha === null || Math.round(Number(noBanco) * 100) !== Math.round(Number(daPlanilha) * 100)) return true;
    } else if (noBanco !== daPlanilha) return true;
  }
  return false;
}

// O log do GitHub deste repositório é PÚBLICO: @, e-mail e nome de pessoa NUNCA vão para o log. Quando for preciso apontar "qual cadastro", usa-se uma marca (hash curto do valor em minúsculas) que permite conferir sem expor a pessoa.
const anon = v => 'h:' + createHash('sha256').update(String(v ?? '').trim().toLowerCase().replace(/^@/, '')).digest('hex').slice(0, 8);
const anonDetalhe = d => d && typeof d === 'object' ? Object.fromEntries(Object.entries(d).map(([k, v]) => [k, /cog|arroba|email|twitter/i.test(k) ? anon(v) : v])) : d;

// Célula com ERRO DE FÓRMULA da planilha (#N/A, #REF!, #VALUE!...) não é dado: em 13/11/2026 havia 20 e-mails e 5 nomes assim, e o sync gravava "#n/a" como e-mail do cadastro (por cima do e-mail real de quem ainda não tinha conta).
// E-mail que não parece e-mail também é tratado como CÉLULA VAZIA (o e-mail que já está no banco fica como está).
const ERRO_FORMULA = /^#(N\/A|REF!?|VALUE!?|NAME\??|DIV\/0!?|NUM!?|NULL!?|ERROR!?)/i;
const EMAIL_VALIDO = /^[^\s@#]+@[^\s@]+\.[^\s@]+$/;
const emailLimpo = v => { const e = String(v ?? '').trim().toLowerCase(); return EMAIL_VALIDO.test(e) ? e : ''; };
const nomeLimpo = v => { const n = String(v ?? '').trim(); return ERRO_FORMULA.test(n) ? '' : n; };

// Data SEM ANO na planilha ("20/12"): o CSV traz só o que a célula mostra, e o sync assumia o ano da execução. Na virada de ano (e a cada nova execução em outro ano) toda data assim seria reescrita com o ano novo
// (103 linhas em 13/11/2026). Se o banco já tem uma data com o MESMO dia e mês, o ano que está no banco é mantido; só uma data realmente nova usa o ano atual.
const dataSemAno = s => /^\d{1,2}\/\d{1,2}$/.test(String(s ?? '').trim());
const dataIso = v => v == null ? null : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const manterAnoDoBanco = (textoPlanilha, novo, doBanco) => {
  const atual = dataIso(doBanco);
  return (novo && atual && dataSemAno(textoPlanilha) && atual.slice(5) === novo.slice(5)) ? atual : novo;
};

// Normaliza nome de coluna: minúsculo, sem espaços extras, sem BOM
function norm(str) {
  return str.replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Busca valor no registro pelo nome normalizado da coluna
function col(record, colMap, ...names) {
  for (const name of names) {
    const key = colMap[norm(name)];
    if (key !== undefined) return record[key] ?? '';
  }
  return '';
}

async function main() {
  if (SIMULACAO) console.log('=== SIMULAÇÃO (SYNC_DRY_RUN=1): NADA será gravado no banco ===');
  console.log('Buscando planilha...');
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Falha ao buscar CSV: ${res.status}`);
  const text = await res.text();

  // Encontra a linha do cabeçalho real procurando por "ABA"
  const allLines = text.replace(/^﻿/, '').split('\n');
  const headerIdx = allLines.findIndex(l => l.includes('ABA'));
  if (headerIdx === -1) throw new Error('Cabeçalho não encontrado no CSV');
  console.log(`Cabeçalho na linha ${headerIdx + 1}: ${allLines[headerIdx].slice(0, 80)}`);
  const csvFromHeader = allLines.slice(headerIdx).join('\n');
  const records = parse(csvFromHeader, { columns: true, skip_empty_lines: true });
  console.log(`${records.length} linhas encontradas na planilha`);

  if (records.length === 0) { console.log('Planilha vazia.'); return; }

  // Monta mapa de colunas normalizadas → nome real
  const colMap = {};
  Object.keys(records[0]).forEach(k => { colMap[norm(k)] = k; });
  console.log('Colunas:', Object.keys(colMap).join(' | '));

  // Carregar joiners para lookup
  const { data: joiners, error: erroJoiners } = await supabase.from('joiners').select('id, cog, email, twitter, confirmado').order('id', { ascending: true });
  // Sem esta leitura o sync não sabe quem já existe nem quem tem conta: continuaria às cegas e poderia trocar o e-mail verificado de uma conta. Melhor parar sem gravar nada.
  if (erroJoiners || !Array.isArray(joiners)) throw new Error(`Não consegui ler as joiners (${erroJoiners?.message || 'sem dados'}). Nada foi gravado.`);
  // Quem disputa o mesmo @/e-mail (ex.: "Seopookie" e "seopookie"): a regra de desempate é fixa e o upsert nunca cria gêmeo (ver resolver-joiner.js).
  // @ ANTIGOS registrados nas trocas: se a planilha ainda mostra o @ de antes, a pessoa continua sendo a MESMA (o cadastro e o cog originais ficam; nada é movido nem criado).
  // Se mais de um cadastro é possível (@ antigo ligado a dois cadastros, ou igual ao cog/@ de outro), o sync NÃO decide: registra o conflito e deixa tudo como está.
  const arrobasAntigos = await carregarArrobasAntigos(supabase, joiners);
  const idxJoiners = indexarJoiners(joiners, arrobasAntigos);
  const conflitos = [];                                   // { onde, tipo, chave, candidatos, detalhe }
  const avisosArrobaAntigo = new Set();                   // cogs cuja planilha ainda mostra o @ antigo (a planilha precisa ser corrigida; nada é sobrescrito)
  const registrarConflito = (onde, resolucao, detalhe) => conflitos.push({ onde, tipo: resolucao.conflito.tipo, chave: resolucao.conflito.chave, candidatos: resolucao.conflito.candidatos, detalhe });

  // Carregar masterlist existente paginada (Supabase limita 1000 por query)
  // existingMap: chave → array de itens (suporta duplicatas)
  // Um erro ou uma leitura vazia NUNCA pode virar "o banco está vazio": em 03/11 uma leitura vazia fez este sync inserir 7.532 cópias de linhas que já existiam.
  const { count: totalEsperado, error: erroContagem } = await supabase.from('masterlist').select('id', { count: 'exact', head: true });
  if (erroContagem || totalEsperado == null) throw new Error(`Não consegui contar a masterlist (${erroContagem?.message || 'sem contagem'}). Nada foi gravado.`);
  const existingMap = {};
  let from = 0;
  while (true) {
    let page = null, erroPagina = null;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      ({ data: page, error: erroPagina } = await supabase
        .from('masterlist')
        .select('id, ceg, nome_do_item, nome, status, pago_item, pago_frete, pago_rf, id_linha, cog, valor_item, frete_inter, taxa_rf, info_adicionais, venc_item, venc_frete, venc_rf')
        .order('id', { ascending: true })
        .range(from, from + 999));
      if (!erroPagina) break;
      await new Promise(r => setTimeout(r, 2000 * tentativa));
    }
    if (erroPagina) throw new Error(`Falha ao ler a masterlist a partir da linha ${from}: ${erroPagina.message}. Nada foi gravado.`);
    if (!page || page.length === 0) break;
    page.forEach(item => {
      const key = `${item.ceg}|${item.nome_do_item}|${item.nome}`.toLowerCase();
      if (!existingMap[key]) existingMap[key] = [];
      existingMap[key].push(item);
    });
    if (page.length < 1000) break;
    from += 1000;
  }
  const totalNoBanco = Object.values(existingMap).reduce((a, v) => a + v.length, 0); // ANTES do casamento por código: é a base da trava de planilha parcial
  const todosBanco = Object.values(existingMap).flat();   // todas as linhas do banco, antes de qualquer casamento (diagnóstico)
  const codigosBanco = new Set(Object.values(existingMap).flat().map(x => String(x.id_linha ?? '').trim()).filter(Boolean)); // TODOS os códigos que o banco já tem (para a adoção)
  console.log(`${totalNoBanco} itens existentes no banco`);
  // A leitura tem que bater com a contagem do banco (tolera a diferença de linhas criadas pelo site no meio do caminho).
  if (Math.abs(totalNoBanco - totalEsperado) > Math.max(25, totalEsperado * 0.01)) {
    throw new Error(`Leitura incompleta: li ${totalNoBanco} linhas, mas o banco tem ${totalEsperado}. Nada foi gravado.`);
  }

  const rows = records.filter(r =>
    col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim() &&
    col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim()
  );

  console.log(`${rows.length} linhas válidas após filtro`);

  // Trava contra inserção em massa: banco muito menor que a planilha = leitura falhou ou banco vazio, não "tudo é novo".
  if (totalNoBanco < rows.length * 0.5 && process.env.SYNC_PERMITIR_BANCO_VAZIO !== '1') {
    throw new Error(`O banco tem ${totalNoBanco} linhas e a planilha ${rows.length}: parece leitura incompleta ou banco vazio. Nada foi gravado. Se for uma carga inicial de verdade, rode com SYNC_PERMITIR_BANCO_VAZIO=1.`);
  }
  const MAX_INSERCOES = Number(process.env.SYNC_MAX_INSERCOES || 500); // limite de linhas novas por execução (a maior carga legítima de 2026 foi 299)
  let bloqueadasPorLimite = 0;

  // Casa primeiro pelo CÓDIGO da planilha (coluna ID = id_linha): a linha continua a MESMA (mesmo id) mesmo que o nome do item, o nome de exibição ou o dono mudem.
  // Sem isso a regra antiga (ceg|item|nome) insere uma linha nova e apaga a antiga, e as demandas de pagamento ficam apontando para um id que não existe mais.
  // O DONO da linha da planilha é calculado como no laço abaixo (@ → joiner cadastrada; senão o próprio @/e-mail): um id NUNCA muda de dono por causa de um código.
  const cogDe = r => resolverLinha({ twitter: col(r, colMap, '@'), email: emailLimpo(col(r, colMap, 'EMAIL')) }, idxJoiners).cog;   // conflito => null (a linha não casa com nada e não é tocada)
  const casamento = casarPorIdLinha(
    rows.map(r => ({ idLinha: col(r, colMap, 'ID').trim(), ceg: col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim(), item: col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim(), cog: cogDe(r) })),
    Object.values(existingMap).flat()
  );
  // as linhas já reivindicadas saem do casamento por chave/ordem (e, por consequência, nunca entram na exclusão)
  for (const k of Object.keys(existingMap)) existingMap[k] = existingMap[k].filter(x => !casamento.reivindicados.has(x.id));
  // Desempate pelo DONO entre linhas SEM código com a MESMA chave (ex.: duas joiners com o mesmo nome de exibição): evita que os donos TROQUEM de id quando a ordem da planilha muda.
  const desempate = casarChavesRepetidas(
    rows.map((r, indice) => ({ indice, r })).filter(x => !casamento.porIndice.has(x.indice))
        .map(x => ({ indice: x.indice, chave: `${col(x.r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim()}|${col(x.r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim()}|${col(x.r, colMap, 'NOME').trim()}`.toLowerCase(), cog: cogDe(x.r) })),
    Object.entries(existingMap).flatMap(([k, arr]) => arr.map(x => ({ id: x.id, chave: k, cog: x.cog, item: x })))
  );
  for (const k of Object.keys(existingMap)) existingMap[k] = existingMap[k].filter(x => !desempate.reivindicados.has(x.id));
  // ADOÇÃO DO CÓDIGO (casar-itens.js, etapa 3): linha da planilha com código NOVO e sem par pela chave (o NOME de exibição mudou junto com o código) adota a linha ANTIGA sem código do mesmo CEG/item/dono,
  // em vez de inserir uma cópia. Roda só nas linhas que ficariam sem par; compra repetida com par pela chave nunca é tocada.
  const codigosPlanilha = new Map();
  for (const r of rows) { const c = col(r, colMap, 'ID').trim(); if (c) codigosPlanilha.set(c, (codigosPlanilha.get(c) || 0) + 1); }
  const chaveDe = r => `${col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim()}|${col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim()}|${col(r, colMap, 'NOME').trim()}`.toLowerCase();
  const adocao = adotarCodigoSemChave(
    rows.map((r, indice) => ({ indice, r })).filter(x => !casamento.porIndice.has(x.indice) && !desempate.porIndice.has(x.indice))
        .map(x => ({ indice: x.indice, chave: chaveDe(x.r), idLinha: col(x.r, colMap, 'ID').trim(), ceg: col(x.r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim(), item: col(x.r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim(), cog: cogDe(x.r) })),
    Object.entries(existingMap).flatMap(([k, arr]) => arr.map(x => ({ id: x.id, chave: k, id_linha: x.id_linha, ceg: x.ceg, nome_do_item: x.nome_do_item, cog: x.cog, item: x }))),
    { codigosPlanilha, codigosBanco }
  );
  for (const k of Object.keys(existingMap)) existingMap[k] = existingMap[k].filter(x => !adocao.reivindicados.has(x.id));
  const blindadasAmbiguas = new Set(adocao.ambiguos.flatMap(a => a.idsBanco)); // grupo ambíguo: as linhas antigas NÃO são candidatas à exclusão (a ordem não prova qual é qual)
  if (adocao.ambiguos.length) {
    console.log(`ADOÇÃO DE CÓDIGO: ${adocao.ambiguos.length} grupo(s) AMBÍGUO(S) deixados sem alteração (mais de uma linha igual — mesmo CEG, item e dono — sem código; a ordem não prova identidade):`);
    adocao.ambiguos.slice(0, 40).forEach(a => console.log(`  ${a.grupo} | planilha: ${a.linhasPlanilha} · banco: ${a.linhasBanco}`));
    if (adocao.ambiguos.length > 40) console.log(`  ... e mais ${adocao.ambiguos.length - 40}`);
  }
  let desempatadasPeloDono = 0, adotadas = 0;
  let casadosPorCodigo = 0, renomeadosPorCodigo = 0;

  let updated = 0, inserted = 0, erros = 0, comData = 0, semMudanca = 0;
  const atualizarTudo = process.env.SYNC_ATUALIZAR_TUDO === '1';
  const mudancasStatus = []; // { cog, nomeItem, ceg, statusNovo }
  const novosItens = [];     // { cog, nomeItem, ceg }
  const planoInsercoes = []; // simulação: linhas que SERIAM inseridas (código | CEG | item; sem dono)
  const planoAtualizacoes = [], bloqueadasPorDono = [], pagamentosMantidos = [], detalheProtecao = [], statusMantidos = [], precosMantidos = [];   // execução controlada / simulação: o que mudaria em cada linha (ver ADIAR_ESCRITA)
  const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
  const insercoesPendentes = []; // linhas da planilha sem par: só são inseridas depois da checagem de suspeita (abaixo)
  // Rastreia quantas vezes cada chave apareceu na planilha (para duplicatas)
  const sheetKeyCount = {};

  for (const [idxLinha, r] of rows.entries()) {
    try {
      const ceg      = col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG').trim();
      const nome     = col(r, colMap, 'NOME').trim();
      const nomeItem = col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c').trim();
      const twitter  = col(r, colMap, '@').trim().replace(/^@/, '').toLowerCase();
      const email    = emailLimpo(col(r, colMap, 'EMAIL'));
      const chegou    = col(r, colMap, 'Chegou?', 'CHEGOU?').trim().toUpperCase() === 'TRUE';
      const nacional  = col(r, colMap, 'NACIONAL').trim().toUpperCase() === 'TRUE';
      const pagoItem  = col(r, colMap, 'ITEM').trim().toUpperCase() === 'TRUE';
      const pagoFrete = col(r, colMap, 'FRETE').trim().toUpperCase() === 'TRUE';
      const pagoRf    = col(r, colMap, 'RF').trim().toUpperCase() === 'TRUE';
      const idLinha   = col(r, colMap, 'ID').trim() || null;

      const resol = resolverLinha({ twitter, email }, idxJoiners);
      if (resol.conflito) {
        // mais de um cadastro possível: NÃO move item, NÃO cria cadastro, NÃO atualiza a linha. A linha do banco (se existir) é protegida da exclusão (conta como presente na planilha).
        registrarConflito('masterlist', resol, { ceg, item: nomeItem, id_linha: col(r, colMap, 'ID').trim() || null });
        const chaveProtegida = `${ceg}|${nomeItem}|${nome}`.toLowerCase();
        sheetKeyCount[chaveProtegida] = (sheetKeyCount[chaveProtegida] || 0) + 1;
        continue;
      }
      const cog = resol.cog;
      if (resol.via === 'arroba_antigo') avisosArrobaAntigo.add(cog);

      const parseDate = str => {
        if (!str || !str.trim()) return null;
        const s = str.trim();
        const brFull = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (brFull) return `${brFull[3]}-${brFull[2].padStart(2,'0')}-${brFull[1].padStart(2,'0')}`;
        const brShort = s.match(/^(\d{1,2})\/(\d{1,2})$/);
        if (brShort) return `${new Date().getFullYear()}-${brShort[2].padStart(2,'0')}-${brShort[1].padStart(2,'0')}`;
        const isoMatch = s.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isoMatch) return s;
        return null;
      };

      // Preço DESCONHECIDO (célula em branco ou erro de fórmula) não é o mesmo que preço ZERO ("R$ 0,00"): o banco guarda 0 nos dois casos (0 = não cobrado), mas o sync protegido nunca apaga um preço já conhecido por causa de uma célula em branco.
      const emBranco = cel => { const t = String(cel ?? '').trim(); return !t || /^#/.test(t); };
      const precoBranco = { valor_item: emBranco(col(r, colMap, 'PREÇO ITEM', 'PRECO ITEM')), frete_inter: emBranco(col(r, colMap, 'PREÇO FRETE', 'FRETE INTER', 'PRECO FRETE')), taxa_rf: emBranco(col(r, colMap, 'PREÇO RF', 'PRECO RF')) };
      const baseFields = {
        ceg, cog, nome,
        nome_do_item:    nomeItem,
        id_linha:        idLinha,
        valor_item:      parseBRL(col(r, colMap, 'PREÇO ITEM', 'PRECO ITEM')),
        frete_inter:     parseBRL(col(r, colMap, 'PREÇO FRETE', 'FRETE INTER', 'PRECO FRETE')),
        taxa_rf:         parseBRL(col(r, colMap, 'PREÇO RF', 'PRECO RF')),
        info_adicionais: col(r, colMap, 'INFORMAÇÕES', 'INFORMACOES').trim() || null,
        pago_item:  pagoItem,
        pago_frete: pagoFrete,
        pago_rf:    pagoRf,
        venc_item:  parseDate(col(r, colMap, 'ITEM DATA')),
        venc_frete: parseDate(col(r, colMap, 'FRETE DATA')),
        venc_rf:    parseDate(col(r, colMap, 'RF DATA')),
      };

      const freteVal = parseBRL(col(r, colMap, 'PREÇO FRETE', 'FRETE INTER', 'PRECO FRETE'));
      const rfVal    = parseBRL(col(r, colMap, 'PREÇO RF', 'PRECO RF'));
      const status = nacional       ? 'Enviado Nacional'
                   : chegou         ? 'Envio Liberado'
                   : rfVal > 0      ? 'ANTIGOM'
                   : freteVal > 0   ? 'A Caminho'
                   : 'Comprado';

      const key = `${ceg}|${nomeItem}|${nome}`.toLowerCase();
      let existingItem = casamento.porIndice.get(idxLinha); // 1º: pelo código da planilha (mesmo id e mesmo dono)
      const doDesempate = !existingItem && desempate.porIndice.has(idxLinha);
      if (doDesempate) { existingItem = desempate.porIndice.get(idxLinha).item; desempatadasPeloDono++; }
      else if (!existingItem && adocao.porIndice.has(idxLinha)) { existingItem = adocao.porIndice.get(idxLinha).item; adotadas++; }
      else if (existingItem) {
        casadosPorCodigo++;
        if (`${existingItem.ceg}|${existingItem.nome_do_item}|${existingItem.nome}`.toLowerCase() !== key) renomeadosPorCodigo++;
      } else {
        sheetKeyCount[key] = (sheetKeyCount[key] || 0) + 1;
        const occIdx = sheetKeyCount[key] - 1; // 0 = primeira ocorrência
        const existingArr = existingMap[key] || [];
        existingItem = existingArr[occIdx]; // pega o item correspondente por ordem
      }

      if (existingItem) {
        baseFields.venc_item  = manterAnoDoBanco(col(r, colMap, 'ITEM DATA'),  baseFields.venc_item,  existingItem.venc_item);
        baseFields.venc_frete = manterAnoDoBanco(col(r, colMap, 'FRETE DATA'), baseFields.venc_frete, existingItem.venc_frete);
        baseFields.venc_rf    = manterAnoDoBanco(col(r, colMap, 'RF DATA'),    baseFields.venc_rf,    existingItem.venc_rf);
      }
      if (baseFields.venc_item || baseFields.venc_frete || baseFields.venc_rf) comData++;
      if (existingItem) {
        const novoReg = { ...baseFields, status };
        let bloqueadoPorDono = false;
        if (PROTEGER) {
          // execução controlada: o sync não troca o dono de linha existente nem desmarca pagamento (a planilha pode estar atrasada em relação ao site)
          if (String(existingItem.cog ?? '') !== String(novoReg.cog ?? '')) { bloqueadoPorDono = true; detalheProtecao.push(`#${existingItem.id} | ${existingItem.id_linha || '-'} | ${existingItem.ceg} | ${existingItem.nome_do_item} | o DONO mudaria: banco ${anon(existingItem.cog)} -> planilha ${anon(novoReg.cog)} (linha NÃO atualizada)`); }
          else if (STATUS_ORDEM[existingItem.status] != null && STATUS_ORDEM[novoReg.status] != null && STATUS_ORDEM[novoReg.status] < STATUS_ORDEM[existingItem.status]) {
            // a planilha atrasada não faz o item andar para trás (ex.: Envio Liberado → Comprado): o status do banco fica; o resto da atualização segue
            detalheProtecao.push(`#${existingItem.id} | ${existingItem.id_linha || '-'} | ${existingItem.ceg} | ${existingItem.nome_do_item} | o STATUS voltaria de "${existingItem.status}" para "${novoReg.status}" (status MANTIDO)`); statusMantidos.push(existingItem.id); novoReg.status = existingItem.status;
          }
          if (!bloqueadoPorDono) for (const c of ['valor_item', 'frete_inter', 'taxa_rf']) if (precoBranco[c] && Number(existingItem[c]) > 0 && Number(novoReg[c] || 0) === 0) {
            novoReg[c] = existingItem[c]; precosMantidos.push(`${existingItem.id}:${c}`);
            detalheProtecao.push(`#${existingItem.id} | ${existingItem.id_linha || '-'} | ${existingItem.ceg} | ${existingItem.nome_do_item} | ${c} = ${Number(existingItem[c]).toFixed(2)} no banco e a célula da planilha está EM BRANCO (preço desconhecido, não zero): valor MANTIDO`);
          }
          if (!bloqueadoPorDono) for (const c of ['pago_item', 'pago_frete', 'pago_rf']) if (existingItem[c] === true && novoReg[c] === false) { novoReg[c] = true; pagamentosMantidos.push(`${existingItem.id}:${c}`); detalheProtecao.push(`#${existingItem.id} | ${existingItem.id_linha || '-'} | ${existingItem.ceg} | ${existingItem.nome_do_item} | ${c} está marcado no banco e a planilha desmarcaria (marcação MANTIDA)`); }
        }
        if (bloqueadoPorDono) {
          bloqueadasPorDono.push(existingItem.id); semMudanca++;
        } else if (!atualizarTudo && !linhaMudou(existingItem, novoReg)) {
          semMudanca++;
        } else {
          const mudados = camposMudados(existingItem, novoReg);
          if (ADIAR_ESCRITA) {
            const pegar = (o, cs) => Object.fromEntries(cs.map(c => [c, o[c] ?? null]));
            planoAtualizacoes.push({ id: existingItem.id, cod: existingItem.id_linha ?? null, campos: mudados, antes: pegar(existingItem, mudados), depois: pegar(novoReg, mudados), payload: novoReg });
          } else {
            const { error } = await supabase.from('masterlist').update(novoReg).eq('id', existingItem.id);
            if (error) throw error;
          }
          if (existingItem.status !== status && cog) {
            mudancasStatus.push({ cog, nomeItem, ceg, statusNovo: status });
          }
          updated++;
        }
      } else {
        insercoesPendentes.push({ baseFields, status, cog, nomeItem, ceg, idLinha, precoBranco: precoBranco.valor_item });
      }
    } catch (err) {
      console.error(`Erro:`, err.message);
      erros++;
    }
  }

  // Linhas do banco que ficaram SEM PAR na planilha (candidatas à exclusão). Calculado ANTES de inserir, para proteger os casos suspeitos.
  const candidatas = [];
  for (const [key, items] of Object.entries(existingMap)) {
    const countInSheet = sheetKeyCount[key] || 0;
    for (let i = countInSheet; i < items.length; i++) { if (blindadasAmbiguas.has(items[i].id)) continue; candidatas.push(items[i]); }
  }
  // INSERÇÃO SUSPEITA: linha da planilha sem par que COLIDE com linha do banco que a planilha não reconhece — (1) o código dela já existe numa dessas linhas (dono diferente: repasse? correção de cadastro? código repetido?) ou
  // (2) há linha dessas com o mesmo CEG e item (troca de dono/nome ou compra nova: a ordem não prova qual). Sem prova NADA é inserido e NADA dessas linhas é apagado: fica como pendência no log para decisão com evidência.
  const normTxt = v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const sob = [...candidatas, ...todosBanco.filter(x => blindadasAmbiguas.has(x.id))];   // sem par na planilha, ou em grupo ambíguo
  const sobPorCodigo = new Map(), sobPorItem = new Map();
  const empilha = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const x of sob) { const c = String(x.id_linha ?? '').trim(); if (c) empilha(sobPorCodigo, c, x); empilha(sobPorItem, `${normTxt(x.ceg)}|${normTxt(x.nome_do_item)}`, x); }
  // CÓPIA PROVADA: linha do banco SEM PAR que é, sem dúvida, cópia de uma linha PAREADA (a mesma compra registrada duas vezes) não pode ser a origem de uma troca de dono, então NÃO impede a inserção de outra pessoa no mesmo CEG + item.
  // Só vale com prova nos dois lados, e nunca para linha sem código do MESMO dono de linha pareada (isso pode ser compra repetida: continua retida):
  //   (1) mesmo CEG + item + CÓDIGO + dono de uma linha pareada (um código é uma unidade só);
  //   (2) o dono da linha é um apelido (@ ou e-mail) DIGITADO numa linha da planilha do mesmo CEG + item que resolve para OUTRO cadastro (a mesma pessoa), e esse cadastro já tem, pareadas, linhas para TODAS as suas linhas da planilha
  //       desse CEG + item; se a linha tem código, é o mesmo código de uma linha pareada desse cadastro.
  const semParIds = new Set(sob.map(x => x.id));
  const pareadas = todosBanco.filter(x => !semParIds.has(x.id));
  const itemKey = (ceg, item) => `${normTxt(ceg)}|${normTxt(item)}`;
  const linhasPlanilha = rows.map(r => ({ item: itemKey(col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG'), col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c')), dono: normTxt(cogDe(r)), tw: normTxt(col(r, colMap, '@')).replace(/^@/, ''), em: normTxt(emailLimpo(col(r, colMap, 'EMAIL'))) }));
  const codDe = x => String(x.id_linha ?? '').trim();
  const copiasProvadas = new Set();
  const ehCopiaProvada = x => {
    if (copiasProvadas.has(x.id)) return true;
    const k = itemKey(x.ceg, x.nome_do_item), c = normTxt(x.cog), cod = codDe(x);
    if (!c) return false;
    let prova = false;
    if (cod && pareadas.some(y => codDe(y) === cod && itemKey(y.ceg, y.nome_do_item) === k && normTxt(y.cog) === c)) prova = true;                                  // (1)
    else {                                                                                                                                                           // (2)
      const rs = linhasPlanilha.filter(r => r.item === k && r.dono && r.dono !== c && (r.tw === c || r.em === c));
      const donos = new Set(rs.map(r => r.dono));
      if (donos.size === 1) {
        const O = [...donos][0];
        const naPlanilha = linhasPlanilha.filter(r => r.item === k && r.dono === O).length;
        const noBanco = pareadas.filter(y => itemKey(y.ceg, y.nome_do_item) === k && normTxt(y.cog) === O);
        if (noBanco.length >= naPlanilha && (!cod || noBanco.some(y => codDe(y) === cod))) prova = true;
      }
    }
    if (prova) copiasProvadas.add(x.id);
    return prova;
  };
  const insercoesRetidas = [], blindadasPorRetencao = new Set(), inserirAgora = [];
  for (const q of insercoesPendentes) {
    const porCod = q.idLinha ? (sobPorCodigo.get(String(q.idLinha).trim()) || []) : [];
    const porItem = (sobPorItem.get(`${normTxt(q.ceg)}|${normTxt(q.nomeItem)}`) || []).filter(x => !ehCopiaProvada(x));   // o código repetido continua retendo sempre
    const rel = new Map([...porCod, ...porItem].map(x => [x.id, x]));
    if (rel.size === 0) { inserirAgora.push(q); continue; }
    const mesmoDono = [...rel.values()].some(x => x.cog && q.cog && x.cog === q.cog) ? 'dono IGUAL ao de linha relacionada' : 'dono DIFERENTE das linhas relacionadas';
    insercoesRetidas.push({ q, mesmoDono, motivo: porCod.length ? 'o código já existe em linha(s) do banco que a planilha não reconhece (dono diferente ou código repetido)' : 'há linha(s) do banco, sem par na planilha, com o mesmo CEG e item (troca de dono/nome ou compra nova: a ordem não prova qual)', ids: [...rel.keys()].sort((a, c) => a - c) });
    rel.forEach((_, id) => blindadasPorRetencao.add(id));
  }
  if (copiasProvadas.size) console.log(`CÓPIAS PROVADAS: ${copiasProvadas.size} linha(s) do banco sem par são cópia de linha pareada e não impedem inserção no mesmo CEG + item (ids ${[...copiasProvadas].slice(0, 30).join(', ')}${copiasProvadas.size > 30 ? ', ...' : ''}); seguem as regras normais de exclusão (só livres, dentro do limite).`);
  // INSERÇÃO EXCEDENTE: inserir deixaria este dono com MAIS linhas no banco do que na planilha neste CEG + item (possível cópia com outro código/nome). Com SYNC_PROTEGER a inserção é retida; sempre aparece no log.
  {
    const grupo = (ceg, item, cog) => `${normTxt(ceg)}|${normTxt(item)}|${normTxt(cog)}`;
    const naPlanilha = new Map(), noBanco = new Map(), jaContados = new Map();
    for (const r of rows) { const k = grupo(col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG'), col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c'), cogDe(r) ?? ''); naPlanilha.set(k, (naPlanilha.get(k) || 0) + 1); }
    for (const x of todosBanco) { const k = grupo(x.ceg, x.nome_do_item, x.cog ?? ''); noBanco.set(k, (noBanco.get(k) || 0) + 1); }
    const excedentes = [], mantidas = [];
    for (const q of inserirAgora) {
      const k = grupo(q.ceg, q.nomeItem, q.cog ?? ''); const depois = (noBanco.get(k) || 0) + (jaContados.get(k) || 0) + 1;
      if (depois > (naPlanilha.get(k) || 0)) { excedentes.push(q); if (PROTEGER) continue; }
      jaContados.set(k, (jaContados.get(k) || 0) + 1); mantidas.push(q);
    }
    console.log(`INSERÇÕES EXCEDENTES: ${excedentes.length} de ${inserirAgora.length} deixariam o dono com mais linhas no banco do que na planilha neste CEG + item${excedentes.length ? ' (' + excedentes.slice(0, 40).map(q => q.idLinha || q.nomeItem).join(', ') + ')' : ''}${PROTEGER && excedentes.length ? ' — RETIDAS pela proteção' : ''}.`);
    if (PROTEGER && excedentes.length) {
      inserirAgora.length = 0; inserirAgora.push(...mantidas);
      excedentes.forEach(q => insercoesRetidas.push({ q, mesmoDono: 'dono IGUAL ao das linhas do grupo', motivo: 'inserir deixaria este dono com mais linhas no banco do que na planilha neste CEG + item (possível cópia com outro código ou nome)', ids: [] }));
    }
  }
  // ───── PLANO DE ATUALIZAÇÕES (só ids, códigos, nomes de campo e transições de pagamento/status; nunca @, e-mail ou nome de pessoa)
  const chavesPago = ['pago_item', 'pago_frete', 'pago_rf'];
  if (ADIAR_ESCRITA) {
    const porCampos = {}, transPago = {}, transStatus = {}; let comDono = 0;
    for (const u of planoAtualizacoes) {
      const k = u.campos.join('+'); porCampos[k] = (porCampos[k] || 0) + 1;
      for (const c of chavesPago) if (u.campos.includes(c)) { const t = `${c}:${u.antes[c]}->${u.depois[c]}`; transPago[t] = (transPago[t] || 0) + 1; }
      if (u.campos.includes('status')) { const t = `${u.antes.status}->${u.depois.status}`; transStatus[t] = (transStatus[t] || 0) + 1; }
      if (u.campos.includes('cog')) comDono++;
    }
    console.log(`PLANO DE ATUALIZAÇÕES: ${planoAtualizacoes.length} linha(s). Conjuntos de campos que mudam: ${JSON.stringify(porCampos)}`);
    console.log(`  pagamento: ${JSON.stringify(transPago)} · status: ${JSON.stringify(transStatus)} · linhas em que o DONO mudaria: ${comDono}`);
    console.log('  atualizações (id | código | campos | pagamento | status):');
    planoAtualizacoes.slice(0, 400).forEach(u => console.log(`    #${u.id} | ${u.cod || '-'} | ${u.campos.join(',')} | ${chavesPago.filter(c => u.campos.includes(c)).map(c => `${c}:${u.antes[c]}->${u.depois[c]}`).join(' ') || '-'} | ${u.campos.includes('status') ? `${u.antes.status}->${u.depois.status}` : '-'}`));
    if (planoAtualizacoes.length > 400) console.log(`    ... e mais ${planoAtualizacoes.length - 400}`);
  }
  { const semPreco = inserirAgora.filter(q => q.precoBranco); console.log(`PREÇO EM BRANCO (desconhecido, gravado como 0 = NÃO cobrado até a planilha trazer o preço): ${semPreco.length} de ${inserirAgora.length} inserção(ões)${semPreco.length ? ' (' + semPreco.slice(0, 40).map(q => q.idLinha || q.nomeItem).join(', ') + ')' : ''}.`); }
  if (PROTEGER) console.log(`PROTEÇÃO ATIVA (SYNC_PROTEGER=1): ${bloqueadasPorDono.length} linha(s) NÃO atualizadas porque o dono mudaria (ids ${bloqueadasPorDono.slice(0, 80).join(', ')}) · ${pagamentosMantidos.length} marcação(ões) de pagamento mantida(s) porque a planilha desmarcaria (id:campo ${pagamentosMantidos.slice(0, 80).join(', ')}) · ${statusMantidos.length} status mantido(s) porque voltaria para trás (ids ${statusMantidos.slice(0, 80).join(', ')}) · ${precosMantidos.length} preço(s) mantido(s) porque a célula está em branco (id:campo ${precosMantidos.slice(0, 80).join(', ')})`);
  if (PROTEGER && detalheProtecao.length) { console.log('  linhas protegidas (id | código | CEG | item | motivo):'); detalheProtecao.slice(0, 200).forEach(l => console.log('    ' + l)); }
  // ───── REGISTRO PRIVADO DO PLANO (valores anteriores) ANTES de qualquer gravação; sem ele, nada é gravado
  const resultadoAtualizacoes = [];
  if (REGISTRO) {
    try {
      const g = await gravarRegistro(supabase, `sync/${STAMP}_plano.json`, {
        versao: 1, tipo: 'sync_plano', run: process.env.GITHUB_RUN_ID || 'local', quando: new Date().toISOString(),
        modo: { sem_exclusao: SEM_EXCLUSAO, proteger: PROTEGER, joiners: MODO_JOINERS },
        atualizacoes: planoAtualizacoes.map(({ payload, ...u }) => u),
        insercoes: inserirAgora.map(q => ({ codigo: q.idLinha, ceg: q.ceg, item: q.nomeItem, cog: q.cog, valores: q.baseFields, status: q.status })),
        bloqueadas_por_dono: bloqueadasPorDono, pagamentos_mantidos: pagamentosMantidos,
        insercoes_retidas: insercoesRetidas.map(r => ({ codigo: r.q.idLinha, ceg: r.q.ceg, item: r.q.nomeItem, ids_do_banco: r.ids })),
      });
      console.log(`REGISTRO PRIVADO do plano gravado e conferido: ${g.caminho} (${g.bytes} bytes; bucket ${g.bucket}).`);
    } catch (e) { console.error(`Registro privado indisponível — NADA foi gravado no banco: ${e.message}`); process.exitCode = 6; return; }
    // executa as atualizações, conferindo o estado ATUAL de cada linha contra o "antes" do plano (se mudou desde o plano, a linha é pulada)
    const campoData = new Set(['venc_item', 'venc_frete', 'venc_rf']);
    const igualVal = (c, a, b) => CAMPOS_NUMERICOS.has(c) ? ((a == null || b == null) ? a == b : Math.round(Number(a) * 100) === Math.round(Number(b) * 100))
      : campoData.has(c) ? dataIso(a) === dataIso(b) : String(a ?? '') === String(b ?? '');
    for (const u of planoAtualizacoes) {
      try {
        const { data: cur, error: eL } = await supabase.from('masterlist').select(['id', ...u.campos].join(', ')).eq('id', u.id);
        if (eL || !cur || cur.length !== 1) { resultadoAtualizacoes.push({ id: u.id, resultado: 'pulado: não consegui reler' }); continue; }
        if (u.campos.some(c => !igualVal(c, cur[0][c], u.antes[c]))) { resultadoAtualizacoes.push({ id: u.id, resultado: 'pulado: a linha mudou desde o plano' }); continue; }
        const { error } = await supabase.from('masterlist').update(u.payload).eq('id', u.id);
        if (error) throw error;
        resultadoAtualizacoes.push({ id: u.id, resultado: 'aplicado' });
      } catch (err) { console.error(`Erro:`, err.message); erros++; resultadoAtualizacoes.push({ id: u.id, resultado: 'erro: ' + err.message }); }
    }
    console.log(`Atualizações aplicadas: ${resultadoAtualizacoes.filter(r => r.resultado === 'aplicado').length} de ${planoAtualizacoes.length} (puladas por mudança desde o plano: ${resultadoAtualizacoes.filter(r => r.resultado.startsWith('pulado')).length}).`);
  }
  const inseridasOk = [];
  for (const q of inserirAgora) {
    try {
      if (inserted >= MAX_INSERCOES) { bloqueadasPorLimite++; continue; }
      if (SIMULACAO) planoInsercoes.push(`${q.idLinha || '-'} | ${q.ceg} | ${q.nomeItem}`);
      const { error } = SIMULACAO ? { error: null } : await supabase.from('masterlist').insert([{ ...q.baseFields, status: q.status }]);
      if (error) throw error;
      if (q.cog && q.cog.toLowerCase() !== 'disponivel') novosItens.push({ cog: q.cog, nomeItem: q.nomeItem, ceg: q.ceg });
      inserted++; inseridasOk.push(q);
    } catch (err) {
      console.error(`Erro:`, err.message);
      erros++;
    }
  }
  if (insercoesRetidas.length) {
    console.log(`INSERÇÕES RETIDAS (PENDÊNCIA): ${insercoesRetidas.length} linha(s) da planilha NÃO foram inseridas e ${blindadasPorRetencao.size} linha(s) do banco NÃO entram na exclusão — sem prova de que é a mesma compra, outra compra ou troca de dono (código | CEG | item | motivo | ids do banco):`);
    insercoesRetidas.slice(0, 80).forEach(({ q, motivo, mesmoDono, ids }) => console.log(`  ${q.idLinha || '-'} | ${q.ceg} | ${q.nomeItem} | ${motivo} | ${mesmoDono} | ids ${ids.slice(0, 12).join(', ')}${ids.length > 12 ? ', ...' : ''}`));
    if (insercoesRetidas.length > 80) console.log(`  ... e mais ${insercoesRetidas.length - 80}`);
    console.log(`::warning title=Sync: ${insercoesRetidas.length} inserção(ões) retida(s)::Linha(s) da planilha colidem com linhas do banco sem par (mesmo código ou mesmo CEG+item). Nada foi inserido nem apagado por causa delas; veja "INSERÇÕES RETIDAS" no log.`);
  }
  // ───── VALIDAÇÃO POSTERIOR + REGISTRO PRIVADO DO RESULTADO (execução com SYNC_REGISTRO=1)
  if (REGISTRO) {
    const validacao = { atualizacoes_conferidas: 0, atualizacoes_divergentes: [], insercoes: [] };
    const pegaCampos = async u => (await supabase.from('masterlist').select(['id', ...u.campos].join(', ')).eq('id', u.id)).data;
    for (const u of planoAtualizacoes) {
      if (resultadoAtualizacoes.find(r => r.id === u.id)?.resultado !== 'aplicado') continue;
      const cur = await pegaCampos(u);
      const ok = cur && cur.length === 1 && u.campos.every(c => CAMPOS_NUMERICOS.has(c) ? Math.round(Number(cur[0][c]) * 100) === Math.round(Number(u.depois[c]) * 100) : String(cur[0][c] ?? '').slice(0, ['venc_item', 'venc_frete', 'venc_rf'].includes(c) ? 10 : 100000) === String(u.depois[c] ?? '').slice(0, ['venc_item', 'venc_frete', 'venc_rf'].includes(c) ? 10 : 100000));
      if (ok) validacao.atualizacoes_conferidas++; else validacao.atualizacoes_divergentes.push(u.id);
    }
    for (const q of inseridasOk) {
      let query = supabase.from('masterlist').select('id, id_linha').eq('ceg', q.ceg).eq('nome_do_item', q.nomeItem);
      query = q.idLinha ? query.eq('id_linha', q.idLinha) : query.eq('cog', q.cog);
      const { data: achadas } = await query;
      validacao.insercoes.push({ codigo: q.idLinha || null, ceg: q.ceg, item: q.nomeItem, ids: (achadas || []).map(a => a.id), unica: (achadas || []).length === 1 });
    }
    const repetidas = validacao.insercoes.filter(i => !i.unica);
    console.log(`VALIDAÇÃO POSTERIOR: ${validacao.atualizacoes_conferidas} de ${resultadoAtualizacoes.filter(r => r.resultado === 'aplicado').length} atualizações conferidas (divergentes: ${validacao.atualizacoes_divergentes.length}) · ${validacao.insercoes.length - repetidas.length} de ${validacao.insercoes.length} inserções aparecem UMA única vez${repetidas.length ? ` (repetidas ou ausentes: ${repetidas.map(i => i.codigo || i.item).join(', ')})` : ''}.`);
    if (validacao.atualizacoes_divergentes.length || repetidas.length) erros++;
    try {
      const g = await gravarRegistro(supabase, `sync/${STAMP}_resultado.json`, { versao: 1, tipo: 'sync_resultado', plano: `sync/${STAMP}_plano.json`, run: process.env.GITHUB_RUN_ID || 'local', quando: new Date().toISOString(), atualizacoes: resultadoAtualizacoes, validacao });
      console.log(`REGISTRO PRIVADO do resultado: ${g.caminho}.`);
    } catch (e) { console.error(`Erro ao gravar o registro do resultado: ${e.message}`); erros++; }
  }
  // DIAGNÓSTICO DE GRUPOS: onde o banco tem MAIS linhas que a planilha para o mesmo CEG + item + dono (sem nome de pessoa; só CEG, item, contagens e ids)
  {
    const gp = new Map(), gb = new Map(), idsG = new Map();
    for (const r of rows) { const k = `${normTxt(col(r, colMap, 'ABA / CEG', 'CEG', 'ABA/CEG'))}|${normTxt(col(r, colMap, 'NOME DO ITEM', 'NOME_DO_ITEM', 'c'))}|${cogDe(r) ?? ''}`; gp.set(k, (gp.get(k) || 0) + 1); }
    for (const x of todosBanco) { const k = `${normTxt(x.ceg)}|${normTxt(x.nome_do_item)}|${x.cog ?? ''}`; gb.set(k, (gb.get(k) || 0) + 1); empilha(idsG, k, x); }
    const gruposExcesso = [...gb.entries()].filter(([k, m]) => m > (gp.get(k) || 0) && sob.some(x => `${normTxt(x.ceg)}|${normTxt(x.nome_do_item)}|${x.cog ?? ''}` === k));
    console.log(`DIAGNÓSTICO: ${gruposExcesso.length} grupo(s) (CEG + item + dono) em que o banco tem MAIS linhas que a planilha e há linha sem par (grupo | planilha | banco | ids com código/sem:pago):`);
    gruposExcesso.slice(0, 120).forEach(([k, m]) => { const [c, it] = k.split('|'); console.log(`  ${c} | ${it} | planilha ${gp.get(k) || 0} | banco ${m} | ${idsG.get(k).map(x => `${x.id}(${x.id_linha ? 'cod' : 'sem'}${x.pago_item || x.pago_frete || x.pago_rf ? ':pago' : ''})`).join(' ')}`); });
    if (gruposExcesso.length > 120) console.log(`  ... e mais ${gruposExcesso.length - 120}`);
  }

  console.log(`Sem mudança (nenhum UPDATE enviado): ${semMudanca}`);
  console.log(`\n✓ Masterlist: ${updated} atualizados · ${inserted} inseridos · ${erros} erros · ${comData} com data · ${casadosPorCodigo} casados pelo código (${renomeadosPorCodigo} com nome/CEG alterado, mantendo o id) · ${desempatadasPeloDono} desempatadas pelo dono · ${adotadas} linha(s) antiga(s) sem código adotada(s) (receberam o código da planilha, sem criar cópia)`);

  if (SIMULACAO) {
    console.log(`SIMULAÇÃO: ${updated} linha(s) SERIAM atualizadas e ${inserted} SERIAM inseridas (nada foi gravado).`);
    if (planoInsercoes.length) { console.log('Linhas que seriam INSERIDAS (código | CEG | item):'); planoInsercoes.slice(0, 300).forEach(l => console.log('  ' + l)); if (planoInsercoes.length > 300) console.log(`  ... e mais ${planoInsercoes.length - 300}`); }
  }

  if (bloqueadasPorLimite > 0) {
    console.error(`LIMITE DE INSERÇÕES (${MAX_INSERCOES}) ATINGIDO: ${bloqueadasPorLimite} linha(s) novas NÃO foram inseridas. Confira a planilha e o banco; para liberar de propósito, rode com SYNC_MAX_INSERCOES maior.`);
    process.exitCode = 5;
  }

  const PUSH_URL = `${process.env.SUPABASE_URL}/functions/v1/push-evento`;   // send-push (antiga, aberta) foi descontinuada: o push-evento aceita o mesmo corpo e a chave de serviço do sync
  // Interruptor das notificações do sync: DESLIGADO por padrão. Só envia push (mudança de status e item novo) com SYNC_ENVIAR_PUSH=1
  // (no GitHub: Settings > Secrets and variables > Actions > Variables > SYNC_ENVIAR_PUSH = 1).
  const ENVIAR_PUSH = !SIMULACAO && process.env.SYNC_ENVIAR_PUSH === '1';
  if (!ENVIAR_PUSH) console.log(`Push desligado (SYNC_ENVIAR_PUSH != 1): ${mudancasStatus.length} mudança(s) de status e ${novosItens.length} item(ns) novo(s) NÃO serão notificados.`);

  // Enviar push para joiners com mudança de status
  if (ENVIAR_PUSH && mudancasStatus.length > 0) {
    const STATUS_LABEL = {
      'Comprado':        'Comprado ✓',
      'A Caminho':       'A Caminho 🚛',
      'ANTIGOM':         'Na ANTIGOM 📦',
      'Envio Liberado':  'Envio liberado! ✅',
      'Enviado Nacional':'Enviado Nacional 🚀',
      'Disponível':      'Disponível para retirada',
    };
    const cogsMudados = [...new Set(mudancasStatus.map(m => m.cog))];
    const { data: subs } = await supabase.from('push_subscriptions')
      .select('joiner_cog, endpoint, p256dh, auth')
      .in('joiner_cog', cogsMudados);

    const subsByCog = {};
    (subs || []).forEach(s => {
      if (!subsByCog[s.joiner_cog]) subsByCog[s.joiner_cog] = [];
      subsByCog[s.joiner_cog].push(s);
    });
    let pushEnviados = 0, pushErros = 0;

    for (const { cog, nomeItem, ceg, statusNovo } of mudancasStatus) {
      const cogSubs = subsByCog[cog] || [];
      const label = STATUS_LABEL[statusNovo] || statusNovo;
      for (const s of cogSubs) {
        try {
          const res = await fetch(PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              title: `ANTICEG — ${ceg}`,
              body: `${nomeItem}: ${label}`,
              url: '/masterlist',
            }),
          });
          if (res.ok) pushEnviados++; else pushErros++;
        } catch { pushErros++; }
      }
    }
    console.log(`✓ Push: ${mudancasStatus.length} mudança(s) · ${pushEnviados} notificações enviadas · ${pushErros} erros`);
  }

  // Enviar push para joiners com novo item inserido
  if (ENVIAR_PUSH && novosItens.length > 0) {
    const cogsNovos = [...new Set(novosItens.map(m => m.cog))];
    const { data: subsNovos } = await supabase.from('push_subscriptions')
      .select('joiner_cog, endpoint, p256dh, auth')
      .in('joiner_cog', cogsNovos);

    const subsByNovoCog = {};
    (subsNovos || []).forEach(s => {
      if (!subsByNovoCog[s.joiner_cog]) subsByNovoCog[s.joiner_cog] = [];
      subsByNovoCog[s.joiner_cog].push(s);
    });

    let novosPushEnviados = 0, novosPushErros = 0;
    for (const { cog, nomeItem, ceg } of novosItens) {
      const cogSubs = subsByNovoCog[cog] || [];
      for (const s of cogSubs) {
        try {
          const res = await fetch(PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              title: `ANTICEG — ${ceg}`,
              body: `Novo item cadastrado: ${nomeItem}`,
              url: '/masterlist',
            }),
          });
          if (res.ok) novosPushEnviados++; else novosPushErros++;
        } catch { novosPushErros++; }
      }
    }
    console.log(`✓ Push novos: ${novosItens.length} item(s) · ${novosPushEnviados} notificações enviadas · ${novosPushErros} erros`);
  }

  // Sincronizar joiners únicos da planilha
  const joinersMap = {};
  for (const r of rows) {
    const twitter = col(r, colMap, '@').trim();
    const email   = emailLimpo(col(r, colMap, 'EMAIL'));
    const nome    = nomeLimpo(col(r, colMap, 'NOME'));
    const handle  = twitter.replace(/^@/, '').toLowerCase();
    const key     = handle || email;
    if (key && !joinersMap[key]) {
      joinersMap[key] = {
        cog:     handle || email.split('@')[0],
        nome,
        email:   email || null,
        twitter: twitter || null,
      };
    }
  }

  const joinersList = Object.values(joinersMap);
  console.log(`\nSincronizando ${joinersList.length} joiners únicos...`);
  let jUpserted = 0, jErros = 0, jNovos = 0, jExistentes = 0;

  // E-mail: célula vazia da planilha nunca apaga o e-mail do banco, e quem já tem conta ativada (e-mail verificado) não tem o e-mail trocado pelo sync.
  const { idsComConta, contasIndisponiveis } = await carregarIdsComConta(supabase);
  if (contasIndisponiveis) console.error('Aviso: não foi possível consultar contas_joiner — nenhum e-mail será enviado pelo sync nesta rodada (preservação total).');
  let emailsPreservados = 0;
  // E-mail trocado pela administração/prova verificada: o sync não o desfaz com o valor antigo da planilha (ver preservar-email.js, regras 5 e 6)
  const { idsEmailTrocado, trocadosIndisponiveis } = await carregarIdsEmailTrocado(supabase);
  if (trocadosIndisponiveis) console.error('Aviso: não foi possível consultar as trocas de e-mail — nenhum e-mail será enviado pelo sync nesta rodada (preservação total).');
  const divergentesDoTrocado = [];

  for (const j of joinersList) {
    // A pessoa da linha é resolvida pela MESMA regra dos itens: @ de hoje → e-mail → @ ANTIGO registrado → pessoa nova. Mais de um cadastro possível = conflito (nada é criado nem alterado).
    const resol = resolverLinha({ twitter: j.twitter, email: j.email }, idxJoiners);
    if (resol.conflito) { registrarConflito('joiner', resol, { cog_da_planilha: j.cog }); continue; }
    const nova = resol.via === 'novo';
    const atual = nova ? joinerExistente(j.cog, idxJoiners) : joinerExistente(resol.cog, idxJoiners);
    // modo controlado: 'nenhum' não mexe em cadastros; 'somente-novos' cria o cadastro que não existe e NÃO altera nenhum cadastro existente
    if (nova && !atual) jNovos++; else jExistentes++;
    if (MODO_JOINERS === 'nenhum' || (MODO_JOINERS === 'somente-novos' && !(nova && !atual))) continue;
    // Joiner que já existe (mesmo @ com outras maiúsculas, ou @ antigo) é atualizada pelo COG que ela já tem: o upsert nunca cria um gêmeo.
    const alvo = montarUpsertJoiner({ ...j, cog: nova ? cogDoUpsert(j.cog, idxJoiners) : resol.cog }, atual, { idsComConta, contasIndisponiveis, idsEmailTrocado, trocadosIndisponiveis });
    // planilha com @ antigo (ou @ que só casa pelo e-mail): o @ de hoje do cadastro NÃO é sobrescrito pelo valor atrasado da planilha; o aviso diz qual planilha precisa ser corrigida
    if (resol.via === 'arroba_antigo' || resol.via === 'email') { delete alvo.twitter; avisosArrobaAntigo.add(resol.cog); }
    if (emailPlanilhaDivergeDoTrocado(j, atual, idsEmailTrocado)) divergentesDoTrocado.push(atual.cog);
    if (atual?.email && !('email' in alvo)) emailsPreservados++;
    const { error } = SIMULACAO ? { error: null } : await supabase.from('joiners')
      .upsert(alvo, { onConflict: 'cog', ignoreDuplicates: false });
    if (error) { console.error('Erro joiner:', error.message); jErros++; }
    else jUpserted++;
  }

  console.log(`✓ Joiners: ${jUpserted} sincronizados · ${jErros} erros · ${emailsPreservados} e-mail(s) existente(s) preservado(s) · modo ${MODO_JOINERS}: ${jNovos} cadastro(s) NOVO(s) e ${jExistentes} já existente(s) entre os resolvidos${MODO_JOINERS !== 'todos' ? ' (os existentes NÃO foram alterados' + (MODO_JOINERS === 'nenhum' ? ' e nenhum cadastro foi criado)' : ')') : ''}`);
  // Conflitos de dono (mais de um cadastro possível) e planilhas com @ antigo: nada foi movido, criado ou sobrescrito por causa deles. Fica registrado no log e no resumo da execução (GitHub) para análise.
  if (avisosArrobaAntigo.size > 0) console.log(`✓ Planilha com @ antigo/diferente do cadastro (o @ do cadastro foi preservado; corrija a planilha): ${avisosArrobaAntigo.size} cadastro(s) (marcas, sem @): ${[...avisosArrobaAntigo].slice(0, 40).map(anon).join(', ')}`);
  if (conflitos.length > 0) {
    const unicos = new Map(conflitos.map(c => [`${c.tipo}|${c.chave}|${(c.candidatos || []).join(',')}`, c]));
    console.log(`⚠ CONFLITOS DE DONO (mais de um cadastro possível): ${conflitos.length} linha(s) em ${unicos.size} caso(s). NADA foi movido, criado ou alterado por causa deles.`);
    for (const c of unicos.values()) console.log(`CONFLITO_SYNC ${JSON.stringify({ tipo: c.tipo, chave: anon(c.chave), candidatos: (c.candidatos || []).map(anon), onde: c.onde, exemplo: anonDetalhe(c.detalhe) })}`);
    console.log(`::warning title=Sync: ${unicos.size} conflito(s) de dono::Mais de um cadastro possível para linhas da planilha; nada foi movido nem criado. Veja as linhas CONFLITO_SYNC neste log.`);
    try {
      if (process.env.GITHUB_STEP_SUMMARY) {
        const linhas = ['### Conflitos de dono no sync (nada foi movido, criado ou alterado)', '', '| tipo | chave | cadastros possíveis |', '|---|---|---|', ...[...unicos.values()].map(c => `| ${c.tipo} | ${anon(c.chave)} | ${(c.candidatos || []).map(anon).join(', ')} |`), ''];
        (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, linhas.join('\n'));
      }
    } catch { /* o resumo é só um complemento do log */ }
  }
  if (idsEmailTrocado.size > 0) console.log(`✓ E-mail trocado por administração/prova verificada (protegido do sync): ${idsEmailTrocado.size} cadastro(s); ${divergentesDoTrocado.length} com a planilha ainda mostrando outro e-mail (nada foi sobrescrito; corrija a planilha) (marcas, sem @): ${divergentesDoTrocado.slice(0, 30).map(anon).join(', ')}`);

  // Erros por linha NÃO podem passar por "sync íntegro": o job fica vermelho (código 4) para alguém olhar.
  // Os logs de cada erro acima continuam como estavam, e as demais atualizações já foram feitas (nada é desfeito).
  if (erros > 0 || jErros > 0) {
    console.error(`✗ Sync com erros por linha: ${erros} na masterlist · ${jErros} em joiners — o job termina com falha (código 4).`);
    process.exitCode = 4;
  }


  // Remover registros do banco que não existem mais na planilha — SEMPRE pela função atômica prune_masterlist (supabase/sync/S1_*.sql).
  // Ela mesma recusa planilha parcial, preserva claims/linhas do site/pagas, aplica limite por execução e arquiva o que apagar.
  // Se a função não existir (S1 não aplicado) NÃO apagamos nada: nunca há exclusão direta por este script.
  const totalExistentes = totalNoBanco; // total REAL do banco (as linhas casadas pelo código saíram do existingMap)
  // Se a planilha tem menos ocorrências que o banco, as extras são CANDIDATAS (a função decide quais podem sair). As retidas (inserção suspeita) e as de grupo ambíguo NÃO entram.
  const toDelete = candidatas.filter(x => !blindadasPorRetencao.has(x.id)).map(x => x.id);
  if (blindadasAmbiguas.size) console.log(`Linhas antigas sem código em grupo AMBÍGUO: ${blindadasAmbiguas.size} preservadas (NÃO entram na exclusão), para análise com evidência.`);

  if (SEM_EXCLUSAO) { console.log(`EXCLUSÕES DESLIGADAS (SYNC_SEM_EXCLUSAO=1): ${toDelete.length} linha(s) ausentes da planilha NÃO foram enviadas à exclusão; prune_masterlist NÃO foi chamada (independente do limite).`); return; }
  if (toDelete.length === 0) { console.log(`
✓ Nenhum registro candidato à remoção`); return; }
  console.log(`
${toDelete.length} registro(s) ausentes da planilha (de ${totalExistentes} no banco): enviando para a exclusão protegida...`);
  // Lista as candidatas (só id, código, CEG, item, status e pago; sem dono nem e-mail) para quem for revisar à mão por que não estão na planilha.
  const LISTA_MAX = 300;
  const itensPorId = new Map(Object.values(existingMap).flat().map(x => [x.id, x]));
  console.log('Candidatas à remoção (id | código | CEG | item | status | pago item/frete/rf):');
  toDelete.slice(0, LISTA_MAX).forEach(id => {
    const x = itensPorId.get(id) || {};
    console.log(`  ${id} | ${x.id_linha || '-'} | ${x.ceg} | ${x.nome_do_item} | ${x.status} | ${x.pago_item ? 'S' : 'n'}/${x.pago_frete ? 'S' : 'n'}/${x.pago_rf ? 'S' : 'n'}`);
  });
  if (toDelete.length > LISTA_MAX) console.log(`  ... e mais ${toDelete.length - LISTA_MAX}`);
  if (SIMULACAO) {
    try {
      const porMotivo = {}; let livres = 0, semLeitura = 0;
      for (const id of toDelete) {
        const { data: mot, error: eM } = await supabase.rpc('masterlist_motivos_protecao', { p_id: id });
        if (eM) { semLeitura++; continue; }
        if (!mot || mot.length === 0) livres++; else for (const m of mot) porMotivo[m] = (porMotivo[m] || 0) + 1;
      }
      const limite = Math.max(1, Math.min(25, 25, Math.max(10, Math.floor(totalExistentes * 0.05))));
      console.log(`SIMULAÇÃO da exclusão protegida: ${toDelete.length} candidata(s); ${livres} LIVRE(S) (sem pagamento/claim/multa/loja) e as demais protegidas por motivo ${JSON.stringify(porMotivo)}${semLeitura ? ` (${semLeitura} sem leitura)` : ''}. Limite por execução: ${limite} livres. ${livres > limite ? 'RESULTADO: ABORTARIA a exclusão (limite_excedido) e NÃO apagaria nenhuma; atualizações e inserções já teriam sido feitas.' : `RESULTADO: EXECUTARIA e arquivaria/apagaria ${livres} linha(s) livre(s).`}`);
    } catch (e) { console.log('SIMULAÇÃO da exclusão protegida: sem leitura das proteções (' + e.message + ').'); }
    console.log('SIMULAÇÃO: a exclusão protegida NÃO foi chamada (nada foi apagado).'); return;
  }
  const { data: rel, error: errPrune } = await supabase.rpc('prune_masterlist', { p_ids: toDelete, p_linhas_planilha: rows.length, p_limite: 25 });
  if (errPrune) { console.error('Exclusão protegida indisponível — NADA foi apagado:', errPrune.message); return; }
  if (rel.abortado) {
    console.error(`Exclusão ABORTADA pela proteção (${rel.motivo}) — nada foi apagado.`, JSON.stringify(rel));
    if (rel.motivo === 'limite_excedido') {
      // Há mais linhas ausentes da planilha do que o limite por execução (25). Nada foi apagado e todo o resto do sync já foi feito: isto é um AVISO (o job fica verde),
      // não uma falha. A lista "Candidatas à remoção" acima mostra quais são, para revisão manual.
      console.log(`::warning title=Sync: ${toDelete.length} linha(s) ausentes da planilha::Exclusão protegida não apagou nada (limite_excedido). Veja a lista "Candidatas à remoção" neste log.`);
      return;
    }
    process.exitCode = 3;   // qualquer outro motivo (ex.: planilha parcial) continua vermelho para alguém olhar; as demais atualizações já foram feitas
    return;
  }
  console.log(`✓ Removidos: ${rel.apagadas} · preservados por proteção: ${rel.protegidas} ${JSON.stringify(rel.por_motivo)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
