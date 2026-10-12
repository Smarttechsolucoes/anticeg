import supabase from "./supabase.js";

// Procura um joiner a partir do @ digitado (cog ou twitter). Retorna { cog, nome } ou null.
export async function buscarRecrutador(texto) {
  const handle = (texto || "").trim().replace(/^@/, "");
  if (!handle) return null;
  const campos = "cog, nome, nome_site";
  let { data } = await supabase.from("joiners").select(campos).eq("cog", handle).maybeSingle();
  if (!data) {
    ({ data } = await supabase.from("joiners").select(campos)
      .or(`twitter.ilike.@${handle},twitter.ilike.${handle}`).limit(1).maybeSingle());
  }
  return data ? { cog: data.cog, nome: data.nome_site || data.nome || data.cog } : null;
}

// Mesma busca, devolvendo só o cog (ou null se não achar)
export async function resolverRecrutador(texto) {
  return (await buscarRecrutador(texto))?.cog || null;
}

// Quantos joiners têm este cog como recrutador (0 se a coluna ainda não existir)
export async function contarRecrutados(cog) {
  const { count } = await supabase.from("joiners").select("id", { count: "exact", head: true }).eq("recrutador", cog);
  return count || 0;
}

// Link do grupo de WhatsApp da comunidade. O valor atual fica na tabela config (editável no admin);
// o padrão abaixo vale enquanto nada tiver sido salvo lá.
export const LINK_COMUNIDADE_PADRAO = "https://chat.whatsapp.com/BUSX3go4re09fddJMNRex4";

export async function buscarLinkComunidade() {
  const { data } = await supabase.from("config").select("value").eq("key", "link_comunidade_wpp").maybeSingle();
  return data?.value?.trim() || LINK_COMUNIDADE_PADRAO;
}
