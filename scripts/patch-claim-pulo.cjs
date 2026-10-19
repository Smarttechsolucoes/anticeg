// Uso único: a tela de claim não pode "pular" quando o evento abre (o bloco da contagem regressiva sumia e empurrava tudo para cima).
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "src", "App.jsx");
const raw = fs.readFileSync(p, "utf8");
const CR = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
function rep(a, b, todas = false) {
  const n = s.split(a).length - 1;
  if (todas ? n < 1 : n !== 1) throw new Error(n + " :: " + a.slice(0, 90));
  s = s.split(a).join(b);
}

// o bloco continua ocupando o mesmo espaço depois que abre: troca a contagem por "ABERTO"
rep(`            {!aberto && (
              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                <div style={{ padding:"18px 18px 12px", textAlign:"center" }}>
                  <div style={{ fontFamily:mono, fontSize:10, color:"rgba(245,240,232,.3)", letterSpacing:"1px", marginBottom:6 }}>ABRE EM</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:"var(--offwhite)", letterSpacing:2 }}>{hh}:{mm}:{ss}</div>
                </div>
              </div>
            )}`, `            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              <div style={{ padding:"18px 18px 12px", textAlign:"center" }}>
                <div style={{ fontFamily:mono, fontSize:10, color:"rgba(245,240,232,.3)", letterSpacing:"1px", marginBottom:6 }}>{aberto ? "CLAIMS" : "ABRE EM"}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color: aberto ? "#BAFF39" : "var(--offwhite)", letterSpacing:2, fontVariantNumeric:"tabular-nums" }}>{aberto ? "ABERTO" : \`\${hh}:\${mm}:\${ss}\`}</div>
              </div>
            </div>`);

// botão e caixa "abre em" com a mesma altura
rep(`style={{ flex:1, fontFamily:mono, fontSize:10, fontWeight:700, padding:"10px 14px", background: temSelecionado`, `style={{ flex:1, minHeight:42, boxSizing:"border-box", fontFamily:mono, fontSize:10, fontWeight:700, padding:"10px 14px", background: temSelecionado`, true);
rep(`style={{ flex:1, fontFamily:mono, fontSize:10, fontWeight:700, padding:"10px 14px", background:"rgba(245,240,232,.03)"`, `style={{ flex:1, minHeight:42, boxSizing:"border-box", fontFamily:mono, fontSize:10, fontWeight:700, padding:"10px 14px", background:"rgba(245,240,232,.03)"`, true);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
