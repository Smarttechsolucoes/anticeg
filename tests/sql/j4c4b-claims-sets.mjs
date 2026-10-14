// Teste do J4c-4b (claim_eventos, claim_sets, claim_reservas + funções claim_enviar/claim_organizar) no laboratório fictício (PGlite).
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4c4b-claims-sets.mjs
import { laboratorio, como, n, negado, rodar, verificar, ok, fim, J } from "./_lab.mjs";
const d = await laboratorio();
const T = ["claim_eventos", "claim_sets", "claim_reservas"];
const rpc = async (uid, fn, args) => (await como(d, "authenticated", uid, `select public.${fn}(${args}) r`)).rows?.[0]?.r ?? null;
const rpcErro = async (uid, fn, args) => (await como(d, "authenticated", uid, `select public.${fn}(${args}) r`)).erro;
const enviar = (uid, ev, ped) => rpc(uid, "claim_enviar", `${ev}, '${JSON.stringify(ped)}'::jsonb`);

// ANTES (vulnerabilidade de hoje)
ok((await n(d, "anon", null, "select 1 from public.claim_reservas")) > 0 && (await como(d, "anon", null, "select joiner_nome from public.claim_reservas where joiner_nome like '%Nome Real%' limit 1")).rows?.length === 1, "ANTES: o visitante lê as reservas dos sets com o nome REAL de cada joiner (vulnerabilidade reproduzida)");
ok((await como(d, "anon", null, "update public.claim_reservas set joiner_cog = 'anon' where id = 1 returning id")).rows?.length === 1, "ANTES: o visitante altera uma reserva (vulnerabilidade reproduzida)");
await d.exec("update public.claim_reservas set joiner_cog = 'ana' where id = 1");

const e = await rodar(d, "J4c4b_claims_sets_aplicar.sql", J); ok(e === null, "J4c-4b aplica sem erro" + (e ? ": " + e : ""));
const v = await verificar(d, "J4c4b_claims_sets_verificar.sql");
ok(v["policies nas 3 tabelas (esperado 6)"] === "6" && v["policies para visitante/PUBLIC (esperado 0)"] === "0" && v["RLS ligado nas 3 tabelas (esperado 3)"] === "3" && v["visitante com algum privilégio nas 3 tabelas ou no quadro (esperado false)"] === "false" && v["colunas pessoais no quadro dos sets (esperado 0)"] === "0" && v["funções de claim seguras (esperado 3)"] === "3" && v["visitante executa claim_enviar/claim_organizar (esperado false)"] === "false", "verificação J4c-4b como esperado: " + JSON.stringify(v));
const imp = v["impressão antes | agora (claim_reservas)"].split(" | "); ok(imp[0] === imp[1], "as reservas são idênticas antes e depois");

// visitante
for (const t of T) ok(negado(await como(d, "anon", null, `select * from public.${t}`)), `visitante NÃO lê ${t}`);
ok(negado(await como(d, "anon", null, "select * from public.claim_reservas_quadro")), "visitante NÃO lê o quadro dos sets");
ok(negado(await como(d, "anon", null, "select public.claim_enviar(1, '{}'::jsonb)")) && negado(await como(d, "anon", null, "select public.claim_organizar(1)")), "visitante NÃO executa as funções de claim");
ok(negado(await como(d, "anon", null, "update public.claim_reservas set status = 'cancelado'")) && negado(await como(d, "anon", null, "insert into public.claim_sets (evento_id, numero) values (1, 9)")), "visitante NÃO altera reservas nem cria sets");

// conta ativada: lê eventos/sets, o quadro (sem nome real) e só as próprias reservas
ok((await n(d, "authenticated", 2, "select 1 from public.claim_eventos")) >= 2 && (await n(d, "authenticated", 2, "select 1 from public.claim_sets")) >= 2, "ana (ativada) lê eventos e sets");
const q = (await como(d, "authenticated", 2, "select joiner_cog, joiner_nome, is_admin, membro from public.claim_reservas_quadro where evento_id = 1")).rows;
ok(q.length === 3 && q.some(r => r.joiner_cog === "ana") && q.some(r => r.joiner_cog === "bia") && !q.some(r => r.joiner_nome && /Nome Real/.test(r.joiner_nome)) && q.find(r => r.is_admin)?.joiner_nome === "GOM", "ana vê o quadro dos sets com o COG de todas, SEM o nome real (só o 'GOM' da administradora)");
ok((await como(d, "authenticated", 2, "select joiner_cog from public.claim_reservas")).rows?.every(r => r.joiner_cog === "ana"), "ana lê direto só as reservas dela");
ok((await n(d, "authenticated", 4, "select 1 from public.claim_eventos")) === 0 && (await n(d, "authenticated", 4, "select 1 from public.claim_reservas_quadro")) === 0, "conta SEM vínculo não vê eventos nem quadro");
ok(negado(await como(d, "authenticated", 2, "insert into public.claim_reservas (evento_id, set_id, joiner_cog, membro, status) values (1, 1, 'ana', 'Han', 'pendente')")) && (await como(d, "authenticated", 2, "update public.claim_reservas set status = 'cancelado' where joiner_cog = 'bia' returning id")).rows?.length === 0, "ana NÃO escreve direto em claim_reservas (só pelas funções)");
{ const a = await como(d, "authenticated", 2, "update public.claim_sets set status = 'cancelado' returning id"), b = await como(d, "authenticated", 2, "update public.claim_eventos set limite_por_joiner = 99 returning id");
  ok((negado(a) || a.rows?.length === 0) && (negado(b) || b.rows?.length === 0) && (await d.query("select count(*)::int c from public.claim_eventos where limite_por_joiner = 99")).rows[0].c === 0, "ana NÃO altera sets nem eventos"); }
ok((await n(d, "authenticated", 1, "select 1 from public.claim_reservas")) === 3, "administradora lê todas as reservas direto");

// claim_enviar: regras do servidor (evento 1: 3 membros, limite 2 por joiner; set 1 tem Bang Chan (ana) e Lee Know (GOM))
ok((await rpc(4, "claim_enviar", "1, '{\"Han\":1}'::jsonb")).motivo === "sem_conta", "conta sem vínculo NÃO faz claim");
ok((await enviar(2, 1, { "Membro Inventado": 3 })).motivo === "pedido_vazio", "membro que não existe no evento é ignorado (pedido vazio)");
let r = await enviar(2, 1, { "Changbin": 1 });
ok(r.ok === true && r.gravados === 1 && (await n(d, "authenticated", 1, "select 1 from public.claim_reservas where joiner_cog = 'ana' and membro = 'Changbin' and set_id = 1 and status = 'pendente'")) === 1, "ana pega Changbin no set aberto (set 1 ainda não completo? Bang Chan + Lee Know + Changbin = completo)");
ok((await como(d, "authenticated", 1, "select status from public.claim_sets where id = 1")).rows[0].status === "fechado", "o set 1 completou e foi FECHADO pelo servidor");
// bia já estava no standby de Changbin -> ao fechar o set 1 o servidor abre o set 2 e promove a bia
const sets = (await como(d, "authenticated", 1, "select id, numero, status from public.claim_sets where evento_id = 1 order by numero")).rows;
ok(sets.length === 2 && sets[1].status === "aberto", "o servidor ABRIU o set 2 porque havia standby");
ok((await n(d, "authenticated", 1, "select 1 from public.claim_reservas where joiner_cog = 'bia' and membro = 'Changbin' and set_id = (select id from public.claim_sets where evento_id = 1 and numero = 2) and status = 'pendente'")) === 1, "a bia foi PROMOVIDA do standby para o set 2");
// limite por joiner (2 por membro)
r = await enviar(2, 1, { "Changbin": 5 });
ok(r.ok === true, "ana pede Changbin de novo (limite 2 por membro, ela já tem 1): " + JSON.stringify(r));
const qt = (await como(d, "authenticated", 1, "select count(*)::int c from public.claim_reservas where joiner_cog = 'ana' and membro = 'Changbin' and status <> 'cancelado'")).rows[0].c;
ok(qt === 2, "o limite por joiner foi respeitado (2 no máximo, e não 6): " + qt);
r = await enviar(2, 1, { "Changbin": 1 });
ok(r.ok === false && r.motivo === "ja_tem", "com o limite atingido o pedido é recusado: " + JSON.stringify(r));
// duas joiners disputando a mesma vaga: só uma leva a vaga do set aberto, a outra vai ao standby
await d.exec("update public.claim_reservas set status = 'cancelado' where joiner_cog in ('ana', 'bia') and membro = 'Changbin'");
const rg = await enviar(3, 1, { "Han": 1 });
ok(rg.ok === false && rg.motivo === "pedido_vazio", "Han não é membro do evento 1: ignorado");
const a1 = await enviar(2, 1, { "Changbin": 1 }); const b1 = await enviar(3, 1, { "Changbin": 1 });
const noSet2 = (await como(d, "authenticated", 1, "select joiner_cog from public.claim_reservas where set_id = (select id from public.claim_sets where evento_id = 1 and numero = 2) and membro = 'Changbin' and status <> 'cancelado'")).rows;
ok(a1.ok && b1.ok && noSet2.length === 1, "duas pessoas na mesma vaga: só UMA fica no set; a outra entra no standby: " + JSON.stringify([a1, b1]));
ok(b1.standby?.includes("Changbin"), "a segunda recebe o aviso de standby");
// bloqueio
await d.exec("update public.joiners set bloqueado = true where cog = 'gabi'");
ok((await enviar(9, 1, { "Changbin": 1 })).motivo === "bloqueada", "joiner BLOQUEADA por atraso não faz claim");
// evento fechado/inexistente e ainda não aberto
await d.exec("update public.claim_eventos set abertura = now() + interval '1 day' where id = 1");
ok((await enviar(2, 1, { "Changbin": 1 })).motivo === "evento_fechado" && (await enviar(2, 2, { "Bang Chan": 1 })).motivo === "evento_fechado", "evento ainda não aberto (e evento encerrado) recusam o claim");
await d.exec("update public.claim_eventos set abertura = now() - interval '1 day' where id = 1");
// sem_novos_sets: sem vaga não vai ao standby
await d.exec("update public.claim_eventos set sem_novos_sets = true where id = 1");
await d.exec("update public.claim_sets set status = 'fechado' where evento_id = 1");
r = await enviar(9, 1, { "Lee Know": 1 }); await d.exec("update public.joiners set bloqueado = false where cog = 'gabi'");
r = await enviar(9, 1, { "Lee Know": 1 });
ok(r.ok === false && r.motivo === "sem_vaga", "com 'sem novos sets' e sem set aberto, NÃO vai ao standby: " + JSON.stringify(r));
await d.exec("update public.claim_eventos set sem_novos_sets = false where id = 1");

// OT8: todos os membros do evento 1 de uma vez -> set exclusivo (gabi ainda não tem claims no evento 1)
r = await enviar(9, 1, { "Bang Chan": 1, "Lee Know": 1, "Changbin": 1 });
ok(r.ok === true && r.ot8 === true, "OT8 cria um set exclusivo e fechado: " + JSON.stringify(r));
ok((await como(d, "authenticated", 1, "select count(*)::int c from public.claim_reservas r join public.claim_sets s on s.id = r.set_id where r.joiner_cog = 'gabi' and s.status = 'fechado'")).rows[0].c === 3, "o set OT8 tem as 3 vagas da gabi");
ok((await enviar(9, 1, { "Bang Chan": 1, "Lee Know": 1, "Changbin": 1 })).motivo === "ja_tem_claims", "OT8 recusado se a joiner já tem claims no evento");

// claim_organizar é idempotente e segura
ok((await rpc(2, "claim_organizar", "1")).ok === true && (await rpc(2, "claim_organizar", "1")).ok === true, "claim_organizar roda duas vezes sem erro (idempotente)");
ok((await rpc(2, "claim_organizar", "999")).motivo === "evento_invalido", "claim_organizar de evento inexistente: recusa");
ok((await rpc(4, "claim_organizar", "1")).motivo === "sem_conta", "conta sem vínculo NÃO organiza");

// identidade vem do login, não do pedido: ana não consegue fazer claim em nome da bia
ok((await como(d, "authenticated", 1, "select count(*)::int c from public.claim_reservas where joiner_cog not in ('ana', 'bia', 'gabi', 'nandaverseo_c')")).rows[0].c === 0, "as funções gravam só em nome de quem está logada (nenhum COG estranho nas reservas)");

// reversão protegida e ciclo completo
ok((await rodar(d, "J4c4b_claims_sets_reverter_protegido.sql", J)) !== null, "reversão SEM a frase de autorização é recusada");
ok(await rodar(d, "J4c4b_claims_sets_reverter_protegido.sql", J, "AUTORIZO REABRIR CLAIMS EM SETS") === null && (await n(d, "anon", null, "select 1 from public.claim_reservas")) > 0, "reversão COM a frase reabre (e só então)");
const e2 = await rodar(d, "J4c4b_claims_sets_aplicar.sql", J); ok(e2 === null, "J4c-4b reaplica depois de revertido" + (e2 ? ": " + e2 : ""));
// guardas
const g = await laboratorio(); await g.exec("alter table public.claim_eventos drop column sem_novos_sets cascade");
ok(/sem as colunas esperadas/.test(await rodar(g, "J4c4b_claims_sets_aplicar.sql", J) || ""), "J4c-4b ABORTA se claim_eventos não tem as colunas esperadas");
const g2 = await laboratorio({ aplicarBase: false }); ok(/J4a não está aplicado|J1\/A1/.test(await rodar(g2, "J4c4b_claims_sets_aplicar.sql", J) || ""), "J4c-4b ABORTA sem o J4a");
fim();
