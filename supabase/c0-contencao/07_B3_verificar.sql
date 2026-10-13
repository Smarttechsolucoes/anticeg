-- C0-B3 — VERIFICAÇÃO (somente leitura).
-- Esperado: anon e authenticated com INSERT/UPDATE/DELETE (tabela e coluna) = false e SELECT = true;
--           service_role com tudo = true; nenhuma policy permissiva de escrita; gatilho habilitado.
select 'anon: INSERT/UPDATE/DELETE/TRUNCATE (tabela ou coluna)' as item,
       (has_table_privilege('anon', 'public.multas_pagas', 'INSERT') or has_table_privilege('anon', 'public.multas_pagas', 'UPDATE')
        or has_table_privilege('anon', 'public.multas_pagas', 'DELETE') or has_table_privilege('anon', 'public.multas_pagas', 'TRUNCATE')
        or has_any_column_privilege('anon', 'public.multas_pagas', 'INSERT') or has_any_column_privilege('anon', 'public.multas_pagas', 'UPDATE'))::text as valor
union all select 'authenticated: INSERT/UPDATE/DELETE/TRUNCATE (tabela ou coluna)',
       (has_table_privilege('authenticated', 'public.multas_pagas', 'INSERT') or has_table_privilege('authenticated', 'public.multas_pagas', 'UPDATE')
        or has_table_privilege('authenticated', 'public.multas_pagas', 'DELETE') or has_table_privilege('authenticated', 'public.multas_pagas', 'TRUNCATE')
        or has_any_column_privilege('authenticated', 'public.multas_pagas', 'INSERT') or has_any_column_privilege('authenticated', 'public.multas_pagas', 'UPDATE'))::text
union all select 'anon SELECT', has_table_privilege('anon', 'public.multas_pagas', 'SELECT')::text
union all select 'authenticated SELECT', has_table_privilege('authenticated', 'public.multas_pagas', 'SELECT')::text
union all select 'service_role INSERT/UPDATE/DELETE/SELECT',
       (has_table_privilege('service_role', 'public.multas_pagas', 'INSERT') and has_table_privilege('service_role', 'public.multas_pagas', 'UPDATE')
        and has_table_privilege('service_role', 'public.multas_pagas', 'DELETE') and has_table_privilege('service_role', 'public.multas_pagas', 'SELECT'))::text
union all select 'policies permissivas de escrita aplicáveis a anon/authenticated',
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = 'multas_pagas' and p.permissive = 'PERMISSIVE' and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
           and exists (select 1 from unnest(p.roles) r where case when r = 'public' then true else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end))::text
union all select 'gatilho trg_registrar_multa_paga habilitado',
       (select count(*) from pg_trigger t where t.tgrelid = 'public.masterlist'::regclass and t.tgname = 'trg_registrar_multa_paga' and t.tgenabled = 'O')::text
union all select 'estado anterior registrado (linhas B3)',
       (select count(*) from emergencia.c0b_estado_anterior where etapa = 'B3')::text;
