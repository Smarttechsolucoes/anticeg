// Teste do inventário dos comprovantes antigos (J5_inventario_leitura.sql) no laboratório fictício (PGlite): ele só LÊ, mapeia donas, acha arquivos sem dona, referências sem arquivo e tabelas fora do mapeamento.
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j5-inventario.mjs
import { laboratorio, ok, fim, sql } from "./_lab.mjs";
const d = await laboratorio(); await d.exec(sql("08_storage_simulado.sql", "laboratorio"));
const url = (b, p) => `https://x.supabase.co/storage/v1/object/public/${b}/${p}`;
await d.exec(`
  insert into public.pagamento_demandas (joiner_cog, itens, valor_total, comprovante_url, status) values ('ana','[]',10,'${url("comprovantes", "pagamentos/ana.pdf")}','em_analise'), ('bia','[]',10,'${url("comprovantes", "pagamentos/bia.pdf")}','em_analise');
  insert into public.pedidos_wmag (nome, email, comprovante_url, status) values ('Ana','ana@exemplo.com','${url("comprovantes", "wmag/1700000000000.jpg")}','aguardando');
  update public.mercari_pedidos set comprovante_url = '${url("mercari-comprovantes", "ana_1700000000000.jpg")}' where joiner_cog = 'ana';
  update public.mercari_pedidos set comprovante_url = '${url("mercari-comprovantes", "arquivo-que-sumiu.jpg")}' where joiner_cog = 'bia';
  insert into public.repassos (joiner_cog, novo_dono_cog, nome_do_item, comprovacao_url, status) values ('gabi','ana','Item','${url("comprovantes", "pagamentos/ana.pdf")}','pendente');
  -- referência em tabela que o mapeamento NÃO conhece (observações livres do formulário)
  insert into public.formulario_pedidos (evento, joiner_cog, status, observacoes) values ('EVENTO X', 'ana', 'pendente', 'Comprovante: ${url("comprovantes", "formulario/extra.png")}');
  insert into storage.objects (bucket_id, name) values ('comprovantes', 'formulario/extra.png'), ('comprovantes', 'orfao/sem-dono.jpg');
`);
// fotografia dos dados do site ANTES (o inventário não pode alterar nada)
const foto = async () => JSON.stringify((await d.query(`select (select count(*) from public.pagamento_demandas) a, (select count(*) from public.mercari_pedidos) b, (select count(*) from storage.objects) c, (select md5(string_agg(comprovante_url, ',' order by id)) from public.pagamento_demandas) e, (select count(*) from pg_policies) f, (select count(*) from pg_class where relnamespace = 'public'::regnamespace) g`)).rows);
const antes = await foto();
const res = await d.exec(sql("J5_inventario_leitura.sql", "lancamento"));
const linhas = res[res.length - 1].rows;
const achar = (secao, item) => linhas.find(l => l.secao === secao && (item ? l.item === item : true));

const c = achar("1 por bucket", "comprovantes").valor;
ok(/arquivos no Storage: 5 /.test(c) && /com dona identificada: 3 /.test(c) && /SEM dona \(só a administradora verá\): 2 /.test(c) && /referências SEM arquivo: 0 /.test(c) && /bucket PÚBLICO/.test(c), "comprovantes: 5 arquivos, 3 com dona (pagamento da ana e da bia, compra da ana), 2 sem dona (o do formulário e o órfão): " + c);
const m = achar("1 por bucket", "mercari-comprovantes").valor;
ok(/arquivos no Storage: 1 /.test(m) && /com dona identificada: 1 /.test(m) && /referências SEM arquivo: 1 /.test(m), "mercari: 1 arquivo com dona e 1 referência que aponta para arquivo que sumiu: " + m);
ok(/COGs distintos \| e-mails distintos \| arquivos com mais de uma dona/.test(achar("2 donas").item) && /^\d+ \| 1 \| 1$/.test(achar("2 donas").valor), "donas: o arquivo do repasse tem 2 donas (quem repassa e quem recebe): " + achar("2 donas").valor);
ok(linhas.some(l => l.secao === "3 referências por tabela" && l.item === "pagamento_demandas.comprovante_url") && linhas.some(l => l.item === "repassos.comprovacao_url"), "lista as referências por tabela");
const alerta = linhas.filter(l => l.secao === "4 ALERTA: tabela fora do mapeamento" && l.item !== "(nenhuma)");
ok(alerta.length === 1 && alerta[0].item === "formulario_pedidos.observacoes", "ALERTA: acha a tabela fora do mapeamento (formulario_pedidos.observacoes cita comprovante e o J5 não sabe quem é a dona): " + JSON.stringify(alerta.map(a => a.item)));
ok(await foto() === antes, "o inventário NÃO alterou nada (contagens, hash das URLs, policies e tabelas idênticas)");
const temporarias = (await d.query("select count(*)::int c from pg_class where relnamespace = 'public'::regnamespace and relname like 'j5_%'")).rows[0].c;
ok(temporarias === 0, "só usou tabelas temporárias da sessão (nada ficou no schema do site)");
fim();
