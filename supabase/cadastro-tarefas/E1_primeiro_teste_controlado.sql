-- E1 — PRIMEIRO TESTE DE ESCRITA CONTROLADO (EM PRODUÇÃO, UM ÚNICO CADASTRO). SÓ COM A SUA APROVAÇÃO (ponto F do roteiro). Antes de rodar, troque os 3 marcadores:
--   <COG>         o cog (o @ sem o "@", em minúsculas) do cadastro que você escolheu. Recomendado: o seu próprio.
--   <NOME_ATUAL>  o nome cadastral dele HOJE, igual ao que o passo 1 mostrar (a trava do passo 2 só age se for exatamente esse).
--   (o nome de teste é o atual + " (teste E1)": é só uma marca visível na MASTERLIST, e o passo 3 desfaz)
-- Rode UM passo por vez, no SQL Editor de PRODUÇÃO. Os passos 2 e 3 alteram UMA linha (a trava "and nome = ..." impede alterar outra coisa) e cada um cria UMA tarefa em Atualizações.

-- 1) CONFERIR (somente leitura): o cadastro existe, é um só e o nome é o esperado.
select id, cog, nome from public.joiners where cog = '<COG>';
-- esperado: exatamente 1 linha, com o nome igual a <NOME_ATUAL>. Se vier 0 ou 2+ linhas, PARE.

-- 2) O TESTE: troca o nome (uma linha) e devolve o que mudou. A tarefa aparece em Admin › Atualizações como PENDENTE; em até ~2 min o acionador a leva para SINCRONIZADA.
update public.joiners set nome = '<NOME_ATUAL> (teste E1)' where cog = '<COG>' and nome = '<NOME_ATUAL>' returning id, cog, nome;
-- esperado: 1 linha devolvida. Se vier 0 linhas, nada foi alterado (o nome não era o esperado).

-- 3) DESFAZER o teste (rode depois de ver Dados e MASTERLIST mudarem): volta ao nome original (outra tarefa, versão maior, que leva a planilha de volta).
update public.joiners set nome = '<NOME_ATUAL>' where cog = '<COG>' and nome = '<NOME_ATUAL> (teste E1)' returning id, cog, nome;
-- esperado: 1 linha devolvida. Aguarde essa 2ª tarefa ficar SINCRONIZADA e confira que Dados!B e a MASTERLIST voltaram ao nome original.

-- ABORTAR (se algo parecer errado ANTES da planilha mudar): no Apps Script rode removerGatilhoFilaPerfil e, aqui, cancele o que estiver na fila:
-- update public.perfil_sync_pendente set status = 'cancelado' where status in ('pendente', 'falhou') and tipo = 'cadastro' returning id, joiner_id;
