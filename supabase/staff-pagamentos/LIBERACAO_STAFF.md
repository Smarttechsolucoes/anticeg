# Liberação do fluxo de pagamentos para as staffs — plano controlado (18/10/2026)

## Estado
☆ **ST1 APLICADO em produção** (17/10 ~21:30Z), transação única, com backup (`emergencia.st1_backup_funcoes`), verificação interna, ensaio prévio com rollback e ensaio do reverter. Nenhuma staff criada.
☆ Preparado e testado, **não publicado**: front (branch `feat/staff-pagamentos`, commit `e3b68ed` sobre `feat/p0-02-confirmar-planilha`) e patch do proxy (branch `feat/proxy-staff-pagamentos`, commit `ca43563` sobre o PR #41).
☆ Pendentes: proxy #41 + migração do front, despachante, rotação do token, criação das contas, validação.

## O que o ST1 garante (verificado em produção)
| Condição exigida | Evidência |
|---|---|
| As 3 contas admin preservam acessos | `admin_roles` idêntica (hash f6562ed3…); com a identidade de cada uma: `is_admin=t`, `pode_operar=t`, `meu_papel=admin`; 40 policies com `is_admin()` idênticas (hash 155bd650…); 0 policies mudaram |
| `staff_pagamentos` só opera pagamento | só `admin_definir_status_pagamento` e `admin_marcar_pago` aceitam o papel; `admin_decisoes_pagamento` (leitura do registro) só admin geral |
| Não herda `admin_tudo` nem outras áreas | `is_admin()` passou a exigir `papel='admin'` → conta staff é FALSA em todas as 40 policies; 0 policies usam `pode_operar_pagamentos` |
| Registro no servidor | `emergencia.pagamento_decisoes`: `auth.uid()`, e-mail do JWT, papel (lido de `admin_roles`), ação, demanda, status anterior/novo, motivo, resumo, `now()`; sem acesso por anon/authenticated/service_role |
| Não confia no navegador | papel e identidade vêm de `auth.uid()`/`admin_roles` dentro de funções `SECURITY DEFINER` com `search_path` vazio; nada vem do corpo da requisição |
| Nada mais mudou | ACL das funções (exceto as 3 novas), privilégios de tabelas, todas as policies, demandas, multas e função de multa: impressões idênticas |
Teste de laboratório (PGlite, 36 verificações): permissões, aprovar/rejeitar/reabrir, idempotência, preservação do item coberto, trilha de auditoria, staff sem acesso ao registro nem a admin_roles, reversão.
Reversão: `ST1_reverter.sql` (recusa se existir conta staff; mantém a trilha).

## Sequência de liberação (cada passo só com sua autorização; cada um com volta)
| # | Passo | Verificação | Volta |
|---|---|---|---|
| 1 | **Proxy**: segredos `PLANILHA_URL`/`PLANILHA_TOKEN` (token ATUAL), publicar `planilha-acao` **com o patch de staff**. O site velho continua igual. | sonda do #41: tudo recusado; staff/anon/joiner nos testes do patch (26 testes) | `functions delete` / `secrets unset` |
| 2 | **Sondar o Web App** com o token atual (item inexistente, nada grava). | "aceito, nada gravado" | — |
| 3 | **PR de front consolidado** (um só, sem a #38): #41 (front sem token) rebaseado na `main` + confirmação/rejeição/reabertura (P0-02) + gate por papel. O módulo de confirmação passa a usar o transporte do proxy (URL da função + login da pessoa, sem token). | pacote servido sem `anticeg-pag-2026` nem `script.google.com`; 60+ testes sem rede; lint = main | reverter o merge |
| 4 | **Despachante** (Apps Script: 1 arquivo novo + 2 trocados; sem tocar acionadores) e PR do sync (já na main). | `p001_comparar`, 24 h sem sync cancelado por disparo do Apps Script | recolar os arquivos antigos |
| 5 | **Observação 24 h** com a administradora operando pelo novo fluxo: cada aprovação → RPC → planilha → sync → banco igual. | registro da função, `pagamento_decisoes`, divergências banco×planilha = 0 | passo 3 |
| 6 | **Rotação do token** (S6–S8 do #41): patch v2 no Apps Script, token novo no proxy, token antigo apagado. | sonda `apos-rotacao`: token público recusado, novo aceito | token anterior em `ANTICEG_TOKEN` |
| 7 | **Contas das staffs**: convite no Supabase Auth (cada pessoa define a própria senha, ≥12 caracteres) e `insert into admin_roles (user_id, papel) values (…, 'staff_pagamentos')` — uma por vez, com sua lista. Também incluir o COG da staff na lista de equipe do site (hoje `STAFF_COGS` / equipe extra) para o menu aparecer. | `meu_papel_admin()` = `staff_pagamentos`; `is_admin()` = false | `delete from admin_roles where papel='staff_pagamentos'` |
| 8 | **Aceite da staff** (abaixo). | checklist | desligar a conta |

## Aceite — a staff opera sem a administradora
Usar uma **demanda de teste criada por você** (joiner de teste, valor simbólico, item de teste na planilha), nunca pagamento real.
1. A staff entra no painel: vê só **Pagamentos** (menu), e as demais abas não aparecem. Tentativa direta de uma função de admin geral (ex.: `admin_buscar_joiners`) → "sem permissão".
2. Abre a demanda, confere comprovante, itens, valores e status → **Aprova** → no banco `pago`, itens marcados; na planilha TRUE (resposta do Apps Script conferida na tela); `pagamento_decisoes` mostra o e-mail e o horário da staff.
3. **Reabre** → volta para EM ANÁLISE (mensagem explica que a planilha não muda); **Rejeita** com motivo → desmarca só o que nenhuma outra demanda cobre; o aviso diz o que foi preservado.
4. Repetir a aprovação não duplica nada. Forçar falha (internet desligada na hora do confirmar) → a tela oferece reenviar só o pendente e nunca mostra sucesso.
5. Esperar o **sync seguinte**: banco = planilha, nenhuma decisão desfeita, nenhuma multa nova inesperada.
6. Registro: `admin_decisoes_pagamento` (admin geral) lista quem fez cada ação.

## Bloqueios que continuam (não resolvidos por este plano)
☆ **Token público do Apps Script**: só fecha no passo 6; até lá, a liberação para staffs NÃO acontece (decisão da dona).
☆ **Leitura de demandas/comprovantes aberta ao público** (J4b/J5): independente das staffs; a staff lê pelo mesmo caminho de hoje.
☆ **Sem MFA nas contas admin** (decisão A2): vale para staffs também; recomendar senhas longas.
