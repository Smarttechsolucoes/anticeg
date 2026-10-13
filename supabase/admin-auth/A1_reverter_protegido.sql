-- A1 — REVERSÃO PROTEGIDA: remove admin_roles e is_admin().
-- Só funciona se NENHUMA policy ou função das próximas etapas depender de is_admin() (o DROP falha se houver dependência: é proposital).
-- Nada reverte sozinho. Para executar é preciso digitar, na variável abaixo, a frase exata de autorização.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REMOVER IDENTIDADE DE ADMIN
begin
  if confirmacao is distinct from 'AUTORIZO REMOVER IDENTIDADE DE ADMIN' then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto apaga a lista de administradores.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'A1') then
    raise exception 'Não há registro do A1.';
  end if;
end $$;

drop function public.is_admin();
drop table public.admin_roles;

update emergencia.c0b_estado_anterior set etapa = 'A1-revertido' where etapa = 'A1';

do $$ begin raise notice 'Reversão do A1 feita: admin_roles e is_admin() removidas.'; end $$;

commit;
