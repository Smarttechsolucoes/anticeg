-- JOINERS1 — REVERTER: devolve ao visitante os privilégios originais de SELECT/UPDATE em joiners (a partir de emergencia.env1_backup) e remove envio_salvar_dados.
-- Não toca em dados. Depois disto, CPF/endereço voltam a ser legíveis por visitantes: usar só em emergência. PREPARADO, NÃO APLICADO.
begin;
do $$ begin
  if not exists (select 1 from emergencia.env1_backup where tipo = 'joiners_grant') then raise exception 'JOINERS1 reverter: backup ausente: nada foi alterado.'; end if;
end $$;
revoke select, update on public.joiners from anon;
do $$ declare r record; begin
  for r in select dados from emergencia.env1_backup where tipo = 'joiners_grant' and dados ->> 'grantee' = 'anon' and dados ->> 'privilege' in ('SELECT','UPDATE') loop
    execute format('grant %s on table public.joiners to anon', r.dados ->> 'privilege');
  end loop;
end $$;
drop function if exists public.envio_salvar_dados(jsonb);
do $$ begin
  if not (has_column_privilege('anon', 'public.joiners', 'cpf', 'SELECT') and has_column_privilege('anon', 'public.joiners', 'cpf', 'UPDATE')) then raise exception 'JOINERS1 reverter: o privilegio original nao voltou: abortado.'; end if;
end $$;
commit;
