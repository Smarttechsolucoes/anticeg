// "Enviar código" do painel de Contas (Admin): força o código de ativação para o e-mail do CADASTRO. Regra toda em _shared/admin_codigo.ts.
// A administradora é conferida com o login de QUEM CHAMOU (public.is_admin() usa auth.uid()); a chave de serviço só é usada depois, para criar a conta e registrar.
// Segredos usados: os padrões do Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). Opcional: ALLOWED_ORIGINS.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { garantirUsuarioAdmin } from "../_shared/ativacao.ts";
import { processarEnvioAdmin } from "../_shared/admin_codigo.ts";
import type { DbAdminCodigo, RedeAdminCodigo } from "../_shared/admin_codigo.ts";

const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197").split(",").map(s => s.trim());
const cors = (origin: string | null) => ({
  ...(origin && ORIGENS.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
const resp = (status: number, corpo: unknown, origin: string | null) => new Response(JSON.stringify(corpo), { status, headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" } });
const likeSeguro = (v: string) => v.replace(/[\\%_]/g, c => "\\" + c);

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return resp(405, { error: "método não permitido" }, origin);
  try {
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.toLowerCase().startsWith("bearer ")) return resp(401, { error: "entre como administradora" }, origin);
    const chamador = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const sb = createClient(url, servico, { auth: { persistSession: false } });

    const db: DbAdminCodigo = {
      ehAdmin: async () => (await chamador.rpc("is_admin")).data === true,
      quem: async () => (await chamador.auth.getUser()).data.user?.id ?? null,
      joinerPorId: async (id) => ((await sb.from("joiners").select("id,cog,email,bloqueado").eq("id", id).limit(1)).data?.[0] ?? null) as never,
      quantasComEmail: async (email) => (await sb.from("joiners").select("id", { count: "exact", head: true }).ilike("email", likeSeguro(email))).count ?? 0,
      jaVinculada: async (id) => ((await sb.from("contas_joiner").select("user_id", { count: "exact", head: true }).eq("joiner_id", id)).count ?? 0) > 0,
      liberada: async (id) => (await sb.rpc("ativacao_liberada", { p_joiner_id: id })).data === true,
      vinculoConfiavel: async (id) => { const r = await sb.rpc("ativacao_vinculo_confiavel", { p_joiner_id: id }); return r.error ? true : r.data === true; },
      auditar: async (id, detalhe) => { const r = await sb.from("contas_auditoria").insert({ acao: "enviar_codigo_admin", joiner_id: id, detalhe }); if (r.error) throw new Error("não foi possível registrar: " + r.error.message); },
    };
    const rede: RedeAdminCodigo = {
      garantirUsuario: async (email) => { await garantirUsuarioAdmin(sb as never, email); },
      enviarCodigo: async (email) => {
        const r = await fetch(`${url}/auth/v1/otp`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, create_user: false }) });
        if (!r.ok) throw new Error("o Auth recusou o envio (HTTP " + r.status + ")");
      },
    };
    const r = await processarEnvioAdmin(await req.json().catch(() => null), db, rede);
    return resp(r.status, r.corpo, origin);
  } catch (e) {
    console.error("admin-enviar-codigo", e instanceof Error ? e.message : e);
    return resp(500, { error: "erro interno; nada foi enviado" }, origin);
  }
});
