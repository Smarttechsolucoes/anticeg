// Acesso das joiners com Supabase Auth: ativação da conta (e-mail confirmado + senha + vínculo seguro ao cadastro existente),
// login com @ + senha, recuperação e troca de senha.
// Usa o cliente PRINCIPAL do site: é ele que carrega a sessão da joiner para as consultas ao banco (RLS, etapa J4).
// A decisão de quem é dono de um COG NÃO é do navegador: o servidor (ativar_minha_conta) confere o e-mail confirmado com o cadastro.
import supabase from "./supabase.js";

// Desligado por padrão: com false o site se comporta exatamente como hoje (sem pop-up, sem bloqueio, sessões antigas valem).
// Para o lançamento: defina VITE_JOINERS_AUTH=true no ambiente do build (Vercel) — só depois da autorização.
export const JOINERS_AUTH_ATIVO = import.meta.env.VITE_JOINERS_AUTH === "true";

// Áreas que exigem conta ativada e senha. O resto (CEGs, calendário, regras...) continua público.
export const AREAS_PROTEGIDAS = ["masterlist", "perfil", "envio", "disponiveis", "claims", "prevenda", "wave-maker", "run-it-vol-2", "paper-tales", "odd-fresh", "promo-13"];

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
  const status = err && (err.status || err.context?.status);
  if (status === 429 || /rate.?limit|too many|after \d+ seconds/i.test(txt)) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
  if (contexto === "codigo") return "Código inválido ou expirado. Confira o e-mail e tente de novo, ou peça um código novo.";
  if (contexto === "senha") {
    if (/same_password|different from the old/i.test(txt)) return "Escolha uma senha diferente da anterior.";
    if (/weak|pwned|compromised/i.test(txt)) return "Senha fraca demais. Escolha uma senha mais longa e única.";
    if (/reauth/i.test(txt)) return "Por segurança, entre de novo e tente outra vez.";
    return "Não foi possível salvar a senha. Tente de novo.";
  }
  if (contexto === "entrar") return "@ ou senha incorretos.";
  if (contexto === "recuperar") return "Não foi possível enviar agora. Tente de novo em alguns minutos.";
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

  // 3) login com @ + senha: o servidor resolve o @ para o e-mail verificado (sem devolvê-lo) e devolve só os tokens da sessão
  async function entrar({ cog, senha }) {
    const c = normalizarCog(cog);
    if (!c || !senha) return { erro: "Informe o @ e a senha." };
    const { data, error } = await client.functions.invoke("login-joiner", { body: { cog: c, senha } });
    if (error || !data?.access_token || !data?.refresh_token) return { erro: mensagem(error, "entrar") };
    const { error: es } = await client.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (es) return { erro: mensagem(es, "entrar") };
    const e = await estado(c);
    if (e.estado !== "ativa") { await client.auth.signOut({ scope: "local" }); return { erro: "@ ou senha incorretos." }; }
    return { ok: true, cog: e.cog };
  }

  // 3b) alternativa: e-mail + senha (a conta precisa ser a do @ que está nesta tela)
  async function entrarComEmail({ cog, email, senha }) {
    const c = normalizarCog(cog), e = String(email || "").trim().toLowerCase();
    if (!emailValido(e) || !senha) return { erro: "Informe o e-mail e a senha." };
    const { error } = await client.auth.signInWithPassword({ email: e, password: senha });
    if (error) return { erro: mensagem(error, "entrar") };
    const est = await estado(c);
    if (est.estado !== "ativa") { await client.auth.signOut({ scope: "local" }); return { erro: "Esta conta não corresponde a este @." }; }
    return { ok: true, cog: est.cog };
  }

  // 4) esqueci minha senha: a resposta é sempre a mesma, com ou sem conta
  async function recuperar({ cog }) {
    const c = normalizarCog(cog);
    if (!c) return { erro: "Informe o seu @." };
    const { error } = await client.functions.invoke("recuperar-senha-joiner", { body: { cog: c } });
    if (error && (error.status === 429 || error.context?.status === 429)) return { erro: mensagem(error, "recuperar") };
    return { ok: true };
  }

  // 5) troca de senha (conta logada) e definição da senha nova depois do link de recuperação
  async function trocarSenha(nova, repetir, contexto = {}) {
    const msg = validarSenha(nova, repetir, contexto);
    if (msg) return { erro: msg };
    const { error } = await client.auth.updateUser({ password: nova });
    if (error) return { erro: mensagem(error, "senha") };
    return { ok: true };
  }

  async function sair() { await client.auth.signOut({ scope: "local" }); }

  return { estado, pedirCodigo, confirmar, entrar, entrarComEmail, recuperar, trocarSenha, sair };
}

// Acesso simples (só @): o servidor devolve apenas a identidade mínima (cog, nome do site, foto) e se a conta está ativada.
// Nunca devolve e-mail, CPF, endereço nem telefone, e não aceita e-mail. Não é autenticação: não libera nada privado.
export async function buscarAcessoSimples(identificador, client = supabase) {
  const { data, error } = await client.rpc("entrar_com_arroba", { p_identificador: String(identificador || "") });
  if (error || !data || !data.encontrado) return null;
  return { cog: data.cog, nome: data.nome_site || data.cog, nome_site: data.nome_site || data.cog, foto_perfil: data.foto_perfil || null, confirmado: true, acesso_simples: true, conta_ativa: !!data.conta_ativa };
}

// Depois do login completo: a linha da PRÓPRIA joiner e os itens dela, lidos com a conta (o banco só devolve o que é dela).
export async function carregarDadosPrivados(client = supabase) {
  const { data: meus, error } = await client.rpc("meus_dados");
  if (error || !meus) return null;
  const { data: itens } = await client.from("masterlist").select("*").eq("cog", meus.cog);
  return { joiner: meus, itens: itens || [] };
}

// ── Leituras e escritas entre joiners (J4c-1) ─────────────────────────────────────────────────────────────────────
// Com a flag desligada tudo funciona como hoje (consulta direta). Ligada, a tabela joiners deixa de ser legível por outras joiners:
// listas usam a visão pública (cog, nome do site, @, foto) e as funções seguras do servidor.
export async function listarJoinersPublicos(client = supabase) {
  if (!JOINERS_AUTH_ATIVO) { const { data } = await client.from("joiners").select("cog, nome, twitter").order("nome"); return data || []; }
  const { data } = await client.from("joiners_publico").select("cog, nome_site, twitter").order("nome_site");
  return (data || []).map(j => ({ cog: j.cog, nome: j.nome_site || j.cog, twitter: j.twitter }));
}
export async function fotosDeJoiners(cogs, client = supabase) {
  if (!cogs?.length) return [];
  const { data } = await client.from(JOINERS_AUTH_ATIVO ? "joiners_publico" : "joiners").select("cog, foto_perfil").in("cog", cogs);
  return data || [];
}
export async function meusRecrutados(cog, client = supabase) {
  if (!JOINERS_AUTH_ATIVO) { const { data } = await client.from("joiners").select("cog, nome, nome_site").eq("recrutador", cog); return data || []; }
  const { data } = await client.rpc("meus_recrutados");
  return data || [];
}
export async function joinersOnline(minutos = 10, client = supabase) {
  if (!JOINERS_AUTH_ATIVO) {
    const { data } = await client.from("joiners").select("cog, nome, foto_perfil").gte("last_seen", new Date(Date.now() - minutos * 60 * 1000).toISOString());
    return data || [];
  }
  const { data } = await client.rpc("joiners_online", { p_minutos: minutos });
  return data || [];
}
// Gasta cashback. Ligada a flag, o servidor debita só do saldo da própria conta; desligada, o comportamento antigo (grava o novo saldo).
export async function debitarCashback(cog, valor, novoSaldo, client = supabase) {
  if (!JOINERS_AUTH_ATIVO) { await client.from("joiners").update({ saldo_cashback: novoSaldo }).eq("cog", cog); return novoSaldo; }
  const { data } = await client.rpc("debitar_cashback", { p_valor: valor });
  return typeof data === "number" || typeof data === "string" ? Number(data) : novoSaldo;
}
// Aparelho de push: ligada a flag, o servidor associa o aparelho à conta que está logada.
export async function gravarAssinaturaPush(cog, sub, client = supabase) {
  if (!JOINERS_AUTH_ATIVO) {
    await client.from("push_subscriptions").upsert({ joiner_cog: cog, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
    return;
  }
  await client.rpc("registrar_push", { p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth });
}
// Grupo de envio por código (quem não é a host só enxerga o grupo sabendo o código).
export async function consultarGrupoEnvio(codigo, client = supabase) {
  if (!JOINERS_AUTH_ATIVO) { const { data } = await client.from("grupos_envio").select("*").eq("codigo", codigo).single(); return data || null; }
  const { data } = await client.rpc("grupo_por_codigo", { p_codigo: codigo });
  return data || null;
}
// Recrutador pelo @ (devolve { cog, nome } ou null). Cadastro novo: função segura com resposta neutra.
export async function buscarRecrutadorSeguro(texto, client = supabase) {
  const { data } = await client.rpc("resolver_recrutador", { p_texto: String(texto || "") });
  return data && data.cog ? { cog: data.cog, nome: data.nome || data.cog } : null;
}
export async function solicitarCadastro({ nome, cog, email, whatsapp, recrutador }, client = supabase) {
  const { data, error } = await client.rpc("solicitar_cadastro", { p_nome: nome, p_cog: cog, p_email: email, p_whatsapp: whatsapp || null, p_recrutador: recrutador || null });
  if (error || !data) return { ok: false, motivo: "erro" };
  return data;
}
