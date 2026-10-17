-- AV1 — VERIFICADOR (somente leitura). Esperado, nesta ordem:
--   1 bucket: public=true, limite 262144, tipos {image/jpeg}   |  2 policies novas = 4   |  3 policies de escrita sem filtro alcançando avatars = 0
--   4 policies antigas de avatars remanescentes = 0            |  5 fotos antes = depois (true)  |  6 AV1 registrado = true  |  7 "allow upload" não alcança avatars = true
select 1 as ordem, 'bucket avatars: público | limite | tipos (esperado true | 262144 | {image/jpeg})' as item,
       (select public::text || ' | ' || coalesce(file_size_limit::text, 'sem limite') || ' | ' || coalesce(allowed_mime_types::text, 'qualquer') from storage.buckets where id = 'avatars') as valor
union all
select 2, 'policies avatars_ver/enviar/trocar/apagar (esperado 4)',
       (select count(*)::text from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('avatars_ver', 'avatars_enviar', 'avatars_trocar', 'avatars_apagar'))
union all
select 3, 'policies de ESCRITA que alcançam avatars sem o filtro de caminho (esperado 0)',
       (select count(*)::text from pg_policies p
         where p.schemaname = 'storage' and p.tablename = 'objects' and p.permissive = 'PERMISSIVE' and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
           and p.policyname not in ('avatars_enviar', 'avatars_trocar', 'avatars_apagar')
           and exists (select 1 from unnest(p.roles) r where case when r = 'public' then true else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end)
           and ((coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) like '%bucket_id = ''avatars''%'
                or (p.cmd = 'INSERT' and coalesce(p.with_check, '') !~ 'bucket_id = ''' and coalesce(p.with_check, '') !~ 'avatars')
                or (p.cmd in ('UPDATE', 'DELETE', 'ALL') and coalesce(p.qual, '') !~ 'bucket_id')))
union all
select 4, 'policies antigas de avatars que deviam ter saído (esperado 0)',
       (select count(*)::text from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('anon upload avatars', 'allow anon upload', 'anon update avatars', 'allow anon update', 'anon delete avatars', 'allow anon select', 'public read avatars', '<policy_name>'))
union all
select 5, 'fotos: antes | agora (esperado iguais)',
       coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'AV1' and objeto = 'fotos avatars'), '(AV1 não registrado)') || ' | ' ||
       (select 'quantidade=' || count(*) || ' md5=' || md5(coalesce(string_agg(name, ',' order by name), '')) from storage.objects where bucket_id = 'avatars')
union all
select 6, 'AV1 registrado em emergencia.c0b_estado_anterior (esperado true)',
       exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'AV1')::text
union all
select 7, 'a policy "allow upload" exclui avatars e anti-store (esperado true)',
       (select (with_check like '%avatars%' and with_check like '%anti-store%')::text from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'allow upload')
order by 1;
