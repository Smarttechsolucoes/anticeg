# Modelos de e-mail do Supabase Auth (português)

Colar no painel do projeto, em **Authentication → Emails → Templates**. Cada projeto (ensaio e produção) tem os seus próprios modelos: colar primeiro no **ensaio**.

| Modelo no Supabase | Arquivo | Assunto |
|---|---|---|
| Confirm signup | `codigo-ativacao.html` | Seu código de ativação da Anti CEG |
| Magic Link | `codigo-ativacao.html` | Seu código de ativação da Anti CEG |
| Reset Password | `recuperar-senha.html` | Redefinir sua senha da Anti CEG |

☆ Cole só o HTML (o comentário `<!-- ... -->` do topo pode ficar ou sair).
☆ Ativação usa **código de 6 dígitos** (`{{ .Token }}`), validade 10 min: Authentication → Sign In / Providers → Email → "Email OTP expiration" 600 e "Email OTP length" 6.
☆ Recuperação usa **link** (`{{ .ConfirmationURL }}`), como o site faz hoje. O link só abre se o endereço do site estiver em Authentication → URL Configuration → Redirect URLs.
☆ Os outros modelos (Invite, Change Email, Reauthentication) não são usados pelo login das joiners: não precisam mudar.
☆ Nenhum arquivo daqui é executado: são só textos para colar. Publicar o login continua dependendo de `VITE_JOINERS_AUTH`.
