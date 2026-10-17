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
