# Teste real da etapa 1 numa planilha de TESTE criada do zero (checklist único)

**Objetivo:** ver o fluxo funcionando de verdade: gravação confirmada → tarefa em Atualizações → sincronização automática (sem botão do admin) → Dados → MASTERLIST, com o texto fixo intacto.
**Isolamento:** a planilha é **nova**, privada, só com as abas `Dados` e `MASTERLIST` e dados **fictícios**. Nada da planilha real é copiado. O banco deste teste (nível 1) é local e fictício. Só aparece a ação ✋ onde é preciso a sua conta Google.

## Como o Apps Script de teste "aponta" para a planilha
O script é **vinculado** à planilha de teste (Extensões › Apps Script, aberto de dentro dela): ele só enxerga a planilha à qual pertence. Além disso:
☆ `prepararPlanilhaTeste()` **recusa** rodar numa planilha com qualquer conteúdo e só então grava as propriedades `E1_PLANILHA_TESTE=1` e `E1_PLANILHA_ID=<id>`.
☆ As ações `e1_identificar`/`e1_ler` só respondem se essas propriedades batem com a planilha. O script de teste chama `e1_identificar` **antes de gravar qualquer coisa** e **recusa** se: não for planilha de teste, não tiver só as abas Dados e MASTERLIST, o nome não começar com `TESTE E1`, ou (se você informar `E1_COPIA_SHEET_ID`) o final do id não conferir.
☆ A leitura de volta (Dados, MASTERLIST, digest) é feita pelo próprio Apps Script, com o token: **não precisa compartilhar a planilha**.

## ✋ Ações que exigem a sua conta Google (≈ 15 min, em ordem)
1. **Criar a planilha:** sheets.new (conta que será dona do teste). **Não** copie a real. Deixe em branco, sem renomear.
2. **Abrir o Apps Script dela:** Extensões › Apps Script. Apague o conteúdo de `Código.gs`.
3. **Colar o código:** cole **o arquivo inteiro** `C:\Users\Nanda\anticeg-privado\teste-e1-google\Codigo.gs` (já montado a partir do script de 07/11 + as edições da etapa 1 + o código só de teste; no repositório: `node scripts/e1-montar-codigo-teste.mjs <script-atual.gs> <saida.gs>`). Se o script **publicado** hoje for diferente do de 07/11, monte com a cópia atual dele (me avise se o montador recusar). Salvar.
4. **Preparar:** escolha a função `prepararPlanilhaTeste` › Executar. Autorize quando pedir (é o seu próprio script, na sua planilha). Confira: a planilha virou `TESTE E1 - fictícia - NÃO USAR`, com as abas Dados e MASTERLIST.
5. **Pegar o token de teste:** Configurações do projeto (engrenagem) › Propriedades do script › `ANTICEG_TOKEN` › copiar. **Esse valor vai só para o seu terminal (passo 7); não cole no chat.**
6. **Implantar:** Implantar › Nova implantação › Aplicativo da Web › Executar como: **você**; Quem tem acesso: **Qualquer pessoa**. Autorize. Copie a URL que termina em `/exec` (também só para o terminal).
7. **Rodar o teste**, no PowerShell, na pasta do repositório (`C:\Users\Nanda\anticeg-cadastro-main`, branch `feat/cadastro-etapa1`; `npm i --no-save @electric-sql/pglite` na 1ª vez). Os segredos são digitados no prompt e não aparecem na tela:
```
$env:E1_CONFIRMO_COPIA="1"
$env:E1_PLANILHA_URL = Read-Host "URL /exec da implantação de TESTE"
$s = Read-Host "Token de teste" -AsSecureString
$env:E1_PLANILHA_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
node scripts/e1-teste-copia-planilha.mjs
Remove-Item Env:E1_PLANILHA_TOKEN, Env:E1_PLANILHA_URL
```
8. **Me mandar só a saída do script** (não contém URL nem token) e olhar a planilha de teste: Dados (linha `@teste_e1`: nome novo, e-mail novo, ID, `principal`, versão) e MASTERLIST (as duas linhas com fórmula mostram o nome/e-mail novos; a linha `Nome Fixo Digitado` não mudou).
9. **Repetir** (se quiser): rode `reiniciarDadosTeste` no editor e execute o passo 7 de novo (o script recusa se a planilha não estiver no estado inicial).
10. **Depois:** apague a planilha de teste (isso remove o script e a implantação).

## O que o script confere sozinho
Identificação da planilha de teste · tarefa pendente no banco local · fila processada pela função `perfil-sync` real, **sem botão** · Dados (B, D, E) · MASTERLIST (fórmulas refletem; **texto fixo igual**; digest da planilha inteira igual: nenhuma célula digitada e nenhuma fórmula mudou) · e-mail pelo Auth · versão antiga ignorada · falha "linha não encontrada" vira "precisa de atenção" sem gravar nada.

## Nível 2: o gatilho por horário de verdade
Precisa de um projeto Supabase de TESTE (novo, Free). Tudo (Google + Supabase, em ordem, com os comandos) está no checklist único **`ENSAIO_COMPLETO.md`**; os arquivos são gerados por `scripts/e1-gerar-sql-ensaio.mjs` e o ensaio roda com `scripts/e1-ensaio-gatilho.mjs`.
