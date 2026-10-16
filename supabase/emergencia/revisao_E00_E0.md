# Revisão de E00 + E0 — respostas às suas quatro perguntas

Status: **nada executado em produção.** Arquivos para revisar:
`E00_ferramentas_backup.sql`, `E0_aplicar.sql`, `E0_reverter.sql`, `E0_verificar.sql`.

## 1. Onde o E00 guarda o backup?

No schema **`emergencia`** do próprio banco, em três tabelas:

| Tabela | O que guarda | Quando é gravada |
|--------|--------------|------------------|
| `emergencia.grant_backup` | Permissões originais de `PUBLIC`, `anon` e `authenticated` em cada tabela de `public` | no início de `E0_aplicar.sql` |
| `emergencia.policy_backup` | Cada policy (nome, permissiva/restritiva, papéis, comando, `USING`, `WITH CHECK`) | quando uma fatia E1c/E2 chama `salvar_policies` |
| `emergencia.rls_backup` | Se o RLS estava ligado/forçado em cada tabela | idem |

O E00 sozinho **não grava nenhum backup e não altera nenhuma permissão**: só cria o
schema, as tabelas vazias e 3 funções auxiliares.

Proteção contra sobrescrever o backup: `E0_aplicar.sql` recusa rodar de novo
enquanto existir backup pendente, e `salvar_policies` recusa salvar duas vezes a
mesma etapa/tabela. Assim o estado "já alterado" nunca substitui o original.

**Importante:** esse backup é a única cópia das permissões originais. Não rode
`drop schema emergencia` antes de concluir todas as etapas. Se quiser, exporte
também `select * from emergencia.grant_backup` (CSV) depois do E0.

## 2. O backup fica inacessível para anon e authenticated?

Sim, por quatro camadas independentes (todas em `E00_ferramentas_backup.sql`):

1. `revoke all on schema emergencia from public, anon, authenticated` (sem `USAGE`
   nem consegue enxergar os objetos).
2. `revoke all on all tables in schema emergencia ...` (sem permissão nas tabelas).
3. RLS **ligado** nas três tabelas e **nenhuma policy** (mesmo com permissão, nada é visível).
4. `revoke all on function ... from public, anon, authenticated` nas 3 funções
   (por padrão o Postgres daria `EXECUTE` a todos).

E o schema não entra na API: o Supabase só expõe os schemas listados em
`pgrst.db_schemas` (normalmente `public` e `graphql_public`). Isso **não é
alterado** por nenhum script.

Como conferir depois de aplicar (somente leitura): `E0_verificar.sql`, bloco **4a**
(esperado: `false`, `false`, `0`, `3`, `0`) e bloco **4b** (lista dos schemas expostos;
não pode conter `emergencia` nem `seguranca`). O teste local também verifica isto.

Quem consegue ler o backup: o dono do banco (`postgres`), o SQL Editor do painel e
a chave `service_role`. Não aparece em nenhuma chamada feita com a chave pública.

## 3. O E0 pode afetar o front, Apps Script, GitHub Actions ou outras automações?

O E0 faz só três coisas, todas **REVOKE** apenas para `anon` e `authenticated`:

| Mudança | Quem seria afetado |
|---------|--------------------|
| Fecha todo acesso às 31 tabelas `bkp_unir_*` | Só quem usa essas tabelas pela chave pública. O front **não** usa (verificado no código). |
| Remove `TRUNCATE`, `REFERENCES`, `TRIGGER` (e `MAINTAIN`) | Só quem trunca/cria gatilho pela chave pública. O front não faz isso. |
| Remove `DELETE` das tabelas onde o front nunca apaga | Só quem apaga linhas por chave pública nessas tabelas. O front apaga apenas em 12 tabelas (e `config` deixou de ser uma delas), que ficam como estão. |

**Não muda** `SELECT`, `INSERT` nem `UPDATE`, nem policies/RLS. Portanto leituras,
cadastros, formulários, claims e edições continuam exatamente iguais.

| Componente | Chave usada | Afetado? | Evidência |
|------------|-------------|----------|-----------|
| Site (front) | anon (pública) | **Não**, salvo `.delete()` fora das 12 tabelas | análise de `App.jsx` (47 tabelas); tabelas dinâmicas (`cfg.tabela`) só fazem `select/insert/update` |
| GitHub Actions `sync-masterlist.yml` | `SUPABASE_SERVICE_KEY` (secret) | **Não** (`service_role` não é tocado pelo E0) | workflow + `scripts/sync-masterlist.js` |
| Scripts locais `scripts/*.mjs` | `SUPABASE_SERVICE_KEY` | **Não** | todos leem a chave de variável de ambiente |
| Edge Functions `send-email`, `send-push` | não usam o banco no código versionado | **Não** | arquivos sem chamadas ao Supabase |
| Google Apps Script / Google Sheets | **desconhecida** | **Só se usar a chave pública para `DELETE`/`TRUNCATE` ou ler `bkp_unir_*`** (improvável: costuma ler/inserir/atualizar) | não está no repositório |

Por isso, **antes de aplicar o E0**, precisamos confirmar o que o Apps Script faz.
Há duas formas rápidas, descritas em `inventario_automacoes.md`: olhar o código do
script (procurar `supabase.co` e `apikey`) e consultar os logs de API do Supabase por
`User-Agent` do Google Apps Script. Sem essa confirmação, o E0 só deve ser aplicado
com sua autorização explícita, sabendo que o risco restante é apenas `DELETE`/`TRUNCATE`.

## 4. A reversão pode restaurar permissões inseguras?

**Sim, por definição:** o estado original era inseguro. Por isso a reversão foi
redesenhada para ser **seletiva e consciente**:

* Por padrão `E0_reverter.sql` **recusa rodar** e não reabre nada.
* Para reverter, você precisa editar o script e trocar `false` por `true` em 3 opções
  independentes: `reabrir_backups`, `reabrir_delete`, `reabrir_outros`.
* Se só o `DELETE` causou problema, reverte só o `DELETE`; os backups continuam fechados.
* Reverter uma categoria **não** reverte as outras (testado).
* A reversão só restaura exatamente o que o E0 tirou, nunca concede algo novo.

Recomendação: se algum problema aparecer, **não reverter** o fechamento dos
backups (`reabrir_backups` deve permanecer `false`); eles não têm função no site.
Reverter `reabrir_delete` para uma tabela específica é mais seguro do que reabrir
todas; se isso acontecer, posso gerar uma versão por tabela.

Testes que cobrem isso (em `teste-local/teste-sql.mjs`, 69 verificações):
recusa por padrão; reversão parcial só de `DELETE` mantém `bkp_unir_*` fechado;
reversão total restaura o original e permite reaplicar; o cofre `emergencia` não é
acessível pela chave pública.

## 5. O que fica de fora do E0 (e por quê)

O E0 **não fecha leitura** de `joiners`, `masterlist`, `config`, pedidos etc.
Isso exige o plano de `contencao_urgente.md`, porque o site hoje lê essas tabelas
com a chave pública e fechar sem preparar quebraria o login e o painel.

## 6. Análise dos scripts reais (revisão 2) — o que mudou depois de reler linha a linha

A releitura de `E00`, `E0_aplicar`, `E0_reverter` e `E0_verificar` achou quatro lacunas, já corrigidas
e cobertas pelo teste local (75 verificações):

| # | Lacuna | Correção |
|---|--------|----------|
| 1 | Permissões **por coluna** não entravam no backup (um `REVOKE ALL` na tabela as remove, mas a reversão não as devolvia) | `grant_backup.coluna`; o backup e a reversão passam a guardar/restaurar cada `GRANT (coluna)` |
| 2 | `authenticated` continuava apagando linhas. Se o cadastro público do Supabase Auth estiver ligado, qualquer pessoa vira `authenticated` com os mesmos poderes de `anon` | `DELETE` é retirado de `anon` **e** `authenticated`; além disso, desligue o cadastro público (`admin_contas.md` §1) |
| 3 | `config` mantinha `DELETE` só por causa do botão "remover PIN"; qualquer pessoa podia apagar `admin_pin` pela API e **desligar o PIN** | `config` saiu da lista de tabelas apagáveis (agora 12 tabelas) |
| 4 | A reversão exigia só três `true/false` | Exige também a frase **`AUTORIZO REABRIR EXPOSICOES`** escrita pela pessoa; sem ela, nada é reaberto, mesmo com os `true` |

Avisos que o E0 agora emite: concessões a `PUBLIC` em tabelas (que o `REVOKE` de `anon` não remove).

### Confirmação sobre a reversão

* Por padrão, **nada** é reaberto: o script recusa rodar.
* Para reabrir qualquer coisa são necessárias, ao mesmo tempo: a frase de autorização **e** ao menos uma das 3
  categorias em `true`. Cada categoria é independente (testado).
* Nenhum outro script (E1a, E1c, E2a, E2b) executa a reversão do E0.
* Reverter só devolve o que o E0 tirou; nunca concede algo novo.
