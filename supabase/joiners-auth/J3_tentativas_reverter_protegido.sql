-- J3 — REVERSÃO PROTEGIDA: remove a tabela de tentativas. Sem ela as funções de login e recuperação deixam de funcionar.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REMOVER CONTROLE DE TENTATIVAS
begin
  if confirmacao is distinct from 'AUTORIZO REMOVER CONTROLE DE TENTATIVAS' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J3') then raise exception 'Não há registro do J3.'; end if;
end $$;

drop table if exists public.tentativas_acesso;
update emergencia.c0b_estado_anterior set etapa = 'J3-revertido' where etapa = 'J3';

commit;
