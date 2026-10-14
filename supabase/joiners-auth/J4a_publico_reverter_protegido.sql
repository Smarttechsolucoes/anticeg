-- J4a — REVERSÃO PROTEGIDA: remove a visão e as funções públicas do J4a. Se o site novo já usa essas peças, ele deixa de achar as joiners no acesso simples.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REMOVER PECAS PUBLICAS
begin
  if confirmacao is distinct from 'AUTORIZO REMOVER PECAS PUBLICAS' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4a') then raise exception 'Não há registro do J4a.'; end if;
end $$;

drop function if exists public.contar_recrutados(text);
drop function if exists public.meus_dados();
drop function if exists public.entrar_com_arroba(text);
drop view if exists public.joiners_publico;
update emergencia.c0b_estado_anterior set etapa = 'J4a-revertido' where etapa = 'J4a';

commit;
