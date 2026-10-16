# Gate do E0 — conferir nos logs do Supabase se alguém APAGA com a chave pública

**Por que:** o E0 tira o DELETE de `anon`/`authenticated` em quase todas as tabelas. O código do site foi conferido (só apaga nas 12 tabelas preservadas + `config` para a administradora). O único risco que sobra é uma **automação externa** (Google Apps Script, Make, n8n, script local) que apague com a chave pública. Isto é **somente leitura**: você só consulta logs.

## Onde rodar
1. Painel do Supabase → projeto **anticeg** (`ghjfsmwwcfpfvrouyrka`) → **Logs** (menu da esquerda) → **Logs Explorer** (ou "API Edge Logs"). Se a tela só oferecer filtros prontos, use o filtro da seção "Se a consulta não rodar".
2. **Período (seletor no topo do Explorer):** use o **maior período que o seu plano retém**. Valores de referência da documentação do Supabase: Free ≈ 1 dia, Pro ≈ 7 dias, Team ≈ 28 dias (**confira no seu painel**, o plano pode diferir). Se o Explorer recusar uma janela grande, repita por janelas menores (dia a dia) e some os resultados.

## Consulta exata (cole e execute)
```sql
select
  regexp_replace(r.path, '^/rest/v1/', '') as tabela,
  r.headers.user_agent                     as user_agent,
  count(*)                                 as chamadas
from edge_logs as l
cross join unnest(l.metadata) as m
cross join unnest(m.request) as r
where r.path like '/rest/v1/%'
  and r.method = 'DELETE'
group by 1, 2
order by chamadas desc
limit 200
```
Se quiser separar por resultado (sucesso ou recusa), troque o `select`/`group by` por esta variante, que acrescenta o código HTTP:
```sql
select
  regexp_replace(r.path, '^/rest/v1/', '') as tabela,
  r.headers.user_agent                     as user_agent,
  p.status_code                            as status,
  count(*)                                 as chamadas
from edge_logs as l
cross join unnest(l.metadata) as m
cross join unnest(m.request) as r
cross join unnest(m.response) as p
where r.path like '/rest/v1/%' and r.method = 'DELETE'
group by 1, 2, 3
order by chamadas desc
limit 200
```

## Como ler o resultado (decisão do gate)
| O que aparece | Decisão |
|---|---|
| **Nenhuma linha** no período | gate OK, **com a ressalva abaixo** (ausência de linha só vale para o período consultado) |
| `tabela` começando por uma das 12 (`cal_eventos`, `ceg_config`, `claims`, `estoque_compras`, `estoque_itens`, `item_fotos`, `joiner_storage`, `links_uteis`, `masterlist`, `push_subscriptions`, `pushes`, `rastreios`) ou `config`, com `user_agent` de **navegador** (Chrome/Safari/Firefox/Edge/Mobile) | esperado: o E0 **não** muda nada para elas |
| `tabela` **fora** das 12 (por exemplo `pedidos_*`, `joiners`, `formulario_pedidos`, `claim_*`, `envio_*`) | **PARAR.** Me envie a tabela, o `user_agent` e a contagem (não envie chaves): alguma tela ou automação apaga ali |
| `user_agent` com **Google-Apps-Script**, `node`, `python`, `curl`, `axios`, `GitHub` ou qualquer coisa que **não** seja navegador, em qualquer tabela | **PARAR** e me enviar (o Apps Script é o suspeito principal; os 4 scripts ainda não foram auditados) |
| Status `401/403/404` em DELETE | informativo (a chamada já era recusada hoje) |

## Limitações (leia antes de confiar no "nenhuma linha")
☆ **Só mostra chamadas pela API REST** (`/rest/v1/...`). Conexões diretas ao banco (psql, pooler, Edge Functions com driver SQL) **não** aparecem aqui. As Edge Functions e o GitHub Actions do projeto usam `service_role`, que o E0 **não** afeta.
☆ **Não distingue** `anon` de `service_role` nesta consulta simples: um DELETE vindo do GitHub Actions/Apps Script com `service_role` também aparece. Isso não impede o E0, mas gera falso alarme; me envie a linha e eu classifico.
☆ **Retenção limitada:** automações **raras** (mensais, por exemplo) podem não ter rodado no período retido. O gate cobre o que aconteceu na janela, não o que pode acontecer no futuro.
☆ A **sintaxe do Logs Explorer** muda entre versões do painel. Se der erro de sintaxe, use a seção seguinte.
☆ `TRUNCATE`, `REFERENCES` e `TRIGGER` não passam pela API REST (o E0 os revoga por higiene); não há o que conferir nos logs para eles.

## Se a consulta não rodar
1. Painel → **Logs** → **API Gateway** (ou "API Edge Logs").
2. Defina o maior **período** disponível.
3. Filtre por texto: `DELETE` e, se houver campo de caminho, `/rest/v1/`.
4. Abra algumas linhas e anote **o caminho (tabela)** e o **user-agent**; me envie a lista (sem chaves).

## O que acontece depois
☆ Gate **OK:** sigo com `E00` → `E0` (autorização separada), com o verificador e a reversão protegida já prontos (`supabase/emergencia/BLOCO2_E0_N0_IMPLANTACAO.md`).
☆ Gate **com alerta:** ajusto a lista de tabelas apagáveis do E0 (ou deixo a tabela fora do E0) antes de qualquer aplicação.
