-- C0-B4 — VENCIMENTOS E CAMPOS pag_* DA MASTERLIST: ninguém (anon / authenticated / PUBLIC) altera pela API
-- Colunas travadas: pag_item, pag_frete, pag_taxa, venc_item, venc_frete, venc_rf, venc_taxa.
-- * As datas continuam sendo editadas no Google Sheets: o sync (GitHub Actions, service_role) lê "ITEM DATA / FRETE DATA / RF DATA"
--   da planilha e grava venc_item / venc_frete / venc_rf a cada execução. O service_role mantém UPDATE (conferido abaixo).
-- * O site não escreve nesses campos (só lê). O resto da masterlist continua editável como está (status, na_loja, cog, nome, info_adicionais...).
-- * Requer o B1 já aplicado (permissão de UPDATE só por coluna). Se não estiver, o script para sem alterar nada.
-- Tudo em uma transação com registro do estado anterior e verificação antes do COMMIT.
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
declare n integer;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B4') then
    raise exception 'C0-B4 já foi aplicada: o estado anterior já está registrado e não será sobrescrito.';
  end if;
  if to_regclass('public.masterlist') is null then raise exception 'public.masterlist não existe. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute a
   where a.attrelid = 'public.masterlist'::regclass and not a.attisdropped
     and a.attname in ('pag_item', 'pag_frete', 'pag_taxa', 'venc_item', 'venc_frete', 'venc_rf', 'venc_taxa');
  if n <> 7 then raise exception 'Esperava as 7 colunas pag_item, pag_frete, pag_taxa, venc_item, venc_frete, venc_rf e venc_taxa e encontrei %. Nada foi alterado.', n; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'O papel service_role não existe neste banco. Nada foi alterado.';
  end if;
  -- B1 aplicado? (pago_* travado e UPDATE só por coluna; se a tabela inteira ainda tem UPDATE, revogar colunas não adiantaria)
  if has_table_privilege('anon', 'public.masterlist', 'UPDATE') or has_table_privilege('authenticated', 'public.masterlist', 'UPDATE')
     or has_table_privilege('public', 'public.masterlist', 'UPDATE') then
    raise exception 'anon/authenticated/PUBLIC ainda têm UPDATE na tabela inteira (o B1 não está aplicado). Nada foi alterado.';
  end if;
  if exists (select 1 from pg_attribute a where a.attrelid = 'public.masterlist'::regclass and a.attname in ('pago_item', 'pago_frete', 'pago_rf')
               and (has_column_privilege('anon', 'public.masterlist', a.attname, 'UPDATE') or has_column_privilege('authenticated', 'public.masterlist', a.attname, 'UPDATE'))) then
    raise exception 'pago_* ainda editável por anon/authenticated (o B1 não está aplicado). Nada foi alterado.';
  end if;
end $$;

-- estado ANTERIOR: permissões da tabela, de cada coluna com permissão própria e o acesso efetivo nas 7 colunas
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B4', 'public.masterlist (permissões da tabela)', coalesce(c.relacl::text, '(padrão do dono)')
from pg_class c where c.oid = 'public.masterlist'::regclass;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B4', 'public.masterlist.' || a.attname || ' (permissão da coluna)', a.attacl::text
from pg_attribute a
where a.attrelid = 'public.masterlist'::regclass and a.attnum > 0 and not a.attisdropped and a.attacl is not null;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B4', 'acesso EFETIVO de UPDATE em ' || a.attname || ' para ' || r.rolname,
       has_column_privilege(r.rolname, 'public.masterlist', a.attname, 'UPDATE')::text
from pg_attribute a
cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
where a.attrelid = 'public.masterlist'::regclass and a.attname in ('pag_item', 'pag_frete', 'pag_taxa', 'venc_item', 'venc_frete', 'venc_rf', 'venc_taxa');

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B4', 'impressão dos vencimentos',
       'linhas=' || count(*) || ' md5=' ||
       md5(coalesce(string_agg(id::text || '|' || coalesce(venc_item::text, 'null') || '|' || coalesce(venc_frete::text, 'null') || '|' || coalesce(venc_rf::text, 'null'), E'\n' order by id), ''))
from public.masterlist;

-- a trava
revoke update (pag_item, pag_frete, pag_taxa, venc_item, venc_frete, venc_rf, venc_taxa) on public.masterlist from anon, authenticated, public;

-- service_role (sync) com permissão EXPLÍCITA, sem depender de suposição
grant update on table public.masterlist to service_role;

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; total integer; ok_cols integer; v_antes text; v_depois text;
begin
  select count(*) into n from pg_attribute a cross join (values ('anon'), ('authenticated')) as r(rolname)
   where a.attrelid = 'public.masterlist'::regclass and a.attname in ('pag_item', 'pag_frete', 'pag_taxa', 'venc_item', 'venc_frete', 'venc_rf', 'venc_taxa')
     and has_column_privilege(r.rolname, 'public.masterlist', a.attname, 'UPDATE');
  if n > 0 then raise exception 'anon/authenticated ainda podem alterar % combinação(ões) de coluna de vencimento/pag_*. Transação desfeita.', n; end if;

  -- o B1 não pode ter sido desfeito, e o resto da masterlist continua editável
  select count(*) into total from pg_attribute
   where attrelid = 'public.masterlist'::regclass and attnum > 0 and not attisdropped
     and attname not in ('pago_item', 'pago_frete', 'pago_rf', 'pag_item', 'pag_frete', 'pag_taxa', 'venc_item', 'venc_frete', 'venc_rf', 'venc_taxa');
  select count(*) into ok_cols from pg_attribute a
   where a.attrelid = 'public.masterlist'::regclass and a.attnum > 0 and not a.attisdropped
     and a.attname not in ('pago_item', 'pago_frete', 'pago_rf', 'pag_item', 'pag_frete', 'pag_taxa', 'venc_item', 'venc_frete', 'venc_rf', 'venc_taxa')
     and has_column_privilege('anon', 'public.masterlist', a.attname, 'UPDATE')
     and has_column_privilege('authenticated', 'public.masterlist', a.attname, 'UPDATE');
  if ok_cols <> total then raise exception 'As demais colunas perderam UPDATE (% de % mantidas). Transação desfeita.', ok_cols, total; end if;

  select count(*) into n from pg_attribute a
   where a.attrelid = 'public.masterlist'::regclass and a.attname in ('pago_item', 'pago_frete', 'pago_rf', 'pag_item', 'pag_frete', 'pag_taxa', 'venc_item', 'venc_frete', 'venc_rf', 'venc_taxa')
     and has_column_privilege('service_role', 'public.masterlist', a.attname, 'UPDATE');
  if n <> 10 then raise exception 'service_role perdeu UPDATE em coluna(s) travada(s) (mantém % de 10). Transação desfeita.', n; end if;

  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'B4' and objeto = 'impressão dos vencimentos';
  select 'linhas=' || count(*) || ' md5=' ||
         md5(coalesce(string_agg(id::text || '|' || coalesce(venc_item::text, 'null') || '|' || coalesce(venc_frete::text, 'null') || '|' || coalesce(venc_rf::text, 'null'), E'\n' order by id), ''))
    into v_depois from public.masterlist;
  if v_antes is distinct from v_depois then raise exception 'Os vencimentos mudaram durante o script (% -> %). Transação desfeita.', v_antes, v_depois; end if;
end $$;

commit;
