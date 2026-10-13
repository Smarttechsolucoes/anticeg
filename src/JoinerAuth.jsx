import { useState, useEffect } from "react";
import { criarJoinerAuth, emailValido, mascararEmail, normalizarCog, validarSenha, SENHA_MIN } from "./joinerAuth.js";

const C = { bg: "#17141f", borda: "rgba(245,240,232,0.14)", texto: "#F5F0E8", mudo: "rgba(245,240,232,0.62)", destaque: "#BAFF39", erro: "#FF8A80", ok: "#7CE08A" };
const mono = "'DM Mono',monospace";
const campo = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borda}`, background: "rgba(0,0,0,0.25)", color: C.texto, fontSize: 14, fontFamily: mono };
const botao = { padding: "11px 16px", borderRadius: 8, border: "none", background: C.destaque, color: "#111", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: mono, width: "100%" };
const botaoSec = { ...botao, background: "transparent", color: C.texto, border: `1px solid ${C.borda}`, fontWeight: 500 };
const DISPENSA = "anticeg_ativacao_dispensada";

function Aviso({ texto }) {
  return texto ? <div role="alert" style={{ color: C.erro, fontSize: 12, fontFamily: mono, margin: "2px 0" }}>{texto}</div> : null;
}
function Rotulo({ children }) {
  return <label style={{ display: "grid", gap: 4, fontSize: 11, color: C.mudo, fontFamily: mono }}>{children}</label>;
}

function JoinerAtivacaoModal({ user, api, onFechar }) {
  const [fase, setFase] = useState("dados");           // dados | codigo | ok | pendente | regularizar
  const [cog, setCog] = useState(normalizarCog(user?.cog));
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function enviarCodigo(e) {
    if (e) e.preventDefault();
    setErro("");
    if (!normalizarCog(cog)) { setErro("Confirme o seu @."); return; }
    if (!emailValido(email)) { setErro("Digite um e-mail válido."); return; }
    const msgSenha = validarSenha(senha, repetir, { cog, email });
    if (msgSenha) { setErro(msgSenha); return; }
    setOcupado(true);
    const r = await api.pedirCodigo({ cog, email });
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setCodigo(""); setEspera(60); setFase("codigo");
  }
  async function reenviar() {
    if (espera > 0 || ocupado) return;
    setErro(""); setOcupado(true);
    const r = await api.pedirCodigo({ cog, email });
    setOcupado(false);
    if (r.erro) setErro(r.erro); else setEspera(60);
  }
  async function confirmarCodigo(e) {
    e.preventDefault();
    setErro(""); setOcupado(true);
    const r = await api.confirmar({ cog, email, codigo, senha });
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setFase(r.resultado === "ok" ? "ok" : "pendente");
  }
  function continuarLimitado() {
    try { sessionStorage.setItem(DISPENSA, "1"); } catch { /* sem armazenamento: o aviso volta no próximo acesso */ }
    onFechar(false);
  }

  return (
    <div data-testid="ativacao-modal" role="dialog" aria-modal="true" aria-label="Atualização cadastral e segurança"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 16, overflowY: "auto" }}>
      <div style={{ background: C.bg, border: `1px solid ${C.borda}`, borderRadius: 14, padding: "24px 22px", width: "min(420px, 100%)", color: C.texto, display: "grid", gap: 12, boxSizing: "border-box" }}>
        {fase === "dados" && (
          <form onSubmit={enviarCodigo} noValidate style={{ display: "grid", gap: 10 }}>
            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.destaque }}>🔒 Atualização cadastral e segurança</div>
            <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>Agora o acesso aos seus dados, pedidos e pagamentos é protegido por senha. Seus pedidos, claims e histórico continuam exatamente como estão. Leva um minuto:</div>
            <Rotulo>Seu @ cadastrado<input style={campo} value={cog} onChange={ev => setCog(ev.target.value)} aria-label="Seu @ cadastrado" autoComplete="username" /></Rotulo>
            <Rotulo>E-mail do seu cadastro<input style={campo} type="email" value={email} onChange={ev => setEmail(ev.target.value)} aria-label="E-mail do cadastro" autoComplete="email" placeholder="o e-mail que você usou na Anti CEG" /></Rotulo>
            <Rotulo>Crie uma senha (mínimo {SENHA_MIN} caracteres)<input style={campo} type="password" value={senha} onChange={ev => setSenha(ev.target.value)} aria-label="Crie sua senha" autoComplete="new-password" /></Rotulo>
            <Rotulo>Repita a senha<input style={campo} type="password" value={repetir} onChange={ev => setRepetir(ev.target.value)} aria-label="Repita a senha" autoComplete="new-password" /></Rotulo>
            <Aviso texto={erro} />
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar código de confirmação"}</button>
            <button type="button" style={{ ...botaoSec, fontSize: 11 }} onClick={() => { setErro(""); setFase("regularizar"); }}>Meu e-mail não está no cadastro ou não lembro qual é</button>
          </form>
        )}
        {fase === "codigo" && (
          <form onSubmit={confirmarCodigo} style={{ display: "grid", gap: 10 }}>
            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.destaque }}>Confirme o seu e-mail</div>
            <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>Se os dados estiverem corretos, enviamos um código para <b style={{ color: C.texto }}>{mascararEmail(email)}</b>. Digite-o abaixo. Confira também a caixa de spam.</div>
            <input style={{ ...campo, letterSpacing: 4, textAlign: "center", fontSize: 18 }} inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="000000" value={codigo} onChange={ev => setCodigo(ev.target.value)} aria-label="Código de confirmação" />
            <Aviso texto={erro} />
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Conferindo…" : "Confirmar e ativar minha conta"}</button>
            <button type="button" style={{ ...botaoSec, fontSize: 11 }} onClick={reenviar} disabled={espera > 0 || ocupado}>{espera > 0 ? `Reenviar código em ${espera}s` : "Reenviar código"}</button>
            <button type="button" style={{ ...botaoSec, fontSize: 11 }} onClick={() => { setErro(""); setFase("dados"); }}>Voltar e corrigir os dados</button>
          </form>
        )}
        {fase === "ok" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.ok }}>✓ Conta ativada</div>
            <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>Pronto! Seu e-mail foi confirmado e a senha foi criada. Seus pedidos, claims e histórico continuam no seu @. Nas próximas vezes, entre com a sua senha para ver suas informações privadas.</div>
            <button style={botao} onClick={() => onFechar(true)}>Continuar</button>
          </div>
        )}
        {fase === "pendente" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.destaque }}>Falta só uma conferência</div>
            <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>Seu e-mail foi confirmado, mas não conseguimos ligar a conta ao seu cadastro automaticamente (por exemplo, o e-mail cadastrado é outro ou o cadastro está incompleto). <b style={{ color: C.texto }}>Nada se perdeu</b>: seu @, pedidos e histórico continuam guardados. Fale com a administração para regularizar. Enquanto isso você pode continuar navegando no modo limitado, sem acesso às informações privadas.</div>
            <button style={botao} onClick={continuarLimitado}>Continuar no modo limitado</button>
          </div>
        )}
        {fase === "regularizar" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.destaque }}>Vamos regularizar o seu cadastro</div>
            <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>Sem problema! Fale com a administração e informe o seu @ e o e-mail que você quer usar. Ninguém precisa criar outro cadastro: seus pedidos, claims e histórico ficam guardados no seu @. Enquanto isso você pode continuar navegando no modo limitado.</div>
            <button style={botao} onClick={continuarLimitado}>Continuar no modo limitado</button>
            <button style={botaoSec} onClick={() => { setErro(""); setFase("dados"); }}>Voltar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Pop-up obrigatório de primeiro acesso: aparece para quem entrou só com o @ e ainda não tem conta ativada.
// Não aparece para administradoras, visitantes (guest) nem pré-cadastros, e some quando a conta já está ativa.
export function JoinerAtivacaoGate({ user }) {
  const [api] = useState(() => criarJoinerAuth());
  const [aberto, setAberto] = useState(false);
  const [dispensado, setDispensado] = useState(() => { try { return sessionStorage.getItem(DISPENSA) === "1"; } catch { return false; } });

  useEffect(() => {
    let vivo = true;
    if (!user?.cog) return undefined;
    api.estado(user.cog).then(r => { if (vivo) setAberto(r.estado !== "ativa"); }).catch(() => { if (vivo) setAberto(true); });
    return () => { vivo = false; };
  }, [api, user?.cog]);

  if (!aberto || dispensado) return null;
  return <JoinerAtivacaoModal user={user} api={api} onFechar={concluida => { setAberto(false); if (!concluida) setDispensado(true); }} />;
}
