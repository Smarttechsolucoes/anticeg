-- Badge Foxiny (Maknae on Top / Recrutador / Embaixador):
-- guarda o cog de quem indicou o joiner.
alter table joiners add column if not exists recrutador text;
create index if not exists joiners_recrutador_idx on joiners (recrutador);
