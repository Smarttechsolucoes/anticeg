// E-mails de notificação do site. O visitante NÃO escolhe destinatário, assunto nem corpo: informa só o tipo do evento e o id do registro.
// O servidor confere o evento no banco, descobre o destinatário no cadastro e monta a mensagem com modelos próprios (ver _shared/notificacoes.ts).
// A lógica HTTP fica em _shared/handlers.ts (testada sem rede). Aqui só entram as dependências reais.
// Segredos (Supabase > Edge Functions > Secrets): SENDGRID_API_KEY, SENDER_EMAIL, SENDER_NAME. Opcionais: ADMIN_NOTIFY_EMAIL (aviso de cadastro novo à administração), ALLOWED_ORIGINS, PERMITIR_COMPROVANTE_ANONIMO ("false" depois do lançamento).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarEmail } from "../_shared/handlers.ts";
import type { Db } from "../_shared/notificacoes.ts";

const likeSeguro = (v: string) => v.replace(/[\\%_]/g, c => "\\" + c);

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const db: Db = {
    demanda: async id => (await sb.from("pagamento_demandas").select("id,joiner_cog,status,created_at,valor_total,itens,motivo_rejeicao").eq("id", id).maybeSingle()).data ?? null,
    report: async id => (await sb.from("reports").select("id,joiner_cog,item_nome,resposta,status").eq("id", id).maybeSingle()).data ?? null,
    preCadastroRecente: async cog => (await sb.from("pre_cadastros").select("cog,nome,email,created_at").ilike("cog", likeSeguro(cog)).order("created_at", { ascending: false }).limit(1).maybeSingle()).data ?? null,
    joinersPorCog: async cog => (await sb.from("joiners").select("cog,nome,email").ilike("cog", likeSeguro(cog)).limit(5)).data ?? [],
    pendenciasDoJoiner: async cog => ((await sb.from("masterlist").select("cog,ceg,nome_do_item,valor_item,frete_inter,taxa_rf,pago_item,pago_frete,pago_rf").ilike("cog", likeSeguro(cog)).limit(500)).data ?? []).filter((r: { cog: string | null }) => String(r.cog ?? "").trim() === cog.trim()),
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
  return tratarEmail(req, {
    env: (nome) => Deno.env.get(nome),
    db: () => db,
    resolverToken: async (token) => {
      const c = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
      const { data: admin } = await c.rpc("is_admin");
      if (admin === true) return { admin: true, cog: null };
      const { data: cog } = await c.rpc("meu_cog");   // existe depois do J1; antes dele a chamada falha e segue como anônima
      return { admin: false, cog: typeof cog === "string" ? cog : null };
    },
    fetch,
    desfazerEnvio: async (evento, dest) => { await sb.from("emails_enviados").delete().eq("evento", evento).eq("destinatario", dest).gte("criado_em", new Date(Date.now() - 60_000).toISOString()); },
  });
});
