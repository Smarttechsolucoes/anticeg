# Implantação controlada do login geral direto em produção (sem ambiente de ensaio) — revisão de 17/10/2026

Nada deste documento foi executado. Login geral DESLIGADO; J4-0, J4b…J5, N1 e as funções novas NÃO aplicados. Complementa `LANCAMENTO.md` e `CHECKLIST.md` (que seguem válidos) com o **estado real de produção de hoje** e o que mudou desde que eles foram escritos.

## 1. Estado real de produção (leituras somente de hoje)
| Item | Hoje |
|---|---|
| Etapas já registradas | A1, A2, B1–B8, B8-0, **J1, J1c, J3, J4a, J4d**, N0, PILOTO-1, R1, R1.1, S1 (+ **E00/E0**, aplicados em 17/10) |
| **Ainda não aplicados** | **N1**, **J4-0**, **J4c-4e** (fase A) e **J4b, J4c-1, J4c-2, J4c-3, J4c-4a, 4b, 4c, 4d, 4f, J5** (fase B) |
| Joiners | 456; **407** com e-mail de formato válido; **49** sem e-mail (ficam no modo limitado até a administradora corrigir); **40** @ repetidos ignorando maiúsculas (ex.: Ela/ela, não ativam sozinhas); **68** e-mails repetidos entre joiners diferentes (não vinculam sozinhas) |
| Contas | 3 administradoras; 8 contas no Auth, 4 vinculadas a uma joiner |
| Auth (config pública) | e-mail ligado, confirmação de e-mail ligada, **cadastro público desligado**, telefone desligado (1 aviso: sem SMS, irrelevante) |
| Edge Functions publicadas | `login-joiner`, `pedir-codigo-joiner`, `recuperar-senha-joiner` (v1, 15/10, JWT exigido) + as antigas `send-email` e `send-push` (**sem** exigir JWT), `swift-processor` |
| **Edge Functions que FALTAM** | `email-evento`, `push-evento` (precisam do N1), `comprovante-upload`, `comprovante-url` (+ `planilha-acao`, só quando o token do Apps Script for tratado) |
| Segredos existentes (nomes) | SENDGRID_API_KEY, SENDER_EMAIL, SENDER_NAME, SITE_URL, VAPID_PUBLIC/PRIVATE/SUBJECT |
| **Segredos que FALTAM** | `ADMIN_NOTIFY_EMAIL`, `ALLOWED_ORIGINS`, `EMAIL_MODO_SECO` (começar `true`), `PLANILHA_URL`/`PLANILHA_TOKEN` (futuro) |
| Storage | 7 buckets públicos com policies de INSERT/UPDATE/DELETE para o visitante; `comprovantes` 1.141 arquivos (38 sem dona, 82 com mais de uma dona), `mercari-comprovantes` 56 |
| E0 | DELETE só nas 12 tabelas do site (+ `config` para a administradora); concessões do `service_role` e ACL de funções intactas |

## 2. O que a revisão encontrou (ajustes ao roteiro)
1. **Ordem das funções:** `email-evento` e `push-evento` dependem do **N1** (controle de e-mails enviados). O roteiro já coloca o N1 na fase A; manter. `send-email`/`send-push` antigas só saem de cena **depois** do site novo (quem chama é o site de hoje).
2. **`verificar-api.mjs` NÃO é somente leitura hoje:** ele tenta enviar `__teste_visitante.txt` para `comprovantes` e `avatars` com a chave pública. Como esses buckets **aceitam upload anônimo agora**, rodá-lo **antes do J5** criaria dois arquivos de teste no Storage de produção. **Usar apenas depois do J5** (onde o esperado é HTTP ≥ 400), ou antes disso com a seção de Storage desligada. O "antes" da fase A deve usar só `00_preflight_leitura.sql` e `J5_inventario_leitura.sql`.
3. **`avatars` fica fora do J5:** o bucket de fotos de perfil continua público e com INSERT/UPDATE/DELETE para o visitante (o site grava e apaga avatars pela chave pública; 11 DELETEs nos logs). Não bloqueia o lançamento, mas é uma pendência de segurança separada (exige mover o upload para uma função com login).
4. **Inconsistência de texto:** `LANCAMENTO.md` 0/D2 diz que a variável `PERMITIR_COMPROVANTE_ANONIMO` não reabre nada; o passo 3.4 manda defini-la como `false`. Definir como `false` não faz mal; só não é necessário. Ajuste editorial.
5. **Notificações internas** seguem ocultas (`NOTIFICACOES_INTERNAS_ATIVAS=false`, PR #37). O J4c-4c cria as policies de `notifications` (compatível com o N0). A flag só vira `true` num deploy **separado**, depois da validação das policies com contas reais.
6. **Pagamentos e sync:** o J4b fecha `pagamento_demandas`, `multas_pagas` e `masterlist`. Compatível com R1/R1.1 (funções SECURITY DEFINER só para administradora), S1 (gatilho) e S2 (sync usa chave de serviço). Testado em PGlite (suíte completa passou na consolidação).
7. **Sync agendado durante a janela:** a chave de serviço ignora RLS; mesmo assim, evitar disparar o sync manualmente durante a janela e conferir a primeira execução depois dela.

## 3. Como reduzir o risco sem ambiente de ensaio
O que **não** existe: um ensaio real no Supabase (as fases A e B nunca rodaram no Supabase de verdade, só em PGlite com dados fictícios). O risco residual é diferença PGlite × Supabase. Mitigações, em camadas:
1. **Tudo que é aditivo vem antes e é provado sozinho** (fase A): N1, J4-0, J4c-4e, funções e segredos. Cada SQL tem guarda "Nada foi alterado", verificador e reversão protegida; nenhum muda o acesso de ninguém.
2. **Backup antes** (painel + `db dump` local) e leitura "antes" (`00_preflight`, `J5_inventario`, impressão de contagens e de permissões).
3. **Interface nova só depois dos dados fechados**, com `VITE_JOINERS_AUTH` ausente até a janela. Mesclar a PR consolidada com a chave desligada **não muda nada** para as joiners.
4. **Janela com manutenção ligada** e cada SQL da fase B aplicado **um por vez**, com o `_verificar` e a fumaça; se qualquer verificação falhar, **para** e informa (sem reverter dados às cegas).
5. **Duas contas controladas + administradora** (onda 1) para provar a interface; ativação em ondas pequenas.
6. **Interruptores de volta:** manutenção ligada; "Instant Rollback"/promoção do deploy anterior na Vercel; `ativacao_estado.onda_liberada` recuado; `_reverter_protegido.sql` de cada passo, na ordem inversa.
7. **Preview inerte** (PR #40) evita testar em preview apontando para a produção: previews não têm banco.

## 4. Pacote final para aprovação (ordem)
**Pré-requisitos que dependem de você**
☆ Backup (painel + cópia local) e janela de ≈ 30 min fora do horário de pico. ☆ **Onda 1** (lista de @) e as **duas contas controladas** (A e B) com autorização por escrito das donas. ☆ Confirmar que existem **≥ 2 administradoras** com senha (hoje: 3). ☆ Vercel: desligar "Auto-assign Custom Domains" **ou** usar a alternativa do roteiro 3.5. ☆ Domínio(s) para `ALLOWED_ORIGINS`.

**Fase A (sem impacto; pode ser em dias diferentes)** — um por vez, com `_verificar`: N1 → J4-0 → J4c-4e. Publicar `email-evento`, `push-evento`, `comprovante-upload`, `comprovante-url`; segredos novos (`EMAIL_MODO_SECO=true`). Mesclar a PR consolidada com a chave desligada, **depois** das funções.

**Fase B (janela)**: manutenção ON → J4b → J4c-1 → J4c-2 → J4c-3 → J4c-4a → 4b → 4c → 4d → 4f → J5 (cada um com o verificador) → `99_auditoria_final.sql` → `verificar-api.mjs` → segredos finais → onda 1 → promover o site → fumaça com A, B e a administradora → manutenção OFF → anunciar a onda 1.

**Não está neste pacote:** rotação do token do Apps Script, `planilha-acao`, `NOTIFICACOES_INTERNAS_ATIVAS`, fechar o bucket `avatars`, remover `send-email`/`send-push`, ondas 2+.

## 5. Decisões que dependem de você para liberar a fase A
1. Quem entra na **onda 1** e quem são **A e B**.
2. Data/hora da janela da fase B.
3. Autorização, por etapa, para: aplicar N1/J4-0/J4c-4e; publicar as 4 funções e criar os segredos; mesclar a PR consolidada com a chave desligada.
