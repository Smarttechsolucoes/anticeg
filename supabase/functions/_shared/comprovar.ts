// "QUERO MANTER MEU E-MAIL E COMPROVAR MEU CADASTRO" (J14), SEM Deno, rede ou banco reais (tudo entra por "deps"; testável).
// A pessoa informa @ + e-mail cadastrado + uma DESCRIÇÃO de outra prova (comprovante de pagamento anterior, dados de um pedido, outro contato conhecido...).
//   * Este módulo NUNCA envia e-mail ou código e NUNCA afirma que algo foi enviado. Só registra um PEDIDO para a administração (public.comprovacao_abrir).
//   * Não existe desafio por mensagem direta: a via do banco 'perfil_conhecido' fica sem uso por aqui (só 'sem_perfil').
//   * Só quem acertou o PAR (@ + e-mail do cadastro) cria um pedido de verdade; para os demais a resposta é a mesma e nada é criado.
//   * Quem acertou o par e não pode seguir por aqui sabe o próximo passo (pedir o código normal, entrar, pedir ajuda, aguardar), como em pedir-codigo-joiner.
//   * O texto da pessoa NÃO é confiável: vira só um campo de texto para a administração ler (nunca HTML, nunca instrução).
//   * Aprovar NÃO é automático: a administração confere a prova e aprova (admin_aprovar_comprovacao); só então o código normal passa a sair para o e-mail do cadastro.
import { cabecalhosCors } from "./handlers.ts";
import { normalizarCog, emailValido } from "./ativacao.ts";
import type { JoinerAtivacao, Resultado } from "./ativacao.ts";

export const LIMITES_COMPROVAR = { porIpPorHora: 6, porCogPorHora: 3, porEmailPorHora: 3, janelaMin: 60 };
export const DETALHE_MIN = 20, DETALHE_MAX = 500;
const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197";

export interface DbComprovar {
  contar(chave: string, desdeIso: string): Promise<number>;
  registrar(chave: string): Promise<void>;
  joinersPorCog(cog: string): Promise<JoinerAtivacao[]>;
  /** public.comprovacao_abrir(via 'sem_perfil'). Devolve o id; os erros do banco chegam como Error com o código curto (nao_precisa, conta_ativa, limite_diario...). */
  abrirComprovacao(joinerId: number, emailDigitado: string, detalhe: string): Promise<number>;
}
/** Etapas que SÓ quem acertou o par pode receber, além de "pedido_recebido" (igual para todos). */
export type EtapaComprovar = "pedido_recebido" | "pedir_codigo" | "entrar" | "ajuda" | "limite_diario";
const etapa = (e: EtapaComprovar): Resultado => ({ status: 200, corpo: { ok: true, etapa: e } });

export async function processarPedidoComprovacao(entrada: unknown, ip: string, db: DbComprovar, agora: Date = new Date()): Promise<Resultado> {
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || Array.isArray(e) || Object.keys(e).some(k => k !== "cog" && k !== "email" && k !== "detalhe")) return { status: 400, corpo: { error: "pedido inválido" } };
  const cog = normalizarCog(e.cog);
  const detalhe = typeof e.detalhe === "string" ? e.detalhe.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim() : "";
  if (!cog || cog.length > 64 || /[\s\u0000-\u001f@]/.test(cog) || !emailValido(e.email)) return { status: 400, corpo: { error: "pedido inválido" } };
  if (detalhe.length < DETALHE_MIN || detalhe.length > DETALHE_MAX) return { status: 400, corpo: { error: "pedido inválido" } };
  const email = (e.email as string).trim().toLowerCase();

  const desde = new Date(agora.getTime() - LIMITES_COMPROVAR.janelaMin * 60000).toISOString();
  const chaves: [string, number][] = [[`comp-ip:${ip || "desconhecido"}`, LIMITES_COMPROVAR.porIpPorHora], [`comp-cog:${cog}`, LIMITES_COMPROVAR.porCogPorHora], [`comp-email:${email}`, LIMITES_COMPROVAR.porEmailPorHora]];
  for (const [chave, limite] of chaves) if ((await db.contar(chave, desde)) >= limite) return { status: 429, corpo: { error: "Muitas tentativas. Espere alguns minutos e tente de novo." } };
  for (const [chave] of chaves) await db.registrar(chave);             // toda tentativa conta, acerte ou não

  try {
    const candidatas = (await db.joinersPorCog(cog)).filter(j => String(j.cog).trim().toLowerCase() === cog);
    if (candidatas.length !== 1) return etapa("pedido_recebido");
    const j = candidatas[0];
    const cadastrado = String(j.email ?? "").trim().toLowerCase();
    if (!emailValido(cadastrado) || cadastrado !== email) return etapa("pedido_recebido");   // o PAR precisa estar certo
    // ── daqui em diante a pessoa acertou o par ──
    if (j.bloqueado) return etapa("ajuda");
    try { await db.abrirComprovacao(j.id, email, detalhe); }
    catch (err) {
      const c = err instanceof Error ? err.message : String(err);
      if (/nao_precisa/.test(c)) return etapa("pedir_codigo");        // já pode pedir o código normalmente
      if (/conta_ativa/.test(c)) return etapa("entrar");
      if (/limite_diario/.test(c)) return etapa("limite_diario");
      if (/email_compartilhado|sem_email_valido/.test(c)) return etapa("ajuda");
      if (/email_diferente|sem_cadastro/.test(c)) return etapa("pedido_recebido");
      throw err;
    }
    return etapa("pedido_recebido");
  } catch (err) {
    console.error("comprovar-cadastro", err instanceof Error ? err.message : err);
    return etapa("pedido_recebido");                                    // erro interno também responde no mesmo formato
  }
}

export interface DepsComprovar { env: (nome: string) => string | undefined; db: () => DbComprovar; agora?: () => Date }
export async function tratarPedidoComprovacao(req: Request, deps: DepsComprovar, ip: string): Promise<Response> {
  const cors = cabecalhosCors(req.headers.get("origin"), deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  const responder = (r: Resultado) => new Response(JSON.stringify(r.corpo), { status: r.status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder({ status: 405, corpo: { error: "método não permitido" } });
  try {
    return responder(await processarPedidoComprovacao(await req.json().catch(() => null), ip, deps.db(), deps.agora ? deps.agora() : new Date()));
  } catch (err) {
    console.error("comprovar-cadastro", err instanceof Error ? err.message : err);
    return responder({ status: 200, corpo: { ok: true, etapa: "pedido_recebido" } });
  }
}
