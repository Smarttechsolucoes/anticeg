// Decide para qual banco o site fala. Função pura (sem import.meta nem window) para poder ser testada em Node.
// Regra de segurança: um PREVIEW da Vercel (build de preview ou qualquer *.vercel.app que não seja o site oficial) NUNCA usa o Supabase de produção.
// Sem outro projeto configurado, o preview fica INERTE: aponta para um endereço inexistente (.invalid), então nenhuma leitura nem escrita chega ao banco real.
export const REF_PRODUCAO = "ghjfsmwwcfpfvrouyrka";
export const URL_PRODUCAO = `https://${REF_PRODUCAO}.supabase.co`;
export const URL_INERTE = "https://preview-sem-banco.invalid";
export const HOSTS_OFICIAIS = ["anticeg.vercel.app", "anticeg-smarttechsolucoes-projects.vercel.app"];

export const ehPreviewVercel = (host = "") => /\.vercel\.app$/i.test(host) && !HOSTS_OFICIAIS.includes(host.toLowerCase());

/** @returns {{ url: string, inerte: boolean, alternativo: boolean }} */
export function decidirBanco({ host = "", urlEnv = "", buildPreview = false } = {}) {
  const preview = !!buildPreview || ehPreviewVercel(host);
  const alternativo = !!urlEnv && !urlEnv.includes(REF_PRODUCAO);          // projeto próprio de ensaio, configurado de propósito
  if (preview && !alternativo) return { url: URL_INERTE, inerte: true, alternativo: false };
  if (alternativo) return { url: urlEnv, inerte: false, alternativo: true };
  return { url: URL_PRODUCAO, inerte: false, alternativo: false };
}
