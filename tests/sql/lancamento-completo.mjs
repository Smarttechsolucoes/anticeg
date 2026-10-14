// SEQUÊNCIA COMPLETA DO LANÇAMENTO no laboratório fictício (PGlite): aplica, na ordem do roteiro, TODOS os SQLs de proteção (J4b, J4c-1, J4c-2, J4c-3, J4c-4a..e, J5), roda a verificação de cada um,
// e termina com a auditoria final (supabase/lancamento/99_auditoria_final.sql): nada INESPERADO pode sobrar para o visitante. Também percorre a vida da joiner ativada em todas as áreas.
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/lancamento-completo.mjs
import { laboratorio, como, n, negado, rodar, verificar, ok, fim, J, sql, U } from "./_lab.mjs";
const d = await laboratorio(); await d.exec(sql("08_storage_simulado.sql", "laboratorio"));
const ORDEM = [
  ["J4b_lote1_aplicar.sql", "J4b_lote1_verificar.sql"],
  ["J4c1_joiners_aplicar.sql", "J4c1_joiners_verificar.sql"],
  ["J4c2_pedidos_claims_aplicar.sql", "J4c2_pedidos_claims_verificar.sql"],
  ["J4c3_lojas_aplicar.sql", "J4c3_lojas_verificar.sql"],
  ["J4c4a_mercari_lojinha_aplicar.sql", "J4c4a_mercari_lojinha_verificar.sql"],
  ["J4c4b_claims_sets_aplicar.sql", "J4c4b_claims_sets_verificar.sql"],
  ["J4c4c_pessoais_aplicar.sql", "J4c4c_pessoais_verificar.sql"],
  ["J4c4d_admin_catalogos_aplicar.sql", "J4c4d_admin_catalogos_verificar.sql"],
  ["J4c4e_cegs_publico_aplicar.sql", "J4c4e_cegs_publico_verificar.sql"],
  ["J5_comprovantes_aplicar.sql", "J5_comprovantes_verificar.sql"],
];

// PRÉ-VOO (somente leitura) roda sem erro antes e depois, e acusa o que falta
{ const pv = (await d.query(sql("00_preflight_leitura.sql", "lancamento"))).rows;
  ok(pv.length > 60 && pv.some(r => r.secao === "1 cadastros" && r.item === "joiners no total") && pv.some(r => r.item.startsWith("J4c-4b") && r.valor === "NÃO"), "o pré-voo roda e mostra que o J4c-4b ainda NÃO está aplicado: " + pv.length + " linhas");
  const rep = pv.find(r => r.item.startsWith("@/COG repetidos")); ok(rep && Number(rep.valor) >= 2, "o pré-voo acusa os COGs repetidos ignorando maiúsculas (Ela/ela)"); }
// ANTES: o visitante alcança tudo
const antes = (await d.query(sql("99_auditoria_final.sql", "lancamento"))).rows;
ok(antes.filter(r => r.situacao.startsWith("INESPERADO")).length >= 20, "ANTES: a auditoria final acusa DEZENAS de coisas que o visitante alcança hoje: " + antes.filter(r => r.situacao.startsWith("INESPERADO")).length);

// o C0-B8 (config só da administradora) já está aplicado em produção: o laboratório reproduz esse estado antes do lançamento
{ const e = await rodar(d, "21_B8_config_aplicar.sql", "c0-contencao"); ok(e === null, "C0-B8 (já em produção) aplicado no laboratório" + (e ? ": " + e.slice(0, 160) : "")); }
for (const [aplicar, ver] of ORDEM) {
  const e = await rodar(d, aplicar, J); ok(e === null, `${aplicar} aplica sem erro` + (e ? ": " + e : ""));
  const v = await verificar(d, ver); ok(Object.keys(v).length >= 3, `${ver} responde (${Object.keys(v).length} itens)`);
}

// DEPOIS: auditoria final
const depois = (await d.query(sql("99_auditoria_final.sql", "lancamento"))).rows;
const ruins = depois.filter(r => r.situacao.startsWith("INESPERADO"));
ok(ruins.length === 0, "AUDITORIA FINAL: nada INESPERADO para o visitante" + (ruins.length ? " → " + ruins.map(r => r.tipo + ":" + r.objeto + " (" + r.situacao + ")").join("; ") : ""));
const revisar = depois.filter(r => r.situacao.startsWith("REVISAR"));
console.log("INFO  itens a REVISAR (" + revisar.length + "): " + revisar.map(r => r.objeto).join(" | ").slice(0, 400));
ok(depois.filter(r => r.situacao === "esperado" && r.tipo === "tabela/visão").length >= 8, "a auditoria lista o conteúdo público esperado (config, avisos gerais, fotos, links, calendário, preços, sugestões e as visões públicas)");
ok(depois.some(r => r.tipo === "storage: bucket de comprovantes" && r.situacao === "esperado") && !depois.some(r => r.tipo === "storage: bucket de comprovantes" && r.situacao !== "esperado"), "comprovantes: buckets privados com limite");

{ const pv2 = (await d.query(sql("00_preflight_leitura.sql", "lancamento"))).rows;
  ok(pv2.filter(r => r.secao === "2 já aplicado" && /^J(1|4|5)/.test(r.item) && r.valor === "NÃO").length === 0, "depois do lançamento o pré-voo mostra TODAS as funções do lançamento como aplicadas"); }
// VISITANTE: sondagem tabela por tabela (o equivalente local do teste de API anônima)
const TODAS = ["joiners", "masterlist", "pagamento_demandas", "multas_pagas", "claims", "reports", "envio_solicitacoes", "pre_cadastros", "grupos_envio", "push_subscriptions", "formulario_pedidos",
  "pedidos_revista", "pedidos_popup", "pedidos_wmag", "pedidos_wmag_leeknow", "pedidos_dazed_seungmin", "pedidos_smolmerch", "pedidos_bazaar_in", "pedidos_lightstick", "pedidos_popcorn_sleeve", "pedidos_singba", "pedidos_skzoo_rio",
  "mercari_pedidos", "lojinha_repasses", "repassos", "claim_eventos", "claim_sets", "claim_reservas", "feedbacks", "notifications", "push_reads", "joiner_storage", "joiner_conferencias", "joiner_updates",
  "envio_rounds", "envio_requests", "confirmacoes", "rastreios", "estoque_itens", "estoque_compras", "ceg_config", "antiv_badges"];
for (const t of TODAS) ok(negado(await como(d, "anon", null, `select * from public.${t} limit 1`)), `visitante NÃO lê ${t}`);
ok(negado(await como(d, "anon", null, "select * from public.claim_reservas_quadro")), "visitante NÃO lê o quadro dos sets");

// ANA (ativada) em todas as áreas: lê só o que é dela
const so = async (uid, t, col = "joiner_cog") => { const r = await como(d, "authenticated", uid, `select ${col} c from public.${t}`); return !r.erro && r.rows.every(x => String(x.c).toLowerCase() === "ana"); };
for (const t of ["pagamento_demandas", "multas_pagas", "claims", "reports", "envio_solicitacoes", "mercari_pedidos", "feedbacks", "notifications", "push_reads", "joiner_storage", "joiner_conferencias", "envio_requests"])
  ok(await so(2, t), `ana lê só as linhas dela em ${t}`);
ok(await so(2, "masterlist", "case when lower(trim(cog)) = 'disponivel' then 'ana' else cog end"), "ana lê só os itens dela na masterlist (e slots disponíveis)");
ok((await n(d, "authenticated", 2, "select 1 from public.joiners")) === 1 && (await n(d, "authenticated", 4, "select 1 from public.joiners")) === 0, "ana lê só a própria linha em joiners; conta sem vínculo não lê nada");
ok((await n(d, "authenticated", 1, "select 1 from public.joiners")) > 5 && (await n(d, "authenticated", 1, "select 1 from public.mercari_pedidos")) >= 2 && (await n(d, "authenticated", 1, "select 1 from public.envio_requests")) >= 2, "administradora preservada: lê tudo");
ok((await como(d, "authenticated", 2, "select public.meu_cog() c")).rows[0].c === "ana", "ana é reconhecida pela conta (meu_cog)");

// D3: conta CRIADA por qualquer pessoa (e-mail confirmado, sem vínculo a uma joiner) NÃO acessa nada privado: nem ler, nem escrever, nem usar função
{
  const SEM_VINCULO = [4, 20]; await d.exec(`insert into auth.users values ('${U(20)}', 'curioso@exemplo.com', now()) on conflict do nothing`);
  let vazou = [];
  for (const uid of SEM_VINCULO) {
    for (const t of [...TODAS, "claim_reservas_quadro"]) { const r = await como(d, "authenticated", uid, `select * from public.${t} limit 1`); if (!r.erro && r.rows.length) vazou.push(`${uid}:${t}`); }
    for (const q of ["update public.joiners set nome = 'x' returning id", "delete from public.mercari_pedidos returning id", "insert into public.mercari_pedidos (joiner_cog, status) values ('ana','pendente')", "update public.pagamento_demandas set status = 'pago' returning id", "insert into public.feedbacks (joiner_cog, message) values ('ana','x')", "insert into public.claim_reservas (evento_id, set_id, joiner_cog, membro) values (1,1,'ana','Han')"]) {
      const r = await como(d, "authenticated", uid, q); if (!r.erro && r.rows?.length) vazou.push(`${uid}:${q.slice(0, 30)}`);
    }
  }
  ok(vazou.length === 0, "D3: contas criadas SEM vínculo (2 contas) não leem nenhuma das " + (TODAS.length + 1) + " tabelas/visões protegidas nem alteram dado" + (vazou.length ? ": " + vazou.join(", ") : ""));
  const f = async (uid, fn, args) => (await como(d, "authenticated", uid, `select public.${fn}(${args}) r`)).rows?.[0]?.r;
  ok((await f(4, "claim_enviar", "1, '{\"Changbin\":1}'::jsonb")).motivo === "sem_conta" && (await f(4, "envio_entrar_round", "'x'")).motivo === "sem_conta" && (await f(4, "pedido_loja_criar", "'pedidos_revista', '{\"nome\":\"x\",\"email\":\"x@x.com\"}'::jsonb")).motivo === "login_necessario" && (await f(4, "comprovante_assinavel", "'comprovantes', 'pagamentos/ana.pdf'")) === false && JSON.stringify(await f(4, "ceg_itens", "'SKZOO'")) === "[]" && (await f(4, "meu_cog", "")) === null && (await f(4, "meus_dados", "")) === null,
     "D3: as funções recusam a conta sem vínculo (claim, fila de envio, pedido de loja, comprovante, itens do CEG, meus dados)");
  ok(negado(await como(d, "authenticated", 4, "insert into storage.objects (bucket_id, name) values ('avatars', 'sem/vinculo.png')")), "D3: conta sem vínculo não envia arquivo nem para os buckets públicos");
}
// COGs parecidos (Ela / ela são PESSOAS DIFERENTES): cada uma lê só as linhas do COG exato dela, em todas as tabelas com dono
{
  const comDono = [["pagamento_demandas", "joiner_cog"], ["mercari_pedidos", "joiner_cog"], ["reports", "joiner_cog"], ["feedbacks", "joiner_cog"], ["notifications", "joiner_cog"], ["joiner_storage", "joiner_cog"], ["envio_requests", "joiner_cog"], ["push_reads", "joiner_cog"], ["joiner_conferencias", "joiner_cog"], ["claim_reservas", "joiner_cog"], ["claims", "joiner_cog"], ["envio_solicitacoes", "joiner_cog"], ["lojinha_repasses", "joiner_cog"], ["multas_pagas", "joiner_cog"]];
  const extras = { lojinha_repasses: ", status", claims: ", status", reports: ", status", envio_solicitacoes: ", status", claim_reservas: ", evento_id, membro", multas_pagas: ", masterlist_id, campo, dias_atraso, valor_multa", claims_x: "" };
  const valores = { lojinha_repasses: ", 'vendido'", claims: ", 'pendente'", reports: ", 'pendente'", envio_solicitacoes: ", 'solicitação de envio'", claim_reservas: ", 1, 'Han'", multas_pagas: ", 1, 'item', 1, 1" };
  let cobertas = 0, trocadas = [];
  for (const [t, col] of comDono) {
    try { await d.exec(`insert into public.${t} (${col}${extras[t] || ""}) values ('Ela'${valores[t] || ""}), ('ela'${valores[t] || ""})`); } catch { continue; }
    cobertas++;
    const r7 = (await como(d, "authenticated", 7, `select ${col} c from public.${t} where ${col} in ('Ela', 'ela')`)).rows || [], r8 = (await como(d, "authenticated", 8, `select ${col} c from public.${t} where ${col} in ('Ela', 'ela')`)).rows || [];
    if (!(r7.length >= 1 && r7.every(x => x.c === "Ela")) || !(r8.length >= 1 && r8.every(x => x.c === "ela"))) trocadas.push(`${t} (Ela vê ${r7.map(x => x.c).join("/") || "nada"}; ela vê ${r8.map(x => x.c).join("/") || "nada"})`);
  }
  ok(cobertas >= 10 && trocadas.length === 0, `COGs parecidos: Ela e ela ficam isoladas em ${cobertas} tabelas com dono` + (trocadas.length ? " → MISTURA em: " + trocadas.join("; ") : ""));
  const ml = (await como(d, "authenticated", 7, "select cog from public.masterlist where lower(trim(cog)) <> 'disponivel'")).rows || [];
  ok(ml.every(x => x.cog === "Ela") && (await como(d, "authenticated", 8, "select cog from public.masterlist where lower(trim(cog)) <> 'disponivel'")).rows.every(x => x.cog === "ela"), "COGs parecidos: na masterlist cada uma lê só o COG exato");
}
// reversões protegidas dos lotes exigem a frase (nenhuma é executada aqui)
for (const [arq, frase] of [["J4c4a_mercari_lojinha_reverter_protegido.sql", ""], ["J4c4b_claims_sets_reverter_protegido.sql", ""], ["J4c4c_pessoais_reverter_protegido.sql", ""], ["J4c4d_admin_catalogos_reverter_protegido.sql", ""], ["J5_comprovantes_reverter_protegido.sql", ""]])
  ok(await rodar(d, arq, J, frase) !== null, `${arq} é recusada sem a frase de autorização`);
fim();
