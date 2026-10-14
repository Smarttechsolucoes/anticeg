// Comprovantes privados (J5): envio e visualização AUTORIZADOS, SEM Deno, rede ou banco reais (tudo entra por "deps"; testável).
// Depois do J5 os buckets de comprovantes são PRIVADOS: ninguém envia arquivo direto no Storage e ninguém abre um link "público".
//   * comprovante-upload : o navegador pede permissão para enviar UM arquivo (bucket, caminho, tipo, tamanho) e recebe um token de envio de uso único.
//                          O servidor confere o caminho, o tipo e o tamanho, aplica limite por hora e NUNCA sobrescreve um arquivo que já existe.
//   * comprovante-url    : devolve um link assinado e curto para VER um comprovante, só para a administradora ou para a dona do pedido
//                          (a função do banco comprovante_assinavel confere se o arquivo pertence a um pedido dela).
import { identificarChamada } from "./notificacoes.ts";
import type { Chamada } from "./notificacoes.ts";
import { cabecalhosCors } from "./handlers.ts";

export const BUCKETS = ["comprovantes", "mercari-comprovantes"];
export const LIMITE_BYTES = 10 * 1024 * 1024;
export const LIMITES_UPLOAD = { anonimoPorHora: 20, joinerPorHora: 60, janelaMin: 60 };
export const SEGUNDOS_LINK = 600;
const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197";

const EXT_MIME: Record<string, string[]> = {
  jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"], webp: ["image/webp"],
  heic: ["image/heic", "image/heif"], heif: ["image/heif", "image/heic"], pdf: ["application/pdf"],
};
export const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

// caminho do arquivo: até 4 pastas de letras, números, ponto, hífen e sublinhado; sem ".." e sem barra no começo
export function caminhoValido(p: unknown): p is string {
  if (typeof p !== "string" || p.length < 3 || p.length > 200) return false;
  if (p.startsWith("/") || p.includes("..") || p.includes("//")) return false;
  const partes = p.split("/");
  if (partes.length > 5) return false;
  return partes.every(s => /^[A-Za-z0-9._-]{1,80}$/.test(s) && !s.startsWith("."));
}
export function extensaoDe(p: string): string { const m = /\.([A-Za-z0-9]{1,5})$/.exec(p); return m ? m[1].toLowerCase() : ""; }

export interface PedidoUpload { bucket: string; path: string; tipo: string }
export function validarPedidoUpload(entrada: unknown): { ok: true; pedido: PedidoUpload } | { ok: false; erro: string } {
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || Array.isArray(e)) return { ok: false, erro: "pedido inválido" };
  if (Object.keys(e).some(k => !["bucket", "path", "tipo", "tamanho"].includes(k))) return { ok: false, erro: "pedido inválido" };
  if (typeof e.bucket !== "string" || !BUCKETS.includes(e.bucket)) return { ok: false, erro: "bucket não permitido" };
  if (!caminhoValido(e.path)) return { ok: false, erro: "caminho inválido" };
  const ext = extensaoDe(e.path);
  const tipo = typeof e.tipo === "string" ? e.tipo.toLowerCase().split(";")[0].trim() : "";
  if (!EXT_MIME[ext]) return { ok: false, erro: "tipo de arquivo não permitido" };
  // o navegador às vezes informa tipo vazio ou genérico: a extensão decide; se informou um tipo, ele precisa combinar com a extensão
  if (tipo && tipo !== "application/octet-stream" && !EXT_MIME[ext].includes(tipo)) return { ok: false, erro: "tipo de arquivo não permitido" };
  const tamanho = Number(e.tamanho);
  if (!Number.isFinite(tamanho) || tamanho <= 0) return { ok: false, erro: "tamanho inválido" };
  if (tamanho > LIMITE_BYTES) return { ok: false, erro: "arquivo grande demais (máximo 10 MB)" };
  return { ok: true, pedido: { bucket: e.bucket, path: e.path, tipo: EXT_MIME[ext][0] } };
}

function responder(status: number, corpo: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export interface DepsUpload {
  env: (nome: string) => string | undefined;
  resolverToken: (token: string) => Promise<{ admin: boolean; cog: string | null }>;
  contar: (chave: string, desdeIso: string) => Promise<number>;
  registrar: (chave: string) => Promise<void>;
  assinar: (bucket: string, path: string) => Promise<{ token: string; path: string } | null>;   // null = o arquivo já existe
  agora?: () => Date;
}
export async function tratarUploadComprovante(req: Request, deps: DepsUpload, ip: string): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = cabecalhosCors(origin, deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder(405, { error: "método não permitido" }, cors);
  try {
    const chamada: Chamada = await identificarChamada(req.headers.get("authorization"), deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "", deps.resolverToken);
    const permitirAnonimo = (deps.env("PERMITIR_COMPROVANTE_ANONIMO") ?? "true") !== "false";
    if (chamada.quem === "anonimo" && !permitirAnonimo) return responder(401, { error: "entre na sua conta para enviar o comprovante" }, cors);
    const v = validarPedidoUpload(await req.json().catch(() => null));
    if (!v.ok) return responder(400, { error: v.erro }, cors);
    const agora = deps.agora ? deps.agora() : new Date();
    const desde = new Date(agora.getTime() - LIMITES_UPLOAD.janelaMin * 60000).toISOString();
    const chave = chamada.cogConta ? `cog:${chamada.cogConta.toLowerCase()}` : chamada.quem === "admin" || chamada.quem === "servico" ? `admin` : `ip:${ip || "desconhecido"}`;
    const limite = chamada.quem === "anonimo" ? LIMITES_UPLOAD.anonimoPorHora : LIMITES_UPLOAD.joinerPorHora;
    if (chamada.quem !== "admin" && chamada.quem !== "servico" && (await deps.contar(chave, desde)) >= limite) return responder(429, { error: "Muitos envios agora. Tente de novo em alguns minutos." }, cors);
    const assinado = await deps.assinar(v.pedido.bucket, v.pedido.path);
    if (!assinado) return responder(409, { error: "já existe um arquivo com esse nome" }, cors);
    await deps.registrar(chave);
    return responder(200, { ok: true, bucket: v.pedido.bucket, path: assinado.path, token: assinado.token, tipo: v.pedido.tipo }, cors);
  } catch (e) {
    console.error("comprovante-upload", e instanceof Error ? e.message : e);
    return responder(500, { error: "não foi possível autorizar o envio agora" }, cors);
  }
}

export interface DepsUrl {
  env: (nome: string) => string | undefined;
  resolverToken: (token: string) => Promise<{ admin: boolean; cog: string | null }>;
  podeVer: (token: string, bucket: string, path: string) => Promise<boolean>;       // função do banco, com o login de quem pede
  assinarLeitura: (bucket: string, path: string, segundos: number) => Promise<string | null>;
}
export async function tratarUrlComprovante(req: Request, deps: DepsUrl): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = cabecalhosCors(origin, deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder(405, { error: "método não permitido" }, cors);
  try {
    const cab = req.headers.get("authorization");
    const chamada = await identificarChamada(cab, deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "", deps.resolverToken);
    if (chamada.quem === "anonimo") return responder(401, { error: "entre na sua conta para ver o comprovante" }, cors);
    const e = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!e || typeof e !== "object" || Object.keys(e).some(k => k !== "bucket" && k !== "path") || typeof e.bucket !== "string" || !BUCKETS.includes(e.bucket) || !caminhoValidoLeitura(e.path)) return responder(400, { error: "pedido inválido" }, cors);
    const bucket = e.bucket as string, path = e.path as string;
    if (chamada.quem === "joiner") {
      const token = /^Bearer\s+(.+)$/i.exec(cab || "")![1].trim();
      if (!(await deps.podeVer(token, bucket, path))) return responder(404, { error: "comprovante não encontrado" }, cors);   // mesma resposta de "não existe"
    }
    const url = await deps.assinarLeitura(bucket, path, SEGUNDOS_LINK);
    if (!url) return responder(404, { error: "comprovante não encontrado" }, cors);
    return responder(200, { ok: true, url }, cors);
  } catch (e) {
    console.error("comprovante-url", e instanceof Error ? e.message : e);
    return responder(500, { error: "não foi possível abrir o comprovante agora" }, cors);
  }
}
// na leitura, arquivos antigos podem ter nomes com espaço ou acento: aceita qualquer caminho sem "..", sem barra inicial e sem caracteres de controle
export function caminhoValidoLeitura(p: unknown): p is string {
  return typeof p === "string" && p.length >= 1 && p.length <= 300 && !p.startsWith("/") && !p.includes("..") && !/[\u0000-\u001f]/.test(p);
}
