-- DUP — RELATÓRIO DE DUPLICIDADES QUE IMPEDEM A ATIVAÇÃO AUTOMÁTICA (SOMENTE LEITURA; não altera nenhuma conta, joiner, claim, pagamento ou item).
-- Uma joiner só ativa sozinha se tiver e-mail de formato válido, ÚNICO entre as joiners, e COG único ignorando maiúsculas (regra do J1: ativar_minha_conta). As demais viram "vínculo pendente" e a administradora decide.
-- Cada linha é UMA joiner bloqueada, com o motivo, o grupo (joiners que compartilham o mesmo COG ou e-mail), o que ela tem (itens, claims, demandas) e o e-mail MASCARADO (primeira letra + domínio), para a administradora decidir sem expor o endereço completo.
-- Use com a administradora (tela de vínculos pendentes) ou exporte para uma planilha PRIVADA. Não cole em chat e não commite a saída.
with j as (
  select id, cog, lower(trim(cog)) as lc, lower(trim(coalesce(email, ''))) as em, nullif(trim(coalesce(nome, '')), '') as nome,
         (lower(trim(coalesce(email, ''))) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') as email_valido
  from public.joiners where coalesce(trim(cog), '') <> ''
), grp_cog as (select lc, count(*) as n, array_agg(id order by id) as ids from j group by lc having count(*) > 1),
   grp_em as (select em, count(*) as n, array_agg(id order by id) as ids from j where email_valido group by em having count(*) > 1),
   itens as (select lower(trim(cog)) as lc, count(*) as n from public.masterlist group by 1),
   clm as (select lower(trim(joiner_cog)) as lc, count(*) as n from public.claims group by 1),
   dem as (select lower(trim(joiner_cog)) as lc, count(*) as n from public.pagamento_demandas group by 1),
   contas as (select joiner_id from public.contas_joiner)
select j.id as joiner_id,
       concat_ws(' + ', case when gc.lc is not null then 'COG repetido (' || gc.n || ')' end, case when ge.em is not null then 'e-mail compartilhado (' || ge.n || ')' end, case when not j.email_valido then 'sem e-mail válido' end) as motivo,
       coalesce('cog:' || gc.lc, 'email:' || md5(ge.em), 'sem-grupo') as grupo,
       case when j.email_valido then left(j.em, 1) || '***@' || split_part(j.em, '@', 2) else '(sem e-mail válido)' end as email_mascarado,
       coalesce(i.n, 0) as itens, coalesce(c.n, 0) as claims, coalesce(d.n, 0) as demandas,
       (j.id in (select joiner_id from contas)) as ja_tem_conta,
       case
         when j.id in (select joiner_id from contas) then 'já vinculada: nada a fazer'
         when not j.email_valido and gc.lc is null and ge.em is null then 'A: cadastrar e-mail válido (contato direto) e a joiner ativa sozinha'
         when ge.em is not null and gc.lc is not null and (select count(distinct lc) from j j2 where j2.em = j.em) = 1 then 'B: mesma pessoa com variações de maiúscula - escolher UMA joiner "principal" do grupo'
         when ge.em is not null and (select count(distinct lc) from j j2 where j2.em = j.em) > 1 then 'C: e-mail usado em @ diferentes - perguntar à pessoa qual é o principal; os demais ficam em modo limitado ou ganham outro e-mail'
         when gc.lc is not null then 'B: COG repetido - escolher UMA joiner "principal" do grupo'
         else 'A: cadastrar e-mail válido' end as estrategia
from j
left join grp_cog gc on gc.lc = j.lc
left join grp_em ge on ge.em = j.em and j.email_valido
left join itens i on i.lc = j.lc
left join clm c on c.lc = j.lc
left join dem d on d.lc = j.lc
where gc.lc is not null or ge.em is not null or not j.email_valido
order by (coalesce(i.n, 0) + coalesce(c.n, 0) + coalesce(d.n, 0)) desc, grupo, j.id;
