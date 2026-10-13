-- C0-B5 — VERIFICAÇÃO (somente leitura, sem dados pessoais).
-- Esperado: policies de leitura (SELECT/ALL) que alcançam o bucket comprovantes = 0; policies de INSERT para o bucket >= 1;
--           arquivos no bucket = o número registrado antes; policy "comprovantes read" ausente.
select 'policies de LEITURA que alcançam comprovantes' as item,
       (select count(*) from pg_policies p
         where p.schemaname = 'storage' and p.tablename = 'objects' and p.permissive = 'PERMISSIVE' and p.cmd in ('SELECT', 'ALL')
           and exists (select 1 from unnest(p.roles) r where case when r = 'public' then true else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end)
           and (p.qual is null or p.qual !~* 'bucket_id' or p.qual ilike '%comprovantes%'))::text as valor
union all select 'policy "comprovantes read" existe',
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'comprovantes read')::text
union all select 'policies de INSERT que servem ao bucket comprovantes',
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT', 'ALL') and permissive = 'PERMISSIVE'
           and (with_check ilike '%comprovantes%' or with_check = 'true'))::text
union all select 'policies de UPDATE/DELETE que alcançam comprovantes (esperado 0)',
       (select count(*) from pg_policies p
         where p.schemaname = 'storage' and p.tablename = 'objects' and p.permissive = 'PERMISSIVE' and p.cmd in ('UPDATE', 'DELETE', 'ALL')
           and exists (select 1 from unnest(p.roles) r where case when r = 'public' then true else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end)
           and (p.qual is null or p.qual !~* 'bucket_id' or p.qual ilike '%comprovantes%'))::text
union all select 'arquivos no bucket comprovantes (igual ao registrado antes)',
       (select count(*) from storage.objects where bucket_id = 'comprovantes')::text || ' | antes: ' ||
       coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'B5' and objeto = 'arquivos no bucket comprovantes'), 'sem registro')
union all select 'estado anterior registrado (linhas B5)',
       (select count(*) from emergencia.c0b_estado_anterior where etapa = 'B5')::text;
