// Acesso das joiners com Supabase Auth: ativação da conta (e-mail confirmado + senha + vínculo seguro ao cadastro existente).
// Usa o cliente PRINCIPAL do site: é ele que carrega a sessão da joiner para as consultas ao banco (RLS, etapa J4).
// A decisão de quem é dono de um COG NÃO é do navegador: o servidor (ativar_minha_conta) confere o e-mail confirmado com o cadastro.
import supabase from "./supabase.js";

// Desligado por padrão: com false o site se comporta exatamente como hoje (sem pop-up, sessões antigas valem).
// Para o lançamento: defina VITE_JOINERS_AUTH=true no ambiente do build (Vercel) — só depois da autorização.
export const JOINERS_AUTH_ATIVO = import.meta.env.VITE_JOINERS_AUTH === "true";

export const SENHA_MIN = 8;

export function normalizarCog(valor) {
  return String(valor || "").trim().replace(/^@+/, "").toLowerCase();
}
export function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(valor || "").trim());
}
export function mascararEmail(valor) {
  const [u = "", d = ""] = String(valor || "").trim().toLowerCase().split("@");
  return u ? `${u[0]}${"•".repeat(Math.max(2, Math.min(6, u.length - 1)))}@${d}` : "";
}
// regras de senha: simples e claras; a política final (tamanho mínimo, senhas vazadas) também vale no painel do Supabase
export function validarSenha(senha, repetir, { cog = "", email = "" } = {}) {
  if (String(senha || "").length < SENHA_MIN) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  if (senha !== repetir) return "As duas senhas digitadas são diferentes.";
  const baixa = senha.toLowerCase();
  if (cog && baixa === normalizarCog(cog)) return "A senha não pode ser igual ao seu @.";
  if (email && baixa === String(email).trim().toLowerCase()) return "A senha não pode ser igual ao seu e-mail.";
  if (/^(.)\1+$/.test(senha) || /^(0123456789|123456789|12345678|password|senha123|qwertyui)/i.test(senha)) return "Escolha uma senha menos óbvia.";
  return "";
}

function mensagem(err, contexto) {
  const txt = String((err && (err.message || err.code)) || "");
  const status = err && err.status;
  if (status === 429 || /rate.?limit|too many|after \d+ seconds/i.test(txt)) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (contexto === "codigo") return "Código inválido ou expirado. Confira o e-mail e tente de novo, ou peça um código novo.";
  if (contexto === "senha") {
    if (/same_password|different from the old/i.test(txt)) return "Escolha uma senha diferente da anterior.";
    if (/weak|pwned|compromised/i.test(txt)) return "Senha fraca demais. Escolha uma senha mais longa e única.";
    return "Não foi possível salvar a senha. Tente de novo.";
  }
  return "Não foi possível enviar o código agora. Tente de novo em alguns minutos.";
}

// Estados da conta no navegador: simples (só @) | ativa (sessão + vínculo ao COG) | sem_vinculo (sessão sem vínculo ainda)
export function criarJoinerAuth(client = supabase) {
  async function estado(cogAtual) {
    const { data: s } = await client.auth.getSession();
    if (!s?.session) return { estado: "simples" };
    const { data: cog, error } = await client.rpc("meu_cog");
    if (error) return { estado: "erro" };
    if (cog && (!cogAtual || normalizarCog(cog) === normalizarCog(cogAtual))) return { estado: "ativa", cog };
    return { estado: "sem_vinculo" };
  }

  // 1) envia o código para o e-mail digitado. A resposta é sempre a mesma: não revela se o @ ou o e-mail existem.
  async function pedirCodigo({ cog, email }) {
    const c = normalizarCog(cog), e = String(email || "").trim().toLowerCase();
    if (!c) return { erro: "Informe o seu @." };
    if (!emailValido(e)) return { erro: "Digite um e-mail válido." };
    // se houver sessão de outra pessoa neste aparelho, encerra antes (só local)
    const { data: s } = await client.auth.getSession();
    if (s?.session) await client.auth.signOut({ scope: "local" });
    const { error } = await client.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true, data: { cog_pedido: c } } });
    if (error) return { erro: mensagem(error, "envio") };
    return { ok: true };
  }

  // 2) confere o código, grava a senha (só depois de provar que controla o e-mail) e pede ao servidor o vínculo ao cadastro
  async function confirmar({ cog, email, codigo, senha }) {
    const c = normalizarCog(cog), e = String(email || "").trim().toLowerCase();
    const limpo = String(codigo || "").replace(/\s+/g, "");
    if (!/^\d{6,10}$/.test(limpo)) return { erro: "Digite o código numérico que chegou no e-mail." };
    const { error: ev } = await client.auth.verifyOtp({ email: e, token: limpo, type: "email" });
    if (ev) return { erro: mensagem(ev, "codigo") };
    const { error: es } = await client.auth.updateUser({ password: senha });
    if (es) return { erro: mensagem(es, "senha"), senhaPendente: true };
    const { data, error: er } = await client.rpc("ativar_minha_conta", { p_cog: c });
    if (er) return { erro: "Seu e-mail foi confirmado, mas não conseguimos concluir agora. Tente de novo em instantes." };
    return { resultado: data && data.status === "ok" ? "ok" : "pendente" };
  }

  async function sair() { await client.auth.signOut({ scope: "local" }); }

  return { estado, pedirCodigo, confirmar, sair };
}
