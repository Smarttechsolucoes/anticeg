// Uso único: bloqueia segunda solicitação de envio na mesma rodada. Aplica sobre src/App.jsx.
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "src", "App.jsx");
let raw = fs.readFileSync(p, "utf8");
const CR = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
function rep(a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(n + " :: " + a.slice(0, 70));
  s = s.replace(a, () => b);
}

rep(`    setLoading(true);
    const itensSel = storageDisponivel.filter(`, `    setLoading(true);
    // uma solicitação por rodada: confere no banco antes de gravar (outra aba, duplo clique)
    const { data: jaTem } = await supabase.from("envio_solicitacoes").select("id").eq("joiner_cog", user.cog).neq("status", "cancelado").gte("created_at", INICIO_RODADA_ENVIO).limit(1);
    if (jaTem && jaTem.length > 0) { setLoading(false); setMeuEnvios(prev => prev.some(e => e.id === jaTem[0].id) ? prev : [{ id: jaTem[0].id, status:"solicitação de envio", created_at: new Date().toISOString() }, ...prev]); return; }
    const itensSel = storageDisponivel.filter(`);

rep(`    if (error) { setErro("Erro ao enviar. Tente novamente."); return; }
    setEnviado(true);
  }`, `    if (error) { setErro("Erro ao enviar. Tente novamente."); return; }
    setMeuEnvios(prev => [{ id:"novo", status:"solicitação de envio", created_at: new Date().toISOString() }, ...prev]);
    setEnviado(true);
  }`);

const ini = s.indexOf(`        <button onClick={() => {
          setEnviado(false);
          setSelecionados([]);`);
const fimTxt = `          + Fazer outra solicitação
        </button>\n`;
const fim = s.indexOf(fimTxt, ini);
if (ini < 0 || fim < 0) throw new Error("botao fazer outra");
s = s.slice(0, ini) + s.slice(fim + fimTxt.length);

rep(`  const enviadoScreen = (`, `  const jaSolicitou = meuEnvios.some(e => e.status !== "cancelado" && (e.created_at || "") >= INICIO_RODADA_ENVIO);
  const jaSolicitouScreen = (
    <div style={{ textAlign:"center", padding:"40px 16px" }}>
      <div style={{ fontSize:36, marginBottom:16 }}>📦</div>
      <div style={{ fontSize:16, fontWeight:700, color:"#F5F0E8", fontFamily:"'DM Mono',monospace", marginBottom:14 }}>Você já enviou sua solicitação</div>
      <div style={{ fontSize:12, color:"rgba(245,240,232,.55)", fontFamily:"'DM Mono',monospace", lineHeight:1.9, background:"var(--card-bg)", border:"1px solid rgba(245,240,232,.07)", borderRadius:10, padding:"18px 20px", maxWidth:520, margin:"0 auto", textAlign:"left" }}>
        Só é possível preencher o formulário uma vez por rodada. Acompanhe sua solicitação e a cotação em "Minhas Solicitações".
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginTop:16 }}>
        <button onClick={() => { setEnvioSubTab("solicitacoes"); }} style={{ padding:"9px 24px", background:"var(--laranja)", color:"#111", border:"none", borderRadius:6, fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
          Ver minhas solicitações →
        </button>
      </div>
    </div>
  );

  const enviadoScreen = (`);

rep(`          enviado ? enviadoScreen : (<div style={{ paddingBottom:60`, `          enviado ? enviadoScreen : jaSolicitou ? jaSolicitouScreen : (<div style={{ paddingBottom:60`);

rep(`function EnvioTab(`, `const INICIO_RODADA_ENVIO = "2026-10-18";\nfunction EnvioTab(`);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
