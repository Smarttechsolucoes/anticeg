# Ensaio completo da etapa 1 (Google + Supabase de TESTE): checklist único

**Meta:** ver uma tarefa sair de **pendente** para **sincronizada** depois de um **disparo automático** (gatilho de horário do Apps Script, sem clique no admin), com a alteração em **Dados** refletida na **MASTERLIST** e a linha de **texto fixo** preservada. Tudo fictício, tudo de teste. **Nada de produção é tocado.**

Peças: a **planilha de teste** (criada do zero, só Dados e MASTERLIST) + um **projeto Supabase de teste** (novo, plano Free). A mesma planilha serve ao nível 1 (banco local) e ao ensaio do gatilho.

> Vaga no plano gratuito: não consigo ver a sua conta. Se o Supabase avisar que a organização já atingiu o limite de projetos gratuitos, **pare e me avise**. Não contrate nada. (Alternativa sem custo: pausar/apagar um projeto de teste antigo, se existir.)

## Parte A — Google (login Google) ≈ 15 min
1. sheets.new › planilha em branco (não copie a real).
2. Extensões › Apps Script › apague o `Código.gs` › cole **inteiro** `C:\Users\Nanda\anticeg-privado\teste-e1-google\Codigo.gs` › salvar.
3. Executar `prepararPlanilhaTeste` (autorize). A planilha vira `TESTE E1 - fictícia - NÃO USAR`.
4. Configurações do projeto › Propriedades do script › copie o valor de `ANTICEG_TOKEN` (só para o seu terminal).
5. Implantar › Nova implantação › Aplicativo da Web (executar como você; acesso: qualquer pessoa) › copie a URL `/exec` (só para o terminal).
6. **Nível 1 (opcional, banco local):** `node scripts/e1-teste-copia-planilha.mjs` (comandos em `TESTE_REAL_COPIA.md`). Depois, no editor do Apps Script, execute `reiniciarDadosTeste` (o ensaio do gatilho exige a planilha no estado inicial).

## Parte B — Supabase de TESTE (login Supabase) ≈ 20 min
7. supabase.com › **New project** › nome `anticeg-ensaio-e1` › plano **Free** › região qualquer › gere uma senha nova do banco. (Sem vaga? pare aqui e me avise.)
8. Project Settings › API: anote **Project URL**, **anon** e **service_role** (prefira as chaves "legacy" `eyJ…`). A service_role é secreta: só no seu terminal.
9. **SQL Editor do projeto de TESTE** (confira o nome do projeto no topo!): cole **inteiro** `C:\Users\Nanda\anticeg-privado\teste-e1-supabase\ENSAIO_E1_projeto_de_teste.sql` › Run. Esperado: a última linha diz `ENSAIO E1 pronto`. O arquivo **recusa** rodar se o banco já tiver `public.joiners` (proteção contra rodar na produção).
10. **Terminal** (PowerShell), na pasta `C:\Users\Nanda\anticeg-cadastro-main` (branch `feat/cadastro-etapa1`). Os segredos são digitados nos prompts e **não** passam pelo chat:
```
npx supabase login
npx supabase link --project-ref <REF DO PROJETO DE TESTE>     # o ref aparece na URL do projeto; se pedir senha do banco, pode pular
$seg = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
Set-Clipboard $seg        # guarda o segredo do agendador na área de transferência (para o passo 11); não é exibido
$urlPlan = Read-Host "URL /exec da planilha de TESTE"
$s = Read-Host "Token da planilha de TESTE" -AsSecureString
$tok = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
npx supabase secrets set "PLANILHA_URL=$urlPlan" "PLANILHA_TOKEN=$tok" "PERFIL_SYNC_SEGREDO=$seg"
npx supabase functions deploy perfil-sync                      # sem Docker: acrescente --use-api
```
Se as chaves do projeto forem do tipo novo (`sb_publishable_…`) e a chamada do gatilho der 401, publique com `--no-verify-jwt` (a função se autentica sozinha pelo segredo ou pelo token de admin).
11. **Apps Script da planilha de TESTE** › Propriedades do script › acrescente (cole o segredo com Ctrl+V; as outras duas vêm do passo 8): `PERFIL_SYNC_SEGREDO`, `PERFIL_SYNC_URL` = `https://<REF>.supabase.co/functions/v1/perfil-sync`, `SUPABASE_ANON_KEY` = a chave **anon**. Depois execute **`instalarGatilhoFilaPerfil`** (autorize). Isso liga o disparo de **1 em 1 minuto**, só nesta planilha de teste.
12. **Rodar o ensaio** (o script só altera e espera; ele **não** chama a função e **não** processa a fila):
```
$env:E1_CONFIRMO_ENSAIO="1"
$env:E1_SUPABASE_URL = Read-Host "Project URL do projeto de TESTE"
$env:E1_SUPABASE_ANON_KEY = Read-Host "anon do projeto de TESTE"
$s = Read-Host "service_role do projeto de TESTE" -AsSecureString
$env:E1_SUPABASE_SERVICE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
$env:E1_PLANILHA_URL = $urlPlan; $env:E1_PLANILHA_TOKEN = $tok
node scripts/e1-ensaio-gatilho.mjs
Remove-Item Env:E1_SUPABASE_SERVICE_KEY, Env:E1_SUPABASE_ANON_KEY, Env:E1_SUPABASE_URL, Env:E1_PLANILHA_TOKEN, Env:E1_PLANILHA_URL
```
Esperado: `+0s pendente → +NNs sincronizada` (normalmente 1 a 2 min), Dados e MASTERLIST conferidos e `ENSAIO CONCLUÍDO`. **Me mande só a saída** (não tem chave, token, URL nem JWT).
13. **Desligar:** no Apps Script de teste execute `removerGatilhoFilaPerfil`. Depois apague a planilha de teste e pause/apague o projeto Supabase de teste.

## O que eu faço com o resultado
Leio a saída, diagnostico qualquer falha (gatilho que não disparou, propriedade faltando, 401, etc.) e ajusto o código. Se a Execução do Apps Script mostrar erro, me mande só a mensagem (o log do gatilho nunca registra o segredo).

## Antes de usar em produção (aprovação separada, depois do ensaio)
☆ Preflight (somente leitura) em produção: `E1_preflight_somente_leitura.sql`.
☆ Comparar a `perfil-sync` implantada com a base do PR: `node C:\Users\Nanda\anticeg-privado\perfil-sync-comparar\comparar.mjs <pasta da função baixada>` (`npx supabase functions download perfil-sync`), **antes de substituir a função**.
☆ Conferir o Apps Script publicado, aplicar o E1, segredo, publicar a função, o site e o gatilho de produção: ordem e reversões no `LEIA-ME.md`.
