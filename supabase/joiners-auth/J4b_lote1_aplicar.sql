-- J4b (lote 1) — DADOS INDIVIDUAIS PROTEGIDOS PELO BANCO: pagamento_demandas, multas_pagas e masterlist
-- Cada joiner passa a enxergar SÓ o que é dela (ligada pela conta logada: meu_cog()); a administradora (is_admin()) enxerga tudo; o visitante e o "acesso simples só com @" NÃO recebem nada.
-- As policies antigas (abertas ao visitante) saem; o que cada papel pode fazer é decidido aqui, uma por uma, sem copiar o acesso de visitante para a conta logada:
--   pagamento_demandas : joiner lê e CRIA só as próprias demandas (nascem 'em_analise'); administradora tudo; visitante nada.
--   multas_pagas       : joiner lê só as próprias; escrita só pelo servidor (gatilho/sync); visitante nada.
--   masterlist         : joiner lê só os próprios itens e os slots 'disponivel' (para o claim); pode assumir um slot 'disponivel' para si; administradora tudo; visitante nada.
-- Permissões por coluna já travadas (pago_*, venc_*, pag_*) NÃO são tocadas: valem para todas, inclusive administradora (só o service_role grava).
-- ⚠ APLICAR SOMENTE NO LANÇAMENTO, junto com o site novo no ar (VITE_JOINERS_AUTH ligado). O site de hoje usa o acesso de visitante e deixaria de enxergar estas tabelas.
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
declare n integer; t text;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4b-1') then raise exception 'J4b (lote 1) já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.meu_cog()') is null or to_regprocedure('public.is_admin()') is null then raise exception 'J1/A1 não estão aplicados. Nada foi alterado.'; end if;
  foreach t in array array['pagamento_demandas', 'multas_pagas', 'masterlist'] loop
    if to_regclass('public.' || t) is null then raise exception 'A tabela % não existe. Nada foi alterado.', t; end if;
  end loop;
  select count(*) into n from pg_attribute where attrelid = 'public.pagamento_demandas'::regclass and attname in ('joiner_cog', 'status', 'motivo_rejeicao') and not attisdropped;
  if n <> 3 then raise exception 'pagamento_demandas sem as colunas esperadas. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.multas_pagas'::regclass and attname = 'joiner_cog' and not attisdropped;
  if n <> 1 then raise exception 'multas_pagas sem joiner_cog. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.masterlist'::regclass and attname in ('cog', 'na_loja', 'ceg') and not attisdropped;
  if n <> 3 then raise exception 'masterlist sem as colunas cog, na_loja e ceg. Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há administradora cadastrada. Nada foi alterado.'; end if;
  if to_regprocedure('public.cog_e_da_conta(text)') is null then raise exception 'O J4a não está aplicado (falta cog_e_da_conta). Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR: todas as policies das 3 tabelas (para recriar exatamente), permissões e impressão dos dados (só contagem e hash)
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4b-1', 'policy ' || tablename || ' / ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'public' and tablename in ('pagamento_demandas', 'multas_pagas', 'masterlist');

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4b-1', 'acl ' || c.relname, coalesce(c.relacl::text, '(padrão do dono)') from pg_class c where c.oid in ('public.pagamento_demandas'::regclass, 'public.multas_pagas'::regclass, 'public.masterlist'::regclass);

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4b-1', 'impressão ' || t, f from (
  select 'pagamento_demandas' as t, 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || coalesce(status, ''), ',' order by id), '')) as f from public.pagamento_demandas
  union all select 'multas_pagas', 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || valor_multa::text, ',' order by id), '')) from public.multas_pagas
  union all select 'masterlist', 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || coalesce(cog, ''), ',' order by id), '')) from public.masterlist) x;

-- 1) RLS ligado e fora TODAS as policies antigas das 3 tabelas
alter table public.pagamento_demandas enable row level security;
alter table public.multas_pagas enable row level security;
alter table public.masterlist enable row level security;
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('pagamento_demandas', 'multas_pagas', 'masterlist') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) visitante: sem nenhum acesso às 3 tabelas (privilégios e policies)
revoke all on table public.pagamento_demandas, public.multas_pagas, public.masterlist from anon, public;
-- (a conta logada mantém as permissões por coluna já existentes na masterlist e as de tabela nas outras duas; quem decide as LINHAS são as policies abaixo)
grant select, insert on table public.pagamento_demandas to authenticated;
grant select on table public.multas_pagas to authenticated;
grant select on table public.masterlist to authenticated;
grant insert on table public.masterlist to authenticated;

-- 3) as policies novas
create policy admin_tudo on public.pagamento_demandas for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_proprias on public.pagamento_demandas for select to authenticated using (public.cog_e_da_conta(joiner_cog));
create policy joiner_cria_proprias on public.pagamento_demandas for insert to authenticated
  with check (public.cog_e_da_conta(joiner_cog) and status = 'em_analise' and motivo_rejeicao is null);

create policy admin_tudo on public.multas_pagas for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_proprias on public.multas_pagas for select to authenticated using (public.cog_e_da_conta(joiner_cog));

create policy admin_tudo on public.masterlist for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_proprios_e_slots on public.masterlist for select to authenticated
  using (public.cog_e_da_conta(cog) or lower(trim(cog)) = 'disponivel');
-- claim: pegar um slot 'disponivel' para si (o COG novo tem de ser o dela); devolver/reabrir um slot (continua 'disponivel')
create policy joiner_assume_slot on public.masterlist for update to authenticated
  using (lower(trim(cog)) = 'disponivel' and na_loja is true)
  with check (public.cog_e_da_conta(cog) or lower(trim(cog)) = 'disponivel');
create policy joiner_abre_slot_de_set on public.masterlist for insert to authenticated
  with check (lower(trim(cog)) = 'disponivel' and ceg = 'CLAIM');

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_a text; v_d text; t text;
begin
  select count(*) into n from (values ('public.pagamento_demandas'), ('public.multas_pagas'), ('public.masterlist')) x(nome)
   where has_table_privilege('anon', x.nome, 'SELECT') or has_table_privilege('anon', x.nome, 'INSERT') or has_table_privilege('anon', x.nome, 'UPDATE') or has_table_privilege('anon', x.nome, 'DELETE')
      or has_any_column_privilege('anon', x.nome, 'SELECT') or has_any_column_privilege('anon', x.nome, 'UPDATE') or has_any_column_privilege('anon', x.nome, 'INSERT');
  if n > 0 then raise exception 'O visitante ainda tem permissão em alguma das 3 tabelas. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('pagamento_demandas', 'multas_pagas', 'masterlist') and ('anon' = any(roles) or 'public' = any(roles));
  if n > 0 then raise exception 'Sobrou policy para visitante ou PUBLIC. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('pagamento_demandas', 'multas_pagas', 'masterlist');
  if n <> 9 then raise exception 'Esperava 9 policies novas e há %. Transação desfeita.', n; end if;
  -- as colunas travadas continuam travadas para todas as contas logadas
  select count(*) into n from pg_attribute a where a.attrelid = 'public.masterlist'::regclass and a.attname in ('pago_item', 'pago_frete', 'pago_rf', 'pag_item', 'pag_frete', 'pag_taxa', 'venc_item', 'venc_frete', 'venc_rf', 'venc_taxa')
     and has_column_privilege('authenticated', 'public.masterlist', a.attname, 'UPDATE');
  if n > 0 then raise exception 'Coluna travada da masterlist ficou editável por conta logada. Transação desfeita.'; end if;
  for t in select unnest(array['pagamento_demandas', 'multas_pagas', 'masterlist']) loop
    select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'J4b-1' and objeto = 'impressão ' || t;
    v_d := case t
      when 'pagamento_demandas' then (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || coalesce(status, ''), ',' order by id), '')) from public.pagamento_demandas)
      when 'multas_pagas' then (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || valor_multa::text, ',' order by id), '')) from public.multas_pagas)
      else (select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || coalesce(cog, ''), ',' order by id), '')) from public.masterlist) end;
    if v_a is distinct from v_d then raise exception 'Os dados de % mudaram durante o script. Transação desfeita.', t; end if;
  end loop;
end $$;

commit;
