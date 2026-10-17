// Sondagem DIRETA do Web App do Apps Script, sem gravar nada: usa um id_linha que não existe, então a ação `confirmar` só LÊ e responde "nao_encontrado" (sem escrita e sem disparar sync).
// A conferência do token vem ANTES de qualquer ação (doPost v2), então esta única ação prova o comportamento das outras 6. NÃO use outras ações aqui: com um token aceito elas gravariam.
// O token e a URL vêm de variáveis de ambiente e NUNCA são impressos.
// Uso (PowerShell):  $env:WEBAPP_URL="https://script.google.com/macros/s/.../exec"; $env:WEBAPP_TOKEN="<token a testar>"
//   node scripts/lancamento/sondar-webapp.mjs aceito             -> WEBAPP_TOKEN deve ser ACEITO
//   node scripts/lancamento/sondar-webapp.mjs recusado           -> WEBAPP_TOKEN deve ser RECUSADO
//   node scripts/lancamento/sondar-webapp.mjs apos-rotacao       -> WEBAPP_TOKEN (o NOVO) é aceito E o token público antigo, vazio e inventados são todos RECUSADOS (verificação da rotação)
const url = process.env.WEBAPP_URL, token = process.env.WEBAPP_TOKEN, modo = (process.argv[2] || "aceito").toLowerCase();
if (!url || !token) { console.error("Defina WEBAPP_URL e WEBAPP_TOKEN (variáveis de ambiente)."); process.exit(2); }
if (!["aceito", "recusado", "apos-rotacao"].includes(modo)) { console.error("Primeiro argumento: aceito | recusado | apos-rotacao"); process.exit(2); }
async function sondar(t) {
  const r = await fetch(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ acao: "confirmar", token: t, itens: [{ id_linha: "ZZZ-SONDA-INEXISTENTE", ceg: "X", nome_do_item: "X", valor_item: 1, frete_inter: 0, taxa_rf: 0 }] }) });
  const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch { /* ilegível */ }
  const recusado = !!j && /Token inválido|não configurado/.test(String(j.erro || ""));
  const aceito = !!j && !recusado && Array.isArray(j.nao_processados) && j.nao_processados.some(n => n.motivo === "nao_encontrado") && Number(j.updated) === 0 && j.sync == null;
  return { status: r.status, recusado, aceito, bruto: txt.slice(0, 120).replace(/[A-Za-z0-9_-]{24,}/g, "***") };
}
const descr = r => r.recusado ? "TOKEN RECUSADO" : r.aceito ? "aceito (item inexistente: nada gravado, sem sync)" : "resposta inesperada: " + r.bruto;
let falhas = 0;
const confere = (rotulo, r, esperado) => { const ok = esperado === "aceito" ? r.aceito : r.recusado; if (!ok) falhas++; console.log(`${ok ? "OK   " : "FALHA"} ${rotulo}: HTTP ${r.status} · ${descr(r)} [esperado ${esperado}]`); };
if (modo === "apos-rotacao") {
  confere("token NOVO (o do servidor)", await sondar(token), "aceito");
  confere("token público antigo do site (anticeg-pag-2026)", await sondar("anticeg-pag-2026"), "recusado");
  confere("token vazio", await sondar(""), "recusado");
  confere("token inventado", await sondar("inventado-" + Math.random().toString(36).slice(2)), "recusado");
  confere("token novo com 1 caractere a menos", await sondar(token.slice(0, -1)), "recusado");
  confere("token novo em maiúsculas", await sondar(token.toUpperCase() === token ? token + "x" : token.toUpperCase()), "recusado");
} else confere("WEBAPP_TOKEN", await sondar(token), modo);
console.log(falhas ? `\n${falhas} verificação(ões) fora do esperado` : "\nTODAS AS VERIFICAÇÕES PASSARAM (nada foi gravado)");
process.exit(falhas ? 1 : 0);
