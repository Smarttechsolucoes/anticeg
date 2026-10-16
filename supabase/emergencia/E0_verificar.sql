-- ============================================================================
-- E0 — VERIFICAÇÃO (SOMENTE LEITURA). Rode antes e depois de E0 e compare.
-- ============================================================================

-- 1) Privilégios efetivos de anon por tabela (deve mostrar: bkp_unir_* tudo false;
--    delete = false exceto nas 12 tabelas apagáveis; truncate = false em todas).
select
  c.relname as tabela,
  has_table_privilege('anon', c.oid, 'SELECT')   as anon_select,
  has_table_privilege('anon', c.oid, 'INSERT')   as anon_insert,
  has_table_privilege('anon', c.oid, 'UPDATE')   as anon_update,
  has_table_privilege('anon', c.oid, 'DELETE')   as anon_delete,
  has_table_privilege('anon', c.oid, 'TRUNCATE') as anon_truncate
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relname;

-- 2) Resumo para conferência rápida
select
  count(*) filter (where c.relname like 'bkp\_unir\_%' escape '\' and has_any_column_privilege('anon', c.oid, 'SELECT')) as bkp_ainda_legiveis_por_anon,
  count(*) filter (where has_table_privilege('anon', c.oid, 'TRUNCATE'))                                                 as tabelas_com_truncate_anon,
  count(*) filter (where has_table_privilege('anon', c.oid, 'DELETE') and c.relname not like 'bkp\_unir\_%' escape '\')  as tabelas_com_delete_anon
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p');
-- Esperado após E0: 0, 0 e 12.

-- 3) Backup salvo (estado original)
select etapa, count(*) as concessoes_salvas, min(feito_em) as feito_em
from emergencia.grant_backup group by etapa order by min(feito_em);

-- ============================================================================
-- 4) O BACKUP ESTÁ INACESSÍVEL PARA anon/authenticated? (esperado: tudo false/0)
-- ============================================================================
-- 4a) Acesso ao schema, às tabelas e às funções do cofre
select
  has_schema_privilege('anon',          'emergencia', 'USAGE')  as anon_usa_schema,
  has_schema_privilege('authenticated', 'emergencia', 'USAGE')  as auth_usa_schema,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'emergencia' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
        or has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE'))) as tabelas_acessiveis,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'emergencia' and c.relkind = 'r' and c.relrowsecurity) as tabelas_com_rls,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'emergencia'
      and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))) as funcoes_executaveis;

-- 4b) O schema NÃO deve aparecer entre os expostos pela API (PostgREST).
--     Esperado: só "public, graphql_public" (ou similar), sem "emergencia" nem "seguranca".
select r.rolname, c as configuracao
from pg_roles r, unnest(r.rolconfig) c
where r.rolname = 'authenticator' and c like 'pgrst.db_schemas%';

-- ============================================================================
-- 5) config e DELETE preservado (Bloco 2). Esperado: false, true, 12 e 0.
--    O visitante NÃO apaga em config; o administrador logado MANTÉM (botão "Remover PIN" do painel); as 12 tabelas da lista seguem apagáveis; nenhuma tabela com TRUNCATE.
-- ============================================================================
select
  has_table_privilege('anon', 'public.config', 'DELETE')          as anon_apaga_config,
  has_table_privilege('authenticated', 'public.config', 'DELETE') as authenticated_apaga_config,
  (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and c.relname in ('cal_eventos', 'ceg_config', 'claims', 'estoque_compras', 'estoque_itens', 'item_fotos', 'joiner_storage', 'links_uteis', 'masterlist', 'push_subscriptions', 'pushes', 'rastreios')
      and has_table_privilege('anon', c.oid, 'DELETE') and has_table_privilege('authenticated', c.oid, 'DELETE')) as tabelas_da_lista_ainda_apagaveis,
  (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and (has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))) as tabelas_com_truncate;
