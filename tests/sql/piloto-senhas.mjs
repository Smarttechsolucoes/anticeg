// Teste do PILOTO DE SENHAS no laboratório fictício (PGlite): J1 + J3 + J4a + J4d + P0/P1 (liberação exclusiva de cinco joiners), SEM nenhum dos SQLs de proteção (J4b em diante).
// Prova: (1) os quatro SQLs não concedem acesso novo por RLS, RPC ou permissão; (2) só as cinco ativam; (3) fora da lista nada vincula; (4) contas existentes ficam intactas;
// (5) desativar não apaga nada; (6) o pré-voo acusa duplicidade e conta já existente no Auth.
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/piloto-senhas.mjs
import { PGlite } from "@electric-sql/pglite";
import { como, n, negado, rodar, ok, fim, J, U, sql } from "./_lab.mjs";
const PS = "piloto-senhas";
const CINCO = [[2, "al.melo", 11], [272, "nicknowsaurus", 12], [42, "lyrichangbin", 13], [187751, "gnabjubs", 14], [7213, "ttalilitinha", 15]];

// ── laboratório ANTES do J1: igual ao de produção hoje (políticas abertas simuladas, administradora, sem nenhuma tabela de contas) ──────────────
async function labPreJ1() {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $f$;
    create function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    insert into auth.users values ('${U(1)}', 'dona@exemplo.com', now());
  `);
  await d.exec(sql("01_schema_minimo.sql", "laboratorio")); await d.exec(sql("02_politicas_de_hoje_simuladas.sql", "laboratorio"));
  await d.exec(`grant all on all tables in schema public to anon, authenticated, service_role; grant all on all sequences in schema public to anon, authenticated, service_role;`);
  await d.exec(`revoke update on public.masterlist from anon, authenticated; grant update (ceg, cog, nome, nome_do_item, valor_item, frete_inter, taxa_rf, status, info_adicionais, na_loja, id_linha) on public.masterlist to anon, authenticated;
                revoke update, delete on public.pagamento_demandas from anon, authenticated; revoke insert, update, delete on public.multas_pagas from anon, authenticated;`);
  await d.exec(sql("03_dados_ficticios.sql", "laboratorio")); await d.exec(sql("04_tabelas_j4c.sql", "laboratorio")); await d.exec(sql("06_lojas_publicas.sql", "laboratorio")); await d.exec(sql("07_tabelas_j4c4.sql", "laboratorio"));
  await d.exec(sql("A1_base_aplicar.sql", "admin-auth")); await d.exec(sql("A2_senha_apenas_aplicar.sql", "admin-auth"));
  await d.exec(`insert into public.admin_roles (user_id) values ('${U(1)}')`);
  // cadastros do piloto: as cinco + quem NÃO está na lista + casos de ambiguidade
  await d.exec(`delete from public.joiners`);
  await d.exec(`insert into public.joiners (id, cog, nome, nome_site, email, twitter) values
    (2, 'al.melo', 'Al Melo', 'Al', 'al.melo@exemplo.com', '@al.melo'),
    (272, 'nicknowsaurus', 'nicolle', 'Nick', 'nicolle@exemplo.com', '@nicknowsaurus'),
    (42, 'lyrichangbin', 'Lyric', 'Lyric', 'lyric@exemplo.com', '@lyrichangbin'),
    (187751, 'gnabjubs', 'Gnab', 'Gnab', 'gnab@exemplo.com', '@gnabjubs'),
    (7213, 'ttalilitinha', 'Tali', 'Tali', 'tali@exemplo.com', '@ttalilitinha'),
    (500, 'fora_da_lista', 'Fora', 'Fora', 'fora@exemplo.com', '@fora_da_lista'),
    (700, 'dup_a', 'Dup A', 'DupA', 'compartilhado@exemplo.com', '@dup_a'),
    (701, 'dup_b', 'Dup B', 'DupB', 'compartilhado@exemplo.com', '@dup_b'),
    (900, 'antiga', 'Antiga', 'Antiga', 'antiga@exemplo.com', '@antiga')`);
  return d;
}
const estadoOndas = async d => JSON.stringify((await d.query("select (select count(*) from public.ativacao_ondas) o, (select onda_liberada from public.ativacao_estado) w, (select liberar_todas from public.ativacao_estado) t, (select count(*) from emergencia.c0b_estado_anterior where etapa = 'PILOTO-1') e")).rows[0]);
const p0b = async d => JSON.stringify((await d.query(sql("P0b_foto_permissoes_leitura.sql", PS))).rows);
const pre = async d => (await d.query(sql("P0_preflight_leitura.sql", PS))).rows;
const achar = (rows, trecho) => rows.filter(r => r.item.includes(trecho));
const p1v = async d => Object.fromEntries((await d.query(sql("P1_verificar.sql", PS))).rows.map(r => [r.item, r.valor]));

// foto das permissões (tabelas/visões/funções) para provar o que os SQLs mudam
async function foto(d) {
  const t = (await d.query(`select c.relname, c.relkind::text k, c.relrowsecurity rls,
      has_table_privilege('anon', c.oid, 'select') as_, has_table_privilege('anon', c.oid, 'insert') ai, has_table_privilege('anon', c.oid, 'update') au, has_table_privilege('anon', c.oid, 'delete') ad,
      has_table_privilege('authenticated', c.oid, 'select') bs, has_table_privilege('authenticated', c.oid, 'insert') bi, has_table_privilege('authenticated', c.oid, 'update') bu, has_table_privilege('authenticated', c.oid, 'delete') bd,
      coalesce((select string_agg(p.policyname || ':' || p.cmd || ':' || array_to_string(p.roles, ',') || ':' || coalesce(p.qual, '') || ':' || coalesce(p.with_check, ''), ' ; ' order by p.policyname) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname), '') pol
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'p') order by 1`)).rows;
  const f = (await d.query(`select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' fn, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') b from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1`)).rows;
  return { t: Object.fromEntries(t.map(r => [r.relname, r])), f: Object.fromEntries(f.map(r => [r.fn, r])) };
}

const d = await labPreJ1();

// ═══ 0) PRÉ-VOO antes de qualquer SQL novo ═══════════════════════════════════════════════════════════════════════
let p0 = await pre(d);
ok(p0.length > 25 && p0.filter(r => r.situacao === "FALHA").length === 0, "pré-voo roda ANTES do J1 sem erro e sem nenhuma FALHA: " + p0.filter(r => r.situacao === "FALHA").map(r => r.item).join("; "));
ok(achar(p0, "= @").length === 5 && achar(p0, "= @").every(r => r.valor === "confere" && r.situacao === "OK"), "pré-voo: os cinco IDs apontam para os @ certos");
ok(achar(p0, "cadastro antigo biachinicks")[0].valor === "0" && achar(p0, "qualquer outra joiner com o e-mail")[0].valor === "0", "pré-voo: o cadastro antigo (id 12) não existe e ninguém divide o e-mail das cinco");
ok(achar(p0, "(contas_joiner) — total")[0].valor.startsWith("n/a") && achar(p0, "J1 (contas_joiner)")[0].valor === "NÃO", "pré-voo antes do J1: mostra n/a e que o J1 ainda não está aplicado (sem erro)");
ok(achar(p0, "contas no Auth com o e-mail de uma das cinco")[0].valor === "0", "pré-voo: nenhuma conta do Auth com o e-mail das cinco");

// ═══ 1) PRÉ-VOO NEGATIVO: acusa duplicidade e conta já existente ════════════════════════════════════════════════════
{
  const x = await labPreJ1();
  await x.exec("update public.joiners set email = 'nicolle@exemplo.com' where id = 700");   // outra joiner com o e-mail da nicknowsaurus
  let r = await pre(x); ok(achar(r, "qualquer outra joiner com o e-mail")[0].situacao === "FALHA" && achar(r, "id 272: joiners com ESTE e-mail")[0].situacao === "FALHA", "pré-voo ACUSA e-mail dividido com a nicknowsaurus");
  await x.exec("update public.joiners set email = 'compartilhado@exemplo.com' where id = 700; insert into public.joiners (id, cog, nome, email, twitter) values (12, 'biachinicks', 'nicolle antiga', 'nicolle@exemplo.com', '@biachinicks')");
  r = await pre(x); ok(achar(r, "cadastro antigo biachinicks")[0].situacao === "FALHA", "pré-voo ACUSA a volta do cadastro antigo biachinicks (id 12)");
  await x.exec("delete from public.joiners where id = 12; insert into public.joiners (id, cog, nome, email, twitter) values (13, 'AL.MELO', 'Al duplicada', 'outro@exemplo.com', '@x')");
  r = await pre(x); ok(achar(r, "id 2: joiners com ESTE cog")[0].situacao === "FALHA", "pré-voo ACUSA @ repetido ignorando maiúsculas (al.melo / AL.MELO)");
  await x.exec("delete from public.joiners where id = 13; insert into auth.users values ('" + U(40) + "', 'LYRIC@exemplo.com', now())");
  r = await pre(x); ok(achar(r, "contas no Auth com o e-mail de uma das cinco")[0].situacao === "ATENÇÃO" && achar(r, "já CONFIRMADAS")[0].situacao === "ATENÇÃO", "pré-voo ACUSA conta do Auth já existente com o e-mail de uma das cinco (confirmada)");
}

// ═══ 2) OS QUATRO SQLs: o que mudam em permissões ═══════════════════════════════════════════════════════════════════
const antes = await foto(d);
const fotoA = await p0b(d);
const antesPoliticas = (await d.query("select count(*)::int c from pg_policies where schemaname = 'public'")).rows[0].c;
for (const [apl, ver] of [["J1_estrutura_aplicar.sql", "J1_verificar.sql"], ["J3_tentativas_aplicar.sql", "J3_tentativas_verificar.sql"], ["J4a_publico_aplicar.sql", "J4a_publico_verificar.sql"], ["J4d_ondas_aplicar.sql", "J4d_ondas_verificar.sql"]]) {
  const e = await rodar(d, apl, J); ok(e === null, `${apl} aplica sem erro` + (e ? ": " + e : ""));
  const v = (await d.query(sql(ver, J))).rows; ok(v.length >= 3, `${ver} responde`);
}
const depois = await foto(d);
const fotoB = await p0b(d);
ok(fotoA === fotoB && /\/ [0-9a-f]{32}/.test(fotoA), "P0b (SQL de produção): o código de conferência das permissões do que JÁ EXISTIA é IDÊNTICO antes e depois de J1+J3+J4a+J4d");
const novasTab = Object.keys(depois.t).filter(k => !antes.t[k]), novasFn = Object.keys(depois.f).filter(k => !antes.f[k]);
console.log("INFO  tabelas/visões novas:", novasTab.join(", ")); console.log("INFO  funções novas:", novasFn.join(", "));
// a) nada que já existia mudou de permissão ou de política
const mudou = Object.keys(antes.t).filter(k => JSON.stringify(antes.t[k]) !== JSON.stringify(depois.t[k]));
ok(mudou.length === 0, "NENHUMA tabela/visão que já existia teve permissão, RLS ou política alterada pelos quatro SQLs" + (mudou.length ? " → " + mudou.join(", ") : ""));
const fnMudou = Object.keys(antes.f).filter(k => depois.f[k] && (antes.f[k].a !== depois.f[k].a || antes.f[k].b !== depois.f[k].b));
ok(fnMudou.length === 0, "NENHUMA função que já existia teve a permissão de execução alterada" + (fnMudou.length ? " → " + fnMudou.join(", ") : ""));
// b) tabelas novas: fechadas a visitante e joiner (inclusive a lista de ondas)
const tabFechadas = ["tentativas_acesso", "ativacao_ondas", "ativacao_estado"];
console.log("INFO  privilégios das tabelas novas:", JSON.stringify(tabFechadas.map(t => [t, depois.t[t] && depois.t[t].rls, ["as_", "ai", "au", "ad", "bs", "bi", "bu", "bd"].filter(c => depois.t[t] && depois.t[t][c])])));
ok(tabFechadas.every(t => depois.t[t] && depois.t[t].rls && !["as_", "ai", "au", "ad", "bs", "bi", "bu", "bd"].some(c => depois.t[t][c])), "tentativas_acesso, ativacao_ondas e ativacao_estado: RLS ligado e NENHUM privilégio para visitante nem joiner");
// c) a única visão nova é a pública de 5 colunas
const visoesNovas = novasTab.filter(k => depois.t[k].k === "v");
ok(JSON.stringify(visoesNovas) === JSON.stringify(["joiners_publico"]) && depois.t.joiners_publico.as_ && !depois.t.joiners_publico.ai && !depois.t.joiners_publico.au && !depois.t.joiners_publico.ad, "a única visão nova é joiners_publico, somente leitura");
const colsPublicas = (await d.query("select string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns where table_schema = 'public' and table_name = 'joiners_publico'")).rows[0].c;
ok(!/email|cpf|telefone|whatsapp|rua|cep|numero|bairro/i.test(colsPublicas), "joiners_publico não expõe e-mail, CPF, telefone nem endereço: " + colsPublicas);
// d) funções novas: quem executa o quê
const anonFn = novasFn.filter(f => depois.f[f].a), authFn = novasFn.filter(f => depois.f[f].b && !depois.f[f].a);
console.log("INFO  executáveis pelo visitante:", anonFn.join(", ")); console.log("INFO  executáveis só pela joiner logada:", authFn.join(", "));
ok(JSON.stringify(anonFn.sort()) === JSON.stringify(["entrar_com_arroba(p_identificador text)"].sort()) || anonFn.every(f => /^(entrar_com_arroba|contar_recrutados)\(/.test(f)), "o visitante só executa as funções públicas de identidade mínima: " + anonFn.join(", "));
ok(authFn.every(f => /^(ativar_minha_conta|meu_cog|meu_joiner_id|meus_dados|cog_e_da_conta|admin_[a-z_]+)\(/.test(f)), "a joiner logada só executa funções vinculadas à própria conta ou de administração (que conferem is_admin): " + authFn.join(", "));
ok(!depois.f["ativacao_liberada(p_joiner_id bigint)"].a && !depois.f["ativacao_liberada(p_joiner_id bigint)"].b, "ativacao_liberada (a lista) não é executável por visitante nem joiner");
// e) ninguém logado enxerga mais do que o visitante enxerga hoje
{
  const verTudo = Object.keys(depois.t).filter(k => depois.t[k].k === "r" || depois.t[k].k === "v").filter(k => depois.t[k].bs);
  await d.exec(`insert into auth.users values ('${U(20)}', 'fora@exemplo.com', now())`);
  const excedentes = [];
  for (const t of verTudo) { const a = await n(d, "anon", null, `select 1 from public.${t}`), b = await n(d, "authenticated", 20, `select 1 from public.${t}`); if ((b ?? 0) > (a ?? 0)) excedentes.push(`${t} (${b} > ${a})`); }
  ok(excedentes.length === 0, `uma conta logada (sem vínculo) NÃO lê mais linhas que o visitante em nenhuma das ${verTudo.length} tabelas/visões` + (excedentes.length ? " → " + excedentes.join("; ") : ""));
  console.log("INFO  legíveis só pela joiner logada:", verTudo.filter(t => !depois.t[t].as_ && depois.t[t].bs).join(", "));
  const soLogada = novasTab.filter(t => !depois.t[t].as_ && depois.t[t].bs);
  ok(JSON.stringify(soLogada.sort()) === JSON.stringify(["contas_joiner", "vinculos_pendentes"]) && depois.t.contas_joiner.rls && depois.t.vinculos_pendentes.rls && !depois.t.contas_joiner.bi && !depois.t.contas_joiner.bu && !depois.t.contas_joiner.bd && !depois.t.vinculos_pendentes.bi && !depois.t.vinculos_pendentes.bu && !depois.t.vinculos_pendentes.bd, "as ÚNICAS tabelas novas legíveis pela joiner logada são contas_joiner e vinculos_pendentes, só leitura e com RLS (o recorte por dono é provado abaixo, com linhas reais)");
}

// ═══ 3) conta já ativada ANTES do piloto (deve ser preservada) ═══════════════════════════════════════════════════
await d.exec(`insert into auth.users values ('${U(90)}', 'antiga@exemplo.com', now()); insert into public.contas_joiner (user_id, joiner_id, origem) values ('${U(90)}', 900, 'admin')`);
const snapContas = async () => JSON.stringify([(await d.query("select user_id, joiner_id, origem from public.contas_joiner order by user_id")).rows, (await d.query("select id, lower(email) e, email_confirmed_at is not null c from auth.users order by id")).rows]);
const contasAntesDoPiloto = await snapContas();

// ═══ 4) P1: as guardas (cada falha deixa tudo como estava) ══════════════════════════════════════════════════════════
const estado0 = await estadoOndas(d);
async function recusa(rotulo, preparar, reverter, padrao) {
  await d.exec(preparar); const e = await rodar(d, "P1_liberar_cinco_aplicar.sql", PS); await d.exec(reverter);
  ok(e !== null && padrao.test(e) && (await estadoOndas(d)) === estado0, `P1 ABORTA e não altera nada: ${rotulo}` + (e && !padrao.test(e) ? " (mensagem: " + e.slice(0, 120) + ")" : ""));
}
await recusa("o ID 272 passa a ter outro @", "update public.joiners set cog = 'nicolle' where id = 272", "update public.joiners set cog = 'nicknowsaurus' where id = 272", /não corresponde ao @nicknowsaurus/);
await recusa("o e-mail da nicknowsaurus é dividido com outro cadastro", "update public.joiners set email = 'nicolle@exemplo.com' where id = 701", "update public.joiners set email = 'compartilhado@exemplo.com' where id = 701", /ambiguidade/);
await recusa("o cadastro antigo biachinicks (id 12) existe", "insert into public.joiners (id, cog, nome, email, twitter) values (12, 'biachinicks', 'antiga', 'antiga12@exemplo.com', '@biachinicks')", "delete from public.joiners where id = 12", /biachinicks.*ainda existe/);
await recusa("há outra joiner na lista de ondas", "insert into public.ativacao_ondas (joiner_id, onda) values (500, 1)", "delete from public.ativacao_ondas where joiner_id = 500", /fora das cinco/);
await recusa("liberar_todas está ligado", "update public.ativacao_estado set liberar_todas = true", "update public.ativacao_estado set liberar_todas = false", /liberar_todas/);
await recusa("uma das cinco está bloqueada", "update public.joiners set bloqueado = true where id = 42", "update public.joiners set bloqueado = false where id = 42", /bloqueado/);
await recusa("uma das cinco ficou sem e-mail válido", "update public.joiners set email = 'sem-formato' where id = 7213", "update public.joiners set email = 'tali@exemplo.com' where id = 7213", /e-mail válido/);
await recusa("o @ de uma das cinco também é twitter de outro cadastro", "update public.joiners set twitter = '@gnabjubs' where id = 500", "update public.joiners set twitter = '@fora_da_lista' where id = 500", /twitter de outro cadastro/);
await recusa("uma das cinco não existe", "update public.joiners set id = 999999 where id = 187751", "update public.joiners set id = 187751 where id = 999999", /não corresponde|achei 0/);
{ const g = await labPreJ1(); const e = await rodar(g, "P1_liberar_cinco_aplicar.sql", PS); ok(/J1 não está aplicado/.test(e || ""), "P1 ABORTA se o J1 não estiver aplicado"); }

// ═══ 5) P1 aplica ═══════════════════════════════════════════════════════════════════════════════════════════════
const e1 = await rodar(d, "P1_liberar_cinco_aplicar.sql", PS); ok(e1 === null, "P1 aplica sem erro" + (e1 ? ": " + e1 : ""));
let v = await p1v(d);
ok(await p0b(d) === fotoA, "P0b: depois do P1 o código de conferência continua IDÊNTICO ao de antes de tudo");
ok(v["lista de ondas (esperado 5)"] === "5" && v["ids na lista de ondas (esperado 2, 42, 272, 7213, 187751)"] === "2, 42, 272, 7213, 187751" && v["onda liberada (esperado 1; 0 = piloto pausado)"] === "1" && v["liberar_todas (esperado false)"] === "false", "P1_verificar: lista = exatamente as cinco, onda 1, sem liberar_todas: " + JSON.stringify(v).slice(0, 220));
ok(v["joiners com ativação liberada (esperado 5; 0 = piloto pausado)"] === "5" && v["liberadas FORA das cinco (esperado 0)"] === "0", "P1_verificar: 5 liberadas e nenhuma fora da lista");
ok(v["o visitante executa ativar_minha_conta (esperado false)"] === "false" && v["o visitante ou a joiner lê a lista de ondas (esperado false)"] === "false" && v["a joiner executa ativacao_liberada (esperado false)"] === "false", "P1_verificar: nada novo aberto a visitante ou joiner");
ok(await snapContas() === contasAntesDoPiloto, "P1 não tocou em nenhuma conta, vínculo ou usuário do Auth (a conta antiga continua igual)");
ok(/ja esta liberado|já está liberado/.test(await rodar(d, "P1_liberar_cinco_aplicar.sql", PS) || ""), "P1 recusa ser aplicado duas vezes (use verificar ou desativar)");
const libertas = (await d.query("select j.id from public.joiners j where public.ativacao_liberada(j.id) order by 1")).rows.map(r => Number(r.id));
ok(JSON.stringify(libertas) === JSON.stringify([2, 42, 272, 7213, 187751]), "ativacao_liberada é verdadeira exatamente para os IDs 2, 42, 272, 7213 e 187751");

// ═══ 6) ATIVAÇÃO: as cinco entram; ninguém mais ═════════════════════════════════════════════════════════════════
const emailDe = id => (id === 2 ? "al.melo" : id === 272 ? "nicolle" : id === 42 ? "lyric" : id === 187751 ? "gnab" : "tali") + "@exemplo.com";
for (const [id, , uid] of CINCO) await d.exec(`insert into auth.users values ('${U(uid)}', '${emailDe(id)}', now(), null)`);   // o que o servidor cria (admin.createUser com e-mail confirmado, senha aleatória desconhecida, SEM login)
const ativar = async (uid, cog) => (await como(d, "authenticated", uid, `select public.ativar_minha_conta('${cog}') as r`)).rows?.[0]?.r;
await d.exec(`insert into auth.users values ('${U(21)}', 'compartilhado@exemplo.com', now(), null), ('${U(23)}', 'curioso@exemplo.com', now(), null)`);
const semLogin = async () => (await p1v(d))["contas do Auth com e-mail marcado CONFIRMADO e SEM primeiro login (convidadas que ainda não digitaram o código; o e-mail só é PROVADO no primeiro login)"];
ok(await semLogin() === "5", "contas recém-criadas pelo servidor (confirmadas, sem login): o P1_verificar as mostra como 'ainda NÃO provaram o e-mail' (5)");
// NEGATIVO: ninguém, de fora, consegue vincular uma conta recém-criada ANTES de ela abrir sessão com o código
for (const [, cog] of CINCO) ok((await ativar(23, cog)).status === "pendente", `NEGATIVO: outra conta autenticada tentando o @${cog} antes de a dona digitar o código → pendente, não vincula`);
ok((await d.query("select count(*)::int c from public.contas_joiner where joiner_id in (2, 272, 42, 187751, 7213)")).rows[0].c === 0, "NEGATIVO: nenhuma das cinco foi vinculada sem a dona ter aberto sessão");
ok(negado(await como(d, "anon", null, "select public.ativar_minha_conta('al.melo')")), "NEGATIVO: sem sessão (visitante) não há vínculo possível, mesmo com a conta já confirmada no Auth");
// negativos
const contasFora = async () => (await d.query("select count(*)::int c from public.contas_joiner where joiner_id not in (2, 272, 42, 187751, 7213, 900)")).rows[0].c;
ok((await ativar(20, "fora_da_lista")).status === "aguardando_liberacao" && await contasFora() === 0, "NEGATIVO: joiner FORA da lista (conta com o e-mail certo) → 'aguardando liberação' e nenhuma conta é criada");
ok((await d.query("select count(*)::int c from public.vinculos_pendentes where user_id = '" + U(20) + "'")).rows[0].c === 0, "NEGATIVO: fora da lista não deixa nem pedido de vínculo pendente");
ok((await ativar(21, "dup_a")).status === "pendente" && await contasFora() === 0, "NEGATIVO: e-mail compartilhado fora da lista → vínculo PENDENTE (sem conta; a administradora decide)");
ok((await ativar(23, "al.melo")).status === "pendente" && (await d.query("select count(*)::int c from public.contas_joiner where joiner_id = 2")).rows[0].c === 0, "NEGATIVO: conta com OUTRO e-mail tentando o @ de uma das cinco → pendente, não vincula");
ok((await ativar(11, "lyrichangbin")).status === "pendente" && (await d.query("select count(*)::int c from public.contas_joiner where joiner_id = 42")).rows[0].c === 0, "NEGATIVO: a conta da al.melo tentando o @ da lyrichangbin → pendente, não vincula");
ok((await ativar(11, "inexistente_xyz")).status === "pendente", "NEGATIVO: @ que não existe → pendente");
// positivos
for (const [id, cog, uid] of CINCO) { await d.exec(`update auth.users set last_sign_in_at = now() where id = '${U(uid)}'`); }   // verifyOtp: a sessão nasce do código
ok(await semLogin() === "0", "depois do código digitado (primeiro login), nenhuma conta fica 'confirmada sem provar'");
for (const [id, cog, uid] of CINCO) ok((await ativar(uid, cog)).status === "ok", `@${cog} (ID ${id}) ativa com o e-mail verificado do próprio cadastro`);
const pares = (await d.query("select c.joiner_id::int id, j.cog from public.contas_joiner c join public.joiners j on j.id = c.joiner_id where c.joiner_id in (2, 272, 42, 187751, 7213) order by 1")).rows.map(r => `${r.id}=${r.cog}`).join(",");
ok(pares === "2=al.melo,42=lyrichangbin,272=nicknowsaurus,7213=ttalilitinha,187751=gnabjubs", "contas vinculadas às cinco: exatamente os pares ID = @ esperados (" + pares + ")");
ok((await d.query("select count(*)::int c from public.contas_joiner")).rows[0].c === 6, "total de contas = as cinco + a conta antiga preservada");
ok((await ativar(23, "nicknowsaurus")).status === "pendente" && (await d.query("select count(*)::int c from public.contas_joiner where joiner_id = 272")).rows[0].c === 1, "outra conta NÃO toma o lugar da nicknowsaurus (vínculo único por joiner)");
ok((await ativar(12, "nicknowsaurus")).status === "ok", "repetir a ativação da conta já vinculada é inofensivo (idempotente)");
ok(await p0b(d) === fotoA, "P0b: depois das cinco ativações o código de conferência continua IDÊNTICO");
ok((await p1v(d))["contas vinculadas por e-mail verificado cujo usuário NUNCA abriu sessão (esperado 0: o vínculo exige a sessão aberta pelo código)"] === "0", "nenhuma conta vinculada por e-mail verificado sem sessão aberta pelo código");
{ await d.exec(`insert into auth.users values ('${U(77)}', 'quebra@exemplo.com', now(), null); insert into public.joiners (id, cog, nome, nome_site, email, twitter) values (777, 'quebra', 'Q', 'Q', 'quebra@exemplo.com', '@quebra'); insert into public.contas_joiner (user_id, joiner_id, origem) values ('${U(77)}', 777, 'email_verificado')`);
  ok((await p1v(d))["contas vinculadas por e-mail verificado cujo usuário NUNCA abriu sessão (esperado 0: o vínculo exige a sessão aberta pelo código)"] === "1", "o alarme do P1_verificar ACUSA um vínculo sem sessão (simulado)");
  await d.exec(`delete from public.contas_joiner where user_id = '${U(77)}'; delete from public.joiners where id = 777; delete from auth.users where id = '${U(77)}'`); }
v = await p1v(d);
ok(v["vínculo com @ DIFERENTE do esperado (esperado 0)"] === "0" && v["contas vinculadas às cinco (pares ID = @)"].split(" · ").length === 5, "P1_verificar mostra os cinco pares corretos e nenhum vínculo trocado");
// o que a conta logada de uma das cinco consegue (nada além do visitante)
{
  const r = await como(d, "authenticated", 12, "select public.meu_cog() c, public.meu_joiner_id() i, (select count(*) from public.meus_dados()) n");
  ok(r.rows?.[0]?.c === "nicknowsaurus" && Number(r.rows[0].i) === 272 && Number(r.rows[0].n) === 1, "a conta da nicknowsaurus enxerga a própria identidade (cog, ID 272) e meus_dados() devolve UMA linha");
  const md = await como(d, "authenticated", 12, "select to_jsonb(m) as j from public.meus_dados() m"); console.log("INFO  meus_dados:", JSON.stringify(md).slice(0, 160)); ok(md.rows?.length === 1 && String(md.rows[0].j.cog ?? md.rows[0].j.id) !== "" && (md.rows[0].j.cog === "nicknowsaurus" || Number(md.rows[0].j.id) === 272), "meus_dados() devolve só a linha dela");
  ok(negado(await como(d, "authenticated", 12, "select public.admin_vinculos_pendentes()")) || !!(await como(d, "authenticated", 12, "select public.admin_vinculos_pendentes()")).erro, "as funções de administração recusam quem não é administradora");
  const cj = await como(d, "authenticated", 12, "select joiner_id::int j from public.contas_joiner"); ok(cj.rows?.length === 1 && cj.rows[0].j === 272, "a conta da nicknowsaurus lê em contas_joiner SÓ o próprio vínculo (1 linha, ID 272)");
  ok((await n(d, "authenticated", 20, "select 1 from public.contas_joiner")) === 0 && (await n(d, "authenticated", 12, "select 1 from public.vinculos_pendentes")) === 0 && (await n(d, "authenticated", 20, "select 1 from public.vinculos_pendentes")) === 0, "conta sem vínculo não lê contas_joiner; vinculos_pendentes é só da administradora");
  ok((await n(d, "authenticated", 1, "select 1 from public.contas_joiner")) === 6 && (await n(d, "authenticated", 1, "select 1 from public.vinculos_pendentes")) >= 1, "a administradora lê todos os vínculos e os pedidos pendentes");
  ok(negado(await como(d, "anon", null, "select * from public.contas_joiner")) && negado(await como(d, "anon", null, "select * from public.vinculos_pendentes")), "o visitante não lê contas_joiner nem vinculos_pendentes");
  ok(negado(await como(d, "authenticated", 12, "insert into public.contas_joiner (user_id, joiner_id) values ('" + U(12) + "', 2)")) && negado(await como(d, "authenticated", 12, "update public.contas_joiner set joiner_id = 2")) && negado(await como(d, "authenticated", 12, "delete from public.contas_joiner")), "a conta logada não cria, troca nem apaga vínculo");
  const sem = await como(d, "authenticated", 12, "select * from public.ativacao_ondas"); ok(negado(sem), "a conta logada não lê a lista de ondas");
  ok(negado(await como(d, "authenticated", 12, "select public.ativacao_liberada(2)")), "a conta logada não executa ativacao_liberada");
  ok(negado(await como(d, "anon", null, "select public.ativar_minha_conta('al.melo')")), "o visitante não executa ativar_minha_conta");
}

// ═══ 7) DESATIVAR: pausa sem apagar nada ═════════════════════════════════════════════════════════════════════════
const antesDesativar = await snapContas();
const ed = await rodar(d, "P1_desativar.sql", PS); ok(ed === null, "P1_desativar aplica sem erro" + (ed ? ": " + ed : ""));
ok(await snapContas() === antesDesativar, "desativar NÃO apagou nem alterou nenhuma conta, vínculo ou usuário do Auth");
v = await p1v(d);
ok(v["joiners com ativação liberada (esperado 5; 0 = piloto pausado)"] === "0" && v["onda liberada (esperado 1; 0 = piloto pausado)"] === "0" && v["lista de ondas (esperado 5)"] === "5", "depois de desativar: 0 liberadas, a lista é preservada");
ok((await como(d, "authenticated", 12, "select public.meu_cog() c")).rows[0].c === "nicknowsaurus", "quem já ativou continua com a conta reconhecida depois de desativar");
await d.exec(`insert into auth.users values ('${U(30)}', 'novo@exemplo.com', now())`);
const antesTentativaNova = await snapContas();
ok((await ativar(30, "fora_da_lista")).status !== "ok" && await contasFora() === 0, "com o piloto pausado nenhuma NOVA ativação acontece");
ok(/não está liberado/.test(await rodar(d, "P1_desativar.sql", PS) || ""), "desativar duas vezes é recusado (nada a pausar)");
ok(await rodar(d, "P1_liberar_cinco_aplicar.sql", PS) === null && (await p1v(d))["joiners com ativação liberada (esperado 5; 0 = piloto pausado)"] === "5", "reativar (P1 de novo) volta a liberar exatamente as cinco");
ok(await snapContas() === antesTentativaNova, "reativar também não tocou em nenhuma conta");
fim();
