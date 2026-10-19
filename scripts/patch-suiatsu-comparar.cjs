// Uso único: botão "Comparar versões" no SUIATSU (tabela com o que vem em cada edição). Aplica sobre src/App.jsx.
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

// tabela de comparação (SUIATSU)
rep(`const SU_INFO_LIMITADA_A = {`, `const SU_COMPARAR = {
  colunas: ["Limitada A", "Limitada B", "Regular", "Solo (8 versões)", "Fã-clube"],
  linhas: [
    { rotulo: "Valor", valores: ["R$190", "R$155", "R$110", "R$125", "R$120"] },
    { rotulo: "Formato", valores: ["CD + Blu-ray", "CD + ZINE especial", "Somente CD", "Somente CD", "Somente CD"] },
    { rotulo: "Photobook", valores: ["24 páginas (tipo A)", "32 páginas (tipo B)", "12 páginas", "12 páginas", "12 páginas"] },
    { rotulo: "Photocards", valores: ["2 tipo A aleatórios (16 modelos)", "2 tipo B aleatórios (16 modelos)", "1 tipo C aleatório (8 modelos)", "2 aleatórios (4 modelos)", "1 especial frente e verso, aleatório (8 modelos)"] },
    { rotulo: "ID photo", valores: ["1 tipo A aleatória (8 modelos)", "1 tipo B aleatória (8 modelos)", "—", "1 aleatória (2 modelos)", "—"] },
    { rotulo: "Bromide", valores: ["—", "1 aleatório (8 modelos)", "—", "—", "—"] },
    { rotulo: "Cards frente e verso", valores: ["—", "—", "—", "2 (tamanho do booklet)", "—"] },
    { rotulo: "ZINE", valores: ["—", "20 páginas, fotos de câmera analógica e mensagens manuscritas", "—", "—", "—"] },
    { rotulo: "Blu-ray", valores: ["Making of das fotos da capa (+ Relay Cam), making of de “SUIATSU”, MV e making of de “Hollow”", "—", "—", "—", "—"] },
    { rotulo: "Embalagem", valores: ["Digipack alto, capa exclusiva", "Digipack alto, capa exclusiva", "—", "—", "—"] },
    { rotulo: "Código serial (1 participação)", valores: ["1", "1", "—", "—", "—"] },
    { rotulo: "Observação", valores: ["—", "—", "—", "Produção limitada por período; cada versão traz itens do respectivo membro", "Exclusiva para membros STAY JAPAN / STAY JAPAN MOBILE; produção somente sob encomenda"] },
  ],
};
const SU_INFO_LIMITADA_A = {`);
rep(`  prazosPagamento: ["30 de outubro", "10 de novembro", "20 de novembro"],`, `  prazosPagamento: ["30 de outubro", "10 de novembro", "20 de novembro"],
  comparar: SU_COMPARAR,`);

// estado
rep(`  const [infoModal, setInfoModal] = useState(null);\n`, `  const [infoModal, setInfoModal] = useState(null);\n  const [compararAberto, setCompararAberto] = useState(false);\n`);

// botão acima da lista de itens
rep(`      {/* Seção ITENS SOLTOS */}`, `      {cfg.comparar && (
        <button onClick={() => setCompararAberto(true)} style={{ width:"100%", marginBottom:16, background:"rgba(201,168,240,.08)", border:"1px solid rgba(201,168,240,.35)", borderRadius:10, padding:"11px", color:"var(--lilas)", fontFamily:mono, fontSize:11, fontWeight:700, letterSpacing:"1px", cursor:"pointer" }}>
          ⇄ COMPARAR VERSÕES DOS ÁLBUNS
        </button>
      )}

      {/* Seção ITENS SOLTOS */}`);

// janela de comparação
rep(`      {/* Informações do álbum */}`, `      {/* Comparar versões */}
      {compararAberto && cfg.comparar && (
        <div onClick={() => setCompararAberto(false)} style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.92)", display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth:980, width:"100%", maxHeight:"92vh", display:"flex", flexDirection:"column", background:"#111", border:"1px solid rgba(245,240,232,.1)", borderRadius:14, padding:14 }}>
            <div style={{ fontFamily:mono, fontSize:11, letterSpacing:"1.5px", color:"var(--lilas)", fontWeight:700, marginBottom:10 }}>COMPARAR VERSÕES</div>
            <div style={{ overflow:"auto", flex:1 }}>
              <table style={{ borderCollapse:"collapse", fontFamily:mono, fontSize:10.5, minWidth:760, width:"100%" }}>
                <thead>
                  <tr>
                    <th style={{ position:"sticky", left:0, top:0, zIndex:3, background:"#111", textAlign:"left", padding:"8px 10px", borderBottom:"1px solid rgba(245,240,232,.15)" }} />
                    {cfg.comparar.colunas.map(c => (
                      <th key={c} style={{ position:"sticky", top:0, zIndex:2, background:"#111", textAlign:"left", padding:"8px 10px", color:"var(--offwhite)", borderBottom:"1px solid rgba(245,240,232,.15)", minWidth:130 }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cfg.comparar.linhas.map(l => (
                    <tr key={l.rotulo}>
                      <td style={{ position:"sticky", left:0, zIndex:1, background:"#111", padding:"8px 10px", color:"rgba(245,240,232,.45)", borderBottom:"1px solid rgba(245,240,232,.06)", verticalAlign:"top", minWidth:110 }}>{l.rotulo}</td>
                      {l.valores.map((v, i) => (
                        <td key={i} style={{ padding:"8px 10px", color: v === "—" ? "rgba(245,240,232,.2)" : l.rotulo === "Valor" ? "var(--verde)" : "rgba(245,240,232,.78)", fontWeight: l.rotulo === "Valor" ? 700 : 400, borderBottom:"1px solid rgba(245,240,232,.06)", verticalAlign:"top", lineHeight:1.4 }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setCompararAberto(false)} style={{ marginTop:10, width:"100%", background:"none", border:"1px solid rgba(245,240,232,.15)", color:"rgba(245,240,232,.5)", borderRadius:8, padding:"9px", fontFamily:mono, fontSize:10, cursor:"pointer" }}>fechar</button>
          </div>
        </div>
      )}

      {/* Informações do álbum */}`);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
