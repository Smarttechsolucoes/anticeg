-- ST1 — PAPEL "staff_pagamentos": a staff aprova, rejeita, reabre e marca pagamentos SEM ser administradora geral. PREPARADO, NÃO APLICADO.
-- O que muda (e só isto):
--   1) admin_roles.papel passa a aceitar 'staff_pagamentos' (hoje só 'admin').
--   2) is_admin() passa a exigir papel = 'admin'. As 3 contas atuais são 'admin': NADA muda para elas (nem nas 40 policies que usam is_admin()).
--      Uma conta 'staff_pagamentos' NÃO é admin geral: continua negada em tudo o que usa is_admin().
--   3) novas funções: pode_operar_pagamentos() (admin OU staff_pagamentos) e meu_papel_admin() (o front mostra o painel certo).
--   4) as RPCs de pagamento (admin_definir_status_pagamento, admin_marcar_pago) trocam SÓ a verificação de permissão para pode_operar_pagamentos()
--      e passam a REGISTRAR quem fez, quando e o quê em emergencia.pagamento_decisoes (inacessível a anon/authenticated/service_role pela API).
--   5) admin_decisoes_pagamento(): leitura do registro, SOMENTE para admin geral.
-- Nada é aberto para usuário comum, nenhuma credencial é criada ou exposta. As RPCs são alteradas lendo a definição VIVA e trocando trechos exatos
-- (se algum trecho não for achado exatamente 1 vez, a transação aborta). Backup das definições em emergencia.st1_backup_funcoes. Reversão: ST1_reverter.sql.
begin;

do $$
begin
  if to_regprocedure('public.is_admin()') is null then raise exception 'public.is_admin() não existe. Nada foi alterado.'; end if;
  if to_regclass('public.admin_roles') is null then raise exception 'public.admin_roles não existe. Nada foi alterado.'; end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('admin_definir_status_pagamento', 'admin_marcar_pago')) <> 2 then
    raise exception 'As duas RPCs de pagamento (R1) precisam existir exatamente uma vez. Nada foi alterado.';
  end if;
  if to_regprocedure('public.pode_operar_pagamentos()') is not null or to_regclass('emergencia.st1_backup_funcoes') is not null then
    raise exception 'ST1 já foi aplicado. Nada foi alterado.';
  end if;
end $$;

create schema if not exists emergencia;

-- backup das definições vivas (para a reversão)
create table emergencia.st1_backup_funcoes (id bigint generated always as identity primary key, salvo_em timestamptz not null default now(), nome text not null, definicao text not null);
insert into emergencia.st1_backup_funcoes (nome, definicao)
select p.oid::regprocedure::text, pg_get_functiondef(p.oid) from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname in ('is_admin', 'admin_definir_status_pagamento', 'admin_marcar_pago');
alter table emergencia.st1_backup_funcoes enable row level security;
revoke all on table emergencia.st1_backup_funcoes from public, anon, authenticated;

-- 1) papel novo em admin_roles (remove o CHECK que só aceita 'admin' e põe outro que aceita os dois)
do $$
declare c record; n integer := 0;
begin
  for c in select conname from pg_constraint where conrelid = 'public.admin_roles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%papel%' loop
    execute format('alter table public.admin_roles drop constraint %I', c.conname); n := n + 1;
  end loop;
  if n <> 1 then raise exception 'esperava exatamente 1 CHECK de papel em admin_roles, achei %. Transação desfeita.', n; end if;
end $$;
alter table public.admin_roles add constraint admin_roles_papel_check check (papel in ('admin', 'staff_pagamentos'));

-- 2) is_admin(): só o papel 'admin' (as contas atuais continuam verdadeiras)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = (select auth.uid()) and r.papel = 'admin'
  )
$$;

-- 3) funções novas
create function public.pode_operar_pagamentos()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = (select auth.uid()) and r.papel in ('admin', 'staff_pagamentos')
  )
$$;
create function public.meu_papel_admin()
returns text language sql stable security definer set search_path = '' as $$
  select r.papel from public.admin_roles r where r.user_id = (select auth.uid())
$$;
revoke all on function public.pode_operar_pagamentos(), public.meu_papel_admin() from public, anon;
grant execute on function public.pode_operar_pagamentos(), public.meu_papel_admin() to authenticated, service_role;

-- 4) registro de decisões (quem, quando, o quê) — fora da API
create table emergencia.pagamento_decisoes (
  id              bigint generated always as identity primary key,
  criado_em       timestamptz not null default now(),
  user_id         uuid,
  email           text,
  papel           text,
  acao            text not null check (acao in ('definir_status', 'marcar_manual')),
  demanda_id      bigint,
  masterlist_id   bigint,
  status_anterior text,
  status_novo     text,
  motivo          text,
  resumo          jsonb
);
alter table emergencia.pagamento_decisoes enable row level security;
revoke all on table emergencia.pagamento_decisoes from public, anon, authenticated;

create function public.admin_decisoes_pagamento(p_limite integer default 100)
returns table (criado_em timestamptz, email text, papel text, acao text, demanda_id bigint, masterlist_id bigint, status_anterior text, status_novo text, motivo text, resumo jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select public.is_admin()) is not true then raise exception 'sem permissão'; end if;
  return query select d.criado_em, d.email, d.papel, d.acao, d.demanda_id, d.masterlist_id, d.status_anterior, d.status_novo, d.motivo, d.resumo
                 from emergencia.pagamento_decisoes d order by d.id desc limit greatest(1, least(coalesce(p_limite, 100), 1000));
end $$;
revoke all on function public.admin_decisoes_pagamento(integer) from public, anon;
grant execute on function public.admin_decisoes_pagamento(integer) to authenticated, service_role;

-- 5) as duas RPCs: troca de permissão + registro (patch exato sobre a definição viva)
do $$
declare
  v_def text; v_novo text; n integer;
  v_quem constant text := '(select auth.uid()), (select auth.jwt() ->> ''email''), (select ar.papel from public.admin_roles ar where ar.user_id = (select auth.uid()))';
  v_perm_antiga constant text := 'if (select public.is_admin()) is not true then raise exception ''sem permissão''; end if;';
  v_perm_nova   constant text := 'if (select public.pode_operar_pagamentos()) is not true then raise exception ''sem permissão''; end if;';
  v_ret_status  constant text := 'return jsonb_build_object(''status'', p_novo_status, ''alterado'', true,';
  v_ret_marcar  constant text := 'return jsonb_build_object(''status'', case when v_n = 1';
begin
  -- admin_definir_status_pagamento
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'admin_definir_status_pagamento';
  n := (length(v_def) - length(replace(v_def, v_perm_antiga, ''))) / length(v_perm_antiga);
  if n <> 1 then raise exception 'admin_definir_status_pagamento: esperava 1 verificação de permissão, achei %. Transação desfeita.', n; end if;
  n := (length(v_def) - length(replace(v_def, v_ret_status, ''))) / length(v_ret_status);
  if n <> 1 then raise exception 'admin_definir_status_pagamento: esperava 1 retorno final, achei %. Transação desfeita.', n; end if;
  v_novo := replace(v_def, v_perm_antiga, v_perm_nova);
  v_novo := replace(v_novo, v_ret_status,
    'insert into emergencia.pagamento_decisoes (user_id, email, papel, acao, demanda_id, status_anterior, status_novo, motivo, resumo) values (' || v_quem || ', ''definir_status'', p_demanda_id, v_d.status, p_novo_status, v_motivo, '
    || 'jsonb_build_object(''itens_marcados'', v_marcados, ''itens_desmarcados'', v_desmarcados, ''itens_mantidos'', v_mantidos, ''itens_reassociados'', v_reass_n));' || chr(10) || '  ' || v_ret_status);
  execute v_novo;

  -- admin_marcar_pago
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'admin_marcar_pago';
  n := (length(v_def) - length(replace(v_def, v_perm_antiga, ''))) / length(v_perm_antiga);
  if n <> 1 then raise exception 'admin_marcar_pago: esperava 1 verificação de permissão, achei %. Transação desfeita.', n; end if;
  n := (length(v_def) - length(replace(v_def, v_ret_marcar, ''))) / length(v_ret_marcar);
  if n <> 1 then raise exception 'admin_marcar_pago: esperava 1 retorno final, achei %. Transação desfeita.', n; end if;
  v_novo := replace(v_def, v_perm_antiga, v_perm_nova);
  v_novo := replace(v_novo, v_ret_marcar,
    'if v_n = 1 then insert into emergencia.pagamento_decisoes (user_id, email, papel, acao, masterlist_id, resumo) values (' || v_quem || ', ''marcar_manual'', p_item_id, '
    || 'jsonb_build_object(''item'', coalesce(p_item, false), ''frete'', coalesce(p_frete, false), ''rf'', coalesce(p_rf, false))); end if;' || chr(10) || '  ' || v_ret_marcar);
  execute v_novo;
end $$;

-- verificação (aborta tudo se algo estiver fora do previsto)
do $$
begin
  if exists (select 1 from public.admin_roles where papel <> 'admin') then raise exception 'há papéis inesperados em admin_roles: abortado.'; end if;
  if (select count(*) from public.admin_roles) <> (select count(*) from public.admin_roles where papel = 'admin') then raise exception 'contagem de admins mudou: abortado.'; end if;
  if pg_get_functiondef('public.admin_definir_status_pagamento(bigint,text,text,boolean,boolean)'::regprocedure) not like '%pode_operar_pagamentos%'
     or pg_get_functiondef('public.admin_definir_status_pagamento(bigint,text,text,boolean,boolean)'::regprocedure) like '%public.is_admin()%' then raise exception 'admin_definir_status_pagamento não foi trocada como esperado: abortado.'; end if;
  if pg_get_functiondef('public.admin_marcar_pago(bigint,boolean,boolean,boolean)'::regprocedure) not like '%pode_operar_pagamentos%'
     or pg_get_functiondef('public.admin_marcar_pago(bigint,boolean,boolean,boolean)'::regprocedure) like '%public.is_admin()%' then raise exception 'admin_marcar_pago não foi trocada como esperado: abortado.'; end if;
  if not (select prosecdef from pg_proc where oid = 'public.pode_operar_pagamentos()'::regprocedure) then raise exception 'pode_operar_pagamentos sem SECURITY DEFINER: abortado.'; end if;
  if has_function_privilege('anon', 'public.pode_operar_pagamentos()', 'EXECUTE') or has_function_privilege('anon', 'public.meu_papel_admin()', 'EXECUTE') then raise exception 'anon não pode executar as funções novas: abortado.'; end if;
  if has_table_privilege('anon', 'emergencia.pagamento_decisoes', 'SELECT') or has_table_privilege('authenticated', 'emergencia.pagamento_decisoes', 'SELECT') then raise exception 'registro de decisões exposto: abortado.'; end if;
end $$;

commit;
