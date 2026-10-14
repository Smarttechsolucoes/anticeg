// Pedido de CÓDIGO DE ATIVAÇÃO das joiners, SEM Deno, rede ou banco reais (tudo entra por "deps"; testável).
// Por que existe: o navegador NÃO pede o código direto ao Supabase Auth (isso exigiria deixar o cadastro público de usuários ligado e permitiria disparar e-mail para qualquer endereço).
// Aqui o SERVIDOR decide, e a resposta é SEMPRE a mesma ({ok:true}), exista ou não o @, o e-mail, a conta ou a liberação:
//   * o código só é enviado para o E-MAIL DO CADASTRO da joiner (nunca para um endereço digitado por outra pessoa);
//   * só se o @ existir e for único (Ela/ela não valem), o e-mail for válido e de uma única joiner, não houver conta vinculada e a onda dela já estiver liberada;
//   * limites por hora: por rede, por @ e por e-mail (429 genérico quando passa do limite).
import { cabecalhosCors } from "./handlers.ts";

export const LIMITES_ATIVACAO = { porIpPorHora: 10, porCogPorHora: 5, porEmailPorHora: 3, janelaMin: 60 };
const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197";

export const normalizarCog = (v: unknown): string => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
export const emailValido = (v: unknown): v is string => typeof v === "string" && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export interface JoinerAtivacao { id: number; cog: string; email: string | null; bloqueado: boolean | null }
export interface DbAtivacao {
  contar(chave: string, desdeIso: string): Promise<number>;
  registrar(chave: string): Promise<void>;
  joinersPorCog(cog: string): Promise<JoinerAtivacao[]>;          // candidatas (a comparação exata é feita aqui)
  quantasComEmail(email: string): Promise<number>;
  jaVinculada(joinerId: number): Promise<boolean>;
  liberada(joinerId: number): Promise<boolean>;
}
export interface RedeAtivacao {
  garantirUsuario(email: string): Promise<void>;                  // cria a conta do Auth (sem senha, não confirmada) se ainda não existir
  enviarCodigo(email: string): Promise<void>;                     // pede ao Auth o e-mail com o código (modelo em português)
}
export interface Resultado { status: number; corpo: Record<string, unknown> }
const NEUTRO: Resultado = { status: 200, corpo: { ok: true } };

export async function processarPedidoCodigo(entrada: unknown, ip: string, db: DbAtivacao, rede: RedeAtivacao, agora: Date = new Date()): Promise<Resultado> {
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || Array.isArray(e) || Object.keys(e).some(k => k !== "cog" && k !== "email")) return { status: 400, corpo: { error: "pedido inválido" } };
  const cog = normalizarCog(e.cog);
  if (!cog || cog.length > 64 || /[\s\u0000-\u001f@]/.test(cog) || !emailValido(e.email)) return { status: 400, corpo: { error: "pedido inválido" } };
  const email = (e.email as string).trim().toLowerCase();

  const desde = new Date(agora.getTime() - LIMITES_ATIVACAO.janelaMin * 60000).toISOString();
  const chaves: [string, number][] = [[`ip:${ip || "desconhecido"}`, LIMITES_ATIVACAO.porIpPorHora], [`cog:${cog}`, LIMITES_ATIVACAO.porCogPorHora], [`email:${email}`, LIMITES_ATIVACAO.porEmailPorHora]];
  for (const [chave, limite] of chaves) if ((await db.contar(chave, desde)) >= limite) return { status: 429, corpo: { error: "Muitas tentativas. Espere alguns minutos e tente de novo." } };
  for (const [chave] of chaves) await db.registrar(chave);           // toda tentativa conta, exista ou não o cadastro

  const candidatas = (await db.joinersPorCog(cog)).filter(j => String(j.cog).trim().toLowerCase() === cog);
  if (candidatas.length !== 1) return NEUTRO;                         // não existe, ou é ambíguo (COGs que só mudam de maiúscula)
  const j = candidatas[0];
  if (j.bloqueado) return NEUTRO;
  const cadastrado = String(j.email ?? "").trim().toLowerCase();
  if (!emailValido(cadastrado) || cadastrado !== email) return NEUTRO;   // só vai para o e-mail do cadastro
  if ((await db.quantasComEmail(cadastrado)) !== 1) return NEUTRO;       // e-mail dividido entre joiners: a administradora resolve
  if (await db.jaVinculada(j.id)) return NEUTRO;                         // quem já tem conta entra por @ + senha ou recupera a senha
  if (!(await db.liberada(j.id))) return NEUTRO;                         // a onda dela ainda não foi liberada
  try { await rede.garantirUsuario(cadastrado); await rede.enviarCodigo(cadastrado); } catch (err) { console.error("pedir-codigo-joiner", err instanceof Error ? err.message : err); }
  return NEUTRO;
}

export interface DepsAtivacao { env: (nome: string) => string | undefined; db: () => DbAtivacao; rede: () => RedeAtivacao; agora?: () => Date }
export async function tratarPedidoCodigo(req: Request, deps: DepsAtivacao, ip: string): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = cabecalhosCors(origin, deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  const responder = (r: Resultado) => new Response(JSON.stringify(r.corpo), { status: r.status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder({ status: 405, corpo: { error: "método não permitido" } });
  try {
    return responder(await processarPedidoCodigo(await req.json().catch(() => null), ip, deps.db(), deps.rede(), deps.agora ? deps.agora() : new Date()));
  } catch (e) {
    console.error("pedir-codigo-joiner", e instanceof Error ? e.message : e);
    return responder(NEUTRO);                                          // mesmo em erro interno a resposta é neutra
  }
}
