-- J4c-4f — VERIFICAÇÃO (somente leitura; só nomes e contagens). Esperado: em cada tabela de estoque existente, RLS ligado, 2 policies (leitura pública + administradora),
-- visitante com SELECT e sem INSERT/UPDATE/DELETE; nenhum dado alterado.
select 'tabelas de estoque presentes' as item, (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque'))::text as valor
union all select 'RLS ligado (esperado = presentes)', (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity and c.relname in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque'))::text
union all select 'policies (esperado = 2 x presentes)', (select count(*) from pg_policies where schemaname = 'public' and tablename in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque'))::text
union all select 'policies de escrita para visitante/PUBLIC (esperado 0)', (select count(*) from pg_policies where schemaname = 'public' and tablename in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque') and cmd <> 'SELECT' and ('anon' = any (roles) or 'public' = any (roles)))::text
union all select 'visitante escreve em estoque (esperado false)',
       (select coalesce(bool_or(has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE') or has_table_privilege('anon', c.oid, 'TRUNCATE')
                                or has_any_column_privilege('anon', c.oid, 'INSERT') or has_any_column_privilege('anon', c.oid, 'UPDATE')), false)::text
          from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque'))
union all select 'visitante lê estoque em todas as presentes (esperado true)',
       (select coalesce(bool_and(has_table_privilege('anon', c.oid, 'SELECT')), true)::text
          from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname in ('wave_maker_estoque', 'paper_tales_estoque', 'promo_13_estoque', 'odd_fresh_estoque'))
union all select 'estado registrado (linhas J4c-4f, esperado >= 4)', (select count(*) from emergencia.c0b_estado_anterior where etapa = 'J4c-4f')::text;
