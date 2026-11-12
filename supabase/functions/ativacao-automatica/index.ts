// Ativação automática completa (J22): consultar o @, enviar o código, conferir o código e ligar a conta ao cadastro. Regra toda em _shared/ativacao_auto.ts.
// Segredos usados: os padrões do Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) e, para avisar o e-mail antigo numa troca, SENDGRID_API_KEY, SENDER_EMAIL e (opcional) SENDER_NAME.
// Depende do SQL J22 (public.ativar_conta_automatica). Opcional: ALLOWED_ORIGINS.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { garantirUsuarioAdmin } from "../_shared/ativacao.ts";
import { tratarAuto } from "../_shared/ativacao_auto.ts";

const likeSeguro = (v: string) => v.replace(/[\\%_]/g, c => "\\" + c);
const escapar = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";
  return tratarAuto(req, {
    env: (nome) => Deno.env.get(nome),
    db: () => ({
      contar: async (chave, desde) => (await sb.from("tentativas_acesso").select("id", { count: "exact", head: true }).eq("tipo", "ativacao_auto").eq("chave", chave).gte("criado_em", desde)).count ?? 0,
      registrar: async (chave) => { await sb.from("tentativas_acesso").insert({ tipo: "ativacao_auto", chave }); },
      joinersPorCog: async (cog) => ((await sb.from("joiners").select("id,cog,email,bloqueado").ilike("cog", likeSeguro(cog)).limit(5)).data ?? []) as never,
      quantasComEmail: async (email) => (await sb.from("joiners").select("id", { count: "exact", head: true }).ilike("email", likeSeguro(email))).count ?? 0,
      jaVinculada: async (id) => ((await sb.from("contas_joiner").select("user_id", { count: "exact", head: true }).eq("joiner_id", id)).count ?? 0) > 0,
      liberada: async (id) => (await sb.rpc("ativacao_liberada", { p_joiner_id: id })).data === true,
    }),
    rede: () => ({
      garantirUsuario: async (email) => { await garantirUsuarioAdmin(sb as never, email); },
      enviarCodigo: async (email) => {
        const r = await fetch(`${url}/auth/v1/otp`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, create_user: false }) });
        if (!r.ok) throw new Error("o Auth recusou o envio (HTTP " + r.status + ")");
      },
      verificarCodigo: async (email, codigo) => {
        const r = await fetch(`${url}/auth/v1/verify`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ type: "email", email, token: codigo }) });
        if (!r.ok) return null;
        const j = await r.json().catch(() => null);
        return j && typeof j.access_token === "string" && typeof j.refresh_token === "string" ? { access_token: j.access_token, refresh_token: j.refresh_token } : null;
      },
      usuarioDoToken: async (jwt) => (await sb.auth.getUser(jwt)).data.user?.id ?? null,
      concluir: async (userId, cog) => {
        const r = await sb.rpc("ativar_conta_automatica", { p_user_id: userId, p_cog: cog });
        if (r.error) throw new Error("ativar_conta_automatica: " + r.error.message);
        return r.data as never;
      },
      avisarTroca: async (emailAntigo, cog) => {
        const chave = Deno.env.get("SENDGRID_API_KEY"), remetente = Deno.env.get("SENDER_EMAIL"), nome = Deno.env.get("SENDER_NAME") ?? "ANTICEG";
        if (!chave || !remetente) throw new Error("envio de e-mail não configurado");
        const texto = `O e-mail do cadastro @${cog} na ANTICEG acabou de ser trocado por outro endereço, quando uma conta foi ativada com ele. Se foi você, não precisa fazer nada. Se NÃO foi você, avise a administração o quanto antes, pelo canal que você já usa para falar com a gente.`;
        const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
          body: JSON.stringify({ personalizations: [{ to: [{ email: emailAntigo }] }], from: { email: remetente, name: nome }, subject: "O e-mail do seu cadastro na ANTICEG foi trocado", content: [{ type: "text/plain", value: texto }, { type: "text/html", value: `<p>${escapar(texto)}</p>` }] }),
        });
        if (!r.ok) throw new Error("o provedor de e-mail recusou o aviso (HTTP " + r.status + ")");
      },
    }),
  }, ip);
});
