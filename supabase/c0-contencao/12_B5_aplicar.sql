-- C0-B5 — BUCKET comprovantes: fecha a LISTAGEM pública (a policy "comprovantes read" sai)
-- * Remove SOMENTE a policy de SELECT "comprovantes read" (storage.objects). As policies de INSERT (envio de comprovantes) ficam como estão.
-- * Nenhum arquivo é tocado. Os links diretos já gravados continuam abrindo (o bucket continua público): este passo fecha a ENUMERAÇÃO,
--   não a leitura por URL conhecida — isso só se resolve com bucket privado + URLs assinadas, na fase do login.
-- * PRÉ-REQUISITO: o PR "uploads sem upsert" (upsert: true exige SELECT) precisa estar no ar ANTES deste script.
-- * Outros buckets (avatars, fotos-itens, storage-itens, anti-store...) NÃO são alterados aqui.
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
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B5') then
    raise exception 'C0-B5 já foi aplicada: o estado anterior já está registrado e não será sobrescrito.';
  end if;
  if to_regclass('storage.objects') is null then raise exception 'storage.objects não existe. Nada foi alterado.'; end if;
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'RLS desligado em storage.objects. Nada foi alterado.';
  end if;
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname = 'comprovantes read'
     and cmd = 'SELECT' and permissive = 'PERMISSIVE' and qual ilike '%comprovantes%';
  if n <> 1 then raise exception 'A policy "comprovantes read" (SELECT, bucket comprovantes) não foi encontrada como esperado. Nada foi alterado.'; end if;
  -- se OUTRA policy permissiva de leitura alcançar o bucket (sem filtro de bucket, ou citando comprovantes), fechar esta não adiantaria
  select string_agg(p.policyname || ' (' || p.cmd || ')', '; ') into v_outras
    from pg_policies p
   where p.schemaname = 'storage' and p.tablename = 'objects' and p.permissive = 'PERMISSIVE'
     and p.cmd in ('SELECT', 'ALL') and p.policyname <> 'comprovantes read'
     and exists (select 1 from unnest(p.roles) r
                  where case when r = 'public' then true
                             else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end)
     and (p.qual is null or p.qual !~* 'bucket_id' or p.qual ilike '%comprovantes%');
  if v_outras is not null then
    raise exception 'Outra policy de leitura também alcança o bucket comprovantes: %. Nada foi alterado.', v_outras;
  end if;
  -- o envio precisa continuar possível
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT', 'ALL') and permissive = 'PERMISSIVE'
     and (with_check ilike '%comprovantes%' or with_check = 'true');
  if n < 1 then raise exception 'Não há policy de INSERT para o bucket comprovantes: o envio já estaria quebrado. Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR: todas as policies de storage.objects (para recriar exatamente) e a lista de policies de leitura por bucket
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B5', 'policy ' || policyname,
       format('cmd=%s roles=%s using=%s check=%s permissive=%s', cmd, roles::text, coalesce(qual, 'null'), coalesce(with_check, 'null'), permissive)
from pg_policies where schemaname = 'storage' and tablename = 'objects';

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B5', 'arquivos no bucket ' || bucket_id, 'quantidade=' || count(*)
from storage.objects where bucket_id = 'comprovantes' group by bucket_id;

-- a correção
drop policy "comprovantes read" on storage.objects;

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; antes integer; depois integer; q_antes text; q_depois text;
begin
  select count(*) into n from pg_policies p
   where p.schemaname = 'storage' and p.tablename = 'objects' and p.permissive = 'PERMISSIVE' and p.cmd in ('SELECT', 'ALL')
     and exists (select 1 from unnest(p.roles) r
                  where case when r = 'public' then true
                             else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end)
     and (p.qual is null or p.qual !~* 'bucket_id' or p.qual ilike '%comprovantes%');
  if n > 0 then raise exception 'Ainda existe policy de leitura alcançando o bucket comprovantes (% encontrada(s)). Transação desfeita.', n; end if;

  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT', 'ALL') and permissive = 'PERMISSIVE'
     and (with_check ilike '%comprovantes%' or with_check = 'true');
  if n < 1 then raise exception 'As policies de INSERT do bucket comprovantes sumiram. Transação desfeita.'; end if;

  -- só uma policy a menos em storage.objects, e nenhuma outra mudou
  select count(*) into antes from emergencia.c0b_estado_anterior where etapa = 'B5' and objeto like 'policy %';
  select count(*) into depois from pg_policies where schemaname = 'storage' and tablename = 'objects';
  if depois <> antes - 1 then raise exception 'Esperava % policies em storage.objects e encontrei %. Transação desfeita.', antes - 1, depois; end if;

  select detalhe into q_antes from emergencia.c0b_estado_anterior where etapa = 'B5' and objeto = 'arquivos no bucket comprovantes';
  select 'quantidade=' || count(*) into q_depois from storage.objects where bucket_id = 'comprovantes';
  if q_antes is distinct from q_depois then raise exception 'A quantidade de arquivos mudou durante o script (% -> %). Transação desfeita.', q_antes, q_depois; end if;
end $$;

commit;
