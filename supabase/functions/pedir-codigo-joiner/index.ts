// Pedido do código de ativação (e-mail) das joiners. O navegador NÃO fala direto com o Supabase Auth para isso: ver _shared/ativacao.ts.
// O cadastro público de usuários do Auth pode (e deve) ficar DESLIGADO: esta função cria a conta pelo painel administrativo do servidor, só para joiners reais e liberadas, e pede o código ao Auth.
// Segredos usados: os padrões do Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). Opcional: ALLOWED_ORIGINS.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarPedidoCodigo, garantirUsuarioAdmin } from "../_shared/ativacao.ts";

const likeSeguro = (v: string) => v.replace(/[\\%_]/g, c => "\\" + c);

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";
  return tratarPedidoCodigo(req, {
    env: (nome) => Deno.env.get(nome),
    db: () => ({
      contar: async (chave, desde) => (await sb.from("tentativas_acesso").select("id", { count: "exact", head: true }).eq("tipo", "ativacao").eq("chave", chave).gte("criado_em", desde)).count ?? 0,
      registrar: async (chave) => { await sb.from("tentativas_acesso").insert({ tipo: "ativacao", chave }); },
      joinersPorCog: async (cog) => ((await sb.from("joiners").select("id,cog,email,bloqueado").ilike("cog", likeSeguro(cog)).limit(5)).data ?? []) as never,
      quantasComEmail: async (email) => (await sb.from("joiners").select("id", { count: "exact", head: true }).ilike("email", likeSeguro(email))).count ?? 0,
      jaVinculada: async (id) => ((await sb.from("contas_joiner").select("user_id", { count: "exact", head: true }).eq("joiner_id", id)).count ?? 0) > 0,
      liberada: async (id) => (await sb.rpc("ativacao_liberada", { p_joiner_id: id })).data === true,
    }),
    rede: () => ({
      garantirUsuario: async (email) => { await garantirUsuarioAdmin(sb as never, email); },   // fluxo administrativo: funciona com User Signups desligado (ver _shared/ativacao.ts)
      enviarCodigo: async (email) => {
        const r = await fetch(`${url}/auth/v1/otp`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, create_user: false }) });
        if (!r.ok) throw new Error("o Auth recusou o envio (HTTP " + r.status + ")");
      },
    }),
  }, ip);
});
