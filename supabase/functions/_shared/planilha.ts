// PROXY SEGURO DO WEB APP DA PLANILHA (Apps Script). O navegador NUNCA mais fala com o Apps Script nem conhece o token dele:
// ele chama a função `planilha-acao` (com o login de quem está usando o site), esta camada decide se AQUELA pessoa pode fazer AQUELA ação
// naquele(s) item(ns), e só então repete a chamada ao Apps Script com o segredo guardado no servidor (PLANILHA_TOKEN).
//
// Autorização por ação:
//   cancelar, repassar, aprovar_disponivel : somente a administradora (login de admin) + o estado correspondente já gravado no banco
//                                             (comprovante rejeitado / repasse aprovado / claim aprovado).
//   confirmar, recebido, atualizar_joiner   : a dona do item (conta ativada) ou, enquanto o login das joiners ainda não existe
//                                             (PLANILHA_EXIGIR_CONTA != "true"), quem apresenta o registro correspondente RECENTE no banco
//                                             (pagamento em análise / report recente / confirmação recente) — nunca um item de outra pessoa.
//   novo_joiner                             : a administradora, ou o pedido de cadastro RECENTE (pre_cadastros) com os mesmos dados.
// O corpo enviado ao Apps Script é montado aqui, campo a campo (lista branca): o navegador não escolhe token, URL nem campos extras.
// Sem Deno, rede ou banco reais: tudo entra por "deps" (injeção), então dá para testar sem tocar em nada.

export type Quem = "anonimo" | "joiner" | "admin";
export interface Chamada { quem: Quem; cog: string | null }
export const ACOES = ["confirmar", "cancelar", "repassar", "recebido", "aprovar_disponivel", "atualizar_joiner", "novo_joiner"] as const;
export type Acao = typeof ACOES[number];

export interface LinhaML { id: number; id_linha: string | null; cog: string | null; nome: string | null; ceg: string | null; nome_do_item: string | null }
export interface DemandaP { id: number; joiner_cog: string; status: string; created_at: string; itens: unknown }
export interface DbPlanilha {
  linhasPorIdLinha(ids: string[]): Promise<LinhaML[]>;
  demandas(filtro: { status: string[]; desde?: string }): Promise<DemandaP[]>;
  claimsAprovados(masterlistIds: number[]): Promise<{ masterlist_id: number; joiner_cog: string | null }[]>;
  repassosAprovados(itemIds: number[]): Promise<{ item_id: number }[]>;
  reportsRecentes(itemIds: number[], desdeIso: string): Promise<{ item_id: number; joiner_cog: string | null }[]>;
  confirmacoesRecentes(desdeIso: string): Promise<{ joiner_cog: string | null; twitter_novo: string | null; email_novo: string | null }[]>;
  preCadastroRecente(cog: string): Promise<{ cog: string; nome: string | null; email: string | null; created_at: string } | null>;
  joinerPorCog(cog: string): Promise<{ cog: string; twitter: string | null } | null>;
  joinersComTwitter(twitterNormalizado: string): Promise<{ cog: string }[]>;
}
export interface DepsPlanilha {
  env: (nome: string) => string | undefined;
  resolverToken: (token: string) => Promise<{ admin: boolean; cog: string | null }>;
  db: DbPlanilha;
  fetch: typeof fetch;
  agora?: () => Date;
}

const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197";
const JANELA = { pagamentoMin: 180, reportMin: 30, confirmacaoMin: 30, cadastroMin: 30 };
const MAX_CORPO = 64 * 1024, MAX_ITENS = 100;

export function cabecalhosCors(origin: string | null, permitidas: string): Record<string, string> {
  const lista = permitidas.split(",").map(s => s.trim()).filter(Boolean);
  return {
    ...(origin && lista.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function responder(status: number, corpo: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const normTw = (v: unknown) => norm(v).replace(/^@/, "");
const texto = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const ID_OK = /^[\w.\-]{1,80}$/;
const TW_OK = /^[\w.]{1,64}$/;
const naoNeg = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) && n >= 0 ? n : NaN; };
const iguaisSeguro = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

export interface Negado { ok: false; status: number; erro: string }
export interface Liberado { ok: true; corpo: Record<string, unknown> }
const nega = (status: number, erro: string): Negado => ({ ok: false, status, erro });

/** Linhas da MASTERLIST (no banco) que o pedido atinge: mesmo id_linha e, se vieram CEG e nome do item, também esses (como o Apps Script desambigua). */
function linhasAlvo(todas: LinhaML[], id: string, ceg?: string, item?: string): LinhaML[] {
  const doId = todas.filter(l => String(l.id_linha ?? "").trim() === id);
  if (ceg && item) {
    const f = doId.filter(l => norm(l.ceg) === norm(ceg) && norm(l.nome_do_item) === norm(item));
    if (f.length) return f;
  }
  return doId;
}
type ItemEntrada = { id_linha: string; ceg: string; nome_do_item: string; valor_item: number; frete_inter: number; taxa_rf: number };
function lerItens(d: Record<string, unknown>): ItemEntrada[] | Negado {
  if (!Array.isArray(d.itens) || d.itens.length === 0 || d.itens.length > MAX_ITENS) return nega(400, "itens inválidos");
  const saida: ItemEntrada[] = [];
  for (const x of d.itens as Record<string, unknown>[]) {
    const id = texto(x?.id_linha, 80);
    if (!ID_OK.test(id)) return nega(400, "id_linha inválido");
    const v = naoNeg(x?.valor_item), f = naoNeg(x?.frete_inter), t = naoNeg(x?.taxa_rf);
    if ([v, f, t].some(Number.isNaN)) return nega(400, "valores inválidos");
    saida.push({ id_linha: id, ceg: texto(x?.ceg), nome_do_item: texto(x?.nome_do_item), valor_item: v, frete_inter: f, taxa_rf: t });
  }
  return saida;
}
const corpoItens = (acao: string, itens: ItemEntrada[]) => ({ acao, itens: itens.map(i => ({ id_linha: i.id_linha, ceg: i.ceg, nome_do_item: i.nome_do_item, valor_item: i.valor_item, frete_inter: i.frete_inter, taxa_rf: i.taxa_rf })) });
const entradaDaDemanda = (dem: DemandaP, id: string): Record<string, unknown> | null => {
  const lista = Array.isArray(dem.itens) ? dem.itens as Record<string, unknown>[] : [];
  return lista.find(x => texto(x?.id_linha, 80) === id) ?? null;
};
const cobre = (pedido: number, noRegistro: unknown) => pedido <= 0 || Number(noRegistro ?? 0) > 0;
function minutosAtras(agora: Date, min: number) { return new Date(agora.getTime() - min * 60000).toISOString(); }
function idadeMin(agora: Date, iso: string) { return (agora.getTime() - new Date(iso).getTime()) / 60000; }

export async function autorizar(acao: Acao, d: Record<string, unknown>, c: Chamada, db: DbPlanilha, agora: Date, exigirConta: boolean): Promise<Negado | Liberado> {
  const admin = c.quem === "admin";
  const joinerOuLivre = (): Negado | null => (exigirConta && c.quem !== "joiner" ? nega(401, "entre na sua conta para continuar") : null);

  // ── confirmar: a joiner marca o que ela mesma acabou de pagar ──────────────────────────────────────────────────────
  if (acao === "confirmar") {
    const nao = joinerOuLivre(); if (nao) return nao;
    const itens = lerItens(d); if (!Array.isArray(itens)) return itens;
    const dems = (await db.demandas({ status: ["em_analise"], desde: minutosAtras(agora, JANELA.pagamentoMin) }))
      .filter(x => c.quem !== "joiner" || norm(x.joiner_cog) === norm(c.cog));
    const linhas = await db.linhasPorIdLinha([...new Set(itens.map(i => i.id_linha))]);
    for (const it of itens) {
      const alvo = linhasAlvo(linhas, it.id_linha, it.ceg, it.nome_do_item);
      if (!alvo.length) return nega(403, `item ${it.id_linha} não encontrado`);
      const ok = dems.some(dem => {
        const e = entradaDaDemanda(dem, it.id_linha);
        return !!e && cobre(it.valor_item, e.valor_item) && cobre(it.frete_inter, e.frete_inter) && cobre(it.taxa_rf, e.taxa_rf) && alvo.every(l => norm(l.cog) === norm(dem.joiner_cog));
      });
      if (!ok) return nega(403, `item ${it.id_linha} não corresponde a um pagamento seu em análise`);
    }
    return { ok: true, corpo: corpoItens("confirmar", itens) };
  }

  // ── cancelar: a administradora desfaz depois de REJEITAR o comprovante ─────────────────────────────────────────────
  if (acao === "cancelar") {
    if (!admin) return nega(403, "somente a administração");
    const itens = lerItens(d); if (!Array.isArray(itens)) return itens;
    const dems = await db.demandas({ status: ["rejeitado"] });
    for (const it of itens) {
      const ok = dems.some(dem => { const e = entradaDaDemanda(dem, it.id_linha); return !!e && cobre(it.valor_item, e.valor_item) && cobre(it.frete_inter, e.frete_inter) && cobre(it.taxa_rf, e.taxa_rf); });
      if (!ok) return nega(403, `item ${it.id_linha} não pertence a um comprovante rejeitado`);
    }
    return { ok: true, corpo: corpoItens("cancelar", itens) };
  }

  // ── ações de UMA linha: id_linha (+ dicas de CEG e item) ──────────────────────────────────────────────────────────
  if (acao === "recebido" || acao === "repassar" || acao === "aprovar_disponivel") {
    const id = texto(d.id_linha, 80), ceg = texto(d.ceg), item = texto(d.nome_do_item);
    if (!ID_OK.test(id)) return nega(400, "id_linha inválido");
    const alvo = linhasAlvo(await db.linhasPorIdLinha([id]), id, ceg, item);
    if (!alvo.length) return nega(403, "item não encontrado");
    const dica = { ceg, nome_do_item: item };

    if (acao === "recebido") {
      const nao = joinerOuLivre(); if (nao) return nao;
      if (c.quem === "joiner") {
        if (!alvo.every(l => norm(l.cog) === norm(c.cog))) return nega(403, "este item não é seu");
      } else {
        const rep = await db.reportsRecentes(alvo.map(l => l.id), minutosAtras(agora, JANELA.reportMin));
        if (!alvo.every(l => rep.some(r => r.item_id === l.id && norm(r.joiner_cog) === norm(l.cog)))) return nega(403, "não há relato recente do dono deste item");
      }
      return { ok: true, corpo: { acao, id_linha: id, ...dica } };
    }

    if (!admin) return nega(403, "somente a administração");
    const novoNome = texto(d.novo_nome), novoTw = texto(d.novo_twitter, 65);
    if (!novoNome || !TW_OK.test(normTw(novoTw))) return nega(400, "novo dono inválido");
    if (acao === "repassar") {
      const ap = await db.repassosAprovados(alvo.map(l => l.id));
      if (!alvo.every(l => norm(l.cog) === normTw(novoTw) && ap.some(r => r.item_id === l.id))) return nega(403, "não há repasse aprovado para este item e este novo dono");
      return { ok: true, corpo: { acao, id_linha: id, ...dica, novo_nome: novoNome, novo_twitter: novoTw } };
    }
    const venc = texto(d.vencimento, 40);
    if (!venc) return nega(400, "vencimento obrigatório");
    const cl = await db.claimsAprovados(alvo.map(l => l.id));
    if (!alvo.every(l => norm(l.cog) === normTw(novoTw) && cl.some(r => r.masterlist_id === l.id && normTw(r.joiner_cog) === normTw(novoTw)))) return nega(403, "não há claim aprovado deste item para este novo dono");
    return { ok: true, corpo: { acao, id_linha: id, ...dica, novo_nome: novoNome, novo_twitter: novoTw, vencimento: venc } };
  }

  // ── atualizar_joiner: a joiner muda o PRÓPRIO @/e-mail ────────────────────────────────────────────────────────────
  if (acao === "atualizar_joiner") {
    const antigo = normTw(d.twitter_antigo), novo = normTw(d.twitter_novo), emailNovo = norm(d.email_novo);
    if (!TW_OK.test(antigo)) return nega(400, "twitter_antigo inválido");
    if (novo && !TW_OK.test(novo)) return nega(400, "twitter_novo inválido");
    if (!novo && !emailNovo) return nega(400, "nenhuma alteração informada");
    if (emailNovo && (emailNovo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailNovo))) return nega(400, "e-mail inválido");
    if (!admin) {
      const nao = joinerOuLivre(); if (nao) return nao;
      // quem é a dona? a conta logada; senão, a autora de uma confirmação RECENTE com exatamente estes dados
      let dona = c.quem === "joiner" ? norm(c.cog) : "";
      const conf = (await db.confirmacoesRecentes(minutosAtras(agora, JANELA.confirmacaoMin)))
        .filter(x => (!novo || normTw(x.twitter_novo) === novo) && (!emailNovo || norm(x.email_novo) === emailNovo));
      if (!conf.length) return nega(403, "não há alteração de cadastro recente com estes dados");
      if (!dona) { const cogs = [...new Set(conf.map(x => norm(x.joiner_cog)).filter(Boolean))]; if (cogs.length !== 1) return nega(403, "alteração ambígua"); dona = cogs[0]; }
      else if (!conf.some(x => norm(x.joiner_cog) === dona)) return nega(403, "não há alteração recente sua com estes dados");
      // o @ antigo precisa ser da própria pessoa (ainda no cadastro dela) ou não ser de mais ninguém (já foi trocado no cadastro)
      const donosDoAntigo = (await db.joinersComTwitter(antigo)).map(j => norm(j.cog));
      if (donosDoAntigo.some(cog => cog !== dona)) return nega(403, "o @ informado pertence a outra pessoa");
    }
    return { ok: true, corpo: { acao, twitter_antigo: texto(d.twitter_antigo, 65), twitter_novo: texto(d.twitter_novo, 65), email_novo: texto(d.email_novo, 254) } };
  }

  // ── novo_joiner: a administradora, ou o pedido de cadastro recém-feito ────────────────────────────────────────────
  if (acao === "novo_joiner") {
    const nome = texto(d.nome, 120), tw = normTw(d.twitter), email = norm(d.email);
    if (!nome || !TW_OK.test(tw)) return nega(400, "nome e @ obrigatórios");
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))) return nega(400, "e-mail inválido");
    if (!admin) {
      const p = await db.preCadastroRecente(tw);
      if (!p || !(idadeMin(agora, p.created_at) >= -1 && idadeMin(agora, p.created_at) <= JANELA.cadastroMin)) return nega(403, "não há pedido de cadastro recente para este @");
      if (norm(p.nome) !== norm(nome) || (email && p.email && norm(p.email) !== email)) return nega(403, "os dados não conferem com o pedido de cadastro");
    }
    return { ok: true, corpo: { acao, nome, twitter: "@" + tw, email } };
  }
  return nega(400, "ação inválida");
}

export async function tratarPlanilha(req: Request, deps: DepsPlanilha): Promise<Response> {
  const cors = cabecalhosCors(req.headers.get("origin"), deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder(405, { erro: "método não permitido" }, cors);
  try {
    const url = deps.env("PLANILHA_URL"), segredo = deps.env("PLANILHA_TOKEN");
    if (!url || !segredo) return responder(500, { erro: "planilha não configurada" }, cors);
    const bruto = await req.text();
    if (bruto.length > MAX_CORPO) return responder(413, { erro: "pedido grande demais" }, cors);
    let entrada: Record<string, unknown>;
    try { entrada = JSON.parse(bruto); } catch { return responder(400, { erro: "pedido inválido" }, cors); }
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return responder(400, { erro: "pedido inválido" }, cors);
    const acao = entrada.acao as Acao;
    if (!ACOES.includes(acao)) return responder(400, { erro: "ação inválida" }, cors);

    // quem chama (token de login → administradora / joiner com conta / anônimo). A chave de serviço NÃO é aceita aqui.
    let chamada: Chamada = { quem: "anonimo", cog: null };
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
    if (m) {
      const tk = m[1].trim(), chaveServico = deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (chaveServico && iguaisSeguro(tk, chaveServico)) return responder(403, { erro: "chave de serviço não é aceita aqui", negado: true }, cors);
      try {
        const r = await deps.resolverToken(tk);
        if (r.admin) chamada = { quem: "admin", cog: null }; else if (r.cog) chamada = { quem: "joiner", cog: r.cog };
      } catch { /* token da chave pública ou expirado: segue como anônimo */ }
    }

    const agora = deps.agora ? deps.agora() : new Date();
    const dec = await autorizar(acao, entrada, chamada, deps.db, agora, deps.env("PLANILHA_EXIGIR_CONTA") === "true");
    if (!dec.ok) return responder(dec.status, { erro: dec.erro, negado: true }, cors);

    let resp: Response;
    try {
      resp = await deps.fetch(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ ...dec.corpo, token: segredo }) });
    } catch { return responder(502, { erro: "A planilha não respondeu. Não foi possível confirmar se foi atualizada.", indeterminado: true }, cors); }
    if (!resp.ok) return responder(502, { erro: `A planilha respondeu com erro HTTP ${resp.status}. Não foi possível confirmar se foi atualizada.`, indeterminado: true }, cors);
    let json: unknown;
    try { json = JSON.parse(await resp.text()); } catch { return responder(502, { erro: "A planilha respondeu algo ilegível. Não foi possível confirmar se foi atualizada.", indeterminado: true }, cors); }
    if (!json || typeof json !== "object") return responder(502, { erro: "A planilha respondeu algo ilegível.", indeterminado: true }, cors);
    return responder(200, json, cors);    // passa a resposta do Apps Script como está (ok/parcial/nao_processados/sync/aviso/erro); o segredo nunca volta
  } catch {
    return responder(500, { erro: "erro interno" }, cors);
  }
}
