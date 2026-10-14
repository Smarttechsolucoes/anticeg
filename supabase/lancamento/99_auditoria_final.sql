-- AUDITORIA FINAL DO LANÇAMENTO — SOMENTE LEITURA (não altera nada). Rode no SQL Editor DEPOIS de todos os scripts do lançamento.
-- Lista TUDO o que o VISITANTE (chave pública, sem login) ainda alcança no banco e no Storage, e marca cada item como:
--   esperado   = faz parte do desenho do lançamento (conteúdo público do site ou função segura que só devolve o mínimo);
--   INESPERADO = alguma tabela, visão ou política que o visitante ainda alcança e NÃO deveria → corrigir antes de seguir;
--   REVISAR    = função ou objeto fora da lista: confirme se é de uso público de verdade.
-- Resultado ideal: nenhuma linha INESPERADO. Guarde o resultado (só nomes e contagens; nenhum dado pessoal sai daqui).
with
publico_ok as (select unnest(array[
  'config', 'pushes', 'item_fotos', 'links_uteis', 'cal_eventos', 'tabela_precos', 'sugestoes_tabela',
  'joiners_publico', 'claims_quadro', 'claims_vendidos', 'formulario_pedidos_publico']) as nome),
funcoes_ok as (select unnest(array[
  'entrar_com_arroba', 'contar_recrutados', 'solicitar_cadastro', 'resolver_recrutador', 'pedido_loja_criar', 'ceg_resumo', 'ceg_vencimentos',
  'is_admin', 'meu_cog', 'meu_joiner_id']) as nome),
rel as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity as rls
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')),
acesso as (
  select r.relname, r.relkind, r.rls,
         concat_ws('+', case when has_table_privilege('anon', r.oid, 'SELECT') or has_any_column_privilege('anon', r.oid, 'SELECT') then 'SELECT' end,
                        case when has_table_privilege('anon', r.oid, 'INSERT') or has_any_column_privilege('anon', r.oid, 'INSERT') then 'INSERT' end,
                        case when has_table_privilege('anon', r.oid, 'UPDATE') or has_any_column_privilege('anon', r.oid, 'UPDATE') then 'UPDATE' end,
                        case when has_table_privilege('anon', r.oid, 'DELETE') then 'DELETE' end,
                        case when has_table_privilege('anon', r.oid, 'TRUNCATE') then 'TRUNCATE' end) as privilegios,
         (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = r.relname and ('anon' = any(p.roles) or 'public' = any(p.roles))) as policies_visitante
    from rel r)
select 'tabela/visão' as tipo, a.relname as objeto, a.privilegios as o_visitante_pode,
       case when a.relkind = 'v' then 'visão (sem RLS própria)' when a.rls then 'RLS ligado' else 'RLS DESLIGADO' end as protecao,
       a.policies_visitante::text as policies_para_visitante,
       case when a.relname in (select nome from publico_ok)
              then case when a.relkind <> 'v' and not a.rls then 'INESPERADO (público sem RLS)'
                        when a.privilegios ~ '(UPDATE|DELETE|TRUNCATE)' and a.relname <> 'sugestoes_tabela' then 'INESPERADO (público com escrita)'
                        when a.relname = 'sugestoes_tabela' and a.privilegios ~ '(UPDATE|DELETE|TRUNCATE)' then 'INESPERADO (sugestões com alteração)'
                        else 'esperado' end
            else 'INESPERADO' end as situacao
  from acesso a
 where a.privilegios <> '' or a.policies_visitante > 0
union all
select 'função', p.oid::regprocedure::text, 'EXECUTE', case when p.prosecdef then 'security definer' else 'comum' end, '',
       case when p.proname in (select nome from funcoes_ok) then case when p.prosecdef or p.proname in ('is_admin', 'meu_cog', 'meu_joiner_id') then 'esperado' else 'REVISAR (comum)' end else 'REVISAR' end
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'EXECUTE')
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')   -- ignora funções de extensões
union all
select 'storage: política', p.policyname, p.cmd || ' para ' || array_to_string(p.roles, ','), coalesce(p.qual, p.with_check, ''), '',
       case when p.cmd = 'SELECT' and coalesce(p.qual, '') ~* 'bucket_id\s*=\s*''(avatars|fotos-itens|storage-itens)''' then 'esperado'
            else 'INESPERADO' end
  from pg_policies p
 where p.schemaname = 'storage' and p.tablename = 'objects' and ('anon' = any(p.roles) or 'public' = any(p.roles))
union all
select 'storage: bucket público', b.id, 'leitura por link', '', '',
       case when b.id in ('avatars', 'fotos-itens', 'storage-itens') then 'esperado' else 'INESPERADO' end
  from storage.buckets b where b.public
union all
select 'storage: bucket de comprovantes', b.id, case when b.public then 'PÚBLICO' else 'privado' end, 'limite=' || coalesce(b.file_size_limit::text, 'sem'), '',
       case when not b.public and b.file_size_limit is not null and b.allowed_mime_types is not null then 'esperado' else 'INESPERADO' end
  from storage.buckets b where b.id in ('comprovantes', 'mercari-comprovantes')
union all
select 'resumo', 'tabelas do schema public sem RLS (fora as visões)', count(*)::text, '', '',
       case when count(*) = 0 then 'esperado' else 'REVISAR' end
  from rel where relkind in ('r', 'p') and not rls and relname not like 'bkp\_%'
order by 6 desc, 1, 2;
