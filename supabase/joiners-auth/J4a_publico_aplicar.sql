-- J4a — PEÇAS PÚBLICAS SEGURAS (em vez de abrir a tabela joiners inteira)
-- ADITIVO: cria uma visão e funções novas; não altera nenhuma tabela, policy ou permissão existente.
--   * joiners_publico (visão): só as colunas realmente públicas — cog, nome_site, twitter, foto_perfil, recrutador. Nunca e-mail, CPF, endereço, telefone, WhatsApp, saldo, bloqueio.
--   * entrar_com_arroba(@): o "acesso simples". Devolve só a identidade mínima (cog, nome do site, foto) e se a conta já está ativada. Não aceita e-mail, não devolve dados pessoais,
--     e responde igual para @ inexistente ou ambíguo.
--   * meus_dados(): a linha COMPLETA da própria joiner (só para conta logada e vinculada).
--   * contar_recrutados(cog): número de pessoas recrutadas (agregado, sem identificar ninguém).
--   * cog_e_da_conta(texto): usada pelas policies para dizer se um COG gravado numa tabela é DA conta logada. Compara o COG EXATO; só aceita diferença de maiúsculas quando
--     nenhuma outra joiner tem o mesmo COG com outra caixa (assim 'Ela' e 'ela', pessoas diferentes, nunca enxergam os dados uma da outra).
-- Pré-requisito: J1 aplicado (contas_joiner, meu_joiner_id). Tudo em uma transação com registro e verificação antes do COMMIT.
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;

create table if not exists emergencia.c0b_estado_anterior (
  id            bigint generated always as identity primary key,
  registrado_em timestamptz not null default now(),
  etapa         text not null,
  objeto        text not null,
  detalhe       text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare n integer;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4a') then raise exception 'J4a já foi aplicada. Nada foi alterado.'; end if;
  if to_regclass('public.contas_joiner') is null or to_regprocedure('public.meu_joiner_id()') is null then raise exception 'O J1 não está aplicado. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.joiners'::regclass and attname in ('id', 'cog', 'nome_site', 'twitter', 'foto_perfil', 'recrutador') and not attisdropped;
  if n <> 6 then raise exception 'Esperava as colunas id, cog, nome_site, twitter, foto_perfil e recrutador em joiners (achei %). Nada foi alterado.', n; end if;
  if to_regclass('public.joiners_publico') is not null then raise exception 'joiners_publico já existe. Nada foi alterado.'; end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('J4a', 'joiners_publico, entrar_com_arroba, meus_dados, contar_recrutados, cog_e_da_conta', 'não existiam (criados pelo J4a)');

create view public.joiners_publico as
  select j.cog, j.nome_site, j.twitter, j.foto_perfil, j.recrutador from public.joiners j;
revoke all on public.joiners_publico from public, anon, authenticated;
grant select on public.joiners_publico to anon, authenticated;
grant select on public.joiners_publico to service_role;

create function public.entrar_com_arroba(p_identificador text)
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
                            'conta_ativa', exists (select 1 from public.contas_joiner c where c.joiner_id = v_j.id));
end $$;
revoke all on function public.entrar_com_arroba(text) from public;
grant execute on function public.entrar_com_arroba(text) to anon, authenticated, service_role;

create function public.meus_dados()
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(j.*) from public.joiners j where j.id = public.meu_joiner_id()
$$;
revoke all on function public.meus_dados() from public, anon;
grant execute on function public.meus_dados() to authenticated, service_role;

create function public.contar_recrutados(p_cog text)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.joiners j where lower(trim(j.recrutador)) = lower(trim(coalesce(p_cog, '')))
$$;
revoke all on function public.contar_recrutados(text) from public;
grant execute on function public.contar_recrutados(text) to anon, authenticated, service_role;

create function public.cog_e_da_conta(p_cog text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_cog is null or public.meu_cog() is null then false
    when btrim(p_cog) = btrim(public.meu_cog()) then true
    when lower(btrim(p_cog)) = lower(btrim(public.meu_cog())) then
      not exists (select 1 from public.joiners j where lower(btrim(j.cog)) = lower(btrim(public.meu_cog())) and j.id <> public.meu_joiner_id())
    else false end
$$;
revoke all on function public.cog_e_da_conta(text) from public, anon;
grant execute on function public.cog_e_da_conta(text) to authenticated, service_role;

do $$
declare n integer;
begin
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'joiners_publico';
  if n <> 5 then raise exception 'A visão pública deveria ter 5 colunas e tem %. Transação desfeita.', n; end if;
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'joiners_publico' and column_name ~* '(email|cpf|whats|telefone|cep|rua|bairro|cidade|numero|saldo|bloque|nome_entrega|^nome$)';
  if n > 0 then raise exception 'A visão pública expõe coluna sensível. Transação desfeita.'; end if;
  select count(*) into n from pg_proc p where p.oid in ('public.entrar_com_arroba(text)'::regprocedure, 'public.meus_dados()'::regprocedure, 'public.contar_recrutados(text)'::regprocedure, 'public.cog_e_da_conta(text)'::regprocedure)
     and (not p.prosecdef or p.proconfig is distinct from array['search_path=""']);
  if n > 0 then raise exception 'Função sem security definer / search_path vazio. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.meus_dados()', 'EXECUTE') then raise exception 'anon pode executar meus_dados(). Transação desfeita.'; end if;
  if not has_function_privilege('anon', 'public.entrar_com_arroba(text)', 'EXECUTE') then raise exception 'anon não pode executar entrar_com_arroba(). Transação desfeita.'; end if;
end $$;

commit;
