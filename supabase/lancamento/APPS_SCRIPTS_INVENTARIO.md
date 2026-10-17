# Apps Scripts — inventário e correções preparadas (2026-10-17)

Nada foi rotacionado, publicado nem alterado em integrações reais.

## 1. O que o repositório mostra
☆ **Um único Web App** (`.../macros/s/AKfycby…/exec`) é chamado pelo navegador com o **token fixo `anticeg-pag-2026`** em 8 pontos da `main` (`src/App.jsx` ×6, `src/LandingPage.jsx` ×1, `src/planilhaCancelar.js` ×1). Ações: `confirmar`, `cancelar`, `recebido`, `repassar`, `aprovar_disponivel`, `atualizar_joiner`, `novo_joiner`.
☆ Qualquer pessoa que abra o site vê o token e a URL: consegue chamar as 7 ações sem login (ex.: desmarcar pagamento, repassar item, cadastrar joiner na planilha).
☆ O sync (GitHub Actions) lê a planilha por CSV público; o Apps Script `SYNC-TRIGGER` dispara o workflow quando a planilha é editada (segredo do GitHub fica no Apps Script — fora do repositório).

## 2. Os 4 scripts (código fora do repositório)
| Script | Papel suposto | Fonte necessária | O que preciso conferir |
|---|---|---|---|
| (Web App com as 7 ações) | recebe as chamadas do site | **sim** (pode ser um dos 4; confirme qual) | como valida o token; se grava mais de uma linha por chamada; se registra quem chamou |
| GERADORDEIDS | gera `id_linha` na planilha | **sim** | regra de geração (unicidade; os 24 códigos repetidos no banco e as repetições na planilha podem ter origem aqui — a confirmar) |
| PAGAMENTO-AUTOMATICO | marca pago na planilha | **sim** | se fala com o Supabase, com qual chave (papel) e em quais tabelas |
| SYNC-TRIGGER | dispara o workflow do GitHub | **sim** | onde guarda o token do GitHub e o escopo dele |
| STATUS-SYNC | grava status do sync | **sim** | idem Supabase/chaves |
Como entregar: copiar o código de cada projeto para `appsscripts/<NOME>.gs` (fora do git) e rodar `node scripts/lancamento/auditar-appsscript.mjs appsscripts/` — somente leitura, nunca imprime a chave (só o papel).

## 3. Correções já preparadas
☆ **Proxy autorizado** (`seguranca/planilha-proxy-main`, já atualizado com a `main`, 19 testes): o navegador deixa de conhecer o token; a função `planilha-acao` (Edge Function) decide *quem* pode fazer *qual ação em qual item* e repete a chamada com o segredo `PLANILHA_TOKEN` guardado no servidor. Remove `planilhaCancelar.js` (token no navegador). O lançamento (`lancamento/consolidado`) já contém essa camada.
☆ **Leitura da resposta** (PR #30, contido no proxy): recusas, parciais e falhas viram aviso em vez de `.catch(() => {})`.
☆ **Fonte autenticada do sync** (`feat/sync-planilha-autenticada-main`, local): lê a MASTERLIST por conta de serviço do Google, mantendo o CSV público como fallback; permite fechar a planilha ao público depois de uma conferência única.

## 4. Ordem segura (depende de você; nada disso foi feito)
1. Entregar o código dos scripts e rodar o auditor.
2. Publicar a Edge Function `planilha-acao` e criar os segredos `PLANILHA_URL` e `PLANILHA_TOKEN` (**antes** de mesclar o front novo; se o front sair antes, as 7 ações param).
3. Mesclar o front. O token antigo continua válido até o passo 4.
4. **Só então rotacionar o token** (propriedade `ANTICEG_TOKEN` no Apps Script + segredo `PLANILHA_TOKEN`). Enquanto o token antigo existir no histórico do site já publicado, ele deve ser considerado público.
5. (Opcional, depois) fechar o acesso público ao CSV da planilha usando a fonte autenticada.

## 5. Como exportar os 4 arquivos .gs (passo a passo)
1. Abra `script.google.com` com a conta dona dos scripts → **Meus projetos** (ou, dentro da planilha: **Extensões → Apps Script**).
2. Para **cada** projeto (GERADORDEIDS, PAGAMENTO-AUTOMATICO, SYNC-TRIGGER, STATUS-SYNC e o que recebe as chamadas do site, se for outro): abra o projeto → no painel **Arquivos** (esquerda) clique em cada arquivo `.gs` → selecione tudo (Ctrl+A) → copie → cole num arquivo de texto e salve em **`C:\Users\Nanda\anticeg\appsscripts\NOME-DO-PROJETO.gs`** (se o projeto tiver mais de um arquivo: `NOME-DO-PROJETO-1.gs`, `-2.gs`…). A pasta já existe e o git a ignora.
3. Para o Web App (o da URL `.../exec`): em **Implantar → Gerenciar implantações** anote só **quem executa** e **quem tem acesso** (ex.: "Qualquer pessoa") e me diga. Não envie a URL nova se não for preciso.
4. Em **Configurações do projeto (engrenagem) → Propriedades do script**: **não copie os valores**. Só me diga os **nomes** das propriedades que existem (ex.: `ANTICEG_TOKEN`, `GITHUB_TOKEN`).
5. Em **Gatilhos** (relógio): anote, para cada projeto, o nome da função, o tipo (de tempo / ao editar a planilha) e a frequência.
6. **Não cole segredos no chat.** Se o código tiver um segredo escrito (token do GitHub, chave do SendGrid, chave do Supabase), troque o valor por `XXXX` antes de salvar o arquivo.
7. Quando os arquivos estiverem em `C:\Users\Nanda\anticeg\appsscripts\`, me avise. Eu rodo, somente leitura:
   ☆ `node scripts/lancamento/auditar-appsscript.mjs C:\Users\Nanda\anticeg\appsscripts` (fala com o Supabase? com qual papel? em quais tabelas? quebra com o RLS?)
   ☆ `node scripts/lancamento/inventariar-appsscript.mjs C:\Users\Nanda\anticeg\appsscripts` (Web App, ações, se verifica token, segredos escritos no código — só tipo e tamanho —, destinos, gatilhos, se apaga linhas).
