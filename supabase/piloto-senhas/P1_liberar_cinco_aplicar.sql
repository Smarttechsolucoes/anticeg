-- PILOTO DE SENHAS — P1: LIBERAÇÃO EXCLUSIVA DE CINCO JOINERS (ONDA 1)
--   al.melo (2) · nicknowsaurus (272) · lyrichangbin (42) · gnabjubs (187751) · ttalilitinha (7213)
-- O que faz: coloca SÓ essas cinco na lista de ativação (ativacao_ondas, onda 1) e libera a onda 1. Qualquer outra joiner continua em "aguardando liberação":
--   o servidor não envia código para ela e ativar_minha_conta não vincula nada. A lista é decidida SÓ aqui, no banco; o navegador e as funções não a conhecem.
-- O que NÃO faz: não cria conta, não vincula ninguém, não mexe em senha, sessão, permissão de leitura/escrita de nenhuma tabela, nem em contas já ativadas.
-- Pré-requisitos (travados abaixo): J1, J3, J4a e J4d aplicados; as cinco existem com o ID e o @ certos, e-mail válido e ÚNICO, sem duplicidade de @ nem de ID,
--   o cadastro antigo biachinicks (id 12) não existe, e a lista de ondas está vazia ou já é exatamente estas cinco.
-- Tudo em uma transação com registro do estado anterior e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare
  n integer;
  esperadas constant jsonb := '[{"id":2,"cog":"al.melo"},{"id":272,"cog":"nicknowsaurus"},{"id":42,"cog":"lyrichangbin"},{"id":187751,"cog":"gnabjubs"},{"id":7213,"cog":"ttalilitinha"}]';
  r record;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'PILOTO-1') then raise exception 'O piloto já está liberado (PILOTO-1). Use o P1_verificar.sql; para pausar, P1_desativar.sql. Nada foi alterado.'; end if;
  if to_regclass('public.contas_joiner') is null or to_regprocedure('public.ativar_minha_conta(text)') is null then raise exception 'O J1 não está aplicado. Nada foi alterado.'; end if;
  if to_regclass('public.tentativas_acesso') is null then raise exception 'O J3 não está aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.entrar_com_arroba(text)') is null then raise exception 'O J4a não está aplicado. Nada foi alterado.'; end if;
  if to_regclass('public.ativacao_ondas') is null or to_regclass('public.ativacao_estado') is null or to_regprocedure('public.ativacao_liberada(bigint)') is null then raise exception 'O J4d não está aplicado. Nada foi alterado.'; end if;

  -- as cinco existem, com o ID e o @ certos
  for r in select (x ->> 'id')::bigint as id, x ->> 'cog' as cog from jsonb_array_elements(esperadas) x loop
    select count(*) into n from public.joiners j where j.id = r.id and lower(trim(j.cog)) = r.cog;
    if n <> 1 then raise exception 'O ID % não corresponde ao @% (achei % cadastro(s)). Nada foi alterado.', r.id, r.cog, n; end if;
    select count(*) into n from public.joiners j where lower(trim(j.cog)) = r.cog;
    if n <> 1 then raise exception 'O @% aparece em % cadastros (ignorando maiúsculas). Nada foi alterado.', r.cog, n; end if;
    select count(*) into n from public.joiners j where j.id <> r.id and lower(regexp_replace(coalesce(j.twitter, ''), '^\s*@+', '')) = r.cog;
    if n <> 0 then raise exception 'O @% também aparece como twitter de outro cadastro. Nada foi alterado.', r.cog; end if;
    select count(*) into n from public.joiners j where j.id = r.id and coalesce(j.bloqueado, false);
    if n <> 0 then raise exception 'O cadastro % está bloqueado. Nada foi alterado.', r.id; end if;
    select count(*) into n from public.joiners j where j.id = r.id and lower(trim(j.email)) ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$';
    if n <> 1 then raise exception 'O cadastro % não tem e-mail válido. Nada foi alterado.', r.id; end if;
    select count(*) into n from public.joiners j2 where lower(trim(j2.email)) = (select lower(trim(j.email)) from public.joiners j where j.id = r.id);
    if n <> 1 then raise exception 'O e-mail do cadastro % está em % cadastros (ambiguidade). Nada foi alterado.', r.id, n; end if;
  end loop;
  if exists (select 1 from public.joiners where id = 12 or lower(trim(cog)) = 'biachinicks') then raise exception 'O cadastro antigo biachinicks (id 12) ainda existe. Nada foi alterado.'; end if;
  select count(*) into n from (select id from public.joiners group by id having count(*) > 1) t;
  if n <> 0 then raise exception 'Há joiners.id repetidos. Nada foi alterado.'; end if;

  -- a lista de ondas não pode ter ninguém além das cinco, e a liberação geral tem de estar desligada
  select count(*) into n from public.ativacao_ondas o where o.joiner_id not in (2, 272, 42, 187751, 7213) or o.onda <> 1;
  if n <> 0 then raise exception 'A lista de ondas tem % item(ns) fora das cinco (ou fora da onda 1). Nada foi alterado.', n; end if;
  if (select liberar_todas from public.ativacao_estado) then raise exception 'liberar_todas está ligado. Nada foi alterado.'; end if;
  if (select onda_liberada from public.ativacao_estado) > 1 then raise exception 'onda_liberada é maior que 1. Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR (para conferência e para a desativação)
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'PILOTO-1', 'estado ativacao_estado', json_build_object('onda_liberada', onda_liberada, 'liberar_todas', liberar_todas)::text from public.ativacao_estado;
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values
  ('PILOTO-1', 'impressão contas_joiner', (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(user_id::text || '|' || joiner_id::text || '|' || origem, E'\n' order by user_id), '')) from public.contas_joiner)),
  ('PILOTO-1', 'impressão auth.users', (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(lower(email), ''), E'\n' order by id), '')) from auth.users)),
  ('PILOTO-1', 'impressão joiners', (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(cog, '') || '|' || coalesce(lower(email), ''), E'\n' order by id), '')) from public.joiners));

-- a liberação: somente as cinco, onda 1
insert into public.ativacao_ondas (joiner_id, onda) values (2, 1), (272, 1), (42, 1), (187751, 1), (7213, 1)
on conflict (joiner_id) do update set onda = 1;
update public.ativacao_estado set onda_liberada = 1, liberar_todas = false, atualizado_em = now();

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_antes text; v_depois text;
begin
  select count(*) into n from public.ativacao_ondas;
  if n <> 5 then raise exception 'A lista deveria ter 5 joiners e tem %. Transação desfeita.', n; end if;
  select count(*) into n from public.joiners j where public.ativacao_liberada(j.id);
  if n <> 5 then raise exception 'Deveria haver exatamente 5 joiners liberadas e há %. Transação desfeita.', n; end if;
  select count(*) into n from public.joiners j where public.ativacao_liberada(j.id) and j.id not in (2, 272, 42, 187751, 7213);
  if n <> 0 then raise exception 'Há joiner liberada fora da lista. Transação desfeita.'; end if;
  if (select liberar_todas from public.ativacao_estado) or (select onda_liberada from public.ativacao_estado) <> 1 then raise exception 'Estado de liberação inesperado. Transação desfeita.'; end if;
  -- nada de conta, senha, vínculo ou cadastro foi tocado
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'PILOTO-1' and objeto = 'impressão contas_joiner';
  select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(user_id::text || '|' || joiner_id::text || '|' || origem, E'\n' order by user_id), '')) into v_depois from public.contas_joiner;
  if v_antes is distinct from v_depois then raise exception 'contas_joiner mudou durante o script. Transação desfeita.'; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'PILOTO-1' and objeto = 'impressão auth.users';
  select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(lower(email), ''), E'\n' order by id), '')) into v_depois from auth.users;
  if v_antes is distinct from v_depois then raise exception 'auth.users mudou durante o script. Transação desfeita.'; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'PILOTO-1' and objeto = 'impressão joiners';
  select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(cog, '') || '|' || coalesce(lower(email), ''), E'\n' order by id), '')) into v_depois from public.joiners;
  if v_antes is distinct from v_depois then raise exception 'joiners mudou durante o script. Transação desfeita.'; end if;
end $$;

commit;
