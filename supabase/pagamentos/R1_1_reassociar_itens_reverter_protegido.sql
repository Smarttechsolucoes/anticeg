-- R1.1 — REVERSÃO PROTEGIDA: devolve a admin_definir_status_pagamento ao corpo que ela tinha ANTES do R1.1 (guardado em emergencia.c0b_estado_anterior). Permissões, dono e dados não são tocados.
-- Efeito: a confirmação volta a tratar item com id inexistente só como "ausente" (sem reassociar pelo id_linha). Nada é perdido: as marcações já feitas continuam como estão.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REVERTER REASSOCIACAO
  v_def text;
begin
  if confirmacao is distinct from 'AUTORIZO REVERTER REASSOCIACAO' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito.'; end if;
  select detalhe into v_def from emergencia.c0b_estado_anterior where etapa = 'R1.1' and objeto = 'definicao_anterior admin_definir_status_pagamento';
  if v_def is null then raise exception 'Não há definição anterior registrada do R1.1.'; end if;
  if v_def not like 'CREATE OR REPLACE FUNCTION public.admin_definir_status_pagamento(%' then raise exception 'A definição guardada não tem o formato esperado. Nada foi alterado.'; end if;
  execute v_def;
  if pg_get_functiondef('public.admin_definir_status_pagamento(bigint, text, text, boolean, boolean)'::regprocedure) like '%reassociaveis%' then raise exception 'O corpo anterior não foi restaurado. Transação desfeita.'; end if;
  update emergencia.c0b_estado_anterior set etapa = 'R1.1-revertido' where etapa = 'R1.1';
  raise notice 'Reversão do R1.1 feita: corpo anterior da função restaurado.';
end $$;

commit;
