# Checklist exato — variáveis "Preview" da Vercel (pré-requisito do merge da PR #26)

Regra: **o merge da #26 só depois de TODOS os itens 1–6 marcados.** Sem as variáveis, todo preview deixa de construir (de propósito).

## A. Projeto Supabase de ENSAIO (separado da produção)
- [ ] 1. Criado `anticeg-ensaio` (Free, outra senha de banco). Guia: `supabase/ensaio/GUIA.md` (PR #27), passos 1–2.
- [ ] 2. Anotados **só no seu computador**: Project URL (`https://<REF_ENSAIO>.supabase.co`), chave **anon** e chave **service_role**. O `REF_ENSAIO` **não** pode ser `ghjfsmwwcfpfvrouyrka` (produção).

## B. Variáveis na Vercel (Settings → Environment Variables) — marcar SOMENTE "Preview"
| Nome | Valor | Production | Development |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `https://<REF_ENSAIO>.supabase.co` | **desmarcado** | **desmarcado** |
| `VITE_SUPABASE_ANON_KEY` | chave **anon** do ensaio (JWT com `"role":"anon"` e `"ref":"<REF_ENSAIO>"`) | **desmarcado** | **desmarcado** |
| `VITE_JOINERS_AUTH` | `true` (liga o login novo **só** no preview) | **desmarcado** | **desmarcado** |
- [ ] 3. As três variáveis existem **apenas** em Preview.
- [ ] 4. **Production não ganhou nenhuma variável nova** (a produção segue como está).
- [ ] 5. **Nenhuma** chave secreta no ambiente Preview: sem `service_role`, sem `SENDGRID_API_KEY`, sem `VAPID_PRIVATE_KEY`, sem token do GitHub/Apps Script. (A trava de build checa que a chave é `anon`, mas não vê outras variáveis.)
- [ ] 6. Settings → Deployment Protection: **Vercel Authentication** ligado para previews.

## C. Prova antes do merge (sem tocar na produção)
- [ ] 7. Com a #26 ainda aberta, abrir um preview dessa PR: o log do build deve mostrar `✔ Build de ensaio aponta para <REF_ENSAIO>.supabase.co (não é a produção)` e o site deve exibir a faixa laranja **AMBIENTE DE ENSAIO**.
- [ ] 8. No preview, DevTools → Network: nenhuma chamada para `ghjfsmwwcfpfvrouyrka.supabase.co`.
- [ ] 9. `/links.html` e `/mercari-embed/` no preview: não conectam em lugar nenhum (bloqueio por hostname `*.vercel.app` ≠ `anticeg.vercel.app`).

## D. Depois do merge
- [ ] 10. O primeiro build de **produção** passa sem variáveis novas (`VERCEL_ENV=production` não é afetado).
- [ ] 11. Conferir que um preview sem variáveis é **recusado** (mensagem `BUILD DE ENSAIO RECUSADO`) — é o comportamento esperado.

## Reversão
Reverter o merge da #26 (volta a URL/chave fixas). Nenhum dado é afetado.

## Efeito colateral a aceitar
Enquanto o item 3 não existir, **qualquer** PR/preview novo falha no check da Vercel (inclusive a PR de lançamento #38). A PR de lançamento só tem preview testável depois deste checklist.
