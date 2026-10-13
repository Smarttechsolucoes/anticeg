// "Esqueci minha senha" das joiners: a pessoa informa o @; o servidor acha o e-mail verificado da conta e pede ao Supabase Auth o link de redefinição.
// A resposta é sempre a mesma (com ou sem conta), o e-mail nunca aparece e há limite por @ e por endereço de rede.
// O link só funciona se https://anticeg.vercel.app/** estiver em Authentication > URL Configuration > Redirect URLs.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { processarRecuperacao } from "../_shared/acesso.ts";
import type { DbAcesso, Rede } from "../_shared/acesso.ts";

const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197").split(",").map(s => s.trim());
const SITE = Deno.env.get("SITE_URL") ?? "https://anticeg.vercel.app";
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
    const sb = createClient(url, servico, { auth: { persistSession: false } });
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";

    const db: DbAcesso = {
      contarTentativas: async (tipo, chave, desde) => (await sb.from("tentativas_acesso").select("id", { count: "exact", head: true }).eq("tipo", tipo).eq("chave", chave).gte("criado_em", desde)).count ?? 0,
      registrarTentativa: async (tipo, chave) => { await sb.from("tentativas_acesso").insert({ tipo, chave }); },
      limparTentativas: async () => {},
      emailDaConta: async (cog) => {
        const { data: c } = await sb.from("contas_joiner").select("user_id").ilike("cog", likeSeguro(cog)).maybeSingle();
        if (!c?.user_id) return null;
        const { data: u } = await sb.auth.admin.getUserById(c.user_id);
        return u?.user?.email && u.user.email_confirmed_at ? u.user.email : null;
      },
    };
    const rede: Rede = {
      entrarComSenha: async () => ({ ok: false }),
      pedirRecuperacao: async (email) => {
        await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(SITE + "/")}`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      },
    };
    const r = await processarRecuperacao(await req.json().catch(() => null), ip, db, rede);
    return resp(r.status, r.corpo, origin);
  } catch (e) {
    console.error("recuperar-senha-joiner", e instanceof Error ? e.message : e);
    return resp(200, { ok: true }, origin);     // mesmo em erro interno a resposta é neutra
  }
});
