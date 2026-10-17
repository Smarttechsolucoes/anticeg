# PILOTO DE SENHAS — 5 JOINERS (checklist de implantação e testes)

**Objetivo:** testar SOMENTE o fluxo de senha — código de 6 dígitos por e-mail, criar senha, login, logout, trocar senha e recuperar senha — com cinco joiners, antes do lançamento completo da Fase 2.
**Quem:** al.melo (ID 2) · nicknowsaurus (ID 272) · lyrichangbin (ID 42) · gnabjubs (ID 187751) · ttalilitinha (ID 7213).
**Regra de ouro:** uma etapa por vez; só passa para a seguinte quando o "resultado esperado" da anterior estiver confirmado. Nada é executado sem a sua autorização.

## 1. O que o piloto muda e o que NÃO muda
| Muda (só acrescenta) | NÃO muda |
|---|---|
| 4 SQLs aditivos (J1, J3, J4a, J4d): tabelas e funções **novas** de contas | nenhuma permissão, RLS ou política do que já existe (provado no teste e conferido na produção pelo `P0b`) |
| uma lista de 5 joiners autorizadas, só no banco (`ativacao_ondas`) | o site continua igual para todo mundo (flag `VITE_JOINERS_AUTH` desligada); o que hoje está aberto continua como está até a Fase 2 |
| 3 funções de acesso (`pedir-codigo-joiner`, `login-joiner`, `recuperar-senha-joiner`) | NÃO são publicadas: comprovantes, e-mails de eventos, push, `planilha-acao` |
| uma página nova e escondida `/piloto-senha/` com código próprio (não carrega o site) | pedidos, pagamentos, comprovantes, alterações cadastrais e planilha: a página não os alcança (teste de navegador prova que só fala com 5 endpoints) |
A conta de uma das cinco tem o **mesmo alcance de um visitante** (o teste confere linha a linha em 53 tabelas/visões). A sessão do piloto fica numa chave própria do navegador (`anticeg-piloto-auth`): o site principal nem a enxerga.

## 2. Como as cinco são autorizadas (e por que ninguém mais entra)
☆ A lista existe **só no banco**: `ativacao_ondas` (IDs 2, 42, 272, 7213, 187751) + `ativacao_estado.onda_liberada = 1`. O navegador e as funções **não têm a lista**: a cada pedido o servidor pergunta ao banco (`ativacao_liberada`).
☆ **Fora da lista:** o servidor responde igual (`{ok:true}`), **não cria conta no Auth e não envia e-mail**; se alguém tivesse uma conta, `ativar_minha_conta` responderia "aguardando liberação" e não vincularia nada. Cadastro público do Auth fica desligado.
☆ **Vínculo seguro:** a conta é ligada ao `joiners.id` (índices únicos: uma conta por joiner e uma joiner por conta). Só vincula se o e-mail confirmado for **igual** ao do cadastro e **único** entre as joiners. Digitar o @ de outra pessoa gera "pendente", nunca vínculo.
☆ **Nicolle:** o cadastro antigo (`id 12`, `biachinicks`) já foi excluído; o e-mail dela está em um único cadastro (`id 272`). O `P0` e o `P1` **recusam** seguir se o id 12 voltar a existir ou se qualquer outro cadastro dividir o e-mail de uma das cinco.
☆ **Contas já ativadas e contas do Auth já existentes:** o `P0` mostra quantas existem e se alguma tem o e-mail das cinco; os scripts não criam, alteram nem apagam conta, senha ou vínculo (conferido por impressão dentro da transação).

## 3. ORDEM DE PUBLICAÇÃO (e por quê)
1. **Leituras** (nada muda): backup, `P0`, `P0b`. Define se o piloto pode seguir.
2. **Pré-requisito do sync** (e-mail): para o sync não zerar e-mails antes da ativação.
3. **Banco**: J1 → J3 → J4a → J4d → `P1` (lista das cinco). Aditivo e invisível para o site atual.
4. **Funções**: as 3 de acesso. Sem a lista (passo 3) elas não enviam nada.
5. **Auth (painel)**: OTP de 6 dígitos, modelos de e-mail, redirecionamento, cadastro público desligado, limite de e-mails.
6. **Site**: a página `/piloto-senha/`. **Por último**: só ela torna o fluxo alcançável; antes dela ninguém consegue testar nada.
7. **Teste com as cinco**, uma de cada vez.
**Reversão (ordem inversa):** (a) tirar a página (Instant Rollback do site) · (b) `P1_desativar.sql` (para códigos e ativações novas) · (c) *Ban user* no Auth, se quiser travar também o login · (d) funções podem ficar publicadas (sem lista ninguém recebe código) · (e) J1/J3/J4a/J4d **não se revertem** (aditivos). Nada disso apaga conta, senha ou vínculo.

## 4. ETAPAS (uma por vez)

### Etapa 1 — Leituras e backup (somente leitura; nada é publicado) ← **PRIMEIRO PASSO**
☆ Backup: Supabase → Database → Backups (confirme o plano) **e** exporte CSV da tabela `joiners` (guarde fora do repositório).
☆ SQL Editor, produção, **uma consulta por vez**: `supabase/piloto-senhas/P0_preflight_leitura.sql` e depois `P0b_foto_permissoes_leitura.sql`. Guarde os dois resultados (o código de conferência do P0b será comparado nas etapas 3 e 4).
☆ **Esperado no P0:** nenhuma linha com `situacao = FALHA`; os 5 IDs "confere"; `cadastro antigo biachinicks = 0`; "qualquer outra joiner com o e-mail de uma das cinco = 0"; "joiners com ESTE e-mail = 1" e "ESTE cog = 1" para cada uma; contas do Auth com o e-mail das cinco = 0 (se > 0 aparece ATENÇÃO: **pare** e me envie).
☆ **Se aparecer FALHA:** não avance; a linha diz qual das cinco e por quê. Qualquer uma que falhe sai do piloto.
☆ Reversão: nada a reverter.

### Etapa 2 — Pré-requisito: correção do sync de e-mail
☆ Branch `fix/sync-preservar-email` (commit `7376d94`): célula EMAIL vazia nunca apaga e-mail do banco; quem tem conta ativada não tem o e-mail trocado. Testes: 7 de 7.
☆ Passos: autorizar o `git push` → PR → merge (o sync do GitHub passa a usar na próxima execução). Rodar o workflow manualmente (Actions → Sync Masterlist → Run workflow).
☆ **Esperado:** execução verde; no log a linha `✓ Joiners: N sincronizados · 0 erros · M e-mail(s) existente(s) preservado(s)`; a consulta `select count(*) filter (where email is null or email = '') from public.joiners;` **não aumenta** depois do sync; o P0 continua sem FALHA.
☆ Reversão: reverter o commit no GitHub.

### Etapa 3 — Banco: J1 → J3 → J4a → J4d → P1
☆ Arquivos, nesta ordem (SQL Editor, **um por vez**, cada um seguido do seu `_verificar`): `supabase/joiners-auth/J1_estrutura_aplicar.sql` + `J1_verificar.sql` → `J3_tentativas_aplicar.sql` + `J3_tentativas_verificar.sql` → `J4a_publico_aplicar.sql` + `J4a_publico_verificar.sql` → `J4d_ondas_aplicar.sql` + `J4d_ondas_verificar.sql`.
☆ Depois do J4d: rodar o **`P0b`** — o código de conferência tem de ser **idêntico** ao da Etapa 1. Rodar o `P0` outra vez (sem FALHA).
☆ **Só então**: `P1_liberar_cinco_aplicar.sql` (aborta sozinho se algo não bater) e `P1_verificar.sql`.
☆ **Esperado no P1_verificar:** lista = 5 (`2, 42, 272, 7213, 187751`); onda liberada = 1; liberar_todas = false; liberadas = 5; liberadas fora das cinco = 0; contas vinculadas às cinco = "(nenhuma ainda)"; os 3 últimos itens = `false`. `P0b` de novo: idêntico.
☆ **Interromper se:** qualquer script abortar ("Nada foi alterado" é o comportamento correto: leia a mensagem), `P0b` diferente, ou o `P1_verificar` fora do esperado.
☆ Reversão: `P1_desativar.sql` (pausa). J1/J3/J4a/J4d ficam (aditivos).

### Etapa 4 — Funções de acesso (3) e segredos
☆ No seu computador, na pasta do branch `piloto/banco-e-docs` (uma vez: `npx supabase login` e `npx supabase link --project-ref ghjfsmwwcfpfvrouyrka`): `npx supabase functions deploy pedir-codigo-joiner login-joiner recuperar-senha-joiner`.
☆ Segredos: `npx supabase secrets set ALLOWED_ORIGINS=https://anticeg.vercel.app SITE_URL=https://anticeg.vercel.app/piloto-senha` (só a função de recuperação usa `SITE_URL`; no lançamento da Fase 2 ele volta para `https://anticeg.vercel.app`).
☆ **Teste sem efeito** (`node supabase/piloto-senhas/testar-funcoes.mjs`, só com a chave pública; equivale aos três `curl` abaixo): (a) `pedir-codigo-joiner` com `{"cog":"naoexiste_xyz","email":"x@exemplo.com"}` → `{"ok":true}` (sem e-mail, sem conta); (b) `login-joiner` com `{"cog":"naoexiste_xyz","senha":"qualquer"}` → HTTP 401 `@ ou senha incorretos.`; (c) `recuperar-senha-joiner` com `{"cog":"naoexiste_xyz"}` → `{"ok":true,...}`. Confirme que **nenhum usuário novo** apareceu em Authentication → Users.
☆ Reversão: pausar com `P1_desativar.sql` já impede qualquer envio; as funções podem ficar.

### Etapa 5 — Supabase Auth (painel)
☆ **Passo a passo completo e modelos prontos para colar: `PAINEL_AUTH.md` e a pasta `auth/`.** Leitura pública de hoje: o cadastro público de usuários está **LIGADO** e precisa ser **DESLIGADO** (Sign In / Providers → User Signups). Email OTP: **comprimento 6**, validade **600 s**.
☆ Authentication → Emails → Templates: `templates-email/codigo-ativacao.html` em **Confirm signup** e em **Magic Link**; `recuperar-senha.html` em **Reset Password**.
☆ Authentication → URL Configuration: Site URL `https://anticeg.vercel.app` e Redirect URLs com `https://anticeg.vercel.app/**`.
☆ Limite de e-mails por hora acima de 30 e SMTP personalizado (SendGrid) ativo. **Esperado:** nada a mais.
☆ Depois de publicar as funções (Etapa 4): `node supabase/piloto-senhas/testar-funcoes.mjs` (teste de fumaça só com a chave pública; confere funções, CORS, respostas neutras e cadastro público desligado).
☆ **Cadastro público desligado é seguro com esta versão da função:** ela cria a conta pelo fluxo administrativo, já confirmada e **sem senha** (a senha aleatória do Auth ninguém conhece), e o código é pedido só para conta existente. Sem isso o envio falharia (código-fonte do Auth). Análise e garantias: `ANALISE_EMAIL_CONFIRMADO.md`.
☆ **Risco que resta (R1):** só o primeiro e-mail real prova na hospedagem. Se não chegar, **pare** e me avise (diagnóstico: P0, logs da função `pedir-codigo-joiner`, SendGrid); não religue o cadastro por conta própria.

### Etapa 6 — Site: página `/piloto-senha/`
☆ Branch `feat/piloto-senhas-site` (commit `75232af`): autorizar `git push` → PR → merge → deploy da Vercel. O site principal não muda (a flag segue desligada; a página tem código e entrada próprios).
☆ **Esperado:** `https://anticeg.vercel.app/piloto-senha/` abre o "Teste de senha"; `curl -s https://anticeg.vercel.app/ | grep -c piloto` = 0 (o site principal não referencia a página); o restante do site abre normalmente.
☆ Reversão: *Instant Rollback* da Vercel.

### Etapa 7 — Teste com as cinco (uma pessoa por vez)
Para cada pessoa, no celular ou computador dela, **em janela anônima**:
1. `/piloto-senha/` → "Primeiro acesso": @ (sem o @) e o e-mail do cadastro → **Enviar código** (mensagem neutra).
2. O e-mail chega em até 5 minutos (veja o spam): digitar o código de 6 dígitos + criar a senha (mínimo 8) → **Ativar conta** → "✓ Conta ativa: @…".
3. **Sair** → **Entrar** com @ e senha → "Conta ativa".
4. **Trocar senha** (estando logada) → sair → entrar com a senha nova.
5. **Esqueci a senha** → e-mail com link → abrir **no mesmo aparelho** → definir senha nova → "Agora entre com a senha nova" → entrar → sair.
**Você confere depois de cada pessoa:** `P1_verificar.sql` (a coluna "contas vinculadas às cinco" ganha um par `ID = @` correto; "vínculo com @ diferente" = 0; "contas fora da lista" não aumenta; "pedidos de vínculo abertos" = 0; "contas confirmadas SEM primeiro login" cai a cada pessoa que digita o código; "contas vinculadas cujo usuário nunca abriu sessão" = **0**) e `P0b` (idêntico).
**Ordem do teste de cadastro desligado:** a 1ª pessoa já é a prova (o cadastro precisa estar desligado antes; o `testar-funcoes.mjs` confere). A conta da @lyrichangbin **não** é tocada: ela só entra no teste se for convidada.
**Interromper o piloto (e rodar `P1_desativar.sql`) se:** o par ID = @ vier trocado; aparecer conta fora da lista; o e-mail chegar para quem não pediu; alguém ver qualquer dado do site depois do login (a página só mostra "Conta ativa").
**Se o código não chegar:** (1) a pessoa digitou o e-mail do cadastro? (o servidor só envia para esse); (2) o P0 ainda está sem FALHA? (3) Logs → Edge Functions → `pedir-codigo-joiner`; (4) painel do SendGrid; (5) limite de e-mails do Auth.
**Se aparecer "precisa de conferência da administração":** o e-mail ou o @ não conferem com o cadastro (ou voltou a duplicidade). Não force: rode o `P0` e me envie o resultado.

### Etapa 8 — Encerrar ou continuar
☆ **Pausar sem apagar nada:** `P1_desativar.sql` (onda 0: nenhum código novo, nenhuma ativação nova; contas e senhas ficam). Reativar: `P1_liberar_cinco_aplicar.sql`.
☆ **Travar também o login:** Authentication → Users → *Ban user* (reversível). **Tirar a página:** reverter o deploy.
☆ **No lançamento da Fase 2:** `SITE_URL` volta para `https://anticeg.vercel.app`; a página `/piloto-senha/` é removida; a lista das cinco vira a **onda 1** do lançamento (as contas criadas aqui já estão vinculadas e **seguem valendo**).

## 5. Testes automatizados que cobrem este piloto (todos passando)
☆ Banco (PGlite) `tests/sql/piloto-senhas.mjs`: J1+J3+J4a+J4d não alteram permissão alguma do que já existia; as tabelas novas ficam fechadas; a conta logada não lê mais que o visitante; só as cinco ativam; fora da lista, @ trocado, e-mail compartilhado e conta de outra pessoa **não vinculam**; as 9 recusas do P1; conta antiga preservada; desativar/reativar sem tocar em conta.
☆ Funções `supabase/functions/_shared/piloto.test.ts`: fora da lista não cria conta no Auth nem envia e-mail; resposta idêntica em todos os casos; lista pausada bloqueia até as cinco; e-mail dividido bloqueia; a lista não aparece em nenhum código.
☆ Navegador `tests/piloto-senhas.e2e.mjs` (branch do site): fluxo completo, caso negativo, só 5 endpoints permitidos, sessão em chave separada, link de recuperação não absorvido pelo site principal.
