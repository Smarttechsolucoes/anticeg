import { useState } from "react";
import { emailValido } from "./joinerAuth.js";

// ETAPA 1 do cadastro (lado da joiner). Interruptor em cadastroEtapa1.js: VITE_CADASTRO_ETAPA1=1 só DEPOIS de o SQL E1 estar aplicado e validado.
//   Ligado: o nome cadastral é editável e só mostra "Salvo no site" quando o banco CONFIRMA; e-mail e @ deixam de ser gravados direto pelo navegador:
//   conta ativada troca o e-mail pelo link do Auth e pede a troca de @ à administração; o login legado (sem sessão) envia um pedido ("Alteração solicitada").

const mono = "'DM Mono',monospace";
const campo = { width: "100%", marginTop: 6 };

/** Pedido de alteração do cadastro. conta = login completo (sessão do Supabase); false = login legado (só @). */
export function PedidoAlteracaoCadastro({ user, conta, api, onFechar }) {
  const [qual, setQual] = useState(conta ? "email" : "nome");   // nome (só legado: a conta edita o nome direto) | arroba | email
  const [valor, setValor] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(null);                     // { id, texto }

  async function enviar(e) {
    e?.preventDefault?.(); setErro(""); setFeito(null);
    const v = String(valor).trim();
    if (!v) { setErro("Digite o valor correto."); return; }
    if (qual === "email" && !emailValido(v)) { setErro("Digite um e-mail válido."); return; }
    setOcupado(true);
    let r;
    if (conta && qual === "email") r = await api.trocarEmail(v);
    else if (conta) r = await api.solicitarCorrecao({ tipo: "arroba", valor: v, mensagem });
    else r = await api.solicitarSemLogin({ cog: user.cog, campo: qual, valor: v, mensagem });
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setFeito(conta && qual === "email"
      ? { id: "cadastro-email-link-enviado", texto: "Enviamos um link de confirmação para o endereço novo. O cadastro só muda depois que você confirmar; até lá o e-mail atual continua valendo." }
      : { id: "cadastro-alteracao-solicitada", texto: "Alteração solicitada. A administração confere antes de mudar qualquer coisa no seu cadastro." });
    setValor(""); setMensagem("");
  }

  return (
    <form onSubmit={enviar} data-testid="cadastro-pedido" style={{ background: "rgba(245,240,232,.04)", border: "1px solid rgba(245,240,232,.12)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.6)", textTransform: "uppercase", letterSpacing: ".08em" }}>{conta ? "Trocar e-mail ou @" : "Pedir alteração do cadastro"}</div>
      <div>
        <label className="login-label">O que mudou?</label>
        <select className="login-input" style={campo} value={qual} onChange={e => { setQual(e.target.value); setErro(""); setFeito(null); }} data-testid="cadastro-pedido-campo">
          {!conta && <option value="nome">Nome cadastral</option>}
          <option value="arroba">Meu @</option>
          <option value="email">Meu e-mail</option>
        </select>
      </div>
      <div>
        <label className="login-label">{qual === "email" ? "E-mail novo" : qual === "arroba" ? "@ correto" : "Nome correto"}</label>
        <input className="login-input" style={campo} type={qual === "email" ? "email" : "text"} value={valor} onChange={e => setValor(e.target.value)} data-testid="cadastro-pedido-valor" />
      </div>
      {!(conta && qual === "email") && (
        <div>
          <label className="login-label">Mensagem para a administração (opcional)</label>
          <textarea className="login-input" style={{ ...campo, minHeight: 60 }} maxLength={500} value={mensagem} onChange={e => setMensagem(e.target.value)} />
        </div>
      )}
      {erro && <div className="login-error" data-testid="cadastro-pedido-erro">{erro}</div>}
      {feito && <div data-testid={feito.id} role="status" style={{ fontSize: 13, color: "var(--verde)", padding: "8px 12px", background: "rgba(186,255,57,.08)", border: "1px solid rgba(186,255,57,.2)", borderRadius: 6 }}>{feito.texto}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" className="login-btn" disabled={ocupado} data-testid="cadastro-pedido-enviar">{ocupado ? "ENVIANDO..." : conta && qual === "email" ? "ENVIAR LINK DE CONFIRMAÇÃO" : "PEDIR ALTERAÇÃO"}</button>
        <button type="button" onClick={onFechar} style={{ background: "transparent", color: "rgba(245,240,232,.6)", border: "1px solid rgba(245,240,232,.15)", borderRadius: 6, padding: "8px 14px", fontFamily: mono, fontSize: 11, cursor: "pointer" }}>fechar</button>
      </div>
    </form>
  );
}

/** Para o LOGIN LEGADO (só @, sem sessão), na tela de bloqueio das áreas protegidas: o pedido de alteração fica ao alcance de quem não consegue editar o cadastro. */
export function PedidoLegadoNoPortao({ user, api }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ maxWidth: 420, margin: "0 auto 32px", padding: "0 16px", boxSizing: "border-box" }}>
      {!aberto
        ? <button type="button" data-testid="portao-abrir-pedido" onClick={() => setAberto(true)} style={{ background: "none", border: "none", color: "rgba(245,240,232,.6)", textDecoration: "underline", cursor: "pointer", fontFamily: mono, fontSize: 12, padding: "8px 0" }}>Preciso corrigir meu nome, @ ou e-mail do cadastro</button>
        : <PedidoAlteracaoCadastro user={user} conta={false} api={api} onFechar={() => setAberto(false)} />}
    </div>
  );
}
