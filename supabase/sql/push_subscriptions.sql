-- Tabela para armazenar as subscriptions de Web Push por joiner
create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  joiner_cog text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

-- Index para buscar todas as subs de um joiner rapidamente
create index if not exists push_subscriptions_joiner_cog_idx
  on push_subscriptions (joiner_cog);

-- RLS: joiner só lê as próprias; sem auth customizada, liberamos via service role na edge function
alter table push_subscriptions enable row level security;

-- Política pública de insert/upsert (app usa anon key)
create policy "allow_upsert_push_sub" on push_subscriptions
  for all using (true) with check (true);
