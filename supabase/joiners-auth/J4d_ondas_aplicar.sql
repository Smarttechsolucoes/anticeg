-- J4d — ATIVAÇÃO EM ONDAS (liberar a criação de senha por grupos, controlado pelo SERVIDOR)
-- Por que existe: o RLS do lançamento afeta todas as joiners, mas a ATIVAÇÃO (criar a senha) precisa ser liberada aos poucos. Este passo cria a lista de ondas e faz o servidor recusar a ativação de quem
-- ainda não foi liberada, SEM reabrir nenhuma permissão e SEM tocar em quem já ativou:
--   * quem já tem conta vinculada continua exatamente como está (a senha e a sessão não mudam; liberar uma nova onda não mexe em nenhuma conta);
--   * quem ainda não foi liberada fica no MODO LIMITADO (só com @) e vê "sua ativação será liberada em breve";
--   * a liberação é um número: ativacao_estado.onda_liberada (ex.: 1 = só a onda 1; 2 = ondas 1 e 2...) ou liberar_todas = true para o lançamento geral.
-- Mudanças (todas no servidor): tabelas ativacao_ondas e ativacao_estado (ninguém além do servidor lê ou escreve), função ativacao_liberada(), ativar_minha_conta() passa a conferir a liberação e
-- entrar_com_arroba() passa a informar, junto com o @, se a ativação já foi liberada (a única informação nova que o visitante recebe; não identifica ninguém além do @ que ele mesmo digitou).
-- Também amplia o controle de tentativas para o tipo 'ativacao' (pedido de código).
-- ADITIVO: depois do J1, J3 e J4a. Estado inicial = NINGUÉM liberada (nada muda para as joiners até a administradora liberar uma onda; o site de hoje nem usa este caminho).
-- Tudo em uma transação com registro do estado anterior e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4d') then raise exception 'J4d já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.ativar_minha_conta(text)') is null or to_regclass('public.contas_joiner') is null then raise exception 'O J1 não está aplicado. Nada foi alterado.'; end if;
  if to_regclass('public.tentativas_acesso') is null then raise exception 'O J3 não está aplicado (falta tentativas_acesso). Nada foi alterado.'; end if;
  if to_regprocedure('public.entrar_com_arroba(text)') is null then raise exception 'O J4a não está aplicado (falta entrar_com_arroba). Nada foi alterado.'; end if;
  if to_regclass('public.ativacao_ondas') is not null or to_regclass('public.ativacao_estado') is not null or to_regprocedure('public.ativacao_liberada(bigint)') is not null then raise exception 'Objetos do J4d já existem. Nada foi alterado.'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.tentativas_acesso'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%recuperar%') then raise exception 'A trava de tipo de tentativas_acesso não é a esperada. Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR: definição exata das duas funções que serão substituídas e da trava de tipo
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values
  ('J4d', 'funcao ativar_minha_conta', pg_get_functiondef('public.ativar_minha_conta(text)'::regprocedure)),
  ('J4d', 'funcao entrar_com_arroba', pg_get_functiondef('public.entrar_com_arroba(text)'::regprocedure));
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4d', 'trava tentativas_acesso ' || conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.tentativas_acesso'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%recuperar%';

-- 1) a lista de ondas e o estado da liberação (só o servidor e a administradora pelo SQL Editor mexem)
create table public.ativacao_ondas (
  joiner_id bigint primary key references public.joiners (id) on delete cascade,
  onda integer not null check (onda >= 1),
  criado_em timestamptz not null default now()
);
create table public.ativacao_estado (
  id boolean primary key default true check (id),            -- uma única linha
  onda_liberada integer not null default 0 check (onda_liberada >= 0),
  liberar_todas boolean not null default false,
  atualizado_em timestamptz not null default now()
);
insert into public.ativacao_estado (id) values (true);
alter table public.ativacao_ondas enable row level security;
alter table public.ativacao_estado enable row level security;
revoke all on table public.ativacao_ondas, public.ativacao_estado from public, anon, authenticated;
grant select on table public.ativacao_ondas, public.ativacao_estado to service_role;

create function public.ativacao_liberada(p_joiner_id bigint) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select e.liberar_todas or exists (select 1 from public.ativacao_ondas o where o.joiner_id = p_joiner_id and o.onda <= e.onda_liberada)
                     from public.ativacao_estado e where e.id), false)
$$;
revoke all on function public.ativacao_liberada(bigint) from public, anon, authenticated;
grant execute on function public.ativacao_liberada(bigint) to service_role;

-- 2) o pedido de código também tem limite de tentativas
alter table public.tentativas_acesso drop constraint tentativas_acesso_tipo_check;
alter table public.tentativas_acesso add constraint tentativas_acesso_tipo_check check (tipo in ('login', 'recuperar', 'ativacao'));

-- 3) ativar_minha_conta: igual ao J1, mais a conferência da liberação (quem já tem conta continua passando direto)
create or replace function public.ativar_minha_conta(p_cog text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text; v_confirmado timestamptz;
  v_cog text := lower(trim(both from regexp_replace(coalesce(p_cog, ''), '^\s*@+', '')));
  v_n integer; v_j record; v_motivo text; v_candidato bigint;
begin
  if v_uid is null then return jsonb_build_object('status', 'nao_autenticado'); end if;
  select lower(trim(u.email)), u.email_confirmed_at into v_email, v_confirmado from auth.users u where u.id = v_uid;
  if v_email is null or v_confirmado is null then return jsonb_build_object('status', 'email_nao_verificado'); end if;

  if exists (select 1 from public.contas_joiner c where c.user_id = v_uid) then return jsonb_build_object('status', 'ok'); end if;

  if v_cog = '' or length(v_cog) > 64 then return jsonb_build_object('status', 'pendente'); end if;

  select count(*) into v_n from public.joiners j where lower(trim(j.cog)) = v_cog;
  if v_n = 0 then v_motivo := 'cog_inexistente';
  elsif v_n > 1 then v_motivo := 'cog_ambiguo';
  else
    select * into v_j from public.joiners j where lower(trim(j.cog)) = v_cog;
    v_candidato := v_j.id;
    if coalesce(trim(v_j.email), '') = '' then v_motivo := 'email_ausente';
    elsif lower(trim(v_j.email)) !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then v_motivo := 'email_invalido';
    elsif lower(trim(v_j.email)) <> v_email then v_motivo := 'email_diferente';
    elsif (select count(*) from public.joiners j2 where lower(trim(j2.email)) = v_email) > 1 then v_motivo := 'email_compartilhado';
    elsif exists (select 1 from public.contas_joiner c where c.joiner_id = v_j.id) then v_motivo := 'cog_ja_vinculado';
    end if;
  end if;

  if v_motivo is null then
    -- J4d: a ativação só vale para quem já foi liberada; as demais seguem no modo limitado (nada é gravado e nenhum pedido pendente é criado)
    if not public.ativacao_liberada(v_j.id) then return jsonb_build_object('status', 'aguardando_liberacao'); end if;
    begin
      insert into public.contas_joiner (user_id, joiner_id, origem) values (v_uid, v_j.id, 'email_verificado');
      return jsonb_build_object('status', 'ok');
    exception when unique_violation then
      v_motivo := 'cog_ja_vinculado';
    end;
  end if;

  insert into public.vinculos_pendentes (user_id, cog_pedido, joiner_id_candidato, motivo) values (v_uid, left(v_cog, 64), v_candidato, v_motivo)
  on conflict (user_id) where status = 'aberto'
  do update set cog_pedido = excluded.cog_pedido, joiner_id_candidato = excluded.joiner_id_candidato, motivo = excluded.motivo, criado_em = now();
  return jsonb_build_object('status', 'pendente');
end $$;
revoke all on function public.ativar_minha_conta(text) from public, anon;
grant execute on function public.ativar_minha_conta(text) to authenticated, service_role;

-- 4) entrar_com_arroba: igual ao J4a, mais a informação "ativação liberada" (para o site mostrar o convite ou o aviso de espera)
create or replace function public.entrar_com_arroba(p_identificador text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_h text := lower(trim(both from regexp_replace(coalesce(p_identificador, ''), '^\s*@+', ''))); v_n integer; v_j record;
begin
  if v_h = '' or length(v_h) > 64 or v_h ~ '[\s@]' then return jsonb_build_object('encontrado', false); end if;
  select count(*) into v_n from public.joiners j where lower(trim(j.cog)) = v_h or lower(regexp_replace(coalesce(j.twitter, ''), '^\s*@+', '')) = v_h;
  if v_n <> 1 then return jsonb_build_object('encontrado', false); end if;
  select j.id, j.cog, j.nome_site, j.foto_perfil, coalesce(j.bloqueado, false) as bloqueado into v_j
    from public.joiners j where lower(trim(j.cog)) = v_h or lower(regexp_replace(coalesce(j.twitter, ''), '^\s*@+', '')) = v_h;
  if v_j.bloqueado then return jsonb_build_object('encontrado', false); end if;
  return jsonb_build_object('encontrado', true, 'cog', v_j.cog, 'nome_site', v_j.nome_site, 'foto_perfil', v_j.foto_perfil,
                            'conta_ativa', exists (select 1 from public.contas_joiner c where c.joiner_id = v_j.id),
                            'ativacao_liberada', public.ativacao_liberada(v_j.id));
end $$;
revoke all on function public.entrar_com_arroba(text) from public;
grant execute on function public.entrar_com_arroba(text) to anon, authenticated, service_role;

-- 5) conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer;
begin
  if has_table_privilege('anon', 'public.ativacao_ondas', 'SELECT') or has_table_privilege('authenticated', 'public.ativacao_ondas', 'SELECT') or has_table_privilege('anon', 'public.ativacao_estado', 'SELECT') or has_table_privilege('authenticated', 'public.ativacao_estado', 'SELECT')
     or has_table_privilege('anon', 'public.ativacao_ondas', 'INSERT') or has_table_privilege('authenticated', 'public.ativacao_estado', 'UPDATE') then raise exception 'As tabelas de ondas estão abertas a visitante ou joiner. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.ativacao_liberada(bigint)', 'EXECUTE') or has_function_privilege('authenticated', 'public.ativacao_liberada(bigint)', 'EXECUTE') then raise exception 'ativacao_liberada está aberta. Transação desfeita.'; end if;
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('ativacao_liberada', 'ativar_minha_conta', 'entrar_com_arroba') and p.prosecdef and p.proconfig = array['search_path=""'];
  if n <> 3 then raise exception 'As funções do J4d não estão todas com security definer e search_path vazio. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.ativar_minha_conta(text)', 'EXECUTE') then raise exception 'O visitante executa ativar_minha_conta. Transação desfeita.'; end if;
  if (select onda_liberada from public.ativacao_estado) <> 0 or (select liberar_todas from public.ativacao_estado) then raise exception 'O estado inicial não é "ninguém liberada". Transação desfeita.'; end if;
end $$;

commit;
