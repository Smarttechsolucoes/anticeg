// Teste do J4d (ativação em ondas) no laboratório fictício (PGlite). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4d-ondas.mjs
import { laboratorio, como, n, negado, rodar, verificar, ok, fim, J, U, sql } from "./_lab.mjs";
const d = await laboratorio({ ondas: "fechado" });
const rpc = async (papel, uid, fn, args = "") => (await como(d, papel, uid, `select public.${fn}(${args}) r`)).rows?.[0]?.r;
await d.exec(`insert into public.joiners (id, cog, nome, nome_site, email, twitter) values (11, 'hana', 'Hana Fictícia', 'Hana', 'hana@exemplo.com', '@hana'), (12, 'iris', 'Íris Fictícia', 'Iris', 'iris@exemplo.com', '@iris');
  insert into auth.users values ('${U(10)}', 'fabi@exemplo.com', now()), ('${U(11)}', 'hana@exemplo.com', now()), ('${U(12)}', 'iris@exemplo.com', now()), ('${U(20)}', 'curioso@exemplo.com', now())`);

const v = await verificar(d, "J4d_ondas_verificar.sql");
ok(v["tabelas de ondas fechadas a visitante e joiner (esperado false)"] === "false" && v["funções do J4d seguras (esperado 3)"] === "3" && v["ativacao_liberada fechada ao visitante e à joiner (esperado false)"] === "false" && v["onda liberada | liberar todas"] === "0 | false", "verificação J4d como esperado (estado inicial: ninguém liberada): " + JSON.stringify(v));
ok(Number(v["contas já vinculadas (não são afetadas pelas ondas)"]) >= 4, "as contas já vinculadas existem e não dependem das ondas");

// fechado ao visitante e à joiner
for (const t of ["ativacao_ondas", "ativacao_estado"]) { ok(negado(await como(d, "anon", null, `select * from public.${t}`)) && negado(await como(d, "authenticated", 2, `select * from public.${t}`)), `visitante e joiner NÃO leem ${t}`); }
ok(negado(await como(d, "authenticated", 2, "update public.ativacao_estado set liberar_todas = true")) && negado(await como(d, "authenticated", 1, "update public.ativacao_estado set liberar_todas = true")), "NINGUÉM libera ondas pela API (nem a administradora pelo site): é feito no SQL Editor");
ok(negado(await como(d, "authenticated", 2, "select public.ativacao_liberada(10)")) && negado(await como(d, "anon", null, "select public.ativacao_liberada(10)")), "ativacao_liberada não é chamável por visitante nem joiner");

// entrar_com_arroba informa a liberação
let a = await rpc("anon", null, "entrar_com_arroba", "'fabi'");
ok(a.encontrado === true && a.conta_ativa === false && a.ativacao_liberada === false, "o @ de quem ainda não foi liberada vem com ativacao_liberada=false: " + JSON.stringify(a));
ok((await rpc("anon", null, "entrar_com_arroba", "'ana'")).conta_ativa === true, "quem já ativou continua 'conta_ativa'");
ok(Object.keys(a).sort().join() === "ativacao_liberada,cog,conta_ativa,encontrado,foto_perfil,nome_site", "o visitante continua recebendo só a identidade mínima (e a informação de liberação), nunca e-mail ou dados pessoais");

// ativação ANTES da liberação: nada é gravado
const antesContas = (await d.query("select count(*)::int c from public.contas_joiner")).rows[0].c, antesPend = (await d.query("select count(*)::int c from public.vinculos_pendentes")).rows[0].c;
ok((await rpc("authenticated", 10, "ativar_minha_conta", "'fabi'")).status === "aguardando_liberacao", "antes da liberação a ativação responde 'aguardando_liberacao'");
ok((await d.query("select count(*)::int c from public.contas_joiner")).rows[0].c === antesContas && (await d.query("select count(*)::int c from public.vinculos_pendentes")).rows[0].c === antesPend, "e NÃO grava vínculo nem pedido pendente (ninguém entra, ninguém polui a fila da administradora)");
ok(await n(d, "authenticated", 10, "select 1 from public.joiners") === 0 && (await rpc("authenticated", 10, "meu_cog")) === null, "a conta criada continua SEM acesso a dado privado enquanto não for liberada e vinculada");

// onda 1 liberada
await d.exec("insert into public.ativacao_ondas (joiner_id, onda) values (10, 1), (11, 2); update public.ativacao_estado set onda_liberada = 1");
ok((await rpc("anon", null, "entrar_com_arroba", "'fabi'")).ativacao_liberada === true && (await rpc("anon", null, "entrar_com_arroba", "'hana'")).ativacao_liberada === false, "liberada a onda 1: a fabi (onda 1) pode ativar; a hana (onda 2) ainda não");
ok((await rpc("authenticated", 10, "ativar_minha_conta", "'fabi'")).status === "ok" && (await rpc("authenticated", 10, "meu_cog")) === "fabi", "a fabi ativa e passa a ser reconhecida");
ok((await rpc("authenticated", 11, "ativar_minha_conta", "'hana'")).status === "aguardando_liberacao", "a hana (onda 2) segue aguardando");
ok((await rpc("authenticated", 12, "ativar_minha_conta", "'iris'")).status === "aguardando_liberacao", "quem não tem onda nenhuma (iris) segue aguardando");

// liberar a onda 2 NÃO mexe em ninguém que já ativou
const antes = JSON.stringify((await d.query("select user_id, joiner_id, origem from public.contas_joiner order by joiner_id")).rows), usuarios = (await d.query("select count(*)::int c from auth.users")).rows[0].c;
await d.exec("update public.ativacao_estado set onda_liberada = 2");
ok(JSON.stringify((await d.query("select user_id, joiner_id, origem from public.contas_joiner order by joiner_id")).rows) === antes && (await d.query("select count(*)::int c from auth.users")).rows[0].c === usuarios, "liberar uma nova onda NÃO altera nenhuma conta já vinculada nem nenhum usuário (as senhas seguem válidas)");
ok((await rpc("authenticated", 11, "ativar_minha_conta", "'hana'")).status === "ok", "a hana (onda 2) ativa depois que a onda 2 é liberada");
ok((await rpc("authenticated", 10, "meu_cog")) === "fabi" && (await rpc("authenticated", 2, "meu_cog")) === "ana" && (await n(d, "authenticated", 2, "select 1 from public.mercari_pedidos")) >= 0, "quem ativou antes continua com acesso (nada foi reaberto nem invalidado)");

// mesmo "recuando" a liberação, quem já tem conta segue funcionando
await d.exec("update public.ativacao_estado set onda_liberada = 0");
ok((await rpc("authenticated", 10, "ativar_minha_conta", "'fabi'")).status === "ok" && (await rpc("authenticated", 10, "meu_cog")) === "fabi", "se a administradora RECUAR a liberação, quem já ativou segue normal (a trava só vale para ativações novas)");
ok((await rpc("authenticated", 12, "ativar_minha_conta", "'iris'")).status === "aguardando_liberacao", "e as demais seguem aguardando");

// lançamento geral
await d.exec("update public.ativacao_estado set liberar_todas = true");
ok((await rpc("authenticated", 12, "ativar_minha_conta", "'iris'")).status === "ok", "com 'liberar todas' a iris (sem onda) ativa");
// e-mail diferente do cadastro continua indo para o vínculo pendente (não é a ativação em onda que decide isso)
ok((await rpc("authenticated", 20, "ativar_minha_conta", "'duda'")).status === "pendente" && (await rpc("authenticated", 20, "meu_cog")) === null, "e-mail diferente do cadastro segue no fluxo de vínculo pendente, sem acesso");

// controle de tentativas aceita o tipo novo
ok(!(await d.query("insert into public.tentativas_acesso (tipo, chave) values ('ativacao', 'ip:1.2.3.4') returning id").catch(e => ({ erro: e.message }))).erro, "o controle de tentativas aceita o tipo 'ativacao'");
ok(!!(await d.query("insert into public.tentativas_acesso (tipo, chave) values ('qualquer', 'x')").catch(e => ({ erro: e.message }))).erro, "e continua recusando tipos desconhecidos");

// reversão protegida e ciclo
ok((await rodar(d, "J4d_ondas_reverter_protegido.sql", J)) !== null, "reversão SEM a frase é recusada");
ok(await rodar(d, "J4d_ondas_reverter_protegido.sql", J, "AUTORIZO REMOVER CONTROLE DE ONDAS") === null && !(await d.query("select to_regclass('public.ativacao_ondas') as t")).rows[0].t, "reversão COM a frase remove as tabelas");
ok((await rpc("authenticated", 10, "meu_cog")) === "fabi" && (await rpc("anon", null, "entrar_com_arroba", "'fabi'")).ativacao_liberada === undefined, "a reversão não mexe nas contas e devolve as funções do J1/J4a");
ok(await rodar(d, "J4d_ondas_aplicar.sql", J) === null, "J4d reaplica depois de revertido");
// guardas
const g = await laboratorio({ ondas: false }); ok(/J3 não está aplicado/.test(await rodar(g, "J4d_ondas_aplicar.sql", J) || ""), "J4d ABORTA sem o J3 (laboratório base sem J3)");
fim();
