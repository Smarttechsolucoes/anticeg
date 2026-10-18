# Envio Nacional — plano para hoje: ordem, testes reais, GO/NO-GO e reversão
Estado: **preparado e testado em rollback/navegador simulado. NADA mesclado, NADA aplicado, NENHUM link gerado.**
Peças: front (PR #54) · `ENV1` (tabelas de envio, comprovantes, storage-itens) · `JOINERS1` (CPF e endereço fora da leitura/gravação do visitante).

## 1. O que cada peça fecha
| Exposição | Peça | Resultado |
|---|---|---|
| Solicitações, endereços, CPF e comprovantes de envio, grupos, storage, rodadas, rastreios abertos ao visitante | ENV1 | só a joiner dona (link pessoal) e a administração |
| `storage-itens` listável/apagável | ENV1 | só a administração (conta admin) |
| CPF + endereço na tabela `joiners` (cpf, cep, rua, numero, complemento, bairro, cidade, estado, nome_entrega) | JOINERS1 | o visitante não lê nem grava essas 9 colunas; a joiner vê/edita as dela só pelo link; a administração lê tudo |
| 22 comprovantes antigos públicos | script de migração (preparado) | executar só com sua autorização, em etapas, sem apagar antes de conferir |

## 2. E-mail e WhatsApp (avaliação objetiva)
- O `select("*")` do login **não é** o motivo: ele é resolvido com a lista explícita de colunas (já feita).
- O motivo é que o **@ é público e não é segredo** (a lista de @ e nomes é legível, e o login devolve a linha de quem digitar o @). Qualquer caminho que entregue e-mail/WhatsApp a quem só informa o @ equivale a deixá-los públicos: bastaria varrer os @.
- Para protegê-los de verdade eles só podem ir a quem tem identidade forte (link pessoal/conta) ou ficar só no servidor. Isso mexe em **~44 pontos** do código: ~18 usos de `user.email` e 13 de `user.whatsapp` (pré-preenchimento de formulários, e-mail de comprovante, gravação de `joiner_email` nos pedidos, relatório que exige WhatsApp) mais ~8 leituras do painel admin (essas são só trocar para a conta admin). A parte de e-mail depende ainda da PR #21 (e-mail resolvido no servidor).
- **Conclusão:** não é indispensável nem seguro fazer hoje sem abrir uma fase nova. Fica como "fase 2b" (mesmo link pessoal, PR #21). Até lá, e-mail e WhatsApp continuam legíveis pelo visitante; CPF e endereço, não.

## 3. Ordem de implantação (hoje), com testes reais
| # | Passo | Verificação |
|---|---|---|
| 0 | Pré-condições: sem sync em andamento (`gh run list`); você confirma quem opera envios (menu "Envios" só para essas pessoas) | — |
| 1 | **Mesclar a PR #54** (Vercel publica o front: login por @ com colunas explícitas, aba Envio por link, Perfil protegido) | site abre; **login real com o @ da Nanda** (`nandaverseo_c`): entra, MASTERLIST, Perfil e Claims abrem; `/envio` sem link mostra o aviso |
| 2 | **Aplicar `ENV1_acesso_aplicar.sql`** | termina sem erro; contagens/conteúdo das 7 tabelas idênticos |
| 3 | **Aplicar `JOINERS1_aplicar.sql`** (logo em seguida) | termina sem erro; contagem e conteúdo de `joiners` idênticos |
| 4 | **Sonda pública** `node scripts/envio-sondar-visitante.mjs --joiners` | **0 FALHAS** (hoje: 10) |
| 5 | **Teste real do site (visitante e login):** login por @ com a conta da Nanda de novo, Perfil → Endereço mostra o aviso; MASTERLIST, Claims e uma página pública abrem sem erro | sem erro de permissão em nenhuma tela |
| 6 | **Teste real do painel:** entrar com a conta admin; abrir Envios (lista), uma solicitação, cotação, rastreio, aba Storage e Rastreios | tudo abre e grava |
| 7 | **Link de teste (1 só, da Nanda):** gerar, abrir, pedir envio de teste, escolher modalidade, anexar comprovante; ver o comprovante pelo painel; **cancelar a solicitação de teste** | fluxo completo sem erro; revogar o link no fim |
| 8 | Só então: gerar os links do piloto (as 8 joiners abaixo), CSV fora do repositório; a equipe envia | — |
| 9 | Migração dos 22 comprovantes antigos: **só com autorização separada** | — |

**Se qualquer um dos passos 2 a 7 falhar: parar a abertura e reverter** (seção 5).

## 4. Piloto proposto (8 joiners; nenhum link gerado)
starsceg, barbaragasp_, evelyn_ofic, stayme_straykids, danicaliope_, dezalourenco, jeongsluvbot, nicknowsaurus (todas com 1 ou 2 itens no storage e envio anterior; 4 com CPF/CEP salvos para testar o preenchimento).

## 5. Reversão (cada peça é independente)
| Problema | Ação |
|---|---|
| Login/Perfil/telas do site com erro de permissão em `joiners` | `JOINERS1_reverter.sql` (devolve SELECT/UPDATE originais ao visitante; ~1 min) |
| Painel admin ou envio por link com falha | `ENV1_acesso_reverter.sql` (policies, privilégios, RLS e Storage originais; ~2 min) e, se preciso, reverter o merge da #54 |
| Link vazado ou enviado à pessoa errada | `node scripts/envio-links.mjs --revogar --cogs <@>` |
Os ensaios em rollback provaram que aplicar + reverter devolve o estado original idêntico (ENV1 e JOINERS1). Dados nunca são tocados.

## 6. Checklist GO / NO-GO (todos SIM)
1. ☐ Você autoriza o merge da #54 e a aplicação do ENV1 e do JOINERS1 (peças separadas).
2. ☐ Você confirma quem opera envios; o menu "Envios" será habilitado só para essas pessoas (configuração `staff_acessos`; **nenhum papel admin novo**). Contas admin hoje: 3 (Letícia e duas "na…").
3. ☐ Sem sync em andamento na hora de aplicar.
4. ☐ Você confirma os 5 passos de teste real (login real da Nanda, Perfil, painel, link de teste).
5. ☐ Você aceita o que permanece: e-mail e WhatsApp legíveis (fase 2b); fotos do storage abrem por quem tem o endereço exato; os 22 comprovantes antigos públicos até a migração.
