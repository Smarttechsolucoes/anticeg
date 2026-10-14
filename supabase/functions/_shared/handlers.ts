// Tratamento HTTP das funções de e-mail e push, SEM Deno, rede ou banco reais: tudo entra por "deps" (injeção), então dá para testar sem enviar nada.
// As funções (index.ts) só montam as dependências reais e chamam estes tratadores.
import { prepararEmail, identificarChamada, validarPush } from "./notificacoes.ts";
import type { Db, Chamada } from "./notificacoes.ts";

const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197";

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

export interface DepsEmail {
  env: (nome: string) => string | undefined;
  db: () => Db;
  resolverToken: (token: string) => Promise<{ admin: boolean; cog: string | null }>;
  fetch: typeof fetch;
  desfazerEnvio: (evento: string, destinatario: string) => Promise<void>;
  agora?: () => Date;
}

export async function tratarEmail(req: Request, deps: DepsEmail): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = cabecalhosCors(origin, deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder(405, { error: "método não permitido" }, cors);
  try {
    const chave = deps.env("SENDGRID_API_KEY"), remetente = deps.env("SENDER_EMAIL"), nomeRemetente = deps.env("SENDER_NAME") ?? "ANTICEG";
    if (!chave || !remetente) return responder(500, { error: "envio de e-mail não configurado" }, cors);

    const chamada: Chamada = await identificarChamada(req.headers.get("authorization"), deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "", deps.resolverToken);
    const permitirAnonimo = (deps.env("PERMITIR_COMPROVANTE_ANONIMO") ?? "true") !== "false";
    const entrada = await req.json().catch(() => null);
    const r = await prepararEmail(entrada, chamada.quem, deps.db(), deps.agora ? deps.agora() : new Date(), { cogConta: chamada.cogConta, permitirAnonimo });
    if (!r.ok) return responder(r.status, { error: r.erro }, cors);

    const envio = await deps.fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "Authorization": `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ personalizations: [{ to: [{ email: r.para, name: r.nome }] }], from: { email: remetente, name: nomeRemetente }, subject: r.assunto, content: [{ type: "text/html", value: r.html }] }),
    });
    if (!envio.ok) {
      await deps.desfazerEnvio(r.evento!, r.para!);        // devolve a vaga: uma nova tentativa legítima volta a funcionar
      return responder(502, { error: "falha no provedor de e-mail" }, cors);   // o detalhe do provedor nunca vai para o navegador
    }
    return responder(200, { ok: true }, cors);             // nunca devolve destinatário nem conteúdo
  } catch {
    return responder(500, { error: "erro interno" }, cors);
  }
}

export interface DepsPush {
  env: (nome: string) => string | undefined;
  resolverToken: (token: string) => Promise<{ admin: boolean; cog: string | null }>;
  enviar: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, vapid: { assunto: string; publica: string; privada: string }) => Promise<void>;
}

export async function tratarPush(req: Request, deps: DepsPush): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = cabecalhosCors(origin, deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder(405, { error: "método não permitido" }, cors);
  try {
    const chamada = await identificarChamada(req.headers.get("authorization"), deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "", deps.resolverToken);
    // só administradora ou o serviço do sync enviam push (uma joiner logada não)
    const quem = chamada.quem === "admin" || chamada.quem === "servico" ? chamada.quem : "anonimo";
    const v = validarPush(await req.json().catch(() => null), quem);
    if (!v.ok) return responder(v.status, { error: v.erro }, cors);
    const publica = deps.env("VAPID_PUBLIC_KEY") ?? "", privada = deps.env("VAPID_PRIVATE_KEY") ?? "";
    if (!publica || !privada) return responder(500, { error: "push não configurado" }, cors);
    const d = v.dados!;
    await deps.enviar(d.subscription, JSON.stringify({ title: d.title, body: d.body, url: d.url }), { assunto: deps.env("VAPID_SUBJECT") ?? "mailto:anticegs@gmail.com", publica, privada });
    return responder(200, { ok: true }, cors);
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    return status === 404 || status === 410 ? responder(410, { error: "inscrição expirada" }, cors) : responder(500, { error: "erro interno" }, cors);
  }
}
