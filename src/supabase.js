import { createClient } from "@supabase/supabase-js";

// chave pública (anon): é a mesma que o navegador já usa; o acesso real é decidido pelas policies do banco
export const SUPABASE_URL = "https://ghjfsmwwcfpfvrouyrka.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamZzbXd3Y2ZwZnZyb3V5cmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMwNDQsImV4cCI6MjA4ODc0OTA0NH0._vfkICuqFw6vhbhIwL_mfDR0QB9p7CXe6Bgac22qZqM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
