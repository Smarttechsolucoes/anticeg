// DESCONTINUADA: esta função aceitava destinatário, assunto e corpo escolhidos por qualquer visitante.
// Foi substituída por email-evento. Este arquivo existe só para fechar a brecha quando a função for reimplantada.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
serve(() => new Response(JSON.stringify({ error: "função descontinuada" }), { status: 410, headers: { "Content-Type": "application/json" } }));
