import { useState } from "react";
import { emailValido } from "./joinerAuth.js";

// Tela OBRIGATÓRIA depois de ativar a conta: nome para claim (o nome público dos claims e do ao vivo = joiners.nome_site), @ apenas CONFIRMADO (não se edita aqui; há um pedido à administração)
// e e-mail confirmado (para trocar, o endereço NOVO precisa ser verificado pelo link que o Auth envia; o antigo continua valendo até lá). O servidor só libera os dados da conta depois de "Concluir".
const C = { bg: "#17141f", borda: "rgba(245,240,232,0.14)", texto: "#F5F0E8", mudo: "rgba(245,240,232,0.72)", destaque: "#BAFF39", erro: "#FF8A80", ok: "#7CE08A" };
const mono = "'DM Mono',monospace";
// parágrafos, rótulos e campos na fonte sem serifa do site (mais legível); título e botões mantêm a fonte da identidade visual
const sans = "var(--sans, system-ui, 'Segoe UI', Roboto, sans-serif)";
const campo = { width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 8, border: `1px solid ${C.borda}`, background: "rgba(0,0,0,0.25)", color: C.texto, fontSize: 16, fontFamily: sans };
const botao = { padding: "13px 16px", borderRadius: 8, border: "none", background: C.destaque, color: "#111", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: mono, width: "100%", minHeight: 46 };
const botaoSec = { ...botao, background: "transparent", color: C.texto, border: `1px solid ${C.borda}`, fontWeight: 500, minHeight: 42, fontSize: 13 };
const link = { background: "none", border: "none", color: C.destaque, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontSize: 14, padding: "8px 0", minHeight: 40, fontFamily: sans, textAlign: "left" };
const Rotulo = ({ children }) => <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: C.mudo, marginBottom: 6 }}>{children}</div>;
const Msg = ({ cor, children, id }) => <div data-testid={id} role="status" style={{ fontSize: 14, fontFamily: sans, lineHeight: 1.5, color: cor }}>{children}</div>;
const Dica = ({ children }) => <div style={{ fontSize: 13, fontFamily: sans, color: C.mudo, lineHeight: 1.5, marginTop: 6 }}>{children}</div>;
// com o teclado aberto no celular, traz o campo focado para o meio da área visível
const rolarAoFocar = ev => { const el = ev.target; setTimeout(() => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* sem suporte */ } }, 250); };

export default function CompletarPerfil({ api, perfil, onConcluido, sobreposto = false }) {
  const nomeAtual = String(perfil?.nome_site || "");
  const [nome, setNome] = useState(nomeAtual);          // já vem preenchido com o nome que consta no cadastro, quando existe; a pessoa só confere
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [painel, setPainel] = useState("");                 // "" | "arroba" | "email"
  const [valor, setValor] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [aviso, setAviso] = useState({ cor: C.ok, texto: "", id: "" });
  const arroba = perfil?.arroba || (perfil?.cog ? "@" + perfil.cog : "");

  async function concluir(e) {
    e.preventDefault(); setErro("");
    if (String(nome).trim().length < 2) { setErro("Digite o nome que aparece nos seus claims (pelo menos 2 letras)."); return; }
    setOcupado(true);
    const r = await api.concluirPerfil(nome);
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    onConcluido?.(r);
  }
  async function enviarPedidoArroba(e) {
    e.preventDefault(); setErro(""); setAviso({ cor: C.ok, texto: "", id: "" });
    if (!String(valor).trim()) { setErro("Digite o @ correto."); return; }
    setOcupado(true);
    const r = await api.solicitarCorrecao({ tipo: "arroba", valor, mensagem });
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setAviso({ cor: C.ok, id: "perfil-pedido-enviado", texto: "Pedido enviado à administração. Você pode concluir agora; o @ só muda depois que a administração confirmar." });
    setPainel(""); setValor(""); setMensagem("");
  }
  async function trocarEmail(e) {
    e.preventDefault(); setErro(""); setAviso({ cor: C.ok, texto: "", id: "" });
    if (!emailValido(valor)) { setErro("Digite um e-mail válido."); return; }
    setOcupado(true);
    const r = await api.trocarEmail(valor);
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setAviso({ cor: C.ok, id: "perfil-email-enviado", texto: "Enviamos um link de confirmação para o endereço novo. O e-mail atual continua valendo até você confirmar o novo." });
    setPainel(""); setValor("");
  }

  // fundo rolável: com o teclado aberto no celular o cartão fica no topo e a página rola até o botão
  const fundo = sobreposto
    ? { position: "fixed", inset: 0, zIndex: 9999, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", background: "var(--bg, #131310)", display: "flex", padding: "max(16px, env(safe-area-inset-top, 0px)) 16px max(24px, env(safe-area-inset-bottom, 0px))", boxSizing: "border-box" }
    : { minHeight: "100vh", background: "var(--bg, #131310)", display: "flex", padding: "max(16px, env(safe-area-inset-top, 0px)) 16px max(24px, env(safe-area-inset-bottom, 0px))", boxSizing: "border-box" };

  return (
    <div style={fundo}>
      <form data-testid="completar-perfil" onSubmit={concluir} style={{ background: C.bg, border: `1px solid ${C.borda}`, borderRadius: 14, padding: "26px 22px", width: "min(460px, 100%)", margin: "auto", color: C.texto, display: "grid", gap: 16, boxSizing: "border-box" }}>
        <div role="heading" aria-level={2} style={{ margin: 0, fontFamily: mono, fontSize: 18, fontWeight: 700, color: C.destaque, lineHeight: 1.3, letterSpacing: 0 }}>Confira seus dados</div>
        <p style={{ margin: 0, fontSize: 14, fontFamily: sans, color: C.mudo, lineHeight: 1.6 }}>Sua conta foi ativada. Falta só conferir como você aparece no site. Seus pedidos, pagamentos, itens e envios continuam ligados ao seu cadastro.</p>

        <div>
          <Rotulo>Nome para claim</Rotulo>
          <input data-testid="perfil-nome" style={campo} value={nome} maxLength={60} autoComplete="nickname" onChange={e => setNome(e.target.value)} onFocus={rolarAoFocar} aria-label="Nome para claim" />
          <Dica>{nomeAtual.trim() ? "Já preenchemos com o nome que consta no seu cadastro: confira e ajuste se quiser. " : ""}É o nome público usado nos claims e no ao vivo. O nome completo usado nos envios é outro campo.</Dica>
        </div>

        <div>
          <Rotulo>Seu @</Rotulo>
          <div data-testid="perfil-arroba" style={{ ...campo, opacity: 0.85 }}>{arroba}</div>
          <button type="button" data-testid="perfil-pedir-arroba" style={link} onClick={() => { setPainel(painel === "arroba" ? "" : "arroba"); setErro(""); setValor(""); }}>O meu @ está errado</button>
        </div>
        {painel === "arroba" && (
          <div data-testid="painel-arroba" style={{ display: "grid", gap: 10, border: `1px solid ${C.borda}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 14, fontFamily: sans, color: C.mudo, lineHeight: 1.5 }}>O @ não é editado aqui. Diga qual é o certo e a administração confere e corrige.</div>
            <input data-testid="perfil-arroba-certo" style={campo} value={valor} maxLength={80} placeholder="@ correto" onChange={e => setValor(e.target.value)} onFocus={rolarAoFocar} aria-label="@ correto" />
            <textarea style={{ ...campo, minHeight: 64 }} value={mensagem} maxLength={500} placeholder="Explique em uma frase (opcional)" onChange={e => setMensagem(e.target.value)} onFocus={rolarAoFocar} aria-label="Mensagem para a administração" />
            <button type="button" data-testid="perfil-enviar-pedido" style={botaoSec} disabled={ocupado} onClick={enviarPedidoArroba}>Enviar pedido à administração</button>
          </div>
        )}

        <div>
          <Rotulo>E-mail</Rotulo>
          <div data-testid="perfil-email" style={{ ...campo, opacity: 0.85 }}>{perfil?.email_mascarado || "(sem e-mail)"}</div>
          <button type="button" data-testid="perfil-trocar-email" style={link} onClick={() => { setPainel(painel === "email" ? "" : "email"); setErro(""); setValor(""); }}>Quero trocar o e-mail</button>
        </div>
        {painel === "email" && (
          <div data-testid="painel-email" style={{ display: "grid", gap: 10, border: `1px solid ${C.borda}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 14, fontFamily: sans, color: C.mudo, lineHeight: 1.5 }}>O e-mail novo só substitui o atual depois de você confirmar pelo link que enviarmos para ele. Se esse endereço já for de outro cadastro, peça à administração.</div>
            <input data-testid="perfil-email-novo" type="email" style={campo} value={valor} maxLength={200} autoComplete="email" placeholder="seuemail@exemplo.com" onChange={e => setValor(e.target.value)} onFocus={rolarAoFocar} aria-label="Novo e-mail" />
            <button type="button" data-testid="perfil-enviar-email" style={botaoSec} disabled={ocupado} onClick={trocarEmail}>Enviar link de confirmação</button>
          </div>
        )}

        {aviso.texto && <Msg id={aviso.id} cor={aviso.cor}>{aviso.texto}</Msg>}
        {erro && <Msg id="perfil-erro" cor={C.erro}>{erro}</Msg>}
        <button type="submit" data-testid="perfil-concluir" style={botao} disabled={ocupado}>{ocupado ? "Salvando…" : "Concluir e entrar"}</button>
      </form>
    </div>
  );
}
