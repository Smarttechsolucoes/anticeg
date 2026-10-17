// Teste no projeto Supabase de ENSAIO REAL (não é o PGlite): Auth, RLS, funções (RPC) e Edge Functions, só com as contas FICTÍCIAS do laboratório.
// RECUSA rodar contra a produção. Não envia e-mail real (as Edge Functions são chamadas com dados que falham ou que o SendGrid de ensaio rejeita).
// Uso (PowerShell):
//   $env:ENSAIO_URL="https://SEUREF.supabase.co"; $env:ENSAIO_ANON_KEY="eyJ..."; $env:ENSAIO_SERVICE_KEY="eyJ..."; node scripts/ensaio/testar-ensaio.mjs
// A chave de SERVIÇO é usada só aqui, no seu computador, para criar as contas fictícias; ela nunca vai para o repositório nem para o site.
import { createClient } from "@supabase/supabase-js";

const PRODUCAO = "ghjfsmwwcfpfvrouyrka";
const URL_ = (process.env.ENSAIO_URL || "").replace(/\/$/, ""), ANON = process.env.ENSAIO_ANON_KEY || "", SERVICO = process.env.ENSAIO_SERVICE_KEY || "";
const SENHA = process.env.ENSAIO_SENHA || "Ensaio-Fictício-2026!";
const refDe = k => { try { return JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()); } catch { return {}; } };
const parar = m => { console.error("✖ " + m); process.exit(2); };
if (!URL_ || !ANON || !SERVICO) parar("Defina ENSAIO_URL, ENSAIO_ANON_KEY e ENSAIO_SERVICE_KEY (veja supabase/ensaio/GUIA.md).");
if (URL_.includes(PRODUCAO) || refDe(ANON).ref === PRODUCAO || refDe(SERVICO).ref === PRODUCAO) parar("Isto é a PRODUÇÃO. Este teste só roda no projeto de ENSAIO.");
if (refDe(ANON).role !== "anon" || refDe(SERVICO).role !== "service_role") parar("ENSAIO_ANON_KEY deve ser a chave 'anon' e ENSAIO_SERVICE_KEY a 'service_role'.");
if (!URL_.includes(refDe(ANON).ref) || refDe(ANON).ref !== refDe(SERVICO).ref) parar("URL e chaves são de projetos diferentes.");

let falhas = 0, info = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const nota = m => { console.log("INFO " + m); info++; };
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient(URL_, SERVICO, opcoes);
const anon = () => createClient(URL_, ANON, opcoes);
const barrado = r => !!r.error || (Array.isArray(r.data) && r.data.length === 0);   // erro de permissão OU nenhuma linha (RLS filtra)
const erroPermissao = r => !!r.error && /permission denied|row-level security|42501|não permitida/i.test(JSON.stringify(r.error));

// ── contas fictícias (e-mails @exemplo.com: o mesmo e-mail do cadastro fictício, então a ativação confere) ─────────────────────────
async function garantirUsuario(email) {
  const { data, error } = await servico.auth.admin.createUser({ email, password: SENHA, email_confirm: true });
  if (!error) return data.user.id;
  const lista = await servico.auth.admin.listUsers({ page: 1, perPage: 200 });
  const u = lista.data?.users?.find(x => x.email === email);
  if (!u) parar(`Não consegui criar nem achar ${email}: ${error.message}`);
  await servico.auth.admin.updateUserById(u.id, { password: SENHA, email_confirm: true });
  return u.id;
}
async function entrar(email) {
  const c = anon(); const { data, error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) parar(`Login de ${email} falhou: ${error.message}`);
  return { c, token: data.session.access_token };
}
const idAdmin = await garantirUsuario("admin.ensaio@exemplo.com");
await garantirUsuario("ana@exemplo.com"); await garantirUsuario("gabi@exemplo.com"); await garantirUsuario("sem.vinculo@exemplo.com");
await servico.from("admin_roles").upsert({ user_id: idAdmin }, { onConflict: "user_id" });

// ── em que estado está o ensaio? ──────────────────────────────────────────────────────────────────────────────────────────────────
const aberto = await anon().from("joiners").select("id").limit(1);
const lancamento = !!aberto.error || (aberto.data || []).length === 0;
console.log(lancamento ? "\n== Estado: LANÇAMENTO (J4 aplicado) ==" : "\n== Estado: HOJE (J4 ainda NÃO aplicado) ==");
if (!lancamento) {
  ok((aberto.data || []).length > 0, "HOJE: o visitante lê joiners (a vulnerabilidade atual, reproduzida no ensaio)");
  nota("Aplique supabase/ensaio/gerado/ENSAIO_2_lancamento.sql e rode este teste de novo para validar a proteção.");
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nOK"); process.exit(falhas ? 1 : 0);
}

// ── visitante / acesso simples ────────────────────────────────────────────────────────────────────────────────────────────────────
const v = anon();
for (const t of ["joiners", "masterlist", "pagamento_demandas", "multas_pagas", "claims", "reports", "envio_solicitacoes", "grupos_envio", "push_subscriptions", "pre_cadastros"])
  ok(barrado(await v.from(t).select("*").limit(5)), `visitante NÃO lê ${t}`);
ok(barrado(await v.from("joiners").update({ saldo_cashback: 9999 }).eq("cog", "ana").select()), "visitante NÃO altera saldo de cashback");
ok(erroPermissao(await v.from("joiners").insert({ cog: "invasor", nome: "x" })), "visitante NÃO cria joiner direto");
const pub = await v.from("joiners_publico").select("*").limit(3);
ok(!pub.error && pub.data.length > 0 && Object.keys(pub.data[0]).sort().join() === "cog,foto_perfil,nome_site,recrutador,twitter", "visão pública: só 5 colunas seguras");
const simples = await v.rpc("entrar_com_arroba", { p_identificador: "@ana" });
ok(simples.data?.encontrado === true && !/@exemplo|000\.000/.test(JSON.stringify(simples.data)), "acesso simples (@ana): identidade mínima, sem dados pessoais");
ok((await v.rpc("entrar_com_arroba", { p_identificador: "ana@exemplo.com" })).data?.encontrado === false, "acesso simples recusa e-mail");
ok(erroPermissao(await v.rpc("meus_dados")) || (await v.rpc("meus_dados")).data === null, "visitante não executa meus_dados");
const sc = await v.rpc("solicitar_cadastro", { p_nome: "Ensaio Nova", p_cog: "ensaio.nova", p_email: "ensaio.nova@exemplo.com", p_whatsapp: null, p_recrutador: null });
ok(sc.data?.ok === true, "visitante pede cadastro pela função segura (resposta neutra)");
ok(JSON.stringify((await v.rpc("solicitar_cadastro", { p_nome: "Outra", p_cog: "ana", p_email: "outra@exemplo.com" })).data) === JSON.stringify({ ok: true }), "@ já existente: a resposta é a mesma (não revela nada)");
ok((await servico.from("joiners").select("email").eq("cog", "ana").single()).data.email === "ana@exemplo.com", "...e a conta da ana não foi alterada");

// ── ana: ativa a conta pelo caminho oficial e vê só o que é dela ──────────────────────────────────────────────────────────────────
const ana = await entrar("ana@exemplo.com");
const ativ = await ana.c.rpc("ativar_minha_conta", { p_cog: "ana" });
ok(!ativ.error, "ana ativa a conta (e-mail confirmado == cadastro)");
ok((await ana.c.rpc("meu_cog")).data === "ana", "meu_cog() devolve 'ana'");
const minhas = await ana.c.from("joiners").select("cog,email,cpf");
ok(minhas.data?.length === 1 && minhas.data[0].cog === "ana", "ana enxerga SÓ a própria linha de joiners");
ok(erroPermissao(await ana.c.from("joiners").update({ saldo_cashback: 9999 }).eq("cog", "ana").select()), "ana NÃO altera o próprio saldo");
ok(erroPermissao(await ana.c.from("joiners").update({ bloqueado: true }).eq("cog", "ana").select()), "ana NÃO altera o próprio bloqueio");
ok(!(await ana.c.from("joiners").update({ numero: "77" }).eq("cog", "ana").select()).error, "ana altera o próprio endereço");
ok((await ana.c.from("joiners").update({ numero: "1" }).eq("cog", "gabi").select()).data?.length === 0, "ana NÃO altera a linha da gabi");
const md = await ana.c.from("masterlist").select("cog");
ok(md.data?.length > 0 && md.data.every(r => ["ana", "disponivel"].includes(String(r.cog).toLowerCase())), "masterlist: só os itens da ana e os slots 'disponivel'");
ok(erroPermissao(await ana.c.from("masterlist").update({ pago_item: true }).eq("cog", "ana").select()), "ana NÃO marca item como pago");
const dem = await ana.c.from("pagamento_demandas").select("id,joiner_cog");
ok(dem.data?.length >= 1 && dem.data.every(r => r.joiner_cog === "ana"), "pagamento_demandas: só as da ana");
ok((await ana.c.from("claims").select("joiner_cog")).data.every(r => r.joiner_cog === "ana"), "claims: só os da ana");
ok((await ana.c.from("envio_solicitacoes").select("joiner_cog,cpf")).data.every(r => r.joiner_cog === "ana"), "envios: só os da ana");
ok((await ana.c.from("grupos_envio").select("codigo")).data.length === 1 && (await ana.c.rpc("grupo_por_codigo", { p_codigo: "abc234" })).data?.host_cog === "ana", "grupo de envio: a host vê o dela e consulta por código");
ok((await servico.from("joiners").select("saldo_cashback").eq("cog", "ana").single()).data.saldo_cashback >= 0 && typeof (await ana.c.rpc("debitar_cashback", { p_valor: 1 })).data !== "undefined", "debitar_cashback responde");
const quadro = await v.from("claims_quadro").select("*").limit(3);
ok(!quadro.error && (quadro.data.length === 0 || Object.keys(quadro.data[0]).sort().join() === "created_at,joiner_nome,masterlist_id,status"), "quadro público de claims: sem e-mail/COG");

// ── conta SEM vínculo e conta com e-mail diferente do cadastro ────────────────────────────────────────────────────────────────
const sv = await entrar("sem.vinculo@exemplo.com");
ok((await sv.c.rpc("meu_cog")).data === null && barrado(await sv.c.from("joiners").select("*")) && barrado(await sv.c.from("pagamento_demandas").select("*")), "conta logada SEM vínculo não vê dado de ninguém");
const tentativa = await sv.c.rpc("ativar_minha_conta", { p_cog: "bia" });
ok((await sv.c.rpc("meu_cog")).data === null, "conta sem o e-mail do cadastro NÃO consegue tomar o COG da bia (vira pedido pendente)" + (tentativa.error ? "" : ""));

// ── administradora ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const adm = await entrar("admin.ensaio@exemplo.com");
ok((await adm.c.rpc("is_admin")).data === true, "is_admin() é true para a administradora de ensaio");
ok((await adm.c.from("joiners").select("id")).data.length >= 10, "administradora lê todas as joiners");
ok(!(await adm.c.from("joiners").update({ nome_entrega: "Ensaio" }).eq("cog", "gabi").select()).error, "administradora altera dados de joiner");
ok(erroPermissao(await adm.c.from("masterlist").update({ pago_item: true }).eq("cog", "ana").select()), "nem a administradora marca pago_* (só o servidor)");

// ── Edge Functions (precisam estar implantadas no ensaio) ──────────────────────────────────────────────────────────────────────────
async function fn(nome, corpo, token = ANON) {
  try { const r = await fetch(`${URL_}/functions/v1/${nome}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }); let j = {}; try { j = await r.json(); } catch { /* sem corpo */ } return { status: r.status, j }; } catch { return { status: 0, j: {} }; }
}
const emailFn = await fn("email-evento", { evento: "comprovante_recebido", demanda_id: -1 });
if (emailFn.status === 404) nota("email-evento não está implantada no ensaio (HTTP 404): pulei os testes de Edge Functions de e-mail/push. Veja o guia, passo 7.");
else {
  ok((await fn("email-evento", { to_email: "x@y.com", assunto: "a", corpo: "b" })).status === 400, "e-mail no formato ANTIGO é recusado (400)");
  ok((await fn("email-evento", { evento: "lembrete_pagamento", joiner_cog: "ana" })).status === 401, "evento de administração sem login: 401");
  ok((await fn("email-evento", { evento: "lembrete_pagamento", joiner_cog: "ana" }, ana.token)).status === 403, "evento de administração com login de joiner: 403");
  const demAna = dem.data[0].id;
  const proprio = await fn("email-evento", { evento: "comprovante_recebido", demanda_id: demAna }, ana.token);
  ok([200, 409, 502, 429].includes(proprio.status), `comprovante da PRÓPRIA demanda: aceito pela autorização (HTTP ${proprio.status}; 502 = SendGrid de ensaio recusou, esperado se a chave for de mentira)`);
  const demBia = (await servico.from("pagamento_demandas").select("id").eq("joiner_cog", "bia").limit(1).single()).data?.id;
  if (demBia) ok((await fn("email-evento", { evento: "comprovante_recebido", demanda_id: demBia }, ana.token)).status === 403, "comprovante da demanda de OUTRA joiner: 403");
  ok((await fn("push-evento", { subscription: { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "a", auth: "b" } }, title: "t", body: "b" }, ana.token)).status === 401, "push com login de joiner: 401");
  ok((await fn("push-evento", { subscription: { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "a", auth: "b" } }, title: "t", body: "b" })).status === 401, "push sem login: 401");
  const velha = await fn("send-email", { to_email: "x@y.com", assunto: "a", corpo: "b" });
  nota(`send-email antiga: HTTP ${velha.status} (400 = ainda ativa; 410 = fechada). No ensaio, deixe fechada (410) depois do teste.`);
}
const login = await fn("login-joiner", { cog: "ana", senha: "senha-errada-xyz" });
if (login.status === 404) nota("login-joiner não está implantada no ensaio (404): pulei.");
else {
  ok([400, 401, 429].includes(login.status) && !/exemplo|ana@/.test(JSON.stringify(login.j)), `login por @ com senha errada: HTTP ${login.status}, resposta neutra`);
  const certo = await fn("login-joiner", { cog: "ana", senha: SENHA });
  ok(certo.status === 200 && !!certo.j.access_token && !certo.j.email && !/exemplo/.test(JSON.stringify(Object.keys(certo.j))), "login por @ com a senha certa devolve só os tokens (nunca o e-mail)");
}
nota("Recuperação de senha, ativação por CÓDIGO no e-mail e Storage dependem de e-mail/policies do projeto: teste à mão (guia, passos 8 e 9).");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
