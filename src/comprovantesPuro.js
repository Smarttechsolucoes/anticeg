// Partes de comprovantes.js sem dependência do navegador/Vite (testáveis com node --test).
const RX_REF = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/(comprovantes|mercari-comprovantes)\/([^?#]+)/;
const RX_ENDERECO = /https?:\/\/[^\s"'<>]+\/storage\/v1\/object\/(?:public|sign|authenticated)\/(?:comprovantes|mercari-comprovantes)\/[^\s"'<>]+/g;
export const EXT_TIPO = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf" };

// {bucket, path} de uma URL gravada num pedido (ou null se não for de um bucket de comprovantes)
export function referenciaDeComprovante(valor) {
  const m = RX_REF.exec(String(valor || ""));
  if (!m) return null;
  let path = m[2];
  try { path = decodeURIComponent(path); } catch { /* mantém como veio */ }
  return { bucket: m[1], path };
}
// todos os endereços de comprovante que aparecem dentro de um HTML
export function enderecosDeComprovante(html) { return [...new Set(String(html).match(RX_ENDERECO) || [])]; }
export function substituirEnderecos(html, mapa) {
  let saida = String(html);
  for (const [de, para] of Object.entries(mapa)) saida = saida.split(de).join(para);
  return saida;
}
