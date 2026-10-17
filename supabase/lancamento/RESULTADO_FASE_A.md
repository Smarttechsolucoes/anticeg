# Resultado da Fase A — executada em produção em 17/10/2026 (15:19–15:23 UTC)

Autorizada pela dona; critérios de parada de `FASE_A_PACOTE.md` respeitados. Não foram ativados login geral nem J4b–J5, a PR #38 não foi mesclada, nenhum e-mail ou push foi enviado, nenhuma conta, claim, pagamento ou linha da MASTERLIST foi alterada.

## Pré-condições
☆ Nenhum sync em andamento: o agendado das 14:52 UTC terminou (sucesso, 15:18:19) antes da primeira alteração; zero execuções ativas na checagem seguinte.
☆ Backup recuperável: backup físico diário do Supabase de 17/10 11:00 UTC (COMPLETED; PITR desligado). Anteriores: 16/10, 15/10, 14/10.
☆ Baseline imediatamente antes: permissões e dados idênticos à baseline registrada (impressões em `q_perm.sql` e `q_fp.sql`).

## O que entrou em produção
| Passo | Resultado | Verificador |
|---|---|---|
| A1 **N1** (`emails_enviados`) | aplicado | `true, false, true, 0, 1` (existe com RLS; anon/authenticated sem acesso; service_role com acesso; 0 envios; 1 linha de estado) |
| A2 **J4-0** (policy `admin_tudo`) | aplicado | 37 tabelas com `admin_tudo`; 0 fora do padrão; authenticated NÃO ganhou UPDATE de tabela inteira em masterlist/pagamento_demandas/multas_pagas; 4 linhas de estado |
| A3 **J4c-4e** (`ceg_resumo`, `ceg_vencimentos`, `ceg_itens`) | aplicado | 3 funções seguras (SECURITY DEFINER, search_path vazio); visitante NÃO executa `ceg_itens`; visitante executa as duas públicas |
| A5 segredo | `EMAIL_MODO_SECO=true` | nomes de segredos listados, sem valores |
| A6 funções | `email-evento`, `push-evento`, `comprovante-upload`, `comprovante-url` (v1, ACTIVE, JWT exigido) | `supabase functions list`; as 3 de login e as antigas `send-email`/`send-push` seguem como estavam |
☆ **Segredos NÃO criados, de propósito:** `ALLOWED_ORIGINS` (o padrão das funções já inclui `https://anticeg.vercel.app`; defini-lo tiraria os `localhost` das 3 funções de login já publicadas) e `ADMIN_NOTIFY_EMAIL` (opcional; falta o endereço desejado). Com `EMAIL_MODO_SECO=true` nada é enviado.

## Comparação com a baseline (A4)
☆ **Idênticos:** impressão de SELECT/INSERT/UPDATE de visitante e logado (tabela e coluna) `b16fbeba…`; DELETE anon = 12 tabelas e authenticated = 13; ACL de TODAS as funções que já existiam (`b4ad6e48…`); ACL das funções de pagamento (R1/R1.1/prune); gatilhos da masterlist; contagens masterlist/claims/demandas/multas; **impressão dos dados** (6.415 linhas, donos, códigos, pagamentos, 114 claims, 2.153 multas, demandas, arquivo 0, maior id 8.358).
☆ **Diferenças esperadas (todas aditivas):** `service_role` ganhou a tabela nova `emails_enviados` (sem ela, as concessões do service_role são idênticas à baseline: `4c5679b7…`); entraram 3 funções novas na ACL; entraram as 37 policies `admin_tudo`.
☆ **AUD_02:** 95 → 96 linhas (a nova `emails_enviados`: visitante sem nenhum acesso). Nenhuma linha por tabela mudou de situação para o visitante. A linha-resumo "tabelas SEM acesso efetivo" caiu de 39 para 37: quatro tabelas que tinham RLS e nenhuma policy (`antiv_badges`, `notifications`, `sugestoes_tabela`, `tabela_precos`) ganharam a `admin_tudo` (válida só para `authenticated` + `is_admin()`), e a tabela nova `emails_enviados` entrou. Todas as linhas por tabela do AUD_02 para o visitante são idênticas à baseline.
☆ **Leitura do site de hoje:** visitante lê `masterlist`, `claims`, `pushes`, `cal_eventos` (HTTP 200/206); `ceg_resumo` (RPC pública nova) devolve a lista; `ceg_itens` como visitante dá 401; o site `anticeg.vercel.app` responde 200.

## Sondagem das funções (A7; chave pública, dados inválidos, nada enviado)
☆ `email-evento`: formato antigo → 400; campo extra → 400; evento de administração sem login → 401; evento inexistente → 400; id de comprovante inválido (-1) → 400; id válido inexistente → 404; cadastro novo de @ inexistente → 404. `push-evento` sem login → 401. `comprovante-upload` e `comprovante-url` sem login → 401. `emails_enviados`: 0 linhas (nada enviado nem registrado).
☆ **Antigas ainda abertas:** `send-email` e `send-push` continuam respondendo 400 a pedidos públicos (isto é, continuam aceitando pedidos de qualquer pessoa); só fecham no lançamento.

## Verificadores dos blocos anteriores (reexecutados depois da Fase A)
☆ S1, R1 e R1.1: todos como antes. **N0:** tudo igual, **exceto a linha "policies"** (esperado 0, agora 1): é a `admin_tudo` que o J4-0 criou também em `notifications`. A tabela segue **fechada**: visitante e logado continuam SEM privilégio algum (`false`/`false`), e a policy só vale para quem já tem privilégio. Não revertido; registrado como diferença conhecida (o N0 será reescrito pelo J4c-4c no lançamento).

## Pendências da Fase A
☆ **Primeiro sync depois da Fase A** (próximo agendado, 00:00 UTC): conferir que termina verde e que `q_fp.sql` continua idêntico. Não disparei sync manual.
☆ Revisão de que `ALLOWED_ORIGINS`/`ADMIN_NOTIFY_EMAIL` não são necessários antes do lançamento (decisão sua sobre o e-mail).
