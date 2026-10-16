-- AUDITORIA 2 — ACESSO EFETIVO (SOMENTE LEITURA; um único SELECT; não altera nada; só nomes de tabelas e estados, nenhum dado).
-- Por que existe: o AUD_01 listou PRIVILÉGIOS concedidos. Privilégio não é acesso: com RLS ligado, quem não tem policy aplicável NÃO acessa nada, mesmo com GRANT.
-- Este script cruza, por tabela, papel (visitante = anon; logado = authenticated) e operação, o privilégio com o RLS e as policies PERMISSIVAS (as RESTRITIVAS só são contadas):
--   ABERTO (sem RLS)        = RLS desligado + privilégio  → qualquer um faz a operação
--   ABERTO (policy livre)   = RLS ligado + policy aplicável com condição vazia/true → qualquer um faz
--   condicionado            = RLS ligado + policy aplicável com condição (ex.: só a própria joiner)
--   bloqueado (RLS sem policy) / bloqueado (sem privilégio)
-- Limitações assumidas: não avalia o conteúdo das condições (só se são "true"/vazias); para UPDATE/DELETE o Postgres também exige policy de SELECT visível, o que torna o resultado
--   uma visão pelo lado "mais aberto" (se disser bloqueado, é bloqueado); privilégios por coluna entram só como "tem algum privilégio".
-- Rode no SQL Editor da produção, cole TUDO, Run, exporte o CSV.

with papeis(papel) as (values ('anon'), ('authenticated')),
ops(op, priv, cmd) as (values ('LER', 'SELECT', 'SELECT'), ('INSERIR', 'INSERT', 'INSERT'), ('ALTERAR', 'UPDATE', 'UPDATE'), ('APAGAR', 'DELETE', 'DELETE')),
tabelas as (select c.oid, c.relname, c.relrowsecurity as rls from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')),
estado as (
  select t.relname, p.papel, o.op,
         (case when o.priv in ('INSERT', 'UPDATE', 'SELECT') then has_table_privilege(p.papel, t.oid, o.priv) or has_any_column_privilege(p.papel, t.oid, o.priv) else has_table_privilege(p.papel, t.oid, o.priv) end) as tem_priv,
         t.rls,
         (select count(*) from pg_policies pol where pol.schemaname = 'public' and pol.tablename = t.relname and pol.permissive = 'PERMISSIVE'
             and (pol.roles && array[p.papel, 'public']::name[]) and pol.cmd in (o.cmd, 'ALL')) as n_pol,
         (select count(*) from pg_policies pol where pol.schemaname = 'public' and pol.tablename = t.relname and pol.permissive = 'PERMISSIVE'
             and (pol.roles && array[p.papel, 'public']::name[]) and pol.cmd in (o.cmd, 'ALL')
             and ((o.cmd = 'INSERT' and coalesce(nullif(btrim(pol.with_check), ''), 'true') in ('true', '(true)'))
               or (o.cmd <> 'INSERT' and coalesce(nullif(btrim(pol.qual), ''), 'true') in ('true', '(true)')))) as n_livre,
         (select count(*) from pg_policies pol where pol.schemaname = 'public' and pol.tablename = t.relname and pol.permissive = 'RESTRICTIVE' and (pol.roles && array[p.papel, 'public']::name[])) as n_restr
    from tabelas t cross join papeis p cross join ops o
),
classe as (
  select relname, papel, op,
         case when not tem_priv then 'bloqueado (sem privilégio)'
              when not rls then 'ABERTO (sem RLS)'
              when n_pol = 0 then 'bloqueado (RLS sem policy)'
              when n_livre > 0 and n_restr = 0 then 'ABERTO (policy livre)'
              when n_livre > 0 then 'condicionado (livre + restritiva)'
              else 'condicionado' end as c
    from estado
),
resumo as (
  select relname,
    string_agg(case when papel = 'anon' then op || '=' || c end, ' | ' order by case op when 'LER' then 1 when 'INSERIR' then 2 when 'ALTERAR' then 3 else 4 end) filter (where papel = 'anon') as visitante,
    string_agg(case when papel = 'authenticated' then op || '=' || c end, ' | ' order by case op when 'LER' then 1 when 'INSERIR' then 2 when 'ALTERAR' then 3 else 4 end) filter (where papel = 'authenticated') as logado,
    bool_or(papel = 'anon' and op in ('INSERIR', 'ALTERAR', 'APAGAR') and c like 'ABERTO%') as visitante_escreve_livre,
    bool_or(papel = 'anon' and op = 'LER' and c like 'ABERTO%') as visitante_le_livre,
    bool_and(c like 'bloqueado%') as tudo_bloqueado
   from classe group by relname
)
select '1 por tabela' as secao, relname as item,
       'VISITANTE: ' || visitante as valor,
       case when visitante_escreve_livre then 'ALERTA: visitante ESCREVE livremente (efetivo)'
            when visitante_le_livre then 'REVISAR: visitante LÊ livremente (efetivo)'
            when tudo_bloqueado then 'sem acesso efetivo para ninguém (privilégios à toa)'
            else '' end || ' || LOGADO: ' || logado as leitura
  from resumo
union all
select '2 resumo', 'tabelas em que o visitante ESCREVE livremente (efetivo)', count(*)::text, 'é a lista que o lançamento (J4b → J5) precisa fechar' from resumo where visitante_escreve_livre
union all
select '2 resumo', 'tabelas em que o visitante LÊ livremente (efetivo)', count(*)::text, 'dados pessoais aqui = vazamento' from resumo where visitante_le_livre
union all
select '2 resumo', 'tabelas SEM acesso efetivo (ex.: bkp_unir_* com RLS e sem policy)', count(*)::text, 'privilégio concedido mas inútil; E0 remove por higiene' from resumo where tudo_bloqueado
union all
select '2 resumo', 'visitante APAGA livremente (efetivo)', coalesce(string_agg(relname, ', ' order by relname), 'nenhuma'), 'o E0 tira DELETE de tabelas em que o site nunca apaga' from classe where papel = 'anon' and op = 'APAGAR' and c like 'ABERTO%'
union all
select '2 resumo', 'visitante tem TRUNCATE (não passa por RLS; a API REST não expõe, mas é privilégio a mais)', count(*)::text, 'o E0 remove'
  from tabelas t where has_table_privilege('anon', t.oid, 'TRUNCATE')
order by 1, 2;
