-- C0-B6 — VERIFICAÇÃO (somente leitura, sem dados pessoais).
-- Esperado: 0 policies alcançando o anti-store; "allow upload" excluindo o anti-store; arquivos = número registrado antes;
--           as 5 policies antigas ausentes; policies dos outros buckets presentes.
select 'policies que alcançam o anti-store' as item,
       (select count(*) from pg_policies p
         where p.schemaname = 'storage' and p.tablename = 'objects' and p.permissive = 'PERMISSIVE'
           and not (p.policyname = 'allow upload' and p.with_check ilike '%bucket_id <> ''anti-store''%')
           and exists (select 1 from unnest(p.roles) r where case when r = 'public' then true else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end)
           and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') !~* 'bucket_id'
                or coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ilike '%anti-store%'
                or coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ~* '(<>|!=|\mnot\M)'))::text as valor
union all select 'policies antigas do anti-store ainda existentes (esperado 0)',
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
         and policyname in ('allow-anon pt8eye_0', 'allow-anon pt8eye_1', 'allow-anon pt8eye_2', 'allow-anon pt8eye_3', 'Public downloads (restricted)'))::text
union all select '"allow upload" agora exclui o anti-store (esperado 1)',
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'allow upload'
         and with_check ilike '%bucket_id <> ''anti-store''%')::text
union all select 'policies de outros buckets presentes (esperado 6)',
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
         and policyname in ('anon upload comprovante', 'comprovantes upload', 'joiner upload comprovante', 'leitura publica fotos-itens', 'public read avatars', 'allow select storage-itens'))::text
union all select 'arquivos no bucket anti-store (igual ao registrado antes)',
       (select count(*) from storage.objects where bucket_id = 'anti-store')::text || ' | antes: ' ||
       coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'B6' and objeto = 'arquivos no bucket anti-store'), 'sem registro')
union all select 'estado anterior registrado (linhas B6)',
       (select count(*) from emergencia.c0b_estado_anterior where etapa = 'B6')::text;
