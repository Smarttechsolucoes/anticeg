# Teste real da etapa 1 numa CÓPIA da planilha (passo a passo)

**Objetivo:** ver o fluxo funcionando de verdade — gravação confirmada → tarefa em Atualizações → sincronização automática → Dados → MASTERLIST — sem tocar na planilha real nem no banco de produção.
O banco do teste é **local e fictício**; só a planilha é de verdade (a **cópia**). Precisa de você (eu não tenho acesso ao Google): é a parte marcada ✋.

## ✋ 1. Copiar a planilha (2 min)
Arquivo › **Fazer uma cópia**. Dê um nome que não deixe dúvida (ex.: `COPIA TESTE E1 - NÃO USAR`). Trabalhe só nela. *(A cópia leva os dados de todas as joiners: mantenha-a privada e apague depois do teste.)*

## ✋ 2. Preparar a cópia (3 min)
Na **cópia**:
1. Aba **Dados**: crie os cabeçalhos `D1 = ID_SITE`, `E1 = PAPEL`, `F1 = VERSAO` e acrescente **uma linha** no fim: `A = @teste_e1`, `B = Teste E1 Antigo`, `C` vazio, D/E/F vazios.
2. Aba **MASTERLIST**: acrescente **3 linhas** no fim com `F = @teste_e1`: nas duas primeiras copie as fórmulas de uma linha real (`E = VLOOKUP(F#,Dados!A:B,2,0)` e `S = VLOOKUP(F#,Dados!A:C,3,0)`); na terceira deixe `E` com **texto fixo** `Nome Fixo Digitado`.

## ✋ 3. Implantação de TESTE do Apps Script (5 min)
Na **cópia**: Extensões › Apps Script. Esse projeto é da cópia (independente do da planilha real).
1. Ao copiar a planilha, o Google **copia junto o projeto do Apps Script** (as *Propriedades do script* NÃO vêm: por isso o token real não vai para a cópia). Confira que o código é o mesmo do real.
2. Faça as **duas edições** e cole `ATUALIZAR_CADASTRO.gs` (ver `appsscript/ATUALIZAR_CADASTRO.md`).
3. Propriedades do script: `ANTICEG_TOKEN` = um valor **novo e só de teste**.
4. Implantar › Nova implantação › Aplicativo da Web (Executar como: você; Quem tem acesso: qualquer pessoa). Guarde a URL `/exec`.

## ✋ 4. Rodar o teste (no seu computador, nesta pasta)
```
$env:E1_CONFIRMO_COPIA="1"
$env:E1_PLANILHA_URL="<URL /exec da implantação de TESTE>"
$env:E1_PLANILHA_TOKEN="<o token de teste>"
$env:E1_COPIA_SHEET_ID="<id da cópia>"      # opcional: com ele o script também confere a aba Dados (a cópia precisa estar com "qualquer pessoa com o link pode ver")
node scripts/e1-teste-copia-planilha.mjs
```
O script **recusa** rodar sem `E1_CONFIRMO_COPIA=1` ou se a URL for igual à `PLANILHA_URL` de produção, só mexe em cadastros fictícios (`@teste_e1…`) e **não imprime** URL nem token. *(Você pode me mandar só a saída do script, que não contém segredo.)*

## ✋ 5. Conferir à mão na cópia (1 min)
Aba **Dados**: linha `@teste_e1` com B = nome novo, C = e-mail novo, D = número, E = `principal`, F = versão. **MASTERLIST**: as duas linhas com fórmula mostram o nome (E) e o e-mail (S); a de texto fixo **não mudou**; nenhuma outra célula mudou.

## Depois
Apague a cópia (e a implantação de teste). O agendador **não** entra neste teste (é de produção); a fila é processada aqui pela própria função, sem o botão do admin. O ensaio do agendador está em `tests/cadastro-etapa1-ponta-a-ponta.mjs` (passo 8).
