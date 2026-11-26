-- J4c-1 — DADOS PESSOAIS DAS JOINERS PROTEGIDOS PELO BANCO: joiners, pre_cadastros, grupos_envio e push_subscriptions
-- Hoje qualquer visitante lê (e altera) e-mail, CPF, endereço, telefone, saldo de cashback e bloqueio de TODAS as joiners. Depois deste passo:
--   joiners            : a joiner logada lê e edita SÓ a própria linha (identificada por joiners.id, pelo vínculo do J1) e SÓ campos de perfil;
--                        e-mail/@ só mudam sem colidir com outra joiner; nome, COG, bloqueio, confirmação e saldo só a administradora (ou o servidor);
--                        criar/apagar joiner: só administradora. Cadastro novo passa por solicitar_cadastro() (função segura, resposta neutra).
--   pre_cadastros      : só administradora (o visitante não lê nem altera mais).
--   grupos_envio       : a host lê/cria/edita o próprio grupo; quem tem o código consulta por grupo_por_codigo() (só conta logada).
--   push_subscriptions : cada joiner vê/gerencia só as próprias; registrar_push() move o aparelho para a conta que está logada.
-- Funções novas (todas SECURITY DEFINER, search_path vazio): solicitar_cadastro, resolver_recrutador, meus_recrutados, joiners_online, debitar_cashback, grupo_por_codigo, registrar_push.
-- Nada de dado é alterado/apagado. As permissões do visitante são retiradas; NENHUMA permissão de visitante é copiada para a conta logada.
-- ⚠ APLICAR SOMENTE NO LANÇAMENTO, junto com o site novo no ar (VITE_JOINERS_AUTH ligado) e depois do J1, J4-0 e J4a. O site de hoje depende do acesso de visitante.
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
declare n integer; t text;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-1') then raise exception 'J4c-1 já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.meu_cog()') is null or to_regprocedure('public.meu_joiner_id()') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'J1/A1 não estão aplicados. Nada foi alterado.';
  end if;
  if to_regclass('public.joiners_publico') is null then raise exception 'J4a não está aplicado (falta joiners_publico). Nada foi alterado.'; end if;
  foreach t in array array['joiners', 'pre_cadastros', 'grupos_envio', 'push_subscriptions'] loop
    if to_regclass('public.' || t) is null then raise exception 'A tabela % não existe. Nada foi alterado.', t; end if;
  end loop;
  select count(*) into n from pg_attribute where attrelid = 'public.joiners'::regclass and not attisdropped
     and attname in ('id', 'cog', 'nome', 'email', 'twitter', 'whatsapp', 'nome_site', 'foto_perfil', 'bloqueado', 'confirmado', 'saldo_cashback', 'recrutador', 'last_seen');
  if n <> 13 then raise exception 'joiners sem as colunas esperadas (achei % de 13). Nada foi alterado.', n; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.pre_cadastros'::regclass and not attisdropped and attname in ('nome', 'cog', 'email', 'whatsapp', 'status', 'created_at');
  if n <> 6 then raise exception 'pre_cadastros sem as colunas esperadas. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.grupos_envio'::regclass and not attisdropped and attname in ('codigo', 'host_cog');
  if n <> 2 then raise exception 'grupos_envio sem codigo/host_cog. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.push_subscriptions'::regclass and not attisdropped and attname in ('joiner_cog', 'endpoint', 'p256dh', 'auth');
  if n <> 4 then raise exception 'push_subscriptions sem as colunas esperadas. Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há administradora cadastrada. Nada foi alterado.'; end if;
  if to_regprocedure('public.cog_e_da_conta(text)') is null then raise exception 'O J4a não está aplicado (falta cog_e_da_conta). Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR: policies (para recriar exatamente), permissões e impressão dos dados (só contagem e hash)
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-1', 'policy ' || tablename || ' / ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'public' and tablename in ('joiners', 'pre_cadastros', 'grupos_envio', 'push_subscriptions');
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-1', 'acl ' || c.relname, coalesce(c.relacl::text, '(padrão do dono)') from pg_class c
 where c.oid in ('public.joiners'::regclass, 'public.pre_cadastros'::regclass, 'public.grupos_envio'::regclass, 'public.push_subscriptions'::regclass);
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-1', 'impressão ' || t, f from (
  select 'joiners' as t, 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || coalesce(cog, '') || coalesce(email, ''), ',' order by id), '')) as f from public.joiners
  union all select 'pre_cadastros', 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(cog || coalesce(status, ''), ',' order by cog, created_at), '')) from public.pre_cadastros
  union all select 'grupos_envio', 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(codigo || host_cog, ',' order by codigo), '')) from public.grupos_envio
  union all select 'push_subscriptions', 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(endpoint || joiner_cog, ',' order by endpoint), '')) from public.push_subscriptions) x;

-- 1) RLS ligado e fora TODAS as policies antigas (abertas ao visitante)
alter table public.joiners enable row level security;
alter table public.pre_cadastros enable row level security;
alter table public.grupos_envio enable row level security;
alter table public.push_subscriptions enable row level security;
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('joiners', 'pre_cadastros', 'grupos_envio', 'push_subscriptions') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) visitante: nenhuma permissão. Conta logada: as policies abaixo decidem as LINHAS.
revoke all on table public.joiners, public.pre_cadastros, public.grupos_envio, public.push_subscriptions from anon, public;
grant select, insert, update, delete on table public.joiners, public.pre_cadastros to authenticated;
grant select, insert, update on table public.grupos_envio to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

-- 3) policies
create policy admin_tudo on public.joiners for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_propria on public.joiners for select to authenticated using (id = (select public.meu_joiner_id()));
create policy joiner_edita_propria on public.joiners for update to authenticated using (id = (select public.meu_joiner_id())) with check (id = (select public.meu_joiner_id()));

create policy admin_tudo on public.pre_cadastros for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy admin_tudo on public.grupos_envio for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy host_le_proprio on public.grupos_envio for select to authenticated using (public.cog_e_da_conta(host_cog));
create policy host_cria_proprio on public.grupos_envio for insert to authenticated with check (public.cog_e_da_conta(host_cog));
create policy host_edita_proprio on public.grupos_envio for update to authenticated
  using (public.cog_e_da_conta(host_cog)) with check (public.cog_e_da_conta(host_cog));

create policy admin_tudo on public.push_subscriptions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_gerencia_proprias on public.push_subscriptions for all to authenticated
  using (public.cog_e_da_conta(joiner_cog)) with check (public.cog_e_da_conta(joiner_cog));

-- 4) trava de colunas da joiners para quem NÃO é administradora (lista PERMITIDA: coluna nova no futuro nasce protegida)
--    O servidor (sync, service_role: sem auth.uid()) segue livre. E-mail e @ só mudam se não colidirem com outra joiner.
create function public.trg_joiners_protege_colunas() returns trigger language plpgsql security definer set search_path = '' as $$
declare permitidas text[] := array['foto_perfil', 'nome_site', 'whatsapp', 'telefone', 'cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'nome_entrega', 'cpf', 'last_seen', 'email', 'twitter', 'recrutador'];
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  -- caminho do debitar_cashback(): só vale se SÓ o saldo mudou e ele DIMINUIU (o sinalizador vale apenas dentro da transação da função)
  if current_setting('anticeg.debito_cashback', true) = '1' then
    if (to_jsonb(new) - 'saldo_cashback') = (to_jsonb(old) - 'saldo_cashback') and coalesce(new.saldo_cashback, 0) <= coalesce(old.saldo_cashback, 0) and coalesce(new.saldo_cashback, 0) >= 0 then return new; end if;
    raise exception 'Alteração não permitida: esse campo só a administradora pode mudar.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - permitidas) is distinct from (to_jsonb(old) - permitidas) then
    raise exception 'Alteração não permitida: esse campo só a administradora pode mudar.' using errcode = '42501';
  end if;
  if new.email is distinct from old.email and coalesce(trim(new.email), '') <> ''
     and exists (select 1 from public.joiners j where j.id <> new.id and lower(trim(j.email)) = lower(trim(new.email))) then
    raise exception 'Esse e-mail já está em uso por outra conta.' using errcode = '23505';
  end if;
  if new.twitter is distinct from old.twitter and coalesce(trim(new.twitter), '') <> ''
     and exists (select 1 from public.joiners j where j.id <> new.id and (lower(regexp_replace(coalesce(j.twitter, ''), '^\s*@+', '')) = lower(regexp_replace(new.twitter, '^\s*@+', '')) or lower(trim(j.cog)) = lower(regexp_replace(new.twitter, '^\s*@+', '')))) then
    raise exception 'Esse @ já está em uso por outra conta.' using errcode = '23505';
  end if;
  if new.recrutador is distinct from old.recrutador then
    if coalesce(trim(old.recrutador), '') <> '' then raise exception 'O recrutador só pode ser definido uma vez.' using errcode = '42501'; end if;
    if lower(trim(new.recrutador)) = lower(trim(new.cog)) or not exists (select 1 from public.joiners j where j.id <> new.id and lower(trim(j.cog)) = lower(trim(new.recrutador))) then
      raise exception 'Recrutador inválido.' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.trg_joiners_protege_colunas() from public, anon, authenticated;
create trigger trg_joiners_protege_colunas before update on public.joiners for each row execute function public.trg_joiners_protege_colunas();

-- 5) funções seguras

-- cadastro novo (visitante): cria a joiner SEM acesso a dados de ninguém; resposta sempre igual (não revela se o @/e-mail já existem). Trava global de 40/hora.
create function public.solicitar_cadastro(p_nome text, p_cog text, p_email text, p_whatsapp text default null, p_recrutador text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_nome text := trim(coalesce(p_nome, '')); v_cog text := regexp_replace(trim(coalesce(p_cog, '')), '^@+', ''); v_email text := lower(trim(coalesce(p_email, '')));
        v_whats text := nullif(trim(coalesce(p_whatsapp, '')), ''); v_rec text; v_rec_cog text;
begin
  if length(v_nome) < 2 or length(v_nome) > 80 or v_cog !~ '^[A-Za-z0-9_.]{2,30}$' or length(v_email) > 120 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or (v_whats is not null and length(v_whats) > 25) then
    return jsonb_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;
  if (select count(*) from public.pre_cadastros where created_at > now() - interval '1 hour') >= 40 then
    return jsonb_build_object('ok', false, 'motivo', 'tente_mais_tarde');
  end if;
  v_rec := nullif(regexp_replace(trim(coalesce(p_recrutador, '')), '^@+', ''), '');
  if v_rec is not null then
    select j.cog into v_rec_cog from public.joiners j where lower(trim(j.cog)) = lower(v_rec) or lower(regexp_replace(coalesce(j.twitter, ''), '^\s*@+', '')) = lower(v_rec) limit 1;
    if v_rec_cog is null or lower(v_rec_cog) = lower(v_cog) then return jsonb_build_object('ok', false, 'motivo', 'recrutador_invalido'); end if;
  end if;
  if exists (select 1 from public.joiners j where lower(trim(j.cog)) = lower(v_cog) or lower(trim(j.email)) = v_email or lower(regexp_replace(coalesce(j.twitter, ''), '^\s*@+', '')) = lower(v_cog)) then
    return jsonb_build_object('ok', true);   -- neutro: não diz se já existia
  end if;
  insert into public.joiners (cog, nome, email, twitter, whatsapp, confirmado, recrutador) values (v_cog, v_nome, v_email, '@' || v_cog, v_whats, false, v_rec_cog);
  insert into public.pre_cadastros (nome, cog, email, whatsapp, status) values (v_nome, v_cog, v_email, v_whats, 'aprovado');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.solicitar_cadastro(text, text, text, text, text) from public;
grant execute on function public.solicitar_cadastro(text, text, text, text, text) to anon, authenticated, service_role;

-- recrutador: devolve só COG e nome público (ou nada)
create function public.resolver_recrutador(p_texto text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v text := lower(regexp_replace(trim(coalesce(p_texto, '')), '^@+', '')); r record;
begin
  if v = '' or length(v) > 64 or v ~ '[\s@]' then return null; end if;
  select j.cog, coalesce(nullif(j.nome_site, ''), j.cog) as nome into r from public.joiners j
   where lower(trim(j.cog)) = v or lower(regexp_replace(coalesce(j.twitter, ''), '^\s*@+', '')) = v order by (lower(trim(j.cog)) = v) desc, j.id limit 1;
  if r.cog is null then return null; end if;
  return jsonb_build_object('cog', r.cog, 'nome', r.nome);
end $$;
revoke all on function public.resolver_recrutador(text) from public;
grant execute on function public.resolver_recrutador(text) to anon, authenticated, service_role;

create function public.meus_recrutados() returns table (cog text, nome text, nome_site text) language sql stable security definer set search_path = '' as $$
  select j.cog, coalesce(nullif(j.nome_site, ''), j.cog), j.nome_site from public.joiners j where public.cog_e_da_conta(j.recrutador) order by j.id
$$;
revoke all on function public.meus_recrutados() from public, anon;
grant execute on function public.meus_recrutados() to authenticated, service_role;

create function public.joiners_online(p_minutos integer default 10) returns table (cog text, nome text, foto_perfil text) language sql stable security definer set search_path = '' as $$
  select j.cog, coalesce(nullif(j.nome_site, ''), j.cog), j.foto_perfil from public.joiners j
   where public.meu_joiner_id() is not null and j.last_seen >= now() - make_interval(mins => greatest(1, least(coalesce(p_minutos, 10), 60))) order by j.last_seen desc limit 200
$$;
revoke all on function public.joiners_online(integer) from public, anon;
grant execute on function public.joiners_online(integer) to authenticated, service_role;

-- cashback: a joiner só consegue GASTAR o próprio saldo (nunca aumentar nem mexer no de outra)
create function public.debitar_cashback(p_valor numeric) returns numeric language plpgsql security definer set search_path = '' as $$
declare v_novo numeric;
begin
  if public.meu_joiner_id() is null or p_valor is null or p_valor <= 0 or p_valor > 100000 then return null; end if;
  perform set_config('anticeg.debito_cashback', '1', true);
  update public.joiners set saldo_cashback = greatest(0, coalesce(saldo_cashback, 0) - least(p_valor, coalesce(saldo_cashback, 0)))
   where id = public.meu_joiner_id() returning saldo_cashback into v_novo;
  perform set_config('anticeg.debito_cashback', '0', true);
  return v_novo;
end $$;
revoke all on function public.debitar_cashback(numeric) from public, anon;
grant execute on function public.debitar_cashback(numeric) to authenticated, service_role;

create function public.grupo_por_codigo(p_codigo text) returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(g.*) from public.grupos_envio g where public.meu_joiner_id() is not null and g.codigo = upper(trim(coalesce(p_codigo, ''))) limit 1
$$;
revoke all on function public.grupo_por_codigo(text) from public, anon;
grant execute on function public.grupo_por_codigo(text) to authenticated, service_role;

create function public.registrar_push(p_endpoint text, p_p256dh text, p_auth text) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_cog text := public.meu_cog();
begin
  if v_cog is null or coalesce(p_endpoint, '') !~ '^https://' or length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then return false; end if;
  insert into public.push_subscriptions (joiner_cog, endpoint, p256dh, auth) values (v_cog, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set joiner_cog = excluded.joiner_cog, p256dh = excluded.p256dh, auth = excluded.auth;
  return true;
end $$;
revoke all on function public.registrar_push(text, text, text) from public, anon;
grant execute on function public.registrar_push(text, text, text) to authenticated, service_role;

-- 6) conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_a text; v_d text; t text;
begin
  select count(*) into n from (values ('public.joiners'), ('public.pre_cadastros'), ('public.grupos_envio'), ('public.push_subscriptions')) x(nome)
   where has_table_privilege('anon', x.nome, 'SELECT') or has_table_privilege('anon', x.nome, 'INSERT') or has_table_privilege('anon', x.nome, 'UPDATE') or has_table_privilege('anon', x.nome, 'DELETE')
      or has_any_column_privilege('anon', x.nome, 'SELECT') or has_any_column_privilege('anon', x.nome, 'UPDATE') or has_any_column_privilege('anon', x.nome, 'INSERT');
  if n > 0 then raise exception 'O visitante ainda tem permissão em alguma das 4 tabelas. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('joiners', 'pre_cadastros', 'grupos_envio', 'push_subscriptions') and ('anon' = any(roles) or 'public' = any(roles));
  if n > 0 then raise exception 'Sobrou policy para visitante ou PUBLIC. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('joiners', 'pre_cadastros', 'grupos_envio', 'push_subscriptions');
  if n <> 10 then raise exception 'Esperava 10 policies novas e há %. Transação desfeita.', n; end if;
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('solicitar_cadastro', 'resolver_recrutador', 'meus_recrutados', 'joiners_online', 'debitar_cashback', 'grupo_por_codigo', 'registrar_push', 'trg_joiners_protege_colunas')
     and p.prosecdef and p.proconfig = array['search_path=""'];
  if n <> 8 then raise exception 'Esperava 8 funções security definer com search_path vazio e há %. Transação desfeita.', n; end if;
  if has_function_privilege('anon', 'public.debitar_cashback(numeric)', 'EXECUTE') or has_function_privilege('anon', 'public.grupo_por_codigo(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.registrar_push(text,text,text)', 'EXECUTE') or has_function_privilege('anon', 'public.joiners_online(integer)', 'EXECUTE') then
    raise exception 'Uma função só para conta logada está aberta ao visitante. Transação desfeita.';
  end if;
  for t in select unnest(array['joiners', 'pre_cadastros', 'grupos_envio', 'push_subscriptions']) loop
    select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'J4c-1' and objeto = 'impressão ' || t;
    v_d := case t
      when 'joiners' then (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || coalesce(cog, '') || coalesce(email, ''), ',' order by id), '')) from public.joiners)
      when 'pre_cadastros' then (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(cog || coalesce(status, ''), ',' order by cog, created_at), '')) from public.pre_cadastros)
      when 'grupos_envio' then (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(codigo || host_cog, ',' order by codigo), '')) from public.grupos_envio)
      else (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(endpoint || joiner_cog, ',' order by endpoint), '')) from public.push_subscriptions) end;
    if v_a is distinct from v_d then raise exception 'Os dados de % mudaram durante o script. Transação desfeita.', t; end if;
  end loop;
end $$;

commit;
