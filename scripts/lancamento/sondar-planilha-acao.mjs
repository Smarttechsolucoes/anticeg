// Sondagem do proxy `planilha-acao` SOMENTE com a chave pública do site (visitante). Todas as chamadas são RECUSADAS pelo proxy: nada chega ao Apps Script e nada é gravado.
// Uso:  node scripts/lancamento/sondar-planilha-acao.mjs            (produção)    |    SONDAR_URL=... SONDAR_CHAVE=... node ... (outro projeto)
import { readFileSync } from "node:fs";
const fonte = readFileSync(new URL("../../src/supabase.js", import.meta.url), "utf8");
const BASE = (process.env.SONDAR_URL || "https://ghjfsmwwcfpfvrouyrka.supabase.co").replace(/\/$/, "");
const CHAVE = process.env.SONDAR_CHAVE || fonte.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0];
let falhas = 0;
async function chamar(corpo, extra = {}) {
  try {
    const r = await fetch(`${BASE}/functions/v1/planilha-acao`, { method: "POST", headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json", ...extra }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch { /* texto */ }
    return { status: r.status, erro: j?.erro || "", corpo: txt };
  } catch (e) { return { status: 0, erro: String(e).slice(0, 60), corpo: "" }; }
}
function linha(rotulo, r, esperados) {
  const ok = esperados.includes(r.status); if (!ok) falhas++;
  console.log(`${ok ? "OK   " : "FALHA"} ${rotulo}: HTTP ${r.status}${r.erro ? ` (${r.erro})` : ""}  [esperado ${esperados.join(" ou ")}]`);
}
const itens = [{ id_linha: "ZZZ-SONDA-INEXISTENTE", ceg: "X", nome_do_item: "X", valor_item: 1, frete_inter: 0, taxa_rf: 0 }];
const primeiro = await chamar({ acao: "confirmar", itens });
if (primeiro.status === 404) { console.log("AVISO: planilha-acao ainda NÃO está publicada (HTTP 404); nada a verificar."); process.exit(0); }
console.log("== visitante (chave pública): tudo deve ser recusado e NADA gravado ==");
linha("confirmar com item que não existe / sem pagamento em análise", primeiro, [403, 401]);
linha("cancelar (só administradora)", await chamar({ acao: "cancelar", itens }), [403]);
linha("repassar (só administradora)", await chamar({ acao: "repassar", id_linha: "ZZZ-SONDA-INEXISTENTE", novo_nome: "X", novo_twitter: "@x" }), [403]);
linha("aprovar_disponivel (só administradora)", await chamar({ acao: "aprovar_disponivel", id_linha: "ZZZ-SONDA-INEXISTENTE", novo_nome: "X", novo_twitter: "@x", vencimento: "01/01" }), [403]);
linha("recebido de item que não existe", await chamar({ acao: "recebido", id_linha: "ZZZ-SONDA-INEXISTENTE" }), [403]);
linha("atualizar_joiner sem alteração de cadastro recente", await chamar({ acao: "atualizar_joiner", twitter_antigo: "sonda_inexistente_xx", twitter_novo: "sonda_inexistente_yy" }), [403]);
linha("novo_joiner sem pedido de cadastro recente", await chamar({ acao: "novo_joiner", nome: "Sonda", twitter: "@sonda_inexistente_xx", email: "" }), [403]);
console.log("== formato e vazamento ==");
linha("ação desconhecida", await chamar({ acao: "apagar_tudo" }), [400]);
linha("corpo que não é JSON", await chamar("isto não é json"), [400]);
linha("id_linha inválido", await chamar({ acao: "recebido", id_linha: "a b;c" }), [400]);
const extra = await chamar({ acao: "confirmar", itens, token: "tentativa-de-token", url: "https://exemplo.invalid" });
linha("campos extras (token/url) são ignorados, nunca repassados", extra, [403, 401]);
const tudo = [primeiro, extra].map(r => r.corpo).join(" ");
const vazou = /anticeg-pag|script\.google\.com|AKfycb|PLANILHA_TOKEN/i.test(tudo); if (vazou) falhas++;
console.log(`${vazou ? "FALHA" : "OK   "} nenhuma resposta cita token, segredo ou o endereço do Web App`);
console.log(falhas ? `\n${falhas} verificação(ões) fora do esperado` : "\nTODAS AS VERIFICAÇÕES PASSARAM (nada foi gravado)");
process.exit(falhas ? 1 : 0);
