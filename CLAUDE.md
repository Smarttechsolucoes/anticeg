# Instruções do projeto Anti CEG

## Autonomia LIMITADA: fluxo de ativação e de atualização de @/e-mail (definida em 09/11/2026)
A dona do produto prefere que **ativação e mudanças de @/e-mail sejam resolvidas por verificações automáticas**, deixando a intervenção administrativa só para exceções reais, e **sem pedir uma aprovação nova a cada comando ou etapa já autorizada**.

**Vale somente para este fluxo** (pedido/entrega de código de ativação, vínculo da conta ao cadastro, regras de liberação, troca/reconhecimento de @ e e-mail, e o sync na parte que resolve dono por @/e-mail). Fora dele, continua valendo o combinado geral: uma aprovação delimitada para produção (SQL, deploy, merge, dados reais, Auth/permissões).

Dentro do escopo, ao receber uma autorização com etapas definidas: executar até concluir, com **backup, testes, verificação e publicação na ordem adequada**. Parar e explicar (sem contornar) apenas se houver: divergência material com o que foi aprovado, risco novo fora do escopo, ou negativa da ferramenta.

**O risco residual desse fluxo foi aceito** pela dona (por exemplo, um registro antigo preenchido sem comprovação de identidade). Isso **não** autoriza:
- que alguém tome um cadastro apenas sabendo o @; CPF, endereço, pedidos e pagamentos só chegam por vínculo de conta;
- registrar nada disso como "identidade confirmada por ela" (liberação por regra automática ≠ confirmação individual);
- perder ou mover itens, pagamentos, histórico ou meios de recuperação; em dúvida entre cadastros, **não mover nem criar outro**: registrar o conflito para análise.

**Fora desta autorização (precisa de pedido explícito):** unir ou escolher o cadastro de `@bad`; liberar em lote os cadastros sem evidência (os "51"); publicar J13 ou J14; disparar o sync manualmente (não acrescenta validação; o acionamento pelo cron é uma pendência separada); enviar código, senha ou e-mail em nome de alguém.

Ao final de cada entrega: o que entrou em produção, quantas pessoas foram efetivamente destravadas (diferenciar elegível, capaz de receber e-mail e ativou), e quais exceções continuam.
