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

    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    const SENDER_EMAIL     = Deno.env.get("SENDER_EMAIL") ?? "";
    const SENDER_NAME      = Deno.env.get("SENDER_NAME") ?? "ANTICEG";

    if (!SENDGRID_API_KEY || !SENDER_EMAIL) {
      return new Response(JSON.stringify({ error: "SENDGRID_API_KEY ou SENDER_EMAIL não configurado" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to_email, name: to_name || "joiner" }] }],
        from: { email: SENDER_EMAIL, name: SENDER_NAME },
        subject: assunto,
        content: [{ type: "text/html", value: corpo }],
      }),
    });

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      const msg = data?.errors?.[0]?.message ?? `SendGrid ${r.status}`;
      return new Response(JSON.stringify({ error: msg }), {
        status: r.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
