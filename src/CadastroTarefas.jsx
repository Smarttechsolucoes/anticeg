import { useEffect, useState } from "react";
import { MOTIVOS, ORIGENS, CAMPOS, precisaAtencaoNaoVista, rotuloPlanilha, rotuloLeitura } from "./cadastroTarefasLogica.js";

const mono = "'DM Mono',monospace";
const Chip = ({ cor, children, id }) => <span data-testid={id} style={{ fontSize: 9, fontFamily: mono, border: `1px solid ${cor}`, color: cor, borderRadius: 4, padding: "2px 7px", textTransform: "uppercase", letterSpacing: ".05em" }}>{children}</span>;
const Botao = ({ onClick, children, id, destaque }) => <button type="button" data-testid={id} onClick={onClick} style={{ fontSize: 10, fontFamily: mono, background: destaque ? "rgba(186,255,57,.1)" : "transparent", color: destaque ? "#BAFF39" : "rgba(245,240,232,.55)", border: `1px solid ${destaque ? "rgba(186,255,57,.35)" : "rgba(245,240,232,.15)"}`, borderRadius: 6, padding: "5px 11px", cursor: "pointer" }}>{children}</button>;

export function CadastroTarefasPainel({ tarefas, tarefaAberta, erro, acoes }) {
  const [notaAberta, setNotaAberta] = useState(null);
  const [nota, setNota] = useState("");
  const [permissao, setPermissao] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  useEffect(() => { if (!tarefaAberta) return; const el = document.getElementById(`tarefa-${tarefaAberta}`); if (el?.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, [tarefaAberta, tarefas.length]);
  const achou = !tarefaAberta || tarefas.some(t => t.id === tarefaAberta);
  const pendentes = tarefas.filter(t => t.pendente).length;
  return (
    <div data-testid="cadastro-tarefas" style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(245,240,232,.55)" }}>Cadastro: {pendentes} pendente{pendentes === 1 ? "" : "s"} · {tarefas.length} no total</div>
        {permissao === "default" && <Botao id="cadastro-ativar-avisos" onClick={async () => { try { setPermissao(await Notification.requestPermission()); } catch { /* sem suporte */ } }}>ativar avisos do navegador</Botao>}
      </div>
      {erro && <div role="alert" style={{ fontSize: 11, fontFamily: mono, color: "#FF8A80", marginBottom: 10 }}>{erro}</div>}
      {!achou && <div data-testid="cadastro-tarefa-nao-achada" style={{ fontSize: 11, fontFamily: mono, color: "#FFD166", marginBottom: 10 }}>A tarefa #{tarefaAberta} não foi encontrada (pode ter sido apagada ou o link está errado).</div>}
      {tarefas.length === 0 && <div style={{ textAlign: "center", padding: "28px 0", fontSize: 12, color: "rgba(245,240,232,.25)", fontFamily: mono }}>Nenhuma tarefa de cadastro ainda.</div>}
      {tarefas.map(t => {
        const pl = rotuloPlanilha(t), le = rotuloLeitura(t), aberta = t.id === tarefaAberta, falhaNova = precisaAtencaoNaoVista(t);
        return (
          <div key={t.id} id={`tarefa-${t.id}`} data-testid={`tarefa-${t.id}`} data-pendente={t.pendente ? "1" : "0"} data-aberta={aberta ? "1" : "0"}
               style={{ background: t.pendente ? "rgba(201,168,240,.06)" : "var(--card-bg)", border: `1px solid ${aberta ? "#BAFF39" : t.pendente ? "rgba(201,168,240,.3)" : "rgba(245,240,232,.07)"}`, boxShadow: aberta ? "0 0 0 2px rgba(186,255,57,.25)" : "none", borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#F5F0E8", fontFamily: mono }}>@{t.cog || "?"}</span>
              <span style={{ fontSize: 9, color: "rgba(245,240,232,.3)", fontFamily: mono }}>#{t.id} · {new Date(t.criado_em).toLocaleDateString("pt-BR")} {new Date(t.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {ORIGENS[t.origem] || t.origem}{t.tem_conta ? " · tem conta" : " · sem conta"}</span>
              <Chip cor={le.cor} id={`tarefa-${t.id}-leitura`}>{le.texto}</Chip>
              <Chip cor={pl.cor} id={`tarefa-${t.id}-planilha`}>{pl.texto}</Chip>
            </div>
            {Object.entries(t.campos || {}).map(([campo, v]) => (
              <div key={campo} style={{ fontSize: 11, fontFamily: mono, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                <span style={{ fontSize: 9, background: "rgba(245,240,232,.07)", borderRadius: 4, padding: "2px 6px", color: "rgba(245,240,232,.4)", textTransform: "uppercase" }}>{CAMPOS[campo] || campo}</span>
                {v && "pedido" in v
                  ? <><span style={{ color: "rgba(245,240,232,.4)" }}>pediu:</span><span style={{ color: "#F5F0E8" }}>{v.pedido || "—"}</span>{v.mensagem && <span style={{ color: "rgba(245,240,232,.4)" }}>“{v.mensagem}”</span>}</>
                  : <><span style={{ color: "rgba(245,240,232,.35)", textDecoration: "line-through" }}>{v?.de || "—"}</span><span style={{ color: "rgba(245,240,232,.25)" }}>→</span><span style={{ color: "#F5F0E8" }}>{v?.para || "—"}</span></>}
              </div>
            ))}
            {t.planilha_status === "atencao" && <div data-testid={`tarefa-${t.id}-motivo`} style={{ fontSize: 11, fontFamily: mono, color: "#FF8A80", marginTop: 6 }}>{MOTIVOS[t.planilha_motivo] || t.planilha_motivo || "Falha na planilha"}{t.planilha_ultimo_erro ? ` · ${t.planilha_ultimo_erro}` : ""}</div>}
            {t.origem === "solicitacao_sem_prova" && !t.resolvida_em && <div style={{ fontSize: 10, fontFamily: mono, color: "#FFD166", marginTop: 6 }}>Pedido feito só com o @ (sem login): confirme com a pessoa por um canal conhecido antes de mudar qualquer coisa.</div>}
            {t.resolvida_em && t.nota && <div style={{ fontSize: 10, fontFamily: mono, color: "rgba(245,240,232,.45)", marginTop: 6 }}>Nota: {t.nota}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {!t.lida_em && !t.resolvida_em && <Botao id={`tarefa-${t.id}-lida`} onClick={() => acoes.marcarLida(t.id)}>✓ lida</Botao>}
              {falhaNova && !t.resolvida_em && <Botao id={`tarefa-${t.id}-vi-falha`} onClick={() => acoes.vejaFalha(t.id)}>vi a falha</Botao>}
              {t.tipo === "alteracao" && t.planilha_status !== "sincronizada" && (t.planilha_status === "atencao" || t.planilha_tentativas > 0) && !t.resolvida_em && <Botao id={`tarefa-${t.id}-reprocessar`} destaque onClick={() => acoes.reprocessar(t.id)}>reprocessar envio</Botao>}
              {!t.resolvida_em && (t.tipo === "solicitacao" || t.planilha_status === "atencao") && <Botao id={`tarefa-${t.id}-resolver`} onClick={() => { setNotaAberta(notaAberta === t.id ? null : t.id); setNota(""); }}>resolver…</Botao>}
            </div>
            {notaAberta === t.id && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <input data-testid={`tarefa-${t.id}-nota`} value={nota} onChange={e => setNota(e.target.value)} maxLength={500} placeholder="como foi resolvido (canal e data)" style={{ flex: 1, minWidth: 200, background: "rgba(0,0,0,.25)", border: "1px solid rgba(245,240,232,.15)", borderRadius: 6, color: "#F5F0E8", padding: "6px 10px", fontSize: 12 }} />
                <Botao id={`tarefa-${t.id}-confirmar-resolver`} destaque onClick={async () => { await acoes.resolver(t.id, nota); setNotaAberta(null); }}>confirmar</Botao>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
