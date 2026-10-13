-- C0-B6 — BUCKET anti-store (privado, sem uso no site): fecha o acesso anônimo de leitura, escrita, alteração e exclusão
-- * Remove as 5 policies que abrem o bucket: allow-anon pt8eye_0..3 (INSERT/SELECT/UPDATE/DELETE para anon) e
--   "Public downloads (restricted)" (SELECT para public, modelo esquecido).
-- * "allow upload" (INSERT para anon/authenticated, check = true, vale para QUALQUER bucket) passa a excluir só o anti-store:
--   with check (bucket_id <> 'anti-store'). Para todos os outros buckets nada muda.
-- * NENHUM arquivo é apagado ou alterado. service_role e o dono do banco (SQL Editor) mantêm acesso total.
-- Tudo em uma transação com registro do estado anterior e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;

create table if not exists emergencia.c0b_estado_anterior (
  id            bigint generated always as identity primary key,
  registrado_em timestamptz not null default now(),
  etapa         text not null,
  objeto        text not null,
  detalhe       text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare n integer; v_outras text;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B6') then
    raise exception 'C0-B6 já foi aplicada: o estado anterior já está registrado e não será sobrescrito.';
  end if;
  if to_regclass('storage.objects') is null then raise exception 'storage.objects não existe. Nada foi alterado.'; end if;
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'RLS desligado em storage.objects. Nada foi alterado.';
  end if;
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('allow-anon pt8eye_0', 'allow-anon pt8eye_1', 'allow-anon pt8eye_2', 'allow-anon pt8eye_3', 'Public downloads (restricted)')
     and coalesce(qual, '') || coalesce(with_check, '') ilike '%anti-store%';
  if n <> 5 then raise exception 'Esperava as 5 policies do anti-store e encontrei %. Nada foi alterado.', n; end if;
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname = 'allow upload'
     and cmd = 'INSERT' and permissive = 'PERMISSIVE' and with_check = 'true';
  if n <> 1 then raise exception 'A policy "allow upload" (INSERT, with check true) não está como esperado. Nada foi alterado.'; end if;
  -- qualquer OUTRA policy que alcance o anti-store (sem filtro de bucket, com negação ou citando-o) faria o fechamento ser incompleto
  select string_agg(p.policyname || ' (' || p.cmd || ')', '; ') into v_outras
    from pg_policies p
   where p.schemaname = 'storage' and p.tablename = 'objects' and p.permissive = 'PERMISSIVE'
     and p.policyname not in ('allow-anon pt8eye_0', 'allow-anon pt8eye_1', 'allow-anon pt8eye_2', 'allow-anon pt8eye_3', 'Public downloads (restricted)', 'allow upload')
     and exists (select 1 from unnest(p.roles) r
                  where case when r = 'public' then true
                             else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end)
     and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') !~* 'bucket_id'
          or coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ilike '%anti-store%'
          or coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ~* '(<>|!=|\mnot\M)');
  if v_outras is not null then
    raise exception 'Outra policy também alcança o bucket anti-store: %. Nada foi alterado.', v_outras;
  end if;
end $$;

-- estado ANTERIOR: todas as policies de storage.objects (para recriar exatamente) e a contagem de arquivos do bucket
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B6', 'policy ' || policyname,
       format('cmd=%s roles=%s using=%s check=%s permissive=%s', cmd, roles::text, coalesce(qual, 'null'), coalesce(with_check, 'null'), permissive)
from pg_policies where schemaname = 'storage' and tablename = 'objects';

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B6', 'arquivos no bucket anti-store', 'quantidade=' || count(*)
from storage.objects where bucket_id = 'anti-store';

-- a correção
drop policy "allow-anon pt8eye_0" on storage.objects;
drop policy "allow-anon pt8eye_1" on storage.objects;
drop policy "allow-anon pt8eye_2" on storage.objects;
drop policy "allow-anon pt8eye_3" on storage.objects;
drop policy "Public downloads (restricted)" on storage.objects;
alter policy "allow upload" on storage.objects with check (bucket_id <> 'anti-store'::text);

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; antes integer; depois integer; q_antes text; q_depois text;
begin
  select count(*) into n from pg_policies p
   where p.schemaname = 'storage' and p.tablename = 'objects' and p.permissive = 'PERMISSIVE'
     and not (p.policyname = 'allow upload' and p.with_check ilike '%bucket_id <> ''anti-store''%')
     and exists (select 1 from unnest(p.roles) r
                  where case when r = 'public' then true
                             else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end)
     and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') !~* 'bucket_id'
          or coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ilike '%anti-store%'
          or coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ~* '(<>|!=|\mnot\M)');
  if n > 0 then raise exception 'Ainda existe policy alcançando o bucket anti-store (% encontrada(s)). Transação desfeita.', n; end if;

  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname = 'allow upload' and with_check ilike '%bucket_id <> ''anti-store''%';
  if n <> 1 then raise exception 'A policy "allow upload" não ficou como esperado. Transação desfeita.'; end if;

  -- 5 policies a menos; nenhuma outra mudou de quantidade
  select count(*) into antes from emergencia.c0b_estado_anterior where etapa = 'B6' and objeto like 'policy %';
  select count(*) into depois from pg_policies where schemaname = 'storage' and tablename = 'objects';
  if depois <> antes - 5 then raise exception 'Esperava % policies em storage.objects e encontrei %. Transação desfeita.', antes - 5, depois; end if;

  -- os outros buckets continuam com o que tinham (leitura e envio)
  select count(*) into n from pg_policies where schemaname = 'storage' and tablename = 'objects'
   and policyname in ('anon upload comprovante', 'comprovantes upload', 'joiner upload comprovante', 'leitura publica fotos-itens', 'public read avatars', 'allow select storage-itens');
  if n <> 6 then raise exception 'Policies de outros buckets foram afetadas (% de 6 presentes). Transação desfeita.', n; end if;

  select detalhe into q_antes from emergencia.c0b_estado_anterior where etapa = 'B6' and objeto = 'arquivos no bucket anti-store';
  select 'quantidade=' || count(*) into q_depois from storage.objects where bucket_id = 'anti-store';
  if q_antes is distinct from q_depois then raise exception 'A quantidade de arquivos mudou durante o script (% -> %). Transação desfeita.', q_antes, q_depois; end if;
end $$;

commit;
