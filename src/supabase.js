import { createClient } from "@supabase/supabase-js";

// chave pública (anon): é a mesma que o navegador já usa; o acesso real é decidido pelas policies do banco
const URL_PRODUCAO = "https://ghjfsmwwcfpfvrouyrka.supabase.co";
const CHAVE_PRODUCAO = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM";

// Ambiente de ENSAIO: o build de teste/preview define VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (projeto Supabase separado). Sem elas, vale a produção, como sempre.
// scripts/checar-ambiente.mjs impede um build de preview da Vercel de sair apontando para a produção.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || URL_PRODUCAO;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || CHAVE_PRODUCAO;
export const AMBIENTE_ENSAIO = SUPABASE_URL !== URL_PRODUCAO;

// O cliente principal só lê sessão que chegue pela URL (link de recuperação de senha) quando o login das joiners está LIGADO (VITE_JOINERS_AUTH=true).
// Com a chave desligada nada muda para o site; a página /piloto-senha/ usa um cliente próprio e lê o link por conta própria.
const LER_SESSAO_NA_URL = import.meta.env.VITE_JOINERS_AUTH === "true";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { detectSessionInUrl: LER_SESSAO_NA_URL } });

export default supabase;
