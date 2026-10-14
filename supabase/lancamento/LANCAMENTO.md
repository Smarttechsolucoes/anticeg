# Lançamento geral do novo login das joiners — roteiro de implantação e reversão

**Escopo:** autenticação (código por e-mail, senha, recuperação, modo limitado só com @) e proteção dos dados (RLS) entram **juntas**, num único lançamento coordenado. Sem piloto, sem ambiente de ensaio, sem solução temporária.
**Regra do dia:** os dados são fechados **antes** de a interface nova ser publicada. Nunca existe um período com a interface nova no ar e os dados privados abertos pela API.
**Nada neste roteiro roda sozinho:** cada SQL é colado por você no SQL Editor, cada função é publicada por você, cada chave é digitada só no seu computador.

---

## 0. Antes de tudo: decisões e dependências em aberto

| # | Decisão / dependência | Padrão no código | O que acontece se ficar assim |
|---|---|---|---|
| D1 | A página de cada CEG hoje mostra **valor, frete e taxa de todas as joiners** para qualquer conta. | Passa a mostrar só @, nome, item e situação de todas; **valores só nos itens da própria joiner**. | Se você quiser manter os valores de terceiros visíveis, o J4b precisa deixar de proteger a masterlist inteira (não recomendado). |
| D2 | Visitante sem conta pode **enviar comprovante** nas páginas públicas de pré-venda (`/wmag-...`, `/revista` etc.)? | Permitido, com limite de 20 envios por hora por rede e arquivos de até 10 MB (imagem ou PDF). | Para exigir conta: defina o segredo `PERMITIR_COMPROVANTE_ANONIMO=false` nas funções (a mesma chave já controla o e-mail de comprovante). Compras por visitante deixam de aceitar PIX com comprovante. |
| D3 | **Cadastro público de usuários do Supabase Auth precisa estar LIGADO** (Authentication → Sign In / Providers → Email → *Allow new users to sign up*). O código de ativação cria a conta no primeiro pedido de código. | — | Com o cadastro desligado **ninguém consegue ativar**. Ligado, qualquer pessoa cria uma conta de e-mail, mas a conta **não enxerga nada** enquanto não for vinculada a uma joiner (e-mail confirmado igual ao cadastro) — comprovado nos testes. O README do login de administrador mandava desligar: **desligar só valia enquanto só a administradora tinha conta**. |
| D4 | **Google Apps Script / automações** que escrevem direto no Supabase com a chave pública deixam de funcionar quando as tabelas fecham. | Desconhecido (não está no repositório). | Antes da janela, confira nos *Logs → API Edge Logs* se algum Apps Script ou `node` usa a chave pública (consulta pronta em `supabase/emergencia/inventario_automacoes.md`, seção 4). Quem usar precisa migrar para função/chave de serviço **antes** do lançamento. |
| D5 | **422 joiners** vão precisar ativar a conta. Quem não tiver e-mail válido, ou dividir o e-mail com outra, vai para "vínculo pendente" e fica no **modo limitado** até a administradora resolver. | — | Rode o pré-voo (`00_preflight_leitura.sql`): a seção 1 diz quantas são. Planeje o comunicado e o atendimento para esse número. |
| D6 | **Funções antigas** `send-email` e `send-push` aceitam chamadas sem login. | Continuam publicadas. | Depois do lançamento (e da sua autorização), remova as duas (`supabase functions delete send-email send-push`). Enquanto existirem, o risco de e-mail falso em nome da comunidade continua. |
| D7 | Buckets `avatars`, `fotos-itens`, `storage-itens` continuam públicos para **ver**. O envio passa a exigir conta ativada. | — | Recomendado depois: limitar tipo/tamanho desses buckets (hoje aceitam qualquer arquivo). Não incluído para não quebrar upload que eu não possa conferir. |
| D8 | Conta de **administradora** com e-mail e senha já existe e entra no `/admin` (A1/A2 aplicados). | Confirmado pelo histórico (C0 e login admin no ar). | Sem ela ninguém administra depois do fechamento. Confira que **pelo menos duas** contas estão em `admin_roles`. |

---

## 1. Mapa dos PRs e ordem de mesclagem

Todos os PRs estão em rascunho. **Mesclar na `main` publica na Vercel de produção.** Como o login novo só liga com `VITE_JOINERS_AUTH=true`, um PR mesclado com a chave desligada **não muda nada** para as joiners (os testes de navegador cobrem os dois estados). Exceções que dependem de algo no Supabase **antes**:

| PR | O que é | Depende de | Pode mesclar antes do lançamento? |
|---|---|---|---|
| #19 → #20 → #22 → #23 → #25 → #28 | J1, J2, J3, J4, J4c-1/2, J4c-3 (em cadeia: cada um é base do seguinte) | o anterior da cadeia | Sim, com a chave desligada |
| **PR deste roteiro** (J4c-4a..e, J5, funções de comprovante, telas de CEG, scripts e testes) | fecha o que faltava | #28 | Sim, com a chave desligada |
| #21 notificações (`email-evento` / `push-evento`) | e-mail e push só por evento validado | **funções publicadas** (seção 3.4) e SQL N1 | Só depois de publicar as funções e aplicar o N1 |
| #26 isolamento do preview da Vercel | trava de build de preview | variáveis na Vercel (não se aplica sem ambiente de ensaio) | Sim (não afeta produção) |
| #27 guia/gerador de ensaio | só documentação e testes | — | Pode ficar de fora: não vamos usar ambiente de ensaio |
| #24 sync seguro (`prune_masterlist`) | muda o `sync-masterlist.js` do GitHub Actions | **SQL S1 aplicado antes** | Fora do lançamento: aplicar S1 e mesclar depois, em passo próprio |

Os PRs da cadeia (#19 → … → #28 → este) são empilhados: mescle sempre o de baixo primeiro, nunca fora de ordem.

---

## 2. Fase A — preparação (dias antes; **nenhuma joiner percebe**)

### 2.1 Backup e ponto de partida
1. **Backup do banco.** Painel → Database → Backups: confirme que existe backup diário do seu plano. Além disso, gere uma cópia sua com o CLI (a senha do banco fica só na sua máquina):
   `npx supabase db dump --db-url "postgresql://postgres:<SENHA>@db.ghjfsmwwcfpfvrouyrka.supabase.co:5432/postgres" -f backup-pre-lancamento.sql` e depois `... --data-only -f backup-dados-pre-lancamento.sql`. Guarde fora do repositório.
2. **Pré-voo (somente leitura):** cole `supabase/lancamento/00_preflight_leitura.sql` no SQL Editor e guarde o resultado. Ele mostra: quantas joiners têm e-mail válido/único, COGs repetidos, o que já está aplicado, o estado de cada tabela e dos buckets.
3. **Configuração pública do Auth:** `node scripts/lancamento/auth-settings.mjs` (variáveis `LANC_URL` e `LANC_ANON`; só chave pública). Esperado hoje: **FALHA no cadastro de usuários** se ainda estiver desligado (D3) — a correção é na janela, **não agora** (veja 2.5).
4. **Sondagem de hoje:** `node scripts/lancamento/verificar-api.mjs` mostra `visitante LÊ ...` em dezenas de tabelas. É o "antes". Guarde.

### 2.2 SQLs aditivos (não mudam o acesso de ninguém)
Em ordem, cada um no SQL Editor, **um por vez**, rodando o `_verificar` logo depois e conferindo o esperado descrito no topo do arquivo. Todos têm `_reverter_protegido` que exige uma frase escrita por você.

| Ordem | Aplicar | Verificar | O que faz |
|---|---|---|---|
| 1 | `supabase/notificacoes/N1_emails_enviados_aplicar.sql` | `N1_emails_enviados_verificar.sql` | controle de e-mails enviados (só o servidor usa) |
| 2 | `supabase/joiners-auth/J1_estrutura_aplicar.sql` | `J1_verificar.sql` | contas das joiners e vínculo seguro pelo id permanente |
| 3 | `J3_tentativas_aplicar.sql` | `J3_tentativas_verificar.sql` | limite de tentativas de login/recuperação |
| 4 | `J4_0_admin_em_todas_aplicar.sql` | `J4_0_admin_em_todas_verificar.sql` | acesso próprio da administradora (só amplia para ela) |
| 5 | `J4a_publico_aplicar.sql` | `J4a_publico_verificar.sql` | visão pública segura e funções de acesso |
| 6 | `J4c4e_cegs_publico_aplicar.sql` | `J4c4e_cegs_publico_verificar.sql` | funções de resumo dos CEGs (a masterlist protegida não esvazia as telas) |

Depois de cada um, rode `node scripts/lancamento/verificar-api.mjs`: o resultado **não muda** (ainda lista as tabelas abertas) — prova de que nada afetou o site de hoje.

### 2.3 Funções (Edge Functions) — publicadas **antes** de qualquer mudança no site
No PowerShell, na pasta do projeto (as chaves ficam só no seu computador):
```
npx supabase login
npx supabase link --project-ref ghjfsmwwcfpfvrouyrka
npx supabase secrets set SENDGRID_API_KEY=<chave de envio> SENDER_EMAIL=<remetente verificado em anticegs.com.br> SENDER_NAME="Anti CEG" ADMIN_NOTIFY_EMAIL=<seu e-mail> SITE_URL=https://anticeg.vercel.app ALLOWED_ORIGINS=https://anticeg.vercel.app EMAIL_MODO_SECO=true
npx supabase functions deploy email-evento push-evento login-joiner recuperar-senha-joiner comprovante-upload comprovante-url
```
☆ `EMAIL_MODO_SECO=true` faz as funções de e-mail validarem tudo **sem enviar**. Troque para `false` só na janela (seção 3).
☆ Os segredos de push (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) já existem da função antiga; confira com `npx supabase secrets list` (só mostra nomes).
☆ Se houver domínio próprio além de `anticeg.vercel.app`, inclua-o em `ALLOWED_ORIGINS` (separado por vírgula).
☆ Fumaça: `login-joiner` com @ inexistente devolve 401 neutro; `comprovante-upload` com um pedido válido devolve `{ok:true,token}` (antes do J5 o bucket ainda é público; nada é gravado).

### 2.4 E-mails (SMTP e modelos) — sem mudar a configuração atual até validar
O SendGrid e o domínio `anticegs.com.br` já estão autenticados e o SMTP do Supabase já entregou um e-mail. **Não altere nada ainda.** Para o dia:
☆ **Modelos em português** estão em `supabase/joiners-auth/templates-email/` (`codigo-ativacao.html` para *Confirm signup* **e** *Magic Link*; `recuperar-senha.html` para *Reset Password*). Cole **na janela** (seção 3), não antes: o modelo atual fica no ar até lá.
☆ **Limite de envio:** Authentication → Rate Limits → *emails per hour* — suba para algo acima de 500 no dia (422 pedidos de código + recuperações + reenvios).
☆ **Código de 6 dígitos, validade 600 s:** Authentication → Sign In / Providers → Email → *Email OTP length* = 6, *Email OTP expiration* = 600.
☆ **Senha mínima 8** e, se o seu plano tiver, **proteção contra senhas vazadas** ligada.
☆ **Site URL** = `https://anticeg.vercel.app` e **Redirect URLs** = `https://anticeg.vercel.app/**` (o link de recuperar senha só abre com isso).
☆ **Provedores externos e login anônimo** desligados (o `auth-settings.mjs` avisa).

### 2.5 Auth — o que conferir e o que **não** mexer ainda
| Item | Valor esperado no lançamento | Quando mudar |
|---|---|---|
| Cadastro de novos usuários (*Allow new users to sign up*) | **ligado** (D3) | **Na janela**, logo antes de publicar o site novo. Até lá fica como está (desligado no login de admin) |
| Confirmação de e-mail | ligada | já |
| SMTP personalizado (SendGrid) | ligado, remetente = remetente verificado | já (validado) |
| Modelos de e-mail | os três em português | na janela |
| Tempo de sessão / renovação | padrão do Supabase | não mexer |

### 2.6 Site preparado, **sem publicar** (Vercel)
1. **Impedir publicação automática:** Vercel → projeto → Settings → Environments → Production → desligar **Auto-assign Custom Domains** (o nome pode variar). Assim cada build de `main` é criado mas **não vira o site no ar** até você clicar em *Promote*.
   Se a sua conta não tiver essa opção: use a alternativa da seção 3.5 (a variável só nasce na janela e o build leva 1–2 min dentro da manutenção); nesse caso, mescle os PRs **antes** de criar a variável.
2. **Variável do site novo:** Settings → Environment Variables → `VITE_JOINERS_AUTH` = `true`, **somente no ambiente Production** (não Preview, não Development). **Não** crie `VITE_SUPABASE_URL` nem `VITE_SUPABASE_ANON_KEY` (o site já usa a produção por padrão).
3. **Mesclar os PRs** na ordem da seção 1 (com a opção do item 1 desligada, nada vai ao ar). Anote a URL do deploy criado: `Deployments` → o mais recente de `main` → **Promote** é o botão da janela.
4. Os previews continuam proibidos de apontar para a produção (trava do #26); não use previews para testar.

### 2.7 Contas de teste controladas
Com **autorização por escrito** das donas, escolha **duas joiners** (A e B) com e-mail válido e único, e a sua conta de administradora. Elas ativam o acesso na janela, **antes** do anúncio. Os testes só **leem** (nunca criam, alteram ou apagam pedido, pagamento ou claim).

### 2.8 Comunicação
☆ Aviso prévio de 48 h: "vai pedir senha; ative com o código que chega no seu e-mail; sem ativar você continua navegando só com o @".
☆ Mensagem pronta para quem **não** receber o código: confira o spam, peça de novo depois de 60 s, e fale com a administração (vínculo pendente).

---

## 3. Fase B — a janela do lançamento (≈ 30 min; o site fica em manutenção ≈ 10 min)

**Quem:** você, com o roteiro aberto. **Quando:** horário de menor uso. **Pare e reverta se qualquer critério da seção 5 for atingido.** Se a Vercel puder segurar a publicação (2.6), o site antigo só fica indisponível de 3.1 até 3.5 (≈ 10 min, com a tela de manutenção).

### 3.0 Conferências de entrada (2 min)
☆ Pré-voo rodado há menos de 24 h; backup feito (2.1); funções publicadas (2.3); build do site novo pronto e **não promovido** (2.6); Auth e modelos prontos para colar.
☆ `node scripts/lancamento/verificar-api.mjs` mostra o "antes" (tabelas abertas) — confirma que você está no projeto certo.

### 3.1 Manutenção (1 min)
☆ `/admin` → painel de manutenção → ligar (**"Site bloqueado para todos (exceto admin)"**). Reversível a qualquer momento.

### 3.2 Fechar os dados (≈ 8 min) — **nesta ordem**, um de cada vez, conferindo o `_verificar` de cada
| Ordem | Aplicar (SQL Editor) | Verificar | Esperado |
|---|---|---|---|
| 1 | `J4b_lote1_aplicar.sql` | `J4b_lote1_verificar.sql` | policies novas, visitante sem nada, dados iguais antes/depois |
| 2 | `J4c1_joiners_aplicar.sql` | `J4c1_joiners_verificar.sql` | idem |
| 3 | `J4c2_pedidos_claims_aplicar.sql` | `J4c2_pedidos_claims_verificar.sql` | 13 policies |
| 4 | `J4c3_lojas_aplicar.sql` | `J4c3_lojas_verificar.sql` | 12 lojas + formulários |
| 5 | `J4c4a_mercari_lojinha_aplicar.sql` | `J4c4a_mercari_lojinha_verificar.sql` | 12 policies |
| 6 | `J4c4b_claims_sets_aplicar.sql` | `J4c4b_claims_sets_verificar.sql` | 6 policies, 3 funções seguras |
| 7 | `J4c4c_pessoais_aplicar.sql` | `J4c4c_pessoais_verificar.sql` | 29 policies (1 de visitante: avisos gerais) |
| 8 | `J4c4d_admin_catalogos_aplicar.sql` | `J4c4d_admin_catalogos_verificar.sql` | 18 policies |
| 9 | `J5_comprovantes_aplicar.sql` | `J5_comprovantes_verificar.sql` | buckets privados, 10 MB, sem escrita de visitante |

Cada aplicação roda em **uma transação** com conferência no final: se algo estiver fora do esperado ela termina com "Nada foi alterado". **Se um script abortar, pare aqui** (os anteriores ficam aplicados; veja a seção 4 para voltar atrás).

### 3.3 Auditoria dos dados (1 min)
☆ Cole `supabase/lancamento/99_auditoria_final.sql`. **Nenhuma linha pode ser `INESPERADO`.** Linhas `REVISAR` precisam de uma olhada (função fora da lista).
☆ `node scripts/lancamento/verificar-api.mjs` agora deve dizer **`visitante NÃO lê`** em todas as tabelas protegidas.

### 3.4 Autenticação e e-mails (3 min)
☆ Painel Auth: **ligar o cadastro de usuários** (D3); colar os três modelos em português (2.4); conferir OTP 6/600 e Site URL.
☆ `npx supabase secrets set EMAIL_MODO_SECO=false` (e, se decidiu D2, `PERMITIR_COMPROVANTE_ANONIMO=false`).
☆ `node scripts/lancamento/auth-settings.mjs` → **tudo OK**.

### 3.5 Publicar o site novo (1 min)
☆ Vercel → Deployments → o build de `main` com `VITE_JOINERS_AUTH=true` → **Promote to Production**.
☆ A partir daqui a interface nova está no ar **e os dados já estão fechados**. A manutenção **continua ligada**.
☆ **Se a sua conta Vercel não tem "Auto-assign" desligável:** deixe a variável `VITE_JOINERS_AUTH` **inexistente** até este momento; aqui crie `VITE_JOINERS_AUTH=true` e faça *Redeploy*; espere o build (1–2 min **com a manutenção ligada**) antes de seguir.

### 3.6 Abertura silenciosa e fumaça com as contas controladas (≈ 15 min)
Desligue a manutenção **sem anunciar nada**. Quase ninguém está no site nesse horário; a proteção dos dados já foi comprovada pela API no item 3.3, então o que falta provar aqui é a interface e os e-mails.
Com as duas contas controladas (A e B, com autorização) e a administradora, faça — e rode o script no fim:
☆ **A:** entra só com o @ → modo limitado; tenta abrir a MASTERLIST → pede senha. ☆ **A:** "ativar conta" → recebe o **código por e-mail** em até 5 min → cria a senha → entra. ☆ **A:** sai e entra por @ + senha. ☆ **A:** "esqueci a senha" → recebe o link → cria a senha nova → entra.
☆ **A:** a MASTERLIST mostra **só os itens dela**; pagamentos e multas só dela; perfil e endereço dela.
☆ **A e B:** a lista de itens de um CEG mostra @/item/situação de todas, **sem valor** de ninguém; o valor aparece só nos itens da própria.
☆ **A:** vê o quadro de claims com os @ (sem nome real). *Não faça claim de verdade*; use o evento fictício que a administradora criar para o teste, ou só observe.
☆ **A:** abre a página de uma pré-venda e vê o card; **não** finalize pedido real.
☆ **A:** a Caixinha Mercari abre sem pedir @ ou e-mail (usa a conta). ☆ **A:** "ver comprovante" de um pedido **dela** abre; **B** não consegue abrir o de **A**.
☆ **Administradora:** o painel abre, lista pedidos, abre um comprovante (link assinado), muda o status de um pedido **de teste** e volta.
☆ **Joiner sem vínculo / e-mail diferente do cadastro:** fica no modo limitado e o pedido aparece em "vínculos pendentes" para a administradora.
☆ `node scripts/lancamento/verificar-api.mjs` com `LANC_A_COG/LANC_A_SENHA`, `LANC_B_COG/LANC_B_SENHA` e `LANC_ADMIN_EMAIL/LANC_ADMIN_SENHA`: **TODAS AS VERIFICAÇÕES PASSARAM**.
**Se qualquer item falhar:** manutenção ligada de novo e siga a seção 5 (voltar o site ou tudo).

### 3.7 Anunciar (1 min)
☆ Enviar o comunicado às joiners (2.8). Fique acompanhando: Supabase → Logs (erros 4xx/5xx), SendGrid → Activity (entregas e rejeições) e o atendimento da administração.

### 3.8 Pós-lançamento (mesmo dia e semana)
☆ Reativar o **Auto-assign** na Vercel (para builds futuros voltarem ao normal).
☆ Acompanhe quantas contas ativaram e quantos pedidos de vínculo pendente chegaram.
☆ Com a sua autorização: publicar S1/#24 do sync (passo próprio), remover `send-email` e `send-push` (D6) e revisar o Apps Script (D4).

---

## 4. Reversão (procedimento e ordem)

**Princípio:** nenhum script apaga dado. Reverter reabre acesso, nunca perde pedido, ativação ou comprovante. A reversão de cada SQL só roda com a **frase escrita por você** dentro do arquivo (se a frase estiver vazia ela se recusa).

### 4.1 Voltar só o site (rápido, sem mexer no banco)
Se o problema for **só visual/funcional do site novo** e os dados estão bem: Vercel → Deployments → o deploy anterior → **Promote** (Instant Rollback). As joiners voltam para a interface antiga **mas as tabelas continuam fechadas** (a interface antiga lê como visitante): use 4.2 em seguida **ou** deixe a manutenção ligada enquanto corrige.

### 4.2 Voltar tudo (site antigo funcionando de novo)
1. Manutenção **ligada**.
2. Vercel → Instant Rollback para o deploy anterior (site antigo).
3. SQL Editor, **na ordem inversa**, editando a frase indicada em cada arquivo e rodando:

| Ordem | Reverter | Frase |
|---|---|---|
| 1 | `J5_comprovantes_reverter_protegido.sql` | AUTORIZO REABRIR COMPROVANTES |
| 2 | `J4c4d_admin_catalogos_reverter_protegido.sql` | AUTORIZO REABRIR ADMINISTRACAO E CATALOGOS |
| 3 | `J4c4c_pessoais_reverter_protegido.sql` | AUTORIZO REABRIR DADOS PESSOAIS RESTANTES |
| 4 | `J4c4b_claims_sets_reverter_protegido.sql` | AUTORIZO REABRIR CLAIMS EM SETS |
| 5 | `J4c4a_mercari_lojinha_reverter_protegido.sql` | AUTORIZO REABRIR MERCARI E LOJINHA |
| 6 | `J4c3_lojas_reverter_protegido.sql` | AUTORIZO REABRIR PEDIDOS DAS LOJAS |
| 7 | `J4c2_pedidos_claims_reverter_protegido.sql` | AUTORIZO REABRIR CLAIMS E ENVIOS |
| 8 | `J4c1_joiners_reverter_protegido.sql` | AUTORIZO REABRIR DADOS PESSOAIS DAS JOINERS |
| 9 | `J4b_lote1_reverter_protegido.sql` | AUTORIZO REABRIR DADOS DO LOTE 1 |

   (`J4c4e` só tem funções: `J4c4e_cegs_publico_reverter.sql` as remove, sem frase.)
4. `node scripts/lancamento/verificar-api.mjs` volta a mostrar `visitante LÊ ...` (o estado de antes). Manutenção desligada.
5. As contas ativadas e os vínculos **ficam** (J1/J3/J4-0/J4a não são revertidos: são aditivos); quando o lançamento for refeito, ninguém precisa ativar de novo.

### 4.3 O que **não** se reverte
☆ Os comprovantes enviados depois do J5 continuam nos buckets (a reversão só os torna públicos de novo).
☆ O estado anterior de cada etapa está em `emergencia.c0b_estado_anterior` (`select etapa, objeto from emergencia.c0b_estado_anterior order by id`); **não apague** o schema `emergencia` antes de encerrar o lançamento.

---

## 5. Critérios objetivos para interromper

| Quando | Condição | Ação |
|---|---|---|
| Durante os SQLs | qualquer script termina com erro / "Nada foi alterado" / `_verificar` fora do esperado | **Parar.** Não seguir para o próximo. Decidir entre corrigir o motivo (a mensagem diz) ou reverter os já aplicados |
| Após o item 3.3 | a auditoria final mostra **qualquer** `INESPERADO`, ou o `verificar-api` mostra `visitante LÊ` em alguma tabela | **Parar.** Não publicar o site. Reverter (4.2) ou corrigir |
| Em 3.6 | administradora não consegue entrar no `/admin`, ou uma conta controlada não consegue ativar/entrar/recuperar a senha | Manutenção ligada; voltar o site (4.1) ou tudo (4.2); investigar |
| Em 3.6 | `verificar-api` com as contas falha (isolamento, valores de terceiros, comprovante de outra) | **Reverter tudo (4.2).** É falha de proteção |
| E-mail | o código **não chega em 5 minutos** para 2 das 3 contas controladas | Não anunciar. Conferir SendGrid Activity / limites / spam. Só anunciar quando resolver |
| Depois de aberto | mais de **5 relatos em 30 min** de tela vazia/erro na MASTERLIST, pagamentos ou claims **ou** erro de função (5xx) em mais de 5% das chamadas por 10 min | Manutenção ligada e reversão 4.1/4.2 |
| Depois de aberto | rejeição/bounce do SendGrid acima de **5%** no dia, ou "email rate limit" em mais de 10% dos pedidos de código | Pausar a comunicação de ativação; subir o limite; retomar em ondas |

---

## 6. O que cada peça cobre (para a revisão)

| Requisito | Entrega |
|---|---|
| J4c-4: Mercari, lojinha, repasses | `J4c4a_*` (+ página estática antiga substituída por redirecionamento; a Caixinha Mercari usa a conta logada) |
| `claim_reservas` e os sets (e a lógica que rodava no navegador) | `J4c4b_*`: `claim_enviar` e `claim_organizar` no servidor, com trava por evento; quadro dos sets sem nome real |
| Pessoais restantes (feedbacks, notificações, avisos, storage, conferências, fila de envio) | `J4c4c_*` (+ `envio_entrar_round` no servidor) |
| Administração e catálogos (estoque, rastreios, links dos grupos, fotos, calendário, preços, selos) | `J4c4d_*` |
| Telas comunitárias que dependiam da masterlist inteira (lista de CEGs, calendário geral, página do CEG) | `J4c4e_*` (D1) |
| J5 comprovantes | `J5_*` + `comprovante-upload` + `comprovante-url`; links assinados de 10 min; arquivos antigos mantidos; donas dos arquivos registradas pelo servidor |
| Modo limitado só com @ | teste de navegador percorre as 12 áreas protegidas e 4 públicas: **nenhuma tabela privada é tocada** e todas pedem senha |
| Publicação conjunta | seções 2–3 (dados fechados antes do site; manutenção no meio) |
| Testes com contas controladas | `scripts/lancamento/verificar-api.mjs` (somente leitura) + checklist 3.6 |
| Auth e cadastro público | seção 2.4/2.5 e `scripts/lancamento/auth-settings.mjs` (D3) |
| Auditoria do que sobra aberto | `99_auditoria_final.sql` (e o teste `lancamento-completo` prova que, na ordem do roteiro, nada INESPERADO sobra) |

### Testes automáticos (todos locais, sem produção, só dados fictícios)
```
npm i --no-save @electric-sql/pglite
node tests/sql/lancamento-completo.mjs                       # a sequência inteira + auditoria final
node tests/sql/j4c4a-mercari-lojinha.mjs   (e j4c4b, j4c4c, j4c4d, j4c4e, j5-comprovantes, j4c3-lojas, ...)
node --test supabase/functions/_shared/*.test.ts src/comprovantesPuro.test.mjs tests/lancamento-scripts.test.mjs
npx vite --port 5199 --strictPort                            # login novo DESLIGADO
VITE_JOINERS_AUTH=true npx vite --port 5197 --strictPort     # LIGADO
node tests/joiner-entrada.e2e.mjs; node tests/comprovantes.e2e.mjs   # (e joiner-login, joiner-ativacao, joiner-cadastro)
```

## 7. Riscos que continuam depois deste lançamento
☆ Os testes de banco usam PGlite (Postgres local): **não é o Supabase**. Por isso existe a verificação pela API real (3.6) e a auditoria (3.3), que rodam no ambiente verdadeiro.
☆ As tabelas **sem SQL no repositório** foram levantadas pelo código; cada script **aborta sem alterar nada** se uma coluna esperada não existir. Se isso acontecer, a mensagem diz qual.
☆ Fluxos que **não** têm teste de navegador automático e dependem da checagem manual 3.6: claims reais, pré-venda completa, Mercari, lojinha e repasses (a lógica está testada no banco; a tela, não).
☆ D4 (Apps Script) e D6 (funções antigas) continuam abertos até você confirmar.
