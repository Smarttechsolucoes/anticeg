// Login de administrador com Supabase Auth + MFA (TOTP).
// Usa um cliente SEPARADO (storageKey próprio): o site das joiners continua com o cliente anônimo de sempre, sem nenhuma mudança.
// A decisão de quem é admin NÃO é do navegador: o banco responde por public.is_admin() (admin cadastrado + sessão aal2).
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase.js";

// Desligado por padrão: o login aparece como aviso e o painel segue como hoje (fase de teste).
// Para ligar, defina VITE_ADMIN_AUTH_OBRIGATORIA=true no ambiente do build (Vercel).
// true  = o painel de admin só abre depois de login + código MFA + is_admin() verdadeiro.
export const ADMIN_AUTH_OBRIGATORIA = import.meta.env.VITE_ADMIN_AUTH_OBRIGATORIA === "true";

let _cliente = null;
export function clienteAdmin() {
  if (!_cliente) {
    _cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storageKey: "anticeg-admin-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return _cliente;
}

function mensagemAmigavel(err, contexto) {
  const msg = String(err?.message || err || "");
  const code = String(err?.code || "");
  if (err?.status === 429 || /rate.?limit/i.test(code + msg)) return "Muitas tentativas. Espere um pouco e tente de novo.";
  if (contexto === "entrar") {
    if (/invalid.*(login|credentials)|invalid_credentials/i.test(code + msg)) return "E-mail ou senha incorretos.";
    if (/not.*confirmed/i.test(code + msg)) return "Esta conta ainda não foi confirmada. Fale com a administração.";
    return "Não foi possível entrar. Tente de novo.";
  }
  if (contexto === "codigo") return "Código inválido ou expirado. Confira o app autenticador e tente de novo.";
  if (contexto === "senha") {
    if (/same_password|different from the old/i.test(code + msg)) return "A nova senha precisa ser diferente da atual.";
    if (/weak_password|weak|pwned|compromised/i.test(code + msg)) return "Senha fraca demais. Use uma senha longa e única.";
    if (/reauth/i.test(code + msg)) return "Por segurança, saia, entre de novo e tente outra vez.";
    return "Não foi possível trocar a senha. Tente de novo.";
  }
  if (contexto === "cadastro") return "Não foi possível preparar o app autenticador. Tente de novo.";
  return "Algo deu errado. Tente de novo.";
}

// Estados: sair | cadastrar_mfa | verificar_mfa | sem_permissao | ok | erro
export function criarAdminAuth(client) {
  async function avaliar() {
    const { data: sdata, error: serr } = await client.auth.getSession();
    if (serr) return { estado: "erro", mensagem: mensagemAmigavel(serr) };
    const session = sdata?.session;
    if (!session) return { estado: "sair" };
    const email = session.user?.email || "";
    const { data: aal, error: aerr } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aerr) return { estado: "erro", mensagem: mensagemAmigavel(aerr), email };
    if (aal?.currentLevel === "aal2") {
      const { data: eAdmin, error: rerr } = await client.rpc("is_admin");
      if (rerr) return { estado: "erro", mensagem: "Não foi possível confirmar a permissão de administrador.", email };
      return eAdmin === true ? { estado: "ok", email } : { estado: "sem_permissao", email };
    }
    const { data: fatores, error: ferr } = await client.auth.mfa.listFactors();
    if (ferr) return { estado: "erro", mensagem: mensagemAmigavel(ferr), email };
    const totp = (fatores?.totp || []).filter(f => f.status === "verified");
    if (totp.length) return { estado: "verificar_mfa", fatorId: totp[0].id, email };
    return { estado: "cadastrar_mfa", email };
  }

  async function entrar(email, senha) {
    const { error } = await client.auth.signInWithPassword({ email: String(email || "").trim(), password: String(senha || "") });
    if (error) return { estado: "sair", mensagem: mensagemAmigavel(error, "entrar") };
    return avaliar();
  }

  // Prepara um fator novo; fatores antigos nunca confirmados são removidos para não acumular.
  async function iniciarCadastro() {
    const { data: lista } = await client.auth.mfa.listFactors();
    for (const f of lista?.all || []) {
      if (f.factor_type === "totp" && f.status === "unverified") await client.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Anti CEG admin " + Date.now().toString(36) });
    if (error || !data?.totp) return { erro: mensagemAmigavel(error, "cadastro") };
    return { fatorId: data.id, qrCode: data.totp.qr_code, segredo: data.totp.secret };
  }

  async function confirmar(fatorId, codigo) {
    const limpo = String(codigo || "").replace(/\s+/g, "");
    if (!/^\d{6}$/.test(limpo)) return { erro: "Digite os 6 números do app autenticador." };
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: fatorId, code: limpo });
    if (error) return { erro: mensagemAmigavel(error, "codigo") };
    return avaliar();
  }

  // Troca a senha da conta já logada (sessão MFA). Mínimo de 12 caracteres.
  async function trocarSenha(nova, repetir) {
    if (String(nova || "").length < 12) return { erro: "A nova senha precisa ter pelo menos 12 caracteres." };
    if (nova !== repetir) return { erro: "As duas senhas digitadas são diferentes." };
    const { error } = await client.auth.updateUser({ password: nova });
    if (error) return { erro: mensagemAmigavel(error, "senha") };
    return { ok: true };
  }

  async function sair() {
    await client.auth.signOut({ scope: "local" });
    return { estado: "sair" };
  }

  return { avaliar, entrar, iniciarCadastro, confirmar, trocarSenha, sair };
}
