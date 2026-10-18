# Segunda leva do front do envio: (a) dados de entrega da joiner vêm do servidor pelo token (não dependem da leitura aberta de joiners);
# (b) fotos do storage: a administração usa a conta admin; a joiner não apaga mais arquivo do bucket.
import os, re
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "App.jsx")
s = open(P, encoding="utf-8").read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a))
    s = s.replace(a, b)

# (a) wrapper: busca os dados de entrega salvos e só então abre o formulário (o formulário lê user.* na montagem)
rep('''  const [acesso, setAcesso] = useState(() => !ENVIO_EXIGE_ACESSO ? "livre" : temTokenEnvio() ? "verificando" : "sem_link");
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
  if (acesso === "livre") return <EnvioTabInterno {...props} />;''',
'''  const [acesso, setAcesso] = useState(() => !ENVIO_EXIGE_ACESSO ? "livre" : temTokenEnvio() ? "verificando" : "sem_link");
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
  }, [user?.cog]);
  if (acesso === "livre") return <EnvioTabInterno {...props} user={dadosEntrega ? { ...user, ...dadosEntrega } : user} />;''')

# (b) storage-itens: administração pela conta admin; a joiner não apaga arquivo do bucket
rep('''      const url = new URL(item.foto_url);
      const raw = url.pathname;
      const path = raw.replace(/.*\\/storage-itens\\//, "");
      if (path && path !== raw) {
        await supabase.storage.from("storage-itens").remove([path]);
      }''', '''      // a foto permanece no bucket (a joiner não apaga arquivos; a administração faz a limpeza): aqui só sai da galeria dela
      void item.foto_url;''')
n = len(re.findall(r'\bsupabase\.storage\.from\("storage-itens"\)', s))
s = re.sub(r'\bsupabase\.storage\.from\("storage-itens"\)', 'clienteAdmin().storage.from("storage-itens")', s)
print("chamadas de storage-itens trocadas para a conta admin:", n)
open(P, "w", encoding="utf-8").write(s)
