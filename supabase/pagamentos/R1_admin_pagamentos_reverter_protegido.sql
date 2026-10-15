-- R1 — REVERSÃO PROTEGIDA: remove as duas funções novas e devolve à função antiga a execução que ela tinha antes do R1.
-- ATENÇÃO: a função antiga (set_pagamento_demanda_status) não confere quem chama. Reverter reabre o que o R1 fechou. Só use se for indispensável e mantenha o botão suspenso no site.
-- Nenhuma permissão de tabela ou dado é tocado.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REVERTER PAGAMENTOS ADMIN
begin
  if confirmacao is distinct from 'AUTORIZO REVERTER PAGAMENTOS ADMIN' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'R1') then raise exception 'Não há registro do R1.'; end if;
end $$;

do $$
declare r record; a jsonb;
begin
  for r in select objeto, detalhe from emergencia.c0b_estado_anterior where etapa = 'R1' and objeto like 'funcao_antiga %' loop
    a := r.detalhe::jsonb;
    if to_regprocedure(substr(r.objeto, length('funcao_antiga ') + 1)) is not null then
      if (a ->> 'anon')::boolean then execute format('grant execute on function %s to anon', substr(r.objeto, length('funcao_antiga ') + 1)); end if;
      if (a ->> 'authenticated')::boolean then execute format('grant execute on function %s to authenticated', substr(r.objeto, length('funcao_antiga ') + 1)); end if;
    end if;
  end loop;
  drop function if exists public.admin_definir_status_pagamento(bigint, text, text);
  drop function if exists public.admin_marcar_pago(bigint, boolean, boolean, boolean);
end $$;

update emergencia.c0b_estado_anterior set etapa = 'R1-revertido' where etapa = 'R1';
do $$ begin raise notice 'Reversão do R1 feita: funções novas removidas; função antiga com as permissões de antes.'; end $$;

commit;
