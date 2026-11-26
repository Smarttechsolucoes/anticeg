// Fila de saída do PERFIL para a planilha (e-mail verificado -> aba Dados), SEM Deno, rede ou banco reais (tudo entra por "deps"; testável).
// Quem pode chamar: a administradora (login) ou o servidor (chave de serviço, p.ex. o job do sync). Nunca o visitante nem uma conta comum.
// Cada item é IDEMPOTENTE (o Apps Script grava o mesmo e-mail de novo sem duplicar nada) e uma falha NÃO se perde: fica registrada e é tentada de novo (espera crescente, no máximo 6 tentativas) ou reprocessada pela administração.
import { cabecalhosCors } from "./handlers.ts";
import { identificarChamada } from "./notificacoes.ts";

export interface ItemPerfil { id: number; joiner_id: number; tipo: string; dados: { twitter?: string; email_novo?: string; tarefa_id?: number }; tentativas: number }
/** Estado atual do cadastro que a tarefa leva à planilha (vem de public.perfil_sync_estado). A versão é o número da tarefa. */
export interface EstadoCadastro { id_site: number; twitter: string | null; nome: string | null; email: string | null; versao: number; campos: string[] }
export interface DepsPerfilSync {
  env: (nome: string) => string | undefined;
  resolverToken: (token: string) => Promise<{ admin: boolean; cog: string | null }>;
  proximos: (limite: number) => Promise<ItemPerfil[]>;
  /** definitivo = falha que não se resolve tentando de novo (linha não encontrada, ambígua, duplicada...): a tarefa vai direto a "precisa de atenção". */
  marcar: (id: number, ok: boolean, erro: string | null, definitivo?: boolean) => Promise<void>;
  planilha: (url: string, corpo: Record<string, unknown>) => Promise<{ status: number; json: unknown }>;
  /** Tarefas de cadastro: lê o estado atual (nome/e-mail) no banco. Opcional para a fila antiga de e-mail. */
  estado?: (tarefaId: number) => Promise<EstadoCadastro | null>;
}
const ORIGENS_PADRAO = "https://anticeg.vercel.app,http://localhost:5173,http://localhost:5199,http://localhost:5197";

/** Devolve só CONTAGENS (nunca o token, a URL ou dados pessoais). */
export async function processarFila(deps: DepsPerfilSync, limite = 10): Promise<{ lidos: number; enviados: number; falharam: number; parou: boolean }> {
  const url = deps.env("PLANILHA_URL"), segredo = deps.env("PLANILHA_TOKEN");
  if (!url || !segredo) throw new Error("planilha não configurada");
  const itens = await deps.proximos(limite);
  let enviados = 0, falharam = 0, seguidas = 0, parou = false;
  for (const it of itens) {
    if (seguidas >= 3) { parou = true; break; }                       // a planilha está fora do ar: não insiste
    try {
      if (it.tipo === "cadastro") {
        // tarefa de cadastro: envia o ESTADO atual (nome/e-mail) com a versão da tarefa; o Apps Script ignora versão antiga e responde se a falha é definitiva
        const tarefaId = it.dados?.tarefa_id;
        const est = typeof tarefaId === "number" && deps.estado ? await deps.estado(tarefaId) : null;
        if (!est) { await deps.marcar(it.id, false, "tarefa_nao_encontrada: a tarefa deste item não existe mais", true); falharam++; continue; }
        const r = await deps.planilha(url, { acao: "atualizar_cadastro", token: segredo, id_site: est.id_site, twitter: est.twitter, nome: est.nome, email: est.email, versao: est.versao, campos: est.campos });
        const j = (r.json ?? {}) as Record<string, unknown>;
        if (r.status >= 200 && r.status < 300 && j.ok === true) { await deps.marcar(it.id, true, null, false); enviados++; seguidas = 0; continue; }
        const texto = (typeof j.erro === "string" ? j.erro : `resposta inesperada (HTTP ${r.status})`).replaceAll(segredo, "[oculto]");
        const definitivo = j.definitivo === true && typeof j.motivo === "string";   // só o Apps Script, que leu a planilha, decide que não adianta tentar de novo
        await deps.marcar(it.id, false, definitivo ? `${String(j.motivo).replace(/[^a-z0-9_]/gi, "").slice(0, 60)}: ${texto}` : texto, definitivo);
        falharam++; if (!definitivo) seguidas++;                       // falha definitiva é do item, não da planilha: não conta para "planilha fora do ar"
        continue;
      }
      if (it.tipo !== "email" || !it.dados?.twitter || !it.dados?.email_novo) throw new Error("item inválido");
      const r = await deps.planilha(url, { acao: "atualizar_joiner", token: segredo, twitter_antigo: it.dados.twitter, email_novo: it.dados.email_novo });
      const j = (r.json ?? {}) as Record<string, unknown>;
      if (r.status >= 200 && r.status < 300 && j.ok === true) { await deps.marcar(it.id, true, null); enviados++; seguidas = 0; }
      else { const msg = typeof j.erro === "string" ? j.erro : `resposta inesperada (HTTP ${r.status})`; await deps.marcar(it.id, false, msg.replaceAll(segredo, "[oculto]")); falharam++; seguidas++; }
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err).replaceAll(segredo, "[oculto]");
      try { await deps.marcar(it.id, false, msg); } catch { /* o item continua pendente */ }
      falharam++; seguidas++;
    }
  }
  return { lidos: itens.length, enviados, falharam, parou };
}

function iguaisSemPressa(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
/** Agendador (Apps Script, a cada minuto): segredo próprio em x-cron-secret (segredo PERFIL_SYNC_SEGREDO da função, mínimo 24 caracteres). Só autoriza processar a fila; a resposta traz só contagens. */
export function chamadaPorSegredo(req: Request, deps: DepsPerfilSync): boolean {
  const esperado = deps.env("PERFIL_SYNC_SEGREDO") ?? "", recebido = req.headers.get("x-cron-secret") ?? "";
  return esperado.length >= 24 && recebido.length > 0 && iguaisSemPressa(esperado, recebido);
}

export async function tratarPerfilSync(req: Request, deps: DepsPerfilSync): Promise<Response> {
  const cors = cabecalhosCors(req.headers.get("origin"), deps.env("ALLOWED_ORIGINS") ?? ORIGENS_PADRAO);
  const responder = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder(405, { error: "método não permitido" });
  try {
    if (!chamadaPorSegredo(req, deps)) {
      const chamada = await identificarChamada(req.headers.get("authorization"), deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "", deps.resolverToken);
      if (chamada.quem !== "admin" && chamada.quem !== "servico") return responder(403, { error: "somente a administração" });
    }
    return responder(200, await processarFila(deps));
  } catch (err) {
    console.error("perfil-sync", err instanceof Error ? err.message : err);
    return responder(500, { error: "erro interno" });
  }
}
