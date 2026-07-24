create table if not exists pre_cadastros (
  id        bigint generated always as identity primary key,
  nome      text not null,
  cog       text not null,
  email     text,
  whatsapp  text,
  status    text not null default 'pendente',
  created_at timestamptz default now()
);

-- permite que qualquer pessoa insira (para o formulário de primeiro acesso)
create policy if not exists "insert_pre_cadastros"
  on pre_cadastros for insert
  to anon
  with check (true);

-- permite que a anon key leia (para o admin panel)
create policy if not exists "select_pre_cadastros"
  on pre_cadastros for select
  to anon
  using (true);

-- permite que a anon key atualize o status (para aprovar/recusar)
create policy if not exists "update_pre_cadastros"
  on pre_cadastros for update
  to anon
  using (true);

alter table pre_cadastros enable row level security;
