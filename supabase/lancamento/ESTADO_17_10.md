# Estado em 17/10/2026 — código preparado × aplicado em produção × liberado ao usuário

Legenda: **Preparado** = existe no repositório/branch e foi testado localmente, mas NÃO está no ar. **Aplicado** = executado em produção (SQL, função, segredo ou deploy). **Liberado** = uma joiner/administradora percebe ou usa.

| Item | Preparado | Aplicado em produção | Liberado ao usuário |
|---|---|---|---|
| R1 / R1.1 (pagamentos só por funções da administradora) | — | sim (PR #33, #35; SQL) | **sim**: botões do painel de pagamentos funcionam pelo servidor |
| S1 (exclusão protegida da masterlist) | — | sim (PR #24; SQL) | sim, invisível: o sync não apaga mais linhas com claim/pagas |
| S2 (sync casa por código) | — | sim (PR #36); 1º sync manual validado | sim, invisível: ids estáveis. **Verificação de 24 h: pendente** |
| N0 (tabela `notifications` fechada) + PR #37 | — | sim (SQL + deploy) | **sim, e visível**: os avisos internos do site ficam ocultos (push e e-mail seguem) |
| PR #39 (sem DELETE em `pushes`) | — | sim (deploy manual `1c86077`) | invisível (some o erro 409) |
| PR #40 (previews inertes) | — | sim (deploy automático) | só afeta previews da Vercel; produção igual |
| E00 / E0 (revogações) | — | sim (SQL) | invisível: DELETE só nas 12 tabelas do site |
| **Fase A**: N1, J4-0, J4c-4e | — | **sim** (SQL, 15:19–15:23Z) | **não**: infraestrutura (o site de hoje não chama nada disso) |
| 4 Edge Functions (`email-evento`, `push-evento`, `comprovante-upload`, `comprovante-url`) | — | **sim** (publicadas); `EMAIL_MODO_SECO=true` | **não**: o site de hoje não as chama; as antigas `send-email`/`send-push` seguem abertas e em uso |
| **AV1** (avatars só `<pasta>/avatar.jpg`, JPEG ≤ 256 KB) | — | **sim** (SQL, 15:27Z) | invisível: as 206 fotos intactas e abrindo; o site continua trocando a foto pelo mesmo caminho; envios fora do padrão passam a ser negados |
| Proxy `planilha-acao` + front que o usa (PR #41, rascunho) | **sim** (função, testes, sondas, plano) | **não** | **não**. **O token do Apps Script continua exposto e válido** |
| Patch v2 do `doPost` (token antes da trava, 2 tokens) | **sim** (`appsscript/`, teste em simulador) | **não** (Apps Script intocado) | não |
| Rotação do token do Apps Script | plano e sondas prontos | **não** | não |
| J4b … J5 (RLS do lançamento, comprovantes privados) + site novo (PR #38, rascunho) | **sim** (J5 corrigido para as 18 policies reais) | **não** | **não** (login geral desligado) |
| Onda 1 | 5 joiners já cadastradas (4 com conta do piloto) | `onda_liberada = 1` desde o piloto | só essas 5 poderiam ativar; **ninguém novo foi convidado** |
| Resolução das 101 joiners com vínculo ambíguo | relatório e estratégia | não | não |
| Auditoria dos Apps Scripts | relatório, auditores, patch | só leitura | — |

## Distinções importantes
☆ **"Publicado" ≠ "em uso":** as 4 funções novas e as 3 de CEG estão no ar, mas nenhuma tela as chama; elas só passam a valer quando o site novo (PR #38) for ao ar.
☆ **"Token fora do front" ≠ "token seguro":** enquanto a rotação não for feita, o token público do Web App continua aceito (sonda real de hoje: aceito com item inexistente, nada gravado).
☆ **Exposição que continua aberta hoje:** o token do Web App; `send-email`/`send-push` sem login; escrita do visitante em quase todas as tabelas de pedidos/joiners/claims (fecha no J4b em diante); buckets `comprovantes`/`mercari-comprovantes` públicos e com upload anônimo (fecha no J5).
