-- ST1 — REVERTER: devolve is_admin() e as duas RPCs às definições guardadas em emergencia.st1_backup_funcoes e remove as funções novas.
-- Recusa reverter se ainda existir conta com papel 'staff_pagamentos' (remova-as de admin_roles antes). Mantém o registro de decisões (trilha de auditoria).
begin;
do $$
begin
  if to_regclass('emergencia.st1_backup_funcoes') is null then raise exception 'ST1 não está aplicado (sem backup). Nada foi alterado.'; end if;
  if exists (select 1 from public.admin_roles where papel <> 'admin') then raise exception 'ainda há contas staff_pagamentos em admin_roles: remova-as antes de reverter. Nada foi alterado.'; end if;
end $$;
do $$
declare b record;
begin
  for b in select distinct on (nome) nome, definicao from emergencia.st1_backup_funcoes order by nome, id loop
    execute b.definicao;
  end loop;
end $$;
drop function if exists public.admin_decisoes_pagamento(integer);
drop function if exists public.pode_operar_pagamentos();
drop function if exists public.meu_papel_admin();
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.admin_roles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%papel%' loop
    execute format('alter table public.admin_roles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.admin_roles add constraint admin_roles_papel_check check (papel in ('admin'));
do $$
begin
  if pg_get_functiondef('public.admin_definir_status_pagamento(bigint,text,text,boolean,boolean)'::regprocedure) like '%pode_operar_pagamentos%' then raise exception 'a RPC não voltou à definição original: abortado.'; end if;
  if pg_get_functiondef('public.is_admin()'::regprocedure) like '%papel = ''admin''%' then raise exception 'is_admin() não voltou à definição original: abortado.'; end if;
end $$;
commit;
