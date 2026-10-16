-- N0 — REVERSÃO PROTEGIDA: apaga a tabela public.notifications SOMENTE se estiver VAZIA (nunca perde notificação). Se já tiver linhas, aborta: exporte-as antes.
-- Atenção: depois do J4c-4c, reverter o N0 deixa o J4c-4c sem a tabela (ele abortaria). Reverta o J4c-4c antes.
begin;
do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO APAGAR NOTIFICATIONS VAZIA
  n bigint;
begin
  if confirmacao is distinct from 'AUTORIZO APAGAR NOTIFICATIONS VAZIA' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'N0') then raise exception 'Não há registro do N0.'; end if;
  if to_regclass('public.notifications') is null then raise exception 'public.notifications não existe.'; end if;
  execute 'select count(*) from public.notifications' into n;
  if n > 0 then raise exception 'notifications tem % linha(s): NÃO apago. Exporte-as e decida (nada foi alterado).', n; end if;
  drop table public.notifications;
  update emergencia.c0b_estado_anterior set etapa = 'N0-revertido' where etapa = 'N0';
end $$;
commit;
