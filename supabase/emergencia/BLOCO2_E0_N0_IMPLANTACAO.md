# Bloco 2 (parte 1) — E0 e N0: ordem de implantação, verificadores e reversão

Escopo: **somente** `N0` (cria `public.notifications`) e `E00 + E0` (revoga privilégios inúteis/perigosos de `anon`/`authenticated`). Não toca no sync, no S1/S2, nas demandas de pagamento, em RLS, em policies nem em dados. Tudo aqui é aditivo ou só `REVOKE`; nenhuma linha é apagada.

## Estado real em produção (leituras de 16/10/2026)
☆ `public.notifications` **não existe**; o site grava/lê nela desde 17/06 (histórico anterior desconhecido; o N0 não presume exclusão).
☆ E00 **não aplicado** (`emergencia.grant_backup` ausente) → pré-requisito do E0. Postgres 17.6.
☆ 89 tabelas em `public`; **80 com TRUNCATE/REFERENCES/TRIGGER** para `anon` e `authenticated`; 29 `bkp_unir_*` com privilégios (RLS ligado e **sem policy**: acesso efetivo negado hoje, privilégio à toa).
☆ Dezenas de tabelas em que o site **nunca apaga** (`joiners`, `formulario_pedidos`, `pedidos_*`, `mercari_pedidos`, `feedbacks`, `confirmacoes`…) ainda têm DELETE para o visitante (efetivo onde há policy livre ou RLS desligado: `pedidos_revista`, `pedidos_wmag`, `pedidos_popup`, `envio_*`, `joiner_*`…).

## O que cada peça faz
| Peça | Faz | Não faz |
|---|---|---|
| **N0** | cria `public.notifications` (id, joiner_cog, message, type, **report_id**, read_at, created_at) com RLS e o MÍNIMO que o site usa (ler, criar, marcar lida = UPDATE só em `read_at`; sem DELETE/TRUNCATE) | não cria dados; recusa se a tabela já existir; o J4c-4c (lançamento) troca as policies por joiner |
| **E00** | cria as tabelas/funções de backup no schema `emergencia` (sem acesso da API) | não muda nenhum acesso |
| **E0** | só `REVOKE`: (a) tudo de `bkp_unir_*`; (b) TRUNCATE/REFERENCES/TRIGGER/MAINTAIN em todas as tabelas; (c) DELETE de `anon`/`authenticated` em todas as tabelas **menos** nas 12 em que o site apaga (`cal_eventos, ceg_config, claims, estoque_compras, estoque_itens, item_fotos, joiner_storage, links_uteis, masterlist, push_subscriptions, pushes, rastreios`) e em `config` para o administrador logado | não mexe em SELECT/INSERT/UPDATE, RLS, policies, dados; **se qualquer outro privilégio mudar, o próprio script desfaz tudo** (auto-verificação contra o backup que ele grava) |

Código do site conferido em 16/10: só apaga nas 12 tabelas da lista + `config` (botão "Remover PIN" do admin, hoje inativo; por isso o E0 **preserva** o DELETE do `authenticated` em `config`). Funções, Actions e `scripts/` com `service_role` não são afetados.

## Mudanças que o usuário percebe
☆ **N0:** passam a funcionar as notificações do site (report resolvido, pedido de endereço de envio, avisos ao entrar), que hoje falham em silêncio. É comportamento novo para as joiners: avisos criados a partir de agora aparecem.
☆ **E0:** nenhuma (o site não usa o que é revogado). Risco único: uma **automação externa** (Apps Script, Make, etc.) apagando com a chave pública — por isso o gate de logs abaixo.

## Ordem recomendada
**0. Leituras (agora e antes de aplicar):** `E0_pre_checagem_leitura.sql` (13 linhas) e `supabase/auditoria/AUD_02_acesso_efetivo_leitura.sql` (baseline do acesso efetivo).

**1. N0 (aditivo, baixo risco)**
1. `N0_tabela_notifications_aplicar.sql`
2. `N0_tabela_notifications_verificar.sql` → **8 linhas**: `true, true, 3, false, false, true, 7, 1`.
3. `N0_teste_fumaca_desfeito.sql` → erro proposital **`N0 FUMAÇA OK`** (9 linhas OK; nada gravado).
4. Reversão: `N0_tabela_notifications_reverter_protegido.sql` (frase `AUTORIZO APAGAR NOTIFICATIONS VAZIA`; recusa se houver linhas).

**GATE (você, 2 min, somente leitura) antes do E0:** no painel Supabase → *Logs → API Edge Logs (Logs Explorer)* rode a consulta abaixo (retenção depende do plano). O E0 só segue se **não aparecer DELETE** em tabela fora das 12 (nem `config` por visitante). Qualquer linha de Apps Script/`node`/GitHub Actions com DELETE → parar e me enviar (só tabela e user-agent).
```sql
select regexp_replace(r.path, '^/rest/v1/', '') as tabela, r.headers.user_agent as user_agent, count(*) as chamadas
from edge_logs as l
cross join unnest(l.metadata) as m
cross join unnest(m.request) as r
where r.path like '/rest/v1/%' and r.method = 'DELETE'
group by 1, 2 order by chamadas desc limit 100
```

**2. E00 (aditivo):** `E00_ferramentas_backup.sql` → `E0_pre_checagem_leitura.sql`: linha 2 (`E00 aplicado`) = `true`.

**3. E0:** `E0_aplicar.sql` (transação única, auto-verificada) → `E0_verificar.sql`:
☆ seção 2: `0, 0, 12` (bkp legível por anon, tabelas com TRUNCATE, tabelas com DELETE para anon);
☆ seção 4a: tudo `false/0` (backup inacessível); 4b: sem `emergencia` entre os schemas expostos;
☆ seção 5: `false, true, 12, 0` (anon não apaga `config`; authenticated apaga; 12 tabelas da lista; 0 TRUNCATE).
Depois repetir `E0_pre_checagem_leitura.sql` (linhas 5, 7, 10 e 11 devem zerar/`(nenhuma)`; a linha 8 deve mostrar só `config`, que o administrador preserva) e `AUD_02_acesso_efetivo_leitura.sql` (o resumo "visitante APAGA livremente" deve listar só as tabelas da lista).
**Fumaça manual do site (sem dados reais de joiners):** abrir MASTERLIST/CEGs; enviar um pedido de teste num formulário (insere); no admin, apagar um item de teste de *Disponíveis* sem claim (continua funcionando); calendário/links úteis (apagam).
**Reversão:** `E0_reverter.sql` é **seletivo e protegido** (frase `AUTORIZO REABRIR EXPOSICOES` + flags `reabrir_backups/delete/outros`; reabre exposição, usar só para um problema comprovado). **Não** reverter o E00 enquanto houver etapas dependentes (apagaria o backup).

## Testes locais (PGlite, dados fictícios)
`node tests/sql/n0-notifications.mjs` (18) · `node tests/sql/n0-fumaca.mjs` (14) · `node tests/sql/e0-pre-checagem.mjs` (11) · `node supabase/emergencia/teste-local/teste-e0.mjs` (32) · `node supabase/emergencia/teste-local/teste-e0-guarda.mjs` (guardas: injeta 6 defeitos e prova que a transação inteira é desfeita) · `node tests/sql/auditoria-acesso-efetivo.mjs` (AUD_02).
PGlite não é o Supabase: a validação real é o conjunto de leituras/verificadores acima.
