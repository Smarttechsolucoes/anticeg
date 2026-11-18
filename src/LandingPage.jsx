import { useEffect, useRef, useState } from "react";
import "./LandingPage.css";
import supabase from "./supabase.js";
import { escolherJoiner, escaparLike } from "./escolherJoiner.js";
import { JOINERS_AUTH_ATIVO, SENHA_MIN, buscarAcessoSimples, carregarDadosPrivados, criarJoinerAuth, emailValido, mascararEmail, solicitarCadastro, validarSenha } from "./joinerAuth.js";
import { AtivacaoPorEmail } from "./JoinerAuth.jsx";
import { chamarPlanilha, mensagemPlanilha } from "./planilhaApi.js";
import bonequinha from "./assets/bonequinha.png";
import foxinyBronze from "./assets/badges/foxiny_bronze.jpg.png";
import foxinyPrata  from "./assets/badges/foxiny_prata.jpg.png";
import foxinyOuro   from "./assets/badges/foxiny_ouro.jpg.png";
import { resolverRecrutador, buscarRecrutador, buscarLinkComunidade, LINK_COMUNIDADE_PADRAO } from "./recrutador.js";


const WA = "5524992782023";

const NIVEIS_RECRUTADOR = [
  { id:"bronze", img:foxinyBronze, cor:"#CD7F32", titulo:"MAKNAE ON TOP", regra:"Entrou na comunidade" },
  { id:"prata",  img:foxinyPrata,  cor:"#C0C0C0", titulo:"RECRUTADOR",    regra:"Recrutou de 1 a 5 membros" },
  { id:"ouro",   img:foxinyOuro,   cor:"#D4AF37", titulo:"EMBAIXADOR",    regra:"Recrutou 6 ou mais membros" },
];

// Campo de senha do card, com o "olhinho" (mostrar/ocultar sem enviar o formulário e sem perder o foco)
function CampoSenhaLp({ value, onChange, placeholder, autoComplete, onKeyDown, rotulo }) {
  const [ver, setVer] = useState(false);
  const txt = ver ? "Ocultar senha" : "Mostrar senha";
  return (
    <div style={{ position:"relative" }}>
      <input className="lp-card-input" type={ver ? "text" : "password"} placeholder={placeholder} value={value} onChange={onChange} onKeyDown={onKeyDown}
        autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label={rotulo} style={{ paddingRight:46 }} />
      <button type="button" data-testid="olhinho-senha" aria-label={txt} aria-pressed={ver} title={txt}
        onMouseDown={e => e.preventDefault()} onClick={() => setVer(v => !v)}
        style={{ position:"absolute", right:2, top:0, bottom:10, width:42, display:"grid", placeItems:"center", background:"none", border:"none", color:"rgba(245,240,232,.55)", padding:0, cursor:"pointer" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ver
            ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
            : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </div>
  );
}

const TEXTO_SEM_CODIGO_LP = {
  entrar: "Você já tem conta, então não enviamos código de ativação. Entre pela tela inicial com o seu @ ou e-mail e a sua senha. Se não lembrar a senha, use “Esqueci minha senha”.",
  aguardando: "A ativação do seu cadastro ainda não foi liberada. Quando chegar a sua vez, a administração avisa.",
  comprovar: "Seu cadastro precisa de uma verificação extra antes de liberarmos o código. Fale com a administração pelo WhatsApp: confirmamos que é você, sem perder pedidos nem histórico.",
  ajuda: "Não conseguimos liberar o código automaticamente para este cadastro. Fale com a administração pelo WhatsApp para resolvermos.",
};

export default function LandingPage({ onLogin, onVerCegs }) {
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const [mobileNav, setMobileNav] = useState(false);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingJoiner, setPendingJoiner] = useState(null);
  const [ativarEmail, setAtivarEmail] = useState(null);      // e-mail digitado na entrada: abre a ativação começando pelo e-mail (sem consultar nada antes)
  const [senha, setSenha] = useState("");
  // acesso rápido com senha (login novo): @ OU e-mail + senha, sempre. Sem a senha nenhum dado privado é carregado.
  const [api] = useState(() => criarJoinerAuth());
  const [senhaAcesso, setSenhaAcesso] = useState("");
  const [aviso, setAviso] = useState("");
  const senhaRef = useRef(null);

  // primeiro acesso unificado (encontrar conta existente OU cadastrar)
  const [primeiroAcesso, setPrimeiroAcesso]   = useState(() => ["/primeiro-acesso", "/recrutador"].includes(window.location.pathname));
  const [cadNome,        setCadNome]           = useState("");
  const [cadCog,         setCadCog]            = useState("");
  const [cadEmail,       setCadEmail]          = useState("");
  const [cadWhats,       setCadWhats]          = useState("");
  const [cadRecrutador,  setCadRecrutador]     = useState("");
  const [linkComunidade, setLinkComunidade]    = useState(LINK_COMUNIDADE_PADRAO);
  const [recStatus,      setRecStatus]          = useState(null); // null | "buscando" | { ok, cog, nome }
  const [cadError,       setCadError]          = useState("");
  const [cadLoading,     setCadLoading]        = useState(false);
  const [cadOk,          setCadOk]             = useState(false);
  // cadastro/ativação COM SENHA (login novo): dados + senha → código no e-mail → conta ativada e entrada
  const [cadSenha,       setCadSenha]          = useState("");
  const [cadRepetir,     setCadRepetir]        = useState("");
  const [cadFase,        setCadFase]           = useState("dados");   // dados | codigo | sem_codigo | pendente | aguardando
  const [cadCodigo,      setCadCodigo]         = useState("");
  const [cadEspera,      setCadEspera]         = useState(0);
  const [cadReenviado,   setCadReenviado]      = useState(false);
  const [cadProximo,     setCadProximo]        = useState("");

  useEffect(() => {
    if (cadEspera <= 0) return undefined;
    const t = setTimeout(() => setCadEspera(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [cadEspera]);

  useEffect(() => { buscarLinkComunidade().then(setLinkComunidade); }, []);

  // link de convite (?ref=cog): já preenche quem indicou
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setCadRecrutador("@" + ref.replace(/^@/, ""));
  }, []);

  // confirma o recrutador enquanto a pessoa digita o @
  useEffect(() => {
    if (!cadRecrutador.trim()) { setRecStatus(null); return; }
    setRecStatus("buscando");
    let cancelado = false;
    const t = setTimeout(async () => {
      const r = await buscarRecrutador(cadRecrutador);
      if (!cancelado) setRecStatus(r ? { ok: true, ...r } : { ok: false });
    }, 500);
    return () => { cancelado = true; clearTimeout(t); };
  }, [cadRecrutador]);

  // quem já tem conta (logada neste aparelho) vê os dados do primeiro acesso preenchidos
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("anticeg_user_v2"));
      if (!u?.cog) return;
      setCadNome(u.nome || u.nome_site || "");
      setCadCog((u.twitter || u.cog || "").replace(/^@/, ""));
      setCadEmail(u.email || "");
      setCadWhats(u.whatsapp || "");
      if (u.recrutador) setCadRecrutador("@" + u.recrutador);
    } catch { /* sem dados salvos */ }
  }, []);

  useEffect(() => {
    const cursor = cursorRef.current;
    const ring = ringRef.current;
    const move = e => {
      cursor.style.left = e.clientX + "px";
      cursor.style.top = e.clientY + "px";
      ring.style.left = e.clientX + "px";
      ring.style.top = e.clientY + "px";
    };
    document.addEventListener("mousemove", move);
    const interactives = document.querySelectorAll(".lp a, .lp button, .lp input");
    interactives.forEach(el => {
      el.addEventListener("mouseenter", () => { cursor.style.width="6px"; cursor.style.height="6px"; ring.style.width="52px"; ring.style.height="52px"; });
      el.addEventListener("mouseleave", () => { cursor.style.width="12px"; cursor.style.height="12px"; ring.style.width="36px"; ring.style.height="36px"; });
    });
    return () => document.removeEventListener("mousemove", move);
  }, []);

  function isEmail(str) {
    const idx = str.indexOf("@");
    return idx > 0;
  }

  async function buscarJoiner(input) {
    // novo acesso: só pelo @ e pela função segura do servidor (nunca lê a linha da joiner nem aceita e-mail)
    if (JOINERS_AUTH_ATIVO) return isEmail(input) ? null : buscarAcessoSimples(input);
    const handle = input.startsWith("@") ? input.slice(1) : input;
    // email: busca direto por email, sem passar pelo cog (pode haver mais de um cadastro com o mesmo e-mail: escolherJoiner decide, sempre do mesmo jeito)
    if (isEmail(input)) {
      const { data: byEmail } = await supabase.from("joiners").select("*")
        .eq("email", input.toLowerCase())
        .limit(10);
      return escolherJoiner(byEmail, handle);
    }
    // busca pelo cog IGNORANDO maiúsculas (escaparLike evita curingas do ilike: "_" e "%"); gêmeos só de maiúsculas viram um único acesso
    const { data: byCog } = await supabase.from("joiners").select("*")
      .ilike("cog", escaparLike(handle))
      .limit(10);
    if (byCog && byCog.length) return escolherJoiner(byCog, handle);
    // fallback: twitter handle
    const { data: byTw } = await supabase.from("joiners").select("*")
      .or(`twitter.ilike.@${escaparLike(handle)},twitter.ilike.${escaparLike(handle)}`)
      .limit(10);
    return escolherJoiner(byTw, handle);
  }

  // Login novo: @ OU e-mail + senha (obrigatória). O servidor resolve o @ para a conta e confere a senha; só depois os dados privados são lidos, com a sessão da própria pessoa.
  async function entrarComSenha(input) {
    if (!senhaAcesso) { setError("Digite sua senha para entrar."); setLoading(false); senhaRef.current?.focus(); return; }
    try {
      const r = isEmail(input)
        ? await api.entrarComEmail({ cog: "", email: input, senha: senhaAcesso })
        : await api.entrar({ cog: input, senha: senhaAcesso });
      if (r.erro) { setError(r.erro.replace("@ ou senha incorretos.", "@/e-mail ou senha incorretos. Ainda não ativou a conta? Use o Primeiro acesso.")); setLoading(false); return; }
      setSenhaAcesso("");
      // perfil ainda por concluir: o servidor não devolve os dados completos; entra com a identidade mínima e o site pede a conclusão do perfil (a sessão já está aberta)
      const dados = r.perfilPendente ? null : await carregarDadosPrivados();
      if (dados) { sairDaPaginaPublica(); onLogin({ ...dados.joiner, acesso_simples: false }, dados.itens); setLoading(false); return; }
      const acesso = await buscarAcessoSimples(r.cog);
      if (acesso) { sairDaPaginaPublica(); onLogin(acesso, []); setLoading(false); return; }
      setError("Não conseguimos carregar seus dados agora. Tente de novo em instantes.");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  // "Esqueci minha senha": a resposta é sempre a mesma, exista ou não a conta (não revela nada)
  async function handleEsqueci() {
    const input = email.trim();
    setError(""); setAviso("");
    if (!input) { setError("Digite seu @ ou e-mail acima para recuperar a senha."); return; }
    setLoading(true);
    try {
      const r = await api.recuperar(isEmail(input) ? { email: input } : { cog: input });
      if (r.erro) setError(r.erro);
      else setAviso("Se existir uma conta ativada, enviamos o link para criar uma senha nova ao e-mail cadastrado. Confira também o spam.");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  async function handleEntrar() {
    setLoading(true); setError(""); setAviso("");
    const input = email.trim();
    if (!input) { setError("Informe seu @ ou e-mail."); setLoading(false); return; }

    const handle = input.startsWith("@") ? input.slice(1) : input;
    if (handle.toUpperCase() === "ADMMODE") {
      setPendingJoiner({ cog: "ADMMODE", nome: "Modo Demo", email: "demo@anticeg.com.br", confirmado: true, _senha_demo: "anticeg@demo" });
      setLoading(false);
      return;
    }

    if (JOINERS_AUTH_ATIVO) { await entrarComSenha(input); return; }

    try {
      const joiner = await buscarJoiner(input);
      if (!joiner) { setError("Acesso não encontrado. Solicite pelo WhatsApp."); setLoading(false); return; }

      const isOwner = joiner.cog === "nandaverseo_c" || joiner.email === "nandag_medeiros@hotmail.com";
      if (isOwner && joiner.senha) {
        setPendingJoiner(joiner);
        setLoading(false);
        return;
      }

      await entrarCom(joiner);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  async function handleSenha() {
    setLoading(true); setError("");
    const senhaCorreta = pendingJoiner._senha_demo || pendingJoiner.senha;
    if (senha.trim() !== senhaCorreta) {
      setError("Senha incorreta."); setLoading(false); return;
    }
    try {
      await entrarCom(pendingJoiner);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  // nas páginas /primeiro-acesso e /recrutador, volta pra raiz antes de entrar (senão a página continuaria aberta)
  function sairDaPaginaPublica() {
    if (["/primeiro-acesso", "/recrutador"].includes(window.location.pathname)) window.history.replaceState(null, "", "/");
  }

  async function entrarCom(joiner) {
    const cogReal = joiner.cog === "ADMMODE" ? "nandaverseo_c" : joiner.cog;
    // no acesso simples os itens (dados privados) NÃO são carregados; eles vêm só depois do login com senha
    const { data: itens } = JOINERS_AUTH_ATIVO && !joiner._senha_demo ? { data: [] } : await supabase.from("masterlist").select("*").eq("cog", cogReal);
    sairDaPaginaPublica();
    onLogin(joiner, itens || []);
  }

  // 1) valida os dados e a senha, registra o pedido de cadastro (só se for cadastro novo: nome + @ + e-mail) e pede o código ao servidor, que decide se envia e responde sempre do mesmo jeito
  async function enviarCodigoCadastro() {
    setCadError("");
    const nome  = cadNome.trim();
    const cog   = cadCog.trim().replace(/^@+/, "");
    const eml   = cadEmail.trim().toLowerCase();
    const whats = cadWhats.trim();
    if (!emailValido(eml)) { setCadError("Digite um e-mail válido."); return; }
    if (nome && !cog) { setCadError("Para cadastro novo, preencha nome, @ e e-mail."); return; }
    const msgSenha = validarSenha(cadSenha, cadRepetir, { cog, email: eml });
    if (msgSenha) { setCadError(msgSenha); return; }
    setCadLoading(true);
    try {
      if (nome && cog) {
        const r = await solicitarCadastro({ nome, cog, email: eml, whatsapp: whats, recrutador: cadRecrutador.trim() });
        if (!r.ok) {
          setCadError(r.motivo === "recrutador_invalido" ? "Recrutador não encontrado. Confira o @ ou deixe em branco."
            : r.motivo === "tente_mais_tarde" ? "Muitos pedidos no momento. Tente de novo mais tarde."
            : "Confira os dados: nome, @ (letras, números, _ ou .) e e-mail válidos.");
          setCadLoading(false); return;
        }
        // aviso à administração (o servidor confere o pedido recente e usa o destinatário configurado; falha não atrapalha)
        supabase.functions.invoke("email-evento", { body: { evento: "novo_cadastro", joiner_cog: cog } }).catch(() => {});
      }
      const r = await api.pedirCodigo({ cog, email: eml });
      if (r.erro) { setCadError(r.erro); setCadLoading(false); return; }
      if (r.proximo) { setCadProximo(r.proximo); setCadFase("sem_codigo"); }
      else { setCadCodigo(""); setCadEspera(60); setCadReenviado(false); setCadFase("codigo"); }
    } catch {
      setCadError("Erro de conexão. Tente novamente.");
    }
    setCadLoading(false);
  }

  async function reenviarCodigoCadastro() {
    if (cadEspera > 0 || cadLoading) return;
    setCadError(""); setCadLoading(true);
    try {
      const r = await api.pedirCodigo({ cog: cadCog.trim().replace(/^@+/, ""), email: cadEmail.trim().toLowerCase() });
      if (r.erro) setCadError(r.erro);
      else if (r.proximo) { setCadProximo(r.proximo); setCadFase("sem_codigo"); }
      else { setCadEspera(60); setCadReenviado(true); }
    } catch { setCadError("Erro de conexão. Tente novamente."); }
    setCadLoading(false);
  }

  // 2) confere o código, grava a senha e liga a conta ao cadastro (api.confirmar); conta ativada = entra já com a conta completa, sem digitar a senha de novo
  async function confirmarCodigoCadastro() {
    setCadError("");
    setCadLoading(true);
    try {
      const r = await api.confirmar({ cog: cadCog.trim().replace(/^@+/, ""), email: cadEmail.trim().toLowerCase(), codigo: cadCodigo, senha: cadSenha });
      if (r.erro) { setCadError(r.erro); setCadLoading(false); return; }
      if (r.resultado === "aguardando") { setCadFase("aguardando"); setCadLoading(false); return; }
      if (r.resultado !== "ok") { setCadFase("pendente"); setCadLoading(false); return; }
      setCadSenha(""); setCadRepetir(""); setCadCodigo("");
      // perfil ainda por concluir: o servidor não devolve os dados completos; entra com a identidade mínima e o site pede a conclusão do perfil (a sessão já está aberta)
      const dados = await carregarDadosPrivados();
      if (dados) { sairDaPaginaPublica(); onLogin({ ...dados.joiner, acesso_simples: false }, dados.itens); setCadLoading(false); return; }
      const acesso = await buscarAcessoSimples(r.cog);
      if (acesso) { sairDaPaginaPublica(); onLogin(acesso, []); setCadLoading(false); return; }
      setCadError("Conta ativada! Não conseguimos abrir seus dados agora: entre pela tela inicial com o seu @ ou e-mail e a senha.");
    } catch {
      setCadError("Erro de conexão. Tente novamente.");
    }
    setCadLoading(false);
  }

  async function handlePrimeiroAcesso() {
    setCadLoading(true); setCadError("");
    const nome  = cadNome.trim();
    const cog   = cadCog.trim().replace(/^@/, "");
    const eml   = cadEmail.trim().toLowerCase();
    const whats = cadWhats.trim();

    if (!cog && !eml) { setCadError("Preencha pelo menos o @ ou o e-mail."); setCadLoading(false); return; }

    // novo acesso: o e-mail NUNCA serve para entrar. Conta existente -> entra pelo @ (acesso simples) e ativa com o código enviado ao e-mail;
    // conta nova -> pedido de cadastro pela função segura do servidor (resposta neutra: não revela se o @/e-mail já existiam).
    if (JOINERS_AUTH_ATIVO) {
      try {
        if (!cog) { setCadError("Digite o seu @. O e-mail é usado só para ativar a conta."); setCadLoading(false); return; }
        if (nome && eml) {
          const r = await solicitarCadastro({ nome, cog, email: eml, whatsapp: whats, recrutador: cadRecrutador.trim() });
          if (!r.ok) {
            setCadError(r.motivo === "recrutador_invalido" ? "Recrutador não encontrado. Confira o @ ou deixe em branco."
              : r.motivo === "tente_mais_tarde" ? "Muitos pedidos no momento. Tente de novo mais tarde."
              : "Confira os dados: nome, @ (letras, números, _ ou .) e e-mail válidos.");
            setCadLoading(false); return;
          }
          // aviso à administração (o servidor confere o pedido recente e usa o destinatário configurado; falha não atrapalha a entrada)
          supabase.functions.invoke("email-evento", { body: { evento: "novo_cadastro", joiner_cog: cog } }).catch(() => {});
        }
        const acesso = await buscarAcessoSimples(cog);
        if (!acesso) { setCadError("Acesso não encontrado. Preencha nome, @ e e-mail para solicitar cadastro ou fale com a admin pelo WhatsApp."); setCadLoading(false); return; }
        await entrarCom(acesso);
      } catch {
        setCadError("Erro de conexão. Tente novamente.");
      }
      setCadLoading(false);
      return;
    }

    // tenta encontrar conta existente
    let joiner = null;
    if (eml) {
      const { data } = await supabase.from("joiners").select("*").eq("email", eml).maybeSingle();
      if (data) joiner = data;
    }
    if (!joiner && cog) {
      const { data } = await supabase.from("joiners").select("*")
        .or(`twitter.ilike.@${cog},twitter.ilike.${cog}`)
        .maybeSingle();
      if (data) joiner = data;
    }

    if (joiner) {
      // conta existe → se informou recrutador e ainda não tinha um, grava (só vale uma vez)
      if (cadRecrutador.trim() && !joiner.recrutador) {
        const rec = await resolverRecrutador(cadRecrutador);
        if (!rec) { setCadError("Recrutador não encontrado. Confira o @ ou deixe em branco."); setCadLoading(false); return; }
        if (rec === joiner.cog) { setCadError("Você não pode ser seu próprio recrutador."); setCadLoading(false); return; }
        const { error: recErr } = await supabase.from("joiners").update({ recrutador: rec }).eq("cog", joiner.cog);
        if (recErr) { setCadError("Não consegui salvar o recrutador. Tente de novo."); setCadLoading(false); return; }
        joiner = { ...joiner, recrutador: rec };
      }
      // loga direto
      try {
        await entrarCom(joiner);
      } catch {
        setCadError("Erro de conexão. Tente novamente.");
      }
      setCadLoading(false);
      return;
    }

    // não tem conta → cadastro automático
    if (!nome || !cog || !eml) {
      setCadError("Conta não encontrada. Preencha nome, @ e e-mail para solicitar cadastro.");
      setCadLoading(false); return;
    }

    // recrutador (opcional): precisa existir
    let recrutador = null;
    if (cadRecrutador.trim()) {
      recrutador = await resolverRecrutador(cadRecrutador);
      if (!recrutador) { setCadError("Recrutador não encontrado. Confira o @ ou deixe em branco."); setCadLoading(false); return; }
      if (recrutador === cog) { setCadError("Você não pode ser seu próprio recrutador."); setCadLoading(false); return; }
    }

    // verifica duplicata na tabela de joiners
    const { data: dupJoiner } = await supabase.from("joiners").select("id")
      .or(`cog.eq.${cog},email.eq.${eml}`).maybeSingle();
    if (dupJoiner) { setCadError("Já existe uma conta com esses dados. Entre em contato com a admin."); setCadLoading(false); return; }

    // cria conta diretamente
    const { error: joinErr } = await supabase.from("joiners").insert([{
      cog, nome, email: eml, twitter: "@" + cog, whatsapp: whats || null, confirmado: false,
      ...(recrutador ? { recrutador } : {}),
    }]);
    if (joinErr) { setCadError("Erro ao criar conta. Tente novamente."); setCadLoading(false); return; }

    // log para admin (não bloqueia a tela). O proxy da planilha exige este registro recente: a chamada abaixo só sai DEPOIS que a gravação termina
    // o aviso à administração (e-mail) também só sai DEPOIS de o pedido estar registrado (o servidor confere o registro antes de enviar)
    const logPreCadastro = supabase.from("pre_cadastros").insert([{ nome, cog, email: eml, whatsapp: whats || null, status: "aprovado" }]).then(() => {}, () => {});
    logPreCadastro.then(() => supabase.functions.invoke("email-evento", { body: { evento: "novo_cadastro", joiner_cog: cog } })).catch(() => {});

    // adiciona na planilha (async). A resposta NÃO é ignorada: se a planilha recusar, falhar ou deixar a linha sem código,
    // a admin recebe um segundo e-mail de alerta (a pessoa que se cadastrou não vê nada, a conta dela já foi criada).
    logPreCadastro.then(() => chamarPlanilha("novo_joiner", { nome, twitter: "@" + cog, email: eml })).then(resPlanilha => {
      const aviso = mensagemPlanilha(resPlanilha, { perfil: "admin", contexto: "Cadastro na planilha" })
        || (resPlanilha?.bruto?.codigo_gerado === false ? "A linha do joiner foi criada na MASTERLIST, mas ficou SEM código (NUM/ID)." : null);
      if (!aviso) return;
      console.error("planilha (novo_joiner):", resPlanilha);
      // evento do servidor (destinatário e texto fixos; o navegador só informa o @): substitui a função antiga send-email, que aceitava destinatário e conteúdo livres
      supabase.functions.invoke("email-evento", { body: { evento: "planilha_atencao", joiner_cog: cog } }).catch(() => {});
    });

    // loga direto com a conta recém-criada
    const { data: novoJoiner } = await supabase.from("joiners").select("*").eq("cog", cog).maybeSingle();
    setCadLoading(false);
    if (novoJoiner) {
      await entrarCom(novoJoiner);
    } else {
      sairDaPaginaPublica();
      onLogin({ nome, cog, email: eml, whatsapp: whats || null }, []);
    }
  }

  // página /primeiro-acesso: só o formulário de primeiro acesso, sem o resto da landing
  // /recrutador é a página de convite: igual ao primeiro acesso, com o botão do grupo da comunidade
  const modoConvite = window.location.pathname === "/recrutador";
  const soPrimeiroAcesso = modoConvite || window.location.pathname === "/primeiro-acesso";

  function resetPrimeiroAcesso() {
    if (soPrimeiroAcesso) { window.location.href = "/"; return; }
    setPrimeiroAcesso(false);
    setCadNome(""); setCadCog(""); setCadEmail(""); setCadWhats(""); setCadRecrutador("");
    setCadError(""); setCadOk(false);
    setCadSenha(""); setCadRepetir(""); setCadCodigo(""); setCadFase("dados"); setCadProximo(""); setCadEspera(0); setCadReenviado(false);
  }

  const voltarStyle = {
    background:"none", border:"none", color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace",
    fontSize:11, cursor:"pointer", marginTop:4, textAlign:"center", width:"100%"
  };

  // Primeiro acesso COM SENHA (login novo): dados + senha → código no e-mail → conta ativada e entrada
  function renderCadastroSenha() {
    const mono = "'DM Mono',monospace";
    const txt = { fontSize:11, color:"rgba(245,240,232,.45)", fontFamily:mono, lineHeight:1.6, marginBottom:12 };
    const emailDigitado = cadEmail.trim().toLowerCase();
    if (cadFase === "codigo") return (
      <>
        <div className="lp-card-label">// confirme o seu e-mail</div>
        <div style={txt}>E-mail informado: <b data-testid="cad-email-mascarado" style={{ color:"#F5F0E8" }}>{mascararEmail(emailDigitado)}</b></div>
        <div style={txt} data-testid="cad-texto-codigo">Se os dados informados corresponderem a um cadastro liberado para ativação, você receberá um código nesse e-mail.</div>
        <input className="lp-card-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="000000" aria-label="Código de confirmação"
          style={{ letterSpacing:6, textAlign:"center", fontSize:20 }} value={cadCodigo} autoFocus
          onChange={e => { setCadCodigo(e.target.value); setCadError(""); }}
          onKeyDown={e => e.key === "Enter" && confirmarCodigoCadastro()} />
        {cadError && <div className="lp-card-error">{cadError}</div>}
        {cadReenviado && <div style={{ ...txt, color:"#BAFF39", marginBottom:8 }} data-testid="cad-reenviado">Pedimos outro código. Se os dados corresponderem a um cadastro liberado para ativação, ele chega nesse e-mail.</div>}
        <button className="lp-card-btn" onClick={confirmarCodigoCadastro} disabled={cadLoading}>{cadLoading ? "..." : "CONFIRMAR CÓDIGO →"}</button>
        <div style={{ ...txt, marginTop:12, marginBottom:4 }}>Confira também Spam ou Lixo Eletrônico. Se pedir outro código, use o mais recente.</div>
        <button type="button" onClick={reenviarCodigoCadastro} disabled={cadEspera > 0 || cadLoading} style={{ ...voltarStyle, opacity: cadEspera > 0 || cadLoading ? .5 : 1 }}>
          {cadEspera > 0 ? `Reenviar código em ${cadEspera}s` : "Reenviar código"}
        </button>
        <button type="button" onClick={() => { setCadError(""); setCadFase("dados"); }} style={voltarStyle}>← corrigir dados</button>
      </>
    );
    if (cadFase === "sem_codigo") return (
      <>
        <div className="lp-card-label">// nenhum código foi enviado</div>
        <div style={txt} data-testid="cad-sem-codigo-texto">{TEXTO_SEM_CODIGO_LP[cadProximo] || TEXTO_SEM_CODIGO_LP.ajuda}</div>
        {cadProximo === "entrar"
          ? <button className="lp-card-btn" onClick={resetPrimeiroAcesso}>ENTRAR →</button>
          : <a className="lp-card-btn" style={{ textAlign:"center", textDecoration:"none", boxSizing:"border-box" }} href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">FALAR COM A ADMIN →</a>}
        <button type="button" onClick={() => { setCadError(""); setCadFase("dados"); }} style={voltarStyle}>← corrigir dados</button>
      </>
    );
    if (cadFase === "pendente" || cadFase === "aguardando") return (
      <>
        <div className="lp-card-label">{cadFase === "aguardando" ? "// ativação em breve" : "// falta só uma conferência"}</div>
        <div style={txt} data-testid="cad-fase-texto">
          {cadFase === "aguardando"
            ? "Estamos liberando a criação de senha aos poucos, em grupos. Quando chegar a sua vez a administração avisa. Seus pedidos e histórico continuam guardados no seu @."
            : "Seu e-mail foi confirmado, mas não conseguimos ligar a conta ao seu cadastro automaticamente. Nada se perdeu: seu @, pedidos e histórico continuam guardados. Fale com a administração para regularizar."}
        </div>
        <a className="lp-card-btn" style={{ textAlign:"center", textDecoration:"none", boxSizing:"border-box" }} href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">FALAR COM A ADMIN →</a>
        <button type="button" onClick={resetPrimeiroAcesso} style={voltarStyle}>← voltar</button>
      </>
    );
    return (
      <>
        <div className="lp-card-label">// primeiro acesso</div>
        {modoConvite && <a href={linkComunidade} target="_blank" rel="noopener noreferrer"
          style={{ display:"block", textAlign:"center", textDecoration:"none", marginBottom:14, padding:"11px 12px", borderRadius:6, background:"rgba(37,211,102,.12)", border:"1px solid rgba(37,211,102,.35)", color:"#25d366", fontFamily:mono, fontSize:11, fontWeight:700, letterSpacing:".5px" }}>
          1 · Entrar na comunidade (WhatsApp) →
        </a>}
        <div style={txt} data-testid="cad-intro">
          {modoConvite && "2 · "}Crie sua senha para acessar seus pedidos e pagamentos. Seu histórico continua no mesmo cadastro. Cadastro novo? Preencha também o nome. Enviamos um código de confirmação para o seu e-mail.
        </div>
        <input className="lp-card-input" type="text" placeholder="nome para a claim (cadastro novo)" aria-label="Nome" value={cadNome} autoComplete="name"
          onChange={e => { setCadNome(e.target.value); setCadError(""); }} autoFocus />
        <input className="lp-card-input" type="text" placeholder="@ da rede social (sem @)" aria-label="Seu @" value={cadCog} autoComplete="username" autoCapitalize="none"
          onChange={e => { setCadCog(e.target.value); setCadError(""); }} />
        <input className="lp-card-input" type="email" placeholder="e-mail" aria-label="E-mail" value={cadEmail} autoComplete="email"
          onChange={e => { setCadEmail(e.target.value); setCadError(""); }} />
        <input className="lp-card-input" type="text" placeholder="whatsapp (pra te localizar nas claims)" aria-label="WhatsApp" value={cadWhats}
          onChange={e => { setCadWhats(e.target.value); setCadError(""); }} />
        <input className="lp-card-input" type="text" placeholder={modoConvite ? "@ de quem te indicou" : "@ de quem te indicou (opcional)"} aria-label="Quem te indicou" value={cadRecrutador}
          onChange={e => { setCadRecrutador(e.target.value); setCadError(""); }} />
        {recStatus && (
          <div style={{ fontSize:11, fontFamily:mono, marginTop:-4, marginBottom:10, lineHeight:1.5,
            color: recStatus === "buscando" ? "rgba(245,240,232,.4)" : recStatus.ok ? "#BAFF39" : "#ff6b6b" }}>
            {recStatus === "buscando" ? "buscando..."
              : recStatus.ok ? `✓ Recrutador confirmado: @${recStatus.cog}${recStatus.nome && recStatus.nome !== recStatus.cog ? ` · ${recStatus.nome}` : ""}`
              : "✕ Recrutador não encontrado. Confira o @."}
          </div>
        )}
        <CampoSenhaLp value={cadSenha} onChange={e => { setCadSenha(e.target.value); setCadError(""); }} placeholder={`crie uma senha (mínimo ${SENHA_MIN} caracteres)`} autoComplete="new-password" rotulo="Crie sua senha" />
        <CampoSenhaLp value={cadRepetir} onChange={e => { setCadRepetir(e.target.value); setCadError(""); }} placeholder="repita a senha" autoComplete="new-password" rotulo="Repita a senha"
          onKeyDown={e => e.key === "Enter" && enviarCodigoCadastro()} />
        {cadError && <div className="lp-card-error">{cadError}</div>}
        <button className="lp-card-btn" onClick={enviarCodigoCadastro} disabled={cadLoading}>{cadLoading ? "..." : "ENVIAR CÓDIGO DE CONFIRMAÇÃO →"}</button>
        <button type="button" onClick={resetPrimeiroAcesso} style={voltarStyle} data-testid="cad-ja-tenho-conta">Já tenho conta? Entrar</button>
        <button type="button" onClick={resetPrimeiroAcesso} style={voltarStyle}>← voltar</button>
      </>
    );
  }

  function renderCard() {
    if (pendingJoiner) return (
      <>
        <div className="lp-card-label">// senha de acesso</div>
        <div style={{ fontSize:12, color:"rgba(245,240,232,.4)", fontFamily:"'DM Mono',monospace", marginBottom:8 }}>
          Olá, {pendingJoiner.nome || pendingJoiner.cog}. Digite sua senha para continuar.
        </div>
        <input
          className="lp-card-input"
          type="password"
          placeholder="senha"
          value={senha}
          onChange={e => { setSenha(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleSenha()}
          autoFocus
        />
        {error && <div className="lp-card-error">{error}</div>}
        <button className="lp-card-btn" onClick={handleSenha} disabled={loading}>{loading ? "..." : "CONFIRMAR →"}</button>
        <button onClick={() => { setPendingJoiner(null); setSenha(""); setError(""); }} style={voltarStyle}>← voltar</button>
      </>
    );

    if (primeiroAcesso && JOINERS_AUTH_ATIVO) return renderCadastroSenha();

    if (primeiroAcesso) return (
      <>
        <div className="lp-card-label">// primeiro acesso</div>
        {cadOk ? (
          <>
            <div style={{ fontSize:12, color:"#BAFF39", fontFamily:"'DM Mono',monospace", lineHeight:1.7, marginBottom:16 }}>
              Cadastro enviado! Aguarde a aprovação da admin. Você receberá acesso em breve.
            </div>
            <button className="lp-card-btn" onClick={resetPrimeiroAcesso}>← voltar</button>
          </>
        ) : (
          <>
            {modoConvite && <a href={linkComunidade} target="_blank" rel="noopener noreferrer"
              style={{ display:"block", textAlign:"center", textDecoration:"none", marginBottom:14, padding:"11px 12px", borderRadius:6, background:"rgba(37,211,102,.12)", border:"1px solid rgba(37,211,102,.35)", color:"#25d366", fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:".5px" }}>
              1 · Entrar na comunidade (WhatsApp) →
            </a>}
            <div style={{ fontSize:11, color:"rgba(245,240,232,.35)", fontFamily:"'DM Mono',monospace", marginBottom:14, lineHeight:1.6 }}>
              {modoConvite && "2 · "}Preencha seus dados. Se você já tiver conta, entrará direto — senão, seu cadastro será enviado para aprovação.
            </div>
            <input className="lp-card-input" type="text" placeholder="nome para a claim" value={cadNome}
              onChange={e => { setCadNome(e.target.value); setCadError(""); }} autoFocus />
            <input className="lp-card-input" type="text" placeholder="@ da rede social (sem @)" value={cadCog}
              onChange={e => { setCadCog(e.target.value); setCadError(""); }} />
            <input className="lp-card-input" type="email" placeholder="e-mail" value={cadEmail}
              onChange={e => { setCadEmail(e.target.value); setCadError(""); }} />
            <input className="lp-card-input" type="text" placeholder="whatsapp (pra te localizar nas claims)" value={cadWhats}
              onChange={e => { setCadWhats(e.target.value); setCadError(""); }} />
            <input className="lp-card-input" type="text" placeholder={modoConvite ? "@ de quem te indicou" : "@ de quem te indicou (opcional)"} value={cadRecrutador}
              onChange={e => { setCadRecrutador(e.target.value); setCadError(""); }}
              onKeyDown={e => e.key === "Enter" && handlePrimeiroAcesso()} />
            {recStatus && (
              <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:-4, marginBottom:10, lineHeight:1.5,
                color: recStatus === "buscando" ? "rgba(245,240,232,.4)" : recStatus.ok ? "#BAFF39" : "#ff6b6b" }}>
                {recStatus === "buscando" ? "buscando..."
                  : recStatus.ok ? `✓ Recrutador confirmado: @${recStatus.cog}${recStatus.nome && recStatus.nome !== recStatus.cog ? ` · ${recStatus.nome}` : ""}`
                  : "✕ Recrutador não encontrado. Confira o @."}
              </div>
            )}
            {cadError && <div className="lp-card-error">{cadError}</div>}
            <button className="lp-card-btn" onClick={handlePrimeiroAcesso} disabled={cadLoading}>
              {cadLoading ? "..." : "CONTINUAR →"}
            </button>
            <button onClick={resetPrimeiroAcesso} style={voltarStyle}>← voltar</button>
          </>
        )}
      </>
    );

    return (
      <>
        <div className="lp-card-label">// acesso rápido</div>
        <input
          className="lp-card-input"
          type="text"
          placeholder="@ da rede social ou e-mail"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(""); setAviso(""); }}
          onKeyDown={e => { if (e.key !== "Enter") return; if (JOINERS_AUTH_ATIVO && !senhaAcesso) senhaRef.current?.focus(); else handleEntrar(); }}
          autoComplete="username"
          autoFocus
        />
        {JOINERS_AUTH_ATIVO && (
          <input
            ref={senhaRef}
            className="lp-card-input"
            type="password"
            placeholder="senha"
            value={senhaAcesso}
            onChange={e => { setSenhaAcesso(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleEntrar()}
            autoComplete="current-password"
          />
        )}
        {error && <div className="lp-card-error">{error}</div>}
        {aviso && <div style={{ fontSize:11, color:"#BAFF39", fontFamily:"'DM Mono',monospace", lineHeight:1.6 }}>{aviso}</div>}
        <button className="lp-card-btn" onClick={handleEntrar} disabled={loading}>{loading ? "..." : "ENTRAR →"}</button>
        {JOINERS_AUTH_ATIVO && <button type="button" onClick={handleEsqueci} disabled={loading} style={voltarStyle}>Esqueci minha senha</button>}
        <div className="lp-card-divider" />
        <button className="lp-card-secondary" onClick={() => {
          // com o login novo, quem digitou o e-mail começa a ativação por ele (como antes); sem e-mail, vai para o primeiro acesso pelo @
          const digitado = email.trim();
          if (JOINERS_AUTH_ATIVO && isEmail(digitado)) setAtivarEmail(digitado.toLowerCase());
          else window.location.href = "/primeiro-acesso";
        }}>Primeiro acesso →</button>
      </>
    );
  }

  if (modoConvite) {
    const mono = "'DM Mono',monospace";
    const bebas = "'Bebas Neue',sans-serif";
    return (
      <div className="lp">
        <div className="lp-cursor" ref={cursorRef} />
        <div className="lp-cursor-ring" ref={ringRef} />
        <div style={{ flex:1, width:"100%", maxWidth:720, margin:"0 auto", boxSizing:"border-box", padding:"36px 20px 56px" }}>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ fontFamily:mono, fontSize:10, letterSpacing:"3px", color:"#C9A8F0", marginBottom:12 }}>// ANTICEG · CONVITE</div>
            <h1 style={{ fontFamily:bebas, fontSize:"clamp(30px,6vw,46px)", lineHeight:1, letterSpacing:".02em", margin:0, color:"#F5F0E8" }}>
              RECRUTE E <span style={{ color:"#BAFF39" }}>SUBA DE NÍVEL</span>
            </h1>
            <p style={{ fontFamily:mono, fontSize:12, lineHeight:1.7, color:"rgba(245,240,232,.55)", maxWidth:460, margin:"12px auto 0" }}>
              Chame stays pra comunidade e suba de nível. Quanto mais gente você traz, mais o seu título cresce no perfil.
            </p>
            <p style={{ fontFamily:mono, fontSize:11, lineHeight:1.6, color:"#FFD166", maxWidth:460, margin:"12px auto 0", padding:"8px 12px", background:"rgba(255,209,102,.08)", border:"1px solid rgba(255,209,102,.3)", borderRadius:8 }}>
              <strong>Importante:</strong> apenas stays com +18 anos. Menores de idade serão banidos.
            </p>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:10, marginBottom:28 }}>
            {NIVEIS_RECRUTADOR.map((n, i) => (
              <div key={n.id} style={{ position:"relative", background:"#141414", border:`1px solid ${n.cor}55`, borderRadius:14, padding:"14px 10px 12px", textAlign:"center", boxShadow:`0 0 28px ${n.cor}14` }}>
                <div style={{ position:"absolute", top:8, left:10, fontFamily:mono, fontSize:8, color:n.cor, letterSpacing:"1.5px" }}>NÍVEL {i + 1}</div>
                <img src={n.img} alt={n.titulo} style={{ width:64, height:64, objectFit:"contain", margin:"10px auto 8px", display:"block", filter:`drop-shadow(0 0 14px ${n.cor}88)` }} />
                <div style={{ fontFamily:bebas, fontSize:16, letterSpacing:".06em", color:n.cor }}>{n.titulo}</div>
                <div style={{ fontFamily:mono, fontSize:9, color:"rgba(245,240,232,.55)", marginTop:3, lineHeight:1.4 }}>{n.regra}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12, marginBottom:32 }}>
            {[
              ["1", "Entre na comunidade", "Pelo grupo do WhatsApp, é onde a gente avisa tudo."],
              ["2", "Faça seu cadastro", "Rapidinho, é só preencher o formulário aqui embaixo."],
              ["3", "Diga quem te indicou", "Coloque o @ de quem te convidou. É assim que ela sobe de nível!"],
              ["4", "Recrutador premiado", "Recrutadores ganham tickets a cada cadastro para concorrer a prêmios/campanhas especiais, como: desconto, presentes, oportunidades exclusivas."],
            ].map(([num, t, d]) => (
              <div key={num} style={{ display:"flex", gap:14, alignItems:"flex-start", padding:"12px 14px", border:"1px solid rgba(245,240,232,.08)", borderRadius:12, background:"rgba(245,240,232,.02)" }}>
                <div style={{ fontFamily:bebas, fontSize:24, lineHeight:1, color:"#FF5C1A" }}>{num}</div>
                <div>
                  <div style={{ fontFamily:mono, fontSize:11, fontWeight:700, color:"#F5F0E8", marginBottom:3 }}>{t}</div>
                  <div style={{ fontFamily:mono, fontSize:10, lineHeight:1.6, color:"rgba(245,240,232,.45)" }}>{d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", justifyContent:"center" }}>
            <div className="lp-hero-card">{renderCard()}</div>
          </div>
        </div>
      </div>
    );
  }

  if (soPrimeiroAcesso) return (
    <div className="lp">
      <div className="lp-cursor" ref={cursorRef} />
      <div className="lp-cursor-ring" ref={ringRef} />
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div className="lp-hero-card">{renderCard()}</div>
      </div>
    </div>
  );

  return (
    <div className="lp">
      {ativarEmail !== null && (
        <AtivacaoPorEmail emailInicial={ativarEmail} onFechar={() => setAtivarEmail(null)}
          aoAtivar={async cogAtivado => { const j = cogAtivado ? await buscarAcessoSimples(cogAtivado).catch(() => null) : null; setAtivarEmail(null); if (j) await entrarCom(j); }} />
      )}
      <div className="lp-cursor" ref={cursorRef} />
      <div className="lp-cursor-ring" ref={ringRef} />

      {/* NAV */}
      <nav className="lp-nav">
        <a className="lp-nav-logo" href="#" onClick={e => e.preventDefault()}>ANTI<span>CEG</span></a>
        <ul className="lp-nav-links">
          <li><a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">Comunidade</a></li>
          <li><button onClick={onVerCegs} className="lp-nav-link-btn">CEGs</button></li>
          <li><a href="https://anticeg.vercel.app/regras.html" target="_blank" rel="noopener noreferrer" className="lp-nav-cta">REGRAS →</a></li>
        </ul>
        <button className="lp-hamburger" onClick={() => setMobileNav(v => !v)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </nav>
      {mobileNav && (
        <div className="lp-mobile-nav" onClick={() => setMobileNav(false)}>
          <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">Comunidade</a>
          <button onClick={onVerCegs} className="lp-nav-link-btn" style={{ textAlign:"center" }}>CEGs</button>
          <a href="https://anticeg.vercel.app/regras.html" target="_blank" rel="noopener noreferrer" className="lp-nav-cta" style={{ textAlign:"center" }}>REGRAS →</a>
        </div>
      )}

      {/* HERO */}
      <section className="lp-hero">
        <img src={bonequinha} alt="antigom" className="lp-bonequinha" />
        <div className="lp-hero-content">
          <div className="lp-hero-left">
            <div className="lp-hero-tag">anticeg — compras em grupo · SKZ & mais</div>
            <h1 className="lp-h1"><span className="ao">ANTI</span><span className="ag">GOM</span></h1>
            <p className="lp-hero-sub">O lugar para você organizar seus trequinhos da anticomu. Consulte seus itens, acompanhe envios e gerencie pagamentos — e sim, você pode comprar na anti-store.</p>
          </div>
          <div className="lp-hero-card">
            {renderCard()}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <span className="lp-footer-mid">OMG, YOU'RE SO ANTI</span>
        <span className="lp-footer-copy">© 2025 design e programação por @nandaverseo_c</span>
      </footer>
    </div>
  );
}
