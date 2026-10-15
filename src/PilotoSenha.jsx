// PILOTO DE SENHAS (/piloto-senha/) — testa SOMENTE: código por e-mail, criação de senha, login, logout, troca e recuperação de senha.
// Não lê nem grava nenhum dado do site: depois do login mostra só "conta ativa". Não libera pedidos, pagamentos, comprovantes, alterações cadastrais nem a planilha.
// Quem pode ativar é decidido SÓ no servidor (função pedir-codigo-joiner + ativar_minha_conta + lista de ondas): nada neste arquivo sabe quem está autorizado.
// Usa um cliente Supabase PRÓPRIO (storageKey separada): a sessão do piloto não aparece no site principal e o site principal não é afetado.
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase.js";
import { criarJoinerAuth, validarSenha, normalizarCog, SENHA_MIN } from "./joinerAuth.js";

let _cliente = null;
function clientePiloto() {
  if (!_cliente) {
    _cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storageKey: "anticeg-piloto-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return _cliente;
}

// Lido AGORA (ao carregar o módulo), antes de o cliente processar e limpar o endereço: o link de recuperação do e-mail chega como #...&type=recovery
const VEIO_DO_LINK_DE_RECUPERACAO = typeof window !== "undefined" && /(^#|&)type=recovery(&|$)/.test(window.location.hash);

const mono = "'DM Mono', ui-monospace, monospace";
const C = { fundo: "#131310", cartao: "#1b1b17", borda: "#34342d", texto: "#f5f0e8", mudo: "rgba(245,240,232,.62)", destaque: "#ff5c1a", ok: "#4ade80", erro: "#ff8f7a" };
const campo = { width: "100%", boxSizing: "border-box", background: "#0d0d0b", border: `1px solid ${C.borda}`, borderRadius: 8, padding: "10px 12px", color: C.texto, fontFamily: mono, fontSize: 14 };
const botao = { background: C.destaque, color: "#111", border: "none", borderRadius: 8, padding: "11px 14px", fontFamily: mono, fontWeight: 700, fontSize: 13, cursor: "pointer" };
const botaoSec = { ...botao, background: "transparent", color: C.texto, border: `1px solid ${C.borda}` };
const rotulo = { display: "grid", gap: 5, fontFamily: mono, fontSize: 11, letterSpacing: ".04em", color: C.mudo };

function Aviso({ texto, tipo = "erro", id }) {
  if (!texto) return null;
  return <div data-testid={id} role={tipo === "erro" ? "alert" : "status"} style={{ fontFamily: mono, fontSize: 12, lineHeight: 1.5, color: tipo === "erro" ? C.erro : C.ok, background: tipo === "erro" ? "rgba(255,143,122,.08)" : "rgba(74,222,128,.08)", borderRadius: 8, padding: "9px 11px" }}>{texto}</div>;
}

export default function PilotoSenha() {
  const api = useMemo(() => criarJoinerAuth(clientePiloto()), []);
  const [fase, setFase] = useState("carregando");   // carregando | inicio | codigo | ativa | nova-senha
  const [aba, setAba] = useState("ativar");          // ativar | entrar | esqueci
  const [cog, setCog] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [aviso, setAviso] = useState(null);          // { tipo, texto }
  const [ocupado, setOcupado] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [cogAtivo, setCogAtivo] = useState("");

  useEffect(() => {
    document.title = "Teste de senha · antigom";
    if (VEIO_DO_LINK_DE_RECUPERACAO) setFase("nova-senha");
    const { data } = clientePiloto().auth.onAuthStateChange(evento => { if (evento === "PASSWORD_RECOVERY") { setFase("nova-senha"); setAviso(null); } });
    let vivo = true;
    (async () => {
      // espera um instante para o cliente processar o link de recuperação (se houver) antes de decidir a tela
      if (VEIO_DO_LINK_DE_RECUPERACAO) return;      // a tela de senha nova já foi escolhida; a sessão do link é a do cliente do piloto
      await new Promise(r => setTimeout(r, 150));
      const e = await api.estado();
      if (!vivo) return;
      setFase(fase0 => fase0 === "nova-senha" ? fase0 : e.estado === "ativa" ? "ativa" : "inicio");
      if (e.estado === "ativa") setCogAtivo(e.cog);
    })();
    return () => { vivo = false; data?.subscription?.unsubscribe(); };
  }, [api]);

  const limpar = () => { setSenha(""); setRepetir(""); setCodigo(""); };
  const info = (texto, tipo = "erro") => setAviso({ tipo, texto });

  async function enviarCodigo(e) {
    e.preventDefault(); setAviso(null); setOcupado(true);
    const r = await api.pedirCodigo({ cog, email });
    setOcupado(false);
    if (r.erro) return info(r.erro);
    setFase("codigo");
    info("Se os dados estiverem corretos e o seu acesso de teste estiver liberado, o código chega por e-mail em até 5 minutos. Veja também o spam.", "ok");
  }

  async function ativar(e) {
    e.preventDefault(); setAviso(null);
    const msg = validarSenha(senha, repetir, { cog: normalizarCog(cog), email });
    if (msg) return info(msg);
    setOcupado(true);
    const r = await api.confirmar({ cog, email, codigo, senha });
    if (r.erro) { setOcupado(false); return info(r.erro); }
    if (r.resultado !== "ok") {
      await api.sair();            // nada fica ligado a este aparelho se o vínculo não foi concluído
      setOcupado(false); limpar(); setFase("inicio"); setAba("ativar");
      return info(r.resultado === "aguardando" ? "Seu acesso de teste ainda não foi liberado." : "Não foi possível concluir automaticamente. Avise a administração; nada foi alterado no seu cadastro.");
    }
    const est = await api.estado(cog);
    setOcupado(false); limpar();
    if (est.estado === "ativa") { setCogAtivo(est.cog); setFase("ativa"); info("Conta ativada. Agora teste: sair e entrar de novo com @ e senha.", "ok"); }
    else { await api.sair(); setFase("inicio"); info("Não foi possível confirmar a conta. Avise a administração."); }
  }

  async function entrar(e) {
    e.preventDefault(); setAviso(null); setOcupado(true);
    const r = await api.entrar({ cog, senha });
    setOcupado(false);
    if (r.erro) return info(r.erro);
    limpar(); setCogAtivo(r.cog); setFase("ativa"); info("Login feito.", "ok");
  }

  async function esqueci(e) {
    e.preventDefault(); setAviso(null); setOcupado(true);
    const r = await api.recuperar({ cog });
    setOcupado(false);
    if (r.erro) return info(r.erro);
    info("Se existir uma conta ativada para esse @, enviamos um link para o e-mail verificado. Abra o link neste mesmo aparelho.", "ok");
  }

  async function salvarNovaSenha(e) {
    e.preventDefault(); setAviso(null); setOcupado(true);
    const r = await api.trocarSenha(senha, repetir, { cog: cogAtivo });
    setOcupado(false);
    if (r.erro) return info(fase === "nova-senha" && /sess|expir|link/i.test(r.erro) ? "O link expirou ou já foi usado. Peça um novo em 'Esqueci a senha'." : r.erro);
    const veioDoLink = fase === "nova-senha";
    limpar(); setTrocando(false);
    if (veioDoLink) {            // termina a sessão do link: o teste seguinte é entrar com a senha nova
      await api.sair(); setFase("inicio"); setAba("entrar");
      try { window.history.replaceState(null, "", window.location.pathname); } catch { /* sem histórico */ }
      return info("Senha alterada. Agora entre com a senha nova.", "ok");
    }
    info("Senha alterada.", "ok");
  }

  async function sair() {
    await api.sair(); limpar(); setCogAtivo(""); setFase("inicio"); setAba("entrar"); info("Você saiu.", "ok");
  }

  const alterna = (nome, rotuloAba) => <button type="button" data-testid={`aba-${nome}`} onClick={() => { setAba(nome); setAviso(null); limpar(); }} style={{ ...(aba === nome ? botao : botaoSec), padding: "8px 10px", fontSize: 12 }}>{rotuloAba}</button>;
  const cx = (t, v, f, extra = {}) => <label style={rotulo}>{t}<input style={campo} value={v} onChange={ev => f(ev.target.value)} {...extra} /></label>;

  return (
    <main style={{ minHeight: "100vh", background: C.fundo, color: C.texto, display: "grid", placeItems: "start center", padding: "28px 16px", boxSizing: "border-box" }}>
      <div style={{ width: "min(440px, 100%)", display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".18em", color: C.destaque }}>ANTI CEG · TESTE</div>
          <h1 style={{ margin: "4px 0 0", fontSize: 22, fontFamily: mono }}>Teste de senha</h1>
        </div>
        <div style={{ fontFamily: mono, fontSize: 12, lineHeight: 1.55, color: C.mudo, background: C.cartao, border: `1px solid ${C.borda}`, borderRadius: 10, padding: "10px 12px" }}>
          Página só para testar o acesso com senha. <strong style={{ color: C.texto }}>Ela não libera pedidos, pagamentos, comprovantes, alterações de cadastro nem a planilha</strong> e não mostra nenhum dado seu.
        </div>

        <div style={{ background: C.cartao, border: `1px solid ${C.borda}`, borderRadius: 12, padding: "16px 14px", display: "grid", gap: 12 }}>
          {fase === "carregando" && <div style={{ fontFamily: mono, fontSize: 12, color: C.mudo }}>Carregando…</div>}

          {fase === "inicio" && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{alterna("ativar", "Primeiro acesso")}{alterna("entrar", "Entrar")}{alterna("esqueci", "Esqueci a senha")}</div>
              {aba === "ativar" && (
                <form onSubmit={enviarCodigo} noValidate style={{ display: "grid", gap: 10 }}>
                  {cx("Seu @ (sem o @)", cog, setCog, { "aria-label": "Seu @", autoComplete: "username", autoCapitalize: "none", "data-testid": "campo-cog" })}
                  {cx("E-mail do seu cadastro", email, setEmail, { type: "email", "aria-label": "E-mail do cadastro", autoComplete: "email", "data-testid": "campo-email" })}
                  <button style={botao} type="submit" disabled={ocupado} data-testid="enviar-codigo">{ocupado ? "Enviando…" : "Enviar código"}</button>
                </form>
              )}
              {aba === "entrar" && (
                <form onSubmit={entrar} noValidate style={{ display: "grid", gap: 10 }}>
                  {cx("Seu @ (sem o @)", cog, setCog, { "aria-label": "Seu @", autoComplete: "username", autoCapitalize: "none", "data-testid": "campo-cog" })}
                  {cx("Senha", senha, setSenha, { type: "password", "aria-label": "Senha", autoComplete: "current-password", "data-testid": "campo-senha" })}
                  <button style={botao} type="submit" disabled={ocupado} data-testid="entrar">{ocupado ? "Entrando…" : "Entrar"}</button>
                </form>
              )}
              {aba === "esqueci" && (
                <form onSubmit={esqueci} noValidate style={{ display: "grid", gap: 10 }}>
                  {cx("Seu @ (sem o @)", cog, setCog, { "aria-label": "Seu @", autoComplete: "username", autoCapitalize: "none", "data-testid": "campo-cog" })}
                  <button style={botao} type="submit" disabled={ocupado} data-testid="recuperar">{ocupado ? "Enviando…" : "Enviar link para criar nova senha"}</button>
                </form>
              )}
            </>
          )}

          {fase === "codigo" && (
            <form onSubmit={ativar} noValidate style={{ display: "grid", gap: 10 }}>
              {cx("Código de 6 dígitos do e-mail", codigo, setCodigo, { inputMode: "numeric", autoComplete: "one-time-code", "aria-label": "Código", "data-testid": "campo-codigo" })}
              {cx(`Crie uma senha (mínimo ${SENHA_MIN} caracteres)`, senha, setSenha, { type: "password", autoComplete: "new-password", "aria-label": "Nova senha", "data-testid": "campo-senha-nova" })}
              {cx("Repita a senha", repetir, setRepetir, { type: "password", autoComplete: "new-password", "aria-label": "Repita a senha", "data-testid": "campo-senha-repetir" })}
              <button style={botao} type="submit" disabled={ocupado} data-testid="ativar">{ocupado ? "Ativando…" : "Ativar conta"}</button>
              <button style={botaoSec} type="button" onClick={() => { setFase("inicio"); limpar(); setAviso(null); }}>Voltar</button>
            </form>
          )}

          {fase === "ativa" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div data-testid="conta-ativa" style={{ fontFamily: mono, fontSize: 14, color: C.ok }}>✓ Conta ativa: @{cogAtivo}</div>
              <div style={{ fontFamily: mono, fontSize: 12, color: C.mudo, lineHeight: 1.5 }}>É só isso: nesta fase de teste a conta não dá acesso a mais nada.</div>
              {!trocando ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={botaoSec} type="button" data-testid="abrir-trocar" onClick={() => { setTrocando(true); setAviso(null); }}>Trocar senha</button>
                  <button style={botao} type="button" data-testid="sair" onClick={sair}>Sair</button>
                </div>
              ) : (
                <form onSubmit={salvarNovaSenha} noValidate style={{ display: "grid", gap: 10 }}>
                  {cx("Senha nova", senha, setSenha, { type: "password", autoComplete: "new-password", "aria-label": "Senha nova", "data-testid": "campo-senha-nova" })}
                  {cx("Repita a senha nova", repetir, setRepetir, { type: "password", autoComplete: "new-password", "aria-label": "Repita a senha nova", "data-testid": "campo-senha-repetir" })}
                  <button style={botao} type="submit" disabled={ocupado} data-testid="salvar-senha">{ocupado ? "Salvando…" : "Salvar senha nova"}</button>
                  <button style={botaoSec} type="button" onClick={() => { setTrocando(false); limpar(); }}>Cancelar</button>
                </form>
              )}
            </div>
          )}

          {fase === "nova-senha" && (
            <form onSubmit={salvarNovaSenha} noValidate style={{ display: "grid", gap: 10 }} data-testid="nova-senha-link">
              <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.destaque }}>Defina a sua nova senha</div>
              {cx(`Senha nova (mínimo ${SENHA_MIN} caracteres)`, senha, setSenha, { type: "password", autoComplete: "new-password", "aria-label": "Senha nova", "data-testid": "campo-senha-nova" })}
              {cx("Repita a senha nova", repetir, setRepetir, { type: "password", autoComplete: "new-password", "aria-label": "Repita a senha nova", "data-testid": "campo-senha-repetir" })}
              <button style={botao} type="submit" disabled={ocupado} data-testid="salvar-senha">{ocupado ? "Salvando…" : "Salvar senha nova"}</button>
            </form>
          )}

          <Aviso texto={aviso?.texto} tipo={aviso?.tipo} id="aviso" />
        </div>
      </div>
    </main>
  );
}
