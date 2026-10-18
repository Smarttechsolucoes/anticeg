-- ENSAIO (rollback) da REVERSÃO do ENV2: aplica o ENV2, emite um acesso por autoatendimento, reverte o ENV2 e prova que o acesso foi revogado e os objetos sumiram.
begin;

do $$ begin
  if to_regprocedure('emergencia.gerar_acesso_envio(text,integer,text)') is null or to_regprocedure('public.envio_token_cog()') is null then raise exception 'ENV2: aplique o ENV1 antes. Nada foi alterado.'; end if;
  if to_regclass('emergencia.envio_codigos') is not null then raise exception 'ENV2: ja aplicado. Nada foi alterado.'; end if;
end $$;

create table emergencia.envio_codigos (
  id bigserial primary key,
  joiner_cog text not null,
  codigo_hash text not null,
  ip_hash text,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  tentativas integer not null default 0,
  usado_em timestamptz,
  invalidado_em timestamptz
);
create index envio_codigos_cog_idx on emergencia.envio_codigos (lower(btrim(joiner_cog)), criado_em desc);
create index envio_codigos_ip_idx on emergencia.envio_codigos (ip_hash, criado_em desc) where ip_hash is not null;
alter table emergencia.envio_codigos enable row level security;
revoke all on emergencia.envio_codigos from public, anon, authenticated, service_role;
revoke all on sequence emergencia.envio_codigos_id_seq from public, anon, authenticated, service_role;

-- 1) emite um código: devolve o e-mail de destino SOMENTE se o pedido é permitido (senão null, sem dizer o motivo)
create function public.envio_codigo_emitir(p_cog text, p_hash text, p_ip_hash text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare v_cog text; v_email text; v_n integer; v_cnt integer;
begin
  if p_cog is null or p_hash is null or length(p_hash) < 32 or length(btrim(p_cog)) < 1 or length(p_cog) > 80 then return null; end if;
  -- limites por IP (conta o pedido mesmo que o @ não exista: não revela existência)
  if p_ip_hash is not null then
    select count(*) into v_cnt from emergencia.envio_codigos where ip_hash = p_ip_hash and criado_em > now() - interval '1 hour';
    if v_cnt >= 20 then return null; end if;
  end if;
  -- uma única joiner (cog exato; se só diferir na caixa, só vale se for inequívoco)
  select j.cog, nullif(btrim(j.email), '') into v_cog, v_email from public.joiners j
   where btrim(j.cog) = btrim(p_cog) and not coalesce(j.bloqueado, false) limit 1;
  if v_cog is null then
    select j.cog, nullif(btrim(j.email), '') into v_cog, v_email from public.joiners j
     where lower(btrim(j.cog)) = lower(btrim(p_cog)) and not coalesce(j.bloqueado, false)
       and (select count(*) from public.joiners z where lower(btrim(z.cog)) = lower(btrim(p_cog))) = 1 limit 1;
  end if;
  if v_cog is null then
    insert into emergencia.envio_codigos (joiner_cog, codigo_hash, ip_hash, expira_em, invalidado_em) values (left(btrim(p_cog), 80), p_hash, p_ip_hash, now(), now());   -- só para contar por IP
    return null;
  end if;
  if v_email is null or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then return null; end if;
  -- limites por @
  select count(*) into v_cnt from emergencia.envio_codigos where lower(btrim(joiner_cog)) = lower(btrim(v_cog)) and criado_em > now() - interval '1 minute' and invalidado_em is null;
  if v_cnt >= 1 then return null; end if;
  select count(*) into v_cnt from emergencia.envio_codigos where lower(btrim(joiner_cog)) = lower(btrim(v_cog)) and criado_em > now() - interval '1 hour' and invalidado_em is null;
  if v_cnt >= 3 then return null; end if;
  update emergencia.envio_codigos set invalidado_em = now() where lower(btrim(joiner_cog)) = lower(btrim(v_cog)) and usado_em is null and invalidado_em is null and expira_em > now();
  insert into emergencia.envio_codigos (joiner_cog, codigo_hash, ip_hash, expira_em) values (v_cog, p_hash, p_ip_hash, now() + interval '10 minutes');
  return v_email;
end $$;

-- 2) valida o código: devolve o ACESSO (token de 7 dias, o mesmo do ENV1) ou null
create function public.envio_codigo_validar(p_cog text, p_hash text, p_ip_hash text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare v_row emergencia.envio_codigos; v_cnt integer;
begin
  if p_cog is null or p_hash is null or length(p_hash) < 32 or length(btrim(p_cog)) < 1 or length(p_cog) > 80 then return null; end if;
  if p_ip_hash is not null then
    select count(*) into v_cnt from emergencia.envio_codigos where ip_hash = p_ip_hash and criado_em > now() - interval '1 hour' and tentativas >= 5;
    if v_cnt >= 6 then return null; end if;   -- muitos códigos esgotados por este IP: bloqueio por uma hora
  end if;
  select * into v_row from emergencia.envio_codigos
   where lower(btrim(joiner_cog)) = lower(btrim(p_cog)) and usado_em is null and invalidado_em is null and expira_em > now()
   order by id desc limit 1 for update;
  if not found then return null; end if;
  if v_row.tentativas >= 5 then return null; end if;
  if v_row.codigo_hash <> p_hash then
    update emergencia.envio_codigos set tentativas = tentativas + 1 where id = v_row.id;
    return null;
  end if;
  update emergencia.envio_codigos set usado_em = now() where id = v_row.id;
  return emergencia.gerar_acesso_envio(v_row.joiner_cog, 7, 'autoatendimento por e-mail');
end $$;

-- 3) "sair": a joiner revoga o PRÓPRIO acesso (token do cabeçalho)
create function public.envio_sair() returns boolean
language plpgsql security definer set search_path = '' as $$
declare h text; tok text; n integer;
begin
  begin h := current_setting('request.headers', true); exception when others then return false; end;
  if h is null or h = '' then return false; end if;
  begin tok := (h::json) ->> 'x-envio-token'; exception when others then return false; end;
  if tok is null or length(tok) < 32 or length(tok) > 128 then return false; end if;
  update emergencia.envio_acessos set revogado_em = now() where token_hash = encode(extensions.digest(tok, 'sha256'), 'hex') and revogado_em is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.envio_codigo_emitir(text, text, text), public.envio_codigo_validar(text, text, text) from public, anon, authenticated;
grant execute on function public.envio_codigo_emitir(text, text, text), public.envio_codigo_validar(text, text, text) to service_role;
revoke all on function public.envio_sair() from public;
grant execute on function public.envio_sair() to anon, authenticated, service_role;

do $$ begin
  if has_function_privilege('anon', 'public.envio_codigo_emitir(text,text,text)', 'EXECUTE') or has_function_privilege('authenticated', 'public.envio_codigo_validar(text,text,text)', 'EXECUTE') then raise exception 'ENV2: funcoes de codigo acessiveis ao visitante: abortado'; end if;
  if not has_function_privilege('service_role', 'public.envio_codigo_emitir(text,text,text)', 'EXECUTE') then raise exception 'ENV2: service_role sem acesso: abortado'; end if;
end $$;

insert into public.joiners (cog, nome, email, twitter, confirmado) values ('zz_rev', 'T', 'r@exemplo.com', '@zz_rev', true);
do $$ declare t text; begin perform public.envio_codigo_emitir('zz_rev', repeat('a', 64), repeat('1', 64)); t := public.envio_codigo_validar('zz_rev', repeat('a', 64), repeat('1', 64)); if t is null then raise exception 'preparo do teste falhou'; end if; end $$;

update emergencia.envio_acessos set revogado_em = now() where obs = 'autoatendimento por e-mail' and revogado_em is null;
drop function if exists public.envio_codigo_emitir(text, text, text), public.envio_codigo_validar(text, text, text), public.envio_sair();
drop table if exists emergencia.envio_codigos;
do $$ begin
  if to_regclass('emergencia.envio_codigos') is not null or to_regprocedure('public.envio_codigo_emitir(text,text,text)') is not null then raise exception 'ENV2 reverter: restou objeto do ENV2: abortado'; end if;
end $$;

do $$ begin
  if exists (select 1 from emergencia.envio_acessos where joiner_cog = 'zz_rev' and revogado_em is null) then raise exception 'REVERSAO ENV2: acesso de autoatendimento ainda ativo'; end if;
  if to_regprocedure('public.envio_sair()') is not null then raise exception 'REVERSAO ENV2: funcao restante'; end if;
  raise exception 'ENV2_REVERSAO_OK: funcoes e tabela removidas e acessos de autoatendimento revogados (rollback: nada permanece)';
end $$;
