// Lógica de notificações (e-mail e push), SEM acesso a rede nem a variáveis de ambiente: recebe tudo por parâmetro, para ser testável.
// Regras: o visitante NUNCA escolhe destinatário, assunto ou corpo. Ele só informa o TIPO do evento e o id do registro;
// o servidor busca o registro no banco, confere se o evento é legítimo, descobre o destinatário e monta a mensagem com modelos próprios.

export type Quem = "anonimo" | "joiner" | "admin" | "servico";
// Contexto de quem chama: o COG da conta logada (se for uma joiner com conta ativada) e se o modo legado "só @" ainda é aceito.
// emailAdmin: destinatário FIXO dos avisos para a administração (vem da configuração do servidor, nunca do pedido)
export interface Contexto { cogConta?: string | null; permitirAnonimo?: boolean; emailAdmin?: string | null }

export interface Joiner { cog: string; nome: string | null; email: string | null }
export interface Demanda { id: number; joiner_cog: string; status: string; created_at: string; valor_total: number | string | null; itens: unknown; motivo_rejeicao: string | null }
export interface Report { id: number; joiner_cog: string; item_nome: string | null; resposta: string | null; status: string }
export interface Pendencia { ceg: string | null; nome_do_item: string | null; valor_item: number | null; frete_inter: number | null; taxa_rf: number | null; pago_item: boolean | null; pago_frete: boolean | null; pago_rf: boolean | null }

export interface PreCadastro { cog: string; nome: string | null; email: string | null; created_at: string }

export interface Db {
  preCadastroRecente(cog: string): Promise<PreCadastro | null>;   // último pedido de cadastro daquele @ (tabela pre_cadastros)
  demanda(id: number): Promise<Demanda | null>;
  report(id: number): Promise<Report | null>;
  joinersPorCog(cog: string): Promise<Joiner[]>;
  pendenciasDoJoiner(cog: string): Promise<Pendencia[]>;
  contarEnvios(destinatario: string | null, desdeIso: string): Promise<number>;
  registrarEnvio(e: { evento: string; referencia: string; destinatario: string }): Promise<boolean>; // false = já existia (não reenviar)
}

export const EVENTOS_EMAIL = {
  comprovante_recebido: { quem: ["anonimo", "joiner", "admin", "servico"], campos: ["demanda_id"] },
  comprovante_recusado: { quem: ["admin", "servico"], campos: ["demanda_id"] },
  report_resolvido: { quem: ["admin", "servico"], campos: ["report_id"] },
  lembrete_pagamento: { quem: ["admin", "servico"], campos: ["joiner_cog"] },
  // aviso à administração de um cadastro novo: o visitante só informa o @; texto e destinatário são do servidor, e só vale para um pedido de cadastro RECENTE
  novo_cadastro: { quem: ["anonimo", "joiner", "admin", "servico"], campos: ["joiner_cog"] },
} as const;
export type EventoEmail = keyof typeof EVENTOS_EMAIL;

export const LIMITES = { porDestinatarioPorHora: 6, globalPorDia: 300, janelaComprovanteMin: 30 };

export function escapeHtml(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
export function emailValido(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
const brl = (n: unknown) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function layout(titulo: string, linhas: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ANTICEG</title></head>
<body style="margin:0;padding:0;background:#1a1a1a;font-family:'Courier New',Courier,monospace"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a;padding:32px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
<tr><td style="background:#111111;padding:28px 40px 12px"><div style="font-size:24px;font-weight:700;color:#F5F0E8;letter-spacing:2px">ANTI<span style="color:#FF5C1A">CEG</span></div></td></tr>
<tr><td style="background:#111111;padding:8px 40px 4px"><div style="font-size:15px;font-weight:700;color:#BAFF39">${escapeHtml(titulo)}</div></td></tr>
${linhas}
<tr><td style="background:#111111;padding:20px 40px 28px"><p style="margin:0;font-size:11px;color:rgba(245,240,232,0.35);line-height:1.6">Esta é uma mensagem automática da Anti CEG. Em caso de dúvida, fale com a administração.</p></td></tr>
</table></td></tr></table></body></html>`;
}
const par = (txt: string) => `<tr><td style="background:#111111;padding:6px 40px"><p style="margin:0;font-size:13px;color:rgba(245,240,232,0.7);line-height:1.6">${txt}</p></td></tr>`;
function itensLista(itens: unknown): string {
  const lista = Array.isArray(itens) ? itens.slice(0, 60) : [];
  return lista.map((it: Record<string, unknown>) => {
    const partes = [Number(it?.valor_item) > 0 ? `item R$${brl(it.valor_item)}` : "", Number(it?.frete_inter) > 0 ? `frete R$${brl(it.frete_inter)}` : "", Number(it?.taxa_rf) > 0 ? `taxa RF R$${brl(it.taxa_rf)}` : "", Number(it?.multa) > 0 ? `multa R$${brl(it.multa)}` : ""].filter(Boolean).join(" · ");
    return `<tr><td style="background:#111111;padding:8px 40px;border-bottom:1px solid #1e1e1e"><div style="font-size:12px;font-weight:700;color:#F5F0E8">${escapeHtml(it?.nome_do_item)}</div><div style="font-size:10px;color:rgba(245,240,232,0.4);margin-top:2px">${escapeHtml(it?.ceg)}${partes ? " · " + escapeHtml(partes) : ""}</div></td></tr>`;
  }).join("");
}

export interface ResultadoEmail { ok: boolean; status: number; erro?: string; para?: string; nome?: string; assunto?: string; html?: string; evento?: string }
const falha = (status: number, erro: string): ResultadoEmail => ({ ok: false, status, erro });

// Valida o pedido e monta o e-mail. NÃO envia: devolve para quem, assunto e html para a camada de rede enviar.
export async function prepararEmail(entrada: unknown, quem: Quem, db: Db, agora: Date = new Date(), ctx: Contexto = {}): Promise<ResultadoEmail> {
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || typeof e.evento !== "string" || !Object.prototype.hasOwnProperty.call(EVENTOS_EMAIL, e.evento)) return falha(400, "evento inválido");
  const evento = e.evento as EventoEmail;
  const regra = EVENTOS_EMAIL[evento];
  // o corpo só pode conter "evento" e os campos do evento: qualquer outra coisa (to_email, assunto, corpo...) é rejeitada
  const permitidos = new Set(["evento", ...regra.campos]);
  if (Object.keys(e).some(k => !permitidos.has(k))) return falha(400, "campos não permitidos");
  if (!(regra.quem as readonly string[]).includes(quem)) return falha(quem === "anonimo" ? 401 : 403, "sem permissão para este evento");
  // modo legado (só @, sem login): só enquanto permitido pela configuração; depois do lançamento o comprovante exige a conta da própria joiner
  if (quem === "anonimo" && !ctx.permitirAnonimo) return falha(401, "faça login para continuar");

  let destinoFixo: { para: string; nome: string } | null = null;
  let cogDest = ""; let assunto = ""; let blocos = ""; let titulo = ""; let referencia = "";
  if (evento === "comprovante_recebido" || evento === "comprovante_recusado") {
    const id = Number(e.demanda_id);
    if (!Number.isInteger(id) || id <= 0) return falha(400, "demanda inválida");
    const d = await db.demanda(id);
    if (!d) return falha(404, "registro não encontrado");
    cogDest = d.joiner_cog;
    // uma joiner logada só dispara o aviso da PRÓPRIA demanda (nunca a de outra pessoa)
    if (quem === "joiner" && String(ctx.cogConta || "").trim().toLowerCase() !== String(d.joiner_cog || "").trim().toLowerCase()) return falha(403, "esta demanda não é sua");
    if (evento === "comprovante_recebido") {
      const idadeMin = (agora.getTime() - new Date(d.created_at).getTime()) / 60000;
      if (d.status !== "em_analise" || !(idadeMin >= -1 && idadeMin <= LIMITES.janelaComprovanteMin)) return falha(409, "evento fora da janela");
      assunto = "✓ Comprovante recebido — ANTICEG"; titulo = "Recebemos o seu comprovante";
      blocos = par("Seu comprovante foi recebido e está <b style=\"color:#F5F0E8\">em análise</b>. Você será avisada quando for confirmado.") + par(`Valor informado: <b style=\"color:#F5F0E8\">R$ ${brl(d.valor_total)}</b> · referência #${escapeHtml(String(d.id).slice(-6))}`) + itensLista(d.itens);
    } else {
      if (d.status !== "rejeitado") return falha(409, "evento fora do estado");
      assunto = "✕ Comprovante recusado — ANTICEG"; titulo = "Seu comprovante foi recusado";
      blocos = par("Não foi possível confirmar o seu comprovante. Envie novamente pelo portal.") + (d.motivo_rejeicao ? par(`Motivo informado: <b style=\"color:#F5F0E8\">${escapeHtml(d.motivo_rejeicao).slice(0, 400)}</b>`) : "") + itensLista(d.itens);
    }
    referencia = `${evento}:${d.id}`;
  } else if (evento === "report_resolvido") {
    const id = Number(e.report_id);
    if (!Number.isInteger(id) || id <= 0) return falha(400, "report inválido");
    const r = await db.report(id);
    if (!r) return falha(404, "registro não encontrado");
    if (r.status !== "resolvido") return falha(409, "evento fora do estado");
    cogDest = r.joiner_cog; assunto = "Seu report foi resolvido ✓"; titulo = "Seu report foi resolvido";
    blocos = par(`Seu report sobre <b style=\"color:#F5F0E8\">${escapeHtml(r.item_nome)}</b> foi atualizado. Acesse a aba Suporte e confira se está correto.`) + (r.resposta ? par(`Resposta da administração: ${escapeHtml(r.resposta).slice(0, 600)}`) : "");
    referencia = `${evento}:${r.id}`;
  } else if (evento === "novo_cadastro") {
    const cog = String(e.joiner_cog ?? "").trim();
    if (!cog || cog.length > 64) return falha(400, "joiner inválida");
    const p = await db.preCadastroRecente(cog);
    if (!p) return falha(404, "registro não encontrado");
    const idadeMin = (agora.getTime() - new Date(p.created_at).getTime()) / 60000;
    if (!(idadeMin >= -1 && idadeMin <= LIMITES.janelaComprovanteMin)) return falha(409, "evento fora da janela");
    if (!emailValido(ctx.emailAdmin)) return falha(422, "sem destinatário válido");
    destinoFixo = { para: ctx.emailAdmin!.trim().toLowerCase(), nome: "Administração" };
    assunto = "✦ Novo joiner adicionado — ANTICEG"; titulo = "Novo cadastro no site";
    blocos = par("Um novo cadastro foi criado automaticamente:") + par(`Nome: <b style="color:#F5F0E8">${escapeHtml(p.nome).slice(0, 120)}</b> · @: <b style="color:#F5F0E8">${escapeHtml(p.cog).slice(0, 64)}</b> · e-mail: <b style="color:#F5F0E8">${escapeHtml(p.email).slice(0, 160)}</b>`);
    referencia = `${evento}:${p.cog.toLowerCase()}`;
  } else {
    const cog = String(e.joiner_cog ?? "").trim();
    if (!cog || cog.length > 64) return falha(400, "joiner inválida");
    cogDest = cog;
    const pend = (await db.pendenciasDoJoiner(cog)).filter(p => (!p.pago_item && Number(p.valor_item) > 0) || (!p.pago_frete && Number(p.frete_inter) > 0) || (!p.pago_rf && Number(p.taxa_rf) > 0));
    if (!pend.length) return falha(409, "sem pendências");
    const total = pend.reduce((s, p) => s + (!p.pago_item ? Number(p.valor_item || 0) : 0) + (!p.pago_frete ? Number(p.frete_inter || 0) : 0) + (!p.pago_rf ? Number(p.taxa_rf || 0) : 0), 0);
    assunto = "Lembrete de pagamento pendente"; titulo = "Você tem pagamentos pendentes";
    blocos = par(`Você tem <b style=\"color:#F5F0E8\">${pend.length}</b> item(ns) com pagamento pendente, somando <b style=\"color:#F5F0E8\">R$ ${brl(total)}</b> (sem multas). Acesse o portal para ver os detalhes e enviar o comprovante.`) + itensLista(pend);
    referencia = `${evento}:${cog.toLowerCase()}:${agora.toISOString().slice(0, 10)}`;
  }

  // destinatário SEMPRE vem do cadastro (nunca do pedido): precisa existir exatamente uma joiner com esse COG e um e-mail válido
  let para: string; let nome: string;
  if (destinoFixo) { para = destinoFixo.para; nome = destinoFixo.nome; }
  else {
    const candidatas = await db.joinersPorCog(cogDest);
    if (candidatas.length !== 1 || !emailValido(candidatas[0].email)) return falha(422, "sem destinatário válido");
    para = candidatas[0].email!.trim().toLowerCase();
    nome = candidatas[0].nome || candidatas[0].cog;
  }

  // limites e envio único
  const umaHora = new Date(agora.getTime() - 3600_000).toISOString();
  const umDia = new Date(agora.getTime() - 86_400_000).toISOString();
  if ((await db.contarEnvios(para, umaHora)) >= LIMITES.porDestinatarioPorHora) return falha(429, "limite por destinatário");
  if ((await db.contarEnvios(null, umDia)) >= LIMITES.globalPorDia) return falha(429, "limite diário");
  if (!(await db.registrarEnvio({ evento, referencia, destinatario: para }))) return falha(409, "já enviado");

  return { ok: true, status: 200, para, nome, assunto, html: layout(titulo, blocos), evento };
}

// ── push ──────────────────────────────────────────────────────────────────────────────────────
const HOSTS_PUSH = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9.-]+\.notify\.windows\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9.-]+\.push\.apple\.com$/, /^[a-z0-9-]+\.push\.services\.mozilla\.com$/];
export function endpointPushValido(endpoint: unknown): boolean {
  try { const u = new URL(String(endpoint)); return u.protocol === "https:" && !u.username && !u.password && HOSTS_PUSH.some(r => r.test(u.hostname)); } catch { return false; }
}
export function validarPush(entrada: unknown, quem: Quem): { ok: boolean; status: number; erro?: string; dados?: { subscription: { endpoint: string; keys: { p256dh: string; auth: string } }; title: string; body: string; url: string } } {
  if (quem === "anonimo") return { ok: false, status: 401, erro: "sem permissão" };
  const e = entrada as Record<string, any> | null;
  if (!e || typeof e !== "object") return { ok: false, status: 400, erro: "pedido inválido" };
  const s = e.subscription;
  if (!s || !endpointPushValido(s.endpoint) || typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string" || s.keys.p256dh.length > 200 || s.keys.auth.length > 100) return { ok: false, status: 400, erro: "subscription inválida" };
  const title = String(e.title ?? "ANTICEG").slice(0, 80);
  const body = String(e.body ?? "").slice(0, 300);
  let url = String(e.url ?? "/");
  if (!url.startsWith("/") || url.startsWith("//") || /[\r\n\\]/.test(url) || url.length > 200) url = "/";
  return { ok: true, status: 200, dados: { subscription: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, title, body, url } };
}

// ── quem está chamando ────────────────────────────────────────────────────────────────────────
export function iguaisSeguro(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export interface Chamada { quem: Quem; cogConta: string | null }
export async function identificarChamada(cabecalhoAuth: string | null, chaveServico: string, resolver: (token: string) => Promise<{ admin: boolean; cog: string | null }>): Promise<Chamada> {
  const m = /^Bearer\s+(.+)$/i.exec(cabecalhoAuth || "");
  if (!m) return { quem: "anonimo", cogConta: null };
  const token = m[1].trim();
  if (chaveServico && iguaisSeguro(token, chaveServico)) return { quem: "servico", cogConta: null };
  try {
    const r = await resolver(token);
    if (r.admin) return { quem: "admin", cogConta: null };
    if (r.cog) return { quem: "joiner", cogConta: r.cog };
  } catch { /* token inválido ou expirado: segue como anônimo */ }
  return { quem: "anonimo", cogConta: null };
}
// compatível com o uso do push: administradora ou serviço
export async function identificarQuem(cabecalhoAuth: string | null, chaveServico: string, ehAdmin: (token: string) => Promise<boolean>): Promise<Quem> {
  const c = await identificarChamada(cabecalhoAuth, chaveServico, async t => ({ admin: await ehAdmin(t), cog: null }));
  return c.quem;
}
