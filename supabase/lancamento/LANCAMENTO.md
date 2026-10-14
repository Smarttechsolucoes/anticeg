# Lançamento geral do novo login das joiners — roteiro final de implantação e reversão

**Escopo:** autenticação (código por e-mail, senha, recuperação, modo limitado só com @) e proteção dos dados (RLS) entram **juntas**, num lançamento coordenado, e a **ativação** das joiners é liberada em **ondas** (grupos pequenos que vão crescendo). Sem ambiente de ensaio.
**Regra do dia:** os dados são fechados **antes** de a interface nova ser publicada. Nunca existe um período com a interface nova no ar e os dados privados abertos pela API.
**Nada neste roteiro roda sozinho:** cada SQL é colado por você no SQL Editor, cada função é publicada por você, cada chave é digitada só no seu computador.
Resumo objetivo (pronto / bloqueios / ordem / manual / testes e reversão): **`CHECKLIST.md`** (mesma pasta).

---

## 0. Decisões tomadas e como o código as cumpre

| Decisão | O que foi feito |
|---|---|
| **D1 aprovado:** ocultar valores, fretes, taxas e pagamentos de outras joiners nas páginas dos CEGs | A página de cada CEG mostra @, nome, item, situação e as informações do item de **todas**; valor, frete, taxa e pagamento aparecem **só nos itens da própria joiner** (`J4c4e`). Preços gerais (`tabela_precos`), fotos, links úteis, calendário e prazos continuam públicos. |
| **D2 aprovado:** nada de comprovante sem autenticação | `comprovante-upload` **recusa (401) visitante, chave pública e conta sem vínculo, sempre** (a variável antiga `PERMITIR_COMPROVANTE_ANONIMO` não reabre nada). `pedido_loja_criar` (todas as lojas) exige conta **ativada e vinculada** e deixa de ser executável pelo visitante. As páginas de pedido do site mostram "Entre na sua conta" a quem não está ativada. O funcionamento antigo só vale **até a janela** (com `VITE_JOINERS_AUTH` desligada o site é idêntico ao de hoje; coberto por teste). |
| **D3 aprovado com condições:** conta criada não é acesso | O cadastro público do Supabase Auth **deixa de ser necessário e fica DESLIGADO** (como está hoje). O pedido de código passa por `pedir-codigo-joiner` (servidor): só envia para o **e-mail do cadastro** de uma joiner **real, única, liberada e sem conta**, com limite por hora por rede, por @ e por e-mail, e responde **sempre o mesmo**. Testado: contas criadas sem vínculo **não leem nenhuma das 43 tabelas/visões protegidas, não escrevem, não usam funções e não enviam arquivo** (inclusive os "slots disponíveis" da masterlist, que corrigi). |
| **D4 verificação obrigatória** | Veja a seção 7 (resultado e o que falta você fazer). |
| **Ajuste do J5:** comprovantes antigos não podem ficar públicos, sem perder nada | `J5` torna os buckets privados (os links antigos param de abrir), **sem mover, apagar ou renomear nenhum arquivo** (contagem conferida dentro da transação); `J5_inventario_leitura.sql` faz o inventário e o mapeamento por dona **antes**; as donas dos arquivos existentes são registradas pelo servidor; a visualização legítima passa por link assinado de 10 min; `verificar-comprovantes-antigos.mjs` prova pela API que **nenhum link público antigo abre** e que a dona ainda vê o dela. |
| **Ativação em ondas** sem reabrir permissões e sem invalidar sessões | `J4d`: tabela de ondas + trava no servidor (`ativar_minha_conta` e `pedir-codigo-joiner` só valem para quem já foi liberada). **Liberar uma onda não toca em nenhuma conta, senha ou sessão** e não altera nenhuma permissão de dados (testado). Quem ainda não foi liberada fica no modo limitado, vê "sua ativação será liberada em breve" e não recebe pop-up. |

---

## 1. Mapa dos PRs e ordem de mesclagem

Todos em rascunho. **Mesclar na `main` publica na Vercel de produção.** Com `VITE_JOINERS_AUTH` ausente, um PR mesclado **não muda nada** para as joiners. Exceções que dependem de algo no Supabase **antes**:

| PR | O que é | Depende de | Pode mesclar antes da janela? |
|---|---|---|---|
| #19 → #20 → #22 → #23 → #25 → #28 → **#29** | J1, J2, J3, J4, J4c-1/2, J4c-3 e este (J4c-4, J4d, J5, comprovantes, telas, roteiro). Empilhados: mescle sempre o de baixo primeiro | o anterior | Sim, com a chave desligada |
| #21 notificações (`email-evento` / `push-evento`) | e-mail e push só por evento validado | funções publicadas (2.4) e SQL N1 | Só depois de publicar as funções e aplicar o N1 |
| #26 isolamento do preview da Vercel | trava de build de preview | — | Sim (não afeta produção) |
| #27 guia/gerador de ensaio | só documentação e testes | — | Pode ficar de fora |
| #24 sync seguro (`prune_masterlist`) | troca a exclusão direta do `sync-masterlist.js` pela função atômica | **SQL S1 aplicado antes** | **Fora do lançamento**: S1 e mesclagem em passo próprio (hoje o `main` ainda exclui direto com a chave de serviço; o RLS não muda isso) |

---

## 2. Fase A — preparação (dias antes; **nenhuma joiner percebe**)

### 2.1 Backup e ponto de partida
1. **Backup:** Painel → Database → Backups (confirme o seu plano) **e** uma cópia sua com o CLI, com a senha só na sua máquina: `npx supabase db dump --db-url "postgresql://postgres:<SENHA>@db.ghjfsmwwcfpfvrouyrka.supabase.co:5432/postgres" -f backup-pre-lancamento.sql` (e `--data-only -f backup-dados.sql`). Guarde fora do repositório.
2. **Pré-voo** (somente leitura): `supabase/lancamento/00_preflight_leitura.sql`. Mostra quantas joiners têm e-mail válido/único (as que **não** têm ficam no modo limitado até a administradora corrigir o cadastro), COGs repetidos, o que já está aplicado e o estado de cada tabela e bucket.
3. **Inventário dos comprovantes antigos** (somente leitura): `supabase/lancamento/J5_inventario_leitura.sql`. Mostra, por bucket, quantos arquivos têm dona identificada, quantos não têm (só a administradora os verá), referências para arquivos que não existem e **tabelas fora do mapeamento** que citam comprovantes. Exporte a consulta **2d** (lista de arquivos) em CSV: ela alimenta a verificação da janela. Se houver ALERTA de tabela fora do mapeamento ou arquivos sem dona que importam, resolva **antes** (consulta 2e registra uma dona manualmente depois do J5).
4. **D4 — Apps Scripts e segredos:** seção 7 (você exporta o código dos 4 scripts e roda o auditor).
5. **Configuração pública do Auth:** `node scripts/lancamento/auth-settings.mjs` (só chave pública). Esperado: cadastro público **DESLIGADO**, confirmação de e-mail ligada, sem provedor externo.
6. **Sondagem de hoje:** `node scripts/lancamento/verificar-api.mjs` mostra `visitante LÊ ...` em dezenas de tabelas. É o "antes".

### 2.2 SQLs aditivos (não mudam o acesso de ninguém)
Em ordem, um por vez, rodando o `_verificar` logo depois e conferindo o esperado descrito no topo do arquivo. Todos têm `_reverter_protegido` (exige uma frase escrita por você).

| Ordem | Aplicar | Verificar | O que faz |
|---|---|---|---|
| 1 | `supabase/notificacoes/N1_emails_enviados_aplicar.sql` | `N1_emails_enviados_verificar.sql` | controle de e-mails enviados (só o servidor) |
| 2 | `supabase/joiners-auth/J1_estrutura_aplicar.sql` | `J1_verificar.sql` | contas das joiners e vínculo seguro pelo id permanente |
| 3 | `J3_tentativas_aplicar.sql` | `J3_tentativas_verificar.sql` | limite de tentativas de login/recuperação |
| 4 | `J4_0_admin_em_todas_aplicar.sql` | `J4_0_admin_em_todas_verificar.sql` | acesso próprio da administradora (só amplia para ela) |
| 5 | `J4a_publico_aplicar.sql` | `J4a_publico_verificar.sql` | visão pública segura e funções de acesso |
| 6 | **`J4d_ondas_aplicar.sql`** | `J4d_ondas_verificar.sql` | ativação em ondas (estado inicial: **ninguém liberada**) |
| 7 | `J4c4e_cegs_publico_aplicar.sql` | `J4c4e_cegs_publico_verificar.sql` | resumo dos CEGs sem dados de terceiros |

Depois de cada um: `node scripts/lancamento/verificar-api.mjs` — o resultado **não muda** (prova de que nada afetou o site de hoje).

### 2.3 Ondas: cadastrar os grupos (ainda sem liberar ninguém)
No SQL Editor (a lista é por @ exato; Ela/ela e e-mails repetidos **não** ativam sozinhas e viram vínculo para a administradora):
```sql
-- Onda 1 = você + as duas contas controladas + o grupo pequeno inicial (troque os @)
insert into public.ativacao_ondas (joiner_id, onda)
select id, 1 from public.joiners where lower(trim(cog)) in ('seu_cog', 'conta_a', 'conta_b')
on conflict (joiner_id) do update set onda = excluded.onda;
-- Onda 2, 3...: o mesmo comando com outro número e outra lista. Conferir: J4d_ondas_verificar.sql
```

### 2.4 Funções (Edge Functions) — publicadas **antes** de qualquer mudança no site
```
npx supabase login
npx supabase link --project-ref ghjfsmwwcfpfvrouyrka
npx supabase secrets set SENDGRID_API_KEY=<chave de envio> SENDER_EMAIL=<remetente verificado em anticegs.com.br> SENDER_NAME="Anti CEG" ADMIN_NOTIFY_EMAIL=<seu e-mail> SITE_URL=https://anticeg.vercel.app ALLOWED_ORIGINS=https://anticeg.vercel.app EMAIL_MODO_SECO=true
npx supabase functions deploy email-evento push-evento login-joiner recuperar-senha-joiner pedir-codigo-joiner comprovante-upload comprovante-url
```
☆ `EMAIL_MODO_SECO=true` faz as funções de e-mail validarem tudo **sem enviar**; vira `false` na janela (3.4).
☆ Os segredos de push (`VAPID_*`) já existem; confira os nomes com `npx supabase secrets list`.
☆ Domínio próprio além de `anticeg.vercel.app`: inclua em `ALLOWED_ORIGINS`.
☆ **Teste do código com o SEU @ (sem site novo):** com você na onda 1 e `update public.ativacao_estado set onda_liberada = 1;` rodado **só agora** (nenhuma joiner fora da onda 1 consegue ativar, e o site de hoje nem usa este caminho), peça o código por `curl -X POST https://ghjfsmwwcfpfvrouyrka.supabase.co/functions/v1/pedir-codigo-joiner -H "apikey: <anon>" -H "Authorization: Bearer <anon>" -H "content-type: application/json" -d '{"cog":"seu_cog","email":"seu-email-do-cadastro"}'`. A resposta é sempre `{"ok":true}`; **o e-mail com o código deve chegar** (confira o spam). Se **não** chegar com o cadastro público desligado, o plano B está na seção 8 (R1).

### 2.5 E-mails e Auth — sem mudar nada antes de validar
O SendGrid e o domínio `anticegs.com.br` já estão autenticados e o SMTP do Supabase já entregou um e-mail. Para o dia:
☆ **Modelos em português** em `supabase/joiners-auth/templates-email/` (`codigo-ativacao.html` em *Confirm signup* **e** *Magic Link*; `recuperar-senha.html` em *Reset Password*). Cole **na janela**.
☆ **Cadastro público de usuários: continua DESLIGADO** (não é preciso mexer).
☆ *Rate limits* → e-mails por hora: suba para algo acima de **200** no dia (a onda 1 é pequena; aumente a cada onda, **não** de uma vez para o total).
☆ OTP de **6 dígitos, 600 s**; senha mínima 8; proteção contra senhas vazadas se o plano tiver.
☆ **Site URL** `https://anticeg.vercel.app` e **Redirect URLs** `https://anticeg.vercel.app/**` (o link de recuperação só abre com isso).
☆ Provedores externos, login por telefone e login anônimo desligados.
**Abuso de e-mail, em camadas:** (1) o site só pede o código à função, que só envia ao e-mail do cadastro de joiner real e liberada, com limite por rede/@/e-mail; (2) o cadastro público desligado impede o pedido direto de criar contas; (3) o limite por hora do projeto e o limite por e-mail do próprio Auth ainda valem para o endpoint direto.

### 2.6 Site preparado, **sem publicar** (Vercel)
1. Settings → Environments → Production → desligar **Auto-assign Custom Domains** (nome pode variar). Assim cada build de `main` é criado mas **não vai ao ar** até você clicar em *Promote*. Se não existir na sua conta: alternativa na seção 3.5.
2. Settings → Environment Variables → `VITE_JOINERS_AUTH` = `true`, **só em Production**. **Não** crie `VITE_SUPABASE_URL` nem `VITE_SUPABASE_ANON_KEY`.
3. Mesclar os PRs na ordem da seção 1. Anote o deploy de `main` criado (é o que será promovido).
4. Previews continuam proibidos de apontar para a produção (trava do #26); não use previews para testar.

### 2.7 Contas controladas e comunicação
☆ Com autorização por escrito das donas: **duas joiners (A e B)** com e-mail válido e único, na **onda 1**, e a sua conta de administradora. Os testes só **leem**.
☆ Aviso prévio de 48 h às joiners: "o site vai pedir senha; a ativação será liberada **por grupos**; sem ativar você continua navegando só com o @; nada do que você tem se perde". Quem pedir pelo WhatsApp entra na próxima onda.

---

## 3. Fase B — a janela do lançamento (≈ 30 min; o site fica em manutenção ≈ 10 min)

### 3.0 Entrada (2 min)
☆ Pré-voo e inventário rodados há menos de 24 h; backup feito; funções publicadas; build do site novo pronto e **não promovido**; modelos de e-mail e `CHECKLIST.md` à mão.
☆ `node scripts/lancamento/verificar-api.mjs` mostra o "antes" (confirma o projeto).

### 3.1 Manutenção (1 min)
☆ `/admin` → manutenção → ligar ("Site bloqueado para todos (exceto admin)"). Reversível a qualquer momento.

### 3.2 Fechar os dados (≈ 8 min) — nesta ordem, um por vez, conferindo o `_verificar`
| Ordem | Aplicar | Verificar | Esperado |
|---|---|---|---|
| 1 | `J4b_lote1_aplicar.sql` | `J4b_lote1_verificar.sql` | policies novas, visitante sem nada, dados iguais antes/depois |
| 2 | `J4c1_joiners_aplicar.sql` | `J4c1_joiners_verificar.sql` | idem |
| 3 | `J4c2_pedidos_claims_aplicar.sql` | `J4c2_pedidos_claims_verificar.sql` | 13 policies |
| 4 | `J4c3_lojas_aplicar.sql` | `J4c3_lojas_verificar.sql` | 12 lojas + formulários; `pedido_loja_criar` fechada ao visitante |
| 5 | `J4c4a_mercari_lojinha_aplicar.sql` | `J4c4a_mercari_lojinha_verificar.sql` | 12 policies |
| 6 | `J4c4b_claims_sets_aplicar.sql` | `J4c4b_claims_sets_verificar.sql` | 6 policies, 3 funções seguras |
| 7 | `J4c4c_pessoais_aplicar.sql` | `J4c4c_pessoais_verificar.sql` | 29 policies (1 de visitante: avisos gerais) |
| 8 | `J4c4d_admin_catalogos_aplicar.sql` | `J4c4d_admin_catalogos_verificar.sql` | 18 policies |
| 9 | `J5_comprovantes_aplicar.sql` | `J5_comprovantes_verificar.sql` | buckets privados, 10 MB, **arquivos antes = depois**, donas registradas |

Cada script roda em **uma transação** com conferência final: se algo estiver fora do esperado ele termina com "Nada foi alterado". **Se um script abortar, pare aqui** (os anteriores ficam aplicados; veja a seção 6).

### 3.3 Auditoria dos dados (2 min)
☆ `supabase/lancamento/99_auditoria_final.sql`: **nenhuma linha `INESPERADO`**; linhas `REVISAR` precisam de olhar.
☆ `node scripts/lancamento/verificar-api.mjs`: **`visitante NÃO lê`** em todas as tabelas protegidas.
☆ `node scripts/lancamento/verificar-comprovantes-antigos.mjs lista.csv --amostra 300`: **nenhum link público antigo abre** (use a lista exportada em 2.1; sem `--amostra` confere todos).

### 3.4 Funções e Auth (3 min)
☆ `npx supabase secrets set EMAIL_MODO_SECO=false PERMITIR_COMPROVANTE_ANONIMO=false` (**obrigatório**: o aviso de comprovante por e-mail deixa de aceitar visitante).
☆ Colar os três modelos em português (2.5); conferir OTP 6/600, Site URL e limite de e-mails.
☆ **Liberar só a onda 1:** `update public.ativacao_estado set onda_liberada = 1, atualizado_em = now();` (**não** use `liberar_todas`).
☆ `node scripts/lancamento/auth-settings.mjs` → tudo OK (cadastro público DESLIGADO).

### 3.5 Publicar o site novo (1 min)
☆ Vercel → Deployments → o build de `main` com `VITE_JOINERS_AUTH=true` → **Promote to Production**. A manutenção **continua ligada**.
☆ Sem "Auto-assign" desligável: deixe `VITE_JOINERS_AUTH` **inexistente** até aqui (mescle os PRs antes); crie `VITE_JOINERS_AUTH=true`, faça *Redeploy* e espere o build (1–2 min **com a manutenção ligada**).

### 3.6 Abertura silenciosa e fumaça com as contas controladas (≈ 15 min)
Desligue a manutenção **sem anunciar**. A proteção dos dados já foi comprovada pela API; falta provar a interface e os e-mails.
Com A e B (onda 1) e a administradora:
☆ **Sem conta ativada:** `/dazed-seungmin` e as outras páginas de pedido mostram "Entre na sua conta" e **nenhum formulário**.
☆ **A:** entra só com o @ → modo limitado; a MASTERLIST pede senha. ☆ **A:** pop-up de ativação → recebe o **código por e-mail** em até 5 min → cria a senha → entra. ☆ **A:** sai e entra por @ + senha. ☆ **A:** "esqueci a senha" → link → senha nova → entra.
☆ **Uma joiner fora da onda 1 (a sua conta de teste de outra onda ou uma voluntária):** o @ dela mostra "sua ativação será liberada em breve", sem pop-up e sem e-mail.
☆ **A:** MASTERLIST, pagamentos e multas só dela; perfil e endereço dela. ☆ **A e B:** lista de itens de um CEG **sem valor** de ninguém; valor só nos itens da própria.
☆ **A:** quadro de claims com @ (sem nome real); *não faça claim de verdade*. ☆ **A:** pré-venda abre o card; **não** finalize pedido real. ☆ **A:** Caixinha Mercari sem pedir @/e-mail.
☆ **A:** "ver comprovante" de um pedido **dela** abre; **B não** abre o de **A**. ☆ `verificar-comprovantes-antigos.mjs lista.csv --ver comprovantes/<arquivo da A>` (com `LANC_A_*` e `LANC_B_*`): dona vê, outra não, visitante não.
☆ **Administradora:** painel abre, lista pedidos, abre um comprovante, muda o status de um pedido **de teste** e volta.
☆ `node scripts/lancamento/verificar-api.mjs` com `LANC_A_*`, `LANC_B_*`, `LANC_ADMIN_*`: **TODAS AS VERIFICAÇÕES PASSARAM**.
**Se algo falhar:** manutenção ligada de novo e siga a seção 5/6.

### 3.7 Anunciar a onda 1 (1 min)
☆ Comunicado só ao grupo da onda 1. Acompanhe: Supabase → Logs (4xx/5xx), SendGrid → Activity, atendimento.

### 3.8 Pós-lançamento
☆ Reativar o **Auto-assign** na Vercel. ☆ Após o próximo sync agendado (9h/21h BRT), conferir na aba Actions que terminou com sucesso (usa chave de serviço: não é afetado pelo RLS). ☆ Com a sua autorização: S1/#24, remover `send-email` e `send-push` (D6) e tratar o que a seção 7 apontar.

---

## 4. Ondas de ativação (o que fazer a cada grupo novo)
1. **Antes de liberar:** a onda anterior está estável (sem alerta da seção 5) e o SendGrid sem rejeição acima de 5%.
2. **Cadastrar o grupo:** `insert into public.ativacao_ondas ... onda = N` (2.3).
3. **Liberar:** `update public.ativacao_estado set onda_liberada = N, atualizado_em = now();`
4. **Avisar** só esse grupo; subir o limite de e-mails por hora na medida do grupo.
5. **Conferir:** `J4d_ondas_verificar.sql` (quantas por onda, quantas contas vinculadas) e `verificar-api.mjs`.
6. **Recuar a liberação** (se precisar parar novas ativações): `update ... onda_liberada = N-1`. **Quem já ativou segue normal**; só novas ativações são seguradas.
7. **Lançamento geral:** `update public.ativacao_estado set liberar_todas = true, atualizado_em = now();` (joiners sem onda passam a poder ativar).
**O que as ondas NÃO tocam:** contas, senhas, sessões e qualquer permissão de dados (verificado por teste: liberar uma onda não altera nenhuma linha de `contas_joiner` nem de `auth.users`).

---

## 5. Critérios objetivos para interromper

| Quando | Condição | Ação |
|---|---|---|
| Durante os SQLs | qualquer script termina com erro / "Nada foi alterado" / `_verificar` fora do esperado | **Parar.** Não seguir. Corrigir o motivo (a mensagem diz) ou reverter os já aplicados |
| 3.3 | a auditoria final mostra **qualquer** `INESPERADO`, ou `verificar-api` mostra `visitante LÊ`, ou `verificar-comprovantes-antigos` mostra link ainda aberto | **Parar.** Não publicar o site. Reverter (seção 6) ou corrigir |
| 3.6 | administradora não entra no `/admin`; conta controlada não ativa/entra/recupera; formulário de pedido abre sem conta | Manutenção ligada; voltar o site (6.1) ou tudo (6.2) |
| 3.6 | `verificar-api` com as contas falha (isolamento, valores de terceiros, comprovante de outra pessoa) | **Reverter tudo (6.2).** Falha de proteção |
| E-mail | o código **não chega em 5 min** para 2 das 3 contas controladas | Não anunciar. Conferir SendGrid/limites/spam; ver R1 (plano B) |
| Cada onda | mais de **5 relatos em 30 min** de tela vazia/erro em MASTERLIST, pagamentos ou claims, **ou** erro 5xx em mais de 5% das chamadas por 10 min | Parar de liberar ondas; manutenção + 6.1/6.2 |
| Cada onda | rejeição/bounce do SendGrid acima de **5%** no dia, ou "email rate limit" em mais de 10% dos pedidos de código | Pausar a onda; ajustar limites; retomar em grupos menores |

---

## 6. Reversão (procedimento e ordem)
**Princípio:** nenhum script apaga dado. Reverter **reabre acesso**, nunca perde pedido, ativação ou comprovante. Cada reversão só roda com a **frase escrita por você** dentro do arquivo.

### 6.1 Voltar só o site (rápido)
Vercel → Deployments → o deploy anterior → **Promote** (Instant Rollback). As tabelas continuam fechadas: o site antigo lê como visitante e fica vazio em partes → use 6.2 em seguida **ou** mantenha a manutenção enquanto corrige.

### 6.2 Voltar tudo
1. Manutenção **ligada**. 2. Instant Rollback para o deploy anterior. 3. SQL Editor, **ordem inversa**, editando a frase de cada arquivo:

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

4. `node scripts/lancamento/verificar-api.mjs` volta a mostrar o "antes". Manutenção desligada.
5. **Não** reverta J1, J3, J4-0, J4a, J4d, J4c4e (aditivos): contas, vínculos e senhas **ficam** e ninguém precisa ativar de novo quando o lançamento for refeito.
### 6.3 O que não volta
☆ Comprovantes enviados depois do J5 continuam nos buckets (a reversão só os torna públicos de novo). ☆ O estado anterior de cada etapa está em `emergencia.c0b_estado_anterior`; **não apague** o schema `emergencia` antes de encerrar o lançamento.

---

## 7. D4 — Apps Scripts, GitHub Actions e credenciais (resultado e o que falta)

**O que o repositório mostra e foi conferido:**
| Item | Acesso ao Supabase | Papel | Continua funcionando depois do RLS? |
|---|---|---|---|
| **GitHub Actions `sync-masterlist.yml`** + `scripts/sync-masterlist.js` | direto: lê/escreve `masterlist` e `joiners`, lê `push_subscriptions`, chama `push-evento` | **chave de SERVIÇO** (segredo `SUPABASE_SERVICE_KEY` do GitHub; **não** está no código) | **Sim**: a chave de serviço ignora o RLS. Os gatilhos de proteção de colunas deixam o servidor livre (`auth.uid() is null`) — coberto pelos testes. A conferência real é o **próximo sync agendado** (9h/21h) terminar com sucesso. **Não rode sincronização para testar.** |
| **Apps Script chamado pelo site** (web app, 7 ações: `recebido`, `confirmar`, `repassar`, `cancelar`, `novo_joiner`, `aprovar_disponivel`, `atualizar_joiner`) | **o navegador não envia chave do Supabase** a ele; é o script que fala com a planilha | token fixo no código do site (risco já conhecido, fora do escopo do RLS) | O RLS não o afeta **se** o script não chamar o Supabase |
| **GERADORDEIDS, PAGAMENTO-AUTOMATICO, SYNC-TRIGGER, STATUS-SYNC** | **não consta no repositório**: não dá para saber daqui se falam com o Supabase | **desconhecido** | **VERIFICAÇÃO PENDENTE (bloqueia a janela)** — veja abaixo |

**O que você faz (10 min):** copie o código de cada projeto do Apps Script para arquivos numa pasta sua (ex.: `appsscripts/GERADORDEIDS.gs`, ...) e rode `node scripts/lancamento/auditar-appsscript.mjs appsscripts/`. Para cada um ele diz, **sem imprimir chave**, se acessa o Supabase, **com qual papel** (anon / service_role / guardada nas propriedades do script), em quais tabelas e se **QUEBRA depois do RLS**. Se qualquer um disser `QUEBRA` ou `VERIFICAR`, me mande a saída (só nomes de tabelas e papéis) e eu ajusto antes da janela. O Google Sheets continua sendo a ferramenta principal de edição: nenhum script do repositório o altera.

**Credenciais de serviço expostas no frontend:** `node scripts/lancamento/auditar-segredos.mjs` examina `src`, `public`, `index.html` e `dist`; com `--historico` varre **todos os commits**. Resultado nesta revisão: **nenhuma** chave de serviço, chave do SendGrid, token do Supabase/GitHub ou chave privada; o único JWT em todo o histórico (1274 commits) tem papel **anon** (a chave pública esperada). O teste automático (`tests/auditores.test.mjs`) prova que o auditor acha chave de serviço/SendGrid e **nunca imprime o segredo**.

---

## 8. Riscos que continuam
☆ **R1 — código de ativação com o cadastro público desligado:** a função cria a conta pelo painel administrativo e pede o código ao Auth. Isso depende de como o GoTrue trata um usuário criado sem confirmação, e **não pôde ser testado aqui** (o laboratório local não é o Supabase). Por isso existe o teste de 2.4 com o **seu** @, antes da janela. **Plano B** se o e-mail não chegar: ligar o cadastro público (D3 aprovado com condições); **todas as condições seguem atendidas** (conta sem vínculo não acessa nada, limites, respostas neutras), só deixa de valer a camada (2) de 2.5.
☆ Os testes de banco usam PGlite (Postgres local): **não equivalem a validar o Supabase real**. A prova no real é: `99_auditoria_final.sql`, `verificar-api.mjs`, `verificar-comprovantes-antigos.mjs` e a fumaça com contas controladas — todas somente leitura.
☆ Tabelas sem SQL no repositório foram levantadas pelo código; cada script **aborta sem alterar nada** se uma coluna esperada não existir.
☆ Sem teste de navegador automático: claims reais, pré-venda completa, Mercari, lojinha e repasses (a lógica está testada no banco; a tela entra na fumaça manual).
☆ Compras e comprovantes de **visitantes** deixam de existir (D2): quem não ativou precisa esperar a onda.
☆ O aviso por e-mail de **cadastro novo** feito por visitante continua bloqueado depois do lançamento (decisão antiga do #21); a administradora vê os pedidos no painel.
☆ D6 (funções antigas `send-email`/`send-push`) e S1/#24 seguem para depois do lançamento, com a sua autorização.
