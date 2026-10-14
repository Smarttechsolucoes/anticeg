import { useState, useEffect } from "react";
import { JOINERS_AUTH_ATIVO, criarJoinerAuth, buscarAcessoSimples, emailValido, mascararEmail, normalizarCog, validarSenha, SENHA_MIN } from "./joinerAuth.js";
import supabase from "./supabase.js";

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

function JoinerAtivacaoModal({ user, api, onFechar, liberada = user?.ativacao_liberada !== false }) {
  const [fase, setFase] = useState(liberada ? "dados" : "aguardando");           // dados | codigo | ok | pendente | regularizar | aguardando (ativação ainda não liberada para o grupo dela)
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
    setFase(r.resultado === "ok" ? "ok" : r.resultado === "aguardando" ? "aguardando" : "pendente");
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
            <button type="button" style={{ ...botaoSec, fontSize: 11 }} onClick={continuarLimitado}>Agora não: continuar só com o @</button>
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
        {fase === "aguardando" && (
          <div data-testid="ativacao-aguardando" style={{ display: "grid", gap: 12 }}>
            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.destaque }}>Sua ativação será liberada em breve</div>
            <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>Estamos liberando a criação de senha aos poucos, em grupos. Quando chegar a sua vez você será avisada pela administração. Enquanto isso você continua navegando só com o @ (calendário, regras e CEGs). Seus pedidos, claims e histórico continuam guardados no seu @ e nada se perde.</div>
            <button style={botao} onClick={continuarLimitado}>Entendi, continuar só com o @</button>
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
  const [liberada, setLiberada] = useState(user?.ativacao_liberada !== false);

  useEffect(() => {
    let vivo = true;
    if (!user?.cog) return undefined;
    api.estado(user.cog).then(async r => {
      if (!vivo) return;
      if (r.estado === "ativa") { setAberto(false); return; }
      // a liberação pode ter mudado desde que o @ foi digitado: confere no servidor (só o @, sem dado pessoal)
      const acesso = await buscarAcessoSimples(user.cog).catch(() => null);
      const lib = acesso ? acesso.ativacao_liberada !== false : user?.ativacao_liberada !== false;
      if (vivo) { setLiberada(lib); setAberto(lib); }      // quem ainda não foi liberada não recebe o pop-up sozinho
    }).catch(() => { if (vivo) setAberto(true); });
    return () => { vivo = false; };
  }, [api, user?.cog]);

  // "Primeiro acesso? Ative sua conta" na tela de senha reabre este pop-up
  useEffect(() => {
    const abrir = () => { try { sessionStorage.removeItem(DISPENSA); } catch { /* sem armazenamento */ } setDispensado(false); setAberto(true); };
    window.addEventListener("anticeg:abrir-ativacao", abrir);
    return () => window.removeEventListener("anticeg:abrir-ativacao", abrir);
  }, []);

  if (!aberto || dispensado) return null;
  return <JoinerAtivacaoModal user={user} api={api} liberada={liberada} onFechar={concluida => { setAberto(false); if (!concluida) setDispensado(true); }} />;
}

// ── nível de acesso: simples (só @) ou completo (@ + senha, conta ativada) ───────────────────────
function useNivelAcesso(user) {
  const [api] = useState(() => criarJoinerAuth());
  const [nivel, setNivel] = useState("carregando");
  useEffect(() => {
    let vivo = true;
    const atualizar = () => api.estado(user?.cog).then(r => { if (vivo) setNivel(r.estado === "ativa" ? "completo" : "simples"); }).catch(() => { if (vivo) setNivel("simples"); });
    atualizar();
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(atualizar, 0); });
    return () => { vivo = false; data?.subscription?.unsubscribe(); };
  }, [api, user?.cog]);
  return { api, nivel };
}

function PromptSenha({ user, api, onSemConta }) {
  const [modo, setModo] = useState("arroba");       // arroba | email | recuperar
  const [senha, setSenha] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const cog = normalizarCog(user?.cog);

  async function entrar(e) {
    e.preventDefault(); setErro(""); setInfo(""); setOcupado(true);
    const r = modo === "email" ? await api.entrarComEmail({ cog, email, senha }) : await api.entrar({ cog, senha });
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setSenha("");      // a área aparece sozinha: o nível de acesso é recalculado pela mudança de sessão
  }
  async function recuperar(e) {
    e.preventDefault(); setErro(""); setInfo(""); setOcupado(true);
    const r = await api.recuperar({ cog });
    setOcupado(false);
    if (r.erro) setErro(r.erro); else setInfo("Se existir uma conta ativada para esse @, enviamos um link para o e-mail verificado. Confira também o spam.");
  }

  return (
    <div data-testid="area-protegida" style={{ maxWidth: 420, margin: "32px auto", padding: "0 16px", boxSizing: "border-box" }}>
      <div style={{ background: C.bg, border: `1px solid ${C.borda}`, borderRadius: 14, padding: "22px 20px", color: C.texto, display: "grid", gap: 12 }}>
        <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.destaque }}>🔒 Área protegida</div>
        <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>Esta área tem informações pessoais e só abre com a sua senha. Você pode continuar navegando nas áreas públicas.</div>
        {modo !== "recuperar" ? (
          <form onSubmit={entrar} noValidate style={{ display: "grid", gap: 10 }}>
            {modo === "arroba"
              ? <Rotulo>Seu @<input style={{ ...campo, opacity: 0.8 }} value={"@" + cog} readOnly aria-label="Seu @" /></Rotulo>
              : <Rotulo>E-mail da conta<input style={campo} type="email" value={email} onChange={ev => setEmail(ev.target.value)} aria-label="E-mail da conta" autoComplete="username" /></Rotulo>}
            <Rotulo>Senha<input style={campo} type="password" value={senha} onChange={ev => setSenha(ev.target.value)} aria-label="Senha" autoComplete="current-password" /></Rotulo>
            <Aviso texto={erro} />
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Entrando…" : "Entrar"}</button>
            <button type="button" style={{ ...botaoSec, fontSize: 11 }} onClick={() => { setErro(""); setModo(modo === "arroba" ? "email" : "arroba"); }}>{modo === "arroba" ? "Entrar com e-mail e senha" : "Entrar com @ e senha"}</button>
          </form>
        ) : (
          <form onSubmit={recuperar} style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>Vamos enviar um link para redefinir a senha no e-mail verificado da conta de <b style={{ color: C.texto }}>@{cog}</b>.</div>
            <Aviso texto={erro} />
            {info && <div role="status" style={{ color: C.ok, fontSize: 12, fontFamily: mono }}>{info}</div>}
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar link de redefinição"}</button>
            <button type="button" style={{ ...botaoSec, fontSize: 11 }} onClick={() => { setErro(""); setInfo(""); setModo("arroba"); }}>Voltar</button>
          </form>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {modo !== "recuperar" && <button type="button" style={{ ...botaoSec, fontSize: 11, flex: 1 }} onClick={() => { setErro(""); setInfo(""); setModo("recuperar"); }}>Esqueci minha senha</button>}
          <button type="button" style={{ ...botaoSec, fontSize: 11, flex: 1 }} onClick={onSemConta}>Primeiro acesso? Ative sua conta</button>
        </div>
      </div>
    </div>
  );
}

// Envolve uma área privada: sem conta ativada e senha, mostra o pedido de senha em vez do conteúdo. Depois de entrar, o conteúdo aparece no mesmo endereço.
export function AreaProtegida({ user, area, children, onLogin, onCompleto }) {   // "area" só para o rastreio do destino
  const { api, nivel } = useNivelAcesso(user);
  useEffect(() => { if (nivel === "completo" && user?.acesso_simples && onCompleto) onCompleto(); }, [nivel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { sessionStorage.setItem("anticeg_destino", window.location.pathname + window.location.search); } catch { /* sem armazenamento */ } }, [area]);
  if (nivel === "completo") return children;
  if (nivel === "carregando") return <div data-testid="area-verificando" style={{ padding: 32, textAlign: "center", color: C.mudo, fontFamily: mono, fontSize: 12 }}>Verificando acesso…</div>;
  if (!user || user.guest || !user.cog) {
    return (
      <div data-testid="area-protegida" style={{ maxWidth: 420, margin: "32px auto", padding: "0 16px", boxSizing: "border-box" }}>
        <div style={{ background: C.bg, border: `1px solid ${C.borda}`, borderRadius: 14, padding: "22px 20px", color: C.texto, display: "grid", gap: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.destaque }}>🔒 Área protegida</div>
          <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>Entre com o seu @ para continuar.</div>
          {onLogin && <button style={botao} onClick={onLogin}>Entrar</button>}
        </div>
      </div>
    );
  }
  return <PromptSenha user={user} api={api} onSemConta={() => window.dispatchEvent(new Event("anticeg:abrir-ativacao"))} />;
}

// Depois do link de "esqueci minha senha": o Supabase abre a sessão de recuperação e o site pede a senha nova.
export function RecuperacaoSenhaGate() {
  const [api] = useState(() => criarJoinerAuth());
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(evento => { if (evento === "PASSWORD_RECOVERY") setAberto(true); });
    return () => data?.subscription?.unsubscribe();
  }, []);

  async function salvar(e) {
    e.preventDefault(); setErro(""); setOcupado(true);
    const r = await api.trocarSenha(senha, repetir);
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setFeito(true);
  }
  function concluir() {
    let destino = "/masterlist";
    try { destino = sessionStorage.getItem("anticeg_destino") || destino; } catch { /* sem armazenamento */ }
    setAberto(false);
    window.location.assign(destino.startsWith("/") && !destino.startsWith("//") ? destino : "/masterlist");
  }

  if (!aberto) return null;
  return (
    <div data-testid="recuperacao-modal" role="dialog" aria-modal="true" aria-label="Definir nova senha"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, padding: 16 }}>
      <div style={{ background: C.bg, border: `1px solid ${C.borda}`, borderRadius: 14, padding: "24px 22px", width: "min(420px, 100%)", color: C.texto, display: "grid", gap: 12, boxSizing: "border-box" }}>
        {!feito ? (
          <form onSubmit={salvar} noValidate style={{ display: "grid", gap: 10 }}>
            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.destaque }}>Defina a sua nova senha</div>
            <Rotulo>Nova senha (mínimo {SENHA_MIN} caracteres)<input style={campo} type="password" value={senha} onChange={ev => setSenha(ev.target.value)} aria-label="Nova senha" autoComplete="new-password" /></Rotulo>
            <Rotulo>Repita a nova senha<input style={campo} type="password" value={repetir} onChange={ev => setRepetir(ev.target.value)} aria-label="Repita a nova senha" autoComplete="new-password" /></Rotulo>
            <Aviso texto={erro} />
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar nova senha"}</button>
          </form>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.ok }}>✓ Senha alterada</div>
            <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>Pronto! Você já pode usar a nova senha.</div>
            <button style={botao} onClick={concluir}>Continuar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Cartão "Segurança" do perfil: troca de senha de quem já está com a conta ativada
export function TrocarSenhaJoiner({ user }) {
  const { api, nivel } = useNivelAcesso(user);
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  if (nivel !== "completo") return null;

  async function salvar(e) {
    e.preventDefault(); setErro(""); setFeito(false); setOcupado(true);
    const r = await api.trocarSenha(senha, repetir, { cog: user?.cog });
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setFeito(true); setSenha(""); setRepetir("");
  }
  return (
    <div data-testid="trocar-senha-joiner" style={{ margin: "0 0 14px", padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.borda}`, background: C.bg, color: C.texto, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontFamily: mono, fontSize: 12, color: C.ok }}>🔒 Conta protegida por senha</span>
        <button style={{ ...botaoSec, width: "auto", padding: "5px 12px", fontSize: 11, marginLeft: "auto" }} onClick={() => { setAberto(v => !v); setFeito(false); setErro(""); }}>Trocar minha senha</button>
      </div>
      {aberto && (
        <form onSubmit={salvar} noValidate style={{ display: "grid", gap: 8 }}>
          <input style={campo} type="password" value={senha} onChange={ev => setSenha(ev.target.value)} placeholder={`nova senha (mínimo ${SENHA_MIN} caracteres)`} aria-label="Nova senha" autoComplete="new-password" />
          <input style={campo} type="password" value={repetir} onChange={ev => setRepetir(ev.target.value)} placeholder="repita a nova senha" aria-label="Repita a nova senha" autoComplete="new-password" />
          <Aviso texto={erro} />
          {feito && <div role="status" style={{ color: C.ok, fontSize: 12, fontFamily: mono }}>Senha alterada.</div>}
          <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar nova senha"}</button>
        </form>
      )}
    </div>
  );
}

// D2: páginas de pedido (pré-vendas, revista, W Magazine, Smol Merch...) só abrem para conta ATIVADA e vinculada. Com o login novo desligado não muda nada.
// Enviar comprovante e criar pedido também são recusados pelo servidor sem conta; esta tela só evita o pedido incompleto.
export function ExigeContaAtiva({ children }) {
  const [api] = useState(() => criarJoinerAuth());
  const [estado, setEstado] = useState(JOINERS_AUTH_ATIVO ? "carregando" : "ativa");
  useEffect(() => {
    if (!JOINERS_AUTH_ATIVO) return undefined;
    let vivo = true;
    const atualizar = () => api.estado().then(r => { if (vivo) setEstado(r.estado === "ativa" ? "ativa" : "bloqueada"); }).catch(() => { if (vivo) setEstado("bloqueada"); });
    atualizar();
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(atualizar, 0); });
    return () => { vivo = false; data?.subscription?.unsubscribe(); };
  }, [api]);
  if (estado === "ativa") return children;
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #131310)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div data-testid="exige-conta" style={{ background: C.bg, border: `1px solid ${C.borda}`, borderRadius: 14, padding: "26px 22px", width: "min(420px, 100%)", color: C.texto, display: "grid", gap: 12, textAlign: "center" }}>
        {estado === "carregando" ? <div style={{ fontFamily: mono, fontSize: 12, color: C.mudo }}>carregando…</div> : (<>
          <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.destaque }}>🔒 Entre na sua conta para fazer o pedido</div>
          <div style={{ fontSize: 12, color: C.mudo, lineHeight: 1.6 }}>Pedidos e comprovantes agora são feitos com a sua conta ativada, para ficarem ligados ao seu cadastro e só você e a administração os verem. Entre com o seu @ e a sua senha; se ainda não ativou, a ativação aparece depois que você entra com o @. Nada do que já foi pedido se perde.</div>
          <button style={botao} onClick={() => { window.location.href = "/"; }}>Ir para a entrada do site</button>
        </>)}
      </div>
    </div>
  );
}
