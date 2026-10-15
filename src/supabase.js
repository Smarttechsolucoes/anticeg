import { createClient } from "@supabase/supabase-js";

// chave pública (anon): é a mesma que o navegador já usa; o acesso real é decidido pelas policies do banco
export const SUPABASE_URL = "https://ghjfsmwwcfpfvrouyrka.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM";

// O cliente principal só lê sessão que chegue pela URL (link de recuperação de senha) quando o login das joiners está LIGADO (VITE_JOINERS_AUTH=true).
// Com a chave desligada nada muda para o site; a página /piloto-senha/ usa um cliente próprio e lê o link por conta própria.
const LER_SESSAO_NA_URL = import.meta.env.VITE_JOINERS_AUTH === "true";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { detectSessionInUrl: LER_SESSAO_NA_URL } });

export default supabase;
