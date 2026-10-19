// Uso único: a planilha de envios passa a puxar os itens e status direto da planilha original (MASTERLIST).
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

// função nova no lugar da anterior
const ini = s.indexOf("// ── Planilha geral das solicitações de envio nacional (abre no Excel) ──");
const fim = s.indexOf("// ── Botão de exportar planilha dos pedidos confirmados de um drop ──");
if (ini < 0 || fim < 0 || fim < ini) throw new Error("bloco da função anterior");
const nova = fs.readFileSync(path.join(__dirname, "funcao-planilha-envios.txt"), "utf8").replace(/\r\n/g, "\n");
s = s.slice(0, ini) + nova + s.slice(fim);

rep(`import { smolmerchLinhas, SMOLMERCH_OPCOES, SMOLMERCH_CFG } from "./smolmerchDados.js";`, `import { smolmerchLinhas, SMOLMERCH_OPCOES, SMOLMERCH_CFG } from "./smolmerchDados.js";\nimport { lerPlanilha } from "./csvSimples.js";`);

// estado de "exportando" (no topo do componente, nunca dentro de função interna)
rep(`  const [filtroEnvio,       setFiltroEnvio]       = useState("todos");`, `  const [filtroEnvio,       setFiltroEnvio]       = useState("todos");\n  const [exportandoEnvio,   setExportandoEnvio]   = useState(false);`);

// botão
rep(`                <button onClick={() => { const n = exportarPlanilhaEnvios(envioSolic); if (!n) alert("Nenhuma solicitação para exportar."); }}
                  style={{ background:"rgba(186,255,57,.08)", border:"1px solid rgba(186,255,57,.25)", borderRadius:6, padding:"5px 14px", fontSize:10, fontFamily:"'DM Mono',monospace", color:"#BAFF39", cursor:"pointer", letterSpacing:".5px" }}>
                  ↓ exportar planilha (Excel)
                </button>`, `                <button disabled={exportandoEnvio} onClick={async () => {
                  setExportandoEnvio(true);
                  try { const n = await exportarPlanilhaEnvios(envioSolic); if (!n) alert("Nenhuma solicitação para exportar."); }
                  catch (e) { alert("Erro ao exportar: " + (e.message || e)); }
                  setExportandoEnvio(false);
                }}
                  style={{ background:"rgba(186,255,57,.08)", border:"1px solid rgba(186,255,57,.25)", borderRadius:6, padding:"5px 14px", fontSize:10, fontFamily:"'DM Mono',monospace", color:"#BAFF39", cursor: exportandoEnvio ? "default" : "pointer", letterSpacing:".5px" }}>
                  {exportandoEnvio ? "buscando na planilha…" : "↓ exportar planilha (Excel)"}
                </button>`);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
