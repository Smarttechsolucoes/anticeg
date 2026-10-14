# Guia: montar o ambiente de ENSAIO (projeto Supabase separado da produção)

**Para quê:** testar J1–J4 (acesso das joiners, RLS), as Edge Functions e o site novo com **dados 100% fictícios**, num banco que não tem nenhuma ligação com a produção.
**Custo:** R$ 0. Só o plano **Free** do Supabase e da Vercel. Nada neste guia pede contratar algo. (Se o Supabase avisar que a sua organização já atingiu o limite de projetos gratuitos, **pare e me avise**: não é para pagar nada sem consultar você.)

## Regras que este ambiente segue
☆ Nenhum dado pessoal real, nenhuma senha, chave ou credencial da produção entra no ensaio.
☆ O ensaio usa **outro** projeto Supabase (outra URL, outro banco, outras chaves, outro Auth, outro Storage).
☆ O banco de ensaio é montado só com os arquivos do repositório (`supabase/laboratorio/`): COGs, pedidos e claims inventados, e-mails `@exemplo.com`.
☆ O site do ensaio (preview da Vercel) só consegue sair com as chaves do ensaio: o build **recusa** sair apontando para a produção (`scripts/checar-ambiente.mjs`).

---

## Passo 1 — Criar o projeto (5 min, no painel do Supabase)
1. supabase.com → **New project**. Organização: a mesma. Nome: `anticeg-ensaio`. Região: a mesma da produção. Plano: **Free**.
2. **Database Password**: gere uma senha NOVA (botão "Generate") e guarde no seu gerenciador de senhas. Não reutilize nenhuma senha da produção.
3. Quando o projeto abrir: **Project Settings → API**. Anote três coisas (ficam só com você):
   ☆ **Project URL** (`https://SEUREF.supabase.co`)
   ☆ **anon public** (chave pública)
   ☆ **service_role** (chave de serviço: **secreta**, só no seu computador, nunca no site, no GitHub ou na Vercel)

## Passo 2 — Gerar os SQLs e montar o banco de ensaio
No computador, na pasta do projeto (use a branch `ensaio/integrado`, que junta todos os PRs):
```
git checkout ensaio/integrado
node scripts/ensaio/gerar-sql.mjs
```
Isso cria 3 arquivos em `supabase/ensaio/gerado/` (não vão para o git). No **SQL Editor do projeto de ENSAIO** (confira o nome `anticeg-ensaio` no topo!):
1. Cole **`ENSAIO_1_base.sql`** inteiro → **Run**. Ele recusa rodar se o banco já tiver tabelas do site (proteção contra rodar na produção por engano). Resultado esperado: "Success". Isso cria o estado de **hoje** (mesmas travas da contenção C0) com dados fictícios, o login da administradora, o J1 (vínculo por `joiners.id`) e o J3.
2. Cole **`ENSAIO_3_storage.sql`** → Run (cria os buckets vazios).

## Passo 3 — Criar as contas fictícias e conferir "como é hoje"
No PowerShell, na pasta do projeto:
```
$env:ENSAIO_URL="https://SEUREF.supabase.co"
$env:ENSAIO_ANON_KEY="<anon do ensaio>"
$env:ENSAIO_SERVICE_KEY="<service_role do ensaio>"
node scripts/ensaio/testar-ensaio.mjs
```
O script **recusa rodar contra a produção** (confere URL e chaves). Ele cria no Auth do ensaio as contas fictícias (`admin.ensaio@exemplo.com`, `ana@exemplo.com`, `gabi@exemplo.com`, `sem.vinculo@exemplo.com`, senha `Ensaio-Fictício-2026!`), registra a administradora de ensaio e, como o J4 ainda não foi aplicado, mostra "Estado: HOJE" e **reproduz a vulnerabilidade atual** (visitante lê joiners).

## Passo 4 — Aplicar o "lançamento" (J4) no ensaio e testar a proteção
1. No SQL Editor do ensaio, cole **`ENSAIO_2_lancamento.sql`** → Run (J4-0, J4a, J4b, J4c-1, J4c-2, J4c-3 e a proteção do sync, na mesma ordem da produção).
2. Rode de novo `node scripts/ensaio/testar-ensaio.mjs`. Agora ele mostra "Estado: LANÇAMENTO" e confere, no Supabase **de verdade** (Auth + PostgREST + RPC): visitante sem acesso, acesso simples só com identidade mínima, cada joiner só vê o que é dela, campos travados (saldo, bloqueio, rastreio...), administradora vê tudo, conta sem vínculo não vê nada. **Esperado: `TODOS OS TESTES PASSARAM`.**

## Passo 5 — Edge Functions no ensaio
Instale o CLI uma vez: `npm i -g supabase` (ou use `npx supabase`). Depois:
```
npx supabase login
npx supabase link --project-ref SEUREF          # o ref do ENSAIO (o que aparece na URL)
npx supabase secrets set SENDGRID_API_KEY=SG.chave-falsa-de-ensaio SENDER_EMAIL=ensaio@exemplo.com SENDER_NAME="Anti CEG Ensaio" ADMIN_NOTIFY_EMAIL=seu-email@dominio.com EMAIL_MODO_SECO=true
npx supabase functions deploy email-evento push-evento login-joiner recuperar-senha-joiner
```
☆ `EMAIL_MODO_SECO=true`: as funções validam tudo mas **não enviam e-mail nenhum**. A chave do SendGrid é de mentira de propósito.
☆ **Não** configure `VAPID_*` reais nem `SENDGRID_API_KEY` real aqui.
☆ Rode `node scripts/ensaio/testar-ensaio.mjs` outra vez: agora ele também confere as funções (formato antigo = 400, evento de admin sem login = 401, joiner = 403, demanda de outra joiner = 403, push só admin, login por @ devolve só tokens).
☆ Sondagem extra, só com a chave pública: `$env:SONDAR_URL="https://SEUREF.supabase.co"; $env:SONDAR_CHAVE="<anon do ensaio>"; node scripts/testar-notificacoes.mjs`.

## Passo 6 — Auth do ensaio (painel do projeto de ensaio)
☆ **Authentication → Providers → Email**: ligado. "Confirm email" ligado. Tamanho mínimo da senha: 8.
☆ **Authentication → URL Configuration**: Site URL = a URL do preview da Vercel (passo 7); adicione-a também em Redirect URLs.
☆ E-mails: o SMTP padrão do Supabase só entrega para endereços da **sua equipe** (Organization → Team). Para testar a ativação por código de verdade, use **o seu próprio e-mail** como e-mail de uma joiner fictícia (no SQL Editor do ensaio: `update public.joiners set email = 'seu-email+ana@gmail.com' where cog = 'ana';`, e crie a conta pelo site). **Não use e-mails de joiners reais, nunca.**

## Passo 7 — Preview da Vercel isolado (painel da Vercel)
1. Projeto da Vercel → **Settings → Environment Variables**. Adicione estas três, marcando **somente "Preview"** (desmarque Production e Development):
   ☆ `VITE_SUPABASE_URL` = URL do ensaio
   ☆ `VITE_SUPABASE_ANON_KEY` = chave **anon** do ensaio (a pública; **nunca** a service_role)
   ☆ `VITE_JOINERS_AUTH` = `true`  (liga o novo acesso só no preview)
2. **Não toque** nas variáveis de Production (a produção continua exatamente como está, sem nenhuma variável nova).
3. **Settings → Deployment Protection**: ligue "Vercel Authentication" para previews (só você acessa).
4. Faça um deploy de preview da branch `ensaio/integrado`. O build mostra `✔ Build de ensaio aponta para SEUREF.supabase.co (não é a produção)` e o site abre com a faixa laranja **"AMBIENTE DE ENSAIO · dados fictícios"**.
⚠ Depois que o PR de isolamento for mesclado, **previews sem essas variáveis deixam de construir** (de propósito). Antes disso, qualquer preview ainda usa a produção: **não use previews para testar até o PR #26 ser mesclado e as variáveis estarem configuradas**.
⚠ Páginas estáticas `public/links.html` e `public/mercari-embed/index.html` têm a URL de produção fixa e **não** fazem parte do ensaio.

## Passo 8 — Testes à mão no preview (checklist)
Entre no preview com as contas fictícias. Marque:
- [ ] Entrar só com `@ana` → acesso limitado: masterlist/perfil pedem senha; nenhum dado pessoal na tela.
- [ ] Pop-up de ativação: pedir código (vai para o **seu** e-mail de teste), criar senha, entrar.
- [ ] Login por `@ana` + senha (função `login-joiner`); senha errada dá a mesma mensagem de sempre.
- [ ] "Esqueci a senha" (e-mail de teste) → link → nova senha.
- [ ] Ana vê só a masterlist/pagamentos/claims/envios dela; edita o próprio endereço; não consegue mexer em saldo.
- [ ] Cadastro novo em `/primeiro-acesso` (use um @ inventado): entra em acesso limitado; o admin vê o pedido.
- [ ] Administradora de ensaio (`admin.ensaio@exemplo.com`) entra no painel e vê tudo.
- [ ] Enviar comprovante de teste: a chamada `email-evento` responde `{"ok":true,"seco":true}` (aba Rede do navegador).

## Passo 9 — Storage
☆ O ensaio cria os buckets, mas **não copia as políticas de Storage da produção** (B5/B6): para o teste de comprovantes privados (J5, ainda não implementado) elas serão acrescentadas ao ensaio quando o J5 existir.
☆ Para ver o que está público hoje: `curl https://SEUREF.supabase.co/storage/v1/object/public/comprovantes/arquivo-que-nao-existe` (404 = bucket público respondendo).

## Passo 10 — Limpeza
☆ Para recomeçar do zero: **Project Settings → General → Delete project** e repita o guia (o projeto é descartável).
☆ Para pausar sem apagar: **Project Settings → General → Pause project** (o plano Free já pausa após 1 semana sem uso).
☆ Nunca copie nada do ensaio para a produção: a produção só recebe os SQLs `*_aplicar.sql` revisados, rodados por você.

## O que o ensaio NÃO substitui
☆ O dia do lançamento continua pedindo a sua autorização, a conferência do SMTP/SendGrid reais e a ordem de implantação por PR (relatório de cada entrega).
☆ GitHub Actions do sync e os Apps Scripts continuam apontando para a produção: **não** troque os segredos deles para o ensaio.
