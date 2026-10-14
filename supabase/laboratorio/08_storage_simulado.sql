-- LABORATÓRIO — Storage simulado (só para testes locais com PGlite; o Supabase real já tem o schema storage). Estado "de HOJE" depois do C0-B5 e C0-B6:
-- buckets públicos, a listagem pública dos comprovantes fechada, e as policies de envio que o diagnóstico encontrou (nomes reais).
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
insert into storage.buckets (id, name, public) values ('comprovantes', 'comprovantes', true), ('mercari-comprovantes', 'mercari-comprovantes', true), ('avatars', 'avatars', true),
  ('fotos-itens', 'fotos-itens', true), ('storage-itens', 'storage-itens', true), ('anti-store', 'anti-store', false);
create policy "anon upload comprovante" on storage.objects for insert to anon with check (bucket_id = 'comprovantes');
create policy "comprovantes upload" on storage.objects for insert to authenticated with check (bucket_id = 'comprovantes');
create policy "joiner upload comprovante" on storage.objects for insert to public with check (bucket_id = 'comprovantes');
create policy "leitura publica fotos-itens" on storage.objects for select to public using (bucket_id = 'fotos-itens');
create policy "public read avatars" on storage.objects for select to public using (bucket_id = 'avatars');
create policy "allow select storage-itens" on storage.objects for select to public using (bucket_id = 'storage-itens');
create policy "allow upload" on storage.objects for insert to anon, authenticated with check (bucket_id <> 'anti-store'::text);
insert into storage.objects (bucket_id, name) values ('comprovantes', 'wmag/1700000000000.jpg'), ('comprovantes', 'pagamentos/ana.pdf'), ('comprovantes', 'pagamentos/bia.pdf'),
  ('mercari-comprovantes', 'ana_1700000000000.jpg'), ('avatars', 'ana.png');
