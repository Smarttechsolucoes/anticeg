# Proxy `planilha-acao` + rotação do token do Apps Script — pacote para aprovação (17/10/2026)

**Nada foi publicado, nenhum token foi rotacionado, nenhum script/gatilho foi alterado, e nenhum dado real foi usado para testar.** Este pacote está na `main` atual (merge feito em `seguranca/planilha-proxy-main`).

## 1. O problema
O Web App do Apps Script (`doPost`, 7 ações) só pede um token, e esse token (`anticeg-pag-2026`) está escrito no JavaScript público do site. Qualquer pessoa pode marcar pagamento, cancelar, repassar, aprovar claim e cadastrar/alterar joiner **na planilha**; o sync leva isso para o banco (um "pago" na planilha vira "pago" no site), contornando o R1.

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

## 5. Sequência segura (cada passo com verificação e volta)
| # | Passo | Quem | Verificação / sonda (sem gravar dado real) | Volta |
|---|---|---|---|---|
| S0 | Você me envia: "Executar como" e "Quem tem acesso" do Web App; tipo e escopo do `GITHUB_TOKEN`; e o nome/uso dos outros 2 projetos | você | — | — |
| S1 | **Gerar o token novo** (32 bytes aleatórios) **na sua máquina**: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Guardar só no seu gerenciador de senhas. **Nunca colar no chat** | você | — | — |
| S2 | **Apps Script — colar o patch v2** em `PAGAMENTO-AUTOMATICO` (substituir o arquivo pelo `appsscript/PAGAMENTO-AUTOMATICO.gs`), criar a propriedade `ANTICEG_TOKEN_NOVO` = token novo, e **reimplantar a MESMA implantação** ("Gerenciar implantações" → editar → Nova versão; a URL `/exec` não muda). `ANTICEG_TOKEN` (o antigo) **não é mexido** | você | `node scripts/lancamento/sondar-webapp.mjs aceito` com `WEBAPP_TOKEN` = antigo → "aceito"; com o novo → "aceito"; com um valor inventado → `recusado`. A sonda usa um item inexistente (nada é gravado, sem sync) | recolar o arquivo anterior e reimplantar; apagar `ANTICEG_TOKEN_NOVO` |
| S3 | **Supabase — segredos**: `PLANILHA_URL` (a URL `/exec`) e `PLANILHA_TOKEN` (o token novo), sem imprimir o valor: PowerShell `$t = Read-Host -AsSecureString ...` (ou o painel: Edge Functions → Secrets). **Não** definir `PLANILHA_EXIGIR_CONTA` ainda | você (ou eu, se você preferir ditar o valor localmente) | `npx supabase secrets list` mostra só os nomes | `secrets unset` |
| S4 | **Publicar a função**: `npx supabase functions deploy planilha-acao --project-ref ghjfsmwwcfpfvrouyrka` | eu | `node scripts/lancamento/sondar-planilha-acao.mjs`: **todas as verificações recusadas** (403/400), nenhuma resposta cita token/endereço; nada gravado | `npx supabase functions delete planilha-acao` |
| S5 | **Migrar o front**: abrir/mesclar a PR `seguranca/planilha-proxy-main` (rascunho) → deploy. O site passa a chamar `planilha-acao`; o Apps Script continua aceitando o token antigo (rede de segurança para qualquer aba aberta com o site velho) | eu (mesclar só com sua autorização) | o pacote servido **não contém** `anticeg-pag-2026` nem `script.google.com`; teste de navegador; as primeiras operações reais (um pagamento, uma rejeição, um cadastro) conferidas nos logs da função e na planilha — **não forço operação real para testar** | reverter a PR (o token antigo ainda vale, o site velho volta a funcionar) |
| S6 | **Observação (24–48 h)**: no Apps Script → Execuções/Registros, as chamadas autenticadas aparecem como "token novo" (proxy) ou "token atual" (site velho). Quando **só** aparecer "novo" por um período sem exceção, seguir | eu leio com você | contagem de "atual" = 0 por 24 h | — |
| S7 | **Rotacionar**: em `ANTICEG_TOKEN` colocar o valor novo e **apagar** `ANTICEG_TOKEN_NOVO`; reimplantar a mesma implantação | você | `sondar-webapp.mjs recusado` com o token antigo `anticeg-pag-2026`; `aceito` com o novo; uma operação real pelo site continua funcionando | recolocar o valor antigo em `ANTICEG_TOKEN` (o site velho é que dependia dele; o proxy continua com o novo se `ANTICEG_TOKEN_NOVO` voltar) |
| S8 | **Lançamento do login**: `PLANILHA_EXIGIR_CONTA=true` (junto da Fase B) | eu, na janela | matriz do §3, coluna "login" | `secrets unset PLANILHA_EXIGIR_CONTA` |

## 6. Critérios de parada
☆ A sonda do S2 mostra token antigo recusado ou novo recusado → não seguir; recolar o arquivo anterior.
☆ O S4 mostra qualquer resposta 2xx para o visitante, ou um segredo/URL na resposta → apagar a função e investigar.
☆ Depois do S5, uma operação legítima do site falha com "negado" sem motivo (ex.: pagamento em análise legítimo recusado) → reverter a PR do front (o token antigo ainda vale).
☆ Antes do S7, "token atual" ainda aparece nos registros → não rotacionar.
☆ Erro 5xx na função ou "indeterminado" (502) repetido.

## 7. Testes feitos (tudo local, sem tocar a planilha real)
☆ `planilha.test.ts` 16 testes (inclui a **matriz** 7×4×2 e a regra "a planilha só espelha o cadastro" no `atualizar_joiner`); `planilha-api.test.mjs` 19 (front: o navegador não contém o token nem o endereço; ações de administração usam o login da administradora); `appsscript-doPost.test.mjs` 10 (o **doPost v2 real** rodando num simulador: token antes da trava, dois tokens, token antigo recusado após a rotação, nenhum token em resposta ou log).
☆ Sondas prontas: `scripts/lancamento/sondar-planilha-acao.mjs` (proxy, só chave pública, tudo recusado) e `scripts/lancamento/sondar-webapp.mjs` (Web App direto, item inexistente, token por variável de ambiente, nunca impresso).

## 8. STATUS-SYNC
Nenhum dos 3 arquivos entregues (nem as versões antigas de Downloads) chama qualquer função de status nem usa `CONFIG` (o gerador novo usa `GERADOR_CONFIG`). Sem o texto do STATUS-SYNC não dá para provar de fora, mas **ele não pode funcionar** neste projeto: depende de `CONFIG`, que não existe mais (`ReferenceError`). Para fechar a conclusão "sem uso", confira em **Apps Script → Execuções** (filtro pelo nome da função, últimos 90 dias): se não houver execuções, está sem uso. Recomendo **não apagar** agora (pendência da Fase 2 do pacote de 15/10).
