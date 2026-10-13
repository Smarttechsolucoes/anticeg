# Login de administrador com MFA — passo A1

O que existe neste passo:

- **Banco** (`A1_base_aplicar.sql`): tabela `public.admin_roles` (quem é admin) e função `public.is_admin()`, que só é verdadeira para um admin cadastrado **com sessão MFA (aal2)**. Ninguém lê ou escreve `admin_roles` pela API.
- **Site** (`src/adminAuth.js`, `src/AdminAuth.jsx`): tela de login (e-mail + senha), cadastro do app autenticador (QR Code) e confirmação do código. Usa um cliente Supabase separado; o resto do site não muda.
- **Interruptor**: `VITE_ADMIN_AUTH_OBRIGATORIA`. Desligado (padrão), o painel de admin continua abrindo como hoje e aparece só uma barra de aviso. Ligado (`true`), o painel só abre depois de senha + código + `is_admin()`.

Nada protege ainda as tabelas: isso vem nas próximas etapas, que passam a exigir `is_admin()` nas policies e funções.

## Ordem de uso

1. **Painel do Supabase → Authentication → Sign In / Providers → Email:** desligar *Allow new users to sign up* (ninguém cria conta sozinho).
2. **Authentication → Multi-Factor:** conferir que TOTP está habilitado (enroll e verify).
3. **Authentication → Users → Add user → Create new user:** e-mail + senha longa, marcando *Auto Confirm User*.
4. SQL Editor: rodar `A1_base_aplicar.sql`; depois `A1_verificar.sql`.
5. SQL Editor: editar o e-mail em `A1_registrar_admin.sql` e rodar.
6. Publicar este PR (interruptor desligado), abrir `/admin`, clicar em **Entrar com MFA** e fazer o primeiro acesso (senha → QR Code → código).
7. Só depois de funcionar para todas as contas admin: ligar `VITE_ADMIN_AUTH_OBRIGATORIA=true` na Vercel e refazer o deploy.

## Recuperação (sem e-mail configurado)

- **Perdeu o celular:** no SQL Editor, `delete from auth.mfa_factors where user_id = (select id from auth.users where email = '...');` e refaça o cadastro do app no próximo login.
- **Esqueceu a senha:** redefinir pelo painel do Supabase (Authentication → Users).
- **Admin saiu da equipe:** `delete from public.admin_roles where user_id = (select id from auth.users where email = '...');` e remover o usuário no painel.

Recomendado em seguida: cadastrar um segundo fator (segundo celular ou outro app) para não ficar trancada ao trocar de aparelho.
