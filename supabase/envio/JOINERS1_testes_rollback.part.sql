-- TESTES do JOINERS1 (rollback), com ENV1 + JOINERS1 aplicados dentro da transação. Papéis reais anon/authenticated. Dados reais só são CONTADOS (nada pessoal é lido ou impresso).
do $t$
declare res text := ''; ok integer := 0; bad integer := 0; n integer; v_a text; tok_a text; v_admin uuid; v_conta uuid; v_conta_cog text; j jsonb; v_cep_antes text;
  hidden text[] := array['cpf','cep','rua','numero','complemento','bairro','cidade','estado','nome_entrega'];
  h text; v_total integer;
begin
  select count(*) into v_total from public.joiners;
  select joiner_cog into v_a from public.envio_solicitacoes group by 1 order by count(*) desc limit 1;
  select user_id into v_admin from public.admin_roles where papel = 'admin' limit 1;
  select c.user_id, j2.cog into v_conta, v_conta_cog from public.contas_joiner c join public.joiners j2 on j2.id = c.joiner_id limit 1;
  tok_a := emergencia.gerar_acesso_envio(v_a, 14, 'ensaio');
  select cep into v_cep_antes from public.joiners where lower(btrim(cog)) = lower(btrim(v_a)) limit 1;

  -- ---------- visitante (sem token)
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.role', 'anon', true); perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.headers', '{}', true);
  begin perform id, cog, nome, email, twitter, whatsapp, foto_perfil, last_seen, bloqueado, confirmado, last_notified_at, saldo_cashback, nome_site, telefone, recrutador from public.joiners limit 1; ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA J1 colunas publicas nao legiveis: ' || sqlerrm || ' ; '; end;
  select count(*) into n from public.joiners; if n = v_total then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA J1b contagem publica ' || n || ' de ' || v_total || ' ; '; end if;
  foreach h in array hidden loop
    begin execute format('select %I from public.joiners limit 1', h); bad := bad + 1; res := res || 'FALHA J2 visitante le ' || h || ' ; '; exception when insufficient_privilege then ok := ok + 1; end;
    begin execute format('update public.joiners set %I = %I where false', h, h); bad := bad + 1; res := res || 'FALHA J3 visitante grava ' || h || ' ; '; exception when insufficient_privilege then ok := ok + 1; end;
  end loop;
  begin perform * from public.joiners limit 1; bad := bad + 1; res := res || 'FALHA J4 select * funcionou para o visitante ; '; exception when insufficient_privilege then ok := ok + 1; end;
  begin update public.joiners set last_seen = now() where lower(btrim(cog)) = lower(btrim(v_a)); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA J5 visitante nao atualiza last_seen: ' || sqlerrm || ' ; '; end;
  begin update public.joiners set nome_site = nome_site, foto_perfil = foto_perfil, whatsapp = whatsapp, email = email, saldo_cashback = saldo_cashback, recrutador = recrutador, bloqueado = bloqueado where false; ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA J5b colunas publicas nao atualizaveis: ' || sqlerrm || ' ; '; end;
  begin insert into public.joiners (cog, nome, email, twitter, whatsapp, confirmado) values ('zz_ensaio_j1', 'Ensaio', 'ensaio@exemplo.com', '@zz_ensaio_j1', null, false); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA J6 cadastro (insert) quebrou: ' || sqlerrm || ' ; '; end;
  begin perform public.envio_salvar_dados('{"cep":"00000000"}'::jsonb); bad := bad + 1; res := res || 'FALHA J7 salvar dados sem token funcionou ; '; exception when others then ok := ok + 1; end;
  if public.envio_meus_dados() is null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA J7b dados sem token ; '; end if;

  -- ---------- joiner com o link pessoal
  perform set_config('request.headers', json_build_object('x-envio-token', tok_a)::text, true);
  j := public.envio_meus_dados(); if j is not null and j ? 'cpf' then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA J8 dados proprios com token ; '; end if;
  begin if public.envio_salvar_dados('{"cep":"12345678","estado":"sp","cidade":"Ensaio"}'::jsonb) then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA J9 salvar devolveu falso ; '; end if; exception when others then bad := bad + 1; res := res || 'FALHA J9 salvar: ' || sqlerrm || ' ; '; end;
  j := public.envio_meus_dados(); if (j ->> 'cep') = '12345678' and (j ->> 'estado') = 'SP' then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA J9b valor salvo nao confere ; '; end if;
  begin perform public.envio_salvar_dados('{"saldo_cashback":1000}'::jsonb); bad := bad + 1; res := res || 'FALHA J10 campo nao permitido aceito ; '; exception when others then ok := ok + 1; end;
  begin perform public.envio_salvar_dados('{"cpf":"x"}'::jsonb || jsonb_build_object('bairro', repeat('a', 500))); bad := bad + 1; res := res || 'FALHA J10b valor gigante aceito ; '; exception when others then ok := ok + 1; end;
  begin perform public.envio_salvar_dados('[]'::jsonb); bad := bad + 1; res := res || 'FALHA J10c formato invalido aceito ; '; exception when others then ok := ok + 1; end;

  -- ---------- administração (authenticated + conta admin) lê tudo
  execute 'reset role'; execute 'set local role authenticated';
  perform set_config('request.headers', '{}', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', v_admin::text, true); perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin select count(*) into n from public.joiners where cpf is not null or cep is not null; if n >= 0 then ok := ok + 1; end if; exception when others then bad := bad + 1; res := res || 'FALHA J11 admin nao le cpf/cep: ' || sqlerrm || ' ; '; end;
  begin perform * from public.joiners limit 1; ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA J11b admin select *: ' || sqlerrm || ' ; '; end;
  begin update public.joiners set cep = cep where false; ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA J11c admin nao grava: ' || sqlerrm || ' ; '; end;

  -- ---------- conta logada comum não lê joiners dos outros
  if v_conta is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_conta, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', v_conta::text, true);
    select count(*) into n from public.joiners where lower(btrim(cog)) <> lower(btrim(v_conta_cog)); if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA J12 conta comum viu ' || n || ' joiners ; '; end if;
  end if;
  execute 'reset role';
  raise exception E'JOINERS1_ENSAIO % | aprovados=% falhas=% | %', case when bad = 0 then 'OK' else 'COM FALHAS' end, ok, bad, res;
end $t$;
