# Proxy `planilha-acao` + rotação do token do Apps Script — pacote para aprovação (17/10/2026)

**Nada foi publicado, nenhum token foi rotacionado, nenhum script/gatilho foi alterado, e nenhum dado real foi usado para testar.** Este pacote está na `main` atual (merge feito em `seguranca/planilha-proxy-main`).

## 1. O problema
O Web App do Apps Script (`doPost`, 7 ações) só pede um token, e esse token (`anticeg-pag-2026`) está escrito no JavaScript público do site. Qualquer pessoa pode marcar pagamento, cancelar, repassar, aprovar claim e cadastrar/alterar joiner **na planilha**; o sync leva isso para o banco (um "pago" na planilha vira "pago" no site), contornando o R1.

**Configuração confirmada pela dona (17/10):** Web App "Executar como: Eu (proprietária) · Quem pode acessar: Qualquer pessoa · App da Web". Ou seja: o endereço é público e o script roda com as permissões da conta dona; **o único controle é o token**. Por isso a retirada do token do navegador e a rotação são a correção, e o Web App **não será alterado antes de o fluxo novo estar funcionando** (§5).

## 2. A solução (já escrita e testada)
☆ O navegador deixa de falar com o Apps Script: chama a Edge Function **`planilha-acao`** com o login de quem usa o site. A função decide **quem pode fazer o quê, em qual item**, e só então repete a chamada ao Apps Script com um token que só o **servidor** conhece (`PLANILHA_TOKEN`). O corpo enviado é montado campo a campo (lista branca); a chave de serviço não é aceita como credencial; o segredo nunca volta na resposta.
☆ O Apps Script ganha o patch **v2** (`appsscript/PAGAMENTO-AUTOMATICO.gs`, diff em `appsscript/PAGAMENTO-AUTOMATICO_v2.diff`): token conferido **antes** da trava e da ação, comparação exata, e **dois tokens aceitos durante a migração** (`ANTICEG_TOKEN` atual e `ANTICEG_TOKEN_NOVO`), para trocar sem derrubar o site. Isso **não é** a solução sozinho: sem o proxy o token continuaria no navegador.

## 3. Autorização por ação (verificada por teste de matriz: 7 ações × 4 identidades × 2 modos)
Identidade vem do login (token do Supabase Auth): **administradora** (`is_admin()`), **joiner com conta ativada** (`meu_cog()`), **visitante**. O modo "legado" (sem login das joiners) é o de hoje; o modo "login" liga com `PLANILHA_EXIGIR_CONTA=true` no lançamento.
| Ação | Quem pode | Propriedade do item / prova exigida | Visitante · dona · outra joiner · admin (legado) | (login exigido) |
|---|---|---|---|---|
| `cancelar` | **só administradora** | o item está num comprovante **rejeitado** no banco, nos valores registrados | 403 · 403 · 403 · **200** | igual |
| `repassar` | **só administradora** | repasse **aprovado** e o novo dono já gravado no item | 403 · 403 · 403 · **200** | igual |
| `aprovar_disponivel` | **só administradora** | claim **aprovado** daquele novo dono, vencimento obrigatório | 403 · 403 · 403 · **200** | igual |
| `novo_joiner` | administradora, ou o **pedido de cadastro recente** (30 min) com os mesmos dados | nome e @ iguais ao pedido | 200* · 200* · 200* · 200 | igual (cadastro novo ainda não tem conta) |
| `confirmar` | a dona do pagamento | item no pagamento **em análise** (180 min) **dela**, valores ≤ registrados, **e a linha pertence a quem pagou** | 200† · **200** · 403 · 200 | 401 · **200** · 403 · 401 |
| `recebido` | a dona do item | item é **dela** (login) ou existe **relato recente** dela sobre o item | 200† · **200** · 403 · 200 | 401 · **200** · 403 · 401 |
| `atualizar_joiner` | a dona do cadastro | alteração de cadastro **recente** com estes dados **e o cadastro dela já tem o novo @**; o @ antigo não é de outra pessoa | 200† · **200** · 403 · 200 | 401 · **200** · 403 · **200** |
\* só se existir pedido de cadastro recente com os mesmos dados (o teste usa um). † só com a **prova no banco** (pagamento/relato/alteração recente); sem ela, 403.
☆ **As 3 ações de administração (cancelar, repassar, aprovar_disponivel) ficam seguras já na publicação**: dependem do login da administradora, que existe hoje (3 contas).
☆ **As 3 ações da joiner e o cadastro por visitante dependem de provas escritas no banco por quem chama** (pagamento, relato, confirmação, pré-cadastro). Hoje o banco aceita escrita do visitante nessas tabelas, então **a prova pode ser forjada** por quem conhece o COG/IDs de outra joiner. Efeito prático: deixa de ser "qualquer pessoa, a qualquer hora, qualquer valor" e vira "precisa forjar um registro no banco que a administradora vê, dentro de 30–180 minutos, para itens que já constam desse registro". **Isso fecha de verdade no lançamento** (J4b/J4c: o visitante deixa de escrever nessas tabelas; e `PLANILHA_EXIGIR_CONTA=true` passa a exigir a conta da dona). Até lá, o risco residual é este e vale o acompanhamento.

## 4. O que o Apps Script faz com isso (compatibilidade)
☆ As mesmas 7 ações, os mesmos campos (conferido contra o `doPost`: o campo `nome_novo` que o site enviava **não é lido** pelo script, então o proxy pode descartá-lo). A resposta do script passa como está (`ok`, `parcial`, `nao_processados`, `sync`, `aviso`); o site novo já interpreta (PR #30, dentro do pacote).
☆ `confirmar` com `id_linha` inexistente **não grava nem dispara sync** (conferido no código): é a sonda segura.

## 5. Sequência segura — o novo fluxo funciona ANTES de qualquer mudança no Apps Script
**Regra:** nenhum passo abaixo mexe na implantação do Apps Script nem no token até o fluxo novo (site → `planilha-acao` → Web App) estar funcionando com **operações reais**. No começo, o proxy usa o **mesmo token que o site usa hoje**; o Web App nem percebe a mudança.
| # | Passo | Quem | Verificação (sem gravar dado real) | Volta |
|---|---|---|---|---|
| S0 | Você já confirmou: *Executar como: Eu · Acesso: Qualquer pessoa · App da Web*. Falta só: tipo e escopo do `GITHUB_TOKEN` e o uso dos outros 2 projetos | você | — | — |
| S1 | **Segredos do Supabase**: `PLANILHA_URL` = a URL `/exec` atual e `PLANILHA_TOKEN` = o **token atual do Web App** (o mesmo que o site manda hoje). Sem `PLANILHA_EXIGIR_CONTA`. Valores nunca impressos | eu (ou você, pelo painel) | `npx supabase secrets list` mostra só os nomes | `secrets unset` |
| S2 | **Publicar a função**: `npx supabase functions deploy planilha-acao --project-ref ghjfsmwwcfpfvrouyrka` | eu | `node scripts/lancamento/sondar-planilha-acao.mjs`: todas as verificações **recusadas**, nada gravado, nenhuma resposta cita token/endereço. Como a configuração dos segredos é conferida **antes** da autorização, um 403 do visitante (e não 500 "planilha não configurada") prova que os segredos estão presentes | `functions delete planilha-acao` |
| S3 | **Prova de que o Web App aceita o token que o proxy usa**, sem gravar: `sondar-webapp.mjs aceito` com `WEBAPP_TOKEN` = o token atual (item inexistente, só lê) | eu/você | "aceito (nada gravado, sem sync)" | — |
| S4 | **Migrar o front**: mesclar a PR #41 (hoje em rascunho) → deploy. O site passa a chamar `planilha-acao`; o token **sai do JavaScript público** (conferir no pacote servido) | eu, **só com sua autorização** | pacote servido sem `anticeg-pag-2026` nem `script.google.com`; teste de navegador; **as primeiras operações reais** (um comprovante de pagamento, uma rejeição, um cadastro, um repasse) conferidas no registro da função e na planilha. Não forço operação real para testar | reverter a PR #41 (o Web App não mudou; o site velho volta a funcionar) |
| S5 | **Observação** até o fluxo novo ter funcionado com operações reais de cada tipo que ocorrerem (mínimo 24 h). Nesse período o token antigo **ainda é válido** (é o risco que se aceita para não interromper nada) | nós | registro da função `planilha-acao` sem erro; nenhuma operação legítima negada sem motivo | — |
| S6 | **Só agora mexer no Apps Script (nova versão da MESMA implantação, URL `/exec` não muda):** colar o patch v2 (`appsscript/PAGAMENTO-AUTOMATICO.gs`) e criar a propriedade `ANTICEG_TOKEN_NOVO` = token novo (gerado na sua máquina: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`, guardado só no seu gerenciador de senhas, nunca no chat). `ANTICEG_TOKEN` (antigo) continua valendo | você | `sondar-webapp.mjs aceito` com o antigo → aceito; com o novo → aceito; `recusado` com um valor inventado. Registro do Apps Script passa a dizer "token atual" × "token novo" | recolar o arquivo anterior, reimplantar, apagar `ANTICEG_TOKEN_NOVO` |
| S7 | **Trocar o token do proxy**: `PLANILHA_TOKEN` = token novo; **redeploy** da função (`functions deploy planilha-acao`) para garantir que pega o segredo | eu | uma operação real pelo site continua funcionando; no registro do Apps Script as chamadas passam a aparecer como **"token novo"** e as de "token atual" param (esperar 24 h com **zero** "token atual") | `PLANILHA_TOKEN` = token antigo + redeploy |
| S8 | **ROTAÇÃO (fecha a vulnerabilidade):** em `ANTICEG_TOKEN` colocar o valor novo e **apagar** `ANTICEG_TOKEN_NOVO`; reimplantar a mesma implantação | você | **verificação das chamadas diretas** (abaixo) + uma operação real pelo site funcionando | recolocar o valor antigo em `ANTICEG_TOKEN` (o proxy usa o novo via `ANTICEG_TOKEN_NOVO` se ainda existir; senão, atualizar `PLANILHA_TOKEN`) |
| S9 | **Lançamento do login**: `PLANILHA_EXIGIR_CONTA=true` (junto da Fase B) | eu, na janela | coluna "login" da matriz do §3 | `secrets unset PLANILHA_EXIGIR_CONTA` |

### Verificação de que chamadas diretas ao Web App são rejeitadas depois da rotação (S8) — sem interromper operações legítimas
1. `WEBAPP_URL` = a URL `/exec`, `WEBAPP_TOKEN` = o **token novo**, e rodar `node scripts/lancamento/sondar-webapp.mjs apos-rotacao`. Esperado, todos sem gravar nada (item inexistente):
   ☆ token novo → **aceito** (o proxy continua funcionando);
   ☆ `anticeg-pag-2026` (o token que esteve no site) → **recusado**;
   ☆ token vazio, inventado, o novo com 1 caractere a menos e com a caixa trocada → **recusados**.
2. A conferência do token vem **antes** da trava e **antes** de qualquer ação no `doPost` v2, então a recusa vale para as 7 ações, não só para `confirmar` (provado no teste do simulador `appsscript-doPost.test.mjs`: ação válida, inválida ou ausente com token errado dão a mesma resposta "Token inválido", sem tocar a trava nem a planilha). Por isso a sonda usa só `confirmar` com item inexistente: com token aceito ela não grava, e as outras 6 ações **não devem ser testadas diretamente** (aceitas, gravariam).
3. Operação legítima: abrir o site e fazer uma operação real de rotina (ex.: o próximo comprovante de pagamento) e conferir na planilha e no registro da função `planilha-acao` ("token novo" no registro do Apps Script).
4. Uma semana depois, conferir no registro do Apps Script que **nenhuma** chamada aparece como "token atual"; qualquer tentativa externa aparece apenas como "Token inválido".
5. Como o Web App é "Qualquer pessoa" executando "Como eu", **o único controle é o token**: guardá-lo só em dois lugares (propriedade do script e segredo do Supabase), nunca no site, no GitHub, em chat ou e-mail. Reforço opcional futuro: assinatura HMAC com horário (impede reutilização de uma chamada capturada).

## 6. Critérios de parada
☆ S2: qualquer resposta 2xx para o visitante, ou segredo/URL na resposta → apagar a função e investigar.
☆ S3: o Web App não aceita o token atual → não migrar o front (o proxy não funcionaria).
☆ Depois do S4: uma operação legítima falha com "negado" sem motivo (ex.: pagamento em análise legítimo recusado) ou "indeterminado" (502) repetido → reverter a PR #41 (o Web App não mudou, o site velho volta a funcionar).
☆ S6: o token atual deixa de ser aceito, ou o novo é recusado → recolar o arquivo anterior.
☆ S8: **não rotacionar** se ainda aparecer "token atual" nos registros do Apps Script, ou se o proxy ainda usa o token antigo.
☆ Depois do S8: a sonda  aceita o token público antigo, ou recusa o novo → recolocar o valor anterior e investigar antes de seguir.

## 7. Testes feitos (tudo local, sem tocar a planilha real)
☆ `planilha.test.ts` 16 testes (inclui a **matriz** 7×4×2 e a regra "a planilha só espelha o cadastro" no `atualizar_joiner`); `planilha-api.test.mjs` 19 (front: o navegador não contém o token nem o endereço; ações de administração usam o login da administradora); `appsscript-doPost.test.mjs` 10 (o **doPost v2 real** rodando num simulador: token antes da trava, dois tokens, token antigo recusado após a rotação, nenhum token em resposta ou log).
☆ Sondas prontas: `scripts/lancamento/sondar-planilha-acao.mjs` (proxy, só chave pública, tudo recusado) e `scripts/lancamento/sondar-webapp.mjs` (Web App direto, item inexistente, token por variável de ambiente, nunca impresso).

## 8. STATUS-SYNC
Nenhum dos 3 arquivos entregues (nem as versões antigas de Downloads) chama qualquer função de status nem usa `CONFIG` (o gerador novo usa `GERADOR_CONFIG`). Sem o texto do STATUS-SYNC não dá para provar de fora, mas **ele não pode funcionar** neste projeto: depende de `CONFIG`, que não existe mais (`ReferenceError`). Para fechar a conclusão "sem uso", confira em **Apps Script → Execuções** (filtro pelo nome da função, últimos 90 dias): se não houver execuções, está sem uso. Recomendo **não apagar** agora (pendência da Fase 2 do pacote de 15/10).
