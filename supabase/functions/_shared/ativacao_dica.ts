// PROPOSTA (NÃO PUBLICADA, NÃO LIGADA a nenhuma função): "dica" do e-mail cadastrado na ativação, SEM Deno, rede ou banco reais (tudo entra por "deps"; testável).
// Jornada: a pessoa informa o @; o site mostra SÓ uma parte mascarada do e-mail ("m•••@g•••.com"); ela digita o e-mail completo; o código segue pelo caminho que já existe (pedir-codigo-joiner).
// Regras de segurança desta etapa (cada uma tem teste):
//   * a resposta tem SEMPRE a mesma forma ({ok:true, dica}), exista ou não o @, tenha ou não e-mail válido, seja ambíguo, bloqueado ou já ativado: ninguém descobre por aqui quem existe;
//   * @ que não dá uma dica real recebe uma dica FALSA, mas estável (derivada do @ por HMAC com um segredo do servidor): perguntar de novo devolve a mesma, e não se distingue da real pelo formato;
//   * a dica nunca mostra o tamanho do e-mail (sempre 3 pontos), nem o domínio inteiro: só a 1ª letra do usuário, a 1ª letra do provedor e o final (.com, .com.br);
//   * limites por hora por rede e por @ e um teto por dia por rede; TODA consulta conta, mesmo a que não acha nada; acima do limite a resposta é 429 genérica;
//   * nenhum código é enviado aqui e nada é gravado além do contador de tentativas.
import { cabecalhosCors } from "./handlers.ts";

// Auto-contido: não depende de outros módulos além de handlers.ts (cabeçalhos CORS), para ser publicado sozinho.
export interface Resultado { status: number; corpo: Record<string, unknown> }
export interface JoinerAtivacao { id: number; cog: string; email: string | null; bloqueado: boolean | null }
export const normalizarCog = (v: unknown): string => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
export const emailValido = (v: unknown): v is string => typeof v === "string" && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const LIMITES_DICA = { porIpPorHora: 8, porCogPorHora: 4, porIpPorDia: 30, janelaHoraMin: 60, janelaDiaMin: 1440 };
const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197";
const PONTOS = "•••";

/** "maria.souza@gmail.com" -> "m•••@g•••.com". Sempre 3 pontos (não revela o tamanho). Devolve null se não for e-mail utilizável. */
export function mascararEmail(email: unknown): string | null {
  if (!emailValido(email)) return null;
  const e = email.trim().toLowerCase();
  const arroba = e.lastIndexOf("@");
  const usuario = e.slice(0, arroba), dominio = e.slice(arroba + 1);
  const ponto = dominio.indexOf(".");
  if (!usuario || ponto < 1) return null;
  return `${[...usuario][0]}${PONTOS}@${[...dominio][0]}${PONTOS}${dominio.slice(ponto)}`;
}

const LETRAS = "abcdefghijklmnopqrstuvwxyz";
// provedores mais comuns, com peso (a dica falsa se parece com as verdadeiras)
const PROVEDORES: [string, string, number][] = [["g", ".com", 70], ["h", ".com", 12], ["o", ".com", 8], ["y", ".com", 4], ["i", ".com", 3], ["h", ".com.br", 2], ["u", ".com.br", 1]];

async function hmac(segredo: string, texto: string): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto)));
}

/** Dica FALSA e estável para um @ sem dica real: mesma entrada + mesmo segredo = mesma dica; sem o segredo não dá para prever. */
export async function dicaFalsa(cog: string, segredo: string): Promise<string> {
  const h = await hmac(segredo, "dica:" + cog);
  const total = PROVEDORES.reduce((s, p) => s + p[2], 0);
  let alvo = ((h[1] << 8) | h[2]) % total, escolhido = PROVEDORES[0];
  for (const p of PROVEDORES) { if (alvo < p[2]) { escolhido = p; break; } alvo -= p[2]; }
  return `${LETRAS[h[0] % 26]}${PONTOS}@${escolhido[0]}${PONTOS}${escolhido[1]}`;
}

export interface DbDica {
  contar(chave: string, desdeIso: string): Promise<number>;
  registrar(chave: string): Promise<void>;
  joinersPorCog(cog: string): Promise<JoinerAtivacao[]>;          // candidatas (a comparação exata é feita aqui)
}

export async function processarPedidoDica(entrada: unknown, ip: string, db: DbDica, segredo: string, agora: Date = new Date()): Promise<Resultado> {
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || Array.isArray(e) || Object.keys(e).some(k => k !== "cog")) return { status: 400, corpo: { error: "pedido inválido" } };
  const cog = normalizarCog(e.cog);
  if (!cog || cog.length > 64 || /[\s\u0000-\u001f@]/.test(cog)) return { status: 400, corpo: { error: "pedido inválido" } };

  const desdeHora = new Date(agora.getTime() - LIMITES_DICA.janelaHoraMin * 60000).toISOString();
  const desdeDia = new Date(agora.getTime() - LIMITES_DICA.janelaDiaMin * 60000).toISOString();
  const ipChave = `dica-ip:${ip || "desconhecido"}`;
  const checagens: [string, string, number][] = [[ipChave, desdeHora, LIMITES_DICA.porIpPorHora], [`dica-cog:${cog}`, desdeHora, LIMITES_DICA.porCogPorHora], [ipChave, desdeDia, LIMITES_DICA.porIpPorDia]];
  for (const [chave, desde, limite] of checagens) if ((await db.contar(chave, desde)) >= limite) return { status: 429, corpo: { error: "Muitas tentativas. Espere alguns minutos e tente de novo." } };
  await db.registrar(ipChave); await db.registrar(`dica-cog:${cog}`);   // toda consulta conta, ache ou não

  let dica: string | null = null;
  try {
    const candidatas = (await db.joinersPorCog(cog)).filter(j => String(j.cog).trim().toLowerCase() === cog);
    if (candidatas.length === 1) dica = mascararEmail(candidatas[0].email);     // só 1 cadastro; bloqueado, já ativado ou e-mail compartilhado também recebem a dica real (o estado NÃO é revelado)
  } catch { dica = null; }
  return { status: 200, corpo: { ok: true, dica: dica ?? await dicaFalsa(cog, segredo) } };
}

export interface DepsDica { env: (nome: string) => string | undefined; db: () => DbDica; agora?: () => Date }
export async function tratarPedidoDica(req: Request, deps: DepsDica, ip: string): Promise<Response> {
  const cors = cabecalhosCors(req.headers.get("origin"), deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  const responder = (r: Resultado) => new Response(JSON.stringify(r.corpo), { status: r.status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder({ status: 405, corpo: { error: "método não permitido" } });
  const segredo = deps.env("DICA_SEGREDO");
  if (!segredo || segredo.length < 16) return responder({ status: 503, corpo: { error: "indisponível" } });     // sem segredo configurado a função NÃO responde (não cai em dica previsível)
  try {
    return responder(await processarPedidoDica(await req.json().catch(() => null), ip, deps.db(), segredo, deps.agora ? deps.agora() : new Date()));
  } catch (err) {
    console.error("ativacao-dica", err instanceof Error ? err.message : err);
    return responder({ status: 503, corpo: { error: "indisponível" } });
  }
}
