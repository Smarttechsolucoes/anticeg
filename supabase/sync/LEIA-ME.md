# S1 — Exclusão segura da masterlist (sync)

**O que resolve:** o sync apagava da masterlist qualquer linha ausente da planilha, inclusive linhas criadas pelo site, linhas com claim e linhas já pagas.
O Google Sheets continua sendo a ferramenta de edição; só a **exclusão** passou a ser protegida, dentro do banco.

## O que é protegido (nunca apagado pelo sync)
☆ linha com claim que não esteja rejeitado
☆ `ceg = 'CLAIM'` e `cog = 'disponivel'` (nascem no site)
☆ `na_loja = true`
☆ qualquer `pago_item / pago_frete / pago_rf` marcado
☆ linha com multa registrada

## Limites
☆ planilha com menos de 50% das linhas do banco: não apaga nada
☆ no máximo 25 exclusões por execução (e nunca mais que 5% da tabela, mínimo 10). Passou disso: **não apaga nenhuma** e o job do GitHub fica vermelho (código 3)
☆ tudo que é apagado fica arquivado em `masterlist_exclusoes` (linha completa, com o id original) e pode ser restaurado
☆ segunda camada: um gatilho impede que QUALQUER chamador apague linha com claim ativo

## Como implantar (você roda; eu não executo nada em produção)
1. SQL Editor: colar `S1_prune_protegido_aplicar.sql` e executar (transação única; para sozinho se algo estiver diferente).
2. Colar `S1_prune_protegido_verificar.sql`: tudo deve dar `OK`.
3. Fazer o merge do PR (muda `scripts/sync-masterlist.js`). Se o merge vier ANTES do SQL, o sync simplesmente não apaga nada (a função não existe) — é seguro.
4. Na próxima execução do sync, conferir no log a linha `✓ Removidos: N · preservados por proteção: M {...}`.
5. Para ver o que foi arquivado: `select masterlist_id, dados->>'nome_do_item', excluido_em from masterlist_exclusoes order by id desc;`
6. Restaurar uma linha apagada por engano (mesmo id):
   `insert into public.masterlist select * from jsonb_populate_recordset(null::public.masterlist, (select jsonb_agg(dados) from public.masterlist_exclusoes where masterlist_id = 123));`

Reversão: `S1_prune_protegido_reverter_protegido.sql` (pede frase digitada). Não recomendada sem voltar também ao script antigo.

## Teste local (dados fictícios)
`npm i --no-save @electric-sql/pglite && node tests/sql/s1-prune.mjs`
