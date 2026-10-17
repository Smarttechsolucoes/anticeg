// Login de administrador com Supabase Auth: e-mail e senha da conta de admin.
// Usa um cliente SEPARADO (storageKey próprio): o site das joiners continua com o cliente anônimo de sempre, sem nenhuma mudança.
// A decisão de quem é admin NÃO é do navegador: o banco responde por public.is_admin() (conta cadastrada em admin_roles).
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase.js";

// Ligado por padrão: o painel de admin só abre depois do login (e o PIN antigo deixa de existir).
// Para desligar em emergência, defina VITE_ADMIN_AUTH_OBRIGATORIA=false no ambiente do build (Vercel).
export const ADMIN_AUTH_OBRIGATORIA = import.meta.env.VITE_ADMIN_AUTH_OBRIGATORIA !== "false";

let _cliente = null;
export function clienteAdmin() {
  if (!_cliente) {
    _cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storageKey: "anticeg-admin-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return _cliente;
}

export { criarAdminAuth } from "./adminAuthNucleo.js";
