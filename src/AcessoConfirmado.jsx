// Bloco "Seu acesso" do formulário WEVERSE BLACK FRIDAY: só aparece para quem tem um pedido CONFIRMADO.
// O conteúdo (endereço, telefone, print) NÃO está no código do site: vem da função do banco weverse_meu_acesso() — que só responde
// para a conta que tem pedido com status "confirmado" (ou para a administração) — e a imagem fica em um bucket PRIVADO do Storage,
// lida por link assinado e curto. Sem pedido confirmado, a função devolve nulo e nada é mostrado.
import { useEffect, useState } from "react";
import supabase from "./supabase.js";

const mono = "'DM Mono',monospace";

function Copiar({ texto }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => { try { navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1800); } catch { /* sem área de transferência */ } }}
      style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(245,240,232,.2)", background: "transparent", color: ok ? "#4ade80" : "rgba(245,240,232,.7)", fontFamily: mono, fontSize: 10, cursor: "pointer" }}>
      {ok ? "✓ copiado" : "copiar"}
    </button>
  );
}

/** Mostra os blocos [{ titulo, linhas: [[rótulo, valor], ...] }] e a imagem (caminho no bucket). Exportado separado para teste. */
export function CartaoAcesso({ acesso, imagemUrl }) {
  if (!acesso) return null;
  const blocos = Array.isArray(acesso.blocos) ? acesso.blocos : [];
  return (
    <div data-testid="acesso-confirmado" style={{ background: "rgba(37,211,102,.07)", border: "1px solid rgba(37,211,102,.35)", borderRadius: 12, padding: "16px 16px 8px", marginBottom: 28 }}>
      <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "2px", color: "#25d366", marginBottom: 8 }}>✓ PAGAMENTO CONFIRMADO</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{acesso.titulo || "Seu acesso ao endereço"}</div>
      {acesso.aviso && <div style={{ fontFamily: mono, fontSize: 10, lineHeight: 1.7, color: "rgba(245,240,232,.7)", marginBottom: 12 }}>☆ {acesso.aviso}</div>}
      {blocos.map((b, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          {b.titulo && <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "1.5px", color: "rgba(245,240,232,.5)", marginBottom: 6, textTransform: "uppercase" }}>{b.titulo}</div>}
          {(b.linhas || []).map(([rotulo, valor], k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: "1px solid rgba(245,240,232,.07)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(245,240,232,.45)" }}>{rotulo}</div>
                <div style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-word" }}>{valor}</div>
              </div>
              <Copiar texto={String(valor)} />
            </div>
          ))}
        </div>
      ))}
      {(imagemUrl || acesso.imagem_data) && <img src={imagemUrl || acesso.imagem_data} alt="Print do endereço na Weverse" style={{ display: "block", width: "100%", height: "auto", borderRadius: 8, marginBottom: 14, background: "rgba(245,240,232,.06)" }} />}
    </div>
  );
}

export default function AcessoConfirmado({ rpc = "weverse_meu_acesso", bucket = "weverse-privado" }) {
  const [acesso, setAcesso] = useState(null);
  const [imagemUrl, setImagemUrl] = useState(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc(rpc);
        if (!vivo || error || !data) return;
        setAcesso(data);
        if (data.imagem) {
          const { data: assinado } = await supabase.storage.from(bucket).createSignedUrl(data.imagem, 3600);
          if (vivo && assinado?.signedUrl) setImagemUrl(assinado.signedUrl);
        }
      } catch { /* sem login ou sem pedido confirmado: nada a mostrar */ }
    })();
    return () => { vivo = false; };
  }, [rpc, bucket]);
  return <CartaoAcesso acesso={acesso} imagemUrl={imagemUrl} />;
}
