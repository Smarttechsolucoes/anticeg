-- PILOTO DE SENHAS — FOTO DE PERMISSÕES (SOMENTE LEITURA; só contagens e um código de conferência, nenhum dado). Rode NA PRODUÇÃO antes do J1 e de novo depois do J4d e depois do P1.
-- O que prova: que os SQLs do piloto não mudaram NENHUMA permissão, RLS ou política do que já existia. Os dois códigos ("hash") têm de ser IDÊNTICOS nas três rodadas.
-- (As tabelas e funções NOVAS do piloto ficam de fora desta conta de propósito; elas são conferidas no P1_verificar.sql.)
with t as (
  select c.relname,
         c.relkind::text || ':' || c.relrowsecurity::text || ':'
         || has_table_privilege('anon', c.oid, 'select')::text || has_table_privilege('anon', c.oid, 'insert')::text || has_table_privilege('anon', c.oid, 'update')::text || has_table_privilege('anon', c.oid, 'delete')::text || ':'
         || has_table_privilege('authenticated', c.oid, 'select')::text || has_table_privilege('authenticated', c.oid, 'insert')::text || has_table_privilege('authenticated', c.oid, 'update')::text || has_table_privilege('authenticated', c.oid, 'delete')::text || ':'
         || coalesce((select string_agg(p.policyname || '/' || p.cmd || '/' || array_to_string(p.roles, ',') || '/' || coalesce(p.qual, '') || '/' || coalesce(p.with_check, ''), ' ; ' order by p.policyname)
                        from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname), '') as linha
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'p')
     and c.relname not in ('contas_joiner', 'vinculos_pendentes', 'tentativas_acesso', 'ativacao_ondas', 'ativacao_estado', 'joiners_publico')
), f as (
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as nome,
         has_function_privilege('anon', p.oid, 'execute')::text || has_function_privilege('authenticated', p.oid, 'execute')::text as linha
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname not in ('admin_buscar_joiners', 'admin_desvincular_conta', 'admin_resolver_vinculo', 'admin_vinculos_pendentes', 'ativacao_liberada', 'ativar_minha_conta', 'cog_e_da_conta',
                           'contar_recrutados', 'entrar_com_arroba', 'meu_cog', 'meu_joiner_id', 'meus_dados')
)
select 'tabelas/visões que já existiam: quantidade / código de conferência' as item,
       (select count(*) from t)::text || ' / ' || (select md5(coalesce(string_agg(relname || '=' || linha, E'\n' order by relname), '')) from t) as valor
union all
select 'funções que já existiam: quantidade / código de conferência',
       (select count(*) from f)::text || ' / ' || (select md5(coalesce(string_agg(nome || '=' || linha, E'\n' order by nome), '')) from f)
union all
select 'políticas em todo o schema public: quantidade', (select count(*) from pg_policies where schemaname = 'public' and tablename not in ('contas_joiner', 'vinculos_pendentes', 'tentativas_acesso', 'ativacao_ondas', 'ativacao_estado', 'joiners_publico'))::text;
