-- C0-B8 (passo 0) — REVERSÃO: remove a policy config_admin (volta ao estado em que só anon_all existia).
-- Seguro de rodar a qualquer momento: não reabre nada. Se o fechamento (21) já tiver sido aplicado, NÃO use este script: use o 23.
begin;

do $$
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B8') then
    raise exception 'O B8 (fechamento) já foi aplicado: use o 23_B8_config_reverter_protegido.sql. Nada foi alterado.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B8-0') then
    raise exception 'Não há registro do B8-0. Nada foi alterado.';
  end if;
end $$;

drop policy if exists config_admin on public.config;
update emergencia.c0b_estado_anterior set etapa = 'B8-0-revertido' where etapa = 'B8-0';

commit;
