-- J4c-4f — ESTOQUE DOS DROPS: wave_maker_estoque, paper_tales_estoque, promo_13_estoque, odd_fresh_estoque
-- Hoje essas tabelas têm UPDATE aberto: qualquer visitante, com a chave pública, consegue trocar a quantidade em estoque de um item (e apagar/inserir linhas).
-- Depois deste passo, em cada uma que EXISTIR:
--   leitura  : pública (os formulários dos drops mostram "disponível/esgotado" para quem ainda não entrou) — NADA muda para quem só lê.
--   escrita  : somente a administradora (o painel altera o estoque com o login dela). Visitante e joiner: nenhuma escrita.
-- Nada de dado é alterado/apagado. As permissões de escrita do visitante saem e NENHUMA é copiada para a conta logada.
-- Tabela que não existir é IGNORADA (aviso); se NENHUMA existir o script aborta sem alterar nada.
-- ⚠ APLICAR SOMENTE NO LANÇAMENTO, junto com o site novo no ar (a administradora passa a escrever com o login dela) e depois do J1, J4-0 e J4a.
-- Tudo em uma transação com registro do estado anterior e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare n integer; t text; presentes integer := 0;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-4f') then raise exception 'J4c-4f já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'J1/A1 não estão aplicados (falta is_admin). Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há administradora cadastrada. Nada foi alterado.'; end if;
  foreach t in array array['wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'Tabela % não existe neste banco: ignorada.', t;
    else
      select count(*) into n from pg_attribute where attrelid = ('public.' || t)::regclass and not attisdropped and attname in ('item_id', 'estoque', 'contar_desde');
      if n <> 3 then raise exception '% sem as colunas esperadas (item_id, estoque, contar_desde). Nada foi alterado.', t; end if;
      presentes := presentes + 1;
    end if;
  end loop;
  if presentes = 0 then raise exception 'Nenhuma tabela de estoque dos drops encontrada. Nada foi alterado.'; end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4f', 'policy ' || tablename || ' / ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'public' and tablename in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque');
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4f', 'acl ' || c.relname, coalesce(c.relacl::text, '(padrão do dono)') from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque');
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4f', 'rls ' || c.relname, case when c.relrowsecurity then 'ligado' else 'desligado' end from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque');
do $$
declare t text; v text;
begin
  foreach t in array array['wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select ''linhas='' || count(*) || '' soma='' || coalesce(sum(estoque), 0) from public.%I', t) into v;
      insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('J4c-4f', 'impressão ' || t, v);
    end if;
  end loop;
end $$;

-- 1) RLS ligado, políticas antigas fora, visitante sem escrita; leitura pública; a administradora sempre com acesso próprio
do $$
declare t text; r record;
begin
  foreach t in array array['wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop execute format('drop policy %I on public.%I', r.policyname, t); end loop;
      execute format('revoke all on table public.%I from anon, public', t);
      execute format('grant select on table public.%I to anon', t);
      execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
      execute format('create policy leitura_publica on public.%I for select to anon, authenticated using (true)', t);
      execute format('create policy admin_tudo on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    end if;
  end loop;
end $$;

-- 2) conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; presentes integer; v_a text; v_d text; t text;
begin
  select count(*) into presentes from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque');
  select count(*) into n from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque')
     and (has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE') or has_table_privilege('anon', c.oid, 'TRUNCATE')
          or has_any_column_privilege('anon', c.oid, 'INSERT') or has_any_column_privilege('anon', c.oid, 'UPDATE') or not has_table_privilege('anon', c.oid, 'SELECT') or not c.relrowsecurity);
  if n > 0 then raise exception 'O visitante ainda escreve (ou perdeu a leitura) em tabela de estoque. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque');
  if n <> presentes * 2 then raise exception 'Esperava % policies (2 por tabela) e há %. Transação desfeita.', presentes * 2, n; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque') and cmd <> 'SELECT' and ('anon' = any (roles) or 'public' = any (roles));
  if n > 0 then raise exception 'Há policy de escrita para o visitante. Transação desfeita.'; end if;
  foreach t in array array['wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque'] loop
    if to_regclass('public.' || t) is not null then
      select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'J4c-4f' and objeto = 'impressão ' || t;
      execute format('select ''linhas='' || count(*) || '' soma='' || coalesce(sum(estoque), 0) from public.%I', t) into v_d;
      if v_a is distinct from v_d then raise exception 'Os dados de % mudaram durante o script. Transação desfeita.', t; end if;
    end if;
  end loop;
end $$;

commit;
