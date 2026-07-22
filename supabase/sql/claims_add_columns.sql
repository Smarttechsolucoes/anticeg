alter table claims
  add column if not exists joiner_email text,
  add column if not exists vencimento date;
