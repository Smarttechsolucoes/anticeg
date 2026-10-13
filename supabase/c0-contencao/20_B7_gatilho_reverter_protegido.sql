-- C0-B7 — REVERSÃO PROTEGIDA: religa o gatilho trg_confirmar_pagamento.
-- ATENÇÃO: religar faz o envio de comprovante voltar a falhar com "permission denied for table masterlist" enquanto o B1 estiver ativo.
-- Nada reverte sozinho. Para executar é preciso digitar, na variável abaixo, a frase exata de autorização.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO RELIGAR GATILHO DE PAGAMENTO
begin
  if confirmacao is distinct from 'AUTORIZO RELIGAR GATILHO DE PAGAMENTO' then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Religar o gatilho quebra o envio de comprovantes enquanto o B1 estiver ativo.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B7') then
    raise exception 'Não há estado anterior do B7 registrado.';
  end if;
end $$;

alter table public.pagamento_demandas enable trigger trg_confirmar_pagamento;

update emergencia.c0b_estado_anterior set etapa = 'B7-revertido' where etapa = 'B7';

do $$ begin raise notice 'Reversão do B7 feita: o gatilho trg_confirmar_pagamento foi religado.'; end $$;

commit;
