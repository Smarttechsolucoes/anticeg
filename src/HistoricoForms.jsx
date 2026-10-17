import { useEffect, useState } from "react";
import supabase from "./supabase.js";
import { FORMS_PREVENDA, identidade, filtroDoDono, normalizarPedido } from "./historicoPreVenda.js";

const mono = "'DM Mono',monospace";
const reais = n => "R$" + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TOM = {
  ok:     { cor: "var(--verde)",             borda: "rgba(186,255,57,.2)" },
  espera: { cor: "var(--lilas)",             borda: "rgba(201,168,240,.2)" },
  ruim:   { cor: "rgba(245,240,232,.35)",    borda: "rgba(245,240,232,.06)" },
};

// Aba "Meus forms" em /prevenda: todos os formulários de pré-venda que a joiner preencheu, do mais recente para o mais antigo.
export default function HistoricoForms({ user }) {
  const ident = identidade(user);
  const chaveIdent = ident ? `${ident.cog}|${ident.email}|${ident.arroba}` : "";
  const [pedidos, setPedidos] = useState(null);     // null = carregando
  const [falhas, setFalhas] = useState(0);
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => {
    if (!ident) return;   // sem conta: a tela abaixo já mostra o aviso e nada é consultado
    let vivo = true;
    (async () => {
      const buscas = FORMS_PREVENDA.map(async f => {
        const ou = filtroDoDono(f, ident);
        if (!ou) return [];
        const { data, error } = await supabase.from(f.tabela).select("*").or(ou).order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []).map(p => normalizarPedido(f, p));
      });
      const r = await Promise.allSettled(buscas);
      if (!vivo) return;
      setFalhas(r.filter(x => x.status === "rejected").length);
      setPedidos(r.flatMap(x => (x.status === "fulfilled" ? x.value : [])).sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""))));
    })();
    return () => { vivo = false; };
  }, [chaveIdent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ident) return <div style={{ textAlign: "center", padding: "48px 0", fontFamily: mono, fontSize: 12, color: "rgba(245,240,232,.4)" }}>Entre na sua conta para ver os formulários que você preencheu.</div>;
  if (pedidos === null) return <div style={{ fontFamily: mono, fontSize: 12, opacity: .4, padding: "24px 0" }}>carregando...</div>;

  const por = k => pedidos.filter(p => p.status.chave === k);
  const totalConfirmado = por("confirmado").reduce((a, p) => a + p.valor, 0);
  const lista = filtro === "todos" ? pedidos : por(filtro);
  const filtros = [["todos", "Todos", pedidos.length], ["confirmado", "Confirmados", por("confirmado").length], ["pendente", "Pendentes", por("pendente").length], ["cancelado", "Cancelados", por("cancelado").length]];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[["Formulários", pedidos.length], ["Confirmados", por("confirmado").length], ["Pendentes", por("pendente").length], ["Valor confirmado", reais(totalConfirmado)]].map(([l, v]) => (
          <div key={l} style={{ flex: "1 1 110px", background: "rgba(245,240,232,.04)", border: "1px solid rgba(245,240,232,.08)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: "1px", color: "rgba(245,240,232,.35)", marginBottom: 4, textTransform: "uppercase" }}>{l}</div>
            <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {filtros.map(([id, label, n]) => (
          <button key={id} onClick={() => setFiltro(id)} style={{ fontSize: 10, fontFamily: mono, padding: "4px 12px", borderRadius: 20, cursor: "pointer",
            border: filtro === id ? "1px solid var(--laranja)" : "1px solid rgba(245,240,232,.12)", background: filtro === id ? "rgba(255,92,26,.12)" : "transparent",
            color: filtro === id ? "var(--laranja)" : "rgba(245,240,232,.45)" }}>
            {label} ({n})
          </button>
        ))}
      </div>

      {falhas > 0 && <div style={{ fontFamily: mono, fontSize: 10, color: "#ffb86b", background: "rgba(255,184,107,.08)", border: "1px solid rgba(255,184,107,.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>Não foi possível carregar {falhas === 1 ? "um dos formulários" : `${falhas} dos formulários`} agora; os demais aparecem abaixo. Tente de novo mais tarde.</div>}

      {lista.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◧</div>
          <div style={{ fontSize: 13, color: "rgba(245,240,232,.35)", fontFamily: mono }}>{pedidos.length === 0 ? "Você ainda não preencheu nenhum formulário de pré-venda." : "Nenhum formulário nesta situação."}</div>
        </div>
      ) : lista.map(p => {
        const t = TOM[p.status.tom];
        const data = p.criadoEm ? new Date(p.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
        return (
          <div key={p.chave} style={{ background: "var(--card-bg)", border: `1px solid ${t.borda}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 12, color: "var(--lilas)", letterSpacing: "1px" }}>{p.rotulo}</div>
              {data && <div style={{ fontSize: 9, fontFamily: mono, color: "rgba(245,240,232,.3)", flexShrink: 0 }}>{data}</div>}
            </div>
            {p.linhas.length > 0 && (
              <div style={{ fontSize: 12, lineHeight: 1.6, color: p.status.tom === "ruim" ? "rgba(245,240,232,.4)" : "var(--offwhite)", marginBottom: 8, textDecoration: p.status.tom === "ruim" ? "line-through" : "none" }}>
                {p.linhas.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, fontFamily: mono, color: t.cor, letterSpacing: "1px", border: `1px solid ${t.borda}`, borderRadius: 20, padding: "2px 8px" }}>{p.status.rotulo}</span>
                {p.pagamento && <span style={{ fontSize: 10, fontFamily: mono, color: "rgba(245,240,232,.35)" }}>{p.pagamento}</span>}
                {p.temComprovante && <span style={{ fontSize: 10, fontFamily: mono, color: "rgba(245,240,232,.35)" }}>comprovante enviado</span>}
              </div>
              {p.valor > 0 && <span style={{ fontSize: 12, fontFamily: mono, fontWeight: 700, color: p.status.tom === "ruim" ? "rgba(245,240,232,.25)" : "var(--laranja)" }}>{reais(p.valor)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
