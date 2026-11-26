-- E1 — AGENDADOR DA FILA, PLANO B (o plano A, mais simples, é o gatilho do Apps Script em appsscript/ATUALIZAR_CADASTRO.gs). PROPOSTA; NÃO APLICAR sem aprovação separada. NÃO TESTADO aqui: o laboratório (PGlite) não tem pg_cron, pg_net nem o cofre do Supabase.
-- Faz a função perfil-sync rodar sozinha a cada minuto (a fila do E1 já tem espera crescente entre tentativas e para depois de 6; chamar sem itens não faz nada).
-- Antes de aplicar, no painel do Supabase: (1) Database > Extensions: ligar pg_cron e pg_net; (2) guardar a chave de serviço no cofre (Vault) com o nome perfil_sync_chave
--   (create via painel ou: select vault.create_secret('<chave de serviço do projeto>', 'perfil_sync_chave');). A chave NUNCA vai neste arquivo nem no repositório.
-- Reversão: E1_agendador_reverter.sql (desagenda). Desligar é só isso; a fila continua existindo e o botão em Admin > Contas continua funcionando.
begin;
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then raise exception 'pg_cron não está ligado. Nada foi alterado.'; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then raise exception 'pg_net não está ligado. Nada foi alterado.'; end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'perfil_sync_chave') then raise exception 'O segredo perfil_sync_chave não existe no cofre. Nada foi alterado.'; end if;
  if to_regclass('public.cadastro_tarefas') is null then raise exception 'E1 não está aplicado. Nada foi alterado.'; end if;
end $$;

select cron.schedule(
  'perfil-sync-cadastro',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://ghjfsmwwcfpfvrouyrka.supabase.co/functions/v1/perfil-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'perfil_sync_chave')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $job$
);
commit;
