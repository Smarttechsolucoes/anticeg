# E-mail e push seguros: como implantar

Problema: as funções `send-email` e `send-push` aceitavam, de qualquer visitante, destinatário, assunto e corpo (e-mail) e qualquer inscrição, título e texto (push).
Solução: duas funções novas, `email-evento` e `push-evento`, com nomes novos para a troca ser **sem interrupção**.

- **email-evento**: o site informa só o tipo do evento e o id do registro. O servidor confere no banco, descobre o destinatário no cadastro e monta a mensagem. Eventos: `comprovante_recebido` (a própria joiner pode acionar, uma vez por demanda, até 30 min depois), `comprovante_recusado`, `report_resolvido`, `lembrete_pagamento` (só administradora). Limites: 6 e-mails por destinatário por hora e 300 por dia no total.
- **push-evento**: só a administradora logada ou o serviço do sync (chave de serviço). Endpoint só de serviços de push conhecidos, textos limitados, URL só do próprio site.

## Ordem (cada passo é seguro e reversível)

1. **SQL** `N1_emails_enviados_aplicar.sql` e `N1_emails_enviados_verificar.sql` (tabela de controle de envios; só o servidor acessa).
2. **Implantar as 2 funções novas** (os segredos `SENDGRID_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`, `VAPID_*` são os mesmos de hoje):
   `supabase functions deploy email-evento push-evento --project-ref ghjfsmwwcfpfvrouyrka`
   (ou pelo painel: Edge Functions > Deploy a new function, colando `index.ts` e a pasta `_shared`). Deixe **Verify JWT ligado**.
3. **Publicar o site** (merge do PR). Ele passa a chamar as funções novas. Conferir: enviar um comprovante de teste (chega o e-mail "Comprovante recebido") e, como administradora, usar um push de teste.
4. **Fechar a brecha:** reimplantar as funções antigas, que agora são apenas um aviso "descontinuada" (410):
   `supabase functions deploy send-email send-push --project-ref ghjfsmwwcfpfvrouyrka`
   Depois disso ninguém mais envia e-mail ou push arbitrário.
5. O sync da planilha (`scripts/sync-masterlist.js`) já passa a chamar `push-evento` com a chave de serviço.

## Como testar sem enviar nada real

Pela API, sem login, mande para `email-evento` os formatos antigos (`to_email`, `assunto`, `corpo`): a resposta deve ser **400**. Um evento de administração sem login deve dar **401**. Pedir `push-evento` sem login deve dar **401**.
