// Devolve um link ASSINADO e curto (10 minutos) para ver um comprovante em bucket privado. Ver _shared/comprovantes.ts.
// Quem pode: a administradora, ou a dona do pedido (a função do banco comprovante_assinavel confere, com o login de quem pede, se o arquivo pertence a um pedido dela).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarUrlComprovante } from "../_shared/comprovantes.ts";

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const comoUsuario = (token: string) => createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  return tratarUrlComprovante(req, {
    env: (nome) => Deno.env.get(nome),
    resolverToken: async (token) => {
      const c = comoUsuario(token);
      const { data: admin } = await c.rpc("is_admin");
      if (admin === true) return { admin: true, cog: null };
      const { data: cog } = await c.rpc("meu_cog");
      return { admin: false, cog: typeof cog === "string" ? cog : null };
    },
    podeVer: async (token, bucket, path) => (await comoUsuario(token).rpc("comprovante_assinavel", { p_bucket: bucket, p_path: path })).data === true,
    assinarLeitura: async (bucket, path, segundos) => {
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, segundos);
      return error || !data ? null : data.signedUrl;
    },
  });
});
