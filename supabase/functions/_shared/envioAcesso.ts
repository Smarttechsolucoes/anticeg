// Autoatendimento do ENVIO NACIONAL (ENV2): a joiner prova que é dona do @ com um CÓDIGO enviado ao e-mail JÁ CADASTRADO. SEM Deno, rede ou banco reais: tudo entra por "deps" (testável em Node).
// O @ sozinho nunca dá acesso. A resposta do pedido é SEMPRE a mesma (não revela se o @ existe, se tem e-mail ou se está bloqueado) e nunca contém e-mail, telefone ou qualquer dado pessoal.
// O código tem 6 dígitos, vale 10 minutos e aceita 5 tentativas (regras no banco: public.envio_codigo_emitir / envio_codigo_validar). O banco guarda só o HASH do código.

export const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5301";
export const MENSAGEM_PEDIDO = "Se este @ tem e-mail cadastrado, enviamos um código de 6 dígitos para esse e-mail. Ele vale por 10 minutos. Confira também a caixa de spam.";
export const MENSAGEM_ERRO_CODIGO = "Código inválido ou expirado. Confira o e-mail ou peça um código novo.";
const COG_VALIDO = /^[\p{L}\p{N}_.\-() ]{1,60}$/u;

export interface DepsEnvioAcesso {
  env: (nome: string) => string | undefined;
  emitir: (cog: string, codigoHash: string, ipHash: string | null) => Promise<string | null>;       // devolve o e-mail de destino só se o pedido é permitido
  validar: (cog: string, codigoHash: string, ipHash: string | null) => Promise<string | null>;      // devolve o token de acesso ou null
  enviarEmail: (para: string, codigo: string) => Promise<void>;
  depois?: (p: Promise<unknown>) => void;                                                          // roda em segundo plano (resposta não depende do envio: sem diferença de tempo)
  aleatorio?: () => string;                                                                         // 6 dígitos (injetável nos testes)
}

export function cabecalhosCors(origin: string | null, permitidas: string): Record<string, string> {
  const lista = permitidas.split(",").map(s => s.trim()).filter(Boolean);
  return {
    ...(origin && lista.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
export function normalizarCog(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().replace(/^@+/, "");
  return COG_VALIDO.test(c) ? c : null;
}
export function codigoAleatorio(): string {
  // 6 dígitos uniformes (rejeição para evitar viés de módulo)
  const buf = new Uint32Array(1); const limite = Math.floor(0xFFFFFFFF / 1_000_000) * 1_000_000;
  let n: number; do { crypto.getRandomValues(buf); n = buf[0]; } while (n >= limite);
  return String(n % 1_000_000).padStart(6, "0");
}
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
export async function hmacHex(segredo: string, texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto)));
}
export function corpoEmailCodigo(codigo: string): { assunto: string; html: string } {
  return {
    assunto: "Seu código de acesso ao Envio Nacional — Anti CEG",
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222"><h2 style="margin:0 0 12px">Envio Nacional — Anti CEG</h2><p>Use este código para entrar no seu Envio Nacional:</p><p style="font-size:34px;letter-spacing:8px;font-weight:bold;margin:18px 0">${codigo}</p><p>Ele vale por <strong>10 minutos</strong> e só funciona uma vez.</p><p style="color:#666;font-size:12px">Se você não pediu este código, ignore este e-mail: ninguém consegue entrar sem ele.</p></div>`,
  };
}

function responder(status: number, corpo: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function tratarEnvioAcesso(req: Request, deps: DepsEnvioAcesso): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = cabecalhosCors(origin, deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder(405, { erro: "método não permitido" }, cors);
  try {
    const corpo = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return responder(400, { erro: "pedido inválido" }, cors);
    if (Object.keys(corpo).some(k => !["acao", "cog", "codigo"].includes(k))) return responder(400, { erro: "pedido inválido" }, cors);
    const cog = normalizarCog(corpo.cog);
    if (!cog) return responder(400, { erro: "Informe o seu @ da comunidade." }, cors);
    const segredo = deps.env("ENVIO_CODIGO_SEGREDO") ?? deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!segredo) return responder(500, { erro: "serviço indisponível" }, cors);
    const ipBruto = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "";
    const ipHash = ipBruto ? await hmacHex(segredo, "ip|" + ipBruto) : null;
    const cogChave = cog.toLowerCase();

    if (corpo.acao === "pedir") {
      const codigo = (deps.aleatorio ?? codigoAleatorio)();
      const hash = await hmacHex(segredo, `${cogChave}|${codigo}`);
      const destino = await deps.emitir(cog, hash, ipHash);
      if (destino && deps.env("ENVIO_CODIGO_MODO_SECO") !== "true") {
        const envio = deps.enviarEmail(destino, codigo).catch(e => { console.error("envio-acesso: falha ao enviar o e-mail", e instanceof Error ? e.message : "erro"); });
        if (deps.depois) deps.depois(envio); else await envio;
      }
      return responder(200, { ok: true, mensagem: MENSAGEM_PEDIDO }, cors);   // igual para @ inexistente, sem e-mail, bloqueado, limite atingido ou enviado
    }
    if (corpo.acao === "validar") {
      const codigo = typeof corpo.codigo === "string" ? corpo.codigo.replace(/\s+/g, "") : "";
      if (!/^\d{6}$/.test(codigo)) return responder(400, { ok: false, erro: "Digite os 6 dígitos do código." }, cors);
      const token = await deps.validar(cog, await hmacHex(segredo, `${cogChave}|${codigo}`), ipHash);
      if (!token) return responder(200, { ok: false, erro: MENSAGEM_ERRO_CODIGO }, cors);
      return responder(200, { ok: true, token }, cors);
    }
    return responder(400, { erro: "pedido inválido" }, cors);
  } catch (e) {
    console.error("envio-acesso", e instanceof Error ? e.message : "erro");
    return responder(500, { erro: "serviço indisponível" }, cors);
  }
}
