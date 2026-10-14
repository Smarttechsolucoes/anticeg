// Verificação do lançamento PELA API REAL (PostgREST + Auth + Edge Functions), SOMENTE LEITURA: não cria, altera nem apaga nada.
//  1) VISITANTE (só a chave pública): nenhuma tabela protegida pode ser lida; funções e Storage fechados.
//  2) DUAS CONTAS CONTROLADAS (com autorização das donas): cada uma vê só o que é dela e NADA da outra.
//  3) ADMINISTRADORA (opcional): continua vendo tudo.
// Uso (PowerShell), todas as variáveis só no seu computador:
//   $env:LANC_URL="https://SEUREF.supabase.co"; $env:LANC_ANON="<chave anon pública>"
//   (opcional) $env:LANC_A_COG="ana"; $env:LANC_A_SENHA="..."; $env:LANC_B_COG="bia"; $env:LANC_B_SENHA="..."
//   (opcional) $env:LANC_ADMIN_EMAIL="..."; $env:LANC_ADMIN_SENHA="..."
//   node scripts/lancamento/verificar-api.mjs
// Recusa rodar com chave de serviço. Nunca imprime senha, token nem e-mail. As contas A e B precisam ser de pessoas que AUTORIZARAM o teste.
const URL_ = (process.env.LANC_URL || "").replace(/\/$/, ""), ANON = process.env.LANC_ANON || "";
const papelDe = t => { try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).role; } catch { return ""; } };
if (!URL_ || !ANON) { console.error("Defina LANC_URL e LANC_ANON (chave PÚBLICA)."); process.exit(2); }
if (papelDe(ANON) !== "anon") { console.error("A chave informada não é a pública (anon). Nunca use a chave de serviço aqui."); process.exit(2); }

let falhas = 0, avisos = 0;
const ok = (c, m) => { console.log((c ? "OK     " : "FALHA  ") + m); if (!c) falhas++; };
const aviso = (m) => { console.log("AVISO  " + m); avisos++; };
const chamar = async (caminho, { token, metodo = "GET", corpo, extra = {} } = {}) => {
  const r = await fetch(`${URL_}${caminho}`, { method: metodo, headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, "Content-Type": "application/json", ...extra }, body: corpo ? JSON.stringify(corpo) : undefined });
  let json = null; try { json = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, json };
};
const lista = (r) => Array.isArray(r.json) ? r.json : [];
const negado = r => r.status === 401 || r.status === 403 || (r.status >= 400 && /permission denied|42501|row-level security/i.test(JSON.stringify(r.json || "")));

// ── tabelas e quem é a dona de cada linha ───────────────────────────────────────────────────────────────────────────────────────────
const PROTEGIDAS = ["joiners", "masterlist", "pagamento_demandas", "multas_pagas", "claims", "reports", "envio_solicitacoes", "pre_cadastros", "grupos_envio", "push_subscriptions", "formulario_pedidos",
  "pedidos_revista", "pedidos_popup", "pedidos_wmag", "pedidos_wmag_leeknow", "pedidos_dazed_seungmin", "pedidos_smolmerch", "pedidos_bazaar_in", "pedidos_lightstick", "pedidos_popcorn_sleeve", "pedidos_singba", "pedidos_skzoo_rio",
  "mercari_pedidos", "lojinha_repasses", "repassos", "claim_eventos", "claim_sets", "claim_reservas", "claim_reservas_quadro", "feedbacks", "notifications", "push_reads", "joiner_storage", "joiner_conferencias",
  "joiner_updates", "envio_rounds", "envio_requests", "confirmacoes", "rastreios", "estoque_itens", "estoque_compras", "ceg_config", "antiv_badges"];
const COM_DONA = [["pagamento_demandas", "joiner_cog"], ["multas_pagas", "joiner_cog"], ["claims", "joiner_cog"], ["reports", "joiner_cog"], ["envio_solicitacoes", "joiner_cog"], ["mercari_pedidos", "joiner_cog"],
  ["feedbacks", "joiner_cog"], ["notifications", "joiner_cog"], ["push_reads", "joiner_cog"], ["joiner_storage", "joiner_cog"], ["joiner_conferencias", "joiner_cog"], ["envio_requests", "joiner_cog"],
  ["claim_reservas", "joiner_cog"], ["antiv_badges", "joiner_cog"], ["joiners", "cog"]];

console.log("Projeto:", new URL(URL_).host, "\n── 1) VISITANTE ──");
for (const t of PROTEGIDAS) {
  const r = await chamar(`/rest/v1/${t}?select=*&limit=1`);
  if (negado(r)) ok(true, `visitante NÃO lê ${t} (HTTP ${r.status})`);
  else if (r.status === 200 && lista(r).length === 0) { aviso(`${t}: respondeu vazio em vez de "permissão negada" (confira se o script de proteção foi aplicado)`); ok(true, `visitante NÃO lê ${t} (vazio)`); }
  else ok(false, `visitante LÊ ${t} (HTTP ${r.status}, ${lista(r).length} linha(s))`);
}
for (const [fn, corpo] of [["claim_enviar", { p_evento: 1, p_pedidos: {} }], ["claim_organizar", { p_evento: 1 }], ["envio_entrar_round", { p_itens: null }], ["comprovante_assinavel", { p_bucket: "comprovantes", p_path: "x" }], ["ceg_itens", { p_ceg: "SKZOO" }], ["pedido_loja_criar", { p_tabela: "pedidos_revista", p_dados: {} }], ["meus_dados", {}]]) {
  const r = await chamar(`/rest/v1/rpc/${fn}`, { metodo: "POST", corpo });
  ok(negado(r) || r.status === 404 || r.json === null || (Array.isArray(r.json) && r.json.length === 0), `visitante NÃO consegue usar ${fn} (HTTP ${r.status})`);
}
const sb = await chamar("/storage/v1/object/list/comprovantes", { metodo: "POST", corpo: { prefix: "", limit: 1 } });
ok(negado(sb) || (Array.isArray(sb.json) && sb.json.length === 0), `visitante NÃO lista os comprovantes (HTTP ${sb.status})`);
const pub = await fetch(`${URL_}/storage/v1/object/public/comprovantes/qualquer/arquivo.jpg`);
ok(pub.status === 400 || pub.status === 404 || pub.status === 401 || pub.status === 403, `link "público" de comprovante não abre (HTTP ${pub.status}); 400/404 = bucket privado`);
const up = await fetch(`${URL_}/storage/v1/object/comprovantes/__teste_visitante.txt`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "text/plain" }, body: "x" });
ok(up.status >= 400, `visitante NÃO envia arquivo direto para comprovantes (HTTP ${up.status})`);
const upA = await fetch(`${URL_}/storage/v1/object/avatars/__teste_visitante.txt`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "text/plain" }, body: "x" });
ok(upA.status >= 400, `visitante NÃO envia arquivo direto para avatars (HTTP ${upA.status})`);
const cfg = await chamar("/rest/v1/config?select=key&key=in.(admin_pin,senha_manutencao,senha_disponiveis)");
ok(lista(cfg).length === 0, "visitante NÃO lê as chaves secretas da config (PIN e senhas)");
const camposPriv = await chamar("/rest/v1/joiners_publico?select=*&limit=1");
ok(!lista(camposPriv).some(l => ["email", "cpf", "telefone", "whatsapp", "saldo_cashback", "bloqueado"].some(k => k in l)), "a visão pública de joiners não traz e-mail, CPF, telefone, WhatsApp, saldo nem bloqueio");

// ── contas controladas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function entrar(cog, senha) {
  const r = await chamar("/functions/v1/login-joiner", { metodo: "POST", corpo: { cog, senha } });
  return r.json?.access_token || null;
}
const contas = [];
for (const [rotulo, cog, senha] of [["A", process.env.LANC_A_COG, process.env.LANC_A_SENHA], ["B", process.env.LANC_B_COG, process.env.LANC_B_SENHA]]) {
  if (!cog || !senha) continue;
  const token = await entrar(String(cog).replace(/^@/, ""), senha);
  ok(!!token, `conta ${rotulo} (@${cog}) entra por @ + senha`);
  if (token) contas.push({ rotulo, cog: String(cog).replace(/^@/, "").toLowerCase(), token });
}
console.log(contas.length ? "\n── 2) CONTAS CONTROLADAS (somente leitura) ──" : "\n(sem contas controladas: defina LANC_A_COG/LANC_A_SENHA e LANC_B_COG/LANC_B_SENHA para testar o isolamento entre joiners)");
for (const c of contas) {
  const eu = await chamar("/rest/v1/rpc/meu_cog", { metodo: "POST", token: c.token, corpo: {} });
  ok(String(eu.json || "").toLowerCase() === c.cog, `conta ${c.rotulo}: o servidor reconhece @${c.cog}`);
  for (const [t, col] of COM_DONA) {
    const r = await chamar(`/rest/v1/${t}?select=${col}&limit=500`, { token: c.token });
    const donas = lista(r).map(x => String(x[col]).toLowerCase());
    ok(r.status === 200 && donas.every(d => d === c.cog), `conta ${c.rotulo}: em ${t} só aparecem linhas dela (${donas.length} linha(s))`);
  }
  const ml = await chamar("/rest/v1/masterlist?select=cog&limit=1000", { token: c.token });
  ok(lista(ml).every(l => String(l.cog).toLowerCase() === c.cog || String(l.cog).trim().toLowerCase() === "disponivel"), `conta ${c.rotulo}: na masterlist só os itens dela e os slots disponíveis (${lista(ml).length})`);
  const itens = await chamar("/rest/v1/rpc/ceg_itens", { metodo: "POST", token: c.token, corpo: { p_ceg: lista(await chamar("/rest/v1/rpc/ceg_resumo", { metodo: "POST", token: c.token, corpo: {} }))[0]?.ceg || "SKZOO" } });
  const arr = Array.isArray(itens.json) ? itens.json : [];
  ok(!arr.some(l => ["valor_item", "frete_inter", "taxa_rf", "pago_item", "pago_frete", "pago_rf", "venc_item"].some(k => k in l)), `conta ${c.rotulo}: a lista de itens do CEG não traz valor nem pagamento de ninguém (${arr.length} item(ns))`);
  const q = await chamar("/rest/v1/claim_reservas_quadro?select=joiner_nome,is_admin&limit=500", { token: c.token });
  ok(!lista(q).some(l => l.joiner_nome && !l.is_admin), `conta ${c.rotulo}: o quadro dos sets não mostra nome REAL de ninguém (só o "GOM" da administradora)`);
}
if (contas.length === 2) {
  const [A, B] = contas;
  for (const [t, col] of COM_DONA) {
    const r = await chamar(`/rest/v1/${t}?select=${col}&${col}=ilike.${encodeURIComponent(B.cog)}`, { token: A.token });
    ok(r.status === 200 && lista(r).length === 0, `ISOLAMENTO: A pedindo as linhas de B em ${t} recebe ZERO`);
  }
  const r = await chamar(`/rest/v1/rpc/comprovante_assinavel`, { metodo: "POST", token: A.token, corpo: { p_bucket: "comprovantes", p_path: "inexistente/arquivo-de-b.jpg" } });
  ok(r.json === false, "A não consegue assinar um comprovante que não é dela");
}

// ── administradora (opcional) ─────────────────────────────────────────────────────────────────────────────────────────────────────────
if (process.env.LANC_ADMIN_EMAIL && process.env.LANC_ADMIN_SENHA) {
  console.log("\n── 3) ADMINISTRADORA (somente leitura) ──");
  const tk = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: process.env.LANC_ADMIN_EMAIL, password: process.env.LANC_ADMIN_SENHA }) }).then(r => r.json()).catch(() => ({}));
  ok(!!tk.access_token, "administradora entra por e-mail + senha");
  if (tk.access_token) {
    const eAdmin = await chamar("/rest/v1/rpc/is_admin", { metodo: "POST", token: tk.access_token, corpo: {} });
    ok(eAdmin.json === true, "o servidor reconhece a administradora (is_admin)");
    for (const t of ["joiners", "masterlist", "pagamento_demandas", "mercari_pedidos", "claim_reservas", "envio_solicitacoes", "pedidos_wmag_leeknow", "estoque_itens", "rastreios"]) {
      const r = await chamar(`/rest/v1/${t}?select=id&limit=1`, { token: tk.access_token });
      ok(r.status === 200 && lista(r).length >= 0, `administradora lê ${t} (HTTP ${r.status})`);
    }
  }
}
console.log(`\n${falhas ? falhas + " FALHA(S): NÃO prossiga; veja o roteiro de reversão." : "TODAS AS VERIFICAÇÕES PASSARAM"}${avisos ? " · " + avisos + " aviso(s)" : ""}`);
process.exit(falhas ? 1 : 0);
