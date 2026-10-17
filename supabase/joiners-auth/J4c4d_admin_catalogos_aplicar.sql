-- J4c-4d — ADMINISTRAÇÃO E CATÁLOGOS: rastreios, estoque_itens, estoque_compras, ceg_config, item_fotos, links_uteis, cal_eventos, tabela_precos, sugestoes_tabela, antiv_badges
-- Hoje qualquer visitante pode ler, trocar e APAGAR o controle de estoque, os rastreios, os links dos grupos de WhatsApp de cada CEG, o calendário, as fotos e os links úteis.
-- Depois deste passo:
--   rastreios, estoque_itens, estoque_compras : só a administradora. Visitante e joiner: nada.
--   ceg_config (links dos grupos de WhatsApp) : joiner com conta ATIVADA lê; escrever é só da administradora. Visitante: nada.
--   item_fotos, links_uteis, cal_eventos, tabela_precos (conteúdo PÚBLICO do site: fotos dos CEGs, calendário, links úteis, tabela de preços): todos leem; escrever é só da administradora.
--   sugestoes_tabela : qualquer pessoa pode SUGERIR um preço (nasce 'pendente', no máximo 100 por hora) e ver as sugestões pendentes; aprovar/recusar é só da administradora.
--   antiv_badges     : a joiner lê só os próprios selos; quem concede é a administradora/o servidor.
-- Nada de dado é alterado/apagado. As permissões de escrita do visitante saem e NENHUMA é copiada para a conta logada.
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
declare n integer; t text; cols text[]; esperadas jsonb := jsonb_build_object(
  'rastreios', array['id'], 'estoque_itens', array['id'], 'estoque_compras', array['id'], 'ceg_config', array['ceg'], 'item_fotos', array['id'],
  'links_uteis', array['id'], 'cal_eventos', array['id'], 'tabela_precos', array['id'], 'sugestoes_tabela', array['id', 'status', 'created_at'], 'antiv_badges', array['id', 'joiner_cog']);
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-4d') then raise exception 'J4c-4d já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.meu_cog()') is null or to_regprocedure('public.is_admin()') is null then raise exception 'J1/A1 não estão aplicados. Nada foi alterado.'; end if;
  if to_regprocedure('public.cog_e_da_conta(text)') is null then raise exception 'O J4a não está aplicado (falta cog_e_da_conta). Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há administradora cadastrada. Nada foi alterado.'; end if;
  for t in select jsonb_object_keys(esperadas) loop
    if to_regclass('public.' || t) is null then raise exception 'A tabela % não existe. Nada foi alterado.', t; end if;
    select array_agg(x) into cols from jsonb_array_elements_text(esperadas -> t) x;
    select count(*) into n from pg_attribute where attrelid = ('public.' || t)::regclass and not attisdropped and attname = any (cols);
    if n <> array_length(cols, 1) then raise exception '% sem as colunas esperadas. Nada foi alterado.', t; end if;
  end loop;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4d', 'policy ' || tablename || ' / ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'public' and tablename in ('rastreios', 'estoque_itens', 'estoque_compras', 'ceg_config', 'item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos', 'sugestoes_tabela', 'antiv_badges');
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4d', 'acl ' || c.relname, coalesce(c.relacl::text, '(padrão do dono)') from pg_class c where c.oid = any (array['public.rastreios'::regclass, 'public.estoque_itens'::regclass, 'public.estoque_compras'::regclass, 'public.ceg_config'::regclass, 'public.item_fotos'::regclass, 'public.links_uteis'::regclass, 'public.cal_eventos'::regclass, 'public.tabela_precos'::regclass, 'public.sugestoes_tabela'::regclass, 'public.antiv_badges'::regclass]);
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4d', 'rls ' || c.relname, case when c.relrowsecurity then 'ligado' else 'desligado' end from pg_class c where c.oid = any (array['public.rastreios'::regclass, 'public.estoque_itens'::regclass, 'public.estoque_compras'::regclass, 'public.ceg_config'::regclass, 'public.item_fotos'::regclass, 'public.links_uteis'::regclass, 'public.cal_eventos'::regclass, 'public.tabela_precos'::regclass, 'public.sugestoes_tabela'::regclass, 'public.antiv_badges'::regclass]);
do $$
declare t text; v text;
begin
  foreach t in array array['rastreios', 'estoque_itens', 'estoque_compras', 'ceg_config', 'item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos', 'sugestoes_tabela', 'antiv_badges'] loop
    execute format('select ''linhas='' || count(*) from public.%I', t) into v;
    insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('J4c-4d', 'impressão ' || t, v);
  end loop;
end $$;

-- 1) RLS ligado, políticas antigas fora, visitante sem escrita; a administradora sempre com acesso próprio
do $$
declare t text; r record;
begin
  foreach t in array array['rastreios', 'estoque_itens', 'estoque_compras', 'ceg_config', 'item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos', 'sugestoes_tabela', 'antiv_badges'] loop
    execute format('alter table public.%I enable row level security', t);
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop execute format('drop policy %I on public.%I', r.policyname, t); end loop;
    execute format('revoke all on table public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('create policy admin_tudo on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- 2) conteúdo público: todos leem
do $$
declare t text;
begin
  foreach t in array array['item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos'] loop
    execute format('grant select on table public.%I to anon', t);
    execute format('create policy leitura_publica on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- 3) links dos grupos de WhatsApp: só conta ativada
create policy ativadas_leem on public.ceg_config for select to authenticated using ((select public.meu_cog()) is not null);

-- 4) sugestões de preço: qualquer pessoa sugere (limite por hora) e vê as pendentes; decidir é da administradora
grant select, insert on table public.sugestoes_tabela to anon;
create policy le_pendentes on public.sugestoes_tabela for select to anon, authenticated using (status = 'pendente');
create policy sugere_publico on public.sugestoes_tabela for insert to anon, authenticated
  with check (status = 'pendente' and (select count(*) from public.sugestoes_tabela s where s.created_at > now() - interval '1 hour') < 100);

-- 5) selos: a joiner lê os próprios
create policy joiner_le_proprios on public.antiv_badges for select to authenticated using (public.cog_e_da_conta(joiner_cog));

-- 6) conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_a text; v_d text; t text;
begin
  select count(*) into n from unnest(array['rastreios', 'estoque_itens', 'estoque_compras', 'ceg_config', 'antiv_badges']) x(nome)
   where has_table_privilege('anon', 'public.' || x.nome, 'SELECT') or has_table_privilege('anon', 'public.' || x.nome, 'INSERT') or has_table_privilege('anon', 'public.' || x.nome, 'UPDATE') or has_table_privilege('anon', 'public.' || x.nome, 'DELETE')
      or has_any_column_privilege('anon', 'public.' || x.nome, 'SELECT');
  if n > 0 then raise exception 'O visitante ainda tem permissão em tabela restrita. Transação desfeita.'; end if;
  select count(*) into n from unnest(array['item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos', 'sugestoes_tabela']) x(nome)
   where has_table_privilege('anon', 'public.' || x.nome, 'UPDATE') or has_table_privilege('anon', 'public.' || x.nome, 'DELETE');
  if n > 0 then raise exception 'O visitante altera ou apaga conteúdo. Transação desfeita.'; end if;
  if has_table_privilege('anon', 'public.item_fotos', 'INSERT') or has_table_privilege('anon', 'public.links_uteis', 'INSERT') or has_table_privilege('anon', 'public.cal_eventos', 'INSERT') or has_table_privilege('anon', 'public.tabela_precos', 'INSERT') then raise exception 'O visitante cria conteúdo. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('rastreios', 'estoque_itens', 'estoque_compras', 'ceg_config', 'item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos', 'sugestoes_tabela', 'antiv_badges') and ('anon' = any(roles) or 'public' = any(roles));
  if n <> 6 then raise exception 'Esperava 6 policies para visitante (4 leituras públicas + 2 de sugestões) e há %. Transação desfeita.', n; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('rastreios', 'estoque_itens', 'estoque_compras', 'ceg_config', 'item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos', 'sugestoes_tabela', 'antiv_badges');
  if n <> 18 then raise exception 'Esperava 18 policies novas e há %. Transação desfeita.', n; end if;
  foreach t in array array['rastreios', 'estoque_itens', 'estoque_compras', 'ceg_config', 'item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos', 'sugestoes_tabela', 'antiv_badges'] loop
    select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'J4c-4d' and objeto = 'impressão ' || t;
    execute format('select ''linhas='' || count(*) from public.%I', t) into v_d;
    if v_a is distinct from v_d then raise exception 'Os dados de % mudaram durante o script. Transação desfeita.', t; end if;
  end loop;
end $$;

commit;
