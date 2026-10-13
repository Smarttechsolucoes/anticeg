// DESCONTINUADA: esta função aceitava qualquer inscrição, título e texto enviados por qualquer visitante.
// Foi substituída por push-evento. Este arquivo existe só para fechar a brecha quando a função for reimplantada.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
serve(() => new Response(JSON.stringify({ error: "função descontinuada" }), { status: 410, headers: { "Content-Type": "application/json" } }));
