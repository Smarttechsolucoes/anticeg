# ENV2 — Envio Nacional em autoatendimento (código no e-mail cadastrado) — PREPARADO, NÃO PUBLICADO, NÃO APLICADO

## O fluxo da joiner (sem login e senha, sem WhatsApp, sem a equipe)
1. Entra no site pelo @ (como sempre) e abre **Envio Nacional** (`/envio`).
2. A tela mostra o @ e o botão **"Enviar código ao meu e-mail →"**. O e-mail NÃO é mostrado (nem parcial).
3. Recebe um código de **6 dígitos** no **e-mail já cadastrado**; digita e confirma.
4. O Envio abre sozinho (mesmo acesso do ENV1): vê só os próprios itens do storage, pede cotação, escolhe o frete, anexa o comprovante e acompanha o pedido. O acesso vale **7 dias** neste aparelho; "Sair deste acesso" revoga.
O @ sozinho **não** abre nada: sem o código as tabelas de envio continuam devolvendo 0 linhas.

## Como é seguro
- O código é gerado no servidor (aleatório, 6 dígitos), guardado só como **HMAC** (o banco nunca vê o código), vale **10 minutos**, aceita **5 tentativas** e só funciona **uma vez**; pedir um novo invalida o anterior.
- Limites no banco: por @ — 1 pedido por minuto e 3 por hora; por IP — 20 pedidos por hora (IP também em HMAC); 5 códigos esgotados no mesmo IP bloqueiam por uma hora.
- A resposta ao pedido é **sempre a mesma** (@ inexistente, sem e-mail, bloqueado, limite atingido ou enviado) e o envio do e-mail roda em segundo plano (sem diferença de tempo): não dá para descobrir quem existe ou qual é o e-mail.
- O navegador só envia `{acao, cog}` e `{acao, cog, codigo}`; **nunca** recebe e-mail, telefone ou dado pessoal. As funções do banco que emitem/validam código só executam como `service_role` (provado em rollback: visitante e conta logada são recusados).
- Nenhuma permissão pública foi reaberta: ENV1 e JOINERS1 ficam como estão. Foi removido o e-mail do cabeçalho do site (agora mostra o @) para não expor e-mail a quem só informou o @.

## Entrega do código: o que foi verificado
| Verificação | Resultado |
|---|---|
| Chave do SendGrid e remetente (segredos já existentes no projeto) | **Válidos**: a API aceitou uma mensagem de teste técnica endereçada ao domínio reservado `example.com` (HTTP 200, sem pessoa real). Destinatário malformado foi recusado (HTTP 400), o que prova que a chave autentica |
| Entrega real na caixa de entrada (Gmail/Hotmail) e se cai no spam | **NÃO verificada** — exige 1 e-mail de teste para um endereço seu (ver "Autorização pendente") |
| Domínio de envio autenticado (SPF/DKIM) | **Não verificável daqui** (depende do painel do SendGrid). Remetente em Gmail/Hotmail costuma ser recusado ou cair em spam |

## Limites honestos
- **22 joiners sem e-mail cadastrado** (de 457) não conseguem se autoatender: o e-mail delas precisa ser atualizado por uma pessoa. **26 e-mails** são usados por 2 ou mais @ (o código vai para o mesmo e-mail, que é da mesma pessoa na prática).
- Quem tem o e-mail cadastrado errado ou antigo não recebe o código (a tela orienta a avisar a equipe).
- E-mail e WhatsApp continuam legíveis publicamente na tabela `joiners` (risco prioritário pendente; a correção usará este mesmo código, sem senha).
- Se o provedor de e-mail cair, ninguém recebe código: o pedido segue "neutro" e a joiner não consegue entrar. Plano B: voltar aos links individuais do ENV1 (continuam funcionando).

## Colocação no ar (ordem; nada feito ainda)
1. `ENV2_codigo_aplicar.sql` (cria a tabela de códigos e as 3 funções; reversão `ENV2_codigo_reverter.sql`).
2. Publicar a Edge Function `envio-acesso` **sem verificação de JWT** (`supabase functions deploy envio-acesso --no-verify-jwt`).
3. Teste real de entrega com 1 e-mail de teste (autorização pendente) e fluxo completo com uma joiner sintética cujo e-mail é o seu.
4. Mesclar o PR do front (só então a aba passa a oferecer o código).
Reversão: reverter o merge do front; apagar a função; `ENV2_codigo_reverter.sql` (revoga os acessos criados por autoatendimento).

## Testes feitos (nada em produção)
- Banco, em rollback na produção com papéis reais: **27 verificações, 0 falhas** (limites por @ e por IP, código errado/vencido/reutilizado/esgotado, acesso de 7 dias funcionando no ENV1, "sair" revoga, visitante e conta logada não executam as funções) + reversão provada.
- Lógica da função (Node, sem rede): **11 testes** (resposta neutra idêntica, só HASH e IP em hash chegam ao banco, e-mail só com o código, CORS, entradas inválidas, falha do provedor sem vazamento, envio em segundo plano).
- Navegador (Playwright, API simulada): **autoatendimento completo** (pedir, código errado, código certo, abrir o Envio, consultas com o acesso, sair) sem e-mail na tela antes da confirmação, mais todos os testes anteriores (suíte do front 90 testes + navegador, todos passando).
