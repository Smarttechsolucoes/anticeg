# Login de administrador (e-mail e senha)

O que existe:

- **Banco** (`A1_base_aplicar.sql`, `A2_senha_apenas_aplicar.sql`): tabela `public.admin_roles` (quem é admin) e função `public.is_admin()`, verdadeira só para uma conta cadastrada em `admin_roles` com sessão de login. Ninguém lê ou escreve `admin_roles` pela API.
- **Site** (`src/adminAuth.js`, `src/AdminAuth.jsx`): tela de entrada com e-mail e senha dentro da aba Admin e botão "Trocar senha". Usa um cliente Supabase separado; o resto do site não muda. O PIN antigo deixa de ser pedido.
- **Interruptor** `VITE_ADMIN_AUTH_OBRIGATORIA`: por padrão está ligado (o painel só abre depois do login). Para desligar em emergência, defina `false` na Vercel e refaça o deploy (volta o PIN antigo).

Nada protege ainda as tabelas: isso vem nas próximas etapas, que passam a exigir `is_admin()` nas policies e funções.

## Ordem de uso

1. **Painel do Supabase → Authentication → Sign In / Providers → Email:** desligar *Allow new users to sign up*.
2. **Authentication → Users → Add user → Create new user:** e-mail + senha longa, marcando *Auto Confirm User* (uma conta por pessoa).
3. SQL Editor: `A1_base_aplicar.sql`, `A1_verificar.sql`, `A1_registrar_admins.sql` (com os e-mails reais, sem gravar no repositório, que é público).
4. SQL Editor: `A2_senha_apenas_aplicar.sql` e `A2_senha_apenas_verificar.sql` (a função deixa de exigir MFA). **Rode antes de publicar o site.**
5. Publicar o site. Cada pessoa abre `/admin`, entra com e-mail e senha e usa **Trocar senha** para definir a própria.

## Recuperação (sem e-mail configurado)

- **Esqueceu a senha:** redefinir pelo painel do Supabase (Authentication → Users).
- **Admin saiu da equipe:** `delete from public.admin_roles where user_id = (select id from auth.users where email = '...');` e remover o usuário no painel.

## Observação de segurança

O acesso é só por senha, por decisão da administração. Use senha longa e única (gerenciador de senhas) e nunca compartilhe a conta. O Supabase limita tentativas de login. Se isso mudar, `A2_reverter_protegido.sql` volta a exigir verificação em duas etapas na função.
