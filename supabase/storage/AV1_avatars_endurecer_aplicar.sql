-- AV1 — AVATARS: endurece o envio/troca/exclusão de fotos de perfil SEM exigir login e SEM mexer em nenhuma foto existente.
-- Hoje (leitura de 17/10/2026): bucket PÚBLICO, sem limite de tamanho nem de tipo; 5 policies de escrita para o visitante (INSERT/UPDATE/DELETE) valem para QUALQUER caminho e QUALQUER arquivo,
--   e a policy genérica "allow upload" (INSERT para anon e logada em qualquer bucket menos anti-store) também alcança avatars.
-- O site grava sempre `<cog>/avatar.jpg` (JPEG 200x200, ~15 KB; maior existente: 33 KB). As 206 fotos existentes seguem esse padrão e são image/jpeg.
-- O que muda:
--   1) o bucket passa a aceitar SÓ image/jpeg e até 256 KB por arquivo (envios novos);
--   2) as policies de avatars passam a valer SÓ para o caminho `<pasta>/avatar.jpg` (ver, enviar, trocar, apagar); qualquer outro nome é negado;
--   3) a policy "allow upload" deixa de valer para avatars (continua igual para todos os outros buckets).
-- O que NÃO muda: a leitura pública das fotos (URLs gravadas continuam abrindo), o fluxo do site (remove + upload), nenhum arquivo, nenhuma linha de joiners, nenhum outro bucket.
-- LIMITAÇÃO HONESTA: sem login o banco não sabe quem é a pessoa; ainda é possível trocar/apagar a foto de OUTRA joiner pelo caminho `<cog>/avatar.jpg`. Isso só fecha no lançamento (AV2), quando só a conta dona do COG (ou a administradora) escreve.
-- Tudo em uma transação com registro do estado anterior e conferência antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare n integer; v_fora text;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'AV1') then raise exception 'AV1 já foi aplicado. Nada foi alterado.'; end if;
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then raise exception 'storage.objects/buckets não existem. Nada foi alterado.'; end if;
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then raise exception 'RLS desligado em storage.objects. Nada foi alterado.'; end if;
  if not exists (select 1 from storage.buckets where id = 'avatars' and public) then raise exception 'O bucket avatars não existe ou não é público como esperado. Nada foi alterado.'; end if;
  select count(*) into n from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'allow upload' and cmd = 'INSERT' and permissive = 'PERMISSIVE';
  if n <> 1 then raise exception 'A policy "allow upload" (INSERT) não está como esperado. Nada foi alterado.'; end if;
  -- todas as fotos existentes precisam seguir o padrão que continuará permitido (senão ficariam sem poder ser trocadas)
  select string_agg(name, ', ') into v_fora from (select name from storage.objects where bucket_id = 'avatars' and name !~ '^[^/]+/avatar\.jpg$' limit 5) x;
  if v_fora is not null then raise exception 'Há fotos fora do padrão <pasta>/avatar.jpg (ex.: %). Nada foi alterado.', v_fora; end if;
  select count(*) into n from storage.objects where bucket_id = 'avatars' and coalesce(metadata ->> 'mimetype', 'image/jpeg') <> 'image/jpeg';
  if n > 0 then raise exception 'Há % foto(s) que não são image/jpeg. Nada foi alterado.', n; end if;
  select count(*) into n from storage.objects where bucket_id = 'avatars' and coalesce((metadata ->> 'size')::numeric, 0) > 262144;
  if n > 0 then raise exception 'Há % foto(s) acima de 256 KB. Nada foi alterado.', n; end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('avatars_ver', 'avatars_enviar', 'avatars_trocar', 'avatars_apagar')) then raise exception 'As policies do AV1 já existem. Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR (policies para recriar exatamente, configuração do bucket e retrato das fotos)
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'AV1', 'policy ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'storage' and tablename = 'objects';
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'AV1', 'bucket ' || id, json_build_object('public', public, 'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types)::text from storage.buckets where id = 'avatars';
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'AV1', 'fotos avatars', 'quantidade=' || count(*) || ' md5=' || md5(coalesce(string_agg(name, ',' order by name), '')) from storage.objects where bucket_id = 'avatars';

-- 1) o bucket só aceita JPEG de até 256 KB (envios novos)
update storage.buckets set file_size_limit = 262144, allowed_mime_types = array['image/jpeg'] where id = 'avatars';

-- 2) saem as policies que valiam para QUALQUER caminho em avatars (só as que citam exclusivamente o bucket avatars)
do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and policyname in ('anon upload avatars', 'allow anon upload', 'anon update avatars', 'allow anon update', 'anon delete avatars', 'allow anon select', 'public read avatars', '<policy_name>')
              and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%bucket_id = ''avatars''::text%'
              and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) !~ '(comprovantes|fotos-itens|storage-itens|popup-skzoo)' loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

-- 3) a policy genérica de envio deixa de alcançar avatars (os demais buckets ficam exatamente como estão)
alter policy "allow upload" on storage.objects with check (bucket_id <> 'anti-store'::text and bucket_id <> 'avatars'::text);

-- 4) policies novas: só o caminho <pasta>/avatar.jpg
create policy avatars_ver    on storage.objects for select to anon, authenticated using (bucket_id = 'avatars' and name ~ '^[^/]+/avatar\.jpg$');
create policy avatars_enviar on storage.objects for insert to anon, authenticated with check (bucket_id = 'avatars' and name ~ '^[^/]+/avatar\.jpg$');
create policy avatars_trocar on storage.objects for update to anon, authenticated using (bucket_id = 'avatars' and name ~ '^[^/]+/avatar\.jpg$') with check (bucket_id = 'avatars' and name ~ '^[^/]+/avatar\.jpg$');
create policy avatars_apagar on storage.objects for delete to anon, authenticated using (bucket_id = 'avatars' and name ~ '^[^/]+/avatar\.jpg$');

-- 5) conferência dentro da transação (funcional, com sondas desfeitas): qualquer falha desfaz tudo
do $$
declare n integer; v_a text; v_d text; v_ant integer; v_dep integer;
begin
  if not exists (select 1 from storage.buckets where id = 'avatars' and public and file_size_limit = 262144 and allowed_mime_types = array['image/jpeg']) then raise exception 'O bucket avatars não ficou como previsto. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('avatars_ver', 'avatars_enviar', 'avatars_trocar', 'avatars_apagar');
  if n <> 4 then raise exception 'As 4 policies novas não foram criadas (%). Transação desfeita.', n; end if;
  -- quantidade de policies: só saíram as de avatars (no máximo 8) e entraram as 4 novas
  select count(*) into v_ant from emergencia.c0b_estado_anterior where etapa = 'AV1' and objeto like 'policy %';
  select count(*) into v_dep from pg_policies where schemaname = 'storage' and tablename = 'objects';
  if v_dep > v_ant + 4 or v_dep < v_ant + 4 - 8 then raise exception 'Quantidade inesperada de policies em storage.objects (% antes, % agora). Transação desfeita.', v_ant, v_dep; end if;
  -- as policies dos outros buckets continuam todas presentes
  select count(*) into v_ant from emergencia.c0b_estado_anterior where etapa = 'AV1' and objeto like 'policy %'
     and objeto not in ('policy anon upload avatars', 'policy allow anon upload', 'policy anon update avatars', 'policy allow anon update', 'policy anon delete avatars', 'policy allow anon select', 'policy public read avatars', 'policy <policy_name>');
  select count(*) into v_dep from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname not in ('avatars_ver', 'avatars_enviar', 'avatars_trocar', 'avatars_apagar');
  if v_ant <> v_dep then raise exception 'Uma policy de outro bucket mudou (% esperadas, % agora). Transação desfeita.', v_ant, v_dep; end if;
  -- nenhuma foto foi tocada
  select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'AV1' and objeto = 'fotos avatars';
  select 'quantidade=' || count(*) || ' md5=' || md5(coalesce(string_agg(name, ',' order by name), '')) into v_d from storage.objects where bucket_id = 'avatars';
  if v_a is distinct from v_d then raise exception 'As fotos mudaram durante o script. Transação desfeita.'; end if;
  -- sondas funcionais como VISITANTE (cada uma dentro de uma subtransação desfeita): caminho do site passa; qualquer outro é negado
  begin
    begin execute 'set local role anon'; insert into storage.objects (bucket_id, name) values ('avatars', 'sonda_av1/avatar.jpg'); raise exception 'sonda_ok';
    exception when others then execute 'reset role'; if sqlerrm <> 'sonda_ok' then raise exception 'O caminho normal <pasta>/avatar.jpg foi NEGADO ao visitante (%). Transação desfeita.', sqlerrm; end if; end;
    begin execute 'set local role anon'; insert into storage.objects (bucket_id, name) values ('avatars', 'sonda_av1/invasor.html'); raise exception 'sonda_falhou_enviou';
    exception when others then execute 'reset role'; if sqlerrm = 'sonda_falhou_enviou' then raise exception 'O visitante ainda envia arquivo fora do padrão para avatars. Transação desfeita.'; end if; end;
    begin execute 'set local role anon'; insert into storage.objects (bucket_id, name) values ('avatars', 'a/b/avatar.jpg'); raise exception 'sonda_falhou_enviou';
    exception when others then execute 'reset role'; if sqlerrm = 'sonda_falhou_enviou' then raise exception 'O visitante ainda envia para subpasta fora do padrão. Transação desfeita.'; end if; end;
    begin execute 'set local role authenticated'; insert into storage.objects (bucket_id, name) values ('avatars', 'sonda_av1/outro.png'); raise exception 'sonda_falhou_enviou';
    exception when others then execute 'reset role'; if sqlerrm = 'sonda_falhou_enviou' then raise exception 'Conta logada ainda envia arquivo fora do padrão para avatars. Transação desfeita.'; end if; end;
  end;
end $$;

commit;
