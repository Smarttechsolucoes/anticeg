// Teste do J4c-4c (feedbacks, notifications, pushes, push_reads, joiner_storage, joiner_conferencias, joiner_updates, envio_rounds, envio_requests, confirmacoes) no laboratório fictício (PGlite).
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4c4c-pessoais.mjs
import { laboratorio, como, n, negado, rodar, verificar, ok, fim, J } from "./_lab.mjs";
const d = await laboratorio();
const T = ["feedbacks", "notifications", "push_reads", "joiner_storage", "joiner_conferencias", "joiner_updates", "envio_rounds", "envio_requests", "confirmacoes"];
const barrado = r => negado(r) || r.rows?.length === 0;

// ANTES (vulnerabilidade de hoje)
for (const t of ["feedbacks", "notifications", "joiner_storage", "envio_requests"]) ok((await n(d, "anon", null, `select 1 from public.${t}`)) > 0, `ANTES: o visitante lê ${t} inteira (vulnerabilidade reproduzida)`);
ok((await como(d, "anon", null, "update public.feedbacks set resposta = 'forjada' returning id")).rows?.length >= 1, "ANTES: o visitante responde feedbacks (vulnerabilidade reproduzida)");
await d.exec("update public.feedbacks set resposta = null");

const e = await rodar(d, "J4c4c_pessoais_aplicar.sql", J); ok(e === null, "J4c-4c aplica sem erro" + (e ? ": " + e : ""));
const v = await verificar(d, "J4c4c_pessoais_verificar.sql");
ok(v["policies nas 10 tabelas (esperado 29)"] === "29" && v["policies para visitante/PUBLIC (esperado 1: avisos gerais)"] === "1" && v["RLS ligado nas 10 tabelas (esperado 10)"] === "10" && v["visitante com privilégio fora de pushes/SELECT (esperado false)"] === "false" && v["visitante escreve em pushes (esperado false)"] === "false" && v["gatilhos de campos ligados (esperado 4)"] === "4" && v["envio_entrar_round segura e fechada ao visitante (esperado true)"] === "true", "verificação J4c-4c como esperado: " + JSON.stringify(v));
const imp = v["impressão antes | agora (feedbacks)"].split(" | "); ok(imp[0] === imp[1], "os dados são idênticos antes e depois");

// visitante
for (const t of T) ok(negado(await como(d, "anon", null, `select * from public.${t}`)), `visitante NÃO lê ${t}`);
const pg = (await como(d, "anon", null, "select message, joiner_cog from public.pushes")).rows;
ok(pg.length === 1 && pg[0].joiner_cog === null, "visitante lê SÓ o aviso geral (não os avisos pessoais)");
ok(negado(await como(d, "anon", null, "insert into public.pushes (message) values ('forjado')")) && negado(await como(d, "anon", null, "update public.pushes set active = false")) && negado(await como(d, "anon", null, "delete from public.pushes")), "visitante NÃO escreve em pushes");
ok(negado(await como(d, "anon", null, "select public.envio_entrar_round('x')")), "visitante NÃO executa envio_entrar_round");

// feedbacks
ok((await como(d, "authenticated", 2, "select joiner_cog from public.feedbacks")).rows?.every(r => r.joiner_cog === "ana") && (await n(d, "authenticated", 2, "select 1 from public.feedbacks")) === 1, "ana lê SÓ os feedbacks dela");
ok((await como(d, "authenticated", 2, "insert into public.feedbacks (joiner_cog, tipo, message, status) values ('ana','sugestao','nova','pendente') returning id")).rows?.length === 1, "ana cria feedback dela");
ok(negado(await como(d, "authenticated", 2, "insert into public.feedbacks (joiner_cog, tipo, message, status) values ('bia','sugestao','forjado','pendente')")) && negado(await como(d, "authenticated", 2, "insert into public.feedbacks (joiner_cog, tipo, message, resposta) values ('ana','sugestao','x','resposta forjada')")), "ana NÃO cria feedback em nome da bia nem já 'respondido'");
ok((await como(d, "authenticated", 2, "update public.feedbacks set resposta_joiner = 'obrigada', resposta_joiner_at = now() where joiner_cog = 'ana' returning id")).rows?.length >= 1, "ana grava a RÉPLICA ao feedback");
ok(negado(await como(d, "authenticated", 2, "update public.feedbacks set resposta = 'eu me respondo', status = 'respondido' where joiner_cog = 'ana'")), "ana NÃO grava a resposta da administração nem muda o status");
ok(barrado(await como(d, "authenticated", 2, "update public.feedbacks set resposta_joiner = 'x' where joiner_cog = 'bia' returning id")), "ana NÃO altera feedback da bia");
ok((await como(d, "authenticated", 1, "update public.feedbacks set resposta = 'oi', status = 'respondido' where joiner_cog = 'bia' returning id")).rows?.length === 1, "administradora responde o feedback");

// notifications
ok((await como(d, "authenticated", 2, "select joiner_cog from public.notifications")).rows?.every(r => r.joiner_cog === "ana"), "ana lê só as notificações dela");
ok((await como(d, "authenticated", 2, "update public.notifications set read_at = now() where joiner_cog = 'ana' returning id")).rows?.length === 1, "ana marca como lida a notificação dela");
ok(negado(await como(d, "authenticated", 2, "update public.notifications set message = 'trocada' where joiner_cog = 'ana'")) && barrado(await como(d, "authenticated", 2, "update public.notifications set read_at = now() where joiner_cog = 'bia' returning id")), "ana NÃO edita o texto nem marca a notificação da bia");
ok(negado(await como(d, "authenticated", 2, "insert into public.notifications (joiner_cog, message) values ('bia','phishing')")), "ana NÃO cria notificação para outra pessoa");
ok((await como(d, "authenticated", 1, "insert into public.notifications (joiner_cog, message, type) values ('ana','da admin','teste') returning id")).rows?.length === 1, "administradora cria notificação");

// pushes
const pa = (await como(d, "authenticated", 2, "select message, joiner_cog from public.pushes order by id")).rows;
ok(pa.length === 2 && pa.some(r => r.joiner_cog === null) && pa.some(r => r.joiner_cog === "ana") && !pa.some(r => r.joiner_cog === "bia"), "ana vê o aviso geral e o pessoal dela (não o da bia)");
ok((await como(d, "authenticated", 2, "delete from public.pushes where joiner_cog = 'ana' returning id")).rows?.length === 1 && barrado(await como(d, "authenticated", 2, "delete from public.pushes where joiner_cog is null returning id")) && barrado(await como(d, "authenticated", 2, "delete from public.pushes where joiner_cog = 'bia' returning id")), "ana apaga o aviso pessoal dela, mas NÃO o geral nem o da bia");
ok(negado(await como(d, "authenticated", 2, "insert into public.pushes (message, joiner_cog) values ('golpe', null)")), "ana NÃO publica aviso geral");

// push_reads
ok((await como(d, "authenticated", 2, "insert into public.push_reads (push_id, joiner_cog) values (1, 'ana') returning id")).rows?.length === 1 && negado(await como(d, "authenticated", 2, "insert into public.push_reads (push_id, joiner_cog) values (1, 'bia')")), "ana registra a própria leitura, não a da bia");
ok((await n(d, "authenticated", 2, "select 1 from public.push_reads")) === 2 && (await n(d, "authenticated", 1, "select 1 from public.push_reads")) >= 2, "ana lê só as próprias leituras; administradora todas");

// joiner_storage
ok((await como(d, "authenticated", 2, "select joiner_cog from public.joiner_storage")).rows?.every(r => r.joiner_cog === "ana"), "ana lê só as fotos do storage dela");
ok((await como(d, "authenticated", 2, "update public.joiner_storage set ativo = false where joiner_cog = 'ana' returning id")).rows?.length === 1, "ana desativa a foto dela");
ok(negado(await como(d, "authenticated", 2, "update public.joiner_storage set ativo = true where joiner_cog = 'ana'")) && negado(await como(d, "authenticated", 2, "update public.joiner_storage set foto_url = 'http://x' where joiner_cog = 'ana'")) && negado(await como(d, "authenticated", 2, "insert into public.joiner_storage (joiner_cog, foto_url) values ('ana','http://x')")), "ana NÃO reativa, NÃO troca a foto e NÃO cadastra storage (é da administradora)");
ok((await como(d, "authenticated", 1, "insert into public.joiner_storage (joiner_cog, foto_url, descricao) values ('bia','https://exemplo.com/n.jpg','nova') returning id")).rows?.length === 1, "administradora cadastra foto no storage");

// joiner_conferencias
ok((await n(d, "authenticated", 2, "select 1 from public.joiner_conferencias")) === 1 && (await n(d, "authenticated", 3, "select 1 from public.joiner_conferencias")) === 0, "ana lê a conferência dela; bia não vê a da ana");
ok((await como(d, "authenticated", 3, "insert into public.joiner_conferencias (joiner_cog, prazo_dias) values ('bia', 5) returning id")).rows?.length === 1 && negado(await como(d, "authenticated", 3, "insert into public.joiner_conferencias (joiner_cog, prazo_dias, confirmada_em) values ('bia', 5, now())")), "bia cria a conferência dela (sem já nascer confirmada)");
ok((await como(d, "authenticated", 3, "update public.joiner_conferencias set confirmada_em = now() where joiner_cog = 'bia' returning id")).rows?.length === 1, "bia confirma a conferência dela");
ok(negado(await como(d, "authenticated", 3, "update public.joiner_conferencias set confirmada_em = null where joiner_cog = 'bia'")) && negado(await como(d, "authenticated", 3, "update public.joiner_conferencias set prazo_dias = 99 where joiner_cog = 'bia'")), "bia NÃO desfaz a confirmação nem muda o prazo");

// joiner_updates / confirmacoes: só registram
{ const a = await como(d, "authenticated", 2, "insert into public.joiner_updates (joiner_cog, campos) values ('ana','[\"cep\"]')"), b = await como(d, "authenticated", 2, "insert into public.joiner_updates (joiner_cog, campos) values ('bia','[\"cep\"]')");
  ok(!a.erro && negado(b), "ana registra a atualização de perfil dela, não a da bia"); }
ok((await n(d, "authenticated", 2, "select 1 from public.joiner_updates")) === 0 && (await n(d, "authenticated", 1, "select 1 from public.joiner_updates")) >= 2, "ana NÃO lê joiner_updates; administradora lê");
ok(!(await como(d, "authenticated", 2, "insert into public.confirmacoes (joiner_cog, joiner_nome, twitter_novo) values ('ana','Ana','@nova')")).erro && negado(await como(d, "authenticated", 2, "insert into public.confirmacoes (joiner_cog, joiner_nome, twitter_novo, visto) values ('ana','Ana','@x', true)")) && (await n(d, "authenticated", 2, "select 1 from public.confirmacoes")) === 0, "ana registra o pedido de troca de @ (não já 'visto') e NÃO lê confirmacoes");
ok((await n(d, "authenticated", 1, "select 1 from public.confirmacoes")) >= 2, "administradora lê as confirmações");

// fila de envio: leitura própria e entrada só pela função
ok((await n(d, "authenticated", 2, "select 1 from public.envio_requests")) === 1 && (await n(d, "authenticated", 4, "select 1 from public.envio_requests")) === 0 && (await n(d, "authenticated", 4, "select 1 from public.envio_rounds")) === 0, "ana lê só a entrada dela na fila; conta SEM vínculo não vê nada");
ok(negado(await como(d, "authenticated", 2, "insert into public.envio_requests (joiner_cog, round_id, posicao_no_round) values ('ana', 1, 9)")) && negado(await como(d, "authenticated", 2, "insert into public.envio_rounds (numero, status) values (99, 'aberto')")) && barrado(await como(d, "authenticated", 2, "update public.envio_rounds set status = 'concluido' returning id")), "ana NÃO entra na fila nem cria/fecha rodada direto");
const rpc = async (uid, args) => (await como(d, "authenticated", uid, `select public.envio_entrar_round(${args}) r`)).rows?.[0]?.r;
ok((await rpc(4, "'x'")).motivo === "sem_conta", "conta SEM vínculo não entra na fila");
let r = await rpc(9, "'Photobook · Han'");   // gabi entra: round 1 já tem ana e bia -> posição 3
ok(r.ok === true && r.request.posicao_no_round === 3 && r.request.envio_rounds.numero === 1 && r.request.itens_manuais === "Photobook · Han" && r.request.joiner_cog === "gabi", "gabi entra na fila: o servidor escolhe a rodada 1 e a posição 3: " + JSON.stringify(r.request));
ok((await rpc(9, "null")).repetido === true && (await n(d, "authenticated", 1, "select 1 from public.envio_requests where joiner_cog = 'gabi'")) === 1, "pedir de novo na mesma rodada não duplica");
// completar a rodada (7 posições) fecha a rodada e abre a próxima
await d.exec("insert into public.envio_requests (joiner_cog, round_id, posicao_no_round) values ('x1',1,4),('x2',1,5),('x3',1,6)");
r = await rpc(7, "null");
ok(r.ok === true && r.request.posicao_no_round === 7 && (await como(d, "authenticated", 1, "select status from public.envio_rounds where numero = 1")).rows[0].status === "fechado", "a 7ª pessoa FECHA a rodada 1");
r = await rpc(8, "null");
ok(r.ok === true && r.request.posicao_no_round === 1 && r.request.envio_rounds.numero === 2 && r.request.envio_rounds.status === "aberto", "a próxima abre a rodada 2 na posição 1");
ok((await n(d, "authenticated", 7, "select 1 from public.envio_rounds")) === 2, "joiner ativada lê as rodadas");

// administradora preservada
ok((await n(d, "authenticated", 1, "select 1 from public.feedbacks")) >= 3 && (await n(d, "authenticated", 1, "select 1 from public.envio_requests")) >= 7 && (await como(d, "authenticated", 1, "update public.envio_rounds set status = 'concluido' where numero = 1 returning id")).rows?.length === 1, "administradora lê e gerencia tudo");

// reversão protegida e ciclo completo
ok((await rodar(d, "J4c4c_pessoais_reverter_protegido.sql", J)) !== null, "reversão SEM a frase de autorização é recusada");
ok(await rodar(d, "J4c4c_pessoais_reverter_protegido.sql", J, "AUTORIZO REABRIR DADOS PESSOAIS RESTANTES") === null && (await n(d, "anon", null, "select 1 from public.feedbacks")) > 0, "reversão COM a frase reabre (e só então)");
const e2 = await rodar(d, "J4c4c_pessoais_aplicar.sql", J); ok(e2 === null, "J4c-4c reaplica depois de revertido" + (e2 ? ": " + e2 : ""));
// guardas
const g = await laboratorio(); await g.exec("alter table public.envio_requests drop column posicao_no_round cascade");
ok(/sem as colunas esperadas/.test(await rodar(g, "J4c4c_pessoais_aplicar.sql", J) || ""), "J4c-4c ABORTA se envio_requests não tem as colunas esperadas");
const g2 = await laboratorio({ aplicarBase: false }); ok(/J4a não está aplicado|J1\/A1/.test(await rodar(g2, "J4c4c_pessoais_aplicar.sql", J) || ""), "J4c-4c ABORTA sem o J4a");
fim();
