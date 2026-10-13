-- A2 — ADMIN SÓ COM SENHA: is_admin() deixa de exigir a verificação em duas etapas (MFA/aal2)
-- Decisão da administração: o acesso ao painel é feito com e-mail e senha da conta de admin, sem app autenticador.
-- A função continua verdadeira SOMENTE para quem está cadastrado em admin_roles E tem sessão válida de login (usuário autenticado).
-- Anônimo, usuário comum e quem não está na lista continuam falsos. Nenhuma tabela é aberta ou fechada por este script
-- (hoje nenhuma policy usa is_admin()). Reversão protegida em A2_reverter_protegido.sql (volta a exigir aal2).
-- Tudo em uma transação com registro e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

do $$
declare v_def text;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'A2') then
    raise exception 'A2 já foi aplicada: o registro já existe e não será sobrescrito.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'A1') then
    raise exception 'O A1 não está aplicado (sem registro). Nada foi alterado.';
  end if;
  if to_regclass('public.admin_roles') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'admin_roles / is_admin() não existem. Nada foi alterado.';
  end if;
  v_def := pg_get_functiondef('public.is_admin()'::regprocedure);
  if v_def not ilike '%aal2%' then
    raise exception 'is_admin() não exige aal2 hoje (definição inesperada). Nada foi alterado.';
  end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'A2', 'definição anterior de public.is_admin()', pg_get_functiondef('public.is_admin()'::regprocedure);

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'A2', 'admins cadastrados', 'quantidade=' || count(*) from public.admin_roles;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = (select auth.uid())
  )
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

do $$
declare n integer; v_antes text; v_depois text;
begin
  if pg_get_functiondef('public.is_admin()'::regprocedure) ilike '%aal%' then
    raise exception 'is_admin() ainda menciona aal. Transação desfeita.';
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.is_admin()'::regprocedure) then
    raise exception 'is_admin() não é SECURITY DEFINER. Transação desfeita.';
  end if;
  if (select proconfig from pg_proc where oid = 'public.is_admin()'::regprocedure) is distinct from array['search_path=""'] then
    raise exception 'is_admin() sem search_path vazio. Transação desfeita.';
  end if;
  if not (has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') and has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')) then
    raise exception 'anon/authenticated não podem executar is_admin(). Transação desfeita.';
  end if;
  select count(*) into n from (values ('anon'), ('authenticated')) as r(rolname)
   where has_table_privilege(r.rolname, 'public.admin_roles', 'SELECT') or has_table_privilege(r.rolname, 'public.admin_roles', 'INSERT')
      or has_table_privilege(r.rolname, 'public.admin_roles', 'UPDATE') or has_table_privilege(r.rolname, 'public.admin_roles', 'DELETE');
  if n > 0 then raise exception 'anon/authenticated ganharam acesso a admin_roles. Transação desfeita.'; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'A2' and objeto = 'admins cadastrados';
  select 'quantidade=' || count(*) into v_depois from public.admin_roles;
  if v_antes is distinct from v_depois then raise exception 'A lista de admins mudou durante o script (% -> %). Transação desfeita.', v_antes, v_depois; end if;
end $$;

commit;
