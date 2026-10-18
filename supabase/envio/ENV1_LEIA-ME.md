# ENV1 — Envio Nacional com link pessoal (sem login/senha) — PREPARADO, NÃO PUBLICADO, NÃO APLICADO
Decisão, roteiro e reversão: ver `ENVIO_GO_NO-GO.md`. **JOINERS1** (`JOINERS1_aplicar.sql`, `JOINERS1_reverter.sql`, ensaios `JOINERS1_*_rollback.sql`): esconde CPF e endereço de `joiners` do visitante (36 verificações em rollback, 0 falhas; reversão idêntica); o front usa colunas explícitas (`src/joinersColunas.js`) e o Perfil grava/lê CPF e endereço só pelo link pessoal.

## O que muda (e só isto)
| Camada | Mudança |
|---|---|
| Banco (`ENV1_acesso_aplicar.sql`) | As 7 tabelas de envio (`envio_solicitacoes`, `grupos_envio`, `joiner_storage`, `envio_requests`, `envio_rounds`, `joiner_conferencias`, `rastreios`) deixam de ser abertas ao visitante: a joiner só vê/edita as próprias linhas **com o token do link pessoal**; a administração (conta admin) mantém acesso total; servidor e acesso direto seguem livres. Travas de campo (a joiner não muda status, cotação, CPF após criar, nem escolhe preço fora das opções cotadas). Funções `envio_solicitar_rodada`, `envio_grupo_por_codigo`, `envio_meu_acesso`, `envio_meus_dados`. Bucket privado novo `envio-comprovantes`. Bucket `storage-itens`: visitante não lista/apaga/envia. Nenhum dado é apagado ou migrado. |
| Front (`feat/envio-acesso-seguro`) | Aba Envio exige o link pessoal; senha fixa removida; consultas da joiner levam o token; painel admin e fotos do storage usam a conta admin; comprovantes vão ao bucket privado; endereço/CPF salvos vêm do servidor pelo token; `confirmarEnvio` não toca mais linhas erradas da MASTERLIST; rodada e busca de grupo pelo servidor; telas só confirmam o que o servidor aceitou. |
| Scripts | `envio-links.mjs` (gerar/revogar links), `envio-sondar-visitante.mjs` (sonda GO/NO-GO), `envio-migrar-comprovantes-antigos.mjs` (22 comprovantes antigos, em etapas). |

## Identidade
Link `…/envio?acesso=<token>` (192 bits) gerado pela equipe técnica e enviado por canal individual. O banco guarda só o **hash**, com validade (padrão 14 dias) e revogação. O token vai no cabeçalho `x-envio-token` (o gateway do Supabase aceita esse cabeçalho no CORS: verificado). Sem token válido: 0 linhas e nenhuma escrita. Saber o @ não basta.

## Testes
- **Banco, produção em rollback, papéis reais `anon`/`authenticated`** (`ENV1_ensaio_rollback.sql`): **64 verificações, 0 falhas.** Visitante, token errado/expirado/revogado: 0 linhas e sem escrita. Joiner A vê só o que é dela, não cria para outra, não muda status/cotação/CPF, não adultera preço, cancela só o que pode, retira só o próprio item de storage. Administradora lê, escreve, apaga e abre comprovantes. Conta logada: só as próprias. Bucket: caminho livre e solicitação inexistente recusados; `storage-itens` fechado para visitante.
- **Reversão** (`ENV1_reversao_ensaio_rollback.sql`): aplicar + reverter = policies, privilégios, RLS e policies do Storage idênticos ao original.
- **Navegador real, API simulada** (`tests/envio-acesso.e2e.mjs`, Playwright): **23 verificações, 0 falhas** (sem link, link válido, link de outra joiner, link vencido, banco ainda sem o pacote, CPF/endereço do servidor, pedido de envio, escolha de modalidade, escrita recusada sem sucesso falso, comprovante ao bucket privado com o token).
- **Front:** `tests/envio-acesso.test.mjs` (15) + suíte 77/77; navegador `tests/envio-acesso.e2e.mjs` com 30 verificações; lint no nível da `main` (93); build ok.
- **Não testado:** o fluxo de navegador contra um Supabase de ensaio real (não existe projeto de ensaio ativo) e o painel admin no navegador (coberto por testes de banco e por varredura do código).

## Limites honestos
1. Em `joiners`, **e-mail e WhatsApp continuam legíveis** pelo visitante (CPF e endereço, não): ver `ENVIO_GO_NO-GO.md`, seção 2.
2. Fotos do storage abrem por quem tem o endereço exato; os 22 comprovantes antigos seguem públicos até a migração.
3. A policy genérica de upload do Storage ("allow upload": qualquer bucket exceto os excluídos) continua; o ENV1 só exclui dela os buckets `envio-comprovantes` e `storage-itens`.
4. Validação de pagamento **por item** no pedido: os itens do storage são fotos sem código da MASTERLIST; a equipe confere na cotação. Para automatizar é preciso selecionar a partir da MASTERLIST (fase 2).
5. Só contas **admin** abrem o painel de envios (contas só de pagamentos não).
6. O link pode ser repassado por quem o recebe (como uma senha): validade curta e revogação mitigam. O modo "a joiner pede o link e recebe no e-mail cadastrado" fica para a fase 2.
