// J5 contra o conjunto REAL de policies do Storage de 17/10/2026 (o laboratório antigo tinha só 1 policy genérica; a produção tem 18): o J5 não pode abortar nem deixar escrita anônima.
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/j5-storage-real.mjs
import { laboratorio, como, negado, rodar, ok, fim, J, sql } from "./_lab.mjs";
const ins = (d, papel, uid, b, nome) => como(d, papel, uid, `insert into storage.objects (bucket_id, name) values ('${b}', '${nome}')`);
async function lab(comAV1) {
  const d = await laboratorio(); await d.exec(sql("08b_storage_real_17_10.sql", "laboratorio"));
  await d.exec(`insert into public.pagamento_demandas (joiner_cog, itens, valor_total, comprovante_url, status) values ('ana','[]',10,'https://x.supabase.co/storage/v1/object/public/comprovantes/pagamentos/ana.pdf','em_analise')`);
  if (comAV1) { const e = await rodar(d, "AV1_avatars_endurecer_aplicar.sql", "storage"); if (e) throw new Error("AV1: " + e); }
  return d;
}
for (const comAV1 of [false, true]) {
  const rot = comAV1 ? "com AV1 aplicado antes" : "sem AV1";
  const d = await lab(comAV1);
  const e = await rodar(d, "J5_comprovantes_aplicar.sql", J); ok(e === null, `J5 aplica sem erro contra as policies REAIS (${rot})` + (e ? ": " + e.slice(0, 200) : ""));
  if (e) continue;
  const anonEscrita = (await d.query("select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT','UPDATE','DELETE','ALL') and ('anon' = any(roles) or 'public' = any(roles))")).rows;
  ok(anonEscrita.length === 0, `(${rot}) nenhuma policy de escrita para o visitante sobra` + (anonEscrita.length ? ": " + anonEscrita.map(r => r.policyname).join(", ") : ""));
  for (const bk of ["avatars", "storage-itens", "popup-skzoo", "comprovantes", "mercari-comprovantes", "fotos-itens"]) ok(negado(await ins(d, "anon", null, bk, "sonda/avatar.jpg")), `(${rot}) visitante NÃO envia para ${bk}`);
  ok(negado(await como(d, "anon", null, "delete from storage.objects where bucket_id = 'storage-itens' and name = 'x/foto.jpg' returning id")) || (await como(d, "anon", null, "delete from storage.objects where bucket_id = 'storage-itens' and name = 'x/foto.jpg' returning id")).rows?.length === 0, `(${rot}) visitante NÃO apaga em storage-itens`);
  // conta ativada (ana = conta 2) escreve só na PRÓPRIA pasta de avatar
  ok(!(await ins(d, "authenticated", 2, "avatars", "ana/avatar.jpg")).erro, `(${rot}) ana envia a foto dela (ana/avatar.jpg)`);
  ok(negado(await ins(d, "authenticated", 2, "avatars", "bia/avatar.jpg")), `(${rot}) ana NÃO envia na pasta da bia`);
  ok(negado(await ins(d, "authenticated", 2, "avatars", "ana/outro.html")), `(${rot}) ana NÃO envia arquivo fora do padrão`);
  ok(negado(await ins(d, "authenticated", 4, "avatars", "ana/avatar.jpg")), `(${rot}) conta SEM vínculo não envia`);
  ok(!(await ins(d, "authenticated", 1, "avatars", "bia/avatar.jpg")).erro, `(${rot}) a administradora envia em qualquer pasta`);
  ok((await como(d, "authenticated", 2, "delete from storage.objects where bucket_id = 'avatars' and name = 'bia/avatar.jpg' returning id")).rows?.length === 0, `(${rot}) ana NÃO apaga a foto da bia`);
  ok((await como(d, "authenticated", 2, "delete from storage.objects where bucket_id = 'avatars' and name = 'ana/avatar.jpg' returning id")).rows?.length >= 1, `(${rot}) ana apaga a PRÓPRIA foto (o site faz remove antes do upload)`);
  ok(!(await ins(d, "authenticated", 2, "storage-itens", "ana/item.jpg")).erro && !(await ins(d, "authenticated", 2, "popup-skzoo", "ana/c.jpg")).erro && !(await ins(d, "authenticated", 2, "fotos-itens", "ana/f.jpg")).erro, `(${rot}) conta ativada segue enviando em storage-itens, popup-skzoo e fotos-itens`);
  ok(negado(await ins(d, "authenticated", 2, "comprovantes", "ana/c.jpg")) && negado(await ins(d, "authenticated", 2, "anti-store", "x.jpg")), `(${rot}) comprovantes só pela função; anti-store fechado`);
  ok((await como(d, "anon", null, "select 1 from storage.objects where bucket_id = 'avatars'")).rows?.length >= 4, `(${rot}) as fotos existentes continuam legíveis pelo visitante`);
  ok((await d.query("select count(*)::int c from storage.objects where bucket_id = 'avatars' and name in ('ana/avatar.jpg','bia/avatar.jpg','gabi/avatar.jpg','ela/avatar.jpg','Ela/avatar.jpg','sem.joiner/avatar.jpg')")).rows[0].c >= 5, `(${rot}) fotos originais preservadas`);
}
fim();
