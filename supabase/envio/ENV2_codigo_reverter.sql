-- ENV2 — REVERTER: remove as funções de código, a função "sair" e a tabela de códigos; revoga os acessos criados por autoatendimento. Não toca nos acessos manuais do ENV1 nem em dados de joiners. PREPARADO, NÃO APLICADO.
begin;
update emergencia.envio_acessos set revogado_em = now() where obs = 'autoatendimento por e-mail' and revogado_em is null;
drop function if exists public.envio_codigo_emitir(text, text, text), public.envio_codigo_validar(text, text, text), public.envio_sair();
drop table if exists emergencia.envio_codigos;
do $$ begin
  if to_regclass('emergencia.envio_codigos') is not null or to_regprocedure('public.envio_codigo_emitir(text,text,text)') is not null then raise exception 'ENV2 reverter: restou objeto do ENV2: abortado'; end if;
end $$;
commit;
