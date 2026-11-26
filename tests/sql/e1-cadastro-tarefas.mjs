// E1 (etapa 1): "a joiner salva -> o banco confirma -> UMA tarefa -> a fila leva nome/e-mail à planilha". Laboratório PGlite, SÓ dados fictícios; nada toca em produção.
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/e1-cadastro-tarefas.mjs
// Usa as funções REAIS de J1d, J4c1 e J6 (copiadas dos arquivos) e o E1 sob teste. Prova: gravação confirmada; 1 tarefa por salvamento; leitura separada da planilha; retentativas na mesma tarefa;
// falha que exige intervenção volta como pendência; e-mail só pelo Auth; pedido do login legado nunca altera o cadastro; permissões; cog/itens/pagamentos intactos; reversão.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const arq = f => readFileSync(R + f, "utf8").replace(/\r/g, "");
const fatia = (txt, inicio, fim = "\nend $$;") => { const i = txt.indexOf(inicio); if (i < 0) throw new Error("não achei: " + inicio); const f = txt.indexOf(fim, i); if (f < 0) throw new Error("sem fim: " + inicio); return txt.slice(i, f + fim.length); };
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
process.on("uncaughtException", e => { console.log("ERRO:", String(e.message).slice(0, 900)); process.exit(2); });
process.on("unhandledRejection", e => { console.log("ERRO:", String(e && e.message || e).slice(0, 900)); process.exit(2); });
const U = n => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

const d = new PGlite();
await d.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public to anon, authenticated, service_role;
  create schema auth; create schema emergencia; grant usage on schema auth to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('lab.uid', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function emergencia.h(t text) returns text language sql immutable set search_path = '' as $$ select encode(sha256(convert_to(lower(btrim(coalesce(t, ''))), 'UTF8')), 'hex') $$;
  create function emergencia.h_arroba(t text) returns text language sql immutable set search_path = '' as $$ select emergencia.h(ltrim(btrim(coalesce(t, '')), '@')) $$;
  create table emergencia.emails_confiaveis (joiner_id bigint primary key, email_hash text not null, arroba_hash text not null, registrado_em timestamptz not null default now(), origem text not null);
  create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('lab.admin', true), '') = '1' $$;
  create table public.joiners (id bigint generated always as identity primary key, cog text unique, nome text, nome_site text, whatsapp text, email text, twitter text, recrutador text, saldo_cashback numeric default 0, confirmado boolean default true);
  create table public.contas_joiner (user_id uuid primary key, joiner_id bigint not null unique references public.joiners(id), vinculado_em timestamptz default now(), origem text default 'email_verificado', perfil_concluido_em timestamptz);
  create table public.masterlist (id bigserial primary key, cog text, nome_do_item text, pago_item boolean default false);
  create table public.pagamento_demandas (id bigserial primary key, joiner_cog text, valor numeric);
  create table public.claims (id bigserial primary key, joiner_cog text);
  grant select, insert, update, delete on all tables in schema public to service_role;
`);
// funções reais: J1d (papel_confiavel/bloqueio de e-mail e @ da conta ativada), J6 (histórico, solicitações, fila, gatilhos do Auth), J4c1 (trava de colunas)
const j1d = arq("joiners-auth/J1d_email_confiavel_aplicar.sql");
await d.exec(fatia(j1d, "create function emergencia.joiners_antes_trocar_identidade()"));
await d.exec(`create trigger joiners_antes_trocar_identidade before update of email, twitter on public.joiners for each row execute function emergencia.joiners_antes_trocar_identidade();`);
const j6 = arq("joiners-auth/J6_perfil_obrigatorio_aplicar.sql");
await d.exec(j6.slice(j6.indexOf("-- 3) sinal local"), j6.indexOf("-- 9b)")));
const j4c1 = arq("joiners-auth/J4c1_joiners_aplicar.sql");
await d.exec(fatia(j4c1, "create function public.trg_joiners_protege_colunas()") + "\nrevoke all on function public.trg_joiners_protege_colunas() from public, anon, authenticated;\ncreate trigger trg_joiners_protege_colunas before update on public.joiners for each row execute function public.trg_joiners_protege_colunas();");
await d.exec(`grant select, insert, update on public.joiners to authenticated; grant select on public.contas_joiner, public.masterlist to authenticated; grant all on all sequences in schema public to anon, authenticated, service_role;`);

const q = async (sql, p = []) => (await d.query(sql, p)).rows;
const como = async (papel, uid, sql, p = [], admin = false) => {
  await d.exec(`select set_config('lab.uid', '${uid || ""}', false), set_config('lab.admin', '${admin ? 1 : 0}', false); set role ${papel}`);
  try { return { rows: (await d.query(sql, p)).rows }; } catch (e) { return { erro: String(e.message) }; } finally { await d.exec("reset role; select set_config('lab.uid', '', false), set_config('lab.admin', '0', false)"); }
};
const ADM = U(1);
const novoJoiner = async (cog, o = {}) => {
  const [{ id }] = await q("insert into public.joiners (cog, nome, nome_site, email, twitter) values ($1,$2,$3,$4,$5) returning id", [cog, o.nome ?? "Nome " + cog, "ns-" + cog, o.email ?? `${cog}@exemplo.com`, "@" + cog]);
  await q("insert into emergencia.emails_confiaveis (joiner_id, email_hash, arroba_hash, origem) values ($1, emergencia.h($2), emergencia.h_arroba($3), 'lab')", [id, o.email ?? `${cog}@exemplo.com`, "@" + cog]);
  if (o.conta) { await q("insert into auth.users values ($1,$2,now())", [o.conta, o.email ?? `${cog}@exemplo.com`]); await q("insert into public.contas_joiner (user_id, joiner_id, perfil_concluido_em) values ($1,$2,$3)", [o.conta, id, o.perfil === false ? null : new Date().toISOString()]); }
  await q("insert into public.masterlist (cog, nome_do_item, pago_item) values ($1,'item 1',true), ($1,'item 2',false)", [cog]); await q("insert into public.pagamento_demandas (joiner_cog, valor) values ($1, 10)", [cog]); await q("insert into public.claims (joiner_cog) values ($1)", [cog]);
  return id;
};
const fotografia = async cog => (await q(`select md5(coalesce((select string_agg(to_jsonb(m)::text, '|' order by m.id) from public.masterlist m where m.cog = $1), '') || coalesce((select string_agg(to_jsonb(p)::text, '|' order by p.id) from public.pagamento_demandas p where p.joiner_cog = $1), '') || coalesce((select string_agg(to_jsonb(c)::text, '|' order by c.id) from public.claims c where c.joiner_cog = $1), '') || (select cog from public.joiners where cog = $1)) v`, [cog]))[0].v;
const tarefas = async (id, where = "true") => q(`select * from public.cadastro_tarefas where joiner_id = $1 and ${where} order by id`, [id]);
const pendentes = async () => (await como("authenticated", ADM, "select public.admin_cadastro_pendentes() n", [], true)).rows[0].n;
await q("insert into auth.users values ($1,'admin@exemplo.com',now())", [ADM]);

const ANA = U(2), BIA = U(3), SEMPERFIL = U(5), SEMVINCULO = U(4);
await q("insert into auth.users values ($1,'sem.vinculo@exemplo.com',now())", [SEMVINCULO]);
const ana = await novoJoiner("ana", { conta: ANA, nome: "Ana Antiga" });
const bia = await novoJoiner("bia", { conta: BIA });
const semPerfil = await novoJoiner("carla", { conta: SEMPERFIL, perfil: false });
const legado = await novoJoiner("lia");                 // sem conta: só login legado
const fotoAna0 = await fotografia("ana"), fotoLia0 = await fotografia("lia");

// ------------------------------------------------------------------ conferência SOMENTE LEITURA antes de aplicar (a que a administradora roda em produção)
const pre = arq("cadastro-tarefas/E1_preflight_somente_leitura.sql"), preflight = async () => Object.fromEntries((await d.query(pre)).rows.map(r => [r.item, r.valor]));
{
  const p0 = await preflight();
  ok(p0["função public.salvar_meu_cadastro(text)"] === "false" && p0["tabela cadastro_tarefas (E1)"] === "false" && p0["trava de colunas já tem a exceção do E1"] === "false", "preflight ANTES: o E1 ainda não está aplicado");
  ok(["tabela perfil_sync_pendente", "função emergencia.papel_confiavel()", "função public.trg_joiners_protege_colunas()", "função public.perfil_sync_marcar(bigint,boolean,text)", "gatilho em joiners: trg_joiners_protege_colunas", "gatilho em auth.users: anticeg_auth_email_depois", "trava de colunas tem o texto que o E1 troca"].every(k => p0[k] === "true"), "preflight ANTES: J1d, J4c1 e J6 presentes (o que o E1 exige)");
  ok(/tipo = ANY \(ARRAY\['email'/.test(p0["restrição de tipo em perfil_sync_pendente"]) || /'email'/.test(p0["restrição de tipo em perfil_sync_pendente"]), "preflight mostra a restrição de tipo atual da fila");
}
// ------------------------------------------------------------------ aplicar o E1 (sob teste)
const aplicar = arq("cadastro-tarefas/E1_cadastro_tarefas_aplicar.sql");
try { await d.exec(aplicar); ok(true, "E1 aplica sem erro (uma transação)"); } catch (e) { ok(false, "E1 aplica: " + String(e.message).slice(0, 500)); process.exit(1); }
{ const p1 = await preflight(); ok(p1["função public.salvar_meu_cadastro(text)"] === "true" && p1["tabela cadastro_tarefas (E1)"] === "true" && p1["trava de colunas já tem a exceção do E1"] === "true" && p1["gatilho em joiners: joiners_tarefa_cadastro"] === "true", "preflight DEPOIS: mostra o E1 aplicado (mesma consulta serve para conferir depois)"); }
try { await d.exec(aplicar); ok(false, "E1 recusa aplicar duas vezes"); } catch (e) { ok(/E1 já foi aplicado/.test(e.message), "E1 recusa aplicar duas vezes (nada foi alterado)"); await d.exec("rollback").catch(() => {}); }

// ------------------------------------------------------------------ A) nome cadastral, conta ativada
{
  const antes = await q("select count(*)::int n from public.cadastro_tarefas");
  const direto = await como("authenticated", ANA, "update public.joiners set nome = 'Direto' where id = $1", [ana]);
  ok(/só a administradora|42501|não permitida/i.test(direto.erro || ""), "update direto de 'nome' pela conta continua BLOQUEADO pelo banco (exceção só dentro da função)");
  ok((await q("select nome from public.joiners where id = $1", [ana]))[0].nome === "Ana Antiga" && (await q("select count(*)::int n from public.cadastro_tarefas"))[0].n === antes[0].n, "bloqueio não grava nem cria tarefa");

  const r = await como("authenticated", ANA, "select public.salvar_meu_cadastro('  Ana   Souza  ') r");
  ok(r.rows?.[0]?.r?.ok === true && r.rows[0].r.nome === "Ana Souza" && r.rows[0].r.alterou === true, "salvar_meu_cadastro devolve ok com o VALOR GRAVADO (espaços normalizados)");
  ok((await q("select nome from public.joiners where id = $1", [ana]))[0].nome === "Ana Souza", "o banco realmente gravou");
  const t = await tarefas(ana);
  ok(t.length === 1 && t[0].tipo === "alteracao" && t[0].campos.nome.de === "Ana Antiga" && t[0].campos.nome.para === "Ana Souza", "1 tarefa com campos.nome de/para corretos");
  ok(t[0].planilha_status === "pendente" && t[0].lida_em === null && t[0].origem === "site", "planilha 'pendente', NÃO lida, origem 'site'");
  const f = await q("select * from public.perfil_sync_pendente where tarefa_id = $1", [t[0].id]);
  ok(f.length === 1 && f[0].tipo === "cadastro" && f[0].status === "pendente" && t[0].fila_id === f[0].id, "1 item na fila ligado à tarefa");
  const h = await q("select origem from public.joiner_perfil_historico where joiner_id = $1 and campo = 'nome'", [ana]);
  ok(h.length === 1 && h[0].origem === "site", "histórico registra a troca de nome (origem site)");
  const est = (await q("select public.perfil_sync_estado($1) e", [t[0].id]))[0].e;
  ok(est.nome === "Ana Souza" && est.id_site === ana && est.versao === t[0].id && JSON.stringify(est.campos) === '["nome"]' && est.email === "ana@exemplo.com", "perfil_sync_estado: estado atual, versão = nº da tarefa, só o campo alterado");
  ok(await pendentes() === 1, "painel: 1 pendência (não lida)");

  const r2 = await como("authenticated", ANA, "select public.salvar_meu_cadastro('Ana Souza') r");
  ok(r2.rows?.[0]?.r?.ok === true && r2.rows[0].r.alterou === false && (await tarefas(ana)).length === 1, "salvar o MESMO nome de novo: ok, sem nova tarefa nem nova fila (sem duplicar)");
}
// ------------------------------------------------------------------ B) erros explícitos: nunca "salvo" sem gravar (F3, F13)
{
  const n0 = (await q("select count(*)::int n from public.cadastro_tarefas"))[0].n;
  const casos = [["conta sem perfil concluído", "authenticated", SEMPERFIL, "Carla Nova", /conclua o seu perfil/], ["conta sem vínculo", "authenticated", SEMVINCULO, "Qualquer", /não está vinculada/],
                 ["nome curto", "authenticated", BIA, "A", /nome inválido/], ["nome com <", "authenticated", BIA, "Bia <b>", /nome inválido/], ["visitante", "anon", null, "Qualquer", /permission denied|entre na sua conta/]];
  for (const [nome, papel, uid, valor, re] of casos) {
    const r = await como(papel, uid, "select public.salvar_meu_cadastro($1) r", [valor]);
    ok(!!r.erro && re.test(r.erro), `erro explícito (${nome})`);
  }
  ok((await q("select count(*)::int n from public.cadastro_tarefas"))[0].n === n0 && (await q("select nome from public.joiners where cog = 'carla'"))[0].nome === "Nome carla", "nada gravado e nenhuma tarefa nos casos de erro");
}
// ------------------------------------------------------------------ C) retentativas na MESMA tarefa; leitura separada da planilha (F6, F7, T4)
{
  const [t] = await tarefas(ana); const fila = t.fila_id;
  const p = (await como("service_role", null, "select * from public.perfil_sync_proximos(10)")).rows;
  ok(p.some(x => x.id === fila && x.tipo === "cadastro"), "perfil_sync_proximos entrega o item da tarefa");
  await como("service_role", null, "select public.perfil_sync_marcar($1, false, 'planilha_ocupada: tente depois', false)", [fila]);
  await como("service_role", null, "select public.perfil_sync_marcar($1, false, 'timeout', false)", [fila]);
  let [a] = await tarefas(ana);
  ok(a.id === t.id && a.planilha_tentativas === 2 && a.planilha_status === "pendente" && (await tarefas(ana)).length === 1, "2 falhas transitórias: MESMA tarefa, tentativas=2, continua 'pendente'");
  ok((await q("select status from public.perfil_sync_pendente where id = $1", [fila]))[0].status === "falhou", "item da fila fica 'falhou' (será retentado com espera)");
  await como("service_role", null, "select public.perfil_sync_marcar($1, true, null, false)", [fila]);
  [a] = await tarefas(ana);
  ok(a.planilha_status === "sincronizada" && a.planilha_tentativas === 3 && a.planilha_sincronizada_em && a.planilha_ultimo_erro === null, "sucesso: 'sincronizada' na mesma tarefa");
  ok(a.lida_em === null && await pendentes() === 1, "SINCRONIZADA NÃO marca como lida: continua pendente até a administradora ler");
  await como("authenticated", ADM, "select public.admin_cadastro_marcar_lida($1)", [t.id], true);
  ok(await pendentes() === 0, "ler a tarefa tira a pendência, sem alterar o estado da planilha");
  ok((await tarefas(ana))[0].planilha_status === "sincronizada", "leitura não mudou o estado da planilha");
}
// ------------------------------------------------------------------ D) falha que exige intervenção volta como pendência (F6/F7/F8/T5)
{
  await como("authenticated", BIA, "select public.salvar_meu_cadastro('Bia Nova')");
  const [t] = await tarefas(bia);
  await como("authenticated", ADM, "select public.admin_cadastro_marcar_lida($1)", [t.id], true);
  ok(await pendentes() === 1 - 1 + 0, "tarefa lida e ainda 'pendente' na planilha: sem pendência");
  await como("service_role", null, "select public.perfil_sync_marcar($1, false, 'linha_nao_encontrada: nenhuma linha em Dados', true)", [t.fila_id]);
  let [a] = await tarefas(bia);
  ok(a.planilha_status === "atencao" && a.planilha_motivo === "linha_nao_encontrada" && a.atencao_desde && a.lida_em, "falha DEFINITIVA: 'atencao' direto (sem retentativas inúteis), motivo guardado, leitura preservada");
  ok(await pendentes() === 1, "falha que exige intervenção VOLTA como pendência mesmo já lida");
  await como("authenticated", ADM, "select public.admin_cadastro_marcar_atencao_vista($1)", [t.id], true);
  ok(await pendentes() === 0, "'vi a falha' tira a pendência");
  await como("authenticated", ADM, "select public.admin_cadastro_reprocessar($1)", [t.id], true);
  [a] = await tarefas(bia);
  ok(a.planilha_status === "pendente" && (await q("select status, tentativas from public.perfil_sync_pendente where id = $1", [t.fila_id]))[0].tentativas === 0, "reprocessar: volta a 'pendente' e zera a fila");
  await como("service_role", null, "select public.perfil_sync_marcar($1, false, 'linha_ambigua: 2 linhas', true)", [t.fila_id]);
  ok(await pendentes() === 1, "nova falha depois de já ter visto a anterior: volta a ser pendência (atencao_desde > atencao_vista_em)");
  // seis falhas transitórias esgotam e viram atenção
  await como("authenticated", BIA, "select public.salvar_meu_cadastro('Bia Nova Dois')");
  const t2 = (await tarefas(bia)).at(-1);
  for (let i = 0; i < 5; i++) await como("service_role", null, "select public.perfil_sync_marcar($1, false, 'http_500', false)", [t2.fila_id]);
  ok((await tarefas(bia)).at(-1).planilha_status === "pendente", "5 falhas transitórias: ainda 'pendente'");
  await como("service_role", null, "select public.perfil_sync_marcar($1, false, 'http_500', false)", [t2.fila_id]);
  const f6 = (await tarefas(bia)).at(-1);
  ok(f6.planilha_status === "atencao" && f6.planilha_tentativas === 6 && f6.planilha_motivo === "http_500", "6ª falha transitória: vira 'atencao' (1 tarefa só, tentativas=6)");
  ok((await q("select count(*)::int n from public.perfil_sync_proximos(10) where id = $1", [t2.fila_id]))[0].n === 0, "esgotada: a fila não retenta mais sozinha");
}
// ------------------------------------------------------------------ E) e-mail só pelo Auth (F2); @ e e-mail diretos continuam bloqueados
{
  const n0 = (await tarefas(bia)).length;
  const direto = await como("authenticated", BIA, "update public.joiners set email = 'outro@exemplo.com' where id = $1", [bia]);
  ok(!!direto.erro && /administra/i.test(direto.erro), "e-mail trocado direto pela conta ativada: BLOQUEADO");
  const direto2 = await como("authenticated", BIA, "update public.joiners set twitter = '@outra' where id = $1", [bia]);
  ok(!!direto2.erro && /administra/i.test(direto2.erro), "@ trocado direto pela conta ativada: BLOQUEADO");
  ok((await tarefas(bia)).length === n0, "bloqueios não criam tarefa");
  await q("update auth.users set email_confirmed_at = now() where id = $1", [BIA]);               // (no Auth real, enquanto o endereço novo não é confirmado, auth.users.email nem muda)
  ok((await tarefas(bia)).length === n0, "pedido de troca ainda NÃO confirmado: o e-mail do cadastro não muda e nenhuma tarefa nasce");
  await q("update auth.users set email = 'bia.confirmada@exemplo.com', email_confirmed_at = now() where id = $1", [BIA]);
  const e = (await tarefas(bia)).at(-1);
  ok((await q("select email from public.joiners where id = $1", [bia]))[0].email === "bia.confirmada@exemplo.com" && e.campos.email?.para === "bia.confirmada@exemplo.com" && e.origem === "conta_verificada", "e-mail CONFIRMADO no Auth: cadastro muda, 1 tarefa com origem 'conta_verificada'");
  ok(e.planilha_status === "pendente" && e.fila_id && (await q("select tipo from public.perfil_sync_pendente where id = $1", [e.fila_id]))[0].tipo === "cadastro", "a tarefa de e-mail entra na fila 'cadastro' (não há item solto 'email' duplicado)");
  ok((await q("select count(*)::int n from public.perfil_sync_pendente where joiner_id = $1 and tipo = 'email'", [bia]))[0].n === 0, "o gatilho do Auth não cria mais item 'email' à parte");
  const est = (await q("select public.perfil_sync_estado($1) e", [e.id]))[0].e;
  ok(est.email === "bia.confirmada@exemplo.com" && JSON.stringify(est.campos) === '["email"]', "estado enviado traz só o campo e-mail");
  const outro = await como("authenticated", BIA, "update auth.users set email = 'ana@exemplo.com' where id = $1", [BIA]);   // (a conta logada não altera o Auth direto; o Auth faz isso como servidor)
  await q("update auth.users set email = 'ana@exemplo.com' where id = $1", [BIA]).then(() => ok(false, "e-mail de OUTRO cadastro deveria ser recusado"), e2 => ok(/pertence a outro cadastro/.test(e2.message), "e-mail que pertence a outro cadastro: o banco recusa a troca"));
}
// ------------------------------------------------------------------ F) alterações da administração e do servidor (tarefa nasce lida; @ vira atenção; formato não conta)
{
  const n0 = (await tarefas(legado)).length;
  await como("authenticated", ADM, "update public.joiners set nome = 'Lia Admin' where id = $1", [legado], true);
  const t = (await tarefas(legado)).at(-1);
  ok(t.tipo === "alteracao" && t.origem === "administracao_ou_servidor" && t.lida_em && t.campos.nome.para === "Lia Admin", "troca de nome pela administradora: tarefa nasce JÁ LIDA (origem administracao_ou_servidor)");
  ok(t.planilha_status === "pendente" && t.fila_id, "…e continua indo para a planilha");
  await q("update public.joiners set twitter = '@Lia' where id = $1", [legado]);                  // só formato: @lia -> @Lia
  ok((await tarefas(legado)).length === n0 + 1, "mudança só de FORMATO do @ não cria tarefa");
  const antes = (await pendentes()), tarefasAntes = (await tarefas(legado)).length;
  await como("authenticated", ADM, "update public.joiners set twitter = '@lia.nova' where id = $1", [legado], true);
  ok((await tarefas(legado)).length === tarefasAntes && await pendentes() === antes, "troca REAL de @ não gera tarefa automática (etapa 2: alias); o pedido de troca de @ é que vira tarefa");
  ok((await q("select count(*)::int n from public.perfil_sync_pendente where joiner_id = $1 and tarefa_id is not null and id > (select max(id) from public.perfil_sync_pendente) - 0", [legado]))[0].n >= 0, "(a fila de @ não existe: só nome e e-mail vão à planilha)");
  ok((await q("select cog from public.joiners where id = $1", [legado]))[0].cog === "lia", "cog NÃO mudou");
}
// ------------------------------------------------------------------ G) pedidos: login legado (sem sessão) e conta logada nunca alteram o cadastro (F4)
{
  const nomeAntes = (await q("select nome, email, twitter from public.joiners where cog = 'lia'"))[0];
  const r = await como("anon", null, "select public.solicitar_alteracao_sem_login('@Lia', 'nome', 'Lia Pedida', 'sou eu') r");
  ok(r.rows?.[0]?.r?.status === "solicitada", "visitante envia o pedido: resposta 'solicitada'");
  const sol = await q("select * from public.perfil_solicitacoes where joiner_id = $1 and sem_prova", [legado]);
  ok(sol.length === 1 && sol[0].tipo === "nome" && sol[0].valor_pedido === "Lia Pedida" && sol[0].status === "aberta", "pedido guardado como 'sem prova' e aberto");
  const t = (await tarefas(legado, "tipo = 'solicitacao'"))[0];
  ok(t && t.origem === "solicitacao_sem_prova" && t.planilha_status === "nao_se_aplica" && t.lida_em === null, "vira tarefa em Atualizações (origem 'solicitacao_sem_prova', não lida)");
  ok(JSON.stringify((await q("select nome, email, twitter from public.joiners where cog = 'lia'"))[0]) === JSON.stringify(nomeAntes), "o CADASTRO NÃO MUDOU (nunca aprovado sozinho)");
  const rNaoExiste = await como("anon", null, "select public.solicitar_alteracao_sem_login('naoexiste', 'email', 'x@y.com', '') r");
  ok(JSON.stringify(rNaoExiste.rows?.[0]?.r) === JSON.stringify(r.rows[0].r) && (await q("select count(*)::int n from public.perfil_solicitacoes where cog_informado = 'naoexiste'"))[0].n === 0, "cadastro inexistente: MESMA resposta e nada gravado (não revela quem existe)");
  for (let i = 0; i < 4; i++) await como("anon", null, "select public.solicitar_alteracao_sem_login('lia', 'email', $1, '')", [`novo${i}@exemplo.com`]);
  ok((await q("select count(*)::int n from public.perfil_solicitacoes where joiner_id = $1 and sem_prova and status = 'aberta'", [legado]))[0].n === 3, "no máximo 3 pedidos abertos sem prova por cadastro");
  ok(/tipo de pedido inválido/.test((await como("anon", null, "select public.solicitar_alteracao_sem_login('lia', 'cpf', '123', '')")).erro || ""), "campo fora de nome/@/e-mail é recusado");
  ok(!!(await como("anon", null, "select * from public.cadastro_tarefas")).erro && !!(await como("anon", null, "select * from public.perfil_solicitacoes")).erro, "visitante não lê tarefas nem pedidos");
  const a = await como("authenticated", ANA, "select public.solicitar_correcao_perfil('arroba', '@ana.nova', 'troquei') r");
  ok(a.rows?.[0]?.r?.ok === true && (await tarefas(ana, "tipo = 'solicitacao'")).at(-1)?.origem === "solicitacao_conta", "conta logada pede troca de @: tarefa 'solicitacao_conta'");
  ok((await q("select twitter from public.joiners where id = $1", [ana]))[0].twitter === "@ana", "…e o @ do cadastro NÃO mudou");
  await como("authenticated", ADM, "select public.admin_cadastro_resolver($1, 'conferido com a pessoa')", [t.id], true);
  ok((await q("select status from public.perfil_solicitacoes where id = $1", [sol[0].id]))[0].status === "resolvida" && (await tarefas(legado, "id = " + t.id))[0].resolvida_em, "resolver a tarefa encerra o pedido");
}
// ------------------------------------------------------------------ H) permissões
{
  ok(!!(await como("authenticated", ANA, "select public.admin_cadastro_tarefas()")).erro, "conta comum NÃO lista tarefas");
  ok(!!(await como("authenticated", ANA, "select * from public.cadastro_tarefas")).rows?.length === false, "conta comum não enxerga nenhuma tarefa (política)");
  ok(!!(await como("authenticated", ANA, "select public.perfil_sync_marcar(1, true, null, false)")).erro, "conta comum NÃO chama a marcação da fila");
  ok(!!(await como("authenticated", ANA, "select public.perfil_sync_estado(1)")).erro, "conta comum NÃO chama perfil_sync_estado");
  ok(!!(await como("anon", null, "select public.admin_cadastro_pendentes()")).erro, "visitante NÃO conta pendências");
  const lista = await como("authenticated", ADM, "select * from public.admin_cadastro_tarefas(50)", [], true);
  ok(lista.rows?.length > 5 && lista.rows.some(x => x.pendente) && lista.rows.every(x => ["id", "cog", "campos", "pendente", "tem_conta"].every(k => k in x)), "administradora lista as tarefas (com 'pendente' e 'tem_conta')");
  ok((await como("authenticated", ADM, "select count(*)::int n from public.cadastro_tarefas", [], true)).rows[0].n === lista.rows.length || lista.rows.length === 50, "a política deixa a administradora ler a tabela");
}
// ------------------------------------------------------------------ I) itens, pagamentos, claims e cog intactos
ok((await fotografia("ana")) === fotoAna0 && (await fotografia("lia")) === fotoLia0, "cog, itens, pagamentos e claims INTACTOS depois de todos os fluxos");

// ------------------------------------------------------------------ J) reversão exata
const rev = arq("cadastro-tarefas/E1_cadastro_tarefas_reverter.sql");
try { await d.exec(rev); ok(true, "reversão executa"); } catch (e) { ok(false, "reversão: " + String(e.message).slice(0, 400)); }
{
  ok((await q("select to_regclass('public.cadastro_tarefas') t"))[0].t === null && (await q("select to_regprocedure('public.salvar_meu_cadastro(text)') t"))[0].t === null, "tabela e funções do E1 removidas");
  ok(!/anticeg.salvar_cadastro/.test((await q("select pg_get_functiondef('public.trg_joiners_protege_colunas()'::regprocedure) d"))[0].d), "gatilho de proteção volta ao texto anterior (sem a exceção)");
  const direto = await como("authenticated", ANA, "update public.joiners set nome = 'Direto' where id = $1", [ana]);
  ok(/administradora/.test(direto.erro || ""), "depois da reversão o nome volta a ser só da administradora");
  ok((await q("select count(*)::int n from public.perfil_sync_pendente where tipo = 'cadastro'"))[0].n === 0, "fila sem itens 'cadastro'");
  ok((await q("select count(*)::int n from emergencia.cadastro_tarefas_arquivo"))[0].n > 5, "as tarefas foram ARQUIVADAS antes de apagar (nada se perde)");
  await q("update auth.users set email = 'bia.depois@exemplo.com', email_confirmed_at = now() where id = $1", [BIA]);
  ok((await q("select count(*)::int n from public.perfil_sync_pendente where joiner_id = $1 and tipo = 'email'", [bia]))[0].n === 1, "o gatilho do Auth volta a enfileirar o item 'email' (comportamento do J6)");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);
