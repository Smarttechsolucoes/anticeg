-- N0 (v2, fechada) — TESTE DE FUMAÇA COM DESFAZIMENTO AUTOMÁTICO. Rode DEPOIS do N0_tabela_notifications_aplicar.sql e do _verificar. NADA FICA GRAVADO.
-- Prova o ISOLAMENTO: visitante e logado não leem nem escrevem na tabela; só a administradora cria; a leitura por @ devolve só as não lidas daquele @; marcar como lida só vale para o @ certo.
-- Tudo dentro de UM bloco DO que termina com um ERRO proposital ("N0 FUMAÇA ..."), o que desfaz a transação inteira (as linhas de teste somem). Nenhuma notificação, e-mail ou push real é disparado (só SQL).
-- Usa a primeira administradora de admin_roles e @s de teste inexistentes (zz_teste_n0_*). Único efeito que não é desfeito: a numeração (identity) avança alguns números (nenhum dado).
do $$
declare
  rep text := ''; falhas int := 0; v_admin uuid; v_outra uuid := gen_random_uuid(); n int; b boolean;
  v_a text := 'zz_teste_n0_a_' || substr(md5(random()::text), 1, 6); v_b text := 'zz_teste_n0_b_' || substr(md5(random()::text), 1, 6); v_id_a bigint; v_id_b bigint;
begin
  if to_regclass('public.notifications') is null then raise exception 'N0 FUMAÇA: public.notifications não existe (nada foi tocado)'; end if;
  select user_id into v_admin from public.admin_roles order by user_id limit 1;
  if v_admin is null then raise exception 'N0 FUMAÇA: nenhuma administradora em admin_roles (nada foi tocado)'; end if;

  -- 1) VISITANTE: nada direto na tabela
  set local role anon;
  begin perform 1 from public.notifications limit 1; rep := rep || E'FALHA visitante leu a tabela\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO lê a tabela (42501)\n'; else rep := rep || E'FALHA leitura (visitante): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin insert into public.notifications (joiner_cog, message, type) values (v_a, 'falsa', 'pagamento'); rep := rep || E'FALHA visitante criou notificação (falsa)\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO cria notificação (42501)\n'; else rep := rep || E'FALHA criar (visitante): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin update public.notifications set read_at = now(); rep := rep || E'FALHA visitante alterou a tabela\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO altera nem marca direto (42501)\n'; else rep := rep || E'FALHA alterar (visitante): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin delete from public.notifications; rep := rep || E'FALHA visitante apagou\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO apaga (42501)\n'; else rep := rep || E'FALHA apagar (visitante): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  reset role;

  -- 2) LOGADO que NÃO é administradora: não cria (RLS) e não lê direto
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outra, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outra::text, true);
  set local role authenticated;
  begin insert into public.notifications (joiner_cog, message, type) values (v_a, 'falsa', 'pagamento'); rep := rep || E'FALHA logada sem ser admin criou notificação\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    logada sem ser administradora NÃO cria notificação (42501)\n'; else rep := rep || E'FALHA criar (logada): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin perform 1 from public.notifications limit 1; rep := rep || E'FALHA logada leu a tabela\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    logada NÃO lê a tabela direto (42501)\n'; else rep := rep || E'FALHA leitura (logada): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  reset role;

  -- 3) ADMINISTRADORA cria 2 notificações para @s diferentes (e 1 já lida para o @ A)
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    -- sem RETURNING (como o painel faz): a administradora cria, mas não tem leitura direta da tabela
    insert into public.notifications (joiner_cog, message, type, report_id) values (v_a, 'para A', 'report_resolved', 1);
    insert into public.notifications (joiner_cog, message, type) values (v_b, 'para B', 'envio_address_request');
    rep := rep || E'OK    administradora cria notificações\n';
  exception when others then rep := rep || E'FALHA administradora não conseguiu criar: ' || sqlstate || E'\n'; falhas := falhas + 1; end;
  reset role;

  select id into v_id_a from public.notifications where joiner_cog = v_a;
  select id into v_id_b from public.notifications where joiner_cog = v_b;

  -- 4) LEITURA POR @ (como visitante): só as não lidas daquele @; nada de curinga; nada entre joiners
  set local role anon;
  begin
    select count(*) into n from public.minhas_notificacoes(v_a);
    if n = 1 then rep := rep || E'OK    o @ A recebe só a notificação dele (1)\n'; else rep := rep || E'FALHA o @ A recebeu ' || n || E'\n'; falhas := falhas + 1; end if;
    select count(*) into n from public.minhas_notificacoes(v_a) where joiner_cog <> v_a;
    if n = 0 then rep := rep || E'OK    nenhuma notificação de outro @ aparece na consulta do A\n'; else rep := rep || E'FALHA apareceu notificação de outro @\n'; falhas := falhas + 1; end if;
    select count(*) into n from public.minhas_notificacoes('%');
    if n = 0 then rep := rep || E'OK    curinga "%" não lista ninguém\n'; else rep := rep || E'FALHA curinga listou ' || n || E'\n'; falhas := falhas + 1; end if;
    select count(*) into n from public.minhas_notificacoes(null); if n = 0 then rep := rep || E'OK    @ nulo não lista ninguém\n'; else rep := rep || E'FALHA @ nulo listou\n'; falhas := falhas + 1; end if;
    select count(*) into n from public.minhas_notificacoes('');   if n = 0 then rep := rep || E'OK    @ vazio não lista ninguém\n'; else rep := rep || E'FALHA @ vazio listou\n'; falhas := falhas + 1; end if;
  exception when others then rep := rep || E'FALHA leitura por @: erro ' || sqlstate || E'\n'; falhas := falhas + 1; end;

  -- 5) MARCAR COMO LIDA: só o id do @ certo
  begin
    b := public.marcar_notificacao_lida(v_id_a, v_b);
    if b is false then rep := rep || E'OK    marcar a notificação do A informando o @ B é RECUSADO (false)\n'; else rep := rep || E'FALHA marcou a notificação de outra joiner\n'; falhas := falhas + 1; end if;
    b := public.marcar_notificacao_lida(v_id_a, v_a);
    if b is true then rep := rep || E'OK    marcar com o @ certo funciona (true)\n'; else rep := rep || E'FALHA não marcou com o @ certo\n'; falhas := falhas + 1; end if;
    select count(*) into n from public.minhas_notificacoes(v_a);
    if n = 0 then rep := rep || E'OK    depois de lida, some da lista do A\n'; else rep := rep || E'FALHA continua na lista\n'; falhas := falhas + 1; end if;
    select count(*) into n from public.minhas_notificacoes(v_b);
    if n = 1 then rep := rep || E'OK    a notificação do B continua intacta e não lida (1)\n'; else rep := rep || E'FALHA a do B mudou (' || n || E')\n'; falhas := falhas + 1; end if;
  exception when others then rep := rep || E'FALHA marcar como lida: erro ' || sqlstate || E'\n'; falhas := falhas + 1; end;
  reset role;

  if falhas = 0 then raise exception E'N0 FUMAÇA OK (todas as verificações passaram; NADA foi gravado, este erro é proposital):\n%', rep;
  else raise exception E'N0 FUMAÇA FALHA (% falha(s); NADA foi gravado):\n%', falhas, rep; end if;
end $$;
