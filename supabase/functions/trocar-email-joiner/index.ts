// "Quero mudar de e-mail" (J13): troca do e-mail do cadastro COM PROVA (código no e-mail antigo e no novo). Toda a regra está em _shared/troca_email.ts; aqui só se montam as dependências reais.
// NUNCA vincula conta a cadastro. Segredos: os padrões do Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY), DICA_SEGREDO (≥16 caracteres; sem ele a função NÃO responde)
// e o remetente atual do site (SENDGRID_API_KEY, SENDER_EMAIL, SENDER_NAME). Opcional: ALLOWED_ORIGINS.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarTroca } from "../_shared/troca_email.ts";

const likeSeguro = (v: string) => v.replace(/[\\%_]/g, c => "\\" + c);

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";
  const rpc = async (nome: string, args: Record<string, unknown>) => { const r = await sb.rpc(nome, args); if (r.error) throw new Error(r.error.message); return r.data; };
  return tratarTroca(req, {
    env: (nome) => Deno.env.get(nome),
    db: () => ({
      contar: async (chave, desde) => (await sb.from("tentativas_acesso").select("id", { count: "exact", head: true }).eq("tipo", "ativacao").eq("chave", chave).gte("criado_em", desde)).count ?? 0,
      registrar: async (chave) => { await sb.from("tentativas_acesso").insert({ tipo: "ativacao", chave }); },
      joinersPorCog: async (cog) => ((await sb.from("joiners").select("id,cog,email,bloqueado").ilike("cog", likeSeguro(cog)).limit(5)).data ?? []) as never,
      quantasComEmail: async (email) => (await sb.from("joiners").select("id", { count: "exact", head: true }).ilike("email", likeSeguro(email))).count ?? 0,
      abrir: async (joinerId, via, novoEmail, codAntigoHash, codNovoHash) => Number(await rpc("troca_email_abrir", { p_joiner_id: joinerId, p_via: via, p_novo_email: novoEmail, p_cod_antigo_hash: codAntigoHash, p_cod_novo_hash: codNovoHash })),
      conferir: async (id, lado, codHash) => String(await rpc("troca_email_conferir", { p_id: id, p_lado: lado, p_cod_hash: codHash })) as never,
      concluir: async (id) => String(await rpc("troca_email_concluir", { p_id: id })) as never,
    }),
    // remetente atual do site (o mesmo das notificações por e-mail)
    enviar: () => async (para, assunto, texto, html) => {
      const chave = Deno.env.get("SENDGRID_API_KEY"), remetente = Deno.env.get("SENDER_EMAIL"), nome = Deno.env.get("SENDER_NAME") ?? "ANTICEG";
      if (!chave || !remetente) throw new Error("envio de e-mail não configurado");
      const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({ personalizations: [{ to: [{ email: para }] }], from: { email: remetente, name: nome }, subject: assunto, content: [{ type: "text/plain", value: texto }, { type: "text/html", value: html }] }),
      });
      if (!r.ok) throw new Error("o provedor de e-mail recusou o envio (HTTP " + r.status + ")");
    },
  }, ip);
});
