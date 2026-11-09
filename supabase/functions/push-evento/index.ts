// Push do site. Só a administradora logada (ou o serviço do sync, com a chave de serviço) consegue enviar.
// A inscrição precisa ser de um serviço de push conhecido, o texto é limitado e a URL só pode ser um caminho do próprio site.
// A lógica HTTP fica em _shared/handlers.ts (testada sem rede). Segredos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (os mesmos da função antiga).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarPush } from "../_shared/handlers.ts";

serve((req) => {
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  return tratarPush(req, {
    env: (nome) => Deno.env.get(nome),
    resolverToken: async (token) => {
      const c = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
      const { data } = await c.rpc("is_admin");
      return { admin: data === true, cog: null };
    },
    enviar: async (subscription, payload, vapid) => {
      webpush.setVapidDetails(vapid.assunto, vapid.publica, vapid.privada);
      await webpush.sendNotification(subscription, payload);
    },
  });
});
