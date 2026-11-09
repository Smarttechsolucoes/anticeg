// Telas "Quero mudar de e-mail" (J13) e "Quero manter meu e-mail e comprovar meu cadastro" (J14), dentro do pop-up de ativação.
// Regras de texto (cada uma coberta por teste de navegador):
//   * NUNCA afirmar que um código foi enviado quando isso não aconteceu: antes de o servidor confirmar, o texto é condicional ("se os dados conferirem...").
//   * Diferenciar claramente três situações: "e-mail verificado", "pedido aguardando análise" e "acesso liberado". Cada uma só aparece como CUMPRIDA quando o servidor disse que é.
//   * Confirmar um e-mail novo NÃO liga conta a cadastro e não libera nada sozinho: quem decide, quando não é automático, é a administração.
//   * Só a via "descrever outra prova" (sem mensagem direta no X). Nenhum e-mail completo é mostrado de volta (só o do que a própria pessoa digitou nesta tela, ou mascarado).
// Os estilos e átomos vêm do pop-up por "ui" (evita importação circular).
import { useState } from "react";
import { emailValido, normalizarCog, mascararEmail, DETALHE_MIN } from "./joinerAuth.js";

const CONTATO_MIN = 5, CONTATO_MAX = 100, DESCRICAO_MAX = 380;

// três situações lado a lado: cada linha diz o que JÁ aconteceu e o que ainda NÃO
function Situacao({ ui, emailVerificado, pedido, acesso }) {
  const { C, sans } = ui;
  const linha = (id, feito, texto, pendente) => (
    <li data-testid={id} data-estado={feito ? "sim" : pendente ? "pendente" : "nao"} style={{ display: "flex", gap: 8, alignItems: "baseline", fontFamily: sans, fontSize: 14, lineHeight: 1.45, color: feito ? C.ok : pendente ? C.texto : C.mudo }}>
      <span aria-hidden="true" style={{ width: 18, flex: "none" }}>{feito ? "✓" : pendente ? "…" : "–"}</span><span>{texto}</span>
    </li>
  );
  return (
    <ul data-testid="situacao" style={{ listStyle: "none", margin: 0, padding: "10px 12px", display: "grid", gap: 6, border: `1px solid ${C.borda}`, borderRadius: 8 }}>
      {linha("situacao-email", emailVerificado, emailVerificado ? "E-mail verificado: você confirmou o código enviado a ele." : "E-mail ainda não verificado.", false)}
      {linha("situacao-pedido", false, pedido === "aguardando" ? "Pedido aguardando análise da administração." : pedido === "enviado" ? "Descrição enviada: a administração analisa se o @ e o e-mail conferirem com um cadastro." : pedido === "nenhum" ? "Nenhum pedido pendente." : "Pedido ainda não enviado.", pedido === "aguardando" || pedido === "enviado")}
      {linha("situacao-acesso", acesso, acesso ? "Acesso liberado: você já pode pedir o código de ativação." : "Acesso ainda NÃO liberado: nenhum código de ativação foi enviado.", false)}
    </ul>
  );
}

export function FluxoTrocaEmail({ ui, api, cogInicial = "", emailInicial = "", onVoltar, onAtivar, onAjuda, onContinuarLimitado }) {
  const { C, campo, botao, botaoSec, acaoSec, Titulo, Texto, Aviso, Rotulo, rolarAoFocar } = ui;
  const [etapa, setEtapa] = useState("dados");           // dados | antigo | novo | fim_aplicada | fim_aguardando | sem_pedido
  const [via, setVia] = useState("email_antigo");
  const [cog, setCog] = useState(normalizarCog(cogInicial));
  const [emailAtual, setEmailAtual] = useState(String(emailInicial || ""));
  const [novoEmail, setNovoEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [token, setToken] = useState("");
  const [codigoAntigo, setCodigoAntigo] = useState("");   // guardado só para repetir o envio ao e-mail novo se o provedor falhar
  const [novoMascarado, setNovoMascarado] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [semPedido, setSemPedido] = useState("");        // ajuda | entrar | limite (quem acertou o par e não pode seguir por aqui)
  const [contato, setContato] = useState("");
  const [contatoEnviado, setContatoEnviado] = useState(false);

  const recomecar = msg => { setToken(""); setCodigo(""); setCodigoAntigo(""); setNovoMascarado(""); setAviso(""); setErro(msg || ""); setEtapa("dados"); };

  async function iniciar(e) {
    e.preventDefault(); setErro(""); setAviso("");
    if (!normalizarCog(cog)) return setErro("Informe o seu @.");
    if (via === "email_antigo" && !emailValido(emailAtual)) return setErro("Digite o e-mail que está no seu cadastro.");
    if (!emailValido(novoEmail)) return setErro("Digite um e-mail novo válido.");
    setOcupado(true);
    const r = await api.iniciarTrocaEmail({ cog, email: emailAtual, novoEmail, via });
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    if (r.proximo) { setSemPedido(r.proximo); setEtapa("sem_pedido"); return; }
    setToken(r.token); setCodigo("");
    setEtapa(via === "email_antigo" ? "antigo" : "novo");
  }

  async function conferir(lado, codigoUsado) {
    setErro(""); setAviso(""); setOcupado(true);
    const r = await api.confirmarTrocaEmail({ token, lado, codigo: codigoUsado });
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    switch (r.resultado) {
      case "errado": return setErro("Esse código não confere. Confira os 6 números e tente de novo.");
      case "bloqueado": return recomecar("Foram muitas tentativas erradas e este pedido foi encerrado. Comece de novo para receber outro código.");
      case "expirado": return recomecar("O pedido expirou (os códigos valem por 30 minutos). Comece de novo.");
      case "limite_envio": return recomecar("Você chegou ao limite de envios deste pedido. Comece de novo mais tarde.");
      case "falha_envio": setCodigoAntigo(codigoUsado); return setErro("O e-mail do cadastro foi confirmado, mas não conseguimos enviar o código ao e-mail novo agora. Toque em “Tentar enviar de novo”.");
      case "antigo_ok": setCodigoAntigo(""); setNovoMascarado(r.novoMascarado || ""); setCodigo(""); setEtapa("novo"); return setAviso("E-mail do cadastro confirmado.");
      case "aplicada": return setEtapa("fim_aplicada");
      case "aguardando_identidade": return setEtapa("fim_aguardando");
      case "falta_antigo": return setErro("Falta confirmar o código do e-mail do cadastro antes do código do e-mail novo.");
      default: return setErro("Não foi possível conferir agora. Tente de novo em alguns minutos.");
    }
  }
  const confirmarAntigo = e => { e.preventDefault(); conferir("antigo", codigo); };
  const confirmarNovo = e => { e.preventDefault(); conferir("novo", codigo); };
  async function enviarContato(e) {
    e.preventDefault(); setErro(""); setOcupado(true);
    const r = await api.pedirAjuda({ cog, contato, texto: "Pedido de troca de e-mail aguardando análise: deixo este contato para a administração confirmar que sou eu." });
    setOcupado(false);
    if (r.erro) return setErro(r.erro); setContatoEnviado(true);
  }

  const campoCodigo = (
    <input style={{ ...campo, letterSpacing: 6, textAlign: "center", fontSize: 22, fontFamily: ui.mono }} inputMode="numeric" enterKeyHint="go" autoComplete="one-time-code" maxLength={10} placeholder="000000" value={codigo} onChange={ev => setCodigo(ev.target.value)} onFocus={rolarAoFocar} aria-label="Código de confirmação" data-testid="troca-codigo" />
  );
  const voltar = <div style={{ display: "flex", justifyContent: "center" }}><button type="button" style={acaoSec} onClick={onVoltar} data-testid="troca-voltar">Voltar</button></div>;

  if (etapa === "dados") return (
    <form onSubmit={iniciar} noValidate data-testid="troca-dados" style={{ display: "grid", gap: 14 }}>
      <Titulo>Quero mudar de e-mail</Titulo>
      <Texto>Para trocar o e-mail do cadastro, você confirma o e-mail novo com um código. Seu histórico, itens e pagamentos continuam no mesmo cadastro: nada é apagado nem criado de novo.</Texto>
      <Rotulo>Seu @ cadastrado<input style={campo} value={cog} onChange={ev => setCog(ev.target.value)} onFocus={rolarAoFocar} aria-label="Seu @ cadastrado" autoComplete="username" /></Rotulo>
      <fieldset style={{ border: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        <legend style={{ ...ui.legendaEstilo }}>Você ainda consegue abrir o e-mail que está no cadastro?</legend>
        <label style={{ display: "flex", gap: 8, alignItems: "baseline", fontFamily: ui.sans, fontSize: 14, color: C.texto }}><input type="radio" name="via-troca" checked={via === "email_antigo"} onChange={() => setVia("email_antigo")} data-testid="troca-via-antigo" />Sim, ainda tenho acesso</label>
        <label style={{ display: "flex", gap: 8, alignItems: "baseline", fontFamily: ui.sans, fontSize: 14, color: C.texto }}><input type="radio" name="via-troca" checked={via === "sem_acesso"} onChange={() => setVia("sem_acesso")} data-testid="troca-via-sem-acesso" />Não, perdi o acesso a ele</label>
      </fieldset>
      {via === "email_antigo"
        ? <Texto pequeno data-testid="troca-texto-antigo">Você vai confirmar um código no e-mail do cadastro e outro no e-mail novo. Em alguns casos a troca é feita na hora; em outros a administração ainda precisa conferir.</Texto>
        : <Texto pequeno data-testid="troca-texto-sem-acesso">Sem acesso ao e-mail do cadastro, a troca <b style={{ color: C.texto }}>nunca é feita sozinha</b>: você confirma o e-mail novo por código e a administração confirma que é você por outro canal antes de trocar.</Texto>}
      {via === "email_antigo" && <Rotulo>E-mail que está no seu cadastro hoje<input style={campo} type="email" value={emailAtual} onChange={ev => setEmailAtual(ev.target.value)} onFocus={rolarAoFocar} aria-label="E-mail atual do cadastro" autoComplete="email" placeholder="seuemail@exemplo.com" /></Rotulo>}
      <Rotulo>E-mail novo<input style={campo} type="email" value={novoEmail} onChange={ev => setNovoEmail(ev.target.value)} onFocus={rolarAoFocar} aria-label="E-mail novo" autoComplete="off" placeholder="novoemail@exemplo.com" /></Rotulo>
      <Aviso texto={erro} />
      <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Enviando…" : "Continuar"}</button>
      {voltar}
    </form>
  );

  if (etapa === "antigo") return (
    <form onSubmit={confirmarAntigo} data-testid="troca-antigo" style={{ display: "grid", gap: 14 }}>
      <Titulo>Confirme o e-mail do cadastro</Titulo>
      <Texto data-testid="troca-texto-codigo-antigo">Se o @ e o e-mail do cadastro que você informou conferirem, o código vai para <b style={{ color: C.texto }}>{mascararEmail(emailAtual)}</b>. Digite-o abaixo. Se não chegar em alguns minutos, olhe também o Spam: é possível que nenhum código tenha sido enviado.</Texto>
      {campoCodigo}
      <Aviso texto={erro} />
      {aviso && <div role="status" style={{ color: C.ok, fontSize: 14, fontFamily: ui.sans }}>{aviso}</div>}
      <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Conferindo…" : "Confirmar código"}</button>
      {codigoAntigo && <button type="button" style={botaoSec} disabled={ocupado} data-testid="troca-reenviar" onClick={() => conferir("antigo", codigoAntigo)}>Tentar enviar de novo</button>}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 16px" }}>
        <button type="button" style={acaoSec} onClick={() => recomecar()} data-testid="troca-corrigir">Corrigir dados</button>
        <button type="button" style={acaoSec} onClick={onAjuda} data-testid="troca-ajuda">Preciso de ajuda</button>
      </div>
    </form>
  );

  if (etapa === "novo") return (
    <form onSubmit={confirmarNovo} data-testid="troca-novo" style={{ display: "grid", gap: 14 }}>
      <Titulo>Confirme o e-mail novo</Titulo>
      {novoMascarado
        ? <Texto data-testid="troca-texto-codigo-novo">Enviamos um código para <b style={{ color: C.texto }}>{novoMascarado}</b>. Digite-o abaixo.</Texto>
        : <Texto data-testid="troca-texto-codigo-novo">Se os dados informados puderem seguir por aqui, o código vai para <b style={{ color: C.texto }}>{mascararEmail(novoEmail)}</b>. Digite-o abaixo. Se não chegar em alguns minutos, olhe também o Spam: é possível que nenhum código tenha sido enviado.</Texto>}
      {aviso && <div role="status" data-testid="troca-aviso-antigo-ok" style={{ color: C.ok, fontSize: 14, fontFamily: ui.sans }}>✓ {aviso}</div>}
      {campoCodigo}
      <Aviso texto={erro} />
      <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Conferindo…" : "Confirmar código"}</button>
      {codigoAntigo && <button type="button" style={botaoSec} disabled={ocupado} data-testid="troca-reenviar" onClick={() => conferir("antigo", codigoAntigo)}>Tentar enviar de novo</button>}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 16px" }}>
        <button type="button" style={acaoSec} onClick={() => recomecar()} data-testid="troca-corrigir">Corrigir dados</button>
        <button type="button" style={acaoSec} onClick={onAjuda} data-testid="troca-ajuda">Preciso de ajuda</button>
      </div>
    </form>
  );

  if (etapa === "fim_aplicada") return (
    <div data-testid="troca-fim-aplicada" role="status" style={{ display: "grid", gap: 14 }}>
      <Titulo cor={C.ok}>✓ E-mail trocado</Titulo>
      <Texto>O e-mail do seu cadastro agora é o que você confirmou. Seu @, itens, pagamentos e histórico continuam exatamente como estavam.</Texto>
      <Situacao ui={ui} emailVerificado pedido="nenhum" acesso />
      <Texto pequeno>Agora ative sua conta com o e-mail novo: o código de ativação vai para ele.</Texto>
      <button style={botao} data-testid="troca-ir-ativar" onClick={() => onAtivar(novoEmail.trim())}>Ativar minha conta com o e-mail novo</button>
    </div>
  );

  if (etapa === "fim_aguardando") return (
    <div data-testid="troca-fim-aguardando" role="status" style={{ display: "grid", gap: 14 }}>
      <Titulo>E-mail confirmado, troca em análise</Titulo>
      <Texto>Você provou que lê o e-mail novo. Isso <b style={{ color: C.texto }}>não troca</b> o e-mail do cadastro nem libera a ativação: a administração ainda vai confirmar que é você por um canal conhecido. Nada se perdeu e nenhum cadastro novo foi criado.</Texto>
      <Situacao ui={ui} emailVerificado pedido="aguardando" acesso={false} />
      <Texto pequeno>Quando a troca for feita, volte aqui, toque em “Ative sua conta” e peça o código de ativação.</Texto>
      {!contatoEnviado ? (
        <form onSubmit={enviarContato} data-testid="troca-contato" style={{ display: "grid", gap: 8 }}>
          <Rotulo>Quer adiantar? Deixe um contato para a administração te responder (WhatsApp, e-mail ou outro @)<input style={campo} value={contato} onChange={ev => setContato(ev.target.value)} onFocus={rolarAoFocar} aria-label="Contato para resposta" maxLength={CONTATO_MAX} /></Rotulo>
          <Aviso texto={erro} />
          <button style={botaoSec} type="submit" disabled={ocupado || contato.trim().length < CONTATO_MIN}>{ocupado ? "Enviando…" : "Enviar contato"}</button>
        </form>
      ) : <Texto data-testid="troca-contato-enviado" role="status">✓ Contato enviado à administração.</Texto>}
      <button style={botao} data-testid="troca-continuar-limitado" onClick={onContinuarLimitado}>Entendi, continuar só com o @</button>
    </div>
  );

  // etapa "sem_pedido": quem acertou o @ + e-mail do cadastro e não pode seguir por aqui
  return (
    <div data-testid="troca-sem-pedido" style={{ display: "grid", gap: 14 }}>
      <Titulo>Não foi possível seguir por aqui</Titulo>
      <Texto data-testid="troca-sem-pedido-texto">{semPedido === "entrar" ? "Seu cadastro já tem conta, então a troca de e-mail não é feita por esta tela. Entre com o seu @ e a sua senha; se precisar trocar o e-mail, peça ajuda à administração." : semPedido === "limite" ? "Você já fez pedidos de troca demais nas últimas 24 horas. Espere e tente de novo amanhã, ou peça ajuda à administração." : "Não conseguimos fazer a troca automaticamente para este cadastro. Peça ajuda: a administração confirma que é você por um canal conhecido. Nenhum código foi enviado."}</Texto>
      <button style={botao} data-testid="troca-sem-pedido-ajuda" onClick={onAjuda}>Preciso de ajuda</button>
      {voltar}
    </div>
  );
}

export function FluxoComprovar({ ui, api, cogInicial = "", emailInicial = "", onVoltar, onPedirCodigo, onEntrar, onAjuda, onContinuarLimitado }) {
  const { C, campo, botao, acaoSec, Titulo, Texto, Aviso, Rotulo, rolarAoFocar } = ui;
  const [cog, setCog] = useState(normalizarCog(cogInicial));
  const [email, setEmail] = useState(String(emailInicial || ""));
  const [detalhe, setDetalhe] = useState("");
  const [contato, setContato] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [etapa, setEtapa] = useState("");                 // "" (formulário) | pedido_recebido | pedir_codigo | entrar | ajuda | limite_diario

  async function enviar(e) {
    e.preventDefault(); setErro("");
    if (!normalizarCog(cog)) return setErro("Informe o seu @.");
    if (!emailValido(email)) return setErro("Digite o e-mail que está no seu cadastro.");
    if (detalhe.trim().length < DETALHE_MIN) return setErro(`Descreva a prova com pelo menos ${DETALHE_MIN} letras.`);
    if (contato.trim().length < CONTATO_MIN) return setErro("Deixe um contato para a administração te responder (WhatsApp, e-mail ou outro @).");
    setOcupado(true);
    const r = await api.pedirComprovacao({ cog, email, detalhe: `${detalhe.trim()}\n\nContato: ${contato.trim()}` });
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    setEtapa(r.etapa);
  }
  const voltar = <div style={{ display: "flex", justifyContent: "center" }}><button type="button" style={acaoSec} onClick={onVoltar} data-testid="comprovar-voltar">Voltar</button></div>;

  if (!etapa) return (
    <form onSubmit={enviar} noValidate data-testid="comprovar-dados" style={{ display: "grid", gap: 14 }}>
      <Titulo>Quero manter meu e-mail e comprovar meu cadastro</Titulo>
      <Texto>Use esta opção se o e-mail do cadastro é o seu, mas o sistema não liberou o código de ativação. Conte outra prova de que o cadastro é seu e a administração analisa. <b style={{ color: C.texto }}>Nenhum código é enviado agora</b> e nenhum cadastro novo é criado.</Texto>
      <Rotulo>Seu @ cadastrado<input style={campo} value={cog} onChange={ev => setCog(ev.target.value)} onFocus={rolarAoFocar} aria-label="Seu @ cadastrado" autoComplete="username" /></Rotulo>
      <Rotulo>E-mail que está no seu cadastro<input style={campo} type="email" value={email} onChange={ev => setEmail(ev.target.value)} onFocus={rolarAoFocar} aria-label="E-mail do cadastro" autoComplete="email" placeholder="seuemail@exemplo.com" /></Rotulo>
      <Rotulo>Descreva outra prova (mínimo {DETALHE_MIN} letras)<textarea style={{ ...campo, minHeight: 96, resize: "vertical" }} value={detalhe} onChange={ev => setDetalhe(ev.target.value)} onFocus={rolarAoFocar} aria-label="Descreva outra prova" maxLength={DESCRICAO_MAX} data-testid="comprovar-detalhe" placeholder="Ex.: paguei o pedido da Smol em outubro; tenho o comprovante de R$ 120. Também posso informar o outro @ que eu usava." /></Rotulo>
      <Texto pequeno data-testid="comprovar-exemplos">Pode ser o comprovante de um pagamento anterior, dados de um pedido que você fez, ou um contato que a administração já conheça. Não envie senhas nem documentos por aqui.</Texto>
      <Rotulo>Contato para resposta (WhatsApp, e-mail ou outro @)<input style={campo} value={contato} onChange={ev => setContato(ev.target.value)} onFocus={rolarAoFocar} aria-label="Contato para resposta" maxLength={CONTATO_MAX} /></Rotulo>
      <Aviso texto={erro} />
      <button style={botao} type="submit" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar para análise"}</button>
      {voltar}
    </form>
  );

  if (etapa === "pedido_recebido") return (
    <div data-testid="comprovar-recebido" role="status" style={{ display: "grid", gap: 14 }}>
      <Titulo cor={C.ok}>✓ Descrição enviada</Titulo>
      <Texto data-testid="comprovar-recebido-texto">Recebemos a sua descrição. Se o @ e o e-mail conferirem com um cadastro, a administração vai analisar e responder pelo contato que você deixou. <b style={{ color: C.texto }}>Nenhum código foi enviado</b> e nada foi liberado ainda.</Texto>
      <Situacao ui={ui} emailVerificado={false} pedido="enviado" acesso={false} />
      <Texto pequeno>Se for aprovado, volte aqui, toque em “Ative sua conta” e peça o código: ele vai para o e-mail que já está no cadastro.</Texto>
      <button style={botao} data-testid="comprovar-continuar-limitado" onClick={onContinuarLimitado}>Entendi, continuar só com o @</button>
    </div>
  );
  const texto = {
    pedir_codigo: "Seu cadastro já pode receber o código de ativação normalmente: não precisa comprovar nada.",
    entrar: "Seu cadastro já tem conta, então não há o que comprovar. Entre com o seu @ e a sua senha. Se não lembrar a senha, use “Esqueci minha senha”.",
    limite_diario: "Você já enviou pedidos demais nas últimas 24 horas. A administração vai analisar o que já foi enviado; tente de novo amanhã se precisar.",
    ajuda: "Não conseguimos seguir por esta tela para este cadastro. Peça ajuda: a administração confirma que é você por um canal conhecido.",
  }[etapa] || "Não conseguimos seguir por esta tela. Peça ajuda à administração.";
  return (
    <div data-testid={`comprovar-etapa-${etapa}`} style={{ display: "grid", gap: 14 }}>
      <Titulo>{etapa === "pedir_codigo" ? "Você não precisa comprovar" : "Não foi possível seguir por aqui"}</Titulo>
      <Texto data-testid="comprovar-etapa-texto">{texto}</Texto>
      {etapa === "pedir_codigo" && <button style={botao} data-testid="comprovar-pedir-codigo" onClick={() => onPedirCodigo(email.trim())}>Pedir o código de ativação</button>}
      {etapa === "entrar" && <button style={botao} data-testid="comprovar-entrar" onClick={onEntrar}>Entrar com @ e senha</button>}
      {(etapa === "ajuda" || etapa === "limite_diario") && <button style={botao} data-testid="comprovar-ajuda" onClick={onAjuda}>Preciso de ajuda</button>}
      {voltar}
    </div>
  );
}
