// Autoriza o envio de UM comprovante para um bucket privado (comprovantes ou mercari-comprovantes). Ver _shared/comprovantes.ts.
// O navegador recebe um token de envio de uso único (createSignedUploadUrl): o arquivo nunca sobrescreve outro, e o tipo/tamanho são conferidos aqui e pelo próprio bucket.
// Segredos usados: os padrões do Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). Opcionais: ALLOWED_ORIGINS, PERMITIR_COMPROVANTE_ANONIMO (false = só conta logada pode enviar).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarUploadComprovante } from "../_shared/comprovantes.ts";

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";
  return tratarUploadComprovante(req, {
    env: (nome) => Deno.env.get(nome),
    resolverToken: async (token) => {
      const c = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
      const { data: admin } = await c.rpc("is_admin");
      if (admin === true) return { admin: true, cog: null };
      const { data: cog } = await c.rpc("meu_cog");
      return { admin: false, cog: typeof cog === "string" ? cog : null };
    },
    contar: async (chave, desde) => (await sb.from("comprovantes_uploads").select("id", { count: "exact", head: true }).eq("chave", chave).gte("criado_em", desde)).count ?? 0,
    registrar: async (chave) => { await sb.from("comprovantes_uploads").insert({ chave }); },
    assinar: async (bucket, path) => {
      const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(path);   // sem upsert: se o arquivo já existe, recusa
      if (error || !data) return null;
      return { token: data.token, path: data.path };
    },
  }, ip);
});
