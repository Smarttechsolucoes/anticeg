# E00 / E0 — prontidão (2026-10-17). NADA foi aplicado em produção.

## O que o E0 revoga (somente REVOKE; nenhum dado muda)
| Item | Hoje no banco real (leitura de 17/10) | Depois do E0 |
|---|---|---|
| Tabelas `bkp_unir_*` com algum acesso de anon/authenticated | 29 | 0 (acesso total removido; o site não usa nenhuma) |
| Tabelas com TRUNCATE/REFERENCES/TRIGGER para anon ou authenticated | 80 | 0 |
| Tabelas com DELETE para anon | 79 | 12 (lista abaixo) + `config` só para a administradora logada |
| Dessas 79, as que perdem o DELETE | 67 | — |

## DELETE que o site usa e que o E0 PRESERVA (conferido no código da `main` e do lançamento, 13 tabelas)
`cal_eventos`, `ceg_config`, `claims`, `estoque_compras`, `estoque_itens`, `item_fotos`, `joiner_storage`, `links_uteis`, `masterlist`, `push_subscriptions`, `pushes`, `rastreios` (anon e authenticated) e `config` (apenas `authenticated`, botão "Remover PIN").
Não há `.delete` dinâmico, nem em Edge Functions, nem em scripts (o sync só apaga por `prune_masterlist`, com a chave de serviço, que o E0 não toca). Único `delete from` em SQL do repositório fora do S1: script de preparação único de `promo_13_estoque` (não é runtime).

## Verificação e reversão (já prontas)
☆ Conferência dentro da transação do próprio E0: compara com `emergencia.grant_backup` e desfaz tudo se SELECT/INSERT/UPDATE (tabela e coluna) ou os DELETE preservados mudarem.
☆ `E0_verificar.sql` (somente leitura) depois de aplicar; `E0_reverter.sql` restaura exatamente do backup (testado: reverter total + reaplicar).
☆ Testes locais: `teste-e0.mjs` e `teste-e0-guarda.mjs` passam; `teste-sql.mjs` passa nas partes do E0 (a parte E1a depende do branch do E1, fora deste escopo).

## Ordem (sem aplicar agora)
1. Você roda a consulta de logs (`E0_gate_logs_delete.md`) e me entrega o resultado.
2. Gate OK → `E00_ferramentas_backup.sql` → `E0_aplicar.sql` → `E0_verificar.sql` (autorização separada).
3. Gate com alerta → eu ajusto a lista de tabelas apagáveis antes.

## O que continua dependendo de você
☆ O resultado dos logs de DELETE (a única fonte para automações externas) e/ou o código dos 4 Apps Scripts.

## Resultado do gate de logs de DELETE (export de 14–17/10, 100 chamadas, `Downloads/supabase_logs.csv`)
| Chamadas | Tabela / caminho | Origem | Papel | E0 afeta? |
|---|---|---|---|---|
| 78 (todas **409**) | `pushes` | navegadores (iPhone/Android) | anon | **Não**: `pushes` está entre as 12 preservadas. O 409 vem da FK `push_reads_push_id_fkey` (o site grava a leitura e tenta apagar o push; nunca funcionou). Corrigido localmente em `fix/push-banner-sem-409` (não apaga mais; push_reads já faz o aviso sumir) |
| 5 (204) | `masterlist` | `node` (script do sync, 15–16/10 até 17:23, antes do S1) | `service_role` (chave de serviço do GitHub Actions) | **Não**: o E0 só revoga de `anon`/`authenticated`. Depois do S1 o sync só apaga pela função `prune_masterlist` (não aparece como DELETE REST) |
| 5 (204) | `tentativas_acesso` | Edge Function (deno), 15/10 | `service_role` (a função usa `SUPABASE_SERVICE_ROLE_KEY`; no banco anon/authenticated nem têm privilégio na tabela) | **Não** |
| 1 (204) | `joiner_storage` | navegador, 14/10 | anon | **Não**: tabela preservada |
| 11 (200) | Storage `avatars` | navegadores | anon/authenticated via **políticas do Storage** (`storage.objects`) | **Não**: o E0 só mexe em tabelas do schema `public`; Storage é outro mecanismo (fica para o J5/Storage) |
☆ Nenhuma outra tabela, nenhum `user_agent` de automação externa (Apps Script, curl, python) no período exportado.
☆ **Conclusão do gate: sem incompatibilidade.** Limites: só mostra a janela exportada e a API REST; automações raras ou o Apps Script que use conexão direta não aparecem (por isso o código dos 4 scripts continua pedido).
