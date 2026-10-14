// Teste do J4c-4e (ceg_resumo, ceg_vencimentos, ceg_itens) no laboratório fictício (PGlite), COM o J4b aplicado: a masterlist fica só com as linhas de cada joiner, e as funções devolvem a visão
// da comunidade SEM valores financeiros nem pagamentos de terceiros. Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4c4e-cegs-publico.mjs
import { laboratorio, como, n, negado, rodar, verificar, ok, fim, J } from "./_lab.mjs";
const d = await laboratorio();
const rpc = async (papel, uid, fn, args = "") => (await como(d, papel, uid, `select public.${fn}(${args}) r`)).rows?.[0]?.r;
const erroRpc = async (papel, uid, fn, args = "") => (await como(d, papel, uid, `select public.${fn}(${args}) r`)).erro;

// dados: vários donos, valores, vencimentos e um slot disponível
await d.exec(`delete from public.masterlist;
  insert into public.masterlist (id, ceg, cog, nome, nome_do_item, valor_item, frete_inter, taxa_rf, status, info_adicionais, pago_item, venc_item, venc_frete) values
   (1, 'SKZOO', 'ana', 'Ana', 'Photocard A', 40, 10, 5, 'Pré-venda', 'prazo 20/10', false, current_date + 5, current_date + 9),
   (2, 'SKZOO', 'bia', 'Bia', 'Photocard B', 80, 20, 8, 'Pré-venda', null, true, current_date + 5, null),
   (3, 'SKZOO', 'bia', 'Bia', 'Photocard C', 90, 22, 9, 'Comprado', null, true, null, null),
   (4, 'SKZOO', 'gabi', 'Gabi', 'Photocard D', 70, 15, 7, 'Chegou', null, false, current_date + 12, null),
   (5, 'SKZOO', 'ninguem', 'Disponivel', 'Slot livre', 50, 0, 0, 'Pré-venda', null, false, null, null),
   (6, 'WAVE', 'ana', 'Ana', 'Box', 200, 50, 20, 'Pré-venda', null, false, current_date + 5, current_date + 9)`);

// ANTES: a masterlist inteira é pública
ok((await n(d, "anon", null, "select 1 from public.masterlist")) === 6, "ANTES: o visitante lê a masterlist inteira, com valores de todas (vulnerabilidade reproduzida)");

for (const a of ["J4b_lote1_aplicar.sql", "J4c4e_cegs_publico_aplicar.sql"]) { const e = await rodar(d, a, J); ok(e === null, `${a} aplica sem erro` + (e ? ": " + e : "")); }
const v = await verificar(d, "J4c4e_cegs_publico_verificar.sql");
ok(v["funções de CEG seguras (esperado 3)"] === "3" && v["visitante executa ceg_itens (esperado false)"] === "false" && v["visitante executa ceg_resumo e ceg_vencimentos (esperado true)"] === "true", "verificação J4c-4e como esperado: " + JSON.stringify(v));

// com o J4b, a masterlist direta mostra só o que é da própria joiner (é por isso que as telas precisam das funções)
ok((await n(d, "anon", null, "select 1 from public.masterlist")) === undefined || negado(await como(d, "anon", null, "select * from public.masterlist")), "com o J4b o visitante NÃO lê mais a masterlist");
ok((await como(d, "authenticated", 2, "select cog from public.masterlist where nome <> 'Disponivel'")).rows?.every(r => r.cog === "ana"), "com o J4b a ana lê direto só os itens dela");

// ceg_resumo: números, ninguém identificado; pública
const rs = await rpc("anon", null, "ceg_resumo"); const sk = rs.find(x => x.ceg === "SKZOO"), wv = rs.find(x => x.ceg === "WAVE");
ok(rs.length === 2 && sk.itens === 4 && sk.joiners === 3 && sk.status_counts["Pré-venda"] === 2 && sk.status_counts["Comprado"] === 1 && sk.status_counts["Chegou"] === 1 && wv.itens === 1 && wv.joiners === 1, "ceg_resumo: itens, joiners e itens por situação de cada CEG (o slot 'Disponivel' não conta): " + JSON.stringify(rs));
ok(!JSON.stringify(rs).match(/ana|bia|gabi|Photocard|valor|40|80/i), "ceg_resumo NÃO traz nome, @, item nem valor de ninguém");
ok(JSON.stringify(await rpc("authenticated", 2, "ceg_resumo")) === JSON.stringify(rs), "o resumo é o mesmo para visitante e para joiner (números da comunidade, não da linha dela)");

// ceg_vencimentos: datas, sem dono nem valor; pública
const vc = await rpc("anon", null, "ceg_vencimentos");
ok(vc.length >= 3 && vc.every(x => Object.keys(x).sort().join() === "ceg,venc_frete,venc_item,venc_rf") && !JSON.stringify(vc).match(/ana|bia|valor|pago/i), "ceg_vencimentos: só CEG e datas (sem dono, valor ou pagamento): " + vc.length + " linhas");

// ceg_itens: só conta ativada/administradora; sem valores nem pagamentos
ok((await rpc("anon", null, "ceg_itens", "'SKZOO'")) === undefined && /permission denied/.test(await erroRpc("anon", null, "ceg_itens", "'SKZOO'") || ""), "visitante NÃO executa ceg_itens");
ok(JSON.stringify(await rpc("authenticated", 4, "ceg_itens", "'SKZOO'")) === "[]", "conta SEM vínculo recebe lista vazia");
const it = await rpc("authenticated", 2, "ceg_itens", "'SKZOO'");
ok(it.length === 4 && it.some(x => x.cog === "bia" && x.nome_do_item === "Photocard B") && it.some(x => x.cog === "ana") && !it.some(x => x.nome === "Disponivel"), "ana (ativada) vê a lista dos 4 itens do CEG com @, nome, item e situação (sem o slot livre)");
ok(it.every(x => Object.keys(x).sort().join() === "ceg,cog,id,info_adicionais,nome,nome_do_item,status") && !JSON.stringify(it).match(/valor|frete|taxa|pago|venc/i), "ceg_itens NÃO traz valor, frete, taxa, pagamento nem vencimento de ninguém");
ok(JSON.stringify(await rpc("authenticated", 2, "ceg_itens", "'NAO EXISTE'")) === "[]", "CEG inexistente: lista vazia");
const injecao = await rpc("authenticated", 2, "ceg_itens", "'SKZOO'' or true or ''x'");
ok(JSON.stringify(injecao) === "[]", "texto malicioso no nome do CEG não vaza nada (parâmetro, não SQL)");
ok((await rpc("authenticated", 1, "ceg_itens", "'SKZOO'")).length === 4, "administradora também lê");

// as funções não abrem a tabela
ok((await como(d, "authenticated", 2, "select cog from public.masterlist where cog = 'bia'")).rows?.length === 0, "com as funções aplicadas, a ana continua SEM ler as linhas da bia na masterlist");

// reversão e guardas
ok(await rodar(d, "J4c4e_cegs_publico_reverter.sql", J) === null && !(await d.query("select to_regprocedure('public.ceg_itens(text)') as p")).rows[0].p, "reversão remove as 3 funções");
ok(await rodar(d, "J4c4e_cegs_publico_aplicar.sql", J) === null, "J4c-4e reaplica depois de revertido");
const g = await laboratorio(); await g.exec("alter table public.masterlist drop column venc_rf cascade");
ok(/sem as colunas esperadas/.test(await rodar(g, "J4c4e_cegs_publico_aplicar.sql", J) || ""), "J4c-4e ABORTA se a masterlist não tem as colunas esperadas");
fim();
