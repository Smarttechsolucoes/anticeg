-- PILOTO DE SENHAS — DESATIVAR (PAUSA O PILOTO SEM APAGAR NADA)
-- O que faz: onda_liberada = 0 e liberar_todas = false. Resultado imediato: nenhuma joiner (nem as cinco) recebe código novo nem consegue ativar conta nova.
-- O que NÃO faz (conferido dentro da transação): não apaga conta, senha, vínculo (contas_joiner), usuário do Auth nem cadastro; não altera a lista de ondas.
--   Quem já ativou continua com a conta e a senha (o login e a recuperação não dependem da liberação). Para bloquear também o LOGIN sem apagar nada: Authentication > Users > "Ban user"
--   (reversível), ou tirar a página do ar (reverter o deploy do site). Reativar depois: rodar de novo o P1_liberar_cinco_aplicar.sql.
-- Tudo em uma transação; se qualquer conferência falhar: "Nada foi alterado".
begin;

do $$
begin
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'PILOTO-1') then raise exception 'O piloto não está liberado (não há registro PILOTO-1). Nada foi alterado.'; end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'PILOTO-1-desativacao', 'estado antes de desativar', json_build_object('onda_liberada', onda_liberada, 'liberar_todas', liberar_todas)::text from public.ativacao_estado;
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values
  ('PILOTO-1-desativacao', 'impressão contas_joiner', (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(user_id::text || '|' || joiner_id::text || '|' || origem, E'\n' order by user_id), '')) from public.contas_joiner)),
  ('PILOTO-1-desativacao', 'impressão auth.users', (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(lower(email), ''), E'\n' order by id), '')) from auth.users)),
  ('PILOTO-1-desativacao', 'impressão ativacao_ondas', (select 'linhas=' || count(*) || ' ids=' || coalesce(string_agg(joiner_id::text, ',' order by joiner_id), '') from public.ativacao_ondas));

update public.ativacao_estado set onda_liberada = 0, liberar_todas = false, atualizado_em = now();

do $$
declare n integer; v_antes text; v_depois text;
begin
  select count(*) into n from public.joiners j where public.ativacao_liberada(j.id);
  if n <> 0 then raise exception 'Ainda há % joiner(s) com ativação liberada. Transação desfeita.', n; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'PILOTO-1-desativacao' and objeto = 'impressão contas_joiner' order by id desc limit 1;
  select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(user_id::text || '|' || joiner_id::text || '|' || origem, E'\n' order by user_id), '')) into v_depois from public.contas_joiner;
  if v_antes is distinct from v_depois then raise exception 'contas_joiner mudou. Transação desfeita.'; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'PILOTO-1-desativacao' and objeto = 'impressão auth.users' order by id desc limit 1;
  select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(lower(email), ''), E'\n' order by id), '')) into v_depois from auth.users;
  if v_antes is distinct from v_depois then raise exception 'auth.users mudou. Transação desfeita.'; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'PILOTO-1-desativacao' and objeto = 'impressão ativacao_ondas' order by id desc limit 1;
  select 'linhas=' || count(*) || ' ids=' || coalesce(string_agg(joiner_id::text, ',' order by joiner_id), '') into v_depois from public.ativacao_ondas;
  if v_antes is distinct from v_depois then raise exception 'a lista de ondas mudou. Transação desfeita.'; end if;
end $$;

-- marca o piloto como pausado (permite liberar de novo com o P1_liberar_cinco_aplicar.sql)
update emergencia.c0b_estado_anterior set etapa = 'PILOTO-1-pausado' where etapa = 'PILOTO-1';

commit;
