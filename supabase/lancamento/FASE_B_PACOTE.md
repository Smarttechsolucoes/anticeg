# Fase B — J4b…J5 + site novo (preparo para aprovação; NADA aplicado) — 17/10/2026

Pré-requisito: **Fase A concluída e verificada** (N1, J4-0, J4c-4e, 4 funções, `EMAIL_MODO_SECO=true`). AV1 é opcional (o J5 corrigido cobre avatars de qualquer jeito). Sem ambiente de ensaio: a segurança vem de ordem, verificadores, janela curta e reversões — veja `IMPLANTACAO_CONTROLADA.md`.

## 1. O que a Fase B muda para as joiners
☆ O banco passa a mostrar a cada joiner só o que é dela (MASTERLIST, pagamentos, multas, claims, pedidos, lojas, avisos, envios) e fecha o Storage de comprovantes. O **site atual deixaria de funcionar** nesses pontos depois do J4b…J5; por isso o site novo entra **na mesma janela**, com a manutenção ligada.
☆ Joiners que ainda não ativaram (a maioria) entram **só com o @, em modo limitado** (CEGs públicos, calendário, regras): sem valores de terceiros nem dados pessoais. Só as da onda 1 (5 joiners já autorizadas) ativam senha agora.
☆ O login da administradora continua e-mail+senha; o painel passa a usar a mesma sessão.

## 2. Pré-voo (o dia anterior, somente leitura)
1. Backup do dia confirmado (`supabase backups list`: físico diário; PITR está desligado) **e** cópia local (`db dump`) se possível.
2. `00_preflight_leitura.sql`, `J5_inventario_leitura.sql`, `99_auditoria_final.sql` (guardar a saída), impressão de permissões (`q_perm.sql`) e de dados (`S2_impressao_leitura.sql`).
3. `node scripts/lancamento/auth-settings.mjs` (cadastro público desligado), e-mails: modelos em português colados (Confirm signup + Magic Link + Reset), OTP 6 dígitos/600 s, Site URL e Redirect URLs `https://anticeg.vercel.app/**`, limite de e-mails/hora acima de 200.
4. Segredos finais **preparados** (não aplicar ainda): `EMAIL_MODO_SECO=false` (só na janela), `PERMITIR_COMPROVANTE_ANONIMO=false` (opcional).
5. Build do site novo **pronto e não publicado**: a PR #38 mesclada na `main` com `VITE_JOINERS_AUTH` **inexistente** (não muda nada para as joiners); a variável `VITE_JOINERS_AUTH=true` só é criada na janela, seguida de redeploy (a Vercel não deve ser a fonte de surpresa: se o deploy automático não disparar, deploy manual do mesmo commit com `vercel deploy --prod`).
6. Contas controladas: **somente as 5 joiners já autorizadas da onda 1** + 3 administradoras. (A/B só com sua aprovação.)
7. Nenhum sync em andamento; aviso prévio de 48 h às joiners (texto no roteiro).

## 3. Janela (≈ 40 min; manutenção ≈ 15 min)
| # | Passo | Verificação esperada |
|---|---|---|
| 0 | `/admin` → manutenção ON; confirmar que não há sync rodando | "Site bloqueado para todos (exceto admin)" |
| 1 | `J4b_lote1_aplicar` → `_verificar` | policies novas; visitante sem acesso a pagamentos/multas/masterlist |
| 2 | `J4c1_joiners` → `_verificar` | idem |
| 3 | `J4c2_pedidos_claims` → `_verificar` | 13 policies |
| 4 | `J4c3_lojas` → `_verificar` | 13 lojas + formulários, inclusive Dazed Seungmin e Esquire Hyunjin; `pedido_loja_criar` fechada ao visitante |
| 5 | `J4c4a_mercari_lojinha` → `_verificar` | 12 policies |
| 6 | `J4c4b_claims_sets` → `_verificar` | 6 policies, 3 funções seguras |
| 7 | `J4c4c_pessoais` → `_verificar` | 29 policies (1 de visitante: avisos gerais); compatível com o N0 |
| 8 | `J4c4d_admin_catalogos` → `_verificar` | 18 policies |
| 9 | `J4c4f_estoque_drops` → `_verificar` | leitura pública mantida; escrita só da administradora |
| 10 | **`J5_comprovantes_aplicar` (versão corrigida)** → `_verificar` | buckets `comprovantes`/`mercari-comprovantes` privados, sem escrita anônima em nenhum bucket, arquivos antes = depois, avatars só na pasta da dona |
| 11 | `99_auditoria_final.sql` | **nenhuma linha `INESPERADO`** |
| 12 | `node scripts/lancamento/verificar-api.mjs` (**só aqui, depois do J5**) | "visitante NÃO lê" em todas as tabelas protegidas; uploads de teste negados (HTTP ≥ 400) |
| 13 | Segredos: `EMAIL_MODO_SECO=false`; conferir `auth-settings.mjs` | tudo OK |
| 14 | Onda: `ativacao_estado.onda_liberada = 1` (já é 1); `ativacao_ondas` = as 5 autorizadas | `J4d_ondas_verificar.sql` |
| 15 | Criar `VITE_JOINERS_AUTH=true` (Production) e publicar o site novo; abrir `anticeg.vercel.app` | manutenção continua ligada |
| 16 | Fumaça com as 5 autorizadas e a administradora (roteiro 3.6): modo limitado sem dados; ativação com código por e-mail; MASTERLIST/pagamentos só da própria; CEG sem valores de terceiros; administradora no painel; comprovante: dona abre, outra não | todas passam |
| 17 | Manutenção OFF (sem anunciar); acompanhar logs 30 min; comunicar só a onda 1 | sem 4xx/5xx novos |
| 18 | Depois: sync seguinte verde; conferir `q_fp.sql` (dados iguais) | igual |

## 4. Critérios de PARADA (interrompo e informo antes de qualquer outra ação)
1. Qualquer SQL termina com erro (todos terminam com "Nada foi alterado"/"Transação desfeita"): **os anteriores ficam aplicados**; manutenção continua ligada; avalio antes de reverter.
2. Qualquer verificador fora do esperado, ou `99_auditoria_final` com `INESPERADO`.
3. `verificar-api.mjs` mostra que o visitante ainda lê algo protegido ou ainda envia arquivo.
4. Um sync entra em execução durante a janela.
5. A fumaça (passo 16) falha em qualquer item, principalmente: modo limitado mostrando dado pessoal, ou a dona não consegue abrir o próprio comprovante.
6. Erros 5xx na API ou nas funções depois de abrir.
**Volta rápida (nesta ordem):** manutenção ON → "Instant Rollback" do deploy anterior na Vercel (site velho) → reversões SQL em ordem inversa (J5 `AUTORIZO REABRIR COMPROVANTES` … J4b), cada uma com sua frase; as joiners nunca perdem dados (todos os scripts só mudam permissões/policies, nunca linhas).
**Atenção:** reverter o J5 reabre os comprovantes ao público e o envio ao visitante; só com problema comprovado.

## 5. Estado dos testes locais da Fase B
☆ `lancamento-completo.mjs` (sequência completa + auditoria final) e os 25 testes SQL passam na consolidação; o J5 foi corrigido e testado contra o conjunto REAL de 18 policies de Storage (`j5-storage-real.mjs`, com e sem AV1).
☆ Limite honesto: PGlite ≠ Supabase. Cada SQL se auto-verifica e tem verificador; é a mesma disciplina que valeu para R1, S1 e E0.
☆ Pendências antes de aprovar a Fase B: (1) resultado da Fase A; (2) AV1 aplicado ou não; (3) decisão sobre a PR #38 (mesclar com a chave desligada antes da janela); (4) ordem de resolução das 101 joiners bloqueadas (não é pré-requisito); (5) Apps Scripts (`planilha-acao`/token não entram na Fase B).
