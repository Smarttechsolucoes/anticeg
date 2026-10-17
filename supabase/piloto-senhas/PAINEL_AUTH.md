# PILOTO DE SENHAS — Supabase Auth (passo a passo do painel)

Painel: https://supabase.com/dashboard/project/ghjfsmwwcfpfvrouyrka → **Authentication**. Os nomes dos menus podem variar um pouco; os valores é que importam.
Estado lido hoje pela API pública (somente leitura): e-mail ligado ✔ · confirmação de e-mail ligada ✔ · telefone/SMS desligado ✔ · nenhum login externo ligado ✔ · **cadastro público LIGADO ✖ (precisa desligar)**. SMTP, validade do código, URLs de redirecionamento e limites **não aparecem na API pública**: só você vê no painel.

## Faça nesta ordem (uma passada, ~10 minutos)

### 1. Desligar o cadastro público  ← único item que ainda está errado
**Sign In / Providers → User Signups → "Allow new users to sign up" = DESLIGADO.** Salvar.
☆ **É seguro porque a função foi corrigida** (`pedir-codigo-joiner` cria a conta pelo fluxo administrativo, já confirmada e sem senha, e pede o código só para conta existente). Sem essa correção o envio do código FALHARIA com o cadastro desligado (código-fonte do Auth: conta não confirmada passa pelo `Signup`, que é recusado). A análise completa está em `ANALISE_EMAIL_CONFIRMADO.md`.
☆ Por quê desligar: hoje qualquer pessoa pode criar conta no Auth e disparar e-mails para qualquer endereço. No piloto a conta é criada **só** pela função, para joiner real e liberada.
☆ Não afeta o que existe: o site atual não usa cadastro público (conferi o código); o login da administradora é por senha; contas já existentes, inclusive a da Leticia, não mudam.
☆ **Ordem:** pode desligar agora ou logo antes da Etapa 4; o `testar-funcoes.mjs` só dá "tudo certo" com ele desligado.
☆ Se na Etapa 7 o código **não chegar** para a primeira pessoa: **não** religue por reflexo. Primeiro rode o `P0`, veja os logs da função `pedir-codigo-joiner` e me avise; religar o cadastro só serve para isolar a causa e eu te digo se vale.

### 2. Código de e-mail: 6 dígitos, 10 minutos
**Sign In / Providers → Email** (abrir o provedor "Email"):
☆ **Confirm email** = LIGADO (já está).
☆ **Email OTP Length** = **6**.
☆ **Email OTP Expiration** = **600** (segundos). O e-mail diz "vale por 10 minutos"; com outro valor o texto ficaria falso.
Salvar.

### 3. URLs
**URL Configuration:**
☆ **Site URL** = `https://anticeg.vercel.app`
☆ **Redirect URLs** = incluir `https://anticeg.vercel.app/**` (se já existir, deixe). É o que permite o link de recuperação abrir em `/piloto-senha/`. Sem isso o Supabase manda o link para a página inicial e o "esqueci a senha" não funciona.

### 4. Modelos de e-mail (3 colagens, 2 arquivos)
**Emails → Templates.** Em cada um: **Subject** (assunto) e **Message body** (abrir o arquivo no Bloco de Notas → Ctrl+A → Ctrl+C → colar no campo do corpo, no modo HTML/"Source").
| Modelo no painel | Assunto | Corpo (arquivo da pasta `supabase/piloto-senhas/auth/`) |
|---|---|---|
| **Confirm signup** | `Seu código de ativação da Anti CEG` | `modelo-1-codigo-ativacao.html` |
| **Magic Link** | `Seu código de ativação da Anti CEG` | `modelo-1-codigo-ativacao.html` (o mesmo arquivo) |
| **Reset Password** | `Redefinir sua senha da Anti CEG` | `modelo-2-redefinir-senha.html` |
☆ Por que o mesmo texto em dois modelos: conta nova chega por "Confirm signup"; conta que já existe (como a da Leticia, no futuro) chega por "Magic Link". Os dois precisam mostrar o código (`{{ .Token }}`).
☆ Não mexa nos outros modelos (Invite, Change Email, Reauthentication): o piloto não usa.
☆ Os modelos já foram revisados: português, sem imagens nem links externos, um único código no corpo, link de redefinição com botão e endereço por extenso.

### 5. Envio de e-mail (SMTP) e limites
**Emails → SMTP Settings:** confirme **"Enable custom SMTP" ligado** (SendGrid) e que o remetente é um endereço do domínio autenticado (anticegs.com.br). Se estiver desligado, o Supabase usa o envio padrão, que só permite poucos e-mails por hora e **só para endereços da equipe**: o piloto não funcionaria.
**Rate Limits:** "Rate limit for sending emails" **≥ 30 por hora** (com SMTP próprio o padrão costuma ser 30; confirme).

## Depois (eu confiro sozinho, sem você)
Me avise "Auth feito". Eu rodo a leitura pública de novo e confirmo que o cadastro público aparece como desligado. O restante só se prova no primeiro e-mail real (Etapa 7): chegou? veio com 6 dígitos? o texto diz 10 minutos? o link de recuperação abre em `/piloto-senha/`?

## Quando a Leticia (ID 42) for convidada
A conta Auth dela já existe e está confirmada, **sem vínculo**. Nada neste passo a toca. Quando ela for convidada, o código chega pelo modelo **Magic Link** (por isso ele precisa estar configurado) e ela cria a senha; o vínculo `ID 42 = @lyrichangbin` só acontece se o e-mail confirmado for igual ao do cadastro dela.
