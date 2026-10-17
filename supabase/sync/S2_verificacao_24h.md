# S2 — verificação complementar de 24 h (somente leitura)

**Primeira execução real com o S2:** sync manual `39037241682` (17/10/2026, 13:36–13:53 UTC, sucesso): 6.415 atualizados, 0 inseridos, **5.158 casados pelo código**, **139 desempatados pelo dono**, 0 removidos, 0 erros.

## Como executar (qualquer dia depois de 18/10/2026 ~14h UTC)
1. `gh run list --workflow sync-masterlist.yml --limit 10` e, para cada execução depois de `39037241682`: `gh run view <ID> --log` → conferir `casados pelo código`, `desempatadas pelo dono`, `inseridos`, `Nenhum registro candidato à remoção` (ou `Removidos`/`preservados por proteção`), `erros = 0`.
2. No SQL Editor (ou `npx supabase db query --linked --project-ref ghjfsmwwcfpfvrouyrka -f <arquivo>`), rodar **`S2_verificar_leitura.sql`** e **`S2_impressao_leitura.sql`**.
3. Comparar com a linha de base (17/10 logo após o primeiro sync com o S2):

| Item | Valor de referência | Regra |
|---|---|---|
| linhas na masterlist | 6.415 | só pode crescer por linhas novas da planilha |
| sem `id_linha` | 1.015 | não pode crescer além das novas |
| `id_linha` repetidos no banco | 24 | não pode crescer |
| chaves `ceg\|item\|nome` repetidas | 204 | não pode crescer além de joiners novas de mesmo nome |
| itens de demandas com id obsoleto | 413 | não pode crescer |
| ids emitidos que não existem mais | 1.943 | **deve parar de subir** (cada linha recriada soma 1) |
| sequência / maior id | 8358 / 8358 | sobe só com linha nova |
| impressão `id\|cog\|id_linha\|ceg` | `bcdd525fdfb8cb2177a553724e3d34a5` | muda só se a planilha mudou donos/linhas; **nenhum id existente pode trocar de dono** |
| impressão dos pagamentos | `d64fb693ba8072a86768d2ba142bd50f` | muda só com confirmações legítimas |
| claims / linhas com claim | 114 / 33 | não pode cair |
| multas pagas | 2.153 | não pode cair |
| arquivadas (`masterlist_exclusoes`) | 0 | >0 só se uma exclusão protegida aconteceu |

## Se algo não bater
Não reverter nada automaticamente. Reverter o S2 = reverter o merge da PR #36 (o S2 só deixa de reaproveitar o id; nenhum dado a consertar). Antes, anotar qual linha/dono divergiu.
