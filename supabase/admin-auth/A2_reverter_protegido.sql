-- A2 — REVERSÃO PROTEGIDA: is_admin() volta a exigir a verificação em duas etapas (aal2).
-- Atenção: depois de reverter, o admin só passa com MFA ativo (o site atual não oferece o cadastro do app autenticador).
-- Nada reverte sozinho. Para executar é preciso digitar, na variável abaixo, a frase exata de autorização.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO EXIGIR MFA DE NOVO
begin
  if confirmacao is distinct from 'AUTORIZO EXIGIR MFA DE NOVO' then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Os admins ficariam sem acesso até cadastrarem o app autenticador.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'A2') then
    raise exception 'Não há registro do A2.';
  end if;
end $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = (select auth.uid())
      and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  )
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

update emergencia.c0b_estado_anterior set etapa = 'A2-revertido' where etapa = 'A2';

do $$ begin raise notice 'Reversão do A2 feita: is_admin() voltou a exigir aal2 (MFA).'; end $$;

commit;
