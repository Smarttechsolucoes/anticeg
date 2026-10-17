# Pré-voo 1 — como executar (SOMENTE LEITURA, produção)

**O que é:** uma fotografia do ponto de partida. **Não altera nada**: só `select` (e, no inventário, tabelas temporárias que somem ao fechar a aba). Não cria conta, não toca em senha, sessão, onda ou permissão. Nenhuma conta ativada é afetada.
**Resultado:** só contagens e nomes de tabelas/funções/buckets. **Nenhum e-mail, CPF, telefone ou nome de joiner aparece.**

## Passo a passo (≈ 10 min)
1. Abra o painel do Supabase e **confira na URL que o projeto é `ghjfsmwwcfpfvrouyrka`** (o de produção).
2. Menu **SQL Editor → New query**. Dê o nome `pre-voo-1`.
3. **Parte A — cadastros, o que já está aplicado, tabelas e Storage.** Abra o arquivo `supabase/lancamento/00_preflight_leitura.sql`, copie **tudo**, cole e clique **Run**. O resultado é uma única tabela (colunas `secao`, `item`, `valor`).
   ☆ Se der erro dizendo que `emergencia.c0b_estado_anterior` não existe, **pare e me avise**: significa que o C0 não está como eu esperava.
   ☆ Clique em **Download CSV** (ou "Copy as markdown") e guarde.
4. **Parte B — inventário dos comprovantes.** Em **outra aba** (`pre-voo-1b`), copie **tudo** de `supabase/lancamento/J5_inventario_leitura.sql` e **Run** de uma vez, **na mesma aba** (as tabelas temporárias valem só nessa aba). O resultado é a tabela `resumo`.
   ☆ Exporte o resultado também. As consultas da "PARTE 2" (comentadas no fim do arquivo) são opcionais: descomente **uma por vez** e rode na mesma aba só se eu pedir.
5. **Parte C — configuração pública do Auth e visão do visitante (no seu computador, só a chave PÚBLICA):**
   ```
   $env:LANC_URL="https://ghjfsmwwcfpfvrouyrka.supabase.co"
   $env:LANC_ANON="<chave anon pública do painel: Project Settings → API → anon public>"
   node scripts/lancamento/auth-settings.mjs
   node scripts/lancamento/verificar-api.mjs
   ```
   Os scripts recusam chave de serviço e **só leem**. `verificar-api.mjs` vai mostrar `FALHA visitante LÊ ...` em dezenas de tabelas: isso é o "antes" esperado (o banco de hoje ainda está aberto), **não** é um problema novo.
6. Me envie: o CSV da Parte A, o da Parte B e a saída das duas execuções da Parte C (**não** inclua chaves nem senhas).

## O que eu vou olhar no resultado
| Seção | O que significa | Decisão que depende disso |
|---|---|---|
| `1 cadastros` | quantas joiners têm e-mail válido e único; COGs repetidos ignorando maiúsculas; sem @; bloqueadas | quantas **não** ativam sozinhas (ficam em modo limitado até a administradora corrigir) e como montar as ondas |
| `2 já aplicado` | quais funções do J1/J4/J5 já existem; etapas já registradas; contas já ativadas | confirma que a produção está no ponto que o roteiro supõe (o C0 aplicado e nada do J4 ainda) |
| `3 tabelas` | RLS, o que o visitante alcança hoje e quais tabelas **faltam** | tabela ausente faz o script que a cobre **abortar**; preciso saber antes |
| `4 storage` | buckets públicos/privados, contagem de arquivos e policies | base do J5 |
| Parte B | arquivos com dona, sem dona, referências quebradas, **tabelas fora do mapeamento** | se algum comprovante antigo ficaria só visível à administradora |

## Regras desta etapa
☆ **Nada de merge, nada de SQL que altere, nada de login novo publicado.** Estes dois arquivos são os únicos SQLs desta etapa e são de leitura.
☆ **Contas e senhas já ativadas:** o pré-voo nem as toca; as ondas futuras também não (liberar um grupo não altera nenhuma conta).
☆ Não rode o sync do GitHub nem qualquer Apps Script para "testar".
