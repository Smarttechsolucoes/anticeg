// ENSAIO do gatilho por horário: projeto Supabase de TESTE + planilha de TESTE (as mesmas do teste do Google). Só dados fictícios.
// O script NÃO chama o perfil-sync nem processa a fila: ele só ALTERA (como a joiner fictícia), e ESPERA o gatilho de tempo do Apps Script fazer o trabalho.
// Mostra: tarefa 'pendente' -> 'sincronizada' (com o tempo), Dados atualizado, MASTERLIST refletida, linha de TEXTO FIXO igual, digest da planilha inteira igual.
// Variáveis (digite-as no prompt; nada é impresso): E1_CONFIRMO_ENSAIO=1, E1_SUPABASE_URL, E1_SUPABASE_ANON_KEY, E1_SUPABASE_SERVICE_KEY, E1_PLANILHA_URL, E1_PLANILHA_TOKEN
// Opcionais: E1_ESPERA_MIN (padrão 4), E1_POLL_SEG (padrão 5), E1_ARROBA_TESTE (padrão teste_e1).
const REF_PRODUCAO = "ghjfsmwwcfpfvrouyrka";
const env = n => process.env[n] || "";
const URL_SB = env("E1_SUPABASE_URL").replace(/\/+$/, ""), ANON = env("E1_SUPABASE_ANON_KEY"), SERVICO = env("E1_SUPABASE_SERVICE_KEY");
const URL_PLANILHA = env("E1_PLANILHA_URL"), TOKEN = env("E1_PLANILHA_TOKEN");
const ARROBA = (env("E1_ARROBA_TESTE") || "teste_e1").replace(/^@/, "");
const ESPERA_MS = Number(env("E1_ESPERA_MIN") || 4) * 60000, POLL_MS = Number(env("E1_POLL_SEG") || 5) * 1000;
const sair = async c => { process.exitCode = c; await new Promise(r => setTimeout(r, 400)); process.exit(c); };   // espera as conexões fecharem (evita o erro do libuv no Windows)
const recusar = async m => { console.error("Recusado: " + m); await sair(2); };

if (env("E1_CONFIRMO_ENSAIO") !== "1") await recusar("defina E1_CONFIRMO_ENSAIO=1 para confirmar que o Supabase e a planilha são os de TESTE.");
if (!URL_SB || !ANON || !SERVICO || !URL_PLANILHA || !TOKEN) await recusar("faltam variáveis (E1_SUPABASE_URL, E1_SUPABASE_ANON_KEY, E1_SUPABASE_SERVICE_KEY, E1_PLANILHA_URL, E1_PLANILHA_TOKEN).");
if (URL_SB.includes(REF_PRODUCAO)) await recusar("a URL do Supabase é a de PRODUÇÃO.");
if (env("PLANILHA_URL") && env("PLANILHA_URL") === URL_PLANILHA) await recusar("E1_PLANILHA_URL é igual à PLANILHA_URL de produção.");
if (!ARROBA.startsWith("teste_e1")) await recusar("o @ de teste precisa começar com teste_e1.");

let falhas = 0; const ok = (c, m) => { console.log((c ? "  OK   " : "  FALHA ") + m); if (!c) falhas++; };
const passo = t => console.log("\n▶ " + t);
const dormir = ms => new Promise(r => setTimeout(r, ms));
const J = async (url, opc = {}) => { const r = await fetch(url, opc); let corpo = null; const txt = await r.text(); try { corpo = JSON.parse(txt); } catch { /* sem JSON */ } return { status: r.status, corpo }; };
const sbServico = { apikey: SERVICO, Authorization: "Bearer " + SERVICO, "Content-Type": "application/json" };
const planilha = async acao => { const r = await J(URL_PLANILHA, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ acao, token: TOKEN, twitter: "@" + ARROBA }) }); return r.corpo; };

console.log("ENSAIO DO GATILHO (Supabase de TESTE + planilha de TESTE; dados fictícios)");

passo("0. Confirmar a planilha de TESTE e o estado inicial");
const ident = await planilha("e1_identificar");
ok(ident?.ok === true && ident.teste === true && ident.abas?.length === 2 && /^TESTE E1/.test(ident.nome ?? ""), "o Apps Script confirma: planilha de teste E1, só com Dados e MASTERLIST");
if (!(ident?.ok === true && ident.teste === true && ident.abas?.length === 2 && /^TESTE E1/.test(ident.nome ?? ""))) { console.error("\nRECUSADO: o endereço informado NÃO é a planilha de teste. Nada foi gravado."); await sair(2); }
const base0 = await planilha("e1_ler");
if (!base0?.ok || base0.dados.length !== 1 || base0.dados[0].versao !== "") { console.error("\nA planilha de teste não está no estado inicial. Rode reiniciarDadosTeste() no Apps Script dela e repita. Nada foi gravado."); await sair(2); }
const textoFixoAntes = base0.master.find(m => !m.formula_nome)?.nome;
ok(base0.master.length === 3 && textoFixoAntes === "Nome Fixo Digitado", "estado inicial da planilha: 2 linhas com fórmula e 1 de texto fixo");

passo("1. Conta fictícia no Auth do projeto de TESTE e vínculo com o cadastro fictício");
const email = `ensaio.e1.${Date.now()}@exemplo.com`, senha = "Ens-" + Math.random().toString(36).slice(2) + "-X9!";
const criada = await J(`${URL_SB}/auth/v1/admin/users`, { method: "POST", headers: sbServico, body: JSON.stringify({ email, password: senha, email_confirm: true }) });
const userId = criada.corpo?.id;
ok(criada.status < 300 && !!userId, "conta fictícia criada (e-mail @exemplo.com)");
if (!userId) { console.error("Não consegui criar a conta (confira a chave de serviço e a URL). Nada mais foi feito."); await sair(1); }
let joinerId = null;
try {
  const sem = await J(`${URL_SB}/rest/v1/rpc/e1_ensaio_semear`, { method: "POST", headers: sbServico, body: JSON.stringify({ p_user: userId, p_cog: ARROBA }) });
  joinerId = typeof sem.corpo === "number" ? sem.corpo : null;
  ok(sem.status < 300 && joinerId > 0, "cadastro fictício semeado e vinculado à conta (função só do ensaio)");
  const login = await J(`${URL_SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: senha }) });
  const jwt = login.corpo?.access_token;
  ok(login.status < 300 && !!jwt, "a conta fictícia entrou (login real no Auth de teste)");
  if (!jwt || !joinerId) throw new Error("sem sessão ou sem cadastro; interrompido");

  passo("2. A joiner fictícia salva o nome (caminho real do site: salvar_meu_cadastro)");
  const nomeNovo = `Teste E1 ${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
  const t0 = Date.now();
  const salvo = await J(`${URL_SB}/rest/v1/rpc/salvar_meu_cadastro`, { method: "POST", headers: { apikey: ANON, Authorization: "Bearer " + jwt, "Content-Type": "application/json" }, body: JSON.stringify({ p_nome: nomeNovo }) });
  ok(salvo.status < 300 && salvo.corpo?.ok === true && salvo.corpo?.nome === nomeNovo, "o banco confirmou a gravação e devolveu o valor gravado");
  const tarefa = async () => (await J(`${URL_SB}/rest/v1/cadastro_tarefas?joiner_id=eq.${joinerId}&order=id.desc&limit=1&select=id,planilha_status,planilha_tentativas,planilha_motivo,lida_em`, { headers: sbServico })).corpo?.[0] ?? null;
  const t1 = await tarefa();
  ok(t1?.planilha_status === "pendente", "tarefa criada em Atualizações com a planilha 'pendente' (antes do gatilho)");

  passo(`3. Esperar o disparo AUTOMÁTICO (gatilho de tempo do Apps Script; sem clique no admin, sem chamar a função daqui). Limite: ${ESPERA_MS / 60000} min`);
  let ultimo = t1?.planilha_status, final = t1;
  const historico = [`+0s pendente`];
  while (Date.now() - t0 < ESPERA_MS) {
    await dormir(POLL_MS);
    const t = await tarefa();
    if (t && t.planilha_status !== ultimo) { ultimo = t.planilha_status; historico.push(`+${Math.round((Date.now() - t0) / 1000)}s ${t.planilha_status}`); console.log("   " + historico.at(-1)); }
    final = t;
    if (t && (t.planilha_status === "sincronizada" || t.planilha_status === "atencao")) break;
  }
  const segundos = Math.round((Date.now() - t0) / 1000);
  ok(final?.planilha_status === "sincronizada", `a tarefa saiu de 'pendente' para 'sincronizada' sozinha, em ~${segundos}s` + (final?.planilha_status === "atencao" ? ` (parou em 'atenção': motivo ${final.planilha_motivo})` : ""));
  if (final?.planilha_status !== "sincronizada") console.log("   Se continuou 'pendente': o gatilho não instalou ou as propriedades do script estão incompletas (veja Execuções no Apps Script).");

  passo("4. Dados e MASTERLIST na planilha de teste");
  const depois = await planilha("e1_ler");
  ok(depois.dados?.[0]?.nome === nomeNovo && String(depois.dados[0].id_site) === String(joinerId) && depois.dados[0].papel === "principal", "Dados: B = nome novo, D = ID_SITE, E = principal");
  const comFormula = (depois.master ?? []).filter(m => m.formula_nome), fixa = (depois.master ?? []).find(m => !m.formula_nome);
  ok(comFormula.length === 2 && comFormula.every(m => m.nome === nomeNovo), "MASTERLIST: as 2 linhas com fórmula mostram o nome novo");
  ok(fixa?.nome === textoFixoAntes, "MASTERLIST: a linha de TEXTO FIXO continua igual");
  ok(depois.digesto_constantes === base0.digesto_constantes && depois.digesto_formulas === base0.digesto_formulas, "MASTERLIST: nenhuma célula digitada e nenhuma fórmula mudou (digest da planilha inteira)");
  console.log("\nLinha do tempo: " + historico.join(" → "));
} catch (e) {
  console.error("\nInterrompido: " + String(e.message).slice(0, 200)); falhas++;
} finally {
  const apagou = await J(`${URL_SB}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: sbServico });
  console.log("\n(limpeza) conta fictícia " + (apagou.status < 300 ? "removida do Auth de teste" : "NÃO removida: apague-a em Authentication › Users"));
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nENSAIO CONCLUÍDO: o disparo automático levou a tarefa a 'sincronizada' e a MASTERLIST refletiu, com o texto fixo preservado.");
await sair(falhas ? 1 : 0);
