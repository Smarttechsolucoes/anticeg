// Uso único: botão "Ver informações do álbum" nos itens do SUIATSU (conteúdo de cada edição). Aplica sobre src/App.jsx.
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

// conteúdo de cada edição
rep(`const SUIATSU_PRAZO = new Date("2026-11-19T23:59:59-03:00");`, `const SUIATSU_PRAZO = new Date("2026-11-19T23:59:59-03:00");
const SU_INFO_LIMITADA_A = {
  secoes: [
    { titulo: "CD + Blu-ray", itens: [
      "Photobook de 24 páginas — tipo A.",
      "Embalagem digipack em formato alto, com capa exclusiva.",
      "2 photocards A aleatórios, entre 16 modelos individuais.",
      "1 ID photo A aleatória, entre 8 modelos individuais.",
      "1 código serial para uma participação.",
    ] },
    { titulo: "Conteúdo do Blu-ray", itens: [
      "Making of das fotos da capa.",
      "Making of das fotos da capa — versão Relay Cam.",
      "Making of da gravação de “SUIATSU”.",
      "MV de “Hollow”.",
      "Making of do MV de “Hollow”.",
    ] },
  ],
};
const SU_INFO_LIMITADA_B = {
  secoes: [
    { titulo: "CD + ZINE especial", itens: [
      "Photobook de 32 páginas — tipo B.",
      "ZINE especial de 20 páginas, com fotos feitas com câmera analógica e mensagens manuscritas dos membros.",
      "Embalagem digipack em formato alto, com capa exclusiva.",
      "2 photocards B aleatórios, entre 16 modelos individuais.",
      "1 ID photo B aleatória, entre 8 modelos individuais.",
      "1 cartão fotográfico tipo bromide aleatório, entre 8 modelos individuais.",
      "1 código serial para uma participação.",
    ] },
  ],
};
const SU_INFO_REGULAR = {
  secoes: [
    { titulo: "Somente CD", itens: [
      "Photobook de 12 páginas.",
      "1 photocard C aleatório, entre 8 modelos individuais.",
    ] },
  ],
};
const SU_INFO_SOLO = {
  secoes: [
    { titulo: "Somente CD · Produção limitada por período · 8 versões", itens: [
      "Cada versão contém itens do respectivo membro:",
      "Photobook de 12 páginas.",
      "2 photocards aleatórios, entre 4 modelos.",
      "2 cards com impressão frente e verso, do tamanho do booklet.",
      "1 ID photo aleatória, entre 2 modelos.",
    ] },
  ],
};
const SU_INFO_FA_CLUBE = {
  secoes: [
    { titulo: "Somente CD", itens: [
      "Photobook de 12 páginas.",
      "1 photocard especial com impressão frente e verso aleatório, entre 8 modelos individuais.",
    ] },
  ],
  nota: "Exclusiva para membros do STAY JAPAN ou STAY JAPAN MOBILE. Produção somente sob encomenda.",
};`);

// liga o conteúdo aos itens
rep(`preco: 190, proporcao: "3/4" },`, `preco: 190, proporcao: "3/4", detalhes: SU_INFO_LIMITADA_A },`);
rep(`preco: 155, proporcao: "3/4" },`, `preco: 155, proporcao: "3/4", detalhes: SU_INFO_LIMITADA_B },`);
rep(`preco: 110, proporcao: "3/4" },`, `preco: 110, proporcao: "3/4", detalhes: SU_INFO_REGULAR },`);
rep(`"fa-clube.svg", preco: 120 },`, `"fa-clube.svg", preco: 120, detalhes: SU_INFO_FA_CLUBE },`);
s = s.replace(/(\{ id: "EDIÇÃO SOLO [A-Z. ]+", foto: SU \+ "[a-z-]+\.jpg", preco: 125) \}/g, "$1, detalhes: SU_INFO_SOLO }");
if ((s.match(/detalhes: SU_INFO_SOLO/g) || []).length !== 8) throw new Error("solos");

// estado
rep(`  const [tipoModal, setTipoModal] = useState(null);\n`, `  const [tipoModal, setTipoModal] = useState(null);\n  const [infoModal, setInfoModal] = useState(null);\n`);

// botão no card (abaixo de SELECIONAR)
rep(`                  {sel ? "✓ SELECIONADO" : "SELECIONAR"}
                </button>
                )}`, `                  {sel ? "✓ SELECIONADO" : "SELECIONAR"}
                </button>
                )}
                {it.detalhes && (
                  <button onClick={() => setInfoModal(it)} style={{ marginTop:6, width:"100%", background:"none", border:"none", padding:"4px 0", color:"rgba(201,168,240,.75)", fontFamily:mono, fontSize:9, letterSpacing:".5px", textDecoration:"underline", cursor:"pointer" }}>
                    ver informações do álbum
                  </button>
                )}`);

// janela com as informações
rep(`      {/* Escolha do tipo (itens com tipos) */}`, `      {/* Informações do álbum */}
      {infoModal && (
        <div onClick={() => setInfoModal(null)} style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.9)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, overflowY:"auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth:460, width:"100%", maxHeight:"90vh", overflowY:"auto", background:"#111", border:"1px solid rgba(245,240,232,.1)", borderRadius:14, padding:16 }}>
            <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:14 }}>
              <img src={infoModal.foto} alt={infoModal.id} style={{ width:72, height:72, objectFit:"cover", borderRadius:8, flexShrink:0, background:"rgba(245,240,232,.04)" }} />
              <div style={{ minWidth:0 }}>
                <div style={{ fontFamily:mono, fontSize:12, color:"var(--offwhite)", lineHeight:1.3 }}>{infoModal.id}</div>
                <div style={{ fontFamily:mono, fontSize:14, fontWeight:700, color:"var(--verde)", marginTop:4 }}>{fmtPreco(infoModal.preco)}</div>
              </div>
            </div>
            {infoModal.detalhes.secoes.map(sec => (
              <div key={sec.titulo} style={{ marginBottom:14 }}>
                <div style={{ fontFamily:mono, fontSize:10, letterSpacing:"1px", color:"var(--lilas)", fontWeight:700, marginBottom:6 }}>{sec.titulo}</div>
                {sec.itens.map((l, i) => (
                  <div key={i} style={{ fontFamily:mono, fontSize:11, color:"rgba(245,240,232,.7)", lineHeight:1.5, marginBottom:3 }}>
                    <span style={{ color:"var(--laranja)", marginRight:6 }}>☆</span>{l}
                  </div>
                ))}
              </div>
            ))}
            {infoModal.detalhes.nota && <div style={{ fontFamily:mono, fontSize:10, color:"#f0c040", lineHeight:1.5, marginBottom:14 }}>⚠ {infoModal.detalhes.nota}</div>}
            <button onClick={() => setInfoModal(null)} style={{ width:"100%", background:"none", border:"1px solid rgba(245,240,232,.15)", color:"rgba(245,240,232,.5)", borderRadius:8, padding:"9px", fontFamily:mono, fontSize:10, cursor:"pointer" }}>fechar</button>
          </div>
        </div>
      )}

      {/* Escolha do tipo (itens com tipos) */}`);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
