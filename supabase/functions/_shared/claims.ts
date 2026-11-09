// CLAIMS SÓ COM @ (J20), SEM Deno, rede ou banco reais (tudo entra por "deps"; testável).
// Dois caminhos, UMA regra (claim_enviar_por_cog no banco, a mesma de claim_enviar):
//   * QUEM ESTÁ LOGADA (token de uma conta ligada a um cadastro, com ou sem perfil concluído): usa o @ da PRÓPRIA conta; o @ que vier no pedido é IGNORADO (ninguém usa a sessão para claimar em nome de outra pessoa).
//   * QUEM NÃO ESTÁ LOGADA ou ainda não tem cadastro: informa o @ e a claim é registrada com esse @, sem senha, ativação ou perfil. Nenhuma conta nem cadastro é criado.
// A claim nunca é descartada por falta de conta. Histórico e dados privados NÃO passam por aqui (continuam exigindo senha).
// Limites por rede e por @ (toda tentativa conta). A resposta do banco (ok/motivo/gravados/standby...) é repassada; nada mais é devolvido.
import { cabecalhosCors } from "./handlers.ts";
import { normalizarCog } from "./ativacao.ts";
import type { Resultado } from "./ativacao.ts";

export const LIMITES_CLAIM = { porIpPorHora: 120, porCogPorHora: 60, janelaMin: 60, maxMembros: 24, maxPorMembro: 50 };
const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197";

export interface DbClaim {
  contar(chave: string, desdeIso: string): Promise<number>;
  registrar(chave: string): Promise<void>;
  /** @ da conta logada (qualquer estado do perfil) a que o token pertence; null se o token não é de uma conta ligada a um cadastro (por exemplo, a chave pública do site). */
  cogDaConta(token: string): Promise<string | null>;
  /** public.claim_enviar_por_cog (só o servidor). Devolve o JSON do banco. */
  enviar(cog: string, evento: number, pedidos: Record<string, number>): Promise<unknown>;
}

export const cogValido = (c: string) => c.length >= 1 && c.length <= 64 && !/[\s@\u0000-\u001f]/.test(c);

export async function processarClaim(entrada: unknown, token: string | null, ip: string, db: DbClaim, agora: Date = new Date()): Promise<Resultado> {
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || Array.isArray(e) || Object.keys(e).some(k => !["cog", "evento", "pedidos"].includes(k))) return { status: 400, corpo: { error: "pedido inválido" } };
  const evento = e.evento;
  if (typeof evento !== "number" || !Number.isInteger(evento) || evento < 1 || evento > 2 ** 52) return { status: 400, corpo: { error: "pedido inválido" } };
  const bruto = e.pedidos;
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return { status: 400, corpo: { error: "pedido inválido" } };
  const entradas = Object.entries(bruto as Record<string, unknown>);
  if (!entradas.length || entradas.length > LIMITES_CLAIM.maxMembros) return { status: 400, corpo: { error: "pedido inválido" } };
  const pedidos: Record<string, number> = {};
  for (const [membro, q] of entradas) {
    if (!membro || membro.length > 60 || typeof q !== "number" || !Number.isInteger(q) || q < 0 || q > LIMITES_CLAIM.maxPorMembro) return { status: 400, corpo: { error: "pedido inválido" } };
    if (q > 0) pedidos[membro] = q;
  }
  if (!Object.keys(pedidos).length) return { status: 200, corpo: { ok: false, motivo: "pedido_vazio" } };

  // identidade: a CONTA logada manda; só sem conta vale o @ informado
  let cog: string | null = null, daConta = false;
  if (token) { try { cog = await db.cogDaConta(token); daConta = !!cog; } catch { cog = null; } }
  if (!cog) {
    cog = typeof e.cog === "string" ? normalizarCog(e.cog) : "";
    if (!cogValido(cog)) return { status: 200, corpo: { ok: false, motivo: "cog_invalido" } };
  }

  const desde = new Date(agora.getTime() - LIMITES_CLAIM.janelaMin * 60000).toISOString();
  const chaves: [string, number][] = [[`claim-ip:${ip || "desconhecido"}`, LIMITES_CLAIM.porIpPorHora], [`claim-cog:${cog.toLowerCase()}`, LIMITES_CLAIM.porCogPorHora]];
  for (const [chave, limite] of chaves) if ((await db.contar(chave, desde)) >= limite) return { status: 429, corpo: { error: "Muitas tentativas. Espere alguns minutos e tente de novo." } };
  for (const [chave] of chaves) await db.registrar(chave);

  let r: unknown;
  try { r = await db.enviar(cog, evento, pedidos); }
  catch (err) { console.error("claim-enviar", err instanceof Error ? err.message : err); return { status: 502, corpo: { error: "Não foi possível registrar agora." } }; }
  if (!r || typeof r !== "object" || typeof (r as { ok?: unknown }).ok !== "boolean") return { status: 502, corpo: { error: "Não foi possível registrar agora." } };
  const o = r as Record<string, unknown>;
  // só o que a tela precisa; nada do banco além disso
  return { status: 200, corpo: { ok: o.ok, ...(o.motivo !== undefined ? { motivo: o.motivo } : {}), ...(o.ot8 !== undefined ? { ot8: o.ot8 } : {}), ...(o.gravados !== undefined ? { gravados: o.gravados } : {}), ...(o.standby !== undefined ? { standby: o.standby } : {}), ...(o.falhas !== undefined ? { falhas: o.falhas } : {}), conta: daConta } };
}

export interface DepsClaim { env: (nome: string) => string | undefined; db: () => DbClaim; agora?: () => Date }
export async function tratarClaim(req: Request, deps: DepsClaim, ip: string): Promise<Response> {
  const cors = cabecalhosCors(req.headers.get("origin"), deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  const responder = (r: Resultado) => new Response(JSON.stringify(r.corpo), { status: r.status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder({ status: 405, corpo: { error: "método não permitido" } });
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  try {
    return responder(await processarClaim(await req.json().catch(() => null), m ? m[1].trim() : null, ip, deps.db(), deps.agora ? deps.agora() : new Date()));
  } catch (err) {
    console.error("claim-enviar", err instanceof Error ? err.message : err);
    return responder({ status: 500, corpo: { error: "erro interno" } });
  }
}
