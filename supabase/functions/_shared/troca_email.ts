// "QUERO MUDAR DE E-MAIL" (J13): trocar o e-mail do cadastro COM PROVA. SEM Deno, rede ou banco reais (tudo entra por "deps"; testável).
//
// O que esta função faz e o que NÃO faz:
//   * NUNCA vincula uma conta a um cadastro. Confirmar um e-mail novo só cria/atualiza um PEDIDO (tabela emergencia.trocas_email, via funções do banco).
//   * Quem decide se a troca vale é o BANCO (public.troca_email_concluir): só aplica sozinho se o cadastro já é "liberado pela regra", o e-mail antigo foi provado, o novo foi provado,
//     nada mudou no meio-tempo e a pessoa continua liberada DEPOIS da troca. Senão, o pedido vai para a administração com o e-mail novo já verificado.
//   * Duas vias: 'email_antigo' (prova o e-mail cadastrado e depois o novo) e 'sem_acesso' (só o novo; NUNCA aplica sozinho).
//   * O código do e-mail NOVO só sai depois que o do ANTIGO foi provado (via 'email_antigo'). O servidor só guarda o HASH dos códigos; os códigos são derivados por HMAC (segredo do servidor + nonce)
//     para poderem ser reenviados sem ficarem guardados.
//   * Quem não acerta o par (@ + e-mail cadastrado) recebe a MESMA forma de resposta (um "token" que parece verdadeiro e nunca é aceito). A resposta nunca afirma que algo foi enviado.
//   * Nenhuma resposta contém e-mail completo ou código. Os e-mails enviados não citam o @ do cadastro (o e-mail novo pode ser de terceiros).
import { cabecalhosCors } from "./handlers.ts";
import { normalizarCog, emailValido } from "./ativacao.ts";
import type { JoinerAtivacao, Resultado } from "./ativacao.ts";
import { mascararEmail } from "./ativacao_dica.ts";

export const LIMITES_TROCA = { iniciarPorIpPorHora: 8, iniciarPorCogPorHora: 3, iniciarPorNovoEmailPorHora: 3, confirmarPorIpPorHora: 30, envioNovoPorPedido: 3, janelaMin: 60, validadeMin: 30 };
const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197";

export type ViaTroca = "email_antigo" | "sem_acesso";
export type ResultadoConferir = "ok" | "errado" | "bloqueado" | "expirado" | "invalido";
export type ResultadoConcluir = "aplicada" | "aguardando_identidade" | "incompleto" | "invalido" | "expirado";
export interface DbTroca {
  contar(chave: string, desdeIso: string): Promise<number>;
  registrar(chave: string): Promise<void>;
  joinersPorCog(cog: string): Promise<JoinerAtivacao[]>;
  quantasComEmail(email: string): Promise<number>;
  /** public.troca_email_abrir (só o servidor). Devolve o id. Erros do banco chegam como Error com o código curto (email_em_uso, conta_ativa, limite_diario...). */
  abrir(joinerId: number, via: ViaTroca, novoEmail: string, codAntigoHash: string | null, codNovoHash: string): Promise<number>;
  conferir(id: number, lado: "antigo" | "novo", codHash: string): Promise<ResultadoConferir>;
  concluir(id: number): Promise<ResultadoConcluir>;
}
/** Envia UM e-mail pelo remetente do site. Lança erro se o provedor recusar (nada é afirmado à pessoa nesse caso). */
export type EnviarEmail = (para: string, assunto: string, texto: string, html: string) => Promise<void>;

// ───────────────────────────── criptografia (HMAC) ─────────────────────────────
const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b as ArrayBuffer)].map(x => x.toString(16).padStart(2, "0")).join("");
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
async function chaveHmac(segredo: string) { return crypto.subtle.importKey("raw", enc.encode("troca-email-v1:" + segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
async function hmac(segredo: string, texto: string): Promise<Uint8Array> { return new Uint8Array(await crypto.subtle.sign("HMAC", await chaveHmac(segredo), enc.encode(texto))); }
export async function sha256Hex(texto: string): Promise<string> { return hex(await crypto.subtle.digest("SHA-256", enc.encode(texto))); }

/** Código de 6 dígitos derivado do segredo do servidor + lado + nonce. Quem não tem o segredo não o calcula; o banco guarda só o sha256. */
export async function codigoDerivado(segredo: string, lado: "antigo" | "novo", nonce: string): Promise<string> {
  const h = await hmac(segredo, `codigo:${lado}:${nonce}`);
  const n = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}
export interface CargaToken { p: number; n: string; m: string; v: ViaTroca; e: number }
export async function assinarToken(segredo: string, c: CargaToken): Promise<string> {
  const corpo = b64u(enc.encode(JSON.stringify(c)));
  return `${corpo}.${b64u(await hmac(segredo, "token:" + corpo))}`;
}
/** Token FALSO, de aparência idêntica ao verdadeiro; a assinatura é aleatória e nunca confere. */
export function tokenFalso(c: CargaToken): string {
  return `${b64u(enc.encode(JSON.stringify(c)))}.${b64u(crypto.getRandomValues(new Uint8Array(32)))}`;
}
export async function lerToken(segredo: string, token: unknown, agora: Date): Promise<CargaToken | null> {
  if (typeof token !== "string" || token.length > 600) return null;
  const [corpo, assinatura, sobra] = token.split(".");
  if (!corpo || !assinatura || sobra !== undefined) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await chaveHmac(segredo), deB64u(assinatura), enc.encode("token:" + corpo)))) return null;
    const c = JSON.parse(new TextDecoder().decode(deB64u(corpo))) as CargaToken;
    if (!Number.isInteger(c.p) || typeof c.n !== "string" || typeof c.m !== "string" || (c.v !== "email_antigo" && c.v !== "sem_acesso") || typeof c.e !== "number" || c.e * 1000 < agora.getTime()) return null;
    return c;
  } catch { return null; }
}
const novoNonce = () => hex(crypto.getRandomValues(new Uint8Array(16)));

// ───────────────────────────── modelos de e-mail ─────────────────────────────
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
function modelo(titulo: string, linhas: string[], codigo: string): { assunto: string; texto: string; html: string } {
  const texto = `${titulo}\n\n${linhas.join("\n\n")}\n\nCódigo: ${codigo}\n\nO código vale por ${LIMITES_TROCA.validadeMin} minutos e só funciona uma vez. Não envie este código a ninguém.\nSe não foi você, ignore esta mensagem: nada muda sem o código.\n\nANTICEG`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:16px;color:#222">
<h2 style="margin:0 0 12px">${esc(titulo)}</h2>${linhas.map(l => `<p style="margin:0 0 12px;line-height:1.45">${esc(l)}</p>`).join("")}
<p style="font-size:30px;letter-spacing:6px;font-weight:bold;margin:16px 0;text-align:center">${esc(codigo)}</p>
<p style="margin:0 0 8px;line-height:1.45;font-size:13px;color:#555">O código vale por ${LIMITES_TROCA.validadeMin} minutos e só funciona uma vez. Não envie este código a ninguém.</p>
<p style="margin:0;line-height:1.45;font-size:13px;color:#555">Se não foi você, ignore esta mensagem: nada muda sem o código.</p></div>`;
  return { assunto: `ANTICEG — ${titulo}`, texto, html };
}
/** Código no e-mail ANTIGO (o do cadastro). Não cita o @; mostra só o endereço novo mascarado, para a dona reconhecer o pedido. */
export function modeloCodigoAntigo(codigo: string, novoEmail: string) {
  return modelo("código para mudar o e-mail do cadastro", [`Alguém pediu para trocar o e-mail do cadastro ligado a este endereço para ${mascararEmail(novoEmail) ?? "outro endereço"}.`, "Se foi você, digite o código abaixo na tela do site."], codigo);
}
/** Código no e-mail NOVO. Não cita o @ nem o endereço antigo: este endereço pode ser de outra pessoa. */
export function modeloCodigoNovo(codigo: string) {
  return modelo("código para confirmar este e-mail", ["Este endereço foi informado para ser o e-mail de um cadastro na ANTICEG.", "Se foi você, digite o código abaixo na tela do site para confirmar que este e-mail é seu."], codigo);
}

// ───────────────────────────── processamento ─────────────────────────────
/** Só para quem acertou o par (@ + e-mail cadastrado) e NÃO pode seguir por aqui. */
export type ProximoTroca = "ajuda" | "entrar" | "limite";
const proximo = (p: ProximoTroca): Resultado => ({ status: 200, corpo: { ok: true, proximo: p } });
const codigoCurto = (err: unknown) => (err instanceof Error ? err.message : String(err));

interface Contexto { db: DbTroca; enviar: EnviarEmail; segredo: string; ip: string; agora: Date }

export async function processarTroca(entrada: unknown, ctx: Contexto): Promise<Resultado> {
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || Array.isArray(e)) return { status: 400, corpo: { error: "pedido inválido" } };
  if (e.acao === "iniciar") return iniciar(e, ctx);
  if (e.acao === "confirmar") return confirmar(e, ctx);
  return { status: 400, corpo: { error: "pedido inválido" } };
}

async function limitar(ctx: Contexto, chaves: [string, number][], janelaMin = LIMITES_TROCA.janelaMin): Promise<Resultado | null> {
  const desde = new Date(ctx.agora.getTime() - janelaMin * 60000).toISOString();
  for (const [chave, limite] of chaves) if ((await ctx.db.contar(chave, desde)) >= limite) return { status: 429, corpo: { error: "Muitas tentativas. Espere alguns minutos e tente de novo." } };
  for (const [chave] of chaves) await ctx.db.registrar(chave);          // toda tentativa conta, acerte ou não
  return null;
}

async function iniciar(e: Record<string, unknown>, ctx: Contexto): Promise<Resultado> {
  const chavesOk = new Set(["acao", "cog", "email", "novo_email", "via"]);
  if (Object.keys(e).some(k => !chavesOk.has(k))) return { status: 400, corpo: { error: "pedido inválido" } };
  const via = e.via as ViaTroca;
  const cog = normalizarCog(e.cog);
  if ((via !== "email_antigo" && via !== "sem_acesso") || !cog || cog.length > 64 || /[\s\u0000-\u001f@]/.test(cog) || !emailValido(e.novo_email)) return { status: 400, corpo: { error: "pedido inválido" } };
  if (via === "email_antigo" && !emailValido(e.email)) return { status: 400, corpo: { error: "pedido inválido" } };
  const novo = (e.novo_email as string).trim().toLowerCase();
  const antigoDigitado = via === "email_antigo" ? (e.email as string).trim().toLowerCase() : null;
  if (antigoDigitado && antigoDigitado === novo) return { status: 400, corpo: { error: "pedido inválido" } };

  const bloqueio = await limitar(ctx, [[`troca-ip:${ctx.ip || "desconhecido"}`, LIMITES_TROCA.iniciarPorIpPorHora], [`troca-cog:${cog}`, LIMITES_TROCA.iniciarPorCogPorHora], [`troca-novo:${novo}`, LIMITES_TROCA.iniciarPorNovoEmailPorHora]]);
  if (bloqueio) return bloqueio;

  const exp = Math.floor(ctx.agora.getTime() / 1000) + LIMITES_TROCA.validadeMin * 60;
  // resposta-padrão (par errado, cadastro inexistente, erro qualquer): mesma forma da verdadeira, com um token que nunca é aceito
  const aparente = (): Resultado => ({ status: 200, corpo: { ok: true, via, token: tokenFalso({ p: 1 + Math.floor(Math.random() * 90000), n: novoNonce(), m: novo, v: via, e: exp }) } });
  try {
    const candidatas = (await ctx.db.joinersPorCog(cog)).filter(j => String(j.cog).trim().toLowerCase() === cog);
    if (candidatas.length !== 1) return aparente();
    const j = candidatas[0];
    const cadastrado = String(j.email ?? "").trim().toLowerCase();
    if (via === "email_antigo") {
      if (!emailValido(cadastrado) || cadastrado !== antigoDigitado) return aparente();     // o PAR precisa estar certo
      // ── daqui em diante a pessoa acertou o par: pode saber que não dá para seguir por aqui ──
      if (j.bloqueado) return proximo("ajuda");
      if ((await ctx.db.quantasComEmail(cadastrado)) !== 1) return proximo("ajuda");
    } else if (j.bloqueado) return aparente();                                              // sem_acesso: não há par para provar; nada aparece para ninguém
    const nonce = novoNonce();
    const codAntigo = via === "email_antigo" ? await codigoDerivado(ctx.segredo, "antigo", nonce) : null;
    const codNovo = await codigoDerivado(ctx.segredo, "novo", nonce);
    let id: number;
    try { id = await ctx.db.abrir(j.id, via, novo, codAntigo ? await sha256Hex(codAntigo) : null, await sha256Hex(codNovo)); }
    catch (err) {
      const c = codigoCurto(err);
      if (via === "email_antigo") {
        if (/conta_ativa/.test(c)) return proximo("entrar");
        if (/limite_diario/.test(c)) return proximo("limite");
        if (/email_em_uso|sem_email_antigo|email_igual/.test(c)) return proximo("ajuda");
      }
      console.error("trocar-email-joiner", c);
      return aparente();
    }
    const token = await assinarToken(ctx.segredo, { p: id, n: nonce, m: novo, v: via, e: exp });
    try {
      if (via === "email_antigo") { const m = modeloCodigoAntigo(codAntigo!, novo); await ctx.enviar(cadastrado, m.assunto, m.texto, m.html); }
      else { const m = modeloCodigoNovo(codNovo); await ctx.enviar(novo, m.assunto, m.texto, m.html); await ctx.db.registrar(`troca-envio:${id}`); }
    } catch (err) { console.error("trocar-email-joiner: envio", codigoCurto(err)); }       // mesma resposta: nada é afirmado sobre o envio
    return { status: 200, corpo: { ok: true, via, token } };
  } catch (err) {
    console.error("trocar-email-joiner", codigoCurto(err));
    return aparente();
  }
}

async function confirmar(e: Record<string, unknown>, ctx: Contexto): Promise<Resultado> {
  const chavesOk = new Set(["acao", "token", "lado", "codigo"]);
  if (Object.keys(e).some(k => !chavesOk.has(k))) return { status: 400, corpo: { error: "pedido inválido" } };
  const codigo = typeof e.codigo === "string" ? e.codigo.replace(/\s+/g, "") : "";
  if ((e.lado !== "antigo" && e.lado !== "novo") || !/^\d{6}$/.test(codigo)) return { status: 400, corpo: { error: "pedido inválido" } };
  const lado = e.lado as "antigo" | "novo";
  const bloqueio = await limitar(ctx, [[`troca-conf-ip:${ctx.ip || "desconhecido"}`, LIMITES_TROCA.confirmarPorIpPorHora]]);
  if (bloqueio) return bloqueio;
  const t = await lerToken(ctx.segredo, e.token, ctx.agora);
  if (!t) return { status: 200, corpo: { ok: true, resultado: "errado" } };                // token falso, adulterado ou vencido: mesma resposta de um código errado
  if (lado === "antigo" && t.v !== "email_antigo") return { status: 400, corpo: { error: "pedido inválido" } };
  try {
    const r = await ctx.db.conferir(t.p, lado, await sha256Hex(codigo));
    if (r === "errado") return { status: 200, corpo: { ok: true, resultado: "errado" } };
    if (r === "bloqueado") return { status: 200, corpo: { ok: true, resultado: "bloqueado" } };
    if (r !== "ok") return { status: 200, corpo: { ok: true, resultado: "expirado" } };
    if (lado === "antigo") {
      // e-mail antigo provado: AGORA (e só agora) sai o código do e-mail novo
      const usados = await ctx.db.contar(`troca-envio:${t.p}`, new Date(ctx.agora.getTime() - LIMITES_TROCA.validadeMin * 60000).toISOString());
      if (usados >= LIMITES_TROCA.envioNovoPorPedido) return { status: 200, corpo: { ok: true, resultado: "limite_envio" } };
      try {
        await ctx.db.registrar(`troca-envio:${t.p}`);
        const m = modeloCodigoNovo(await codigoDerivado(ctx.segredo, "novo", t.n));
        await ctx.enviar(t.m, m.assunto, m.texto, m.html);
      } catch (err) { console.error("trocar-email-joiner: envio novo", codigoCurto(err)); return { status: 200, corpo: { ok: true, resultado: "falha_envio" } }; }   // só aqui a pessoa já provou o antigo
      return { status: 200, corpo: { ok: true, resultado: "antigo_ok", novo_mascarado: mascararEmail(t.m) } };
    }
    const fim = await ctx.db.concluir(t.p);
    if (fim === "aplicada") return { status: 200, corpo: { ok: true, resultado: "aplicada" } };
    if (fim === "aguardando_identidade") return { status: 200, corpo: { ok: true, resultado: "aguardando_identidade" } };
    if (fim === "incompleto") return { status: 200, corpo: { ok: true, resultado: "falta_antigo" } };
    return { status: 200, corpo: { ok: true, resultado: "expirado" } };
  } catch (err) {
    console.error("trocar-email-joiner: confirmar", codigoCurto(err));
    return { status: 200, corpo: { ok: true, resultado: "erro" } };
  }
}

export interface DepsTroca { env: (nome: string) => string | undefined; db: () => DbTroca; enviar: () => EnviarEmail; agora?: () => Date }
export async function tratarTroca(req: Request, deps: DepsTroca, ip: string): Promise<Response> {
  const cors = cabecalhosCors(req.headers.get("origin"), deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  const responder = (r: Resultado) => new Response(JSON.stringify(r.corpo), { status: r.status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder({ status: 405, corpo: { error: "método não permitido" } });
  const segredo = deps.env("DICA_SEGREDO");
  if (!segredo || segredo.length < 16) return responder({ status: 503, corpo: { error: "indisponível" } });
  try {
    return responder(await processarTroca(await req.json().catch(() => null), { db: deps.db(), enviar: deps.enviar(), segredo, ip, agora: deps.agora ? deps.agora() : new Date() }));
  } catch (err) {
    console.error("trocar-email-joiner", codigoCurto(err));
    return responder({ status: 500, corpo: { error: "erro interno" } });
  }
}
