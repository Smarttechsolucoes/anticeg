// ATIVAÇÃO AUTOMÁTICA COMPLETA (J22, pedido explícito da administradora em 12/11/2026). SEM Deno, rede ou banco reais (tudo entra por "deps"; testável).
// Fluxo da pessoa: 1) informa o @; 2) o servidor diz o próximo passo:
//      "confirmar_email"  -> o cadastro tem e-mail: mostra-o PARCIALMENTE ("a***@gmail.com") e a pessoa confirma que é dela;
//      "informar_email"   -> o cadastro não tem e-mail (ou a pessoa quer outro): ela digita o e-mail que quer usar;
//      "entrar" | "ajuda" -> já tem conta | conflito que só a administradora resolve (e-mail repartido, bloqueado...);
//    3) o código vai para o e-mail escolhido; 4) a pessoa digita o código, o servidor o confere e devolve a sessão; 5) "concluir" liga a conta ao cadastro (função J22 do banco).
// RISCO ACEITO PELA ADMINISTRADORA: quem controla um e-mail verificado liga a conta a um cadastro sem e-mail (ou com e-mail só dele) apenas sabendo o @.
// Proteções que ficam: limites por rede/@/e-mail; conflitos (e-mail repartido, @ repetido, bloqueado, e-mail que é de outro cadastro) vão para a administração; o e-mail ANTIGO é avisado da troca;
// cada ligação fica em contas_auditoria e NÃO conta como "identidade confirmada"; o e-mail completo do cadastro nunca sai do servidor.
import { cabecalhosCors } from "./handlers.ts";
import { emailValido, normalizarCog } from "./ativacao.ts";
import type { JoinerAtivacao, Resultado } from "./ativacao.ts";
import { mascararEmail } from "./ativacao_dica.ts";

export const LIMITES_AUTO = { porIpPorHora: 20, porCogPorHora: 8, porEmailPorHora: 3, verificarPorCogPorHora: 10, janelaMin: 60 };
const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197";
const NEUTRO: Resultado = { status: 200, corpo: { ok: true } };
const LIMITE: Resultado = { status: 429, corpo: { error: "Muitas tentativas. Espere alguns minutos e tente de novo." } };
const proximo = (p: string, extra: Record<string, unknown> = {}): Resultado => ({ status: 200, corpo: { ok: true, proximo: p, ...extra } });

export interface DbAuto {
  contar(chave: string, desdeIso: string): Promise<number>;
  registrar(chave: string): Promise<void>;
  joinersPorCog(cog: string): Promise<JoinerAtivacao[]>;
  quantasComEmail(email: string): Promise<number>;
  jaVinculada(joinerId: number): Promise<boolean>;
  liberada(joinerId: number): Promise<boolean>;
}
export interface SessaoAuto { access_token: string; refresh_token: string }
export interface ResultadoConcluir { status: string; email_trocado?: boolean; email_antigo?: string | null }
export interface RedeAuto {
  garantirUsuario(email: string): Promise<void>;
  enviarCodigo(email: string): Promise<void>;
  verificarCodigo(email: string, codigo: string): Promise<SessaoAuto | null>;          // null = código errado ou vencido
  usuarioDoToken(jwt: string): Promise<string | null>;                                  // id do usuário dono do token
  concluir(userId: string, cog: string): Promise<ResultadoConcluir>;
  avisarTroca(emailAntigo: string, cog: string): Promise<void>;
}

async function limitar(db: DbAuto, chaves: [string, number][], agora: Date): Promise<boolean> {
  const desde = new Date(agora.getTime() - LIMITES_AUTO.janelaMin * 60000).toISOString();
  for (const [chave, limite] of chaves) if ((await db.contar(chave, desde)) >= limite) return true;
  for (const [chave] of chaves) await db.registrar(chave);          // toda tentativa conta, exista ou não o cadastro
  return false;
}
const cogValido = (cog: string) => !!cog && cog.length <= 64 && !/[\s\u0000-\u001f@]/.test(cog);
async function cadastroUnico(db: DbAuto, cog: string): Promise<JoinerAtivacao | null> {
  const c = (await db.joinersPorCog(cog)).filter(j => String(j.cog).trim().toLowerCase() === cog);
  return c.length === 1 ? c[0] : null;                               // não existe, ou é ambíguo (@ que só muda a maiúscula)
}
const emailDe = (j: JoinerAtivacao) => String(j.email ?? "").trim().toLowerCase();

export async function processarAuto(entrada: unknown, jwt: string | null, ip: string, db: DbAuto, rede: RedeAuto, agora: Date = new Date()): Promise<Resultado> {
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || Array.isArray(e)) return { status: 400, corpo: { error: "pedido inválido" } };
  const cog = normalizarCog(e.cog);
  if (!cogValido(cog)) return { status: 400, corpo: { error: "pedido inválido" } };
  const ipChave: [string, number] = [`ip:${ip || "desconhecido"}`, LIMITES_AUTO.porIpPorHora];

  // ── 1) consultar: o que fazer com este @? (nunca devolve o e-mail completo) ──
  if (e.acao === "consultar") {
    if (Object.keys(e).some(k => k !== "acao" && k !== "cog")) return { status: 400, corpo: { error: "pedido inválido" } };
    if (await limitar(db, [ipChave, [`cog:${cog}`, LIMITES_AUTO.porCogPorHora]], agora)) return LIMITE;
    const j = await cadastroUnico(db, cog);
    if (!j) return proximo("informar_email");                        // @ inexistente ou ambíguo: igual a "sem e-mail" (não revela se o @ existe; nenhum código sai depois)
    if (j.bloqueado) return proximo("ajuda");
    if (await db.jaVinculada(j.id)) return proximo("entrar");
    const cad = emailDe(j);
    if (!emailValido(cad)) return proximo("informar_email");
    if ((await db.quantasComEmail(cad)) !== 1) return proximo("ajuda");   // e-mail repartido entre cadastros: a administradora decide
    return proximo("confirmar_email", { email_mascarado: mascararEmail(cad) });
  }

  // ── 2) enviar: código para o e-mail do cadastro (usar_cadastrado) ou para um e-mail informado ──
  if (e.acao === "enviar") {
    if (Object.keys(e).some(k => k !== "acao" && k !== "cog" && k !== "email" && k !== "usar_cadastrado")) return { status: 400, corpo: { error: "pedido inválido" } };
    const usarCadastrado = e.usar_cadastrado === true;
    if (usarCadastrado === (e.email !== undefined)) return { status: 400, corpo: { error: "pedido inválido" } };   // exatamente um dos dois
    if (!usarCadastrado && !emailValido(e.email)) return { status: 400, corpo: { error: "pedido inválido" } };
    const informado = usarCadastrado ? "" : (e.email as string).trim().toLowerCase();
    const chaves: [string, number][] = [ipChave, [`cog:${cog}`, LIMITES_AUTO.porCogPorHora]];
    if (informado) chaves.push([`email:${informado}`, LIMITES_AUTO.porEmailPorHora]);
    if (await limitar(db, chaves, agora)) return LIMITE;

    const j = await cadastroUnico(db, cog);
    if (!j) return NEUTRO;
    if (j.bloqueado) return proximo("ajuda");
    if (await db.jaVinculada(j.id)) return proximo("entrar");
    if (!(await db.liberada(j.id))) return proximo("aguardando");
    const cad = emailDe(j), cadValido = emailValido(cad);
    if (cadValido && (await db.quantasComEmail(cad)) !== 1) return proximo("ajuda");           // e-mail repartido: conflito
    let destino: string;
    if (usarCadastrado) { if (!cadValido) return proximo("informar_email"); destino = cad; }
    else {
      destino = informado;
      if (!(cadValido && cad === informado) && (await db.quantasComEmail(informado)) > 0) return proximo("ajuda");   // o e-mail informado já é de OUTRO cadastro: conflito
    }
    try { await rede.garantirUsuario(destino); await rede.enviarCodigo(destino); } catch (err) { console.error("ativacao-automatica", err instanceof Error ? err.message : err); }
    return NEUTRO;
  }

  // ── 3) verificar: o servidor confere o código (a pessoa não precisa saber o e-mail completo) e devolve a sessão ──
  if (e.acao === "verificar") {
    if (Object.keys(e).some(k => k !== "acao" && k !== "cog" && k !== "email" && k !== "codigo")) return { status: 400, corpo: { error: "pedido inválido" } };
    const codigo = String(e.codigo ?? "").replace(/\s+/g, "");
    if (!/^\d{6,10}$/.test(codigo)) return { status: 400, corpo: { error: "Digite o código numérico que chegou no e-mail." } };
    if (e.email !== undefined && !emailValido(e.email)) return { status: 400, corpo: { error: "pedido inválido" } };
    if (await limitar(db, [ipChave, [`verificar:${cog}`, LIMITES_AUTO.verificarPorCogPorHora]], agora)) return LIMITE;
    const j = await cadastroUnico(db, cog);
    const alvo = e.email !== undefined ? String(e.email).trim().toLowerCase() : j ? emailDe(j) : "";
    if (!j || !emailValido(alvo)) return { status: 400, corpo: { error: "Código incorreto ou vencido. Peça outro código." } };
    const sessao = await rede.verificarCodigo(alvo, codigo);
    if (!sessao) return { status: 400, corpo: { error: "Código incorreto ou vencido. Peça outro código." } };
    return { status: 200, corpo: { ok: true, access_token: sessao.access_token, refresh_token: sessao.refresh_token } };
  }

  // ── 4) concluir: liga a conta (do token de quem chamou) ao cadastro; avisa o e-mail antigo se houve troca ──
  if (e.acao === "concluir") {
    if (Object.keys(e).some(k => k !== "acao" && k !== "cog")) return { status: 400, corpo: { error: "pedido inválido" } };
    const uid = jwt ? await rede.usuarioDoToken(jwt) : null;
    if (!uid) return { status: 401, corpo: { error: "entre de novo e tente outra vez" } };
    const r = await rede.concluir(uid, cog);
    if (r.status === "ok" && r.email_trocado && r.email_antigo && emailValido(r.email_antigo)) {
      try { await rede.avisarTroca(r.email_antigo, cog); } catch (err) { console.error("ativacao-automatica aviso", err instanceof Error ? err.message : err); }
    }
    return { status: 200, corpo: { ok: true, resultado: r.status === "ok" ? "ok" : r.status === "aguardando_liberacao" ? "aguardando" : "pendente" } };
  }
  return { status: 400, corpo: { error: "pedido inválido" } };
}

export interface DepsAuto { env: (nome: string) => string | undefined; db: () => DbAuto; rede: () => RedeAuto; agora?: () => Date }
export async function tratarAuto(req: Request, deps: DepsAuto, ip: string): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = cabecalhosCors(origin, deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  const responder = (r: Resultado) => new Response(JSON.stringify(r.corpo), { status: r.status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder({ status: 405, corpo: { error: "método não permitido" } });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
    return responder(await processarAuto(await req.json().catch(() => null), jwt, ip, deps.db(), deps.rede(), deps.agora ? deps.agora() : new Date()));
  } catch (e) {
    console.error("ativacao-automatica", e instanceof Error ? e.message : e);
    return responder(NEUTRO);
  }
}
