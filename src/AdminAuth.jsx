import { useState, useEffect } from "react";
import { clienteAdmin, criarAdminAuth, ADMIN_AUTH_OBRIGATORIA } from "./adminAuth.js";

const C = { bg: "#17141f", borda: "rgba(245,240,232,0.14)", texto: "#F5F0E8", mudo: "rgba(245,240,232,0.6)", destaque: "#BAFF39", erro: "#FF8A80", ok: "#7CE08A" };
const mono = "'DM Mono',monospace";
const campo = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borda}`, background: "rgba(0,0,0,0.25)", color: C.texto, fontSize: 14, fontFamily: mono };
const botao = { padding: "10px 16px", borderRadius: 8, border: "none", background: C.destaque, color: "#111", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: mono };
const botaoSec = { ...botao, background: "transparent", color: C.texto, border: `1px solid ${C.borda}`, fontWeight: 500 };
const barra = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: 0, padding: "8px 12px", borderRadius: 8, background: C.bg, fontFamily: mono, fontSize: 12 };

// Todos os hooks ficam aqui, no topo do componente (nunca dentro de funções internas ou callbacks).
function useAdminAuth() {
  const [api] = useState(() => criarAdminAuth(clienteAdmin()));
  const [info, setInfo] = useState({ estado: "carregando" });
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    let vivo = true;
    const atualizar = () => api.avaliar().then(r => { if (vivo) setInfo(r); });
    atualizar();
    const { data } = clienteAdmin().auth.onAuthStateChange(() => { setTimeout(atualizar, 0); });
    return () => { vivo = false; data?.subscription?.unsubscribe(); };
  }, [api]);

  function aplicar(r) {
    setMensagem(r?.mensagem || "");
    if (r?.estado) setInfo(r);
  }
  async function executar(fn) {
    setOcupado(true); setMensagem("");
    try { return await fn(); } finally { setOcupado(false); }
  }
  return {
    info, ocupado, mensagem,
    entrar: (email, senha) => executar(async () => aplicar(await api.entrar(email, senha))),
    trocarSenha: (nova, repetir) => executar(() => api.trocarSenha(nova, repetir)),
    sair: () => executar(async () => aplicar(await api.sair())),
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
      <Titulo>🔒 Acesso do administrador</Titulo>
      <div style={{ color: C.mudo, fontSize: 12 }}>Entre com o e-mail e a senha da sua conta de administrador.</div>
      <input style={campo} type="email" autoComplete="username" placeholder="e-mail" value={email} onChange={e => setEmail(e.target.value)} aria-label="E-mail do administrador" required />
      <input style={campo} type="password" autoComplete="current-password" placeholder="senha" value={senha} onChange={e => setSenha(e.target.value)} aria-label="Senha" required />
      <Aviso texto={auth.mensagem} />
      <button style={botao} type="submit" disabled={auth.ocupado}>{auth.ocupado ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}

function FormSenha({ auth, onFechar }) {
  const [nova, setNova] = useState("");
  const [repetir, setRepetir] = useState("");
  const [aviso, setAviso] = useState("");
  const [feito, setFeito] = useState(false);
  return (
    <form data-testid="admin-auth-senha" onSubmit={async e => { e.preventDefault(); setAviso(""); setFeito(false); const r = await auth.trocarSenha(nova, repetir); if (r.erro) setAviso(r.erro); else { setFeito(true); setNova(""); setRepetir(""); } }}
      style={{ display: "grid", gap: 8, flexBasis: "100%", marginTop: 6 }}>
      <input style={campo} type="password" autoComplete="new-password" placeholder="nova senha (mínimo 12 caracteres)" value={nova} onChange={e => setNova(e.target.value)} aria-label="Nova senha" />
      <input style={campo} type="password" autoComplete="new-password" placeholder="repita a nova senha" value={repetir} onChange={e => setRepetir(e.target.value)} aria-label="Repita a nova senha" />
      <Aviso texto={aviso} />
      {feito && <div role="status" style={{ color: C.ok, fontSize: 12, fontFamily: mono }}>Senha alterada.</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={botao} type="submit" disabled={auth.ocupado}>{auth.ocupado ? "Salvando…" : "Salvar nova senha"}</button>
        <button style={botaoSec} type="button" onClick={onFechar}>Fechar</button>
      </div>
    </form>
  );
}

export function AdminAuthCard({ auth, bloqueante = false }) {
  const [aberto, setAberto] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const { estado, email } = auth.info;

  if (estado === "ok") {
    return (
      <div data-testid="admin-auth-ok" style={{ ...barra, border: `1px solid ${C.borda}`, color: C.ok }}>
        <span>🔒 Acesso de administrador verificado</span>
        <span style={{ color: C.mudo }}>{email}</span>
        <button style={{ ...botaoSec, padding: "4px 10px", fontSize: 11, marginLeft: "auto" }} onClick={() => setTrocando(v => !v)}>Trocar senha</button>
        <button style={{ ...botaoSec, padding: "4px 10px", fontSize: 11 }} onClick={auth.sair} disabled={auth.ocupado}>Sair</button>
        {trocando && <FormSenha auth={auth} onFechar={() => setTrocando(false)} />}
      </div>
    );
  }
  if (!bloqueante && !aberto) {
    return (
      <div data-testid="admin-auth-aviso" style={{ ...barra, border: `1px dashed ${C.borda}`, color: C.mudo }}>
        <span>🔓 Acesso de administrador ainda não verificado nesta sessão.</span>
        <button style={{ ...botaoSec, padding: "4px 10px", fontSize: 11, marginLeft: "auto" }} onClick={() => setAberto(true)}>Entrar</button>
      </div>
    );
  }
  return (
    <div data-testid="admin-auth-card" style={{ maxWidth: 420, width: "100%", boxSizing: "border-box", margin: bloqueante ? "24px auto" : "0 0 12px", padding: 16, borderRadius: 12, border: `1px solid ${C.borda}`, background: C.bg, color: C.texto }}>
      {estado === "carregando" && <div style={{ color: C.mudo, fontFamily: mono, fontSize: 12 }}>Verificando acesso…</div>}
      {estado === "sair" && <FormEntrar auth={auth} />}
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

// Em volta do painel de admin. Com ADMIN_AUTH_OBRIGATORIA o painel só abre depois do login.
export function AdminAuthGate({ children }) {
  const auth = useAdminAuth();
  const liberado = auth.info.estado === "ok";
  if (ADMIN_AUTH_OBRIGATORIA && !liberado) return <div className="admin-auth-wrap"><AdminAuthCard auth={auth} bloqueante /></div>;
  return (
    <>
      <div className="admin-auth-wrap"><AdminAuthCard auth={auth} /></div>
      {children}
    </>
  );
}
