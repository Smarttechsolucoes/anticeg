// Envia à planilha (aba Dados) os e-mails verificados que ficaram na fila public.perfil_sync_pendente. Ver _shared/perfilsync.ts.
// Quem chama: a administradora (botão "reprocessar") ou o servidor (job do sync, com a chave de serviço). Segredos: PLANILHA_URL e PLANILHA_TOKEN (os mesmos do proxy planilha-acao).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarPerfilSync } from "../_shared/perfilsync.ts";

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, servico, { auth: { persistSession: false } });
  const comoUsuario = (token: string) => createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  return tratarPerfilSync(req, {
    env: (nome) => Deno.env.get(nome),
    resolverToken: async (token) => { const { data: admin } = await comoUsuario(token).rpc("is_admin"); return { admin: admin === true, cog: null }; },
    proximos: async (limite) => ((await sb.rpc("perfil_sync_proximos", { p_limite: limite })).data ?? []) as never,
    // E1: a marcação de 4 parâmetros atualiza a MESMA tarefa de cadastro (tentativas, erro, estado da planilha); o SQL E1 precisa estar aplicado ANTES desta função ser publicada
    marcar: async (id, ok, erro, definitivo) => { await sb.rpc("perfil_sync_marcar", { p_id: id, p_ok: ok, p_erro: erro, p_definitivo: definitivo === true }); },
    estado: async (tarefaId) => ((await sb.rpc("perfil_sync_estado", { p_tarefa_id: tarefaId })).data ?? null) as never,
    planilha: async (u, corpo) => {
      const r = await fetch(u, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(corpo) });
      let json: unknown = null; try { json = JSON.parse(await r.text()); } catch { /* ilegível */ }
      return { status: r.status, json };
    },
  });
});
