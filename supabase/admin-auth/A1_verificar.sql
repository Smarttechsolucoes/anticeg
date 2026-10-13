-- A1 — VERIFICAÇÃO (somente leitura). Mostra apenas e-mails dos admins cadastrados (dados da própria dona do projeto).
-- Esperado: tabela existe com RLS ligado; anon/authenticated sem nenhum acesso; is_admin() security definer com search_path vazio,
--           executável por anon/authenticated; estado registrado (2 linhas).
select 'admin_roles existe, RLS ligado' as item,
       coalesce((select relrowsecurity::text from pg_class where oid = to_regclass('public.admin_roles')), 'não existe') as valor
union all select 'anon/authenticated com algum acesso a admin_roles (esperado false)',
       (has_table_privilege('anon', 'public.admin_roles', 'SELECT') or has_table_privilege('authenticated', 'public.admin_roles', 'SELECT')
        or has_table_privilege('anon', 'public.admin_roles', 'INSERT') or has_table_privilege('authenticated', 'public.admin_roles', 'INSERT')
        or has_table_privilege('anon', 'public.admin_roles', 'UPDATE') or has_table_privilege('authenticated', 'public.admin_roles', 'UPDATE')
        or has_table_privilege('anon', 'public.admin_roles', 'DELETE') or has_table_privilege('authenticated', 'public.admin_roles', 'DELETE'))::text
union all select 'policies em admin_roles (esperado 0)',
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'admin_roles')::text
union all select 'is_admin(): security definer | search_path',
       (select p.prosecdef::text || ' | ' || coalesce(p.proconfig::text, 'sem config') from pg_proc p where p.oid = to_regprocedure('public.is_admin()'))
union all select 'is_admin() executável por anon e authenticated (esperado true)',
       (has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') and has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE'))::text
union all select 'admins cadastrados',
       (select count(*) from public.admin_roles)::text
union all select 'estado registrado (linhas A1)',
       (select count(*) from emergencia.c0b_estado_anterior where etapa = 'A1')::text;

-- Quem são os admins (rode separado depois de cadastrar):
-- select u.email, r.papel, r.criado_em from public.admin_roles r join auth.users u on u.id = r.user_id order by r.criado_em;
