-- N0 (v3, estrutural) — TESTE DE FUMAÇA COM DESFAZIMENTO AUTOMÁTICO. Rode DEPOIS do N0_tabela_notifications_aplicar.sql e do _verificar. NADA FICA GRAVADO.
-- Prova que a tabela está FECHADA: visitante, logada comum e até a administradora logada NÃO leem, criam, alteram nem apagam pela API (sem privilégio e sem policy), nenhuma função pública de notificação existe,
--   e o servidor (service_role) consegue escrever e ler (informativo se o papel não puder ser assumido neste ambiente).
-- Tudo dentro de UM bloco DO que termina com um ERRO proposital ("N0 FUMAÇA ..."), o que desfaz a transação inteira (a linha de teste do servidor some). Nenhuma notificação, e-mail ou push real é disparado (só SQL).
-- Único efeito que não é desfeito: a numeração (identity) de notifications avança 1 número (nenhum dado).
do $$
declare
  rep text := ''; falhas int := 0; v_admin uuid; v_outra uuid := gen_random_uuid(); n int; v_cog text := 'zz_teste_n0_' || substr(md5(random()::text), 1, 8); v_role text;
begin
  if to_regclass('public.notifications') is null then raise exception 'N0 FUMAÇA: public.notifications não existe (nada foi tocado)'; end if;
  select user_id into v_admin from public.admin_roles order by user_id limit 1;

  -- 1) VISITANTE
  set local role anon;
  begin perform 1 from public.notifications limit 1; rep := rep || E'FALHA visitante leu a tabela\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO lê (42501)\n'; else rep := rep || E'FALHA leitura (visitante): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin insert into public.notifications (joiner_cog, message, type) values (v_cog, 'falsa', 'pagamento'); rep := rep || E'FALHA visitante criou notificação\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO cria (42501)\n'; else rep := rep || E'FALHA criar (visitante): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin update public.notifications set read_at = now(); rep := rep || E'FALHA visitante alterou\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO altera (42501)\n'; else rep := rep || E'FALHA alterar (visitante): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin delete from public.notifications; rep := rep || E'FALHA visitante apagou\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO apaga (42501)\n'; else rep := rep || E'FALHA apagar (visitante): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin truncate public.notifications; rep := rep || E'FALHA visitante truncou\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO trunca (42501)\n'; else rep := rep || E'FALHA truncar (visitante): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  reset role;

  -- 2) LOGADA comum e ADMINISTRADORA logada: também nada pela API
  foreach v_role in array array['comum', 'admin'] loop
    if v_role = 'admin' and v_admin is null then continue; end if;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', case when v_role = 'admin' then v_admin else v_outra end, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', (case when v_role = 'admin' then v_admin else v_outra end)::text, true);
    set local role authenticated;
    begin perform 1 from public.notifications limit 1; rep := rep || E'FALHA logada (' || v_role || E') leu a tabela\n'; falhas := falhas + 1;
    exception when others then if sqlstate = '42501' then rep := rep || E'OK    logada (' || v_role || E') NÃO lê (42501)\n'; else rep := rep || E'FALHA leitura (' || v_role || E'): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
    begin insert into public.notifications (joiner_cog, message, type) values (v_cog, 'falsa', 'pagamento'); rep := rep || E'FALHA logada (' || v_role || E') criou notificação\n'; falhas := falhas + 1;
    exception when others then if sqlstate = '42501' then rep := rep || E'OK    logada (' || v_role || E') NÃO cria (42501)\n'; else rep := rep || E'FALHA criar (' || v_role || E'): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
    begin delete from public.notifications; rep := rep || E'FALHA logada (' || v_role || E') apagou\n'; falhas := falhas + 1;
    exception when others then if sqlstate = '42501' then rep := rep || E'OK    logada (' || v_role || E') NÃO apaga (42501)\n'; else rep := rep || E'FALHA apagar (' || v_role || E'): erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
    reset role;
  end loop;

  -- 3) nenhuma função pública de notificação (nada para um visitante explorar informando o @ de outra pessoa)
  select count(*) into n from pg_proc where pronamespace = 'public'::regnamespace and proname in ('minhas_notificacoes', 'marcar_notificacao_lida');
  if n = 0 then rep := rep || E'OK    nenhuma função pública de notificação existe\n'; else rep := rep || E'FALHA existem ' || n || E' função(ões) de notificação\n'; falhas := falhas + 1; end if;

  -- 4) o SERVIDOR consegue (o J4c-4c e as futuras funções de servidor dependem disso)
  begin
    set local role service_role;
    insert into public.notifications (joiner_cog, message, type) values (v_cog, 'teste do servidor', 'teste');
    select count(*) into n from public.notifications where joiner_cog = v_cog;
    reset role;
    if n = 1 then rep := rep || E'OK    o servidor (service_role) cria e lê\n'; else rep := rep || E'FALHA o servidor não leu a linha criada\n'; falhas := falhas + 1; end if;
  exception when others then reset role; rep := rep || E'(informativo) não foi possível assumir o papel service_role neste ambiente: ' || sqlstate || E'\n'; end;

  if falhas = 0 then raise exception E'N0 FUMAÇA OK (todas as verificações passaram; NADA foi gravado, este erro é proposital):\n%', rep;
  else raise exception E'N0 FUMAÇA FALHA (% falha(s); NADA foi gravado):\n%', falhas, rep; end if;
end $$;
