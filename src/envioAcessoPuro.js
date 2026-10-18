// Parte PURA do acesso ao envio nacional (sem rede, sem Supabase): validação do token, captura de ?acesso= e guarda local. Testável em Node.
export const CHAVE_TOKEN = "anticeg-envio-acesso";
export const PARAM_ACESSO = "acesso";
export function tokenValido(t) { return typeof t === "string" && /^[0-9a-f]{48}$/.test(t); }
export function normalizarCogEnvio(v) { return String(v || "").trim().replace(/^@+/, "").toLowerCase(); }

// `armazenamento` e `janela` são injetáveis (testes); no navegador valem localStorage e window.
export function criarGuardaToken({ armazenamento = typeof localStorage !== "undefined" ? localStorage : null, janela = typeof window !== "undefined" ? window : null } = {}) {
  let memoria = null;
  const guardar = t => { memoria = t; try { if (armazenamento) armazenamento.setItem(CHAVE_TOKEN, t); } catch { /* sem armazenamento: vale só nesta aba */ } };
  const ler = () => {
    try { const t = armazenamento && armazenamento.getItem(CHAVE_TOKEN); if (tokenValido(t)) return t; } catch { /* ignora */ }
    return tokenValido(memoria) ? memoria : null;
  };
  const limpar = () => { memoria = null; try { if (armazenamento) armazenamento.removeItem(CHAVE_TOKEN); } catch { /* ignora */ } };
  // lê ?acesso= da URL, guarda o token e TIRA o parâmetro da barra de endereço (não fica no histórico nem vai em "Referer")
  const capturar = () => {
    if (!janela || !janela.location) return null;
    let url; try { url = new URL(janela.location.href); } catch { return null; }
    const t = url.searchParams.get(PARAM_ACESSO);
    if (t === null) return null;
    url.searchParams.delete(PARAM_ACESSO);
    try { janela.history.replaceState(janela.history.state, "", url.pathname + (url.search || "") + url.hash); } catch { /* ignora */ }
    const limpo = String(t).trim().toLowerCase();
    if (!tokenValido(limpo)) return null;
    guardar(limpo);
    return limpo;
  };
  return { capturar, ler, limpar };
}
