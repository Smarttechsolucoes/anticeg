# Aplica as mudanças do front do ENVIO (uma vez) sobre src/App.jsx. Cada substituição confere quantas ocorrências existem; qualquer divergência aborta SEM gravar.
import re, sys, os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "App.jsx")
s = open(P, encoding="utf-8").read()
linhas = s.split("\n")
TAB = r'(envio_solicitacoes|grupos_envio|joiner_storage|envio_requests|envio_rounds|joiner_conferencias|rastreios)'
JOINER = {1966, 1977, 1984, 2860, 3608, 5335, 5363, 27216} | set(range(19490, 20700))
n_j = n_a = 0
for i, l in enumerate(linhas, start=1):
    if not re.search(r'\bsupabase\.from\("' + TAB + r'"\)', l): continue
    if i in JOINER:
        linhas[i-1] = re.sub(r'\bsupabase\.from\("' + TAB + r'"\)', r'supabaseEnvio().from("\1")', l); n_j += 1
    else:
        linhas[i-1] = re.sub(r'\bsupabase\.from\("' + TAB + r'"\)', r'clienteAdmin().from("\1")', l); n_a += 1
s = "\n".join(linhas)
print("chamadas trocadas: joiner =", n_j, "| administração =", n_a)
assert not re.search(r"supabase\.from\('" + TAB + r"'\)", s) and not re.search(r"supabase\.from\(`" + TAB, s), "ha chamada com outro tipo de aspas"
assert not re.search(r'\bsupabase\.from\("' + TAB + r'"\)', s)

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a))
    s = s.replace(a, b)
def rep_re(pat, b, n=1, flags=re.S):
    global s
    achou = re.findall(pat, s, flags)
    assert len(achou) == n, (pat[:90], len(achou))
    s = re.sub(pat, lambda m: b, s, flags=flags)

# 1) importações + captura do link
rep('import { ADMIN_AUTH_OBRIGATORIA, clienteAdmin } from "./adminAuth.js";',
    'import { ADMIN_AUTH_OBRIGATORIA, clienteAdmin } from "./adminAuth.js";\nimport { supabaseEnvio, capturarTokenEnvio, temTokenEnvio, limparTokenEnvio, normalizarCogEnvio, ENVIO_EXIGE_ACESSO } from "./envioAcesso.js";')
rep('const WHATSAPP_NUM = "5524992782023";', 'capturarTokenEnvio();   // link pessoal do envio nacional (?acesso=): guarda o token e limpa a barra de endereço\nconst WHATSAPP_NUM = "5524992782023";')

# 2) senha fixa: some (os dois pontos); a abertura é pela data configurada ou pela rodada liberada pela equipe
rep_re(r'<div style=\{\{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" \}\}>\s*<div style=\{\{ display:"flex", gap:6 \}\}>\s*<input type="password" placeholder="senha".*?\{senhaErr && <div [^>]*>senha incorreta</div>\}\s*</div>', "", n=2)
assert "ILOVE2MIN" not in s
rep('  const [unlocked,    setUnlocked]    = useState(false);\n  const [senha,       setSenha]       = useState("");\n  const [senhaErr,    setSenhaErr]    = useState(false);\n', '')
rep('const efetivamenteUnlocked = unlocked || isAutoUnlocked || roundAberto;', 'const efetivamenteUnlocked = isAutoUnlocked || roundAberto;')

# 3) aviso com data fixa velha -> texto pela configuração
rep('O formulário de envios está aberto até <strong>19 de agosto (quarta-feira)</strong>.',
    '{isAutoUnlocked ? <>O formulário de envios está aberto até <strong>{envioAberturaFim.split("-").reverse().join("/")}</strong>.</> : <>O formulário foi liberado pela equipe para a sua rodada de envio.</>}')

# 4) rodadas: servidor (sem corrida entre joiners)
rep_re(r'async function solicitarEnvio\(\) \{.*?\n          \}\n\n          const roundInfo', '''async function solicitarEnvio() {
            setEnvioSolicitando(true);
            const { data, error } = await supabaseEnvio().rpc("envio_solicitar_rodada", { p_itens_manuais: itensManual.trim() || null });
            setEnvioSolicitando(false);
            if (error || !data) { alert("Não foi possível registrar o seu pedido agora. Tente de novo em instantes ou fale com a equipe."); return; }
            setEnvioRequest(data);
          }

          const roundInfo''')

# 5) grupo: busca do código pelo servidor (exige o link pessoal)
rep('const { data, error } = await supabaseEnvio().from("grupos_envio").select("*").eq("codigo", codigo).single();',
    'const { data, error } = await supabaseEnvio().rpc("envio_grupo_por_codigo", { p_codigo: codigo });')

# 6) comprovante: bucket PRIVADO envio-comprovantes; no banco fica só o caminho
rep_re(r'const ext = cf\.file\.name\.split\("\."\)\.pop\(\);\s*const path = `envio/\$\{s\.id\}/comprovante_\$\{Date\.now\(\)\}\.\$\{ext\}`;.*?setMeuEnvios\(prev => prev\.map\(x => x\.id === s\.id \? \{ \.\.\.x, comprovante_url: publicUrl \} : x\)\);',
'''const ext = (cf.file.name.split(".").pop() || "").toLowerCase();
                                                    if (!["jpg","jpeg","png","webp","heic","heif","pdf"].includes(ext)) { alert("Envie o comprovante em JPG, PNG, WEBP, HEIC ou PDF."); setComprovFiles(prev => ({ ...prev, [s.id]: { ...cf, uploading: false } })); return; }
                                                    const path = `${s.id}/comprovante_${Date.now()}.${ext}`;
                                                    const { error: upErr } = await supabaseEnvio().storage.from("envio-comprovantes").upload(path, cf.file, { upsert: false });
                                                    if (upErr) { alert("Erro no upload: " + upErr.message); setComprovFiles(prev => ({ ...prev, [s.id]: { ...cf, uploading: false } })); return; }
                                                    const { error: dbErr } = await supabaseEnvio().from("envio_solicitacoes").update({ comprovante_url: path }).eq("id", s.id);
                                                    if (dbErr) { alert("O arquivo foi enviado, mas não conseguimos registrá-lo agora. Tente de novo ou avise a equipe."); setComprovFiles(prev => ({ ...prev, [s.id]: { ...cf, uploading: false } })); return; }
                                                    setMeuEnvios(prev => prev.map(x => x.id === s.id ? { ...x, comprovante_url: path } : x));''')
rep_re(r'<a href=\{s\.comprovante_url\} target="_blank" rel="noopener noreferrer" style=\{\{ fontSize:10, color:"rgba\(245,240,232,\.4\)"[^>]*>ver →</a>', '<LinkComprovanteEnvio valor={s.comprovante_url} />')
rep_re(r'<a href=\{s\.comprovante_url\} target="_blank" rel="noopener noreferrer" style=\{\{ fontSize:10, color:"#BAFF39"[^>]*>ver comprovante →</a>', '<LinkComprovanteEnvio valor={s.comprovante_url} admin />')

# 7) escolha de modalidade e cancelamento: só atualiza a tela se o servidor aceitou
rep('await supabaseEnvio().from("envio_solicitacoes").update({ modalidade_escolhida: chosen, status:"pagamento em aberto" }).eq("id", s.id);\n',
    'const { error: eMod } = await supabaseEnvio().from("envio_solicitacoes").update({ modalidade_escolhida: chosen, status:"pagamento em aberto" }).eq("id", s.id);\n                                    if (eMod) { alert("Não foi possível confirmar a modalidade agora. Tente de novo ou fale com a equipe."); return; }\n')
rep('await supabaseEnvio().from("envio_solicitacoes").update({ modalidade_escolhida: op, status: "pagamento em aberto" }).eq("id", s.id);\n',
    'const { error: eMod } = await supabaseEnvio().from("envio_solicitacoes").update({ modalidade_escolhida: op, status: "pagamento em aberto" }).eq("id", s.id);\n                                      if (eMod) { alert("Não foi possível confirmar a modalidade agora. Tente de novo ou fale com a equipe."); return; }\n')
rep('await supabaseEnvio().from("envio_solicitacoes").update({ status:"cancelado" }).eq("id", s.id);\n                    setMeuEnvios',
    'const { error: eCan } = await supabaseEnvio().from("envio_solicitacoes").update({ status:"cancelado" }).eq("id", s.id);\n                    if (eCan) { alert("Não foi possível cancelar agora. Tente de novo ou fale com a equipe."); return; }\n                    setMeuEnvios')

# 8) confirmação de envio: itens do storage NUNCA tocam a masterlist (o id deles é de outra tabela)
rep('''    for (const it of (s.itens || [])) {
      await supabase.from("masterlist").update({ status: "Enviado Nacional" }).eq("id", it.id);
    }''', '''    for (const it of (s.itens || [])) {
      // só linhas REAIS da MASTERLIST (com o código da planilha conferido); itens do storage têm id de OUTRA tabela e nunca podem atualizar linhas de ninguém
      if (!it || it.ceg === "Storage GOM" || !it.id_linha || !Number.isFinite(Number(it.id))) continue;
      await supabase.from("masterlist").update({ status: "Enviado Nacional" }).eq("id", it.id).eq("id_linha", it.id_linha);
    }''')

# 9) o componente de acesso + o link do comprovante
rep('function EnvioTab({ user, itens, proximoEnvio = "", envioAberturaInicio = "", envioAberturaFim = "" }) {', '''function LinkComprovanteEnvio({ valor, admin = false }) {
  const v = String(valor || "");
  const estilo = { fontSize:10, color:"#BAFF39", fontFamily:"'DM Mono',monospace", textDecoration:"underline", background:"transparent", border:"none", cursor:"pointer", padding:0 };
  if (/^https?:/.test(v)) return <a href={v} target="_blank" rel="noopener noreferrer" style={estilo}>ver comprovante →</a>;
  if (!admin) return null;   // comprovante novo é privado: só a administração abre (link assinado de 10 minutos)
  return <button type="button" style={estilo} onClick={async () => {
    const { data, error } = await clienteAdmin().storage.from("envio-comprovantes").createSignedUrl(v, 600);
    if (error || !data?.signedUrl) { alert("Não foi possível abrir o comprovante agora."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }}>ver comprovante →</button>;
}

// Porta do Envio Nacional: exige o LINK PESSOAL da joiner (token). O banco confere o token; aqui só se mostra o estado.
function EnvioTab(props) {
  const { user } = props;
  const [acesso, setAcesso] = useState(() => !ENVIO_EXIGE_ACESSO ? "livre" : temTokenEnvio() ? "verificando" : "sem_link");
  useEffect(() => {
    if (!ENVIO_EXIGE_ACESSO || !temTokenEnvio()) return;
    let vivo = true;
    supabaseEnvio().rpc("envio_meu_acesso").then(({ data, error }) => {
      if (!vivo) return;
      if (error) { setAcesso(error.code === "PGRST202" ? "livre" : "erro"); return; }   // PGRST202: o pacote do banco ainda não foi aplicado
      if (!data || !data.cog) { setAcesso("invalido"); return; }
      setAcesso(normalizarCogEnvio(data.cog) === normalizarCogEnvio(user?.cog) ? "livre" : "outra");
    });
    return () => { vivo = false; };
  }, [user?.cog]);
  if (acesso === "livre") return <EnvioTabInterno {...props} />;
  const msg = {
    verificando: "Verificando o seu acesso…",
    sem_link: "Para pedir o seu envio nacional, use o LINK PESSOAL que a equipe enviou para você. Ele identifica você com segurança, sem senha.",
    invalido: "Este link não está mais válido (venceu ou foi substituído). Peça um link novo à equipe.",
    outra: "Este link pertence a outra joiner. Saia deste acesso e use o seu link pessoal.",
    erro: "Não foi possível verificar o seu acesso agora. Tente de novo em instantes.",
  }[acesso];
  return (
    <div className="admin-wrap">
      <h2 className="admin-title" style={{ marginBottom:4 }}>◫ Envio Nacional</h2>
      <div style={{ background:"var(--card-bg)", border:"1px solid rgba(201,168,240,.25)", borderRadius:10, padding:"22px 20px", marginTop:16, maxWidth:560, fontFamily:"'DM Mono',monospace", fontSize:12, lineHeight:1.8, color:"rgba(245,240,232,.75)" }}>
        <div style={{ fontSize:9, letterSpacing:"2px", color:"#C9A8F0", marginBottom:8 }}>◧ ACESSO AO ENVIO NACIONAL</div>
        {msg}
        {acesso !== "verificando" && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:14 }}>
            <a href={`https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent("Olá! Preciso do meu link pessoal para o Envio Nacional.")}`} target="_blank" rel="noopener noreferrer"
               style={{ padding:"9px 16px", background:"var(--laranja)", color:"#111", borderRadius:6, fontSize:11, fontWeight:700, textDecoration:"none" }}>Pedir meu link pelo WhatsApp →</a>
            {(acesso === "outra" || acesso === "invalido") && <button onClick={() => { limparTokenEnvio(); setAcesso("sem_link"); }} style={{ padding:"9px 16px", background:"transparent", color:"rgba(245,240,232,.6)", border:"1px solid rgba(245,240,232,.2)", borderRadius:6, fontSize:11, cursor:"pointer" }}>Sair deste acesso</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function EnvioTabInterno({ user, itens, proximoEnvio = "", envioAberturaInicio = "", envioAberturaFim = "" }) {''')
open(P, "w", encoding="utf-8").write(s)
print("App.jsx atualizado")
