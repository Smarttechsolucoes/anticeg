# Consolidação do login geral (PRs #19–#29) — estratégia e estado (2026-10-17)

Nada foi mesclado, publicado, ativado nem aplicado em produção. Login geral continua DESLIGADO (`VITE_JOINERS_AUTH` ausente) e nenhuma permissão foi alterada.

## 1. Estado verificado
☆ O branch local `piloto/banco-e-docs` contém **todos** os commits dos branches das PRs #19, #20, #21, #22, #23, #25, #27, #28 e #29 (conferido com `merge-base --is-ancestor`: 0 commits fora). **Só ele reúne as 8 correções J1/J3/J4d do piloto.** Ele só existe no computador (83 commits à frente da `main`).
☆ A PR #26 (`seguranca/isolar-preview`) **não** está no piloto (13 commits a mais, mais a atualização feita em 17/10).
☆ A `main` avançou 11 commits que o piloto não tem: R1, R1.1, S1, S2, N0 (documentação), notificações ocultas (#37), página `/piloto-senha/`, preservação de e-mail no sync e as capas Esquire.

## 2. Estratégia (sem mesclar PRs individualmente)
1. **Base única:** `lancamento/consolidado` = `piloto/banco-e-docs` + `origin/main` (feito localmente, commit `cd7cbf2`). Apenas **3 conflitos pequenos**, resolvidos assim:
   ☆ `src/App.jsx` (imports): fica a versão do piloto (autenticação, comprovantes, `chamarPlanilha`); `planilhaCancelar.js` removido (continha o token do Apps Script).
   ☆ `src/App.jsx` (rejeição de pagamento): fica a versão do piloto, que lê a resposta da planilha pelo proxy.
   ☆ `scripts/sync-masterlist.js`: fica `totalExistentes = totalNoBanco` (trava de planilha parcial do S2).
2. **Uma PR única** a partir de `lancamento/consolidado` (depois de você autorizar o push). Fecho #19, #20, #21, #22, #23, #25, #27, #28 e #29 como "substituídas pela PR de consolidação", **sem apagar os branches**. A #26 e a #30 saem da pilha: a #26 entra primeiro, sozinha (é isolada e já está pronta); a #30 já está dentro do proxy.
3. **Com a chave desligada, a PR não muda nada para as joiners.** O lançamento (J4b → J5, ondas) segue o roteiro `LANCAMENTO.md` e só começa com autorização.

## 3. O que foi testado na consolidação (local, PGlite e Node)
☆ Build do Vite ok. Testes unitários: 56 de 57 passaram; o 1 que falhou era uma guarda minha e foi ajustada (o e-mail do relato agora sai por evento do servidor, `notificarEmail`).
☆ Suíte SQL: 25 arquivos de teste, todos passaram (J1, J1c, J3, J4, J4c1–J4c4f, J4d, J5, lançamento completo, piloto, R1 ×6, S1, S2).
☆ Integração do script real do sync na consolidação: ver resultado no relatório final desta rodada.

## 4. Dependências entre os SQLs (todos com guarda "Nada foi alterado")
| SQL | Exige antes | Observações |
|---|---|---|
| J4-0 | A1/A2 (`is_admin`), C0 (`emergencia`) | só amplia acesso para a administradora; a lista de tabelas já inclui `pedidos_dazed_seungmin` e `pedidos_esquire_hyunjin` |
| J4a | J1 | visão pública segura e `cog_e_da_conta` |
| J4b | J1/A1 e **J4a** (`cog_e_da_conta`) | fecha `pagamento_demandas`, `multas_pagas`, `masterlist`. **Compatível com o R1** (funções do R1 são SECURITY DEFINER e só admin executa) e com o gatilho do S1 |
| J4c-1/2/3 | J1/A1 e J4a | J4c-3 cobre os formulários, inclusive Dazed Seungmin e Esquire Hyunjin |
| J4c-4a…f | J4a/J4c anteriores | J4c-4c cria as policies de `notifications`: **compatível com o N0** (ele liga o RLS, apaga policies antigas e concede a `authenticated`) |
| J5 | J4c anteriores; funções de comprovante publicadas | buckets privados, sem mover arquivos |
| J4d | J1 | ondas; estado inicial "ninguém liberada" |
☆ **Ponto de atenção:** as cópias locais não commitadas de `J4_0`, `J4c3_*` e `06_lojas_publicas.sql` no workspace `anticeg` (branch `ensaio/integrado`) são **mais antigas** que as do piloto (só têm Dazed; o piloto tem Dazed e Esquire). A consolidação usa a versão do piloto.
☆ **Ordem com o E0:** o E0 (revogar DELETE/TRUNCATE) é independente do J4; aplicado antes ou depois, o J4 recria as permissões das tabelas que fecha. O E0 deve ser aplicado **antes** do J4b, porque a reversão dele restaura o estado anterior inteiro.

## 5. Antes de ativar o `NOTIFICACOES_INTERNAS_ATIVAS` (J4c-4c)
Só depois da autenticação segura e de validar as policies de `notifications` com contas reais.
