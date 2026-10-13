// Lógica do login das joiners por @ + senha e da recuperação de senha, SEM rede nem variáveis de ambiente (testável).
// Regras: o @ vira e-mail só NO SERVIDOR, e o e-mail nunca volta para o navegador. Falha de @ inexistente, conta não ativada e senha errada
// têm a MESMA resposta. Há limite de tentativas por @ e por endereço de rede.

export const LIMITES_ACESSO = {
  loginPorCogEm15min: 5,
  loginPorIpEm15min: 25,
  recuperarPorCogPorHora: 3,
  recuperarPorIpPorHora: 10,
  janelaLoginMin: 15,
  janelaRecuperarMin: 60,
};

export function normalizarCog(v: unknown): string {
  return String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
}
export function cogValido(c: string): boolean { return c.length > 0 && c.length <= 64 && !/[\s\u0000-\u001f]/.test(c); }

export interface Registro { quem: "cog" | "ip"; chave: string }
export interface DbAcesso {
  contarTentativas(tipo: "login" | "recuperar", chave: string, desdeIso: string): Promise<number>;
  registrarTentativa(tipo: "login" | "recuperar", chave: string): Promise<void>;
  limparTentativas(tipo: "login" | "recuperar", chave: string): Promise<void>;
  emailDaConta(cog: string): Promise<string | null>;       // via contas_joiner + auth.users, SOMENTE no servidor
}
export interface Rede {
  entrarComSenha(email: string, senha: string): Promise<{ ok: boolean; sessao?: Record<string, unknown> }>;
  pedirRecuperacao(email: string): Promise<void>;
}

const msgLogin = "@ ou senha incorretos.";
const NEUTRO = { ok: false as const };

export interface ResultadoLogin { status: number; corpo: Record<string, unknown> }

// Tokens da sessão: devolve só o necessário (NUNCA o objeto "user", que contém o e-mail)
export function sessaoSemUsuario(sessao: Record<string, unknown>): Record<string, unknown> {
  const { access_token, refresh_token, expires_in, expires_at, token_type } = sessao as Record<string, unknown>;
  return { access_token, refresh_token, expires_in, expires_at, token_type };
}

export async function processarLogin(entrada: unknown, ip: string, db: DbAcesso, rede: Rede, agora: Date = new Date()): Promise<ResultadoLogin> {
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || Array.isArray(e) || Object.keys(e).some(k => k !== "cog" && k !== "senha")) return { status: 400, corpo: { error: "pedido inválido" } };
  const cog = normalizarCog(e.cog);
  const senha = typeof e.senha === "string" ? e.senha : "";
  if (!cogValido(cog) || senha.length < 1 || senha.length > 200) return { status: 401, corpo: { error: msgLogin } };

  const desde = new Date(agora.getTime() - LIMITES_ACESSO.janelaLoginMin * 60000).toISOString();
  const chaveCog = `cog:${cog}`, chaveIp = `ip:${ip || "desconhecido"}`;
  if ((await db.contarTentativas("login", chaveCog, desde)) >= LIMITES_ACESSO.loginPorCogEm15min
   || (await db.contarTentativas("login", chaveIp, desde)) >= LIMITES_ACESSO.loginPorIpEm15min) {
    return { status: 429, corpo: { error: "Muitas tentativas. Espere alguns minutos e tente de novo." } };
  }

  const email = await db.emailDaConta(cog);
  // Sem conta ativada: faz uma tentativa com um e-mail inexistente, para o tempo de resposta não revelar se o @ tem conta
  const r = await rede.entrarComSenha(email ?? "sem-conta@invalido.anticeg.test", senha);
  if (email && r.ok && r.sessao) {
    await db.limparTentativas("login", chaveCog);
    return { status: 200, corpo: sessaoSemUsuario(r.sessao) };
  }
  await db.registrarTentativa("login", chaveCog);
  await db.registrarTentativa("login", chaveIp);
  return { status: 401, corpo: { error: msgLogin } };
}

export async function processarRecuperacao(entrada: unknown, ip: string, db: DbAcesso, rede: Rede, agora: Date = new Date()): Promise<ResultadoLogin> {
  const resposta = { status: 200, corpo: { ok: true, mensagem: "Se existir uma conta ativada para esse @, enviamos um link para o e-mail verificado." } };
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || Array.isArray(e) || Object.keys(e).some(k => k !== "cog")) return { status: 400, corpo: { error: "pedido inválido" } };
  const cog = normalizarCog(e.cog);
  if (!cogValido(cog)) return resposta;

  const desde = new Date(agora.getTime() - LIMITES_ACESSO.janelaRecuperarMin * 60000).toISOString();
  const chaveCog = `cog:${cog}`, chaveIp = `ip:${ip || "desconhecido"}`;
  if ((await db.contarTentativas("recuperar", chaveCog, desde)) >= LIMITES_ACESSO.recuperarPorCogPorHora
   || (await db.contarTentativas("recuperar", chaveIp, desde)) >= LIMITES_ACESSO.recuperarPorIpPorHora) {
    return resposta;        // mesma resposta: o limite não revela nada nem vira alvo de enumeração
  }
  await db.registrarTentativa("recuperar", chaveCog);
  await db.registrarTentativa("recuperar", chaveIp);
  const email = await db.emailDaConta(cog);
  if (email) { try { await rede.pedirRecuperacao(email); } catch { /* resposta neutra mesmo se o provedor falhar */ } }
  return resposta;
}
void NEUTRO;
