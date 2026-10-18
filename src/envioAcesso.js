// Acesso das joiners ao ENVIO NACIONAL sem login/senha, mas com um LINK PESSOAL SECRETO enviado pela equipe (…/envio?acesso=<token>).
// O token é guardado só neste aparelho e vai no cabeçalho "x-envio-token" das consultas das tabelas de envio. QUEM decide se ele vale é o BANCO
// (public.envio_token_cog / policies do ENV1): token errado, expirado ou revogado = nenhuma linha e nenhuma escrita. Saber o @ não basta.
import { createClient } from "@supabase/supabase-js";
import supabase, { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase.js";
import { criarGuardaToken, normalizarCogEnvio } from "./envioAcessoPuro.js";

export { normalizarCogEnvio };
// com false (variável do build) a aba volta a abrir sem link: só para emergência
export const ENVIO_EXIGE_ACESSO = import.meta.env.VITE_ENVIO_EXIGE_ACESSO !== "false";

const guarda = criarGuardaToken();
export const capturarTokenEnvio = () => guarda.capturar();
export const tokenEnvio = () => guarda.ler();
export const temTokenEnvio = () => !!guarda.ler();

let _cliente = null, _clienteToken = null;
export function limparTokenEnvio() { guarda.limpar(); _cliente = null; _clienteToken = null; }

// cliente com o token no cabeçalho; sem sessão própria (não mexe no login do resto do site)
export function clienteEnvio() {
  const t = tokenEnvio();
  if (!t) return null;
  if (!_cliente || _clienteToken !== t) {
    _cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "anticeg-envio-anon" },
      global: { headers: { "x-envio-token": t } },
    });
    _clienteToken = t;
  }
  return _cliente;
}
// usado em TODO acesso da joiner às tabelas de envio: com token, o cliente do envio; sem token, o cliente de sempre (que o banco recusa depois do ENV1)
export function supabaseEnvio() { return clienteEnvio() || supabase; }
