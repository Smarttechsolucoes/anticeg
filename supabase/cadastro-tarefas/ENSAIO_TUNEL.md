# Ensaio do acionador por horário SEM Supabase de teste (túnel temporário + banco fictício local)

**O que prova:** o acionador de 1 minuto do Apps Script, de verdade, chama a `perfil-sync` real (rodando no seu computador, com banco fictício), e uma tarefa vai de **pendente** para **sincronizada** sem clique no admin, com Dados e MASTERLIST atualizados e a linha de texto fixo intacta. Ao terminar, o script **desliga o túnel** e **remove o acionador de teste** (confirmando 0 acionadores).

**O que fica exposto (e o que não):** o túnel (`cloudflared`, "quick tunnel", sem conta) encaminha só para uma porta local que serve **apenas `POST /perfil-sync`** (qualquer outro caminho ou método responde 404). A chamada só é aceita com o **segredo exclusivo deste ensaio** (gerado a cada execução, copiado para a área de transferência, nunca impresso). Banco, admin, rotas do site e a planilha real **não** estão no túnel. A resposta traz só contagens. O túnel dura só enquanto o script roda (máx. 10 min).

## Uma vez só: atualizar o Apps Script da planilha de TESTE
1. Selecione tudo no `Código.gs`, apague e cole **inteiro** `C:\Users\Nanda\anticeg-privado\teste-e1-google\Codigo.gs` (código novo, com a ação que confere/remove o acionador). Salve.
2. **Implantar › Gerenciar implantações › lápis (editar) › Versão: Nova versão › Implantar.** (A URL `/exec` continua a mesma. Autorize se o Google pedir: o código novo usa acionadores.)
3. Execute a função **`reiniciarDadosTeste`** (a planilha precisa estar no estado inicial).

## No PowerShell
```
cd C:\Users\Nanda\anticeg-cadastro-main
$env:E1_CONFIRMO_ENSAIO="1"
$env:E1_CLOUDFLARED="C:\Users\Nanda\anticeg-privado\ensaio-tunel\bin\cloudflared.exe"
$env:E1_PLANILHA_URL = Read-Host "URL /exec da implantação de TESTE"
$s = Read-Host "Token de teste" -AsSecureString
$env:E1_PLANILHA_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
node scripts/e1-ensaio-tunel.mjs
Remove-Item Env:E1_PLANILHA_TOKEN, Env:E1_PLANILHA_URL
```
(O `cloudflared.exe` é o binário oficial da release 2026.11.2, com o hash conferido.) **Deixe a janela aberta** até o fim.

## No Apps Script de TESTE, quando o script pedir (passo 2 da tela)
1. Configurações do projeto › **Propriedades do script**: crie `PERFIL_SYNC_URL` (o endereço que o script imprime), `SUPABASE_ANON_KEY` (qualquer texto, ex.: `ensaio`) e `PERFIL_SYNC_SEGREDO` (**Ctrl+V**: já está na sua área de transferência).
2. No editor, execute **`instalarGatilhoFilaPerfil`** (autorize se pedir).
3. Espere. Em 1 a 3 minutos a tela mostra o 1º disparo (fila vazia), depois a tarefa `PENDENTE`, depois o disparo que a leva a `SINCRONIZADA`, e por fim o encerramento (túnel desligado, acionador removido).

Se algo travar: feche o script com **Ctrl+C** (ele também desliga o túnel e remove o acionador) e, por garantia, execute `removerGatilhoFilaPerfil` no Apps Script e confira em **Acionadores** (relógio) que não sobrou nenhum.

## Testes sem Google e sem internet
`node tests/e1-ensaio-tunel.test.mjs` (túnel falso, planilha em memória, o `rodarFilaPerfil_` real disparado por um relógio simulado): caminho feliz, rotas barradas (404/403), tempo esgotado.
