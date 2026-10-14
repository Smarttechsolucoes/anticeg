-- J4-0 — REVERSÃO PROTEGIDA: remove a policy admin_tudo das tabelas em que este passo a criou.
-- Depois disso a administradora logada deixa de ter acesso próprio a essas tabelas (o site de hoje, que usa o acesso de visitante, não é afetado).
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REMOVER ACESSO DA ADMIN
  t text;
begin
  if confirmacao is distinct from 'AUTORIZO REMOVER ACESSO DA ADMIN' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4-0') then raise exception 'Não há registro do J4-0.'; end if;
  for t in select unnest(string_to_array(coalesce((select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4-0' and objeto = 'policies admin_tudo criadas'), ''), ',')) loop
    if t <> '' then execute format('drop policy if exists admin_tudo on public.%I', t); end if;
  end loop;
  update emergencia.c0b_estado_anterior set etapa = 'J4-0-revertido' where etapa = 'J4-0';
end $$;

commit;
