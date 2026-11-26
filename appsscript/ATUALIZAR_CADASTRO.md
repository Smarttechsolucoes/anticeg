# Apps Script — ação `atualizar_cadastro` (etapa 1) e agendador da fila

O script **publicado** não está versionado neste repositório (a cópia mais recente que temos é de 07/11 e precisa ser conferida em **Implantar › Gerenciar implantações**). Por isso este PR **não substitui** o script: traz uma função para colar e duas edições no `doPost`.

## 1. Colar `ATUALIZAR_CADASTRO.gs` no projeto (arquivo novo, sem apagar nada)

## 2. Duas edições no `doPost` (script de 07/11: linhas ~25–35 e ~55)
a) Na lista `acoesPermitidas`, acrescentar `"atualizar_cadastro",` (por exemplo logo abaixo de `"atualizar_joiner",`).

b) Logo ANTES do trecho `// MASTERLIST` / `const sheet = spreadsheet.getSheetByName("MASTERLIST");` (depois do bloco `if (payload.acao === "atualizar_joiner") { ... }`), acrescentar:
```js
    if (payload.acao === "atualizar_cadastro") {
      return resposta(atualizarCadastro_(spreadsheet, payload, gravar));
    }
```
O token continua sendo conferido ANTES (nada muda na autenticação). As demais ações não mudam.

## 3. Aba Dados
Cabeçalhos em D `ID_SITE`, E `PAPEL`, F `VERSAO` (as células ficam vazias; o primeiro envio de cada cadastro preenche D e E quando há UMA linha só com aquele @). As fórmulas `Dados!A:B` e `Dados!A:C` da MASTERLIST não são afetadas.

## 4. Agendador (opcional, só depois de aprovado)
Propriedades do script: `PERFIL_SYNC_URL`, `SUPABASE_ANON_KEY`, `PERFIL_SYNC_SEGREDO`. Executar `instalarGatilhoFilaPerfil()` UMA vez. Desligar: `removerGatilhoFilaPerfil()`.
Reaproveita o que já existe (o próprio Apps Script e a função `perfil-sync`); não exige ligar `pg_cron`/`pg_net`. O segredo vive só nas propriedades do script e nos segredos da função.
