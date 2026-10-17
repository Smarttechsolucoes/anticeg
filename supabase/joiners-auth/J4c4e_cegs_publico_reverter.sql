-- J4c-4e — REVERSÃO (só remove as 3 funções; nenhuma tabela é tocada). Sem elas, a lista de CEGs, o calendário geral e a página de cada CEG do site novo ficam vazios.
begin;
drop function if exists public.ceg_resumo();
drop function if exists public.ceg_vencimentos();
drop function if exists public.ceg_itens(text);
commit;
