// Descobre, nos arquivos EXPORTADOS dos Google Apps Scripts (GERADORDEIDS, PAGAMENTO-AUTOMATICO, SYNC-TRIGGER, STATUS-SYNC...), quais falam DIRETO com o Supabase, com qual PAPEL e em quais tabelas,
// e se isso continua funcionando depois do RLS do lançamento. SOMENTE LEITURA: lê arquivos locais; não se conecta a nada; nunca imprime a chave (só o papel).
// Como exportar: no editor do Apps Script, copie o código de cada projeto para um arquivo .gs numa pasta SUA (ex.: appsscripts/GERADORDEIDS.gs) ou use `clasp pull`.
// Uso:  node scripts/lancamento/auditar-appsscript.mjs appsscripts/
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";

// tabelas que o lançamento FECHA para o papel anônimo (a chave pública do site)
export const FECHADAS = new Set(["joiners", "masterlist", "pagamento_demandas", "multas_pagas", "claims", "reports", "envio_solicitacoes", "pre_cadastros", "grupos_envio", "push_subscriptions", "formulario_pedidos",
  "pedidos_revista", "pedidos_popup", "pedidos_wmag", "pedidos_wmag_leeknow", "pedidos_dazed_seungmin", "pedidos_esquire_hyunjin", "pedidos_smolmerch", "pedidos_bazaar_in", "pedidos_lightstick", "pedidos_popcorn_sleeve", "pedidos_singba", "pedidos_skzoo_rio",
  "mercari_pedidos", "lojinha_repasses", "repassos", "claim_eventos", "claim_sets", "claim_reservas", "feedbacks", "notifications", "pushes", "push_reads", "joiner_storage", "joiner_conferencias", "joiner_updates",
  "envio_rounds", "envio_requests", "confirmacoes", "rastreios", "estoque_itens", "estoque_compras", "ceg_config", "antiv_badges", "config", "admin_roles", "contas_joiner", "vinculos_pendentes", "emails_enviados"]);
const ABERTAS_LEITURA = new Set(["item_fotos", "links_uteis", "cal_eventos", "tabela_precos", "sugestoes_tabela"]);
const RX_JWT = /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g;
const papelDoJwt = t => { try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).role || "desconhecido"; } catch { return "desconhecido"; } };

export function analisarArquivo(nome, texto) {
  const usaSupabase = /supabase\.co|supabase\.in|\/rest\/v1\/|createClient\(/i.test(texto);
  const jwts = [...new Set(texto.match(RX_JWT) || [])].map(papelDoJwt);
  const props = [...texto.matchAll(/getProperty\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g)].map(m => m[1]).filter(n => /supa|key|token|service|anon|secret/i.test(n));
  const envolveChaveServico = jwts.includes("service_role") || /service[_-]?role|SERVICE_KEY|SERVICE_ROLE/i.test(texto) || props.some(p => /service/i.test(p));
  const papeis = new Set(jwts); if (/service[_-]?role|SERVICE_KEY|SERVICE_ROLE/i.test(texto)) papeis.add("service_role (pelo nome)");
  const tabelas = [...new Set([...texto.matchAll(/\/rest\/v1\/([a-z_0-9]+)/gi)].map(m => m[1].toLowerCase()).filter(t => t !== "rpc"))];
  const rpcs = [...new Set([...texto.matchAll(/\/rest\/v1\/rpc\/([a-z_0-9]+)/gi)].map(m => m[1]))];
  const fns = [...new Set([...texto.matchAll(/\/functions\/v1\/([a-z0-9_-]+)/gi)].map(m => m[1]))];
  const storage = /\/storage\/v1\//i.test(texto);
  const sdk = [...texto.matchAll(/\.from\(\s*['"]([a-z_0-9]+)['"]\s*\)/gi)].map(m => m[1].toLowerCase());
  const todas = [...new Set([...tabelas, ...sdk])];
  const escrita = /method\s*:\s*['"](post|patch|put|delete)['"]/i.test(texto) || /\.(insert|update|upsert|delete)\(/.test(texto);
  let veredito, motivo = [];
  if (!usaSupabase) veredito = "NÃO ACESSA o Supabase (continua funcionando)";
  else if (envolveChaveServico && !jwts.includes("anon")) veredito = "usa chave de SERVIÇO: ignora o RLS e continua funcionando";
  else if (jwts.length === 0 && props.length) veredito = "VERIFICAR: a chave fica nas propriedades do script (" + props.join(", ") + "); confira se é a de serviço ou a pública";
  else if (jwts.includes("anon") || (jwts.length === 0 && !envolveChaveServico)) {
    const quebra = todas.filter(t => FECHADAS.has(t)), leitura = todas.filter(t => ABERTAS_LEITURA.has(t));
    if (quebra.length) { veredito = "QUEBRA depois do RLS: usa a chave PÚBLICA em tabela que o lançamento fecha"; motivo = quebra; }
    else if (todas.length === 0 && !rpcs.length) veredito = "VERIFICAR: usa a chave pública mas não consegui ler as tabelas (nome montado em variável?)";
    else veredito = "usa a chave pública só em conteúdo público/funções públicas" + (leitura.length ? " (leitura)" : "") + (escrita && leitura.length ? ": ATENÇÃO, escrita em conteúdo público também fecha" : "");
  } else veredito = "VERIFICAR";
  const rpcsPrivadas = rpcs.filter(r => !["entrar_com_arroba", "solicitar_cadastro", "contar_recrutados", "resolver_recrutador", "pedido_loja_criar", "ceg_resumo", "ceg_vencimentos"].includes(r));
  if (veredito.startsWith("usa a chave pública") && rpcsPrivadas.length) veredito = "VERIFICAR: usa a chave pública em funções que podem fechar (" + rpcsPrivadas.join(", ") + ")";
  return { arquivo: nome, usaSupabase, papeis: [...papeis], tabelas: todas, rpcs, funcoes: fns, storage, escrita, veredito, motivo };
}

function listar(p) {
  const st = statSync(p); if (st.isFile()) return [p];
  return readdirSync(p).flatMap(n => { const q = join(p, n); const s = statSync(q); return s.isDirectory() ? (n === "node_modules" || n === ".git" ? [] : listar(q)) : (/\.(gs|js|mjs|txt|json|html)$/i.test(n) ? [q] : []); });
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const pasta = process.argv[2];
  if (!pasta || !existsSync(pasta)) { console.error("Informe a pasta com os arquivos exportados dos Apps Scripts. Ex.: node scripts/lancamento/auditar-appsscript.mjs appsscripts/"); process.exit(2); }
  const rel = listar(pasta).map(f => analisarArquivo(basename(f), readFileSync(f, "utf8")));
  let problemas = 0;
  for (const r of rel) {
    console.log(`\n■ ${r.arquivo}\n  Supabase: ${r.usaSupabase ? "SIM" : "não"}${r.papeis.length ? " · papel: " + r.papeis.join(", ") : ""}${r.tabelas.length ? " · tabelas: " + r.tabelas.join(", ") : ""}${r.rpcs.length ? " · funções: " + r.rpcs.join(", ") : ""}${r.storage ? " · usa Storage" : ""}\n  → ${r.veredito}${r.motivo.length ? " (" + r.motivo.join(", ") + ")" : ""}`);
    if (/^(QUEBRA|VERIFICAR)/.test(r.veredito)) problemas++;
  }
  console.log(`\n${rel.length} arquivo(s) examinado(s); ${problemas ? problemas + " precisam de ação ANTES do lançamento." : "nenhum quebra com o RLS."}`);
  process.exit(problemas ? 1 : 0);
}
