# E-mail do Supabase Auth (ativação e recuperação de senha) usando o SendGrid que já existe

O Supabase Auth manda os e-mails de **código de ativação** e **redefinição de senha**. O envio padrão do Supabase só entrega para e-mails da equipe do projeto
e tem limite muito baixo, então a comunidade precisa de um SMTP próprio. O SendGrid atual pode ser reaproveitado pelo SMTP dele.

## 1. Conferir a conta (sem expor nenhuma chave)
No painel do SendGrid:
- **Settings > Account Details:** o plano (teste/pago/gratuito) e a situação da conta. O SendGrid encerrou o plano gratuito permanente em 2025; se a conta estiver só em teste vencido, o envio para.
- **Dashboard / Email Activity:** volume enviado e se há bloqueios ou "bounces".
- **Settings > Sender Authentication:** qual remetente está verificado. É o mesmo valor do segredo `SENDER_EMAIL`.
Limite a considerar: ~254 ativações + recuperações de senha da comunidade cabem com folga até no menor plano; o gargalo costuma ser a entrega, não o limite.

## 2. Remetente
O remetente do SMTP precisa ser **o mesmo remetente verificado** (`SENDER_EMAIL`). Atenção: se for um endereço `@gmail.com`, `@hotmail.com` ou `@yahoo.*`, o SendGrid pode bloquear e, mesmo quando envia, o Gmail e o Hotmail tendem a mandar para o spam por falta de autenticação do domínio. A solução definitiva é um domínio próprio (`.com.br` em torno de R$ 40/ano) autenticado no SendGrid; **o código do site não muda** quando isso acontecer.

## 3. Chave exclusiva e mínima
SendGrid > Settings > API Keys > Create API Key:
- Nome: `supabase-auth-smtp`
- **Restricted Access**, marcando **somente Mail Send > Mail Send**.
- Copie a chave uma única vez e cole direto no Supabase (passo 4). Não coloque em chat nem em arquivo.
(Assim, se essa chave vazar, ela só envia e-mail; não lê contatos nem altera a conta. A chave do site, `SENDGRID_API_KEY`, continua separada.)

## 4. Configurar no Supabase
Authentication > Emails > SMTP Settings (ou Project Settings > Authentication):
- Enable Custom SMTP: ligado
- Sender email: o mesmo remetente verificado · Sender name: `Anti CEG`
- Host: `smtp.sendgrid.net` · Port: `587` · Username: `apikey` · Password: a chave do passo 3
Depois, em Authentication > Rate Limits, suba o limite de e-mails por hora (o padrão com SMTP próprio é baixo, 30/h).
Em Authentication > Sign In / Providers > Email: confirmação de e-mail **ligada**; "Email OTP expiration" 600 s; "Email OTP length" 6.
Authentication > URL Configuration: Site URL `https://anticeg.vercel.app`; Redirect URLs `https://anticeg.vercel.app/**` (necessário para o link de redefinição de senha).

## 5. Modelos de e-mail (para o código aparecer)
Authentication > Emails > Templates. Em **Confirm signup** e em **Magic Link**, o corpo precisa conter `{{ .Token }}`. Exemplo:

```html
<h2>Seu código da Anti CEG</h2>
<p>Use este código para confirmar o seu e-mail:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:bold">{{ .Token }}</p>
<p>Ele vale por 10 minutos. Se não foi você, ignore este e-mail.</p>
```
No modelo **Reset Password**, mantenha o link `{{ .ConfirmationURL }}`.

## 6. Teste real com conta controlada (antes de liberar para a comunidade)
1. Aplicar o SQL do J1 (`J1_estrutura_aplicar.sql`).
2. Em um ambiente de teste (build local ou preview da Vercel com `VITE_JOINERS_AUTH=true`), entrar com o @ de uma pessoa de teste cujo cadastro tenha um e-mail que você controla.
3. Seguir o pop-up: o código deve chegar (confira também o spam), a senha é criada e a conta fica ativada.
4. Conferir no banco (SQL Editor) que `contas_joiner` ganhou 1 linha e que `joiners` não mudou.
5. Repetir com um e-mail diferente do cadastro: o pedido deve cair em `vinculos_pendentes` e a pessoa fica no modo limitado.
Só depois disso ligar `VITE_JOINERS_AUTH=true` na produção.
