// Painel da administradora: contas das joiners (vínculos pendentes, cadastros com problema, troca de e-mail, pedidos antigos sem dona).
// Tudo passa por funções do banco que conferem "é administradora" no servidor (J1 e J4c-0); este arquivo só mostra e chama.
// Nada aqui apaga pedido, claim, pagamento ou cadastro.
import { useCallback, useEffect, useState } from "react";
import { clienteAdmin } from "./adminAuth.js";

const mono = "'DM Mono',monospace";
const C = { fundo: "rgba(245,240,232,.04)", borda: "rgba(245,240,232,.12)", mudo: "rgba(245,240,232,.55)", texto: "#F5F0E8", destaque: "#FF5C1A", ok: "#BAFF39", erro: "#ff6b6b" };
const caixa = { background: C.fundo, border: `1px solid ${C.borda}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 };
const campo = { background: "rgba(245,240,232,.06)", border: `1px solid ${C.borda}`, borderRadius: 6, padding: "7px 10px", color: C.texto, fontFamily: mono, fontSize: 12, minWidth: 0 };
const botao = (cor = C.destaque) => ({ background: "transparent", border: `1px solid ${cor}`, color: cor, borderRadius: 6, padding: "6px 12px", fontFamily: mono, fontSize: 11, cursor: "pointer" });
const rot = { fontFamily: mono, fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: C.mudo };

// Escolhe UMA joiner pelo id permanente (a busca mostra e-mail e se já tem conta, para decidir os casos repetidos)
function BuscaJoiner({ cliente, rotulo, onEscolher }) {
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState([]);
  const [msg, setMsg] = useState("");
  async function buscar() {
    setMsg("");
    const { data, error } = await cliente.rpc("admin_buscar_joiners", { p_termo: termo });
    if (error) { setMsg(error.message); return; }
    setAchados(data || []); if (!(data || []).length) setMsg("Nenhuma joiner encontrada (digite ao menos 2 letras).");
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input style={{ ...campo, flex: 1 }} value={termo} onChange={e => setTermo(e.target.value)} placeholder="Buscar joiner por @ ou nome" aria-label="Buscar joiner" onKeyDown={e => { if (e.key === "Enter") buscar(); }} />
        <button style={botao(C.mudo)} onClick={buscar}>Buscar</button>
      </div>
      {msg && <div style={{ color: C.mudo, fontSize: 11, fontFamily: mono }}>{msg}</div>}
      {achados.map(j => (
        <div key={j.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontFamily: mono, fontSize: 11, color: C.texto, borderTop: `1px solid ${C.borda}`, paddingTop: 6 }}>
          <span style={{ flex: 1, minWidth: 180 }}>#{j.id} · @{j.cog} · {j.nome_site || "—"} · {j.email || "sem e-mail"}{j.conta_vinculada ? " · já tem conta" : ""}</span>
          <button style={botao(C.ok)} onClick={() => onEscolher(j)}>{rotulo}</button>
        </div>
      ))}
    </div>
  );
}

export default function AdminContas() {
  const [cliente] = useState(() => clienteAdmin());
  const [pendentes, setPendentes] = useState([]);
  const [problemas, setProblemas] = useState([]);
  const [orfaos, setOrfaos] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);   // J6: pedidos de perfil (@, e-mail, ativação sem vínculo confiável)
  const [fila, setFila] = useState([]);                      // J6: fila de saída para a planilha
  const [aConfirmar, setAConfirmar] = useState([]);           // J6: cadastros cujo vínculo (e-mail/@) ainda não foi confirmado por evidência independente
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  const [abertoTroca, setAbertoTroca] = useState(null);       // joiner_id com o formulário de troca de e-mail aberto
  const [novoEmail, setNovoEmail] = useState("");
  const [motivo, setMotivo] = useState("");
  const [abertoOrfao, setAbertoOrfao] = useState(null);       // e-mail do grupo de pedidos aberto para vincular
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [a, b, c, d, e, f] = await Promise.all([
      cliente.rpc("admin_vinculos_pendentes"),
      cliente.rpc("admin_joiners_problemas", { p_limite: 500 }),
      cliente.rpc("admin_pedidos_orfaos", { p_limite: 1000 }),
      cliente.rpc("admin_perfil_solicitacoes"),
      cliente.rpc("admin_perfil_sync_pendentes"),
      cliente.rpc("admin_vinculos_a_confirmar", { p_limite: 300 }),
    ]);
    setPendentes(a.data || []); setProblemas(b.data || []); setOrfaos(c.data || []); setSolicitacoes(d.data || []); setFila(e.data || []); setAConfirmar(f.data || []);
    const falha = a.error || b.error || c.error;   // d/e/f só existem depois do J6: a ausência não é falha
    if (falha) setAviso({ tipo: "erro", texto: "Não foi possível carregar tudo: " + falha.message });
    setCarregando(false);
  }, [cliente]);
  useEffect(() => { carregar(); }, [carregar]);

  const ok = texto => setAviso({ tipo: "ok", texto });
  const falhou = texto => setAviso({ tipo: "erro", texto });

  async function resolver(p, aprovar, joiner) {
    if (aprovar && !window.confirm(`Ligar a conta ${p.email_da_conta} ao cadastro @${joiner.cog} (#${joiner.id})? Confirme antes que a pessoa é mesmo a dona deste @.`)) return;
    const { data, error } = await cliente.rpc("admin_resolver_vinculo", { p_id: p.id, p_aprovar: aprovar, p_joiner_id: aprovar ? joiner.id : null });
    if (error) return falhou(error.message);
    ok(data?.status === "aprovado" ? `Conta ligada ao @${joiner.cog}.` : "Pedido recusado.");
    carregar();
  }
  async function trocarEmail(j) {
    if (!window.confirm(`Trocar o e-mail do cadastro @${j.cog} para ${novoEmail.trim()}?\n\nA conta de login antiga será desvinculada (nada é apagado) e a pessoa ativa de novo com o e-mail novo. Só faça depois de confirmar quem é a pessoa por outro canal.`)) return;
    const { data, error } = await cliente.rpc("admin_trocar_email_joiner", { p_joiner_id: j.joiner_id, p_novo_email: novoEmail.trim(), p_motivo: motivo.trim() });
    if (error) return falhou(error.message);
    ok(`E-mail trocado. ${data?.conta_desvinculada ? "A conta antiga foi desvinculada. " : ""}${data?.pedidos_vinculados ? `${data.pedidos_vinculados} pedido(s) do e-mail antigo continuam dela.` : (data?.email_antigo_era_exclusivo === false ? "O e-mail antigo era compartilhado: nenhum pedido foi vinculado sozinho." : "")}`);
    setAbertoTroca(null); setNovoEmail(""); setMotivo(""); carregar();
  }
  async function vincularEmail(email, j) {
    if (!window.confirm(`Vincular TODOS os pedidos feitos com ${email} ao cadastro @${j.cog} (#${j.id})?`)) return;
    const { data, error } = await cliente.rpc("admin_vincular_pedidos_do_email", { p_email: email, p_joiner_id: j.id, p_motivo: "vínculo pelo painel" });
    if (error) return falhou(error.message);
    ok(`${data} pedido(s) vinculado(s) a @${j.cog}.`); setAbertoOrfao(null); carregar();
  }

  async function resolverSolicitacao(sol, status) {
    const nota = status === "recusada" ? window.prompt("Motivo da recusa (a pessoa não vê; fica no registro):", "") : window.prompt("Anote o que foi feito (ex.: @ corrigido no cadastro e na planilha):", "");
    if (nota === null) return;
    const { error } = await cliente.rpc("admin_resolver_solicitacao", { p_id: sol.id, p_status: status, p_nota: nota });
    if (error) falhou("Não foi possível registrar: " + error.message); else { ok("Pedido registrado."); carregar(); }
  }
  async function confirmarVinculo(v) {
    const informado = window.prompt(`Digite o e-mail COMPLETO que a pessoa (@${v.cog}) informou pelo canal conhecido. O sistema compara com o cadastro; o que você digita não é mostrado nem guardado.`, "");
    if (informado === null) return;
    if (!informado.includes("@")) return falhou("Digite o e-mail completo informado pela pessoa. Nada foi alterado.");
    const nota = window.prompt(`Como você confirmou que o @${v.cog} é a pessoa certa? (canal e data, ex.: WhatsApp em 09/11; mínimo 5 letras — fica no registro)`, "");
    if (nota === null) return;
    if (nota.trim().length < 5) return falhou("Anote como confirmou (pelo menos 5 letras). Nada foi alterado.");
    const { error } = await cliente.rpc("admin_confirmar_vinculo", { p_joiner_id: v.joiner_id, p_nota: nota.trim(), p_email_informado: informado.trim() });
    if (error) falhou("Não foi possível confirmar: " + error.message); else { ok(`Vínculo do @${v.cog} confirmado. Ela já pode pedir o código de ativação.`); carregar(); }
  }
  async function reprocessar(item) {
    const { error } = await cliente.rpc("admin_reprocessar_perfil_sync", { p_id: item.id });
    if (error) falhou("Não foi possível reprocessar: " + error.message); else { ok("Item recolocado na fila."); carregar(); }
  }
  async function enviarFilaAgora() {
    setEnviando(true);
    const { data, error } = await cliente.functions.invoke("perfil-sync", { body: {} });
    setEnviando(false);
    if (error) falhou("Não foi possível chamar o envio agora."); else { ok(`Envio feito: ${data?.enviados ?? 0} enviado(s), ${data?.falharam ?? 0} com falha.`); carregar(); }
  }
  // pedidos sem dona agrupados por e-mail
  const grupos = Object.values(orfaos.reduce((m, o) => { const k = (o.email || "(sem e-mail)").toLowerCase(); (m[k] ||= { email: o.email || "", chave: k, itens: [] }).itens.push(o); return m; }, {}));

  return (
    <div style={{ color: C.texto, fontFamily: mono, maxWidth: 980 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, marginBottom: 4 }}>CONTAS DAS JOINERS</div>
      <div style={{ color: C.mudo, fontSize: 11, lineHeight: 1.6, marginBottom: 14 }}>
        Resolva aqui quem não consegue ativar sozinha (e-mail ausente, inválido, repetido ou perdido). Antes de ligar uma conta a um cadastro ou trocar um e-mail, confirme a identidade por outro canal. Cada troca fica registrada.
      </div>
      {aviso.texto && <div role="status" style={{ ...caixa, borderColor: aviso.tipo === "erro" ? C.erro : C.ok, color: aviso.tipo === "erro" ? C.erro : C.ok, fontSize: 12 }}>{aviso.texto}</div>}
      {carregando && <div style={{ color: C.mudo, fontSize: 12, marginBottom: 12 }}>Carregando…</div>}

      <div style={caixa} data-testid="admin-solicitacoes">
        <div style={rot}>Pedidos de perfil e ativações sem vínculo confiável ({solicitacoes.filter(x => x.status === "aberta").length} abertos)</div>
        <div style={{ color: C.mudo, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>Correção de @ ou de e-mail pedida pela própria pessoa, e quem tentou ativar mas teve o e-mail/@ alterado depois da fotografia confiável. Confirme a identidade por um canal conhecido (WhatsApp, @) antes de corrigir.</div>
        {!solicitacoes.length && <div style={{ color: C.mudo, fontSize: 12, marginTop: 8 }}>Nenhum pedido.</div>}
        {solicitacoes.map(x => (
          <div key={x.id} style={{ borderTop: `1px solid ${C.borda}`, marginTop: 8, paddingTop: 8, fontSize: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 220 }}>#{x.joiner_id ?? "—"} · @{x.cog || "?"} · <b style={{ color: C.destaque }}>{x.tipo === "ativacao_sem_vinculo" ? "ativação sem vínculo confiável" : x.tipo}</b>{x.valor_pedido ? <> · pediu: <b>{x.valor_pedido}</b></> : null}{x.mensagem ? <> · “{x.mensagem}”</> : null} · {x.status} · {new Date(x.criado_em).toLocaleString("pt-BR")}</span>
            {x.status === "aberta" && <><button style={botao(C.ok)} onClick={() => resolverSolicitacao(x, "resolvida")}>Resolvido</button><button style={botao(C.erro)} onClick={() => resolverSolicitacao(x, "recusada")}>Recusar</button></>}
          </div>
        ))}
      </div>

      <div style={caixa} data-testid="admin-vinculos-confirmar">
        <div style={rot}>Vínculos aguardando confirmação ({aConfirmar.length}{aConfirmar.length >= 300 ? "+" : ""})</div>
        <div style={{ color: C.mudo, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>A ativação é AUTOMÁTICA: a pessoa recebe o código sozinha quando o e-mail do cadastro é válido e só dela, o @ não se repete e nem o e-mail nem o @ foram alterados depois da fotografia confiável do cadastro (ou quando você já confirmou o vínculo). Os cadastros desta lista NÃO passaram nessa regra e não recebem código sozinhos: e-mail ausente, inválido ou compartilhado, @ repetido, ou e-mail/@ alterado depois da fotografia. Para eles, confirme por um canal conhecido (WhatsApp, @). Quem pediu ajuda aparece primeiro. Procedimento: (1) a pessoa fala com você pelo próprio @ ou por um contato já conhecido; (2) ela diz QUAL e-mail usa na Anti CEG; (3) clique em Confirmar vínculo e DIGITE o e-mail completo que ela informou — o sistema confere com o cadastro sem mostrá-lo; (4) se não conferir, nada é confirmado: use "Trocar e-mail" mais abaixo. Conhecer o @ não prova que o e-mail é dela.</div>
        {!aConfirmar.length && <div style={{ color: C.mudo, fontSize: 12, marginTop: 8 }}>Nenhum cadastro aguardando.</div>}
        {aConfirmar.map(v => (
          <div key={v.joiner_id} style={{ borderTop: `1px solid ${C.borda}`, marginTop: 8, paddingTop: 8, fontSize: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 220 }}>#{v.joiner_id} · @{v.cog} · {v.nome_site || "—"} · e-mail @{v.dominio || "?"}{v.tem_conta ? " · já tem conta" : ""}{v.itens ? ` · ${v.itens} pedido(s)` : ""}{v.pedido_de_ajuda ? <> · <b style={{ color: C.destaque }}>pediu ajuda</b></> : null}</span>
            <button style={botao(C.ok)} onClick={() => confirmarVinculo(v)}>Confirmar vínculo</button>
          </div>
        ))}
      </div>

      <div style={caixa} data-testid="admin-fila-planilha">
        <div style={rot}>Fila de envio à planilha ({fila.filter(x => x.status === "pendente" || x.status === "falhou").length} pendentes)</div>
        <div style={{ color: C.mudo, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>E-mails verificados que ainda precisam ser gravados na aba Dados. Falhas ficam aqui e são tentadas de novo; o envio é seguro para repetir.</div>
        <div style={{ marginTop: 8 }}><button style={botao(C.ok)} disabled={enviando} onClick={enviarFilaAgora}>{enviando ? "Enviando…" : "Enviar agora"}</button></div>
        {fila.map(x => (
          <div key={x.id} style={{ borderTop: `1px solid ${C.borda}`, marginTop: 8, paddingTop: 8, fontSize: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 220 }}>#{x.joiner_id} · @{x.cog || "?"} · {x.tipo} · <b style={{ color: x.status === "falhou" ? C.erro : C.destaque }}>{x.status}</b> · tentativas: {x.tentativas}{x.ultimo_erro ? <> · {x.ultimo_erro}</> : null}</span>
            {(x.status === "falhou" || x.status === "pendente") && <button style={botao()} onClick={() => reprocessar(x)}>Reprocessar</button>}
          </div>
        ))}
      </div>

      <div style={caixa}>
        <div style={rot}>Pedidos de ligação de conta ({pendentes.length})</div>
        {!pendentes.length && <div style={{ color: C.mudo, fontSize: 12, marginTop: 8 }}>Nenhum pedido aberto.</div>}
        {pendentes.map(p => (
          <div key={p.id} style={{ borderTop: `1px solid ${C.borda}`, marginTop: 10, paddingTop: 10, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12 }}>Conta <b>{p.email_da_conta}</b> pediu o @ <b>{p.cog_pedido}</b> · motivo: {p.motivo} · {new Date(p.criado_em).toLocaleString("pt-BR")}</div>
            <BuscaJoiner cliente={cliente} rotulo="Ligar a esta joiner" onEscolher={j => resolver(p, true, j)} />
            <div><button style={botao(C.erro)} onClick={() => window.confirm("Recusar este pedido?") && resolver(p, false)}>Recusar pedido</button></div>
          </div>
        ))}
      </div>

      <div style={caixa}>
        <div style={rot}>Cadastros que não ativam sozinhos ({problemas.length})</div>
        {!problemas.length && <div style={{ color: C.mudo, fontSize: 12, marginTop: 8 }}>Nenhum.</div>}
        {problemas.map(j => (
          <div key={j.joiner_id} style={{ borderTop: `1px solid ${C.borda}`, marginTop: 8, paddingTop: 8, fontSize: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 200 }}>#{j.joiner_id} · @{j.cog} · {j.nome_site || "—"} · {j.email || "sem e-mail"} · <b style={{ color: C.destaque }}>{j.problema}</b>{j.conta_vinculada ? " · já tem conta" : ""}</span>
              <button style={botao()} onClick={() => { setAbertoTroca(abertoTroca === j.joiner_id ? null : j.joiner_id); setNovoEmail(""); setMotivo(""); }}>Trocar e-mail</button>
            </div>
            {abertoTroca === j.joiner_id && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <input style={{ ...campo, flex: 1, minWidth: 200 }} type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="novo e-mail" aria-label="Novo e-mail" />
                <input style={{ ...campo, flex: 1, minWidth: 200 }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="motivo (como confirmou quem é)" aria-label="Motivo" />
                <button style={botao(C.ok)} disabled={!novoEmail.includes("@")} onClick={() => trocarEmail(j)}>Confirmar troca</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={caixa}>
        <div style={rot}>Pedidos antigos sem dona ({orfaos.length} pedidos · {grupos.length} e-mails)</div>
        <div style={{ color: C.mudo, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>Pedidos feitos com um e-mail ou @ que nenhuma conta alcança sozinha (e-mail antigo, digitado diferente ou compartilhado). Ligue ao cadastro certo; nenhum pedido é alterado.</div>
        {grupos.map(g => (
          <div key={g.chave} style={{ borderTop: `1px solid ${C.borda}`, marginTop: 8, paddingTop: 8, fontSize: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 200 }}><b>{g.email || "(sem e-mail)"}</b> · {g.itens.length} pedido(s) · {[...new Set(g.itens.map(i => i.tabela.replace("pedidos_", "")))].join(", ")}{g.itens.some(i => i.social) ? ` · @ digitado: ${[...new Set(g.itens.map(i => i.social).filter(Boolean))].slice(0, 3).join(", ")}` : ""}</span>
              {g.email && <button style={botao()} onClick={() => setAbertoOrfao(abertoOrfao === g.chave ? null : g.chave)}>Vincular…</button>}
            </div>
            {abertoOrfao === g.chave && <div style={{ marginTop: 8 }}><BuscaJoiner cliente={cliente} rotulo="Vincular a esta joiner" onEscolher={j => vincularEmail(g.email, j)} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
