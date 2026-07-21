import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { to_email, to_name, assunto, corpo } = await req.json();

    if (!to_email) {
      return new Response(JSON.stringify({ error: "to_email obrigatório" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const BREVO_API_KEY     = Deno.env.get("BREVO_API_KEY");
    const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") ?? "";
    const BREVO_SENDER_NAME  = Deno.env.get("BREVO_SENDER_NAME")  ?? "ANTICEG";

    if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY ou BREVO_SENDER_EMAIL não configurado" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key":      BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender:      { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to:          [{ email: to_email, name: to_name || "joiner" }],
        subject:     assunto,
        htmlContent: corpo,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return new Response(JSON.stringify({ error: data?.message ?? `Brevo ${r.status}` }), {
        status: r.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, messageId: data.messageId }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
