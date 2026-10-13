// Push do site. Só a administradora logada (ou o serviço do sync, com a chave de serviço) consegue enviar.
// A inscrição precisa ser de um serviço de push conhecido, o texto é limitado e a URL só pode ser um caminho do próprio site.
// Segredos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (os mesmos da função antiga).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validarPush, identificarQuem } from "../_shared/notificacoes.ts";

const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199").split(",").map(s => s.trim());
const cors = (origin: string | null) => ({
  ...(origin && ORIGENS.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
const resp = (status: number, corpo: unknown, origin: string | null) => new Response(JSON.stringify(corpo), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return resp(405, { error: "método não permitido" }, origin);
  try {
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const quem = await identificarQuem(req.headers.get("authorization"), servico, async (token) => {
      const c = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
      const { data } = await c.rpc("is_admin");
      return data === true;
    });
    const v = validarPush(await req.json().catch(() => null), quem);
    if (!v.ok) return resp(v.status, { error: v.erro }, origin);

    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "", VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return resp(500, { error: "push não configurado" }, origin);
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:anticegs@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);
    const d = v.dados!;
    await webpush.sendNotification(d.subscription, JSON.stringify({ title: d.title, body: d.body, url: d.url }));
    return resp(200, { ok: true }, origin);
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    console.error("push-evento", e instanceof Error ? e.message : e);
    return resp(status === 404 || status === 410 ? 410 : 500, { error: status === 404 || status === 410 ? "inscrição expirada" : "erro interno" }, origin);
  }
});
