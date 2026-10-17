// Sondagem DIRETA do Web App do Apps Script, sem gravar nada: usa um id_linha que não existe, então a ação `confirmar` só LÊ e responde "nao_encontrado" (sem escrita e sem disparar sync).
// O token e a URL vêm de variáveis de ambiente e NUNCA são impressos.
// Uso (PowerShell):  $env:WEBAPP_URL="https://script.google.com/macros/s/.../exec"; $env:WEBAPP_TOKEN="<token a testar>"; node scripts/lancamento/sondar-webapp.mjs [esperado: aceito|recusado]
const url = process.env.WEBAPP_URL, token = process.env.WEBAPP_TOKEN, esperado = (process.argv[2] || "aceito").toLowerCase();
if (!url || !token) { console.error("Defina WEBAPP_URL e WEBAPP_TOKEN (variáveis de ambiente)."); process.exit(2); }
if (!["aceito", "recusado"].includes(esperado)) { console.error("Segundo argumento: aceito | recusado"); process.exit(2); }
const r = await fetch(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ acao: "confirmar", token, itens: [{ id_linha: "ZZZ-SONDA-INEXISTENTE", ceg: "X", nome_do_item: "X", valor_item: 1, frete_inter: 0, taxa_rf: 0 }] }) });
const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch { /* ilegível */ }
const recusado = !!j && /Token inválido|não configurado/.test(String(j.erro || ""));
const aceito = !!j && !recusado && Array.isArray(j.nao_processados) && j.nao_processados.some(n => n.motivo === "nao_encontrado") && Number(j.updated) === 0 && j.sync == null;
console.log(`HTTP ${r.status} | ${recusado ? "TOKEN RECUSADO" : aceito ? "token aceito (item inexistente: nada gravado, sem sync)" : "resposta inesperada: " + txt.slice(0, 120).replace(/[A-Za-z0-9_-]{24,}/g, "***")}`);
const ok = esperado === "aceito" ? aceito : recusado;
console.log(ok ? `OK: resultado igual ao esperado (${esperado})` : `FALHA: esperado ${esperado}`);
process.exit(ok ? 0 : 1);
