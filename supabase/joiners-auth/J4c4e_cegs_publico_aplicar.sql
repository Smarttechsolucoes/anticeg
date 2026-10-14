-- J4c-4e — VISÃO COMUNITÁRIA DOS CEGs SEM DADOS PESSOAIS: ceg_resumo(), ceg_vencimentos() e ceg_itens(ceg)
-- Por que existe: a lista de CEGs, o calendário geral de vencimentos e a página de cada CEG leem a MASTERLIST INTEIRA (de todas as joiners). O J4b, com razão, passa a mostrar a cada joiner só
-- as linhas dela. Sem este passo, essas telas ficariam vazias ou erradas para TODAS no lançamento. Estas funções devolvem só o que a comunidade já vê hoje, SEM valores financeiros de terceiros:
--   ceg_resumo()        : por CEG, quantidade de itens, de joiners e de itens por situação (números, ninguém identificado). Pública (visitante também vê a lista de CEGs).
--   ceg_vencimentos()   : datas de vencimento por CEG (sem dono, sem valor, sem pagamento). Pública (o calendário é público).
--   ceg_itens(ceg)      : a lista de itens de UM CEG com @, nome, item, situação e informações do item, para joiner com conta ATIVADA (ou administradora).
--                         NÃO traz valor, frete, taxa nem pagamento de ninguém (esses só aparecem nas linhas da própria joiner, que continuam vindo da masterlist). Visitante e conta sem vínculo recebem lista vazia.
-- ADITIVO: cria só funções (SECURITY DEFINER, search_path vazio); não altera tabela, policy nem permissão existente. Pode ser aplicado junto com o J4b ou antes dele.
-- Decisão de produto (D1): a página de cada CEG deixa de mostrar o VALOR/FRETE/TAXA de OUTRAS joiners (hoje aparece para qualquer conta). Para manter, seria preciso aceitar a leitura dos valores de terceiros.
begin;

do $$
declare n integer;
begin
  if to_regprocedure('public.meu_cog()') is null or to_regprocedure('public.is_admin()') is null then raise exception 'J1/A1 não estão aplicados. Nada foi alterado.'; end if;
  if to_regclass('public.masterlist') is null then raise exception 'A tabela masterlist não existe. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.masterlist'::regclass and not attisdropped
     and attname in ('id', 'ceg', 'cog', 'nome', 'nome_do_item', 'status', 'info_adicionais', 'venc_item', 'venc_frete', 'venc_rf');
  if n <> 10 then raise exception 'masterlist sem as colunas esperadas (achei % de 10). Nada foi alterado.', n; end if;
  if to_regprocedure('public.ceg_resumo()') is not null or to_regprocedure('public.ceg_vencimentos()') is not null or to_regprocedure('public.ceg_itens(text)') is not null then raise exception 'As funções de CEG já existem. Nada foi alterado.'; end if;
end $$;

create function public.ceg_resumo() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('ceg', g.ceg, 'itens', g.itens, 'joiners', g.joiners, 'status_counts', g.sc) order by g.ceg), '[]'::jsonb)
    from (select t.ceg, sum(t.c)::bigint as itens, jsonb_object_agg(t.st, t.c) as sc,
                 (select count(distinct m2.cog) from public.masterlist m2 where coalesce(m2.ceg, '—') = t.ceg and (m2.nome is null or m2.nome <> 'Disponivel') and m2.cog is not null) as joiners
            from (select coalesce(m.ceg, '—') as ceg, coalesce(m.status, 'Pré-venda') as st, count(*) as c from public.masterlist m where m.nome is null or m.nome <> 'Disponivel' group by 1, 2) t
           group by t.ceg) g
$$;
revoke all on function public.ceg_resumo() from public;
grant execute on function public.ceg_resumo() to anon, authenticated, service_role;

create function public.ceg_vencimentos() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('ceg', d.ceg, 'venc_item', d.venc_item, 'venc_frete', d.venc_frete, 'venc_rf', d.venc_rf)), '[]'::jsonb)
    from (select distinct m.ceg, m.venc_item, m.venc_frete, m.venc_rf from public.masterlist m where m.venc_item is not null or m.venc_frete is not null or m.venc_rf is not null) d
$$;
revoke all on function public.ceg_vencimentos() from public;
grant execute on function public.ceg_vencimentos() to anon, authenticated, service_role;

create function public.ceg_itens(p_ceg text) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when (select public.meu_cog()) is null and not (select public.is_admin()) then '[]'::jsonb
    else coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'ceg', m.ceg, 'cog', m.cog, 'nome', m.nome, 'nome_do_item', m.nome_do_item, 'status', m.status, 'info_adicionais', m.info_adicionais) order by m.id)
                     from public.masterlist m where m.ceg = p_ceg and coalesce(m.nome, '') not ilike 'disponivel'), '[]'::jsonb) end
$$;
revoke all on function public.ceg_itens(text) from public, anon;
grant execute on function public.ceg_itens(text) to authenticated, service_role;

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer;
begin
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('ceg_resumo', 'ceg_vencimentos', 'ceg_itens') and p.prosecdef and p.proconfig = array['search_path=""'];
  if n <> 3 then raise exception 'As funções de CEG não estão todas com security definer e search_path vazio. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.ceg_itens(text)', 'EXECUTE') then raise exception 'O visitante executa ceg_itens. Transação desfeita.'; end if;
  if not has_function_privilege('anon', 'public.ceg_resumo()', 'EXECUTE') or not has_function_privilege('anon', 'public.ceg_vencimentos()', 'EXECUTE') then raise exception 'O resumo público dos CEGs não está acessível ao visitante. Transação desfeita.'; end if;
end $$;

commit;
