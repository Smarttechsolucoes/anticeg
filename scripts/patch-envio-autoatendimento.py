# Front do ENV2 (uma vez): a porta do Envio Nacional passa a oferecer o AUTOATENDIMENTO por código enviado ao e-mail cadastrado (sem WhatsApp, sem link distribuído por pessoas).
import os, re
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
def ler(p): return open(os.path.join(RAIZ, p), encoding="utf-8").read()
def gravar(p, s): open(os.path.join(RAIZ, p), "w", encoding="utf-8").write(s)
def rep(s, a, b, n=1):
    assert s.count(a) == n, (a[:90], s.count(a)); return s.replace(a, b)

# ---- parte pura + cliente
p = ler("src/envioAcessoPuro.js")
p = rep(p, "  const limpar = () =>", "  const salvar = t => { if (!tokenValido(t)) return false; guardar(t); return true; };\n  const limpar = () =>")
p = rep(p, "  return { capturar, ler, limpar };", "  return { capturar, ler, limpar, salvar };")
gravar("src/envioAcessoPuro.js", p)
c = ler("src/envioAcesso.js")
c = rep(c, "export const temTokenEnvio = () => !!guarda.ler();", "export const temTokenEnvio = () => !!guarda.ler();\nexport const salvarTokenEnvio = t => { const ok = guarda.salvar(t); _cliente = null; _clienteToken = null; return ok; };   // acesso conquistado pelo código do e-mail (autoatendimento)")
gravar("src/envioAcesso.js", c)

# ---- App.jsx
s = ler("src/App.jsx")
s = rep(s, "import { supabaseEnvio, capturarTokenEnvio, temTokenEnvio, limparTokenEnvio, normalizarCogEnvio, ENVIO_EXIGE_ACESSO } from \"./envioAcesso.js\";",
           "import { supabaseEnvio, capturarTokenEnvio, temTokenEnvio, limparTokenEnvio, salvarTokenEnvio, normalizarCogEnvio, ENVIO_EXIGE_ACESSO } from \"./envioAcesso.js\";")
i = s.index("// Porta do Envio Nacional: exige o LINK PESSOAL"); j = s.index("function EnvioTabInterno(")
novo = r'''// Autoatendimento do Envio Nacional: o @ da sessão + um CÓDIGO de 6 dígitos enviado ao e-mail JÁ CADASTRADO (sem login e senha, sem ajuda da equipe). O @ sozinho não dá acesso.
// O endereço de e-mail nunca é mostrado nem sai do servidor; a resposta do pedido é sempre a mesma (não revela se o @ existe).
function EnvioAcessoPorCodigo({ cog, aviso, onToken }) {
  const [etapa, setEtapa] = useState("pedir");
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(e => e - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);
  async function pedir() {
    setOcupado(true); setErro(""); setMsg("");
    const { data, error } = await supabase.functions.invoke("envio-acesso", { body: { acao: "pedir", cog } });
    setOcupado(false);
    if (error || !data?.ok) { setErro("Não foi possível enviar o código agora. Tente de novo em instantes."); return; }
    setMsg(data.mensagem || ""); setEtapa("codigo"); setCodigo(""); setEspera(60);
  }
  async function confirmar() {
    const limpo = codigo.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(limpo)) { setErro("Digite os 6 dígitos do código."); return; }
    setOcupado(true); setErro("");
    const { data, error } = await supabase.functions.invoke("envio-acesso", { body: { acao: "validar", cog, codigo: limpo } });
    setOcupado(false);
    if (error) { setErro("Não foi possível confirmar agora. Tente de novo."); return; }
    if (!data?.ok || !data.token) { setErro(data?.erro || "Código inválido ou expirado."); return; }
    onToken(data.token);
  }
  const caixa = { background:"var(--card-bg)", border:"1px solid rgba(201,168,240,.25)", borderRadius:10, padding:"22px 20px", marginTop:16, maxWidth:560, fontFamily:"'DM Mono',monospace", fontSize:12, lineHeight:1.8, color:"rgba(245,240,232,.75)" };
  const botao = { padding:"10px 18px", background:"var(--laranja)", color:"#111", border:"none", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'DM Mono',monospace" };
  const botao2 = { ...botao, background:"transparent", color:"rgba(245,240,232,.6)", border:"1px solid rgba(245,240,232,.2)" };
  return (
    <div style={caixa} data-testid="envio-codigo">
      <div style={{ fontSize:9, letterSpacing:"2px", color:"#C9A8F0", marginBottom:8 }}>◧ CONFIRMAR O SEU ACESSO AO ENVIO NACIONAL</div>
      {aviso && <div style={{ marginBottom:8, color:"#FFD166" }}>{aviso}</div>}
      <div>Você está entrando como <strong style={{ color:"#F5F0E8" }}>@{cog}</strong>. Para proteger os seus dados, enviamos um código de 6 dígitos para o <strong style={{ color:"#F5F0E8" }}>e-mail cadastrado</strong> nesta conta (por segurança, não mostramos o endereço). Não precisa de senha.</div>
      {etapa === "pedir" ? (
        <div style={{ marginTop:14 }}><button disabled={ocupado} onClick={pedir} style={botao}>{ocupado ? "Enviando…" : "Enviar código ao meu e-mail →"}</button></div>
      ) : (
        <div style={{ marginTop:14 }}>
          {msg && <div style={{ marginBottom:10, color:"rgba(245,240,232,.6)" }}>{msg}</div>}
          <input value={codigo} onChange={e => setCodigo(e.target.value.replace(/[^\d\s]/g, "").slice(0, 7))} onKeyDown={e => { if (e.key === "Enter") confirmar(); }}
            inputMode="numeric" autoComplete="one-time-code" placeholder="000000" aria-label="Código de 6 dígitos"
            style={{ width:170, background:"#0d0d0d", border:"1px solid rgba(245,240,232,.25)", borderRadius:6, padding:"10px 12px", color:"#F5F0E8", fontSize:20, letterSpacing:"6px", textAlign:"center", fontFamily:"'DM Mono',monospace", outline:"none" }} />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
            <button disabled={ocupado} onClick={confirmar} style={botao}>{ocupado ? "Conferindo…" : "Confirmar →"}</button>
            <button disabled={ocupado || espera > 0} onClick={pedir} style={{ ...botao2, opacity: espera > 0 ? .5 : 1 }}>{espera > 0 ? `Reenviar código (${espera}s)` : "Reenviar código"}</button>
          </div>
          <div style={{ marginTop:10, fontSize:11, color:"rgba(245,240,232,.4)" }}>Não chegou? Confira o spam. Se o e-mail cadastrado estiver errado ou antigo, avise a equipe para atualizar.</div>
        </div>
      )}
      {erro && <div role="alert" style={{ marginTop:12, color:"#ff6b6b" }}>{erro}</div>}
    </div>
  );
}

// Porta do Envio Nacional: exige o acesso por código do e-mail (ou um link já emitido). O banco confere o token; aqui só se mostra o estado.
function EnvioTab(props) {
  const { user } = props;
  const [acesso, setAcesso] = useState(() => !ENVIO_EXIGE_ACESSO ? "livre" : temTokenEnvio() ? "verificando" : "sem_link");
  const [verif, setVerif] = useState(0);
  const [dadosEntrega, setDadosEntrega] = useState(null);   // endereço/CPF salvos da própria joiner, vindos do servidor pelo token
  useEffect(() => {
    if (!ENVIO_EXIGE_ACESSO || !temTokenEnvio()) return;
    let vivo = true;
    (async () => {
      const cli = supabaseEnvio();
      const { data, error } = await cli.rpc("envio_meu_acesso");
      if (!vivo) return;
      if (error) { setAcesso(error.code === "PGRST202" ? "livre" : "erro"); return; }   // PGRST202: o pacote do banco ainda não foi aplicado
      if (!data || !data.cog) { setAcesso("invalido"); return; }
      if (normalizarCogEnvio(data.cog) !== normalizarCogEnvio(user?.cog)) { setAcesso("outra"); return; }
      const r = await cli.rpc("envio_meus_dados");
      if (!vivo) return;
      if (r.data && typeof r.data === "object") setDadosEntrega(Object.fromEntries(Object.entries(r.data).filter(([, v]) => v !== null && v !== undefined && v !== "")));
      setAcesso("livre");
    })();
    return () => { vivo = false; };
  }, [user?.cog, verif]);
  async function sair() {
    try { await supabaseEnvio().rpc("envio_sair"); } catch { /* sem o pacote do banco: só sai deste aparelho */ }
    limparTokenEnvio(); setDadosEntrega(null); setAcesso("sem_link");
  }
  if (acesso === "livre") return (
    <>
      {ENVIO_EXIGE_ACESSO && temTokenEnvio() && (
        <div style={{ textAlign:"right", maxWidth:1100, margin:"0 auto", padding:"0 16px" }}>
          <button onClick={sair} style={{ background:"transparent", border:"none", color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", fontSize:10, cursor:"pointer", textDecoration:"underline" }}>Sair deste acesso</button>
        </div>
      )}
      <EnvioTabInterno {...props} user={dadosEntrega ? { ...user, ...dadosEntrega } : user} />
    </>
  );
  const aviso = { invalido: "O seu acesso venceu. Confirme o código do e-mail de novo.", outra: "Este aparelho estava com o acesso de outra joiner. Confirme o código do seu e-mail." }[acesso];
  return (
    <div className="admin-wrap">
      <h2 className="admin-title" style={{ marginBottom:4 }}>◫ Envio Nacional</h2>
      {acesso === "verificando" || acesso === "erro" ? (
        <div style={{ marginTop:16, fontFamily:"'DM Mono',monospace", fontSize:12, color:"rgba(245,240,232,.7)" }}>
          {acesso === "verificando" ? "Verificando o seu acesso…" : <>Não foi possível verificar o seu acesso agora. <button onClick={() => { setAcesso("verificando"); setVerif(v => v + 1); }} style={{ background:"transparent", border:"1px solid rgba(245,240,232,.25)", color:"inherit", borderRadius:6, padding:"6px 12px", cursor:"pointer", marginLeft:8 }}>Tentar de novo</button></>}
        </div>
      ) : (
        <EnvioAcessoPorCodigo cog={user?.cog} aviso={aviso} onToken={t => { salvarTokenEnvio(t); setAcesso("verificando"); setVerif(v => v + 1); }} />
      )}
    </div>
  );
}

'''
s = s[:i] + novo + s[j:]
# Perfil: texto do aviso do endereço
s = rep(s, "Seu CPF e endereço agora ficam protegidos. Para cadastrá-los ou alterá-los, use o link pessoal do Envio Nacional que a equipe envia para você (peça pelo WhatsApp se ainda não recebeu).",
           "Seu CPF e endereço ficam protegidos. Para cadastrá-los ou alterá-los, abra o Envio Nacional (menu) e confirme o código que enviamos ao seu e-mail cadastrado. Leva menos de um minuto e não precisa de senha.")
s = rep(s, '<span className="user-email">{user.email || `COG ${user.cog}`}</span>', '<span className="user-email">@{user.cog}</span>   {/* o cabeçalho não mostra mais o e-mail de quem só informou o @ */}')
gravar("src/App.jsx", s)
print("front do autoatendimento aplicado")
