# Bloco 3 — Integridade da MASTERLIST (R1.1 + S1 + S2): ordem de implantação, verificação e reversão

## STATUS (2026-10-16)
| Etapa | Estado |
|---|---|
| R1.1 | **APLICADO** (SQL + verificador 8/8 + permissões OK; PR #35 `8aac0bc`) |
| S1 | **APLICADO** (SQL + verificador OK; PR #24 `11b5fb2`). Execuções reais do sync pós-S1: verdes, sem exclusão, ids preservados. O caminho de EXCLUSÃO com dados reais ainda não foi exercitado (nenhuma candidata); a função foi validada com chamadas que não apagam nada |
| **S2** | **PRONTO, NÃO PUBLICADO** — branch `fix/sync-casar-por-codigo-final` (a partir da main atual; o diff é só o S2). Testes: 14 unitários, 34 do script real do sync (inclui Livias 7129/8357, ordem invertida e código reaproveitado) contra PGlite + SQL do S1, 5 do verificador. Aguarda a execução agendada de 00:00 UTC e a autorização da usuária |
Os passos 1 e 2 abaixo ficam como registro; **o próximo é o passo 3 (S2)**.

**Problema:** o sync identifica a linha por `ceg|item|nome` + ordem. Quando alguém edita o nome do item, o nome de exibição ou o CEG na planilha, ele **apaga a linha e insere outra com id novo**. As demandas de pagamento guardam o id antigo (413 de 3.811 itens em 16/10; demanda 779 em análise). Hoje o sync também **apaga linhas com claim e linhas pagas** (o teste `tests/sync-integracao.mjs` reproduz isso com o script atual).

| Peça | O que é | Onde | Mexe no banco? |
|---|---|---|---|
| **R1.1** | a confirmação reassocia, pelo `id_linha` (conferência estrita), o item recriado pelo sync | branch `fix/pagamentos-reassociar-itens` (SQL + front) | só o corpo de `admin_definir_status_pagamento` |
| **S1** | exclusão atômica e protegida (claims, pagos, multas, linhas do site, limites, arquivo) | PR #24 + `supabase/sync/S1_*` | sim (função, tabela de arquivo, gatilho) — aditivo |
| **S2** | o sync casa pelo código (`id_linha`) antes da regra antiga: o id não muda quando só o nome muda | branch `bloco3/sync-integrado` (já com S1 mesclado) | **não** (só código do script) |

## Ordem recomendada (cada passo é independente e reversível)
**0. Linha de base (somente leitura, antes de tudo):** `supabase/sync/S2_verificar_leitura.sql` — anote as 8 linhas.

**1. R1.1 (não toca no sync)**
1. `git push` do branch e abrir o PR (sem mesclar).
2. SQL Editor: `R1_1_reassociar_itens_aplicar.sql` → `R1_1_reassociar_itens_verificar.sql` (**8 linhas**: true, true, false, true, 1, true, 2, false) → `R1_teste_permissoes_nao_destrutivo.sql` (esperado erro `R1 PERMISSÕES OK`).
3. Mesclar o PR (só a mensagem do painel muda). A demanda 779 passa a mostrar `6183 → 7238` e `6184 → 7239` antes do aceite.
4. **Reversão:** `R1_1_reassociar_itens_reverter_protegido.sql` (frase `AUTORIZO REVERTER REASSOCIACAO`) + reverter o merge.

**2. S1 (protege o que o sync atual apaga)** — primeiro o SQL, depois o código
1. `S1_prune_protegido_aplicar.sql` → `S1_prune_protegido_verificar.sql` (tudo `OK`).
   Com o sync ANTIGO ainda no ar isso é seguro: o gatilho barra a exclusão de linha com claim, o lote falha com `Erro ao deletar` e o job segue verde (testado).
2. Mesclar o PR #24. Próximas execuções: `✓ Removidos: N · preservados por proteção: M {...}`, código de saída 0.
3. **Reversão:** reverter o merge (volta à exclusão direta) e `S1_prune_protegido_reverter_protegido.sql`.

**3. S2 (reduz a recriação de linhas)** — depois de observar 2–3 execuções do passo 2
1. Push do branch `fix/sync-casar-por-codigo-final`, abrir o PR (o diff contra a main é só o S2: `casar-itens.js`, 28 linhas no `sync-masterlist.js`, testes e este guia), conferir que está limpo e mesclar.
2. Próxima execução: `✓ Masterlist: … · ~5155 casados pelo código (N com nome/CEG alterado, mantendo o id)`, 0 ou poucos inseridos.
3. Em 24 h, rodar de novo `S2_verificar_leitura.sql` e comparar: linhas, chaves repetidas, códigos repetidos e itens obsoletos **não podem crescer**; "ids emitidos e que não existem mais" deve parar de subir rápido.
4. **Reversão:** reverter o merge. Não há dado a consertar: o S2 só deixa de reaproveitar o id.

## Por que isso não interrompe o sincronizador
☆ O GitHub Actions lê o script da `main` a cada execução; um merge é atômico e execuções em andamento terminam com o código que já carregaram. Não é preciso pausar o workflow.
☆ **Código novo antes do SQL do S1** (sem a função `prune_masterlist`): o script não apaga nada, loga `Exclusão protegida indisponível — NADA foi apagado` e termina verde. **SQL do S1 antes do código novo:** o script antigo continua funcionando (o gatilho só barra claims). Os dois sentidos estão em `tests/sync-integracao.mjs`.
☆ O S2 não altera permissões, tabelas nem dados; a trava de planilha parcial usa o total real do banco (o S2 não a enfraquece). Planilha parcial: exclusão abortada (código 3, job vermelho) e nada apagado.

## Como o S2 trata cada caso (testado no script real)
| Caso | Comportamento |
|---|---|
| Linha com código **único** na planilha e **único** no banco, mesmo CEG | casa pelo código: mesmo id; atualiza nome, valores e dono; nunca apagada |
| **Sem id_linha** (1.015 linhas hoje) | regra antiga (`ceg|item|nome` + ordem), igual a hoje; renomear cria linha nova e a antiga segue para o S1 |
| Código **repetido na planilha** (218 repetições) | não casa nenhuma das linhas repetidas; seguem pela regra antiga; a linha nova nunca toma o id de outra |
| Código **repetido no banco** (24 valores) | não casa (ambíguo); a outra linha nunca é confundida |
| Mesmo código, **CEG diferente** | trata como item diferente: linha nova; a antiga segue a regra antiga/S1 |
| Mesmo código, mas **dono (@) diferente** | NÃO casa: o id nunca muda de dono; a outra joiner recebe linha nova (testado: código reaproveitado) |
| **Sem código**, mesma chave `ceg|item|nome` (ex.: duas Livias, ids 7129/8357) | desempate pelo **@ exato**: cada linha segue com o seu dono, mesmo com a ordem da planilha invertida (o script antigo TROCA os donos; o S2 não) |
| Linha com **claim** e código, renomeada | mantém o id; o claim continua ligado |
| Linha **sem código**, paga/com claim, renomeada | S1 preserva a antiga: **duplicata conhecida** até alguém cadastrar o código na planilha |

## R1.1: o que ele nunca faz (testado)
☆ Item recriado de **outra joiner**: a confirmação pede a confirmação de terceiros **antes** de qualquer outra coisa, mesmo que os ausentes já tenham sido aceitos.
☆ **Código duplicado**, CEG/nome/valor diferente, `id_linha` vazio ou inexistente: o item continua "ausente"; com ou sem aceites nada é marcado no lugar.
☆ Nada é gravado antes do aceite; o JSON da demanda não é reescrito.

## Limites assumidos
☆ Itens obsoletos de demandas **já pagas/rejeitadas** (411 em 16/10) permanecem como estão (histórico); o R1.1 só atua ao confirmar. ☆ 57 dos 413 itens obsoletos têm código único mas falhariam na conferência estrita (nome/valor mudaram): ficam ausentes, por segurança.
