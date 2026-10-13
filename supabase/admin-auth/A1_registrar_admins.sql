-- A1 — CADASTRAR VÁRIOS ADMINS DE UMA VEZ (rode no SQL Editor, depois de criar os usuários no painel do Supabase)
-- Pré-requisito: Authentication > Users > Add user > Create new user, para cada pessoa, com e-mail, senha longa e "Auto Confirm User" marcado.
-- Troque os e-mails de exemplo pelos reais (mantendo aspas simples e vírgulas). NÃO guarde e-mails reais neste arquivo do repositório (ele é público).
-- Todos ou nenhum: se algum e-mail não existir em auth.users, ou se houver e-mail repetido na lista, nada é cadastrado.
begin;

do $$
declare
  v_emails text[] := array[
    'admin1@exemplo.com',
    'admin2@exemplo.com',
    'admin3@exemplo.com'
  ];
  v_email text;
  v_faltando text[] := '{}';
  v_cadastrados integer;
begin
  foreach v_email in array v_emails loop
    if not exists (select 1 from auth.users where lower(email) = lower(trim(v_email))) then
      v_faltando := v_faltando || trim(v_email);
    end if;
  end loop;
  if array_length(v_faltando, 1) is not null then
    raise exception 'Estes e-mails não existem em auth.users: %. Nada foi cadastrado.', array_to_string(v_faltando, ', ');
  end if;

  insert into public.admin_roles (user_id)
  select u.id from auth.users u
   where lower(u.email) in (select lower(trim(x)) from unnest(v_emails) x)
  on conflict (user_id) do nothing;

  select count(*) into v_cadastrados from public.admin_roles r
   join auth.users u on u.id = r.user_id
   where lower(u.email) in (select lower(trim(x)) from unnest(v_emails) x);
  if v_cadastrados <> cardinality(v_emails) then
    raise exception 'Esperava % admins e há % (e-mail repetido na lista?). Nada foi cadastrado.', cardinality(v_emails), v_cadastrados;
  end if;
  raise notice 'Admins cadastrados: %', v_cadastrados;
end $$;

commit;

-- Conferir quem são os admins:
-- select u.email, r.papel, r.criado_em from public.admin_roles r join auth.users u on u.id = r.user_id order by r.criado_em;
