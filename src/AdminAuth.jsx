import { useState, useEffect } from "react";
import { clienteAdmin, criarAdminAuth, ADMIN_AUTH_OBRIGATORIA } from "./adminAuth.js";

const C = { bg: "#17141f", borda: "rgba(245,240,232,0.14)", texto: "#F5F0E8", mudo: "rgba(245,240,232,0.6)", destaque: "#BAFF39", erro: "#FF8A80", ok: "#7CE08A" };
const mono = "'DM Mono',monospace";
const campo = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borda}`, background: "rgba(0,0,0,0.25)", color: C.texto, fontSize: 14, fontFamily: mono };
const botao = { padding: "10px 16px", borderRadius: 8, border: "none", background: C.destaque, color: "#111", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: mono };
const botaoSec = { ...botao, background: "transparent", color: C.texto, border: `1px solid ${C.borda}`, fontWeight: 500 };

// Todos os hooks ficam aqui, no topo do componente (nunca dentro de funções internas ou callbacks).
function useAdminAuth() {
  const [api] = useState(() => criarAdminAuth(clienteAdmin()));
  const [info, setInfo] = useState({ estado: "carregando" });
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [cadastro, setCadastro] = useState(null);

  useEffect(() => {
    let vivo = true;
    const atualizar = () => api.avaliar().then(r => { if (vivo) setInfo(r); });
    atualizar();
    const { data } = clienteAdmin().auth.onAuthStateChange(() => { setTimeout(atualizar, 0); });
    return () => { vivo = false; data?.subscription?.unsubscribe(); };
  }, [api]);

  function aplicar(r) {
    if (r?.erro) { setMensagem(r.erro); return; }
    setMensagem(r?.mensagem || "");
    if (r?.estado) { setInfo(r); if (r.estado !== "cadastrar_mfa") setCadastro(null); }
  }
  async function executar(fn) {
    setOcupado(true); setMensagem("");
    try { return await fn(); } finally { setOcupado(false); }
  }
  return {
    info, ocupado, mensagem, cadastro,
    entrar: (email, senha) => executar(async () => aplicar(await api.entrar(email, senha))),
    gerarQr: () => executar(async () => { const r = await api.iniciarCadastro(); if (r.erro) setMensagem(r.erro); else setCadastro(r); }),
    confirmar: (fatorId, codigo) => executar(async () => aplicar(await api.confirmar(fatorId, codigo))),
    sair: () => executar(async () => { aplicar(await api.sair()); setCadastro(null); }),
    recarregar: () => executar(async () => aplicar(await api.avaliar())),
  };
}

function Titulo({ children }) {
  return <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: C.destaque, letterSpacing: 0.5, marginBottom: 6 }}>{children}</div>;
}
function Aviso({ texto }) {
  return texto ? <div role="alert" style={{ color: C.erro, fontSize: 12, fontFamily: mono, margin: "8px 0" }}>{texto}</div> : null;
}

function FormEntrar({ auth }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  return (
    <form onSubmit={e => { e.preventDefault(); auth.entrar(email, senha); }} style={{ display: "grid", gap: 10 }}>
      <Titulo>🔒 Acesso seguro do administrador</Titulo>
      <div style={{ color: C.mudo, fontSize: 12 }}>Entre com a conta de administrador. Em seguida você confirma com o código do app autenticador.</div>
      <input style={campo} type="email" autoComplete="username" placeholder="e-mail" value={email} onChange={e => setEmail(e.target.value)} aria-label="E-mail do administrador" required />
      <input style={campo} type="password" autoComplete="current-password" placeholder="senha" value={senha} onChange={e => setSenha(e.target.value)} aria-label="Senha" required />
      <Aviso texto={auth.mensagem} />
      <button style={botao} type="submit" disabled={auth.ocupado}>{auth.ocupado ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}

function FormCodigo({ auth, fatorId, rotulo }) {
  const [codigo, setCodigo] = useState("");
  return (
    <form onSubmit={e => { e.preventDefault(); auth.confirmar(fatorId, codigo); }} style={{ display: "grid", gap: 10 }}>
      <input style={{ ...campo, letterSpacing: 6, textAlign: "center", fontSize: 18 }} inputMode="numeric" autoComplete="one-time-code" maxLength={7}
        placeholder="000000" value={codigo} onChange={e => setCodigo(e.target.value)} aria-label="Código de 6 dígitos" />
      <Aviso texto={auth.mensagem} />
      <button style={botao} type="submit" disabled={auth.ocupado}>{auth.ocupado ? "Conferindo…" : rotulo}</button>
    </form>
  );
}

export function AdminAuthCard({ auth, bloqueante = false }) {
  const [aberto, setAberto] = useState(false);
  const { estado, email } = auth.info;

  if (estado === "ok") {
    return (
      <div data-testid="admin-auth-ok" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.borda}`, background: C.bg, fontFamily: mono, fontSize: 12, color: C.ok }}>
        <span>🔒 Sessão segura verificada (MFA)</span>
        <span style={{ color: C.mudo }}>{email}</span>
        <button style={{ ...botaoSec, padding: "4px 10px", fontSize: 11, marginLeft: "auto" }} onClick={auth.sair} disabled={auth.ocupado}>Sair</button>
      </div>
    );
  }
  if (!bloqueante && !aberto) {
    return (
      <div data-testid="admin-auth-aviso" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, border: `1px dashed ${C.borda}`, background: C.bg, fontFamily: mono, fontSize: 12, color: C.mudo }}>
        <span>🔓 Acesso seguro (MFA) ainda não verificado nesta sessão.</span>
        <button style={{ ...botaoSec, padding: "4px 10px", fontSize: 11, marginLeft: "auto" }} onClick={() => setAberto(true)}>Entrar com MFA</button>
      </div>
    );
  }
  return (
    <div data-testid="admin-auth-card" style={{ maxWidth: 420, margin: bloqueante ? "40px auto" : "0 0 12px", padding: 16, borderRadius: 12, border: `1px solid ${C.borda}`, background: C.bg, color: C.texto }}>
      {estado === "carregando" && <div style={{ color: C.mudo, fontFamily: mono, fontSize: 12 }}>Verificando acesso…</div>}
      {estado === "sair" && <FormEntrar auth={auth} />}
      {estado === "verificar_mfa" && (
        <div style={{ display: "grid", gap: 10 }}>
          <Titulo>Confirme com o app autenticador</Titulo>
          <div style={{ color: C.mudo, fontSize: 12 }}>Digite o código de 6 números que aparece no app para {email}.</div>
          <FormCodigo auth={auth} fatorId={auth.info.fatorId} rotulo="Confirmar" />
        </div>
      )}
      {estado === "cadastrar_mfa" && (
        <div style={{ display: "grid", gap: 10 }}>
          <Titulo>Ative a verificação em duas etapas</Titulo>
          <div style={{ color: C.mudo, fontSize: 12 }}>1. Instale um app autenticador no celular (Google Authenticator, Authy ou similar).<br />2. Gere o QR Code abaixo e leia com o app.<br />3. Digite o código de 6 números que o app mostrar.</div>
          {!auth.cadastro && <><Aviso texto={auth.mensagem} /><button style={botao} onClick={auth.gerarQr} disabled={auth.ocupado}>{auth.ocupado ? "Gerando…" : "Gerar QR Code"}</button></>}
          {auth.cadastro && (
            <>
              <img src={auth.cadastro.qrCode} alt="QR Code para o app autenticador" style={{ width: 180, height: 180, background: "#fff", borderRadius: 8, padding: 6, justifySelf: "center" }} />
              <div style={{ color: C.mudo, fontSize: 11, fontFamily: mono, wordBreak: "break-all" }}>Sem câmera? Digite esta chave no app: <b style={{ color: C.texto }}>{auth.cadastro.segredo}</b></div>
              <FormCodigo auth={auth} fatorId={auth.cadastro.fatorId} rotulo="Ativar" />
            </>
          )}
        </div>
      )}
      {estado === "sem_permissao" && (
        <div style={{ display: "grid", gap: 10 }}>
          <Titulo>Conta sem permissão</Titulo>
          <div style={{ color: C.mudo, fontSize: 12 }}>A conta {email} entrou, mas não está cadastrada como administradora.</div>
          <button style={botaoSec} onClick={auth.sair} disabled={auth.ocupado}>Sair</button>
        </div>
      )}
      {estado === "erro" && (
        <div style={{ display: "grid", gap: 10 }}>
          <Titulo>Não foi possível verificar o acesso</Titulo>
          <Aviso texto={auth.info.mensagem || auth.mensagem} />
          <button style={botaoSec} onClick={auth.recarregar} disabled={auth.ocupado}>Tentar de novo</button>
        </div>
      )}
      {!bloqueante && estado !== "carregando" && <button style={{ ...botaoSec, marginTop: 10, padding: "4px 10px", fontSize: 11 }} onClick={() => setAberto(false)}>Fechar</button>}
    </div>
  );
}

// Em volta do painel de admin. Com ADMIN_AUTH_OBRIGATORIA = false só mostra o aviso e o painel segue como hoje.
export function AdminAuthGate({ children }) {
  const auth = useAdminAuth();
  const liberado = auth.info.estado === "ok";
  if (ADMIN_AUTH_OBRIGATORIA && !liberado) return <AdminAuthCard auth={auth} bloqueante />;
  return (
    <>
      <AdminAuthCard auth={auth} />
      {children}
    </>
  );
}
