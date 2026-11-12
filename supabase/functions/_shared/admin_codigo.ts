// "ENVIAR CÓDIGO" do painel (Admin → Contas): a administradora força o envio do código de ativação para o e-mail QUE ESTÁ NO CADASTRO.
// SEM Deno, rede ou banco reais (tudo entra por "deps"; testável). O que este botão NUNCA faz:
//   * enviar para um e-mail diferente do cadastrado (para mudar o e-mail, use "Atualizar dados" antes);
//   * enviar para quem já tem conta (nesse caso o caminho é recuperar a senha);
//   * enviar para cadastro bloqueado, sem e-mail válido ou com e-mail repartido entre cadastros (conflito: a administradora decide antes);
//   * funcionar sem login de administradora (a conferência usa o login de quem chamou, no servidor).
// Ele PULA só as travas "aguardando liberação" e "comprovar" da ativação automática, e avisa quando a ativação ainda ficará pendente.
import { emailValido } from "./ativacao.ts";

export interface JoinerAdminCodigo { id: number; cog: string; email: string | null; bloqueado: boolean | null }
export interface DbAdminCodigo {
  ehAdmin(): Promise<boolean>;                                    // conferido com o login de QUEM CHAMOU (nunca com a chave de serviço)
  quem(): Promise<string | null>;                                 // id do usuário que chamou (para o registro)
  joinerPorId(id: number): Promise<JoinerAdminCodigo | null>;
  quantasComEmail(email: string): Promise<number>;
  jaVinculada(joinerId: number): Promise<boolean>;
  liberada(joinerId: number): Promise<boolean>;
  vinculoConfiavel(joinerId: number): Promise<boolean>;
  auditar(joinerId: number, detalhe: Record<string, unknown>): Promise<void>;   // se falhar, NADA é enviado
}
export interface RedeAdminCodigo {
  garantirUsuario(email: string): Promise<void>;
  enviarCodigo(email: string): Promise<void>;
}
export interface ResultadoAdminCodigo { status: number; corpo: Record<string, unknown> }

export type MotivoRecusa = "sem_email" | "bloqueado" | "email_compartilhado" | "ja_tem_conta";
const MENSAGENS: Record<MotivoRecusa, string> = {
  sem_email: "O cadastro não tem e-mail válido. Use “Atualizar dados” para corrigir e tente de novo.",
  bloqueado: "O cadastro está bloqueado. Nada foi enviado.",
  email_compartilhado: "O e-mail do cadastro é compartilhado com outro cadastro. Decida de quem é antes de enviar (nada foi enviado).",
  ja_tem_conta: "Esta pessoa já tem conta. Use “Esqueci minha senha” (ou peça a ela) em vez de código de ativação.",
};
const recusa = (motivo: MotivoRecusa): ResultadoAdminCodigo => ({ status: 409, corpo: { error: MENSAGENS[motivo], motivo } });
const dominioDe = (email: string) => (email.split("@")[1] || "").toLowerCase();

export async function processarEnvioAdmin(entrada: unknown, db: DbAdminCodigo, rede: RedeAdminCodigo): Promise<ResultadoAdminCodigo> {
  // 1) só administradora; qualquer outra pessoa recebe a mesma recusa, antes de qualquer consulta ao cadastro
  if (!(await db.ehAdmin())) return { status: 403, corpo: { error: "somente a administração" } };
  const e = entrada as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || Array.isArray(e) || Object.keys(e).some(k => k !== "joiner_id") || !Number.isSafeInteger(e.joiner_id) || (e.joiner_id as number) <= 0) return { status: 400, corpo: { error: "pedido inválido" } };
  const id = e.joiner_id as number;

  const j = await db.joinerPorId(id);
  if (!j) return { status: 404, corpo: { error: "cadastro não encontrado" } };
  const email = String(j.email ?? "").trim().toLowerCase();
  if (!emailValido(email)) return recusa("sem_email");
  if (j.bloqueado) return recusa("bloqueado");
  if ((await db.quantasComEmail(email)) !== 1) return recusa("email_compartilhado");
  if (await db.jaVinculada(id)) return recusa("ja_tem_conta");

  // o que ainda vai segurar a ATIVAÇÃO (o código chega, mas ativar_minha_conta pode responder "pendente"): a administradora é avisada
  const avisos: string[] = [];
  if (!(await db.liberada(id))) avisos.push("A ativação deste cadastro ainda não foi liberada: o código chega, mas a conta fica aguardando liberação.");
  if (!(await db.vinculoConfiavel(id))) avisos.push("O e-mail ou o @ foi alterado depois da fotografia confiável: o código chega, mas a ativação fica pendente até você usar “Confirmar vínculo” (depois de confirmar a pessoa por outro canal).");

  // 2) registro ANTES do envio: sem registro, sem envio
  await db.auditar(id, { acao: "enviar_codigo_admin", por: await db.quem(), dominio: dominioDe(email), avisos: avisos.length });
  try { await rede.garantirUsuario(email); await rede.enviarCodigo(email); }
  catch (err) { console.error("admin-enviar-codigo", err instanceof Error ? err.message : err); return { status: 502, corpo: { error: "O envio falhou (o serviço de e-mail recusou). Nada chegou à pessoa; tente de novo em alguns minutos.", motivo: "envio_falhou" } }; }
  return { status: 200, corpo: { ok: true, dominio: dominioDe(email), avisos } };
}
