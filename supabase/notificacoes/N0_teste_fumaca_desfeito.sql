-- N0 — TESTE DE FUMAÇA COM DESFAZIMENTO AUTOMÁTICO. Rode DEPOIS do N0_tabela_notifications_aplicar.sql e do _verificar. NADA FICA GRAVADO.
-- Faz, como visitante (anon) e como logado, exatamente o que o site faz com a tabela: criar uma notificação, lê-la, marcá-la como lida (só read_at) — e confere que o resto é negado (alterar mensagem/destinatário/report_id, apagar, truncar).
-- Tudo dentro de UM bloco DO que termina com um ERRO proposital ("N0 FUMAÇA ..."), o que desfaz a transação inteira (a linha de teste some). Nenhuma notificação, e-mail ou push é disparado (só SQL).
-- Único efeito que não é desfeito: a numeração (identity) de notifications avança 2 números (nenhum dado).
do $$
declare
  rep text := ''; falhas int := 0; v_id bigint; n int; v_msg text; v_cog text := 'zz_teste_n0_' || substr(md5(random()::text), 1, 8);
begin
  if to_regclass('public.notifications') is null then raise exception 'N0 FUMAÇA: public.notifications não existe (nada foi tocado)'; end if;
  if (select count(*) from public.notifications) > 0 then rep := rep || E'(informativo) a tabela já tem linhas; o teste só usa a sua própria linha\n'; end if;

  -- 1) VISITANTE: o que o site faz (criar, ler, marcar como lida)
  set local role anon;
  begin
    insert into public.notifications (joiner_cog, message, type, report_id) values (v_cog, 'teste de fumaça', 'report_resolved', 1) returning id into v_id;
    rep := rep || E'OK    visitante cria notificação (com report_id)\n';
  exception when others then rep := rep || E'FALHA visitante não conseguiu criar: ' || sqlstate || E'\n'; falhas := falhas + 1; end;
  begin
    select count(*) into n from public.notifications where joiner_cog = v_cog and read_at is null;
    if n = 1 then rep := rep || E'OK    visitante lê a notificação não lida (consulta do site)\n'; else rep := rep || E'FALHA leitura devolveu ' || n || E' linhas\n'; falhas := falhas + 1; end if;
  exception when others then rep := rep || E'FALHA visitante não conseguiu ler: ' || sqlstate || E'\n'; falhas := falhas + 1; end;
  begin
    update public.notifications set read_at = now() where id = v_id;
    select count(*) into n from public.notifications where joiner_cog = v_cog and read_at is null;
    if n = 0 then rep := rep || E'OK    visitante marca como lida (read_at)\n'; else rep := rep || E'FALHA marcar como lida não valeu\n'; falhas := falhas + 1; end if;
  exception when others then rep := rep || E'FALHA visitante não conseguiu marcar como lida: ' || sqlstate || E'\n'; falhas := falhas + 1; end;

  -- 2) VISITANTE: o que NÃO pode
  begin update public.notifications set message = 'x' where id = v_id; rep := rep || E'FALHA visitante alterou a mensagem\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO altera a mensagem (42501)\n'; else rep := rep || E'FALHA alterar mensagem: erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin update public.notifications set joiner_cog = 'outra' where id = v_id; rep := rep || E'FALHA visitante trocou o destinatário\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO troca o destinatário (42501)\n'; else rep := rep || E'FALHA trocar destinatário: erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin delete from public.notifications where id = v_id; rep := rep || E'FALHA visitante apagou\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO apaga (42501)\n'; else rep := rep || E'FALHA apagar: erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  begin truncate public.notifications; rep := rep || E'FALHA visitante truncou\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    visitante NÃO trunca (42501)\n'; else rep := rep || E'FALHA truncar: erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  reset role;

  -- 3) LOGADO (qualquer conta autenticada, como as joiners do piloto): mesmo conjunto mínimo
  perform set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.notifications (joiner_cog, message, type) values (v_cog, 'teste logado', 'teste');
    rep := rep || E'OK    logado cria notificação\n';
  exception when others then rep := rep || E'FALHA logado não conseguiu criar: ' || sqlstate || E'\n'; falhas := falhas + 1; end;
  begin delete from public.notifications where joiner_cog = v_cog; rep := rep || E'FALHA logado apagou\n'; falhas := falhas + 1;
  exception when others then if sqlstate = '42501' then rep := rep || E'OK    logado NÃO apaga (42501)\n'; else rep := rep || E'FALHA logado apagar: erro inesperado ' || sqlstate || E'\n'; falhas := falhas + 1; end if; end;
  reset role;

  if falhas = 0 then raise exception E'N0 FUMAÇA OK (todas as verificações passaram; NADA foi gravado, este erro é proposital):\n%', rep;
  else raise exception E'N0 FUMAÇA FALHA (% falha(s); NADA foi gravado):\n%', falhas, rep; end if;
end $$;
