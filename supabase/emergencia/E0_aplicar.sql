-- ============================================================================
-- E0 — CONTENÇÃO SEM IMPACTO NO SITE  (pré-requisito: E00_ferramentas_backup.sql)
-- ============================================================================
-- O que faz (somente REVOKE; nenhum dado é alterado ou apagado):
--   1) Salva o estado original das permissões (emergencia.grant_backup).
--   2) Tira TODO acesso de anon/authenticated às 31 tabelas bkp_unir_* (backups de
--      cadastros, inclusive PII). O site não usa nenhuma delas.
--   3) Tira TRUNCATE/REFERENCES/TRIGGER (e MAINTAIN no PG17+) de anon/authenticated
--      em todas as tabelas de public. O site nunca usa essas operações.
--   4) Tira DELETE de anon e authenticated nas tabelas em que o site NUNCA apaga. As 12 tabelas em
--      que o painel admin apaga continuam apagáveis até a etapa de admin (E2).
--
-- O que NÃO faz: não fecha leitura de joiners, pedidos, etc. (isso é E2/E3).
--
-- Funcionalidade afetada: nenhuma, desde que (a) nenhuma automação externa use a
-- chave anon para apagar/truncar, e (b) a revisão da lista de 12 tabelas abaixo
-- esteja correta. Reversão: E0_reverter.sql (restaura exatamente do backup).
--
-- Seguro rodar uma vez. Uma segunda execução é recusada (para não sobrescrever o
-- backup do estado original com o estado já alterado).
-- ============================================================================

begin;

do $$
begin
  if to_regclass('emergencia.grant_backup') is null then
    raise exception 'Rode antes E00_ferramentas_backup.sql';
  end if;
  if exists (select 1 from emergencia.grant_backup where etapa = 'E0') then
    raise exception 'E0 já foi aplicada. Rode E0_reverter.sql antes de reaplicar.';
  end if;
end $$;

-- 1) Backup do estado original (concessões a PUBLIC, anon e authenticated)
insert into emergencia.grant_backup (etapa, tabela, grantee, privilege_type)
select 'E0', c.relname,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
       a.privilege_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(c.relacl) a
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated'));

-- 1b) Backup das concessões POR COLUNA (REVOKE ALL na tabela também as remove)
insert into emergencia.grant_backup (etapa, tabela, grantee, privilege_type, coluna)
select 'E0', c.relname,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
       a.privilege_type, att.attname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute att on att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
cross join lateral aclexplode(att.attacl) a
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and att.attacl is not null
  and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated'));

-- 1c) Aviso: concessões a PUBLIC em tabelas valem para anon e este script NÃO as remove
do $$
declare n integer;
begin
  select count(*) into n from emergencia.grant_backup
   where etapa = 'E0' and grantee = 'PUBLIC' and coluna is null;
  if n > 0 then
    raise warning 'Há % concessões a PUBLIC em tabelas de public: o REVOKE de anon não as remove. Veja: select * from emergencia.grant_backup where etapa = ''E0'' and grantee = ''PUBLIC'';', n;
  end if;
end $$;

-- 2) Backups de cadastros: nenhum acesso pela API
do $$
declare r record;
begin
  for r in select tablename from pg_tables
           where schemaname = 'public' and tablename like 'bkp\_unir\_%' escape '\' loop
    execute format('revoke all on table public.%I from anon, authenticated', r.tablename);
  end loop;
end $$;

-- 3) Operações que o site nunca usa
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, references, trigger on table public.%I from anon, authenticated', r.tablename);
    if current_setting('server_version_num')::int >= 170000 then
      execute format('revoke maintain on table public.%I from anon, authenticated', r.tablename);
    end if;
  end loop;
end $$;

-- 4) DELETE só continua onde o painel admin realmente apaga (análise do código).
--    "config": o visitante (anon) perde o DELETE (se ainda tiver); o administrador logado (authenticated) MANTÉM o DELETE, porque o painel o usa ("Remover PIN") e a RLS do B8
--    já impede qualquer um que não seja administradora de gravar nessa tabela. Assim nenhum botão do painel deixa de funcionar.
do $$
declare
  r record;
  apagaveis text[] := array[
    'cal_eventos',        -- AdminTab: remover evento do calendário
    'ceg_config',         -- WhatsappCegsBlock: remover link de grupo
    'claims',             -- ClaimPublicoPageLegacy: cancelar claim
    'estoque_compras',    -- ControleEstoqueTab
    'estoque_itens',      -- ControleEstoqueTab
    'item_fotos',         -- CegDetailView / CegPage / AdminGaleria
    'joiner_storage',     -- AdminTab
    'links_uteis',        -- AdminLinks
    'masterlist',         -- AdminDisponivel
    'push_subscriptions', -- PerfilTab: desativar push
    'pushes',             -- App: remover aviso
    'rastreios'           -- RastreiosTab
  ];
begin
  for r in select tablename from pg_tables
           where schemaname = 'public'
             and tablename not like 'bkp\_unir\_%' escape '\'
             and tablename <> 'config'
             and tablename <> all (apagaveis) loop
    -- anon E authenticated: se o cadastro público do Supabase Auth estiver ligado, qualquer
    -- pessoa vira "authenticated"; o site hoje só usa anon, então nada se perde.
    execute format('revoke delete on table public.%I from anon, authenticated', r.tablename);
  end loop;
end $$;
-- config: só o visitante perde DELETE; o administrador logado continua apagando chaves pelo painel
do $$
begin
  if to_regclass('public.config') is not null then execute 'revoke delete on table public.config from anon'; end if;
end $$;

-- Conferência final DENTRO da transação: o E0 só pode ter REMOVIDO privilégios previstos. Compara o estado atual com o backup que o próprio E0 gravou no início (emergencia.grant_backup, etapa E0).
-- Preservado por contrato: SELECT/INSERT/UPDATE (tabela e coluna) de anon/authenticated/PUBLIC em tabelas que não são bkp_unir_*; DELETE nas 12 tabelas da lista; DELETE do authenticated em config. Qualquer diferença desfaz tudo.
do $$
declare n integer; v_outros text;
begin
  with antes as (
    select tabela, grantee, privilege_type, coalesce(coluna, '') as coluna from emergencia.grant_backup
     where etapa = 'E0' and tabela not like 'bkp\_unir\_%' escape '\' and grantee in ('PUBLIC', 'anon', 'authenticated')
       and (privilege_type in ('SELECT', 'INSERT', 'UPDATE')
            or (privilege_type = 'DELETE' and (tabela in ('cal_eventos', 'ceg_config', 'claims', 'estoque_compras', 'estoque_itens', 'item_fotos', 'joiner_storage', 'links_uteis', 'masterlist', 'push_subscriptions', 'pushes', 'rastreios') or (tabela = 'config' and grantee = 'authenticated'))))),
  depois as (
    select c.relname::text as tabela, case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee)::text end as grantee, a.privilege_type::text as privilege_type, ''::text as coluna
      from pg_class c cross join lateral aclexplode(c.relacl) a
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname not like 'bkp\_unir\_%' escape '\'
       and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated'))
       and (a.privilege_type in ('SELECT', 'INSERT', 'UPDATE')
            or (a.privilege_type = 'DELETE' and (c.relname in ('cal_eventos', 'ceg_config', 'claims', 'estoque_compras', 'estoque_itens', 'item_fotos', 'joiner_storage', 'links_uteis', 'masterlist', 'push_subscriptions', 'pushes', 'rastreios') or (c.relname = 'config' and pg_get_userbyid(a.grantee) = 'authenticated'))))
    union all
    select c.relname::text, case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee)::text end, a.privilege_type::text, att.attname::text
      from pg_class c join pg_attribute att on att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
      cross join lateral aclexplode(att.attacl) a
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname not like 'bkp\_unir\_%' escape '\' and att.attacl is not null
       and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated')))
  select count(*) into n from ((select * from antes except select * from depois) union all (select * from depois except select * from antes)) d;
  if n <> 0 then raise exception 'O E0 alterou % privilégio(s) que não podia (SELECT/INSERT/UPDATE ou DELETE preservado). Transação desfeita.', n; end if;
  -- nada de bkp_unir_* acessível, nenhum TRUNCATE/REFERENCES/TRIGGER, e DELETE só onde previsto
  select count(*) into n from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname like 'bkp\_unir\_%' escape '\'
    and (has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES') or has_any_column_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
         or has_table_privilege('anon', c.oid, 'DELETE,TRUNCATE,TRIGGER') or has_table_privilege('authenticated', c.oid, 'DELETE,TRUNCATE,TRIGGER'));
  if n <> 0 then raise exception '% tabela(s) bkp_unir_* ainda acessível(is). Transação desfeita.', n; end if;
  select count(*) into n from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and (has_table_privilege('anon', c.oid, 'TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('authenticated', c.oid, 'TRUNCATE,REFERENCES,TRIGGER'));
  if n <> 0 then raise exception '% tabela(s) ainda com TRUNCATE/REFERENCES/TRIGGER. Transação desfeita.', n; end if;
  select string_agg(c.relname, ', ') into v_outros from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname not like 'bkp\_unir\_%' escape '\'
    and c.relname not in ('cal_eventos', 'ceg_config', 'claims', 'estoque_compras', 'estoque_itens', 'item_fotos', 'joiner_storage', 'links_uteis', 'masterlist', 'push_subscriptions', 'pushes', 'rastreios')
    and (has_table_privilege('anon', c.oid, 'DELETE') or (c.relname <> 'config' and has_table_privilege('authenticated', c.oid, 'DELETE')));
  if v_outros is not null then raise exception 'DELETE ainda presente fora do previsto: %. Transação desfeita.', v_outros; end if;
end $$;

commit;
