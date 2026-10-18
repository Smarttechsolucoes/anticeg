# Front do JOINERS1 (uma vez): colunas explícitas no login, Perfil sem ler/gravar CPF e endereço pelo visitante, visão do admin pela conta admin.
import os, re
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
def ler(p): return open(os.path.join(RAIZ, p), encoding="utf-8").read()
def gravar(p, s): open(os.path.join(RAIZ, p), "w", encoding="utf-8").write(s)
def rep(s, a, b, n=1):
    assert s.count(a) == n, (a[:90], s.count(a)); return s.replace(a, b)

gravar("src/joinersColunas.js", '''// Colunas de joiners que o VISITANTE pode ler (JOINERS1): tudo menos CPF e endereço (cpf, cep, rua, numero, complemento, bairro, cidade, estado, nome_entrega).
// select("*") deixou de funcionar para o visitante de propósito: use SEMPRE esta lista. Deve ser igual à lista "grant select (...)" de supabase/envio/JOINERS1_aplicar.sql (há teste).
export const COLUNAS_JOINER_PUBLICAS = "id,cog,nome,email,twitter,whatsapp,foto_perfil,last_seen,bloqueado,confirmado,last_notified_at,saldo_cashback,nome_site,telefone,recrutador";
''')

# ---- App.jsx
s = ler("src/App.jsx")
s = rep(s, 'import { supabaseEnvio, capturarTokenEnvio, temTokenEnvio, limparTokenEnvio, normalizarCogEnvio, ENVIO_EXIGE_ACESSO } from "./envioAcesso.js";',
           'import { supabaseEnvio, capturarTokenEnvio, temTokenEnvio, limparTokenEnvio, normalizarCogEnvio, ENVIO_EXIGE_ACESSO } from "./envioAcesso.js";\nimport { COLUNAS_JOINER_PUBLICAS } from "./joinersColunas.js";')
# visão do admin: conta admin (lê tudo); demais: colunas públicas
s = rep(s, 'const { data: joiner } = await supabase.from("joiners").select("*")\n      .or(`cog.ilike.%${termo}%,nome.ilike.%${termo}%`)', 'const { data: joiner } = await clienteAdmin().from("joiners").select("*")\n      .or(`cog.ilike.%${termo}%,nome.ilike.%${termo}%`)')
n_app = len(re.findall(r'from\("joiners"\)\s*\.select\("\*"\)', s))
s = re.sub(r'(from\("joiners"\)\s*\.select\()"\*"(\))', r'\1COLUNAS_JOINER_PUBLICAS\2', s)
print("App.jsx: select(*) -> colunas públicas:", n_app)

# Perfil: dados de entrega só pelo link pessoal (servidor); sem link, aviso
s = rep(s, '  const [endCepLoading,  setEndCepLoading]  = useState(false);',
'''  const [endCepLoading,  setEndCepLoading]  = useState(false);
  // CPF e endereço NÃO são mais lidos/gravados pelo visitante: só pelo link pessoal do Envio Nacional (servidor identifica a joiner)
  const [endAcesso, setEndAcesso] = useState(() => temTokenEnvio() ? "verificando" : "sem_link");
  useEffect(() => {
    if (!temTokenEnvio()) return;
    let vivo = true;
    supabaseEnvio().rpc("envio_meus_dados").then(({ data, error }) => {
      if (!vivo) return;
      if (error || !data) { setEndAcesso("erro"); return; }
      setEndNomeEntrega(data.nome_entrega || ""); setEndCpf(data.cpf || ""); setEndCep(data.cep || ""); setEndRua(data.rua || "");
      setEndNumero(data.numero || ""); setEndComplemento(data.complemento || ""); setEndBairro(data.bairro || ""); setEndCidade(data.cidade || ""); setEndEstado(data.estado || "");
      setEndAcesso("sim");
    });
    return () => { vivo = false; };
  }, []);''')
s = rep(s, '''      {perfilSubTab === "endereco" && (
        <div className="login-box" style={{ gap:14 }}>''',
'''      {perfilSubTab === "endereco" && endAcesso !== "sim" && (
        <div className="login-box" style={{ gap:14 }}>
          <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase", color:"rgba(245,240,232,.28)", marginBottom:4 }}>Endereço de entrega</div>
          <div style={{ fontSize:12, color:"rgba(245,240,232,.6)", fontFamily:"'DM Mono',monospace", lineHeight:1.7 }}>
            {endAcesso === "verificando" ? "Verificando o seu acesso…" : endAcesso === "erro" ? "Não foi possível carregar o seu endereço agora. Tente de novo em instantes." :
              "Seu CPF e endereço agora ficam protegidos. Para cadastrá-los ou alterá-los, use o link pessoal do Envio Nacional que a equipe envia para você (peça pelo WhatsApp se ainda não recebeu)."}
          </div>
        </div>
      )}
      {perfilSubTab === "endereco" && endAcesso === "sim" && (
        <div className="login-box" style={{ gap:14 }}>''')
s = rep(s, '            const { error: err } = await supabase.from("joiners").update(payload).eq("cog", user.cog);\n            setEndSaving(false);\n            if (err) { setEndErr("Erro ao salvar. Tente novamente."); return; }\n            const updatedUser = { ...user, ...payload };',
           '            const { data: okSalvo, error: err } = await supabaseEnvio().rpc("envio_salvar_dados", { p_dados: payload });\n            setEndSaving(false);\n            if (err || okSalvo !== true) { setEndErr("Erro ao salvar. Tente novamente."); return; }\n            const updatedUser = { ...user, telefone: payload.telefone };   // CPF e endereço não ficam guardados no aparelho')
gravar("src/App.jsx", s)

# ---- LandingPage.jsx
l = ler("src/LandingPage.jsx")
n_lp = len(re.findall(r'from\("joiners"\)\s*\.select\("\*"\)', l))
l = re.sub(r'(from\("joiners"\)\s*\.select\()"\*"(\))', r'\1COLUNAS_JOINER_PUBLICAS\2', l)
first_import = l.index("import ")
l = l[:first_import] + 'import { COLUNAS_JOINER_PUBLICAS } from "./joinersColunas.js";\n' + l[first_import:]
gravar("src/LandingPage.jsx", l)
print("LandingPage.jsx: select(*) -> colunas públicas:", n_lp)
