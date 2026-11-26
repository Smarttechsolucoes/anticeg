# Etapa 1 do cadastro (nome e e-mail): tarefas em Atualizações + envio para a aba Dados

**Estado: PREPARADO, NADA APLICADO.** Nada aqui foi executado na planilha real, no banco de produção, em deploy ou em agendamento. Tudo testado com dados fictícios e planilha simulada. Branch `feat/cadastro-etapa1`, a partir de `origin/main` (9ce5dfb).

## O fluxo
1. A joiner salva o **nome cadastral** (Meu Perfil) → `salvar_meu_cadastro` grava e devolve o valor gravado → só então **"Salvo no site ✓"**.
2. No mesmo ato nasce **uma tarefa** (`cadastro_tarefas`) em **Admin › Atualizações**, no padrão do Report: selo, pendências no resumo, título da aba `(N)`, aviso do navegador, link `/admin/atualizacoes?tarefa=ID` que abre e destaca a tarefa.
3. `perfil-sync` lê o **estado atual** e manda `atualizar_cadastro` ao Apps Script, que grava **só Dados!B (nome) / Dados!C (e-mail)** (na 1ª vez também D=`ID_SITE`, E=`principal`; F=`VERSAO`). A **MASTERLIST** reflete pelas fórmulas existentes; texto fixo não muda; **nenhuma escrita na MASTERLIST**.
4. Estados **separados**: leitura (`lida_em`) × planilha (`pendente` / `sincronizada` / `precisa de atenção`). Retentativas atualizam **a mesma tarefa**; falha definitiva vai direto a "precisa de atenção" e **volta como pendência** mesmo já lida (até "vi a falha"); "reprocessar" refaz na mesma tarefa.
5. **E-mail**: só pelo link do Auth; ao confirmar, o gatilho cria a tarefa. **@**: fica **só como pedido** (conta: `solicitar_correcao_perfil`; login legado: `solicitar_alteracao_sem_login` → "Alteração solicitada", **sem prova de identidade, nunca altera o cadastro**). Atualizar @ na planilha e alias = **etapa 2** (nenhuma tarefa automática de @).
6. **Fila sem botão**: gatilho por tempo do próprio Apps Script chama `perfil-sync` a cada minuto (`appsscript/ATUALIZAR_CADASTRO.gs`; só roda se alguém executar `instalarGatilhoFilaPerfil()`).

## Interruptor do site
`VITE_CADASTRO_ETAPA1=1` (+ `VITE_JOINERS_AUTH=true`). **Desligado por padrão** = site idêntico ao de hoje (verificado com os e2e existentes). Ligado: nome cadastral editável com confirmação do banco; e-mail e @ deixam de ser gravados direto (Perfil › Dados e Confirmar dados).

## Dependências (lista mínima trazida para esta branch)
| Item | Por quê | Já aplicado no Supabase? | Origem (branch local `integracao/contas-e-seguranca`) |
|---|---|---|---|
| `supabase/joiners-auth/J1d_email_confiavel_aplicar.sql` | `papel_confiavel`, bloqueio de e-mail/@ de conta ativada | **Sim** (dump de 08/11) | 9b8c34b |
| `supabase/joiners-auth/J4c1_joiners_aplicar.sql` | `trg_joiners_protege_colunas` (o E1 troca uma linha dele) | **Sim** (dump de 08/11) | 9a8999f, c70257f |
| `supabase/joiners-auth/J6_perfil_obrigatorio_aplicar.sql` | `joiner_perfil_historico`, `perfil_solicitacoes`, `perfil_sync_pendente`, gatilho do Auth | **Sim** (dump de 08/11) | série J6 de 07–08/11 (7 commits, o primeiro 35a8139) |
| `supabase/functions/_shared/perfilsync.ts` (+ teste) e `perfil-sync/index.ts` | código da função **que já está publicada** mas não estava versionada | **Sim** (função implantada; OPTIONS 200) | c1f541c |

Os três SQL são **REFERÊNCIA: cópia idêntica à da branch de integração, no mesmo caminho (sem conflito quando ela for publicada). NÃO reaplicar.** Só servem aos testes. Nenhum outro commit da integração é necessário: **não foi preciso trazer bloco maior**.

## O que já está aplicado × o que falta versionar
☆ Os objetos que o E1 usa **só são definidos** em J1d, J4c1 e J6; nenhuma migração posterior (J7 a J22) os altera (verificado por busca). Logo não há migração a reaplicar.
☆ O dump do banco aplicado (08/11, `banco-estado-aplicado/`) confirma a presença de: `trg_joiners_protege_colunas` (com o texto que o E1 troca), `auth_email_depois`, `perfil_sync_marcar` e `perfil_sync_proximos`, `papel_confiavel`, `h_arroba`, `joiners_historico`, `solicitar_correcao_perfil`, as tabelas e os gatilhos. **O E1 não aparece (correto).**
☆ O dump tem 17 dias: **rode `E1_preflight_somente_leitura.sql`** (só leitura, sem dado pessoal) para confirmar hoje. O próprio E1 também se recusa a aplicar se algo estiver diferente ("Nada foi alterado").
☆ **Falta versionar**: o **Apps Script publicado** (só temos a cópia de 07/11) e a versão implantada de `perfil-sync` (conferir "Last deployed"). Por isso o Apps Script entra como **peça para colar + 2 edições**, não como arquivo inteiro.

## Testes (todos passam)
```
node tests/sql/e1-cadastro-tarefas.mjs                          # banco: 80 verificações (preflight antes/depois, aplicar, fluxos, permissões, reversão)
node --test tests/appsscript-atualizar-cadastro.test.mjs        # Apps Script (esqueleto); com o script REAL de 07/11: APPS_SCRIPT_ATUAL=<caminho do .gs>
node --test supabase/functions/_shared/perfilsync.test.ts       # inclui o agendador por segredo
node --test tests/cadastro-tarefas-logica.test.mjs
node tests/cadastro-etapa1-ponta-a-ponta.mjs                    # DEMONSTRAÇÃO (passo 8: fila processada SEM o botão do admin)
node tests/e1-teste-copia-dry-run.mjs                           # ensaio do script do teste real contra um servidor local
VITE_JOINERS_AUTH=true VITE_CADASTRO_ETAPA1=1 npx vite build --outDir /tmp/dist-e2e && npx vite preview --outDir /tmp/dist-e2e --port 5197 --strictPort
node tests/cadastro-etapa1.e2e.mjs                              # navegador, 35 verificações
```
(`npm i --no-save @electric-sql/pglite` para os de banco; o e2e roda contra o **build**, não contra `vite dev`, por causa do StrictMode.)
**Teste real numa planilha de TESTE criada do zero (só Dados e MASTERLIST, dados fictícios):** checklist em `TESTE_REAL_COPIA.md`; ferramentas `scripts/e1-montar-codigo-teste.mjs`, `scripts/e1-teste-copia-planilha.mjs` e `appsscript/TESTE_E1.gs` (**só teste, nunca na planilha real**). Precisa de você: itens ✋.

## Ordem de publicação (cada passo só com aprovação) e reversão
| # | Passo | Reversão |
|---|---|---|
| 0 | Rodar `E1_preflight_somente_leitura.sql`; conferir a versão do Apps Script publicado e o "Last deployed" de `perfil-sync`; guardar cópias | — |
| 1 | **Teste real na planilha de teste** (TESTE_REAL_COPIA.md) | apagar a planilha de teste |
| 2 | Cópia da aba Dados; no Apps Script real: colar o pedaço, 2 edições, **nova versão de implantação**; cabeçalhos D/E/F em Dados | reativar a versão anterior; apagar colunas |
| 3 | SQL `E1_cadastro_tarefas_aplicar.sql` (**antes** de publicar a função) | `E1_cadastro_tarefas_reverter.sql` (arquiva antes de apagar) |
| 4 | Segredo `PERFIL_SYNC_SEGREDO` na função e publicar `perfil-sync` | publicar a anterior (a fila antiga de e-mail continua suportada) |
| 5 | Publicar o site com o interruptor **desligado** (o admin já mostra as tarefas); validar; ligar | desligar |
| 6 | Agendador: propriedades do script + `instalarGatilhoFilaPerfil()` | `removerGatilhoFilaPerfil()` |

## Agendador (proposta)
**Plano A (recomendado, o mais simples):** gatilho por tempo do Apps Script (a cada 1 min) → `perfil-sync` com segredo próprio em `x-cron-secret`. Reaproveita o Apps Script e a função que já existem; **não** exige ligar `pg_cron`/`pg_net`. O segredo só autoriza processar a fila (resposta só com contagens). Custo: cerca de 24 min/dia da cota de gatilhos do Apps Script.
**Plano B:** `E1_agendador_PROPOSTA.sql` (`pg_cron` + `pg_net` + cofre). **Descartado:** GitHub Actions (atrasos medidos de 3 a 11 h).

## Limites
☆ `perfil-sync` e Apps Script foram testados por **simulação**; a prova real é o teste na cópia (precisa do seu acesso).
☆ O gatilho do Apps Script e o agendador **não** foram executados de verdade.
☆ E-mail de alerta administrativo: **fora desta entrega** (selo e aviso do navegador existem).
☆ "Confirmar dados" só abre no login antigo; ficou protegido pelo interruptor.
