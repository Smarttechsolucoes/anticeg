// Uso único: o SUIATSU pede a data de pagamento (30/10, 10/11 ou 20/11); depois de enviado o pedido não permite trocar.
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "src", "App.jsx");
const raw = fs.readFileSync(p, "utf8");
const CR = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
function rep(a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(n + " :: " + a.slice(0, 90));
  s = s.replace(a, () => b);
}

// configuração
rep(`  get fechado() { return new Date() > SUIATSU_PRAZO; },`, `  get fechado() { return new Date() > SUIATSU_PRAZO; },
  prazosPagamento: ["30 de outubro", "10 de novembro", "20 de novembro"],`);
rep(`"Prazos de pagamento: 30 de outubro, 10 de novembro e 20 de novembro", `, `"Prazos de pagamento: 30 de outubro, 10 de novembro e 20 de novembro", "Ao escolher a data de pagamento, não será possível alterar, mesmo que existam novos prazos", `);

// estado
rep(`  const [tipoModal, setTipoModal] = useState(null);\n`, `  const [tipoModal, setTipoModal] = useState(null);\n  const [prazoPgto, setPrazoPgto] = useState("");\n`);

// envio: exige a data e grava no pedido
rep(`    if (modalFinal === "ITENS SOLTOS" && itensSel.length === 0) { setErro("Selecione ao menos um item."); return; }`,
    `    if (modalFinal === "ITENS SOLTOS" && itensSel.length === 0) { setErro("Selecione ao menos um item."); return; }
    if (cfg.prazosPagamento && !prazoPgto) { setErro("Escolha a data de pagamento."); return; }`);
rep("    const obsFinal = modalFinal === \"ITENS SOLTOS\"\n      ? `Itens: ${itensSel.join(\", \")} · Qtd: ${qtdEf}`\n      : `Qtd: ${qtdEf}`;",
    "    const obsBase = modalFinal === \"ITENS SOLTOS\"\n      ? `Itens: ${itensSel.join(\", \")} · Qtd: ${qtdEf}`\n      : `Qtd: ${qtdEf}`;\n    const obsFinal = cfg.prazosPagamento ? `${obsBase} · Pagamento: ${prazoPgto}` : obsBase;");
rep(`    setEnviado({ posicao });`, `    setEnviado({ posicao });\n    setPrazoPgto("");`);

// escolha da data (logo antes dos dados do pedido)
rep(`      {/* Dados */}
      {modalidade && user && (`, `      {/* Data de pagamento (só nos drops com prazos de pagamento) */}
      {modalidade && cfg.prazosPagamento && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:9, fontFamily:mono, color:"rgba(245,240,232,.3)", letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:10 }}>Data de pagamento</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {cfg.prazosPagamento.map(d => {
              const on = prazoPgto === d;
              return (
                <button key={d} onClick={() => setPrazoPgto(on ? "" : d)}
                  style={{ border:\`1px solid \${on?"var(--lilas)":"rgba(201,168,240,.3)"}\`, borderRadius:8, padding:"9px 14px", background:on?"var(--lilas)":"transparent", color:on?"#000":"rgba(201,168,240,.9)", fontFamily:mono, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  {on ? "✓ " : ""}{d}
                </button>
              );
            })}
          </div>
          <div style={{ fontFamily:mono, fontSize:10, color:"#f0c040", marginTop:8, lineHeight:1.5 }}>⚠ Depois de enviar o pedido a data de pagamento não pode ser alterada, mesmo que existam novos prazos.</div>
        </div>
      )}

      {/* Dados */}
      {modalidade && user && (`);

// histórico da joiner
rep(`            const itensStr = h.observacoes?.match(/Itens: ([^·]+)/)?.[1]?.trim();
            return (`, `            const itensStr = h.observacoes?.match(/Itens: ([^·]+)/)?.[1]?.trim();
            const hPgto = h.observacoes?.match(/Pagamento:\\s*([^·]+)/)?.[1]?.trim();
            return (`);
rep(`{itensStr && <div style={{ fontFamily:mono, fontSize:10, color:"rgba(245,240,232,.4)" }}>{itensStr}</div>}`, `{itensStr && <div style={{ fontFamily:mono, fontSize:10, color:"rgba(245,240,232,.4)" }}>{itensStr}</div>}
                    {hPgto && <div style={{ fontFamily:mono, fontSize:10, color:"var(--lilas)" }}>Pagamento: {hPgto}</div>}`);

// admin: mostra a data escolhida
rep(`          const itensList = itensStr ? itensStr.split(", ").map(s => s.trim()) : [];
          const wmInfo = WM_FOTOS[p.modalidade];`, `          const itensList = itensStr ? itensStr.split(", ").map(s => s.trim()) : [];
          const pgtoData = p.observacoes?.match(/Pagamento:\\s*([^·]+)/)?.[1]?.trim();
          const wmInfo = WM_FOTOS[p.modalidade];`);
rep(`{itensList.length > 0 && <div style={{ fontFamily:mono, fontSize:10, color:"rgba(245,240,232,.4)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{itensList.join(", ")}</div>}`,
    `{itensList.length > 0 && <div style={{ fontFamily:mono, fontSize:10, color:"rgba(245,240,232,.4)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{itensList.join(", ")}</div>}
                  {pgtoData && <div style={{ fontFamily:mono, fontSize:10, color:"var(--lilas)" }}>Pagamento: {pgtoData}</div>}`);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
