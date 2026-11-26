# Roteiro de publicação da etapa 1 do cadastro (PR #276)

**Estado hoje:** nada disto foi feito. Produção, planilha real, Vercel e Supabase estão como antes. O PR #276 está em **rascunho**.
**Já provado:** preflight em produção (26/11), `perfil-sync` implantada = base do PR, teste real na planilha de teste e ensaio do acionador por horário (pendente → sincronizada, MASTERLIST refletida, texto fixo intacto).
**Ainda não provado (só em produção):** o primeiro disparo real da função implantada com a autenticação configurada. O roteiro abaixo o valida **antes** de ligar o acionador (etapa E).

## Regras da janela (valem do início ao fim)
☆ Escolha um horário calmo, com cerca de 1 hora livre. Nenhuma outra pessoa mexendo em cadastros.
☆ **Não** edite `nome` nem `email` de cadastros por SQL ou pelo painel, e **não** clique em "reprocessar", entre as etapas A e E (sem o acionador, essas alterações entrariam na fila e ficariam esperando).
☆ **Não** mude `SYNC_JOINERS` do sync da planilha para `todos` enquanto o E1 estiver no ar. Hoje ele está `somente-novos` (conferido em `.github/workflows/sync-masterlist.yml`): o sync só cria cadastros novos e nunca altera um existente, então não gera tarefas. Em `todos` ele atualizaria nome e e-mail de todo mundo, e cada mudança viraria uma tarefa e uma escrita na planilha.
☆ A ordem importa. Cada etapa só começa depois da checagem da anterior. Em caso de dúvida, pare e me mande a saída.

## Execução em DOIS BLOCOS (uma aprovação por bloco)
Decisão da dona (26/11): em vez de sete avais, **dois**. Dentro de cada bloco as etapas seguem na ordem abaixo, com a checagem de cada uma; **só pára e chama** se houver divergência, falha ou uma ação que exija o login dela. Os pontos A a G deixam de ser avais separados e viram etapas internas dos blocos.

| Bloco | Etapas | Quem executa | Onde a dona é chamada |
|---|---|---|---|
| **Etapa 0** (já feita, exceto 3 itens dela) | conferências e backups | Claude (CLI, leituras e `--read-only`) | itens listados na seção "Etapa 0 — o que falta" |
| **Bloco 1 — publicação com o recurso desligado** | A (SQL) → B (segredo + função) → **C (Apps Script real)** → D (merge + deploy) | Claude executa A, B e D; **a dona executa C** (Google) | **só em C**: colar o código, nova versão, colunas D/E/F, 3 propriedades (≈10 min, guiado). O segredo já estará na área de transferência. |
| **Bloco 2 — teste e liberação** | E (fila + autenticação + acionador) → F (teste no cadastro da dona + restauração) → G (interruptor) | Claude executa a fila, o SQL do teste, as conferências no banco e o interruptor; **a dona executa as funções no Apps Script e olha a planilha** | executar `rodarFilaPerfil_` uma vez e `instalarGatilhoFilaPerfil` (Google); olhar Dados/MASTERLIST antes/depois (Google); me dizer o que viu |

**Paradas obrigatórias (o bloco não segue sozinho):**
☆ Bloco 1: preflight diferente do esperado antes de A; o SQL recusar; a checagem 403 da função diferente de 403; o `diff` do Apps Script com remoções; qualquer erro no deploy do site.
☆ Bloco 2: **qualquer item na fila** antes de ligar o acionador ou 1 minuto depois; autenticação diferente de HTTP 200 com `lidos 0`; tarefa do teste em "precisa de atenção" ou que não sincroniza em ~5 minutos; o nome não voltar ao original no banco; a planilha não voltar ao original. Nesses casos **não** se liga o interruptor (G) e eu reverto o que for preciso.
☆ Como não há como eu ler a planilha real (as ações de teste não existem em produção), a prova da volta na planilha é: tarefas `sincronizada` no banco (o Apps Script só responde ok depois de gravar) **mais** a conferência visual da dona (Dados e MASTERLIST) e o Histórico de versões.

## Pontos de aval (preciso do seu "aprovo" em cada um, separadamente)
| Ponto | O que muda em produção | Depois dele |
|---|---|---|
| **A** | SQL do E1 no banco | tabela, funções e gatilhos novos; nada de dados existentes muda |
| **B** | segredo `PERFIL_SYNC_SEGREDO` + publicar `perfil-sync` | função nova no ar (ninguém a chama ainda) |
| **C** | Apps Script real: código novo, colunas D/E/F em Dados, propriedades | planilha pronta para receber; acionador NÃO instalado |
| **D** | merge do PR na `main` (deploy do site na Vercel, interruptor desligado) | site novo no ar, igual ao de hoje para as joiners |
| **E** | instalar o acionador de 1 min | fila passa a ser processada sozinha |
| **F** | SQL pontual de teste em UM cadastro | primeira escrita real, acompanhada |
| **G** | ligar `VITE_CADASTRO_ETAPA1` na Vercel | joiners passam a editar o nome cadastral |

Frase de aval: "Aprovo o ponto X" (ou "Aprovo A e B"). Sem a frase, eu não executo nada daquela etapa.

---

## Etapa 0 — Preparação (somente leitura e cópias; sem mudança em produção)
**Fazer, no dia:**
1. **Preflight de novo** (`E1_preflight_somente_leitura.sql`, SQL Editor de produção). Esperado: igual a 26/11 (itens do E1 `false`, J1d/J4c1/J6 `true`). Se algo diferir, pare e me mande.
2. **Fila vazia**: rode as partes A e B de `E1_fila_antes_de_ativar_somente_leitura.sql`. Esperado: nenhuma linha.
3. **Vercel › projeto › Settings › Environment Variables, escopo Production:** `VITE_CADASTRO_ETAPA1` **não pode existir** (ou ser `0`); `VITE_JOINERS_AUTH` deve ser `true`. Anote o que viu.
4. **Backups:**
   ☆ **Banco:** o SQL do E1 guarda o texto das 3 funções que ele troca em `emergencia.c0b_estado_anterior` e **não altera nenhuma linha de dados existente** (conferido). Se o seu plano do Supabase tem backups, anote o horário do último em Database › Backups.
   ☆ **Função:** a cópia da `perfil-sync` implantada hoje já está em `C:\Users\Nanda\perfil-sync-implantada` (não apague). É a fonte da reversão da etapa B.
   ☆ **Apps Script real:** abra o projeto da planilha real, selecione **todo** o `Código.gs`, copie e salve como `C:\Users\Nanda\anticeg-privado\producao-e1\Codigo-ATUAL-antes-do-E1.gs`. Em Implantar › Gerenciar implantações, anote a **versão** atual e a URL `/exec`.
   ☆ **Planilha real:** Arquivo › **Fazer uma cópia** (nome `BACKUP antes do E1 - AAAA-MM-DD`; mantenha privada) ou, no mínimo, clique com o botão direito na aba **Dados** › Duplicar.
5. **Pasta de publicação da função** (uma vez): 
```
mkdir C:\Users\Nanda\perfil-sync-publicar
cd C:\Users\Nanda\perfil-sync-publicar
npx supabase init
Copy-Item -Recurse C:\Users\Nanda\anticeg-cadastro-main\supabase\functions\perfil-sync supabase\functions\
Copy-Item -Recurse C:\Users\Nanda\anticeg-cadastro-main\supabase\functions\_shared supabase\functions\
```
(a pasta do repositório precisa estar na branch `feat/cadastro-etapa1`, igual ao PR).

### Resultado da etapa 0 (26/11, feita pelo Claude por CLI, somente leitura)
☆ **Preflight em produção (transação `--read-only`):** 26 de 26 linhas como o esperado (J1d/J4c1/J6 presentes; nada do E1; restrições de tipo as esperadas; `pg_cron`/`pg_net` ausentes).
☆ **Fila:** a tabela `perfil_sync_pendente` tem **0 linhas** (nenhum item, nenhuma tarefa).
☆ **Função implantada** idêntica à de 26/11 (backup datado em `producao-e1ackup-funcao-2026-11-26-etapa0`); segredos `PLANILHA_URL` e `PLANILHA_TOKEN` existem; `PERFIL_SYNC_SEGREDO` ainda não.
☆ **PR sobre a `main` atual** (`9ce5dfb`, também o último deploy de Production): sem conflito esperado. Sync diário em `somente-novos`.
### Etapa 0 — o que falta (depende do acesso da dona)
1. **Google:** anotar a versão publicada do Apps Script (Implantar › Gerenciar implantações) e salvar o código atual em `producao-e1\Codigo-ATUAL-antes-do-E1.gs`.
2. **Google:** backup da planilha real (Arquivo › Fazer uma cópia) e conferir que as colunas D, E e F de **Dados** estão vazias.
3. **Vercel:** rodar `vercel login` e autorizar (uma vez); com isso o Claude lê as variáveis de Production (só os nomes) e confere o deploy atual.
4. **Informar** o @ do cadastro que será usado no teste do Bloco 2 (recomendado: o da própria dona).

---

## Etapa A — SQL do E1 (ponto A)
**Antes:** etapa 0 concluída.
**Fazer:** SQL Editor de **produção** (confira o nome do projeto no topo). Cole **inteiro** `E1_cadastro_tarefas_aplicar.sql` › Run. É uma transação; se algo estiver diferente, ele para com "Nada foi alterado.".
**Checar:** rode de novo o preflight. Agora devem ser `true`: `tabela cadastro_tarefas`, `perfil_sync_estado`, `salvar_meu_cadastro`, `solicitar_alteracao_sem_login`, gatilho `joiners_tarefa_cadastro`, "trava já tem a exceção do E1". A restrição de tipo em `perfil_sync_pendente` deve citar `email` **e** `cadastro`. Os itens J1d/J4c1/J6 seguem `true`. Me mande a saída.
**Reverter:** `E1_cadastro_tarefas_reverter.sql` (arquiva tarefas e itens da fila em `emergencia.*` antes de apagar e restaura as 3 funções). Só depois de remover o acionador e desligar o interruptor, se já tiverem sido ligados.
**Efeito enquanto só isto estiver feito:** nenhum para as joiners (o site ainda não usa). Alterações de nome/e-mail por SQL passariam a gerar tarefa e item na fila, por isso as regras da janela.

## Etapa B — Segredo e `perfil-sync` (ponto B)
**Antes:** etapa A checada.
**Fazer:**
```
cd C:\Users\Nanda\perfil-sync-publicar
npx supabase login                                  # se a sessão tiver expirado
$seg = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
Set-Clipboard $seg                                  # guarda o segredo na área de transferência (não aparece na tela); será colado no Apps Script na etapa C
npx supabase secrets set "PERFIL_SYNC_SEGREDO=$seg" --project-ref ghjfsmwwcfpfvrouyrka
npx supabase secrets list --project-ref ghjfsmwwcfpfvrouyrka
npx supabase functions deploy perfil-sync --project-ref ghjfsmwwcfpfvrouyrka --use-api
```
**Checar:**
1. `secrets list` deve mostrar `PLANILHA_URL`, `PLANILHA_TOKEN` e `PERFIL_SYNC_SEGREDO` (só nomes). Se faltar `PLANILHA_URL` ou `PLANILHA_TOKEN`, pare: são os mesmos do proxy `planilha-acao`.
2. **Autenticação sem processar nada** (chamadas que a função recusa, então nada é lido nem gravado). Eu espero **403** nas duas:
```
$u = "https://ghjfsmwwcfpfvrouyrka.supabase.co/functions/v1/perfil-sync"
$anon = [regex]::Match((Get-Content C:\Users\Nanda\anticeg-cadastro-main\src\supabase.js -Raw), 'CHAVE_PRODUCAO = "([^"]+)"').Groups[1].Value
curl.exe -s -w "`nHTTP %{http_code}`n" -X POST $u -H "Authorization: Bearer $anon" -H "apikey: $anon" -H "Content-Type: application/json" -d "{}"
curl.exe -s -w "`nHTTP %{http_code}`n" -X POST $u -H "Authorization: Bearer $anon" -H "apikey: $anon" -H "x-cron-secret: segredo-errado-0123456789abcdefghij" -H "Content-Type: application/json" -d "{}"
```
Esperado: `{"error":"somente a administração"}` e `HTTP 403`. Um `401 Invalid JWT` significaria que a chave não passa no porteiro do Supabase (me mande).
3. **Versão implantada = a do PR:** baixe de novo (`npx supabase functions download perfil-sync --project-ref ghjfsmwwcfpfvrouyrka --use-api` numa pasta nova) e rode `comparar.mjs`: `perfil-sync/index.ts` e `_shared/perfilsync.ts` devem dar "IGUAL à versão nova do PR".
**Reverter:** `cd C:\Users\Nanda\perfil-sync-implantada` e `npx supabase functions deploy perfil-sync --project-ref ghjfsmwwcfpfvrouyrka --use-api` (volta à versão de hoje). Depois `npx supabase secrets unset PERFIL_SYNC_SEGREDO --project-ref ghjfsmwwcfpfvrouyrka`.
**Efeito:** nenhum enquanto o acionador não existir (a função só roda por botão do admin ou pelo acionador).

## Etapa C — Apps Script real (ponto C)
**Antes:** etapa B checada.
**Fazer:**
1. **Gerar o código a partir do SEU código atual** (o que você salvou na etapa 0):
```
cd C:\Users\Nanda\anticeg-cadastro-main
node scripts/e1-montar-codigo-teste.mjs --producao C:\Users\Nanda\anticeg-privado\producao-e1\Codigo-ATUAL-antes-do-E1.gs C:\Users\Nanda\anticeg-privado\producao-e1\Codigo-NOVO-producao.gs
git diff --no-index C:\Users\Nanda\anticeg-privado\producao-e1\Codigo-ATUAL-antes-do-E1.gs C:\Users\Nanda\anticeg-privado\producao-e1\Codigo-NOVO-producao.gs
```
O `diff` deve mostrar **só linhas acrescentadas**: 1 linha na lista de ações (`"atualizar_cadastro",`), 3 linhas do ramo `if (payload.acao === "atualizar_cadastro")` e o bloco final (`atualizarCadastro_` + as 3 funções do acionador). Se o montador recusar ("não tem os pontos esperados") ou o diff mostrar remoções, **pare**: o código publicado difere do de 07/11.
2. **Dados real:** as colunas D, E e F devem estar **vazias em todas as linhas** (não só no trecho visível): no backup, digite `=COUNTA(D:F)` numa célula livre de OUTRA aba e confira que dá `0` (ou selecione as colunas D:F e leia a Contagem na barra inferior). Crie os cabeçalhos **na mesma linha dos outros cabeçalhos da aba** (hoje a linha 5: `D5 = ID_SITE`, `E5 = PAPEL`, `F5 = VERSAO`). O código **não lê** a linha do cabeçalho nem depende da posição dela: lê da **linha 2 até a última** e acha a pessoa pelo número (D) ou pelo @ (A), então cadastros acima ou abaixo do cabeçalho são achados (testado em `tests/e1-dados-cabecalho-linha5.test.mjs`). **A linha 1 nunca é lida**: um cadastro que esteja na linha 1 não seria achado (a tarefa viria como "precisa de atenção: linha_nao_encontrada", sem gravar nada).
3. **Onde colar (lição de 26/11):** o projeto real tem VÁRIOS arquivos (`GeradorDeIDs`, `PAGAMENTO-AUTOMATICO`, `SYNC-TRIGGER`, `STATUS-SYNC`, `P001_CONFERENCIA`, `P001_VERIFICAR_TOKEN`) e **não** tem `Código.gs`. O `doPost` está em **`PAGAMENTO-AUTOMATICO.gs`**: cole **por cima do conteúdo desse arquivo**, nunca em um arquivo novo (um arquivo novo duplica `AVISO_SYNC_` e o web app inteiro responde `SyntaxError`). Confira que a lista continua com 6 arquivos.
3b. **Qual implantação é a de produção:** a que o site usa é a que tem o **hash** igual ao do segredo `PLANILHA_URL` (hoje: **`v2: token antes da trava, dois tokens`**, ID `AKfycbyqio…`). Eu confirmo pelo hash; **não adivinhe pelo nome**. Não crie "Nova implantação" e não toque nas outras.
3c. **Ensaiar antes de promover (para nunca repetir o erro em produção):** primeiro faça **Nova versão numa implantação que o site NÃO usa** (uma implantação de apoio), eu sondo a URL dela (esperado `{"erro":"Token inválido"}` e a checagem sem efeito abaixo) e só então, na implantação de produção, escolha **a mesma versão numerada** já ensaiada no menu "Versão" (não "Nova versão") e clique em Implantar.
4. **Propriedades do script** (sem instalar o acionador ainda): `PERFIL_SYNC_URL` = `https://ghjfsmwwcfpfvrouyrka.supabase.co/functions/v1/perfil-sync`; `SUPABASE_ANON_KEY` = a chave **anon** (a mesma do site); `PERFIL_SYNC_SEGREDO` = **Ctrl+V** (se perdeu, rode `Set-Clipboard $seg` na mesma janela do PowerShell da etapa B; se a janela fechou, gere outro segredo e refaça só o `secrets set` da etapa B).
**Checar (sem efeito na planilha):** a ação nova responde e recusa um pedido que não casa com ninguém:
```
$env:URLP = Read-Host "URL /exec da planilha REAL"
$s = Read-Host "Token da planilha REAL (ANTICEG_TOKEN_NOVO, se existir; senão ANTICEG_TOKEN)" -AsSecureString
$tok = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
$corpo = '{"acao":"atualizar_cadastro","token":"' + $tok + '","id_site":"999999999","versao":1,"campos":["nome"],"nome":"Checagem sem efeito"}'
$corpo | curl.exe -s -L -H "Content-Type: text/plain" --data-binary "@-" $env:URLP   # o corpo vai por stdin (o PowerShell 5.1 REMOVE as aspas de argumentos para o curl.exe e o JSON chegaria quebrado: "Requisição inválida"); e SEM -X POST (com ele o Google responde 411 no redirecionamento)
Remove-Item Env:URLP; $tok = $null
```
Esperado: `{"erro":"Sem ID_SITE na planilha e sem @ para localizar a linha","definitivo":true,"motivo":"linha_nao_encontrada"}`. Nenhuma célula muda. Confirme também que as ações de sempre continuam normais (abra o site, o fluxo de pedido/confirmação não deve ter mudado: o código antigo ficou intacto, só houve acréscimos).
**Reverter:** Implantar › Gerenciar implantações › lápis › escolha a **versão anterior** (anotada na etapa 0) › Implantar; cole de volta `Codigo-ATUAL-antes-do-E1.gs` se quiser o editor igual; apague as 3 propriedades `PERFIL_SYNC_*`; as colunas D/E/F podem ficar (vazias, inofensivas).

## Etapa D — Merge e deploy do site (ponto D)
**Antes:** A, B e C checadas; Vercel Production sem `VITE_CADASTRO_ETAPA1` (etapa 0).
**Fazer:** marque o PR como **Ready for review** e faça **Squash and merge**. A Vercel publica a `main` em produção sozinha (alguns minutos). O site sai com o interruptor **desligado**: para as joiners nada muda.
**Checar:**
1. Vercel › Deployments: o deploy de Production do commit do merge está **Ready**.
2. Site: página inicial, `/cegs`, entrar na conta, Meu Perfil (igual ao de hoje: nome do site, e-mail e @ como antes).
3. Admin › Atualizações: aparece o painel das tarefas de cadastro, **vazio** (e sem erro vermelho).
**Reverter:** Vercel › Deployments › o deploy de Production anterior ao merge › **Instant Rollback** (segundos). Se precisar tirar do histórico: `git revert` do commit de merge e novo PR.
**Atenção:** o merge entrega só o código do site e os arquivos de apoio. Ele **não** aplica SQL, não publica a função e não toca no Apps Script (por isso as etapas A a C vieram antes).

## Etapa E — Conferir a fila, validar a autenticação e instalar o acionador (ponto E)
**Antes:** A a D checadas.
**Conferir a fila (somente leitura) e me mostrar:**
1. `E1_fila_antes_de_ativar_somente_leitura.sql`, partes **A e B** (e **C**, que agora existe). Esperado: sem linhas.
2. **Repita A, B e C duas vezes mais:** (a) **logo antes** de instalar o acionador e (b) **cerca de 1 minuto depois** dele instalado. A fila pode ter recebido alterações enquanto a publicação avançava (qualquer pessoa ou rotina que altere `nome`/`email`). Em (b), se aparecer item, o acionador já o terá processado: a tarefa correspondente em Atualizações mostra o resultado.
3. **Se houver itens em qualquer uma das conferências:** **não ative**. Me mande as tabelas A, B e C: eu mostro item por item o que seria enviado (tipo, tarefa, campos, tentativas), e você decide entre (a) deixar processar, (b) cancelar o item (o SQL de cancelamento está no arquivo do primeiro teste, em comentário) ou (c) corrigir antes. Nenhum item é processado sem você ver.
**Validar a autenticação com a configuração real (só se A e B estavam vazias):** no Apps Script real, escolha a função **`rodarFilaPerfil_`** e clique em **Executar** uma única vez. Ela faz exatamente a chamada que o acionador fará, com `x-cron-secret`. Em **Execuções**, o registro deve dizer `rodarFilaPerfil_: HTTP 200 {"lidos":0,"enviados":0,"falharam":0,"parou":false}`. Isso prova: URL certa, chave aceita pelo porteiro, segredo igual nos dois lados, função implantada. Se vier `HTTP 403`, o segredo do Apps Script não é o do Supabase; se `HTTP 401`, a chave/JWT; me mande a linha (ela não traz o segredo).
**Instalar:** só depois do 200 acima, execute **`instalarGatilhoFilaPerfil`** (autorize se pedir). **Checar:** Acionadores mostra 1 linha de `rodarFilaPerfil_` (a cada minuto); em Execuções, 3 execuções seguidas com `HTTP 200 lidos 0`.
**Desligar a qualquer momento:** execute `removerGatilhoFilaPerfil` (e confira que Acionadores ficou vazio); para travar de vez, apague a propriedade `PERFIL_SYNC_SEGREDO` do Apps Script ou rode `supabase secrets unset PERFIL_SYNC_SEGREDO`. Com a fila vazia, ligar o acionador não altera nada na planilha.

## Etapa F — Primeiro teste de escrita controlado (ponto F)
**Cadastro:** recomendo o **seu próprio** (o da administradora). A planilha real recebe a alteração, então vale ser um cadastro seu: você reconhece a linha e desfaz sem ônus.
**Antes (você olha, sem mudar nada):**
☆ Copie o resultado do passo 1 do SQL (o nome **exatamente** como está) para um bloco de notas: é o valor a restaurar.
☆ Anote a hora e, na planilha real, abra **Arquivo › Histórico de versões** para saber de qual versão comparar depois.
☆ Dados: **uma única** linha com o seu @; as células B (nome) e C (e-mail) **sem fórmula**.
☆ MASTERLIST: quantas linhas suas têm o NOME por fórmula (vão mudar) e quantas têm texto fixo (**não** devem mudar). Anote os números de linha.
☆ Admin › Atualizações: sem pendências.
**Fazer** (`E1_primeiro_teste_controlado.sql`, SQL Editor de produção; troque `<COG>` e `<NOME_ATUAL>` e rode **um passo por vez**): passo 1 (conferir, 1 linha) › passo 2 (o teste: nome + " (teste E1)").
**Acompanhar** (Atualizações → Dados → MASTERLIST):
1. **Atualizações:** a tarefa aparece **PENDENTE**, com selo e contagem. Em até ~2 min fica **SINCRONIZADA**. O acionador faz isso sozinho (você não clica em nada).
2. **Dados:** na sua linha, B = nome com " (teste E1)"; D = seu número (ID do site); E = `principal`; F = versão (número da tarefa). Nas outras linhas, nada muda.
3. **MASTERLIST:** as suas linhas **com fórmula** mostram o nome novo; as de **texto fixo continuam iguais**; nenhuma outra célula muda.
**Restaurar o seu nome e provar que tudo voltou (passos 3 e 4 do arquivo):**
1. **Banco:** rode o passo 3 (volta ao nome original, 1 linha). Se devolver 0 linhas, alguém mudou o nome no meio do teste: use o **plano B** do arquivo (restaura pelo id, só se o nome ainda não for o original). Depois rode o passo 4: `nome_voltou` deve ser `true`.
2. **Tarefas:** o segundo `select` do passo 4 deve listar as duas tarefas mais novas, **as duas sincronizadas**: a do teste (`de` = original, `para` = original + " (teste E1)") e a do desfazer (o contrário). Se alguma estiver `pendente`, espere 2 minutos; se estiver `atencao`, o motivo aparece em Atualizações e eu preciso ver.
3. **Fila:** rode de novo as partes A e B do SQL da fila: sem linhas.
4. **Planilha (Dados):** na sua linha, **B** voltou ao nome original; **A** (@) e **C** (e-mail) não mudaram em nenhum momento.
5. **Planilha (MASTERLIST):** as linhas suas com fórmula mostram o nome original; as de texto fixo nunca mudaram.
6. **Prova pelo histórico:** Arquivo › Histórico de versões › abra a versão **de antes do teste** e use "Mostrar alterações": as únicas células que diferem são as da sua linha em Dados (D, E, F, descritas abaixo) e nada mais. Se algo diferir fora disso, me mande o print.

**O que fazer com D, E e F (preenchidas pelo teste):** o teste preenche, **uma vez**, na sua linha de Dados: **D** = o número do seu cadastro no site (ID_SITE), **E** = `principal`, **F** = o número da última tarefa aplicada (a versão). Elas **não** voltam sozinhas ao vazio quando o nome é restaurado, e isso é o esperado: D/E ligam a linha ao cadastro pelo número (assim uma troca futura de @ não perde a linha) e F impede que uma alteração antiga sobrescreva uma nova.
☆ **Recomendado: manter** D, E e F. São a ligação definitiva da sua linha e o primeiro envio real de qualquer cadastro as preencheria de qualquer jeito.
☆ **Se preferir desfazer por completo:** só **depois** de a tarefa do desfazer estar sincronizada e de a fila estar vazia, selecione **apenas as três células D, E e F da sua linha** e aperte Delete (elas não têm fórmula). Confira que A, B e C da linha não mudaram. Consequência: a próxima alteração desse cadastro volta a achar a linha pelo @ e a preencher D, E e F de novo. Não apague a coluna inteira nem a linha de cabeçalho.
☆ **Não** mexa em D, E ou F de outras pessoas: elas só são preenchidas quando a própria pessoa tiver uma alteração enviada.

**Abortar** antes da planilha mudar: `removerGatilhoFilaPerfil` e o SQL de cancelamento (em comentário no arquivo). Se a tarefa ficar **PRECISA DE ATENÇÃO** (por exemplo `linha_nao_encontrada`, `linha_ambigua`, `celula_com_formula`), **nada foi gravado** na planilha; o motivo aparece na tarefa e me mande para decidirmos.
**Me mande:** um print de Atualizações (pendente e depois sincronizada), o que viu em Dados e na MASTERLIST, e a linha do Registro de execução do acionador.

## Etapa G — Interruptor do site (ponto G)
**Antes:** F concluída e desfeita sem pendências.
**Fazer:** Vercel › Settings › Environment Variables › Production: criar `VITE_CADASTRO_ETAPA1` = `1` (e confirmar `VITE_JOINERS_AUTH` = `true`); **Deployments › Redeploy** do último deploy de Production (sem usar o cache de build). O interruptor é de **build**: só vale depois do redeploy.
**Checar (com a sua conta):** Meu Perfil: o **nome cadastral** fica editável e, ao salvar, diz "Salvo no site ✓" só depois da confirmação do banco; **e-mail e @ viram somente leitura**, com o caminho de "pedir alteração"; o login antigo mostra "Alteração solicitada" ao pedir troca. Troque o seu nome cadastral por um valor de teste e volte: a tarefa nasce em Atualizações e sincroniza como na etapa F.
**Reverter:** apague `VITE_CADASTRO_ETAPA1` (ou ponha `0`) e **Redeploy**; ou **Instant Rollback** para o deploy anterior (o da etapa D, com o interruptor desligado). Tarefas já criadas ficam registradas e seguem sendo processadas.

---

## Depois de publicado (primeiras 24 horas)
☆ Admin › Atualizações: pendências e tarefas "precisa de atenção". Uma tarefa em atenção não grava nada na planilha; leia o motivo.
☆ Apps Script › Execuções: falhas de `rodarFilaPerfil_` (rede, 401, 403). A cota de tempo de acionadores do Google comporta um disparo por minuto (≈ 24 min/dia).
☆ SQL de leitura C (tarefas pendentes) uma ou duas vezes ao dia.
☆ Nada de `SYNC_JOINERS=todos`.

## Reversão total (ordem inversa)
G (apagar o interruptor + redeploy) → F (passo 3 do teste, se ainda aplicado) → E (`removerGatilhoFilaPerfil`) → D (Instant Rollback na Vercel) → C (versão anterior da implantação) → B (redeploy da função de `perfil-sync-implantada` + `secrets unset`) → A (`E1_cadastro_tarefas_reverter.sql`, que arquiva antes de apagar).

## Riscos conhecidos (e o que os cobre)
| Risco | Cobertura |
|---|---|
| Entre A e B, uma alteração de nome/e-mail por SQL entra na fila e a função antiga não a entende | regras da janela; a função antiga só roda por botão; o minuto entre A e B |
| Troca de `@` não chega à planilha (etapa 2) | por desenho: vira pedido; a linha em Dados é achada pelo ID depois da primeira escrita |
| Linha de Dados ausente, repetida ou com fórmula | a escrita é recusada e a tarefa vira "precisa de atenção"; nada é gravado |
| Chave do projeto no formato novo (`sb_publishable_…`) recusada pelo porteiro | checagem da etapa B (item 2) e da etapa E; solução: publicar com `--no-verify-jwt` (a função se autentica sozinha) |
| Planilha ocupada | resposta "ocupado" é transitória e tentada de novo; as tentativas atualizam a mesma tarefa |
| Preview da Vercel | é inerte e protegido; nada do roteiro depende dele |
