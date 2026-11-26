-- J1d — O E-MAIL E O @ DO CADASTRO SÓ VALEM PARA ATIVAR UMA CONTA SE NÃO FORAM TROCADOS DEPOIS DE UM MOMENTO CONHECIDO
-- Problema: hoje qualquer visitante troca o e-mail (e o @) de qualquer cadastro. A ativação confia no e-mail do cadastro; se ele foi trocado por quem quer tomar a conta,
--           receber o código nesse e-mail não prova que a pessoa é a dona dos pedidos, do CPF, do endereço nem do saldo.
-- O que faz (aditivo, nenhum dado de negócio é alterado ou apagado):
--   1) FOTOGRAFA (em emergencia.emails_confiaveis) o resumo (SHA-256) do e-mail e do @ de TODOS os cadastros neste instante. Não guarda o e-mail em claro.
--   2) ativar_minha_conta passa a recusar a ativação automática quando o e-mail/@ do cadastro NÃO é mais o da fotografia (ou o cadastro nasceu depois dela):
--      a pessoa vira um pedido em vinculos_pendentes (motivo 'email_alterado') e a administração confirma por um canal conhecido (WhatsApp / @).
--   3) Quem alterar e-mail/@ depois da fotografia NÃO atualiza a fotografia, EXCETO administradora ou servidor (admin_trocar_email_joiner, sync): o gatilho olha o papel da requisição.
--   4) Para joiners que JÁ TÊM CONTA (as 4 do piloto e as futuras): o e-mail e o @ do cadastro só podem ser alterados pela administradora ou pelo servidor.
--      Isso impede que alguém desligue "pedidos pelo e-mail" de uma conta ativada ou tente ativar uma segunda conta com o e-mail trocado.
-- Limite honesto: troca feita ANTES da fotografia não é detectável (o banco não guarda histórico). Por isso a fotografia é tirada o mais cedo possível, e o script
--   cadastros-121.mjs compara com a linha de base de 07/11. A fotografia reduz a janela; não prova que os e-mails antigos eram legítimos.
-- Pré-requisitos: J1 e J4d aplicados. Em uma transação com guardas; se algo falhar: "Nada foi alterado". Reversão: J1d_reverter_protegido.sql.
begin;

do $$
begin
  if to_regprocedure('public.ativar_minha_conta(text)') is null or to_regprocedure('public.ativacao_liberada(bigint)') is null then raise exception 'J1 e J4d não estão aplicados. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'public.is_admin() não existe. Nada foi alterado.'; end if;
  if to_regclass('emergencia.c0b_estado_anterior') is not null then
    if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J1d') then raise exception 'J1d já foi aplicado. Nada foi alterado.'; end if;
  end if;
end $$;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

-- (a) registro do estado anterior
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values
  ('J1d', 'funcao ativar_minha_conta', pg_get_functiondef('public.ativar_minha_conta(text)'::regprocedure)),
  ('J1d', 'constraint vinculos_pendentes_motivo_check', coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c where c.conname = 'vinculos_pendentes_motivo_check' and c.conrelid = 'public.vinculos_pendentes'::regclass), ''));

-- (b) a fotografia
create function emergencia.h(t text) returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(lower(btrim(coalesce(t, ''))), 'UTF8')), 'hex')
$$;
create function emergencia.h_arroba(t text) returns text language sql immutable set search_path = '' as $$
  select emergencia.h(ltrim(btrim(coalesce(t, '')), '@'))
$$;
create table emergencia.emails_confiaveis (
  joiner_id bigint primary key, email_hash text not null, arroba_hash text not null, registrado_em timestamptz not null default now(), origem text not null
);
alter table emergencia.emails_confiaveis enable row level security;
revoke all on table emergencia.emails_confiaveis from public, anon, authenticated;
insert into emergencia.emails_confiaveis (joiner_id, email_hash, arroba_hash, origem)
  select j.id, emergencia.h(j.email), emergencia.h_arroba(j.twitter), 'fotografia_inicial' from public.joiners j;

-- (c) quem mudou? o papel da REQUISIÇÃO (não o dono da função) decide se a mudança é confiável
create function emergencia.papel_confiavel() returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_papel text := coalesce(nullif(nullif(current_setting('role', true), 'none'), ''), '');
begin
  if v_papel = '' then
    begin v_papel := coalesce(nullif((current_setting('request.jwt.claims', true))::jsonb ->> 'role', ''), ''); exception when others then v_papel := ''; end;
  end if;
  return v_papel in ('service_role', 'postgres', 'supabase_admin', '') or (v_papel = 'authenticated' and (select public.is_admin()));
end $$;
revoke all on function emergencia.papel_confiavel() from public, anon, authenticated;

create function emergencia.joiners_antes_trocar_identidade() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.email is distinct from old.email or emergencia.h_arroba(new.twitter) is distinct from emergencia.h_arroba(old.twitter))
     and exists (select 1 from public.contas_joiner c where c.joiner_id = old.id)
     and not emergencia.papel_confiavel() then
    raise exception 'O e-mail e o @ de um cadastro com conta ativada só podem ser alterados pela administração.';
  end if;
  return new;
end $$;
revoke all on function emergencia.joiners_antes_trocar_identidade() from public, anon, authenticated;
create trigger joiners_antes_trocar_identidade before update of email, twitter on public.joiners for each row execute function emergencia.joiners_antes_trocar_identidade();

create function emergencia.joiners_depois_trocar_identidade() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if emergencia.papel_confiavel() then
    insert into emergencia.emails_confiaveis (joiner_id, email_hash, arroba_hash, origem)
      values (new.id, emergencia.h(new.email), emergencia.h_arroba(new.twitter), 'administracao_ou_servidor')
    on conflict (joiner_id) do update set email_hash = excluded.email_hash, arroba_hash = excluded.arroba_hash, registrado_em = now(), origem = excluded.origem;
  end if;
  return null;
end $$;
revoke all on function emergencia.joiners_depois_trocar_identidade() from public, anon, authenticated;
create trigger joiners_depois_trocar_identidade after insert or update of email, twitter on public.joiners for each row execute function emergencia.joiners_depois_trocar_identidade();

-- (d) novo motivo de pendência
alter table public.vinculos_pendentes drop constraint if exists vinculos_pendentes_motivo_check;
alter table public.vinculos_pendentes add constraint vinculos_pendentes_motivo_check
  check (motivo in ('cog_inexistente', 'cog_ambiguo', 'email_ausente', 'email_invalido', 'email_diferente', 'email_compartilhado', 'cog_ja_vinculado', 'email_alterado'));

-- (e) a ativação confere a fotografia (igual à do J4d, mais UMA condição)
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
    elsif not exists (select 1 from emergencia.emails_confiaveis t where t.joiner_id = v_j.id and t.email_hash = emergencia.h(v_j.email) and t.arroba_hash = emergencia.h_arroba(v_j.twitter)) then v_motivo := 'email_alterado';
    elsif exists (select 1 from public.contas_joiner c where c.joiner_id = v_j.id) then v_motivo := 'cog_ja_vinculado';
    end if;
  end if;

  if v_motivo is null then
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

-- (f) conferências antes do COMMIT
do $$
declare n_j bigint; n_t bigint; n_pend bigint;
begin
  select count(*) into n_j from public.joiners; select count(*) into n_t from emergencia.emails_confiaveis;
  if n_t <> n_j then raise exception 'A fotografia não cobre todos os cadastros (% de %). Transação desfeita.', n_t, n_j; end if;
  if has_function_privilege('anon', 'public.ativar_minha_conta(text)', 'EXECUTE') then raise exception 'O visitante executa ativar_minha_conta. Transação desfeita.'; end if;
  if has_schema_privilege('anon', 'emergencia', 'USAGE') or has_table_privilege('anon', 'emergencia.emails_confiaveis', 'SELECT') then raise exception 'O visitante alcança a fotografia. Transação desfeita.'; end if;
  if exists (select 1 from pg_proc p where p.oid = 'public.ativar_minha_conta(text)'::regprocedure and pg_get_functiondef(p.oid) !~ 'email_alterado') then raise exception 'ativar_minha_conta não foi atualizada. Transação desfeita.'; end if;
  select count(*) into n_pend from public.vinculos_pendentes;
  raise notice 'J1d aplicado: % cadastros fotografados; % pendências existentes preservadas. Nenhum dado de negócio foi alterado.', n_t, n_pend;
end $$;

commit;
