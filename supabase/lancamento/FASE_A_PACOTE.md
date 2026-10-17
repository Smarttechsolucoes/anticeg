# Fase A — pacote para aprovação (17/10/2026). NADA aqui foi aplicado.

**O que é a Fase A:** tudo que é ADITIVO e não muda o acesso de ninguém: N1, J4-0, J4c-4e, 3 segredos e 4 Edge Functions. Não liga login geral, não aplica J4b…J5, não mexe em contas, claims, pagamentos nem MASTERLIST. O site de hoje não chama nada disso.

## 1. O que foi provado localmente (PGlite com dados fictícios + testes de Node)
☆ `tests/sql/fase-a.mjs`: aplica N1 → J4-0 → J4c-4e **sobre o estado de produção de hoje** (J1, J1c, J3, J4a, J4d aplicados; onda fechada) e compara **168 combinações papel × tabela** (visitante, joiner ativada, conta sem vínculo; ler, inserir, atualizar, apagar): **nenhuma mudou**. As policies existentes continuam as mesmas, entram só 3 funções, a administradora ganha acesso próprio e a trava de UPDATE em `pagamento_demandas` vale até para ela. As 3 reversões (ordem inversa) devolvem o acesso exatamente ao de antes; reaplicar funciona.
☆ Edge Functions: 100 testes sem rede passam (`handlers` 15, `notificacoes` 20, `comprovantes` 13, `acesso` 15, `ativacao` 8, `planilha` 15, `piloto` 14).
☆ Guardas reais conferidas em produção (somente leitura): nenhuma policy `admin_tudo`, `emails_enviados` e `ceg_*` não existem, N1/J4-0/J4c-4e não registrados, `is_admin()`/`meu_cog()` existem, colunas usadas existem.
☆ A sondagem `scripts/testar-notificacoes.mjs` já confirma o "antes": as funções novas dão 404 e as antigas `send-email`/`send-push` seguem **abertas ao público** (aceitam pedidos de qualquer pessoa — a brecha que o lançamento fecha).
☆ Limite honesto: PGlite não é o Supabase. Por isso cada SQL se auto-verifica dentro da transação e tem verificador próprio; qualquer guarda que falhe termina com "Nada foi alterado".

## 2. Sequência proposta (≈ 45 min, sem manutenção do site; nenhuma joiner percebe)
**Janela sugerida:** qualquer horário de baixo movimento, **sem sync em andamento** (conferir `gh run list`; o sync leva 20–40 min e roda às 00:00 e 12:00 UTC + a cada edição da planilha). Sugestão: começar logo depois de um sync terminar. Duração total ≈ 45 min.

| # | Passo | Como | Resultado esperado |
|---|---|---|---|
| P1 | **Backup** | painel Supabase → Database → Backups (confirmar o mais recente) **e** `db dump` local | backup de hoje existe |
| P2 | **Linha de base** | `E0_pre_checagem`, `q_perm.sql` (impressão de permissões), contagens, `00_preflight_leitura.sql` | valores anotados (a impressão de permissões é a referência) |
| A1 | **N1** | `N1_emails_enviados_aplicar.sql` → `N1_emails_enviados_verificar.sql` | `true, false, true, 0, 1` |
| A2 | **J4-0** | `J4_0_admin_em_todas_aplicar.sql` → `J4_0_admin_em_todas_verificar.sql` | admin_tudo > 20 tabelas, 0 fora do padrão, `false` (sem UPDATE novo), 4 linhas de estado |
| A3 | **J4c-4e** | `J4c4e_cegs_publico_aplicar.sql` → `J4c4e_cegs_publico_verificar.sql` | `3, false, true` |
| A4 | **Conferência de acesso** | repetir `q_perm.sql` e `AUD_02_acesso_efetivo_leitura.sql` | impressão de SELECT/INSERT/UPDATE **idêntica** à do P2; AUD_02 igual (só entram 3 funções e as policies admin_tudo) |
| A5 | **Segredos** | `npx supabase secrets set ADMIN_NOTIFY_EMAIL=<seu e-mail> ALLOWED_ORIGINS=https://anticeg.vercel.app EMAIL_MODO_SECO=true --project-ref ghjfsmwwcfpfvrouyrka` | `EMAIL_MODO_SECO=true`: as funções validam tudo e **não enviam e-mail** |
| A6 | **4 funções** | `npx supabase functions deploy email-evento push-evento comprovante-upload comprovante-url --project-ref ghjfsmwwcfpfvrouyrka` | 4 funções ACTIVE (as três de login e as antigas seguem como estão) |
| A7 | **Sondagem pós-deploy** | `node scripts/testar-notificacoes.mjs` (chave pública, dados inválidos, não envia nada) | e-mail antigo → 400; admin sem login → 401; push sem login → 401; comprovante-upload/url sem login → 401; `send-email`/`send-push` antigas: iguais a hoje |
| A8 | **Site de hoje intacto** | abrir o site; ler a MASTERLIST como visitante; `q_fp.sql`/contagens; primeiro sync seguinte verde | tudo igual; nenhum 4xx/5xx novo no log da API |

**O que NÃO está na Fase A:** mesclar a PR #38; `VITE_JOINERS_AUTH`; J4b…J5; `EMAIL_MODO_SECO=false`; remover `send-email`/`send-push`; AV1 (lote próprio, abaixo); tocar em contas ou ondas.

## 3. Critérios de PARADA (qualquer um interrompe a sequência e eu informo antes de fazer outra coisa)
1. Qualquer SQL termina com erro. Todos terminam com "Nada foi alterado"/"Transação desfeita": não há meia-aplicação. **Não reverto sozinho**; reportar e avaliar.
2. Um verificador devolve valor diferente do esperado na tabela acima.
3. A impressão de permissões (A4) **difere** da linha de base em SELECT/INSERT/UPDATE de visitante ou de joiner, ou algum `service_role` mudou.
4. A sondagem (A7) mostra 200 onde se espera 401/400, ou qualquer e-mail/push **enviado**.
5. O site de hoje falha: leitura da MASTERLIST como visitante muda, erro 5xx na API, ou o sync seguinte termina vermelho.
6. Um sync está em andamento quando for aplicar um SQL (esperar terminar).
**Reversões (cada uma protegida por frase):** A3 `J4c4e_cegs_publico_reverter.sql`; A2 `J4_0_..._reverter_protegido.sql` (`AUTORIZO REMOVER ACESSO DA ADMIN`); A1 `N1_reverter_protegido.sql` (`AUTORIZO REMOVER CONTROLE DE ENVIOS`); funções: `npx supabase functions delete <nome>`; segredos: `npx supabase secrets unset <NOME>`. Nenhuma toca em dados das joiners.

## 4. Lote separado (opcional, depende de aprovação própria): AV1 — endurecer o bucket `avatars`
☆ Auditoria (leitura de hoje): bucket público, **sem limite de tamanho nem de tipo**; **5 policies deixam o visitante enviar, trocar e apagar QUALQUER arquivo** (confirmado com sonda desfeita: o visitante insere até `.html` em avatars). 206 fotos, todas `<cog>/avatar.jpg`, JPEG, 15 KB em média (máx. 33 KB); 193 joiners apontam para elas.
☆ AV1 (`supabase/storage/AV1_*`): aceita só JPEG até 256 KB; só o caminho `<pasta>/avatar.jpg` (ver, enviar, trocar, apagar); a policy genérica "allow upload" deixa de alcançar avatars. **Não toca em nenhuma foto** (quantidade e lista conferidas por hash dentro da transação), mantém a leitura pública e o fluxo do site (remove + upload). Testado contra o conjunto REAL de policies de hoje; o CLI consegue aplicar (sonda reversível em produção). Reversão protegida: `AUTORIZO REABRIR AVATARS`.
☆ Limite: sem login ainda é possível trocar a foto de outra joiner pelo caminho dela; isso fecha no J5 (só a dona do COG ou a administradora).

## 5. Achado importante para a Fase B (já corrigido no código, não aplicado)
O **J5 como estava abortaria em produção** (sem alterar nada): o laboratório tinha 1 policy genérica de Storage; a produção tem **18**, incluindo escrita anônima em `avatars`, `storage-itens` e `popup-skzoo`, e o guarda final do J5 recusa qualquer escrita anônima. Corrigi o J5: derruba as policies anônimas listadas, cria as da dona (`avatars` só na pasta dela), leitura para conta logada nos buckets públicos e apagar em `storage-itens` só para conta ativada/administradora; testado contra o conjunto real (`tests/sql/j5-storage-real.mjs`, com e sem AV1) e a suíte antiga do J5 continua passando.
