-- E1 — FILA ANTES DE LIGAR O ACIONADOR (SOMENTE LEITURA). Rode no SQL Editor do projeto de PRODUÇÃO, imediatamente antes de instalar o acionador e de novo se algo mudar.
-- Mostra o que a função perfil-sync PROCESSARIA no próximo disparo. Não altera nada. Não mostra nome nem e-mail de ninguém (só números, tipos e nomes de campos).
-- As partes A e B funcionam antes e depois do E1. A parte C só existe depois do E1: rode-a separadamente, depois que o SQL do E1 estiver aplicado.

-- A) Resumo da fila. Esperado antes de ativar: nenhuma linha (fila vazia) OU só itens 'enviado'/'cancelado'.
select p.tipo, p.status, count(*) as itens, min(p.criado_em)::date as mais_antigo, max(p.tentativas) as maior_numero_de_tentativas
  from public.perfil_sync_pendente p
 group by p.tipo, p.status
 order by p.tipo, p.status;

-- B) O que o perfil-sync pegaria AGORA (mesmo critério de public.perfil_sync_proximos). Esperado: nenhuma linha. Se aparecer algo, NÃO ative o acionador: me mande esta tabela.
select p.id as item_da_fila, p.tipo, p.status, p.tentativas, p.criado_em, p.joiner_id, p.dados ->> 'tarefa_id' as tarefa_id,
       case when p.tipo = 'email' then 'gravaria o e-mail novo em Dados!C (ação antiga atualizar_joiner)'
            else 'gravaria o ESTADO ATUAL de nome/e-mail do cadastro em Dados (ação atualizar_cadastro)' end as o_que_faria
  from public.perfil_sync_pendente p
 where p.status in ('pendente', 'falhou') and p.tentativas < 6
   and (p.tentado_em is null or p.tentado_em < now() - (interval '2 minutes' * power(2, p.tentativas)))
 order by p.criado_em
 limit 50;

-- C) SÓ DEPOIS DO E1 (remova os dois traços da frente de cada linha para rodar): as tarefas que ainda aguardam a planilha. Esperado antes de ativar: nenhuma, ou só as que você conhece.
-- select t.id as tarefa, t.joiner_id, t.origem, (select array_agg(k order by k) from jsonb_object_keys(t.campos) k) as campos, t.planilha_status, t.planilha_tentativas, t.criado_em, t.lida_em is not null as lida
--   from public.cadastro_tarefas t
--  where t.planilha_status in ('pendente', 'atencao') and t.resolvida_em is null
--  order by t.criado_em;
