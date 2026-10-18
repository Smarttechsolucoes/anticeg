# ENV1 — Envio Nacional com link pessoal (sem login/senha) — PREPARADO, NÃO PUBLICADO, NÃO APLICADO

## O que muda (e só isto)
| Camada | Mudança |
|---|---|
| Banco (`ENV1_acesso_aplicar.sql`) | As 7 tabelas de envio (`envio_solicitacoes`, `grupos_envio`, `joiner_storage`, `envio_requests`, `envio_rounds`, `joiner_conferencias`, `rastreios`) deixam de ser abertas ao visitante. A joiner só enxerga/edita as próprias linhas **com o token do link pessoal**; a administração (conta admin) mantém acesso total; o servidor e o acesso direto continuam livres. Bucket privado novo `envio-comprovantes`. Nenhum dado é apagado ou migrado. |
| Front (`feat/envio-acesso-seguro`) | Aba Envio exige o link pessoal; senha fixa removida; consultas da joiner usam o token; painel admin usa a conta admin; comprovantes vão ao bucket privado; `confirmarEnvio` não toca mais linhas erradas da MASTERLIST; rodada e busca de grupo passam por funções do servidor. |
| Reversão | `ENV1_acesso_reverter.sql` devolve policies, privilégios e RLS originais (provado em rollback: idêntico). Front: reverter o merge. |

## Como a identidade funciona
Link `…/envio?acesso=<token>` (192 bits, aleatório) gerado pela equipe técnica e entregue por canal já usado com a joiner (WhatsApp/DM). O banco guarda só o **hash**, com validade (padrão 14 dias) e revogação. O token vai no cabeçalho `x-envio-token`; sem token válido o banco devolve 0 linhas. Saber o @ não basta. O mesmo link serve só para a joiner dona dele (o front compara com o @ do acesso e o banco isola por COG).

## Ordem de colocação no ar (hoje, se autorizado)
1. **Revisão sua** do diff do front e dos SQLs.
2. Publicar o **front** (funciona com ou sem o SQL: sem o SQL as tabelas ainda estão abertas, mas a aba já pede o link).
3. Aplicar `ENV1_acesso_aplicar.sql` (transação única, conferência no fim).
4. Gerar os links da turma-piloto (`emergencia.gerar_acesso_envio(cog, dias)` pelo acesso direto ao banco; CSV fora do repositório) e a equipe envia.
5. Sondar como visitante (`scripts/teste-anon-api.mjs`: deve dar 0 linhas nas 7 tabelas) e testar: painel admin (abrir envios, cotar, confirmar pagamento, rastreio), um link de teste (pedir envio, escolher modalidade, anexar comprovante).
6. Se algo falhar: `ENV1_acesso_reverter.sql` (2 min).

## Testes já feitos (produção, em rollback, papéis reais `anon`/`authenticated`)
`ENV1_ensaio_rollback.sql`: **56 verificações, 0 falhas**. Visitante sem token: 0 linhas em todas as tabelas, sem `rastreios`, sem apagar. Token errado/expirado/revogado: 0. Token da joiner A: vê só as dela (e nenhuma da B); não cria para outra; não muda status, cotação, CPF nem comprovante inválido; não adultera preço da modalidade (só uma das opções cotadas); cancela só o que pode; storage: só retira o próprio item; rodada e grupo pelo servidor. Administradora: lê, escreve, apaga e abre comprovantes. Conta logada: só as próprias. Bucket: caminho livre e solicitação inexistente recusados.
`ENV1_reversao_ensaio_rollback.sql`: aplicar + reverter = estado original idêntico (policies, privilégios, RLS, policy de upload).
Front: `tests/envio-acesso.test.mjs` (12) + suíte inteira 74/74; lint no mesmo nível da `main` (93); build ok.

## Limites e riscos que continuam (honestos)
1. **A tabela `joiners` continua legível por qualquer visitante (456 linhas com CPF, e-mail, WhatsApp, endereço).** O ENV1 protege os dados do ENVIO, não esse cadastro: fechar `joiners` quebra o login por @ do site inteiro (é o J4c-1, que depende do lançamento geral). Por isso o CPF/endereço continuam expostos por essa via até a fase 2.
2. Bucket público `storage-itens` (fotos do storage): continua listável/apagável pelo visitante (policies existentes). Fase 2.
3. Os 22 comprovantes antigos de envio estão no bucket público `comprovantes`; ficam como estão (não migrados). Fase 2 (J5).
4. A policy genérica de upload do Storage ("allow upload": qualquer bucket exceto anti-store/avatars) continua; o ENV1 só exclui o bucket novo dela.
5. Validação de pagamento **por item** no pedido: os itens do storage são fotos (descrição = nome de arquivo, sem código da MASTERLIST), então hoje essa checagem não é automática; a equipe segue conferindo na cotação. Para validar por item é preciso a seleção a partir da MASTERLIST (fase 2).
6. A administradora precisa estar com conta **admin** (`admin_roles.papel = 'admin'`): contas só de pagamentos (staff_pagamentos) não abrem o painel de envios.
7. Link pessoal pode ser repassado por quem o recebe (como uma senha). Mitigação: validade curta, revogação e envio por canal individual.
8. Modo automático por e-mail (a joiner pede o link e recebe no e-mail cadastrado) fica para a fase 2: depende do SMTP do Auth e de uma Edge Function.
