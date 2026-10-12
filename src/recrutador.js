import supabase from "./supabase.js";

// Descobre o cog de um joiner a partir do @ digitado (cog ou twitter). Retorna null se não achar.
export async function resolverRecrutador(texto) {
  const handle = (texto || "").trim().replace(/^@/, "");
  if (!handle) return null;
  const { data: porCog } = await supabase.from("joiners").select("cog").eq("cog", handle).maybeSingle();
  if (porCog) return porCog.cog;
  const { data: porTw } = await supabase.from("joiners").select("cog")
    .or(`twitter.ilike.@${handle},twitter.ilike.${handle}`).limit(1).maybeSingle();
  return porTw?.cog || null;
}

// Quantos joiners têm este cog como recrutador (0 se a coluna ainda não existir)
export async function contarRecrutados(cog) {
  const { count } = await supabase.from("joiners").select("id", { count: "exact", head: true }).eq("recrutador", cog);
  return count || 0;
}
