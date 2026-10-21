// Entrada pelo @ ou e-mail (acesso atual): o mesmo @ pode ter mais de um cadastro só com maiúsculas diferentes ("Seopookie" e "seopookie")
// e o mesmo e-mail pode estar em mais de um cadastro. Com .maybeSingle() a consulta dava erro (mais de uma linha) e a joiner via "Acesso não encontrado";
// com .eq("cog", ...) ela caía no cadastro vazio. Aqui a busca ignora maiúsculas e a escolha é sempre a mesma:
//   1) cadastro confirmado (aquele em que a joiner realmente entra); 2) cog escrito exatamente como digitado; 3) o mais antigo (menor id).

/** Escapa os curingas do LIKE (% _ e a própria barra) para o ilike casar o texto literalmente ("Hellouisa__" não pode casar "HellouisaXY"). */
export function escaparLike(texto) {
  return String(texto ?? "").replace(/[\\%_]/g, c => "\\" + c);
}

/** Escolhe um cadastro entre vários candidatos (lista de linhas de joiners). Devolve null se a lista for vazia. */
export function escolherJoiner(candidatos, digitado = "") {
  const lista = (candidatos || []).filter(Boolean);
  if (!lista.length) return null;
  const alvo = String(digitado ?? "").trim().replace(/^@+/, "");
  const idDe = j => (j.id ?? Infinity);
  return [...lista].sort((a, b) =>
    (b.confirmado ? 1 : 0) - (a.confirmado ? 1 : 0)
    || (b.cog === alvo ? 1 : 0) - (a.cog === alvo ? 1 : 0)
    || idDe(a) - idDe(b))[0];
}
