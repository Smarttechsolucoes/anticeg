import { createClient } from "@supabase/supabase-js";

// chave pública (anon): é a mesma que o navegador já usa; o acesso real é decidido pelas policies do banco
/* global __PREVIEW_VERCEL__ */
import { decidirBanco } from "./ambiente.js";
const CHAVE_PRODUCAO = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM";

// Preview da Vercel NUNCA fala com a produção: sem projeto alternativo configurado, o banco vira um endereço inexistente (preview inerte). Veja src/ambiente.js.
const banco = decidirBanco({
  host: typeof location !== "undefined" ? location.hostname : "",
  urlEnv: import.meta.env.VITE_SUPABASE_URL || "",
  buildPreview: typeof __PREVIEW_VERCEL__ !== "undefined" && __PREVIEW_VERCEL__,
});
export const PREVIEW_INERTE = banco.inerte;
export const SUPABASE_URL = banco.url;
export const SUPABASE_ANON_KEY = banco.alternativo ? (import.meta.env.VITE_SUPABASE_ANON_KEY || "") : banco.inerte ? "preview-sem-banco" : CHAVE_PRODUCAO;

// O cliente principal só lê sessão que chegue pela URL (link de recuperação de senha) quando o login das joiners está LIGADO (VITE_JOINERS_AUTH=true).
// Com a chave desligada nada muda para o site; a página /piloto-senha/ usa um cliente próprio e lê o link por conta própria.
const LER_SESSAO_NA_URL = import.meta.env.VITE_JOINERS_AUTH === "true";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { detectSessionInUrl: LER_SESSAO_NA_URL } });

export default supabase;
