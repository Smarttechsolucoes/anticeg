// Claims SÓ COM @ (J20): quem está logada usa a conta atual; quem não está logada ou não tem cadastro informa o @. Toda a regra está em _shared/claims.ts e no banco (claim_enviar_por_cog).
// Segredos: só os padrões do Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). Opcional: ALLOWED_ORIGINS. Nenhuma conta, cadastro ou senha é criado aqui.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarClaim } from "../_shared/claims.ts";

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";
  return tratarClaim(req, {
    env: (nome) => Deno.env.get(nome),
    db: () => ({
      contar: async (chave, desde) => (await sb.from("tentativas_acesso").select("id", { count: "exact", head: true }).eq("tipo", "ativacao").eq("chave", chave).gte("criado_em", desde)).count ?? 0,
      registrar: async (chave) => { await sb.from("tentativas_acesso").insert({ tipo: "ativacao", chave }); },
      // a conta logada (qualquer estado do perfil): o token precisa ser de um usuário do Auth ligado a um cadastro; a chave pública do site não é de usuário nenhum
      cogDaConta: async (token) => {
        const { data: u, error } = await sb.auth.getUser(token);
        if (error || !u?.user?.id) return null;
        const { data: c } = await sb.from("contas_joiner").select("joiner_id").eq("user_id", u.user.id).maybeSingle();
        if (!c?.joiner_id) return null;
        const { data: j } = await sb.from("joiners").select("cog").eq("id", c.joiner_id).maybeSingle();
        return j?.cog ? String(j.cog) : null;
      },
      enviar: async (cog, evento, pedidos) => {
        const r = await sb.rpc("claim_enviar_por_cog", { p_cog: cog, p_evento: evento, p_pedidos: pedidos });
        if (r.error) throw new Error(r.error.message);
        return r.data;
      },
    }),
  }, ip);
});
