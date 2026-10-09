-- Permite à admin "parar" a abertura de novos sets de um evento de claim:
-- os sets já abertos continuam e podem ser fechados, mas nenhum set novo é criado
-- automaticamente e ninguém entra em standby.
alter table claim_eventos
  add column if not exists sem_novos_sets boolean not null default false;
