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
