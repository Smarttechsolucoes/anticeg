# Duplicidades na ativação e preparo da onda 1 (17/10/2026) — somente leitura; nenhuma conta foi tocada

## 1. Impacto medido hoje (agregado, sem nomes)
| | Joiners |
|---|---|
| Total | **456** |
| **Ativam sozinhas** (e-mail válido, único entre as joiners, COG único ignorando maiúsculas) | **355** |
| Bloqueadas (qualquer motivo) | **101** |
| …sem e-mail de formato válido | 49 (47 só por isso; 2 também têm COG repetido) |
| …COG repetido ignorando maiúsculas (Ela/ela) | 40 em 20 grupos |
| …e-mail compartilhado entre joiners | 50 em 25 grupos (18 grupos = mesma pessoa com variação de maiúscula no @; **7 grupos = @ diferentes** no mesmo e-mail; nenhum e-mail com mais de 2 @) |
| …mais de um motivo ao mesmo tempo | 38 |
| Bloqueadas **com** itens na masterlist | 76 (**502 de 6.415 itens**, 7,8 %) |
| Bloqueadas com claims / com demandas de pagamento | 2 / 11 |
☆ O preflight diz 68 e-mails repetidos porque conta também e-mails de formato inválido repetidos; só os de formato válido (50 joiners) disputam um vínculo.
☆ Pendências já abertas em `vinculos_pendentes`: 0.

## 2. O que o sistema faz com elas (já testado, J1 `ativar_minha_conta`)
Quem é bloqueada **não ganha acesso automático** e **nada é fundido**: a pessoa entra em **modo limitado** (só com o @) e vira um pedido em `vinculos_pendentes`. A administradora escolhe a joiner exata pelo **id** (`admin_buscar_joiners` → `admin_resolver_vinculo`) ou desvincula (`admin_desvincular_conta`). Uma conta vincula a **uma** joiner; o mesmo e-mail não pode ser duas contas.

## 3. Estratégia de resolução (sem modificar contas reais)
Relatório pronto e somente leitura: **`supabase/lancamento/DUP_relatorio_leitura.sql`** (101 linhas: id da joiner, motivo, grupo, e-mail MASCARADO, itens/claims/demandas, e a estratégia sugerida). Usar com a administradora; não colar em chat nem commitar a saída.
| Estratégia | Casos | Como resolver |
|---|---|---|
| **A — sem e-mail válido** | 47 (+2) | contato direto com a joiner, a administradora cadastra o e-mail correto no cadastro dela; depois ela ativa sozinha. Enquanto isso: modo limitado, sem perda |
| **B — mesma pessoa, @ com variação de maiúscula** (20 grupos) | 40 | a administradora escolhe **uma joiner "principal"** por grupo (a que tem os itens/claims/pagamentos; se as duas têm atividade, decidir com a pessoa) e aprova o vínculo nela. **Não unir registros automaticamente** (a ferramenta de união não está no repositório; qualquer fusão é uma operação própria, com backup, fora do lançamento). Os outros registros do grupo seguem em modo limitado |
| **C — e-mail usado por @ diferentes** (7 grupos) | 14 | perguntar à pessoa qual é o @ principal (vínculo) e, para o outro, um segundo e-mail (ele ativa sozinho depois) ou ficar em modo limitado |
Ordem sugerida: primeiro as 11 com demandas e as 2 com claims (impacto real), depois as 76 com itens, por fim as sem atividade. Regra de ouro: **nunca vincular pelo @ sozinho**; sempre pelo id escolhido pela administradora.
**Antes do lançamento nada disso é obrigatório:** as 355 que ativam sozinhas não dependem das 101; as 101 continuam como hoje (modo limitado) até serem resolvidas.

## 4. Onda 1 (pequena, só contas autorizadas)
☆ **Estado de hoje (leitura):** `ativacao_estado.onda_liberada = 1`, `liberar_todas = false`; `ativacao_ondas` tem **5 joiners na onda 1**; **4 já têm conta vinculada** (os do piloto de senhas, 8 contas no Auth, todas com e-mail confirmado); 3 administradoras, nenhuma delas é joiner vinculada. **351** joiners com e-mail válido único e COG único ainda sem conta — elas **não** estão em nenhuma onda, então **não conseguem ativar** (a trava é no servidor).
☆ **Proposta:** a onda 1 continua sendo **só estes 5** + **A e B** (duas contas controladas, com autorização por escrito). Nenhuma outra joiner é convidada, nenhum e-mail em massa.
☆ **Critérios para A e B:** joiner real que deu autorização por escrito; e-mail de formato válido e único; COG único; **sem** claims/pagamentos em aberto sensíveis (os testes só leem, mas melhor não ter risco); e-mail que a pessoa realmente acessa (o código chega por ele).
☆ **Como cadastrar (só na janela, com aprovação):** `insert into public.ativacao_ondas (joiner_id, onda) values (<id A>, 1), (<id B>, 1) on conflict (joiner_id) do update set onda = excluded.onda;` e conferir com `J4d_ondas_verificar.sql`. `onda_liberada` já é 1.
☆ **Antes de abrir:** `EMAIL_MODO_SECO=false` só na janela; subir o limite de e-mails por hora no Auth para algo acima de 200; modelos de e-mail em português (`supabase/joiners-auth/templates-email/`).
☆ **Parada da onda:** `update public.ativacao_estado set onda_liberada = 0` impede novas ativações sem tocar quem já ativou.
☆ **Decisão sua:** os ids de A e B (eu só preciso do @/nome de quem autorizou; eu busco o id).
