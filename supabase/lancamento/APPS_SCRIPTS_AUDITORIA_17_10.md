# Auditoria dos Apps Scripts — com o código entregue em 17/10/2026 (somente leitura; nada foi alterado em gatilhos, scripts ou integrações)

Arquivos analisados (`C:\Users\Nanda\anticeg\appsscripts\`): `GERADORDEIDS.gs`, `PAGAMENTO-AUTOMATICO_para_auditoria.gs`, `SYNC-TRIGGER_para_auditoria.gs` (+ versões antigas de Downloads só como comparação). `STATUS-SYNC` não foi entregue e não é necessário (ver 2).

## 1. Estrutura real (sem presumir 4 projetos)
☆ **Os 3 arquivos são partes de UM mesmo projeto** (vinculado à planilha): `PAGAMENTO-AUTOMATICO` chama `triggerSync()` (definida em SYNC-TRIGGER) e `preencherCodigos()` / `gerador_garantirLinha()` (definidas em GERADORDEIDS) sem importar nada, e todos usam `getActiveSpreadsheet()`. Isso só funciona no mesmo namespace global.
☆ **STATUS-SYNC** (a 4ª "peça") provavelmente é só uma função/arquivo no mesmo projeto, **sem gatilho e sem chamadores**: bate com o que você viu. O pacote Fase 1 de 15/10 já registra isso: ele depende do `CONFIG` do GERADORDEIDS antigo (removido; hoje é `GERADOR_CONFIG`), então **se alguém rodá-lo dará `ReferenceError: CONFIG is not defined`**. Recomendação: deixar como está (não executar); decidir depois se se aposenta.
☆ Os outros 2 projetos que você tem: **não sei o que são**. Só precisam de código se tocarem a planilha, o GitHub ou o Supabase; me diga o nome e para que servem.

## 2. Esse é o código ATIVO?
☆ Os arquivos entregues são **idênticos ao pacote "Fase 1" de 15/10** (`ANTICEG_FASE1_PACOTE_FINAL`): SYNC-TRIGGER tem o mesmo SHA-256 (`72b28ad33034f096`); GERADORDEIDS e PAGAMENTO-AUTOMATICO só diferem por uma quebra de linha no fim. O cabeçalho do SYNC-TRIGGER diz que foi "escrito a partir da descrição do código ativo", ou seja, **pode ser a versão proposta, não a colada**.
☆ **Indício de que o gerador novo está ativo:** os códigos novos na masterlist seguem em sequência (NUM 5050 em 15/10 → 5063–5066 hoje).
☆ **Como confirmar (2 min, sem editar nada):** no editor do Apps Script abra cada arquivo → Ctrl+A → copie → cole num arquivo de texto e compare com o entregue (ou me diga "o editor está igual ao pacote"). Se a versão ativa for outra (a antiga), me entregue ESSA, porque os achados de baixo valem para o texto que de fato responde na internet.

## 3. O que cada peça faz
| Peça | Gatilhos / entrada | Grava na planilha | Chama fora | Segredo |
|---|---|---|---|---|
| GERADORDEIDS | ao editar (`gerarCodigosAoEditar`), a cada 10 min (`completarFaltantesAutomatico`), ao abrir (menu) | NUM/ID das linhas novas (nunca sobrescreve linha com ID nem fórmula) | nada | propriedades `ID_ABA_MASTERLIST`, `ULTIMO_NUMERO` |
| PAGAMENTO-AUTOMATICO | **Web App `doPost`** (7 ações: confirmar, cancelar, repassar, recebido, aprovar_disponivel, atualizar_joiner, novo_joiner) | pagamentos, repasse, dono, recebido, cadastro de joiner | só chama `triggerSync()` | `ANTICEG_TOKEN` (propriedade; **não** está no código) |
| SYNC-TRIGGER | ao editar a aba MASTERLIST (`onMasterlistEdit`, cooldown 60 s) | não | GitHub API: dispara o workflow `sync-masterlist.yml` (branch main) | `GITHUB_TOKEN` (propriedade) |

## 4. Achados
**Bom:** nenhum dos 3 arquivos (nem as versões antigas) fala com o **Supabase**; **J4b…J5 e o RLS não quebram nada aqui**. O auditor de segredos não achou nenhum segredo escrito no código. O token do Web App fica em propriedade. Trava (`LockService`) evita corrida; falha no GitHub vira `sync:false` (não sucesso falso).
| # | Gravidade | Achado | O que fazer |
|---|---|---|---|
| 1 | **Alta** | **A única autorização do `doPost` é um token compartilhado que está escrito no JavaScript público do site** (`anticeg-pag-2026`, 8 pontos). Qualquer pessoa pode chamar as 7 ações: marcar pagamento como pago, cancelar, repassar item, aprovar disponível, cadastrar ou alterar joiner. Como o sync leva a planilha para o banco, **um "pago" marcado na planilha vira "pago" no site**, contornando o R1 (que protege só o botão do painel). | Proxy `planilha-acao` (pronto, 19 testes, não publicado) → depois **rotacionar o token** (`ANTICEG_TOKEN` + segredo `PLANILHA_TOKEN`). Ordem em `APPS_SCRIPTS_INVENTARIO.md`. Enquanto isso, qualquer divergência de pagamento deve ser conferida contra a planilha |
| 2 | Média | **A trava é pega antes de conferir o token**: quem não tem o token ainda ocupa a fila da planilha por instantes, e uma enxurrada de chamadas inválidas atrasa as legítimas ("planilha ocupada"). | Patch mínimo preparado: `supabase/lancamento/appsscript-patches/PAGAMENTO-AUTOMATICO_token_antes_da_trava.diff` (+7 linhas no início do `doPost`; **não aplicado**; teste manual: chamada com token errado deve responder "Token inválido" sem esperar a trava) |
| 3 | Baixa | A ação é validada antes do token: uma chamada sem token revela quais ações existem e diferencia "Ação inválida" de "Token inválido". | Resolvido pelo mesmo patch (token primeiro) |
| 4 | Baixa | O token é comparado com `!==` (não é comparação em tempo constante). Impraticável de explorar remotamente no Apps Script. | Nenhuma |
| 5 | A confirmar | **Configuração da implantação do Web App** (Implantar → Gerenciar implantações): "Executar como" e "Quem tem acesso". Normalmente "Eu" e "Qualquer pessoa". Não dá para ver pelo código. | Você me diz o que está marcado; se estiver "Qualquer pessoa", o achado 1 vale como descrito |
| 6 | A confirmar | **Alcance do `GITHUB_TOKEN`**: o ideal é um token *fine-grained* só do repositório `anticeg` com **Actions: Read and write** e nada mais (e validade definida). Se for um token clássico com `repo`, ele dá acesso a todo o código. | Me diga o tipo/escopo (GitHub → Settings → Developer settings), sem colar o token |
| 7 | Info | `cancelar` usa o mesmo ramo de `confirmar`, só que grava FALSE (valores absolutos): repetir a chamada deixa a planilha idêntica; lote em duas fases (resolve tudo, depois escreve) e item de ID repetido é recusado, não adivinhado. | — |
| 8 | Info | Edições dentro dos 60 s de cooldown não disparam sync (documentado); o sync agendado (00:00 e 12:00 UTC) corrige. | — |

## 5. O que fica pronto / o que NÃO foi feito
☆ Pronto: este relatório; patch do achado 2/3 (diff, não aplicado); proxy `planilha-acao` e `planilhaApi` (achado 1); auditores para rodar de novo em qualquer texto novo.
☆ Não feito (por regra): nenhum gatilho, script ou implantação foi tocado; nenhum token foi rotacionado; `planilha-acao` não foi publicada.
☆ Ordem recomendada quando você autorizar: (1) confirmar 2/5/6; (2) aplicar o patch do `doPost` (cole + reimplante a MESMA implantação, a URL `/exec` não muda); (3) publicar `planilha-acao` + segredos; (4) mesclar o front que usa o proxy (no lançamento); (5) rotacionar o token.
