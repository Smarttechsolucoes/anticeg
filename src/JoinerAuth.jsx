import { useState, useEffect } from "react";
import { JOINERS_AUTH_ATIVO, criarJoinerAuth, buscarAcessoSimples, emailValido, mascararEmail, normalizarCog, validarSenha, SENHA_MIN } from "./joinerAuth.js";
import supabase from "./supabase.js";
import CompletarPerfil from "./CompletarPerfil.jsx";

const C = { bg: "#17141f", borda: "rgba(245,240,232,0.14)", texto: "#F5F0E8", mudo: "rgba(245,240,232,0.72)", destaque: "#BAFF39", erro: "#FF8A80", ok: "#7CE08A" };
const mono = "'DM Mono',monospace";
// Parágrafos, rótulos e campos usam a fonte sem serifa do site (mais legível); títulos e botões mantêm a fonte de código da identidade visual.
const sans = "var(--sans, system-ui, 'Segoe UI', Roboto, sans-serif)";
// fonte de 16px nos campos: o iOS amplia a tela quando o campo tem menos que isso
const campo = { width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 8, border: `1px solid ${C.borda}`, background: "rgba(0,0,0,0.25)", color: C.texto, fontSize: 16, fontFamily: sans };
const botao = { padding: "13px 16px", borderRadius: 8, border: "none", background: C.destaque, color: "#111", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: mono, width: "100%", minHeight: 46 };
const botaoSec = { ...botao, background: "transparent", color: C.texto, border: `1px solid ${C.borda}`, fontWeight: 500 };
// ação secundária: sem caixa, só texto sublinhado, com área de toque confortável
const acaoSec = { background: "none", border: "none", color: C.mudo, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: sans, fontSize: 14, padding: "10px 6px", minHeight: 40 };
// fundo escuro rolável (o cartão fica no topo quando é maior que a tela, por exemplo com o teclado aberto no celular)
const sobreposicao = { position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", display: "flex", zIndex: 10000, padding: "max(16px, env(safe-area-inset-top, 0px)) 16px max(24px, env(safe-area-inset-bottom, 0px))", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", boxSizing: "border-box" };
const cartao = { background: C.bg, border: `1px solid ${C.borda}`, borderRadius: 14, padding: "24px 22px", width: "min(440px, 100%)", margin: "auto", color: C.texto, display: "grid", gap: 14, boxSizing: "border-box" };
const DISPENSA = "anticeg_ativacao_dispensada";
const EVENTO_CONTA = "anticeg:conta-atualizada";
const ROTAS_PUBLICAS = ["/cegs", "/calendario", "/regras"];
// avisa as telas que o estado da conta mudou (ativou ou concluiu o perfil): cada uma relê o servidor, sem recarregar a página
const avisarContaAtualizada = () => { try { window.dispatchEvent(new Event(EVENTO_CONTA)); } catch { /* sem window */ } };
// com o teclado aberto no celular, traz o campo focado para o meio da área visível
const rolarAoFocar = ev => { const el = ev.target; setTimeout(() => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* sem suporte */ } }, 250); };

function Titulo({ children, cor = C.destaque }) {
  return <div role="heading" aria-level={2} style={{ margin: 0, fontFamily: mono, fontSize: 17, fontWeight: 700, color: cor, lineHeight: 1.3, letterSpacing: 0 }}>{children}</div>;
}
function Texto({ children, pequeno, ...resto }) {
  return <p style={{ margin: 0, fontFamily: sans, fontSize: pequeno ? 13 : 14, lineHeight: 1.55, color: C.mudo }} {...resto}>{children}</p>;
}
function Aviso({ texto }) {
  return texto ? <div role="alert" style={{ color: C.erro, fontSize: 14, fontFamily: sans, lineHeight: 1.45, margin: "2px 0" }}>{texto}</div> : null;
}
function Rotulo({ children }) {
  return <label style={{ display: "grid", gap: 6, fontSize: 13, color: C.mudo, fontFamily: sans }}>{children}</label>;
}

// Campo de senha com o "olhinho": alterna mostrar/ocultar SEM enviar o formulário (botão type=button), sem perder o que foi digitado nem o foco/teclado (o mesmo <input> só troca o type).
function CampoSenha({ style, ...resto }) {
  const [ver, setVer] = useState(false);
  const rotulo = ver ? "Ocultar senha" : "Mostrar senha";
  return (
    <span style={{ position: "relative", display: "block" }}>
      <input {...resto} style={{ ...style, paddingRight: 52, width: "100%", boxSizing: "border-box" }} type={ver ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" data-testid="olhinho-senha" aria-label={rotulo} aria-pressed={ver} title={rotulo}
        onMouseDown={ev => ev.preventDefault()} onClick={() => setVer(v => !v)}
        style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", color: C.mudo, cursor: "pointer", padding: 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ver
            ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
            : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </span>
  );
}

function JoinerAtivacaoModal({ user, api, onFechar, liberada = user?.ativacao_liberada !== false, emailInicial = "", aoAtivar = null }) {   // aoAtivar: quem abriu o pop-up SEM @ (começou pelo e-mail) recebe o @ da conta ao ativar
  const [fase, setFase] = useState(liberada ? "dados" : "aguardando");           // dados | codigo | pendente | ajuda | ajuda_enviada | aguardando (ativação ainda não liberada para o grupo dela) | regularizar
  const [cog, setCog] = useState(normalizarCog(user?.cog));
  const [email, setEmail] = useState(String(emailInicial || ""));
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);
  const [reenviado, setReenviado] = useState(false);
  const [contatoAjuda, setContatoAjuda] = useState("");
  const [textoAjuda, setTextoAjuda] = useState("");
  const [faseAnterior, setFaseAnterior] = useState("dados");
  const [lento, setLento] = useState(false);

  // depois de ativar, este pop-up só sai quando a confirmação do perfil assume a tela (a página de trás nunca aparece); se demorar, oferece continuar
  useEffect(() => {
    if (fase !== "finalizando") return undefined;
    const t = setTimeout(() => setLento(true), 8000);
    return () => clearTimeout(t);
  }, [fase]);
  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function enviarCodigo(e) {
    if (e) e.preventDefault();
    setErro("");
    if (!emailValido(email)) { setErro("Digite um e-mail válido."); return; }
    const msgSenha = validarSenha(senha, repetir, { cog, email });
    if (msgSenha) { setErro(msgSenha); return; }
    setOcupado(true);
    const r = await api.pedirCodigo({ cog, email });
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setCodigo(""); setEspera(60); setReenviado(false); setFase("codigo");
  }
  async function reenviar() {
    if (espera > 0 || ocupado) return;
    setErro(""); setOcupado(true);
    const r = await api.pedirCodigo({ cog, email });
    setOcupado(false);
    if (r.erro) setErro(r.erro); else { setEspera(60); setReenviado(true); }
  }
  async function confirmarCodigo(e) {
    e.preventDefault();
    setErro(""); setOcupado(true);
    const r = await api.confirmar({ cog, email, codigo, senha });
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    // conta ativada: segue direto para a confirmação do perfil (as telas releem o estado da conta); a pessoa NÃO precisa entrar de novo
    if (r.resultado === "ok") { if (aoAtivar) { aoAtivar(r.cog); return; } setFase("finalizando"); avisarContaAtualizada(); return; }
    setFase(r.resultado === "aguardando" ? "aguardando" : "pendente");
  }
  function pedirAjuda(deFase) { setErro(""); setFaseAnterior(deFase); setFase("ajuda"); }
  async function enviarAjuda(e) {
    e.preventDefault();
    setErro(""); setOcupado(true);
    const r = await api.pedirAjuda({ cog, contato: contatoAjuda, texto: textoAjuda });
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setFase("ajuda_enviada");
  }
  function continuarLimitado() {
    try { sessionStorage.setItem(DISPENSA, "1"); } catch { /* sem armazenamento: o aviso volta no próximo acesso */ }
    onFechar(false);
  }
  // sem acesso a dado protegido: só o @ fica na sessão e as áreas com dados pessoais continuam pedindo a senha; se a página atual é uma dessas, leva para uma área pública
  function voltarAreasPublicas() {
    continuarLimitado();
    const p = typeof window !== "undefined" ? window.location.pathname : "/";
    if (!ROTAS_PUBLICAS.some(r => p === r || p.startsWith(r + "/"))) window.location.assign("/cegs");
  }

  return (
    <div data-testid="ativacao-modal" role="dialog" aria-modal="true" aria-label="Ative sua conta" style={sobreposicao}>
      <div style={cartao}>
        {fase === "dados" && (
          <form onSubmit={enviarCodigo} noValidate style={{ display: "grid", gap: 14 }}>
            <Titulo>Ative sua conta</Titulo>
            <Texto data-testid="ativacao-intro">Crie sua senha para acessar seus pedidos e pagamentos. Seu histórico continua no mesmo cadastro.</Texto>
            <Rotulo>Seu @ cadastrado (se não lembrar, pode deixar em branco)<input style={campo} value={cog} onChange={ev => setCog(ev.target.value)} onFocus={rolarAoFocar} aria-label="Seu @ cadastrado" autoComplete="username" /></Rotulo>
            <Rotulo>E-mail do seu cadastro<input style={campo} type="email" value={email} onChange={ev => setEmail(ev.target.value)} onFocus={rolarAoFocar} aria-label="E-mail do cadastro" autoComplete="email" placeholder="seuemail@exemplo.com" /></Rotulo>
            <Rotulo>Crie uma senha (mínimo {SENHA_MIN} caracteres)<CampoSenha style={campo} value={senha} onChange={ev => setSenha(ev.target.value)} onFocus={rolarAoFocar} aria-label="Crie sua senha" autoComplete="new-password" /></Rotulo>
            <Rotulo>Repita a senha<CampoSenha style={campo} value={repetir} onChange={ev => setRepetir(ev.target.value)} onFocus={rolarAoFocar} aria-label="Repita a senha" autoComplete="new-password" /></Rotulo>
            <Aviso texto={erro} />
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar código de confirmação"}</button>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 16px" }}>
              <button type="button" style={acaoSec} onClick={() => { setErro(""); setFase("entrar"); }} data-testid="ativacao-ja-tenho-conta">Já tenho conta? Entrar</button>
              <button type="button" style={acaoSec} onClick={voltarAreasPublicas} data-testid="ativacao-voltar-publicas">Voltar às áreas públicas</button>
              <button type="button" style={acaoSec} onClick={() => pedirAjuda("dados")} data-testid="ativacao-pedir-ajuda">Meu e-mail não está no cadastro ou não lembro qual é</button>
            </div>
          </form>
        )}
        {fase === "codigo" && (
          <form onSubmit={confirmarCodigo} style={{ display: "grid", gap: 14 }}>
            <Titulo>Confirme o seu e-mail</Titulo>
            <Texto>E-mail informado: <b style={{ color: C.texto }}>{mascararEmail(email)}</b></Texto>
            <Texto data-testid="ativacao-texto-codigo">Se os dados informados corresponderem a um cadastro liberado para ativação, você receberá um código nesse e-mail.</Texto>
            <input style={{ ...campo, letterSpacing: 6, textAlign: "center", fontSize: 22, fontFamily: mono }} inputMode="numeric" enterKeyHint="go" autoComplete="one-time-code" maxLength={10} placeholder="000000" value={codigo} onChange={ev => setCodigo(ev.target.value)} onFocus={rolarAoFocar} aria-label="Código de confirmação" />
            <Aviso texto={erro} />
            {reenviado && <div data-testid="ativacao-reenviado" role="status" style={{ fontSize: 14, fontFamily: sans, color: C.ok, lineHeight: 1.45 }}>Pedimos outro código. Se os dados corresponderem a um cadastro liberado para ativação, ele chega nesse e-mail.</div>}
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Conferindo…" : "Confirmar código"}</button>
            <Texto pequeno data-testid="ativacao-aviso-spam">Confira também Spam ou Lixo Eletrônico. Se pedir outro código, use o mais recente.</Texto>
            <div style={{ display: "grid", gap: 2, justifyItems: "center" }}>
              <Texto pequeno data-testid="ativacao-dica-ajuda">Não recebeu o código? Toque em “Preciso de ajuda”.</Texto>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 16px" }}>
                <button type="button" style={{ ...acaoSec, opacity: espera > 0 || ocupado ? 0.6 : 1 }} onClick={reenviar} disabled={espera > 0 || ocupado}>{espera > 0 ? `Reenviar código em ${espera}s` : "Reenviar código"}</button>
                <button type="button" style={acaoSec} onClick={() => { setErro(""); setFase("dados"); }}>Corrigir dados</button>
                <button type="button" style={acaoSec} onClick={() => pedirAjuda("codigo")} data-testid="ativacao-nao-recebi">Preciso de ajuda</button>
              </div>
            </div>
          </form>
        )}
        {fase === "finalizando" && (
          <div data-testid="ativacao-finalizando" role="status" style={{ display: "grid", gap: 14 }}>
            <Titulo cor={C.ok}>✓ Conta ativada</Titulo>
            <Texto>Abrindo a confirmação dos seus dados…</Texto>
            {lento && (<>
              <Texto pequeno>Está demorando mais que o normal. Você pode continuar e, se a próxima tela não abrir, recarregar a página.</Texto>
              <button style={botao} onClick={() => { onFechar(true); window.location.reload(); }}>Continuar</button>
            </>)}
          </div>
        )}
        {fase === "pendente" && (
          <div style={{ display: "grid", gap: 14 }}>
            <Titulo>Falta só uma conferência</Titulo>
            <Texto>Seu e-mail foi confirmado, mas não conseguimos ligar a conta ao seu cadastro automaticamente (por exemplo, o e-mail cadastrado é outro ou o cadastro está incompleto). <b style={{ color: C.texto }}>Nada se perdeu</b>: seu @, pedidos e histórico continuam guardados. Fale com a administração para regularizar. Enquanto isso você pode continuar navegando no modo limitado, sem acesso às informações privadas.</Texto>
            <button style={botao} onClick={() => pedirAjuda("pendente")}>Pedir ajuda à administração</button>
            <button style={botaoSec} onClick={continuarLimitado}>Continuar no modo limitado</button>
          </div>
        )}
        {fase === "ajuda" && (
          <form onSubmit={enviarAjuda} data-testid="ativacao-ajuda" style={{ display: "grid", gap: 14 }}>
            <Titulo>Pedir ajuda à administração</Titulo>
            <Texto>Não precisa criar outro cadastro: seus pedidos, claims e histórico ficam guardados no seu @. Conte o que aconteceu (não chegou o código, o e-mail do cadastro é outro...) e deixe um contato; a administração confirma que é você por um canal conhecido e responde.</Texto>
            <Rotulo>Seu @<input style={campo} value={cog} onChange={ev => setCog(ev.target.value)} onFocus={rolarAoFocar} aria-label="Seu @ para a ajuda" autoComplete="username" /></Rotulo>
            <Rotulo>Contato para resposta (WhatsApp, e-mail ou outro @)<input style={campo} value={contatoAjuda} onChange={ev => setContatoAjuda(ev.target.value)} onFocus={rolarAoFocar} aria-label="Contato para resposta" maxLength={120} /></Rotulo>
            <Rotulo>O que aconteceu? (opcional)<textarea style={{ ...campo, minHeight: 80, resize: "vertical" }} value={textoAjuda} onChange={ev => setTextoAjuda(ev.target.value)} onFocus={rolarAoFocar} aria-label="O que aconteceu" maxLength={500} /></Rotulo>
            <Aviso texto={erro} />
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar pedido de ajuda"}</button>
            <div style={{ display: "flex", justifyContent: "center" }}><button type="button" style={acaoSec} onClick={() => { setErro(""); setFase(faseAnterior === "codigo" ? "codigo" : "dados"); }}>Voltar</button></div>
          </form>
        )}
        {fase === "ajuda_enviada" && (
          <div data-testid="ativacao-ajuda-enviada" style={{ display: "grid", gap: 14 }}>
            <Titulo cor={C.ok}>✓ Pedido enviado</Titulo>
            <Texto>A administração recebeu o seu pedido e responde pelo contato que você informou. Seus pedidos e histórico continuam guardados no seu @. Enquanto isso você pode continuar no modo limitado.</Texto>
            <button style={botao} onClick={continuarLimitado}>Continuar no modo limitado</button>
          </div>
        )}
        {fase === "aguardando" && (
          <div data-testid="ativacao-aguardando" style={{ display: "grid", gap: 14 }}>
            <Titulo>Sua ativação será liberada em breve</Titulo>
            <Texto>Estamos liberando a criação de senha aos poucos, em grupos. Quando chegar a sua vez você será avisada pela administração. Enquanto isso você continua navegando só com o @ (calendário, regras e CEGs). Seus pedidos, claims e histórico continuam guardados no seu @ e nada se perde.</Texto>
            <button style={botao} onClick={continuarLimitado}>Entendi, continuar só com o @</button>
          </div>
        )}
        {fase === "entrar" && (
          // o login existente, dentro do pop-up: ao entrar, a sessão muda e o aviso (conferir) fecha sozinho ou abre "Confira seus dados"
          <PromptSenha embutido user={{ cog }} api={api} onSemConta={() => { setErro(""); setFase("dados"); }} />
        )}
        {fase === "regularizar" && (
          <div style={{ display: "grid", gap: 14 }}>
            <Titulo>Vamos regularizar o seu cadastro</Titulo>
            <Texto>Sem problema! Fale com a administração e informe o seu @ e o e-mail que você quer usar. Ninguém precisa criar outro cadastro: seus pedidos, claims e histórico ficam guardados no seu @. Enquanto isso você pode continuar navegando no modo limitado.</Texto>
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
  const [perfilPendente, setPerfilPendente] = useState(null);     // J6: conta ativada, perfil ainda não concluído => tela obrigatória

  useEffect(() => {
    let vivo = true;
    if (!user?.cog) return undefined;
    const conferir = () => api.estado(user.cog).then(async r => {
      if (!vivo) return;
      if (r.estado === "perfil_pendente") { setAberto(false); setPerfilPendente(r.perfil || {}); return; }
      setPerfilPendente(null);
      if (r.estado === "ativa") { setAberto(false); return; }
      // a liberação pode ter mudado desde que o @ foi digitado: confere no servidor (só o @, sem dado pessoal)
      const acesso = await buscarAcessoSimples(user.cog).catch(() => null);
      const lib = acesso ? acesso.ativacao_liberada !== false : user?.ativacao_liberada !== false;
      if (vivo) { setLiberada(lib); setAberto(lib); }      // quem ainda não foi liberada não recebe o pop-up sozinho
    }).catch(() => { if (vivo) setAberto(true); });
    conferir();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { setTimeout(conferir, 0); });
    window.addEventListener(EVENTO_CONTA, conferir);      // ativou a conta ou concluiu o perfil: relê o servidor (sem depender de evento do login)
    return () => { vivo = false; sub?.subscription?.unsubscribe(); window.removeEventListener(EVENTO_CONTA, conferir); };
  }, [api, user?.cog]);

  // "Primeiro acesso? Ative sua conta" na tela de senha reabre este pop-up
  useEffect(() => {
    const abrir = () => { try { sessionStorage.removeItem(DISPENSA); } catch { /* sem armazenamento */ } setDispensado(false); setAberto(true); };
    window.addEventListener("anticeg:abrir-ativacao", abrir);
    return () => window.removeEventListener("anticeg:abrir-ativacao", abrir);
  }, []);

  if (perfilPendente) return <CompletarPerfil sobreposto api={api} perfil={perfilPendente} onConcluido={() => { setPerfilPendente(null); avisarContaAtualizada(); }} />;   // avisa as áreas protegidas: abrem na hora, sem recarregar
  if (!aberto || dispensado) return null;
  return <JoinerAtivacaoModal user={user} api={api} liberada={liberada} onFechar={concluida => { setAberto(false); if (!concluida) setDispensado(true); }} />;
}

// Ativação que começa SÓ pelo e-mail cadastrado (quem ainda não criou senha e não lembra o @). Não consulta nada antes: o servidor decide e a resposta é sempre a mesma.
// Ao ativar, entrega o @ da conta (quem chamou entra como "acesso simples" por ele e o perfil obrigatório assume).
export function AtivacaoPorEmail({ emailInicial = "", aoAtivar, onFechar }) {
  const [api] = useState(() => criarJoinerAuth());
  return <JoinerAtivacaoModal user={{ cog: "" }} api={api} liberada emailInicial={emailInicial} aoAtivar={aoAtivar} onFechar={onFechar} />;
}

// ── nível de acesso: simples (só @) ou completo (@ + senha, conta ativada) ───────────────────────
function useNivelAcesso(user) {
  const [api] = useState(() => criarJoinerAuth());
  const [nivel, setNivel] = useState("carregando");
  const [perfil, setPerfil] = useState(null);
  useEffect(() => {
    let vivo = true;
    const atualizar = () => api.estado(user?.cog).then(r => { if (vivo) { setPerfil(r.perfil || null); setNivel(r.estado === "ativa" ? "completo" : r.estado === "perfil_pendente" ? "perfil_pendente" : "simples"); } }).catch(() => { if (vivo) setNivel("simples"); });
    atualizar();
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(atualizar, 0); });
    const aoMudarConta = () => { setNivel("carregando"); atualizar(); };     // ativou a conta ou concluiu o perfil: mostra "Verificando acesso…" e relê (nunca o login ou o aviso antigos)
    window.addEventListener(EVENTO_CONTA, aoMudarConta);
    return () => { vivo = false; data?.subscription?.unsubscribe(); window.removeEventListener(EVENTO_CONTA, aoMudarConta); };
  }, [api, user?.cog]);
  return { api, nivel, perfil, recarregar: () => api.estado(user?.cog).then(r => { setPerfil(r.perfil || null); setNivel(r.estado === "ativa" ? "completo" : r.estado === "perfil_pendente" ? "perfil_pendente" : "simples"); }) };
}

function PromptSenha({ user, api, onSemConta, embutido = false }) {   // embutido: dentro do pop-up de ativação (sem moldura própria)
  const [modo, setModo] = useState("email");        // email (padrão) | arroba | recuperar
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
    const r = await api.recuperar({ cog, email });
    setOcupado(false);
    if (r.erro) setErro(r.erro); else setInfo("Se existir uma conta ativada para esse e-mail ou @, enviamos um link para o e-mail verificado. Confira também o spam.");
  }

  return (
    <div data-testid={embutido ? "login-no-popup" : "area-protegida"} style={embutido ? undefined : { maxWidth: 460, margin: "32px auto", padding: "0 16px", boxSizing: "border-box" }}>
      <div style={embutido ? undefined : { ...cartao, width: "100%", margin: 0, padding: "24px 22px" }}>
        <Titulo>Entre na sua conta</Titulo>
        <Texto>Estas informações são pessoais e só abrem com a sua senha. As áreas públicas continuam abertas.</Texto>
        {modo !== "recuperar" ? (
          <form onSubmit={entrar} noValidate style={{ display: "grid", gap: 14 }}>
            {modo === "arroba"
              ? <Rotulo>Seu @<input style={{ ...campo, opacity: 0.8 }} value={"@" + cog} readOnly aria-label="Seu @" /></Rotulo>
              : <Rotulo>E-mail da conta<input style={campo} type="email" value={email} onChange={ev => setEmail(ev.target.value)} aria-label="E-mail da conta" autoComplete="username" placeholder="seuemail@exemplo.com" /></Rotulo>}
            <div style={{ display: "grid", gap: 2 }}>
              <Rotulo>Senha<CampoSenha style={campo} value={senha} onChange={ev => setSenha(ev.target.value)} aria-label="Senha" autoComplete="current-password" /></Rotulo>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" style={{ ...acaoSec, color: C.destaque, padding: "8px 2px" }} onClick={() => { setErro(""); setInfo(""); setModo("recuperar"); }}>Esqueci minha senha</button>
              </div>
            </div>
            <Aviso texto={erro} />
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Entrando…" : "Entrar"}</button>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 16px" }}>
              <button type="button" style={acaoSec} onClick={() => { setErro(""); setModo(modo === "arroba" ? "email" : "arroba"); }}>{modo === "arroba" ? "Entrar com e-mail e senha" : "Entrar com @ e senha"}</button>
              <button type="button" style={acaoSec} onClick={onSemConta}>Primeiro acesso? Ative sua conta</button>
            </div>
          </form>
        ) : (
          <form onSubmit={recuperar} noValidate style={{ display: "grid", gap: 14 }}>
            <Texto>Vamos enviar um link para redefinir a senha no e-mail verificado da sua conta. Digite o e-mail da conta; se deixar em branco, usamos o do <b style={{ color: C.texto }}>@{cog}</b>.</Texto>
            <Rotulo>E-mail da conta<input style={campo} type="email" value={email} onChange={ev => setEmail(ev.target.value)} aria-label="E-mail da conta" autoComplete="username" placeholder="seuemail@exemplo.com" /></Rotulo>
            <Texto pequeno>Não tem mais acesso a esse e-mail? Fale com a administração: confirmamos que é você e atualizamos o e-mail do seu cadastro, sem perder pedidos nem histórico.</Texto>
            <Aviso texto={erro} />
            {info && <div role="status" style={{ color: C.ok, fontSize: 14, fontFamily: sans, lineHeight: 1.45 }}>{info}</div>}
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar link de redefinição"}</button>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 16px" }}>
              <button type="button" style={acaoSec} onClick={() => { setErro(""); setInfo(""); setModo("arroba"); }}>Voltar</button>
              <button type="button" style={acaoSec} onClick={onSemConta}>Primeiro acesso? Ative sua conta</button>
            </div>
          </form>
        )}
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
  if (nivel === "perfil_pendente") return <div data-testid="area-perfil-pendente" style={{ padding: 32, textAlign: "center", color: C.mudo, fontFamily: mono, fontSize: 12 }}>Conclua os seus dados na tela que abriu para continuar.</div>;
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
    <div data-testid="recuperacao-modal" role="dialog" aria-modal="true" aria-label="Definir nova senha" style={{ ...sobreposicao, zIndex: 10001 }}>
      <div style={cartao}>
        {!feito ? (
          <form onSubmit={salvar} noValidate style={{ display: "grid", gap: 14 }}>
            <Titulo>Defina a sua nova senha</Titulo>
            <Rotulo>Nova senha (mínimo {SENHA_MIN} caracteres)<CampoSenha style={campo} value={senha} onChange={ev => setSenha(ev.target.value)} aria-label="Nova senha" autoComplete="new-password" /></Rotulo>
            <Rotulo>Repita a nova senha<CampoSenha style={campo} value={repetir} onChange={ev => setRepetir(ev.target.value)} aria-label="Repita a nova senha" autoComplete="new-password" /></Rotulo>
            <Aviso texto={erro} />
            <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar nova senha"}</button>
          </form>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <Titulo cor={C.ok}>✓ Senha alterada</Titulo>
            <Texto>Pronto! Você já pode usar a nova senha.</Texto>
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
          <CampoSenha style={campo} value={senha} onChange={ev => setSenha(ev.target.value)} placeholder={`nova senha (mínimo ${SENHA_MIN} caracteres)`} aria-label="Nova senha" autoComplete="new-password" />
          <CampoSenha style={campo} value={repetir} onChange={ev => setRepetir(ev.target.value)} placeholder="repita a nova senha" aria-label="Repita a nova senha" autoComplete="new-password" />
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
  const [perfil, setPerfil] = useState(null);
  useEffect(() => {
    if (!JOINERS_AUTH_ATIVO) return undefined;
    let vivo = true;
    const atualizar = () => api.estado().then(r => { if (vivo) { setPerfil(r.perfil || null); setEstado(r.estado === "ativa" ? "ativa" : r.estado === "perfil_pendente" ? "perfil_pendente" : "bloqueada"); } }).catch(() => { if (vivo) setEstado("bloqueada"); });
    atualizar();
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(atualizar, 0); });
    const aoMudarConta = () => { setEstado("carregando"); atualizar(); };
    window.addEventListener(EVENTO_CONTA, aoMudarConta);
    return () => { vivo = false; data?.subscription?.unsubscribe(); window.removeEventListener(EVENTO_CONTA, aoMudarConta); };
  }, [api]);
  if (estado === "ativa") return children;
  if (estado === "perfil_pendente") return <CompletarPerfil api={api} perfil={perfil || {}} onConcluido={() => { avisarContaAtualizada(); return api.estado().then(r => { setPerfil(r.perfil || null); setEstado(r.estado === "ativa" ? "ativa" : r.estado === "perfil_pendente" ? "perfil_pendente" : "bloqueada"); }); }} />;
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
