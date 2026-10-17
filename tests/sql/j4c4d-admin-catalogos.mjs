// Teste do J4c-4d (rastreios, estoque, ceg_config, item_fotos, links_uteis, cal_eventos, tabela_precos, sugestoes_tabela, antiv_badges) no laboratório fictício (PGlite).
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4c4d-admin-catalogos.mjs
import { laboratorio, como, n, negado, rodar, verificar, ok, fim, J } from "./_lab.mjs";
const d = await laboratorio();
const barrado = r => negado(r) || r.rows?.length === 0;
const RESTRITAS = ["rastreios", "estoque_itens", "estoque_compras", "ceg_config", "antiv_badges"];
const PUBLICAS = ["item_fotos", "links_uteis", "cal_eventos", "tabela_precos"];

// ANTES (vulnerabilidade de hoje)
ok((await n(d, "anon", null, "select 1 from public.rastreios")) > 0 && (await n(d, "anon", null, "select 1 from public.ceg_config")) > 0, "ANTES: o visitante lê rastreios e os links dos grupos de WhatsApp (vulnerabilidade reproduzida)");
ok((await como(d, "anon", null, "delete from public.links_uteis returning id")).rows?.length >= 1, "ANTES: o visitante APAGA os links úteis (vulnerabilidade reproduzida)");
ok((await como(d, "anon", null, "update public.estoque_itens set saldo_inicial = 0 returning id")).rows?.length >= 1, "ANTES: o visitante altera o estoque (vulnerabilidade reproduzida)");
await d.exec("insert into public.links_uteis (titulo, url) values ('Link fictício', 'https://exemplo.com'); update public.estoque_itens set saldo_inicial = 10");

const e = await rodar(d, "J4c4d_admin_catalogos_aplicar.sql", J); ok(e === null, "J4c-4d aplica sem erro" + (e ? ": " + e : ""));
const v = await verificar(d, "J4c4d_admin_catalogos_verificar.sql");
ok(v["policies nas 10 tabelas (esperado 18)"] === "18" && v["policies para visitante/PUBLIC (esperado 6)"] === "6" && v["RLS ligado nas 10 tabelas (esperado 10)"] === "10" && v["visitante com privilégio em tabela restrita (esperado false)"] === "false" && v["visitante escreve em conteúdo público (esperado false)"] === "false" && v["visitante altera ou apaga sugestões (esperado false)"] === "false", "verificação J4c-4d como esperado: " + JSON.stringify(v));

// visitante: restritas fechadas, públicas só leitura
for (const t of RESTRITAS) ok(negado(await como(d, "anon", null, `select * from public.${t}`)), `visitante NÃO lê ${t}`);
for (const t of PUBLICAS) ok((await como(d, "anon", null, `select * from public.${t}`)).rows?.length >= 1, `visitante LÊ ${t} (conteúdo público do site)`);
ok(negado(await como(d, "anon", null, "insert into public.links_uteis (titulo, url) values ('golpe','http://x')")) && negado(await como(d, "anon", null, "update public.item_fotos set foto_url = 'http://x'")) && negado(await como(d, "anon", null, "delete from public.cal_eventos")) && negado(await como(d, "anon", null, "delete from public.tabela_precos")), "visitante NÃO cria, troca nem apaga conteúdo público");
ok(negado(await como(d, "anon", null, "delete from public.rastreios")) && negado(await como(d, "anon", null, "update public.estoque_itens set saldo_inicial = 0")) && negado(await como(d, "anon", null, "insert into public.estoque_compras (item_id, quantidade) values (1, 1)")), "visitante NÃO apaga rastreios nem mexe no estoque");

// sugestões de preço (tabela-stray-kids é página pública)
const sg = (await como(d, "anon", null, "select status from public.sugestoes_tabela")).rows;
ok(sg.length === 1 && sg[0].status === "pendente", "visitante vê as sugestões pendentes");
ok(!(await como(d, "anon", null, "insert into public.sugestoes_tabela (tabela_preco_id, sheet, item, preco_sugerido, status) values (1, 'Album', 'Album fictício', 'R$ 120', 'pendente')")).erro, "visitante SUGERE um preço (nasce 'pendente')");
ok(negado(await como(d, "anon", null, "insert into public.sugestoes_tabela (tabela_preco_id, sheet, item, preco_sugerido, status) values (1, 'Album', 'x', 'R$ 1', 'aprovado')")), "visitante NÃO cria sugestão já 'aprovada'");
ok(negado(await como(d, "anon", null, "update public.sugestoes_tabela set status = 'aprovado'")) && negado(await como(d, "anon", null, "delete from public.sugestoes_tabela")), "visitante NÃO aprova nem apaga sugestões");
await d.exec("insert into public.sugestoes_tabela (sheet, item, preco_sugerido, status, created_at) select 'Album', 'spam', 'R$ 1', 'pendente', now() from generate_series(1, 100)");
ok(negado(await como(d, "anon", null, "insert into public.sugestoes_tabela (sheet, item, preco_sugerido, status) values ('Album', 'spam', 'R$ 1', 'pendente')")), "depois de 100 sugestões na hora, o servidor RECUSA mais (trava contra spam)");
await d.exec("delete from public.sugestoes_tabela where item = 'spam'");

// joiner ativada
ok((await n(d, "authenticated", 2, "select 1 from public.ceg_config")) === 1 && (await n(d, "authenticated", 4, "select 1 from public.ceg_config")) === 0, "ana (ativada) lê os links dos grupos; conta SEM vínculo não");
ok((await como(d, "authenticated", 2, "select joiner_cog from public.antiv_badges")).rows?.every(r => r.joiner_cog === "ana") && (await n(d, "authenticated", 2, "select 1 from public.antiv_badges")) === 1, "ana lê só os selos dela");
for (const t of RESTRITAS.filter(t => !["ceg_config", "antiv_badges"].includes(t))) ok((await n(d, "authenticated", 2, `select 1 from public.${t}`)) === 0, `ana NÃO lê ${t}`);
ok(barrado(await como(d, "authenticated", 2, "update public.ceg_config set whatsapp_link = 'http://golpe' returning ceg")) && barrado(await como(d, "authenticated", 2, "delete from public.links_uteis returning id")) && negado(await como(d, "authenticated", 2, "insert into public.item_fotos (ceg, foto_url) values ('SKZOO','http://x')")) && barrado(await como(d, "authenticated", 2, "update public.estoque_itens set saldo_inicial = 0 returning id")), "ana NÃO escreve em nenhuma delas");
ok(barrado(await como(d, "authenticated", 2, "update public.sugestoes_tabela set status = 'aprovado' returning id")), "ana NÃO aprova sugestão de preço");

// administradora preservada
ok((await n(d, "authenticated", 1, "select 1 from public.rastreios")) === 1 && (await n(d, "authenticated", 1, "select 1 from public.estoque_itens")) === 1 && (await n(d, "authenticated", 1, "select 1 from public.ceg_config")) === 1, "administradora lê tudo");
ok((await como(d, "authenticated", 1, "insert into public.links_uteis (titulo, url) values ('da admin','https://exemplo.com/a') returning id")).rows?.length === 1 && (await como(d, "authenticated", 1, "update public.sugestoes_tabela set status = 'aprovado' where item = 'Album fictício' returning id")).rows?.length >= 1 && (await como(d, "authenticated", 1, "update public.estoque_itens set saldo_inicial = 7 returning id")).rows?.length === 1 && (await como(d, "authenticated", 1, "delete from public.rastreios returning id")).rows?.length === 1, "administradora cria link, aprova sugestão, ajusta estoque e apaga rastreio");

// reversão protegida e ciclo completo
ok((await rodar(d, "J4c4d_admin_catalogos_reverter_protegido.sql", J)) !== null, "reversão SEM a frase de autorização é recusada");
ok(await rodar(d, "J4c4d_admin_catalogos_reverter_protegido.sql", J, "AUTORIZO REABRIR ADMINISTRACAO E CATALOGOS") === null && (await n(d, "anon", null, "select 1 from public.estoque_itens")) > 0, "reversão COM a frase reabre (e só então)");
const e2 = await rodar(d, "J4c4d_admin_catalogos_aplicar.sql", J); ok(e2 === null, "J4c-4d reaplica depois de revertido" + (e2 ? ": " + e2 : ""));
// guardas
const g = await laboratorio(); await g.exec("alter table public.antiv_badges drop column joiner_cog cascade");
ok(/sem as colunas esperadas/.test(await rodar(g, "J4c4d_admin_catalogos_aplicar.sql", J) || ""), "J4c-4d ABORTA se antiv_badges não tem as colunas esperadas");
const g2 = await laboratorio({ aplicarBase: false }); ok(/J4a não está aplicado|J1\/A1/.test(await rodar(g2, "J4c4d_admin_catalogos_aplicar.sql", J) || ""), "J4c-4d ABORTA sem o J4a");
fim();
