// Uso único: itens com tipos do ODD & FRESH POP-UP usam o card do SKZOO Rio (foto, nome, preço verde, botão que abre a escolha do tipo).
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "src", "App.jsx");
const raw = fs.readFileSync(p, "utf8");
const CR = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
function rep(a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(n + " :: " + a.slice(0, 80));
  s = s.replace(a, () => b);
}

rep(`  const [fotoZoom, setFotoZoom] = useState(null);
  const [estoqueMap, setEstoqueMap] = useState(null);`, `  const [fotoZoom, setFotoZoom] = useState(null);
  const [tipoModal, setTipoModal] = useState(null);
  const [estoqueMap, setEstoqueMap] = useState(null);`);

// foto sem transparência no card de tipos
rep(`opacity: indisp ? .3 : sel?1:.75, filter: indisp ? "grayscale(1)" : "none" }} />
                {indisp && <div style={{ position:"absolute", top:"50%", left:0, right:0, transform:"translateY(-50%)", textAlign:"center", background:"rgba(0,0,0,.7)", padding:"6px 0", fontFamily:mono, fontSize:10, fontWeight:700, letterSpacing:"2px", color:"#ff6b6b" }}>INDISPONÍVEL</div>}
                <div style={{ position:"absolute", bottom:6, right:6, background:"rgba(0,0,0,.55)", borderRadius:5, padding:"2px 6px", fontFamily:mono, fontSize:8, color:"rgba(245,240,232,.55)" }}>🔍</div>
              </div>
              <div style={{ padding:"8px 10px", flex:1, display:"flex", flexDirection:"column", gap:2 }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:12, color: indisp ? "rgba(245,240,232,.35)" : sel?"var(--lilas)":"var(--offwhite)", letterSpacing:.5, lineHeight:1.2 }}>{it.id}</div>
                <div style={{ fontFamily:mono, fontSize:11, color: indisp ? "rgba(245,240,232,.3)" : "var(--laranja)", fontWeight:700, marginTop:2, textDecoration: indisp ? "line-through" : "none" }}>{fmtPreco(it.preco)}</div>`,
`opacity: indisp ? .3 : (sel || it.tipos)?1:.75, filter: indisp ? "grayscale(1)" : "none" }} />
                {indisp && <div style={{ position:"absolute", top:"50%", left:0, right:0, transform:"translateY(-50%)", textAlign:"center", background:"rgba(0,0,0,.7)", padding:"6px 0", fontFamily:mono, fontSize:10, fontWeight:700, letterSpacing:"2px", color:"#ff6b6b" }}>INDISPONÍVEL</div>}
                <div style={{ position:"absolute", bottom:6, right:6, background:"rgba(0,0,0,.55)", borderRadius:5, padding:"2px 6px", fontFamily:mono, fontSize:8, color:"rgba(245,240,232,.55)" }}>🔍</div>
              </div>
              <div style={{ padding:"8px 10px", flex:1, display:"flex", flexDirection:"column", gap:2 }}>
                <div style={it.tipos ? { fontFamily:mono, fontSize:10, color:"var(--offwhite)", lineHeight:1.3 } : { fontFamily:"'Bebas Neue',sans-serif", fontSize:12, color: indisp ? "rgba(245,240,232,.35)" : sel?"var(--lilas)":"var(--offwhite)", letterSpacing:.5, lineHeight:1.2 }}>{it.id}</div>
                <div style={it.tipos ? { fontFamily:mono, fontSize:13, fontWeight:700, color:"var(--verde)", letterSpacing:"0.5px", marginTop:6 } : { fontFamily:mono, fontSize:11, color: indisp ? "rgba(245,240,232,.3)" : "var(--laranja)", fontWeight:700, marginTop:2, textDecoration: indisp ? "line-through" : "none" }}>{fmtPreco(it.preco)}</div>`);

// chips -> botão que abre a escolha
const ini = s.indexOf(`                {it.tipos ? (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>`);
const marca = `                ) : indisp ? (`;
const fim = s.indexOf(marca, ini);
if (ini < 0 || fim < 0) throw new Error("bloco de chips");
s = s.slice(0, ini) + `                {it.tipos ? (() => {
                  const n = itensSel.filter(x => x.startsWith(it.id + " - ")).length;
                  return (
                    <button onClick={() => setTipoModal(it)} style={{ marginTop:"auto", width:"100%", padding:"6px 0", background: n > 0 ? "rgba(255,92,26,.15)" : "rgba(245,240,232,.05)", border:\`1px solid \${n > 0 ? "rgba(255,92,26,.4)" : "rgba(245,240,232,.12)"}\`, borderRadius:6, fontFamily:mono, fontSize:9, color: n > 0 ? "var(--laranja)" : "rgba(245,240,232,.5)", letterSpacing:"1px", cursor:"pointer" }}>
                      {n > 0 ? \`\${n} no carrinho ✓\` : "ESCOLHER TIPO →"}
                    </button>
                  );
                })() : indisp ? (` + s.slice(fim + marca.length);

// janela de escolha do tipo
rep(`      {/* Zoom de foto */}
      {fotoZoom && (
        <div onClick={() => setFotoZoom(null)} style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.9)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth:440, width:"100%" }}>
            <img src={fotoZoom.foto} alt={fotoZoom.id} style={{ width:"100%", borderRadius:14, display:"block", marginBottom:10 }} />
            <div style={{ textAlign:"center", fontFamily:mono, fontSize:11, color:"rgba(245,240,232,.5)", marginBottom:12 }}>{fotoZoom.id}</div>
            <button onClick={() => setFotoZoom(null)} style={{ width:"100%", background:"none", border:"1px solid rgba(245,240,232,.15)", color:"rgba(245,240,232,.4)", borderRadius:8, padding:"9px", fontFamily:mono, fontSize:10, cursor:"pointer" }}>fechar</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
`, `      {/* Escolha do tipo (itens com tipos) */}
      {tipoModal && (
        <div onClick={() => setTipoModal(null)} style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.9)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, overflowY:"auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth:440, width:"100%", background:"#111", border:"1px solid rgba(245,240,232,.1)", borderRadius:14, padding:16 }}>
            <img src={tipoModal.foto} alt={tipoModal.id} style={{ width:"100%", maxHeight:"45vh", objectFit:"contain", borderRadius:10, display:"block", marginBottom:12, background:"rgba(245,240,232,.04)" }} />
            <div style={{ fontFamily:mono, fontSize:12, color:"var(--offwhite)", lineHeight:1.3 }}>{tipoModal.id}</div>
            <div style={{ fontFamily:mono, fontSize:15, fontWeight:700, color:"var(--verde)", margin:"6px 0 12px" }}>{fmtPreco(tipoModal.preco)}</div>
            <div style={{ fontFamily:mono, fontSize:9, letterSpacing:"1.5px", color:"rgba(245,240,232,.35)", marginBottom:8 }}>ESCOLHA O TIPO (pode marcar mais de um)</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
              {tipoModal.tipos.map(t => {
                const tid = tipoModal.id + " - " + t;
                const on = itensSel.includes(tid);
                const r = restante(tid);
                const off = r !== null && r <= 0;
                return (
                  <button key={t} disabled={off} onClick={() => { setModalidade("ITENS SOLTOS"); toggleItem(tid); }}
                    style={{ border:\`1px solid \${on?"var(--lilas)":"rgba(201,168,240,.3)"}\`, borderRadius:8, padding:"8px 12px", background:on?"var(--lilas)":"transparent", color:on?"#000":off?"rgba(245,240,232,.25)":"rgba(201,168,240,.9)", fontFamily:mono, fontSize:11, fontWeight:700, cursor:off?"not-allowed":"pointer", textDecoration:off?"line-through":"none" }}>
                    {on ? "✓ " : ""}{t}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setTipoModal(null)} style={{ width:"100%", background:"var(--lilas)", border:"none", color:"#000", borderRadius:8, padding:"10px", fontFamily:mono, fontSize:11, fontWeight:700, letterSpacing:"1px", cursor:"pointer" }}>CONCLUÍDO ✓</button>
          </div>
        </div>
      )}

      {/* Zoom de foto */}
      {fotoZoom && (
        <div onClick={() => setFotoZoom(null)} style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.9)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth:440, width:"100%" }}>
            <img src={fotoZoom.foto} alt={fotoZoom.id} style={{ width:"100%", borderRadius:14, display:"block", marginBottom:10 }} />
            <div style={{ textAlign:"center", fontFamily:mono, fontSize:11, color:"rgba(245,240,232,.5)", marginBottom:12 }}>{fotoZoom.id}</div>
            <button onClick={() => setFotoZoom(null)} style={{ width:"100%", background:"none", border:"1px solid rgba(245,240,232,.15)", color:"rgba(245,240,232,.4)", borderRadius:8, padding:"9px", fontFamily:mono, fontSize:10, cursor:"pointer" }}>fechar</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
`);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
