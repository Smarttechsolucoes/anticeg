-- E1 — reverte o agendador (desagenda a chamada por minuto da função perfil-sync). Não apaga a fila nem as tarefas.
select cron.unschedule('perfil-sync-cadastro') where exists (select 1 from cron.job where jobname = 'perfil-sync-cadastro');
