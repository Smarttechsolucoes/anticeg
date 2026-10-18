-- TESTES do ENV1 (rollback): simulam visitante sem token, token errado/expirado/revogado, joiner com token, conta logada e administradora, usando os PAPÉIS reais do banco (anon / authenticated).
-- Nada permanece: o script termina SEMPRE em exceção. Os dados reais só são CONTADOS (nenhum valor pessoal é lido ou impresso).
do $t$
declare
  res text := ''; ok integer := 0; bad integer := 0;
  v_a text; v_b text; tok_a text; tok_b text; v_total integer; v_exp_a integer; v_exp_b integer; v_st_a integer; v_st_total integer;
  n integer; v_id bigint; v_admin uuid; v_conta uuid; v_conta_cog text; v_grupo text; j jsonb;
  rec record;
  procedure_dummy integer;
  hdr text;
begin
  select joiner_cog into v_a from public.envio_solicitacoes group by 1 order by count(*) desc limit 1;
  select joiner_cog into v_b from public.envio_solicitacoes where lower(btrim(joiner_cog)) <> lower(btrim(v_a)) group by 1 order by count(*) desc limit 1;
  select count(*) into v_total from public.envio_solicitacoes;
  select count(*) into v_exp_a from public.envio_solicitacoes where lower(btrim(joiner_cog)) = lower(btrim(v_a));
  select count(*) into v_exp_b from public.envio_solicitacoes where lower(btrim(joiner_cog)) = lower(btrim(v_b));
  select count(*) into v_st_a from public.joiner_storage where lower(btrim(joiner_cog)) = lower(btrim(v_a));
  select count(*) into v_st_total from public.joiner_storage;
  select codigo into v_grupo from public.grupos_envio limit 1;
  select user_id into v_admin from public.admin_roles where papel = 'admin' limit 1;
  select c.user_id, j2.cog into v_conta, v_conta_cog from public.contas_joiner c join public.joiners j2 on j2.id = c.joiner_id limit 1;
  tok_a := emergencia.gerar_acesso_envio(v_a, 14, 'ensaio');
  tok_b := emergencia.gerar_acesso_envio(v_b, 14, 'ensaio');

  -- ---------- T1..T3: visitante sem token, token errado, token da joiner A
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.headers', '{}', true);
  select count(*) into n from public.envio_solicitacoes;                         if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T1 visitante sem token viu ' || n || ' solicitacoes ; '; end if;
  select count(*) into n from public.grupos_envio;                               if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T1b grupos ; '; end if;
  select count(*) into n from public.joiner_storage;                             if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T1c storage ; '; end if;
  select count(*) into n from public.envio_requests;                             if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T1d requests ; '; end if;
  select count(*) into n from public.joiner_conferencias;                        if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T1e conferencias ; '; end if;
  begin select count(*) into n from public.rastreios; bad := bad + 1; res := res || 'FALHA T1f rastreios legivel ; '; exception when insufficient_privilege then ok := ok + 1; end;
  begin delete from public.envio_solicitacoes; bad := bad + 1; res := res || 'FALHA T1g visitante apagou ; '; exception when insufficient_privilege then ok := ok + 1; end;
  perform set_config('request.headers', json_build_object('x-envio-token', 'abcdef0123456789abcdef0123456789abcdef0123456789')::text, true);
  select count(*) into n from public.envio_solicitacoes;                         if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T2 token errado viu linhas ; '; end if;

  perform set_config('request.headers', json_build_object('x-envio-token', tok_a)::text, true);
  select count(*) into n from public.envio_solicitacoes;                         if n = v_exp_a and n > 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3 joiner A viu ' || n || ' esperado ' || v_exp_a || ' ; '; end if;
  select count(*) into n from public.envio_solicitacoes where lower(btrim(joiner_cog)) <> lower(btrim(v_a)); if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3b viu de outra ; '; end if;
  select count(*) into n from public.joiner_storage;                             if n = v_st_a then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3c storage ' || n || ' esperado ' || v_st_a || ' ; '; end if;
  begin select count(*) into n from public.rastreios; bad := bad + 1; res := res || 'FALHA T3d rastreios ; '; exception when insufficient_privilege then ok := ok + 1; end;
  begin select count(*) into n from emergencia.envio_acessos; bad := bad + 1; res := res || 'FALHA T3e tokens legiveis ; '; exception when insufficient_privilege then ok := ok + 1; end;
  begin delete from public.envio_solicitacoes where id = -1; bad := bad + 1; res := res || 'FALHA T3f delete ; '; exception when insufficient_privilege then ok := ok + 1; end;

  -- ---------- T4..T9: escrita da joiner A
  begin insert into public.envio_solicitacoes (joiner_cog, joiner_nome, destinatario, cpf, cep, endereco, numero, bairro, cidade, estado, itens, metodo, seguro, status) values (v_b, 'x', 'x', '0', '0', 'x', '1', 'x', 'x', 'SP', '[]', 'PAC', 'nao', 'solicitação de envio');
    bad := bad + 1; res := res || 'FALHA T4 inseriu para outra joiner ; ';
  exception when others then ok := ok + 1; end;
  begin insert into public.envio_solicitacoes (joiner_cog, joiner_nome, destinatario, cpf, cep, endereco, numero, bairro, cidade, estado, itens, metodo, seguro, status, cotacao_valor) values (v_a, 'x', 'x', '0', '0', 'x', '1', 'x', 'x', 'SP', '[]', 'PAC', 'nao', 'solicitação de envio', '1,00');
    bad := bad + 1; res := res || 'FALHA T4b inseriu com cotacao ; ';
  exception when others then ok := ok + 1; end;
  begin insert into public.envio_solicitacoes (joiner_cog, joiner_nome, destinatario, cpf, cep, endereco, numero, bairro, cidade, estado, itens, metodo, seguro, status) values (v_a, 'x', 'x', '0', '0', 'x', '1', 'x', 'x', 'SP', '[]', 'PAC', 'nao', 'enviado');
    bad := bad + 1; res := res || 'FALHA T4c inseriu como enviado ; ';
  exception when others then ok := ok + 1; end;
  insert into public.envio_solicitacoes (joiner_cog, joiner_nome, destinatario, cpf, cep, endereco, numero, bairro, cidade, estado, itens, metodo, seguro, status) values (v_a, 'ENSAIO', 'ENSAIO', '00000000000', '00000000', 'rua x', '1', 'x', 'x', 'SP', '[]', 'PAC', 'nao', 'solicitação de envio') returning id into v_id;
  ok := ok + 1;
  begin update public.envio_solicitacoes set status = 'enviado' where id = v_id; bad := bad + 1; res := res || 'FALHA T5 joiner mudou status para enviado ; '; exception when others then ok := ok + 1; end;
  begin update public.envio_solicitacoes set cotacao_valor = '0,01' where id = v_id; bad := bad + 1; res := res || 'FALHA T5b joiner mexeu em cotacao ; '; exception when others then ok := ok + 1; end;
  begin update public.envio_solicitacoes set cpf = '11111111111' where id = v_id; bad := bad + 1; res := res || 'FALHA T5c joiner alterou CPF apos criar ; '; exception when others then ok := ok + 1; end;
  begin update public.envio_solicitacoes set comprovante_url = 'http://evil' where id = v_id; bad := bad + 1; res := res || 'FALHA T6 comprovante invalido aceito ; '; exception when others then ok := ok + 1; end;
  update public.envio_solicitacoes set comprovante_url = v_id::text || '/comprovante_1760000000000.pdf' where id = v_id; ok := ok + 1;
  begin update public.envio_solicitacoes set modalidade_escolhida = '{"forma":"PAC","valor":"1","prazo":"1 dia"}'::jsonb where id = v_id; bad := bad + 1; res := res || 'FALHA T7 modalidade sem cotacao aceita ; '; exception when others then ok := ok + 1; end;

  -- a administração (acesso direto) cota; depois a joiner escolhe
  execute 'reset role'; perform set_config('request.jwt.claims', '{"role":"service_role"}', true); perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.envio_solicitacoes set cotacao_opcoes = '[{"forma":"PAC","valor":"20","prazo":"8 dias"},{"forma":"SEDEX","valor":"40","prazo":"3 dias"}]'::jsonb, status = 'pagamento em aberto', cotacao_valor = '20,00' where id = v_id;
  execute 'set local role anon'; perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.role', 'anon', true);
  begin update public.envio_solicitacoes set modalidade_escolhida = '{"forma":"PAC","valor":"0,01","prazo":"8 dias"}'::jsonb, status = 'pagamento em aberto' where id = v_id; bad := bad + 1; res := res || 'FALHA T8 modalidade com preco adulterado aceita ; '; exception when others then ok := ok + 1; end;
  update public.envio_solicitacoes set modalidade_escolhida = '{"forma":"SEDEX","valor":"40","prazo":"3 dias"}'::jsonb, status = 'pagamento em aberto' where id = v_id; ok := ok + 1;
  update public.envio_solicitacoes set status = 'cancelado' where id = v_id; ok := ok + 1;

  -- ---------- T10..T14: storage, conferência, rodada, grupo
  select count(*) into n from public.joiner_storage where ativo;
  begin update public.joiner_storage set foto_url = 'x' where id = (select min(id) from public.joiner_storage); if found then bad := bad + 1; res := res || 'FALHA T10 joiner trocou foto ; '; else ok := ok + 1; end if; exception when others then ok := ok + 1; end;
  begin update public.joiner_storage set ativo = false where id = (select min(id) from public.joiner_storage where ativo); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T10b joiner nao conseguiu retirar item proprio ; '; end;
  begin delete from public.joiner_storage; bad := bad + 1; res := res || 'FALHA T10c delete storage ; '; exception when insufficient_privilege then ok := ok + 1; end;
  begin insert into public.joiner_storage (joiner_cog, foto_url, descricao) values (v_a, 'x', 'x'); bad := bad + 1; res := res || 'FALHA T10d joiner inseriu storage ; '; exception when others then ok := ok + 1; end;
  begin insert into public.joiner_conferencias (joiner_cog, prazo_dias) values (v_a, 5); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T11 conferencia propria ; '; end;
  begin insert into public.joiner_conferencias (joiner_cog, prazo_dias) values (v_b, 5); bad := bad + 1; res := res || 'FALHA T11b conferencia de outra ; '; exception when others then ok := ok + 1; end;
  j := public.envio_solicitar_rodada('ensaio'); if j ? 'envio_rounds' and (j->>'joiner_cog') = v_a then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T12 rodada ; '; end if;
  if v_grupo is not null then if public.envio_grupo_por_codigo(v_grupo) is not null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T13 grupo com token ; '; end if; end if;
  begin insert into public.grupos_envio (codigo, host_cog) values ('ZZZZZ1', v_b); bad := bad + 1; res := res || 'FALHA T13b criou grupo para outra ; '; exception when others then ok := ok + 1; end;
  insert into public.grupos_envio (codigo, host_cog, destinatario) values ('ZZZZZ1', v_a, 'ENSAIO'); ok := ok + 1;
  j := public.envio_meu_acesso(); if (j->>'cog') = v_a then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T13c envio_meu_acesso ; '; end if;

  -- ---------- T15: token expirado e revogado
  execute 'reset role'; perform set_config('request.jwt.claims', '{"role":"service_role"}', true); perform set_config('request.jwt.claim.role', 'service_role', true);
  insert into emergencia.envio_acessos (joiner_cog, token_hash, expira_em) values (v_a, encode(extensions.digest('expirado0123456789abcdef0123456789abcdef01', 'sha256'), 'hex'), now() - interval '1 minute');
  insert into emergencia.envio_acessos (joiner_cog, token_hash, expira_em, revogado_em) values (v_a, encode(extensions.digest('revogado0123456789abcdef0123456789abcdef01', 'sha256'), 'hex'), now() + interval '1 day', now());
  execute 'set local role anon'; perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.headers', json_build_object('x-envio-token', 'expirado0123456789abcdef0123456789abcdef01')::text, true);
  select count(*) into n from public.envio_solicitacoes; if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T15 token expirado ; '; end if;
  perform set_config('request.headers', json_build_object('x-envio-token', 'revogado0123456789abcdef0123456789abcdef01')::text, true);
  select count(*) into n from public.envio_solicitacoes; if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T15b token revogado ; '; end if;
  perform set_config('request.headers', json_build_object('x-envio-token', tok_b)::text, true);
  select count(*) into n from public.envio_solicitacoes where lower(btrim(joiner_cog)) = lower(btrim(v_a)); if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T16 token de B viu A ; '; end if;
  select count(*) into n from public.envio_solicitacoes; if n = v_exp_b then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T16b B viu ' || n || ' esperado ' || v_exp_b || ' ; '; end if;

  -- ---------- T17: comprovante no bucket privado (regra de caminho/visitante)
  perform set_config('request.headers', json_build_object('x-envio-token', tok_a)::text, true);
  begin insert into storage.objects (bucket_id, name, owner) values ('envio-comprovantes', 'qualquer.txt', null); bad := bad + 1; res := res || 'FALHA T17 caminho livre aceito ; '; exception when others then ok := ok + 1; end;
  begin insert into storage.objects (bucket_id, name) values ('envio-comprovantes', '999999999/comprovante_1760000000000.pdf'); bad := bad + 1; res := res || 'FALHA T17b solicitacao inexistente aceita ; '; exception when others then ok := ok + 1; end;
  begin insert into storage.objects (bucket_id, name) values ('envio-comprovantes', v_id::text || '/comprovante_1760000000001.pdf'); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T17c envio valido recusado: ' || sqlerrm || ' ; '; end;
  begin select count(*) into n from storage.objects where bucket_id = 'envio-comprovantes'; if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T17d visitante le comprovantes ; '; end if; exception when others then ok := ok + 1; end;

  -- ---------- T18: administradora (papel authenticated + conta admin) mantém TUDO
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.headers', '{}', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', v_admin::text, true); perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*) into n from public.envio_solicitacoes; if n >= v_total then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T18 admin ve ' || n || ' de ' || v_total || ' ; '; end if;
  select count(*) into n from public.joiner_storage; if n >= v_st_total then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T18b admin storage ; '; end if;
  select count(*) into n from public.rastreios; ok := ok + 1;
  select count(*) into n from public.grupos_envio; ok := ok + 1;
  begin update public.envio_solicitacoes set status = 'embalando', rastreio_codigo = 'ENSAIO' where id = v_id; ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T18c admin nao escreve: ' || sqlerrm || ' ; '; end;
  begin insert into public.joiner_storage (joiner_cog, foto_url, descricao) values (v_a, 'ensaio', 'ensaio'); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T18d admin nao insere storage ; '; end;
  begin insert into public.rastreios (codigo, transportadora) values ('ENSAIO', 'x'); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T18e admin nao insere rastreio: ' || sqlerrm || ' ; '; end;
  begin delete from public.rastreios where codigo = 'ENSAIO'; ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T18f admin nao apaga ; '; end;
  begin select count(*) into n from storage.objects where bucket_id = 'envio-comprovantes'; if n >= 1 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T18g admin nao le comprovantes ; '; end if; exception when others then bad := bad + 1; res := res || 'FALHA T18g ' || sqlerrm || ' ; '; end;

  -- ---------- T19: conta logada (authenticated, sem admin) vê só o próprio
  if v_conta is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_conta, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', v_conta::text, true);
    select count(*) into n from public.envio_solicitacoes where lower(btrim(joiner_cog)) <> lower(btrim(v_conta_cog)); if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T19 conta logada viu de outra ; '; end if;
  end if;
  execute 'reset role';
  raise exception E'ENV1_ENSAIO % | aprovados=% falhas=% | %', case when bad = 0 then 'OK' else 'COM FALHAS' end, ok, bad, res;
end $t$;
