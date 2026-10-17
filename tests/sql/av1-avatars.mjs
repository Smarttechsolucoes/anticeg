// Teste do AV1 (avatars endurecidos) contra o conjunto REAL de policies de storage.objects de 17/10/2026 (PGlite, dados fictícios).
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/av1-avatars.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { como, negado, ok, fim } from "./_lab.mjs";
const R = new URL("../../supabase/", import.meta.url);
const sql = (f, d) => readFileSync(new URL(d + "/" + f, R), "utf8");

async function novo() {
  const d = new PGlite();
  await d.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;`);
  await d.exec(sql("08b_storage_real_17_10.sql", "laboratorio"));
  return d;
}
const rodar = async (d, arq, frase) => { try { await d.exec(frase ? sql(arq, "storage").replace("confirmacao text := '';", `confirmacao text := '${frase}';`) : sql(arq, "storage")); return null; } catch (e) { try { await d.exec("rollback"); } catch { /* sem transação */ } return e.message; } };
const ver = async d => Object.fromEntries((await d.query(sql("AV1_avatars_endurecer_verificar.sql", "storage"))).rows.map(r => [Number(r.ordem), r.valor]));
const snapPol = async d => JSON.stringify((await d.query("select policyname, cmd, roles::text r, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname")).rows);
const ins = (d, papel, b, nome) => como(d, papel, null, `insert into storage.objects (bucket_id, name) values ('${b}', '${nome}')`);

const d = await novo();
const antes = await snapPol(d);

// ANTES: a vulnerabilidade de hoje, reproduzida
ok(!(await ins(d, "anon", "avatars", "invasor/pagina.html")).erro, "ANTES: o visitante envia QUALQUER arquivo para avatars (vulnerabilidade reproduzida)");
ok(!(await ins(d, "authenticated", "avatars", "invasor/x.png")).erro, "ANTES: conta logada também envia qualquer arquivo para avatars");
ok((await como(d, "anon", null, "delete from storage.objects where bucket_id = 'avatars' and name = 'invasor/pagina.html' returning id")).rows?.length === 1, "ANTES: o visitante APAGA arquivo de avatars");
await d.exec("delete from storage.objects where name like 'invasor/%'");

// guardas: foto fora do padrão impede a aplicação (e nada muda)
await d.exec("insert into storage.objects (bucket_id, name, metadata) values ('avatars', 'solta.png', '{\"mimetype\":\"image/png\",\"size\":10}')");
let e = await rodar(d, "AV1_avatars_endurecer_aplicar.sql"); ok(e && /fora do padrão/.test(e) && /Nada foi alterado/.test(e), "guarda: foto fora do padrão <pasta>/avatar.jpg barra o AV1 (" + (e || "").slice(0, 60) + ")");
ok((await snapPol(d)) === antes && (await d.query("select file_size_limit from storage.buckets where id = 'avatars'")).rows[0].file_size_limit === null, "…e nada foi alterado");
await d.exec("delete from storage.objects where name = 'solta.png'");
await d.exec("update storage.objects set metadata = '{\"mimetype\":\"image/jpeg\",\"size\":999999}' where name = 'ana/avatar.jpg'");
e = await rodar(d, "AV1_avatars_endurecer_aplicar.sql"); ok(e && /acima de 256 KB/.test(e), "guarda: foto acima de 256 KB barra o AV1");
await d.exec("update storage.objects set metadata = '{\"mimetype\":\"image/jpeg\",\"size\":15200}' where name = 'ana/avatar.jpg'");

// aplica
e = await rodar(d, "AV1_avatars_endurecer_aplicar.sql"); ok(e === null, "AV1 aplica sem erro" + (e ? ": " + e : ""));
const v = await ver(d);
ok(v[1] === "true | 262144 | {image/jpeg}", "bucket: público, 256 KB, só JPEG (" + v[1] + ")");
ok(v[2] === "4" && v[3] === "0" && v[4] === "0" && v[6] === "true" && v[7] === "true", `verificador: 4 policies novas, 0 de escrita sem filtro, 0 antigas, registrado, allow upload excluído (${[2, 3, 4, 6, 7].map(i => v[i]).join(",")})`);
ok(v[5].split(" | ")[0] === v[5].split(" | ")[1], "as fotos são exatamente as mesmas: " + v[5].split(" | ")[0]);
e = await rodar(d, "AV1_avatars_endurecer_aplicar.sql"); ok(e && /já foi aplicado/.test(e), "segunda aplicação é recusada");

// comportamento do site (caminho <cog>/avatar.jpg): remove + upload continuam funcionando; fotos continuam legíveis
ok(!(await ins(d, "anon", "avatars", "nova/avatar.jpg")).erro, "visitante envia a foto no caminho do site (<cog>/avatar.jpg)");
ok((await como(d, "anon", null, "update storage.objects set name = 'nova/avatar.jpg' where bucket_id = 'avatars' and name = 'nova/avatar.jpg' returning id")).rows?.length === 1, "…e troca (upsert) a foto nesse caminho");
ok((await como(d, "anon", null, "delete from storage.objects where bucket_id = 'avatars' and name = 'nova/avatar.jpg' returning id")).rows?.length === 1, "…e apaga a foto nesse caminho (o site faz remove antes do upload)");
ok((await como(d, "anon", null, "select 1 from storage.objects where bucket_id = 'avatars'")).rows?.length === 6, "as 6 fotos existentes continuam LEGÍVEIS pelo visitante");
ok((await como(d, "authenticated", null, "select 1 from storage.objects where bucket_id = 'avatars'")).rows?.length === 6, "…e pela conta logada");
ok(!(await ins(d, "authenticated", "avatars", "nova2/avatar.jpg")).erro, "conta logada também envia no caminho do site");

// o que ficou barrado
for (const [papel, nome] of [["anon", "invasor/pagina.html"], ["anon", "invasor/x.png"], ["anon", "a/b/avatar.jpg"], ["anon", "avatar.jpg"], ["anon", "public/x.jpg"], ["authenticated", "invasor/pagina.html"], ["authenticated", "x/y.jpg"]])
  ok(negado(await ins(d, papel, "avatars", nome)), `${papel} NÃO envia "${nome}" para avatars`);
ok((await como(d, "anon", null, "delete from storage.objects where bucket_id = 'avatars' and name = 'qualquer.html' returning id")).rows?.length === 0, "visitante não apaga arquivo fora do padrão");
ok((await como(d, "anon", null, "select 1 from storage.objects where bucket_id = 'avatars' and name !~ '^[^/]+/avatar\\.jpg$'")).rows?.length === 0, "a listagem não mostra nada fora do padrão");

// outros buckets ficam EXATAMENTE como estavam
const depois = JSON.parse(await snapPol(d)), antesO = JSON.parse(antes);
const nomesAv = ["anon upload avatars", "allow anon upload", "anon update avatars", "allow anon update", "anon delete avatars", "allow anon select", "public read avatars", "<policy_name>"];
const outrosAntes = antesO.filter(p => !nomesAv.includes(p.policyname) && p.policyname !== "allow upload"), outrosDepois = depois.filter(p => !p.policyname.startsWith("avatars_") && p.policyname !== "allow upload");
ok(JSON.stringify(outrosAntes) === JSON.stringify(outrosDepois), `as ${outrosAntes.length} policies dos outros buckets são idênticas`);
ok(!(await ins(d, "anon", "storage-itens", "teste/qualquer.html")).erro && !(await ins(d, "anon", "popup-skzoo", "teste/qualquer.html")).erro && !(await ins(d, "anon", "comprovantes", "teste/qualquer.html")).erro && !(await ins(d, "authenticated", "fotos-itens", "teste/qualquer.html")).erro, "envio nos outros buckets (storage-itens, popup-skzoo, comprovantes, fotos-itens) segue como hoje (o J5 trata no lançamento)");
ok(negado(await ins(d, "anon", "anti-store", "x.jpg")) && negado(await ins(d, "authenticated", "anti-store", "x.jpg")), "anti-store segue fechado");
ok((await d.query("select count(*)::int c from storage.objects where bucket_id = 'avatars'")).rows[0].c === 7, "contagem de avatars = 6 originais + 1 inserida pelo teste (nada apagado indevidamente)");

// reversão protegida
await d.exec("delete from storage.objects where name in ('nova/avatar.jpg', 'nova2/avatar.jpg') or name like 'teste/%'");
e = await rodar(d, "AV1_avatars_endurecer_reverter_protegido.sql"); ok(e && /confirmação por escrito/.test(e), "reversão sem a frase é recusada");
e = await rodar(d, "AV1_avatars_endurecer_reverter_protegido.sql", "AUTORIZO REABRIR AVATARS"); ok(e === null, "reversão com a frase executa" + (e ? ": " + e : ""));
ok((await snapPol(d)) === antes, "as policies de storage.objects voltam EXATAMENTE como estavam");
const b = (await d.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'")).rows[0];
ok(b.public === true && b.file_size_limit === null && b.allowed_mime_types === null, "o bucket volta como estava (sem limite, qualquer tipo)");
ok(!(await ins(d, "anon", "avatars", "invasor/pagina.html")).erro, "depois da reversão, a situação de hoje volta (por isso a frase)");
await d.exec("delete from storage.objects where name = 'invasor/pagina.html'");
e = await rodar(d, "AV1_avatars_endurecer_aplicar.sql"); ok(e === null, "pode reaplicar depois de reverter" + (e ? ": " + e : ""));
fim();
