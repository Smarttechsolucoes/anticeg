-- ENSAIO (rollback) do ENV2: aplica o ENV2 numa transação, testa com papéis reais e termina em exceção. Nada permanece.
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

-- TESTES do ENV2 (rollback), com ENV1 + ENV2 aplicados dentro da transação. Joiners SINTÉTICAS (nenhum dado real é lido ou impresso; nenhum e-mail é enviado: o banco só devolve o destino).
do $t$
declare res text := ''; ok integer := 0; bad integer := 0; r text; tok text; n integer;
  h1 text := repeat('a', 64); h2 text := repeat('b', 64); h3 text := repeat('c', 64); hx text := repeat('d', 64);
  ip1 text := repeat('1', 64); ip2 text := repeat('2', 64); i integer; ex timestamptz;
begin
  insert into public.joiners (cog, nome, email, twitter, confirmado) values ('zz_cod_ok', 'T', 'cod-ok@exemplo.com', '@zz_cod_ok', true), ('zz_cod_sememail', 'T', null, '@zz_cod_sememail', true), ('zz_cod_bloq', 'T', 'b@exemplo.com', '@zz_cod_bloq', true), ('zz_cod_ip', 'T', 'ip@exemplo.com', '@zz_cod_ip', true), ('zz_cod_mal', 'T', 'sem-arroba', '@zz_cod_mal', true);
  update public.joiners set bloqueado = true where cog = 'zz_cod_bloq';

  -- T1: visitante e conta logada NÃO executam as funções de código
  execute 'set local role anon';
  begin perform public.envio_codigo_emitir('zz_cod_ok', h1, ip1); bad := bad + 1; res := res || 'FALHA T1 anon emitiu ; '; exception when insufficient_privilege then ok := ok + 1; end;
  begin perform public.envio_codigo_validar('zz_cod_ok', h1, ip1); bad := bad + 1; res := res || 'FALHA T1b anon validou ; '; exception when insufficient_privilege then ok := ok + 1; end;
  execute 'reset role'; execute 'set local role authenticated';
  begin perform public.envio_codigo_emitir('zz_cod_ok', h1, ip1); bad := bad + 1; res := res || 'FALHA T1c authenticated emitiu ; '; exception when insufficient_privilege then ok := ok + 1; end;
  execute 'reset role';

  -- T2..: como a Edge Function (service_role)
  execute 'set local role service_role';
  r := public.envio_codigo_emitir('zz_cod_ok', h1, ip1); if r = 'cod-ok@exemplo.com' then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T2 emitir ; '; end if;
  r := public.envio_codigo_emitir('zz_cod_ok', h2, ip1); if r is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T2b segundo pedido em 1 minuto aceito ; '; end if;
  if public.envio_codigo_emitir('zz_cod_inexistente', h2, ip1) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T2c @ inexistente ; '; end if;
  if public.envio_codigo_emitir('zz_cod_sememail', h2, ip1) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T2d sem e-mail ; '; end if;
  if public.envio_codigo_emitir('zz_cod_bloq', h2, ip1) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T2e bloqueada ; '; end if;
  if public.envio_codigo_emitir('zz_cod_mal', h2, ip1) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T2f e-mail invalido ; '; end if;
  if public.envio_codigo_emitir('zz_cod_ok', 'curto', ip1) is null and public.envio_codigo_emitir(null, h2, ip1) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T2g entrada invalida ; '; end if;

  -- T3: código errado conta tentativa; certo entrega o acesso
  if public.envio_codigo_validar('zz_cod_ok', hx, ip1) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3 codigo errado aceito ; '; end if;
  if public.envio_codigo_validar('zz_cod_inexistente', h1, ip1) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3b @ inexistente validou ; '; end if;
  tok := public.envio_codigo_validar('zz_cod_ok', h1, ip1);
  if tok ~ '^[0-9a-f]{48}$' then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3c codigo certo nao entregou o acesso ; '; end if;
  if public.envio_codigo_validar('zz_cod_ok', h1, ip1) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3d codigo reutilizado ; '; end if;
  execute 'reset role'; select expira_em into ex from emergencia.envio_acessos where token_hash = encode(extensions.digest(tok, 'sha256'), 'hex'); execute 'set local role service_role';
  if ex between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3e validade do acesso fora de 7 dias ; '; end if;

  -- T4: o acesso emitido funciona no ENV1 (cabeçalho) e só para a dona; depois "sair" revoga
  execute 'reset role'; execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.role', 'anon', true); perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.headers', json_build_object('x-envio-token', tok)::text, true);
  if public.envio_token_cog() = 'zz_cod_ok' and (public.envio_meu_acesso() ->> 'cog') = 'zz_cod_ok' then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T4 o acesso nao identifica a dona ; '; end if;
  if public.envio_sair() then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T4b sair nao revogou ; '; end if;
  if public.envio_token_cog() is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T4c acesso ainda vale depois de sair ; '; end if;
  if not public.envio_sair() then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T4d sair duas vezes ; '; end if;
  perform set_config('request.headers', '{}', true);
  if not public.envio_sair() then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T4e sair sem acesso ; '; end if;

  -- T5: código vencido, tentativas esgotadas, limite por hora
  execute 'reset role'; update emergencia.envio_codigos set criado_em = now() - interval '2 hours' where joiner_cog = 'zz_cod_ok';
  execute 'set local role service_role';
  r := public.envio_codigo_emitir('zz_cod_ok', h2, ip1); if r is not null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T5 novo codigo apos 2h recusado ; '; end if;
  execute 'reset role'; update emergencia.envio_codigos set expira_em = now() - interval '1 second' where joiner_cog = 'zz_cod_ok' and codigo_hash = h2;
  execute 'set local role service_role';
  if public.envio_codigo_validar('zz_cod_ok', h2, ip1) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T5b codigo vencido aceito ; '; end if;
  execute 'reset role'; update emergencia.envio_codigos set criado_em = now() - interval '3 minutes' where joiner_cog = 'zz_cod_ok';
  execute 'set local role service_role';
  r := public.envio_codigo_emitir('zz_cod_ok', h3, ip1); if r is not null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T5c ; '; end if;
  for i in 1..5 loop perform public.envio_codigo_validar('zz_cod_ok', hx, ip1); end loop;
  if public.envio_codigo_validar('zz_cod_ok', h3, ip1) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T5d 5 tentativas erradas nao bloquearam o codigo ; '; end if;
  execute 'reset role'; update emergencia.envio_codigos set criado_em = now() - interval '2 minutes' where joiner_cog = 'zz_cod_ok';
  execute 'set local role service_role';
  r := public.envio_codigo_emitir('zz_cod_ok', repeat('e', 64), ip1);   -- 3o codigo na ultima hora (os anteriores foram invalidados mas contam como pedidos? so contam os nao invalidados)
  execute 'reset role';
  select count(*) into n from emergencia.envio_codigos where joiner_cog = 'zz_cod_ok' and invalidado_em is null; if n <= 3 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T5e ; '; end if;

  -- T6: limite por IP (20 por hora)
  execute 'set local role service_role';
  for i in 1..20 loop perform public.envio_codigo_emitir('zz_inexistente_' || i, repeat('f', 64), ip2); end loop;
  if public.envio_codigo_emitir('zz_cod_ip', repeat('9', 64), ip2) is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T6 limite por IP ; '; end if;
  if public.envio_codigo_emitir('zz_cod_ip', repeat('9', 64), ip1) is not null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T6b outro IP recusado ; '; end if;
  execute 'reset role';

  raise exception E'ENV2_ENSAIO % | aprovados=% falhas=% | %', case when bad = 0 then 'OK' else 'COM FALHAS' end, ok, bad, res;
end $t$;
