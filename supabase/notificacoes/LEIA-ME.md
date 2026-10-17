# E-mail e push seguros: como implantar

**Problema:** as funções `send-email` e `send-push` aceitavam, de qualquer visitante, destinatário, assunto e corpo (e-mail) e qualquer inscrição, título e texto (push). Isso permite spam e phishing "assinados" pela Anti CEG.

**Solução:** duas funções novas, `email-evento` e `push-evento`, com nomes novos para a troca ser **sem interrupção**. CORS só limita navegadores amigáveis: **não é a proteção**. A proteção é a autorização de cada evento, feita no servidor (abaixo).

## O que cada evento exige (verificado no servidor, testado em `_shared/*.test.ts`)

| Evento | Quem pode acionar | O que o servidor confere | Destinatário |
|---|---|---|---|
| `comprovante_recebido` | joiner logada (só a **própria** demanda); enquanto `PERMITIR_COMPROVANTE_ANONIMO` não for `false`, também o modo "só @" | demanda existe, está `em_analise`, criada há ≤ 30 min, ainda não enviada | e-mail do **cadastro** da dona da demanda |
| `comprovante_recusado` | administradora ou serviço | demanda `rejeitado` | cadastro da dona |
| `report_resolvido` | administradora ou serviço | report `resolvido` | cadastro da dona |
| `lembrete_pagamento` | administradora ou serviço | há pendência; 1 por joiner por dia | cadastro da joiner |
| `novo_cadastro` | visitante/joiner/admin | pedido de cadastro **recente** (≤ 30 min) em `pre_cadastros`; 1 por @ | `ADMIN_NOTIFY_EMAIL` (configuração do servidor, nunca do pedido) |

Para todos: campos extras (`to_email`, `assunto`, `corpo`...) → **400**; texto é de modelos do sistema, com tudo escapado; **6 e-mails/hora por destinatário e 300/dia no total**; 1 envio por evento+registro. Push: só administradora ou serviço do sync.

## Ordem de implantação (cada passo é seguro e reversível; as funções antigas só fecham no fim)

1. **SQL** `N1_emails_enviados_aplicar.sql` e `N1_emails_enviados_verificar.sql` (tabela de controle de envios; só o servidor acessa).
2. **Segredos** (Supabase > Edge Functions > Secrets): os de hoje (`SENDGRID_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`, `VAPID_*`) **mais** `ADMIN_NOTIFY_EMAIL` (e-mail que recebe o aviso de cadastro novo) e, enquanto o SendGrid não estiver pronto, `EMAIL_MODO_SECO=true`.
3. **Implantar as 2 funções novas** (Verify JWT ligado):
   `supabase functions deploy email-evento push-evento --project-ref ghjfsmwwcfpfvrouyrka`
4. **Sondagem sem envio:** `node scripts/testar-notificacoes.mjs` → as funções novas devem dar 400/400/401/400/404 (ou 401)/401/(novo_cadastro 404). Nada é enviado.
5. **Merge do PR** (o site passa a chamar as funções novas).
6. **Conferir cada notificação legítima em MODO SECO** (nenhum e-mail sai; a resposta é `{"ok":true,"seco":true}` e o registro de "já enviado" é devolvido):
   ☆ enviar um comprovante de teste com conta controlada → a chamada `email-evento` responde 200 `seco`
   ☆ como administradora, recusar um comprovante de teste, resolver um report de teste, mandar um lembrete → todas respondem 200 `seco`
   ☆ criar um cadastro de teste → o aviso `novo_cadastro` responde 200 `seco`
   (veja as respostas na aba Rede do navegador; erros 401/403/409/422 apontam exatamente qual regra barrou)
7. **Só quando o SendGrid estiver reativado** (domínio `anticegs.com.br` verificado, remetente autenticado): trocar `SENDGRID_API_KEY`/`SENDER_EMAIL`, **remover `EMAIL_MODO_SECO`** e repetir um comprovante de teste de verdade (chega o e-mail).
8. **Fechar a brecha:** reimplantar as antigas, que viram "descontinuada" (410):
   `supabase functions deploy send-email send-push --project-ref ghjfsmwwcfpfvrouyrka`
   ⚠ Faça isso **depois** dos passos 5–7 e **depois de conferir os 4 Apps Scripts** (se algum deles chamar `send-email`, ele pára — revisão separada).
   Dica: se quiser fechar a brecha já, antes do SendGrid, pode fazer o passo 8 logo após o 6: o site novo já não usa as antigas, e o único efeito é nenhum e-mail sair até o passo 7 (hoje, sem SendGrid, nenhum sai mesmo).
9. No lançamento do acesso por senha: `PERMITIR_COMPROVANTE_ANONIMO=false` (o comprovante passa a exigir a conta da própria joiner).

## Como testar sem enviar nada real
`node scripts/testar-notificacoes.mjs` usa só a chave pública e dados inválidos de propósito. Para o ensaio, aponte para o projeto de teste: `$env:SONDAR_URL="https://REF.supabase.co"; $env:SONDAR_CHAVE="<anon do ensaio>"`.
Testes automáticos (sem rede): `node --test supabase/functions/_shared/notificacoes.test.ts supabase/functions/_shared/handlers.test.ts`.
