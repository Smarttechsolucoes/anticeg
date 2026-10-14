// Teste do J4c-4a (mercari_pedidos, lojinha_repasses, repassos) no laboratório fictício (PGlite). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j4c4a-mercari-lojinha.mjs
import { laboratorio, como, n, negado, rodar, verificar, ok, fim, J } from "./_lab.mjs";
const d = await laboratorio();
const T = ["mercari_pedidos", "lojinha_repasses", "repassos"];

// ANTES (vulnerabilidade de hoje)
for (const t of T) ok((await n(d, "anon", null, `select 1 from public.${t}`)) > 0, `ANTES: o visitante lê ${t} inteira (vulnerabilidade reproduzida)`);
ok((await como(d, "anon", null, "select whatsapp from public.lojinha_repasses limit 1")).rows?.[0]?.whatsapp?.length > 5, "ANTES: o visitante lê o WhatsApp das vendedoras da lojinha");

const e = await rodar(d, "J4c4a_mercari_lojinha_aplicar.sql", J); ok(e === null, "J4c-4a aplica sem erro" + (e ? ": " + e : ""));
const v = await verificar(d, "J4c4a_mercari_lojinha_verificar.sql");
ok(v["policies nas 3 tabelas (esperado 12)"] === "12" && v["policies para visitante/PUBLIC (esperado 0)"] === "0" && v["RLS ligado nas 3 tabelas (esperado 3)"] === "3" && v["visitante com algum privilégio nas 3 tabelas (esperado false)"] === "false" && v["gatilhos de campos ligados (esperado 2)"] === "2", "verificação J4c-4a como esperado: " + JSON.stringify(v));
const imp = v["impressão antes | agora (mercari_pedidos)"].split(" | ");
ok(imp[0] === imp[1], "os dados do Mercari são idênticos antes e depois");

// visitante
for (const t of T) ok(negado(await como(d, "anon", null, `select * from public.${t}`)), `visitante NÃO lê ${t}`);
ok(negado(await como(d, "anon", null, "insert into public.mercari_pedidos (joiner_cog, status) values ('ana','pendente')")) && negado(await como(d, "anon", null, "update public.lojinha_repasses set status = 'vendido'")) && negado(await como(d, "anon", null, "delete from public.repassos")), "visitante NÃO cria, altera nem apaga");

// Mercari: ana só vê o dela, cria o dela, não mexe no status, não cria como outra
ok((await como(d, "authenticated", 2, "select joiner_cog from public.mercari_pedidos")).rows?.every(r => r.joiner_cog === "ana") && (await n(d, "authenticated", 2, "select 1 from public.mercari_pedidos")) === 1, "ana vê SÓ o pedido Mercari dela");
ok((await como(d, "authenticated", 2, "insert into public.mercari_pedidos (joiner_cog, joiner_nome, itens, status) values ('ana','Ana','[]','pendente') returning id")).rows?.length === 1, "ana cria pedido Mercari para si (nasce 'pendente')");
ok(negado(await como(d, "authenticated", 2, "insert into public.mercari_pedidos (joiner_cog, status) values ('bia','pendente')")), "ana NÃO cria pedido em nome da bia");
ok(negado(await como(d, "authenticated", 2, "insert into public.mercari_pedidos (joiner_cog, status) values ('ana','finalizado')")) && negado(await como(d, "authenticated", 2, "insert into public.mercari_pedidos (joiner_cog, status) values ('ana','pago')")), "ana NÃO cria pedido já 'pago' ou 'finalizado'");
ok((await como(d, "authenticated", 2, "update public.mercari_pedidos set status = 'pago' where joiner_cog = 'ana' returning id")).rows?.length === 0 && (await como(d, "authenticated", 2, "delete from public.mercari_pedidos where joiner_cog = 'ana' returning id")).rows?.length === 0, "ana NÃO marca o próprio pedido como pago nem apaga");
ok((await n(d, "authenticated", 4, "select 1 from public.mercari_pedidos")) === 0 && (await n(d, "authenticated", 4, "select 1 from public.lojinha_repasses")) === 0, "conta SEM vínculo não vê nada");
ok((await n(d, "authenticated", 1, "select 1 from public.mercari_pedidos")) >= 3 && (await como(d, "authenticated", 1, "update public.mercari_pedidos set status = 'aprovado' where joiner_cog = 'ana' and status = 'pendente' returning id")).rows?.length >= 1, "administradora vê tudo e aprova pedido");

// Lojinha: vitrine só para conta ativada; contato visível só para logadas
const vit = (await como(d, "authenticated", 2, "select joiner_cog, status, reservado_para from public.lojinha_repasses")).rows;
ok(vit.some(r => r.joiner_cog === "bia" && r.status === "disponivel") && vit.some(r => r.joiner_cog === "ana") && vit.some(r => r.status === "reservado" && r.reservado_para === "ana") && !vit.some(r => r.joiner_cog === "gabi"), "ana vê a vitrine (disponíveis), o que é dela e o que foi reservado para ela, mas NÃO o vendido da gabi");
ok((await como(d, "authenticated", 2, "insert into public.lojinha_repasses (joiner_cog, nome_card, valor, status) values ('ana','Novo item',10,'disponivel') returning id")).rows?.length === 1, "ana anuncia item dela");
ok(negado(await como(d, "authenticated", 2, "insert into public.lojinha_repasses (joiner_cog, nome_card, valor, status) values ('bia','Forjado',10,'disponivel')")), "ana NÃO anuncia em nome da bia");
ok((await como(d, "authenticated", 2, "update public.lojinha_repasses set status = 'vendido' where joiner_cog = 'ana' and nome_card = 'Item da Ana' returning id")).rows?.length === 1, "ana marca o item DELA como vendido");
ok((await como(d, "authenticated", 2, "update public.lojinha_repasses set status = 'vendido' where joiner_cog = 'bia' returning id")).rows?.length === 0, "ana NÃO altera item da bia");
ok(negado(await como(d, "authenticated", 2, "update public.lojinha_repasses set joiner_cog = 'bia' where joiner_cog = 'ana'")) || (await como(d, "authenticated", 2, "update public.lojinha_repasses set joiner_cog = 'bia' where joiner_cog = 'ana' returning id")).rows?.length === 0, "ana NÃO passa o item dela para outra dona");
ok((await n(d, "authenticated", 1, "select 1 from public.lojinha_repasses")) === 5, "administradora vê a lojinha inteira (5 itens)");

// Repasses: lê como quem repassa OU quem recebe; cria o próprio; só cancela o próprio pendente
const rp = (await como(d, "authenticated", 2, "select joiner_cog, novo_dono_cog from public.repassos")).rows;
ok(rp.length === 2 && rp.every(r => r.joiner_cog === "ana" || r.novo_dono_cog === "ana"), "ana vê os repasses em que é quem repassa OU quem recebe");
ok((await n(d, "authenticated", 3, "select 1 from public.repassos")) === 1, "bia vê só o repasse em que recebe");
ok((await como(d, "authenticated", 2, "insert into public.repassos (joiner_cog, novo_dono_cog, nome_do_item, status) values ('ana','bia','Item novo','pendente') returning id")).rows?.length === 1, "ana cria repasse próprio");
ok(negado(await como(d, "authenticated", 2, "insert into public.repassos (joiner_cog, novo_dono_cog, nome_do_item, status) values ('bia','ana','Forjado','pendente')")) && negado(await como(d, "authenticated", 2, "insert into public.repassos (joiner_cog, novo_dono_cog, nome_do_item, status) values ('ana','bia','Auto-aprovado','aprovado')")), "ana NÃO cria repasse em nome de outra nem já 'aprovado'");
ok((await como(d, "authenticated", 2, "update public.repassos set status = 'cancelado' where joiner_cog = 'ana' and nome_do_item = 'Item novo' returning id")).rows?.length === 1, "ana cancela o próprio repasse pendente");
{ const r = await como(d, "authenticated", 2, "update public.repassos set status = 'aprovado' where joiner_cog = 'ana' and nome_do_item = 'Photocard X' returning id"); ok(negado(r) || r.rows?.length === 0, "ana NÃO aprova o próprio repasse"); }
ok(negado(await como(d, "authenticated", 2, "update public.repassos set novo_dono_cog = 'gabi', status = 'cancelado' where joiner_cog = 'ana' and nome_do_item = 'Photocard X'")), "ana NÃO troca o novo dono ao cancelar (gatilho de campos)");
ok((await como(d, "authenticated", 3, "update public.repassos set status = 'cancelado' where novo_dono_cog = 'bia' returning id")).rows?.length === 0, "quem RECEBE o repasse não cancela o da outra");
ok((await como(d, "authenticated", 1, "update public.repassos set status = 'aprovado', novo_dono_cog = 'bia' where nome_do_item = 'Photocard X' returning id")).rows?.length === 1, "administradora aprova e define o novo dono");

// reversão protegida e ciclo completo
ok((await rodar(d, "J4c4a_mercari_lojinha_reverter_protegido.sql", J)) !== null, "reversão SEM a frase de autorização é recusada");
ok(await rodar(d, "J4c4a_mercari_lojinha_reverter_protegido.sql", J, "AUTORIZO REABRIR MERCARI E LOJINHA") === null && (await n(d, "anon", null, "select 1 from public.mercari_pedidos")) > 0, "reversão COM a frase reabre (e só então)");
const e2 = await rodar(d, "J4c4a_mercari_lojinha_aplicar.sql", J); ok(e2 === null, "J4c-4a reaplica depois de revertido" + (e2 ? ": " + e2 : ""));
// guardas
const g = await laboratorio(); await g.exec("alter table public.repassos drop column novo_dono_cog cascade");
ok(/sem as colunas esperadas/.test(await rodar(g, "J4c4a_mercari_lojinha_aplicar.sql", J) || ""), "J4c-4a ABORTA se repassos não tem as colunas esperadas");
const g2 = await laboratorio({ aplicarBase: false }); ok(/J4a não está aplicado|J1\/A1/.test(await rodar(g2, "J4c4a_mercari_lojinha_aplicar.sql", J) || ""), "J4c-4a ABORTA sem o J4a");
fim();
