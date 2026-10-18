# Envio Nacional — decisão de publicação (GO / NO-GO), roteiro e reversão

Estado: **preparado e testado; NADA publicado, NADA aplicado em produção.** Autorizações pendentes: (1) mesclar/publicar o front, (2) aplicar o SQL ENV1, (3) migrar os 22 comprovantes antigos.

## 1. Os três riscos que você pediu para resolver ou isolar
| Risco | Situação no pacote | Risco que permanece |
|---|---|---|
| Tabela `joiners` expõe CPF/endereço/e-mail/WhatsApp (456 joiners) | **Isolado, não fechado.** O Envio não depende mais dela: CPF e endereço de entrega vêm do servidor pelo link pessoal (`envio_meus_dados`); a cópia do CPF/endereço nas solicitações fica protegida. | **Continua legível por qualquer visitante.** Provado em rollback: ocultar as colunas sensíveis faz `select *` falhar para o visitante, e há 10 `select("*")` de login, mais perfil e painel, que dependem dessa leitura. Fechar hoje derrubaria o login e o perfil do site inteiro. Plano da fase 2 abaixo. |
| Bucket `storage-itens` listável/apagável por visitante | **Fechado** no ENV1: visitante não lista, não apaga e não envia; só a administração (conta admin). As fotos continuam abrindo pelos links já gravados. A administração passou a usar a conta admin nas 8 chamadas de storage; a joiner não apaga mais arquivo do bucket. | Foto aberta por quem tem o endereço exato (`<cog>/<hora>.jpg`); sem listagem. |
| 22 comprovantes antigos públicos | **Migração pronta** (`scripts/envio-migrar-comprovantes-antigos.mjs`): copia para o bucket privado, grava backup local, atualiza o banco numa transação e só então apaga os originais, em etapas separadas e conferidas. Não executada (depende do ENV1). | Até a migração rodar, os 22 links seguem abertos para quem tem o endereço. |

## 2. Checklist GO / NO-GO (todos precisam ser SIM)
1. ☐ Você revisou e aprovou o PR do envio (diff do front + SQL) e os limites acima, em especial o risco que permanece em `joiners`.
2. ☐ Toda staff que opera envios tem conta **admin** e consegue abrir o painel (o painel de envios passa a exigir a conta admin).
3. ☐ Sem sync em andamento no momento de aplicar (`gh run list`: nada `in_progress`).
4. ☐ Fila do piloto definida: **5 a 10 joiners** (lista de @). Links com validade de 14 dias.
5. ☐ Reversão entendida e à mão: `ENV1_acesso_reverter.sql` (2 min) e reverter o merge do front.
6. ☐ Pós-aplicação: `node scripts/envio-sondar-visitante.mjs` dá **0 FALHAS** (hoje dá 7 FALHAS, como esperado antes do ENV1).
7. ☐ Pós-aplicação: a administradora abre o painel de envios, uma solicitação, a cotação e o rastreio; e um link de teste pede envio, escolhe a modalidade e anexa comprovante.
8. ☐ Se qualquer item 6 ou 7 falhar: **NO-GO imediato → reversão**.

## 3. Roteiro de implantação (hoje, ~40 min depois das autorizações)
| # | Passo | Quem | Verificação |
|---|---|---|---|
| 1 | Mesclar o PR do front (deploy da Vercel) | você autoriza, eu faço | site abre; `/envio` sem link mostra "use o link pessoal"; resto do site igual |
| 2 | Aplicar `ENV1_acesso_aplicar.sql` (transação única, conferência no fim) | você autoriza, eu faço | termina sem erro; contagens e conteúdo das 7 tabelas idênticos ao de antes |
| 3 | `node scripts/envio-sondar-visitante.mjs` | eu | 0 FALHAS |
| 4 | Teste do painel (admin) e de um link de teste | eu + você | itens do item 7 do checklist |
| 5 | Gerar os links do piloto: `node scripts/envio-links.mjs --gerar --cogs … --saida <fora do repositório>` | eu | CSV fora do repo; cada link só para a dona |
| 6 | Equipe envia os links (WhatsApp/DM) e acompanha o piloto | equipe | solicitações aparecem no painel |
| 7 | Migrar os 22 comprovantes antigos (`--copiar`, conferir, `--atualizar`, abrir um pelo painel, `--apagar-originais --confirmo`) | eu, com sua autorização | painel abre os comprovantes antigos pelo link assinado |
| 8 | Piloto 24-48 h; se estável, gerar links da comunidade em levas | você decide | sonda continua em 0 FALHAS |

**Se o front for publicado antes do SQL**, nada quebra: a aba já pede o link, e quem tem link entra (o aviso de "função não encontrada" é tratado). **Se o SQL for aplicado antes do front, o site antigo para de ler/escrever envio**: por isso a ordem acima.

## 4. Reversão
- **Banco:** `ENV1_acesso_reverter.sql` devolve policies, privilégios, RLS e as policies do Storage originais (provado em rollback: estado idêntico). Os dados não são tocados. A reversão reabre o acesso ao visitante: usar só em emergência.
- **Front:** reverter o commit do merge (voltam a senha fixa e as consultas abertas; só faça junto com a reversão do banco).
- **Links:** `node scripts/envio-links.mjs --revogar --cogs …` revoga links individuais a qualquer momento.
- **Comprovantes antigos:** os originais só são apagados no último passo, depois de a cópia privada e o backup local estarem conferidos.

## 5. Fase 2 (não faz parte de hoje): fechar `joiners`
Depende de: trocar os 10 `select("*")` de login por colunas explícitas sem CPF/endereço; levar perfil/endereço para funções que exigem a identidade (o mesmo link pessoal serve); mover as listas do painel admin para a conta admin; só então revogar as colunas sensíveis do visitante. É a mesma peça do J4c-1 do lançamento geral, reaproveitando o link pessoal no lugar do login.
