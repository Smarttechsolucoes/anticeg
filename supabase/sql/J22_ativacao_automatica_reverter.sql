-- Desfaz a J22: apaga só a função ativar_conta_automatica. Contas já ligadas por ela continuam ligadas (use admin_desvincular_conta para desfazer uma a uma;
-- os casos estão em public.contas_auditoria com acao = 'ativacao_automatica').
begin;
drop function if exists public.ativar_conta_automatica(uuid, text);
commit;
