// Núcleo do login de admin (sem dependência do Vite/Supabase: testável em Node). A decisão de quem é admin/staff é do BANCO.
function mensagemAmigavel(err, contexto) {
  const msg = String(err?.message || err || "");
  const code = String(err?.code || "");
  if (err?.status === 429 || /rate.?limit/i.test(code + msg)) return "Muitas tentativas. Espere um pouco e tente de novo.";
  if (contexto === "entrar") {
    if (/invalid.*(login|credentials)|invalid_credentials/i.test(code + msg)) return "E-mail ou senha incorretos.";
    if (/not.*confirmed/i.test(code + msg)) return "Esta conta ainda não foi confirmada. Fale com a administração.";
    return "Não foi possível entrar. Tente de novo.";
  }
  if (contexto === "senha") {
    if (/same_password|different from the old/i.test(code + msg)) return "A nova senha precisa ser diferente da atual.";
    if (/weak_password|weak|pwned|compromised/i.test(code + msg)) return "Senha fraca demais. Use uma senha longa e única.";
    if (/reauth/i.test(code + msg)) return "Por segurança, saia, entre de novo e tente outra vez.";
    return "Não foi possível trocar a senha. Tente de novo.";
  }
  return "Algo deu errado. Tente de novo.";
}

// Estados: sair | sem_permissao | ok | erro
export function criarAdminAuth(client) {
  async function avaliar() {
    const { data: sdata, error: serr } = await client.auth.getSession();
    if (serr) return { estado: "erro", mensagem: mensagemAmigavel(serr) };
    const session = sdata?.session;
    if (!session) return { estado: "sair" };
    const email = session.user?.email || "";
    // papel decidido pelo BANCO (meu_papel_admin): 'admin' = administradora geral | 'staff_pagamentos' = só operações de pagamento. Qualquer outro = sem permissão.
    const { data: papel, error: perr } = await client.rpc("meu_papel_admin");
    if (!perr) {
      if (papel === "admin" || papel === "staff_pagamentos") return { estado: "ok", email, papel };
      return { estado: "sem_permissao", email };
    }
    // função ainda não existe (ST1 não aplicado) ou falhou: comportamento anterior, pelo is_admin()
    const { data: eAdmin, error: rerr } = await client.rpc("is_admin");
    if (rerr) return { estado: "erro", mensagem: "Não foi possível confirmar a permissão de administrador.", email };
    return eAdmin === true ? { estado: "ok", email, papel: "admin" } : { estado: "sem_permissao", email };
  }

  async function entrar(email, senha) {
    const { error } = await client.auth.signInWithPassword({ email: String(email || "").trim(), password: String(senha || "") });
    if (error) return { estado: "sair", mensagem: mensagemAmigavel(error, "entrar") };
    return avaliar();
  }

  // Troca a senha da conta já logada. Mínimo de 12 caracteres.
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

  return { avaliar, entrar, trocarSenha, sair };
}
