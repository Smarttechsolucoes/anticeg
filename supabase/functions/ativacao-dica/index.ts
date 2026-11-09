// Dica MASCARADA do e-mail cadastrado, na ativação (ex.: "m•••@g•••.com"). Nunca devolve o endereço completo, nunca envia e-mail e nunca altera cadastro.
// A resposta tem sempre a mesma forma (@ que não existe recebe uma dica falsa e estável), com limites por rede e por @: ver _shared/ativacao_dica.ts.
// Segredos: os padrões do Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) e DICA_SEGREDO (≥16 caracteres; sem ele a função NÃO responde). Opcional: ALLOWED_ORIGINS.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarPedidoDica } from "../_shared/ativacao_dica.ts";

const likeSeguro = (v: string) => v.replace(/[\\%_]/g, c => "\\" + c);

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";
  return tratarPedidoDica(req, {
    env: (nome) => Deno.env.get(nome),
    db: () => ({
      // mesma tabela e mesmo tipo do pedido de código; as chaves "dica-…" não se misturam com as de lá
      contar: async (chave, desde) => (await sb.from("tentativas_acesso").select("id", { count: "exact", head: true }).eq("tipo", "ativacao").eq("chave", chave).gte("criado_em", desde)).count ?? 0,
      registrar: async (chave) => { await sb.from("tentativas_acesso").insert({ tipo: "ativacao", chave }); },
      joinersPorCog: async (cog) => ((await sb.from("joiners").select("id,cog,email,bloqueado").ilike("cog", likeSeguro(cog)).limit(5)).data ?? []) as never,
    }),
  }, ip);
});
