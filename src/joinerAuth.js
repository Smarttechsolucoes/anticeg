// Acesso das joiners com Supabase Auth: ativação da conta (e-mail confirmado + senha + vínculo seguro ao cadastro existente),
// login com @ + senha, recuperação e troca de senha.
// Usa o cliente PRINCIPAL do site: é ele que carrega a sessão da joiner para as consultas ao banco (RLS, etapa J4).
// A decisão de quem é dono de um COG NÃO é do navegador: o servidor (ativar_minha_conta) confere o e-mail confirmado com o cadastro.
import supabase from "./supabase.js";
import { criaPorFuncao, criarPedidoComoInsert } from "./pedidosFechados.js";

// Desligado por padrão: com false o site se comporta exatamente como hoje (sem pop-up, sem bloqueio, sessões antigas valem).
// Para o lançamento: defina VITE_JOINERS_AUTH=true no ambiente do build (Vercel) — só depois da autorização.
export const JOINERS_AUTH_ATIVO = import.meta.env.VITE_JOINERS_AUTH === "true";

// Áreas que exigem conta ativada e senha. O resto (CEGs, calendário, regras...) continua público.
export const AREAS_PROTEGIDAS = ["masterlist", "perfil", "envio", "disponiveis", "claims", "prevenda", "wave-maker", "run-it-vol-2", "paper-tales", "odd-fresh", "odd-fresh-popup", "suiatsu", "promo-13", "mercari"];

export const SENHA_MIN = 8;

export function normalizarCog(valor) {
  return String(valor || "").trim().replace(/^@+/, "").toLowerCase();
}
export function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(valor || "").trim());
}
// formato ÚNICO aceito para a dica do servidor: 1ª letra do usuário + ••• + @ + 1ª letra do provedor + ••• + final (.com, .com.br). Nada além disso é exibido.
// próximos passos que o servidor pode informar a quem acertou o par (@ + e-mail) e não vai receber código
export const PROXIMOS = ["ajuda", "entrar", "aguardando", "comprovar"];
export const DICA_VALIDA =/^[^\s@•<>"'&]•••@[^\s@•<>"'&]•••\.[a-z]+(\.[a-z]+)?$/u;   // a 1ª letra do usuário pode ser número, "_", "." etc.
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

// Falha de rede/serviço (sem resposta do servidor, relay fora do ar, erro 5xx): não é senha errada.
function falhaDeConexao(err, status, txt) {
  const nome = String((err && err.name) || "");
  if (/FunctionsFetchError|FunctionsRelayError|AuthRetryableFetchError|AuthUnknownError/.test(nome)) return true;
  if (typeof status === "number" && (status === 0 || status >= 500)) return true;
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(txt);
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
  if (contexto === "entrar") return falhaDeConexao(err, status, txt) ? "Não foi possível conectar agora. Verifique a internet e tente de novo em alguns minutos." : "@ ou senha incorretos.";   // credencial inválida e falha de conexão têm mensagens diferentes (nenhuma revela se a conta existe)
  if (contexto === "recuperar") return "Não foi possível enviar agora. Tente de novo em alguns minutos.";
  if (contexto === "dica") return "Não foi possível mostrar a dica agora. Tente de novo em alguns minutos.";
  return "Não foi possível enviar o código agora. Tente de novo em alguns minutos.";
}

// Estados da conta no navegador: simples (só @) | ativa (sessão + vínculo ao COG) | sem_vinculo (sessão sem vínculo ainda)
export function criarJoinerAuth(client = supabase) {
  async function estado(cogAtual) {
    const { data: s } = await client.auth.getSession();
    if (!s?.session) return { estado: "simples" };
    // J6: o estado da conta diz se o perfil já foi concluído (sem isso o servidor não libera dado nenhum). Antes do J6 a função não existe: segue o caminho anterior.
    const { data: ec, error: ee } = await client.rpc("meu_estado_conta");
    if (!ee && ec && typeof ec === "object" && typeof ec.vinculada === "boolean") {
      if (!ec.vinculada) return { estado: "sem_vinculo" };
      if (cogAtual && normalizarCog(ec.cog) !== normalizarCog(cogAtual)) return { estado: "sem_vinculo" };
      return ec.concluido ? { estado: "ativa", cog: ec.cog } : { estado: "perfil_pendente", cog: ec.cog, perfil: ec };
    }
    if (ee && !/PGRST202|42883|could not find|does not exist/i.test(String(ee.code || "") + " " + String(ee.message || ""))) return { estado: "erro" };
    const { data: cog, error } = await client.rpc("meu_cog");
    if (error) return { estado: "erro" };
    if (cog && (!cogAtual || normalizarCog(cog) === normalizarCog(cogAtual))) return { estado: "ativa", cog };
    return { estado: "sem_vinculo" };
  }

  // 1) envia o código para o e-mail digitado. A resposta é sempre a mesma: não revela se o @ ou o e-mail existem.
  async function pedirCodigo({ cog, email }) {
    const c = normalizarCog(cog), e = String(email || "").trim().toLowerCase();
    if (!emailValido(e)) return { erro: "Digite um e-mail válido." };      // o @ é opcional: quem não lembra começa pelo e-mail cadastrado
    // se houver sessão de outra pessoa neste aparelho, encerra antes (só local)
    const { data: s } = await client.auth.getSession();
    if (s?.session) await client.auth.signOut({ scope: "local" });
    // o SERVIDOR decide se envia (só para o e-mail do cadastro, só para quem já foi liberada, com limites) e a resposta é sempre a mesma
    const { data, error } = await client.functions.invoke("pedir-codigo-joiner", { body: c ? { cog: c, email: e } : { email: e } });
    if (error) return { erro: mensagem(error, "envio") };
    // SÓ quem acertou o @ + e-mail do cadastro e NÃO vai receber código ouve o próximo passo (proximo); para os demais a resposta é a neutra de sempre.
    const proximo = data && typeof data.proximo === "string" && PROXIMOS.includes(data.proximo) ? data.proximo : null;
    return proximo ? { ok: true, proximo } : { ok: true };
  }

  // Dica MASCARADA do e-mail cadastrado para um @ (ex.: "m•••@g•••.com"). Só ajuda a lembrar qual e-mail digitar: não envia nada, não confirma que o @ existe
  // (um @ sem dica real recebe uma dica falsa do servidor) e não altera cadastro. O formato é conferido aqui: qualquer outra coisa que chegue NÃO é exibida.
  async function dicaEmail({ cog }) {
    const c = normalizarCog(cog);
    if (!c || c.length > 64 || /[\s@]/.test(c)) return { erro: "Informe o seu @ para ver a dica." };
    const { data, error } = await client.functions.invoke("ativacao-dica", { body: { cog: c } });
    if (error) return { erro: mensagem(error, "dica") };
    const dica = data && typeof data.dica === "string" ? data.dica : "";
    if (!DICA_VALIDA.test(dica)) return { erro: "Não foi possível mostrar a dica agora. Tente de novo em alguns minutos." };
    return { dica };
  }

  // Pedido de ajuda de quem não consegue ativar (não recebeu o código, e-mail errado, vínculo ainda não confirmado). A resposta é sempre a mesma; a administração atende pelo painel.
  async function pedirAjuda({ cog, contato, texto }) {
    const c = normalizarCog(cog), ct = String(contato || "").trim();
    if (!c) return { erro: "Informe o seu @." };
    if (ct.length < 5) return { erro: "Informe um contato para a gente te responder (WhatsApp, e-mail ou outro @)." };
    const { error } = await client.functions.invoke("pedir-ajuda-ativacao", { body: { cog: c, contato: ct.slice(0, 120), mensagem: String(texto || "").trim().slice(0, 500) } });
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
    // sem @ digitado (começou pelo e-mail): o servidor diz qual é o @ DESTA conta, só porque o e-mail acabou de ser provado pelo código; quem decide o vínculo continua sendo ativar_minha_conta
    let cogDaConta = c;
    if (!cogDaConta) {
      const { data: d0, error: e0 } = await client.rpc("cog_para_ativar");
      if (e0) return { erro: "Seu e-mail foi confirmado, mas não conseguimos concluir agora. Tente de novo em instantes." };
      cogDaConta = normalizarCog(d0);
      if (!cogDaConta) return { resultado: "pendente" };      // e-mail dividido entre cadastros ou sem cadastro único: a administração confere
    }
    const { data, error: er } = await client.rpc("ativar_minha_conta", { p_cog: cogDaConta });
    if (er) return { erro: "Seu e-mail foi confirmado, mas não conseguimos concluir agora. Tente de novo em instantes." };
    return { resultado: data && data.status === "ok" ? "ok" : data && data.status === "aguardando_liberacao" ? "aguardando" : "pendente", cog: cogDaConta };
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
    if (e.estado !== "ativa" && e.estado !== "perfil_pendente") { await client.auth.signOut({ scope: "local" }); return { erro: "@ ou senha incorretos." }; }
    return { ok: true, cog: e.cog, perfilPendente: e.estado === "perfil_pendente" };
  }

  // 3b) alternativa: e-mail + senha (a conta precisa ser a do @ que está nesta tela)
  async function entrarComEmail({ cog, email, senha }) {
    const c = normalizarCog(cog), e = String(email || "").trim().toLowerCase();
    if (!emailValido(e) || !senha) return { erro: "Informe o e-mail e a senha." };
    const { data, error } = await client.functions.invoke("login-joiner", { body: { email: e, senha } });   // o servidor limita as tentativas por e-mail e só aceita conta ativada
    if (error || !data?.access_token || !data?.refresh_token) return { erro: mensagem(error, "entrar") };
    const { error: es } = await client.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (es) return { erro: mensagem(es, "entrar") };
    const est = await estado(c);
    if (est.estado !== "ativa" && est.estado !== "perfil_pendente") { await client.auth.signOut({ scope: "local" }); return { erro: "Esta conta não corresponde a este @." }; }
    return { ok: true, cog: est.cog, perfilPendente: est.estado === "perfil_pendente" };
  }

  // 4) esqueci minha senha: a resposta é sempre a mesma, com ou sem conta
  async function recuperar({ cog, email }) {
    const c = normalizarCog(cog), e = String(email || "").trim().toLowerCase();
    if (e && !emailValido(e)) return { erro: "Confira o e-mail digitado." };
    if (!e && !c) return { erro: "Informe o e-mail ou o @." };
    const { error } = await client.functions.invoke("recuperar-senha-joiner", { body: e ? { email: e } : { cog: c } });
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

  // 6) conclusão obrigatória do perfil (J6): nome para claim; o @ não é aceito aqui
  async function concluirPerfil(nomeSite) {
    const nome = String(nomeSite || "").trim();
    if (nome.length < 2 || nome.length > 60 || /[<>]/.test(nome) || [...nome].some(ch => ch.charCodeAt(0) < 32)) return { erro: "Use de 2 a 60 caracteres, sem < > nem caracteres de controle." };
    const { data, error } = await client.rpc("completar_meu_perfil", { p_nome_site: nome });
    if (error) return { erro: /nome inv/i.test(String(error.message)) ? "Nome inválido. Use de 2 a 60 caracteres, sem < >." : "Não foi possível salvar agora. Tente de novo em instantes." };
    return { ok: true, perfil: data };
  }
  // 7) pedido à administração (correção de @ ou de e-mail que não dá para fazer sozinha)
  async function solicitarCorrecao({ tipo, valor, mensagem }) {
    const t = ["arroba", "email", "outro"].includes(tipo) ? tipo : "outro";
    const { error } = await client.rpc("solicitar_correcao_perfil", { p_tipo: t, p_valor: String(valor || "").trim(), p_mensagem: String(mensagem || "").trim() });
    if (error) return { erro: /abertos/i.test(String(error.message)) ? "Você já tem pedidos abertos. Aguarde a administração." : "Não foi possível enviar o pedido agora. Tente de novo em instantes." };
    return { ok: true };
  }
  // 8) troca de e-mail VERIFICADA: o Auth envia o link ao endereço NOVO; o cadastro só muda quando ele for confirmado (e se não for de outro cadastro)
  async function trocarEmail(novo) {
    const e = String(novo || "").trim().toLowerCase();
    if (!emailValido(e)) return { erro: "Digite um e-mail válido." };
    const { error } = await client.auth.updateUser({ email: e }, { emailRedirectTo: (typeof window !== "undefined" ? window.location.origin : "") + "/" });
    if (error) return { erro: /already|registered|exists|outro cadastro/i.test(String(error.message)) ? "Este e-mail não pode ser usado aqui. Peça a troca à administração." : mensagem(error, "enviar") };
    return { ok: true };
  }

  return { estado, pedirCodigo, dicaEmail, pedirAjuda, confirmar, entrar, entrarComEmail, recuperar, trocarSenha, sair, concluirPerfil, solicitarCorrecao, trocarEmail };
}

// Acesso simples (só @): o servidor devolve apenas a identidade mínima (cog, nome do site, foto) e se a conta está ativada.
// Nunca devolve e-mail, CPF, endereço nem telefone, e não aceita e-mail. Não é autenticação: não libera nada privado.
export async function buscarAcessoSimples(identificador, client = supabase) {
  const { data, error } = await client.rpc("entrar_com_arroba", { p_identificador: String(identificador || "") });
  if (error || !data || !data.encontrado) return null;
  return { cog: data.cog, nome: data.nome_site || data.cog, nome_site: data.nome_site || data.cog, foto_perfil: data.foto_perfil || null, confirmado: true, acesso_simples: true, conta_ativa: !!data.conta_ativa, ativacao_liberada: data.ativacao_liberada !== false };
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
// Cashback: NÃO existe mais chamada de débito no navegador. O desconto é feito pelo banco no mesmo ato que registra o pagamento (gatilho q6_debito_cashback, supabase/seguranca/Q6a):
// atômico, uma vez por pagamento, recusa saldo insuficiente. Com o login, só a dona da conta registra pagamento em nome dela (RLS).
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

// ── Quadros públicos de claims (J4c-2) ────────────────────────────────────────────────────────────────────────────
// Ligada a flag, a tabela claims só mostra à joiner os claims dela; os quadros abertos vêm de visões sem e-mail, COG nem nome real.
export async function quadroDeClaims(client = supabase) {
  if (!JOINERS_AUTH_ATIVO) {
    const { data } = await client.from("claims").select("masterlist_id, joiner_nome, status, created_at").eq("ceg", "CLAIM").neq("status", "rejeitado");
    return data || [];
  }
  const { data } = await client.from("claims_quadro").select("masterlist_id, joiner_nome, status, created_at");
  return data || [];
}
export async function claimsVendidos(client = supabase) {
  if (!JOINERS_AUTH_ATIVO) {
    const { data } = await client.from("claims").select("id, ceg, nome_do_item, valor, created_at").eq("status", "aprovado").order("created_at", { ascending: false });
    return data || [];
  }
  const { data } = await client.from("claims_vendidos").select("id, ceg, nome_do_item, valor, created_at").order("created_at", { ascending: false });
  return data || [];
}

// ── Lojas públicas e formulários (J4c-3) ──────────────────────────────────────────────────────────────────────────
// Com a flag desligada tudo funciona como hoje (insert direto). Ligada, o visitante deixa de poder ler/gravar as tabelas de pedidos: a compra passa por
// pedido_loja_criar() (o servidor valida a loja, descarta campos que o cliente não escolhe e recusa pedido já 'confirmado'), que devolve só o número do pedido.
export async function criarPedidoLoja(tabela, dados, { retornar = false } = {}, client = supabase) {
  if (!JOINERS_AUTH_ATIVO) {
    if (criaPorFuncao(tabela)) return criarPedidoComoInsert(tabela, dados, client);   // Q4/Q5: tabela fechada ao visitante; o servidor valida e devolve só o número
    const q = client.from(tabela).insert([dados]);
    return retornar ? q.select().single() : q;
  }
  const { data, error } = await client.rpc("pedido_loja_criar", { p_tabela: tabela, p_dados: dados });
  if (error) return { data: null, error };
  if (!data || data.ok !== true) return { data: null, error: { message: data?.motivo === "tente_mais_tarde" ? "Muitos pedidos agora. Tente de novo em alguns minutos." : data?.motivo === "login_necessario" ? "Entre na sua conta (com a senha ativada) para fazer o pedido." : "Não foi possível registrar o pedido. Confira os dados e tente de novo." } };
  return { data: { id: data.id }, error: null };
}
// Estoque e fila dos formulários: a visão pública traz só evento, modalidade, status, data e "Qtd: N" (nunca nome, e-mail ou texto livre).
export const TABELA_FORMULARIO_PUBLICA = JOINERS_AUTH_ATIVO ? "formulario_pedidos_publico" : "formulario_pedidos";

// Itens de um CEG (página do CEG). Hoje: a masterlist inteira. Com o novo login a MASTERLIST só mostra a cada joiner as linhas dela;
// a comunidade continua vendo a lista do CEG (@, nome, item, situação) por ceg_itens(), SEM valor/frete/taxa/pagamento de terceiros,
// e os valores aparecem só nas linhas da própria joiner (que vêm da masterlist, protegida por linha).
export async function itensDoCeg(ceg, { semDisponivel = true } = {}, client = supabase) {
  if (!JOINERS_AUTH_ATIVO) {
    let q = client.from("masterlist").select("*").eq("ceg", ceg);
    if (semDisponivel) q = q.not("nome", "ilike", "disponivel");
    const { data } = await q;
    return data || [];
  }
  const [{ data: lista }, { data: proprios }] = await Promise.all([
    client.rpc("ceg_itens", { p_ceg: ceg }),
    client.from("masterlist").select("*").eq("ceg", ceg),
  ]);
  const porId = new Map();
  (Array.isArray(lista) ? lista : []).forEach(i => porId.set(i.id, i));
  (proprios || []).filter(i => !semDisponivel || !/^disponivel$/i.test(String(i.nome || ""))).forEach(i => porId.set(i.id, i));   // a linha completa da joiner prevalece
  return [...porId.values()];
}
// Resumo dos CEGs (lista de CEGs) e vencimentos (calendário geral): números e datas da comunidade, sem dono nem valor.
export async function resumoDosCegs(client = supabase) {
  const { data } = await client.rpc("ceg_resumo");
  return Array.isArray(data) ? data : [];
}
export async function vencimentosDosCegs(client = supabase) {
  const { data } = await client.rpc("ceg_vencimentos");
  return Array.isArray(data) ? data : [];
}

