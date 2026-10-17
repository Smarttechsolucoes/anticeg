-- LABORATÓRIO — Storage simulado FIEL ao Supabase real em 17/10/2026 (leitura de pg_policies/storage.buckets feita nessa data). Só para testes locais com PGlite.
-- Diferença para 08_storage_simulado.sql: este traz o conjunto REAL de policies de storage.objects (as de avatars, storage-itens, popup-skzoo e as genéricas), que o 08 não tinha.
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
insert into storage.buckets (id, name, public) values ('anti-store', 'anti-store', false), ('avatars', 'avatars', true), ('comprovantes', 'comprovantes', true), ('fotos-itens', 'fotos-itens', true),
  ('masterlist-fotos', 'masterlist-fotos', true), ('mercari-comprovantes', 'mercari-comprovantes', true), ('popup-skzoo', 'popup-skzoo', true), ('storage-itens', 'storage-itens', true);

-- DELETE
create policy "allow delete storage-itens" on storage.objects for delete to anon using (bucket_id = 'storage-itens'::text);
create policy "anon delete avatars" on storage.objects for delete to anon using (bucket_id = 'avatars'::text);
-- INSERT
create policy "allow anon upload" on storage.objects for insert to anon with check (bucket_id = 'avatars'::text);
create policy "allow upload" on storage.objects for insert to anon, authenticated with check (bucket_id <> 'anti-store'::text);
create policy "allow uploads storage-itens" on storage.objects for insert to anon with check (bucket_id = 'storage-itens'::text);
create policy "anon upload avatars" on storage.objects for insert to anon with check (bucket_id = 'avatars'::text);
create policy "anon upload comprovante" on storage.objects for insert to anon with check (bucket_id = 'comprovantes'::text);
create policy "anon_insert_popup_skzoo" on storage.objects for insert to anon with check (bucket_id = 'popup-skzoo'::text);
create policy "comprovantes upload" on storage.objects for insert to public with check (bucket_id = 'comprovantes'::text);
create policy "joiner upload comprovante" on storage.objects for insert to authenticated with check (bucket_id = 'comprovantes'::text);
create policy "upload fotos-itens autenticado" on storage.objects for insert to authenticated with check (bucket_id = 'fotos-itens'::text);
-- SELECT
create policy "<policy_name>" on storage.objects for select to anon using ((bucket_id = 'avatars'::text) and (name like 'public/%'::text));
create policy "allow anon select" on storage.objects for select to anon using (bucket_id = 'avatars'::text);
create policy "allow select storage-itens" on storage.objects for select to anon using (bucket_id = 'storage-itens'::text);
create policy "leitura publica fotos-itens" on storage.objects for select to public using (bucket_id = 'fotos-itens'::text);
create policy "public read avatars" on storage.objects for select to anon using (bucket_id = 'avatars'::text);
-- UPDATE
create policy "allow anon update" on storage.objects for update to anon using (bucket_id = 'avatars'::text);
create policy "anon update avatars" on storage.objects for update to anon using (bucket_id = 'avatars'::text);

-- dados fictícios: 6 fotos no padrão do site (JPEG pequeno) e arquivos de outros buckets
insert into storage.objects (bucket_id, name, metadata) values
  ('avatars', 'ana/avatar.jpg', '{"mimetype":"image/jpeg","size":15200}'), ('avatars', 'bia/avatar.jpg', '{"mimetype":"image/jpeg","size":16100}'), ('avatars', 'gabi/avatar.jpg', '{"mimetype":"image/jpeg","size":33000}'),
  ('avatars', 'ela/avatar.jpg', '{"mimetype":"image/jpeg","size":14800}'), ('avatars', 'Ela/avatar.jpg', '{"mimetype":"image/jpeg","size":15000}'), ('avatars', 'sem.joiner/avatar.jpg', '{"mimetype":"image/jpeg","size":12000}'),
  ('comprovantes', 'pagamentos/ana.pdf', '{"mimetype":"application/pdf","size":90000}'), ('storage-itens', 'x/foto.jpg', '{"mimetype":"image/jpeg","size":50000}'), ('popup-skzoo', 'p/1.jpg', '{"mimetype":"image/jpeg","size":50000}');
