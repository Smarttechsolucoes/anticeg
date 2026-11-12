// Ativação AUTOMÁTICA (J22), dentro do pop-up "Ative sua conta": a pessoa informa o @ e o resto é guiado.
//   cog       -> informa o @
//   confirmar -> o cadastro tem e-mail: aparece MASCARADO ("a•••@g•••.com") e a pessoa confirma que é dela; o código vai para o e-mail do cadastro
//   outro     -> o cadastro não tem e-mail (ou ela quer outro): digita o e-mail e o código vai para ele
//   codigo    -> digita o código e cria a senha; o servidor liga a conta ao cadastro
// Regras de texto: nunca afirmar que o código foi enviado antes de o servidor responder ("se os dados conferirem..."); nunca mostrar o e-mail completo do cadastro.
// Se a função do servidor ainda não existe, chama onIndisponivel() e o pop-up volta ao formulário antigo (nada quebra antes da publicação).
// Os estilos e átomos vêm do pop-up por "ui" (evita importação circular).
import { useState } from "react";
import { emailValido, normalizarCog, validarSenha, SENHA_MIN } from "./joinerAuth.js";

export default function AtivacaoAutomatica({ ui, api, cogInicial = "", onPronto, onSemCodigo, onIndisponivel, onEntrar }) {
  const { C, mono, sans, campo, botao, acaoSec, Titulo, Texto, Aviso, Rotulo, CampoSenha, rolarAoFocar } = ui;
  const [passo, setPasso] = useState("cog");           // cog | confirmar | outro | codigo
  const [cog, setCog] = useState(normalizarCog(cogInicial));
  const [mascara, setMascara] = useState("");
  const [email, setEmail] = useState("");              // e-mail digitado (vazio = o do cadastro, que a pessoa só viu mascarado)
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [sessaoPronta, setSessaoPronta] = useState(false);   // o código já foi aceito; só a senha precisa ser tentada de novo
  const [reenviado, setReenviado] = useState(false);

  const voltar = () => { setErro(""); setCodigo(""); setSessaoPronta(false); setPasso("cog"); };
  function seguir(r) {                              // próximo passo dito pelo servidor para quem NÃO vai receber código
    if (r.proximo === "informar_email") { setPasso("outro"); return true; }
    if (r.proximo) { onSemCodigo(r.proximo, cog); return true; }
    return false;
  }

  async function consultar(ev) {
    ev.preventDefault(); setErro("");
    if (!normalizarCog(cog)) { setErro("Informe o seu @."); return; }
    setOcupado(true); const r = await api.autoConsultar({ cog }); setOcupado(false);
    if (r.indisponivel) { onIndisponivel(); return; }
    if (r.erro) { setErro(r.erro); return; }
    if (r.proximo === "confirmar_email") { setMascara(r.emailMascarado); setEmail(""); setPasso("confirmar"); return; }
    setEmail(""); seguir(r);
  }
  async function enviar(usarCadastrado) {
    setErro("");
    if (!usarCadastrado && !emailValido(email)) { setErro("Digite um e-mail válido."); return; }
    setOcupado(true); const r = await api.autoEnviar({ cog, email: usarCadastrado ? "" : email, usarCadastrado }); setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    if (r.proximo && seguir(r)) return;
    setCodigo(""); setReenviado(false); setSessaoPronta(false); setPasso("codigo");
  }
  async function reenviar() {
    if (ocupado) return;
    setErro(""); setOcupado(true); const r = await api.autoEnviar({ cog, email, usarCadastrado: !email }); setOcupado(false);
    if (r.erro) setErro(r.erro); else if (r.proximo) seguir(r); else setReenviado(true);
  }
  async function confirmar(ev) {
    ev.preventDefault(); setErro("");
    const msg = validarSenha(senha, repetir, { cog, email });
    if (msg) { setErro(msg); return; }
    setOcupado(true); const r = await api.autoConfirmar({ cog, email, codigo, senha, sessaoPronta }); setOcupado(false);
    if (r.erro) { if (r.senhaPendente) setSessaoPronta(true); setErro(r.erro); return; }
    onPronto(r.resultado, r.cog);
  }

  if (passo === "cog") return (
    <form onSubmit={consultar} noValidate style={{ display: "grid", gap: 14 }} data-testid="auto-cog">
      <Titulo>Ative sua conta</Titulo>
      <Texto>Crie sua senha para acessar seus pedidos e pagamentos. Seu histórico continua no mesmo cadastro.</Texto>
      <Rotulo>Seu @<input style={campo} value={cog} onChange={ev => setCog(ev.target.value)} onFocus={rolarAoFocar} aria-label="Seu @" autoComplete="username" autoFocus /></Rotulo>
      <Aviso texto={erro} />
      <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Procurando…" : "Continuar"}</button>
      <div style={{ display: "flex", justifyContent: "center" }}><button type="button" style={acaoSec} onClick={onEntrar} data-testid="auto-ja-tenho-conta">Já tenho conta? Entrar</button></div>
    </form>
  );
  if (passo === "confirmar") return (
    <div style={{ display: "grid", gap: 14 }} data-testid="auto-confirmar">
      <Titulo>Este é o seu e-mail?</Titulo>
      <Texto>O cadastro de <b style={{ color: C.texto }}>@{normalizarCog(cog)}</b> tem este e-mail:</Texto>
      <div data-testid="auto-mascara" style={{ fontFamily: mono, fontSize: 20, textAlign: "center", padding: "12px 0", border: `1px solid ${C.borda}`, borderRadius: 8, color: C.texto }}>{mascara}</div>
      <Texto pequeno>Se é o seu, enviamos o código para ele. Se não for (ou se você não tem mais acesso a ele), informe outro e-mail.</Texto>
      <Aviso texto={erro} />
      <button style={botao} type="button" disabled={ocupado} onClick={() => enviar(true)} data-testid="auto-sim-meu">{ocupado ? "Enviando…" : "Sim, é o meu e-mail: enviar código"}</button>
      <button style={{ ...acaoSec, justifySelf: "center" }} type="button" disabled={ocupado} onClick={() => { setErro(""); setEmail(""); setPasso("outro"); }} data-testid="auto-nao-meu">Não é o meu e-mail / quero usar outro</button>
      <div style={{ display: "flex", justifyContent: "center" }}><button type="button" style={acaoSec} onClick={voltar}>Corrigir o @</button></div>
    </div>
  );
  if (passo === "outro") return (
    <form onSubmit={ev => { ev.preventDefault(); enviar(false); }} noValidate style={{ display: "grid", gap: 14 }} data-testid="auto-outro">
      <Titulo>Qual e-mail você quer usar?</Titulo>
      <Texto>Digite o e-mail em que você recebe mensagens. Vamos enviar um código para ele e, depois que você o confirmar, ele passa a ser o e-mail do seu cadastro.</Texto>
      <Rotulo>Seu e-mail<input style={campo} type="email" value={email} onChange={ev => setEmail(ev.target.value)} onFocus={rolarAoFocar} aria-label="Seu e-mail" autoComplete="email" placeholder="seuemail@exemplo.com" autoFocus /></Rotulo>
      <Aviso texto={erro} />
      <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar código"}</button>
      <div style={{ display: "flex", justifyContent: "center" }}><button type="button" style={acaoSec} onClick={voltar}>Corrigir o @</button></div>
    </form>
  );
  return (
    <form onSubmit={confirmar} style={{ display: "grid", gap: 14 }} data-testid="auto-codigo">
      <Titulo>Digite o código e crie a senha</Titulo>
      <Texto data-testid="auto-texto-codigo">Se os dados conferirem, você receberá um código no e-mail{email ? <> <b style={{ color: C.texto }}>{email}</b></> : " do cadastro"}. Confira também Spam ou Lixo Eletrônico.</Texto>
      <input style={{ ...campo, letterSpacing: 6, textAlign: "center", fontSize: 22, fontFamily: mono }} inputMode="numeric" enterKeyHint="next" autoComplete="one-time-code" maxLength={10} placeholder="000000" value={codigo} onChange={ev => setCodigo(ev.target.value)} onFocus={rolarAoFocar} aria-label="Código de confirmação" disabled={sessaoPronta} />
      <Rotulo>Crie uma senha (mínimo {SENHA_MIN} caracteres)<CampoSenha style={campo} value={senha} onChange={ev => setSenha(ev.target.value)} onFocus={rolarAoFocar} aria-label="Crie sua senha" autoComplete="new-password" /></Rotulo>
      <Rotulo>Repita a senha<CampoSenha style={campo} value={repetir} onChange={ev => setRepetir(ev.target.value)} onFocus={rolarAoFocar} aria-label="Repita a senha" autoComplete="new-password" /></Rotulo>
      <Aviso texto={erro} />
      {reenviado && <div role="status" data-testid="auto-reenviado" style={{ fontSize: 14, fontFamily: sans, color: C.ok, lineHeight: 1.45 }}>Pedimos outro código. Se os dados conferirem, ele chega no e-mail.</div>}
      <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Conferindo…" : "Confirmar e ativar"}</button>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 16px" }}>
        <button type="button" style={acaoSec} onClick={reenviar} disabled={ocupado || sessaoPronta} data-testid="auto-reenviar">Reenviar código</button>
        <button type="button" style={acaoSec} onClick={voltar}>Corrigir dados</button>
      </div>
    </form>
  );
}
