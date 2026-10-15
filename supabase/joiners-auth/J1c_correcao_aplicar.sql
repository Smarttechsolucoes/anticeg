-- J1c — CORREÇÃO do J1 JÁ INSTALADO (não reinstala nada; não toca em tabelas, vínculos, contas nem na tabela joiners).
-- Duas mudanças, só em funções:
--   1) ativar_minha_conta: tira a execução de QUALQUER usuário logado (fica só o servidor) até o J4d, que traz a conferência das ondas e reabre a execução.
--      Sem isto, durante a janela entre o J1 e o J4d, uma conta preexistente do Auth com e-mail confirmado igual ao cadastro poderia se vincular.
--   2) as 4 funções de administração passam a negar também quando is_admin() devolve NULL: (select public.is_admin()) is not true.
-- Tudo em uma transação, com o texto anterior das funções guardado em emergencia.c0b_estado_anterior (etapa J1c). Qualquer guarda que falhe: "Nada foi alterado".
begin;

do $$
declare n integer;
begin
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J1') then raise exception 'O J1 não está registrado. Nada foi alterado.'; end if;
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J1c') then raise exception 'J1c já foi aplicada. Nada foi alterado.'; end if;
  if to_regclass('public.contas_joiner') is null or to_regclass('public.vinculos_pendentes') is null then raise exception 'Tabelas do J1 ausentes. Nada foi alterado.'; end if;
  select count(*) into n from (values (to_regprocedure('public.ativar_minha_conta(text)')), (to_regprocedure('public.admin_vinculos_pendentes()')), (to_regprocedure('public.admin_buscar_joiners(text)')), (to_regprocedure('public.admin_resolver_vinculo(bigint, boolean, bigint)')), (to_regprocedure('public.admin_desvincular_conta(uuid)'))) t(o) where o is null;
  if n > 0 then raise exception 'Alguma função do J1 não existe. Nada foi alterado.'; end if;
  if exists (select 1 from pg_proc where oid = to_regprocedure('public.ativacao_liberada(bigint)')) then raise exception 'O J4d já está aplicado: esta correção não se aplica. Nada foi alterado.'; end if;
end $$;

-- guarda o texto anterior das 5 funções (para desfazer, se um dia precisar)
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J1c', 'funcao ' || p.oid::regprocedure::text, pg_get_functiondef(p.oid)
  from pg_proc p where p.oid in ('public.ativar_minha_conta(text)'::regprocedure, 'public.admin_vinculos_pendentes()'::regprocedure, 'public.admin_buscar_joiners(text)'::regprocedure, 'public.admin_resolver_vinculo(bigint, boolean, bigint)'::regprocedure, 'public.admin_desvincular_conta(uuid)'::regprocedure);

-- ── 1) ativação fechada para usuário logado até o J4d ─────────────────────────────────────────
revoke all on function public.ativar_minha_conta(text) from public, anon, authenticated;
grant execute on function public.ativar_minha_conta(text) to service_role;

-- ── 2) funções de administração: is_admin() NULL também é negado ──────────────────────────────
-- (funções de administração)
create or replace function public.admin_vinculos_pendentes()
returns table (id bigint, email_da_conta text, cog_pedido text, joiner_id_candidato bigint, motivo text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select public.is_admin()) is not true then raise exception 'sem permissão'; end if;
  return query
    select p.id, u.email::text, p.cog_pedido, p.joiner_id_candidato, p.motivo, p.criado_em
      from public.vinculos_pendentes p join auth.users u on u.id = p.user_id
     where p.status = 'aberto' order by p.criado_em;
end $$;
revoke all on function public.admin_vinculos_pendentes() from public, anon;
grant execute on function public.admin_vinculos_pendentes() to authenticated, service_role;

-- a administradora procura a joiner certa (por COG, nome do site ou @) e vê o id para decidir os casos repetidos
create or replace function public.admin_buscar_joiners(p_termo text)
returns table (id bigint, cog text, nome_site text, twitter text, email text, conta_vinculada boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_t text := regexp_replace(lower(trim(coalesce(p_termo, ''))), '^@+', '');
begin
  if (select public.is_admin()) is not true then raise exception 'sem permissão'; end if;
  if length(v_t) < 2 then return; end if;
  return query
    select j.id, j.cog::text, j.nome_site::text, j.twitter::text, j.email::text, exists (select 1 from public.contas_joiner c where c.joiner_id = j.id)
      from public.joiners j
     where lower(j.cog) like '%' || replace(replace(v_t, '%', ''), '_', '') || '%' or lower(coalesce(j.nome_site, '')) like '%' || replace(replace(v_t, '%', ''), '_', '') || '%'
        or lower(coalesce(j.twitter, '')) like '%' || replace(replace(v_t, '%', ''), '_', '') || '%'
     order by j.cog limit 20;
end $$;
revoke all on function public.admin_buscar_joiners(text) from public, anon;
grant execute on function public.admin_buscar_joiners(text) to authenticated, service_role;

create or replace function public.admin_resolver_vinculo(p_id bigint, p_aprovar boolean, p_joiner_id bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_p record; v_j record; v_n integer; v_cog text; v_uid uuid := (select auth.uid());
begin
  if (select public.is_admin()) is not true then raise exception 'sem permissão'; end if;
  select * into v_p from public.vinculos_pendentes where id = p_id and status = 'aberto' for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if not p_aprovar then
    update public.vinculos_pendentes set status = 'recusado', resolvido_por = v_uid, resolvido_em = now() where id = p_id;
    return jsonb_build_object('status', 'recusado');
  end if;
  if p_joiner_id is not null then
    select * into v_j from public.joiners j where j.id = p_joiner_id;
    if not found then raise exception 'joiner % não existe', p_joiner_id; end if;
  else
    -- sem id: só aceita se o COG pedido corresponder a UMA joiner
    v_cog := lower(trim(both from regexp_replace(v_p.cog_pedido, '^\s*@+', '')));
    select count(*) into v_n from public.joiners j where lower(trim(j.cog)) = v_cog;
    if v_n <> 1 then raise exception 'o COG % corresponde a % joiners; informe o id da joiner (admin_buscar_joiners)', v_cog, v_n; end if;
    select * into v_j from public.joiners j where lower(trim(j.cog)) = v_cog;
  end if;
  if exists (select 1 from public.contas_joiner c where c.joiner_id = v_j.id) then raise exception 'a joiner % já está vinculada a outra conta', v_j.id; end if;
  if exists (select 1 from public.contas_joiner c where c.user_id = v_p.user_id) then raise exception 'esta conta já está vinculada'; end if;
  insert into public.contas_joiner (user_id, joiner_id, origem) values (v_p.user_id, v_j.id, 'admin');
  update public.vinculos_pendentes set status = 'aprovado', resolvido_por = v_uid, resolvido_em = now() where id = p_id;
  return jsonb_build_object('status', 'aprovado', 'joiner_id', v_j.id);
end $$;
revoke all on function public.admin_resolver_vinculo(bigint, boolean, bigint) from public, anon;
grant execute on function public.admin_resolver_vinculo(bigint, boolean, bigint) to authenticated, service_role;

-- desfazer um vínculo feito por engano (a joiner volta ao modo limitado; nada do cadastro ou do histórico é apagado)
create or replace function public.admin_desvincular_conta(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if (select public.is_admin()) is not true then raise exception 'sem permissão'; end if;
  delete from public.contas_joiner where user_id = p_user_id;
  get diagnostics n = row_count;
  return jsonb_build_object('status', case when n = 1 then 'desvinculada' else 'nao_encontrada' end);
end $$;
revoke all on function public.admin_desvincular_conta(uuid) from public, anon;
grant execute on function public.admin_desvincular_conta(uuid) to authenticated, service_role;

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer;
begin
  select count(*) into n from pg_proc p where p.oid in ('public.ativar_minha_conta(text)'::regprocedure, 'public.admin_vinculos_pendentes()'::regprocedure, 'public.admin_buscar_joiners(text)'::regprocedure, 'public.admin_resolver_vinculo(bigint, boolean, bigint)'::regprocedure, 'public.admin_desvincular_conta(uuid)'::regprocedure)
     and (not p.prosecdef or p.proconfig is distinct from array['search_path=""']);
  if n > 0 then raise exception 'Função sem security definer / search_path vazio. Transação desfeita.'; end if;
  select count(*) into n from pg_proc p where p.oid in ('public.ativar_minha_conta(text)'::regprocedure, 'public.admin_vinculos_pendentes()'::regprocedure, 'public.admin_buscar_joiners(text)'::regprocedure, 'public.admin_resolver_vinculo(bigint, boolean, bigint)'::regprocedure, 'public.admin_desvincular_conta(uuid)'::regprocedure) and has_function_privilege('anon', p.oid, 'EXECUTE');
  if n > 0 then raise exception 'anon pode executar funções de conta. Transação desfeita.'; end if;
  if has_function_privilege('authenticated', 'public.ativar_minha_conta(text)', 'EXECUTE') then raise exception 'authenticated ainda executa ativar_minha_conta. Transação desfeita.'; end if;
  select count(*) into n from pg_proc p where p.oid in ('public.admin_vinculos_pendentes()'::regprocedure, 'public.admin_buscar_joiners(text)'::regprocedure, 'public.admin_resolver_vinculo(bigint, boolean, bigint)'::regprocedure, 'public.admin_desvincular_conta(uuid)'::regprocedure) and pg_get_functiondef(p.oid) like '%(select public.is_admin()) is not true%';
  if n <> 4 then raise exception 'As 4 funções de administração não ficaram com a checagem nova (%). Transação desfeita.', n; end if;
  select count(*) into n from pg_proc p where p.oid in ('public.admin_vinculos_pendentes()'::regprocedure, 'public.admin_buscar_joiners(text)'::regprocedure, 'public.admin_resolver_vinculo(bigint, boolean, bigint)'::regprocedure, 'public.admin_desvincular_conta(uuid)'::regprocedure) and not has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if n > 0 then raise exception 'Uma função de administração perdeu a execução do authenticated. Transação desfeita.'; end if;
end $$;

commit;
