-- LIMPEZA dos dados isolados de teste (só as linhas da joiner sintética zz_teste_envio). Revoga e apaga o token de teste. Não toca em nenhuma joiner real.
-- Os arquivos de teste no bucket envio-comprovantes (pasta <id da solicitação de teste>/) são removidos à parte pelo CLI (storage rm), depois de listar os ids abaixo.
begin;
create temp table _ids_teste on commit drop as select id from public.envio_solicitacoes where joiner_cog = 'zz_teste_envio';
select string_agg(id::text, ',') as ids_solicitacoes_de_teste from _ids_teste;
delete from public.envio_solicitacoes where joiner_cog = 'zz_teste_envio';
delete from public.joiner_storage where joiner_cog = 'zz_teste_envio';
delete from public.joiner_conferencias where joiner_cog = 'zz_teste_envio';
delete from public.envio_requests where joiner_cog = 'zz_teste_envio';
delete from public.grupos_envio where host_cog = 'zz_teste_envio';
delete from emergencia.envio_acessos where joiner_cog = 'zz_teste_envio';
delete from public.joiners where cog = 'zz_teste_envio';
do $$ begin
  if exists (select 1 from public.joiners where cog = 'zz_teste_envio') or exists (select 1 from public.envio_solicitacoes where joiner_cog = 'zz_teste_envio') then raise exception 'limpeza incompleta: desfeita'; end if;
end $$;
commit;
