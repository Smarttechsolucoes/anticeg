// E-mails de notificação do site. O visitante NÃO escolhe destinatário, assunto nem corpo: informa só o tipo do evento e o id do registro.
// O servidor confere o evento no banco, descobre o destinatário no cadastro e monta a mensagem com modelos próprios (ver _shared/notificacoes.ts).
// Segredos necessários (Supabase > Edge Functions > Secrets): SENDGRID_API_KEY, SENDER_EMAIL, SENDER_NAME. Os do Supabase (URL, ANON, SERVICE_ROLE) já existem.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { prepararEmail, identificarChamada } from "../_shared/notificacoes.ts";
import type { Db } from "../_shared/notificacoes.ts";

const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199").split(",").map(s => s.trim());
const cors = (origin: string | null) => ({
  ...(origin && ORIGENS.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
const resp = (status: number, corpo: unknown, origin: string | null) => new Response(JSON.stringify(corpo), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
const likeSeguro = (v: string) => v.replace(/[\\%_]/g, c => "\\" + c);

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return resp(405, { error: "método não permitido" }, origin);
  try {
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sg = Deno.env.get("SENDGRID_API_KEY"), remetente = Deno.env.get("SENDER_EMAIL"), nomeRemetente = Deno.env.get("SENDER_NAME") ?? "ANTICEG";
    if (!sg || !remetente) return resp(500, { error: "envio de e-mail não configurado" }, origin);

    const chamada = await identificarChamada(req.headers.get("authorization"), servico, async (token) => {
      const c = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
      const { data: admin } = await c.rpc("is_admin");
      if (admin === true) return { admin: true, cog: null };
      const { data: cog } = await c.rpc("meu_cog");   // existe depois do J1; antes dele a chamada falha e segue como anônima
      return { admin: false, cog: typeof cog === "string" ? cog : null };
    });
    // Enquanto o acesso das joiners por senha não for lançado, o aviso de comprovante ainda precisa funcionar no modo "só @".
    // Depois do lançamento, defina PERMITIR_COMPROVANTE_ANONIMO=false para exigir a conta da própria joiner.
    const permitirAnonimo = (Deno.env.get("PERMITIR_COMPROVANTE_ANONIMO") ?? "true") !== "false";

    const sb = createClient(url, servico, { auth: { persistSession: false } });
    const db: Db = {
      demanda: async id => (await sb.from("pagamento_demandas").select("id,joiner_cog,status,created_at,valor_total,itens,motivo_rejeicao").eq("id", id).maybeSingle()).data ?? null,
      report: async id => (await sb.from("reports").select("id,joiner_cog,item_nome,resposta,status").eq("id", id).maybeSingle()).data ?? null,
      joinersPorCog: async cog => (await sb.from("joiners").select("cog,nome,email").ilike("cog", likeSeguro(cog)).limit(3)).data ?? [],
      pendenciasDoJoiner: async cog => (await sb.from("masterlist").select("ceg,nome_do_item,valor_item,frete_inter,taxa_rf,pago_item,pago_frete,pago_rf").ilike("cog", likeSeguro(cog)).limit(500)).data ?? [],
      contarEnvios: async (dest, desde) => {
        let q = sb.from("emails_enviados").select("id", { count: "exact", head: true }).gte("criado_em", desde);
        if (dest) q = q.eq("destinatario", dest);
        return (await q).count ?? 0;
      },
      registrarEnvio: async e => {
        const { error } = await sb.from("emails_enviados").insert(e);
        if (!error) return true;
        if (error.code === "23505") return false;
        throw new Error("registro de envio indisponível");
      },
    };

    const entrada = await req.json().catch(() => null);
    const r = await prepararEmail(entrada, chamada.quem, db, new Date(), { cogConta: chamada.cogConta, permitirAnonimo });
    if (!r.ok) return resp(r.status, { error: r.erro }, origin);

    const envio = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sg}`, "Content-Type": "application/json" },
      body: JSON.stringify({ personalizations: [{ to: [{ email: r.para, name: r.nome }] }], from: { email: remetente, name: nomeRemetente }, subject: r.assunto, content: [{ type: "text/html", value: r.html }] }),
    });
    if (!envio.ok) {
      // devolve a "vaga" do envio para permitir nova tentativa
      await sb.from("emails_enviados").delete().eq("evento", r.evento!).eq("destinatario", r.para!).gte("criado_em", new Date(Date.now() - 60_000).toISOString());
      return resp(502, { error: "falha no provedor de e-mail" }, origin);
    }
    return resp(200, { ok: true }, origin);
  } catch (e) {
    console.error("email-evento", e instanceof Error ? e.message : e);
    return resp(500, { error: "erro interno" }, origin);
  }
});
