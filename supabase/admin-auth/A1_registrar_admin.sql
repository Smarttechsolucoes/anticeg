-- A1 — CADASTRAR UM ADMIN (rode no SQL Editor, depois de criar o usuário no painel do Supabase)
-- Pré-requisito: Authentication > Users > Add user > Create new user, com e-mail e senha longa e "Auto Confirm User" marcado.
-- Troque o e-mail abaixo pelo e-mail EXATO do usuário criado. Se o e-mail não existir, nada é cadastrado e o script avisa.
begin;

do $$
declare
  v_email text := 'TROQUE-AQUI@exemplo.com';   -- << e-mail do usuário criado no painel
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then raise exception 'Nenhum usuário com o e-mail % em auth.users. Nada foi cadastrado.', v_email; end if;
  insert into public.admin_roles (user_id) values (v_id) on conflict (user_id) do nothing;
  raise notice 'Admin cadastrado (ou já existia): %', v_email;
end $$;

commit;
