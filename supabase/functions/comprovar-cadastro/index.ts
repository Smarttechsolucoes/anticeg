// "Quero manter meu e-mail e comprovar meu cadastro" (J14): registra um PEDIDO para a administração analisar. NÃO envia e-mail nem código, NÃO vincula conta e NÃO libera nada sozinho.
// Toda a regra está em _shared/comprovar.ts. Segredos: só os padrões do Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). Opcional: ALLOWED_ORIGINS.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarPedidoComprovacao } from "../_shared/comprovar.ts";

const likeSeguro = (v: string) => v.replace(/[\\%_]/g, c => "\\" + c);

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";
  return tratarPedidoComprovacao(req, {
    env: (nome) => Deno.env.get(nome),
    db: () => ({
      contar: async (chave, desde) => (await sb.from("tentativas_acesso").select("id", { count: "exact", head: true }).eq("tipo", "ativacao").eq("chave", chave).gte("criado_em", desde)).count ?? 0,
      registrar: async (chave) => { await sb.from("tentativas_acesso").insert({ tipo: "ativacao", chave }); },
      joinersPorCog: async (cog) => ((await sb.from("joiners").select("id,cog,email,bloqueado").ilike("cog", likeSeguro(cog)).limit(5)).data ?? []) as never,
      abrirComprovacao: async (joinerId, emailDigitado, detalhe) => {
        const r = await sb.rpc("comprovacao_abrir", { p_joiner_id: joinerId, p_email_digitado: emailDigitado, p_via: "sem_perfil", p_desafio_hash: null, p_detalhe: detalhe });
        if (r.error) throw new Error(r.error.message);
        return Number(r.data);
      },
    }),
  }, ip);
});
