// Proxy autorizado do Web App da planilha (Apps Script). O token do Apps Script fica SÓ aqui (segredo PLANILHA_TOKEN); o navegador chama esta função com o login de quem usa o site.
// A decisão "quem pode fazer o quê, em qual item" está em _shared/planilha.ts (testada sem rede). Aqui só entram as dependências reais.
// Segredos (Supabase > Edge Functions > Secrets): PLANILHA_URL (a URL /exec do Web App), PLANILHA_TOKEN (o mesmo valor da propriedade ANTICEG_TOKEN do Apps Script).
// Opcionais: ALLOWED_ORIGINS; PLANILHA_EXIGIR_CONTA=true (depois do lançamento do login das joiners: ações das joiners passam a exigir conta ativada e dona do item).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarPlanilha } from "../_shared/planilha.ts";
import type { DbPlanilha } from "../_shared/planilha.ts";

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const comoUsuario = (token: string) => createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const db: DbPlanilha = {
    linhasPorIdLinha: async ids => (await sb.from("masterlist").select("id,id_linha,cog,nome,ceg,nome_do_item").in("id_linha", ids).limit(2000)).data ?? [],
    demandas: async ({ status, desde }) => {
      let q = sb.from("pagamento_demandas").select("id,joiner_cog,status,created_at,itens").in("status", status).order("created_at", { ascending: false }).limit(500);
      if (desde) q = q.gte("created_at", desde);
      return (await q).data ?? [];
    },
    claimsAprovados: async ids => (await sb.from("claims").select("masterlist_id,joiner_cog").in("masterlist_id", ids).eq("status", "aprovado")).data ?? [],
    repassosAprovados: async ids => (await sb.from("repassos").select("item_id").in("item_id", ids).eq("status", "aprovado")).data ?? [],
    reportsRecentes: async (ids, desde) => (await sb.from("reports").select("item_id,joiner_cog").in("item_id", ids).gte("created_at", desde)).data ?? [],
    confirmacoesRecentes: async desde => (await sb.from("confirmacoes").select("joiner_cog,twitter_novo,email_novo").gte("created_at", desde).order("created_at", { ascending: false }).limit(50)).data ?? [],
    preCadastroRecente: async cog => (await sb.from("pre_cadastros").select("cog,nome,email,created_at").ilike("cog", cog.replace(/[\%_]/g, c => "\\" + c)).order("created_at", { ascending: false }).limit(1).maybeSingle()).data ?? null,
    joinerPorCog: async cog => (await sb.from("joiners").select("cog,twitter").eq("cog", cog).maybeSingle()).data ?? null,
    joinersComTwitter: async tw => { const e = tw.replace(/[\\%_]/g, c => "\\" + c); return (await sb.from("joiners").select("cog").or(`twitter.ilike.${e},twitter.ilike.@${e}`).limit(5)).data ?? []; },
  };
  return tratarPlanilha(req, {
    env: (nome) => Deno.env.get(nome),
    fetch,
    db,
    resolverToken: async (token) => {
      const c = comoUsuario(token);
      const { data: admin } = await c.rpc("is_admin");
      if (admin === true) return { admin: true, cog: null };
      const { data: cog, error } = await c.rpc("meu_cog");     // antes do J1 a função não existe: sem erro fatal, a pessoa segue como anônima
      return { admin: false, cog: !error && typeof cog === "string" ? cog : null };
    },
  });
});
