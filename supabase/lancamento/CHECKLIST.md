# Checklist do lançamento (resumo objetivo; o detalhe está em `LANCAMENTO.md`)

## 1. O que está pronto (código, SQL, testes e roteiro — nada foi executado em produção)
☆ **Proteção dos dados (RLS):** J4b, J4c-1, J4c-2, J4c-3 e **J4c-4a–e** (Mercari, lojinha, repasses, claims em sets com regras no servidor, feedbacks, notificações, avisos, storage, conferências, fila de envio, administração, catálogos, CEGs sem valores de terceiros). Cada um com aplicar, verificar e reversão protegida.
☆ **J5 comprovantes:** buckets privados, envio só autenticado (`comprovante-upload`), leitura por link assinado de 10 min (`comprovante-url`), donas dos arquivos antigos registradas pelo servidor, **nenhum arquivo movido ou apagado**, inventário prévio e verificação de que os links antigos deixaram de abrir.
☆ **D1** (valores de terceiros ocultos nos CEGs), **D2** (pedido e comprovante só com conta ativada, servidor e site) e **D3** (conta criada sem vínculo não acessa nada; `pedir-codigo-joiner` com limites, respostas neutras e sem depender do cadastro público do Auth).
☆ **Ativação em ondas (J4d):** liberar um grupo não toca em conta, senha, sessão nem permissão de dados; quem não foi liberada fica em modo limitado com aviso amigável.
☆ **Modo limitado só com @:** teste de navegador percorre 12 áreas protegidas + 4 públicas: nenhuma toca em tabela privada.
☆ **D4:** sincronização do GitHub usa chave de **serviço** (não é afetada pelo RLS); auditores prontos para os Apps Scripts e para segredos; varredura de **todo o histórico do git**: só a chave pública (anon).
☆ **Testes locais (todos passam):** 6 suítes de navegador, 15 de banco (incluindo a **sequência completa do lançamento + auditoria final**, isolamento entre **COGs parecidos** em 14 tabelas e contas sem vínculo em 43 tabelas/visões), 86 testes de funções, módulos e scripts.
☆ **Verificações somente leitura na produção:** `00_preflight_leitura.sql`, `J5_inventario_leitura.sql`, `99_auditoria_final.sql`, `verificar-api.mjs`, `verificar-comprovantes-antigos.mjs`, `auth-settings.mjs`, `auditar-segredos.mjs`, `auditar-appsscript.mjs`.
☆ **PR #29** (rascunho) com tudo isso.

## 2. O que AINDA bloqueia a implantação (só você consegue destravar)
| # | Bloqueio | Como destravar |
|---|---|---|
| B1 | **D4: os 4 Apps Scripts** (GERADORDEIDS, PAGAMENTO-AUTOMATICO, SYNC-TRIGGER, STATUS-SYNC) não estão no repositório: não sei se falam com o Supabase nem com qual papel | Copie o código de cada um para uma pasta e rode `node scripts/lancamento/auditar-appsscript.mjs <pasta>`; me envie a saída (sem chaves). Qualquer `QUEBRA`/`VERIFICAR` precisa de correção **antes** da janela |
| B2 | **R1: o código chega com o cadastro público do Auth desligado?** Não dá para provar fora do Supabase real | Teste de 2.4 do roteiro (um `curl` com o **seu** @ e e-mail do cadastro, estando na onda 1). Se não chegar, ligamos o cadastro (plano B, já aprovado com condições) |
| B3 | **Revisar o inventário** dos comprovantes e o **pré-voo** dos cadastros | Rodar `J5_inventario_leitura.sql` e `00_preflight_leitura.sql`. Decidir sobre: ALERTA de tabela fora do mapeamento, arquivos sem dona, joiners sem e-mail válido/único (ficam em modo limitado até corrigir o cadastro) |
| B4 | **Duas administradoras** com login e senha funcionando | Confirmar `admin_roles` (≥ 2) e que cada uma entra no `/admin` |
| B5 | **Backup** feito e **quem entra na onda 1** | `2.1` do roteiro; lista de @ da onda 1 (você + contas A e B + grupo pequeno) |
| B6 | **Autorização para mesclar** a cadeia #19 → #28 → #29 e para publicar | Você diz; só então eu mescle, **sempre com `VITE_JOINERS_AUTH` desligada** (e #21 só depois de publicar as funções) |
| B7 | **Vercel:** existe "Auto-assign Custom Domains" desligável na sua conta? | Settings → Environments → Production. Se não existir, usamos a alternativa de 3.5 (build de 1–2 min dentro da manutenção) |

## 3. Ordem exata de aplicação
**Fase A (dias antes, sem impacto):** 1) backup · 2) pré-voo + inventário + auditores (D4) · 3) SQLs: **N1 → J1 → J3 → J4-0 → J4a → J4d → J4c4e** (cada um + `_verificar`) · 4) cadastrar a **onda 1** · 5) **funções**: `email-evento, push-evento, login-joiner, recuperar-senha-joiner, pedir-codigo-joiner, comprovante-upload, comprovante-url` + segredos · 6) teste do código com o seu @ · 7) Vercel: Auto-assign desligado + `VITE_JOINERS_AUTH=true` (Production) · 8) mesclar PRs com a chave desligada · 9) contas controladas e comunicado.
**Fase B (janela ≈ 30 min):** 1) manutenção ON · 2) SQLs **J4b → J4c1 → J4c2 → J4c3 → J4c4a → J4c4b → J4c4c → J4c4d → J5** (cada um + `_verificar`) · 3) `99_auditoria_final.sql` + `verificar-api.mjs` + `verificar-comprovantes-antigos.mjs` · 4) segredos `EMAIL_MODO_SECO=false` e `PERMITIR_COMPROVANTE_ANONIMO=false`, modelos de e-mail, **liberar só a onda 1** · 5) **Promote** do site · 6) manutenção OFF **sem anunciar** + fumaça com as contas A/B e a administradora · 7) anunciar a onda 1.
**Depois:** ondas 2, 3… (cadastrar grupo → liberar → avisar → conferir) · Auto-assign de volta · conferir o próximo sync agendado · (com autorização) S1/#24 e remoção de `send-email`/`send-push`.

## 4. O que você precisa fazer manualmente
☆ Colar e rodar cada SQL no SQL Editor (um por vez) e olhar o `_verificar`. ☆ Publicar as 7 funções e digitar os segredos **só no seu computador**. ☆ Mexer no painel do Auth (modelos de e-mail, limites, conferir cadastro desligado). ☆ Vercel: Auto-assign, variável, **Promote**. ☆ Exportar o código dos 4 Apps Scripts e rodar o auditor. ☆ Rodar os scripts somente leitura com as suas chaves **públicas** e as contas controladas (com autorização das donas). ☆ Criar o grupo de cada onda e avisar as joiners. ☆ Autorizar merges e a janela.

## 5. Como testar e como reverter
**Testar (antes de confiar):** `node tests/sql/lancamento-completo.mjs` (sequência inteira) · `node --test supabase/functions/_shared/*.test.ts tests/*.test.mjs` · e2e (`npx vite` nas portas 5197 ligado/5199 desligado/5198 admin; `node tests/joiner-*.e2e.mjs tests/comprovantes.e2e.mjs tests/admin-auth.e2e.mjs`). **Atenção:** PGlite **não** equivale ao Supabase real; a prova no real é `99_auditoria_final.sql` + `verificar-api.mjs` + `verificar-comprovantes-antigos.mjs` + fumaça (todos somente leitura).
**Interromper se** (tabela completa na seção 5 do roteiro): script aborta/`_verificar` fora do esperado · auditoria com `INESPERADO` · link antigo de comprovante ainda abre · `verificar-api` com `visitante LÊ` ou falha de isolamento · admin não entra · conta controlada não ativa ou código não chega em 5 min · mais de 5 relatos de tela vazia em 30 min · bounce > 5%.
**Reverter:** 6.1 voltar só o site (Instant Rollback) · 6.2 tudo: manutenção ON → Rollback → `*_reverter_protegido.sql` em **ordem inversa** (J5 → J4c4d → J4c4c → J4c4b → J4c4a → J4c3 → J4c2 → J4c1 → J4b), cada um com a frase escrita por você. **Nada é apagado**: contas, senhas, vínculos e comprovantes ficam; a reversão só reabre acesso. Ondas: recuar a liberação (`onda_liberada = N-1`) **não** afeta quem já ativou.
