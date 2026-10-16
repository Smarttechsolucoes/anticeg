-- E0 — PRÉ-CHECAGEM (SOMENTE LEITURA; um SELECT; não altera nada; só nomes de tabelas e contagens, nenhum dado). Rode ANTES do E00/E0 e guarde o resultado: ele diz EXATAMENTE o que o E0 vai revogar.
-- O E0 só faz REVOKE (nada é apagado): (a) todo acesso de anon/authenticated às tabelas bkp_unir_*; (b) TRUNCATE/REFERENCES/TRIGGER/MAINTAIN em todas as tabelas de public;
--   (c) DELETE em todas as tabelas, exceto nas 12 em que o site apaga (lista abaixo). O código do site foi conferido em 2026-10-16: só apaga nessas 12 + config (botão "Remover PIN" do admin, hoje inativo).
with lista(t) as (values ('cal_eventos'), ('ceg_config'), ('claims'), ('estoque_compras'), ('estoque_itens'), ('item_fotos'), ('joiner_storage'), ('links_uteis'), ('masterlist'), ('push_subscriptions'), ('pushes'), ('rastreios')),
tb as (select c.oid, c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')),
priv(papel, op) as (values ('anon', 'DELETE'), ('authenticated', 'DELETE'))
select 1 as ordem, 'versão do Postgres (o REVOKE de MAINTAIN só existe a partir da 17)' as item, current_setting('server_version_num') as valor, 'informativo' as esperado
union all select 2, 'E00 aplicado (emergencia.grant_backup existe)', (to_regclass('emergencia.grant_backup') is not null)::text, 'false antes do E00; true depois'
union all select 3, 'E0 já aplicado (concessões salvas da etapa E0)',
       case when to_regclass('emergencia.grant_backup') is null then 'E00 ausente' else (xpath('/row/c/text()', query_to_xml('select count(*) c from emergencia.grant_backup where etapa = ''E0''', false, true, '')))[1]::text end, '0 antes do E0'
union all select 4, 'tabelas de public (r, p)', (select count(*)::text from tb), 'informativo'
union all select 5, 'tabelas bkp_unir_* com QUALQUER privilégio (tabela ou coluna) para anon/authenticated (o E0 remove)',
       (select count(*)::text from tb where relname like 'bkp\_unir\_%' escape '\' and (has_any_column_privilege('anon', oid, 'SELECT,INSERT,UPDATE,REFERENCES') or has_any_column_privilege('authenticated', oid, 'SELECT,INSERT,UPDATE,REFERENCES') or has_table_privilege('anon', oid, 'DELETE,TRUNCATE,TRIGGER') or has_table_privilege('authenticated', oid, 'DELETE,TRUNCATE,TRIGGER'))), '31 hoje (RLS ligado e sem policy: privilégio inútil)'
union all select 6, 'tabelas SEM RLS (o E0 não muda RLS; só para contexto)', (select count(*)::text from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity), 'informativo'
union all select 7, 'DELETE que o E0 REVOGA de anon, em tabelas não-bkp e fora da lista (nomes)',
       coalesce((select string_agg(relname, ', ' order by relname) from tb where relname not like 'bkp\_unir\_%' escape '\' and relname not in (select t from lista) and has_table_privilege('anon', oid, 'DELETE')), '(nenhuma)'), 'o site não apaga nelas'
union all select 8, 'DELETE que o E0 REVOGA de authenticated, em tabelas não-bkp e fora da lista (nomes)',
       coalesce((select string_agg(relname, ', ' order by relname) from tb where relname not like 'bkp\_unir\_%' escape '\' and relname not in (select t from lista) and has_table_privilege('authenticated', oid, 'DELETE')), '(nenhuma)'), 'esperado: só config (botão "Remover PIN" do admin, inativo) e tabelas em que o site não apaga'
union all select 9, 'tabelas da lista (12) que EXISTEM e mantêm DELETE', (select count(*)::text || ' de 12: ' || coalesce(string_agg(relname, ', ' order by relname), '') from tb where relname in (select t from lista)), '12 de 12'
union all select 10, 'tabelas com TRUNCATE para anon / authenticated', (select count(*) filter (where has_table_privilege('anon', oid, 'TRUNCATE'))::text || ' / ' || count(*) filter (where has_table_privilege('authenticated', oid, 'TRUNCATE'))::text from tb), 'o E0 zera'
union all select 11, 'tabelas com REFERENCES / TRIGGER para anon', (select count(*) filter (where has_table_privilege('anon', oid, 'REFERENCES'))::text || ' / ' || count(*) filter (where has_table_privilege('anon', oid, 'TRIGGER'))::text from tb), 'o E0 zera'
union all select 12, 'concessões a PUBLIC em tabelas de public (o E0 NÃO as remove; o aviso do E0 as lista)',
       (select count(*)::text from tb where exists (select 1 from aclexplode(coalesce((select relacl from pg_class x where x.oid = tb.oid), acldefault('r', (select relowner from pg_class x where x.oid = tb.oid)))) a where a.grantee = 0)), '0'
union all select 13, 'config: anon / authenticated têm DELETE hoje', (select has_table_privilege('anon', 'public.config', 'DELETE')::text || ' / ' || has_table_privilege('authenticated', 'public.config', 'DELETE')::text where to_regclass('public.config') is not null), 'false / true (o E0 tira o DELETE do authenticated em config)'
order by 1;
