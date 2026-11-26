-- E1 — PRIMEIRO TESTE DE ESCRITA CONTROLADO (EM PRODUÇÃO, UM ÚNICO CADASTRO). SÓ COM A SUA APROVAÇÃO (ponto F do roteiro). Antes de rodar, troque os marcadores:
--   <COG>         o cog (o @ sem o "@", em minúsculas) do cadastro que você escolheu. Recomendado: o seu próprio.
--   <NOME_ATUAL>  o nome cadastral dele HOJE, copiado EXATAMENTE do que o passo 1 mostrar (letras, acentos e espaços). A trava do passo 2 só age se for exatamente esse.
--   (o nome de teste é o atual + " (teste E1)": só uma marca visível na MASTERLIST; o passo 3 desfaz)
-- Rode UM passo por vez, no SQL Editor de PRODUÇÃO. Os passos 2 e 3 alteram UMA linha (a trava "and nome = ..." impede alterar outra coisa) e cada um cria UMA tarefa em Atualizações.
-- ANTES do passo 2: guarde o nome original (cole o resultado do passo 1 num bloco de notas) e anote a hora; na planilha, abra Arquivo › Histórico de versões para poder comparar depois.

-- 1) CONFERIR (somente leitura): o cadastro existe, é um só e o nome é o esperado.
select id, cog, nome from public.joiners where cog = '<COG>';
-- esperado: exatamente 1 linha, com o nome igual a <NOME_ATUAL>. Se vier 0 ou 2+ linhas, PARE.

-- 2) O TESTE: troca o nome (uma linha) e devolve o que mudou. A tarefa aparece em Admin › Atualizações como PENDENTE; em até ~2 min o acionador a leva para SINCRONIZADA.
update public.joiners set nome = '<NOME_ATUAL> (teste E1)' where cog = '<COG>' and nome = '<NOME_ATUAL>' returning id, cog, nome;
-- esperado: 1 linha devolvida. Se vier 0 linhas, nada foi alterado (o nome não era o esperado).

-- 3) RESTAURAR O SEU NOME NO BANCO (rode depois de ver Dados e MASTERLIST mudarem): volta ao nome original. Cria outra tarefa (versão maior) que leva a planilha de volta.
update public.joiners set nome = '<NOME_ATUAL>' where cog = '<COG>' and nome = '<NOME_ATUAL> (teste E1)' returning id, cog, nome;
-- esperado: 1 linha devolvida. Se vier 0 linhas, o nome do banco NÃO é mais "<NOME_ATUAL> (teste E1)" (alguém o mudou): use o plano B abaixo, que restaura pelo id.

-- 3-B) PLANO B (só se o passo 3 devolveu 0 linhas): restaura pelo id (o id vem do passo 1) e só se o nome ainda NÃO for o original. Remova os dois traços da frente da linha para rodar.
-- update public.joiners set nome = '<NOME_ATUAL>' where id = <ID_DO_PASSO_1> and cog = '<COG>' and nome is distinct from '<NOME_ATUAL>' returning id, cog, nome;

-- 4) CONFERIR QUE O BANCO VOLTOU (somente leitura). Rode depois do passo 3.
select j.id, j.cog, j.nome, (j.nome = '<NOME_ATUAL>') as nome_voltou from public.joiners j where j.cog = '<COG>';
-- esperado: nome_voltou = true.
select t.id as tarefa, t.planilha_status, t.planilha_tentativas, t.lida_em is not null as lida, t.campos -> 'nome' ->> 'de' as de, t.campos -> 'nome' ->> 'para' as para
  from public.cadastro_tarefas t join public.joiners j on j.id = t.joiner_id where j.cog = '<COG>' order by t.id desc limit 4;
-- esperado: as 2 tarefas mais novas (a de baixo é o teste, a de cima é o desfazer), as duas com planilha_status = sincronizada.
--   tarefa do teste:   de = "<NOME_ATUAL>"             para = "<NOME_ATUAL> (teste E1)"
--   tarefa do desfazer: de = "<NOME_ATUAL> (teste E1)"  para = "<NOME_ATUAL>"
-- Se alguma estiver "pendente", espere 2 min e repita. Se estiver "atencao", nada foi gravado na planilha por causa daquela tarefa: o motivo aparece em Admin › Atualizações; me mande.

-- ABORTAR (se algo parecer errado ANTES da planilha mudar): no Apps Script rode removerGatilhoFilaPerfil e, aqui, cancele o que estiver na fila. Remova os dois traços da frente para rodar.
-- update public.perfil_sync_pendente set status = 'cancelado' where status in ('pendente', 'falhou') and tipo = 'cadastro' returning id, joiner_id;
