-- N1 — REVERSÃO PROTEGIDA: remove a tabela de controle de envios. Sem ela, a função email-evento deixa de funcionar (e a antiga está descontinuada).
-- Digite, na variável abaixo, a frase exata de autorização.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REMOVER CONTROLE DE ENVIOS
begin
  if confirmacao is distinct from 'AUTORIZO REMOVER CONTROLE DE ENVIOS' then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'N1') then raise exception 'Não há registro do N1.'; end if;
end $$;

drop table if exists public.emails_enviados;
update emergencia.c0b_estado_anterior set etapa = 'N1-revertido' where etapa = 'N1';

commit;
