-- R1 — TESTE DE PERMISSÕES NÃO DESTRUTIVO. Rode DEPOIS do R1_admin_pagamentos_aplicar.sql e do _verificar. NÃO cria, altera nem apaga NENHUM dado e NÃO usa dados reais de joiners.
-- Só chama as funções do R1 com um id que NÃO existe (-1). Assim:
--   ☆ visitante (anon)          → deve ser NEGADO pelo banco (permission denied, 42501), antes de qualquer leitura;
--   ☆ logada que NÃO é admin    → deve ser NEGADA pela função ("sem permissão"), antes de qualquer leitura;
--   ☆ administradora            → deve PASSAR pela autorização e parar em "demanda não encontrada" (nenhuma linha existe, nada é gravado) e em "nao_encontrado" (UPDATE em 0 linhas).
-- Também confere que o registro interno de marcações (emergencia.pagamento_marcacoes) é inacessível a visitante e a logado (apenas tenta ler; nada é gravado).
-- Nenhuma tabela é escrita (os UPDATE/SELECT FOR UPDATE casam com 0 linhas), nenhum gatilho dispara, nenhuma notificação/HTTP existe aqui. Para garantir, o bloco termina com um ERRO proposital ("R1 PERMISSÕES ...") que desfaz a transação
--   inteira, e o texto do erro é o relatório. Não avança sequência alguma (não há INSERT). Se aparecer "R1 PERMISSÕES OK" tudo passou; "R1 PERMISSÕES FALHA" lista o que falhou.
do $$
declare
  rep text := ''; falhas int := 0; v_admin uuid; v_outra uuid := gen_random_uuid(); v_msg text; r jsonb;
begin
  select user_id into v_admin from public.admin_roles order by user_id limit 1;
  if v_admin is null then raise exception 'R1 PERMISSÕES: nenhuma administradora em admin_roles (nada foi tocado)'; end if;

  -- 1) visitante
  set local role anon;
  begin
    perform public.admin_definir_status_pagamento(-1, 'pago');
    rep := rep || E'FALHA visitante executou admin_definir_status_pagamento\n'; falhas := falhas + 1;
  exception when others then
    if sqlstate = '42501' then rep := rep || E'OK    visitante negado em admin_definir_status_pagamento (42501 permission denied)\n';
    else rep := rep || E'FALHA visitante: erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if;
  end;
  begin
    perform public.admin_marcar_pago(-1, true, false, false);
    rep := rep || E'FALHA visitante executou admin_marcar_pago\n'; falhas := falhas + 1;
  exception when others then
    if sqlstate = '42501' then rep := rep || E'OK    visitante negado em admin_marcar_pago (42501 permission denied)\n';
    else rep := rep || E'FALHA visitante (marcar): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if;
  end;
  reset role;

  -- 2) logada que não é admin (usuário aleatório que não existe em admin_roles)
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outra, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outra::text, true);
  set local role authenticated;
  begin
    perform public.admin_definir_status_pagamento(-1, 'pago');
    rep := rep || E'FALHA logada sem ser admin passou da autorização (admin_definir_status_pagamento)\n'; falhas := falhas + 1;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg = 'sem permissão' then rep := rep || E'OK    logada sem ser admin negada ("sem permissão") em admin_definir_status_pagamento\n';
    else rep := rep || E'FALHA logada sem ser admin: mensagem inesperada: ' || v_msg || E'\n'; falhas := falhas + 1; end if;
  end;
  begin
    perform public.admin_marcar_pago(-1, true, false, false);
    rep := rep || E'FALHA logada sem ser admin passou da autorização (admin_marcar_pago)\n'; falhas := falhas + 1;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg = 'sem permissão' then rep := rep || E'OK    logada sem ser admin negada ("sem permissão") em admin_marcar_pago\n';
    else rep := rep || E'FALHA logada sem ser admin (marcar): mensagem inesperada: ' || v_msg || E'\n'; falhas := falhas + 1; end if;
  end;
  reset role;

  -- 3) administradora: passa pela autorização e para na busca (id -1 não existe => nada é lido nem gravado)
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    perform public.admin_definir_status_pagamento(-1, 'pago');
    rep := rep || E'FALHA administradora: esperava "demanda não encontrada"\n'; falhas := falhas + 1;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg = 'demanda não encontrada' then rep := rep || E'OK    administradora passa pela autorização e para em "demanda não encontrada" (id -1; nada gravado)\n';
    else rep := rep || E'FALHA administradora (definir): mensagem inesperada: ' || v_msg || E'\n'; falhas := falhas + 1; end if;
  end;
  begin
    r := public.admin_marcar_pago(-1, true, false, false);
    if r ->> 'status' = 'nao_encontrado' then rep := rep || E'OK    administradora passa pela autorização e recebe nao_encontrado em admin_marcar_pago (0 linhas afetadas)\n';
    else rep := rep || E'FALHA administradora (marcar): resposta inesperada ' || r::text || E'\n'; falhas := falhas + 1; end if;
  exception when others then rep := rep || E'FALHA administradora (marcar): erro ' || sqlstate || E'\n'; falhas := falhas + 1;
  end;
  reset role;

  -- 4) status inválido é recusado antes de ler dados (administradora)
  set local role authenticated;
  begin
    perform public.admin_definir_status_pagamento(-1, 'qualquer_coisa');
    rep := rep || E'FALHA status inválido aceito\n'; falhas := falhas + 1;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg = 'status inválido' then rep := rep || E'OK    status inválido recusado\n'; else rep := rep || E'FALHA status inválido: mensagem inesperada: ' || v_msg || E'\n'; falhas := falhas + 1; end if;
  end;
  reset role;

  -- 5) o registro interno de marcações (emergencia.pagamento_marcacoes) é inacessível a visitante e a logado (só leitura de teste; nada é gravado)
  set local role anon;
  begin
    perform 1 from emergencia.pagamento_marcacoes limit 1;
    rep := rep || E'FALHA visitante leu o registro interno de marcações
'; falhas := falhas + 1;
  exception when others then
    if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO acessa o registro interno de marcações (42501)
'; else rep := rep || E'FALHA registro interno (visitante): erro inesperado ' || sqlstate || E'
'; falhas := falhas + 1; end if;
  end;
  reset role;
  set local role authenticated;
  begin
    perform 1 from emergencia.pagamento_marcacoes limit 1;
    rep := rep || E'FALHA logada leu o registro interno de marcações
'; falhas := falhas + 1;
  exception when others then
    if sqlstate = '42501' then rep := rep || E'OK    logada NÃO acessa o registro interno de marcações (42501)
'; else rep := rep || E'FALHA registro interno (logada): erro inesperado ' || sqlstate || E'
'; falhas := falhas + 1; end if;
  end;
  reset role;

  if falhas = 0 then raise exception E'R1 PERMISSÕES OK (todas as verificações passaram; NADA foi gravado, este erro é proposital):\n%', rep;
  else raise exception E'R1 PERMISSÕES FALHA (% falha(s); NADA foi gravado):\n%', falhas, rep; end if;
end $$;
