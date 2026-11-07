// Comprovantes em buckets PRIVADOS (J5): envio autorizado pelo servidor e links assinados para ver.
// Desligado por padrão: com VITE_JOINERS_AUTH=false o site se comporta exatamente como hoje (envio direto e links públicos).
// Ligado: o arquivo só sobe com a autorização da função comprovante-upload e só abre pelo link assinado da função comprovante-url.
import { useEffect, useState } from "react";
import supabase from "./supabase.js";
import { JOINERS_AUTH_ATIVO } from "./joinerAuth.js";
import { referenciaDeComprovante, enderecosDeComprovante, substituirEnderecos, EXT_TIPO } from "./comprovantesPuro.js";
export { referenciaDeComprovante };

export const precisaAssinar = valor => JOINERS_AUTH_ATIVO && !!referenciaDeComprovante(valor);

async function mensagemDoErro(error, padrao) {
  try { const corpo = await error?.context?.json?.(); if (corpo?.error) return corpo.error; } catch { /* sem corpo */ }
  return padrao;
}

// substitui supabase.storage.from(bucket).upload(path, file, opts): devolve { error } com o mesmo formato
export async function enviarComprovante(bucket, path, file, opts = {}, client = supabase) {
  if (!JOINERS_AUTH_ATIVO) return client.storage.from(bucket).upload(path, file, opts);
  const ext = String(path).split(".").pop().toLowerCase();
  const { data, error } = await client.functions.invoke("comprovante-upload", { body: { bucket, path, tipo: file?.type || "", tamanho: file?.size || 0 } });
  if (error || !data?.ok) return { error: { message: await mensagemDoErro(error, "Não foi possível autorizar o envio do comprovante. Tente de novo.") } };
  const { error: e2 } = await client.storage.from(bucket).uploadToSignedUrl(data.path, data.token, file, { contentType: EXT_TIPO[ext] || data.tipo || file?.type || "application/octet-stream" });
  return { error: e2 || null };
}

const cache = new Map();   // "bucket/path" -> { url, ate }
// link para ver o comprovante: o próprio valor (modo atual) ou um link assinado de 10 minutos (modo novo)
export async function urlDoComprovante(valor, client = supabase) {
  if (!precisaAssinar(valor)) return valor || null;
  const { bucket, path } = referenciaDeComprovante(valor);
  const chave = bucket + "/" + path;
  const guardado = cache.get(chave);
  if (guardado && guardado.ate > Date.now()) return guardado.url;
  const { data, error } = await client.functions.invoke("comprovante-url", { body: { bucket, path } });
  if (error || !data?.ok || !data.url) return null;
  cache.set(chave, { url: data.url, ate: Date.now() + 8 * 60 * 1000 });
  return data.url;
}

// para <a href={comprovante_url} onClick={e => abrirComprovante(e, comprovante_url)}>: abre o link assinado numa nova aba
export async function abrirComprovante(e, valor) {
  if (!precisaAssinar(valor)) return;
  e.preventDefault();
  const aba = window.open("", "_blank");        // abre já, no clique, para o navegador não bloquear
  const url = await urlDoComprovante(valor);
  if (url && aba) { aba.location.href = url; return; }
  if (aba) aba.close();
  window.alert("Não foi possível abrir o comprovante agora. Tente de novo em instantes.");
}

// troca, dentro de um HTML pronto (impressão), todos os endereços de comprovante pelos links assinados
export async function resolverComprovantesNoHtml(html) {
  if (!JOINERS_AUTH_ATIVO) return html;
  const mapa = {};
  for (const u of enderecosDeComprovante(html)) mapa[u] = (await urlDoComprovante(u)) || "";
  return substituirEnderecos(html, mapa);
}

// para <img src>: devolve o endereço direto (modo atual) ou o link assinado, quando ele chega (null enquanto carrega ou se não puder abrir)
export function useUrlComprovante(valor) {
  const [resolvido, setResolvido] = useState({ para: null, url: null });
  const assina = precisaAssinar(valor);
  useEffect(() => {
    if (!assina) return undefined;
    let vivo = true;
    urlDoComprovante(valor).then(u => { if (vivo) setResolvido({ para: valor, url: u }); });
    return () => { vivo = false; };
  }, [valor, assina]);
  if (!assina) return valor || null;
  return resolvido.para === valor ? resolvido.url : null;
}
