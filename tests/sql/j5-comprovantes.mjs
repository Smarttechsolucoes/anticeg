// Teste do J5 (comprovantes privados: buckets, policies de Storage e comprovante_assinavel) no laboratório fictício (PGlite).
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j5-comprovantes.mjs
import { laboratorio, como, n, negado, rodar, verificar, ok, fim, J, sql, U } from "./_lab.mjs";
async function lab() {
  const d = await laboratorio(); await d.exec(sql("08_storage_simulado.sql", "laboratorio"));
  // pedidos que guardam os arquivos (URL no formato que o site grava com getPublicUrl)
  const url = (b, p) => `https://x.supabase.co/storage/v1/object/public/${b}/${p}`;
  await d.exec(`
    insert into public.pagamento_demandas (joiner_cog, itens, valor_total, comprovante_url, status) values ('ana','[]',10,'${url("comprovantes", "pagamentos/ana.pdf")}','em_analise'), ('bia','[]',10,'${url("comprovantes", "pagamentos/bia.pdf")}','em_analise');
    insert into public.pedidos_wmag (nome, email, comprovante_url, status) values ('Ana','ana@exemplo.com','${url("comprovantes", "wmag/1700000000000.jpg")}','aguardando'), ('Bia','bia.antiga@exemplo.com','${url("comprovantes", "wmag/1800000000000.jpg")}','aguardando');
    update public.mercari_pedidos set comprovante_url = '${url("mercari-comprovantes", "ana_1700000000000.jpg")}' where joiner_cog = 'ana';
    update public.mercari_pedidos set comprovante_url = '${url("mercari-comprovantes", "bia_1.jpg")}' where joiner_cog = 'bia';
    insert into public.repassos (joiner_cog, novo_dono_cog, nome_do_item, comprovacao_url, status) values ('gabi','ana','Item de repasse','${url("comprovantes", "repassos/gabi/1.png")}','pendente');
    insert into public.envio_solicitacoes (joiner_cog, status, comprovante_url) values ('ana','pendente','${url("comprovantes", "envio/9/comprovante_1.jpg")}');
  `);
  return d;
}
const d = await lab();
const ass = async (uid, b, p, email) => {
  const claims = JSON.stringify({ sub: uid ? U(uid) : undefined, role: uid ? "authenticated" : "anon", email });
  await d.exec(`select set_config('request.jwt.claims', '${claims}', false)`); await d.exec(`set role ${uid ? "authenticated" : "anon"}`);
  try { return (await d.query(`select public.comprovante_assinavel('${b}', '${p.replace(/'/g, "''")}') r`)).rows[0].r; } catch (e) { return "ERRO:" + e.message; } finally { await d.exec("reset role"); await d.exec("select set_config('request.jwt.claims','',false)"); }
};
const insObj = (papel, uid, b, nome) => como(d, papel, uid, `insert into storage.objects (bucket_id, name) values ('${b}', '${nome}')`);

// ANTES (vulnerabilidade de hoje)
ok(!(await insObj("anon", null, "comprovantes", "invasor/1.html")).erro, "ANTES: o visitante ENVIA qualquer arquivo para o bucket comprovantes (vulnerabilidade reproduzida)");
ok(!(await insObj("anon", null, "avatars", "invasor/1.html")).erro, "ANTES: o visitante envia arquivo para o bucket avatars (vulnerabilidade reproduzida)");
ok((await d.query("select public from storage.buckets where id = 'comprovantes'")).rows[0].public === true, "ANTES: o bucket comprovantes é PÚBLICO (qualquer link abre)");
await d.exec("delete from storage.objects where name like 'invasor/%'");

const e = await rodar(d, "J5_comprovantes_aplicar.sql", J); ok(e === null, "J5 aplica sem erro" + (e ? ": " + e : ""));
const v = await verificar(d, "J5_comprovantes_verificar.sql");
ok(v["buckets de comprovantes privados com limite e tipos (esperado 2)"] === "2" && v["policies de escrita no Storage para o visitante (esperado 0)"] === "0" && v["policies de INSERT específicas dos comprovantes (esperado 0)"] === "0" && v["comprovante_assinavel segura e fechada ao visitante (esperado true)"] === "true" && v["tabela de controle de envios fechada (esperado false)"] === "false", "verificação J5 como esperado: " + JSON.stringify(v));
ok(v["arquivos antes | agora (comprovantes)"].split(" | ").map(x => x.replace("quantidade=", "")).every((x, i, a) => x === a[0]) , "nenhum arquivo foi tocado: " + v["arquivos antes | agora (comprovantes)"]);
const b = (await d.query("select id, public, file_size_limit, allowed_mime_types from storage.buckets where id in ('comprovantes','mercari-comprovantes') order by id")).rows;
ok(b.every(x => x.public === false && Number(x.file_size_limit) === 10485760 && x.allowed_mime_types.includes("application/pdf") && !x.allowed_mime_types.includes("text/html")), "buckets privados, 10 MB, só imagem e PDF");

// escrita no Storage
for (const bk of ["comprovantes", "mercari-comprovantes"]) {
  ok(negado(await insObj("anon", null, bk, "invasor/2.jpg")), `visitante NÃO envia direto para ${bk}`);
  ok(negado(await insObj("authenticated", 2, bk, "invasor/3.jpg")), `conta logada NÃO envia direto para ${bk} (só pela função de envio)`);
}
ok(negado(await insObj("anon", null, "avatars", "invasor/4.jpg")) && negado(await insObj("anon", null, "fotos-itens", "invasor/4.jpg")) && negado(await insObj("anon", null, "storage-itens", "invasor/4.jpg")), "visitante NÃO envia mais para avatars, fotos-itens nem storage-itens");
ok(negado(await insObj("authenticated", 4, "avatars", "sem-vinculo/1.png")) && negado(await insObj("authenticated", 4, "fotos-itens", "sem-vinculo/1.png")), "conta criada por qualquer pessoa (SEM vínculo a uma joiner) NÃO envia para avatars, fotos-itens nem storage-itens");
ok(!(await insObj("authenticated", 2, "avatars", "ana/avatar.jpg")).erro && !(await insObj("authenticated", 1, "fotos-itens", "admin/capa.png")).erro && !(await insObj("authenticated", 2, "storage-itens", "ana/item.png")).erro, "conta logada continua enviando avatar, foto de item e storage");
ok(negado(await insObj("authenticated", 1, "anti-store", "x.jpg")), "o bucket anti-store segue fechado");
ok(negado(await como(d, "anon", null, "select * from storage.objects where bucket_id = 'comprovantes'")) || (await n(d, "anon", null, "select 1 from storage.objects where bucket_id = 'comprovantes'")) === 0, "visitante NÃO lista os comprovantes");
ok((await n(d, "anon", null, "select 1 from storage.objects where bucket_id = 'avatars'")) >= 1 && (await n(d, "anon", null, "select 1 from storage.objects where bucket_id = 'fotos-itens' or bucket_id = 'avatars'")) >= 1, "os buckets de imagens públicas continuam legíveis (avatars)");
ok(negado(await como(d, "authenticated", 2, "update storage.objects set name = 'x' where bucket_id = 'comprovantes'")) || (await como(d, "authenticated", 2, "update storage.objects set name = 'x' where bucket_id = 'comprovantes' returning id")).rows?.length === 0, "conta logada NÃO renomeia comprovante");
ok((await como(d, "authenticated", 2, "delete from storage.objects where bucket_id = 'comprovantes' returning id")).rows?.length === 0, "conta logada NÃO apaga comprovante");

// comprovante_assinavel: quem pode ver cada arquivo
ok(await ass(1, "comprovantes", "pagamentos/bia.pdf", "dona@exemplo.com") === true && await ass(1, "mercari-comprovantes", "qualquer/coisa.jpg", "dona@exemplo.com") === true, "administradora pode ver qualquer arquivo");
ok(await ass(2, "comprovantes", "pagamentos/ana.pdf", "ana@exemplo.com") === true, "ana vê o comprovante de pagamento DELA");
ok(await ass(2, "comprovantes", "pagamentos/bia.pdf", "ana@exemplo.com") === false, "ana NÃO vê o comprovante de pagamento da bia");
ok(await ass(2, "comprovantes", "wmag/1700000000000.jpg", "ana@exemplo.com") === true && await ass(2, "comprovantes", "wmag/1800000000000.jpg", "ana@exemplo.com") === false, "ana vê o comprovante da compra dela (pelo e-mail verificado) e não o da bia");
ok(await ass(2, "mercari-comprovantes", "ana_1700000000000.jpg", "ana@exemplo.com") === true && await ass(2, "mercari-comprovantes", "bia_1.jpg", "ana@exemplo.com") === false, "ana vê o comprovante do Mercari dela, não o da bia");
ok(await ass(2, "comprovantes", "repassos/gabi/1.png", "ana@exemplo.com") === true && await ass(9, "comprovantes", "repassos/gabi/1.png", "gabi@exemplo.com") === true && await ass(3, "comprovantes", "repassos/gabi/1.png", "bia.antiga@exemplo.com") === false, "no repasse, vê quem repassa e quem recebe — e mais ninguém");
ok(await ass(2, "comprovantes", "envio/9/comprovante_1.jpg", "ana@exemplo.com") === true && await ass(3, "comprovantes", "envio/9/comprovante_1.jpg", "bia.antiga@exemplo.com") === false, "ana vê o comprovante do envio dela");
ok(await ass(2, "comprovantes", "nao/existe.jpg", "ana@exemplo.com") === false && await ass(2, "comprovantes", "pagamentos/ana", "ana@exemplo.com") === false && await ass(2, "comprovantes", "pagamentos/ana.pd", "ana@exemplo.com") === false, "arquivo inexistente e pedaços do nome NÃO valem (o nome tem que ser exato)");
// a dona NÃO se declara dona de arquivo alheio escrevendo o endereço no próprio pedido (a URL em pedido é texto livre do navegador)
await d.exec(`insert into public.mercari_pedidos (joiner_cog, joiner_nome, comprovante_url, status) values ('ana', 'Ana', 'https://x.supabase.co/storage/v1/object/public/comprovantes/pagamentos/bia.pdf', 'pendente');
              insert into public.pedidos_wmag (nome, email, comprovante_url, status) values ('Ana', 'ana@exemplo.com', 'https://x.supabase.co/storage/v1/object/public/comprovantes/pagamentos/bia.pdf', 'aguardando')`);
ok(await ass(2, "comprovantes", "pagamentos/bia.pdf", "ana@exemplo.com") === false, "FRAUDE: ana grava o endereço do comprovante da bia no pedido dela e NÃO ganha acesso (a dona vem do registro, não do texto do pedido)");
// arquivo novo: a dona é gravada pelo servidor (função comprovante-upload, chave de serviço) no momento da autorização
await d.exec("insert into public.comprovantes_uploads (chave, bucket, path, cog, origem) values ('cog:ana', 'comprovantes', 'ana/1900000000000.jpg', 'ana', 'envio'), ('ip:1.2.3.4', 'comprovantes', 'wmag/visitante.jpg', null, 'envio')");
ok(await ass(2, "comprovantes", "ana/1900000000000.jpg", "ana@exemplo.com") === true && await ass(3, "comprovantes", "ana/1900000000000.jpg", "bia.antiga@exemplo.com") === false, "arquivo novo: só a dona registrada (ana) vê; a bia não");
ok(await ass(2, "comprovantes", "wmag/visitante.jpg", "ana@exemplo.com") === false && await ass(1, "comprovantes", "wmag/visitante.jpg", "dona@exemplo.com") === true, "arquivo enviado por visitante (sem dona): só a administradora vê");
ok((await d.query("select count(*)::int c from public.comprovantes_uploads where origem = 'legado'")).rows[0].c >= 8, "o retrato dos arquivos que já existiam foi registrado como 'legado'");
ok(await ass(2, "comprovantes", "pagamentos/ana.pdf%", "ana@exemplo.com") === false && await ass(2, "comprovantes", "%", "ana@exemplo.com") === false && await ass(2, "comprovantes", "_", "ana@exemplo.com") === false, "curingas (% e _) NÃO casam com tudo");
ok(await ass(4, "comprovantes", "pagamentos/ana.pdf", "sem.vinculo@exemplo.com") === false, "conta SEM vínculo não vê nada");
ok((await ass(null, "comprovantes", "pagamentos/ana.pdf", undefined)).toString().startsWith("ERRO"), "visitante NÃO executa comprovante_assinavel");
ok(negado(await como(d, "anon", null, "select * from public.comprovantes_uploads")) && negado(await como(d, "authenticated", 2, "select * from public.comprovantes_uploads")), "a tabela de controle de envios é só do servidor");

// reversão protegida e ciclo completo
ok((await rodar(d, "J5_comprovantes_reverter_protegido.sql", J)) !== null, "reversão SEM a frase de autorização é recusada");
ok(await rodar(d, "J5_comprovantes_reverter_protegido.sql", J, "AUTORIZO REABRIR COMPROVANTES") === null, "reversão COM a frase roda");
ok((await d.query("select public from storage.buckets where id = 'comprovantes'")).rows[0].public === true && !(await insObj("anon", null, "comprovantes", "volta/1.jpg")).erro && (await d.query("select count(*)::int c from pg_policies where schemaname = 'storage' and tablename = 'objects'")).rows[0].c === 7, "reversão devolve o bucket público, o envio direto e as 7 policies originais");
const e2 = await rodar(d, "J5_comprovantes_aplicar.sql", J); ok(e2 === null, "J5 reaplica depois de revertido" + (e2 ? ": " + e2 : ""));
// guardas
const g = await lab(); await g.exec(`create policy vazamento on storage.objects for select to public using (bucket_id = 'comprovantes')`);
ok(/alcança os comprovantes/.test(await rodar(g, "J5_comprovantes_aplicar.sql", J) || ""), "J5 ABORTA se ainda existe policy de leitura aberta nos comprovantes");
const g2 = await lab(); await g2.exec("delete from storage.buckets where id = 'mercari-comprovantes' and not exists (select 1 from storage.objects where bucket_id = 'mercari-comprovantes')").catch(() => {}); await g2.exec("delete from storage.objects where bucket_id = 'mercari-comprovantes'; delete from storage.buckets where id = 'mercari-comprovantes'");
ok(/Esperava os buckets/.test(await rodar(g2, "J5_comprovantes_aplicar.sql", J) || ""), "J5 ABORTA se um bucket de comprovantes não existe");
const g3 = await laboratorio({ aplicarBase: false }); await g3.exec(sql("08_storage_simulado.sql", "laboratorio")); ok(/J4a não está aplicado|J1\/A1/.test(await rodar(g3, "J5_comprovantes_aplicar.sql", J) || ""), "J5 ABORTA sem o J4a");
fim();
