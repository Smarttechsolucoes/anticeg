// Autoatendimento do Envio Nacional: pede/valida o CÓDIGO enviado ao e-mail já cadastrado e entrega o acesso (token do ENV1). Ver _shared/envioAcesso.ts.
// Chamada pública de propósito (visitante sem login): por isso "Verify JWT" fica DESLIGADO; a proteção está no código (neutralidade, limites no banco, hash do código).
// Segredos usados: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (padrão do Supabase), SENDGRID_API_KEY, SENDER_EMAIL, SENDER_NAME (já existem). Opcionais: ALLOWED_ORIGINS, ENVIO_CODIGO_SEGREDO, ENVIO_CODIGO_MODO_SECO (true = não envia e-mail).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarEnvioAcesso, corpoEmailCodigo } from "../_shared/envioAcesso.ts";

declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  return tratarEnvioAcesso(req, {
    env: (nome) => Deno.env.get(nome),
    emitir: async (cog, hash, ipHash) => {
      const { data, error } = await sb.rpc("envio_codigo_emitir", { p_cog: cog, p_hash: hash, p_ip_hash: ipHash });
      if (error) throw new Error("emitir: " + error.code);
      return typeof data === "string" ? data : null;
    },
    validar: async (cog, hash, ipHash) => {
      const { data, error } = await sb.rpc("envio_codigo_validar", { p_cog: cog, p_hash: hash, p_ip_hash: ipHash });
      if (error) throw new Error("validar: " + error.code);
      return typeof data === "string" ? data : null;
    },
    enviarEmail: async (para, codigo) => {
      const chave = Deno.env.get("SENDGRID_API_KEY"), remetente = Deno.env.get("SENDER_EMAIL");
      if (!chave || !remetente) throw new Error("SENDGRID_API_KEY ou SENDER_EMAIL ausente");
      const { assunto, html } = corpoEmailCodigo(codigo);
      const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({ personalizations: [{ to: [{ email: para }] }], from: { email: remetente, name: Deno.env.get("SENDER_NAME") ?? "Anti CEG" }, subject: assunto, content: [{ type: "text/html", value: html }] }),
      });
      if (!r.ok) throw new Error("SendGrid HTTP " + r.status);
    },
    // em segundo plano quando o ambiente permite (a resposta não depende do envio: sem diferença de tempo); senão, aguarda
    depois: (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) ? (p) => { EdgeRuntime!.waitUntil!(p); } : undefined,
  });
});
