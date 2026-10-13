// Login das joiners por @ + senha. O @ é resolvido para o e-mail verificado SÓ AQUI, no servidor; o e-mail nunca volta para o navegador.
// Devolve apenas os tokens da sessão. Falhas (@ inexistente, conta não ativada, senha errada) têm a mesma resposta. Há limite de tentativas.
// Usa as variáveis do próprio Supabase (URL, ANON, SERVICE_ROLE) e a tabela tentativas_acesso (SQL J3).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { processarLogin } from "../_shared/acesso.ts";
import type { DbAcesso, Rede } from "../_shared/acesso.ts";

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
    const sb = createClient(url, servico, { auth: { persistSession: false } });
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";

    const db: DbAcesso = {
      contarTentativas: async (tipo, chave, desde) => (await sb.from("tentativas_acesso").select("id", { count: "exact", head: true }).eq("tipo", tipo).eq("chave", chave).gte("criado_em", desde)).count ?? 0,
      registrarTentativa: async (tipo, chave) => { await sb.from("tentativas_acesso").insert({ tipo, chave }); },
      limparTentativas: async (tipo, chave) => { await sb.from("tentativas_acesso").delete().eq("tipo", tipo).eq("chave", chave); },
      emailDaConta: async (cog) => {
        const { data: c } = await sb.from("contas_joiner").select("user_id").ilike("cog", likeSeguro(cog)).maybeSingle();
        if (!c?.user_id) return null;
        const { data: u } = await sb.auth.admin.getUserById(c.user_id);
        return u?.user?.email && u.user.email_confirmed_at ? u.user.email : null;
      },
    };
    const rede: Rede = {
      entrarComSenha: async (email, senha) => {
        const r = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: senha }) });
        if (!r.ok) return { ok: false };
        return { ok: true, sessao: await r.json() };
      },
      pedirRecuperacao: async () => {},
    };
    if (Math.random() < 0.02) await sb.from("tentativas_acesso").delete().lt("criado_em", new Date(Date.now() - 2 * 86_400_000).toISOString());   // limpeza ocasional

    const r = await processarLogin(await req.json().catch(() => null), ip, db, rede);
    return resp(r.status, r.corpo, origin);
  } catch (e) {
    console.error("login-joiner", e instanceof Error ? e.message : e);
    return resp(500, { error: "erro interno" }, origin);
  }
});
